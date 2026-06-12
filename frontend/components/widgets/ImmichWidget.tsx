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

  const cardStyle = {
    background: '#fff',
    border: '0.5px solid rgba(0,0,0,0.07)',
    borderRadius: 16,
    overflow: 'hidden' as const,
  };

  // Loading state — kein Header, nur Placeholder
  if (loading) {
    return (
      <div style={{ ...cardStyle, height: 180 }} className="animate-pulse" />
    );
  }

  // No data / error state — kompaktes Fallback ohne Header
  if (!data || imgError) {
    return (
      <div style={{ ...cardStyle, height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <i className="ti ti-photo" style={{ fontSize: 28, color: '#c0bbb5' }} />
        <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Kein Foto verfügbar</p>
        {onRefresh && (
          <button onClick={onRefresh} className="text-xs font-sans mt-1 transition-opacity hover:opacity-70" style={{ color: '#e85d3a' }}>
            Neu laden
          </button>
        )}
      </div>
    );
  }

  const stale = isStale(fetched_at);
  const proxyUrl = `${apiBase}/api/widgets/immich/proxy/${data.id}?size=preview`;
  const photoDate = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    // Kein äußeres padding mehr — Bild füllt die Card direkt
    <div style={{ ...cardStyle, position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyUrl}
        alt={data.description ?? data.fileName}
        style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
        onError={() => setImgError(true)}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 immich-gradient pointer-events-none" />

      {/* Refresh-Button — oben rechts ins Bild integriert */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
          style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
          title="Neues Foto laden"
        >
          <i className="ti ti-refresh" style={{ fontSize: 14 }} />
        </button>
      )}

      {/* Stale indicator — oben links */}
      {stale && (
        <div className="absolute top-2 left-2">
          <span className="text-xs rounded px-1.5 py-0.5 font-sans" style={{ background: 'rgba(0,0,0,0.5)', color: '#f0a500' }}>
            ⚠ veraltet
          </span>
        </div>
      )}

      {/* Info overlay — unten */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {(data.location || photoDate) && (
          <div className="space-y-0.5">
            {data.location && (
              <p className="text-xs font-sans" style={{ color: 'rgba(255,255,255,0.85)' }}>
                📍 {data.location}
              </p>
            )}
            {photoDate && (
              <p className="text-xs font-sans" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {photoDate}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}