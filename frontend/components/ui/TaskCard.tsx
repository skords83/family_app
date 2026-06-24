'use client';

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface TaskCardTask {
  id: string; title: string; points: number;
  completed_at: string | null; due_time?: string | null;
  available_from?: string | null; date?: string | null;
  requires_approval?: boolean; approved_at?: string | null;
}
interface TaskCardProps {
  task: TaskCardTask;
  onComplete?: (taskId: string) => Promise<void>;
  onUncomplete?: (taskId: string) => Promise<void>;
  userColor?: string;
  compact?: boolean;
}

function nowBerlin(): { time: string; date: string } {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin', hour12: false }),
    date: now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }),
  };
}

export default function TaskCard({ task, onComplete, onUncomplete, userColor = '#6366f1', compact = false }: TaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const { isOnline } = useOnlineStatus();
  const isCompleted = !!task.completed_at;
  const isPendingApproval = isCompleted && task.requires_approval && !task.approved_at;

  // Re-check availability every 30s so tasks unlock/expire without a page reload
  const [now, setNow] = useState(nowBerlin);
  useEffect(() => {
    if ((!task.available_from && !task.due_time) || isCompleted) return;
    const iv = setInterval(() => setNow(nowBerlin()), 30_000);
    return () => clearInterval(iv);
  }, [task.available_from, task.due_time, isCompleted]);

  const isFromPastDay = !!task.date && task.date < now.date;
  const isExpired = !isCompleted && (isFromPastDay || (!!task.due_time && now.time > task.due_time));
  const isLocked = !isCompleted && !isExpired && !!task.available_from && now.time < task.available_from;

  const handleClick = async () => {
    if (loading || !isOnline || isLocked || isExpired) return;
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

  // ── Time label: show available_from as primary time, due_time as deadline ──
  const timeLabel = task.available_from ? `${task.available_from} Uhr` : null;
  const deadlineLabel = task.due_time ? `bis ${task.due_time}` : null;

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

  // ── Locked State (vor available_from — sichtbar aber nicht abhakbar) ──
  if (isLocked) {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl px-3 ${compact ? 'py-2' : 'py-2.5'}`}
        style={{ background: `${userColor}08`, border: `0.5px solid ${userColor}15`, opacity: 0.5 }}
      >
        <div
          className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
          style={{ borderColor: `${userColor}60` }}
        >
          <i className="ti ti-lock" style={{ fontSize: 9, color: `${userColor}80` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-sans font-medium truncate" style={{ color: '#6b6760' }}>{task.title}</p>
          <p className="text-[10px] font-sans flex items-center gap-1.5" style={{ color: '#a09d99' }}>
            ab {task.available_from} Uhr
            {deadlineLabel && (
              <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: '#c2410c' }}>
                <i className="ti ti-clock-exclamation" style={{ fontSize: 10 }} />{deadlineLabel}
              </span>
            )}
          </p>
        </div>
        <span className="text-xs font-sans font-semibold flex-shrink-0 rounded-full px-2 py-0.5" style={{ color: `${userColor}80`, background: `${userColor}10` }}>
          +{task.points}⭐
        </span>
      </div>
    );
  }

  // ── Expired State (nach due_time / vom Vortag — sichtbar aber nicht mehr abhakbar) ──
  if (isExpired) {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl px-3 ${compact ? 'py-2' : 'py-2.5'}`}
        style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
      >
        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{ background: '#fee2e2', border: '2px solid #fca5a5' }}>
          <i className="ti ti-clock-off" style={{ fontSize: 9, color: '#ef4444' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-sans font-medium truncate line-through" style={{ color: '#9ca3af' }}>{task.title}</p>
          <p className="text-[10px] font-sans" style={{ color: '#f87171' }}>
            Verpasst{task.due_time ? ` · bis ${task.due_time} Uhr` : ''}
          </p>
        </div>
        <span className="text-xs font-sans flex-shrink-0" style={{ color: '#fca5a5' }}>+{task.points}⭐</span>
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
        {(timeLabel || deadlineLabel) && (
          <p className="text-[10px] font-sans flex items-center gap-1.5" style={{ color: '#a09d99' }}>
            {timeLabel}
            {deadlineLabel && (
              <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: '#c2410c' }}>
                <i className="ti ti-clock-exclamation" style={{ fontSize: 10 }} />{deadlineLabel}
              </span>
            )}
          </p>
        )}
      </div>
      <span className="text-xs font-sans font-semibold flex-shrink-0 rounded-full px-2 py-0.5" style={{ color: userColor, background: `${userColor}18` }}>
        +{task.points}⭐
      </span>
    </button>
  );
}