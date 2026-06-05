import { z } from 'zod';

// ============================================================
// Plain TypeScript interfaces
// (bestehender Stil — schrittweise zu Zod-Schemas migrieren)
// ============================================================

export interface User {
  id: string;
  name: string;
  avatar: string; // emoji or url
  color: string;  // hex
  pin: string | null;
  role: 'child' | 'parent';
}

export interface TaskTemplate {
  id: string;
  title: string;
  points: number;
  assigned_to: string | null; // user_id or null=all
  recurrence: 'daily' | 'weekly' | 'once';
  due_time: string | null; // "08:00"
  active: boolean;
}

export interface TaskInstance {
  id: string;
  template_id: string;
  assigned_to: string;
  date: string; // ISO date
  completed_at: string | null;
  completed_by: string | null;
  title: string; // joined from template
  points: number; // joined from template
}

export interface PointEvent {
  id: string;
  user_id: string;
  points: number;
  reason: string; // "task:uuid" | "reward:uuid" | "manual"
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  points_cost: number;
  available_to: string | null;
  active: boolean;
}

export interface RewardClaim {
  id: string;
  reward_id: string;
  user_id: string;
  claimed_at: string;
  approved_at: string | null;
  reward_title?: string;
}

export interface WidgetConfig {
  widgets: WidgetItem[];
}

export interface WidgetItem {
  type: string;
  enabled: boolean;
  order: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
}

export interface WeatherData {
  temperature: number;
  weathercode: number;
  windspeed: number;
  hourly?: { time: string; temperature: number; }[];
}

export interface MealPlan {
  days: { date: string; lunch: string; dinner: string; }[];
}

export interface CachedWidget<T> {
  data: T;
  fetched_at: string;
  source_url: string;
}

// ============================================================
// Zod-Schemas
// Validierung + Single Source of Truth für Frontend/Backend.
// Begonnen mit Müllkalender; weitere Bereiche folgen.
// ============================================================

// --- Waste / Müllkalender ---------------------------------------

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