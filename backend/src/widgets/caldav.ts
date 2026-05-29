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

    // Include events that overlap with [now, futureLimit]
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

async function fetchCalDAV(): Promise<CalendarEvent[]> {
  const caldavUrl = process.env.CALDAV_URL;
  const caldavUser = process.env.CALDAV_USER;
  const caldavPass = process.env.CALDAV_PASS;

  if (!caldavUrl || !caldavUser || !caldavPass) {
    throw new Error('CalDAV configuration missing');
  }

  const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');

  // Try to fetch the calendar ICS directly
  // First try the well-known CalDAV endpoint approach: fetch user principal
  const calendarUrls = [
    `${caldavUrl}/calendars/${caldavUser}/personal/`,
    `${caldavUrl}/calendars/${caldavUser}/`,
    caldavUrl,
  ];

  let icsContent: string | null = null;

  for (const url of calendarUrls) {
    try {
      // Try REPORT request to get all calendar events
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

      const response = await fetch(url, {
        method: 'REPORT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/xml',
          Depth: '1',
        },
        body: reportBody,
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok || response.status === 207) {
        const xmlText = await response.text();

        // Extract calendar-data from XML response
        const calDataMatches = xmlText.match(/<.*?calendar-data[^>]*>([\s\S]*?)<\/.*?calendar-data>/g);

        if (calDataMatches && calDataMatches.length > 0) {
          // Combine all VEVENT blocks into one VCALENDAR
          const vevents: string[] = [];

          for (const match of calDataMatches) {
            const innerMatch = match.match(/<.*?calendar-data[^>]*>([\s\S]*?)<\/.*?calendar-data>/);
            if (innerMatch && innerMatch[1]) {
              const icsBlock = innerMatch[1].trim();
              // Extract VEVENT from full VCALENDAR blocks
              const veventMatches = icsBlock.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
              if (veventMatches) {
                vevents.push(...veventMatches);
              }
            }
          }

          if (vevents.length > 0) {
            icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Family Organizer//EN\r\n${vevents.join('\r\n')}\r\nEND:VCALENDAR`;
            break;
          }
        }

        // Fallback: try direct ICS fetch
        const icsResponse = await fetch(url, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'text/calendar',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (icsResponse.ok) {
          const text = await icsResponse.text();
          if (text.includes('BEGIN:VCALENDAR')) {
            icsContent = text;
            break;
          }
        }
      }
    } catch (_err) {
      // Try next URL
      continue;
    }
  }

  if (!icsContent) {
    throw new Error('Could not fetch any calendar data from CalDAV server');
  }

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
