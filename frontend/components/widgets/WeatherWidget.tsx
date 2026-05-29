'use client';

interface WeatherData {
  temperature: number; weathercode: number; windspeed: number;
  hourly?: { time: string; temperature: number }[];
}
interface WeatherWidgetProps {
  data?: WeatherData; fetched_at?: string; loading?: boolean;
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
  const card = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: 18 };

  if (loading) return (
    <div style={{ ...card, height: 160 }} className="animate-pulse">
      <div style={{ background: '#e8e4de', borderRadius: 6, height: 14, width: 96, marginBottom: 12 }} />
      <div style={{ background: '#e8e4de', borderRadius: 6, height: 48, width: 128, marginBottom: 12 }} />
      <div style={{ background: '#e8e4de', borderRadius: 6, height: 14 }} />
    </div>
  );

  if (!data) return (
    <div style={{ ...card, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Wetterdaten nicht verfügbar</p>
    </div>
  );

  const stale = isStale(fetched_at);
  const currentHour = new Date().getHours();
  const hourlyItems = (data.hourly ?? [])
    .filter(h => { const hr = new Date(h.time).getHours(); return hr >= currentHour && hr <= currentHour + 6; })
    .slice(0, 6);

  return (
    <div style={card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99' }}>Wetter</h3>
        <div className="flex items-center gap-2">
          {stale && <span className="text-xs" style={{ color: '#f0a500' }}>⚠ veraltet</span>}
          {fetched_at && <span className="text-xs font-sans" style={{ color: '#a09d99' }}>{new Date(fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <span className="text-5xl">{getWeatherEmoji(data.weathercode)}</span>
        <div>
          <p className="text-4xl font-bold" style={{ color: '#1a1814', fontFamily: 'Georgia, serif' }}>{Math.round(data.temperature)}°C</p>
          <p className="text-sm font-sans" style={{ color: '#6b6760' }}>{getWeatherDesc(data.weathercode)}</p>
          <p className="text-xs font-sans" style={{ color: '#a09d99' }}>💨 {data.windspeed} km/h</p>
        </div>
      </div>

      {hourlyItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {hourlyItems.map((h, idx) => (
            <div key={idx} className="flex flex-col items-center gap-0.5 flex-shrink-0 rounded-lg px-2 py-1.5" style={{ background: '#f5f2ee', minWidth: 48 }}>
              <span className="text-xs font-sans" style={{ color: '#a09d99' }}>{formatTime(h.time)}</span>
              <span className="text-sm font-semibold font-sans" style={{ color: '#1a1814' }}>{Math.round(h.temperature)}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
