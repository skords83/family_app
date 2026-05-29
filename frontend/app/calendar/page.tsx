'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}

const DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const SLOT_H = 52;
const START_H = 7;
const HOURS = 15;

function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/widgets/calendar`)
      .then(r => r.json())
      .then(data => { if (data.events) setEvents(data.events); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Scroll to 8:00 on mount
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = (8 - START_H) * SLOT_H;
    }
  }, [loading]);

  const weekStart = getWeekStart(weekOffset);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(days[6]); weekEnd.setHours(23, 59, 59);

  const fmt = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const weekLabel = `${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}`;

  function eventsForDay(day: Date, allDay: boolean): CalendarEvent[] {
    const dayStr = day.toISOString().split('T')[0];
    return events.filter(e => {
      const eDay = e.start.split('T')[0];
      return eDay === dayStr && e.allDay === allDay;
    });
  }

  function eventStyle(ev: CalendarEvent): React.CSSProperties {
    const startMin = toMinutes(ev.start);
    const endMin = toMinutes(ev.end);
    const top = ((startMin / 60) - START_H) * SLOT_H;
    const height = Math.max(SLOT_H * 0.5, ((endMin - startMin) / 60) * SLOT_H);
    return {
      position: 'absolute',
      top: Math.max(0, top),
      height,
      left: 3,
      right: 3,
      background: `${ev.color ?? '#6366f1'}20`,
      borderLeft: `3px solid ${ev.color ?? '#6366f1'}`,
      borderRadius: 6,
      padding: '3px 6px',
      overflow: 'hidden',
      zIndex: 2,
      cursor: 'default',
    };
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-black/5"
          style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}
        >‹</button>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-black/5"
          style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}
        >›</button>
        <span className="text-sm font-medium font-sans" style={{ color: '#1a1814', minWidth: 200 }}>
          {weekLabel}
        </span>
        <button
          onClick={() => setWeekOffset(0)}
          className="px-3 py-1 rounded-lg text-xs font-sans transition-all hover:bg-black/5"
          style={{ border: '0.5px solid rgba(0,0,0,0.12)', color: '#6b6760' }}
        >
          Heute
        </button>
      </div>

      {/* Calendar grid */}
      <div
        className="flex-1 overflow-hidden rounded-2xl flex flex-col"
        style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
      >
        {/* Day headers */}
        <div className="grid flex-shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
          <div />
          {days.map(d => {
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={d.toISOString()} className="py-2 text-center" style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)' }}>
                <div className="text-[10px] font-sans font-semibold uppercase tracking-wide" style={{ color: isToday ? '#e85d3a' : '#a09d99' }}>
                  {DAYS_SHORT[d.getDay()]}
                </div>
                <div className={`text-lg font-[Georgia] mt-0.5 mx-auto leading-tight ${isToday ? 'w-8 h-8 rounded-full flex items-center justify-center text-white' : ''}`}
                  style={isToday ? { background: '#e85d3a' } : { color: '#1a1814' }}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        <div className="grid flex-shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '0.5px solid rgba(0,0,0,0.07)', minHeight: 28 }}>
          <div className="flex items-center justify-end pr-2">
            <span className="text-[9px] font-sans" style={{ color: '#a09d99' }}>ganztags</span>
          </div>
          {days.map(d => (
            <div key={d.toISOString()} className="p-0.5" style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)' }}>
              {eventsForDay(d, true).map(ev => (
                <div key={ev.id} className="text-[10px] font-sans font-medium rounded px-1.5 py-0.5 mb-0.5 truncate"
                  style={{ background: `${ev.color ?? '#6366f1'}22`, color: ev.color ?? '#6366f1' }}>
                  {ev.title}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Scrollable time body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* Time labels */}
          <div className="flex flex-col">
            {Array.from({ length: HOURS }, (_, i) => (
              <div key={i} className="flex-shrink-0 flex items-start justify-end pr-2 pt-0.5" style={{ height: SLOT_H, borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
                <span className="text-[10px] font-sans" style={{ color: '#a09d99' }}>{START_H + i}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(d => (
            <div key={d.toISOString()} className="relative" style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)' }}>
              {/* Hour slots */}
              {Array.from({ length: HOURS }, (_, i) => (
                <div key={i} style={{ height: SLOT_H, borderBottom: '0.5px solid rgba(0,0,0,0.07)' }} />
              ))}
              {/* Events */}
              {eventsForDay(d, false).map(ev => (
                <div key={ev.id} style={eventStyle(ev)}>
                  <div className="text-[10px] font-semibold font-sans truncate" style={{ color: ev.color ?? '#6366f1' }}>{ev.title}</div>
                  {ev.calendarName && (
                    <div className="text-[9px] font-sans truncate mt-0.5" style={{ color: ev.color ?? '#6366f1', opacity: 0.7 }}>{ev.calendarName}</div>
                  )}
                  <div className="text-[9px] font-sans mt-0.5" style={{ color: ev.color ?? '#6366f1', opacity: 0.7 }}>
                    {new Date(ev.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(ev.end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}