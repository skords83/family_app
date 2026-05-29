'use client';

import { useState } from 'react';

interface TaskCardTask {
  id: string;
  title: string;
  points: number;
  completed_at: string | null;
  due_time?: string | null;
}

interface TaskCardProps {
  task: TaskCardTask;
  onComplete?: (taskId: string) => Promise<void>;
  onUncomplete?: (taskId: string) => Promise<void>;
  userColor?: string;
  compact?: boolean;
}

export default function TaskCard({
  task,
  onComplete,
  onUncomplete,
  userColor = '#6366f1',
  compact = false,
}: TaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const isCompleted = !!task.completed_at;

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (isCompleted && onUncomplete) {
        await onUncomplete(task.id);
      } else if (!isCompleted && onComplete) {
        setJustCompleted(true);
        await onComplete(task.id);
        setTimeout(() => setJustCompleted(false), 600);
      }
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <div
        className={`
          flex items-center gap-3 rounded-xl px-4
          bg-slate-800/40 border border-slate-700/30
          opacity-50 cursor-default
          ${compact ? 'min-h-[40px] py-2' : 'min-h-[48px] py-3'}
        `}
      >
        <span className="text-green-400 text-lg flex-shrink-0">✓</span>
        <span className="flex-1 text-slate-400 line-through text-sm">{task.title}</span>
        <span className="text-xs text-slate-500">+{task.points}⭐</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        w-full flex items-center gap-3 rounded-xl px-4
        border transition-all duration-200
        active:scale-95 text-left
        ${compact ? 'min-h-[48px] py-2' : 'min-h-[64px] py-3'}
        ${justCompleted ? 'task-complete-animation' : ''}
        ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
      `}
      style={{
        backgroundColor: `${userColor}18`,
        borderColor: `${userColor}44`,
      }}
    >
      <span
        className={`
          w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
          transition-all duration-200
          ${loading ? 'border-slate-500' : ''}
        `}
        style={{ borderColor: userColor }}
      >
        {loading && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-100 truncate">{task.title}</p>
        {task.due_time && (
          <p className="text-xs text-slate-400">{task.due_time} Uhr</p>
        )}
      </div>

      <span
        className="text-sm font-semibold flex-shrink-0 rounded-full px-2 py-0.5"
        style={{ color: userColor, backgroundColor: `${userColor}22` }}
      >
        +{task.points}⭐
      </span>
    </button>
  );
}
