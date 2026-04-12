import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderAuditService } from './audit/order-audit.service';
import { OrderStatusHistoryService } from './order-status-history.service';
import { StripeConnectService } from './stripe-connect.service';
import { MockAdapter } from './adapters/mock/mock.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';
import { RetailerWebhookController } from './webhooks/retailer-webhook.controller';
import { OrderPollingScheduler } from './order-polling.scheduler';

@Module({
  controllers: [OrdersController, RetailerWebhookController],
  providers: [
    OrdersService,
    OrderAuditService,
    OrderStatusHistoryService,
    StripeConnectService,
    PrismaService,
    SubscriptionGuard,
    OrderPollingScheduler,
    {
      provide: 'RETAILER_ADAPTER',
      useClass: MockAdapter,
    },
  ],
  exports: [OrdersService, OrderStatusHistoryService],
})
export class OrdersModule {}
