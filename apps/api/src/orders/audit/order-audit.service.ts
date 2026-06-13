import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface OrderAuditEntry {
  orderId: string;
  userId: string;
  action:
    | 'preview'
    | 'place'
    | 'cancel'
    | 'place_failed'
    | 'cancel_failed'
    | 'refund'
    | 'refund_failed';
  metadata?: Record<string, unknown>;
}

@Injectable()
export class OrderAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: OrderAuditEntry): Promise<void> {
    await this.prisma.orderAuditLog.create({
      data: {
        orderId: entry.orderId,
        userId: entry.userId,
        action: entry.action,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  }
}