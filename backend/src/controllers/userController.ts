import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../prisma';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.query.role as Role | undefined;

    const users = await prisma.user.findMany({
      where: role ? { role } : {},
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            assignedTasks: true,
            createdProjects: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
}

export async function listDevelopers(req: Request, res: Response, next: NextFunction) {
  try {
    const developers = await prisma.user.findMany({
      where: { role: Role.DEVELOPER },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { developers },
    });
  } catch (error) {
    next(error);
  }
}
