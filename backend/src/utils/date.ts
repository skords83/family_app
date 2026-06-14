/**
 * Date utilities for the Family Organizer backend.
 *
 * The app is anchored to Europe/Berlin (the kiosk timezone). The Node container
 * itself usually runs in UTC, so naive `new Date().getDate()` returns the UTC
 * date — wrong by up to ±2h around midnight Berlin time. These helpers use
 * `Intl.DateTimeFormat` with an explicit `timeZone` parameter, so they are
 * **independent** of whatever TZ the container is running under.
 *
 * Use these helpers anywhere we need "what day is it for the kiosk users".
 * Never call `.toISOString().split('T')[0]` or `.getDate()` directly for this.
 */

export const APP_TZ = 'Europe/Berlin';

/**
 * Today's date in Europe/Berlin as `YYYY-MM-DD`.
 * Works regardless of the container's TZ.
 */
export function getTodayInAppTz(): string {
  return formatDateInAppTz(new Date());
}

/**
 * Formats any `Date` as `YYYY-MM-DD` in Europe/Berlin.
 * Uses the `en-CA` locale because it natively produces ISO-style output.
 */
export function formatDateInAppTz(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns the day-of-week (0=Sunday … 6=Saturday) for a `YYYY-MM-DD` string.
 * Anchors to noon UTC so any reasonable timezone interpretation lands on the
 * same calendar day, then uses `getUTCDay()` for full determinism.
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay();
}

/**
 * Converts a value from a Postgres `DATE` column to `YYYY-MM-DD`.
 *
 * `node-postgres` returns DATE as a `Date` object at UTC midnight. We must
 * read it back with UTC accessors — local accessors would shift by the
 * container's TZ offset and produce off-by-one bugs.
 */
export function pgDateToStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).split('T')[0];
}