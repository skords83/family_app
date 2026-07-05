"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WasteUpcomingResponseSchema = exports.WasteTodayResponseSchema = exports.WasteEventSchema = exports.WasteTypeSchema = void 0;
const zod_1 = require("zod");
/**
 * Bekannte Tonnen-Typen.
 * Erweiterbar bei Bedarf (z.B. 'tannenbaum' für saisonale Sammlungen).
 */
exports.WasteTypeSchema = zod_1.z.enum([
    'restmuell',
    'bioabfall',
    'papier',
    'wertstoff',
]);
/**
 * Ein einzelnes Abholungs-Event, wie es in external_events gespeichert wird.
 */
exports.WasteEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    source: zod_1.z.string(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    type: exports.WasteTypeSchema,
    title: zod_1.z.string(),
    fetched_at: zod_1.z.string().datetime(),
});
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
exports.WasteTodayResponseSchema = zod_1.z.object({
    active: zod_1.z.boolean(),
    events: zod_1.z.array(exports.WasteEventSchema),
    next: exports.WasteEventSchema.nullable(),
    fetched_at: zod_1.z.string().datetime(),
});
/**
 * Response für GET /api/widgets/waste/upcoming
 *
 * Liefert die nächsten ~4 Abholungen für die Detailansicht.
 */
exports.WasteUpcomingResponseSchema = zod_1.z.object({
    events: zod_1.z.array(exports.WasteEventSchema),
    fetched_at: zod_1.z.string().datetime(),
});
//# sourceMappingURL=waste.js.map