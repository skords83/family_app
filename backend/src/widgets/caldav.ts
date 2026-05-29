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
}

export const caldavRouter = Router();

function parseICSEvents(icsData: string, weeksAhead = 4): CalendarEvent[] {
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
    });
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events;
}

// Step 1: PROPFIND to discover all calendar collections under the user's calendar home
async function discoverCalendarUrls(baseUrl: string, auth: string): Promise<string[]> {
  const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
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

  // Extract <D:href> values from responses that contain <cal:calendar> resourcetype
  // Split by <D:response> blocks and check each one
  const calendarUrls: string[] = [];
  const responseBlocks = xml.split(/<\/?[^>]*:response>/i).filter(Boolean);

  // Simpler approach: find all hrefs, then filter blocks containing "calendar" resourcetype
  const hrefMatches = xml.matchAll(/<[^>]*:href[^>]*>([^<]+)<\/[^>]*:href>/gi);
  const allHrefs = [...hrefMatches].map(m => m[1].trim());

  // Find which blocks have calendar resourcetype
  const calendarBlocks = xml.match(/<D:response[\s\S]*?<\/D:response>/gi) ?? [];

  for (const block of calendarBlocks) {
    // Must contain calendar resourcetype
    if (!block.includes('calendar') || block.includes('schedule-inbox') || block.includes('schedule-outbox')) {
      continue;
    }
    // Extract href from this block
    const hrefMatch = block.match(/<[^>]*:href[^>]*>([^<]+)<\/[^>]*:href>/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1].trim();
    // Skip the root itself (exact match to baseUrl path)
    const basePath = new URL(baseUrl).pathname.replace(/\/?$/, '/');
    const hrefPath = href.replace(/\/?$/, '/');
    if (hrefPath === basePath) continue;

    // Build full URL
    const fullUrl = href.startsWith('http') ? href : `${new URL(baseUrl).origin}${href}`;
    calendarUrls.push(fullUrl);
  }

  return calendarUrls;
}

// Step 2: REPORT on a single calendar URL to get all VEVENTs
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

  if (!response.ok && response.status !== 207) {
    return [];
  }

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

async function fetchCalDAV(): Promise<CalendarEvent[]> {
  const caldavUrl = process.env.CALDAV_URL;
  const caldavUser = process.env.CALDAV_USER;
  const caldavPass = process.env.CALDAV_PASS;

  if (!caldavUrl || !caldavUser || !caldavPass) {
    throw new Error('CalDAV configuration missing');
  }

  const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');

  // Discover all calendars
  const calendarUrls = await discoverCalendarUrls(caldavUrl, auth);
  console.log(`Discovered ${calendarUrls.length} calendars:`, calendarUrls);

  if (calendarUrls.length === 0) {
    throw new Error('No calendars found via PROPFIND');
  }

  // Fetch events from all calendars in parallel
  const allVevents: string[] = [];
  await Promise.all(
    calendarUrls.map(async (url) => {
      try {
        const vevents = await fetchCalendarEvents(url, auth);
        allVevents.push(...vevents);
      } catch (err) {
        console.warn(`Failed to fetch calendar ${url}:`, err);
      }
    })
  );

  if (allVevents.length === 0) {
    throw new Error('No events found in any calendar');
  }

  const icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Family Organizer//EN\r\n${allVevents.join('\r\n')}\r\nEND:VCALENDAR`;
  return parseICSEvents(icsContent);
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

// GET /api/widgets/calendar
caldavRouter.get('/', async (_req: Request, res: Response) => {
  try {
    let data: CalendarEvent[];
    let fetched_at: string;
    let fromCache = false;

    try {
      data = await fetchCalDAV();
      fetched_at = await updateCalendarCache(data);
    } catch (fetchErr) {
      console.error('CalDAV fetch failed, trying cache:', fetchErr);
      const cached = await getCachedCalendar();
      if (!cached) {
        return res.status(503).json({ error: 'Calendar data unavailable', events: [] });
      }
      data = cached.data;
      fetched_at = cached.fetched_at;
      fromCache = true;
    }

    res.json({ events: data, fetched_at, from_cache: fromCache });
  } catch (err) {
    console.error('Error in calendar handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});