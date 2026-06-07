'use client';

import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        await fetch('/api/widgets/weather', {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        setIsOnline(true);
        setLastSeen(new Date());
      } catch {
        setIsOnline(false);
      }
    };

    check();
    const interval = setInterval(check, 30_000);

    const handleOnline = () => check();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, lastSeen };
}