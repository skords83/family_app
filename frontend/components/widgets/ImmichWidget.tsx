'use client';

import { useState } from 'react';

interface ImmichData {
  id: string; url: string; thumbnailUrl: string; fileName: string;
  createdAt: string; description?: string; location?: string;
}
interface ImmichWidgetProps {
  data?: ImmichData; fetched_at?: string; loading?: boolean;
  onRefresh?: () => void; apiBase?: string;
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

export default function ImmichWidget({ data, fetched_at, loading, onRefresh, apiBase = '' }: ImmichWidgetProps) {
  const [imgError, setImgError] = useState(false);
  const card = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16 };

  if (loading) return (
    <div style={{ ...card, overflow: 'hidden', height: 192 }} className="animate-pulse">
      <div style={{ width: '100%', height: '100%', background: '#e8e4de' }} />
    </div>
  );

  if (!data || imgError) return (
    <div style={{ ...card, height: 192, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <span className="text-4xl">🖼️</span>
      <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Kein Foto verfügbar</p>
      {onRefresh && (
        <button onClick={onRefresh} className="text-xs font-sans transition-opacity hover:opacity-70" style={{ color: '#e85d3a' }}>
          Neu laden
        </button>
      )}
    </div>
  );

  const stale = isStale(fetched_at);
  const proxyUrl = `${apiBase}/api/widgets/immich/proxy/${data.id}?size=preview`;
  const photoDate = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div style={{ ...card, overflow: 'hidden', position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={proxyUrl} alt={data.description ?? data.fileName} className="w-full h-48 object-cover" onError={() => setImgError(true)} />
      <div className="absolute inset-0 immich-gradient pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {(data.description || data.location || photoDate) && (
          <div className="space-y-0.5">
            {data.description && <p className="text-xs text-white/90 font-medium font-sans truncate">{data.description}</p>}
            {data.location && <p className="text-xs text-white/70 font-sans">📍 {data.location}</p>}
            {photoDate && <p className="text-xs text-white/50 font-sans">{photoDate}</p>}
          </div>
        )}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {stale && <span className="text-xs rounded px-1.5 py-0.5 font-sans" style={{ background: 'rgba(0,0,0,0.5)', color: '#f0a500' }}>⚠ veraltet</span>}
        {onRefresh && (
          <button onClick={onRefresh} className="rounded-full w-7 h-7 flex items-center justify-center transition-all text-sm" style={{ background: 'rgba(0,0,0,0.45)' }} title="Neues Foto laden">
            <i className="ti ti-refresh" style={{ fontSize: 14, color: '#fff' }} />
          </button>
        )}
      </div>
    </div>
  );
}
