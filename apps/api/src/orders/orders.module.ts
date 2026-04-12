import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderAuditService } from './audit/order-audit.service';
import { StripeConnectService } from './stripe-connect.service';
import { MockAdapter } from './adapters/mock/mock.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderAuditService,
    StripeConnectService,
    PrismaService,
    SubscriptionGuard,
    {
      provide: 'RETAILER_ADAPTER',
      useClass: MockAdapter,
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
