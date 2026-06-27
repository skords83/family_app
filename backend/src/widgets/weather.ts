import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { WeatherDataSchema, WeatherResponseSchema, type WeatherData, type WeatherHourly, type WeatherDaily } from '@family/shared';

export const weatherRouter = Router();

async function fetchWeather(): Promise<WeatherData> {
  const lat = process.env.WEATHER_LAT ?? '53.5753';
  const lon = process.env.WEATHER_LON ?? '10.0153';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current_weather=true`
    + `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weathercode,relative_humidity_2m,pressure_msl,uv_index`
    + `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode_wmo,sunrise,sunset,uv_index_max`
    + `&forecast_days=7`
    + `&timezone=Europe%2FBerlin`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    throw new Error(`Open-Meteo API returned ${response.status}`);
  }

  const json = await response.json() as {
    current_weather: { temperature: number; weathercode: number; windspeed: number };
    hourly: {
      time: string[];
      temperature_2m: number[];
      apparent_temperature: number[];
      precipitation_probability: number[];
      weathercode: number[];
      relative_humidity_2m: number[];
      pressure_msl: number[];
      uv_index: number[];
    };
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: (number | null)[];
      windspeed_10m_max: (number | null)[];
      weathercode_wmo: number[];
      sunrise: string[];
      sunset: string[];
      uv_index_max: (number | null)[];
    };
  };

  const current = json.current_weather;
  const hourly = json.hourly;
  const daily = json.daily;

  const hourlyData: WeatherHourly[] = [];
  if (hourly?.time) {
    for (let i = 0; i < hourly.time.length; i++) {
      hourlyData.push({
        time: hourly.time[i],
        temperature: hourly.temperature_2m[i],
        apparentTemperature: hourly.apparent_temperature[i],
        precipitationProbability: hourly.precipitation_probability[i] ?? 0,
        weathercode: hourly.weathercode[i],
        humidity: hourly.relative_humidity_2m?.[i] ?? undefined,
        pressure: hourly.pressure_msl?.[i] ?? undefined,
        uvIndex: hourly.uv_index?.[i] != null ? hourly.uv_index[i] : undefined,
      });
    }
  }

  const dailyData: WeatherDaily[] = [];
  if (daily?.time) {
    for (let i = 0; i < daily.time.length; i++) {
      dailyData.push({
        date: daily.time[i],
        temperatureMin: daily.temperature_2m_min[i],
        temperatureMax: daily.temperature_2m_max[i],
        precipitationProbabilityMax: daily.precipitation_probability_max[i] ?? 0,
        windspeedMax: daily.windspeed_10m_max[i] ?? 0,
        weathercode: daily.weathercode_wmo[i],
        sunrise: daily.sunrise[i],
        sunset: daily.sunset[i],
        uvIndexMax: daily.uv_index_max?.[i] != null ? daily.uv_index_max[i] : undefined,
      });
    }
  }

  // Find the current hour's entry for apparent temp, precipitation, humidity, pressure, UV
  const now = new Date();
  const currentHourStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
  const currentEntry = hourlyData.find(h => h.time === currentHourStr);

  return WeatherDataSchema.parse({
    temperature: current.temperature,
    apparentTemperature: currentEntry?.apparentTemperature ?? current.temperature,
    precipitationProbability: currentEntry?.precipitationProbability ?? 0,
    weathercode: current.weathercode,
    windspeed: current.windspeed,
    humidity: currentEntry?.humidity,
    pressure: currentEntry?.pressure,
    uvIndex: currentEntry?.uvIndex,
    hourly: hourlyData,
    daily: dailyData,
  });
}

async function getCachedWeather(): Promise<{ data: WeatherData; fetched_at: string } | null> {
  const result = await pool.query(`
    SELECT data, fetched_at FROM widget_cache WHERE widget_type = 'weather'
  `);
  if (result.rows.length === 0) return null;
  return { data: result.rows[0].data, fetched_at: result.rows[0].fetched_at };
}

async function updateWeatherCache(data: WeatherData): Promise<string> {
  const result = await pool.query(`
    INSERT INTO widget_cache (widget_type, data, fetched_at)
    VALUES ('weather', $1, NOW())
    ON CONFLICT (widget_type)
    DO UPDATE SET data = $1, fetched_at = NOW()
    RETURNING fetched_at
  `, [JSON.stringify(data)]);
  return result.rows[0].fetched_at;
}

// GET /api/widgets/weather
weatherRouter.get('/', async (_req: Request, res: Response) => {
  try {
    let data: WeatherData;
    let fetched_at: string;
    let fromCache = false;

    try {
      data = await fetchWeather();
      fetched_at = await updateWeatherCache(data);
    } catch (fetchErr) {
      console.error('Weather fetch failed, trying cache:', fetchErr instanceof Error ? fetchErr.message : fetchErr);
      const cached = await getCachedWeather();
      if (!cached) {
        return res.status(503).json({ error: 'Weather data unavailable' });
      }
      data = cached.data;
      fetched_at = cached.fetched_at;
      fromCache = true;
    }

    return res.json(WeatherResponseSchema.parse({
      data,
      fetched_at: new Date(fetched_at).toISOString(),
      from_cache: fromCache,
    }));
  } catch (err) {
    console.error('Error in weather handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
