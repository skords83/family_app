/**
 * Shared date utilities for Europe/Berlin timezone.
 *
 * NEVER use `new Date().toISOString().split('T')[0]` for local date comparisons —
 * toISOString() returns UTC, which is 1–2 hours behind Berlin (CET/CEST).
 * After midnight UTC (= 02:00 MESZ) the UTC date flips to the next day,
 * breaking every query that compares against dates stored in Berlin time.
 *
 * This helper is the project-wide standard and replaces all `.toISOString().split('T')[0]`
 * patterns in the backend. The same pattern already exists in waste.ts (toBerlinDate)
 * and throughout the frontend (toLocalDateStr).
 */

/** YYYY-MM-DD in Europe/Berlin — safe for DB date comparisons */
export function toBerlinDateStr(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}
