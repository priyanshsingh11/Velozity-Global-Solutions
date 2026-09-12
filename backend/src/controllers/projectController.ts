import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../prisma';
import { AuthRequest } from '../types';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  clientId: z.string().uuid('Valid Client ID required'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  clientId: z.string().uuid().optional(),
});

export async function listProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;

    let whereClause: any = {};

    if (user.role === Role.ADMIN) {
      whereClause = {}; // Admin sees all projects
    } else if (user.role === Role.PM) {
      whereClause = { createdById: user.userId }; // PM only sees their own
    } else if (user.role === Role.DEVELOPER) {
      // Developer only sees projects where they have assigned tasks
      whereClause = {
        tasks: {
          some: {
            assignedDeveloperId: user.userId,
          },
        },
      };
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: {
          select: { id: true, name: true, company: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { projects },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProjectById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
        tasks: {
          include: {
            assignedDeveloper: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // RBAC Authorization enforcement at the API level
    if (user.role === Role.PM && project.createdById !== user.userId) {
      throw new ForbiddenError('You do not have access to another Project Manager’s project');
    }

    if (user.role === Role.DEVELOPER) {
      const hasAssignedTask = project.tasks.some(
        (t) => t.assignedDeveloperId === user.userId
      );
      if (!hasAssignedTask) {
        throw new ForbiddenError('You do not have access to this project');
      }

      // A Developer may open the project they work in, but must never see
      // another developer's tasks through it. Strip them from the payload.
      return res.status(200).json({
        success: true,
        data: {
          project: {
            ...project,
            tasks: project.tasks.filter((t) => t.assignedDeveloperId === user.userId),
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { name, description, clientId } = req.body;

    // Only Admin and PM can create projects
    if (user.role === Role.DEVELOPER) {
      throw new ForbiddenError('Developers cannot create projects');
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        clientId,
        createdById: user.userId, // Automatically scoped to creator
      },
      include: {
        client: true,
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Project not found');
    }

    // Authorization: Admin can edit any, PM can only edit projects they created
    if (user.role === Role.PM && existing.createdById !== user.userId) {
      throw new ForbiddenError('You cannot modify projects created by another Project Manager');
    }

    if (user.role === Role.DEVELOPER) {
      throw new ForbiddenError('Developers cannot modify projects');
    }

    const updated = await prisma.project.update({
      where: { id },
      data: req.body,
      include: {
        client: true,
        creator: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: { project: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Project not found');
    }

    // Only Admin or PM creator can delete
    if (user.role === Role.PM && existing.createdById !== user.userId) {
      throw new ForbiddenError('You cannot delete projects created by another Project Manager');
    }

    if (user.role === Role.DEVELOPER) {
      throw new ForbiddenError('Developers cannot delete projects');
    }

    await prisma.project.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
