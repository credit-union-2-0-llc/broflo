import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { OrdersService } from '../orders.service';
import { PlaceOrderDto } from '../dto/place-order.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderAuditService } from '../audit/order-audit.service';
import { OrderStatusHistoryService } from '../order-status-history.service';
import { StripeConnectService } from '../stripe-connect.service';

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

  it('throws BadRequestException for a browser-agent order instead of calling the retailer adapter', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: orderId,
      userId,
      status: 'ordered',
      placedAt: new Date(),
      retailerKey: 'browser-agent',
      retailerOrderId: 'REAL-CONF-123',
      giftRecordId: null,
      stripePaymentIntentId: null,
    });

    await expect(service.cancel(userId, orderId)).rejects.toThrow(BadRequestException);
    await expect(service.cancel(userId, orderId)).rejects.toMatchObject({
      message: expect.stringContaining("can't be cancelled through the app yet"),
    });
    expect(adapter.cancelOrder).not.toHaveBeenCalled();
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
        data: { trackingNumber: '1Z999', trackingUrl: undefined, carrierName: 'UPS' },
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

describe('OrdersService - place idempotency (B2)', () => {
  let service: OrdersService;
  let prisma: {
    order: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    giftSuggestion: { findFirst: jest.Mock };
  };
  let adapter: { retailerKey: string; getProduct: jest.Mock; placeOrder: jest.Mock };
  let stripeConnect: {
    createCharge: jest.Mock;
    calculateFeeCents: jest.Mock;
    getConnectedAccountId: jest.Mock;
    refund: jest.Mock;
  };

  const user = { id: 'user-123', stripePaymentMethodId: 'pm_1' } as unknown as User;
  const key = 'idem-key-abc';
  const dto: PlaceOrderDto = {
    suggestionId: 'sug-1',
    personId: 'per-1',
    eventId: 'evt-1',
    retailerProductId: 'prod-1',
    shippingName: 'Alex',
    shippingAddress1: '1 Main St',
    shippingCity: 'Ashland',
    shippingState: 'OR',
    shippingZip: '97520',
  };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      giftSuggestion: { findFirst: jest.fn() },
    };
    adapter = {
      retailerKey: 'mock',
      getProduct: jest.fn().mockResolvedValue({
        id: 'prod-1',
        title: 'A Gift',
        description: 'desc',
        imageUrl: null,
        priceCents: 5000,
      }),
      placeOrder: jest.fn(),
    };
    stripeConnect = {
      createCharge: jest.fn(),
      calculateFeeCents: jest.fn().mockReturnValue(0),
      getConnectedAccountId: jest.fn().mockReturnValue(null), // mock flow, no real charge
      refund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'RETAILER_ADAPTER', useValue: adapter },
        { provide: OrderAuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: OrderStatusHistoryService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: StripeConnectService, useValue: stripeConnect },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('returns the existing order without creating or charging again when the key was already used by the same user', async () => {
    const existing = { id: 'order-existing', userId: user.id, status: 'ordered' };
    prisma.order.findUnique.mockResolvedValue(existing);

    const result = await service.place(user, dto, key);

    expect(result).toBe(existing);
    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(adapter.getProduct).not.toHaveBeenCalled();
    expect(stripeConnect.createCharge).not.toHaveBeenCalled();
  });

  it('rejects when the idempotency key belongs to a different user', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o', userId: 'someone-else' });

    await expect(service.place(user, dto, key)).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('returns the race winner (no second charge) when create hits a P2002 unique violation', async () => {
    const winner = { id: 'order-winner', userId: user.id, status: 'ordered' };
    prisma.order.findUnique
      .mockResolvedValueOnce(null) // first check: nothing yet
      .mockResolvedValueOnce(winner); // after P2002: the concurrent winner
    prisma.giftSuggestion.findFirst.mockResolvedValue({ id: dto.suggestionId });
    prisma.order.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.place(user, dto, key);

    expect(result).toBe(winner);
    expect(stripeConnect.createCharge).not.toHaveBeenCalled();
  });
});
