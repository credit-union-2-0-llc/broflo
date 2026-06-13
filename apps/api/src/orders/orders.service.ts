import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderAuditService } from './audit/order-audit.service';
import { OrderStatusHistoryService } from './order-status-history.service';
import { StripeConnectService } from './stripe-connect.service';
import { RetailerAdapter } from './adapters/retailer.adapter';
import { PlaceOrderDto } from './dto/place-order.dto';
import { PreviewOrderDto } from './dto/preview-order.dto';

const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('RETAILER_ADAPTER') private readonly adapter: RetailerAdapter,
    private readonly audit: OrderAuditService,
    private readonly history: OrderStatusHistoryService,
    private readonly stripe: StripeConnectService,
  ) {}

  async preview(userId: string, dto: PreviewOrderDto) {
    const product = await this.adapter.previewOrder({
      userId,
      productUrl: dto.productUrl,
      budgetCents: dto.budgetCents,
    });
    return { product };
  }

  async place(userId: string, dto: PlaceOrderDto) {
    const feeCents = this.stripe.calculateFeeCents(dto.priceCents);
    const connectedAccountId = this.stripe.getConnectedAccountId(dto.retailerHint);

    const charge = await this.stripe.createCharge({
      userId,
      amountCents: dto.priceCents + feeCents,
      connectedAccountId,
      metadata: { personId: dto.personId },
    });

    const order = await this.prisma.order.create({
      data: {
        userId,
        personId: dto.personId,
        giftRecordId: dto.giftRecordId ?? null,
        retailerOrderId: null,
        status: 'pending',
        productTitle: dto.productTitle,
        productImageUrl: dto.productImageUrl ?? null,
        productUrl: dto.productUrl,
        priceCents: dto.priceCents,
        feeCents,
        stripePaymentIntentId: charge.paymentIntentId,
        placedAt: new Date(),
      },
    });

    await this.audit.record({
      orderId: order.id,
      userId,
      action: 'place',
      metadata: { priceCents: dto.priceCents },
    });

    await this.history.record(order.id, 'pending', 'ordered');

    const retailerResult = await this.adapter.placeOrder({
      orderId: order.id,
      userId,
      productUrl: dto.productUrl,
      priceCents: dto.priceCents,
      shippingAddress: dto.shippingAddress,
    });

    if (!retailerResult.success) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });

      await this.audit.record({
        orderId: order.id,
        userId,
        action: 'place_failed',
        metadata: { reason: retailerResult.error },
      });

      await this.history.record(order.id, 'ordered', 'failed');

      throw new BadRequestException('Retailer order placement failed');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'ordered',
        retailerOrderId: retailerResult.retailerOrderId ?? null,
      },
    });

    return updated;
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const cancellableStatuses = ['pending', 'ordered'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order with status '${order.status}' cannot be cancelled`,
      );
    }

    const now = Date.now();
    const placedAt = order.placedAt ? new Date(order.placedAt).getTime() : now;
    if (now - placedAt > CANCEL_WINDOW_MS) {
      throw new BadRequestException(
        'Cancel window has closed (orders can only be cancelled within 2 hours of placement)',
      );
    }

    if (order.stripePaymentIntentId) {
      await this.stripe.refund(order.stripePaymentIntentId, orderId);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });

    await this.audit.record({
      orderId,
      userId,
      action: 'cancel',
      metadata: {},
    });

    await this.history.record(orderId, order.status, 'cancelled');

    try {
      await this.adapter.cancelOrder({ orderId, retailerOrderId: order.retailerOrderId });
    } catch {
      // best-effort retailer cancellation; order is already marked cancelled
    }

    return updated;
  }

  async list(userId: string, page = 1, limit = 20) {
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data: orders, meta: { page, limit, total } };
  }

  async getById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}