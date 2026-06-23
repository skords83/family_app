import { z } from 'zod';

export const HaClimateEntitySchema = z.object({
  entity_id: z.string(),
  name: z.string(),
  current_temperature: z.number().nullable(),
  target_temperature: z.number().nullable(),
  hvac_mode: z.string(),
});
export type HaClimateEntity = z.infer<typeof HaClimateEntitySchema>;

export const HaClimateResponseSchema = z.object({
  entities: z.array(HaClimateEntitySchema),
  fetched_at: z.string(),
});
export type HaClimateResponse = z.infer<typeof HaClimateResponseSchema>;
