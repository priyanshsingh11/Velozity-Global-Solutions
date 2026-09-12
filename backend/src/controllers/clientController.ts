import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { NotFoundError } from '../utils/errors';

export const createClientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  email: z.string().email('Valid email is required'),
  company: z.string().min(2, 'Company name is required'),
});

export const updateClientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  company: z.string().min(2).optional(),
});

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: { select: { projects: true } },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: { clients },
    });
  } catch (error) {
    next(error);
  }
}

export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await prisma.client.create({
      data: req.body,
    });

    return res.status(201).json({
      success: true,
      data: { client },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Client not found');
    }

    const updated = await prisma.client.update({
      where: { id },
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      data: { client: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Client not found');
    }

    await prisma.client.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
