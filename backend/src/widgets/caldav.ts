import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import * as ical from 'node-ical';
import { RRule } from 'rrule';
import {
  CalendarEventSchema,
  CalendarResponseSchema,
  CalendarCreateInputSchema,
  type CalendarEvent,
  type CalendarMeta,
} from '@family/shared';

export const caldavRouter = Router();

// Cache TTL: 5 Minuten
const CACHE_TTL_MS = 5 * 60 * 1000;

const FALLBACK_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ICS-Titel können HTML-Entities enthalten (z.B. Nextcloud liefert &amp; statt &)
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// RFC-5545 erlaubt statt DTEND ein DURATION-Property (z.B. "PT30M"). node-ical
// setzt in diesem Fall event.end == event.start (keine Addition der Dauer) und
// legt den rohen ISO-8601-Duration-String separat unter event.duration ab.
function parseISODuration(iso: string): number {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!match) return 0;
  const [, sign, weeks, days, hours, minutes, seconds] = match;
  const ms =
    (Number(weeks ?? 0) * 7 * 24 * 60 * 60 +
      Number(days ?? 0) * 24 * 60 * 60 +
      Number(hours ?? 0) * 60 * 60 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)) *
    1000;
  return sign === '-' ? -ms : ms;
}

function parseICSEvents(icsData: string, color: string, calendarName: string, weeksAhead = 26): CalendarEvent[] {
  const parsed = ical.sync.parseICS(icsData);
  const events: CalendarEvent[] = [];

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 52 * 7 * 24 * 60 * 60 * 1000);
  const futureLimit = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (component.type !== 'VEVENT') continue;

    const event = component as ical.VEvent;
    if (!event.start) continue;

    const originalStart = new Date(event.start);
    // RFC-5545: ein VEVENT hat entweder DTEND oder DURATION, nie beide.
    // node-ical setzt bei DURATION event.end == event.start, daher hat
    // DURATION Vorrang, wenn vorhanden.
    const isoDuration: string | undefined = (event as any).duration;
    const duration = isoDuration
      ? parseISODuration(isoDuration)
      : event.end
        ? new Date(event.end).getTime() - originalStart.getTime()
        : 0;

    const allDay =
      event.start instanceof Date &&
      event.start.getHours() === 0 &&
      event.start.getMinutes() === 0 &&
      event.start.getSeconds() === 0 &&
      (event as any).datetype === 'date';

    // node-ical parsed TZID-Events falsch: DTSTART;TZID=Europe/Berlin:20260406T110000
    // wird zu 2026-04-06T09:00:00Z (zieht den TZ-Offset ab statt ihn zu ignorieren).
    let tzOffsetMs = 0;
    if (!allDay && (event as any).rrule) {
      const tzid: string | undefined = (event.start as any).tz;
      if (tzid) {
        try {
          const fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: tzid,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          });
          const parts = fmt.formatToParts(originalStart);
          const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
          const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
          tzOffsetMs = wallAsUtc - originalStart.getTime();
        } catch {
          tzOffsetMs = 0;
        }
      }
    }

    // Wiederkehrende Termine per RRULE expandieren — recurring: true mitliefern
    if ((event as any).rrule) {
      try {
        const rruleObj: RRule = (event as any).rrule;

        const exdates = new Set<number>();
        if ((event as any).exdate) {
          // node-ical liefert exdate als Array-artiges Objekt mit length 0 —
          // die Date-Werte hängen unter benannten (Datums-)Keys statt Indizes,
          // daher liefert Array.isArray() true, aber for..of über das "Array"
          // findet nichts. Object.values() funktioniert für beide Formen.
          // Gleicher TZID-Offset wie bei den Occurrences nötig, da EXDATE vom
          // selben node-ical-Parsing-Bug betroffen ist (siehe tzOffsetMs oben).
          const ex = (event as any).exdate;
          for (const d of Object.values(ex) as unknown[]) {
            if (d instanceof Date) exdates.add(d.getTime() + tzOffsetMs);
          }
        }

        const occurrences = rruleObj.between(rangeStart, futureLimit, true);

        for (const occ of occurrences) {
          const startDate = new Date(occ.getTime() + tzOffsetMs);
          if (exdates.has(startDate.getTime())) continue;
          const endDate = new Date(startDate.getTime() + duration);
          events.push(CalendarEventSchema.parse({
            id: `${event.uid ?? key}-${startDate.toISOString()}`,
            title: decodeHtmlEntities(event.summary ?? '(no title)'),
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            allDay,
            color,
            calendarName,
            recurring: true,
          }));
        }
      } catch (err) {
        console.warn(`[caldav] RRULE expansion failed for ${event.uid}:`, err);
        const endDate = new Date(originalStart.getTime() + duration);
        if (originalStart >= rangeStart && originalStart <= futureLimit) {
          events.push(CalendarEventSchema.parse({
            id: event.uid ?? key,
            title: decodeHtmlEntities(event.summary ?? '(no title)'),
            start: originalStart.toISOString(),
            end: endDate.toISOString(),
            allDay,
            color,
            calendarName,
            recurring: true,
          }));
        }
      }
      continue;
    }

    // Einmalige Termine
    const endDate = new Date(originalStart.getTime() + duration);
    if (originalStart > futureLimit || endDate < rangeStart) continue;

    events.push(CalendarEventSchema.parse({
      id: event.uid ?? key,
      title: decodeHtmlEntities(event.summary ?? '(no title)'),
      start: originalStart.toISOString(),
      end: endDate.toISOString(),
      allDay,
      color,
      calendarName,
      recurring: false,
    }));
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
    if (!block.includes('calendar') || block.includes('schedule-inbox') || block.includes('schedule-outbox')) {
      continue;
    }

    const hrefMatch = block.match(/<D:href[^>]*>([^<]+)<\/D:href>/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1].trim();
    const hrefPath = href.replace(/\/?$/, '/');
    if (hrefPath === basePath) continue;

    const fullUrl = href.startsWith('http') ? href : `${new URL(baseUrl).origin}${href}`;

    const nameMatch = block.match(/<D:displayname[^>]*>([^<]*)<\/D:displayname>/i);
    const name = nameMatch?.[1]?.trim() || href.split('/').filter(Boolean).pop() || 'Kalender';

    const colorMatch = block.match(/<[^>]*:?calendar-color[^>]*>([^<]+)<\/[^>]*:?calendar-color>/i);
    let color = colorMatch?.[1]?.trim() ?? '';
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

// REPORT on a single calendar to get raw VEVENT strings + VTIMEZONE blocks
async function fetchCalendarEvents(calendarUrl: string, auth: string): Promise<{ vevents: string[]; vtimezones: string[] }> {
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

  if (!response.ok && response.status !== 207) return { vevents: [], vtimezones: [] };

  const xml = await response.text();
  const vevents: string[] = [];
  const vtimezones: string[] = [];

  const firstCalData = xml.match(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/i);
  if (firstCalData?.[1]) {
    const tzMatches = firstCalData[1].match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/g);
    if (tzMatches) vtimezones.push(...tzMatches);
  }

  const calDataMatches = xml.match(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/gi) ?? [];

  for (const match of calDataMatches) {
    const innerMatch = match.match(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/i);
    if (!innerMatch?.[1]) continue;
    const icsBlock = innerMatch[1].trim();
    const veventMatches = icsBlock.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
    if (veventMatches) vevents.push(...veventMatches);
  }

  return { vevents, vtimezones };
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

  const allEvents: CalendarEvent[] = [];

  await Promise.all(
    calendars.map(async (cal) => {
      try {
        const { vevents, vtimezones } = await fetchCalendarEvents(cal.url, auth);
        if (vevents.length === 0) return;

        const userColor = userColors.get(cal.name.toLowerCase());
        const color = userColor ?? cal.color;

        const tzBlock = vtimezones.length > 0 ? vtimezones.join('\r\n') + '\r\n' : '';
        const icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Family Organizer//EN\r\n${tzBlock}${vevents.join('\r\n')}\r\nEND:VCALENDAR`;
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
  return { data: result.rows[0].data, fetched_at: result.rows[0].fetched_at };
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

const ALLOWED_CALENDARS = ['familie', 'sven', 'sanna', 'smilla', 'sophine', 'silja', 'samu'];

// GET /api/widgets/calendar/calendars
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

// POST /api/widgets/calendar/events
caldavRouter.post('/events', async (req: Request, res: Response) => {
  const parsed = CalendarCreateInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'title, start, end, calendarUrl sind erforderlich' });
  }

  const { title, start, end, allDay, calendarUrl } = parsed.data;

  try {
    const caldavUser = process.env.CALDAV_USER;
    const caldavPass = process.env.CALDAV_PASS;
    if (!caldavUser || !caldavPass) {
      return res.status(503).json({ error: 'CalDAV configuration missing' });
    }
    const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');

    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@family-organizer`;
    const filename = `${uid}.ics`;

    function toICalDate(iso: string): string {
      return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
    }
    function toICalDateOnly(iso: string): string {
      return iso.split('T')[0].replace(/-/g, '');
    }

    const now = toICalDate(new Date().toISOString());
    const dtstart = allDay
      ? `DTSTART;VALUE=DATE:${toICalDateOnly(start)}`
      : `DTSTART:${toICalDate(start)}`;
    const dtend = allDay
      ? `DTEND;VALUE=DATE:${toICalDateOnly(end)}`
      : `DTEND:${toICalDate(end)}`;

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
        return res.json(CalendarResponseSchema.parse({
          events: cached.data,
          fetched_at: new Date(cached.fetched_at).toISOString(),
          from_cache: true,
        }));
      }

      // Cache vorhanden aber alt → sofort zurückgeben, im Hintergrund neu holen
      res.json(CalendarResponseSchema.parse({
        events: cached.data,
        fetched_at: new Date(cached.fetched_at).toISOString(),
        from_cache: true,
      }));

      fetchCalDAV()
        .then(data => updateCalendarCache(data))
        .then(() => console.log('[caldav] Background refresh completed'))
        .catch(err => console.error('[caldav] Background refresh failed:', err));

      return;
    }

    // Kein Cache → muss warten
    console.log('[caldav] No cache found, fetching CalDAV...');
    try {
      const data = await fetchCalDAV();
      const fetched_at = await updateCalendarCache(data);
      return res.json(CalendarResponseSchema.parse({
        events: data,
        fetched_at: new Date(fetched_at).toISOString(),
        from_cache: false,
      }));
    } catch (fetchErr) {
      console.error('[caldav] Initial fetch failed:', fetchErr);
      return res.status(503).json({ error: 'Calendar data unavailable', events: [] });
    }

  } catch (err) {
    console.error('Error in calendar handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});