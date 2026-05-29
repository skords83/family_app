'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sunday -> adjust to Monday-first
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  const start = new Date(event.start);
  return start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetched_at, setFetchedAt] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    fetch(`${API_BASE}/api/widgets/calendar`)
      .then((r) => r.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
        if (data.fetched_at) setFetchedAt(data.fetched_at);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = today.toISOString().split('T')[0];

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });

  const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function getEventsForDay(day: number): CalendarEvent[] {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.start.startsWith(dateStr));
  }

  function getDateStr(day: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedEvents = selectedDate
    ? events.filter((e) => e.start.startsWith(selectedDate))
    : [];

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all active:scale-95"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white flex-1">Kalender</h1>
        {fetched_at && (
          <span className="text-xs text-slate-500">
            Aktualisiert: {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              if (viewMonth === 0) {
                setViewMonth(11);
                setViewYear((y) => y - 1);
              } else {
                setViewMonth((m) => m - 1);
              }
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            ←
          </button>
          <h2 className="text-lg font-bold text-white capitalize">{monthName}</h2>
          <button
            onClick={() => {
              if (viewMonth === 11) {
                setViewMonth(0);
                setViewYear((y) => y + 1);
              } else {
                setViewMonth((m) => m + 1);
              }
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            →
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayLabels.map((d) => (
            <div key={d} className="text-center text-xs text-slate-500 font-semibold py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="aspect-square bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for first day offset */}
            {[...Array(firstDay)].map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dateStr = getDateStr(day);
              const dayEvents = getEventsForDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`
                    aspect-square rounded-lg flex flex-col items-center justify-start p-1
                    transition-all duration-150 active:scale-95 relative
                    ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}
                    ${isSelected && !isToday ? 'ring-2 ring-indigo-400' : ''}
                  `}
                >
                  <span className={`text-xs font-semibold ${isToday ? 'text-white' : ''}`}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: e.color ?? '#6366f1' }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected day events */}
        {selectedDate && (
          <div className="mt-4 bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-3">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-slate-500 text-sm">Keine Termine</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 bg-slate-700/50 rounded-xl px-3 py-2.5"
                    style={{ borderLeft: `3px solid ${event.color ?? '#6366f1'}` }}
                  >
                    <span className="text-xs text-slate-400 flex-shrink-0 w-14 mt-0.5">
                      {formatEventTime(event)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-slate-200 font-medium">{event.title}</p>
                      {!event.allDay && event.end !== event.start && (
                        <p className="text-xs text-slate-500">
                          bis {new Date(event.end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
