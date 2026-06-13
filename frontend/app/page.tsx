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
  const [waste, setWaste] = useState<WasteTodayData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [usersRes, tasksRes, widgetsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets`).then(r => r.json()),
      ]);
      if (Array.isArray(usersRes)) setUsers(usersRes);
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (widgetsRes) {
        if (widgetsRes.weather) setWeather(widgetsRes.weather);
        if (widgetsRes.calendar) setCalendar(widgetsRes.calendar);
        if (widgetsRes.meals) setMeals(widgetsRes.meals);
        if (widgetsRes.immich) setImmich(widgetsRes.immich);
        if (widgetsRes.waste) setWaste(widgetsRes.waste);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useSSE(`${API_BASE}/api/sse`, (event) => {
    if (event.type === 'task_updated' || event.type === 'points_updated') {
      fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setTasks(data);
      });
      fetch(`${API_BASE}/api/users`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setUsers(data);
      });
    }
    if (event.type === 'widget_updated') {
      fetch(`${API_BASE}/api/widgets`).then(r => r.json()).then(data => {
        if (data?.weather) setWeather(data.weather);
        if (data?.calendar) setCalendar(data.calendar);
        if (data?.meals) setMeals(data.meals);
        if (data?.immich) setImmich(data.immich);
        if (data?.waste) setWaste(data.waste);
      });
    }
  });

  const handleImmichRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/immich/refresh`).then(r => r.json());
      if (res.data) setImmich({ data: res.data, fetched_at: res.fetched_at });
    } catch (e) { console.error(e); }
  };

  return (
    // Outer wrapper: exakt 100vh, kein Scroll
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader variant="home" />

      {/* 3-Spalten-Grid, füllt den restlichen Platz */}
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

        {/* ── SPALTE 1: Kalender ── */}
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CalendarWidget
            events={calendar.events}
            fetched_at={calendar.fetched_at}
            loading={loading}
            daysAhead={1}
          />
        </div>

        {/* ── SPALTE 2: Aufgaben ── */}
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!loading && users.length > 0 && (
            <>
              <h2
                className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3 flex-shrink-0"
                style={{ color: '#7a7874' }}
              >
                Aufgaben heute
              </h2>

              {/* Task-Grid: 2 Spalten, scrollt intern wenn nötig */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  alignContent: 'start',
                  overflowY: 'auto',
                }}
              >
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
                      {/* User header: großer Avatar + Name/Punkte */}
                      <div className="flex items-center gap-3 mb-2">
                        {user.photo ? (
                          <img
                            src={user.photo}
                            alt={user.name}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: `2.5px solid ${user.color}`,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: `${user.color}22`,
                              border: `2.5px solid ${user.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {user.avatar}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-sans font-medium truncate"
                            style={{ fontSize: 13, color: '#1a1814', lineHeight: 1.2 }}
                          >
                            {user.name}
                          </div>
                          <div className="font-sans" style={{ fontSize: 10, color: '#a09d99' }}>
                            {done.length}/{userTasks.length}
                            {userTasks.length > 0 && ` · ${userTasks.reduce((s, t) => s + (t.completed_at ? t.points : 0), 0)} Pkt.`}
                          </div>
                        </div>
                      </div>

                      {/* Fortschrittsbalken */}
                      <div
                        style={{
                          width: '100%',
                          height: 3,
                          borderRadius: 2,
                          background: 'rgba(0,0,0,0.08)',
                          marginBottom: 8,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ height: '100%', width: `${pct}%`, background: user.color, borderRadius: 2 }} />
                      </div>

                      {/* Pending tasks (max 3) */}
                      <div className="space-y-1">
                        {pending.slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5"
                            style={{ background: `${user.color}10` }}
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                              style={{ borderColor: user.color }}
                            />
                            <span
                              className="text-xs font-sans flex-1 leading-tight line-clamp-1"
                              style={{ color: '#1a1814' }}
                            >
                              {task.title}
                            </span>
                            <span
                              className="text-[10px] font-sans flex-shrink-0 flex items-center gap-0.5"
                              style={{ color: '#a09d99' }}
                            >
                              <i className="ti ti-star-filled" style={{ fontSize: 8, color: '#c9a020' }} aria-hidden="true" />
                              {task.points}
                            </span>
                          </div>
                        ))}
                        {pending.length > 3 && (
                          <div className="px-2 py-0.5">
                            <span className="text-[10px] font-sans" style={{ color: '#a09d99' }}>
                              +{pending.length - 3} weitere
                            </span>
                          </div>
                        )}
                        {done.slice(0, 1).map(task => (
                          <div key={task.id} className="flex items-center gap-2 px-2 py-1 opacity-40">
                            <div
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center"
                              style={{ background: user.color }}
                            >
                              <i className="ti ti-check" style={{ fontSize: 8, color: '#fff' }} />
                            </div>
                            <span
                              className="text-xs font-sans line-through flex-1 leading-tight line-clamp-1"
                              style={{ color: '#6b6760' }}
                            >
                              {task.title}
                            </span>
                          </div>
                        ))}
                        {userTasks.length === 0 && (
                          <p className="text-xs font-sans text-center py-2" style={{ color: '#a09d99' }}>
                            Keine Aufgaben
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {loading && (
            <div className="flex flex-col gap-3 flex-1">
              <div className="h-3 w-24 rounded animate-pulse" style={{ background: '#e8e4de' }} />
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[0,1,2,3].map(i => (
                  <div key={i} className="rounded-2xl animate-pulse" style={{ background: '#e8e4de', height: 120 }} />
                ))}
              </div>
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
          <WasteWidget data={waste} fetched_at={waste?.fetched_at} loading={loading} />
          <ImmichWidget
            data={immich.data}
            fetched_at={immich.fetched_at}
            loading={loading}
            onRefresh={handleImmichRefresh}
            apiBase={API_BASE}
          />
        </div>

      </div>
    </div>
  );
}