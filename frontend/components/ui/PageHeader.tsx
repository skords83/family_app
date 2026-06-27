'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClientDate } from '@/hooks/useClientDate';
import AvatarButton from './AvatarButton';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import Link from 'next/link';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
interface User {
  id: string; name: string; avatar: string; photo?: string;
  color: string; points: number; role: string;
  tasks_total?: number; tasks_done?: number;
}
interface PageHeaderProps {
  title?: string;
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
        style={{ fontSize: 48, color: '#1a1814', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        {hm}
      </div>
    </div>
  );
}
export default function PageHeader({ title, variant = 'page' }: PageHeaderProps) {
  const router = useRouter();
  const now = useClientDate();
  const [users, setUsers] = useState<User[]>([]);
  const [weather, setWeather] = useState<{ data?: any; fetched_at?: string }>({});
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Avatare nur auf Unterseiten zur Navigation — auf der Startseite navigiert man über die Kacheln
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    if (variant !== 'page') return;
    fetchUsers();
    const iv = setInterval(fetchUsers, 60_000);
    return () => clearInterval(iv);
  }, [variant, fetchUsers]);

  // Wetter nur im Home-Header
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json());
      if (res?.data) setWeather({ data: res.data, fetched_at: res.fetched_at });
    } catch { /* silent */ }
    finally { setWeatherLoading(false); }
  }, []);
  useEffect(() => {
    if (variant !== 'home') return;
    fetchWeather();
    const iv = setInterval(fetchWeather, 5 * 60_000);
    return () => clearInterval(iv);
  }, [variant, fetchWeather]);

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
    <div className="flex items-center justify-between px-6 pt-4 pb-3 flex-shrink-0">
      <div>
        {variant === 'home' ? (
          <>
            <h1 className="font-normal" style={{ fontSize: 24, color: '#1a1814', fontFamily: 'Georgia, serif' }}>
              {greeting}
            </h1>
            <p className="text-xs font-sans mt-0.5" style={{ color: '#7a7874' }}>{dateStr}</p>
          </>
        ) : (
          <h1 className="font-normal" style={{ fontSize: 20, color: '#1a1814', fontFamily: 'Georgia, serif' }}>
            {title}
          </h1>
        )}
      </div>
      <div className="flex items-center" style={{ gap: 48 }}>
        {variant === 'home' ? (
          <>
            <Link href="/weather" style={{ textDecoration: 'none' }}>
              <WeatherWidget
                variant="header"
                data={weather.data}
                fetched_at={weather.fetched_at}
                loading={weatherLoading}
              />
            </Link>
            <Clock />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/weather"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--family-surface2)', textDecoration: 'none',
                flexShrink: 0,
              }}
              title="Wetter"
            >
              <i className="ti ti-cloud" style={{ fontSize: 18, color: '#6b6760' }} aria-hidden="true" />
            </Link>
            {users.map(user => (
              <AvatarButton
                key={user.id}
                user={user}
                size="topbar"
                onClick={() => router.push(`/user/${user.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}