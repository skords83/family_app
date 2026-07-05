"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirthdayAdminEntrySchema = exports.BirthdaysResponseSchema = exports.BirthdayUpcomingSchema = exports.BirthdayTodaySchema = exports.WasteUpcomingResponseSchema = exports.WasteTodayResponseSchema = exports.WasteEventSchema = exports.WasteTypeSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// Zod-Schemas
// ============================================================
// --- Waste / Müllkalender ------------------------------------
exports.WasteTypeSchema = zod_1.z.enum([
    'restmuell',
    'bioabfall',
    'papier',
    'wertstoff',
]);
exports.WasteEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    source: zod_1.z.string(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    type: exports.WasteTypeSchema,
    title: zod_1.z.string(),
    fetched_at: zod_1.z.string().datetime(),
});
exports.WasteTodayResponseSchema = zod_1.z.object({
    active: zod_1.z.boolean(),
    events: zod_1.z.array(exports.WasteEventSchema),
    next: exports.WasteEventSchema.nullable(),
    fetched_at: zod_1.z.string().datetime(),
});
exports.WasteUpcomingResponseSchema = zod_1.z.object({
    events: zod_1.z.array(exports.WasteEventSchema),
    fetched_at: zod_1.z.string().datetime(),
});
exports.BirthdayTodaySchema = zod_1.z.object({
    name: zod_1.z.string(),
    age: zod_1.z.number().int().nullable(),
});
exports.BirthdayUpcomingSchema = zod_1.z.object({
    name: zod_1.z.string(),
    age: zod_1.z.number().int().nullable(),
    daysUntil: zod_1.z.number().int(),
});
exports.BirthdaysResponseSchema = zod_1.z.object({
    today: exports.BirthdayTodaySchema.nullable(),
    upcoming: zod_1.z.array(exports.BirthdayUpcomingSchema),
    fetched_at: zod_1.z.string().datetime(),
});
exports.BirthdayAdminEntrySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    birth_month: zod_1.z.number().int().min(1).max(12),
    birth_day: zod_1.z.number().int().min(1).max(31),
    birth_year: zod_1.z.number().int().nullable(),
    source: zod_1.z.enum(['manual', 'carddav']),
    active: zod_1.z.boolean(),
});
//# sourceMappingURL=index.js.map