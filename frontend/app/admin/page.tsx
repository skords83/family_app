'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PinModal from '@/components/ui/PinModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  points: number;
  role: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  points: number;
  assigned_to: string | null;
  assigned_to_name?: string;
  recurrence: string;
  due_time: string | null;
  active: boolean;
}

interface Reward {
  id: string;
  title: string;
  points_cost: number;
  available_to: string | null;
  available_to_name?: string;
  active: boolean;
}

interface RewardClaim {
  id: string;
  reward_id: string;
  user_id: string;
  claimed_at: string;
  approved_at: string | null;
  reward_title: string;
  user_name: string;
  user_avatar: string;
  user_color: string;
  points_cost: number;
}

type AdminTab = 'tasks' | 'rewards' | 'users' | 'points';

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [tab, setTab] = useState<AdminTab>('tasks');
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Forms
  const [newTask, setNewTask] = useState({ title: '', points: 1, assigned_to: '', recurrence: 'daily', due_time: '' });
  const [newReward, setNewReward] = useState({ title: '', points_cost: 50, available_to: '' });
  const [manualPoints, setManualPoints] = useState({ user_id: '', points: 0, reason: '' });

  const showNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = useCallback(async () => {
    const [usersRes, templatesRes, rewardsRes, claimsRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/users`).then((r) => r.json()),
      fetch(`${API_BASE}/api/tasks/templates`).then((r) => r.json()),
      fetch(`${API_BASE}/api/rewards`).then((r) => r.json()),
      fetch(`${API_BASE}/api/rewards/claims`).then((r) => r.json()),
    ]);

    if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) setUsers(usersRes.value);
    if (templatesRes.status === 'fulfilled' && Array.isArray(templatesRes.value)) setTemplates(templatesRes.value);
    if (rewardsRes.status === 'fulfilled' && Array.isArray(rewardsRes.value)) setRewards(rewardsRes.value);
    if (claimsRes.status === 'fulfilled' && Array.isArray(claimsRes.value)) setClaims(claimsRes.value);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchData();
    }
  }, [authenticated, fetchData]);

  const handlePinSuccess = (pin: string) => {
    setAdminPin(pin);
    setAuthenticated(true);
  };

  const handleToggleTemplate = async (template: TaskTemplate) => {
    const res = await fetch(`${API_BASE}/api/tasks/templates/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !template.active }),
    });
    if (res.ok) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, active: !t.active } : t))
      );
      showNotification(template.active ? 'Aufgabe deaktiviert' : 'Aufgabe aktiviert');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/tasks/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTask.title,
        points: newTask.points,
        assigned_to: newTask.assigned_to || null,
        recurrence: newTask.recurrence,
        due_time: newTask.due_time || null,
      }),
    });
    if (res.ok) {
      setNewTask({ title: '', points: 1, assigned_to: '', recurrence: 'daily', due_time: '' });
      showNotification('Aufgabe erstellt!');
      fetchData();
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newReward.title,
        points_cost: newReward.points_cost,
        available_to: newReward.available_to || null,
        pin: adminPin,
      }),
    });
    if (res.ok) {
      setNewReward({ title: '', points_cost: 50, available_to: '' });
      showNotification('Belohnung erstellt!');
      fetchData();
    }
  };

  const handleToggleReward = async (reward: Reward) => {
    await fetch(`${API_BASE}/api/rewards/${reward.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !reward.active, pin: adminPin }),
    });
    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, active: !r.active } : r))
    );
    showNotification(reward.active ? 'Belohnung deaktiviert' : 'Belohnung aktiviert');
  };

  const handleApproveClaim = async (claimId: string) => {
    const res = await fetch(`${API_BASE}/api/rewards/${claimId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: adminPin }),
    });
    if (res.ok) {
      showNotification('Belohnung genehmigt!');
      fetchData();
    }
  };

  const handleManualPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/points/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: manualPoints.user_id,
        points: manualPoints.points,
        reason: manualPoints.reason || 'manual',
        pin: adminPin,
      }),
    });
    if (res.ok) {
      setManualPoints({ user_id: '', points: 0, reason: '' });
      showNotification('Punkte angepasst!');
      fetchData();
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <PinModal
          title="Admin PIN"
          onSuccess={handlePinSuccess}
          onCancel={() => router.push('/')}
        />
      </div>
    );
  }

  const pendingClaims = claims.filter((c) => !c.approved_at);

  const tabConfig: { id: AdminTab; label: string }[] = [
    { id: 'tasks', label: 'Aufgaben' },
    { id: 'rewards', label: `Belohnungen${pendingClaims.length > 0 ? ` (${pendingClaims.length})` : ''}` },
    { id: 'users', label: 'Nutzer' },
    { id: 'points', label: 'Punkte' },
  ];

  return (
    <main className="min-h-screen bg-slate-900 p-4">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white rounded-xl px-6 py-3 font-semibold shadow-2xl">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all active:scale-95"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white flex-1">⚙️ Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 max-w-2xl mx-auto overflow-x-auto pb-1">
        {tabConfig.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all active:scale-95
              ${tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto">

        {/* Tasks Tab */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* Create task form */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
              <h3 className="font-bold text-slate-200 mb-4">Neue Aufgabe</h3>
              <form onSubmit={handleCreateTask} className="space-y-3">
                <input
                  type="text"
                  placeholder="Aufgabenname"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Punkte</label>
                    <input
                      type="number"
                      min="1"
                      value={newTask.points}
                      onChange={(e) => setNewTask({ ...newTask, points: parseInt(e.target.value) })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Wiederholung</label>
                    <select
                      value={newTask.recurrence}
                      onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="once">Einmalig</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Zugewiesen an</label>
                    <select
                      value={newTask.assigned_to}
                      onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Alle</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.avatar} {u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Uhrzeit (opt.)</label>
                    <input
                      type="time"
                      value={newTask.due_time}
                      onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors active:scale-95"
                >
                  Aufgabe erstellen
                </button>
              </form>
            </div>

            {/* Templates list */}
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`
                    flex items-center gap-3 bg-slate-800 border rounded-xl px-4 py-3
                    ${template.active ? 'border-slate-700' : 'border-slate-700/30 opacity-50'}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{template.title}</p>
                    <p className="text-xs text-slate-500">
                      {template.points} ⭐ •{' '}
                      {template.recurrence === 'daily' ? 'Täglich' : template.recurrence === 'weekly' ? 'Wöchentlich' : 'Einmalig'} •{' '}
                      {template.assigned_to_name ?? 'Alle'}
                      {template.due_time && ` • ${template.due_time}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleTemplate(template)}
                    className={`
                      min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95
                      ${template.active
                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                        : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                      }
                    `}
                  >
                    {template.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rewards Tab */}
        {tab === 'rewards' && (
          <div className="space-y-4">
            {/* Pending claims */}
            {pendingClaims.length > 0 && (
              <div className="bg-slate-800 rounded-2xl border border-amber-700/30 p-4">
                <h3 className="font-bold text-amber-400 mb-3">⏳ Wartend auf Genehmigung</h3>
                <div className="space-y-2">
                  {pendingClaims.map((claim) => (
                    <div
                      key={claim.id}
                      className="flex items-center gap-3 bg-amber-900/10 border border-amber-700/20 rounded-xl px-3 py-3"
                    >
                      <span className="text-2xl">{claim.user_avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-200 truncate">{claim.reward_title}</p>
                        <p className="text-xs text-slate-400">{claim.user_name} • {claim.points_cost} ⭐</p>
                      </div>
                      <button
                        onClick={() => handleApproveClaim(claim.id)}
                        className="min-h-[36px] px-3 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-semibold transition-colors active:scale-95"
                      >
                        ✓ Genehmigen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create reward form */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
              <h3 className="font-bold text-slate-200 mb-4">Neue Belohnung</h3>
              <form onSubmit={handleCreateReward} className="space-y-3">
                <input
                  type="text"
                  placeholder="Belohnungsname"
                  value={newReward.title}
                  onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Punktekosten</label>
                    <input
                      type="number"
                      min="1"
                      value={newReward.points_cost}
                      onChange={(e) => setNewReward({ ...newReward, points_cost: parseInt(e.target.value) })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Verfügbar für</label>
                    <select
                      value={newReward.available_to}
                      onChange={(e) => setNewReward({ ...newReward, available_to: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Alle</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.avatar} {u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors active:scale-95"
                >
                  Belohnung erstellen
                </button>
              </form>
            </div>

            {/* Rewards list */}
            <div className="space-y-2">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className={`
                    flex items-center gap-3 bg-slate-800 border rounded-xl px-4 py-3
                    ${reward.active ? 'border-slate-700' : 'border-slate-700/30 opacity-50'}
                  `}
                >
                  <span className="text-2xl">🎁</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{reward.title}</p>
                    <p className="text-xs text-slate-500">
                      {reward.points_cost} ⭐ • {reward.available_to_name ?? 'Alle'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleReward(reward)}
                    className={`
                      min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95
                      ${reward.active
                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                        : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                      }
                    `}
                  >
                    {reward.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
              >
                <span className="text-3xl">{user.avatar}</span>
                <div className="flex-1">
                  <p className="font-bold" style={{ color: user.color }}>{user.name}</p>
                  <p className="text-xs text-slate-500">
                    {user.role === 'parent' ? '👑 Elternteil' : '👶 Kind'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: user.color }}>⭐ {user.points}</p>
                  <p className="text-xs text-slate-500">Punkte</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Points Tab */}
        {tab === 'points' && (
          <div className="space-y-4">
            {/* Manual points form */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
              <h3 className="font-bold text-slate-200 mb-4">Punkte manuell anpassen</h3>
              <form onSubmit={handleManualPoints} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Nutzer</label>
                  <select
                    value={manualPoints.user_id}
                    onChange={(e) => setManualPoints({ ...manualPoints, user_id: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Nutzer wählen</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.avatar} {u.name} (aktuell: {u.points} ⭐)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Punkte (negativ zum Abziehen)</label>
                  <input
                    type="number"
                    value={manualPoints.points}
                    onChange={(e) => setManualPoints({ ...manualPoints, points: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Grund (optional)</label>
                  <input
                    type="text"
                    placeholder="z.B. Bonus, Strafe..."
                    value={manualPoints.reason}
                    onChange={(e) => setManualPoints({ ...manualPoints, reason: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors active:scale-95"
                >
                  Punkte anpassen
                </button>
              </form>
            </div>

            {/* Users point summary */}
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                >
                  <span className="text-2xl">{user.avatar}</span>
                  <p className="flex-1 font-semibold" style={{ color: user.color }}>{user.name}</p>
                  <p className="font-bold text-lg" style={{ color: user.color }}>⭐ {user.points}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
