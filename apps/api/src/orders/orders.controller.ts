import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresTier } from '../billing/decorators/requires-tier.decorator';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';
import { PreviewOrderDto } from './dto/preview-order.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('preview')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async preview(@CurrentUser() user: User, @Body() dto: PreviewOrderDto) {
    return this.orders.preview(user, dto);
  }

  @Post('place')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async place(@CurrentUser() user: User, @Body() dto: PlaceOrderDto) {
    return this.orders.place(user, dto);
  }

  @Post(':id/cancel')
  @RequiresTier('pro', 'elite')
  @UseGuards(SubscriptionGuard)
  async cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(user.id, id, dto?.reason);
  }

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListOrdersDto) {
    return this.orders.list(user.id, query);
  }

  @Get(':id')
  async getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.getById(user.id, id);
  }

  @Get(':id/timeline')
  async getTimeline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.getTimeline(user.id, id);
  }

  @Post(':id/mark-manual')
  async markManuallyPurchased(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.orders.markManuallyPurchased(user.id, id);
  }
}
