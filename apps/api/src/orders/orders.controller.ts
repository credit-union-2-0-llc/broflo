import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { PreviewOrderDto } from './dto/preview-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicableFrameworks } from '../compliance/applicable-frameworks.decorator';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  @Post('preview')
  async preview(@CurrentUser() user: { id: string }, @Body() dto: PreviewOrderDto) {
    return this.ordersService.preview(user.id, dto);
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  @Post('place')
  async place(@CurrentUser() user: { id: string }, @Body() dto: PlaceOrderDto) {
    return this.ordersService.place(user.id, dto);
  }

  @Get()
  async list(@CurrentUser() user: { id: string }, @Query() query: ListOrdersDto) {
    return this.ordersService.list(user.id, query);
  }

  @Get(':id')
  async get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ordersService.get(user.id, id);
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  @Patch(':id/cancel')
  async cancel(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() _dto: CancelOrderDto,
  ) {
    return this.ordersService.cancel(user.id, id);
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.ordersService.updateStatus(user.id, id, body.status);
  }
}