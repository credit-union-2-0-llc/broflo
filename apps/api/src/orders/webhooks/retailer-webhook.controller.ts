import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyWebhookSignature } from './verify-signature';
import { OrderStatus, StatusChangeSource } from '@prisma/client';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

interface WebhookPayload {
  retailerOrderId: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
}

@Controller('webhooks/retailer')
export class RetailerWebhookController {
  private readonly log = new Logger(RetailerWebhookController.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':retailerKey')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('retailerKey') retailerKey: string,
    @Headers('x-retailer-signature') signature: string,
    @Req() req: RawBodyRequest,
    @Body() body: WebhookPayload,
  ) {
    const secret = process.env.RETAILER_WEBHOOK_SECRET;
    if (!secret) {
      this.log.error('RETAILER_WEBHOOK_SECRET not configured');
      return { received: true };
    }

    if (!req.rawBody || !signature) {
      throw new UnauthorizedException('Missing signature');
    }

    if (!verifyWebhookSignature(req.rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        retailerKey,
        retailerOrderId: body.retailerOrderId,
      },
    });

    if (!order) {
      this.log.warn(
        `Webhook for unknown order: retailerKey=${retailerKey}, retailerOrderId=${body.retailerOrderId}`,
      );
      return { received: true };
    }

    const toStatus = body.status as OrderStatus;
    await this.orders.transitionStatus(order.id, toStatus, 'webhook' as StatusChangeSource, {
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl,
      carrierName: body.carrierName,
      metadata: { retailerKey, source: 'webhook' },
    });

    return { received: true };
  }
}
