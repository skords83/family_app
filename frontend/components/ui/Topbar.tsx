'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AvatarButton from './AvatarButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface User {
  id: string;
  name: string;
  avatar: string;
  photo?: string;
  color: string;
  points: number;
  role: string;
  tasks_total?: number;
  tasks_done?: number;
}

const PAGE_TITLES: Record<string, string> = {
  '/':           'Dashboard',
  '/calendar':   'Kalender',
  '/tasks':      'Aufgaben',
  '/timetable':  'Stundenpläne',
  '/meals':      'Essensplan',
  '/shopping':   'Einkaufsliste',
  '/photos':     'Fotos',
  '/members':    'Familienmitglieder',
  '/admin':      'Einstellungen',
};

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
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

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )?.[1] ?? 'Family Organizer';

  return (
    <header
      className="h-[68px] flex-shrink-0 flex items-center gap-4 px-6"
      style={{
        paddingLeft: '84px', // 60px sidebar + 24px
        background: '#ffffff',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        zIndex: 20,
      }}
    >
      {/* Page title */}
      <span className="text-[15px] font-medium text-[#6b6760] flex-1 font-sans">
        {title}
      </span>

      {/* Member avatars with progress rings */}
      <div className="flex items-center gap-2.5">
        {users.map((user) => (
          <AvatarButton
            key={user.id}
            user={user}
            size="topbar"
            onClick={() => router.push(`/user/${user.id}`)}
          />
        ))}
      </div>

      <div className="w-px h-7 bg-black/10 mx-1" />

      {/* Members button */}
      <button
        onClick={() => router.push('/members')}
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#6b6760] text-lg transition-all hover:bg-black/5"
        title="Mitglieder"
      >
        👥
      </button>
    </header>
  );
}