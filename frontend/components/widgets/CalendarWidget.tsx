'use client';

import { useClientDateStr } from '@/hooks/useClientDate';

interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}
interface CalendarWidgetProps {
  events?: CalendarEvent[]; fetched_at?: string; loading?: boolean;
  /** Wie viele Tage vorausgeschaut wird, falls heute nichts mehr ansteht. Default 2. */
  lookaheadDays?: number;
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

/**
 * Liefert die anzuzeigenden Events:
 *  1. Alle noch nicht abgelaufenen Termine von HEUTE (Ganztags zählt immer als "heute aktuell").
 *  2. Stehen heute keine an, werden die kommenden Termine der nächsten
 *     `lookaheadDays` Tage gezeigt — gruppiert nach Tag, bis zum ersten Tag
 *     mit Terminen (so dass nicht alle leeren Tage durchlaufen werden).
 * Vergangene Termine werden NIE angezeigt.
 */
function buildVisibleDays(
  events: CalendarEvent[],
  todayStr: string,
  lookaheadDays: number,
): { day: string; events: CalendarEvent[] }[] {
  const now = new Date();

  // Hilfsfunktion: ist dieser Termin schon vorbei?
  const isPast = (e: CalendarEvent): boolean => {
    if (e.allDay) return false; // Ganztags-Termine gelten den ganzen Tag als aktuell
    return new Date(e.end) < now;
  };

  // Termine nach lokalem Datum gruppieren
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const dateKey = toLocalDateStr(new Date(e.start));
    if (dateKey < todayStr) continue;        // vergangene Tage komplett raus
    if (dateKey === todayStr && isPast(e)) continue; // abgelaufene heutige Termine raus
    if (!byDay.has(dateKey)) byDay.set(dateKey, []);
    byDay.get(dateKey)!.push(e);
  }
  for (const [, evs] of byDay) {
    evs.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  // Hat HEUTE noch Termine? Dann nur heute zeigen.
  const todayEvents = byDay.get(todayStr);
  if (todayEvents?.length) {
    return [{ day: todayStr, events: todayEvents }];
  }

  // Sonst: kommende Tage durchsuchen (bis lookaheadDays), ersten Tag mit Terminen zeigen
  const result: { day: string; events: CalendarEvent[] }[] = [];
  const base = new Date(todayStr + 'T00:00:00');
  for (let i = 1; i <= lookaheadDays; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const key = toLocalDateStr(d);
    const evs = byDay.get(key);
    if (evs?.length) {
      result.push({ day: key, events: evs });
    }
  }
  return result;
}

function formatDateLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase();
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  return new Date(event.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarWidget({ events = [], fetched_at, loading, lookaheadDays = 2 }: CalendarWidgetProps) {
  // null on server render — no hydration mismatch
  const todayStr = useClientDateStr();

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div style={{ background: '#e8e4de', borderRadius: 4, height: 12, width: 80, marginBottom: 16 }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ background: '#e8e4de', borderRadius: 4, height: 10, width: 60, marginBottom: 8 }} />
            <div style={{ background: '#e8e4de', borderRadius: 10, height: 40 }} />
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
  const tomorrowStr = toLocalDateStr(tomorrowDate);

  const visibleDays = buildVisibleDays(events, todayStr, lookaheadDays);
  const hasEvents = visibleDays.length > 0;

  // Steht heute nichts mehr an, aber es kommen Termine → kleiner Hinweis
  const showsUpcomingOnly = hasEvents && visibleDays[0].day !== todayStr;

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
        <p className="text-sm font-sans py-4 text-center" style={{ color: '#a09d99' }}>
          Keine anstehenden Termine
        </p>
      ) : (
        <div className="space-y-4">
          {showsUpcomingOnly && (
            <p className="text-xs font-sans" style={{ color: '#a09d99' }}>
              Heute nichts mehr — als Nächstes:
            </p>
          )}
          {visibleDays.map(({ day, events: dayEvents }) => (
            <div key={day}>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#a09d99' }}>
                {formatDateLabel(day, todayStr, tomorrowStr)}
              </p>
              <div className="space-y-1">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-3 py-2"
                    style={{
                      background: '#f7f4f0',
                      borderLeft: `3px solid ${event.color ?? '#6366f1'}`,
                      borderRadius: '0 8px 8px 0',
                    }}
                  >
                    <span className="text-xs font-sans flex-shrink-0 tabular-nums" style={{ color: '#a09d99', minWidth: 44 }}>
                      {formatEventTime(event)}
                    </span>
                    <p className="text-sm font-sans font-medium truncate flex-1" style={{ color: '#1a1814' }}>
                      {event.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}