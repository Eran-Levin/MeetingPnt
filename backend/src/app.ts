import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { adminRouter } from './modules/admin/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { groupsRouter } from './modules/groups/routes.js';
import { activitiesRouter, groupActivitiesRouter } from './modules/activities/routes.js';
import {
  activityInvitationsRouter,
  groupInvitationsRouter,
  invitationsRouter,
} from './modules/invitations/routes.js';
import { locationsRouter } from './modules/locations/routes.js';
import {
  activityMeetingPointsRouter,
  meetingPointsRouter,
} from './modules/meetingPoints/routes.js';
import { rsvpsRouter } from './modules/rsvps/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/groups/:groupId/invitations', groupInvitationsRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/groups/:groupId/activities', groupActivitiesRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/activities', rsvpsRouter);
  app.use('/api/activities/:activityId/meeting-points', activityMeetingPointsRouter);
  app.use('/api/meeting-points', meetingPointsRouter);
  app.use('/api/activities', locationsRouter);
  app.use('/api/activities/:activityId', activityInvitationsRouter);
  app.use('/api/users', usersRouter);

  app.use(errorHandler);

  return app;
}
