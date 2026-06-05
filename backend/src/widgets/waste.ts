import { Router, Request, Response } from 'express';
import ical from 'node-ical';
import { pool } from '../db/pool';
import {
  WasteTodayResponseSchema,
  WasteUpcomingResponseSchema,
  type WasteType,
} from '@family/shared';

export const wasteRouter = Router();

// webcal:// ist nur ein Alias für https:// — wir normalisieren es hier
const rawIcalUrl =
  process.env.WASTE_ICAL_URL ??
  'webcal://backend.stadtreinigung.hamburg/kalender/abholtermine.ics?hnIds=170992';
const ICAL_URL = rawIcalUrl.replace(/^webcal:\/\//i, 'https://');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** YYYY-MM-DD im Europe/Berlin-Zeitraum */
function toBerlinDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Aktuelle Stunde (0–23) in Europe/Berlin */
function getBerlinHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10,
  );
}

/** iCal-SUMMARY → interner WasteType. Gibt null zurück wenn unbekannt. */
function summaryToType(summary: string): WasteType | null {
  const s = summary.toLowerCase().trim();
  if (s.includes('bioabfall') || s.includes('biotonne') || s.includes('bio'))
    return 'bioabfall';
  if (s.includes('papier') || s.includes('altpapier'))
    return 'papier';
  if (s.includes('wertstoff') || s.includes('gelbe tonne') || s.includes('hamburger wertstoff'))
    return 'wertstoff';
  if (s.includes('restm') || s.includes('restabfall'))
    return 'restmuell';
  return null;
}

// ── Fetch & Store ─────────────────────────────────────────────────────────────

export async function fetchAndStoreWasteEvents(): Promise<void> {
  console.log('[waste] Fetching iCal from Hamburger Stadtreinigung...');

  const events = await ical.async.fromURL(ICAL_URL);
  const now = new Date();
  const todayStr = toBerlinDate(now);

  const client = await pool.connect();
  try {
    let upserted = 0;
    let skippedUnknown = 0;

    for (const event of Object.values(events)) {
      if (event.type !== 'VEVENT') continue;
      if (!event.start || !event.summary) continue;

      // Für Ganztagstermine liefert node-ical UTC-Mitternacht.
      // +12h → Mittags → korrekte Datumszuordnung in jeder Zeitzone.
      const eventDate = new Date((event.start as Date).getTime() + 12 * 60 * 60 * 1000);
      const dateStr = toBerlinDate(eventDate);

      if (dateStr < todayStr) continue;

      const type = summaryToType(event.summary);
      if (!type) {
        console.warn(`[waste] Unbekannter SUMMARY "${event.summary}" — wird übersprungen`);
        skippedUnknown++;
        continue;
      }

      await client.query(`
        INSERT INTO external_events (source, date, type, title, raw_data)
        VALUES ('hh_stadtreinigung', $1, $2, $3, $4)
        ON CONFLICT (source, date, type) DO UPDATE SET
          title      = EXCLUDED.title,
          raw_data   = EXCLUDED.raw_data,
          fetched_at = NOW()
      `, [dateStr, type, event.summary.trim(), JSON.stringify({ uid: event.uid })]);

      upserted++;
    }

    // Vergangene Zeilen bereinigen
    await client.query(`
      DELETE FROM external_events
      WHERE source = 'hh_stadtreinigung' AND date < $1
    `, [todayStr]);

    console.log(`[waste] Fertig. Upserted: ${upserted}, Übersprungen (unbekannt): ${skippedUnknown}`);
  } finally {
    client.release();
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/widgets/waste/today
 *
 * Aktives Fenster: Vortag 15:00 → Abholtag 10:00
 *   hour >= 15  → morgen wird abgeholt  → aktiver Zustand
 *   hour < 10   → heute wird abgeholt   → aktiver Zustand
 *   sonst       → passiver Zustand       → nächste Abholung ab morgen
 *
 * `events` enthält IMMER alle Tonnen des relevanten Datums (nicht nur eine).
 * Bei passivem Zustand sind das alle Tonnen des nächsten Abfuhrtermins.
 */
wasteRouter.get('/today', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const hour = getBerlinHour();
    const todayStr = toBerlinDate(now);
    const tomorrowStr = toBerlinDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    const metaResult = await pool.query(`
      SELECT MAX(fetched_at) AS last_fetched
      FROM external_events
      WHERE source = 'hh_stadtreinigung'
    `);
    const fetched_at: string = metaResult.rows[0].last_fetched
      ? (metaResult.rows[0].last_fetched as Date).toISOString()
      : now.toISOString();

    const active = hour >= 15 || hour < 10;

    if (active) {
      const targetDate = hour >= 15 ? tomorrowStr : todayStr;

      const result = await pool.query(`
        SELECT id::text, source, date::text, type, title, fetched_at
        FROM external_events
        WHERE source = 'hh_stadtreinigung' AND date = $1
        ORDER BY type
      `, [targetDate]);

      const events = result.rows.map(r => ({
        ...r,
        fetched_at: (r.fetched_at as Date).toISOString(),
      }));

      return res.json(WasteTodayResponseSchema.parse({ active: true, events, next: events[0] ?? null, fetched_at }));
    }

    // Passiv: ALLE Events des nächsten Abfuhrtermins ab morgen.
    // (Zwischen 10–15 Uhr hat die heutige Abfuhr bereits stattgefunden
    // oder war nie geplant — wir schauen daher immer ab morgen.)
    const nextResult = await pool.query(`
      SELECT id::text, source, date::text, type, title, fetched_at
      FROM external_events
      WHERE source = 'hh_stadtreinigung'
        AND date = (
          SELECT MIN(date) FROM external_events
          WHERE source = 'hh_stadtreinigung' AND date >= $1
        )
      ORDER BY type
    `, [tomorrowStr]);

    const passiveEvents = nextResult.rows.map(r => ({
      ...r,
      fetched_at: (r.fetched_at as Date).toISOString(),
    }));

    return res.json(WasteTodayResponseSchema.parse({
      active: false,
      events: passiveEvents,
      next: passiveEvents[0] ?? null,
      fetched_at,
    }));
  } catch (err) {
    console.error('[waste] Fehler in /today:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/widgets/waste/upcoming
 * Nächste 10 Abholungen (~4–6 Wochen Vorschau) für die Detailansicht.
 */
wasteRouter.get('/upcoming', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStr = toBerlinDate(now);

    const result = await pool.query(`
      SELECT id::text, source, date::text, type, title, fetched_at
      FROM external_events
      WHERE source = 'hh_stadtreinigung' AND date >= $1
      ORDER BY date ASC, type ASC
      LIMIT 10
    `, [todayStr]);

    const metaResult = await pool.query(`
      SELECT MAX(fetched_at) AS last_fetched
      FROM external_events
      WHERE source = 'hh_stadtreinigung'
    `);
    const fetched_at: string = metaResult.rows[0].last_fetched
      ? (metaResult.rows[0].last_fetched as Date).toISOString()
      : now.toISOString();

    const events = result.rows.map(r => ({
      ...r,
      fetched_at: (r.fetched_at as Date).toISOString(),
    }));

    return res.json(WasteUpcomingResponseSchema.parse({ events, fetched_at }));
  } catch (err) {
    console.error('[waste] Fehler in /upcoming:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
