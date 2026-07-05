import { z } from 'zod';
export declare const WeatherHourlySchema: z.ZodObject<{
    time: z.ZodString;
    temperature: z.ZodNumber;
    apparentTemperature: z.ZodNumber;
    precipitationProbability: z.ZodNumber;
    weathercode: z.ZodNumber;
    humidity: z.ZodOptional<z.ZodNumber>;
    pressure: z.ZodOptional<z.ZodNumber>;
    uvIndex: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    temperature: number;
    time: string;
    apparentTemperature: number;
    precipitationProbability: number;
    weathercode: number;
    humidity?: number | undefined;
    pressure?: number | undefined;
    uvIndex?: number | undefined;
}, {
    temperature: number;
    time: string;
    apparentTemperature: number;
    precipitationProbability: number;
    weathercode: number;
    humidity?: number | undefined;
    pressure?: number | undefined;
    uvIndex?: number | undefined;
}>;
export type WeatherHourly = z.infer<typeof WeatherHourlySchema>;
export declare const WeatherDailySchema: z.ZodObject<{
    date: z.ZodString;
    temperatureMin: z.ZodNumber;
    temperatureMax: z.ZodNumber;
    precipitationProbabilityMax: z.ZodNumber;
    windspeedMax: z.ZodNumber;
    weathercode: z.ZodNumber;
    sunrise: z.ZodString;
    sunset: z.ZodString;
    uvIndexMax: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    date: string;
    weathercode: number;
    temperatureMin: number;
    temperatureMax: number;
    precipitationProbabilityMax: number;
    windspeedMax: number;
    sunrise: string;
    sunset: string;
    uvIndexMax?: number | undefined;
}, {
    date: string;
    weathercode: number;
    temperatureMin: number;
    temperatureMax: number;
    precipitationProbabilityMax: number;
    windspeedMax: number;
    sunrise: string;
    sunset: string;
    uvIndexMax?: number | undefined;
}>;
export type WeatherDaily = z.infer<typeof WeatherDailySchema>;
export declare const WeatherDataSchema: z.ZodObject<{
    temperature: z.ZodNumber;
    apparentTemperature: z.ZodNumber;
    precipitationProbability: z.ZodNumber;
    weathercode: z.ZodNumber;
    windspeed: z.ZodNumber;
    humidity: z.ZodOptional<z.ZodNumber>;
    pressure: z.ZodOptional<z.ZodNumber>;
    uvIndex: z.ZodOptional<z.ZodNumber>;
    hourly: z.ZodOptional<z.ZodArray<z.ZodObject<{
        time: z.ZodString;
        temperature: z.ZodNumber;
        apparentTemperature: z.ZodNumber;
        precipitationProbability: z.ZodNumber;
        weathercode: z.ZodNumber;
        humidity: z.ZodOptional<z.ZodNumber>;
        pressure: z.ZodOptional<z.ZodNumber>;
        uvIndex: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        temperature: number;
        time: string;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        humidity?: number | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
    }, {
        temperature: number;
        time: string;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        humidity?: number | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
    }>, "many">>;
    daily: z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        temperatureMin: z.ZodNumber;
        temperatureMax: z.ZodNumber;
        precipitationProbabilityMax: z.ZodNumber;
        windspeedMax: z.ZodNumber;
        weathercode: z.ZodNumber;
        sunrise: z.ZodString;
        sunset: z.ZodString;
        uvIndexMax: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        weathercode: number;
        temperatureMin: number;
        temperatureMax: number;
        precipitationProbabilityMax: number;
        windspeedMax: number;
        sunrise: string;
        sunset: string;
        uvIndexMax?: number | undefined;
    }, {
        date: string;
        weathercode: number;
        temperatureMin: number;
        temperatureMax: number;
        precipitationProbabilityMax: number;
        windspeedMax: number;
        sunrise: string;
        sunset: string;
        uvIndexMax?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    temperature: number;
    apparentTemperature: number;
    precipitationProbability: number;
    weathercode: number;
    windspeed: number;
    humidity?: number | undefined;
    daily?: {
        date: string;
        weathercode: number;
        temperatureMin: number;
        temperatureMax: number;
        precipitationProbabilityMax: number;
        windspeedMax: number;
        sunrise: string;
        sunset: string;
        uvIndexMax?: number | undefined;
    }[] | undefined;
    pressure?: number | undefined;
    uvIndex?: number | undefined;
    hourly?: {
        temperature: number;
        time: string;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        humidity?: number | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
    }[] | undefined;
}, {
    temperature: number;
    apparentTemperature: number;
    precipitationProbability: number;
    weathercode: number;
    windspeed: number;
    humidity?: number | undefined;
    daily?: {
        date: string;
        weathercode: number;
        temperatureMin: number;
        temperatureMax: number;
        precipitationProbabilityMax: number;
        windspeedMax: number;
        sunrise: string;
        sunset: string;
        uvIndexMax?: number | undefined;
    }[] | undefined;
    pressure?: number | undefined;
    uvIndex?: number | undefined;
    hourly?: {
        temperature: number;
        time: string;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        humidity?: number | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
    }[] | undefined;
}>;
export type WeatherData = z.infer<typeof WeatherDataSchema>;
export declare const WeatherResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        temperature: z.ZodNumber;
        apparentTemperature: z.ZodNumber;
        precipitationProbability: z.ZodNumber;
        weathercode: z.ZodNumber;
        windspeed: z.ZodNumber;
        humidity: z.ZodOptional<z.ZodNumber>;
        pressure: z.ZodOptional<z.ZodNumber>;
        uvIndex: z.ZodOptional<z.ZodNumber>;
        hourly: z.ZodOptional<z.ZodArray<z.ZodObject<{
            time: z.ZodString;
            temperature: z.ZodNumber;
            apparentTemperature: z.ZodNumber;
            precipitationProbability: z.ZodNumber;
            weathercode: z.ZodNumber;
            humidity: z.ZodOptional<z.ZodNumber>;
            pressure: z.ZodOptional<z.ZodNumber>;
            uvIndex: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            temperature: number;
            time: string;
            apparentTemperature: number;
            precipitationProbability: number;
            weathercode: number;
            humidity?: number | undefined;
            pressure?: number | undefined;
            uvIndex?: number | undefined;
        }, {
            temperature: number;
            time: string;
            apparentTemperature: number;
            precipitationProbability: number;
            weathercode: number;
            humidity?: number | undefined;
            pressure?: number | undefined;
            uvIndex?: number | undefined;
        }>, "many">>;
        daily: z.ZodOptional<z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            temperatureMin: z.ZodNumber;
            temperatureMax: z.ZodNumber;
            precipitationProbabilityMax: z.ZodNumber;
            windspeedMax: z.ZodNumber;
            weathercode: z.ZodNumber;
            sunrise: z.ZodString;
            sunset: z.ZodString;
            uvIndexMax: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            date: string;
            weathercode: number;
            temperatureMin: number;
            temperatureMax: number;
            precipitationProbabilityMax: number;
            windspeedMax: number;
            sunrise: string;
            sunset: string;
            uvIndexMax?: number | undefined;
        }, {
            date: string;
            weathercode: number;
            temperatureMin: number;
            temperatureMax: number;
            precipitationProbabilityMax: number;
            windspeedMax: number;
            sunrise: string;
            sunset: string;
            uvIndexMax?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        temperature: number;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        windspeed: number;
        humidity?: number | undefined;
        daily?: {
            date: string;
            weathercode: number;
            temperatureMin: number;
            temperatureMax: number;
            precipitationProbabilityMax: number;
            windspeedMax: number;
            sunrise: string;
            sunset: string;
            uvIndexMax?: number | undefined;
        }[] | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
        hourly?: {
            temperature: number;
            time: string;
            apparentTemperature: number;
            precipitationProbability: number;
            weathercode: number;
            humidity?: number | undefined;
            pressure?: number | undefined;
            uvIndex?: number | undefined;
        }[] | undefined;
    }, {
        temperature: number;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        windspeed: number;
        humidity?: number | undefined;
        daily?: {
            date: string;
            weathercode: number;
            temperatureMin: number;
            temperatureMax: number;
            precipitationProbabilityMax: number;
            windspeedMax: number;
            sunrise: string;
            sunset: string;
            uvIndexMax?: number | undefined;
        }[] | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
        hourly?: {
            temperature: number;
            time: string;
            apparentTemperature: number;
            precipitationProbability: number;
            weathercode: number;
            humidity?: number | undefined;
            pressure?: number | undefined;
            uvIndex?: number | undefined;
        }[] | undefined;
    }>;
    fetched_at: z.ZodString;
    from_cache: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fetched_at: string;
    from_cache: boolean;
    data: {
        temperature: number;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        windspeed: number;
        humidity?: number | undefined;
        daily?: {
            date: string;
            weathercode: number;
            temperatureMin: number;
            temperatureMax: number;
            precipitationProbabilityMax: number;
            windspeedMax: number;
            sunrise: string;
            sunset: string;
            uvIndexMax?: number | undefined;
        }[] | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
        hourly?: {
            temperature: number;
            time: string;
            apparentTemperature: number;
            precipitationProbability: number;
            weathercode: number;
            humidity?: number | undefined;
            pressure?: number | undefined;
            uvIndex?: number | undefined;
        }[] | undefined;
    };
}, {
    fetched_at: string;
    from_cache: boolean;
    data: {
        temperature: number;
        apparentTemperature: number;
        precipitationProbability: number;
        weathercode: number;
        windspeed: number;
        humidity?: number | undefined;
        daily?: {
            date: string;
            weathercode: number;
            temperatureMin: number;
            temperatureMax: number;
            precipitationProbabilityMax: number;
            windspeedMax: number;
            sunrise: string;
            sunset: string;
            uvIndexMax?: number | undefined;
        }[] | undefined;
        pressure?: number | undefined;
        uvIndex?: number | undefined;
        hourly?: {
            temperature: number;
            time: string;
            apparentTemperature: number;
            precipitationProbability: number;
            weathercode: number;
            humidity?: number | undefined;
            pressure?: number | undefined;
            uvIndex?: number | undefined;
        }[] | undefined;
    };
}>;
export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
//# sourceMappingURL=weather.d.ts.map