'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import TaskCard from '@/components/ui/TaskCard';
import PointsBadge from '@/components/ui/PointsBadge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  points: number;
  role: string;
}

interface TaskInstance {
  id: string;
  title: string;
  points: number;
  assigned_to: string;
  completed_at: string | null;
  due_time?: string | null;
}

interface Reward {
  id: string;
  title: string;
  points_cost: number;
  available_to: string | null;
  active: boolean;
}

interface RewardClaim {
  id: string;
  reward_id: string;
  user_id: string;
  claimed_at: string;
  approved_at: string | null;
  reward_title?: string;
}

type Tab = 'tasks' | 'rewards';

export default function UserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('tasks');
  const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; color: string } | null>(null);

  const showNotification = (text: string, color: string = '#10b981') => {
    setNotification({ text, color });
    setTimeout(() => setNotification(null), 2500);
  };

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const [userRes, tasksRes, rewardsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users/${userId}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then((r) => r.json()),
        fetch(`${API_BASE}/api/rewards?user_id=${userId}`).then((r) => r.json()),
      ]);

      if (userRes.status === 'fulfilled' && userRes.value.id) {
        setUser(userRes.value);
      }
      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
        setTasks(tasksRes.value.filter((t: TaskInstance) => t.assigned_to === userId));
      }
      if (rewardsRes.status === 'fulfilled' && Array.isArray(rewardsRes.value)) {
        setRewards(rewardsRes.value);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleComplete = async (taskId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    if (res.ok) {
      const data = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t))
      );
      showNotification(`+${data.points_earned} ⭐ verdient!`);

      // Refresh user points
      const userRes = await fetch(`${API_BASE}/api/users/${userId}`).then((r) => r.json());
      if (userRes.id) setUser(userRes);
    }
  };

  const handleClaimReward = async (rewardId: string) => {
    if (!user) return;
    setClaimingRewardId(rewardId);

    try {
      const res = await fetch(`${API_BASE}/api/rewards/${rewardId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();

      if (res.ok) {
        showNotification(`Belohnung beantragt! -${data.points_spent} ⭐`);
        // Refresh
        await fetchData();
      } else {
        showNotification(data.error ?? 'Fehler beim Einlösen', '#ef4444');
      }
    } finally {
      setClaimingRewardId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Lade...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400">Nutzer nicht gefunden</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-slate-800 rounded-xl text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Zurück
        </button>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => !t.completed_at);
  const completedTasks = tasks.filter((t) => t.completed_at);
  const pendingClaims = claims.filter((c) => !c.approved_at);

  const affordableRewards = rewards.filter((r) => r.points_cost <= user.points);
  const unaffordableRewards = rewards.filter((r) => r.points_cost > user.points);

  return (
    <main
      className="min-h-screen p-4 pb-8"
      style={{ background: `linear-gradient(135deg, #0f172a 0%, ${user.color}18 100%)` }}
    >
      {/* Notification */}
      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-6 py-3 font-bold text-white shadow-2xl animate-scale-in"
          style={{ backgroundColor: notification.color }}
        >
          {notification.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all active:scale-95"
        >
          ←
        </button>
        <div className="flex-1" />
      </div>

      {/* User hero */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-6xl mb-3 shadow-2xl"
          style={{
            backgroundColor: `${user.color}22`,
            border: `3px solid ${user.color}66`,
          }}
        >
          {user.avatar}
        </div>
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: user.color }}
        >
          {user.name}
        </h1>
        <PointsBadge points={user.points} color={user.color} size="lg" />

        {/* Progress */}
        {tasks.length > 0 && (
          <div className="mt-4 w-full max-w-xs">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{completedTasks.length} erledigt</span>
              <span>{tasks.length} gesamt</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(completedTasks.length / tasks.length) * 100}%`,
                  backgroundColor: user.color,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 max-w-lg mx-auto">
        {(['tasks', 'rewards'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95
              ${tab === t
                ? 'text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
              }
            `}
            style={tab === t ? { backgroundColor: user.color } : {}}
          >
            {t === 'tasks' ? `Aufgaben (${pendingTasks.length})` : `Belohnungen`}
          </button>
        ))}
      </div>

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div className="space-y-2 max-w-lg mx-auto">
          {pendingTasks.length === 0 && completedTasks.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-4xl mb-3">🎉</p>
              <p className="font-medium">Keine Aufgaben für heute!</p>
            </div>
          )}

          {pendingTasks.length === 0 && completedTasks.length > 0 && (
            <div className="text-center py-6 text-slate-400">
              <p className="text-4xl mb-3">🏆</p>
              <p className="font-bold text-lg">Alle Aufgaben erledigt!</p>
              <p className="text-sm text-slate-500 mt-1">Super gemacht!</p>
            </div>
          )}

          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              userColor={user.color}
              onComplete={handleComplete}
            />
          ))}

          {completedTasks.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Erledigt</p>
              </div>
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userColor={user.color}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Rewards tab */}
      {tab === 'rewards' && (
        <div className="space-y-4 max-w-lg mx-auto">
          {/* Pending claims */}
          {pendingClaims.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                Warten auf Genehmigung
              </h3>
              <div className="space-y-2">
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3"
                  >
                    <span className="text-2xl">⏳</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{claim.reward_title}</p>
                      <p className="text-xs text-amber-400">Wartet auf Elterngenehmigung</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affordable rewards */}
          {affordableRewards.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">
                Verfügbar
              </h3>
              <div className="space-y-2">
                {affordableRewards.map((reward) => (
                  <button
                    key={reward.id}
                    onClick={() => handleClaimReward(reward.id)}
                    disabled={claimingRewardId === reward.id}
                    className="
                      w-full flex items-center gap-3 bg-slate-800 border border-slate-700
                      rounded-xl px-4 min-h-[64px] text-left
                      hover:border-green-500/50 hover:bg-slate-700/50
                      transition-all active:scale-95 disabled:opacity-60
                    "
                  >
                    <span className="text-2xl">🎁</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">{reward.title}</p>
                    </div>
                    <span className="text-sm font-bold text-green-400">
                      {claimingRewardId === reward.id ? '...' : `-${reward.points_cost} ⭐`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Unaffordable rewards */}
          {unaffordableRewards.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Noch nicht verfügbar
              </h3>
              <div className="space-y-2">
                {unaffordableRewards.map((reward) => {
                  const needed = reward.points_cost - user.points;
                  return (
                    <div
                      key={reward.id}
                      className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 min-h-[64px] opacity-60"
                    >
                      <span className="text-2xl">🔒</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-400">{reward.title}</p>
                        <p className="text-xs text-slate-500">Noch {needed} ⭐ nötig</p>
                      </div>
                      <span className="text-sm font-bold text-slate-500">{reward.points_cost} ⭐</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rewards.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-4xl mb-3">🎁</p>
              <p>Keine Belohnungen verfügbar</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
