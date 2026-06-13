'use client';

import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
  calendarName?: string;
  recurring?: boolean;
}

interface LayoutEvent extends CalendarEvent {
  col: number;
  cols: number;
}

interface CalendarOption {
  url: string;
  name: string;
  color: string;
}

const DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
// 36 px/h: 8–22 Uhr = 504 px — kein Scrollen auf 1080p bei 150% Zoom
const SLOT_H = 32;
const START_H = 8;
// 14 h: 8:00–22:00 — 32px×14 = 448px body, passt in 720px effektiv ohne Scroll
const HOURS = 14;
// Mindesthöhe: immer zwei Zeilen (Titel + Zeit) lesbar, auch bei 15/30-min-Terminen
const MIN_EVENT_H = 44;

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

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toLocalTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toLocalISO(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateStr}T${pad(h)}:${pad(m)}:00`;
}

function layoutEvents(events: CalendarEvent[]): LayoutEvent[] {
  const sorted = [...events].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  const columns: string[][] = [];
  const result: LayoutEvent[] = sorted.map(ev => {
    const startMin = toMinutes(ev.start);
    const endMin   = toMinutes(ev.end);
    let col = columns.findIndex(c => {
      const lastId = c[c.length - 1];
      const last = sorted.find(e => e.id === lastId)!;
      return toMinutes(last.end) <= startMin;
    });
    if (col === -1) { col = columns.length; columns.push([]); }
    columns[col].push(ev.id);
    return { ...ev, col, cols: 0 };
  });
  result.forEach(ev => {
    const startMin = toMinutes(ev.start);
    const endMin   = toMinutes(ev.end);
    let maxCol = ev.col;
    result.forEach(other => {
      if (other.id === ev.id) return;
      const oStart = toMinutes(other.start);
      const oEnd   = toMinutes(other.end);
      if (oStart < endMin && oEnd > startMin) maxCol = Math.max(maxCol, other.col);
    });
    ev.cols = maxCol + 1;
  });
  return result;
}

function eventStyle(ev: LayoutEvent, col: number, cols: number): React.CSSProperties {
  const startMin = toMinutes(ev.start) - START_H * 60;
  const endMin   = toMinutes(ev.end)   - START_H * 60;
  const top            = (startMin / 60) * SLOT_H;
  const naturalHeight  = ((endMin - startMin) / 60) * SLOT_H - 2;
  const height         = Math.max(naturalHeight, MIN_EVENT_H);
  const width  = `calc(${100 / cols}% - 3px)`;
  const left   = `calc(${(col / cols) * 100}% + 2px)`;
  const color  = ev.color ?? '#6366f1';
  return {
    position: 'absolute',
    top,
    height,
    left,
    width,
    background: `${color}18`,
    borderLeft: `2.5px solid ${color}`,
    borderRadius: 6,
    padding: '3px 5px',
    overflow: 'hidden',
    cursor: 'default',
    boxSizing: 'border-box',
  };
}

// ---- Neuer-Termin-Modal ----
function NewEventModal({
  initialDate,
  onClose,
  onCreated,
}: {
  initialDate: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/widgets/calendar/calendars`)
      .then(r => r.json())
      .then(data => {
        if (data.calendars?.length) {
          setCalendars(data.calendars);
          setCalendarUrl(data.calendars[0].url);
        }
      })
      .catch(() => setError('Kalender konnten nicht geladen werden'));
  }, []);

  async function handleSave() {
    if (!title.trim()) { setError('Bitte einen Titel eingeben'); return; }
    if (!calendarUrl) { setError('Bitte einen Kalender wählen'); return; }
    setSaving(true);
    setError('');
    try {
      const start = allDay ? `${date}T00:00:00.000Z` : toLocalISO(date, startTime);
      const end   = allDay ? `${date}T23:59:59.000Z` : toLocalISO(date, endTime);
      const res = await fetch(`${API_BASE}/api/widgets/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start, end, allDay, calendarUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#f5f3f0',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'sans-serif',
    color: '#1a1814',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: '#faf8f5', width: 380, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-[Georgia]" style={{ color: '#1a1814' }}>Neuer Termin</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09d99', fontSize: 18 }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <input
          placeholder="Titel"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={inputStyle}
        />

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setAllDay(!allDay)}
            style={{ width: 36, height: 20, borderRadius: 10, background: allDay ? '#e85d3a' : '#d1cdc8', position: 'relative', cursor: 'pointer' }}
          >
            <div style={{
              position: 'absolute', top: 2, left: allDay ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.15s',
            }} />
          </div>
          <span className="text-sm font-sans" style={{ color: '#6b6760' }}>Ganztags</span>
        </label>

        {!allDay && (
          <div className="flex gap-2 items-center">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
            <span style={{ color: '#a09d99', fontSize: 12 }}>–</span>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider font-sans" style={{ color: '#a09d99' }}>Kalender</span>
          <div className="flex flex-col gap-1">
            {calendars.map(cal => (
              <button
                key={cal.url}
                onClick={() => setCalendarUrl(cal.url)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                style={{
                  background: calendarUrl === cal.url ? `${cal.color}18` : 'transparent',
                  border: calendarUrl === cal.url ? `1px solid ${cal.color}40` : '1px solid transparent',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cal.color, flexShrink: 0, display: 'inline-block' }} />
                <span className="text-sm font-sans" style={{ color: '#1a1814' }}>{cal.name}</span>
                {calendarUrl === cal.url && (
                  <i className="ti ti-check ml-auto" style={{ fontSize: 14, color: cal.color }} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs font-sans" style={{ color: '#e85d3a' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-sans transition-all hover:bg-black/5"
            style={{ border: '0.5px solid rgba(0,0,0,0.12)', color: '#6b6760' }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-sans font-medium transition-all"
            style={{ background: saving ? '#ccc' : '#e85d3a', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Findet die ID des nächsten anstehenden Termins (nicht ganztags, in der Zukunft)
function findNextEventId(events: CalendarEvent[]): string | null {
  const now = new Date();
  const upcoming = events
    .filter(e => !e.allDay && new Date(e.start) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return upcoming[0]?.id ?? null;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  function loadEvents() {
    setLoading(true);
    fetch(`${API_BASE}/api/widgets/calendar`)
      .then(r => r.json())
      .then(data => { if (data.events) setEvents(data.events); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEvents(); }, []);

  // START_H = 8 → scrollTop = 0
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [loading]);

  const weekStart = getWeekStart(weekOffset);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const fmt = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const weekLabel = `${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}`;

  const nextEventId = findNextEventId(events);

  function openModal(date?: Date) {
    setModalDate(toLocalDateStr(date ?? today));
    setShowModal(true);
  }

  function eventsForDay(day: Date, allDay: boolean): CalendarEvent[] {
    const dayStr = toLocalDateStr(day);
    return events.filter(e => {
      const eDay = toLocalDateStr(new Date(e.start));
      return eDay === dayStr && e.allDay === allDay;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Puls-Animation CSS */}
      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0px rgba(232,93,58,0.35); }
          60%  { box-shadow: 0 0 0 5px rgba(232,93,58,0.0); }
          100% { box-shadow: 0 0 0 0px rgba(232,93,58,0.0); }
        }
        .next-event-pulse {
          animation: pulse-ring 2.2s ease-out infinite;
        }
      `}</style>

      <PageHeader title="Kalender" variant="page" />

      <div className="flex flex-col flex-1 overflow-hidden px-6 pb-6 gap-3">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="flex items-center justify-center rounded-lg transition-all hover:bg-black/[0.05]"
              style={{ width: 32, height: 32, border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff' }}
            >
              <i className="ti ti-chevron-left" style={{ fontSize: 14, color: '#6b6760' }} aria-hidden="true" />
            </button>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="flex items-center justify-center rounded-lg transition-all hover:bg-black/[0.05]"
              style={{ width: 32, height: 32, border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff' }}
            >
              <i className="ti ti-chevron-right" style={{ fontSize: 14, color: '#6b6760' }} aria-hidden="true" />
            </button>
          </div>

          <span className="text-sm font-[Georgia]" style={{ color: '#1a1814' }}>{weekLabel}</span>

          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1 rounded-lg text-xs font-sans transition-all hover:bg-black/[0.05]"
              style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760', background: '#fff' }}
            >
              Heute
            </button>
          )}

          <button
            onClick={() => openModal()}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all"
            style={{ background: '#e85d3a', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Termin
          </button>
        </div>

        {/* Calendar grid */}
        <div
          className="flex-1 overflow-hidden rounded-2xl flex flex-col"
          style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
        >
          {/* Day headers — Wochentag + Datum nebeneinander in einer Zeile */}
          <div className="grid flex-shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
            <div />
            {days.map(d => {
              const isToday = d.getTime() === today.getTime();
              return (
                <div
                  key={d.toISOString()}
                  className="flex items-center justify-center gap-1.5 py-2 cursor-pointer hover:bg-black/[0.02] transition-colors"
                  style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)' }}
                  onClick={() => openModal(d)}
                >
                  <span
                    className="text-[10px] font-sans font-semibold uppercase tracking-wide"
                    style={{ color: isToday ? '#e85d3a' : '#7a7874' }}
                  >
                    {DAYS_SHORT[d.getDay()]}
                  </span>
                  <span
                    className="text-sm font-[Georgia] tabular-nums flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: isToday ? '#e85d3a' : 'transparent',
                      color: isToday ? '#fff' : '#1a1814',
                    }}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All-day row */}
          <div className="grid flex-shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '0.5px solid rgba(0,0,0,0.07)', minHeight: 28 }}>
            <div className="flex items-center justify-end pr-2">
              <span className="text-[9px] font-sans" style={{ color: '#7a7874' }}>ganztags</span>
            </div>
            {days.map(d => (
              <div key={d.toISOString()} className="p-0.5" style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)' }}>
                {eventsForDay(d, true).map(ev => (
                  <div
                    key={ev.id}
                    className="text-[10px] font-sans font-medium rounded px-1.5 py-0.5 mb-0.5 truncate"
                    style={{ background: `${ev.color ?? '#6366f1'}22`, color: ev.color ?? '#6366f1' }}
                  >
                    {ev.recurring && (
                      <i className="ti ti-repeat" style={{ fontSize: 9, marginRight: 3, opacity: 0.7 }} aria-hidden="true" />
                    )}
                    {ev.title}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Scrollable time body */}
          <div
            ref={bodyRef}
            className="flex-1 overflow-y-auto grid"
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
          >
            {/* Time labels */}
            <div className="flex flex-col">
              {Array.from({ length: HOURS }, (_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 flex items-start justify-end pr-2 pt-0.5"
                  style={{ height: SLOT_H, borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}
                >
                  <span className="text-[10px] font-sans" style={{ color: '#7a7874' }}>{START_H + i}:00</span>
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
                {layoutEvents(eventsForDay(d, false)).map(ev => {
                  const isNext = ev.id === nextEventId;
                  const color = ev.color ?? '#6366f1';
                  return (
                    <div
                      key={ev.id}
                      className={isNext ? 'next-event-pulse' : ''}
                      style={{
                        ...eventStyle(ev, ev.col, ev.cols),
                        borderLeft: isNext ? `3px solid ${color}` : `2.5px solid ${color}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                        <div
                          className="font-semibold font-sans leading-tight"
                          style={{
                            fontSize: 11,
                            color,
                            flex: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {ev.title}
                        </div>
                        {ev.recurring && (
                          <i
                            className="ti ti-repeat"
                            aria-label="Wiederkehrender Termin"
                            style={{ fontSize: 9, color, opacity: 0.6, flexShrink: 0, marginTop: 1 }}
                          />
                        )}
                      </div>
                      <div
                        className="font-sans mt-0.5"
                        style={{ fontSize: 9, color, opacity: 0.65, whiteSpace: 'nowrap' }}
                      >
                        {new Date(ev.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(ev.end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <NewEventModal
          initialDate={modalDate}
          onClose={() => setShowModal(false)}
          onCreated={loadEvents}
        />
      )}
    </div>
  );
}