import { z } from 'zod';
export declare const HaClimateEntitySchema: z.ZodObject<{
    entity_id: z.ZodString;
    name: z.ZodString;
    current_temperature: z.ZodNullable<z.ZodNumber>;
    target_temperature: z.ZodNullable<z.ZodNumber>;
    hvac_mode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    entity_id: string;
    current_temperature: number | null;
    target_temperature: number | null;
    hvac_mode: string;
}, {
    name: string;
    entity_id: string;
    current_temperature: number | null;
    target_temperature: number | null;
    hvac_mode: string;
}>;
export type HaClimateEntity = z.infer<typeof HaClimateEntitySchema>;
export declare const HaSensorEntitySchema: z.ZodObject<{
    entity_id: z.ZodString;
    name: z.ZodString;
    value: z.ZodNullable<z.ZodNumber>;
    unit: z.ZodString;
    device_class: z.ZodEnum<["temperature", "humidity"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    value: number | null;
    entity_id: string;
    unit: string;
    device_class: "temperature" | "humidity";
}, {
    name: string;
    value: number | null;
    entity_id: string;
    unit: string;
    device_class: "temperature" | "humidity";
}>;
export type HaSensorEntity = z.infer<typeof HaSensorEntitySchema>;
export declare const HaClimateResponseSchema: z.ZodObject<{
    entities: z.ZodArray<z.ZodObject<{
        entity_id: z.ZodString;
        name: z.ZodString;
        current_temperature: z.ZodNullable<z.ZodNumber>;
        target_temperature: z.ZodNullable<z.ZodNumber>;
        hvac_mode: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        entity_id: string;
        current_temperature: number | null;
        target_temperature: number | null;
        hvac_mode: string;
    }, {
        name: string;
        entity_id: string;
        current_temperature: number | null;
        target_temperature: number | null;
        hvac_mode: string;
    }>, "many">;
    sensors: z.ZodArray<z.ZodObject<{
        entity_id: z.ZodString;
        name: z.ZodString;
        value: z.ZodNullable<z.ZodNumber>;
        unit: z.ZodString;
        device_class: z.ZodEnum<["temperature", "humidity"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: number | null;
        entity_id: string;
        unit: string;
        device_class: "temperature" | "humidity";
    }, {
        name: string;
        value: number | null;
        entity_id: string;
        unit: string;
        device_class: "temperature" | "humidity";
    }>, "many">;
    fetched_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fetched_at: string;
    entities: {
        name: string;
        entity_id: string;
        current_temperature: number | null;
        target_temperature: number | null;
        hvac_mode: string;
    }[];
    sensors: {
        name: string;
        value: number | null;
        entity_id: string;
        unit: string;
        device_class: "temperature" | "humidity";
    }[];
}, {
    fetched_at: string;
    entities: {
        name: string;
        entity_id: string;
        current_temperature: number | null;
        target_temperature: number | null;
        hvac_mode: string;
    }[];
    sensors: {
        name: string;
        value: number | null;
        entity_id: string;
        unit: string;
        device_class: "temperature" | "humidity";
    }[];
}>;
export type HaClimateResponse = z.infer<typeof HaClimateResponseSchema>;
//# sourceMappingURL=homeassistant.d.ts.map