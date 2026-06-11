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
}
interface CalendarEvent {
  id: string; title: string; start: string; end: string;
  allDay: boolean; color?: string; calendarName?: string;
}
interface Reward {
  id: string; title: string; points_cost: number;
  available_to: string | null; active: boolean;
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

export default function UserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [activeDays, setActiveDays] = useState<boolean[]>([false, false, false, false, false, false, false]);
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

  const fetchWeekActivity = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/week-activity/${userId}`).then(r => r.json());
      if (Array.isArray(res.activeDays)) setActiveDays(res.activeDays);
    } catch (e) { console.error(e); }
  }, [userId]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [ur, tr, cr, rr, wr] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users/${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/rewards?user_id=${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/week-activity/${userId}`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && ur.value.id) setUser(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value))
        setTasks(tr.value.filter((t: TaskInstance) => t.assigned_to === userId));
      if (cr.status === 'fulfilled' && cr.value.events)
        setEvents(cr.value.events);
      if (rr.status === 'fulfilled' && Array.isArray(rr.value))
        setRewards(rr.value);
      if (wr.status === 'fulfilled' && Array.isArray(wr.value.activeDays))
        setActiveDays(wr.value.activeDays);
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
    // Auch Wochenaktivität aktualisieren, da eine Task gerade erledigt wurde
    fetchWeekActivity();
  }, [userId, fetchWeekActivity]);

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

  useSSE({
    task_updated: fetchTasks,
    points_updated: fetchUser,
    reward_claimed: fetchRewards,
  });

  const handleComplete = async (taskId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      const data = await res.json();
      // Optimistisches Update — SSE aktualisiert tasks + user im Hintergrund
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
      showNotification(`+${data.points_earned} Punkte verdient!`);
    }
  };

  const handleClaim = async (rewardId: string) => {
    const res = await fetch(`${API_BASE}/api/rewards/${rewardId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (res.ok) showNotification(`Beantragt! -${data.points_spent} Punkte`);
    else showNotification(data.error ?? 'Fehler', false);
    // SSE triggert reward_claimed + points_updated → fetchRewards + fetchUser
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

  const pending = tasks.filter(t => !t.completed_at);
  const done = tasks.filter(t => t.completed_at);
  const pct = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;

  // Filter calendar events: user's own calendar + shared "Familie" calendar
  // Nur heute & morgen — mit lokalem Datum (kein UTC-Offset-Bug)
  const SHARED_CALENDARS = ['familie', 'family'];
  const now = new Date();
  const todayStr = toLocalDateStr(now);
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
      // Vergangene Termine heute ausblenden (Ganztags immer zeigen)
      if (d === todayStr && !e.allDay && new Date(e.start) < now) return false;
      return true;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Group by date
  const eventsByDate = userEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const d = ev.start.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(ev);
    return acc;
  }, {});

  const affordable = rewards.filter(r => r.points_cost <= user.points);
  const unaffordable = rewards.filter(r => r.points_cost > user.points);

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

      {/* Profile hero — full width */}
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
              {done.length}/{tasks.length} erledigt · {pct}%
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
            {pending.length === 0 && done.length === 0 && (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">🎉</div>
                <p className="font-sans text-sm" style={{ color: '#a09d99' }}>Keine Aufgaben für heute!</p>
              </div>
            )}
            {pending.length === 0 && done.length > 0 && (
              <div className="text-center py-6 rounded-xl mb-3" style={{ background: '#f2fbf2' }}>
                <div className="text-3xl mb-1">🏆</div>
                <p className="font-sans font-semibold text-sm" style={{ color: '#5cb85c' }}>Alle Aufgaben erledigt!</p>
              </div>
            )}
            <div className="space-y-2">
              {pending.map(task => (
                <button key={task.id} onClick={() => handleComplete(task.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98]"
                  style={{ background: `${user.color}10`, border: `0.5px solid ${user.color}30` }}>
                  <div className="w-6 h-6 rounded-full border-2 flex-shrink-0" style={{ borderColor: user.color }} />
                  <span className="flex-1 text-sm font-sans font-medium" style={{ color: '#1a1814' }}>{task.title}</span>
                  {task.due_time && <span className="text-xs font-sans" style={{ color: '#a09d99' }}>{task.due_time}</span>}
                  <span className="text-xs font-sans rounded-full px-2.5 py-0.5 flex items-center gap-1 flex-shrink-0" style={{ background: `${user.color}18`, color: user.color }}>+{task.points}<i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} aria-hidden="true" /></span>
                </button>
              ))}
              {done.length > 0 && (
                <>
                  {pending.length > 0 && <div style={{ height: 4 }} />}
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>Erledigt</p>
                  {done.map(task => (
                    <div key={task.id} className="flex items-center gap-3 rounded-xl px-4 py-3 opacity-50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: user.color }}>
                        <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} />
                      </div>
                      <span className="flex-1 text-sm font-sans line-through" style={{ color: '#6b6760' }}>{task.title}</span>
                      <span className="text-xs font-sans flex items-center gap-1" style={{ color: '#a09d99' }}>+{task.points}<i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} aria-hidden="true" /></span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Kalender */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-calendar" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Heute &amp; morgen
            </p>
            {userEvents.length === 0 ? (
              <div className="text-center py-8 rounded-xl" style={{ background: '#f7f4f0' }}>
                <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Termine</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(eventsByDate).map(([date, dayEvs]) => (
                  <div key={date}>
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-2" style={{ color: '#a09d99' }}>
                      {formatDateLabel(date)}
                    </p>
                    <div className="space-y-1.5">
                      {dayEvs.map(ev => (
                        <div key={ev.id} className="flex items-start gap-3 px-4 py-3"
                          style={{ background: '#f7f4f0', borderLeft: `3px solid ${ev.color ?? user.color}`, borderRadius: '0 10px 10px 0' }}>
                          <span className="text-xs font-sans flex-shrink-0 mt-0.5" style={{ color: '#a09d99', minWidth: 52 }}>
                            {formatEventTime(ev)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-sans font-semibold leading-tight line-clamp-2" style={{ color: '#1a1814' }}>{ev.title}</p>
                            {ev.calendarName && (
                              <p className="text-xs font-sans mt-0.5" style={{ color: ev.color ?? user.color, opacity: 0.8 }}>{ev.calendarName}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>{/* end LEFT */}

        {/* RIGHT — Punktestand + Streak + Belohnungen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Punktestand */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-star" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Punktestand
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <i className="ti ti-star-filled" style={{ fontSize: 22, color: '#c9a020' }} aria-hidden="true" />
              <span style={{ fontSize: 44, fontWeight: 500, color: user.color, lineHeight: 1 }}>{user.points}</span>
              <span className="text-sm font-sans" style={{ color: '#a09d99' }}>Punkte</span>
            </div>
            <p className="text-sm font-sans" style={{ color: '#a09d99', lineHeight: 1.6 }}>
              {done.length} von {tasks.length} Aufgaben erledigt
              {pending.length > 0 && (
                <><br />Noch {pending.reduce((s, t) => s + t.points, 0)} Punkte heute möglich</>
              )}
            </p>
          </div>

          {/* Streak */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-flame" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Diese Woche
            </p>
            <WeekStreak color={user.color} activeDays={activeDays} tasksDone={done.length} tasksTotal={tasks.length} />
          </div>

          {/* Belohnungen */}
          <div className="rounded-2xl p-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mb-3" style={{ color: '#a09d99' }}>
              <i className="ti ti-gift" style={{ fontSize: 13, verticalAlign: -1, marginRight: 4 }} />
              Belohnungen
            </p>
            {rewards.length === 0 && (
              <div className="text-center py-8 rounded-xl" style={{ background: '#f7f4f0' }}>
                <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Belohnungen verfügbar</p>
              </div>
            )}
            <div className="space-y-2">
              {affordable.map(r => (
                <button key={r.id} onClick={() => handleClaim(r.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98]"
                  style={{ background: '#f2fbf2', border: '0.5px solid #5cb85c30' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                    <i className="ti ti-gift" style={{ fontSize: 20, color: '#16a34a' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium truncate" style={{ color: '#1a1814' }}>{r.title}</p>
                    <p className="text-xs font-sans mt-0.5 flex items-center gap-1" style={{ color: '#5cb85c' }}><i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} aria-hidden="true" /> {r.points_cost} Punkte · du hast genug!</p>
                  </div>
                  <span className="text-xs font-sans rounded-full px-3 py-1 font-medium flex-shrink-0" style={{ background: '#bbf7d0', color: '#15803d' }}>Einlösen</span>
                </button>
              ))}
              {unaffordable.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: '#f7f4f0', border: '0.5px solid rgba(0,0,0,0.07)', opacity: 0.6 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0ede8' }}>
                    <i className="ti ti-lock" style={{ fontSize: 18, color: '#a09d99' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans truncate" style={{ color: '#6b6760' }}>{r.title}</p>
                    <p className="text-xs font-sans mt-0.5 flex items-center gap-1" style={{ color: '#a09d99' }}><i className="ti ti-star-filled" style={{ fontSize: 9, color: '#c9a020' }} aria-hidden="true" /> {r.points_cost} · noch {r.points_cost - user.points} fehlen</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>{/* end RIGHT */}

      </div>{/* end grid */}
    </div>
  );
}

function WeekStreak({
  color,
  activeDays,
  tasksDone,
  tasksTotal,
}: {
  color: string;
  activeDays: boolean[];   // [Mo, Di, Mi, Do, Fr, Sa, So] — echte DB-Daten
  tasksDone: number;
  tasksTotal: number;
}) {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const todayIdx = (new Date().getDay() + 6) % 7;

  // Anzahl aktiver Tage diese Woche (ohne heute, der noch offen ist)
  const activePastCount = activeDays.slice(0, todayIdx).filter(Boolean).length;
  // Heute gilt als aktiv wenn alle Tasks erledigt sind
  const todayComplete = tasksTotal > 0 && tasksDone === tasksTotal;
  const totalActiveCount = activePastCount + (todayComplete ? 1 : 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {days.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#a09d99' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {days.map((_, i) => {
          const isToday = i === todayIdx;
          const isPast = i < todayIdx;
          const isFuture = i > todayIdx;
          const wasActive = isPast && activeDays[i];
          const isActiveToday = isToday && todayComplete;

          return (
            <div key={i} style={{
              aspectRatio: '1',
              borderRadius: 6,
              background: (wasActive || isActiveToday)
                ? `${color}30`
                : isFuture ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.04)',
              border: isToday ? `1.5px solid ${color}` : '1.5px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isFuture ? 0.4 : 1,
            }}>
              {wasActive && <i className="ti ti-check" style={{ fontSize: 11, color }} />}
              {isActiveToday && <i className="ti ti-check" style={{ fontSize: 11, color }} />}
              {isPast && !wasActive && (
                <i className="ti ti-x" style={{ fontSize: 10, color: '#c9c5c0' }} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm font-sans mt-2" style={{ color: '#a09d99' }}>
        {totalActiveCount === 0
          ? 'Diese Woche noch keine Aufgaben erledigt'
          : `${totalActiveCount} ${totalActiveCount === 1 ? 'Tag' : 'Tage'} diese Woche aktiv`}
        {totalActiveCount >= 2 && <span style={{ color, fontWeight: 500 }}> · Streak!</span>}
      </p>
    </div>
  );
}