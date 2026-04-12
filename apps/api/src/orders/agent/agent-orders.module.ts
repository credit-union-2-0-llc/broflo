import { Module } from '@nestjs/common';
import { AgentOrdersController } from './agent-orders.controller';
import { AgentOrdersService } from './agent-orders.service';
import { BrowserAgentClient } from './browser-agent.client';
import { StripeIssuingService } from './stripe-issuing.service';
import { RetailerProfileService } from './retailer-profile.service';
import { ServiceCreditService } from './service-credit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionGuard } from '../../billing/guards/subscription.guard';
import { OrdersModule } from '../orders.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [OrdersModule, NotificationsModule],
  controllers: [AgentOrdersController],
  providers: [
    AgentOrdersService,
    BrowserAgentClient,
    StripeIssuingService,
    RetailerProfileService,
    ServiceCreditService,
    PrismaService,
    SubscriptionGuard,
  ],
  exports: [AgentOrdersService, RetailerProfileService, ServiceCreditService],
})
export class AgentOrdersModule {}
