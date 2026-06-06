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
  }, []);
  return now;
}

/**
 * Returns today's date string (YYYY-MM-DD) only after hydration.
 */
export function useClientDateStr(): string | null {
  const now = useClientDate();
  return now ? now.toISOString().split('T')[0] : null;
}
