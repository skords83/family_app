'use client';

interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}
interface CalendarWidgetProps {
  events?: CalendarEvent[]; fetched_at?: string; loading?: boolean;
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  for (const event of events) {
    const startDate = new Date(event.start);
    if (startDate > sevenDaysLater) continue;
    const dateKey = startDate.toISOString().split('T')[0];
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(event);
  }
  return map;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dateStr === today.toISOString().split('T')[0]) return 'Heute';
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  return new Date(event.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const S = {
  card:    { background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: 18 },
  title:   { color: '#a09d99' },
  stale:   { color: '#f0a500' },
  time:    { color: '#a09d99' },
  dlabel:  { color: '#a09d99' },
  evbg:    { background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '7px 12px' },
  evname:  { color: '#1a1814' },
  empty:   { color: '#a09d99' },
  skelBg:  { background: '#e8e4de', borderRadius: 6 },
};

export default function CalendarWidget({ events = [], fetched_at, loading }: CalendarWidgetProps) {
  if (loading) {
    return (
      <div style={{ ...S.card, animationName: 'pulse' }}>
        <div style={{ ...S.skelBg, height: 14, width: 96, marginBottom: 12 }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ ...S.skelBg, height: 10, width: 64, marginBottom: 8 }} />
            <div style={{ ...S.skelBg, height: 32, marginBottom: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  const stale = isStale(fetched_at);
  const grouped = groupEventsByDay(events);
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  const hasEvents = days.some(d => grouped.has(d));

  return (
    <div style={S.card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={S.title}>Kalender</h3>
        <div className="flex items-center gap-2">
          {stale && <span className="text-xs" style={S.stale}>⚠ veraltet</span>}
          {fetched_at && (
            <span className="text-xs font-sans" style={S.time}>
              {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {!hasEvents ? (
        <p className="text-sm font-sans py-4 text-center" style={S.empty}>Keine Termine diese Woche</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {days.map(day => {
            const dayEvents = grouped.get(day);
            if (!dayEvents?.length) return null;
            return (
              <div key={day}>
                <p className="text-[10px] font-sans font-semibold uppercase mb-1.5" style={S.dlabel}>
                  {formatDateLabel(day)}
                </p>
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div key={event.id} className="flex items-start gap-2" style={{ ...S.evbg, borderLeft: `3px solid ${event.color ?? '#6366f1'}` }}>
                      <span className="text-xs font-sans flex-shrink-0 mt-0.5 w-14" style={S.time}>
                        {formatEventTime(event)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-sans font-medium truncate" style={S.evname}>{event.title}</p>
                        {event.calendarName && (
                          <p className="text-xs mt-0.5 truncate font-sans" style={{ color: event.color ?? '#6366f1', opacity: 0.8 }}>
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
