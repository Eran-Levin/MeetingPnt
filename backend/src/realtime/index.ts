import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { corsOrigins, env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';

let io: SocketIOServer | null = null;

/** Everyone approved for the activity — the room for anything the whole group may see. */
export function activityRoom(activityId: string): string {
  return `activity:${activityId}`;
}

/** The leader alone. Member location snapshots go here and nowhere else. */
export function activityLeaderRoom(activityId: string): string {
  return `activity:${activityId}:leader`;
}

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

  // The Redis adapter only matters when more than one backend instance is serving sockets. On a
  // single instance the in-memory adapter is equivalent, so a deployment can omit REDIS_URL
  // entirely rather than pay for a Redis it never uses.
  if (env.REDIS_URL) {
    const pubClient = new Redis(env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  }

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
        socket.join(activityRoom(activityId));
        // Two rooms, because two audiences. Everyone in the activity may see where the *leader*
        // is; only the leader may see where the members are. Splitting the rooms makes that
        // structural — the leader-only room is the one member snapshots are broadcast to, so a
        // member's socket is never sent another member's coordinates in the first place. It used
        // to be one room carrying every snapshot, which left the REST read leader-only while the
        // socket handed the same data to anyone with an approved RSVP.
        if (isLeader) socket.join(activityLeaderRoom(activityId));
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });
  });

  return io;
}
