import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, TaskStatus, TaskPriority, NotificationType } from '@prisma/client';
import prisma from '../prisma';
import { AuthRequest } from '../types';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { emitTaskUpdate, emitNotification } from '../websocket/socketServer';

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Valid Project ID is required'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  assignedDeveloperId: z.string().uuid('Valid Developer ID is required').optional().nullable(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

export const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(3).optional(),
  assignedDeveloperId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

// Server-side validation for the shareable query-parameter filters
// (`/tasks?status=IN_PROGRESS&priority=HIGH&dueFrom=...&dueTo=...`).
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be an ISO date such as 2026-09-01');

export const taskFilterQuerySchema = z
  .object({
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    projectId: z.string().uuid('projectId must be a valid UUID').optional(),
    dueFrom: isoDate.optional(),
    dueTo: isoDate.optional(),
  })
  .refine(
    (q) => !q.dueFrom || !q.dueTo || Date.parse(q.dueFrom) <= Date.parse(q.dueTo),
    { message: 'dueFrom must be on or before dueTo', path: ['dueFrom'] }
  );

export async function listTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { status, priority, projectId, dueFrom, dueTo } = req.query as any;

    let whereClause: any = {};

    // 1. Enforce RBAC data boundary
    if (user.role === Role.ADMIN) {
      // Admin sees all
      if (projectId) whereClause.projectId = projectId;
    } else if (user.role === Role.PM) {
      // PM can only see tasks from projects they created
      whereClause.project = { createdById: user.userId };
      if (projectId) {
        whereClause.projectId = projectId;
      }
    } else if (user.role === Role.DEVELOPER) {
      // Developer can strictly only see tasks assigned to them!
      whereClause.assignedDeveloperId = user.userId;
      if (projectId) {
        whereClause.projectId = projectId;
      }
    }

    // 2. Query filters
    if (status) {
      whereClause.status = status;
    }
    if (priority) {
      whereClause.priority = priority;
    }
    if (dueFrom || dueTo) {
      whereClause.dueDate = {};
      if (dueFrom) {
        whereClause.dueDate.gte = new Date(dueFrom);
      }
      if (dueTo) {
        const endDate = new Date(dueTo);
        endDate.setHours(23, 59, 59, 999);
        whereClause.dueDate.lte = endDate;
      }
    }

    // Developer ordering requirement: sorted by Priority then Due Date
    const orderBy: any =
      user.role === Role.DEVELOPER
        ? [{ priority: 'desc' }, { dueDate: 'asc' }]
        : [{ dueDate: 'asc' }];

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: {
          select: { id: true, name: true, createdById: true },
        },
        assignedDeveloper: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy,
    });

    return res.status(200).json({
      success: true,
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTaskById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, createdById: true },
        },
        assignedDeveloper: {
          select: { id: true, name: true, email: true },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // RBAC: PM must own project; Developer must be assigned
    if (user.role === Role.PM && task.project.createdById !== user.userId) {
      throw new ForbiddenError('You cannot view tasks in another Project Manager’s project');
    }

    if (user.role === Role.DEVELOPER && task.assignedDeveloperId !== user.userId) {
      throw new ForbiddenError('You cannot view tasks assigned to other developers');
    }

    return res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { projectId, title, description, assignedDeveloperId, status, priority, dueDate } =
      req.body;

    // Developers cannot create tasks
    if (user.role === Role.DEVELOPER) {
      throw new ForbiddenError('Developers cannot create tasks');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // PM can only create tasks in their own projects
    if (user.role === Role.PM && project.createdById !== user.userId) {
      throw new ForbiddenError('You can only create tasks in projects you created');
    }

    // Check developer if provided
    if (assignedDeveloperId) {
      const dev = await prisma.user.findUnique({
        where: { id: assignedDeveloperId },
      });
      if (!dev || dev.role !== Role.DEVELOPER) {
        throw new NotFoundError('Assigned user must be an active Developer');
      }
    }

    const parsedDueDate = new Date(dueDate);
    const isPastDue = parsedDueDate < new Date() && status !== TaskStatus.DONE;

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        assignedDeveloperId: assignedDeveloperId || null,
        status: status || TaskStatus.TODO,
        priority: priority || TaskPriority.MEDIUM,
        dueDate: parsedDueDate,
        isOverdue: isPastDue,
      },
      include: {
        project: { select: { id: true, name: true, createdById: true } },
        assignedDeveloper: { select: { id: true, name: true, email: true } },
      },
    });

    // Create activity record in PostgreSQL
    const activity = await prisma.activityLog.create({
      data: {
        taskId: task.id,
        projectId: task.projectId,
        userId: user.userId,
        action: 'TASK_CREATED',
        newStatus: task.status,
        details: `${user.name} created task "${task.title}"`,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Scenario A: If assigned to developer, trigger in-app notification
    if (assignedDeveloperId) {
      const notification = await prisma.notification.create({
        data: {
          userId: assignedDeveloperId,
          taskId: task.id,
          type: NotificationType.TASK_ASSIGNED,
          title: 'New Task Assigned',
          message: `${user.name} assigned task "${task.title}" to you.`,
        },
      });
      emitNotification(assignedDeveloperId, notification);
    }

    // Broadcast real-time update
    emitTaskUpdate({
      task,
      activity,
      projectId: task.projectId,
      assignedDeveloperId: task.assignedDeveloperId,
    });

    return res.status(201).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, createdById: true } },
      },
    });

    if (!existingTask) {
      throw new NotFoundError('Task not found');
    }

    // RBAC: PM can only update tasks in their own project. Developers cannot edit task metadata (use updateStatus)
    if (user.role === Role.PM && existingTask.project.createdById !== user.userId) {
      throw new ForbiddenError('You cannot edit tasks in another Project Manager’s project');
    }
    if (user.role === Role.DEVELOPER) {
      throw new ForbiddenError('Developers can only update task status');
    }

    const { assignedDeveloperId, status, dueDate, ...rest } = req.body;
    const updateData: any = { ...rest };

    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
      if (updateData.dueDate < new Date() && existingTask.status !== TaskStatus.DONE) {
        updateData.isOverdue = true;
      } else {
        updateData.isOverdue = false;
      }
    }

    const assignmentChanged =
      assignedDeveloperId !== undefined &&
      assignedDeveloperId !== existingTask.assignedDeveloperId;

    if (assignedDeveloperId !== undefined) {
      updateData.assignedDeveloperId = assignedDeveloperId;
    }

    if (status !== undefined) {
      updateData.status = status;
      if (status === TaskStatus.DONE) {
        updateData.isOverdue = false;
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, createdById: true } },
        assignedDeveloper: { select: { id: true, name: true, email: true } },
      },
    });

    // Create activity
    const activity = await prisma.activityLog.create({
      data: {
        taskId: updatedTask.id,
        projectId: updatedTask.projectId,
        userId: user.userId,
        action: 'TASK_UPDATED',
        details: `${user.name} updated task "${updatedTask.title}"`,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Scenario A: Notify if newly assigned developer
    if (assignmentChanged && assignedDeveloperId) {
      const notification = await prisma.notification.create({
        data: {
          userId: assignedDeveloperId,
          taskId: updatedTask.id,
          type: NotificationType.TASK_ASSIGNED,
          title: 'Task Assigned to You',
          message: `${user.name} assigned task "${updatedTask.title}" to you.`,
        },
      });
      emitNotification(assignedDeveloperId, notification);
    }

    emitTaskUpdate({
      task: updatedTask,
      activity,
      projectId: updatedTask.projectId,
      assignedDeveloperId: updatedTask.assignedDeveloperId,
    });

    return res.status(200).json({
      success: true,
      data: { task: updatedTask },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { status } = req.body as { status: TaskStatus };

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, createdById: true } },
        assignedDeveloper: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // RBAC:
    // - Admin: allowed
    // - PM: allowed for own project
    // - Developer: strictly allowed ONLY IF assigned to this developer!
    if (user.role === Role.PM && task.project.createdById !== user.userId) {
      throw new ForbiddenError('You cannot update tasks in another Project Manager’s project');
    }

    if (user.role === Role.DEVELOPER && task.assignedDeveloperId !== user.userId) {
      throw new ForbiddenError('You cannot update status for a task not assigned to you');
    }

    const oldStatus = task.status;
    const isOverdue = status === TaskStatus.DONE ? false : task.dueDate < new Date();

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status,
        isOverdue,
      },
      include: {
        project: { select: { id: true, name: true, createdById: true } },
        assignedDeveloper: { select: { id: true, name: true, email: true } },
      },
    });

    // 9. Task Status Change History in PostgreSQL
    const details = `${user.name} moved "${task.title}" from ${oldStatus} → ${status}`;
    const activity = await prisma.activityLog.create({
      data: {
        taskId: task.id,
        projectId: task.projectId,
        userId: user.userId,
        action: 'STATUS_CHANGE',
        oldStatus,
        newStatus: status,
        details,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Scenario B: When moved to 'IN_REVIEW', project creator (PM) receives notification
    if (status === TaskStatus.IN_REVIEW && task.project.createdById !== user.userId) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.project.createdById,
          taskId: task.id,
          type: NotificationType.TASK_IN_REVIEW,
          title: 'Task Moved to In Review',
          message: `${user.name} moved "${task.title}" to In Review for your project.`,
        },
      });
      emitNotification(task.project.createdById, notification);
    }

    // Real-Time Task Status Update via WebSocket (Section 12)
    emitTaskUpdate({
      task: updatedTask,
      activity,
      projectId: updatedTask.projectId,
      assignedDeveloperId: updatedTask.assignedDeveloperId,
    });

    return res.status(200).json({
      success: true,
      data: {
        task: updatedTask,
        activity,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { createdById: true } },
      },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (user.role === Role.PM && task.project.createdById !== user.userId) {
      throw new ForbiddenError('You cannot delete tasks in another PM’s project');
    }

    if (user.role === Role.DEVELOPER) {
      throw new ForbiddenError('Developers cannot delete tasks');
    }

    await prisma.task.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
