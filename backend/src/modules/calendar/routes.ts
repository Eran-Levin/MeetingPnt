import { Router, type Request } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { buildCalendarFeed, getCalendarToken, resetCalendarToken } from './service.js';

/**
 * Built from the address the client reached us on rather than from config, so the link is right
 * wherever this runs — production, staging, or a LAN IP during phone testing.
 */
function feedUrl(req: Request, token: string): string {
  return `${req.protocol}://${req.get('host')}/calendar/${token}.ics`;
}

// Mounted at /api/users/me/calendar-feed
export const calendarFeedSettingsRouter = Router();

calendarFeedSettingsRouter.use(authenticate);

calendarFeedSettingsRouter.get('/', async (req, res, next) => {
  try {
    res.json({ url: feedUrl(req, await getCalendarToken(req.user!.id)) });
  } catch (err) {
    next(err);
  }
});

calendarFeedSettingsRouter.post('/reset', async (req, res, next) => {
  try {
    res.json({ url: feedUrl(req, await resetCalendarToken(req.user!.id)) });
  } catch (err) {
    next(err);
  }
});

/**
 * Mounted at /calendar — the one route that serves someone's events without a session, because
 * the reader is Google's or Apple's server, not the person. The token in the path is the
 * credential.
 */
export const calendarFeedRouter = Router();

calendarFeedRouter.get('/:file', async (req, res, next) => {
  try {
    const token = req.params.file.replace(/\.ics$/, '');
    const ics = await buildCalendarFeed(token);
    if (ics === null) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=0, no-cache');
    res.send(ics);
  } catch (err) {
    next(err);
  }
});
