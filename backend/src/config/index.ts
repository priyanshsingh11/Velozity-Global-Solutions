import dotenv from 'dotenv';
dotenv.config();

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Every browser origin allowed to call the API and open a WebSocket.
 * `FRONTEND_URL` is the primary one; `ADDITIONAL_ORIGINS` is a comma-separated
 * list for preview deployments. Localhost is always allowed in development.
 */
const allowedOrigins = Array.from(
  new Set(
    [
      process.env.FRONTEND_URL,
      ...(process.env.ADDITIONAL_ORIGINS?.split(',') ?? []),
      ...(isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
    ]
      .map((o) => o?.trim())
      .filter((o): o is string => !!o)
  )
);

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowedOrigins,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_velozity_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_velozity_2026',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10),
  },
  /**
   * The refresh token lives in an HttpOnly cookie. In production the SPA and
   * the API sit on different origins (Vercel + API host), so the cookie must be
   * SameSite=None; that in turn requires Secure. Locally the Vite proxy makes
   * the request same-site, where Lax is the safer default.
   */
  cookie: {
    httpOnly: true as const,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10) * 24 * 60 * 60 * 1000,
  },
};
