import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderAuditService } from '../audit/order-audit.service';

describe('OrdersService - cancel window', () => {
  let service: OrdersService;
  let prisma: { order: { findFirst: jest.Mock; update: jest.Mock } };
  let adapter: { cancelOrder: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    adapter = {
      cancelOrder: jest.fn().mockResolvedValue({ success: true }),
    };

    const auditRecord = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'RETAILER_ADAPTER', useValue: adapter },
        { provide: OrderAuditService, useValue: { record: auditRecord } },
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
});
