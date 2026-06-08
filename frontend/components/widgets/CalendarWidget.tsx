'use client';

import { useClientDateStr } from '@/hooks/useClientDate';

interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}
interface CalendarWidgetProps {
  events?: CalendarEvent[]; fetched_at?: string; loading?: boolean;
  daysAhead?: number;
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

// Lokales Datum als YYYY-MM-DD — niemals toISOString() verwenden (UTC-Verschiebung!)
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ✅ todayStr passed in — no new Date() inside
function groupEventsByDay(events: CalendarEvent[], todayStr: string, daysAhead: number): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const todayDate = new Date(todayStr + 'T00:00:00');
  const cutoff = new Date(todayDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const now = new Date();

  for (const event of events) {
    const startDate = new Date(event.start);
    if (startDate >= cutoff) continue;
    const dateKey = toLocalDateStr(startDate); // lokal, nicht UTC
    if (dateKey < todayStr) continue;           // vergangene Tage überspringen
    // Heute: abgelaufene Termine ausblenden — Ganztags-Termine immer zeigen
    if (dateKey === todayStr && !event.allDay) {
      const endDate = new Date(event.end);
      if (endDate < now) continue;
    }
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(event);
  }
  return map;
}

// ✅ todayStr / tomorrowStr passed in
function formatDateLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase();
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  return new Date(event.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarWidget({ events = [], fetched_at, loading, daysAhead = 7 }: CalendarWidgetProps) {
  // ✅ null on server render — no hydration mismatch
  const todayStr = useClientDateStr();

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div style={{ background: '#e8e4de', borderRadius: 4, height: 12, width: 80, marginBottom: 16 }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ background: '#e8e4de', borderRadius: 4, height: 10, width: 60, marginBottom: 8 }} />
            <div style={{ background: '#e8e4de', borderRadius: 10, height: 56 }} />
          </div>
        ))}
      </div>
    );
  }

  const stale = isStale(fetched_at);

  // Render shell before hydration — no date-dependent content
  if (!todayStr) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
            Kalender
          </h3>
        </div>
      </div>
    );
  }

  // Build tomorrow string (safe — client-side only)
  const tomorrowDate = new Date(todayStr + 'T00:00:00');
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tomorrowDate); // lokal, nicht UTC

  const grouped = groupEventsByDay(events, todayStr, daysAhead);

  // Build the list of day keys to display
  const days: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() + i);
    days.push(toLocalDateStr(d)); // lokal, nicht UTC
  }
  const hasEvents = days.some(d => grouped.has(d));

  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
          Kalender
        </h3>
        <div className="flex items-center gap-1.5">
          {fetched_at && (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stale ? '#e0a020' : '#3a9a6e', flexShrink: 0, display: 'inline-block' }} />
              <span className="text-[10px] font-sans" style={{ color: '#a09d99' }}>
                {stale ? 'veraltet' : 'aktuell'}
              </span>
            </>
          )}
        </div>
      </div>

      {!hasEvents ? (
        <p className="text-sm font-sans py-4 text-center" style={{ color: '#a09d99' }}>Keine Termine heute</p>
      ) : (
        <div className="space-y-4">
          {days.map(day => {
            const dayEvents = grouped.get(day);
            if (!dayEvents?.length) return null;
            return (
              <div key={day}>
                <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#a09d99' }}>
                  {formatDateLabel(day, todayStr, tomorrowStr)}
                </p>
                <div className="space-y-1.5">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-xl px-4 py-3"
                      style={{
                        background: '#f7f4f0',
                        borderLeft: `3px solid ${event.color ?? '#6366f1'}`,
                        borderRadius: '0 10px 10px 0',
                      }}
                    >
                      <span className="text-xs font-sans flex-shrink-0 mt-0.5" style={{ color: '#a09d99', minWidth: 48 }}>
                        {formatEventTime(event)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-sans font-medium truncate" style={{ color: '#1a1814' }}>
                          {event.title}
                        </p>
                        {event.calendarName && (
                          <p className="text-xs font-sans mt-0.5 truncate" style={{ color: event.color ?? '#6366f1' }}>
                            {event.calendarName}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}