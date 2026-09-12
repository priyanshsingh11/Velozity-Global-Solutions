import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { JwtPayload } from '../types';

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as any,
  });
}

/**
 * Every refresh token carries a random `jti`. Without it two tokens minted for
 * the same user in the same second are byte-identical - and since we store
 * SHA-256(token) under a unique index, the second one collides. That happens
 * routinely: refreshing immediately after login, or two tabs refreshing at once.
 */
export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as any,
    jwtid: crypto.randomUUID(),
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, config.jwt.refreshSecret) as { userId: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
