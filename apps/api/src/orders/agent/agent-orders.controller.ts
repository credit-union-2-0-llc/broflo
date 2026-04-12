import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { AgentOrdersService } from './agent-orders.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequiresTier } from '../../billing/decorators/requires-tier.decorator';
import { SubscriptionGuard } from '../../billing/guards/subscription.guard';
import { AgentPreviewDto, AgentPlaceDto, AgentCancelDto } from './dto/agent-order.dto';

@Controller('orders/agent')
export class AgentOrdersController {
  constructor(private readonly agentOrders: AgentOrdersService) {}

  @Post('preview')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async preview(@CurrentUser() user: User, @Body() dto: AgentPreviewDto) {
    return this.agentOrders.preview(user, dto);
  }

  @Post('place')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async place(@CurrentUser() user: User, @Body() dto: AgentPlaceDto) {
    return this.agentOrders.place(user, dto);
  }

  @Get(':jobId')
  async getJob(@CurrentUser() user: User, @Param('jobId') jobId: string) {
    return this.agentOrders.getJob(user.id, jobId);
  }

  @Get(':jobId/steps')
  async getSteps(@CurrentUser() user: User, @Param('jobId') jobId: string) {
    return this.agentOrders.getJobSteps(user.id, jobId);
  }

  @Post(':jobId/cancel')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async cancel(@CurrentUser() user: User, @Param('jobId') jobId: string) {
    return this.agentOrders.cancelJob(user.id, jobId);
  }
}
