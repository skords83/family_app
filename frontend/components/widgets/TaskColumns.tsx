'use client';

import TaskCard from '../ui/TaskCard';

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  points: number;
}

interface TaskInstance {
  id: string;
  title: string;
  points: number;
  assigned_to: string;
  completed_at: string | null;
  due_time?: string | null;
}

interface TaskColumnsProps {
  users: User[];
  tasks: TaskInstance[];
  onComplete?: (taskId: string, userId: string) => Promise<void>;
  compact?: boolean;
}

export default function TaskColumns({ users, tasks, onComplete, compact = false }: TaskColumnsProps) {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className={`grid gap-3 ${users.length === 1 ? 'grid-cols-1' : users.length === 2 ? 'grid-cols-2' : users.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
      {users.map((user) => {
        const userTasks = tasks.filter((t) => t.assigned_to === user.id);
        const completedTasks = userTasks.filter((t) => t.completed_at);
        const pendingTasks = userTasks.filter((t) => !t.completed_at);

        return (
          <div
            key={user.id}
            className="bg-slate-800/60 rounded-2xl p-3 border"
            style={{ borderColor: `${user.color}33` }}
          >
            {/* User header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{user.avatar}</span>
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-sm truncate"
                  style={{ color: user.color }}
                >
                  {user.name}
                </p>
                <p className="text-xs text-slate-400">
                  {completedTasks.length}/{userTasks.length} erledigt
                </p>
              </div>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ color: user.color, backgroundColor: `${user.color}22` }}
              >
                ⭐{user.points}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: userTasks.length > 0 ? `${(completedTasks.length / userTasks.length) * 100}%` : '0%',
                  backgroundColor: user.color,
                }}
              />
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userColor={user.color}
                  compact={compact}
                  onComplete={onComplete ? (id) => onComplete(id, user.id) : undefined}
                />
              ))}
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userColor={user.color}
                  compact={compact}
                />
              ))}
              {userTasks.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">Keine Aufgaben</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
