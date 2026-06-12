'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '@/hooks/useSSE';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import MealsWidget from '@/components/widgets/MealsWidget';
import ImmichWidget from '@/components/widgets/ImmichWidget';
import WasteWidget from '@/components/widgets/WasteWidget';
import PageHeader from '@/components/ui/PageHeader';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
interface User { id: string; name: string; avatar: string; photo?: string; color: string; points: number; role: string; tasks_total?: number; tasks_done?: number; }
interface TaskInstance { id: string; title: string; points: number; assigned_to: string; completed_at: string | null; due_time?: string | null; }
interface WeatherData { temperature: number; weathercode: number; windspeed: number; hourly?: { time: string; temperature: number }[]; }
interface CalendarEvent { id: string; title: string; start: string; end: string; allDay: boolean; color?: string; calendarName?: string; }
interface ImmichData { id: string; url: string; thumbnailUrl: string; fileName: string; createdAt: string; description?: string; location?: string; }
type WasteType = 'bioabfall' | 'restmuell' | 'papier' | 'wertstoff';
interface WasteTodayData { active: boolean; events: { id: string; source: string; type: WasteType; date: string; title: string; fetched_at: string; }[]; next: { id: string; source: string; type: WasteType; date: string; title: string; fetched_at: string; } | null; fetched_at: string; }

const PASTELS: Record<string, string> = {
  '#e85d3a':'#fff5f3','#4a9eed':'#f0f7ff','#5cb85c':'#f2fbf2',
  '#9b59b6':'#f8f2fd','#f0a500':'#fffbf0','#00bcd4':'#f0fbfd',
  '#f59e0b':'#fffbeb','#3b82f6':'#eff6ff','#10b981':'#f0fdf4',
  '#ec4899':'#fdf2f8','#6366f1':'#eef2ff',
};

export default function HomePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [weather, setWeather] = useState<{ data?: WeatherData; fetched_at?: string }>({});
  const [calendar, setCalendar] = useState<{ events?: CalendarEvent[]; fetched_at?: string }>({});
  const [meals, setMeals] = useState<{ byDate?: Record<string, any>; fetched_at?: string }>({});
  const [immich, setImmich] = useState<{ data?: ImmichData; fetched_at?: string }>({});
  const [waste, setWaste] = useState<WasteTodayData | undefined>();
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ur, tr, wr, cr, mr, ir, wasteR] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals?range=month`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/immich`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/waste/today`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && Array.isArray(ur.value)) setUsers(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTasks(tr.value);
      if (wr.status === 'fulfilled' && wr.value?.data) setWeather({ data: wr.value.data, fetched_at: wr.value.fetched_at });
      if (cr.status === 'fulfilled' && cr.value?.events) setCalendar({ events: cr.value.events, fetched_at: cr.value.fetched_at });
      if (mr.status === 'fulfilled' && mr.value?.byDate) setMeals({ byDate: mr.value.byDate, fetched_at: mr.value.fetched_at });
      if (ir.status === 'fulfilled' && ir.value?.data) setImmich({ data: ir.value.data, fetched_at: ir.value.fetched_at });
      if (wasteR.status === 'fulfilled' && wasteR.value?.fetched_at) setWaste(wasteR.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 5 * 60_000); return () => clearInterval(iv); }, [fetchAll]);

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/tasks/today`).then(r => r.json());
    if (Array.isArray(res)) setTasks(res);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/users`).then(r => r.json());
    if (Array.isArray(res)) setUsers(res);
  }, []);

  useSSE({
    task_updated: fetchTasks,
    points_updated: fetchUsers,
    reward_claimed: fetchUsers,
    config_updated: useCallback(() => window.location.reload(), []),
  });

  const handleImmichRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/immich/refresh`).then(r => r.json());
      if (res.data) setImmich({ data: res.data, fetched_at: res.fetched_at });
    } catch (e) { console.error(e); }
  };

  return (
    // Kiosk: fill exactly the viewport height passed from layout, no own scroll
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader variant="home" />

      {/* Scrollable content area — only this scrolls if content overflows */}
      <div
        className="px-5 pb-4"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {/* Main 2-col grid — gap reduced from 20px to 14px for 864px height budget */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, height: '100%' }}>

          {/* LEFT col (2/3): Calendar + tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <CalendarWidget events={calendar.events} fetched_at={calendar.fetched_at} loading={loading} daysAhead={1} />

            {/* Tasks per user */}
            {!loading && users.length > 0 && (
              <div>
                <h2 className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#7a7874' }}>
                  Aufgaben heute
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(users.length, 3)}, 1fr)`,
                  gap: 10,
                }}>
                  {users.map(user => {
                    const userTasks = tasks.filter(t => t.assigned_to === user.id);
                    const done = userTasks.filter(t => t.completed_at);
                    const pending = userTasks.filter(t => !t.completed_at);
                    const pct = userTasks.length ? Math.round(done.length / userTasks.length * 100) : 0;
                    const bg = PASTELS[user.color] ?? `${user.color}18`;

                    return (
                      <Link
                        key={user.id}
                        href={`/user/${user.id}`}
                        className="rounded-2xl block active:opacity-75 transition-opacity"
                        style={{ background: bg, border: `0.5px solid ${user.color}25`, padding: '12px 14px' }}
                      >
                        {/* User header */}
                        <div className="flex items-center gap-2 mb-2">
                          {user.photo ? (
                            <img src={user.photo} alt={user.name}
                              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${user.color}` }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${user.color}22`, border: `2px solid ${user.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                              {user.avatar}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-sans font-semibold truncate" style={{ color: '#1a1814' }}>{user.name}</p>
                            <p className="text-[10px] font-sans flex items-center gap-1" style={{ color: '#a09d99' }}>
                              {done.length}/{userTasks.length}
                              <span style={{ marginLeft: 2 }}>·</span>
                              <i className="ti ti-star-filled" style={{ fontSize: 8, color: '#c9a020' }} aria-hidden="true" />
                              {user.points}
                            </p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="rounded-full overflow-hidden mb-2" style={{ height: 3, background: `${user.color}20` }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: user.color }} />
                        </div>
                        {/* Pending tasks (max 3) */}
                        <div className="space-y-1">
                          {pending.slice(0, 3).map(task => (
                            <div key={task.id}
                              className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5"
                              style={{ background: `${user.color}10` }}>
                              <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: user.color }} />
                              <span className="text-xs font-sans flex-1 leading-tight line-clamp-2" style={{ color: '#1a1814' }}>{task.title}</span>
                              <span className="text-[10px] font-sans flex-shrink-0 flex items-center gap-0.5" style={{ color: '#a09d99' }}>
                                <i className="ti ti-star-filled" style={{ fontSize: 8, color: '#c9a020' }} aria-hidden="true" />{task.points}
                              </span>
                            </div>
                          ))}
                          {done.slice(0, 2).map(task => (
                            <div key={task.id} className="flex items-center gap-2 px-2 py-1 opacity-40">
                              <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: user.color }}>
                                <i className="ti ti-check" style={{ fontSize: 8, color: '#fff' }} />
                              </div>
                              <span className="text-xs font-sans line-through flex-1 leading-tight line-clamp-2" style={{ color: '#6b6760' }}>{task.title}</span>
                            </div>
                          ))}
                          {userTasks.length === 0 && (
                            <p className="text-xs font-sans text-center py-2" style={{ color: '#a09d99' }}>Keine Aufgaben</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT col (1/3): Weather + Meals + Waste + Photo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <WeatherWidget data={weather.data} fetched_at={weather.fetched_at} loading={loading} />
            <MealsWidget byDate={meals.byDate} fetched_at={meals.fetched_at} loading={loading} />
            <WasteWidget data={waste} fetched_at={waste?.fetched_at} loading={loading} />
            <ImmichWidget data={immich.data} fetched_at={immich.fetched_at} loading={loading} onRefresh={handleImmichRefresh} apiBase={API_BASE} />
          </div>

        </div>
      </div>
    </div>
  );
}