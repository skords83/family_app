"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherResponseSchema = exports.WeatherDataSchema = exports.WeatherDailySchema = exports.WeatherHourlySchema = void 0;
const zod_1 = require("zod");
exports.WeatherHourlySchema = zod_1.z.object({
    time: zod_1.z.string(),
    temperature: zod_1.z.number(),
    apparentTemperature: zod_1.z.number(),
    precipitationProbability: zod_1.z.number(),
    weathercode: zod_1.z.number(),
    humidity: zod_1.z.number().optional(),
    pressure: zod_1.z.number().optional(),
    uvIndex: zod_1.z.number().optional(),
});
exports.WeatherDailySchema = zod_1.z.object({
    date: zod_1.z.string(),
    temperatureMin: zod_1.z.number(),
    temperatureMax: zod_1.z.number(),
    precipitationProbabilityMax: zod_1.z.number(),
    windspeedMax: zod_1.z.number(),
    weathercode: zod_1.z.number(),
    sunrise: zod_1.z.string(),
    sunset: zod_1.z.string(),
    uvIndexMax: zod_1.z.number().optional(),
});
exports.WeatherDataSchema = zod_1.z.object({
    temperature: zod_1.z.number(),
    apparentTemperature: zod_1.z.number(),
    precipitationProbability: zod_1.z.number(),
    weathercode: zod_1.z.number(),
    windspeed: zod_1.z.number(),
    humidity: zod_1.z.number().optional(),
    pressure: zod_1.z.number().optional(),
    uvIndex: zod_1.z.number().optional(),
    hourly: zod_1.z.array(exports.WeatherHourlySchema).optional(),
    daily: zod_1.z.array(exports.WeatherDailySchema).optional(),
});
exports.WeatherResponseSchema = zod_1.z.object({
    data: exports.WeatherDataSchema,
    fetched_at: zod_1.z.string().datetime(),
    from_cache: zod_1.z.boolean(),
});
//# sourceMappingURL=weather.js.map