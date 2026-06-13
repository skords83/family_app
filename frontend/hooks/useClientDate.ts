'use client';

import { useState, useEffect } from 'react';

/**
 * Returns the current Date only after hydration.
 * Returning null on the first render prevents server/client mismatches.
 */
export function useClientDate(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    // Aktualisiert sich um Mitternacht / periodisch, damit "Heute" korrekt bleibt
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

/** Lokales Datum als YYYY-MM-DD — niemals toISOString() (UTC-Versatz!). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns today's local date string (YYYY-MM-DD) only after hydration.
 * Uses local date getters — NOT toISOString(), which would shift to UTC
 * and return the wrong day in the early-morning / late-evening hours.
 */
export function useClientDateStr(): string | null {
  const now = useClientDate();
  return now ? toLocalDateStr(now) : null;
}