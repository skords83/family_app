import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
export const timetableRouter = Router();

// ──────────────────────────────────────────────────────────────────────
// WICHTIG: Literal-Routen VOR /:userId registrieren, sonst matcht
// Express "subject-colors" als userId-Parameter.
// ──────────────────────────────────────────────────────────────────────

// GET /api/timetable/subject-colors — globale Fachfarben laden
timetableRouter.get('/subject-colors', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT subject, bg, fg FROM timetable_subject_colors ORDER BY subject`,
    );
    const map: Record<string, { bg: string; fg: string }> = {};
    for (const row of result.rows) {
      map[row.subject] = { bg: row.bg, fg: row.fg };
    }
    res.json(map);
  } catch (err) {
    console.error('[timetable] GET subject-colors error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/timetable/subject-colors — globale Fachfarben speichern (Bulk-Upsert)
timetableRouter.put('/subject-colors', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return res.status(400).json({ error: 'Body must be a JSON object { subject: { bg, fg } }' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [subject, colors] of Object.entries(data)) {
        const { bg, fg } = colors as { bg: string; fg: string };
        if (!bg || !fg) continue;
        await client.query(
          `INSERT INTO timetable_subject_colors (subject, bg, fg)
           VALUES ($1, $2, $3)
           ON CONFLICT (subject) DO UPDATE SET bg = EXCLUDED.bg, fg = EXCLUDED.fg`,
          [subject, bg, fg],
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[timetable] PUT subject-colors error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/timetable — Alle Stundenpläne (für Gesamt-Übersicht / subject-color-Sync)
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