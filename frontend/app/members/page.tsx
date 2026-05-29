'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AvatarButton from '@/components/ui/AvatarButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string; name: string; avatar: string; photo?: string;
  color: string; points: number; role: string;
  tasks_total?: number; tasks_done?: number;
}

const COLORS = [
  '#e85d3a','#4a9eed','#5cb85c','#9b59b6',
  '#f0a500','#00bcd4','#f59e0b','#ec4899',
];
const EMOJIS = ['👩','👨','👧','👦','🧒','👶','🧑','🐱'];

export default function MembersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Add/edit form state
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formEmoji, setFormEmoji] = useState(EMOJIS[0]);
  const [formRole, setFormRole] = useState<'parent' | 'child'>('child');
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await fetch(`${API_BASE}/api/users`).then(r => r.json());
      if (Array.isArray(data)) setUsers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openAdd() {
    setEditUser(null);
    setFormName(''); setFormColor(COLORS[0]); setFormEmoji(EMOJIS[0]);
    setFormRole('child'); setFormPhoto(null);
    setShowAdd(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setFormName(u.name); setFormColor(u.color);
    setFormEmoji(u.avatar); setFormRole(u.role as 'parent' | 'child');
    setFormPhoto(u.photo ?? null);
    setShowAdd(true);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFormPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    try {
      if (editUser) {
        // Update existing
        await fetch(`${API_BASE}/api/users/${editUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, avatar: formEmoji, color: formColor }),
        });
        if (formPhoto && formPhoto !== editUser.photo) {
          await fetch(`${API_BASE}/api/users/${editUser.id}/photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: formPhoto }),
          });
        }
      } else {
        // Create new
        const res = await fetch(`${API_BASE}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, avatar: formEmoji, color: formColor, role: formRole }),
        }).then(r => r.json());
        if (formPhoto && res.id) {
          await fetch(`${API_BASE}/api/users/${res.id}/photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: formPhoto }),
          });
        }
      }
      await fetchUsers();
      setShowAdd(false);
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Mitglied wirklich löschen?')) return;
    await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE' });
    await fetchUsers();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>Familienmitglieder</h1>
          <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>{users.length} Mitglieder</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-sans font-medium text-white transition-all active:scale-95"
          style={{ background: '#e85d3a' }}
        >
          <i className="ti ti-plus" style={{ fontSize: 14 }} /> Hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: '#e8e4de' }} />)}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {users.map(u => {
            const pct = u.tasks_total ? Math.round((u.tasks_done ?? 0) / u.tasks_total * 100) : 0;
            return (
              <div key={u.id} className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                {/* Top */}
                <div className="flex items-center gap-3">
                  <AvatarButton user={u} size="sm" onClick={() => openEdit(u)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold font-sans text-sm" style={{ color: u.color }}>{u.name}</div>
                    <div className="text-xs font-sans" style={{ color: '#a09d99' }}>
                      {u.role === 'parent' ? 'Elternteil' : 'Kind'}
                    </div>
                  </div>
                  <button onClick={() => openEdit(u)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition-all" style={{ color: '#a09d99' }}>
                    <i className="ti ti-edit" style={{ fontSize: 14 }} />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: '#f5f2ee' }}>
                    <div className="text-lg font-sans font-semibold" style={{ color: u.color }}>⭐ {u.points}</div>
                    <div className="text-[10px] font-sans" style={{ color: '#a09d99' }}>Punkte</div>
                  </div>
                  <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: '#f5f2ee' }}>
                    <div className="text-lg font-sans font-semibold" style={{ color: '#1a1814' }}>{u.tasks_done ?? 0}/{u.tasks_total ?? 0}</div>
                    <div className="text-[10px] font-sans" style={{ color: '#a09d99' }}>Aufgaben</div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-[11px] font-sans mb-1" style={{ color: '#a09d99' }}>
                    <span>Fortschritt heute</span><span>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0ede8' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: u.color }} />
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(u.id)}
                  className="text-xs font-sans text-center py-1 transition-all hover:opacity-80"
                  style={{ color: '#e85d3a' }}
                >
                  Löschen
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showAdd && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div className="rounded-2xl p-6 w-96 shadow-xl" style={{ background: '#fff' }}>
            <div className="text-base font-sans font-medium mb-5" style={{ color: '#1a1814' }}>
              {editUser ? 'Mitglied bearbeiten' : 'Mitglied hinzufügen'}
            </div>

            {/* Photo upload */}
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                style={{ background: `${formColor}22`, border: `3px solid ${formColor}` }}
                onClick={() => fileRef.current?.click()}
              >
                {formPhoto ? (
                  <img src={formPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{formEmoji}</span>
                )}
              </div>
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-sm font-sans px-3 py-1.5 rounded-lg transition-all hover:bg-black/5"
                  style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760' }}
                >
                  Foto auswählen
                </button>
                {formPhoto && (
                  <button onClick={() => setFormPhoto(null)} className="ml-2 text-xs font-sans" style={{ color: '#a09d99' }}>
                    Entfernen
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>
            </div>

            {/* Name */}
            <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-1" style={{ color: '#a09d99' }}>Name</label>
            <input
              autoFocus
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-sans outline-none mb-4"
              style={{ background: '#f0ede8', color: '#1a1814', border: '0.5px solid rgba(0,0,0,0.1)' }}
              placeholder="z.B. Lena"
            />

            {/* Emoji (if no photo) */}
            {!formPhoto && (
              <>
                <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-1" style={{ color: '#a09d99' }}>Avatar</label>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setFormEmoji(e)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all"
                      style={{
                        background: formEmoji === e ? `${formColor}22` : '#f0ede8',
                        border: formEmoji === e ? `1.5px solid ${formColor}` : '1.5px solid transparent',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Role */}
            {!editUser && (
              <>
                <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-1" style={{ color: '#a09d99' }}>Rolle</label>
                <div className="flex gap-2 mb-4">
                  {(['child', 'parent'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setFormRole(r)}
                      className="flex-1 py-2 rounded-xl text-sm font-sans transition-all"
                      style={{
                        background: formRole === r ? formColor : '#f0ede8',
                        color: formRole === r ? '#fff' : '#6b6760',
                        border: `0.5px solid ${formRole === r ? formColor : 'transparent'}`,
                      }}
                    >
                      {r === 'parent' ? 'Elternteil' : 'Kind'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Color */}
            <label className="text-[11px] font-sans font-semibold uppercase tracking-wider block mb-2" style={{ color: '#a09d99' }}>Farbe</label>
            <div className="flex gap-2 mb-5 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setFormColor(c)}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    border: formColor === c ? `3px solid #1a1814` : '3px solid transparent',
                    transform: formColor === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-sans transition-all hover:bg-black/5"
                style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760' }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl text-sm font-sans font-medium text-white transition-all active:scale-95"
                style={{ background: formColor }}
              >
                {editUser ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
