'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import TaskColumns from '@/components/widgets/TaskColumns';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import MealsWidget from '@/components/widgets/MealsWidget';
import ImmichWidget from '@/components/widgets/ImmichWidget';
import AvatarButton from '@/components/ui/AvatarButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  points: number;
  role: string;
}

interface TaskInstance {
  id: string;
  title: string;
  points: number;
  assigned_to: string;
  completed_at: string | null;
  due_time?: string | null;
}

interface WeatherData {
  temperature: number;
  weathercode: number;
  windspeed: number;
  hourly?: { time: string; temperature: number }[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
}

interface MealDay {
  date: string;
  lunch: string;
  dinner: string;
}

interface ImmichData {
  id: string;
  url: string;
  thumbnailUrl: string;
  fileName: string;
  createdAt: string;
  description?: string;
  location?: string;
}

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const seconds = time.getSeconds();

  return (
    <div className="text-center py-2">
      <div className="text-6xl font-bold text-white tracking-tight tabular-nums">
        {timeStr}
        <span className={`text-slate-500 text-4xl ${seconds % 2 === 0 ? 'opacity-100' : 'opacity-30'} transition-opacity duration-500`}>
          :{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="text-slate-400 text-lg mt-1 capitalize">{dateStr}</div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [weather, setWeather] = useState<{ data?: WeatherData; fetched_at?: string }>({});
  const [calendar, setCalendar] = useState<{ events?: CalendarEvent[]; fetched_at?: string }>({});
  const [meals, setMeals] = useState<{ days?: MealDay[]; fetched_at?: string }>({});
  const [immich, setImmich] = useState<{ data?: ImmichData; fetched_at?: string }>({});
  const [loading, setLoading] = useState(true);

  // Long-press for gear/admin
  const gearPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [usersRes, tasksRes, weatherRes, calendarRes, mealsRes, immichRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then((r) => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then((r) => r.json()),
        fetch(`${API_BASE}/api/widgets/weather`).then((r) => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then((r) => r.json()),
        fetch(`${API_BASE}/api/widgets/meals`).then((r) => r.json()),
        fetch(`${API_BASE}/api/widgets/immich`).then((r) => r.json()),
      ]);

      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
        setUsers(usersRes.value);
      }
      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
        setTasks(tasksRes.value);
      }
      if (weatherRes.status === 'fulfilled' && weatherRes.value.data) {
        setWeather({ data: weatherRes.value.data, fetched_at: weatherRes.value.fetched_at });
      }
      if (calendarRes.status === 'fulfilled' && calendarRes.value.events) {
        setCalendar({ events: calendarRes.value.events, fetched_at: calendarRes.value.fetched_at });
      }
      if (mealsRes.status === 'fulfilled' && mealsRes.value.data) {
        setMeals({ days: mealsRes.value.data.days, fetched_at: mealsRes.value.fetched_at });
      }
      if (immichRes.status === 'fulfilled' && immichRes.value.data) {
        setImmich({ data: immichRes.value.data, fetched_at: immichRes.value.fetched_at });
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleTaskComplete = async (taskId: string, _userId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: task.assigned_to }),
    });

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t))
    );

    // Refresh users to update point balances
    const usersRes = await fetch(`${API_BASE}/api/users`).then((r) => r.json());
    if (Array.isArray(usersRes)) setUsers(usersRes);
  };

  const handleImmichRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/immich/refresh`).then((r) => r.json());
      if (res.data) {
        setImmich({ data: res.data, fetched_at: res.fetched_at });
      }
    } catch (err) {
      console.error('Failed to refresh immich:', err);
    }
  };

  const handleGearPressStart = () => {
    gearPressTimer.current = setTimeout(() => {
      router.push('/admin');
    }, 1500);
  };

  const handleGearPressEnd = () => {
    if (gearPressTimer.current) {
      clearTimeout(gearPressTimer.current);
    }
  };

  // Filter users — show all on home
  const displayUsers = users;
  const childUsers = users.filter((u) => u.role === 'child');

  return (
    <main className="min-h-screen bg-slate-900 p-3 md:p-4">
      {/* Clock */}
      <Clock />

      {/* User avatars — clickable to user page */}
      {displayUsers.length > 0 && (
        <div className="flex justify-center gap-3 mt-3 mb-4 flex-wrap">
          {displayUsers.map((user) => (
            <AvatarButton
              key={user.id}
              user={user}
              showPoints
              size="sm"
              onClick={() => router.push(`/user/${user.id}`)}
            />
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 max-w-7xl mx-auto">
        {/* Left column: Tasks */}
        <div className="lg:col-span-2 space-y-3">
          {/* Task columns for all users */}
          {!loading && (
            <TaskColumns
              users={childUsers.length > 0 ? childUsers : displayUsers}
              tasks={tasks}
              onComplete={handleTaskComplete}
              compact
            />
          )}
          {loading && (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-slate-800 rounded-2xl p-4 border border-slate-700 animate-pulse h-48" />
              ))}
            </div>
          )}

          {/* Calendar */}
          <CalendarWidget
            events={calendar.events}
            fetched_at={calendar.fetched_at}
            loading={loading}
          />
        </div>

        {/* Right column: Widgets */}
        <div className="space-y-3">
          {/* Weather */}
          <WeatherWidget
            data={weather.data}
            fetched_at={weather.fetched_at}
            loading={loading}
          />

          {/* Meals */}
          <MealsWidget
            days={meals.days}
            fetched_at={meals.fetched_at}
            loading={loading}
          />

          {/* Immich */}
          <ImmichWidget
            data={immich.data}
            fetched_at={immich.fetched_at}
            loading={loading}
            onRefresh={handleImmichRefresh}
            apiBase={API_BASE}
          />
        </div>
      </div>

      {/* Gear button (long-press for admin) */}
      <div className="fixed bottom-4 right-4">
        <button
          onMouseDown={handleGearPressStart}
          onMouseUp={handleGearPressEnd}
          onMouseLeave={handleGearPressEnd}
          onTouchStart={handleGearPressStart}
          onTouchEnd={handleGearPressEnd}
          className="
            w-12 h-12 rounded-full bg-slate-800 border border-slate-700
            flex items-center justify-center text-slate-500
            hover:text-slate-300 hover:border-slate-500 transition-all
            active:scale-95 select-none
          "
          title="Lange drücken für Admin"
        >
          ⚙️
        </button>
      </div>
    </main>
  );
}
