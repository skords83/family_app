'use client';

import { useState, useEffect, useCallback } from 'react';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import MealsWidget from '@/components/widgets/MealsWidget';
import ImmichWidget from '@/components/widgets/ImmichWidget';
import TaskColumns from '@/components/widgets/TaskColumns';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string; name: string; avatar: string; photo?: string;
  color: string; points: number; role: string;
  tasks_total?: number; tasks_done?: number;
}
interface TaskInstance {
  id: string; title: string; points: number;
  assigned_to: string; completed_at: string | null; due_time?: string | null;
}
interface WeatherData {
  temperature: number; weathercode: number; windspeed: number;
  hourly?: { time: string; temperature: number }[];
}
interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}
type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
interface PlannedRecipe { id: string; date: string; slot: MealSlot; recipeName: string | null; }
interface ImmichData {
  id: string; url: string; thumbnailUrl: string; fileName: string;
  createdAt: string; description?: string; location?: string;
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const hm = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const sec = time.getSeconds();
  const date = time.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="text-center pt-2 pb-4">
      <div className="text-5xl font-bold tracking-tight tabular-nums" style={{ color: '#1a1814', fontFamily: 'Georgia, serif' }}>
        {hm}
        <span className={`text-3xl transition-opacity duration-500 ${sec % 2 === 0 ? 'opacity-100' : 'opacity-20'}`} style={{ color: '#a09d99' }}>
          :{String(sec).padStart(2, '0')}
        </span>
      </div>
      <div className="text-sm mt-1 capitalize font-sans" style={{ color: '#a09d99' }}>{date}</div>
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
      const [usersRes, tasksRes, weatherRes, calendarRes, mealsRes, immichRes] =
        await Promise.allSettled([
          fetch(`${API_BASE}/api/users`).then(r => r.json()),
          fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
          fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json()),
          fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
          fetch(`${API_BASE}/api/widgets/meals`).then(r => r.json()),
          fetch(`${API_BASE}/api/widgets/immich`).then(r => r.json()),
        ]);
      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) setUsers(usersRes.value);
      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) setTasks(tasksRes.value);
      if (weatherRes.status === 'fulfilled' && weatherRes.value?.data) setWeather({ data: weatherRes.value.data, fetched_at: weatherRes.value.fetched_at });
      if (calendarRes.status === 'fulfilled' && calendarRes.value?.events) setCalendar({ events: calendarRes.value.events, fetched_at: calendarRes.value.fetched_at });
      if (mealsRes.status === 'fulfilled' && mealsRes.value?.byDate) setMeals({ byDate: mealsRes.value.byDate, fetched_at: mealsRes.value.fetched_at });
      if (immichRes.status === 'fulfilled' && immichRes.value?.data) setImmich({ data: immichRes.value.data, fetched_at: immichRes.value.fetched_at });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 5 * 60_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const handleTaskComplete = async (taskId: string, _userId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: task.assigned_to }),
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

  const childUsers = users.filter(u => u.role === 'child');
  const displayUsers = childUsers.length > 0 ? childUsers : users;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Clock />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Tasks + Calendar */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {!loading && (
            <TaskColumns
              users={displayUsers}
              tasks={tasks}
              onComplete={handleTaskComplete}
              compact
            />
          )}
          {loading && (
            <div className="grid grid-cols-2 gap-4">
              {[0,1].map(i => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: '#e8e4de' }} />)}
            </div>
          )}
          <CalendarWidget events={calendar.events} fetched_at={calendar.fetched_at} loading={loading} />
        </div>

        {/* Right: Weather + Meals + Photo */}
        <div className="flex flex-col gap-5">
          <WeatherWidget data={weather.data} fetched_at={weather.fetched_at} loading={loading} />
          <MealsWidget byDate={meals.byDate} fetched_at={meals.fetched_at} loading={loading} />
          <ImmichWidget data={immich.data} fetched_at={immich.fetched_at} loading={loading} onRefresh={handleImmichRefresh} apiBase={API_BASE} />
        </div>
      </div>
    </div>
  );
}