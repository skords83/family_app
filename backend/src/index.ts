import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { pool } from './db/pool';
import { schema } from './db/schema';
import { usersRouter } from './routes/users';
import { tasksRouter } from './routes/tasks';
import { timetableRouter } from './routes/timetable';
import { pointsRouter, userPointsRouter } from './routes/points';
import { rewardsRouter } from './routes/rewards';
import { configRouter } from './routes/config';
import { birthdaysRouter } from './routes/birthdays';
import { authRouter } from './routes/auth';
import { weatherRouter } from './widgets/weather';
import { caldavRouter } from './widgets/caldav';
import { norishRouter } from './widgets/norish';
import { immichRouter } from './widgets/immich';
import { wasteRouter, fetchAndStoreWasteEvents } from './widgets/waste';
import { birthdaysWidgetRouter } from './widgets/contacts';
import { homeassistantRouter } from './widgets/homeassistant';
import { appliancesRouter } from './widgets/appliances';
import { startDailyTaskCron, ensureTodayTasksGenerated } from './jobs/generateDailyTasks';
import { startWasteCron } from './jobs/refreshWaste';
import { sseHandler } from './sse';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Laeuft immer hinter genau einem Reverse-Proxy-Hop (Traefik) - ohne das hier sieht
// jede IP-basierte Logik (z.B. express-rate-limit) fuer alle Clients dieselbe interne
// Traefik-Adresse statt der echten Client-IP.
app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));

// SSE — vor compression und anderen Middlewares registrieren
app.get('/api/events', sseHandler);

app.use('/api/users', usersRouter);
app.use('/api/users/:id/points', userPointsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/timetable', timetableRouter);
app.use('/api/points', pointsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/config', configRouter);
app.use('/api/birthdays', birthdaysRouter);
app.use('/api/auth', authRouter);
app.use('/api/widgets/weather', weatherRouter);
app.use('/api/widgets/calendar', caldavRouter);
app.use('/api/widgets/meals', norishRouter);
app.use('/api/widgets/immich', immichRouter);
app.use('/api/widgets/waste', wasteRouter);
app.use('/api/widgets/birthdays', birthdaysWidgetRouter);
app.use('/api/widgets/homeassistant', homeassistantRouter);
app.use('/api/widgets/appliances', appliancesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    await client.query(schema);
    console.log('Migrations completed.');
  } finally {
    client.release();
  }
}

async function start(): Promise<void> {
  try {
    await runMigrations();

    // Catch-up generation on startup — covers the case where the 00:05 cron
    // was missed (container down, deployment, DB hiccup). Idempotent and
    // memoised, so safe even if today's instances already exist.
    try {
      await ensureTodayTasksGenerated();
    } catch (err) {
      console.error('Initial task generation failed (non-fatal):', err);
    }

    // Initialer Waste-Fetch beim Start — füllt external_events beim ersten Deploy.
    // Danach übernimmt der Cronjob. Non-fatal: Server startet auch ohne Netzwerk.
    fetchAndStoreWasteEvents().catch(err =>
      console.error('[waste] Initial fetch failed (non-fatal):', err),
    );

    startDailyTaskCron();
    startWasteCron();

    app.listen(PORT, () => {
      console.log(`Family Organizer backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();