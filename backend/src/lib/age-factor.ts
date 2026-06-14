/**
 * Alters-Multiplikator für Belohnungskosten.
 *
 * Basis = 7 Jahre (Faktor 1.0). Jüngere zahlen weniger, ältere mehr.
 * Zwischen den Stützstellen wird linear interpoliert, damit Kinder
 * nicht von einem Tag auf den anderen einen Sprung sehen.
 *
 * Stützstellen:
 *   4 Jahre  → 0.6×
 *   7 Jahre  → 1.0×
 *  10 Jahre  → 1.6×
 *  12 Jahre  → 2.0×
 *  ≥13 Jahre → 2.2×  (geringer weiterer Anstieg, aber nicht unbegrenzt)
 *
 * Eltern (oder Nutzer ohne Geburtsdatum) bekommen 1.0× zurück.
 */

type Stop = readonly [age: number, factor: number];

const AGE_STOPS: ReadonlyArray<Stop> = [
  [4, 0.6],
  [7, 1.0],
  [10, 1.6],
  [12, 2.0],
  [13, 2.2],
];

/**
 * Aktuelles Alter in vollendeten Jahren.
 * Akzeptiert `Date`, ISO-String oder YYYY-MM-DD.
 */
export function calculateAge(birthdate: Date | string | null | undefined, today: Date = new Date()): number | null {
  if (!birthdate) return null;
  const birth = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Multiplikator anhand des Geburtsdatums.
 * Null/ungültig → 1.0
 */
export function ageFactorFromBirthdate(birthdate: Date | string | null | undefined): number {
  const age = calculateAge(birthdate);
  if (age === null) return 1.0;
  return ageFactor(age);
}

/**
 * Multiplikator für ein konkretes Alter.
 * Außerhalb der Stützstellen wird auf den Rand geklemmt.
 */
export function ageFactor(age: number): number {
  if (age <= AGE_STOPS[0][0]) return AGE_STOPS[0][1];
  if (age >= AGE_STOPS[AGE_STOPS.length - 1][0]) {
    return AGE_STOPS[AGE_STOPS.length - 1][1];
  }
  for (let i = 0; i < AGE_STOPS.length - 1; i++) {
    const [a1, f1] = AGE_STOPS[i];
    const [a2, f2] = AGE_STOPS[i + 1];
    if (age >= a1 && age <= a2) {
      const t = (age - a1) / (a2 - a1);
      return f1 + t * (f2 - f1);
    }
  }
  return 1.0;
}

/**
 * Effektive Belohnungskosten — Basispreis × Faktor, aufgerundet auf Ganzzahl,
 * minimum 1 Punkt (sonst wären gratis-Belohnungen möglich).
 */
export function effectiveRewardCost(baseCost: number, factor: number): number {
  return Math.max(1, Math.round(baseCost * factor));
}
