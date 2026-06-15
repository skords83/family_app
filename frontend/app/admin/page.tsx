'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PinModal from '@/components/ui/PinModal';
import { useSSE } from '@/hooks/useSSE';
import PageHeader from '@/components/ui/PageHeader';

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

// Vorgeschlagene Emojis für schnelle Auswahl. Kein Anspruch auf Vollständigkeit —
// Eltern können beliebige Emojis ins Textfeld tippen oder pasten.
const ICON_PRESETS = ['🦷', '🛏️', '📚', '🍽️', '🚿', '🗑️', '👕', '🧹', '🎵', '🌱', '🐕', '✨'];

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
  assigned_to: string | string[] | null;
  assigned_to_name?: string;
  recurrence: string;
  due_time: string | null;
  active: boolean;
  requires_approval: boolean;
  icon: string | null;
  category: string | null;
  due_date: string | null;       // YYYY-MM-DD
  valid_from: string | null;     // YYYY-MM-DD
  valid_until: string | null;    // YYYY-MM-DD
  rotation: boolean;
  available_from: string | null; // HH:MM — Aufgabe vor dieser Uhrzeit nicht abhakbar
}

interface Reward {
  id: string;
  title: string;
  points_cost: number;
  available_to: string | string[] | null;
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

interface PendingTaskApproval {
  id: string;
  template_id: string;
  assigned_to: string;
  date: string;
  completed_at: string;
  title: string;
  points: number;
  user_name: string;
  user_avatar: string;
  user_photo?: string;
  user_color: string;
}

interface CompletedTodayTask {
  id: string;
  template_id: string;
  assigned_to: string;
  date: string;
  completed_at: string;
  approved_at: string | null;
  title: string;
  points: number;
  icon: string | null;
  requires_approval: boolean;
  user_name: string;
  user_avatar: string;
  user_photo?: string;
  user_color: string;
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

/** Format YYYY-MM-DD → DD.MM.YYYY for display */
function formatDateDe(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
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
  const [pendingApprovals, setPendingApprovals] = useState<PendingTaskApproval[]>([]);
  const [completedToday, setCompletedToday] = useState<CompletedTodayTask[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Forms
  const [newTask, setNewTask] = useState({
    title: '',
    points: 1,
    assigned_to: [] as string[],
    recurrence: 'daily',
    due_time: '',
    weekdays: [] as string[],
    requires_approval: false,
    icon: '',
    category: '',
    due_date: '',
    valid_from: '',
    valid_until: '',
    rotation: false,
    available_from: '',
  });
  const [newReward, setNewReward] = useState({ title: '', points_cost: 50, available_to: [] as string[] });
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editRewardForm, setEditRewardForm] = useState({ title: '', points_cost: 50, available_to: [] as string[] });
  const [manualPoints, setManualPoints] = useState({ user_id: '', points: 0, reason: '' });

  const showNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = useCallback(async () => {
    const [usersRes, templatesRes, rewardsRes, claimsRes, pendingRes, completedRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/users`).then((r) => r.json()),
      fetch(`${API_BASE}/api/tasks/templates`).then((r) => r.json()),
      fetch(`${API_BASE}/api/rewards?admin=true`).then((r) => r.json()),
      fetch(`${API_BASE}/api/rewards/claims`).then((r) => r.json()),
      fetch(`${API_BASE}/api/tasks/instances/pending-approval`).then((r) => r.json()),
      fetch(`${API_BASE}/api/tasks/instances/completed-today`).then((r) => r.json()),
    ]);

    if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) setUsers(usersRes.value);
    if (templatesRes.status === 'fulfilled' && Array.isArray(templatesRes.value)) setTemplates(templatesRes.value);
    if (rewardsRes.status === 'fulfilled' && Array.isArray(rewardsRes.value)) setRewards(rewardsRes.value);
    if (claimsRes.status === 'fulfilled' && Array.isArray(claimsRes.value)) setClaims(claimsRes.value);
    if (pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value)) setPendingApprovals(pendingRes.value);
    if (completedRes.status === 'fulfilled' && Array.isArray(completedRes.value)) setCompletedToday(completedRes.value);
  }, []);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  // ── Granulare Fetcher für SSE-Updates ──
  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/users`).then(r => r.json());
    if (Array.isArray(res)) setUsers(res);
  }, []);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/tasks/templates`).then(r => r.json());
    if (Array.isArray(res)) setTemplates(res);
  }, []);

  const fetchRewards = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/rewards?admin=true`).then(r => r.json());
    if (Array.isArray(res)) setRewards(res);
  }, []);

  const fetchClaims = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/rewards/claims`).then(r => r.json());
    if (Array.isArray(res)) setClaims(res);
  }, []);

  const fetchPendingApprovals = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/tasks/instances/pending-approval`).then(r => r.json());
    if (Array.isArray(res)) setPendingApprovals(res);
  }, []);

  const fetchCompletedToday = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/tasks/instances/completed-today`).then(r => r.json());
    if (Array.isArray(res)) setCompletedToday(res);
  }, []);

  const handleRewardClaimed = useCallback(() => {
    fetchClaims();
    fetchRewards();
  }, [fetchClaims, fetchRewards]);

  const handleTaskUpdated = useCallback(() => {
    fetchTemplates();
    fetchPendingApprovals();
    fetchCompletedToday();
  }, [fetchTemplates, fetchPendingApprovals, fetchCompletedToday]);

  // SSE-Subscription nur wenn authentifiziert
  useSSE(authenticated ? {
    points_updated: fetchUsers,
    task_updated: handleTaskUpdated,
    task_uncompleted: handleTaskUpdated,
    reward_claimed: handleRewardClaimed,
  } : {});

  const handlePinSuccess = (pin: string) => {
    setAdminPin(pin);
    setAuthenticated(true);
  };

  // Bestehende Kategorien für Auto-Vorschläge
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [templates]);

  // ── Edit drawer state ──
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    points: 1,
    assigned_to: [] as string[],
    recurrence: 'daily',
    due_time: '',
    weekdays: [] as string[],
    requires_approval: false,
    icon: '',
    category: '',
    due_date: '',
    valid_from: '',
    valid_until: '',
    rotation: false,
    available_from: '',
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
    } else if (template.recurrence.startsWith('biweekly:')) {
      weekdays = template.recurrence.replace('biweekly:', '').split(',');
      recurrence = 'biweekly';
    }
    setEditForm({
      title: template.title,
      points: template.points,
      assigned_to: ids,
      recurrence,
      due_time: template.due_time ?? '',
      weekdays,
      requires_approval: template.requires_approval ?? false,
      icon: template.icon ?? '',
      category: template.category ?? '',
      due_date: template.due_date ?? '',
      valid_from: template.valid_from ?? '',
      valid_until: template.valid_until ?? '',
      rotation: template.rotation ?? false,
      available_from: template.available_from ?? '',
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
    } else if (editForm.recurrence === 'biweekly') {
      if (editForm.weekdays.length === 0) { showNotification('Bitte mindestens einen Wochentag auswählen.'); return; }
      if (!editForm.valid_from) { showNotification('Bei "Alle 14 Tage" ist ein Startdatum (Gültig ab) erforderlich.'); return; }
      recurrenceValue = `biweekly:${editForm.weekdays.join(',')}`;
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
        requires_approval: editForm.requires_approval,
        icon: editForm.icon || null,
        category: editForm.category || null,
        due_date: editForm.recurrence === 'once' ? (editForm.due_date || null) : null,
        valid_from: editForm.recurrence !== 'once' ? (editForm.valid_from || null) : null,
        valid_until: editForm.recurrence !== 'once' ? (editForm.valid_until || null) : null,
        rotation: editForm.assigned_to.length > 1 ? editForm.rotation : false,
        available_from: editForm.available_from || null,
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
      // Falls aus dem Edit-Drawer gelöscht wurde, diesen ebenfalls schließen
      if (editingTemplate?.id === template.id) setEditingTemplate(null);
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
    let recurrenceValue = newTask.recurrence;
    if (newTask.recurrence === 'weekdays') {
      if (newTask.weekdays.length === 0) {
        showNotification('Bitte mindestens einen Wochentag auswählen.');
        return;
      }
      recurrenceValue = `weekdays:${newTask.weekdays.join(',')}`;
    } else if (newTask.recurrence === 'biweekly') {
      if (newTask.weekdays.length === 0) {
        showNotification('Bitte mindestens einen Wochentag auswählen.');
        return;
      }
      if (!newTask.valid_from) {
        showNotification('Bei "Alle 14 Tage" ist ein Startdatum (Gültig ab) erforderlich.');
        return;
      }
      recurrenceValue = `biweekly:${newTask.weekdays.join(',')}`;
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
        requires_approval: newTask.requires_approval,
        icon: newTask.icon || null,
        category: newTask.category || null,
        due_date: newTask.recurrence === 'once' ? (newTask.due_date || null) : null,
        valid_from: newTask.recurrence !== 'once' ? (newTask.valid_from || null) : null,
        valid_until: newTask.recurrence !== 'once' ? (newTask.valid_until || null) : null,
        rotation: newTask.assigned_to.length > 1 ? newTask.rotation : false,
        available_from: newTask.available_from || null,
      }),
    });
    if (res.ok) {
      setNewTask({
        title: '', points: 1, assigned_to: [], recurrence: 'daily',
        due_time: '', weekdays: [], requires_approval: false,
        icon: '', category: '', due_date: '', valid_from: '', valid_until: '', rotation: false,
        available_from: '',
      });
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
        available_to: newReward.available_to.length > 0 ? newReward.available_to : null,
        pin: adminPin,
      }),
    });
    if (res.ok) {
      setNewReward({ title: '', points_cost: 50, available_to: [] });
      showNotification('Belohnung erstellt!');
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      showNotification(`Fehler: ${err.error ?? res.status}`);
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

  const openEditReward = (reward: Reward) => {
    const ids = Array.isArray(reward.available_to)
      ? reward.available_to
      : reward.available_to ? [reward.available_to] : [];
    setEditRewardForm({ title: reward.title, points_cost: reward.points_cost, available_to: ids });
    setEditingReward(reward);
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward) return;
    const res = await fetch(`${API_BASE}/api/rewards/${editingReward.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editRewardForm.title,
        points_cost: editRewardForm.points_cost,
        available_to: editRewardForm.available_to.length > 0 ? editRewardForm.available_to : null,
        pin: adminPin,
      }),
    });
    if (res.ok) {
      setEditingReward(null);
      showNotification('Belohnung gespeichert!');
      fetchData();
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    if (!confirm(`"${reward.title}" wirklich löschen?`)) return;
    const res = await fetch(`${API_BASE}/api/rewards/${reward.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: adminPin }),
    });
    if (res.ok) {
      setRewards((prev) => prev.filter((r) => r.id !== reward.id));
      showNotification('Belohnung gelöscht.');
    }
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

  const handleApproveTask = async (instanceId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${instanceId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: adminPin }),
    });
    if (res.ok) {
      showNotification('Aufgabe bestätigt! Punkte gutgeschrieben.');
      fetchPendingApprovals();
      fetchUsers();
    } else {
      const err = await res.json().catch(() => ({}));
      showNotification(`Fehler: ${err.error ?? res.status}`);
    }
  };

  const handleRejectTask = async (instanceId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${instanceId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: adminPin }),
    });
    if (res.ok) {
      showNotification('Aufgabe abgelehnt – zurück auf offen.');
      fetchPendingApprovals();
    } else {
      const err = await res.json().catch(() => ({}));
      showNotification(`Fehler: ${err.error ?? res.status}`);
    }
  };

  const handleUncompleteTask = async (instanceId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${instanceId}/uncomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      showNotification('Aufgabe zurückgesetzt. Kind wird benachrichtigt.');
      fetchCompletedToday();
      fetchPendingApprovals();
      fetchUsers();
    } else {
      const err = await res.json().catch(() => ({}));
      showNotification(`Fehler: ${err.error ?? res.status}`);
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

  /** Human-readable recurrence label including dates if present */
  const recurrenceLabel = (template: TaskTemplate): string => {
    const rec = template.recurrence;
    if (rec === 'daily') return 'Täglich';
    if (rec === 'weekly') return 'Wöchentlich';
    if (rec === 'once') {
      return template.due_date ? `Einmalig am ${formatDateDe(template.due_date)}` : 'Einmalig';
    }
    if (rec.startsWith('weekdays:')) {
      const days = rec.replace('weekdays:', '').split(',');
      return days.map((d) => WEEKDAYS.find((w) => w.key === d)?.label ?? d).join(', ');
    }
    if (rec.startsWith('biweekly:')) {
      const days = rec.replace('biweekly:', '').split(',');
      const dayLabels = days.map((d) => WEEKDAYS.find((w) => w.key === d)?.label ?? d).join(', ');
      return `Alle 14 Tage (${dayLabels})`;
    }
    return rec;
  };

  const verifyAdminPin = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/verify-parent-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      return data.valid === true;
    } catch {
      return false;
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--family-bg)' }}>
        <PinModal
          title="Admin PIN"
          onSuccess={handlePinSuccess}
          onCancel={() => router.push('/')}
          verify={verifyAdminPin}
        />
      </div>
    );
  }

  const pendingClaims = claims.filter((c) => !c.approved_at);

  const tabConfig: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'tasks', label: 'Aufgaben', icon: 'checklist' },
    { id: 'rewards', label: `Belohnungen${pendingClaims.length > 0 ? ` (${pendingClaims.length})` : ''}`, icon: 'gift' },
    { id: 'users', label: `Nutzer${pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ''}`, icon: 'users' },
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
    <main className="min-h-screen" style={{ background: 'var(--family-bg)' }}>
      <PageHeader title="Einstellungen" variant="page" />

      {/* Notification */}
      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-6 py-3 font-semibold shadow-2xl text-white"
          style={{ background: 'var(--family-accent)' }}
        >
          {notification}
        </div>
      )}

      <div className="px-4 pb-4 max-w-2xl mx-auto">

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
                {/* Icon + Title */}
                <div className="flex gap-3">
                  <div style={{ width: 72, flexShrink: 0 }}>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Icon</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="🦷"
                      value={newTask.icon}
                      onChange={(e) => setNewTask({ ...newTask, icon: e.target.value })}
                      className={inputCls}
                      style={{ ...inputStyle, textAlign: 'center', fontSize: 22, paddingLeft: 4, paddingRight: 4 }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Aufgabenname</label>
                    <input
                      type="text"
                      placeholder="z.B. Zähne putzen"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {/* Icon presets */}
                <div className="flex flex-wrap gap-1.5">
                  {ICON_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewTask({ ...newTask, icon: emoji })}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 hover:scale-110"
                      style={{
                        background: newTask.icon === emoji ? 'var(--family-accent)' + '22' : 'var(--family-surface2)',
                        border: `1px solid ${newTask.icon === emoji ? 'var(--family-accent)' : '#d8d4cf'}`,
                        fontSize: 18,
                      }}
                      title={`Icon: ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

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
                      <option value="biweekly">Alle 14 Tage</option>
                      <option value="once">Einmalig</option>
                    </select>
                  </div>
                </div>

                {/* Weekday picker — both for 'weekdays' and 'biweekly' */}
                {(newTask.recurrence === 'weekdays' || newTask.recurrence === 'biweekly') && (
                  <div>
                    <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                      {newTask.recurrence === 'biweekly' ? 'Wochentag (alle 14 Tage)' : 'Wochentage auswählen'}
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

                {/* Due date (only for 'once') */}
                {newTask.recurrence === 'once' && (
                  <div
                    className="rounded-xl p-3 border-2 border-dashed"
                    style={{ borderColor: 'var(--family-accent)', background: 'var(--family-accent)' + '08' }}
                  >
                    <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--family-accent)' }}>
                      <Icon name="calendar-event" />&nbsp;Fälligkeitsdatum&nbsp;
                      <span className="font-normal" style={{ color: 'var(--family-text3)' }}>
                        (leer = sofort heute)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Valid from/until (only for recurring) */}
                {newTask.recurrence !== 'once' && (
                  <div
                    className={newTask.recurrence === 'biweekly' ? 'rounded-xl p-3 border-2 border-dashed' : ''}
                    style={newTask.recurrence === 'biweekly'
                      ? { borderColor: 'var(--family-accent)', background: 'var(--family-accent)' + '08' }
                      : undefined
                    }
                  >
                    {newTask.recurrence === 'biweekly' && (
                      <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--family-accent)' }}>
                        <Icon name="calendar-event" />&nbsp;Start-Anker — ab diesem Datum wird alle 14 Tage gerechnet
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                          Gültig ab {newTask.recurrence === 'biweekly'
                            ? <span style={{ color: 'var(--family-accent)' }}>(Pflicht)</span>
                            : <span style={{ color: 'var(--family-text3)' }}>(opt.)</span>}
                        </label>
                        <input
                          type="date"
                          value={newTask.valid_from}
                          onChange={(e) => setNewTask({ ...newTask, valid_from: e.target.value })}
                          className={inputCls}
                          style={inputStyle}
                          required={newTask.recurrence === 'biweekly'}
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                          Gültig bis <span style={{ color: 'var(--family-text3)' }}>(opt.)</span>
                        </label>
                        <input
                          type="date"
                          value={newTask.valid_until}
                          onChange={(e) => setNewTask({ ...newTask, valid_until: e.target.value })}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
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

                {/* Rotation toggle (only when multiple users assigned) */}
                {newTask.assigned_to.length > 1 && (
                  <label
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-colors"
                    style={{
                      background: newTask.rotation ? '#dbeafe' : 'var(--family-surface2)',
                      borderColor: newTask.rotation ? '#3b82f6' : '#d8d4cf',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newTask.rotation}
                      onChange={(e) => setNewTask({ ...newTask, rotation: e.target.checked })}
                      className="w-4 h-4 accent-[var(--family-accent)]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: newTask.rotation ? '#1e40af' : 'var(--family-text2)' }}>
                        <Icon name="refresh" />&nbsp;Faire Rotation
                      </p>
                      <p className="text-xs" style={{ color: 'var(--family-text3)' }}>
                        Nur ein Kind pro Tag — wechselt fair durch (z.B. Geschirrspüler)
                      </p>
                    </div>
                  </label>
                )}

                {/* Category */}
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                    Kategorie <span style={{ color: 'var(--family-text3)' }}>(opt.)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Hygiene, Schule, Haushalt"
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                    list="task-categories"
                  />
                  {existingCategories.length > 0 && (
                    <datalist id="task-categories">
                      {existingCategories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  )}
                  {existingCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {existingCategories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewTask({ ...newTask, category: c })}
                          className="px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95"
                          style={{
                            background: newTask.category === c ? 'var(--family-accent)' + '22' : 'var(--family-surface2)',
                            border: `1px solid ${newTask.category === c ? 'var(--family-accent)' : '#d8d4cf'}`,
                            color: newTask.category === c ? 'var(--family-accent)' : 'var(--family-text3)',
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Zeitfenster (Verfügbar ab / Verfügbar bis) ── */}
                <div
                  className="rounded-xl p-3 space-y-3"
                  style={{ background: 'var(--family-surface2)', border: '1px solid #d8d4cf' }}
                >
                  <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--family-text2)' }}>
                    <Icon name="clock-hour-4" />
                    Zeitfenster <span className="font-normal" style={{ color: 'var(--family-text3)' }}>(opt.)</span>
                  </p>

                  {/* Verfügbar ab */}
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--family-text2)' }}>
                      Verfügbar ab
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="time"
                        value={newTask.available_from}
                        onChange={(e) => setNewTask({ ...newTask, available_from: e.target.value })}
                        className={inputCls}
                        style={{ ...inputStyle, flex: 1, background: '#fff' }}
                      />
                      {newTask.available_from && (
                        <button
                          type="button"
                          onClick={() => setNewTask({ ...newTask, available_from: '' })}
                          className="px-3 py-2 rounded-lg text-xs"
                          style={{ background: '#fff', color: 'var(--family-text3)', border: '1px solid #d8d4cf' }}
                        >
                          <Icon name="x" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[
                        { label: 'Ganztägig', value: '' },
                        { label: 'Ab 13:00 (nach Schule)', value: '13:00' },
                        { label: 'Ab 18:00 (abends)', value: '18:00' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setNewTask({ ...newTask, available_from: preset.value })}
                          className="px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95"
                          style={{
                            background: newTask.available_from === preset.value ? 'var(--family-accent)' + '22' : '#fff',
                            border: `1px solid ${newTask.available_from === preset.value ? 'var(--family-accent)' : '#d8d4cf'}`,
                            color: newTask.available_from === preset.value ? 'var(--family-accent)' : 'var(--family-text3)',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--family-text3)' }}>
                      Aufgabe wird vor dieser Uhrzeit nicht angezeigt.
                    </p>
                  </div>

                  {/* Verfügbar bis (Deadline) */}
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--family-text2)' }}>
                      Verfügbar bis
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="time"
                        value={newTask.due_time}
                        onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                        className={inputCls}
                        style={{ ...inputStyle, flex: 1, background: '#fff' }}
                      />
                      {newTask.due_time && (
                        <button
                          type="button"
                          onClick={() => setNewTask({ ...newTask, due_time: '' })}
                          className="px-3 py-2 rounded-lg text-xs"
                          style={{ background: '#fff', color: 'var(--family-text3)', border: '1px solid #d8d4cf' }}
                        >
                          <Icon name="x" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[
                        { label: 'Keine Deadline', value: '' },
                        { label: 'Bis 10:00', value: '10:00' },
                        { label: 'Bis 16:00', value: '16:00' },
                        { label: 'Bis 18:00', value: '18:00' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setNewTask({ ...newTask, due_time: preset.value })}
                          className="px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95"
                          style={{
                            background: newTask.due_time === preset.value ? '#fff0e6' : '#fff',
                            border: `1px solid ${newTask.due_time === preset.value ? '#c2410c' : '#d8d4cf'}`,
                            color: newTask.due_time === preset.value ? '#c2410c' : 'var(--family-text3)',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--family-text3)' }}>
                      Deadline — danach kann die Aufgabe nicht mehr erledigt werden.
                    </p>
                  </div>
                </div>

                {/* Requires approval toggle */}
                <label
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-colors"
                  style={{
                    background: newTask.requires_approval ? '#fef3c722' : 'var(--family-surface2)',
                    borderColor: newTask.requires_approval ? '#f0a500' : '#d8d4cf',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newTask.requires_approval}
                    onChange={(e) => setNewTask({ ...newTask, requires_approval: e.target.checked })}
                    className="w-4 h-4 accent-[var(--family-accent)]"
                  />
                  <span className="text-sm" style={{ color: 'var(--family-text2)' }}>
                    Muss von Elternteil bestätigt werden
                  </span>
                </label>

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

            {/* Templates list header */}
            <div className="flex items-center gap-2 pl-2" style={{ color: 'var(--family-text2)' }}>
              <Icon name="list" />
              <p className="font-bold text-sm">Vorlagen ({templates.length})</p>
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
                    style={{ background: 'var(--family-surface2)', fontSize: template.icon ? 20 : undefined }}
                  >
                    {template.icon
                      ? <span>{template.icon}</span>
                      : <Icon name="checklist" className="text-[var(--family-accent)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--family-text)' }}>{template.title}</p>
                    <p className="text-xs" style={{ color: 'var(--family-text3)' }}>
                      {template.points} Pkt. • {recurrenceLabel(template)} • {assignedLabel(template)}
                      {template.recurrence !== 'once' && (template.valid_from || template.valid_until) && (
                        <span className="ml-1" style={{ color: 'var(--family-text3)' }}>
                          {' '}• {template.valid_from ? `ab ${formatDateDe(template.valid_from)}` : ''}
                          {template.valid_from && template.valid_until ? ' ' : ''}
                          {template.valid_until ? `bis ${formatDateDe(template.valid_until)}` : ''}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.category && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                          <Icon name="tag" />&nbsp;{template.category}
                        </span>
                      )}
                      {template.available_from && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                          <Icon name="clock" />&nbsp;ab {template.available_from}
                        </span>
                      )}
                      {template.due_time && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#fff0e6', color: '#c2410c' }}>
                          <Icon name="clock-exclamation" />&nbsp;bis {template.due_time}
                        </span>
                      )}
                      {template.rotation && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#dbeafe', color: '#1e40af' }}>
                          <Icon name="refresh" />&nbsp;Rotation
                        </span>
                      )}
                      {template.requires_approval && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                          ✓ Bestätigung nötig
                        </span>
                      )}
                    </div>
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
                </div>
                <div>
                  <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                    Verfügbar für
                    <span className="ml-1 font-normal" style={{ color: 'var(--family-text3)' }}>
                      {newReward.available_to.length === 0 ? '— Alle' : `(${newReward.available_to.length} ausgewählt)`}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {users.map((u) => {
                      const sel = newReward.available_to.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setNewReward((prev) => ({
                              ...prev,
                              available_to: sel
                                ? prev.available_to.filter((id) => id !== u.id)
                                : [...prev.available_to, u.id],
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
                      {reward.points_cost} Pkt. • {
                        !reward.available_to || (Array.isArray(reward.available_to) && reward.available_to.length === 0)
                          ? 'Alle'
                          : Array.isArray(reward.available_to)
                            ? reward.available_to.map((id) => users.find((u) => u.id === id)?.name ?? '?').join(', ')
                            : (users.find((u) => u.id === reward.available_to)?.name ?? reward.available_to_name ?? 'Alle')
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEditReward(reward)}
                      className="min-h-[36px] w-9 flex items-center justify-center rounded-lg text-sm transition-colors active:scale-95"
                      style={{ background: 'var(--family-surface2)', color: 'var(--family-text2)', border: '1px solid #d8d4cf' }}
                      title="Bearbeiten"
                    >
                      <Icon name="pencil" />
                    </button>
                    <button
                      onClick={() => handleDeleteReward(reward)}
                      className="min-h-[36px] w-9 flex items-center justify-center rounded-lg text-sm transition-colors active:scale-95"
                      style={{ background: '#fee2e2', color: '#dc2626' }}
                      title="Löschen"
                    >
                      <Icon name="trash" />
                    </button>
                    <button
                      onClick={() => handleToggleReward(reward)}
                      className="min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95"
                      style={
                        reward.active
                          ? { background: '#fef3c7', color: '#92400e' }
                          : { background: '#dcfce7', color: '#16a34a' }
                      }
                    >
                      {reward.active ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Pending approvals */}
            {pendingApprovals.length > 0 && (
              <div
                className="rounded-2xl border p-4"
                style={{ background: '#fffbeb', borderColor: '#fbbf24' }}
              >
                <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#92400e' }}>
                  <Icon name="clock" />
                  Aufgaben wartend auf Bestätigung
                </h3>
                <div className="space-y-2">
                  {pendingApprovals.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 border"
                      style={{ background: '#fef3c7', borderColor: '#fcd34d' }}
                    >
                      <UserAvatar user={{ avatar: item.user_avatar, photo: item.user_photo, name: item.user_name, color: item.user_color }} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--family-text)' }}>{item.title}</p>
                        <p className="text-xs" style={{ color: 'var(--family-text2)' }}>
                          {item.user_name} • {item.points} Pkt.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleRejectTask(item.id)}
                          className="min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95 flex items-center gap-1"
                          style={{ background: '#fee2e2', color: '#dc2626' }}
                        >
                          <Icon name="x" />
                          Ablehnen
                        </button>
                        <button
                          onClick={() => handleApproveTask(item.id)}
                          className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-white transition-colors active:scale-95 flex items-center gap-1"
                          style={{ background: '#16a34a' }}
                        >
                          <Icon name="check" />
                          Bestätigen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Heutige erledigte Aufgaben — Rückgängig */}
            {completedToday.length > 0 && (
              <div
                className="rounded-2xl border p-4"
                style={{ background: 'var(--family-surface)', borderColor: '#d8d4cf' }}
              >
                <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--family-text)' }}>
                  <Icon name="arrow-back-up" />
                  Heutige Aufgaben zurücknehmen
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--family-text3)' }}>
                  Erledigte Aufgaben von heute. Bei Rücknahme wird das Kind benachrichtigt.
                </p>
                <div className="space-y-2">
                  {completedToday.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 border"
                      style={{ background: item.approved_at ? '#f0fdf4' : item.requires_approval ? '#fffbeb' : '#f0fdf4', borderColor: '#d8d4cf' }}
                    >
                      <UserAvatar user={{ avatar: item.user_avatar, photo: item.user_photo, name: item.user_name, color: item.user_color }} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--family-text)' }}>
                          {item.icon && <span>{item.icon}</span>}
                          {item.title}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--family-text3)' }}>
                          {item.user_name} • {item.points} Pkt.
                          {item.requires_approval && !item.approved_at && ' • wartend'}
                          {item.approved_at && ' • bestätigt'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUncompleteTask(item.id)}
                        className="min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors active:scale-95 flex items-center gap-1"
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        <Icon name="arrow-back-up" />
                        Rückgängig
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutzerliste */}
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
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--family-text3)' }}>Aufgabe bearbeiten</p>
                <p className="font-bold text-lg leading-tight truncate" style={{ color: 'var(--family-text)' }}>
                  {editingTemplate.icon ? <span style={{ marginRight: 6 }}>{editingTemplate.icon}</span> : null}
                  {editingTemplate.title}
                </p>
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
              {/* Icon + Title */}
              <div className="flex gap-3">
                <div style={{ width: 72, flexShrink: 0 }}>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Icon</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="🦷"
                    value={editForm.icon}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    className={inputCls}
                    style={{ ...inputStyle, textAlign: 'center', fontSize: 22, paddingLeft: 4, paddingRight: 4 }}
                  />
                </div>
                <div className="flex-1">
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
              </div>

              {/* Icon presets */}
              <div className="flex flex-wrap gap-1.5">
                {ICON_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, icon: emoji })}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 hover:scale-110"
                    style={{
                      background: editForm.icon === emoji ? 'var(--family-accent)' + '22' : 'var(--family-surface2)',
                      border: `1px solid ${editForm.icon === emoji ? 'var(--family-accent)' : '#d8d4cf'}`,
                      fontSize: 18,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

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
                    <option value="biweekly">Alle 14 Tage</option>
                    <option value="once">Einmalig</option>
                  </select>
                </div>
              </div>

              {/* Weekday picker for edit — both 'weekdays' and 'biweekly' */}
              {(editForm.recurrence === 'weekdays' || editForm.recurrence === 'biweekly') && (
                <div>
                  <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                    {editForm.recurrence === 'biweekly' ? 'Wochentag (alle 14 Tage)' : 'Wochentage'}
                  </label>
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

              {/* Due date (once) */}
              {editForm.recurrence === 'once' && (
                <div
                  className="rounded-xl p-3 border-2 border-dashed"
                  style={{ borderColor: 'var(--family-accent)', background: 'var(--family-accent)' + '08' }}
                >
                  <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--family-accent)' }}>
                    <Icon name="calendar-event" />&nbsp;Fälligkeitsdatum&nbsp;
                    <span className="font-normal" style={{ color: 'var(--family-text3)' }}>(leer = sofort)</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Valid from/until (recurring) */}
              {editForm.recurrence !== 'once' && (
                <div
                  className={editForm.recurrence === 'biweekly' ? 'rounded-xl p-3 border-2 border-dashed' : ''}
                  style={editForm.recurrence === 'biweekly'
                    ? { borderColor: 'var(--family-accent)', background: 'var(--family-accent)' + '08' }
                    : undefined
                  }
                >
                  {editForm.recurrence === 'biweekly' && (
                    <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--family-accent)' }}>
                      <Icon name="calendar-event" />&nbsp;Start-Anker — ab diesem Datum wird alle 14 Tage gerechnet
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                        Gültig ab {editForm.recurrence === 'biweekly'
                          ? <span style={{ color: 'var(--family-accent)' }}>(Pflicht)</span>
                          : <span style={{ color: 'var(--family-text3)' }}>(opt.)</span>}
                      </label>
                      <input
                        type="date"
                        value={editForm.valid_from}
                        onChange={(e) => setEditForm({ ...editForm, valid_from: e.target.value })}
                        className={inputCls}
                        style={inputStyle}
                        required={editForm.recurrence === 'biweekly'}
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                        Gültig bis <span style={{ color: 'var(--family-text3)' }}>(opt.)</span>
                      </label>
                      <input
                        type="date"
                        value={editForm.valid_until}
                        onChange={(e) => setEditForm({ ...editForm, valid_until: e.target.value })}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
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

              {/* Rotation toggle */}
              {editForm.assigned_to.length > 1 && (
                <label
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-colors"
                  style={{
                    background: editForm.rotation ? '#dbeafe' : 'var(--family-surface2)',
                    borderColor: editForm.rotation ? '#3b82f6' : '#d8d4cf',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editForm.rotation}
                    onChange={(e) => setEditForm({ ...editForm, rotation: e.target.checked })}
                    className="w-4 h-4 accent-[var(--family-accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: editForm.rotation ? '#1e40af' : 'var(--family-text2)' }}>
                      <Icon name="refresh" />&nbsp;Faire Rotation
                    </p>
                    <p className="text-xs" style={{ color: 'var(--family-text3)' }}>
                      Nur ein Kind pro Tag — wechselt fair durch
                    </p>
                  </div>
                </label>
              )}

              {/* Category */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>
                  Kategorie <span style={{ color: 'var(--family-text3)' }}>(opt.)</span>
                </label>
                <input
                  type="text"
                  placeholder="z.B. Hygiene, Schule"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                  list="edit-task-categories"
                />
                {existingCategories.length > 0 && (
                  <datalist id="edit-task-categories">
                    {existingCategories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                )}
              </div>

              {/* ── Zeitfenster (Verfügbar ab / Verfügbar bis) ── */}
              <div
                className="rounded-xl p-3 space-y-3"
                style={{ background: 'var(--family-surface2)', border: '1px solid #d8d4cf' }}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--family-text2)' }}>
                  <Icon name="clock-hour-4" />
                  Zeitfenster <span className="font-normal" style={{ color: 'var(--family-text3)' }}>(opt.)</span>
                </p>

                {/* Verfügbar ab */}
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: 'var(--family-text2)' }}>
                    Verfügbar ab
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="time"
                      value={editForm.available_from}
                      onChange={(e) => setEditForm({ ...editForm, available_from: e.target.value })}
                      className={inputCls}
                      style={{ ...inputStyle, flex: 1, background: '#fff' }}
                    />
                    {editForm.available_from && (
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, available_from: '' })}
                        className="px-3 py-2 rounded-lg text-xs"
                        style={{ background: '#fff', color: 'var(--family-text3)', border: '1px solid #d8d4cf' }}
                      >
                        <Icon name="x" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      { label: 'Ganztägig', value: '' },
                      { label: 'Ab 13:00 (nach Schule)', value: '13:00' },
                      { label: 'Ab 18:00 (abends)', value: '18:00' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, available_from: preset.value })}
                        className="px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95"
                        style={{
                          background: editForm.available_from === preset.value ? 'var(--family-accent)' + '22' : '#fff',
                          border: `1px solid ${editForm.available_from === preset.value ? 'var(--family-accent)' : '#d8d4cf'}`,
                          color: editForm.available_from === preset.value ? 'var(--family-accent)' : 'var(--family-text3)',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--family-text3)' }}>
                    Aufgabe wird vor dieser Uhrzeit nicht angezeigt.
                  </p>
                </div>

                {/* Verfügbar bis (Deadline) */}
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: 'var(--family-text2)' }}>
                    Verfügbar bis
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="time"
                      value={editForm.due_time}
                      onChange={(e) => setEditForm({ ...editForm, due_time: e.target.value })}
                      className={inputCls}
                      style={{ ...inputStyle, flex: 1, background: '#fff' }}
                    />
                    {editForm.due_time && (
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, due_time: '' })}
                        className="px-3 py-2 rounded-lg text-xs"
                        style={{ background: '#fff', color: 'var(--family-text3)', border: '1px solid #d8d4cf' }}
                      >
                        <Icon name="x" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      { label: 'Keine Deadline', value: '' },
                      { label: 'Bis 10:00', value: '10:00' },
                      { label: 'Bis 16:00', value: '16:00' },
                      { label: 'Bis 18:00', value: '18:00' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, due_time: preset.value })}
                        className="px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95"
                        style={{
                          background: editForm.due_time === preset.value ? '#fff0e6' : '#fff',
                          border: `1px solid ${editForm.due_time === preset.value ? '#c2410c' : '#d8d4cf'}`,
                          color: editForm.due_time === preset.value ? '#c2410c' : 'var(--family-text3)',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--family-text3)' }}>
                    Deadline — danach kann die Aufgabe nicht mehr erledigt werden.
                  </p>
                </div>
              </div>

              {/* Requires approval toggle */}
              <label
                className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-colors"
                style={{
                  background: editForm.requires_approval ? '#fef3c722' : 'var(--family-surface2)',
                  borderColor: editForm.requires_approval ? '#f0a500' : '#d8d4cf',
                }}
              >
                <input
                  type="checkbox"
                  checked={editForm.requires_approval}
                  onChange={(e) => setEditForm({ ...editForm, requires_approval: e.target.checked })}
                  className="w-4 h-4 accent-[var(--family-accent)]"
                />
                <span className="text-sm" style={{ color: 'var(--family-text2)' }}>
                  Muss von Elternteil bestätigt werden
                </span>
              </label>

              {/* Delete button — sits before the cancel/save row so it's visible
                  but not too close to "Speichern" to avoid accidental taps */}
              <button
                type="button"
                onClick={() => handleDeleteTemplate(editingTemplate)}
                className="w-full py-2.5 font-semibold rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-2 border"
                style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
              >
                <Icon name="trash" />
                Aufgabe löschen
              </button>

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

      {/* ── Edit Reward Drawer ── */}
      {editingReward && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingReward(null); }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto"
            style={{ background: 'var(--family-bg)', maxHeight: '92dvh' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--family-text3)' }}>Belohnung bearbeiten</p>
                <p className="font-bold text-lg leading-tight truncate" style={{ color: 'var(--family-text)' }}>{editingReward.title}</p>
              </div>
              <button
                onClick={() => setEditingReward(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl"
                style={{ background: 'var(--family-surface2)', color: 'var(--family-text2)' }}
              >
                <Icon name="x" />
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Belohnungsname</label>
                <input
                  type="text"
                  value={editRewardForm.title}
                  onChange={(e) => setEditRewardForm({ ...editRewardForm, title: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--family-text2)' }}>Punktekosten</label>
                <input
                  type="number" min="1"
                  value={editRewardForm.points_cost}
                  onChange={(e) => setEditRewardForm({ ...editRewardForm, points_cost: parseInt(e.target.value) })}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="text-xs mb-2 block" style={{ color: 'var(--family-text2)' }}>
                  Verfügbar für
                  <span className="ml-1 font-normal" style={{ color: 'var(--family-text3)' }}>
                    {editRewardForm.available_to.length === 0 ? '— Alle' : `(${editRewardForm.available_to.length} ausgewählt)`}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => {
                    const sel = editRewardForm.available_to.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setEditRewardForm((prev) => ({
                          ...prev,
                          available_to: sel ? prev.available_to.filter((id) => id !== u.id) : [...prev.available_to, u.id],
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

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingReward(null)}
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

      </div>
    </main>
  );
}