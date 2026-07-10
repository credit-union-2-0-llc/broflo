import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { RetailerAdapter, OrderStatusResult } from './adapters/retailer.adapter';
import { OrderStatus, StatusChangeSource } from '@prisma/client';
import { CarrierTrackingService } from './carriers/carrier-tracking.service';

const POLL_BATCH_SIZE = 10;

// The status values a live carrier ever reports us — carriers have no concept
// of our internal 'ordered'/'processing' states, so a carrier-tracked order
// always starts at one of those and is walked forward through STATUS_SEQUENCE
// below until it reaches whatever the carrier says.
const STATUS_SEQUENCE: OrderStatus[] = ['ordered', 'processing', 'shipped', 'delivered'];

// USPS's 2026 API caps at 60 requests/hour; with a 15-min cron (4 runs/hour)
// this keeps us well under budget even accounting for other USPS calls.
const USPS_MAX_POLLS_PER_RUN = 8;

@Injectable()
export class OrderPollingScheduler {
  private readonly log = new Logger(OrderPollingScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject('RETAILER_ADAPTER') private readonly adapter: RetailerAdapter,
    private readonly carrierTracking: CarrierTrackingService,
  ) {
    this.enabled = process.env.ORDER_POLLING_ENABLED === 'true';
    if (!this.enabled) this.log.warn('Order polling disabled (ORDER_POLLING_ENABLED != true)');
  }

  @Cron('*/15 * * * *')
  async pollActiveOrders() {
    if (!this.enabled) return;
    await this.pollRetailerOrders();
    await this.pollCarrierTrackedOrders();
  }

  private async pollRetailerOrders() {
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

  // Manual orders (retailerKey: 'manual') with a detected carrierKey and a
  // tracking number — polled against the live carrier API instead of a
  // retailer adapter. Orders whose carrier has no adapter configured yet are
  // silently skipped (same "inert until configured" behavior as the adapters
  // themselves), so this is a no-op until Jasper adds a carrier's credentials.
  private async pollCarrierTrackedOrders() {
    const carrierOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['ordered', 'processing', 'shipped'] },
        carrierKey: { not: null },
        trackingNumber: { not: null },
      },
      select: { id: true, status: true, carrierKey: true, trackingNumber: true },
    });

    if (carrierOrders.length === 0) return;

    this.log.debug(`Polling ${carrierOrders.length} carrier-tracked orders`);

    let uspsPollsThisRun = 0;
    for (let i = 0; i < carrierOrders.length; i += POLL_BATCH_SIZE) {
      const batch = carrierOrders.slice(i, i + POLL_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((order) => {
          if (order.carrierKey === 'usps') {
            if (uspsPollsThisRun >= USPS_MAX_POLLS_PER_RUN) return Promise.resolve();
            uspsPollsThisRun++;
          }
          return this.pollCarrierOrder(order);
        }),
      );
    }
  }

  private async pollCarrierOrder(order: {
    id: string;
    status: string;
    carrierKey: string | null;
    trackingNumber: string | null;
  }) {
    const trackingAdapter = this.carrierTracking.getAdapter(order.carrierKey!);
    if (!trackingAdapter) return;

    try {
      const result = await trackingAdapter.getTrackingStatus(order.trackingNumber!);

      if (result.status !== order.status) {
        await this.advanceCarrierOrderStatus(order, result.status as OrderStatus, {
          estimatedDeliveryDate: result.estimatedDeliveryDate,
          metadata: { source: 'carrier_polling', lastEventDescription: result.lastEventDescription },
        });
        this.log.log(`Order ${order.id}: ${order.status} → ${result.status} (${order.carrierKey})`);
      }
    } catch (err) {
      this.log.error(`Carrier polling failed for order ${order.id} (${order.carrierKey}): ${err}`);
    }
  }

  // Carriers only ever report shipped/delivered/failed — never our
  // intermediate 'processing' state — so a jump like ordered → shipped is
  // walked one valid transition at a time rather than attempted directly.
  private async advanceCarrierOrderStatus(
    order: { id: string; status: string },
    targetStatus: OrderStatus,
    extra: { estimatedDeliveryDate?: Date; metadata?: Record<string, unknown> },
  ) {
    if (targetStatus === 'failed') {
      await this.orders.transitionStatus(order.id, 'failed', 'system' as StatusChangeSource, extra);
      return;
    }

    const currentIndex = STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
    const targetIndex = STATUS_SEQUENCE.indexOf(targetStatus);
    if (currentIndex === -1 || targetIndex === -1 || targetIndex <= currentIndex) return;

    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      await this.orders.transitionStatus(
        order.id,
        STATUS_SEQUENCE[i],
        'system' as StatusChangeSource,
        extra,
      );
    }
  }
}
