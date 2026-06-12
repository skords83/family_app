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
interface WeatherData { temperature: number; weathercode: number; windspeed: number; apparentTemperature?: number; precipitationProbability?: number; hourly?: { time: string; temperature: number }[]; }
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
  const [waste, setWaste] = useState<WasteTodayData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [usersRes, tasksRes, weatherRes, calRes, mealsRes, immichRes, wasteRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/immich`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/waste/today`).then(r => r.json()),
      ]);
      if (Array.isArray(usersRes)) setUsers(usersRes);
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (weatherRes.data) setWeather(weatherRes);
      if (calRes.events) setCalendar(calRes);
      if (mealsRes.byDate) setMeals(mealsRes);
      if (immichRes.data) setImmich(immichRes);
      if (wasteRes && !wasteRes.error) setWaste(wasteRes);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  // Tasks-Grid: ≤4 User → 2 Spalten, ≤6 User → 3 Spalten (aber bei 5–6 besser 2 Reihen à 3)
  // Bei 150% Zoom (1280px effektiv): 5–6 User in grid-cols-3 ist zu eng → grid-cols-2
  const taskGridCols = users.length <= 4
    ? 'grid-cols-2'
    : users.length <= 6
      ? 'grid-cols-3'
      : 'grid-cols-3';

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <PageHeader variant="home" />

      <div className="px-4 pb-4 flex flex-col gap-4 flex-1">
        {/* Main 2-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT col (2/3): Calendar + tasks */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            <CalendarWidget events={calendar.events} fetched_at={calendar.fetched_at} loading={loading} daysAhead={1} />

            {/* Tasks per user */}
            {!loading && users.length > 0 && (
              <div>
                <h2 className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#7a7874' }}>
                  Aufgaben heute
                </h2>
                <div className={`grid gap-2.5 ${taskGridCols}`}>
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
                        className="rounded-2xl p-3 block active:opacity-75 transition-opacity"
                        style={{ background: bg, border: `0.5px solid ${user.color}25` }}
                      >
                        {/* User header */}
                        <div className="flex items-center gap-2 mb-2">
                          {user.photo ? (
                            <img src={user.photo} alt={user.name}
                              className="rounded-full object-cover flex-shrink-0"
                              style={{ width: 28, height: 28 }} />
                          ) : (
                            <div className="rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                              style={{ width: 28, height: 28, background: user.color }}>
                              {user.name[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-sans font-semibold truncate" style={{ color: '#1a1814' }}>{user.name}</p>
                            <p className="text-[10px] font-sans" style={{ color: '#a09d99' }}>
                              {done.length}/{userTasks.length} · <i className="ti ti-star-filled" style={{ fontSize: 8, color: '#c9a020' }} />{user.points}
                            </p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-0.5 rounded-full mb-2 overflow-hidden" style={{ background: `${user.color}25` }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: user.color }} />
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
                            <p className="text-xs font-sans text-center py-1" style={{ color: '#a09d99' }}>Keine Aufgaben</p>
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
          <div className="flex flex-col gap-4">
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