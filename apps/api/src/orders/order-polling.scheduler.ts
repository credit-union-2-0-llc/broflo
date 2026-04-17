import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { RetailerAdapter, OrderStatusResult } from './adapters/retailer.adapter';
import { OrderStatus, StatusChangeSource } from '@prisma/client';

const POLL_BATCH_SIZE = 10;

@Injectable()
export class OrderPollingScheduler {
  private readonly log = new Logger(OrderPollingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject('RETAILER_ADAPTER') private readonly adapter: RetailerAdapter,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pollActiveOrders() {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['ordered', 'processing', 'shipped'] },
        retailerOrderId: { not: null },
      },
      select: { id: true, retailerOrderId: true, status: true },
    });

    if (activeOrders.length === 0) return;

    this.log.debug(`Polling ${activeOrders.length} active orders`);

    for (let i = 0; i < activeOrders.length; i += POLL_BATCH_SIZE) {
      const batch = activeOrders.slice(i, i + POLL_BATCH_SIZE);
      await Promise.allSettled(batch.map((order) => this.pollOrder(order)));
    }
  }

  private async pollOrder(order: { id: string; retailerOrderId: string | null; status: string }) {
    try {
      const result: OrderStatusResult = await this.adapter.getOrderStatus(
        order.retailerOrderId!,
      );

      if (result.status !== order.status) {
        await this.orders.transitionStatus(
          order.id,
          result.status as OrderStatus,
          'system' as StatusChangeSource,
          {
            trackingNumber: result.trackingNumber,
            trackingUrl: result.trackingUrl,
            carrierName: result.carrierName,
            metadata: { source: 'polling' },
          },
        );
        this.log.log(
          `Order ${order.id}: ${order.status} → ${result.status}`,
        );
      }
    } catch (err) {
      this.log.error(`Polling failed for order ${order.id}: ${err}`);
    }
  }
}
