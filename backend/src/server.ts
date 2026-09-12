import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/errors';
import { initSocketServer } from './websocket/socketServer';
import { startOverdueCron } from './jobs/overdueCron';

import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';
import clientRoutes from './routes/clientRoutes';
import activityRoutes from './routes/activityRoutes';
import notificationRoutes from './routes/notificationRoutes';
import userRoutes from './routes/userRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

const app = express();

// Behind a proxy (Render / Railway / Fly), trust X-Forwarded-Proto so that
// `Secure` cookies are issued correctly.
app.set('trust proxy', 1);
const httpServer = http.createServer(app);

// Core Middleware
app.use(
  cors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(cookieParser());

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Velozity Dashboard API',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Unknown API routes get the same structured error envelope as everything else
app.use('/api', (_req, _res, next) => {
  next(new NotFoundError('API endpoint not found'));
});

// Global Error Handler (must be last)
app.use(errorHandler);

// Initialize Socket.io WebSocket server
initSocketServer(httpServer);

// Start Background Cron Job for Overdue Tasks
startOverdueCron();

// Start HTTP Server
httpServer.listen(config.port, () => {
  console.log(`\n🚀 Velozity Backend running at http://localhost:${config.port}`);
  console.log(`📡 WebSocket server active on same port`);
  console.log(`🌱 Environment: ${config.nodeEnv}\n`);
});

export default app;
