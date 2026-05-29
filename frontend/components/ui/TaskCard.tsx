'use client';

import { useState } from 'react';

interface TaskCardTask {
  id: string; title: string; points: number;
  completed_at: string | null; due_time?: string | null;
}
interface TaskCardProps {
  task: TaskCardTask;
  onComplete?: (taskId: string) => Promise<void>;
  onUncomplete?: (taskId: string) => Promise<void>;
  userColor?: string;
  compact?: boolean;
}

export default function TaskCard({ task, onComplete, onUncomplete, userColor = '#6366f1', compact = false }: TaskCardProps) {
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
    } finally { setLoading(false); }
  };

  if (isCompleted) {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl px-3 opacity-50 ${compact ? 'py-2' : 'py-2.5'}`}
        style={{ background: 'rgba(0,0,0,0.04)' }}
      >
        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: userColor }}>
          <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />
        </div>
        <span className="flex-1 text-sm font-sans line-through" style={{ color: '#6b6760' }}>{task.title}</span>
        <span className="text-xs font-sans" style={{ color: '#a09d99' }}>+{task.points}⭐</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`w-full flex items-center gap-3 rounded-xl px-3 text-left transition-all duration-200 active:scale-95 ${compact ? 'py-2' : 'py-2.5'} ${justCompleted ? 'scale-95' : ''} ${loading ? 'opacity-60' : ''}`}
      style={{ background: `${userColor}14`, border: `0.5px solid ${userColor}30` }}
    >
      <div
        className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
        style={{ borderColor: userColor }}
      >
        {loading && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: userColor }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-medium truncate" style={{ color: '#1a1814' }}>{task.title}</p>
        {task.due_time && <p className="text-xs font-sans" style={{ color: '#a09d99' }}>{task.due_time} Uhr</p>}
      </div>
      <span className="text-xs font-sans font-semibold flex-shrink-0 rounded-full px-2 py-0.5" style={{ color: userColor, background: `${userColor}18` }}>
        +{task.points}⭐
      </span>
    </button>
  );
}