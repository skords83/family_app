'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const { isOnline, lastSeen } = useOnlineStatus();

  if (isOnline) return null;

  const ago = lastSeen
    ? Math.round((Date.now() - lastSeen.getTime()) / 60_000)
    : null;

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed top-0 left-0 right-0 bg-red-600 text-white text-sm text-center py-1.5 px-4"
    >
      ⚠️ Keine Verbindung zum Server
      {ago !== null && ago > 0 && (
        <span className="ml-2 opacity-75">
          · zuletzt aktualisiert vor {ago} Min
        </span>
      )}
    </div>
  );
}
