import { Module } from '@nestjs/common';
import { AutopilotController } from './autopilot.controller';
import { AutopilotService } from './autopilot.service';
import { AutopilotScheduler } from './autopilot.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { FamilyModule } from '../family/family.module';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';

@Module({
  imports: [SuggestionsModule, FamilyModule],
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
