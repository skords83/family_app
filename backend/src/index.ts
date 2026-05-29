import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { pool } from './db/pool';
import { schema } from './db/schema';
import { usersRouter } from './routes/users';
import { tasksRouter } from './routes/tasks';
import { pointsRouter, userPointsRouter } from './routes/points';
import { rewardsRouter } from './routes/rewards';
import { configRouter } from './routes/config';
import { weatherRouter } from './widgets/weather';
import { caldavRouter } from './widgets/caldav';
import { norishRouter } from './widgets/norish';
import { immichRouter } from './widgets/immich';
import { startDailyTaskCron, generateDailyTasks } from './jobs/generateDailyTasks';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: '*' }));
// Increase JSON limit to 10mb for base64 photo uploads
app.use(express.json({ limit: '10mb' }));

app.use('/api/users', usersRouter);
app.use('/api/users/:id/points', userPointsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/points', pointsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/config', configRouter);
app.use('/api/widgets/weather', weatherRouter);
app.use('/api/widgets/calendar', caldavRouter);
app.use('/api/widgets/meals', norishRouter);
app.use('/api/widgets/immich', immichRouter);

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
    try {
      await generateDailyTasks();
    } catch (err) {
      console.error('Initial task generation failed (non-fatal):', err);
    }
    startDailyTaskCron();
    app.listen(PORT, () => {
      console.log(`Family Organizer backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();