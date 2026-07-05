import { z } from 'zod';

// ============================================================
// Plain TypeScript interfaces
// (bestehender Stil — schrittweise zu Zod-Schemas migrieren)
// ============================================================

export interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  pin: string | null;
  role: 'child' | 'parent';
  /** ISO-Datum YYYY-MM-DD oder null. Bestimmt den Alters-Multiplikator für Belohnungen. */
  birthdate: string | null;
  /** NFC-Chip UID für kontaktlose Anmeldung. */
  nfc_uid?: string | null;
}

export interface TaskTemplate {
  id: string;
  title: string;
  points: number;
  assigned_to: string | null;
  recurrence: 'daily' | 'weekly' | 'once';
  due_time: string | null;
  active: boolean;
}

export interface TaskInstance {
  id: string;
  template_id: string;
  assigned_to: string;
  date: string;
  completed_at: string | null;
  completed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  requires_approval: boolean;
  title: string;
  points: number;
}

export interface PointEvent {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  /** Basispreis. Tatsächlicher Preis beim Einlösen = `effective_cost`. */
  points_cost: number;
  /** Vom Backend pro Anfrage berechnet: points_cost × Altersfaktor des `user_id`-Parameters. */
  effective_cost?: number;
  /** Verwendeter Multiplikator (z.B. 0.6, 1.0, 1.6, 2.0). */
  age_factor?: number;
  available_to: string[] | null;
  active: boolean;
}

export interface RewardClaim {
  id: string;
  reward_id: string;
  user_id: string;
  claimed_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  /** Tatsächlich abgebuchte Punkte (Audit-Trail; kann von points_cost abweichen). */
  points_spent: number;
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

export interface MealPlan {
  days: { date: string; lunch: string; dinner: string }[];
}

export interface CachedWidget<T> {
  data: T;
  fetched_at: string;
  source_url: string;
}

// ============================================================
// Zod-Schemas
// ============================================================

// --- Waste / Müllkalender ------------------------------------

export const WasteTypeSchema = z.enum([
  'restmuell',
  'bioabfall',
  'papier',
  'wertstoff',
]);
export type WasteType = z.infer<typeof WasteTypeSchema>;

export const WasteEventSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: WasteTypeSchema,
  title: z.string(),
  fetched_at: z.string().datetime(),
});
export type WasteEvent = z.infer<typeof WasteEventSchema>;

export const WasteTodayResponseSchema = z.object({
  active: z.boolean(),
  events: z.array(WasteEventSchema),
  next: WasteEventSchema.nullable(),
  fetched_at: z.string().datetime(),
});
export type WasteTodayResponse = z.infer<typeof WasteTodayResponseSchema>;

export const WasteUpcomingResponseSchema = z.object({
  events: z.array(WasteEventSchema),
  fetched_at: z.string().datetime(),
});
export type WasteUpcomingResponse = z.infer<typeof WasteUpcomingResponseSchema>;

export const BirthdayTodaySchema = z.object({
  name: z.string(),
  age: z.number().int().nullable(),
});
export type BirthdayToday = z.infer<typeof BirthdayTodaySchema>;

export const BirthdayUpcomingSchema = z.object({
  name: z.string(),
  age: z.number().int().nullable(),
  daysUntil: z.number().int(),
});
export type BirthdayUpcoming = z.infer<typeof BirthdayUpcomingSchema>;

export const BirthdaysResponseSchema = z.object({
  today: BirthdayTodaySchema.nullable(),
  upcoming: z.array(BirthdayUpcomingSchema),
  fetched_at: z.string().datetime(),
});
export type BirthdaysResponse = z.infer<typeof BirthdaysResponseSchema>;

export const BirthdayAdminEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birth_month: z.number().int().min(1).max(12),
  birth_day: z.number().int().min(1).max(31),
  birth_year: z.number().int().nullable(),
  source: z.enum(['manual', 'carddav']),
  active: z.boolean(),
});
export type BirthdayAdminEntry = z.infer<typeof BirthdayAdminEntrySchema>;
