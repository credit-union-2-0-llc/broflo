import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateNotificationData {
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateNotificationData) {
    return this.prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        linkUrl: data.linkUrl ?? null,
      },
    });
  }

  async list(userId: string, page = 1, limit = 20) {
    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data: notifications, meta: { page, limit, total } };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
