'use client';

import { useState, useEffect } from 'react';

interface WeatherHourly {
  time: string;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  weathercode: number;
}

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  weathercode: number;
  windspeed: number;
  hourly?: WeatherHourly[];
}

interface WeatherWidgetProps {
  data?: WeatherData;
  fetched_at?: string;
  loading?: boolean;
}

function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function getWeatherDesc(code: number): string {
  if (code === 0) return 'Klar';
  if (code <= 3) return 'Leicht bewölkt';
  if (code <= 48) return 'Neblig';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Schauer';
  if (code <= 99) return 'Gewitter';
  return 'Unbekannt';
}

function formatTime(isoTime: string): string {
  return new Date(isoTime).getHours().toString().padStart(2, '0') + ':00';
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

export default function WeatherWidget({ data, fetched_at, loading }: WeatherWidgetProps) {
  // currentHour only available after hydration — null prevents server/client mismatch
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const card = {
    background: '#fff',
    border: '0.5px solid rgba(0,0,0,0.07)',
    borderRadius: 16,
    padding: 18,
  };

  if (loading) return (
    <div style={{ ...card, height: 180 }} className="animate-pulse">
      <div style={{ background: '#e8e4de', borderRadius: 6, height: 14, width: 96, marginBottom: 12 }} />
      <div style={{ background: '#e8e4de', borderRadius: 6, height: 48, width: 128, marginBottom: 12 }} />
      <div style={{ background: '#e8e4de', borderRadius: 6, height: 14 }} />
    </div>
  );

  if (!data) return (
    <div style={{ ...card, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Wetterdaten nicht verfügbar</p>
    </div>
  );

  const stale = isStale(fetched_at);

  // Filter hourly: from now onward, next 6 entries
  // Works across midnight because backend provides forecast_days=2
  const hourlyItems = now !== null
    ? (data.hourly ?? [])
        .filter(h => new Date(h.time).getTime() >= now - 30 * 60 * 1000)
        .slice(0, 6)
    : [];

  const showFeelsLike =
    data.apparentTemperature !== undefined &&
    Math.round(data.apparentTemperature) !== Math.round(data.temperature);

  return (
    <div style={card}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-[10px] font-sans font-semibold uppercase tracking-wider"
          style={{ color: '#a09d99' }}
        >
          Wetter
        </h3>
        <div className="flex items-center gap-1.5">
          {fetched_at && (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: stale ? '#e0a020' : '#3a9a6e',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span className="text-[10px] font-sans" style={{ color: '#a09d99' }}>
                {stale ? 'veraltet' : 'aktuell'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main temperature */}
      <div className="flex items-center gap-4 mb-3">
        <span className="text-5xl">{getWeatherEmoji(data.weathercode)}</span>
        <div>
          <p
            className="text-4xl font-bold"
            style={{ color: '#1a1814', fontFamily: 'Georgia, serif' }}
          >
            {Math.round(data.temperature)}°C
          </p>
          <p className="text-sm font-sans" style={{ color: '#6b6760' }}>
            {getWeatherDesc(data.weathercode)}
          </p>
        </div>
      </div>

      {/* Detail row: feels-like, rain, wind */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
        {showFeelsLike && (
          <div className="flex items-center gap-1">
            <i
              className="ti ti-temperature"
              style={{ fontSize: 13, color: '#a09d99' }}
              aria-hidden="true"
            />
            <span className="text-xs font-sans" style={{ color: '#6b6760' }}>
              Gefühlt{' '}
              <span style={{ fontWeight: 600, color: '#1a1814' }}>
                {Math.round(data.apparentTemperature)}°
              </span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <i
            className="ti ti-droplet"
            style={{ fontSize: 13, color: '#a09d99' }}
            aria-hidden="true"
          />
          <span className="text-xs font-sans" style={{ color: '#6b6760' }}>
            Regen{' '}
            <span style={{ fontWeight: 600, color: '#1a1814' }}>
              {Math.round(data.precipitationProbability)}%
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <i
            className="ti ti-wind"
            style={{ fontSize: 13, color: '#a09d99' }}
            aria-hidden="true"
          />
          <span className="text-xs font-sans" style={{ color: '#6b6760' }}>
            <span style={{ fontWeight: 600, color: '#1a1814' }}>{data.windspeed}</span> km/h
          </span>
        </div>
      </div>

      {/* Hourly forecast — crosses midnight thanks to forecast_days=2 */}
      {hourlyItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {hourlyItems.map((h, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-0.5 flex-shrink-0 rounded-lg px-2 py-1.5"
              style={{ background: '#f5f2ee', minWidth: 52 }}
            >
              <span className="text-[11px] font-sans" style={{ color: '#a09d99' }}>
                {formatTime(h.time)}
              </span>
              <span className="text-sm font-semibold font-sans" style={{ color: '#1a1814' }}>
                {Math.round(h.temperature)}°
              </span>
              {h.precipitationProbability > 0 && (
                <div className="flex items-center gap-0.5">
                  <i
                    className="ti ti-droplet"
                    style={{ fontSize: 10, color: '#378ADD' }}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-sans" style={{ color: '#378ADD' }}>
                    {Math.round(h.precipitationProbability)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}