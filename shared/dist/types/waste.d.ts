import { z } from 'zod';
/**
 * Bekannte Tonnen-Typen.
 * Erweiterbar bei Bedarf (z.B. 'tannenbaum' für saisonale Sammlungen).
 */
export declare const WasteTypeSchema: z.ZodEnum<["restmuell", "bioabfall", "papier", "wertstoff"]>;
export type WasteType = z.infer<typeof WasteTypeSchema>;
/**
 * Ein einzelnes Abholungs-Event, wie es in external_events gespeichert wird.
 */
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
/**
 * Response für GET /api/widgets/waste/upcoming
 *
 * Liefert die nächsten ~4 Abholungen für die Detailansicht.
 */
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
//# sourceMappingURL=waste.d.ts.map