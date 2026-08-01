import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { corsOrigins, env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
}

export function createRealtimeServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  });

  const pubClient = new Redis(env.REDIS_URL);
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Missing token');
      const claims = verifyAccessToken(token);
      socket.data.user = { id: claims.sub, role: claims.role };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.id as string;

    socket.on('group:join', async (groupId: string, ack?: (ok: boolean) => void) => {
      try {
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return ack?.(false);
        const isLeader = group.leaderId === userId;
        const isMember =
          isLeader ||
          !!(await prisma.groupMember.findFirst({ where: { groupId, userId, status: 'active' } }));
        if (!isMember) return ack?.(false);
        socket.join(`group:${groupId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('activity:join', async (activityId: string, ack?: (ok: boolean) => void) => {
      try {
        const activity = await prisma.activity.findUnique({ where: { id: activityId } });
        if (!activity) return ack?.(false);
        // Ended activities stream nothing, matching the location gate in locations/service.ts.
        if (activity.status === 'completed' || activity.status === 'cancelled') return ack?.(false);
        const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
        const isLeader = group?.leaderId === userId;
        const isApproved =
          isLeader ||
          !!(await prisma.rsvp.findFirst({ where: { activityId, userId, status: 'approved' } }));
        if (!isApproved) return ack?.(false);
        socket.join(`activity:${activityId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });
  });

  return io;
}
