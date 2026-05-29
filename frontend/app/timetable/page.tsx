'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string; name: string; avatar: string; photo?: string; color: string; role: string;
}

interface Lesson {
  name: string; bg: string; fg: string;
}

type Timetable = Record<string, Lesson>; // key: "Mo_0"
type AllTimetables = Record<string, Timetable>; // key: userId

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const SLOTS = [
  '1. (07:45–08:30)',
  '2. (08:30–09:15)',
  '3. (09:30–10:15)',
  '4. (10:15–11:00)',
  '5. (11:15–12:00)',
  '6. (12:00–12:45)',
];
const SLOT_SHORT = ['1.', '2.', '3.', '4.', '5.', '6.'];

const COLORS = [
  { bg: '#fde8e3', fg: '#e85d3a', label: 'Rot'    },
  { bg: '#e3f0fd', fg: '#4a9eed', label: 'Blau'   },
  { bg: '#e8f5e9', fg: '#5cb85c', label: 'Grün'   },
  { bg: '#f3e8fd', fg: '#9b59b6', label: 'Lila'   },
  { bg: '#fef9e3', fg: '#f0a500', label: 'Gelb'   },
  { bg: '#e0f7fa', fg: '#00bcd4', label: 'Türkis' },
  { bg: '#f0ede8', fg: '#6b6760', label: 'Grau'   },
];

const STORAGE_KEY = 'family_timetables';

function loadTimetables(): AllTimetables {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function saveTimetables(data: AllTimetables) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export default function TimetablePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timetables, setTimetables] = useState<AllTimetables>({});
  const [editing, setEditing] = useState<{ day: string; slot: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);

  useEffect(() => {
    fetch(`${API_BASE}/api/users`)
      .then(r => r.json())
      .then((data: User[]) => {
        if (Array.isArray(data)) {
          const kids = data.filter(u => u.role === 'child');
          setUsers(kids);
          if (kids.length > 0) setActiveId(kids[0].id);
        }
      })
      .catch(console.error);
    setTimetables(loadTimetables());
  }, []);

  const activeUser = users.find(u => u.id === activeId);
  const tt: Timetable = (activeId && timetables[activeId]) ? timetables[activeId] : {};

  function openEdit(day: string, slot: number) {
    const key = `${day}_${slot}`;
    const existing = tt[key];
    setEditName(existing?.name ?? '');
    setEditColor(existing ? (COLORS.find(c => c.fg === existing.fg) ?? COLORS[0]) : COLORS[0]);
    setEditing({ day, slot });
  }

  function saveLesson() {
    if (!activeId || !editing) return;
    const key = `${editing.day}_${editing.slot}`;
    const updated = { ...timetables };
    if (!updated[activeId]) updated[activeId] = {};
    if (editName.trim()) {
      updated[activeId][key] = { name: editName.trim(), bg: editColor.bg, fg: editColor.fg };
    } else {
      delete updated[activeId][key];
    }
    setTimetables(updated);
    saveTimetables(updated);
    setEditing(null);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>Stundenpläne</h1>
        <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>Mo – Fr</p>
      </div>

      {/* Child tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => setActiveId(u.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-sans font-medium transition-all"
            style={{
              background: activeId === u.id ? u.color : '#fff',
              color: activeId === u.id ? '#fff' : '#6b6760',
              border: `0.5px solid ${activeId === u.id ? u.color : 'rgba(0,0,0,0.1)'}`,
            }}
          >
            {u.photo ? (
              <img src={u.photo} alt={u.name} className="w-6 h-6 rounded-full object-cover" style={{ border: `2px solid ${u.color}` }} />
            ) : (
              <span>{u.avatar}</span>
            )}
            {u.name}
          </button>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-16" style={{ color: '#a09d99' }}>
          <p className="font-sans text-sm">Keine Kinder angelegt</p>
        </div>
      )}

      {activeUser && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
          {/* Header row */}
          <div className="grid" style={{ gridTemplateColumns: '90px repeat(5, 1fr)' }}>
            <div className="px-3 py-3" style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)', background: '#fafaf9' }} />
            {DAYS.map(d => (
              <div
                key={d}
                className="px-3 py-3 text-center text-xs font-sans font-semibold uppercase tracking-wider"
                style={{ color: '#a09d99', borderRight: '0.5px solid rgba(0,0,0,0.07)', background: '#fafaf9', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Slot rows */}
          {SLOTS.map((slotLabel, si) => (
            <div key={si} className="grid" style={{ gridTemplateColumns: '90px repeat(5, 1fr)', borderBottom: si < SLOTS.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
              {/* Time */}
              <div
                className="px-3 py-3 flex items-center justify-end"
                style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)', background: '#fafaf9' }}
              >
                <span className="text-[11px] font-sans text-right leading-tight" style={{ color: '#a09d99' }}>
                  {slotLabel}
                </span>
              </div>

              {/* Day cells */}
              {DAYS.map((day, di) => {
                const key = `${day}_${si}`;
                const lesson = tt[key];
                return (
                  <button
                    key={day}
                    onClick={() => openEdit(day, si)}
                    className="relative p-1.5 min-h-[56px] text-left transition-all group"
                    style={{ borderRight: di < 4 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}
                  >
                    {lesson ? (
                      <div className="w-full h-full rounded-lg px-2 py-1.5 flex items-center" style={{ background: lesson.bg }}>
                        <span className="text-xs font-sans font-medium truncate" style={{ color: lesson.fg }}>
                          {lesson.name}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#f0ede8' }}>
                        <i className="ti ti-plus" style={{ fontSize: 14, color: '#a09d99' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="rounded-2xl p-6 w-80 shadow-xl" style={{ background: '#fff' }}>
            <div className="text-base font-sans font-medium mb-4" style={{ color: '#1a1814' }}>
              {editing.day} · {SLOT_SHORT[editing.slot]} Stunde
            </div>

            <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#a09d99' }}>Fach</label>
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveLesson()}
              placeholder="z.B. Mathe"
              className="w-full px-3 py-2 rounded-xl text-sm font-sans outline-none mb-4"
              style={{ background: '#f0ede8', color: '#1a1814', border: '0.5px solid rgba(0,0,0,0.1)' }}
            />

            <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-2" style={{ color: '#a09d99' }}>Farbe</label>
            <div className="flex gap-2 mb-5">
              {COLORS.map(c => (
                <button
                  key={c.fg}
                  onClick={() => setEditColor(c)}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c.bg,
                    border: editColor.fg === c.fg ? `2.5px solid ${c.fg}` : '2px solid transparent',
                    transform: editColor.fg === c.fg ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={c.label}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-sans transition-all hover:bg-black/5"
                style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760' }}
              >
                Abbrechen
              </button>
              {tt[`${editing.day}_${editing.slot}`] && (
                <button
                  onClick={() => { setEditName(''); saveLesson(); }}
                  className="py-2.5 px-3 rounded-xl text-sm font-sans transition-all"
                  style={{ background: '#fff0ee', color: '#e85d3a' }}
                >
                  Löschen
                </button>
              )}
              <button
                onClick={saveLesson}
                className="flex-1 py-2.5 rounded-xl text-sm font-sans font-medium text-white transition-all"
                style={{ background: activeUser?.color ?? '#e85d3a' }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
