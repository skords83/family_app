'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface User {
  id: string;
  name: string;
  avatar: string;
  photo?: string;
  color: string;
  role: string;
}

interface Lesson {
  name: string;
  bg: string;
  fg: string;
}

type Timetable = Record<string, Lesson>; // key: "Mo_0" … "Mo_8"
type AllTimetables = Record<string, Timetable>; // key: userId
type SubjectColorMap = Record<string, { bg: string; fg: string }>;

/* ------------------------------------------------------------------ */
/*  Slots – 9 Einzelstunden (1.–9.)                                   */
/*  Slots 0+1 (1.+2. Stunde) = Hauptunterricht-Paar,                  */
/*  visuell verschmolzen wenn gleiches Fach.                           */
/* ------------------------------------------------------------------ */

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const;

const SLOTS = [
  '1. (08:00–08:50)',
  '2. (08:50–09:40)',
  '3. (10:15–11:00)',
  '4. (11:05–11:50)',
  '5. (12:10–12:55)',
  '6. (13:00–13:45)',
  '7. (13:45–14:30)',
  '8. (14:30–15:15)',
  '9. (15:15–16:00)',
] as const;

const SLOT_LABELS = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.'] as const;

/* ------------------------------------------------------------------ */
/*  24 Farben — gut unterscheidbar auf dem Kiosk-Display               */
/* ------------------------------------------------------------------ */

interface ColorOption {
  bg: string;
  fg: string;
  label: string;
}

const COLORS: ColorOption[] = [
  { bg: '#fde8e3', fg: '#d4432f', label: 'Rot' },
  { bg: '#e3f0fd', fg: '#2b7cd4', label: 'Blau' },
  { bg: '#e4f3e6', fg: '#2d8a3e', label: 'Grün' },
  { bg: '#f0e4fd', fg: '#8b3fc4', label: 'Lila' },
  { bg: '#fef5d4', fg: '#b88600', label: 'Gelb' },
  { bg: '#d9f4f8', fg: '#0091a1', label: 'Türkis' },
  { bg: '#eeecea', fg: '#6b6760', label: 'Grau' },
  { bg: '#fce0ee', fg: '#c91a72', label: 'Pink' },
  { bg: '#fde8d4', fg: '#c66318', label: 'Orange' },
  { bg: '#e2e4f6', fg: '#4650a8', label: 'Indigo' },
  { bg: '#e9e0d6', fg: '#7a5a3a', label: 'Braun' },
  { bg: '#d6f0ee', fg: '#0e7367', label: 'Petrol' },
  { bg: '#fbe0d8', fg: '#c03a14', label: 'Terrakotta' },
  { bg: '#e8f4d8', fg: '#5a8c22', label: 'Limette' },
  { bg: '#e0d6f0', fg: '#5a2d8c', label: 'Violett' },
  { bg: '#d4ecfd', fg: '#1a6eb5', label: 'Himmelblau' },
  { bg: '#fdf0d4', fg: '#a87010', label: 'Bernstein' },
  { bg: '#f4d8e8', fg: '#9c1a5e', label: 'Magenta' },
  { bg: '#d8ede0', fg: '#1a6b32', label: 'Waldgrün' },
  { bg: '#e8d8f2', fg: '#6a2894', label: 'Pflaume' },
  { bg: '#fce4d6', fg: '#b04a1a', label: 'Kupfer' },
  { bg: '#d6e6f4', fg: '#2a5a92', label: 'Marine' },
  { bg: '#f0eed6', fg: '#7a7020', label: 'Oliv' },
  { bg: '#f0d8e0', fg: '#a82a52', label: 'Beere' },
];

/* ------------------------------------------------------------------ */
/*  localStorage-Migration (alt 8 Slots → neu 9 Slots)                */
/*  Alt: Mo_0 = HU (1+2 kombiniert), Mo_1 = 3. Std, …                */
/*  Neu: Mo_0 = 1. Std, Mo_1 = 2. Std, Mo_2 = 3. Std, …             */
/* ------------------------------------------------------------------ */

const OLD_LS_KEY = 'family_timetables';
const OLD_SC_KEY = 'family_subject_colors';
const MIGRATED_FLAG = 'family_timetables_migrated_v2';

function migrateLocalStorageData(): { timetables: AllTimetables; colors: SubjectColorMap } | null {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return null;
    const raw = localStorage.getItem(OLD_LS_KEY);
    if (!raw) return null;

    const old: AllTimetables = JSON.parse(raw);
    const migrated: AllTimetables = {};

    for (const [userId, oldTt] of Object.entries(old)) {
      const newTt: Timetable = {};
      for (const [key, lesson] of Object.entries(oldTt)) {
        const [day, idxStr] = key.split('_');
        const oldIdx = parseInt(idxStr, 10);
        if (isNaN(oldIdx)) continue;

        if (oldIdx === 0) {
          // Alt: HU-Block → Neu: 1. und 2. Stunde mit gleichem Fach
          newTt[`${day}_0`] = lesson;
          newTt[`${day}_1`] = lesson;
        } else {
          // Alt: Mo_1 (3. Std) → Neu: Mo_2 (Index + 1)
          newTt[`${day}_${oldIdx + 1}`] = lesson;
        }
      }
      migrated[userId] = newTt;
    }

    // Fachfarben migrieren
    let colors: SubjectColorMap = {};
    const scRaw = localStorage.getItem(OLD_SC_KEY);
    if (scRaw) {
      try { colors = JSON.parse(scRaw); } catch { /* ignorieren */ }
    }

    // Flag setzen, damit Migration nur einmal läuft
    localStorage.setItem(MIGRATED_FLAG, 'true');

    return { timetables: migrated, colors };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function collectSubjects(timetables: AllTimetables): string[] {
  const names = new Set<string>();
  for (const tt of Object.values(timetables)) {
    for (const lesson of Object.values(tt)) {
      if (lesson.name) names.add(lesson.name);
    }
  }
  return Array.from(names).sort();
}

function findColor(fg: string): ColorOption {
  return COLORS.find(c => c.fg === fg) ?? COLORS[0];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TimetablePage() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timetables, setTimetables] = useState<AllTimetables>({});
  const [subjectColors, setSubjectColors] = useState<SubjectColorMap>({});
  const [editing, setEditing] = useState<{ day: string; slot: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<ColorOption>(COLORS[0]);
  const [fillBoth, setFillBoth] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [legendEditSubject, setLegendEditSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- SSR guard ---- */
  useEffect(() => setMounted(true), []);

  /* ---- Load data from API ---- */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, ttRes, scRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`),
        fetch(`${API_BASE}/api/timetable`),
        fetch(`${API_BASE}/api/timetable/subject-colors`),
      ]);
      const usersData: User[] = await usersRes.json();
      let ttData: AllTimetables = ttRes.ok ? await ttRes.json() : {};
      let scData: SubjectColorMap = scRes.ok ? await scRes.json() : {};

      // One-time localStorage migration
      const hasData = Object.keys(ttData).some(uid => Object.keys(ttData[uid] ?? {}).length > 0);
      if (!hasData) {
        const migrated = migrateLocalStorageData();
        if (migrated && Object.keys(migrated.timetables).length > 0) {
          ttData = migrated.timetables;
          scData = { ...migrated.colors, ...scData };
          // Save migrated data to API (fire-and-forget)
          Promise.all([
            ...Object.entries(migrated.timetables).map(([uid, data]) =>
              fetch(`${API_BASE}/api/timetable/${uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              }).catch(() => {}),
            ),
            Object.keys(migrated.colors).length > 0
              ? fetch(`${API_BASE}/api/timetable/subject-colors`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(migrated.colors),
                }).catch(() => {})
              : Promise.resolve(),
          ]);
        }
      }

      if (Array.isArray(usersData)) {
        const kids = usersData.filter(u => u.role === 'child');
        setUsers(kids);
        if (kids.length > 0) setActiveId(prev => prev ?? kids[0].id);
      }

      if (ttData && typeof ttData === 'object') setTimetables(ttData);
      if (scData && typeof scData === 'object') setSubjectColors(scData);
    } catch (err) {
      console.error('[timetable] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) loadAll();
  }, [mounted, loadAll]);

  /* ---- Derived state ---- */
  const activeUser = users.find(u => u.id === activeId);
  const tt: Timetable = activeId && timetables[activeId] ? timetables[activeId] : {};
  const allSubjects = collectSubjects(timetables);

  /* ---- API helpers ---- */
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

  async function saveSubjectColorsToApi(colors: SubjectColorMap) {
    try {
      await fetch(`${API_BASE}/api/timetable/subject-colors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colors),
      });
    } catch (err) {
      console.error('[timetable] save subject-colors error:', err);
    }
  }

  /* ---- Edit modal logic ---- */
  function handleEditNameChange(val: string) {
    setEditName(val);
    const normalized = val.trim().toLowerCase();
    const match = Object.entries(subjectColors).find(([k]) => k.toLowerCase() === normalized);
    if (match) {
      const c = findColor(match[1].fg);
      setEditColor(c);
    }
  }

  function selectSuggestion(name: string) {
    setEditName(name);
    const sc = subjectColors[name];
    if (sc) setEditColor(findColor(sc.fg));
    inputRef.current?.focus();
  }

  function openEdit(day: string, slot: number) {
    const key = `${day}_${slot}`;
    const existing = tt[key];
    setEditName(existing?.name ?? '');
    setEditColor(existing ? findColor(existing.fg) : COLORS[0]);
    // Default: 1. Stunde → beide ausfüllen anbieten
    setFillBoth(slot === 0);
    setEditing({ day, slot });
  }

  async function saveLesson() {
    if (!activeId || !editing) return;
    const trimmed = editName.trim();
    const updatedTt = { ...tt };

    if (trimmed) {
      const lesson: Lesson = { name: trimmed, bg: editColor.bg, fg: editColor.fg };
      updatedTt[`${editing.day}_${editing.slot}`] = lesson;

      // "Auch 2. Stunde" — wenn Slot 0 und fillBoth aktiv
      if (editing.slot === 0 && fillBoth) {
        updatedTt[`${editing.day}_1`] = lesson;
      }

      // Update global subject color map
      const sc = { ...subjectColors, [trimmed]: { bg: editColor.bg, fg: editColor.fg } };
      setSubjectColors(sc);
      saveSubjectColorsToApi(sc);
    } else {
      delete updatedTt[`${editing.day}_${editing.slot}`];
    }

    const updatedAll = { ...timetables, [activeId]: updatedTt };
    setTimetables(updatedAll);
    setEditing(null);
    await saveTimetableForUser(activeId, updatedTt);
  }

  /* ---- Legend color change (propagates to all timetables) ---- */
  async function updateLegendColor(subject: string, color: ColorOption) {
    const sc = { ...subjectColors, [subject]: { bg: color.bg, fg: color.fg } };
    setSubjectColors(sc);
    setLegendEditSubject(null);

    // Update all lessons with this name across all timetables
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

    // Save everything
    await Promise.all([
      saveSubjectColorsToApi(sc),
      ...Object.entries(updated).map(([uid, data]) => saveTimetableForUser(uid, data)),
    ]);
  }

  /* ---- Merge detection for HU (slots 0 + 1) ---- */
  function isMergedPair(day: string): boolean {
    const l0 = tt[`${day}_0`];
    const l1 = tt[`${day}_1`];
    return !!l0?.name && !!l1?.name && l0.name === l1.name;
  }

  /* ---- Subject suggestions for edit modal ---- */
  const suggestions = (() => {
    const query = editName.trim().toLowerCase();
    if (!query) return allSubjects.slice(0, 12);
    return allSubjects
      .filter(s => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      .slice(0, 8);
  })();

  /* ---- SSR guard ---- */
  if (!mounted) return null;

  /* ---- Render ---- */
  return (
    <div>
      <PageHeader title="Stundenpläne" variant="page" />

      <div className="px-6 pb-6">
        {/* Toolbar: Fachfarben + Saving indicator */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {saving && (
              <span className="text-[11px] font-sans" style={{ color: '#a09d99' }}>
                Speichern…
              </span>
            )}
          </div>
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
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  background: showLegend ? 'rgba(255,255,255,0.2)' : '#f0ede8',
                  color: showLegend ? '#fff' : '#6b6760',
                }}
              >
                {allSubjects.length}
              </span>
            )}
          </button>
        </div>

        {/* Legend panel */}
        {showLegend && allSubjects.length > 0 && (
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
          >
            <p
              className="text-[11px] font-sans font-semibold uppercase tracking-wider mb-3"
              style={{ color: '#a09d99' }}
            >
              Fachfarben
            </p>
            <div className="flex flex-wrap gap-2">
              {allSubjects.map(subject => {
                const sc = subjectColors[subject] ?? COLORS[0];
                const isLegendEditing = legendEditSubject === subject;
                return (
                  <div key={subject}>
                    {isLegendEditing ? (
                      <div
                        className="rounded-xl p-2 shadow-md"
                        style={{
                          background: '#fff',
                          border: '0.5px solid rgba(0,0,0,0.1)',
                          zIndex: 10,
                          position: 'relative',
                        }}
                      >
                        <div
                          className="text-xs font-sans font-medium mb-2"
                          style={{ color: '#1a1814' }}
                        >
                          {subject}
                        </div>
                        <div className="flex gap-1.5 flex-wrap" style={{ maxWidth: 240 }}>
                          {COLORS.map(c => (
                            <button
                              key={c.fg}
                              onClick={() => updateLegendColor(subject, c)}
                              className="w-6 h-6 rounded-full transition-all"
                              style={{
                                background: c.bg,
                                border:
                                  sc.fg === c.fg
                                    ? `2px solid ${c.fg}`
                                    : '2px solid transparent',
                              }}
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
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: sc.fg }}
                        />
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
          <div className="flex gap-2 mb-4 flex-wrap">
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
                {u.photo ? (
                  <img
                    src={u.photo}
                    alt={u.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <span style={{ fontSize: 16 }}>{u.avatar}</span>
                )}
                {u.name}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-sm font-sans" style={{ color: '#a09d99' }}>
              Lade Stundenpläne…
            </span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-sm font-sans" style={{ color: '#a09d99' }}>
              Keine Kinder angelegt.
            </span>
          </div>
        ) : (
          /* ---- Timetable grid ---- */
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '0.5px solid rgba(0,0,0,0.07)', background: '#fff' }}
          >
            {/* Header row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: '90px repeat(5, 1fr)',
                borderBottom: '0.5px solid rgba(0,0,0,0.07)',
              }}
            >
              <div
                style={{
                  borderRight: '0.5px solid rgba(0,0,0,0.07)',
                  background: '#fafaf9',
                }}
              />
              {DAYS.map((day, di) => (
                <div
                  key={day}
                  className="py-3 flex items-center justify-center"
                  style={{
                    borderRight: di < 4 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                    background: '#fafaf9',
                  }}
                >
                  <span
                    className="text-[11px] font-sans font-semibold uppercase tracking-wider"
                    style={{ color: '#a09d99' }}
                  >
                    {day}
                  </span>
                </div>
              ))}
            </div>

            {/* Slot rows */}
            {SLOTS.map((slotLabel, si) => {
              // Skip rendering slot 1 row-header + cells when ALL days have merged HU
              // (not feasible cleanly — instead handle per-cell)
              const isSlot1 = si === 1;

              return (
                <div
                  key={si}
                  className="grid"
                  style={{
                    gridTemplateColumns: '90px repeat(5, 1fr)',
                    borderBottom:
                      si < SLOTS.length - 1
                        ? '0.5px solid rgba(0,0,0,0.07)'
                        : 'none',
                  }}
                >
                  {/* Time label */}
                  <div
                    className="px-2 py-2 flex items-center justify-end"
                    style={{
                      borderRight: '0.5px solid rgba(0,0,0,0.07)',
                      background: '#fafaf9',
                    }}
                  >
                    <span
                      className="text-[10px] font-sans text-right leading-tight"
                      style={{ color: '#a09d99' }}
                    >
                      {slotLabel}
                    </span>
                  </div>

                  {/* Day cells */}
                  {DAYS.map((day, di) => {
                    const key = `${day}_${si}`;
                    const lesson = tt[key];

                    // Merge detection: slot 0 merged with slot 1
                    const merged = isMergedPair(day);
                    const isTopOfMerge = si === 0 && merged;
                    const isBottomOfMerge = isSlot1 && merged;

                    // Bottom half of merge: show empty continuation
                    if (isBottomOfMerge) {
                      return (
                        <button
                          key={day}
                          onClick={() => openEdit(day, si)}
                          className="relative p-1.5 text-left group"
                          style={{
                            borderRight:
                              di < 4 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                            minHeight: 44,
                          }}
                        >
                          {/* Colored continuation bar (no text) */}
                          <div
                            className="w-full h-full rounded-b-lg"
                            style={{
                              background: lesson.bg,
                              marginTop: -6,
                              borderBottomLeftRadius: 8,
                              borderBottomRightRadius: 8,
                            }}
                          />
                        </button>
                      );
                    }

                    return (
                      <button
                        key={day}
                        onClick={() => openEdit(day, si)}
                        className="relative p-1.5 text-left transition-all group"
                        style={{
                          borderRight:
                            di < 4 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                          minHeight: isTopOfMerge ? 44 : 44,
                        }}
                      >
                        {lesson ? (
                          <div
                            className="w-full h-full px-2 py-1.5 flex items-center"
                            style={{
                              background: lesson.bg,
                              borderRadius: isTopOfMerge
                                ? '8px 8px 0 0'
                                : '8px',
                              marginBottom: isTopOfMerge ? -6 : 0,
                            }}
                          >
                            <span
                              className="text-xs font-sans font-medium truncate"
                              style={{ color: lesson.fg }}
                            >
                              {lesson.name}
                            </span>
                          </div>
                        ) : (
                          <div
                            className="w-full h-full rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: '#f0ede8' }}
                          >
                            <i
                              className="ti ti-plus"
                              style={{ fontSize: 14, color: '#a09d99' }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Edit modal ---- */}
      {editing && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={e => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="rounded-2xl p-6 w-80 shadow-xl" style={{ background: '#fff' }}>
            <div
              className="text-base font-sans font-medium mb-4"
              style={{ color: '#1a1814' }}
            >
              {editing.day} · {SLOT_LABELS[editing.slot]} Stunde
            </div>

            {/* Subject input */}
            <label
              className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-1.5"
              style={{ color: '#a09d99' }}
            >
              Fach
            </label>
            <input
              ref={inputRef}
              autoFocus
              value={editName}
              onChange={e => handleEditNameChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveLesson()}
              placeholder="z.B. Englisch"
              className="w-full rounded-xl px-3 py-2.5 text-sm font-sans outline-none mb-2"
              style={{
                background: '#f5f3f0',
                color: '#1a1814',
                border: '0.5px solid rgba(0,0,0,0.1)',
              }}
            />

            {/* Subject suggestions — tippbare Chips */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {suggestions.map(s => {
                  const sc = subjectColors[s];
                  return (
                    <button
                      key={s}
                      onClick={() => selectSuggestion(s)}
                      className="px-2 py-1 rounded-lg text-[11px] font-sans font-medium transition-all hover:opacity-80"
                      style={{
                        background: sc?.bg ?? '#f0ede8',
                        color: sc?.fg ?? '#6b6760',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Color picker */}
            <label
              className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-2"
              style={{ color: '#a09d99' }}
            >
              Farbe
            </label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {COLORS.map(c => (
                <button
                  key={c.fg}
                  onClick={() => setEditColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c.bg,
                    border:
                      editColor.fg === c.fg
                        ? `2.5px solid ${c.fg}`
                        : '2.5px solid transparent',
                  }}
                  title={c.label}
                />
              ))}
            </div>

            {/* "Auch 2. Stunde" checkbox — only when editing slot 0 */}
            {editing.slot === 0 && (
              <label
                className="flex items-center gap-2 mb-4 cursor-pointer select-none"
                onClick={() => setFillBoth(v => !v)}
              >
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                  style={{
                    background: fillBoth ? '#1a1814' : '#f0ede8',
                    color: fillBoth ? '#fff' : 'transparent',
                    border: '0.5px solid rgba(0,0,0,0.15)',
                  }}
                >
                  ✓
                </span>
                <span className="text-xs font-sans" style={{ color: '#6b6760' }}>
                  Auch 2. Stunde (HU-Block)
                </span>
              </label>
            )}

            {/* Preview */}
            {editName.trim() && (
              <div
                className="rounded-lg px-3 py-2 mb-4 flex items-center"
                style={{ background: editColor.bg }}
              >
                <span
                  className="text-sm font-sans font-medium"
                  style={{ color: editColor.fg }}
                >
                  {editName.trim()}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditName('');
                  saveLesson();
                }}
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