'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

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

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Ganztags';
  return new Date(event.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dateStr === today.toISOString().split('T')[0]) return 'Heute';
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Morgen';
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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tasks' | 'calendar' | 'rewards'>('tasks');
  const [notification, setNotification] = useState<{ text: string; ok: boolean } | null>(null);

  const showNotification = (text: string, ok = true) => {
    setNotification({ text, ok });
    setTimeout(() => setNotification(null), 2500);
  };

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [ur, tr, cr, rr] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users/${userId}`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/rewards?user_id=${userId}`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && ur.value.id) setUser(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value))
        setTasks(tr.value.filter((t: TaskInstance) => t.assigned_to === userId));
      if (cr.status === 'fulfilled' && cr.value.events)
        setEvents(cr.value.events);
      if (rr.status === 'fulfilled' && Array.isArray(rr.value))
        setRewards(rr.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleComplete = async (taskId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
      showNotification(`+${data.points_earned} ⭐ verdient!`);
      const fresh = await fetch(`${API_BASE}/api/users/${userId}`).then(r => r.json());
      if (fresh.id) setUser(fresh);
    }
  };

  const handleClaim = async (rewardId: string) => {
    const res = await fetch(`${API_BASE}/api/rewards/${rewardId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (res.ok) { showNotification(`Beantragt! -${data.points_spent} ⭐`); fetchData(); }
    else showNotification(data.error ?? 'Fehler', false);
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
  const SHARED_CALENDARS = ['familie', 'family'];
  const today = new Date().toISOString().split('T')[0];
  const userEvents = events
    .filter(e => {
      const cal = e.calendarName?.toLowerCase() ?? '';
      const name = user.name.toLowerCase();
      const isOwn = cal.includes(name) || name.includes(cal);
      const isShared = SHARED_CALENDARS.some(s => cal.includes(s));
      return isOwn || isShared;
    })
    .filter(e => e.start.split('T')[0] >= today)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 10);

  // Group by date
  const eventsByDate = userEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const d = ev.start.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(ev);
    return acc;
  }, {});

  const affordable = rewards.filter(r => r.points_cost <= user.points);
  const unaffordable = rewards.filter(r => r.points_cost > user.points);

  const TABS = [
    { key: 'tasks',    label: `Aufgaben (${pending.length})` },
    { key: 'calendar', label: 'Kalender'                     },
    { key: 'rewards',  label: 'Belohnungen'                  },
  ] as const;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-6 py-3 text-sm font-sans font-semibold text-white shadow-xl"
          style={{ background: notification.ok ? '#5cb85c' : '#e85d3a' }}>
          {notification.text}
        </div>
      )}

      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-sans mb-6 transition-opacity hover:opacity-70" style={{ color: '#a09d99' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 16 }} /> Zurück
      </button>

      {/* Profile hero */}
      <div className="rounded-2xl p-6 mb-6 flex items-center gap-5" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
        {/* Avatar with progress ring */}
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
          <p className="text-sm font-sans mt-0.5" style={{ color: '#a09d99' }}>{user.role === 'parent' ? 'Elternteil' : 'Kind'}</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="rounded-xl px-3 py-1.5 text-sm font-sans font-semibold" style={{ background: `${user.color}18`, color: user.color }}>
              ⭐ {user.points} Punkte
            </div>
            <div className="text-sm font-sans" style={{ color: '#a09d99' }}>
              {done.length}/{tasks.length} erledigt · {pct}%
            </div>
          </div>
          {/* Progress bar */}
          {tasks.length > 0 && (
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: user.color }} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 rounded-xl text-sm font-sans font-medium transition-all"
            style={{
              background: tab === t.key ? user.color : '#fff',
              color: tab === t.key ? '#fff' : '#6b6760',
              border: `0.5px solid ${tab === t.key ? user.color : 'rgba(0,0,0,0.1)'}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TASKS TAB */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {pending.length === 0 && done.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🎉</div>
              <p className="font-sans" style={{ color: '#a09d99' }}>Keine Aufgaben für heute!</p>
            </div>
          )}
          {pending.length === 0 && done.length > 0 && (
            <div className="text-center py-8 rounded-2xl" style={{ background: '#f2fbf2' }}>
              <div className="text-4xl mb-2">🏆</div>
              <p className="font-sans font-semibold" style={{ color: '#5cb85c' }}>Alle Aufgaben erledigt!</p>
            </div>
          )}
          {pending.map(task => (
            <button key={task.id} onClick={() => handleComplete(task.id)}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-95"
              style={{ background: `${user.color}12`, border: `0.5px solid ${user.color}25` }}>
              <div className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{ borderColor: user.color }} />
              <span className="flex-1 text-sm font-sans font-medium" style={{ color: '#1a1814' }}>{task.title}</span>
              {task.due_time && <span className="text-xs font-sans" style={{ color: '#a09d99' }}>{task.due_time}</span>}
              <span className="text-xs font-sans rounded-full px-2 py-0.5" style={{ background: `${user.color}18`, color: user.color }}>+{task.points}⭐</span>
            </button>
          ))}
          {done.length > 0 && (
            <>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-wider pt-2" style={{ color: '#a09d99' }}>Erledigt</p>
              {done.map(task => (
                <div key={task.id} className="flex items-center gap-3 rounded-xl px-4 py-3 opacity-50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: user.color }}>
                    <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />
                  </div>
                  <span className="flex-1 text-sm font-sans line-through" style={{ color: '#6b6760' }}>{task.title}</span>
                  <span className="text-xs font-sans" style={{ color: '#a09d99' }}>+{task.points}⭐</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* CALENDAR TAB */}
      {tab === 'calendar' && (
        <div>
          {userEvents.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
              <div className="text-3xl mb-3">📅</div>
              <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Termine gefunden</p>
              <p className="text-xs font-sans mt-1" style={{ color: '#c0bbb5' }}>
                Kalender-Name muss "{user.name}" enthalten
              </p>
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
                      <div key={ev.id} className="flex items-start gap-3 rounded-xl px-4 py-3"
                        style={{ background: '#f7f4f0', borderLeft: `3px solid ${ev.color ?? user.color}`, borderRadius: '0 10px 10px 0' }}>
                        <span className="text-xs font-sans flex-shrink-0 mt-0.5" style={{ color: '#a09d99', minWidth: 52 }}>
                          {formatEventTime(ev)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-sans font-semibold truncate" style={{ color: '#1a1814' }}>{ev.title}</p>
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
      )}

      {/* REWARDS TAB */}
      {tab === 'rewards' && (
        <div className="space-y-3">
          {affordable.length > 0 && (
            <>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#5cb85c' }}>Verfügbar</p>
              {affordable.map(r => (
                <button key={r.id} onClick={() => handleClaim(r.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-95"
                  style={{ background: '#f2fbf2', border: '0.5px solid #5cb85c30' }}>
                  <span className="text-xl">🎁</span>
                  <span className="flex-1 text-sm font-sans font-medium" style={{ color: '#1a1814' }}>{r.title}</span>
                  <span className="text-sm font-sans font-semibold" style={{ color: '#5cb85c' }}>-{r.points_cost}⭐</span>
                </button>
              ))}
            </>
          )}
          {unaffordable.length > 0 && (
            <>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-wider mt-2" style={{ color: '#a09d99' }}>Noch nicht verfügbar</p>
              {unaffordable.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3 opacity-50"
                  style={{ background: '#f5f2ee', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                  <span className="text-xl">🔒</span>
                  <div className="flex-1">
                    <p className="text-sm font-sans" style={{ color: '#6b6760' }}>{r.title}</p>
                    <p className="text-xs font-sans" style={{ color: '#a09d99' }}>Noch {r.points_cost - user.points}⭐ nötig</p>
                  </div>
                  <span className="text-sm font-sans" style={{ color: '#a09d99' }}>{r.points_cost}⭐</span>
                </div>
              ))}
            </>
          )}
          {rewards.length === 0 && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">🎁</div>
              <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Belohnungen verfügbar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}