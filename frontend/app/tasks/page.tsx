'use client';

import { useState, useEffect, useCallback } from 'react';
import AvatarButton from '@/components/ui/AvatarButton';

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

const PASTELS: Record<string, string> = {
  '#e85d3a': '#fff5f3', '#4a9eed': '#f0f7ff', '#5cb85c': '#f2fbf2',
  '#9b59b6': '#f8f2fd', '#f0a500': '#fffbf0', '#00bcd4': '#f0fbfd',
  '#f59e0b': '#fffbeb', '#3b82f6': '#eff6ff', '#10b981': '#f0fdf4',
  '#ec4899': '#fdf2f8', '#6366f1': '#eef2ff',
};
function pastel(color: string) {
  return PASTELS[color] ?? `${color}18`;
}

export default function TasksPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ur, tr] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
      ]);
      if (ur.status === 'fulfilled' && Array.isArray(ur.value)) setUsers(ur.value);
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTasks(tr.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleComplete = async (taskId: string, userId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t
    ));
    const fresh = await fetch(`${API_BASE}/api/users`).then(r => r.json());
    if (Array.isArray(fresh)) setUsers(fresh);
  };

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: '#e8e4de' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>Aufgaben</h1>
        <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>{today}</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {users.map(user => {
          const userTasks = tasks.filter(t => t.assigned_to === user.id);
          const pending = userTasks.filter(t => !t.completed_at);
          const done = userTasks.filter(t => t.completed_at);
          const pct = userTasks.length ? Math.round(done.length / userTasks.length * 100) : 0;
          const bg = pastel(user.color);

          return (
            <div
              key={user.id}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: bg, border: `0.5px solid ${user.color}30` }}
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <AvatarButton user={{ ...user, tasks_total: userTasks.length, tasks_done: done.length }} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold font-sans text-sm truncate" style={{ color: user.color }}>
                    {user.name}
                  </div>
                  <div className="text-xs font-sans" style={{ color: '#a09d99' }}>
                    {done.length}/{userTasks.length} · ⭐ {user.points}
                  </div>
                </div>
                {/* Add task button */}
                <button
                  onClick={() => {
                    const title = prompt('Aufgabe:');
                    if (!title) return;
                    // TODO: POST /api/task-templates + assign
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                  style={{ background: `${user.color}22`, color: user.color }}
                  title="Aufgabe hinzufügen"
                >
                  <i className="ti ti-plus" style={{ fontSize: 14 }} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${user.color}20` }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: user.color }}
                />
              </div>

              {/* Pending tasks */}
              <div className="flex flex-col gap-1.5">
                {pending.map(task => (
                  <button
                    key={task.id}
                    onClick={() => handleComplete(task.id, user.id)}
                    className="flex items-center gap-2.5 w-full text-left group"
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all group-hover:scale-110"
                      style={{ borderColor: user.color }}
                    />
                    <span className="text-sm font-sans flex-1" style={{ color: '#1a1814' }}>{task.title}</span>
                    <span className="text-xs font-sans" style={{ color: '#a09d99' }}>⭐{task.points}</span>
                  </button>
                ))}

                {done.map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 opacity-50">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: user.color }}
                    >
                      <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />
                    </div>
                    <span className="text-sm font-sans line-through flex-1" style={{ color: '#6b6760' }}>{task.title}</span>
                    <span className="text-xs font-sans" style={{ color: '#a09d99' }}>⭐{task.points}</span>
                  </div>
                ))}

                {userTasks.length === 0 && (
                  <p className="text-xs font-sans text-center py-3" style={{ color: '#a09d99' }}>
                    Keine Aufgaben
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
