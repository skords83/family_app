import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

export const timetableRouter = Router();

// GET /api/timetable/:userId — Stundenplan eines Kindes laden
timetableRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT data FROM timetables WHERE user_id = $1`,
      [userId],
    );
    if (result.rows.length === 0) {
      return res.json({});
    }
    res.json(result.rows[0].data ?? {});
  } catch (err) {
    console.error('[timetable] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/timetable/:userId — Stundenplan eines Kindes speichern
timetableRouter.put('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const data = req.body;

    if (typeof data !== 'object' || data === null) {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }

    await pool.query(
      `INSERT INTO timetables (user_id, data)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [userId, JSON.stringify(data)],
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[timetable] PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/timetable — Alle Stundenpläne (für subject-color-Sync)
timetableRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT user_id, data FROM timetables`);
    const all: Record<string, unknown> = {};
    for (const row of result.rows) {
      all[row.user_id] = row.data ?? {};
    }
    res.json(all);
  } catch (err) {
    console.error('[timetable] GET all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});