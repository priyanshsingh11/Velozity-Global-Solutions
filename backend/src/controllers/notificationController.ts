import { Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../types';
import { NotFoundError } from '../utils/errors';

export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.userId },
        include: {
          task: { select: { id: true, title: true, status: true, projectId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: user.userId, isRead: false },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.userId },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.userId, isRead: false },
    });

    return res.status(200).json({
      success: true,
      data: {
        notification: updated,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;

    await prisma.notification.updateMany({
      where: { userId: user.userId, isRead: false },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: { unreadCount: 0 },
    });
  } catch (error) {
    next(error);
  }
}
