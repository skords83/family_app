'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClientDate } from '@/hooks/useClientDate';
import AvatarButton from './AvatarButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string; name: string; avatar: string; photo?: string;
  color: string; points: number; role: string;
  tasks_total?: number; tasks_done?: number;
}

interface PageHeaderProps {
  /** Custom title for non-homepage views, e.g. "Kalender" */
  title?: string;
  /** Show greeting + clock (homepage style) or just title (subpage style) */
  variant?: 'home' | 'page';
}

function Clock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const iv = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);
  const hm = time
    ? time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '\u00a0\u00a0:\u00a0\u00a0';
  return (
    <div className="text-right flex-shrink-0">
      <div className="tabular-nums font-light tracking-tight"
        style={{ fontSize: 40, color: '#1a1814', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        {hm}
      </div>
    </div>
  );
}

export default function PageHeader({ title, variant = 'page' }: PageHeaderProps) {
  const router = useRouter();
  const now = useClientDate();
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUsers();
    const iv = setInterval(fetchUsers, 60_000);
    return () => clearInterval(iv);
  }, [fetchUsers]);

  const greeting = (() => {
    if (!now) return 'Hallo 👋';
    const h = now.getHours();
    if (h < 12) return 'Guten Morgen 👋';
    if (h < 18) return 'Guten Tag 👋';
    return 'Guten Abend 👋';
  })();

  const dateStr = now
    ? now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '\u00a0';

  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
      {/* Left: greeting or page title */}
      <div>
        {variant === 'home' ? (
          <>
            <h1 className="font-normal" style={{ fontSize: 28, color: '#1a1814', fontFamily: 'Georgia, serif' }}>
              {greeting}
            </h1>
            <p className="text-sm font-sans mt-0.5" style={{ color: '#7a7874' }}>{dateStr}</p>
          </>
        ) : (
          <h1 className="font-normal" style={{ fontSize: 22, color: '#1a1814', fontFamily: 'Georgia, serif' }}>
            {title}
          </h1>
        )}
      </div>

      {/* Right: avatars + clock */}
      <div className="flex items-center gap-4">
        {/* Avatar row */}
        <div className="flex items-center gap-2">
          {users.map(user => (
            <AvatarButton
              key={user.id}
              user={user}
              size="topbar"
              onClick={() => router.push(`/user/${user.id}`)}
            />
          ))}
        </div>

        {/* Clock — only on homepage */}
        {variant === 'home' && <Clock />}
      </div>
    </div>
  );
}