import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { AutopilotService } from './autopilot.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresTier } from '../billing/decorators/requires-tier.decorator';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';
import { CreateAutopilotRuleDto, UpdateAutopilotRuleDto, ListAutopilotRunsDto } from './dto/autopilot.dto';

@Controller('autopilot')
export class AutopilotController {
  constructor(private readonly autopilot: AutopilotService) {}

  @Post('rules')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async createRule(
    @CurrentUser() user: User,
    @Body() dto: CreateAutopilotRuleDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    return this.autopilot.createRule(user.id, dto, ip);
  }

  @Get('rules')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async listRules(@CurrentUser() user: User) {
    return this.autopilot.listRules(user.id);
  }

  @Get('rules/:id')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async getRule(@CurrentUser() user: User, @Param('id') id: string) {
    return this.autopilot.getRule(user.id, id);
  }

  @Patch('rules/:id')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async updateRule(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAutopilotRuleDto,
  ) {
    return this.autopilot.updateRule(user.id, id, dto);
  }

  @Delete('rules/:id')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async deleteRule(@CurrentUser() user: User, @Param('id') id: string) {
    return this.autopilot.deleteRule(user.id, id);
  }

  @Get('runs')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async listRuns(@CurrentUser() user: User, @Query() query: ListAutopilotRunsDto) {
    return this.autopilot.listRuns(user.id, query);
  }

  @Get('spend')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async getSpend(@CurrentUser() user: User) {
    const monthlySpent = await this.autopilot.getMonthlySpend(user.id);
    return { monthlySpentCents: monthlySpent };
  }
}
