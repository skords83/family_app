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
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase();
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  return new Date(event.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarWidget({ events = [], fetched_at, loading }: CalendarWidgetProps) {
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
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-widest" style={{ color: '#a09d99' }}>
          Kalender
        </h3>
        <div className="flex items-center gap-2">
          {stale && <span className="text-xs font-sans" style={{ color: '#f0a500' }}>⚠ veraltet</span>}
          {fetched_at && (
            <span className="text-xs font-sans" style={{ color: '#a09d99' }}>
              {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {!hasEvents ? (
        <p className="text-sm font-sans py-4 text-center" style={{ color: '#a09d99' }}>Keine Termine diese Woche</p>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {days.map(day => {
            const dayEvents = grouped.get(day);
            if (!dayEvents?.length) return null;
            return (
              <div key={day}>
                {/* Day label */}
                <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#a09d99' }}>
                  {formatDateLabel(day)}
                </p>
                {/* Events */}
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
                      {/* Time */}
                      <span className="text-xs font-sans flex-shrink-0 mt-0.5" style={{ color: '#a09d99', minWidth: 48 }}>
                        {formatEventTime(event)}
                      </span>
                      {/* Title + calendar name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-sans font-semibold truncate" style={{ color: '#1a1814' }}>
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