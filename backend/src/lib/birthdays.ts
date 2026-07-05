/**
 * Reine Datumslogik für das Geburtstags-Widget — keine DB-Zugriffe.
 *
 * "Nächstes Vorkommen" von Monat/Tag ab heute: fällt der 29. Februar in ein
 * Nicht-Schaltjahr, weicht die Berechnung auf den 28. Februar aus.
 */

export interface BirthdaySource {
  name: string;
  month: number; // 1–12
  day: number;   // 1–31
  year: number | null;
}

export interface BirthdayWindowEntry {
  name: string;
  age: number | null;
  daysUntil: number;
}

export interface BirthdayWindow {
  today: { name: string; age: number | null } | null;
  upcoming: BirthdayWindowEntry[];
}

const WINDOW_DAYS = 7;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function safeDayForYear(month: number, day: number, year: number): number {
  if (month === 2 && day === 29 && !isLeapYear(year)) return 28;
  return day;
}

export interface NextOccurrence {
  year: number;
  daysUntil: number;
}

/** Nächstes Vorkommen von Monat/Tag ab (inklusive) `todayStr` (YYYY-MM-DD). */
export function nextOccurrence(month: number, day: number, todayStr: string): NextOccurrence {
  const today = new Date(todayStr + 'T12:00:00Z');
  const todayYear = today.getUTCFullYear();

  let year = todayYear;
  let candidate = new Date(Date.UTC(year, month - 1, safeDayForYear(month, day, year), 12));
  if (candidate.getTime() < today.getTime()) {
    year = todayYear + 1;
    candidate = new Date(Date.UTC(year, month - 1, safeDayForYear(month, day, year), 12));
  }

  const daysUntil = Math.round((candidate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return { year, daysUntil };
}

/**
 * Dedupliziert nach Name (case-insensitive, getrimmt). Bei einer Kollision
 * gewinnt der User-Eintrag — verhindert Doppelanzeige, falls die eigene
 * Familie zusätzlich im synchronisierten Adressbuch steht.
 */
export function dedupeByName(
  userEntries: BirthdaySource[],
  contactEntries: BirthdaySource[],
): BirthdaySource[] {
  const userNames = new Set(userEntries.map(e => e.name.trim().toLowerCase()));
  const filteredContacts = contactEntries.filter(e => !userNames.has(e.name.trim().toLowerCase()));
  return [...userEntries, ...filteredContacts];
}

/**
 * Baut die Widget-Antwort aus einer bereits deduplizierten Liste.
 * `today` = daysUntil 0, `upcoming` = daysUntil 1..WINDOW_DAYS, aufsteigend sortiert.
 */
export function buildBirthdayWindow(entries: BirthdaySource[], todayStr: string): BirthdayWindow {
  const withOccurrence = entries
    .map(e => {
      const occ = nextOccurrence(e.month, e.day, todayStr);
      const age = e.year != null ? occ.year - e.year : null;
      return { name: e.name, age, daysUntil: occ.daysUntil };
    })
    .filter(e => e.daysUntil <= WINDOW_DAYS);

  withOccurrence.sort((a, b) => a.daysUntil - b.daysUntil);

  const todayEntry = withOccurrence.find(e => e.daysUntil === 0);
  const upcoming = withOccurrence.filter(e => e.daysUntil > 0);

  return {
    today: todayEntry ? { name: todayEntry.name, age: todayEntry.age } : null,
    upcoming,
  };
}
