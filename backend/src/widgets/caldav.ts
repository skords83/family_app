import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import * as ical from 'node-ical';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
  calendarName?: string;
}

interface CalendarMeta {
  url: string;
  color: string;
  name: string;
}

export const caldavRouter = Router();

// Cache TTL: 5 Minuten
const CACHE_TTL_MS = 5 * 60 * 1000;

// Fallback colors if Nextcloud doesn't return one
const FALLBACK_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function parseICSEvents(icsData: string, color: string, calendarName: string, weeksAhead = 4): CalendarEvent[] {
  const parsed = ical.sync.parseICS(icsData);
  const events: CalendarEvent[] = [];

  const now = new Date();
  const futureLimit = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (component.type !== 'VEVENT') continue;

    const event = component as ical.VEvent;
    if (!event.start) continue;

    const startDate = new Date(event.start);
    const endDate = event.end ? new Date(event.end) : startDate;

    if (endDate < now || startDate > futureLimit) continue;

    const allDay =
      event.start instanceof Date &&
      event.start.getHours() === 0 &&
      event.start.getMinutes() === 0 &&
      event.start.getSeconds() === 0 &&
      (event as any).datetype === 'date';

    events.push({
      id: event.uid ?? key,
      title: event.summary ?? '(no title)',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay,
      color,
      calendarName,
    });
  }

  return events;
}

// PROPFIND to discover all calendar collections with their color and displayname
async function discoverCalendars(baseUrl: string, auth: string): Promise<CalendarMeta[]> {
  const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:"
            xmlns:C="urn:ietf:params:xml:ns:caldav"
            xmlns:A="http://apple.com/ns/ical/">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <A:calendar-color/>
  </D:prop>
</D:propfind>`;

  const response = await fetch(baseUrl, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      Depth: '1',
    },
    body: propfindBody,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok && response.status !== 207) {
    throw new Error(`PROPFIND failed with status ${response.status}`);
  }

  const xml = await response.text();
  const calendars: CalendarMeta[] = [];
  const basePath = new URL(baseUrl).pathname.replace(/\/?$/, '/');

  const calendarBlocks = xml.match(/<D:response[\s\S]*?<\/D:response>/gi) ?? [];

  for (const block of calendarBlocks) {
    // Must be a calendar collection, skip inbox/outbox
    if (!block.includes('calendar') || block.includes('schedule-inbox') || block.includes('schedule-outbox')) {
      continue;
    }

    const hrefMatch = block.match(/<D:href[^>]*>([^<]+)<\/D:href>/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1].trim();
    const hrefPath = href.replace(/\/?$/, '/');
    if (hrefPath === basePath) continue;

    const fullUrl = href.startsWith('http') ? href : `${new URL(baseUrl).origin}${href}`;

    // Extract displayname
    const nameMatch = block.match(/<D:displayname[^>]*>([^<]*)<\/D:displayname>/i);
    const name = nameMatch?.[1]?.trim() || href.split('/').filter(Boolean).pop() || 'Kalender';

    // Extract apple calendar-color (may include alpha suffix like #FF0000FF)
    const colorMatch = block.match(/<[^>]*:?calendar-color[^>]*>([^<]+)<\/[^>]*:?calendar-color>/i);
    let color = colorMatch?.[1]?.trim() ?? '';
    // Strip alpha channel if present (#RRGGBBAA → #RRGGBB)
    if (color.match(/^#[0-9a-fA-F]{8}$/)) {
      color = color.slice(0, 7);
    }
    if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
      color = FALLBACK_COLORS[calendars.length % FALLBACK_COLORS.length];
    }

    calendars.push({ url: fullUrl, color, name });
  }

  return calendars;
}

// REPORT on a single calendar to get raw VEVENT strings
async function fetchCalendarEvents(calendarUrl: string, auth: string): Promise<string[]> {
  const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const response = await fetch(calendarUrl, {
    method: 'REPORT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      Depth: '1',
    },
    body: reportBody,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok && response.status !== 207) return [];

  const xml = await response.text();
  const vevents: string[] = [];

  const calDataMatches = xml.match(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/gi) ?? [];

  for (const match of calDataMatches) {
    const innerMatch = match.match(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/i);
    if (!innerMatch?.[1]) continue;
    const icsBlock = innerMatch[1].trim();
    const veventMatches = icsBlock.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
    if (veventMatches) vevents.push(...veventMatches);
  }

  return vevents;
}

async function getUserColorMap(): Promise<Map<string, string>> {
  const result = await pool.query(`SELECT name, color FROM users WHERE color IS NOT NULL`);
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(row.name.toLowerCase(), row.color);
  }
  return map;
}

async function fetchCalDAV(): Promise<CalendarEvent[]> {
  const caldavUrl = process.env.CALDAV_URL;
  const caldavUser = process.env.CALDAV_USER;
  const caldavPass = process.env.CALDAV_PASS;

  if (!caldavUrl || !caldavUser || !caldavPass) {
    throw new Error('CalDAV configuration missing');
  }

  const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');

  const [calendars, userColors] = await Promise.all([
    discoverCalendars(caldavUrl, auth),
    getUserColorMap(),
  ]);

  console.log(`Discovered ${calendars.length} calendars:`, calendars.map(c => `${c.name} (${c.color})`));

  if (calendars.length === 0) {
    throw new Error('No calendars found via PROPFIND');
  }

  // Fetch all calendars in parallel, parse each with its own color+name
  const allEvents: CalendarEvent[] = [];

  await Promise.all(
    calendars.map(async (cal) => {
      try {
        const vevents = await fetchCalendarEvents(cal.url, auth);
        if (vevents.length === 0) return;

        // User-Farbe hat Vorrang vor Nextcloud-Kalenderfarbe
        const userColor = userColors.get(cal.name.toLowerCase());
        const color = userColor ?? cal.color;

        const icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Family Organizer//EN\r\n${vevents.join('\r\n')}\r\nEND:VCALENDAR`;
        const events = parseICSEvents(icsContent, color, cal.name);
        allEvents.push(...events);
      } catch (err) {
        console.warn(`Failed to fetch calendar ${cal.url}:`, err);
      }
    })
  );

  if (allEvents.length === 0) {
    throw new Error('No events found in any calendar');
  }

  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return allEvents;
}

async function getCachedCalendar(): Promise<{ data: CalendarEvent[]; fetched_at: string } | null> {
  const result = await pool.query(`
    SELECT data, fetched_at FROM widget_cache WHERE widget_type = 'calendar'
  `);
  if (result.rows.length === 0) return null;
  return {
    data: result.rows[0].data,
    fetched_at: result.rows[0].fetched_at,
  };
}

async function updateCalendarCache(data: CalendarEvent[]): Promise<string> {
  const result = await pool.query(`
    INSERT INTO widget_cache (widget_type, data, fetched_at)
    VALUES ('calendar', $1, NOW())
    ON CONFLICT (widget_type)
    DO UPDATE SET data = $1, fetched_at = NOW()
    RETURNING fetched_at
  `, [JSON.stringify(data)]);
  return result.rows[0].fetched_at;
}

// Kalender die beim Erstellen auswählbar sind
const ALLOWED_CALENDARS = ['familie', 'sven', 'sanna', 'smilla', 'sophine', 'silja', 'samu'];

// GET /api/widgets/calendar/calendars — verfügbare Kalender für das Erstell-Modal
caldavRouter.get('/calendars', async (_req: Request, res: Response) => {
  try {
    const caldavUrl = process.env.CALDAV_URL;
    const caldavUser = process.env.CALDAV_USER;
    const caldavPass = process.env.CALDAV_PASS;
    if (!caldavUrl || !caldavUser || !caldavPass) {
      return res.status(503).json({ error: 'CalDAV configuration missing' });
    }
    const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');
    const [calendars, userColors] = await Promise.all([
      discoverCalendars(caldavUrl, auth),
      getUserColorMap(),
    ]);
    const filtered = calendars
      .filter(c => ALLOWED_CALENDARS.includes(c.name.toLowerCase()))
      .map(c => ({
        url: c.url,
        name: c.name,
        color: userColors.get(c.name.toLowerCase()) ?? c.color,
      }));
    res.json({ calendars: filtered });
  } catch (err) {
    console.error('Error fetching calendar list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/widgets/calendar — neuen Termin anlegen
caldavRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, start, end, allDay, calendarUrl } = req.body as {
      title: string;
      start: string;       // ISO string
      end: string;         // ISO string
      allDay: boolean;
      calendarUrl: string; // volle Nextcloud-URL des Zielkalenders
    };

    if (!title || !start || !end || !calendarUrl) {
      return res.status(400).json({ error: 'title, start, end, calendarUrl sind erforderlich' });
    }

    const caldavUser = process.env.CALDAV_USER;
    const caldavPass = process.env.CALDAV_PASS;
    if (!caldavUser || !caldavPass) {
      return res.status(503).json({ error: 'CalDAV configuration missing' });
    }
    const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');

    // UID + Dateinamen generieren
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@family-organizer`;
    const filename = `${uid}.ics`;

    // iCal-String bauen
    function toICalDate(iso: string): string {
      return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
    }
    function toICalDateOnly(iso: string): string {
      return iso.split('T')[0].replace(/-/g, '');
    }

    const now = toICalDate(new Date().toISOString());
    let dtstart: string;
    let dtend: string;

    if (allDay) {
      dtstart = `DTSTART;VALUE=DATE:${toICalDateOnly(start)}`;
      dtend   = `DTEND;VALUE=DATE:${toICalDateOnly(end)}`;
    } else {
      dtstart = `DTSTART:${toICalDate(start)}`;
      dtend   = `DTEND:${toICalDate(end)}`;
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Family Organizer//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      dtstart,
      dtend,
      `SUMMARY:${title}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const putUrl = calendarUrl.replace(/\/?$/, '/') + filename;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'text/calendar; charset=utf-8',
      },
      body: icsContent,
      signal: AbortSignal.timeout(15000),
    });

    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      console.error(`[caldav] PUT failed: ${putRes.status} ${await putRes.text()}`);
      return res.status(502).json({ error: `CalDAV PUT failed: ${putRes.status}` });
    }

    // Cache invalidieren → nächster GET holt frische Daten
    await pool.query(`DELETE FROM widget_cache WHERE widget_type = 'calendar'`);
    console.log(`[caldav] Event created: "${title}" in ${calendarUrl}`);

    res.status(201).json({ ok: true, uid });
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/widgets/calendar
caldavRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cached = await getCachedCalendar();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();

      if (age < CACHE_TTL_MS) {
        // Cache frisch → sofort zurückgeben, kein CalDAV-Call
        return res.json({ events: cached.data, fetched_at: cached.fetched_at, from_cache: true });
      }

      // Cache vorhanden aber alt → sofort zurückgeben, im Hintergrund neu holen
      res.json({ events: cached.data, fetched_at: cached.fetched_at, from_cache: true });

      fetchCalDAV()
        .then(data => updateCalendarCache(data))
        .then(() => console.log('[caldav] Background refresh completed'))
        .catch(err => console.error('[caldav] Background refresh failed:', err));

      return;
    }

    // Kein Cache vorhanden (erster Start nach DB-Reset) → muss warten
    console.log('[caldav] No cache found, fetching CalDAV...');
    try {
      const data = await fetchCalDAV();
      const fetched_at = await updateCalendarCache(data);
      return res.json({ events: data, fetched_at, from_cache: false });
    } catch (fetchErr) {
      console.error('[caldav] Initial fetch failed:', fetchErr);
      return res.status(503).json({ error: 'Calendar data unavailable', events: [] });
    }

  } catch (err) {
    console.error('Error in calendar handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});