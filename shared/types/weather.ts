import { z } from 'zod';

export const WeatherHourlySchema = z.object({
  time: z.string(),
  temperature: z.number(),
});
export type WeatherHourly = z.infer<typeof WeatherHourlySchema>;

export const WeatherDataSchema = z.object({
  temperature: z.number(),
  weathercode: z.number(),
  windspeed: z.number(),
  hourly: z.array(WeatherHourlySchema).optional(),
});
export type WeatherData = z.infer<typeof WeatherDataSchema>;

export const WeatherResponseSchema = z.object({
  data: WeatherDataSchema,
  fetched_at: z.string().datetime(),
  from_cache: z.boolean(),
});
export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
