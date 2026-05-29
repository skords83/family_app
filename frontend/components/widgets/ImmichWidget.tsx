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

  const Header = () => (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h3 className="text-[10px] font-sans font-semibold uppercase tracking-widest" style={{ color: '#a09d99' }}>
        Erinnerung des Tages
      </h3>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-black/5"
          style={{ color: '#a09d99' }}
          title="Neues Foto laden"
        >
          <i className="ti ti-refresh" style={{ fontSize: 15 }} />
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={cardStyle}>
        <Header />
        <div className="mx-4 mb-4 rounded-xl animate-pulse" style={{ background: '#f0ede8', height: 180 }} />
      </div>
    );
  }

  if (!data || imgError) {
    return (
      <div style={cardStyle}>
        <Header />
        <div className="mx-4 mb-4 rounded-xl flex flex-col items-center justify-center gap-2" style={{ background: '#f0ede8', height: 180 }}>
          <i className="ti ti-photo" style={{ fontSize: 28, color: '#c0bbb5' }} />
          <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Kein Foto verfügbar</p>
          {onRefresh && (
            <button onClick={onRefresh} className="text-xs font-sans mt-1 transition-opacity hover:opacity-70" style={{ color: '#e85d3a' }}>
              Neu laden
            </button>
          )}
        </div>
      </div>
    );
  }

  const stale = isStale(fetched_at);
  const proxyUrl = `${apiBase}/api/widgets/immich/proxy/${data.id}?size=preview`;
  const photoDate = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div style={cardStyle}>
      <Header />
      {/* Photo with rounded corners inside card */}
      <div className="mx-4 mb-4 relative rounded-xl overflow-hidden" style={{ height: 200 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxyUrl}
          alt={data.description ?? data.fileName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 immich-gradient pointer-events-none" />

        {/* Info overlay bottom */}
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

        {/* Stale indicator */}
        {stale && (
          <div className="absolute top-2 left-2">
            <span className="text-xs rounded px-1.5 py-0.5 font-sans" style={{ background: 'rgba(0,0,0,0.5)', color: '#f0a500' }}>
              ⚠ veraltet
            </span>
          </div>
        )}
      </div>
    </div>
  );
}