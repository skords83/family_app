import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { getTodayInAppTz } from '../utils/date';
import { dedupeByName, buildBirthdayWindow, type BirthdaySource } from '../lib/birthdays';
import { BirthdaysResponseSchema } from '@family/shared';

export interface ParsedContact {
  uid: string;
  name: string;
  month: number;
  day: number;
  year: number | null;
}

// vCard erlaubt Zeilenumbruch-Fortsetzungen (Zeile beginnt mit Leerzeichen/Tab).
function unfoldVCardLines(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

interface ParsedBday {
  month: number;
  day: number;
  year: number | null;
}

/**
 * Unterstuetzte BDAY-Formate (RFC 6350):
 *   YYYYMMDD     - z.B. 19960415
 *   YYYY-MM-DD   - z.B. 1996-04-15
 *   --MMDD/--MM-DD - Jahr unbekannt, z.B. --0415 / --04-15
 */
function parseVCardBirthday(raw: string): ParsedBday | null {
  const value = raw.trim();

  const unknownYearMatch = value.match(/^--(\d{2})-?(\d{2})$/);
  if (unknownYearMatch) {
    return { month: Number(unknownYearMatch[1]), day: Number(unknownYearMatch[2]), year: null };
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return { year: Number(compactMatch[1]), month: Number(compactMatch[2]), day: Number(compactMatch[3]) };
  }

  return null;
}

/** Extrahiert UID/FN/BDAY aus einem einzelnen BEGIN:VCARD...END:VCARD-Block. */
export function parseVCard(vcardText: string): ParsedContact | null {
  const unfolded = unfoldVCardLines(vcardText);

  const uidMatch = unfolded.match(/^UID:(.+)$/mi);
  const fnMatch = unfolded.match(/^FN:(.+)$/mi);
  const bdayMatch = unfolded.match(/^BDAY(?:;[^:]*)?:(.+)$/mi);

  if (!uidMatch || !fnMatch || !bdayMatch) return null;

  const parsedBday = parseVCardBirthday(bdayMatch[1]);
  if (!parsedBday) return null;

  return {
    uid: uidMatch[1].trim(),
    name: fnMatch[1].trim(),
    month: parsedBday.month,
    day: parsedBday.day,
    year: parsedBday.year,
  };
}

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
