"use client";

import { useEffect, useState, useRef } from "react";

interface ScreensaverProps {
  onDismiss: () => void;
  apiBase?: string;
}

interface SlideshowPhoto {
  id: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

export function Screensaver({ onDismiss, apiBase = '' }: ScreensaverProps) {
  const [now, setNow] = useState(new Date());
  const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
  const [pair, setPair] = useState({ a: 0, b: 1, front: 'A' as 'A' | 'B' });
  const counterRef = useRef(2);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`${apiBase}/api/widgets/immich/slideshow`)
      .then(r => r.json())
      .then((d: { photos?: SlideshowPhoto[] }) => setPhotos(d.photos ?? []))
      .catch(() => {});
  }, [apiBase]);

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => {
      const next = counterRef.current % photos.length;
      counterRef.current++;
      setPair(prev => prev.front === 'A'
        ? { a: prev.a, b: next, front: 'B' }
        : { a: next, b: prev.b, front: 'A' }
      );
    }, 45_000);
    return () => clearInterval(t);
  }, [photos.length]);

  function handleDismiss(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    onDismiss();
  }

  const photoA = photos[pair.a];
  const photoB = photos[pair.b];
  const hasPhotos = photos.length > 0;
  const clockColor = hasPhotos ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)';
  const dateColor = hasPhotos ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.10)';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', cursor: 'none', animation: 'ss-fade-in 1.5s ease forwards' }}
      onClick={handleDismiss}
      onTouchStart={handleDismiss}
      aria-label="Tippen zum Fortfahren"
    >
      {/* Slot A */}
      {photoA && (
        <div style={{ position: 'absolute', inset: 0, opacity: pair.front === 'A' ? 1 : 0, transition: 'opacity 3s ease' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiBase}/api/widgets/immich/proxy/${photoA.id}?size=preview`} alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.45)', transform: 'scale(1.08)' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiBase}/api/widgets/immich/proxy/${photoA.id}?size=preview`} alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
      {/* Slot B */}
      {photoB && (
        <div style={{ position: 'absolute', inset: 0, opacity: pair.front === 'B' ? 1 : 0, transition: 'opacity 3s ease' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiBase}/api/widgets/immich/proxy/${photoB.id}?size=preview`} alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.45)', transform: 'scale(1.08)' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiBase}/api/widgets/immich/proxy/${photoB.id}?size=preview`} alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}

      {hasPhotos && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.55) 100%)' }} />
      )}

      <div style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <span style={{ display: 'block', fontSize: 'clamp(3rem, 8vw, 7rem)', fontWeight: 100, letterSpacing: '0.05em', color: clockColor, fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, "SF Mono", monospace', lineHeight: 1 }}>
          {formatTime(now)}
        </span>
        <span style={{ display: 'block', marginTop: '0.5rem', fontSize: 'clamp(0.75rem, 1.8vw, 1.1rem)', fontWeight: 300, letterSpacing: '0.12em', textTransform: 'uppercase', color: dateColor, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          {formatDate(now)}
        </span>
      </div>

      <style>{`
        @keyframes ss-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
