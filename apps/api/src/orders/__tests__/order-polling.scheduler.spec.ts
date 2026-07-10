import { OrderPollingScheduler } from '../order-polling.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders.service';
import { RetailerAdapter } from '../adapters/retailer.adapter';
import { CarrierTrackingService } from '../carriers/carrier-tracking.service';

describe('OrderPollingScheduler', () => {
  let prisma: { order: { findMany: jest.Mock } };
  let orders: { transitionStatus: jest.Mock };
  let retailerAdapter: { getOrderStatus: jest.Mock };
  let carrierTracking: { getAdapter: jest.Mock };
  let scheduler: OrderPollingScheduler;

  function buildScheduler() {
    return new OrderPollingScheduler(
      prisma as unknown as PrismaService,
      orders as unknown as OrdersService,
      retailerAdapter as unknown as RetailerAdapter,
      carrierTracking as unknown as CarrierTrackingService,
    );
  }

  beforeEach(() => {
    process.env.ORDER_POLLING_ENABLED = 'true';

    prisma = { order: { findMany: jest.fn().mockResolvedValue([]) } };
    orders = { transitionStatus: jest.fn().mockResolvedValue(undefined) };
    retailerAdapter = { getOrderStatus: jest.fn() };
    carrierTracking = { getAdapter: jest.fn() };

    scheduler = buildScheduler();
  });

  afterEach(() => {
    delete process.env.ORDER_POLLING_ENABLED;
  });

  it('does nothing when polling is disabled', async () => {
    process.env.ORDER_POLLING_ENABLED = 'false';
    const disabledScheduler = buildScheduler();
    await disabledScheduler.pollActiveOrders();
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('still polls retailer-adapter orders unaffected by the carrier path', async () => {
    prisma.order.findMany
      .mockResolvedValueOnce([{ id: 'order-1', retailerOrderId: 'RET-1', status: 'ordered' }])
      .mockResolvedValueOnce([]);
    retailerAdapter.getOrderStatus.mockResolvedValue({
      status: 'processing',
      trackingNumber: null,
      trackingUrl: null,
      carrierName: null,
    });

    await scheduler.pollActiveOrders();

    expect(retailerAdapter.getOrderStatus).toHaveBeenCalledWith('RET-1');
    expect(orders.transitionStatus).toHaveBeenCalledWith(
      'order-1',
      'processing',
      'system',
      expect.objectContaining({ metadata: { source: 'polling' } }),
    );
  });

  it('walks a carrier-tracked order forward one valid transition at a time to reach "shipped"', async () => {
    prisma.order.findMany
      .mockResolvedValueOnce([]) // retailer orders
      .mockResolvedValueOnce([
        { id: 'order-2', status: 'ordered', carrierKey: 'ups', trackingNumber: '1Z999AA10123456784' },
      ]);
    const adapter = {
      getTrackingStatus: jest.fn().mockResolvedValue({ status: 'shipped', lastEventDescription: 'In transit' }),
    };
    carrierTracking.getAdapter.mockReturnValue(adapter);

    await scheduler.pollActiveOrders();

    expect(adapter.getTrackingStatus).toHaveBeenCalledWith('1Z999AA10123456784');
    // ordered -> processing -> shipped: two intermediate transitionStatus calls
    expect(orders.transitionStatus).toHaveBeenNthCalledWith(
      1,
      'order-2',
      'processing',
      'system',
      expect.any(Object),
    );
    expect(orders.transitionStatus).toHaveBeenNthCalledWith(
      2,
      'order-2',
      'shipped',
      'system',
      expect.any(Object),
    );
  });

  it('skips a carrier-tracked order whose carrier has no configured adapter', async () => {
    prisma.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'order-3', status: 'shipped', carrierKey: 'fedex', trackingNumber: '999999999999' },
      ]);
    carrierTracking.getAdapter.mockReturnValue(null);

    await scheduler.pollActiveOrders();

    expect(orders.transitionStatus).not.toHaveBeenCalled();
  });

  it('caps USPS polls at the per-run limit, leaving the rest for the next run', async () => {
    const uspsOrders = Array.from({ length: 10 }, (_, i) => ({
      id: `order-usps-${i}`,
      status: 'shipped',
      carrierKey: 'usps',
      trackingNumber: `940011120255584276${i}`,
    }));
    prisma.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(uspsOrders);
    const adapter = {
      getTrackingStatus: jest.fn().mockResolvedValue({ status: 'delivered' }),
    };
    carrierTracking.getAdapter.mockReturnValue(adapter);

    await scheduler.pollActiveOrders();

    expect(adapter.getTrackingStatus).toHaveBeenCalledTimes(8);
  });

  it('goes straight to failed regardless of the current status', async () => {
    prisma.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'order-4', status: 'shipped', carrierKey: 'ups', trackingNumber: '1Z999AA10123456784' },
      ]);
    const adapter = {
      getTrackingStatus: jest.fn().mockResolvedValue({ status: 'failed' }),
    };
    carrierTracking.getAdapter.mockReturnValue(adapter);

    await scheduler.pollActiveOrders();

    expect(orders.transitionStatus).toHaveBeenCalledTimes(1);
    expect(orders.transitionStatus).toHaveBeenCalledWith('order-4', 'failed', 'system', expect.any(Object));
  });
});
