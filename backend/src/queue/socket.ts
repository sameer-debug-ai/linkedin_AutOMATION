import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../config/logger';

let io: SocketServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow any localhost port (works with any Angular/Vite dev server port)
        if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Socket.IO: Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket] Client connected: ${socket.id}`);

    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.info(`[Socket] Socket ${socket.id} joined room user:${userId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketServer(): SocketServer | null {
  return io;
}
