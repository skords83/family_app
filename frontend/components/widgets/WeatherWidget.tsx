'use client';

interface WeatherData {
  temperature: number;
  weathercode: number;
  windspeed: number;
  hourly?: { time: string; temperature: number }[];
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
  const date = new Date(isoTime);
  return date.getHours().toString().padStart(2, '0') + ':00';
}

function isStale(fetchedAt?: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs;
}

export default function WeatherWidget({ data, fetched_at, loading }: WeatherWidgetProps) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 animate-pulse h-40">
        <div className="h-4 bg-slate-700 rounded w-24 mb-3" />
        <div className="h-12 bg-slate-700 rounded w-32 mb-3" />
        <div className="h-4 bg-slate-700 rounded w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex items-center justify-center h-40">
        <p className="text-slate-500 text-sm">Wetterdaten nicht verfügbar</p>
      </div>
    );
  }

  const stale = isStale(fetched_at);
  const now = new Date();
  const currentHour = now.getHours();

  // Filter hourly data to show upcoming hours today
  const hourlyItems = (data.hourly ?? [])
    .filter((h) => {
      const hour = new Date(h.time).getHours();
      return hour >= currentHour && hour <= currentHour + 6;
    })
    .slice(0, 6);

  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Wetter</h3>
        <div className="flex items-center gap-2">
          {stale && (
            <span className="text-xs text-amber-400">⚠ veraltet</span>
          )}
          {fetched_at && (
            <span className="text-xs text-slate-500">
              {new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Current weather */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-5xl">{getWeatherEmoji(data.weathercode)}</span>
        <div>
          <p className="text-4xl font-bold text-white">{Math.round(data.temperature)}°C</p>
          <p className="text-sm text-slate-400">{getWeatherDesc(data.weathercode)}</p>
          <p className="text-xs text-slate-500">💨 {data.windspeed} km/h</p>
        </div>
      </div>

      {/* Hourly forecast strip */}
      {hourlyItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {hourlyItems.map((h, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-0.5 flex-shrink-0 bg-slate-700/50 rounded-lg px-2 py-1.5 min-w-[44px]"
            >
              <span className="text-xs text-slate-400">{formatTime(h.time)}</span>
              <span className="text-sm font-semibold text-slate-200">{Math.round(h.temperature)}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
