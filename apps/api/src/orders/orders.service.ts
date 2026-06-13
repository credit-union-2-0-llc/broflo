import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewOrderDto } from './dto/preview-order.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { RetailerAdapter } from './adapters/retailer.adapter';
import { OrderAuditService } from './audit/order-audit.service';
import { OrderStatusHistoryService } from './order-status-history.service';
import { StripeConnectService } from './stripe-connect.service';
import { OrderStatus } from '@prisma/client';

interface ChargeResult {
  orderId: string;
  customerId: string;
  paymentIntentId?: string;
  amountCents?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('RETAILER_ADAPTER') private readonly adapter: RetailerAdapter,
    private readonly auditService: OrderAuditService,
    private readonly statusHistoryService: OrderStatusHistoryService,
    private readonly stripeConnect: StripeConnectService,
  ) {}

  async preview(dto: PreviewOrderDto) {
    const results = await this.adapter.searchProducts({
      keyword: dto.keyword ?? '',
      minBudgetCents: dto.minBudgetCents ?? 0,
      maxBudgetCents: dto.maxBudgetCents ?? 999999,
    });
    return { products: results };
  }

  async place(dto: PlaceOrderDto): Promise<ChargeResult> {
    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, userId: dto.userId },
    });
    if (!person) throw new NotFoundException('Person not found');

    await this.statusHistoryService.record(
      'pending',
      OrderStatus.pending,
      OrderStatus.ordered,
    );

    let chargeResult: ChargeResult;
    try {
      const connectedAccountId = this.stripeConnect.getConnectedAccountId(dto.retailerSlug);
      const feeCents = this.stripeConnect.calculateFeeCents(dto.amountCents);

      if (connectedAccountId) {
        const charge = await this.stripeConnect.createCharge({
          customerId: dto.userId,
          amountCents: dto.amountCents,
          feeCents,
          connectedAccountId,
          metadata: { personId: dto.personId },
        });
        chargeResult = {
          orderId: 'pending',
          customerId: dto.userId,
          paymentIntentId: charge?.paymentIntentId,
          amountCents: dto.amountCents,
        };
      } else {
        chargeResult = {
          orderId: 'pending',
          customerId: dto.userId,
          amountCents: dto.amountCents,
        };
      }
    } catch (err) {
      throw new BadRequestException(`Payment failed: ${(err as Error).message}`);
    }

    const retailerResult = await this.adapter.placeOrder({
      keyword: dto.keyword ?? '',
      minBudgetCents: dto.amountCents,
      maxBudgetCents: dto.amountCents,
      retailerProductId: dto.retailerProductId,
      shippingAddress: {
        name: person.name ?? '',
        line1: person.shippingAddress1 ?? '',
        city: person.shippingCity ?? '',
        state: person.shippingState ?? '',
        zip: person.shippingZip ?? '',
      },
    });

    const order = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        personId: dto.personId,
        retailerSlug: dto.retailerSlug,
        retailerOrderId: retailerResult.retailerOrderId,
        retailerProductId: dto.retailerProductId,
        status: OrderStatus.ordered,
        amountCents: dto.amountCents,
        stripePaymentIntentId: chargeResult.paymentIntentId ?? null,
        placedAt: new Date(),
      },
    });

    if (dto.giftRecordId) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { giftRecordId: dto.giftRecordId },
      });
    }

    await this.auditService.record(order.id, 'placed', dto.userId, {
      amountCents: dto.amountCents,
      retailerSlug: dto.retailerSlug,
    });

    await this.statusHistoryService.record(
      order.id,
      OrderStatus.pending,
      OrderStatus.ordered,
    );

    return {
      orderId: order.id,
      customerId: dto.userId,
      paymentIntentId: chargeResult.paymentIntentId,
      amountCents: dto.amountCents,
    };
  }

  async cancel(userId: string, orderId: string, _dto?: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const cancellableStatuses: OrderStatus[] = [OrderStatus.ordered, OrderStatus.confirmed];
    if (!cancellableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(`Order cannot be cancelled in status: ${order.status}`);
    }

    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (order.placedAt && Date.now() - order.placedAt.getTime() > twoHoursMs) {
      throw new BadRequestException('Cancel window has closed (2-hour limit exceeded)');
    }

    await this.adapter.cancelOrder(order.retailerOrderId ?? '');

    if (order.stripePaymentIntentId) {
      await this.stripeConnect.refund(order.stripePaymentIntentId);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.cancelled },
    });

    await this.auditService.record(orderId, 'cancelled', userId, {});

    await this.statusHistoryService.record(
      orderId,
      order.status as OrderStatus,
      OrderStatus.cancelled,
    );

    return updated;
  }

  async list(userId: string, dto: ListOrdersDto) {
    const { page = 1, limit = 20, status } = dto;
    const where = {
      userId,
      ...(status ? { status: status as OrderStatus } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data: orders, meta: { page, limit, total } };
  }

  async get(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}