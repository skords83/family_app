'use client';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
}

interface CalendarWidgetProps {
  events?: CalendarEvent[];
  fetched_at?: string;
  loading?: boolean;
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
    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
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
  const start = new Date(event.start);
  return start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarWidget({ events = [], fetched_at, loading }: CalendarWidgetProps) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-24 mb-3" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-3">
            <div className="h-3 bg-slate-700 rounded w-16 mb-2" />
            <div className="h-8 bg-slate-700 rounded mb-1" />
          </div>
        ))}
      </div>
    );
  }

  const stale = isStale(fetched_at);
  const grouped = groupEventsByDay(events);

  // Get next 7 days
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }

  const hasEvents = days.some((d) => grouped.has(d));

  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Kalender</h3>
        <div className="flex items-center gap-2">
          {stale && <span className="text-xs text-amber-400">⚠ veraltet</span>}
          {fetched_at && (
            <span className="text-xs text-slate-500">
              {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Events */}
      {!hasEvents ? (
        <p className="text-slate-500 text-sm py-4 text-center">Keine Termine diese Woche</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {days.map((day) => {
            const dayEvents = grouped.get(day);
            if (!dayEvents || dayEvents.length === 0) return null;

            return (
              <div key={day}>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">
                  {formatDateLabel(day)}
                </p>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 bg-slate-700/50 rounded-lg px-3 py-2"
                      style={{
                        borderLeft: `3px solid ${event.color ?? '#6366f1'}`,
                      }}
                    >
                      <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5 w-14">
                        {formatEventTime(event)}
                      </span>
                      <span className="text-sm text-slate-200 font-medium">{event.title}</span>
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
