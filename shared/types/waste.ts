import { z } from 'zod';

/**
 * Bekannte Tonnen-Typen.
 * Erweiterbar bei Bedarf (z.B. 'tannenbaum' für saisonale Sammlungen).
 */
export const WasteTypeSchema = z.enum([
  'restmuell',
  'bioabfall',
  'papier',
  'wertstoff',
]);
export type WasteType = z.infer<typeof WasteTypeSchema>;

/**
 * Ein einzelnes Abholungs-Event, wie es in external_events gespeichert wird.
 */
export const WasteEventSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: WasteTypeSchema,
  title: z.string(),
  fetched_at: z.string().datetime(),
});
export type WasteEvent = z.infer<typeof WasteEventSchema>;

/**
 * Response für GET /api/widgets/waste/today
 *
 * - active=true   → events enthält die heute/morgen relevanten Tonnen,
 *                   Widget zeigt den aktiven Zustand (Bild + großer Text).
 * - active=false  → events ist leer, next enthält die nächste Abholung,
 *                   Widget zeigt den passiven Zustand (kompakte Zeile).
 *
 * Das Backend entscheidet anhand der Uhrzeit:
 *   Vortag 15:00 → Abholtag 10:00 = active
 *   sonst                          = passive
 */
export const WasteTodayResponseSchema = z.object({
  active: z.boolean(),
  events: z.array(WasteEventSchema),
  next: WasteEventSchema.nullable(),
  fetched_at: z.string().datetime(),
});
export type WasteTodayResponse = z.infer<typeof WasteTodayResponseSchema>;

/**
 * Response für GET /api/widgets/waste/upcoming
 *
 * Liefert die nächsten ~4 Abholungen für die Detailansicht.
 */
export const WasteUpcomingResponseSchema = z.object({
  events: z.array(WasteEventSchema),
  fetched_at: z.string().datetime(),
});
export type WasteUpcomingResponse = z.infer<typeof WasteUpcomingResponseSchema>;
