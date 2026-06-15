'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSSE } from '@/hooks/useSSE';
import { useIdleTimer } from '@/hooks/useIdleTimer';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string; name: string; avatar: string; photo?: string;
  color: string; points: number; role: string;
  tasks_total?: number; tasks_done?: number;
}

interface TaskInstance {
  id: string; title: string; points: number;
  assigned_to: string; completed_at: string | null; due_time?: string | null;
  requires_approval: boolean; approved_at: string | null;
}

interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}

interface Reward {
  id: string; title: string; points_cost: number;
  /** Vom Backend pro Nutzer berechnet: points_cost × Altersfaktor. */
  effective_cost?: number;
  /** Verwendeter Multiplikator (0.6 / 1.0 / 1.6 / 2.0 …). */
  age_factor?: number;
  available_to: string | null; active: boolean;
}

interface UserClaim {
  id: string;
  reward_id: string;
  reward_title: string;
  points_cost: number;
  claimed_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
}

// Lokales Datum als YYYY-MM-DD ohne UTC-Verschiebung
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  return new Date(event.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const tom = new Date(now); tom.setDate(now.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tom);
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** WeekStreak — 7 Kreise Mo–So, gefüllt wenn Aufgaben erledigt */
function WeekStreak({ color, tasksDone, tasksTotal }: { color: string; tasksDone: number; tasksTotal: number }) {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const today = new Date().getDay(); // 0=So, 1=Mo ...
  const todayIdx = today === 0 ? 6 : today - 1;
  const allDone = tasksTotal > 0 && tasksDone >= tasksTotal;

  return (
    <div className="flex gap-1.5 justify-between">
      {days.map((d, i) => {
        const isPast = i < todayIdx;
        const isToday = i === todayIdx;
        return (
          <div key={d} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-lg flex items-center justify-center text-[10px] font-bold"
              style={{
                height: 28,
                background: isToday && allDone ? color
                  : isToday ? `${color}30`
                  : isPast ? '#e8e4de'
                  : '#f0ede8',
                color: isToday && allDone ? '#fff'
                  : isToday ? color
                  : '#a09d99',
                border: isToday ? `1.5px solid ${color}` : 'none',
              }}
            >
              {isToday && allDone ? '✓' : d}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function UserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<UserClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ text: string; ok: boolean } | null>(null);
  const [idleCountdown, setIdleCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setIdleCountdown(5);
    countdownRef.current = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Navigate home when idle timer fires (25s quiet → 5s countdown → home)
  useIdleTimer(() => {
    startCountdown();
    setTimeout(() => router.push('/'), 5000);
  }, 25_000);

  const showNotification = (text: string, ok = true) => {
    setNotification({ text, ok });
    setTimeout(() => setNotification(null), 2500);
  };

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [ur, tr, cr, rr, clr] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users/${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/rewards?user_id=${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/api/rewards/claims?user_id=${userId}`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && ur.value.id) setUser(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value))
        setTasks(tr.value.filter((t: TaskInstance) => t.assigned_to === userId));
      if (cr.status === 'fulfilled' && cr.value.events)
        setEvents(cr.value.events);
      if (rr.status === 'fulfilled' && Array.isArray(rr.value))
        setRewards(rr.value);
      if (clr.status === 'fulfilled' && Array.isArray(clr.value))
        setClaims(clr.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/api/tasks/today`).then(r => r.json());
    if (Array.isArray(res)) {
      setTasks(res.filter((t: TaskInstance) => t.assigned_to === userId));
    }
  }, [userId]);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/api/users/${userId}`).then(r => r.json());
    if (res.id) setUser(res);
  }, [userId]);

  const fetchRewards = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/api/rewards?user_id=${userId}`).then(r => r.json());
    if (Array.isArray(res)) setRewards(res);
  }, [userId]);

  const fetchClaims = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/api/rewards/claims?user_id=${userId}`).then(r => r.json());
    if (Array.isArray(res)) setClaims(res);
  }, [userId]);

  useSSE({
    task_updated: fetchTasks,
    points_updated: fetchUser,
    reward_claimed: () => { fetchRewards(); fetchClaims(); fetchUser(); },
    task_uncompleted: (event) => {
      // Nur Notification zeigen wenn dieses Kind betroffen ist
      if (event.data.user_id === userId) {
        const title = event.data.task_title as string;
        showNotification(`„${title}" wurde zurückgesetzt`, false);
      }
      fetchTasks();
      fetchUser();
    },
  });

  const handleComplete = async (taskId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.pending_approval) {
        // Optimistisch: mark as completed but not approved
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t
        ));
        showNotification('Erledigt! Wartet auf Bestätigung.');
      } else {
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t
        ));
        showNotification(`+${data.points_earned} Punkte verdient!`);
      }
    }
  };

  const handleClaim = async (rewardId: string) => {
    const res = await fetch(`${API_BASE}/api/rewards/${rewardId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotification(`Beantragt! −${data.points_spent} Punkte`);
      // SSE triggert reward_claimed → fetchRewards + fetchClaims + fetchUser
    } else {
      showNotification(data.error ?? 'Fehler', false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="text-sm font-sans" style={{ color: '#a09d99' }}>Lade...</div>
    </div>
  );

  if (!user) return (
    <div className="p-8 flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
      <p className="font-sans" style={{ color: '#a09d99' }}>Nutzer nicht gefunden</p>
      <button onClick={() => router.back()} className="text-sm font-sans px-4 py-2 rounded-xl" style={{ background: '#f0ede8', color: '#6b6760' }}>Zurück</button>
    </div>
  );

  // ── Task buckets ──
  // open:           no completed_at
  // pendingApproval: completed_at set, requires_approval=true, no approved_at
  // done:           completed_at set, and (no requires_approval OR approved_at set)
  const openTasks       = tasks.filter(t => !t.completed_at);
  const pendingApproval = tasks.filter(t => t.completed_at && t.requires_approval && !t.approved_at);
  const doneTasks       = tasks.filter(t => t.completed_at && (!t.requires_approval || t.approved_at));

  const pct = tasks.length ? Math.round((doneTasks.length + pendingApproval.length) / tasks.length * 100) : 0;

  // ── Claim buckets ──
  const todayStr = toLocalDateStr(new Date());
  const pendingClaims  = claims.filter(c => !c.approved_at && !c.rejected_at);
  const rejectedToday  = claims.filter(c => c.rejected_at && c.rejected_at.startsWith(todayStr));

  // ── Rewards split ──
  // Only show rewards that have no active pending claim (prevent double-claiming)
  const pendingClaimRewardIds = new Set(pendingClaims.map(c => c.reward_id));
  const affordable   = rewards.filter(r => (r.effective_cost ?? r.points_cost) <= user.points && !pendingClaimRewardIds.has(r.id));
  const unaffordable = rewards.filter(r => (r.effective_cost ?? r.points_cost) > user.points && !pendingClaimRewardIds.has(r.id));

  // ── Calendar events ──
  const SHARED_CALENDARS = ['familie', 'family'];
  const now = new Date();
  const tom = new Date(now); tom.setDate(now.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tom);

  const userEvents = events
    .filter(e => {
      const cal = e.calendarName?.toLowerCase() ?? '';
      const name = user.name.toLowerCase();
      const isOwn = cal.includes(name) || name.includes(cal);
      const isShared = SHARED_CALENDARS.some(s => cal.includes(s));
      return isOwn || isShared;
    })
    .filter(e => {
      const d = e.start.split('T')[0];
      if (d < todayStr || d > tomorrowStr) return false;
      if (d === todayStr && !e.allDay && new Date(e.start) < now) return false;
      return true;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const eventsByDate = userEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const d = ev.start.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(ev);
    return acc;
  }, {});

  return (
    <div className="p-4" style={{ minHeight: '100vh', background: '#f5f2ee' }}>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-6 py-3 text-sm font-sans font-semibold text-white shadow-xl"
          style={{ background: notification.ok ? '#5cb85c' : '#e85d3a' }}>
          {notification.text}
        </div>
      )}

      {/* Idle countdown banner */}
      {idleCountdown !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-6 py-3 text-sm font-sans font-semibold text-white shadow-xl flex items-center gap-3"
          style={{ background: 'rgba(26,24,20,0.85)', backdropFilter: 'blur(8px)' }}>
          <span>Zurück zur Startseite in {idleCountdown}s</span>
          <button
            onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); setIdleCountdown(null); }}
            className="rounded-lg px-3 py-1 text-xs font-sans"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            Bleiben
          </button>
        </div>
      )}

      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-sans mb-3 transition-opacity hover:opacity-70" style={{ color: '#a09d99' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 16 }} /> Zurück
      </button>

      {/* Profile hero */}
      <div className="rounded-2xl p-5 mb-4 flex items-center gap-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div className="relative flex-shrink-0">
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="rounded-full object-cover block" style={{ width: 72, height: 72, border: `3px solid ${user.color}` }} />
          ) : (
            <div className="rounded-full flex items-center justify-center text-4xl" style={{ width: 72, height: 72, background: `${user.color}18`, border: `3px solid ${user.color}` }}>
              {user.avatar}
            </div>
          )}
          {/* SVG progress ring */}
          <svg width="84" height="84" viewBox="0 0 84 84" className="absolute" style={{ top: -6, left: -6, pointerEvents: 'none', transform: 'rotate(-90deg)' }}>
            <circle cx="42" cy="42" r="39" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
            <circle cx="42" cy="42" r="39" fill="none" stroke={user.color} strokeWidth="3"
              strokeDasharray={`${(pct / 100) * 2 * Math.PI * 39} ${2 * Math.PI * 39}`}
              strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>{user.name}</h1>
          <span className="inline-block text-xs font-sans font-medium rounded-full px-2.5 py-0.5 mt-1" style={{ background: 'rgba(0,0,0,0.05)', color: '#6b6760' }}>
            {user.role === 'parent' ? 'Elternteil' : 'Kind'}
          </span>
          <div className="flex items-center gap-3 mt-3">
            <div className="rounded-xl px-3 py-1.5 text-sm font-sans font-semibold flex items-center gap-1.5" style={{ background: `${user.color}18`, color: user.color }}>
              <i className="ti ti-star-filled" style={{ fontSize: 12, color: '#c9a020' }} aria-hidden="true" /> {user.points} Punkte
            </div>
            <div className="text-sm font-sans" style={{ color: '#a09d99' }}>
              {doneTasks.length}/{tasks.length} erledigt · {pct}%
            </div>
          </div>
          {tasks.length > 0 && (
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: user.color }} />
            </div>
          )}
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 14, alignItems: 'start' }}>

        {/* LEFT — Aufgaben + Kalender */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Aufgaben */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-checks" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Aufgaben heute ({tasks.length})
            </p>

            {tasks.length === 0 && (
              <div className="text-center py-8 rounded-xl" style={{ background: '#f7f4f0' }}>
                <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Aufgaben heute 🎉</p>
              </div>
            )}

            <div className="space-y-2">
              {/* Open tasks — interactable */}
              {openTasks.map(t => (
                <button key={t.id} onClick={() => handleComplete(t.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98]"
                  style={{ background: '#f7f4f0', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                  <div className="w-6 h-6 rounded-full border-2 flex-shrink-0" style={{ borderColor: user.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-sans font-medium line-clamp-2" style={{ color: '#1a1814' }}>{t.title}</p>
                      {t.requires_approval && (
                        <i className="ti ti-eye" style={{ fontSize: 13, color: '#a09d99', flexShrink: 0 }} title="Wird geprüft" />
                      )}
                    </div>
                    {t.due_time && (
                      <p className="text-xs font-sans mt-0.5" style={{ color: '#a09d99' }}>{t.due_time} Uhr</p>
                    )}
                  </div>
                  <span className="text-xs font-sans font-semibold flex items-center gap-1 flex-shrink-0" style={{ color: user.color }}>
                    <i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} /> +{t.points}
                  </span>
                </button>
              ))}

              {/* Pending approval tasks — yellow state, not clickable */}
              {pendingApproval.map(t => (
                <div key={t.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: '#fffbeb', border: '0.5px solid #fbbf2440' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}>
                    <i className="ti ti-clock" style={{ fontSize: 12, color: '#f59e0b' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium line-clamp-2" style={{ color: '#1a1814' }}>{t.title}</p>
                    <p className="text-xs font-sans mt-0.5" style={{ color: '#f59e0b' }}>Wartet auf Bestätigung</p>
                  </div>
                  <span className="text-xs font-sans font-semibold flex items-center gap-1 flex-shrink-0" style={{ color: '#f59e0b' }}>
                    <i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} /> +{t.points}
                  </span>
                </div>
              ))}

              {/* Done tasks */}
              {doneTasks.map(t => (
                <div key={t.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 opacity-60"
                  style={{ background: '#f0fdf4', border: '0.5px solid #86efac40' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                    <i className="ti ti-check" style={{ fontSize: 14, color: '#16a34a' }} />
                  </div>
                  <p className="flex-1 text-sm font-sans line-clamp-1 line-through" style={{ color: '#6b6760' }}>{t.title}</p>
                  <span className="text-xs font-sans font-semibold flex items-center gap-1 flex-shrink-0" style={{ color: '#16a34a' }}>
                    <i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} /> +{t.points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Kalender */}
          {Object.keys(eventsByDate).length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
                <i className="ti ti-calendar" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
                Termine
              </p>
              <div className="space-y-4">
                {Object.entries(eventsByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, evs]) => (
                  <div key={date}>
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#c09d99' }}>
                      {formatDateLabel(date)}
                    </p>
                    <div className="space-y-1.5">
                      {evs.map(ev => (
                        <div key={ev.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                          style={{ background: `${ev.color ?? '#6366f1'}12`, borderLeft: `3px solid ${ev.color ?? '#6366f1'}` }}>
                          <span className="text-xs font-sans font-medium flex-shrink-0" style={{ color: ev.color ?? '#6366f1', minWidth: 48 }}>
                            {formatEventTime(ev)}
                          </span>
                          <p className="text-sm font-sans font-medium line-clamp-1" style={{ color: '#1a1814' }}>{ev.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Punkte, Streak, Belohnungen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Points summary */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#a09d99' }}>
              <i className="ti ti-star-filled" style={{ fontSize: 13, color: '#c9a020', verticalAlign: -1, marginRight: 4 }} />
              Punkte
            </p>
            <p className="text-4xl font-[Georgia]" style={{ color: user.color }}>{user.points}</p>
            <p className="text-xs font-sans mt-1" style={{ color: '#a09d99' }}>
              {openTasks.length > 0 ? (
                <>Noch {openTasks.reduce((s, t) => s + t.points, 0)} Punkte heute möglich</>
              ) : tasks.length > 0 ? (
                <>Alle Aufgaben erledigt!</>
              ) : null}
            </p>
          </div>

          {/* Streak */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-flame" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Diese Woche
            </p>
            <WeekStreak color={user.color} tasksDone={doneTasks.length} tasksTotal={tasks.length} />
          </div>

          {/* Belohnungen */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-gift" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Belohnungen
            </p>

            {rewards.length === 0 && pendingClaims.length === 0 && (
              <div className="text-center py-8 rounded-xl" style={{ background: '#f7f4f0' }}>
                <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Belohnungen verfügbar</p>
              </div>
            )}

            <div className="space-y-2">
              {/* Rejected today — show briefly so child knows */}
              {rejectedToday.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: '#fff1f1', border: '0.5px solid #fca5a540' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fee2e2' }}>
                    <i className="ti ti-x" style={{ fontSize: 18, color: '#dc2626' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium line-clamp-1" style={{ color: '#7f1d1d' }}>{c.reward_title}</p>
                    <p className="text-xs font-sans mt-0.5" style={{ color: '#ef4444' }}>
                      Abgelehnt · {c.points_cost} Pkt. zurückgebucht
                    </p>
                  </div>
                </div>
              ))}

              {/* Pending claims — waiting for parent */}
              {pendingClaims.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: '#fffbeb', border: '0.5px solid #fbbf2440' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
                    <i className="ti ti-clock" style={{ fontSize: 18, color: '#f59e0b' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium line-clamp-1" style={{ color: '#1a1814' }}>{c.reward_title}</p>
                    <p className="text-xs font-sans mt-0.5" style={{ color: '#f59e0b' }}>Wartet auf Eltern · {c.points_cost} Pkt.</p>
                  </div>
                </div>
              ))}

              {/* Affordable rewards */}
              {affordable.map(r => (
                <button key={r.id} onClick={() => handleClaim(r.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98]"
                  style={{ background: '#f2fbf2', border: '0.5px solid #5cb85c30' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                    <i className="ti ti-gift" style={{ fontSize: 20, color: '#16a34a' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium truncate" style={{ color: '#1a1814' }}>{r.title}</p>
                    <p className="text-xs font-sans mt-0.5 flex items-center gap-1" style={{ color: '#5cb85c' }}>
                      <i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} aria-hidden="true" /> {r.effective_cost ?? r.points_cost} Punkte · du hast genug!
                    </p>
                  </div>
                  <span className="text-xs font-sans rounded-full px-3 py-1 font-medium flex-shrink-0" style={{ background: '#bbf7d0', color: '#15803d' }}>Einlösen</span>
                </button>
              ))}

              {/* Unaffordable rewards */}
              {unaffordable.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: '#f7f4f0', border: '0.5px solid rgba(0,0,0,0.07)', opacity: 0.6 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0ede8' }}>
                    <i className="ti ti-lock" style={{ fontSize: 18, color: '#a09d99' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium truncate" style={{ color: '#1a1814' }}>{r.title}</p>
                    <p className="text-xs font-sans mt-0.5" style={{ color: '#a09d99' }}>
                      Noch {(r.effective_cost ?? r.points_cost) - user.points} Punkte fehlen
                    </p>
                  </div>
                  <span className="text-xs font-sans font-semibold flex-shrink-0 flex items-center gap-1" style={{ color: '#a09d99' }}>
                    <i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} /> {r.effective_cost ?? r.points_cost}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
