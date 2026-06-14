import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RetailerAdapter } from './adapters/retailer.adapter';
import { OrderAuditService } from './audit/order-audit.service';
import { OrderStatusHistoryService } from './order-status-history.service';
import { StripeConnectService } from './stripe-connect.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { PreviewOrderDto } from './dto/preview-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ApplicableFrameworks } from '../compliance/applicable-frameworks.decorator';

const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('RETAILER_ADAPTER') private readonly retailer: RetailerAdapter,
    private readonly auditService: OrderAuditService,
    private readonly statusHistory: OrderStatusHistoryService,
    private readonly stripeConnect: StripeConnectService,
  ) {}

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  async preview(userId: string, dto: PreviewOrderDto) {
    const result = await this.retailer.previewOrder({
      productUrl: dto.productUrl,
      productTitle: dto.productTitle,
      productPriceCents: dto.productPriceCents,
    });
    return result;
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  async place(userId: string, dto: PlaceOrderDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const totalCents =
      (dto.productPriceCents ?? 0) + (dto.shippingCents ?? 0);

    const feeCents = this.stripeConnect.calculateFeeCents(totalCents);
    const connectedAccountId = this.stripeConnect.getConnectedAccountId(
      dto.retailerSlug ?? null,
    );

    let stripePaymentIntentId: string | null = null;
    if (user.stripePaymentMethodId && user.stripeCustomerId) {
      const charge = await this.stripeConnect.createCharge({
        amountCents: totalCents,
        feeCents,
        customerId: user.stripeCustomerId,
        paymentMethodId: user.stripePaymentMethodId,
        connectedAccountId,
      });
      stripePaymentIntentId = charge.paymentIntentId ?? null;
    }

    const retailerResult = await this.retailer.placeOrder({
      productUrl: dto.productUrl,
      productTitle: dto.productTitle,
      productPriceCents: dto.productPriceCents,
      productImageUrl: dto.productImageUrl ?? null,
      shippingCents: dto.shippingCents ?? 0,
      shippingAddress1: dto.shippingAddress1,
      shippingAddress2: dto.shippingAddress2 ?? null,
      shippingCity: dto.shippingCity,
      shippingState: dto.shippingState,
      shippingZip: dto.shippingZip,
      shippingCountry: dto.shippingCountry ?? 'US',
      recipientName: dto.recipientName,
      recipientEmail: dto.recipientEmail ?? null,
      retailerSlug: dto.retailerSlug ?? null,
    });

    const order = await this.prisma.order.create({
      data: {
        userId,
        status: 'ordered',
        placedAt: new Date(),
        productUrl: dto.productUrl,
        productTitle: dto.productTitle,
        productPriceCents: dto.productPriceCents,
        productImageUrl: dto.productImageUrl ?? null,
        shippingCents: dto.shippingCents ?? 0,
        shippingAddress1: dto.shippingAddress1,
        shippingAddress2: dto.shippingAddress2 ?? null,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        shippingZip: dto.shippingZip,
        shippingCountry: dto.shippingCountry ?? 'US',
        recipientName: dto.recipientName,
        recipientEmail: dto.recipientEmail ?? null,
        retailerSlug: dto.retailerSlug ?? null,
        retailerOrderId: retailerResult.retailerOrderId ?? null,
        stripePaymentIntentId,
        giftRecordId: dto.giftRecordId ?? null,
      },
    });

    await this.auditService.recordWithFrameworks(
      order.id,
      'created',
      `user-${userId}`,
      ['GDPR', 'CCPA', 'GLBA'],
      { totalCents, retailerOrderId: retailerResult.retailerOrderId },
    );

    return order;
  }

  async list(userId: string, dto: ListOrdersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { placedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return { orders, total, page, limit };
  }

  async get(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  async cancel(userId: string, orderId: string, _dto?: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const cancellableStatuses = ['ordered', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order with status "${order.status}" cannot be cancelled`,
      );
    }

    const placedAt = order.placedAt ? new Date(order.placedAt).getTime() : 0;
    const elapsed = Date.now() - placedAt;
    if (elapsed > CANCEL_WINDOW_MS) {
      throw new BadRequestException(
        'Cancel window has closed (2 hours after placement)',
      );
    }

    // Attempt retailer cancellation
    if (order.retailerOrderId) {
      await this.retailer.cancelOrder(order.retailerOrderId);
    }

    // Refund if payment was captured
    if (order.stripePaymentIntentId) {
      await this.stripeConnect.refund(order.stripePaymentIntentId);
    }

    const previousStatus = order.status;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });

    await this.statusHistory.record(orderId, previousStatus, 'cancelled', 'user');

    await this.auditService.recordWithFrameworks(
      orderId,
      'cancelled',
      `user-${userId}`,
      ['GDPR', 'CCPA', 'GLBA'],
      { previousStatus: order.status },
    );

    return updated;
  }

  async updateStatus(
    orderId: string,
    newStatus: string,
    changedBy: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const previousStatus = order.status;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    await this.statusHistory.record(orderId, previousStatus, newStatus, changedBy);

    await this.auditService.record(
      orderId,
      'status_changed',
      changedBy,
      { previousStatus, newStatus },
    );

    return updated;
  }

  async adminUpdateStatus(
    orderId: string,
    newStatus: string,
  ) {
    return this.updateStatus(orderId, newStatus, 'system');
  }

  async getWithAudit(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        auditEntries: {
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async markShipped(orderId: string, trackingNumber?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const previousStatus = order.status;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'shipped',
        ...(trackingNumber ? { trackingNumber } : {}),
      },
    });

    await this.statusHistory.record(orderId, previousStatus, 'shipped', 'system');

    await this.auditService.record(
      orderId,
      'status_changed',
      'system',
      { previousStatus, newStatus: 'shipped' },
    );

    return updated;
  }

  async markDelivered(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const previousStatus = order.status;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'delivered' },
    });

    await this.statusHistory.record(orderId, previousStatus, 'delivered', 'system');

    await this.auditService.record(
      orderId,
      'status_changed',
      'system',
      { previousStatus, newStatus: 'delivered' },
    );

    return updated;
  }
}