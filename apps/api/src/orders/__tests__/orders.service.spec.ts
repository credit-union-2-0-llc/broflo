import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderAuditService } from '../audit/order-audit.service';
import { OrderStatusHistoryService } from '../order-status-history.service';
import { StripeConnectService } from '../stripe-connect.service';
import { CarrierDetectionService } from '../carriers/carrier-detection.service';

describe('OrdersService - cancel window', () => {
  let service: OrdersService;
  let prisma: {
    order: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    person: { findFirst: jest.Mock };
    giftRecord: { findFirst: jest.Mock; update: jest.Mock };
  };
  let adapter: { cancelOrder: jest.Mock };
  let stripeConnect: { refund: jest.Mock; createCharge: jest.Mock; calculateFeeCents: jest.Mock; getConnectedAccountId: jest.Mock };
  let statusHistory: { record: jest.Mock };
  let auditRecord: jest.Mock;

  beforeEach(async () => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      person: {
        findFirst: jest.fn(),
      },
      giftRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    adapter = {
      cancelOrder: jest.fn().mockResolvedValue({ success: true }),
    };

    stripeConnect = {
      refund: jest.fn().mockResolvedValue(undefined),
      createCharge: jest.fn(),
      calculateFeeCents: jest.fn().mockReturnValue(0),
      getConnectedAccountId: jest.fn().mockReturnValue(null),
    };

    auditRecord = jest.fn().mockResolvedValue(undefined);
    statusHistory = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'RETAILER_ADAPTER', useValue: adapter },
        { provide: OrderAuditService, useValue: { record: auditRecord } },
        { provide: OrderStatusHistoryService, useValue: statusHistory },
        { provide: StripeConnectService, useValue: stripeConnect },
        CarrierDetectionService,
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  const userId = 'user-123';
  const orderId = 'order-456';

  it('throws BadRequestException when order.placedAt is > 2 hours ago', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: orderId,
      userId,
      status: 'ordered',
      placedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      retailerOrderId: 'MOCK-123',
      giftRecordId: null,
      stripePaymentIntentId: null,
    });

    await expect(service.cancel(userId, orderId)).rejects.toThrow(BadRequestException);
    await expect(service.cancel(userId, orderId)).rejects.toMatchObject({
      message: expect.stringContaining('Cancel window has closed'),
    });
  });

  it('succeeds when order.placedAt is < 2 hours ago', async () => {
    const mockOrder = {
      id: orderId,
      userId,
      status: 'ordered',
      placedAt: new Date(), // just now
      retailerOrderId: 'MOCK-123',
      giftRecordId: null,
      stripePaymentIntentId: null,
    };
    prisma.order.findFirst.mockResolvedValue(mockOrder);
    prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'cancelled' });

    await expect(service.cancel(userId, orderId)).resolves.toBeDefined();
  });

  it('throws BadRequestException when order status is shipped', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: orderId,
      userId,
      status: 'shipped',
      placedAt: new Date(), // recent, but wrong status
      retailerOrderId: 'MOCK-123',
      giftRecordId: null,
      stripePaymentIntentId: null,
    });

    await expect(service.cancel(userId, orderId)).rejects.toThrow(BadRequestException);
    await expect(service.cancel(userId, orderId)).rejects.toMatchObject({
      message: expect.stringContaining('cannot be cancelled'),
    });
  });

  it('throws NotFoundException when order does not belong to user', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.cancel(userId, orderId)).rejects.toThrow(NotFoundException);
  });

  describe('createManualOrder', () => {
    const person = {
      id: 'person-1',
      userId,
      name: 'Alice',
      shippingAddress1: '123 Main St',
      shippingAddress2: null,
      shippingCity: 'Portland',
      shippingState: 'OR',
      shippingZip: '97201',
    };

    it('throws NotFoundException for a person owned by someone else', async () => {
      prisma.person.findFirst.mockResolvedValue(null);
      await expect(
        service.createManualOrder(userId, { personId: 'person-1', productTitle: 'A Nice Mug' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates an order with retailerKey "manual", backfilling shipping from the person', async () => {
      prisma.person.findFirst.mockResolvedValue(person);
      prisma.order.create.mockResolvedValue({ id: 'order-1', status: 'ordered' });

      await service.createManualOrder(userId, {
        personId: 'person-1',
        productTitle: 'A Nice Mug',
        priceCents: 2500,
        trackingNumber: '1Z999',
      });

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          retailerKey: 'manual',
          retailerProductId: 'manual',
          productTitle: 'A Nice Mug',
          priceCents: 2500,
          status: 'ordered',
          trackingNumber: '1Z999',
          shippingName: 'Alice',
          shippingAddress1: '123 Main St',
          shippingCity: 'Portland',
        }),
      });
      expect(statusHistory.record).toHaveBeenCalledWith('order-1', null, 'ordered', 'manual', expect.any(Object));
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'manual_order_created' }),
      );
    });

    it('falls back to empty shipping fields when the person has no address on file', async () => {
      prisma.person.findFirst.mockResolvedValue({ ...person, shippingAddress1: null, shippingCity: null, shippingState: null, shippingZip: null });
      prisma.order.create.mockResolvedValue({ id: 'order-1', status: 'ordered' });

      await service.createManualOrder(userId, { personId: 'person-1', productTitle: 'A Nice Mug' });

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shippingAddress1: '',
          shippingCity: '',
          shippingState: '',
          shippingZip: '',
        }),
      });
    });

    it('throws NotFoundException when giftRecordId does not belong to the user', async () => {
      prisma.person.findFirst.mockResolvedValue(person);
      prisma.giftRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.createManualOrder(userId, {
          personId: 'person-1',
          productTitle: 'A Nice Mug',
          giftRecordId: 'gift-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTracking', () => {
    it('throws NotFoundException for an order belonging to someone else', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      await expect(
        service.updateTracking(userId, orderId, { trackingNumber: '1Z999' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates tracking fields without changing status when none is provided', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: orderId, userId, status: 'ordered', deliveredAt: null });
      prisma.order.update.mockResolvedValue({ id: orderId, status: 'ordered', trackingNumber: '1Z999' });

      await service.updateTracking(userId, orderId, { trackingNumber: '1Z999', carrierName: 'UPS' });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { trackingNumber: '1Z999', trackingUrl: undefined, carrierName: 'UPS', carrierKey: null },
      });
      expect(statusHistory.record).not.toHaveBeenCalled();
    });

    it('jumps status directly (e.g. ordered -> delivered) bypassing strict transition validation', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: orderId, userId, status: 'ordered', deliveredAt: null });
      prisma.order.update.mockResolvedValue({ id: orderId, status: 'delivered' });

      await service.updateTracking(userId, orderId, { trackingNumber: '1Z999', status: 'delivered' });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: expect.objectContaining({ status: 'delivered', deliveredAt: expect.any(Date) }),
      });
      expect(statusHistory.record).toHaveBeenCalledWith(orderId, 'ordered', 'delivered', 'manual', expect.any(Object));
    });

    it('does not overwrite an existing deliveredAt', async () => {
      const existingDeliveredAt = new Date('2026-01-01');
      prisma.order.findFirst.mockResolvedValue({ id: orderId, userId, status: 'shipped', deliveredAt: existingDeliveredAt });
      prisma.order.update.mockResolvedValue({ id: orderId, status: 'delivered' });

      await service.updateTracking(userId, orderId, { trackingNumber: '1Z999', status: 'delivered' });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: expect.objectContaining({ deliveredAt: undefined }),
      });
    });
  });
});
