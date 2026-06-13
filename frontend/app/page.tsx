'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '@/hooks/useSSE';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import MealsWidget from '@/components/widgets/MealsWidget';
import WasteWidget from '@/components/widgets/WasteWidget';
import PageHeader from '@/components/ui/PageHeader';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User { id: string; name: string; avatar: string; photo?: string; color: string; points: number; role: string; tasks_total?: number; tasks_done?: number; }
interface TaskInstance { id: string; title: string; points: number; assigned_to: string; completed_at: string | null; due_time?: string | null; }
// WeatherData wird durch WeatherWidget typisiert
interface CalendarEvent { id: string; title: string; start: string; end: string; allDay: boolean; color?: string; calendarName?: string; }
type WasteType = 'bioabfall' | 'restmuell' | 'papier' | 'wertstoff';
interface WasteTodayData { active: boolean; events: { id: string; source: string; type: WasteType; date: string; title: string; fetched_at: string; }[]; next: { id: string; source: string; type: WasteType; date: string; title: string; fetched_at: string; } | null; fetched_at: string; }

const PASTELS: Record<string, string> = {
  '#e85d3a':'#fff5f3','#4a9eed':'#f0f7ff','#5cb85c':'#f2fbf2',
  '#9b59b6':'#f8f2fd','#f0a500':'#fffbf0','#00bcd4':'#f0fbfd',
  '#f59e0b':'#fffbeb','#3b82f6':'#eff6ff','#10b981':'#f0fdf4',
  '#ec4899':'#fdf2f8','#6366f1':'#eef2ff',
};

const MAX_VISIBLE_TASKS = 3;

// Avatar mit Fortschritts-Ring — das einzige Fortschritts-Signal pro Person
function AvatarRing({ user, pct, size = 52 }: { user: User; pct: number; size?: number }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  const inner = size - stroke * 2 - 4;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={user.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: inner,
          height: inner,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${user.color}22`,
          fontSize: Math.round(inner * 0.42),
        }}
      >
        {user.photo
          ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span>{user.avatar}</span>}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [weather, setWeather] = useState<{ data?: any; fetched_at?: string }>({});
  const [calendar, setCalendar] = useState<{ events?: CalendarEvent[]; fetched_at?: string }>({});
  const [meals, setMeals] = useState<{ byDate?: Record<string, any>; fetched_at?: string }>({});
  const [waste, setWaste] = useState<WasteTodayData | undefined>();
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ur, tr, wr, cr, mr, wasteR] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals?range=month`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/waste/today`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && Array.isArray(ur.value)) setUsers(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTasks(tr.value);
      if (wr.status === 'fulfilled' && wr.value?.data) setWeather({ data: wr.value.data, fetched_at: wr.value.fetched_at });
      if (cr.status === 'fulfilled' && cr.value?.events) setCalendar({ events: cr.value.events, fetched_at: cr.value.fetched_at });
      if (mr.status === 'fulfilled' && mr.value?.byDate) setMeals({ byDate: mr.value.byDate, fetched_at: mr.value.fetched_at });
      if (wasteR.status === 'fulfilled' && wasteR.value?.fetched_at) setWaste(wasteR.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 5 * 60_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/tasks/today`).then(r => r.json());
    if (Array.isArray(res)) setTasks(res);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/users`).then(r => r.json());
    if (Array.isArray(res)) setUsers(res);
  }, []);

  const handleConfigUpdated = useCallback(() => window.location.reload(), []);

  useSSE({
    task_updated: fetchTasks,
    points_updated: fetchUsers,
    reward_claimed: fetchUsers,
    config_updated: handleConfigUpdated,
  });

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader variant="home" />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 300px',
          gap: 16,
          padding: '0 24px 24px',
          overflow: 'hidden',
        }}
      >

        {/* ── SPALTE 1: Kalender + Müllabfuhr ── */}
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CalendarWidget
            events={calendar.events}
            fetched_at={calendar.fetched_at}
            loading={loading}
            daysAhead={1}
          />
          <div style={{ flexShrink: 0 }}>
            <WasteWidget data={waste} fetched_at={waste?.fetched_at} loading={loading} />
          </div>
        </div>

        {/* ── SPALTE 2: Familie / Aufgaben ── */}
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!loading && users.length > 0 && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridAutoRows: '1fr',
                gap: 12,
              }}
            >
              {users.map(user => {
                const userTasks = tasks.filter(t => t.assigned_to === user.id);
                const done = userTasks.filter(t => t.completed_at);
                const pending = userTasks.filter(t => !t.completed_at);
                const pct = userTasks.length ? Math.round(done.length / userTasks.length * 100) : 0;
                const bg = PASTELS[user.color] ?? `${user.color}18`;
                const allDone = userTasks.length > 0 && pending.length === 0;
                const hint = allDone || userTasks.length === 0 ? 'Aufgaben ansehen' : 'Aufgaben abhaken';

                return (
                  <Link
                    key={user.id}
                    href={`/user/${user.id}`}
                    className="rounded-2xl p-3 flex flex-col active:opacity-75 transition-opacity"
                    style={{ background: bg, border: `0.5px solid ${user.color}25`, minHeight: 0 }}
                  >
                    {/* Kopf: Ring-Avatar + Name + Punkte */}
                    <div className="flex items-center gap-3 mb-2.5 flex-shrink-0">
                      <AvatarRing user={user} pct={pct} />
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-sans font-medium truncate"
                          style={{ fontSize: 14, color: '#1a1814', lineHeight: 1.2 }}
                        >
                          {user.name}
                        </div>
                        <div className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>
                          {userTasks.length > 0 && `${done.length}/${userTasks.length} · `}{user.points} Pkt.
                        </div>
                      </div>
                    </div>

                    {/* Offene Aufgaben — reine Liste, kein Abhaken hier */}
                    <div className="flex-1 min-h-0 flex flex-col" style={{ gap: 2 }}>
                      {userTasks.length === 0 && (
                        <p className="font-sans" style={{ fontSize: 12, color: '#a09d99' }}>
                          Keine Aufgaben heute
                        </p>
                      )}

                      {allDone && (
                        <div className="flex items-center gap-2 py-1">
                          <i
                            className="ti ti-circle-check-filled"
                            style={{ fontSize: 18, color: user.color }}
                            aria-hidden="true"
                          />
                          <span className="font-sans font-medium" style={{ fontSize: 13, color: user.color }}>
                            Alles erledigt!
                          </span>
                        </div>
                      )}

                      {pending.slice(0, MAX_VISIBLE_TASKS).map(task => (
                        <div key={task.id} className="flex items-center gap-2 py-1">
                          <span
                            style={{ width: 4, height: 18, borderRadius: 2, background: user.color, flexShrink: 0 }}
                          />
                          <span
                            className="font-sans flex-1 truncate"
                            style={{ fontSize: 13, color: '#1a1814' }}
                          >
                            {task.title}
                          </span>
                          <span
                            className="font-sans flex-shrink-0 flex items-center gap-0.5"
                            style={{ fontSize: 11, color: '#a09d99' }}
                          >
                            <i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} aria-hidden="true" />
                            {task.points}
                          </span>
                        </div>
                      ))}

                      {pending.length > MAX_VISIBLE_TASKS && (
                        <span
                          className="font-sans"
                          style={{ fontSize: 11, color: '#a09d99', paddingLeft: 12 }}
                        >
                          + {pending.length - MAX_VISIBLE_TASKS} weitere
                        </span>
                      )}
                    </div>

                    {/* Fuß: Hinweis, dass im Kind-Modus abgehakt wird */}
                    <div
                      className="flex items-center justify-end gap-1 mt-1.5 flex-shrink-0"
                      style={{ fontSize: 11, color: '#a09d99' }}
                    >
                      <span className="font-sans">{hint}</span>
                      <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {loading && (
            <div
              className="grid gap-3 flex-1"
              style={{ gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr' }}
            >
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="rounded-2xl animate-pulse" style={{ background: '#e8e4de' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── SPALTE 3: Info-Widgets ── */}
        <div
          style={{
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <WeatherWidget data={weather.data} fetched_at={weather.fetched_at} loading={loading} />
          <MealsWidget byDate={meals.byDate} fetched_at={meals.fetched_at} loading={loading} />
        </div>

      </div>
    </div>
  );
}