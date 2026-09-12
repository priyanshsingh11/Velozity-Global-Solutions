import { Request } from 'express';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
