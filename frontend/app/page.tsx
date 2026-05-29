'use client';

import { useState, useEffect, useCallback } from 'react';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import MealsWidget from '@/components/widgets/MealsWidget';
import ImmichWidget from '@/components/widgets/ImmichWidget';
import AvatarButton from '@/components/ui/AvatarButton';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
interface PlannedRecipe { id: string; date: string; slot: MealSlot; recipeName: string | null; }
interface User { id: string; name: string; avatar: string; photo?: string; color: string; points: number; role: string; tasks_total?: number; tasks_done?: number; }
interface TaskInstance { id: string; title: string; points: number; assigned_to: string; completed_at: string | null; due_time?: string | null; }
interface WeatherData { temperature: number; weathercode: number; windspeed: number; hourly?: { time: string; temperature: number }[]; }
interface CalendarEvent { id: string; title: string; start: string; end: string; allDay: boolean; color?: string; calendarName?: string; }
interface ImmichData { id: string; url: string; thumbnailUrl: string; fileName: string; createdAt: string; description?: string; location?: string; }

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setTime(new Date()), 30_000); return () => clearInterval(iv); }, []);
  const hm = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="text-right">
      <div className="text-5xl font-bold tracking-tight tabular-nums" style={{ color: '#1a1814', fontFamily: 'Georgia, serif' }}>
        {hm}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [weather, setWeather] = useState<{ data?: WeatherData; fetched_at?: string }>({});
  const [calendar, setCalendar] = useState<{ events?: CalendarEvent[]; fetched_at?: string }>({});
  const [meals, setMeals] = useState<{ byDate?: Record<string, any>; fetched_at?: string }>({});
  const [immich, setImmich] = useState<{ data?: ImmichData; fetched_at?: string }>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ur, tr, wr, cr, mr, ir] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals?range=week`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/immich`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && Array.isArray(ur.value)) setUsers(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTasks(tr.value);
      if (wr.status === 'fulfilled' && wr.value?.data) setWeather({ data: wr.value.data, fetched_at: wr.value.fetched_at });
      if (cr.status === 'fulfilled' && cr.value?.events) setCalendar({ events: cr.value.events, fetched_at: cr.value.fetched_at });
      if (mr.status === 'fulfilled' && mr.value?.byDate) setMeals({ byDate: mr.value.byDate, fetched_at: mr.value.fetched_at });
      if (ir.status === 'fulfilled' && ir.value?.data) setImmich({ data: ir.value.data, fetched_at: ir.value.fetched_at });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 5 * 60_000); return () => clearInterval(iv); }, [fetchAll]);

  const handleTaskComplete = async (taskId: string, userId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
    const fresh = await fetch(`${API_BASE}/api/users`).then(r => r.json());
    if (Array.isArray(fresh)) setUsers(fresh);
  };

  const handleImmichRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/immich/refresh`).then(r => r.json());
      if (res.data) setImmich({ data: res.data, fetched_at: res.fetched_at });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header: greeting + clock */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1a1814', fontFamily: 'Georgia, serif' }}>
            {(() => {
              const h = new Date().getHours();
              if (h < 12) return 'Guten Morgen 👋';
              if (h < 18) return 'Guten Tag 👋';
              return 'Guten Abend 👋';
            })()}
          </h1>
          <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Clock />
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT col (2/3): Calendar big + tasks below */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Calendar widget – prominent */}
          <CalendarWidget events={calendar.events} fetched_at={calendar.fetched_at} loading={loading} daysAhead={1} />

          {/* Tasks per user */}
          {!loading && users.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>
                  Aufgaben heute
                </h2>
                <Link href="/tasks" className="text-xs font-sans" style={{ color: '#e85d3a' }}>Alle →</Link>
              </div>
              <div className={`grid gap-3 ${users.length <= 2 ? 'grid-cols-2' : users.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
                {users.map(user => {
                  const userTasks = tasks.filter(t => t.assigned_to === user.id);
                  const done = userTasks.filter(t => t.completed_at);
                  const pending = userTasks.filter(t => !t.completed_at);
                  const pct = userTasks.length ? Math.round(done.length / userTasks.length * 100) : 0;
                  const PASTELS: Record<string, string> = {
                    '#e85d3a':'#fff5f3','#4a9eed':'#f0f7ff','#5cb85c':'#f2fbf2',
                    '#9b59b6':'#f8f2fd','#f0a500':'#fffbf0','#00bcd4':'#f0fbfd',
                    '#f59e0b':'#fffbeb','#3b82f6':'#eff6ff','#10b981':'#f0fdf4',
                    '#ec4899':'#fdf2f8','#6366f1':'#eef2ff',
                  };
                  const bg = PASTELS[user.color] ?? `${user.color}18`;

                  return (
                    <div key={user.id} className="rounded-2xl p-4" style={{ background: bg, border: `0.5px solid ${user.color}25` }}>
                      {/* User header */}
                      <div className="flex items-center gap-2 mb-2">
                        <AvatarButton user={{ ...user, tasks_total: userTasks.length, tasks_done: done.length }} size="topbar" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold font-sans truncate" style={{ color: user.color }}>{user.name}</p>
                          <p className="text-xs font-sans" style={{ color: '#a09d99' }}>{done.length}/{userTasks.length} · ⭐{user.points}</p>
                        </div>
                      </div>
                      {/* Progress */}
                      <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: `${user.color}20` }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: user.color }} />
                      </div>
                      {/* Pending tasks (max 3) */}
                      <div className="space-y-1">
                        {pending.slice(0, 3).map(task => (
                          <button key={task.id} onClick={() => handleTaskComplete(task.id, user.id)}
                            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-all active:scale-95"
                            style={{ background: `${user.color}10` }}>
                            <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: user.color }} />
                            <span className="text-xs font-sans flex-1 truncate" style={{ color: '#1a1814' }}>{task.title}</span>
                            <span className="text-[10px] font-sans" style={{ color: '#a09d99' }}>⭐{task.points}</span>
                          </button>
                        ))}
                        {done.slice(0, 2).map(task => (
                          <div key={task.id} className="flex items-center gap-2 px-2 py-1 opacity-40">
                            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: user.color }}>
                              <i className="ti ti-check" style={{ fontSize: 8, color: '#fff' }} />
                            </div>
                            <span className="text-xs font-sans line-through flex-1 truncate" style={{ color: '#6b6760' }}>{task.title}</span>
                          </div>
                        ))}
                        {userTasks.length === 0 && (
                          <p className="text-xs font-sans text-center py-2" style={{ color: '#a09d99' }}>Keine Aufgaben</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT col (1/3): Weather + Meals + Photo */}
        <div className="flex flex-col gap-5">
          <WeatherWidget data={weather.data} fetched_at={weather.fetched_at} loading={loading} />
          <MealsWidget byDate={meals.byDate} fetched_at={meals.fetched_at} loading={loading} />
          <ImmichWidget data={immich.data} fetched_at={immich.fetched_at} loading={loading} onRefresh={handleImmichRefresh} apiBase={API_BASE} />
        </div>
      </div>
    </div>
  );
}