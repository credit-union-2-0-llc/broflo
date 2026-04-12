import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.notifications.unreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('mark-all-read')
  async markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }
}
