"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarCreateInputSchema = exports.CalendarResponseSchema = exports.CalendarMetaSchema = exports.CalendarEventSchema = void 0;
const zod_1 = require("zod");
exports.CalendarEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    start: zod_1.z.string().datetime(),
    end: zod_1.z.string().datetime(),
    allDay: zod_1.z.boolean(),
    color: zod_1.z.string().optional(),
    calendarName: zod_1.z.string().optional(),
    recurring: zod_1.z.boolean().optional(),
});
exports.CalendarMetaSchema = zod_1.z.object({
    url: zod_1.z.string(),
    color: zod_1.z.string(),
    name: zod_1.z.string(),
});
exports.CalendarResponseSchema = zod_1.z.object({
    events: zod_1.z.array(exports.CalendarEventSchema),
    fetched_at: zod_1.z.string().datetime(),
    from_cache: zod_1.z.boolean(),
});
exports.CalendarCreateInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    start: zod_1.z.string().datetime(),
    end: zod_1.z.string().datetime(),
    allDay: zod_1.z.boolean(),
    calendarUrl: zod_1.z.string().url(),
});
//# sourceMappingURL=calendar.js.map