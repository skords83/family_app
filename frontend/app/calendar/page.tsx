'use client';

import { useState, useEffect, useRef } from 'react';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}

interface CalendarOption {
  url: string;
  name: string;
  color: string;
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

// Lokales Datum als YYYY-MM-DD (nicht UTC) — verhindert den +1-Tag-Bug bei UTC-Offset
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Lokale Zeit als HH:MM für input[type=time]
function toLocalTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Kombiniert Datum-String + Zeit-String zu lokalem ISO — kein UTC-Versatz
function toLocalISO(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateStr}T${pad(h)}:${pad(m)}:00`;
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
      const end   = allDay ? `${date}T00:00:00.000Z` : toLocalISO(date, endTime);
      const res = await fetch(`${API_BASE}/api/widgets/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), start, end, allDay, calendarUrl }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Fehler beim Speichern');
      }
      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'Unbekannter Fehler');
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '0.5px solid rgba(0,0,0,0.15)',
    background: '#f7f4f0',
    fontSize: 14,
    color: '#1a1814',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
        style={{ background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold font-sans" style={{ color: '#1a1814' }}>
            Neuer Termin
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-black/5" style={{ color: '#a09d99' }} aria-label="Schließen">
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Titel */}
        <input
          type="text"
          placeholder="Titel"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={inputStyle}
          autoFocus
        />

        {/* Datum */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />

        {/* Ganztags-Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setAllDay(v => !v)}
            className="w-9 h-5 rounded-full transition-colors flex-shrink-0"
            style={{ background: allDay ? '#e85d3a' : '#d1cdc8', position: 'relative', cursor: 'pointer' }}
          >
            <div style={{
              position: 'absolute', top: 2, left: allDay ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.15s',
            }} />
          </div>
          <span className="text-sm font-sans" style={{ color: '#6b6760' }}>Ganztags</span>
        </label>

        {/* Zeiten */}
        {!allDay && (
          <div className="flex gap-2 items-center">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
            <span style={{ color: '#a09d99', fontSize: 12 }}>–</span>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
          </div>
        )}

        {/* Kalender-Auswahl */}
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

        {/* Fehler */}
        {error && <p className="text-xs font-sans" style={{ color: '#e85d3a' }}>{error}</p>}

        {/* Buttons */}
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

  // Assign each event to the first column where the previous event has ended,
  // then compute cols = max simultaneous column index + 1 per event.
  function layoutEvents(evs: CalendarEvent[]): Array<CalendarEvent & { col: number; cols: number }> {
    if (evs.length === 0) return [];
    const sorted = [...evs].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    // Pass 1: greedy column assignment
    const colEndTimes: number[] = [];
    const colAssignments: number[] = [];
    for (const ev of sorted) {
      const startMin = toMinutes(ev.start);
      const endMin   = toMinutes(ev.end);
      let col = colEndTimes.findIndex(t => t <= startMin);
      if (col === -1) col = colEndTimes.length;
      colEndTimes[col] = endMin;
      colAssignments.push(col);
    }

    // Pass 2: for each event, cols = highest column index among all events
    //         that truly overlap with it, + 1
    return sorted.map((ev, idx) => {
      const startMin = toMinutes(ev.start);
      const endMin   = toMinutes(ev.end);
      let maxCol = colAssignments[idx];
      sorted.forEach((other, j) => {
        if (toMinutes(other.start) < endMin && toMinutes(other.end) > startMin) {
          maxCol = Math.max(maxCol, colAssignments[j]);
        }
      });
      return { ...ev, col: colAssignments[idx], cols: maxCol + 1 };
    });
  }

  function eventStyle(ev: CalendarEvent, col: number, cols: number): React.CSSProperties {
    const startMin = toMinutes(ev.start);
    const endMin = toMinutes(ev.end);
    const top = ((startMin / 60) - START_H) * SLOT_H;
    const height = Math.max(SLOT_H * 0.5, ((endMin - startMin) / 60) * SLOT_H);
    const width = cols > 1 ? `calc(${100 / cols}% - 4px)` : undefined;
    const left = cols > 1 ? `calc(${(col / cols) * 100}% + 2px)` : 3;
    const right = cols > 1 ? undefined : 3;
    return {
      position: 'absolute',
      top: Math.max(0, top),
      height,
      left,
      right,
      width,
      background: `${ev.color ?? '#6366f1'}28`,
      borderLeft: `3px solid ${ev.color ?? '#6366f1'}`,
      borderRadius: 6,
      padding: '3px 6px',
      overflow: 'hidden',
      zIndex: 2,
      cursor: 'default',
    };
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Kalender" variant="page" />

      {showModal && (
        <NewEventModal
          initialDate={modalDate}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadEvents(); }}
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden px-6 pb-6 gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-black/5"
          style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}
          aria-label="Vorherige Woche"
        ><i className="ti ti-chevron-left" style={{ fontSize: 16, color: '#6b6760' }} /></button>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-black/5"
          style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}
          aria-label="Nächste Woche"
        ><i className="ti ti-chevron-right" style={{ fontSize: 16, color: '#6b6760' }} /></button>
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
        {/* Neuer Termin Button */}
        <button
          onClick={() => openModal()}
          className="ml-auto px-4 py-1.5 rounded-lg text-xs font-sans font-medium transition-all hover:opacity-90 flex items-center gap-1.5"
          style={{ background: '#e85d3a', color: '#fff', border: 'none' }}
        >
          <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Termin
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
              <div
                key={d.toISOString()}
                className="py-2 text-center cursor-pointer hover:bg-black/[0.02] transition-colors"
                style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)' }}
                onClick={() => openModal(d)}
              >
                <div className="text-[10px] font-sans font-semibold uppercase tracking-wide" style={{ color: isToday ? '#e85d3a' : '#7a7874' }}>
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
            <span className="text-[9px] font-sans" style={{ color: '#7a7874' }}>ganztags</span>
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
              {/* Events with collision layout */}
              {layoutEvents(eventsForDay(d, false)).map(ev => (
                <div key={ev.id} style={eventStyle(ev, ev.col, ev.cols)}>
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
    </div>
  );
}