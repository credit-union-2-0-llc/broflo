import { Module } from '@nestjs/common';
import { AutopilotController } from './autopilot.controller';
import { AutopilotService } from './autopilot.service';
import { AutopilotScheduler } from './autopilot.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersModule } from '../orders/orders.module';
import { AgentOrdersModule } from '../orders/agent/agent-orders.module';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';

@Module({
  imports: [OrdersModule, AgentOrdersModule, SuggestionsModule],
  controllers: [AutopilotController],
  providers: [
    AutopilotService,
    AutopilotScheduler,
    PrismaService,
    SubscriptionGuard,
  ],
  exports: [AutopilotService],
})
export class AutopilotModule {}
