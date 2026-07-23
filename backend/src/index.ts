import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { createRealtimeServer } from './realtime/index.js';

const app = createApp();
const httpServer = createServer(app);
createRealtimeServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
});
