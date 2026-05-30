'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PinModal from '@/components/ui/PinModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

const WEEKDAYS = [
  { key: 'mon', label: 'Mo' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Mi' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Fr' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'So' },
];

interface User {
  id: string;
  name: string;
  avatar: string;
  photo?: string;
  color: string;
  points: number;
  role: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  points: number;
  assigned_to: string | string[] | null;   // legacy: single UUID or new: UUID[]
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
  user_photo?: string;
  points_cost: number;
}

type AdminTab = 'tasks' | 'rewards' | 'users' | 'points';

/** Small avatar: photo if available, otherwise emoji fallback */
function UserAvatar({ user, size = 36 }: { user: { avatar: string; photo?: string; name: string; color: string }; size?: number }) {
  if (user.photo) {
    return (
      <img
        src={user.photo}
        alt={user.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${user.color}` }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: user.color + '22',
        border: `2px solid ${user.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        flexShrink: 0,
      }}
    >
      {user.avatar}
    </div>
  );
}

/** Tabler icon helper (webfont must be loaded in layout.tsx) */
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i className={`ti ti-${name} ${className}`} aria-hidden="true" />;
}

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
  const [newTask, setNewTask] = useState({
    title: '',
    points: 1,
    assigned_to: [] as string[],   // multi-select
    recurrence: 'daily',
    due_time: '',
    weekdays: [] as string[],
  });
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
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  const handlePinSuccess = (pin: string) => {
    setAdminPin(pin);
    setAuthenticated(true);
  };

  // ── Edit drawer state ──
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    points: 1,
    assigned_to: [] as string[],
    recurrence: 'daily',
    due_time: '',
    weekdays: [] as string[],
  });

  const openEdit = (template: TaskTemplate) => {
    const ids = Array.isArray(template.assigned_to)
      ? template.assigned_to
      : template.assigned_to ? [template.assigned_to] : [];
    let recurrence = template.recurrence;
    let weekdays: string[] = [];
    if (template.recurrence.startsWith('weekdays:')) {
      weekdays = template.recurrence.replace('weekdays:', '').split(',');
      recurrence = 'weekdays';
    }
    setEditForm({
      title: template.title,
      points: template.points,
      assigned_to: ids,
      recurrence,
      due_time: template.due_time ?? '',
      weekdays,
    });
    setEditingTemplate(template);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    let recurrenceValue = editForm.recurrence;
    if (editForm.recurrence === 'weekdays') {
      if (editForm.weekdays.length === 0) { showNotification('Bitte mindestens einen Wochentag auswählen.'); return; }
      recurrenceValue = `weekdays:${editForm.weekdays.join(',')}`;
    }
    const res = await fetch(`${API_BASE}/api/tasks/templates/${editingTemplate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        points: editForm.points,
        assigned_to: editForm.assigned_to.length > 0 ? editForm.assigned_to : null,
        recurrence: recurrenceValue,
        due_time: editForm.due_time || null,
      }),
    });
    if (res.ok) {
      setEditingTemplate(null);
      showNotification('Aufgabe gespeichert!');
      fetchData();
    }
  };

  const handleDeleteTemplate = async (template: TaskTemplate) => {
    if (!confirm(`"${template.title}" wirklich löschen? Alle zugehörigen Instanzen werden ebenfalls gelöscht.`)) return;
    const res = await fetch(`${API_BASE}/api/tasks/templates/${template.id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      showNotification('Aufgabe gelöscht.');
    }
  };

  const handleToggleTemplate = async (template: TaskTemplate) => {
    const res = await fetch(`${API_BASE}/api/tasks/templates/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !template.active }),
    });
    if (res.ok) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, active: !t.active } : t)));
      showNotification(template.active ? 'Aufgabe deaktiviert' : 'Aufgabe aktiviert');
    }
  };

  const toggleWeekday = (day: string) => {
    setNewTask((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    // For weekday recurrence, encode selected days into recurrence string, e.g. "weekdays:mon,tue,wed"
    let recurrenceValue = newTask.recurrence;
    if (newTask.recurrence === 'weekdays') {
      if (newTask.weekdays.length === 0) {
        showNotification('Bitte mindestens einen Wochentag auswählen.');
        return;
      }
      recurrenceValue = `weekdays:${newTask.weekdays.join(',')}`;
    }

    const res = await fetch(`${API_BASE}/api/tasks/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTask.title,
        points: newTask.points,
        assigned_to: newTask.assigned_to.length > 0 ? newTask.assigned_to : null,
        recurrence: recurrenceValue,
        due_time: newTask.due_time || null,
      }),
    });
    if (res.ok) {
      setNewTask({ title: '', points: 1, assigned_to: [], recurrence: 'daily', due_time: '', weekdays: [] });
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
    setRewards((prev) => prev.map((r) => (r.id === reward.id ? { ...r, active: !r.active } : r)));
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

  /** Assigned-to label: handles legacy single UUID, array, or null */
  const assignedLabel = (template: TaskTemplate): string => {
    if (!template.assigned_to) return 'Alle';
    const ids = Array.isArray(template.assigned_to) ? template.assigned_to : [template.assigned_to];
    if (ids.length === 0) return 'Alle';
    const names = ids.map((id) => users.find((u) => u.id === id)?.name ?? '?');
    return names.join(', ');
  };

  /** Human-readable recurrence label */
  const recurrenceLabel = (rec: string) => {
    if (rec === 'daily') return 'Täglich';
    if (rec === 'weekly') return 'Wöchentlich';
    if (rec === 'once') return 'Einmalig';
    if (rec.startsWith('weekdays:')) {
      const days = rec.replace('weekdays:', '').split(',');
      return days.map((d) => WEEKDAYS.find((w) => w.key === d)?.label ?? d).join(', ');
    }
    return rec;
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--family-bg)' }}>
        <PinModal
          title="Admin PIN"
          onSuccess={handlePinSuccess}
          onCancel={() => router.push('/')}
        />
      </div>
    );
  }

  const pendingClaims = claims.filter((c) => !c.approved_at);

  const tabConfig: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'tasks', label: 'Aufgaben', icon: 'checklist' },
    { id: 'rewards', label: `Belohnungen${pendingClaims.length > 0 ? ` (${pendingClaims.length})` : ''}`, icon: 'gift' },
    { id: 'users', label: 'Nutzer', icon: 'users' },
    { id: 'points', label: 'Punkte', icon: 'star' },
  ];

  // Input / select shared classes (light theme)
  const inputCls =
    'w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--family-accent)] border transition-colors';
  const inputStyle = {
    background: 'var(--family-surface2)',
    borderColor: '#d8d4cf',
    color: 'var(--family-text)',
  } as React.CSSProperties;

  return (
    <main className="min-h-screen p-4" style={{ background: 'var(--family-bg)' }}>
      {/* Notification */}
      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-6 py-3 font-semibold shadow-2xl text-white"
          style={{ background: 'var(--family-accent)' }}
        >
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border transition-all active:scale-95"
          style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf', color: 'var(--family-text2)' }}
        >
          <Icon name="arrow-left" />
        </button>
        <h1 className="text-xl font-bold flex-1 flex items-center gap-2" style={{ color: 'var(--family-text)' }}>
          <Icon name="settings" className="text-[var(--family-accent)]" />
          Admin
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 max-w-2xl mx-auto overflow-x-auto pb-1">
        {tabConfig.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5"
            style={
              tab === t.id
                ? { background: 'var(--family-accent)', color: '#fff', border: '1.5px solid transparent' }
                : { background: 'var(--family-surface)', color: 'var(--family-text2)', border: '1.5px solid #d8d4cf' }
            }
          >
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto">

        {/* ── Tasks Tab ── */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* Create task form */}
            <div
              className="rounded-2xl border p-4"
              style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf' }}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--family-text)' }}>
                <Icon name="plus" className="text-[var(--family-accent)]" />
                Neue Aufgabe
              </h3>
              <form onSubmit={handleCreateTask} className="space-y-3">
                <input
                  type="text"
                  placeholder="Aufgabenname"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Punkte</label>
                    <input
                      type="number"
                      min="1"
                      value={newTask.points}
                      onChange={(e) => setNewTask({ ...newTask, points: parseInt(e.target.value) })}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Wiederholung</label>
                    <select
                      value={newTask.recurrence}
                      onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value, weekdays: [] })}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekdays">Bestimmte Wochentage</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="once">Einmalig</option>
                    </select>
                  </div>
                </div>

                {/* Weekday picker — shown only when recurrence = weekdays */}
                {newTask.recurrence === 'weekdays' && (
                  <div>
                    <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                      Wochentage auswählen
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {WEEKDAYS.map((day) => {
                        const selected = newTask.weekdays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => toggleWeekday(day.key)}
                            className="w-10 h-10 rounded-xl text-sm font-bold transition-all active:scale-95"
                            style={
                              selected
                                ? { background: 'var(--family-accent)', color: '#fff', border: '2px solid var(--family-accent)' }
                                : { background: 'var(--family-surface2)', color: 'var(--family-text2)', border: '2px solid #d8d4cf' }
                            }
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Multi-user assignment */}
                <div>
                  <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                    Zugewiesen an
                    <span className="ml-1 font-normal" style={{ color: 'var(--family-text3)' }}>
                      {newTask.assigned_to.length === 0 ? '— Alle' : `(${newTask.assigned_to.length} ausgewählt)`}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {users.map((u) => {
                      const sel = newTask.assigned_to.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setNewTask((prev) => ({
                              ...prev,
                              assigned_to: sel
                                ? prev.assigned_to.filter((id) => id !== u.id)
                                : [...prev.assigned_to, u.id],
                            }))
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border-2"
                          style={
                            sel
                              ? { background: u.color + '22', borderColor: u.color, color: u.color }
                              : { background: 'var(--family-surface2)', borderColor: '#d8d4cf', color: 'var(--family-text3)' }
                          }
                        >
                          {u.photo ? (
                            <img src={u.photo} alt={u.name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 16 }}>{u.avatar}</span>
                          )}
                          {u.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Due time */}
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Uhrzeit (opt.)</label>
                  <input
                    type="time"
                    value={newTask.due_time}
                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 font-semibold rounded-xl transition-colors active:scale-95 text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--family-accent)' }}
                >
                  <Icon name="plus" />
                  Aufgabe erstellen
                </button>
              </form>
            </div>

            {/* Templates list */}
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 border transition-opacity"
                  style={{
                    background: 'var(--family-surface)',
                    borderColor: '#d8d4cf',
                    opacity: template.active ? 1 : 0.45,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--family-surface2)' }}
                  >
                    <Icon name="checklist" className="text-[var(--family-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--family-text)' }}>{template.title}</p>
                    <p className="text-xs" style={{ color: 'var(--family-text3)' }}>
                      {template.points} Pkt. • {recurrenceLabel(template.recurrence)} • {assignedLabel(template)}
                      {template.due_time && ` • ${template.due_time}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEdit(template)}
                      className="min-h-[36px] w-9 flex items-center justify-center rounded-lg text-sm transition-colors active:scale-95"
                      style={{ background: 'var(--family-surface2)', color: 'var(--family-text2)', border: '1px solid #d8d4cf' }}
                      title="Bearbeiten"
                    >
                      <Icon name="pencil" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="min-h-[36px] w-9 flex items-center justify-center rounded-lg text-sm transition-colors active:scale-95"
                      style={{ background: '#fee2e2', color: '#dc2626' }}
                      title="Löschen"
                    >
                      <Icon name="trash" />
                    </button>
                    <button
                      onClick={() => handleToggleTemplate(template)}
                      className="min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95"
                      style={
                        template.active
                          ? { background: '#fef3c7', color: '#92400e' }
                          : { background: '#dcfce7', color: '#16a34a' }
                      }
                    >
                      {template.active ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rewards Tab ── */}
        {tab === 'rewards' && (
          <div className="space-y-4">
            {pendingClaims.length > 0 && (
              <div
                className="rounded-2xl border p-4"
                style={{ background: '#fffbeb', borderColor: '#fbbf24' }}
              >
                <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#92400e' }}>
                  <Icon name="clock" />
                  Wartend auf Genehmigung
                </h3>
                <div className="space-y-2">
                  {pendingClaims.map((claim) => {
                    const claimUser = users.find((u) => u.id === claim.user_id);
                    return (
                      <div
                        key={claim.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 border"
                        style={{ background: '#fef3c7', borderColor: '#fcd34d' }}
                      >
                        {claimUser ? (
                          <UserAvatar user={claimUser} size={36} />
                        ) : (
                          <span className="text-2xl">{claim.user_avatar}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--family-text)' }}>{claim.reward_title}</p>
                          <p className="text-xs" style={{ color: 'var(--family-text2)' }}>
                            {claim.user_name} • {claim.points_cost} Pkt.
                          </p>
                        </div>
                        <button
                          onClick={() => handleApproveClaim(claim.id)}
                          className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-white transition-colors active:scale-95 flex items-center gap-1"
                          style={{ background: '#16a34a' }}
                        >
                          <Icon name="check" />
                          Genehmigen
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Create reward form */}
            <div
              className="rounded-2xl border p-4"
              style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf' }}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--family-text)' }}>
                <Icon name="plus" className="text-[var(--family-accent)]" />
                Neue Belohnung
              </h3>
              <form onSubmit={handleCreateReward} className="space-y-3">
                <input
                  type="text"
                  placeholder="Belohnungsname"
                  value={newReward.title}
                  onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Punktekosten</label>
                    <input
                      type="number"
                      min="1"
                      value={newReward.points_cost}
                      onChange={(e) => setNewReward({ ...newReward, points_cost: parseInt(e.target.value) })}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Verfügbar für</label>
                    <select
                      value={newReward.available_to}
                      onChange={(e) => setNewReward({ ...newReward, available_to: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
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
                  className="w-full py-3 font-semibold rounded-xl transition-colors active:scale-95 text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--family-accent)' }}
                >
                  <Icon name="plus" />
                  Belohnung erstellen
                </button>
              </form>
            </div>

            {/* Rewards list */}
            <div className="space-y-2">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 border transition-opacity"
                  style={{
                    background: 'var(--family-surface)',
                    borderColor: '#d8d4cf',
                    opacity: reward.active ? 1 : 0.45,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--family-surface2)' }}
                  >
                    <Icon name="gift" className="text-[var(--family-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--family-text)' }}>{reward.title}</p>
                    <p className="text-xs" style={{ color: 'var(--family-text3)' }}>
                      {reward.points_cost} Pkt. • {reward.available_to_name ?? 'Alle'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleReward(reward)}
                    className="min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95"
                    style={
                      reward.active
                        ? { background: '#fee2e2', color: '#dc2626' }
                        : { background: '#dcfce7', color: '#16a34a' }
                    }
                  >
                    {reward.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf' }}
              >
                <UserAvatar user={user} size={44} />
                <div className="flex-1">
                  <p className="font-bold" style={{ color: user.color }}>{user.name}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--family-text3)' }}>
                    {user.role === 'parent'
                      ? <><Icon name="crown" />&nbsp;Elternteil</>
                      : <><Icon name="user" />&nbsp;Kind</>
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold flex items-center gap-1 justify-end" style={{ color: user.color }}>
                    <Icon name="star" />{user.points}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--family-text3)' }}>Punkte</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Points Tab ── */}
        {tab === 'points' && (
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-4"
              style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf' }}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--family-text)' }}>
                <Icon name="adjustments-horizontal" className="text-[var(--family-accent)]" />
                Punkte manuell anpassen
              </h3>
              <form onSubmit={handleManualPoints} className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Nutzer</label>
                  <select
                    value={manualPoints.user_id}
                    onChange={(e) => setManualPoints({ ...manualPoints, user_id: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                    required
                  >
                    <option value="">Nutzer wählen</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.avatar} {u.name} (aktuell: {u.points} Pkt.)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                    Punkte (negativ zum Abziehen)
                  </label>
                  <input
                    type="number"
                    value={manualPoints.points}
                    onChange={(e) => setManualPoints({ ...manualPoints, points: parseInt(e.target.value) })}
                    className={inputCls}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Grund (optional)</label>
                  <input
                    type="text"
                    placeholder="z.B. Bonus, Strafe..."
                    value={manualPoints.reason}
                    onChange={(e) => setManualPoints({ ...manualPoints, reason: e.target.value })}
                    className={inputCls}
                    style={{ ...inputStyle }}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 font-semibold rounded-xl transition-colors active:scale-95 text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--family-accent)' }}
                >
                  <Icon name="check" />
                  Punkte anpassen
                </button>
              </form>
            </div>

            {/* Users point summary */}
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                  style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf' }}
                >
                  <UserAvatar user={user} size={40} />
                  <p className="flex-1 font-semibold" style={{ color: user.color }}>{user.name}</p>
                  <p className="font-bold text-lg flex items-center gap-1" style={{ color: user.color }}>
                    <Icon name="star" />{user.points}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Template Drawer ── */}
      {editingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingTemplate(null); }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto"
            style={{ background: 'var(--family-bg)', maxHeight: '92dvh' }}
          >
            {/* Drawer header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--family-text3)' }}>Aufgabe bearbeiten</p>
                <p className="font-bold text-lg leading-tight truncate" style={{ color: 'var(--family-text)' }}>{editingTemplate.title}</p>
              </div>
              <button
                onClick={() => setEditingTemplate(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl"
                style={{ background: 'var(--family-surface2)', color: 'var(--family-text2)' }}
              >
                <Icon name="x" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Aufgabenname</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Points + Recurrence */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Punkte</label>
                  <input
                    type="number" min="1"
                    value={editForm.points}
                    onChange={(e) => setEditForm({ ...editForm, points: parseInt(e.target.value) })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Wiederholung</label>
                  <select
                    value={editForm.recurrence}
                    onChange={(e) => setEditForm({ ...editForm, recurrence: e.target.value, weekdays: [] })}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="daily">Täglich</option>
                    <option value="weekdays">Bestimmte Wochentage</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="once">Einmalig</option>
                  </select>
                </div>
              </div>

              {/* Weekday picker for edit */}
              {editForm.recurrence === 'weekdays' && (
                <div>
                  <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>Wochentage</label>
                  <div className="flex gap-2 flex-wrap">
                    {WEEKDAYS.map((day) => {
                      const sel = editForm.weekdays.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => setEditForm((prev) => ({
                            ...prev,
                            weekdays: sel ? prev.weekdays.filter((d) => d !== day.key) : [...prev.weekdays, day.key],
                          }))}
                          className="w-10 h-10 rounded-xl text-sm font-bold transition-all active:scale-95"
                          style={sel
                            ? { background: 'var(--family-accent)', color: '#fff', border: '2px solid var(--family-accent)' }
                            : { background: 'var(--family-surface2)', color: 'var(--family-text2)', border: '2px solid #d8d4cf' }}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Assigned to */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                  Zugewiesen an
                  <span className="ml-1 font-normal" style={{ color: 'var(--family-text3)' }}>
                    {editForm.assigned_to.length === 0 ? '— Alle' : `(${editForm.assigned_to.length} ausgewählt)`}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => {
                    const sel = editForm.assigned_to.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setEditForm((prev) => ({
                          ...prev,
                          assigned_to: sel ? prev.assigned_to.filter((id) => id !== u.id) : [...prev.assigned_to, u.id],
                        }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border-2"
                        style={sel
                          ? { background: u.color + '22', borderColor: u.color, color: u.color }
                          : { background: 'var(--family-surface2)', borderColor: '#d8d4cf', color: 'var(--family-text3)' }}
                      >
                        {u.photo
                          ? <img src={u.photo} alt={u.name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 16 }}>{u.avatar}</span>}
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due time */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Uhrzeit (opt.)</label>
                <input
                  type="time"
                  value={editForm.due_time}
                  onChange={(e) => setEditForm({ ...editForm, due_time: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="flex-1 py-3 font-semibold rounded-xl transition-colors active:scale-95"
                  style={{ background: 'var(--family-surface2)', color: 'var(--family-text2)', border: '1px solid #d8d4cf' }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 font-semibold rounded-xl transition-colors active:scale-95 text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--family-accent)' }}
                >
                  <Icon name="check" />
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}