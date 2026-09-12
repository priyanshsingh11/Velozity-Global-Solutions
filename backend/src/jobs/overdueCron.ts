import cron from 'node-cron';
import { TaskStatus, NotificationType } from '@prisma/client';
import prisma from '../prisma';
import { emitTaskUpdate, emitNotification } from '../websocket/socketServer';

export function startOverdueCron() {
  console.log('⏰ Starting Overdue Tasks background cron job (running every 60s)...');

  // Run every minute: '* * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find tasks that are past their due date, not yet DONE, and not yet flagged isOverdue
      const overdueTasks = await prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { not: TaskStatus.DONE },
          isOverdue: false,
        },
        include: {
          project: { select: { id: true, name: true, createdById: true } },
          assignedDeveloper: { select: { id: true, name: true, email: true } },
        },
      });

      if (overdueTasks.length === 0) {
        return;
      }

      console.log(`⚠️ Overdue cron detected ${overdueTasks.length} task(s) past due date.`);

      for (const task of overdueTasks) {
        // Update task isOverdue flag
        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: { isOverdue: true },
          include: {
            project: { select: { id: true, name: true, createdById: true } },
            assignedDeveloper: { select: { id: true, name: true, email: true } },
          },
        });

        // Store activity history in PostgreSQL
        const activity = await prisma.activityLog.create({
          data: {
            taskId: task.id,
            projectId: task.projectId,
            userId: task.project.createdById, // Scoped attribution
            action: 'TASK_OVERDUE',
            details: `Task "${task.title}" became Overdue (Due: ${task.dueDate.toISOString()})`,
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        });

        // Notify assigned developer if any
        if (task.assignedDeveloperId) {
          const notification = await prisma.notification.create({
            data: {
              userId: task.assignedDeveloperId,
              taskId: task.id,
              type: NotificationType.TASK_OVERDUE,
              title: 'Task Overdue Alert',
              message: `Your task "${task.title}" is now past its due date.`,
            },
          });
          emitNotification(task.assignedDeveloperId, notification);
        }

        // Broadcast real-time update
        emitTaskUpdate({
          task: updatedTask,
          activity,
          projectId: updatedTask.projectId,
          assignedDeveloperId: updatedTask.assignedDeveloperId,
        });
      }
    } catch (error) {
      console.error('Error running overdue background cron:', error);
    }
  });
}
