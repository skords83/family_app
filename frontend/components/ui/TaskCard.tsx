'use client';

import { useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface TaskCardTask {
  id: string; title: string; points: number;
  completed_at: string | null; due_time?: string | null;
  requires_approval?: boolean; approved_at?: string | null;
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
  const { isOnline } = useOnlineStatus();
  const isCompleted = !!task.completed_at;
  const isPendingApproval = isCompleted && task.requires_approval && !task.approved_at;

  const handleClick = async () => {
    if (loading || !isOnline) return;
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

  // ── Pending Approval State (gelb/orange) ──
  if (isPendingApproval) {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl px-3 ${compact ? 'py-2' : 'py-2.5'}`}
        style={{ background: '#fffbeb', border: '0.5px solid #fbbf2440' }}
      >
        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}>
          <i className="ti ti-clock" style={{ fontSize: 9, color: '#f59e0b' }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-sans line-clamp-1" style={{ color: '#1a1814' }}>{task.title}</span>
          <p className="text-[10px] font-sans" style={{ color: '#f59e0b' }}>Wartet auf Bestätigung</p>
        </div>
        <span className="text-xs font-sans" style={{ color: '#f59e0b' }}>+{task.points}⭐</span>
      </div>
    );
  }

  // ── Completed State (grün, durchgestrichen) ──
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

  // ── Open State (klickbar) ──
  return (
    <button
      onClick={handleClick}
      disabled={loading || !isOnline}
      title={!isOnline ? 'Keine Verbindung' : undefined}
      className={`w-full flex items-center gap-3 rounded-xl px-3 text-left transition-all duration-200 ${compact ? 'py-2' : 'py-2.5'} ${justCompleted ? 'scale-95' : ''} ${loading ? 'opacity-60' : ''} ${!isOnline ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
      style={{ background: `${userColor}14`, border: `0.5px solid ${userColor}30` }}
    >
      <div
        className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
        style={{ borderColor: userColor }}
      >
        {loading && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: userColor }} />}
        {!isOnline && !loading && <i className="ti ti-wifi-off" style={{ fontSize: 9, color: userColor }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-sans font-medium truncate" style={{ color: '#1a1814' }}>{task.title}</p>
          {task.requires_approval && (
            <i className="ti ti-eye" style={{ fontSize: 12, color: '#a09d99', flexShrink: 0 }} title="Wird geprüft" />
          )}
        </div>
        {task.due_time && <p className="text-xs font-sans" style={{ color: '#a09d99' }}>{task.due_time} Uhr</p>}
      </div>
      <span className="text-xs font-sans font-semibold flex-shrink-0 rounded-full px-2 py-0.5" style={{ color: userColor, background: `${userColor}18` }}>
        +{task.points}⭐
      </span>
    </button>
  );
}
