import { z } from 'zod';

export const WeatherHourlySchema = z.object({
  time: z.string(),
  temperature: z.number(),
  apparentTemperature: z.number(),
  precipitationProbability: z.number(),
  weathercode: z.number(),
  humidity: z.number().optional(),
  pressure: z.number().optional(),
  uvIndex: z.number().optional(),
});
export type WeatherHourly = z.infer<typeof WeatherHourlySchema>;

export const WeatherDailySchema = z.object({
  date: z.string(),
  temperatureMin: z.number(),
  temperatureMax: z.number(),
  precipitationProbabilityMax: z.number(),
  windspeedMax: z.number(),
  weathercode: z.number(),
  sunrise: z.string(),
  sunset: z.string(),
  uvIndexMax: z.number().optional(),
});
export type WeatherDaily = z.infer<typeof WeatherDailySchema>;

export const WeatherDataSchema = z.object({
  temperature: z.number(),
  apparentTemperature: z.number(),
  precipitationProbability: z.number(),
  weathercode: z.number(),
  windspeed: z.number(),
  humidity: z.number().optional(),
  pressure: z.number().optional(),
  uvIndex: z.number().optional(),
  hourly: z.array(WeatherHourlySchema).optional(),
  daily: z.array(WeatherDailySchema).optional(),
});
export type WeatherData = z.infer<typeof WeatherDataSchema>;

export const WeatherResponseSchema = z.object({
  data: WeatherDataSchema,
  fetched_at: z.string().datetime(),
  from_cache: z.boolean(),
});
export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
