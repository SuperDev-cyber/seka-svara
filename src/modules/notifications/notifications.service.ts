import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async getUserNotifications(userId: string, page: number = 1, limit: number = 10) {
    const [notifications, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationsRepository.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(id: string) {
    await this.notificationsRepository.update(id, { isRead: true });
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.notificationsRepository.update({ userId }, { isRead: true });
    return { message: 'All notifications marked as read' };
  }

  async createNotification(userId: string, title: string, message: string, type: string) {
    const notification = this.notificationsRepository.create({
      userId,
      title,
      message,
      type,
    });
    return this.notificationsRepository.save(notification);
  }
}

