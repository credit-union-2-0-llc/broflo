import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderStatusHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        reason: reason ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
}