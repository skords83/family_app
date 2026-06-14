'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';

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
  'HU (08:00–09:50)',
  '3. (10:15–11:00)',
  '4. (11:05–11:50)',
  '5. (12:10–12:55)',
  '6. (13:00–13:45)',
  '7. (13:45–14:30)',
  '8. (14:30–15:15)',
  '9. (15:15–16:00)',
];
const SLOT_SHORT = ['HU', '3.', '4.', '5.', '6.', '7.', '8.', '9.'];

const COLORS = [
  { bg: '#fde8e3', fg: '#e85d3a', label: 'Rot'    },
  { bg: '#e3f0fd', fg: '#4a9eed', label: 'Blau'   },
  { bg: '#e8f5e9', fg: '#4caf7d', label: 'Grün'   },
  { bg: '#f3e8fd', fg: '#9b59b6', label: 'Lila'   },
  { bg: '#fef9e3', fg: '#e0a000', label: 'Gelb'   },
  { bg: '#e0f7fa', fg: '#00bcd4', label: 'Türkis' },
  { bg: '#f0ede8', fg: '#6b6760', label: 'Grau'   },
  { bg: '#fce4ec', fg: '#e91e8c', label: 'Pink'   },
  { bg: '#fff3e0', fg: '#e67e22', label: 'Orange' },
  { bg: '#e8eaf6', fg: '#5c6bc0', label: 'Indigo' },
];

// Collects all unique subject names across all timetables
function collectSubjects(timetables: AllTimetables): string[] {
  const names = new Set<string>();
  for (const tt of Object.values(timetables)) {
    for (const lesson of Object.values(tt)) {
      if (lesson.name) names.add(lesson.name);
    }
  }
  return Array.from(names).sort();
}

// Derives subject→color map from existing timetable data
function deriveSubjectColors(timetables: AllTimetables): Record<string, { bg: string; fg: string }> {
  const sc: Record<string, { bg: string; fg: string }> = {};
  for (const tt of Object.values(timetables)) {
    for (const lesson of Object.values(tt)) {
      if (lesson.name && !sc[lesson.name]) {
        sc[lesson.name] = { bg: lesson.bg, fg: lesson.fg };
      }
    }
  }
  return sc;
}

export default function TimetablePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timetables, setTimetables] = useState<AllTimetables>({});
  const [subjectColors, setSubjectColors] = useState<Record<string, { bg: string; fg: string }>>({});
  const [editing, setEditing] = useState<{ day: string; slot: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [showLegend, setShowLegend] = useState(false);
  const [legendEditSubject, setLegendEditSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load all users (children only) + all timetables from API
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, ttRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`),
        fetch(`${API_BASE}/api/timetable`),
      ]);
      const usersData: User[] = await usersRes.json();
      const ttData: AllTimetables = ttRes.ok ? await ttRes.json() : {};

      if (Array.isArray(usersData)) {
        const kids = usersData.filter(u => u.role === 'child');
        setUsers(kids);
        if (kids.length > 0) setActiveId(prev => prev ?? kids[0].id);
      }

      if (ttData && typeof ttData === 'object') {
        setTimetables(ttData);
        setSubjectColors(deriveSubjectColors(ttData));
      }
    } catch (err) {
      console.error('[timetable] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeUser = users.find(u => u.id === activeId);
  const tt: Timetable = (activeId && timetables[activeId]) ? timetables[activeId] : {};

  // Persist single user's timetable to API
  async function saveTimetableForUser(userId: string, data: Timetable) {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/timetable/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error('[timetable] save error:', err);
    } finally {
      setSaving(false);
    }
  }

  // When typing a known subject name, auto-apply its color
  function handleEditNameChange(val: string) {
    setEditName(val);
    const normalized = val.trim().toLowerCase();
    const match = Object.entries(subjectColors).find(([k]) => k.toLowerCase() === normalized);
    if (match) {
      const c = COLORS.find(x => x.fg === match[1].fg);
      if (c) setEditColor(c);
    }
  }

  function openEdit(day: string, slot: number) {
    const key = `${day}_${slot}`;
    const existing = tt[key];
    setEditName(existing?.name ?? '');
    setEditColor(existing ? (COLORS.find(c => c.fg === existing.fg) ?? COLORS[0]) : COLORS[0]);
    setEditing({ day, slot });
  }

  async function saveLesson() {
    if (!activeId || !editing) return;
    const key = `${editing.day}_${editing.slot}`;
    const updatedTt = { ...tt };
    const trimmed = editName.trim();

    if (trimmed) {
      updatedTt[key] = { name: trimmed, bg: editColor.bg, fg: editColor.fg };
      // Update subject color map
      const sc = { ...subjectColors, [trimmed]: { bg: editColor.bg, fg: editColor.fg } };
      setSubjectColors(sc);
    } else {
      delete updatedTt[key];
    }

    const updatedAll = { ...timetables, [activeId]: updatedTt };
    setTimetables(updatedAll);
    setEditing(null);
    await saveTimetableForUser(activeId, updatedTt);
  }

  // All known subjects across all kids' timetables
  const allSubjects = collectSubjects(timetables);

  async function updateLegendColor(subject: string, color: { bg: string; fg: string }) {
    // Update subjectColors
    const sc = { ...subjectColors, [subject]: color };
    setSubjectColors(sc);
    setLegendEditSubject(null);

    // Update all existing lessons with this name across all timetables
    const updated: AllTimetables = {};
    for (const [uid, tt2] of Object.entries(timetables)) {
      updated[uid] = {};
      for (const [k, lesson] of Object.entries(tt2)) {
        if (lesson.name === subject) {
          updated[uid][k] = { ...lesson, bg: color.bg, fg: color.fg };
        } else {
          updated[uid][k] = lesson;
        }
      }
    }
    setTimetables(updated);

    // Save updated timetables for all affected users
    await Promise.all(
      Object.entries(updated).map(([uid, data]) =>
        saveTimetableForUser(uid, data),
      ),
    );
  }

  return (
    <div>
      <PageHeader title="Stundenpläne" variant="page" />

      <div className="px-6 pb-6">
      {/* Fachfarben-Toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowLegend(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-sans transition-all"
          style={{
            background: showLegend ? '#1a1814' : '#fff',
            color: showLegend ? '#fff' : '#6b6760',
            border: '0.5px solid rgba(0,0,0,0.1)',
          }}
        >
          <i className="ti ti-palette" style={{ fontSize: 15 }} />
          Fachfarben
          {allSubjects.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: showLegend ? 'rgba(255,255,255,0.2)' : '#f0ede8', color: showLegend ? '#fff' : '#6b6760' }}>
              {allSubjects.length}
            </span>
          )}
        </button>
      </div>

      {/* Legend panel */}
      {showLegend && allSubjects.length > 0 && (
        <div className="mb-4 rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
          <p className="text-[11px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>Fachfarben</p>
          <div className="flex flex-wrap gap-2">
            {allSubjects.map(subject => {
              const sc = subjectColors[subject] ?? COLORS[0];
              const isEditing = legendEditSubject === subject;
              return (
                <div key={subject}>
                  {isEditing ? (
                    <div className="rounded-xl p-2 shadow-md" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', zIndex: 10, position: 'relative' }}>
                      <div className="text-xs font-sans font-medium mb-2" style={{ color: '#1a1814' }}>{subject}</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {COLORS.map(c => (
                          <button
                            key={c.fg}
                            onClick={() => updateLegendColor(subject, { bg: c.bg, fg: c.fg })}
                            className="w-6 h-6 rounded-full border-2 transition-all"
                            style={{ background: c.bg, borderColor: sc.fg === c.fg ? c.fg : 'transparent' }}
                            title={c.label}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setLegendEditSubject(null)}
                        className="mt-2 text-[10px] font-sans"
                        style={{ color: '#a09d99' }}
                      >
                        Schließen
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLegendEditSubject(subject)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-sans font-medium transition-all hover:opacity-80"
                      style={{ background: sc.bg, color: sc.fg }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.fg }} />
                      {subject}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Child tabs */}
      {users.length > 0 && (
        <div className="flex gap-2 mb-4">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => setActiveId(u.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-sans font-medium transition-all"
              style={{
                background: activeId === u.id ? u.color : '#fff',
                color: activeId === u.id ? '#fff' : '#6b6760',
                border: '0.5px solid rgba(0,0,0,0.1)',
              }}
            >
              <span style={{ fontSize: 16 }}>{u.photo ? undefined : u.avatar}</span>
              {u.photo && (
                <img src={u.photo} alt={u.name}
                  className="w-5 h-5 rounded-full object-cover" />
              )}
              {u.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <span className="text-sm font-sans" style={{ color: '#a09d99' }}>Lade Stundenpläne…</span>
        </div>
      ) : users.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <span className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Kinder angelegt.</span>
        </div>
      ) : (
        /* Grid */
        <div className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.07)', background: '#fff' }}>
          {/* Header row */}
          <div className="grid" style={{ gridTemplateColumns: '80px repeat(5, 1fr)', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
            <div style={{ borderRight: '0.5px solid rgba(0,0,0,0.07)', background: '#fafaf9' }} />
            {DAYS.map((day, di) => (
              <div
                key={day}
                className="py-3 flex items-center justify-center"
                style={{ borderRight: di < 4 ? '0.5px solid rgba(0,0,0,0.07)' : 'none', background: '#fafaf9' }}
              >
                <span className="text-[11px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
                  {day}
                </span>
              </div>
            ))}
          </div>

          {/* Slot rows */}
          {SLOTS.map((slotLabel, si) => (
            <div
              key={si}
              className="grid"
              style={{ gridTemplateColumns: '80px repeat(5, 1fr)', borderBottom: si < SLOTS.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
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
      </div>

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
              onChange={e => handleEditNameChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveLesson()}
              placeholder="z.B. Mathematik"
              className="w-full rounded-xl px-3 py-2.5 text-sm font-sans outline-none mb-4"
              style={{ background: '#f5f3f0', color: '#1a1814', border: '0.5px solid rgba(0,0,0,0.1)' }}
            />

            <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-2" style={{ color: '#a09d99' }}>Farbe</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {COLORS.map(c => (
                <button
                  key={c.fg}
                  onClick={() => setEditColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ background: c.bg, borderColor: editColor.fg === c.fg ? c.fg : 'transparent' }}
                  title={c.label}
                />
              ))}
            </div>

            {/* Preview */}
            {editName.trim() && (
              <div className="rounded-lg px-3 py-2 mb-4 flex items-center" style={{ background: editColor.bg }}>
                <span className="text-sm font-sans font-medium" style={{ color: editColor.fg }}>
                  {editName.trim()}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setEditName(''); saveLesson(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-sans transition-all"
                style={{ background: '#f5f3f0', color: '#6b6760' }}
              >
                Löschen
              </button>
              <button
                onClick={saveLesson}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-sans font-medium transition-all"
                style={{ background: saving ? '#ccc' : '#1a1814', color: '#fff' }}
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}