'use client';

import TaskCard from '../ui/TaskCard';

interface User {
  id: string; name: string; avatar: string; photo?: string;
  color: string; points: number;
}
interface TaskInstance {
  id: string; title: string; points: number;
  assigned_to: string; completed_at: string | null; due_time?: string | null;
}
interface TaskColumnsProps {
  users: User[]; tasks: TaskInstance[];
  onComplete?: (taskId: string, userId: string) => Promise<void>;
  compact?: boolean;
}

const PASTELS: Record<string, string> = {
  '#e85d3a':'#fff5f3','#4a9eed':'#f0f7ff','#5cb85c':'#f2fbf2',
  '#9b59b6':'#f8f2fd','#f0a500':'#fffbf0','#00bcd4':'#f0fbfd',
  '#f59e0b':'#fffbeb','#3b82f6':'#eff6ff','#10b981':'#f0fdf4',
  '#ec4899':'#fdf2f8','#6366f1':'#eef2ff',
};
function pastel(color: string) { return PASTELS[color] ?? `${color}18`; }

export default function TaskColumns({ users, tasks, onComplete, compact = false }: TaskColumnsProps) {
  if (users.length === 0) return null;

  const cols = users.length === 1 ? 'grid-cols-1'
    : users.length === 2 ? 'grid-cols-2'
    : users.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2 md:grid-cols-4';

  return (
    <div className={`grid gap-4 ${cols}`}>
      {users.map(user => {
        const userTasks = tasks.filter(t => t.assigned_to === user.id);
        const completedTasks = userTasks.filter(t => t.completed_at);
        const pendingTasks = userTasks.filter(t => !t.completed_at);
        const pct = userTasks.length ? Math.round(completedTasks.length / userTasks.length * 100) : 0;
        const bg = pastel(user.color);

        return (
          <div key={user.id} className="rounded-2xl p-4" style={{ background: bg, border: `0.5px solid ${user.color}25` }}>
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
              {user.photo ? (
                <img src={user.photo} alt={user.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${user.color}` }} />
              ) : (
                <span className="text-2xl flex-shrink-0">{user.avatar}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold font-sans text-sm truncate" style={{ color: user.color }}>{user.name}</p>
                <p className="text-xs font-sans" style={{ color: '#a09d99' }}>{completedTasks.length}/{userTasks.length} erledigt</p>
              </div>
              <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-full" style={{ color: user.color, background: `${user.color}18` }}>
                ⭐{user.points}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: `${user.color}20` }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: user.color }} />
            </div>

            {/* Tasks */}
            <div className="space-y-1.5">
              {pendingTasks.map(task => (
                <TaskCard key={task.id} task={task} userColor={user.color} compact={compact}
                  onComplete={onComplete ? id => onComplete(id, user.id) : undefined} />
              ))}
              {completedTasks.map(task => (
                <TaskCard key={task.id} task={task} userColor={user.color} compact={compact} />
              ))}
              {userTasks.length === 0 && (
                <p className="text-xs font-sans text-center py-3" style={{ color: '#a09d99' }}>Keine Aufgaben</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
