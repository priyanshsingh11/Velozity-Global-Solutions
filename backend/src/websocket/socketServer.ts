import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { JwtPayload } from '../types';
import { config } from '../config';
import { presenceManager } from './presenceManager';
import prisma from '../prisma';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      credentials: true,
    },
  });

  // Authentication Handshake Middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = verifyAccessToken(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;

    console.log(`🔌 WebSocket connected: ${user.name} (${user.role}) - Socket ID: ${socket.id}`);

    // Track presence
    presenceManager.handleUserConnected(io!, user.userId, socket.id);

    // Automatically join personal user notification room
    socket.join(`user:${user.userId}`);

    // If Admin, join global feed room
    if (user.role === Role.ADMIN) {
      socket.join('admin:global');
      // Send immediate initial presence count to newly connected Admin
      socket.emit('presence:update', {
        onlineCount: presenceManager.getOnlineCount(),
        onlineUserIds: presenceManager.getOnlineUserIds(),
        timestamp: new Date().toISOString(),
      });
    }

    // Client requests to subscribe to a specific project room
    socket.on('project:join', async ({ projectId }: { projectId: string }, callback) => {
      try {
        if (!projectId) {
          return callback?.({ success: false, error: 'Project ID required' });
        }

        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            tasks: {
              select: { assignedDeveloperId: true },
            },
          },
        });

        if (!project) {
          return callback?.({ success: false, error: 'Project not found' });
        }

        // Enforce authorization for joining project live channel
        if (user.role === Role.PM && project.createdById !== user.userId) {
          return callback?.({
            success: false,
            error: 'Forbidden: Cannot join another PM’s project channel',
          });
        }

        if (user.role === Role.DEVELOPER) {
          const hasTask = project.tasks.some(
            (t) => t.assignedDeveloperId === user.userId
          );
          if (!hasTask) {
            return callback?.({
              success: false,
              error: 'Forbidden: Cannot join a project without assigned tasks',
            });
          }
        }

        socket.join(`project:${projectId}`);
        callback?.({ success: true, room: `project:${projectId}` });
      } catch (err) {
        callback?.({ success: false, error: 'Failed to join project room' });
      }
    });

    socket.on('project:leave', ({ projectId }: { projectId: string }) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ WebSocket disconnected: ${user.name} - Socket ID: ${socket.id}`);
      presenceManager.handleUserDisconnected(io!, socket.id);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io server has not been initialized');
  }
  return io;
}

// Real-time notification broadcaster
export function emitNotification(userId: string, notification: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification:new', notification);
}

// Real-time task update broadcaster
export function emitTaskUpdate(data: {
  task: any;
  activity: any;
  projectId: string;
  assignedDeveloperId?: string | null;
}) {
  if (!io) return;

  // 1. Send to the project room (viewers of that project)
  io.to(`project:${data.projectId}`).emit('task:updated', {
    task: data.task,
    activity: data.activity,
  });

  // 2. Send to Admin global room
  io.to('admin:global').emit('task:updated', {
    task: data.task,
    activity: data.activity,
  });

  // 3. Also send to assigned developer's direct room if applicable
  if (data.assignedDeveloperId) {
    io.to(`user:${data.assignedDeveloperId}`).emit('task:updated', {
      task: data.task,
      activity: data.activity,
    });
  }

  // 4. Emit new activity event
  emitActivityEvent(data.activity, data.projectId, data.assignedDeveloperId);
}

// Real-time role-filtered activity event dispatcher
export function emitActivityEvent(
  activity: any,
  projectId: string,
  assignedDeveloperId?: string | null
) {
  if (!io) return;

  // Admin gets all activities
  io.to('admin:global').emit('activity:new', activity);

  // Project room gets activities for that project
  io.to(`project:${projectId}`).emit('activity:new', activity);

  // Assigned developer gets activity related to their task
  if (assignedDeveloperId) {
    io.to(`user:${assignedDeveloperId}`).emit('activity:new', activity);
  }
}
