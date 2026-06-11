import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { WeatherDataSchema, WeatherResponseSchema, type WeatherData, type WeatherHourly } from '@family/shared';

export const weatherRouter = Router();

async function fetchWeather(): Promise<WeatherData> {
  const lat = process.env.WEATHER_LAT ?? '53.5753';
  const lon = process.env.WEATHER_LON ?? '10.0153';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current_weather=true`
    + `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weathercode`
    + `&forecast_days=2`
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
    };
  };

  const current = json.current_weather;
  const hourly = json.hourly;

  const hourlyData: WeatherHourly[] = [];
  if (hourly?.time) {
    for (let i = 0; i < hourly.time.length; i++) {
      hourlyData.push({
        time: hourly.time[i],
        temperature: hourly.temperature_2m[i],
        apparentTemperature: hourly.apparent_temperature[i],
        precipitationProbability: hourly.precipitation_probability[i],
        weathercode: hourly.weathercode[i],
      });
    }
  }

  // Find the current hour's entry for apparent temp + precipitation
  const now = new Date();
  const currentHourStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
  const currentEntry = hourlyData.find(h => h.time === currentHourStr);

  return WeatherDataSchema.parse({
    temperature: current.temperature,
    apparentTemperature: currentEntry?.apparentTemperature ?? current.temperature,
    precipitationProbability: currentEntry?.precipitationProbability ?? 0,
    weathercode: current.weathercode,
    windspeed: current.windspeed,
    hourly: hourlyData,
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
      console.error('Weather fetch failed, trying cache:', fetchErr);
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