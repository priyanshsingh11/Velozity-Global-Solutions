import { Response, NextFunction } from 'express';
import { Role, TaskStatus, TaskPriority } from '@prisma/client';
import prisma from '../prisma';
import { AuthRequest } from '../types';
import { presenceManager } from '../websocket/presenceManager';

export async function getDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;

    if (user.role === Role.ADMIN) {
      // 17.1 Admin Dashboard
      const [totalProjects, totalTasks, tasksByStatusRaw, overdueCount] = await Promise.all([
        prisma.project.count(),
        prisma.task.count(),
        prisma.task.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.task.count({
          where: { isOverdue: true, status: { not: TaskStatus.DONE } },
        }),
      ]);

      const tasksByStatus = {
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      };

      tasksByStatusRaw.forEach((item) => {
        tasksByStatus[item.status] = item._count.status;
      });

      return res.status(200).json({
        success: true,
        data: {
          role: Role.ADMIN,
          totalProjects,
          totalTasks,
          tasksByStatus,
          overdueCount,
          activeUsersOnline: presenceManager.getOnlineCount(),
        },
      });
    }

    if (user.role === Role.PM) {
      // 17.2 PM Dashboard
      const [projects, tasksByPriorityRaw, upcomingTasksThisWeek] = await Promise.all([
        prisma.project.findMany({
          where: { createdById: user.userId },
          include: {
            client: { select: { name: true } },
            _count: { select: { tasks: true } },
          },
        }),
        prisma.task.groupBy({
          by: ['priority'],
          where: {
            project: { createdById: user.userId },
          },
          _count: { priority: true },
        }),
        (() => {
          const now = new Date();
          const oneWeekLater = new Date();
          oneWeekLater.setDate(now.getDate() + 7);

          return prisma.task.findMany({
            where: {
              project: { createdById: user.userId },
              dueDate: { gte: now, lte: oneWeekLater },
              status: { not: TaskStatus.DONE },
            },
            include: {
              assignedDeveloper: { select: { id: true, name: true } },
              project: { select: { id: true, name: true } },
            },
            orderBy: { dueDate: 'asc' },
          });
        })(),
      ]);

      const tasksByPriority = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      };

      tasksByPriorityRaw.forEach((item) => {
        tasksByPriority[item.priority] = item._count.priority;
      });

      return res.status(200).json({
        success: true,
        data: {
          role: Role.PM,
          totalProjects: projects.length,
          projects,
          tasksByPriority,
          upcomingTasksThisWeek,
        },
      });
    }

    if (user.role === Role.DEVELOPER) {
      // 17.3 Developer Dashboard
      const assignedTasks = await prisma.task.findMany({
        where: { assignedDeveloperId: user.userId },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      });

      const stats = {
        total: assignedTasks.length,
        todo: assignedTasks.filter((t) => t.status === TaskStatus.TODO).length,
        inProgress: assignedTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
        inReview: assignedTasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length,
        done: assignedTasks.filter((t) => t.status === TaskStatus.DONE).length,
        overdue: assignedTasks.filter((t) => t.isOverdue && t.status !== TaskStatus.DONE).length,
      };

      return res.status(200).json({
        success: true,
        data: {
          role: Role.DEVELOPER,
          stats,
          tasks: assignedTasks,
        },
      });
    }

    return res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
}
