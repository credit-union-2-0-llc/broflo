import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, StatusChangeSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderStatusHistoryService {
  private readonly log = new Logger(OrderStatusHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    orderId: string,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    source: StatusChangeSource = 'system',
    metadata?: Record<string, unknown>,
  ) {
    this.log.debug(
      `Status change: ${fromStatus ?? 'null'} → ${toStatus} [${source}] for order ${orderId}`,
    );
    return this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        source,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
        changedAt: new Date(),
      },
    });
  }

  async getTimeline(orderId: string) {
    return this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { changedAt: 'asc' },
    });
  }
}
