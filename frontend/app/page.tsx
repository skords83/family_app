'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/hooks/useSSE';
import type { SSEEvent } from '@/hooks/useSSE';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import MealsWidget from '@/components/widgets/MealsWidget';
import WasteWidget from '@/components/widgets/WasteWidget';
import BirthdayWidget from '@/components/widgets/BirthdayWidget';
import PageHeader from '@/components/ui/PageHeader';
import { ApplianceToastContainer, type ApplianceNotification } from '@/components/ui/ApplianceToast';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User { id: string; name: string; avatar: string; photo?: string; color: string; points: number; role: string; tasks_total?: number; tasks_done?: number; }
interface TaskInstance { id: string; title: string; points: number; assigned_to: string; completed_at: string | null; due_time?: string | null; available_from?: string | null; }
interface CalendarEvent { id: string; title: string; start: string; end: string; allDay: boolean; color?: string; calendarName?: string; }
type WasteType = 'bioabfall' | 'restmuell' | 'papier' | 'wertstoff';
interface WasteTodayData { active: boolean; events: { id: string; source: string; type: WasteType; date: string; title: string; fetched_at: string; }[]; next: { id: string; source: string; type: WasteType; date: string; title: string; fetched_at: string; } | null; fetched_at: string; }
interface BirthdaysData {
  today: { name: string; age: number | null } | null;
  upcoming: { name: string; age: number | null; daysUntil: number }[];
  fetched_at: string;
}

const PASTELS: Record<string, string> = {
  '#e85d3a':'#fff5f3','#4a9eed':'#f0f7ff','#5cb85c':'#f2fbf2',
  '#9b59b6':'#f8f2fd','#f0a500':'#fffbf0','#00bcd4':'#f0fbfd',
  '#f59e0b':'#fffbeb','#3b82f6':'#eff6ff','#10b981':'#f0fdf4',
  '#ec4899':'#fdf2f8','#6366f1':'#eef2ff',
};

const MAX_VISIBLE_TASKS = 5;

// Avatar mit Fortschritts-Ring — das einzige Fortschritts-Signal pro Person
function AvatarRing({ user, pct, size = 56 }: { user: User; pct: number; size?: number }) {
  const stroke = 4;
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

/** Current Berlin time as "HH:MM" string. */
function nowHHMM(): string {
  return new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin', hour12: false,
  });
}

export default function HomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [calendar, setCalendar] = useState<{ events?: CalendarEvent[]; fetched_at?: string }>({});
  const [meals, setMeals] = useState<{ byDate?: Record<string, any>; fetched_at?: string }>({});
  const [waste, setWaste] = useState<WasteTodayData | undefined>();
  const [birthdays, setBirthdays] = useState<BirthdaysData | undefined>();
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(nowHHMM);
  const [applianceToasts, setApplianceToasts] = useState<ApplianceNotification[]>([]);
  const toastIdRef = useRef(0);

  const fetchAll = useCallback(async () => {
    try {
      const [ur, tr, cr, mr, wasteR, birthdaysR] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals?range=month`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/waste/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/birthdays`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && Array.isArray(ur.value)) setUsers(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTasks(tr.value);
      if (cr.status === 'fulfilled' && cr.value?.events) setCalendar({ events: cr.value.events, fetched_at: cr.value.fetched_at });
      if (mr.status === 'fulfilled' && mr.value?.byDate) setMeals({ byDate: mr.value.byDate, fetched_at: mr.value.fetched_at });
      if (wasteR.status === 'fulfilled' && wasteR.value?.fetched_at) setWaste(wasteR.value);
      if (birthdaysR.status === 'fulfilled' && birthdaysR.value?.fetched_at) setBirthdays(birthdaysR.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 5 * 60_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // Re-check available_from locks every 30s so cards unlock without a full reload
  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(nowHHMM()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/tasks/today`).then(r => r.json());
    if (Array.isArray(res)) setTasks(res);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/users`).then(r => r.json());
    if (Array.isArray(res)) setUsers(res);
  }, []);

  const handleConfigUpdated = useCallback(() => window.location.reload(), []);

  const handleApplianceDone = useCallback((event: SSEEvent) => {
    const appliance = event.data?.appliance as 'washer' | 'dryer' | undefined;
    if (appliance !== 'washer' && appliance !== 'dryer') return;
    const id = ++toastIdRef.current;
    setApplianceToasts(prev => [...prev, { id, appliance }]);
  }, []);

  const dismissApplianceToast = useCallback((id: number) => {
    setApplianceToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleNfcScan = useCallback((event: SSEEvent) => {
    const scannedUser = event.data?.user as { id?: string; role?: string } | undefined;
    const userId = scannedUser?.id;
    if (userId) {
      const key = scannedUser?.role === 'parent' ? 'parent' : String(userId);
      sessionStorage.setItem('nfc_unlocked_for', key);
      router.push(`/user/${userId}`);
    }
  }, [router]);

  useSSE({
    task_updated: fetchTasks,
    points_updated: fetchUsers,
    reward_claimed: fetchUsers,
    config_updated: handleConfigUpdated,
    nfc_scan: handleNfcScan,
    appliance_done: handleApplianceDone,
  });

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <ApplianceToastContainer notifications={applianceToasts} onDismiss={dismissApplianceToast} />
      <PageHeader variant="home" />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '440px 1fr',
          gap: 16,
          padding: '0 24px 24px',
          overflow: 'hidden',
        }}
      >

        {/* ── LINKS: HEUTE (Kalender + Essensplan + Müll) ── */}
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BirthdayWidget data={birthdays} loading={loading} />
          <CalendarWidget
            events={calendar.events}
            fetched_at={calendar.fetched_at}
            loading={loading}
            daysAhead={1}
          />
          <div style={{ flexShrink: 0 }}>
            <MealsWidget byDate={meals.byDate} fetched_at={meals.fetched_at} loading={loading} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <WasteWidget data={waste} fetched_at={waste?.fetched_at} loading={loading} />
          </div>
        </div>

        {/* ── RECHTS: FAMILIE (3×2-Raster) ── */}
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!loading && users.length > 0 && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gridAutoRows: '1fr',
                gap: 14,
              }}
            >
              {users.map(user => {
                const userTasks = tasks.filter(t => t.assigned_to === user.id);
                const done = userTasks.filter(t => t.completed_at);
                const pending = userTasks.filter(t => !t.completed_at);
                // Split pending into unlocked, locked, and expired
                const expired = pending.filter(t => !!t.due_time && currentTime > t.due_time);
                const active = pending.filter(t => !t.due_time || currentTime <= t.due_time);
                const unlocked = active.filter(t => !t.available_from || currentTime >= t.available_from);
                const locked = active.filter(t => !!t.available_from && currentTime < t.available_from);
                // Expired tasks are hidden — only show what's still doable
                const sortedPending = [...unlocked, ...locked];
                const visibleTotal = active.length + done.length;
                const pct = visibleTotal ? Math.round(done.length / visibleTotal * 100) : 0;
                const bg = PASTELS[user.color] ?? `${user.color}18`;
                const allDone = userTasks.length > 0 && active.length === 0;
                const hint = allDone || userTasks.length === 0 ? 'Aufgaben ansehen' : 'Aufgaben abhaken';

                return (
                  <Link
                    key={user.id}
                    href={`/user/${user.id}`}
                    className="rounded-2xl p-4 flex flex-col active:opacity-75 transition-opacity"
                    style={{ background: bg, border: '0.5px solid var(--family-border)', minHeight: 0 }}
                  >
                    {/* Kopf: Ring-Avatar + Name + Punkte */}
                    <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                      <AvatarRing user={user} pct={pct} />
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-sans font-medium truncate"
                          style={{ fontSize: 16, color: '#1a1814', lineHeight: 1.2 }}
                        >
                          {user.name}
                        </div>
                        <div className="font-sans" style={{ fontSize: 12, color: '#a09d99' }}>
                          {visibleTotal > 0 && `${done.length}/${visibleTotal} · `}{user.points} Pkt.
                        </div>
                      </div>
                    </div>

                    {/* Offene Aufgaben — reine Liste, kein Abhaken hier */}
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ gap: 3 }}>
                      {userTasks.length === 0 && (
                        <p className="font-sans" style={{ fontSize: 13, color: '#a09d99' }}>
                          Keine Aufgaben heute
                        </p>
                      )}

                      {allDone && (
                        <div className="flex items-center gap-2 py-1">
                          <i
                            className="ti ti-circle-check"
                            style={{ fontSize: 20, color: user.color }}
                            aria-hidden="true"
                          />
                          <span className="font-sans font-medium" style={{ fontSize: 14, color: user.color }}>
                            Alles erledigt!
                          </span>
                        </div>
                      )}

                      {sortedPending.slice(0, MAX_VISIBLE_TASKS).map(task => {
                        const isLocked = !!task.available_from && currentTime < task.available_from;
                        return (
                          <div key={task.id} className="flex items-center gap-2.5 py-1" style={{ opacity: isLocked ? 0.4 : 1 }}>
                            {isLocked ? (
                              <i
                                className="ti ti-lock"
                                style={{ fontSize: 12, color: '#a09d99', flexShrink: 0, width: 4, marginLeft: 0 }}
                                aria-hidden="true"
                              />
                            ) : (
                              <span
                                style={{ width: 4, height: 20, borderRadius: 2, background: user.color, flexShrink: 0 }}
                              />
                            )}
                            <span
                              className="font-sans flex-1 truncate"
                              style={{ fontSize: 14, color: isLocked ? '#a09d99' : '#1a1814' }}
                            >
                              {task.title}
                              {isLocked && (
                                <span className="font-sans ml-1.5" style={{ fontSize: 11, color: '#c0bcb8' }}>
                                  ab {task.available_from}
                                </span>
                              )}
                            </span>
                            <span
                              className="font-sans flex-shrink-0 flex items-center gap-0.5"
                              style={{ fontSize: 12, color: '#a09d99' }}
                            >
                              <i className="ti ti-star" style={{ fontSize: 10, color: isLocked ? '#d8d4ce' : '#c9a020' }} aria-hidden="true" />
                              {task.points}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Fuß: links Überhang, rechts Hinweis auf Kind-Modus — eine Zeile, kein Überlapp */}
                    <div
                      className="flex items-center justify-between gap-2 mt-2 flex-shrink-0"
                      style={{ fontSize: 12, color: '#a09d99' }}
                    >
                      <span className="font-sans truncate">
                        {sortedPending.length > MAX_VISIBLE_TASKS ? `+ ${sortedPending.length - MAX_VISIBLE_TASKS} weitere` : ''}
                      </span>
                      <span className="font-sans flex items-center gap-1 flex-shrink-0">
                        {hint}
                        <i className="ti ti-chevron-right" style={{ fontSize: 13 }} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {loading && (
            <div
              className="grid gap-3.5 flex-1"
              style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: '1fr' }}
            >
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="rounded-2xl animate-pulse" style={{ background: '#e8e4de' }} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}