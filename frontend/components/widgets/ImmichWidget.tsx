'use client';

import { useState } from 'react';

interface ImmichData {
  id: string;
  url: string;
  thumbnailUrl: string;
  fileName: string;
  createdAt: string;
  description?: string;
  location?: string;
}

interface ImmichWidgetProps {
  data?: ImmichData;
  fetched_at?: string;
  loading?: boolean;
  onRefresh?: () => void;
  apiBase?: string;
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

export default function ImmichWidget({ data, fetched_at, loading, onRefresh, apiBase = '' }: ImmichWidgetProps) {
  const [imgError, setImgError] = useState(false);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden animate-pulse h-48">
        <div className="w-full h-full bg-slate-700" />
      </div>
    );
  }

  if (!data || imgError) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col items-center justify-center h-48 gap-3">
        <span className="text-4xl">🖼️</span>
        <p className="text-slate-500 text-sm">Kein Foto verfügbar</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Neu laden
          </button>
        )}
      </div>
    );
  }

  const stale = isStale(fetched_at);

  // Use proxy endpoint to avoid exposing API key
  const proxyUrl = `${apiBase}/api/widgets/immich/proxy/${data.id}?size=preview`;

  const photoDate = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden relative">
      {/* Photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyUrl}
        alt={data.description ?? data.fileName}
        className="w-full h-48 object-cover"
        onError={() => setImgError(true)}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 immich-gradient pointer-events-none" />

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {(data.description || data.location || photoDate) && (
          <div className="space-y-0.5">
            {data.description && (
              <p className="text-xs text-slate-300 font-medium truncate">{data.description}</p>
            )}
            {data.location && (
              <p className="text-xs text-slate-400">📍 {data.location}</p>
            )}
            {photoDate && (
              <p className="text-xs text-slate-500">{photoDate}</p>
            )}
          </div>
        )}
      </div>

      {/* Top right controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {stale && (
          <span className="text-xs bg-amber-900/80 text-amber-400 rounded px-1.5 py-0.5">⚠ veraltet</span>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center transition-colors text-sm"
            title="Neues Foto laden"
          >
            🔄
          </button>
        )}
      </div>
    </div>
  );
}
