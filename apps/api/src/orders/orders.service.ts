import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RetailerAdapter, RetailerOrderError } from './adapters/retailer.adapter';
import { OrderAuditService } from './audit/order-audit.service';
import { StripeConnectService } from './stripe-connect.service';
import { PreviewOrderDto } from './dto/preview-order.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('RETAILER_ADAPTER') private readonly adapter: RetailerAdapter,
    private readonly orderAudit: OrderAuditService,
    private readonly stripeConnect: StripeConnectService,
  ) {}

  async preview(user: User, dto: PreviewOrderDto) {
    const suggestion = await this.prisma.giftSuggestion.findFirst({
      where: { id: dto.suggestionId, userId: user.id, eventId: dto.eventId },
    });
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, userId: user.id, deletedAt: null },
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    const products = await this.adapter.searchProducts(
      suggestion.retailerHint || suggestion.title,
      suggestion.estimatedPriceMinCents,
      dto.budgetMaxCents ?? suggestion.estimatedPriceMaxCents,
    );

    if (products.length === 0) {
      throw new BadRequestException('No products available for this suggestion');
    }

    const bestMatch = products[0];

    return {
      product: bestMatch,
      suggestion: {
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
      },
      person: {
        id: person.id,
        name: person.name,
        shippingAddress1: person.shippingAddress1,
        shippingAddress2: person.shippingAddress2,
        shippingCity: person.shippingCity,
        shippingState: person.shippingState,
        shippingZip: person.shippingZip,
      },
      cancelWindowHours: 2,
    };
  }

  async place(user: User, dto: PlaceOrderDto) {
    if (!user.stripePaymentMethodId) {
      throw new BadRequestException(
        'No payment method on file. Add one in Billing settings.',
      );
    }

    const suggestion = await this.prisma.giftSuggestion.findFirst({
      where: { id: dto.suggestionId, userId: user.id, eventId: dto.eventId },
    });
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    const product = await this.adapter.getProduct(dto.retailerProductId);

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        personId: dto.personId,
        eventId: dto.eventId,
        giftRecordId: dto.giftRecordId ?? null,
        suggestionId: dto.suggestionId,
        retailerKey: this.adapter.retailerKey,
        retailerProductId: dto.retailerProductId,
        productTitle: product.title,
        productDescription: product.description,
        productImageUrl: product.imageUrl,
        priceCents: product.priceCents,
        platformFeeCents: this.stripeConnect.calculateFeeCents(product.priceCents),
        stripePaymentIntentId: null,
        status: 'pending',
        shippingName: dto.shippingName,
        shippingAddress1: dto.shippingAddress1,
        shippingAddress2: dto.shippingAddress2 ?? null,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        shippingZip: dto.shippingZip,
        placedAt: new Date(),
      },
    });

    // Stripe Connect: charge user with destination transfer to retailer
    let stripePaymentIntentId: string | null = null;
    const connectedAccountId = this.stripeConnect.getConnectedAccountId(this.adapter.retailerKey);

    if (connectedAccountId && user.stripeCustomerId && user.stripePaymentMethodId) {
      try {
        const charge = await this.stripeConnect.createCharge({
          amountCents: product.priceCents,
          customerId: user.stripeCustomerId,
          paymentMethodId: user.stripePaymentMethodId,
          connectedAccountId,
          orderId: order.id,
          userId: user.id,
        });
        stripePaymentIntentId = charge.paymentIntentId;

        // Update order with payment intent ID
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            stripePaymentIntentId,
            platformFeeCents: this.stripeConnect.calculateFeeCents(product.priceCents),
          },
        });
      } catch (err) {
        // Stripe charge failed — mark order as failed, do NOT call retailer
        this.log.error(`Stripe charge failed for order ${order.id}: ${err}`);
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'failed' },
        });
        await this.orderAudit.record({
          orderId: order.id,
          userId: user.id,
          action: 'place_failed',
          details: { reason: 'stripe_charge_failed', error: String(err) },
        });
        throw new InternalServerErrorException('Payment failed. Your card was not charged.');
      }
    } else {
      // No connected account (or no payment method) — mock flow without real charge
      this.log.warn(
        `Skipping Stripe charge for order ${order.id}: no connected account or payment method`,
      );
    }

    try {
      const result = await this.adapter.placeOrder(
        product,
        {
          name: dto.shippingName,
          address1: dto.shippingAddress1,
          address2: dto.shippingAddress2,
          city: dto.shippingCity,
          state: dto.shippingState,
          zip: dto.shippingZip,
        },
        stripePaymentIntentId || order.id,
      );

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'ordered',
          retailerOrderId: result.retailerOrderId,
          confirmationNumber: result.confirmationNumber,
          estimatedDeliveryDate: new Date(result.estimatedDeliveryDate),
        },
      });

      if (dto.giftRecordId) {
        try {
          await this.prisma.giftRecord.update({
            where: { id: dto.giftRecordId, userId: user.id },
            data: { source: 'ordered' },
          });
        } catch (err) {
          this.log.warn(`GiftRecord source update failed (non-critical): ${err}`);
        }
      }

      await this.orderAudit.record({
        orderId: order.id,
        userId: user.id,
        action: 'place',
        details: {
          retailerOrderId: result.retailerOrderId,
          priceCents: product.priceCents,
        },
      });

      return updatedOrder;
    } catch (adapterErr) {
      if (adapterErr instanceof RetailerOrderError || adapterErr instanceof InternalServerErrorException) {
        // If it's already an ISE from the Stripe path re-throw directly
        if (adapterErr instanceof InternalServerErrorException) {
          throw adapterErr;
        }
      }

      // Retailer failed — refund if we charged
      if (stripePaymentIntentId) {
        try {
          await this.stripeConnect.refund(stripePaymentIntentId, order.id);
          await this.orderAudit.record({
            orderId: order.id,
            userId: user.id,
            action: 'refund',
            details: { reason: 'retailer_failed_after_charge' },
          });
        } catch (refundErr) {
          this.log.error(`CRITICAL: Refund failed for order ${order.id}: ${refundErr}`);
          await this.orderAudit.record({
            orderId: order.id,
            userId: user.id,
            action: 'refund_failed',
            details: { paymentIntentId: stripePaymentIntentId, error: String(refundErr) },
          });
        }
      }

      // Mark order as failed
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      await this.orderAudit.record({
        orderId: order.id,
        userId: user.id,
        action: 'place_failed',
        details: {
          reason: 'retailer_failed',
          error: String(adapterErr),
          ...(adapterErr instanceof RetailerOrderError
            ? { errorCode: adapterErr.code }
            : {}),
        },
      });
      throw new InternalServerErrorException(
        'Order placement failed. Your card has been refunded.',
      );
    }
  }

  async cancel(userId: string, orderId: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      !order.placedAt ||
      Date.now() - order.placedAt.getTime() >= 2 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        'Cancel window has closed. Order cannot be cancelled.',
      );
    }

    if (!['pending', 'ordered'].includes(order.status)) {
      throw new BadRequestException(
        'Order cannot be cancelled in its current state.',
      );
    }

    // Refund via Stripe if payment was made
    if (order.stripePaymentIntentId) {
      try {
        await this.stripeConnect.refund(order.stripePaymentIntentId, order.id);
        await this.orderAudit.record({
          orderId: order.id,
          userId,
          action: 'refund',
          details: { paymentIntentId: order.stripePaymentIntentId },
        });
      } catch (refundErr) {
        this.log.error(`Refund failed for order ${order.id}: ${refundErr}`);
        await this.orderAudit.record({
          orderId: order.id,
          userId,
          action: 'refund_failed',
          details: {
            paymentIntentId: order.stripePaymentIntentId,
            error: String(refundErr),
          },
        });
        throw new BadRequestException('Refund failed. Please contact support.');
      }
    }

    try {
      await this.adapter.cancelOrder(order.retailerOrderId || order.id);
    } catch (err) {
      await this.orderAudit.record({
        orderId: order.id,
        userId,
        action: 'cancel_failed',
        details: {
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Cancel failed',
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
      },
    });

    if (order.giftRecordId) {
      try {
        await this.prisma.giftRecord.update({
          where: { id: order.giftRecordId },
          data: { source: 'suggestion' },
        });
      } catch (err) {
        this.log.warn(`GiftRecord source revert failed (non-critical): ${err}`);
      }
    }

    await this.orderAudit.record({
      orderId: order.id,
      userId,
      action: 'cancel',
      details: { reason: reason ?? null },
    });

    return updatedOrder;
  }

  async list(userId: string, query: ListOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: { userId: string; status?: OrderStatus } = { userId };
    if (query.status) {
      where.status = query.status as OrderStatus;
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { person: { select: { name: true } } },
      }),
    ]);

    return { data: orders, meta: { page, limit, total } };
  }

  async getById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        person: { select: { name: true } },
        giftRecord: { select: { id: true, title: true, source: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const cancelWindowSecondsLeft = order.placedAt
      ? Math.max(
          0,
          Math.floor(
            (order.placedAt.getTime() + 2 * 60 * 60 * 1000 - Date.now()) / 1000,
          ),
        )
      : 0;

    return { ...order, cancelWindowSecondsLeft };
  }
}
