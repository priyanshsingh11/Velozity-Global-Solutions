import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../prisma';
import { AuthRequest } from '../types';

export const activityFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  since: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'since must be an ISO timestamp')
    .optional(),
});

export async function getActivityFeed(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;

    let whereClause: any = {};

    // 1. Enforce Role Filtering for Activity Feed (Section 13)
    if (user.role === Role.ADMIN) {
      // Admin sees global activity
      whereClause = {};
    } else if (user.role === Role.PM) {
      // PM sees only projects created by that PM
      whereClause = {
        project: {
          createdById: user.userId,
        },
      };
    } else if (user.role === Role.DEVELOPER) {
      // Developer sees only activities related to tasks assigned to them
      whereClause = {
        task: {
          assignedDeveloperId: user.userId,
        },
      };
    }

    if (since) {
      whereClause.createdAt = { gt: since };
    }

    const activities = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return res.status(200).json({
      success: true,
      data: { activities },
    });
  } catch (error) {
    next(error);
  }
}

// Section 15: Missed Activity Catch-Up from PostgreSQL (Mandatory Last 20)
export async function getMissedActivities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const limit = 20; // Assessment requirement: exactly last 20 missed events

    let whereClause: any = {};

    if (user.role === Role.ADMIN) {
      whereClause = {};
    } else if (user.role === Role.PM) {
      whereClause = {
        project: {
          createdById: user.userId,
        },
      };
    } else if (user.role === Role.DEVELOPER) {
      whereClause = {
        task: {
          assignedDeveloperId: user.userId,
        },
      };
    }

    const activities = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        activities,
        count: activities.length,
        source: 'PostgreSQL',
      },
    });
  } catch (error) {
    next(error);
  }
}
