import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { getTodayInAppTz } from '../utils/date';
import { dedupeByName, buildBirthdayWindow, type BirthdaySource } from '../lib/birthdays';
import { BirthdaysResponseSchema } from '@family/shared';

export const birthdaysWidgetRouter = Router();

/**
 * GET /api/widgets/birthdays
 *
 * Kombiniert Familienmitglieder (users.birthdate) mit externen Kontakten
 * (birthdays-Tabelle, source='carddav' oder 'manual', active=true).
 * Fenster: heute bis einschließlich +7 Tage.
 */
birthdaysWidgetRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const today = getTodayInAppTz();

    const usersResult = await pool.query<{ name: string; month: number; day: number; year: number | null }>(`
      SELECT
        name,
        EXTRACT(MONTH FROM birthdate)::int AS month,
        EXTRACT(DAY FROM birthdate)::int AS day,
        EXTRACT(YEAR FROM birthdate)::int AS year
      FROM users
      WHERE birthdate IS NOT NULL
    `);

    const contactsResult = await pool.query<{ name: string; month: number; day: number; year: number | null }>(`
      SELECT name, birth_month AS month, birth_day AS day, birth_year AS year
      FROM birthdays
      WHERE active = true
    `);

    const userEntries: BirthdaySource[] = usersResult.rows;
    const contactEntries: BirthdaySource[] = contactsResult.rows;
    const combined = dedupeByName(userEntries, contactEntries);
    const window = buildBirthdayWindow(combined, today);

    res.json(BirthdaysResponseSchema.parse({
      ...window,
      fetched_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[birthdays] Fehler in /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
