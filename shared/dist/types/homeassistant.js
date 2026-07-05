"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaClimateResponseSchema = exports.HaSensorEntitySchema = exports.HaClimateEntitySchema = void 0;
const zod_1 = require("zod");
exports.HaClimateEntitySchema = zod_1.z.object({
    entity_id: zod_1.z.string(),
    name: zod_1.z.string(),
    current_temperature: zod_1.z.number().nullable(),
    target_temperature: zod_1.z.number().nullable(),
    hvac_mode: zod_1.z.string(),
});
exports.HaSensorEntitySchema = zod_1.z.object({
    entity_id: zod_1.z.string(),
    name: zod_1.z.string(),
    value: zod_1.z.number().nullable(),
    unit: zod_1.z.string(),
    device_class: zod_1.z.enum(['temperature', 'humidity']),
});
exports.HaClimateResponseSchema = zod_1.z.object({
    entities: zod_1.z.array(exports.HaClimateEntitySchema),
    sensors: zod_1.z.array(exports.HaSensorEntitySchema),
    fetched_at: zod_1.z.string(),
});
//# sourceMappingURL=homeassistant.js.map