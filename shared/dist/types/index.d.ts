import { z } from 'zod';
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
    days: {
        date: string;
        lunch: string;
        dinner: string;
    }[];
}
export interface CachedWidget<T> {
    data: T;
    fetched_at: string;
    source_url: string;
}
export declare const WasteTypeSchema: z.ZodEnum<["restmuell", "bioabfall", "papier", "wertstoff"]>;
export type WasteType = z.infer<typeof WasteTypeSchema>;
export declare const WasteEventSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodString;
    date: z.ZodString;
    type: z.ZodEnum<["restmuell", "bioabfall", "papier", "wertstoff"]>;
    title: z.ZodString;
    fetched_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
    date: string;
    title: string;
    fetched_at: string;
    source: string;
}, {
    id: string;
    type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
    date: string;
    title: string;
    fetched_at: string;
    source: string;
}>;
export type WasteEvent = z.infer<typeof WasteEventSchema>;
export declare const WasteTodayResponseSchema: z.ZodObject<{
    active: z.ZodBoolean;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        date: z.ZodString;
        type: z.ZodEnum<["restmuell", "bioabfall", "papier", "wertstoff"]>;
        title: z.ZodString;
        fetched_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }, {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }>, "many">;
    next: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        date: z.ZodString;
        type: z.ZodEnum<["restmuell", "bioabfall", "papier", "wertstoff"]>;
        title: z.ZodString;
        fetched_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }, {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }>>;
    fetched_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    events: {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }[];
    fetched_at: string;
    active: boolean;
    next: {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    } | null;
}, {
    events: {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }[];
    fetched_at: string;
    active: boolean;
    next: {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    } | null;
}>;
export type WasteTodayResponse = z.infer<typeof WasteTodayResponseSchema>;
export declare const WasteUpcomingResponseSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        date: z.ZodString;
        type: z.ZodEnum<["restmuell", "bioabfall", "papier", "wertstoff"]>;
        title: z.ZodString;
        fetched_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }, {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }>, "many">;
    fetched_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    events: {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }[];
    fetched_at: string;
}, {
    events: {
        id: string;
        type: "restmuell" | "bioabfall" | "papier" | "wertstoff";
        date: string;
        title: string;
        fetched_at: string;
        source: string;
    }[];
    fetched_at: string;
}>;
export type WasteUpcomingResponse = z.infer<typeof WasteUpcomingResponseSchema>;
export declare const BirthdayTodaySchema: z.ZodObject<{
    name: z.ZodString;
    age: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    age: number | null;
}, {
    name: string;
    age: number | null;
}>;
export type BirthdayToday = z.infer<typeof BirthdayTodaySchema>;
export declare const BirthdayUpcomingSchema: z.ZodObject<{
    name: z.ZodString;
    age: z.ZodNullable<z.ZodNumber>;
    daysUntil: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    age: number | null;
    daysUntil: number;
}, {
    name: string;
    age: number | null;
    daysUntil: number;
}>;
export type BirthdayUpcoming = z.infer<typeof BirthdayUpcomingSchema>;
export declare const BirthdaysResponseSchema: z.ZodObject<{
    today: z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        age: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        age: number | null;
    }, {
        name: string;
        age: number | null;
    }>>;
    upcoming: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        age: z.ZodNullable<z.ZodNumber>;
        daysUntil: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        age: number | null;
        daysUntil: number;
    }, {
        name: string;
        age: number | null;
        daysUntil: number;
    }>, "many">;
    fetched_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fetched_at: string;
    today: {
        name: string;
        age: number | null;
    } | null;
    upcoming: {
        name: string;
        age: number | null;
        daysUntil: number;
    }[];
}, {
    fetched_at: string;
    today: {
        name: string;
        age: number | null;
    } | null;
    upcoming: {
        name: string;
        age: number | null;
        daysUntil: number;
    }[];
}>;
export type BirthdaysResponse = z.infer<typeof BirthdaysResponseSchema>;
export declare const BirthdayAdminEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    birth_month: z.ZodNumber;
    birth_day: z.ZodNumber;
    birth_year: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<["manual", "carddav"]>;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    source: "manual" | "carddav";
    active: boolean;
    birth_month: number;
    birth_day: number;
    birth_year: number | null;
}, {
    id: string;
    name: string;
    source: "manual" | "carddav";
    active: boolean;
    birth_month: number;
    birth_day: number;
    birth_year: number | null;
}>;
export type BirthdayAdminEntry = z.infer<typeof BirthdayAdminEntrySchema>;
//# sourceMappingURL=index.d.ts.map