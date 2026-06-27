'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import PageHeader from '@/components/ui/PageHeader';

interface WeatherHourly {
  time: string;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  weathercode: number;
  humidity?: number;
  pressure?: number;
  uvIndex?: number;
}

interface WeatherDaily {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbabilityMax: number;
  windspeedMax: number;
  weathercode: number;
  sunrise: string;
  sunset: string;
  uvIndexMax?: number;
}

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  weathercode: number;
  windspeed: number;
  humidity?: number;
  pressure?: number;
  uvIndex?: number;
  hourly?: WeatherHourly[];
  daily?: WeatherDaily[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

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

function formatHHMM(isoStr: string): string {
  const d = new Date(isoStr);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function formatDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long' });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
}

function todayBerlin(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}

function uvLabel(uv: number): string {
  if (uv <= 2) return 'Niedrig';
  if (uv <= 5) return 'Mäßig';
  if (uv <= 7) return 'Hoch';
  if (uv <= 10) return 'Sehr hoch';
  return 'Extrem';
}

function uvColor(uv: number): string {
  if (uv <= 2) return '#3a9a6e';
  if (uv <= 5) return '#c9a020';
  if (uv <= 7) return '#e07820';
  if (uv <= 10) return '#c03030';
  return '#8b00a0';
}

const card: CSSProperties = {
  background: '#fff',
  border: '0.5px solid rgba(0,0,0,0.07)',
  borderRadius: 16,
  padding: 20,
};

function StatCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 14, color: '#a09d99' }} aria-hidden="true" />
        <span className="font-sans" style={{ fontSize: 11, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <span className="font-sans" style={{ fontSize: 18, fontWeight: 600, color: '#1a1814' }}>
        {value}
      </span>
    </div>
  );
}

function TodayBlock({ data, todayDaily }: { data: WeatherData; todayDaily?: WeatherDaily }) {
  const uv = data.uvIndex ?? todayDaily?.uvIndexMax;
  return (
    <div style={card}>
      {/* Kompakte Kopfzeile: Emoji + Temp + Beschreibung + Min/Max in einer Linie */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>{getWeatherEmoji(data.weathercode)}</span>
        <span style={{ fontSize: 36, fontWeight: 700, color: '#1a1814', fontFamily: 'Georgia, serif', lineHeight: 1, flexShrink: 0 }}>
          {Math.round(data.temperature)}°
        </span>
        <span className="font-sans" style={{ fontSize: 15, color: '#6b6760', flexShrink: 0 }}>
          {getWeatherDesc(data.weathercode)}
        </span>
        {todayDaily && (
          <>
            <div style={{ flex: 1 }} />
            <span className="font-sans" style={{ fontSize: 13, color: '#a09d99', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600, color: '#1a1814' }}>{Math.round(todayDaily.temperatureMax)}°</span>
              {' / '}
              <span>{Math.round(todayDaily.temperatureMin)}°</span>
              <span style={{ marginLeft: 4 }}>heute</span>
            </span>
          </>
        )}
      </div>

      {/* Stats – alle in einer Zeile */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 14, borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
        <StatCell icon="ti-temperature" label="Gefühlt" value={`${Math.round(data.apparentTemperature)}°`} />
        <StatCell icon="ti-droplet" label="Regen" value={`${Math.round(data.precipitationProbability)}%`} />
        <StatCell icon="ti-wind" label="Wind" value={`${Math.round(data.windspeed)} km/h`} />
        {data.humidity !== undefined && (
          <StatCell icon="ti-droplets" label="Luftfeuchte" value={`${Math.round(data.humidity)}%`} />
        )}
        {data.pressure !== undefined && (
          <StatCell icon="ti-gauge" label="Luftdruck" value={`${Math.round(data.pressure)} hPa`} />
        )}
        {uv !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="ti ti-sun" style={{ fontSize: 14, color: '#a09d99' }} aria-hidden="true" />
              <span className="font-sans" style={{ fontSize: 11, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                UV-Index
              </span>
            </div>
            <span className="font-sans" style={{ fontSize: 18, fontWeight: 600, color: uvColor(uv) }}>
              {Math.round(uv)} <span style={{ fontSize: 12, fontWeight: 400 }}>{uvLabel(uv)}</span>
            </span>
          </div>
        )}
        {todayDaily && (
          <>
            <StatCell icon="ti-sunrise" label="Sonnenaufgang" value={formatHHMM(todayDaily.sunrise)} />
            <StatCell icon="ti-sunset" label="Sonnenuntergang" value={formatHHMM(todayDaily.sunset)} />
          </>
        )}
      </div>
    </div>
  );
}

function HourlyTimeline({ hourly }: { hourly: WeatherHourly[] }) {
  const [now] = useState(() => Date.now());

  const today = todayBerlin();
  const items = hourly
    .filter(h => new Date(h.time).getTime() >= now - 30 * 60 * 1000)
    .slice(0, 12);

  if (items.length === 0) return null;

  let lastDate = '';

  return (
    <div style={card}>
      <h2 className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
        Nächste 24 Stunden
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
        {items.map((h, i) => {
          const dateStr = h.time.slice(0, 10);
          const isNewDay = dateStr !== lastDate && dateStr !== today;
          const showDayLabel = isNewDay && dateStr !== lastDate;
          if (dateStr !== lastDate) lastDate = dateStr;

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              {showDayLabel && (
                <span className="font-sans" style={{ fontSize: 9, color: '#378ADD', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  {formatDayName(dateStr).slice(0, 2)}
                </span>
              )}
              {!showDayLabel && <span style={{ fontSize: 9, lineHeight: '1.3' }}>&nbsp;</span>}
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: showDayLabel ? 'rgba(55,138,221,0.08)' : 'var(--family-surface2)',
                  borderRadius: 12, padding: '8px 10px', minWidth: 56,
                  border: showDayLabel ? '0.5px solid rgba(55,138,221,0.25)' : 'none',
                }}
              >
                <span className="font-sans" style={{ fontSize: 10, color: '#a09d99' }}>
                  {h.time.slice(11, 16)}
                </span>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{getWeatherEmoji(h.weathercode)}</span>
                <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: '#1a1814' }}>
                  {Math.round(h.temperature)}°
                </span>
                {h.precipitationProbability > 0 ? (
                  <span className="font-sans" style={{ fontSize: 10, color: '#378ADD', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <i className="ti ti-droplet" style={{ fontSize: 9 }} aria-hidden="true" />
                    {Math.round(h.precipitationProbability)}%
                  </span>
                ) : (
                  <span style={{ fontSize: 10 }}>&nbsp;</span>
                )}
                {h.humidity !== undefined && (
                  <span className="font-sans" style={{ fontSize: 9, color: '#a09d99' }}>
                    {Math.round(h.humidity)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyRow({ day, isFirst }: { day: WeatherDaily; isFirst: boolean }) {
  const label = isFirst ? 'Heute' : formatDayName(day.date);
  const shortDate = formatShortDate(day.date);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 40px 1fr auto auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '0.5px solid rgba(0,0,0,0.05)',
      }}
    >
      <div>
        <div className="font-sans" style={{ fontSize: 14, fontWeight: isFirst ? 600 : 400, color: '#1a1814' }}>
          {label}
        </div>
        <div className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>{shortDate}</div>
      </div>

      <span style={{ fontSize: 26, textAlign: 'center' }}>{getWeatherEmoji(day.weathercode)}</span>

      <div className="font-sans" style={{ fontSize: 12, color: '#6b6760' }}>
        {getWeatherDesc(day.weathercode)}
      </div>

      {/* Temp range */}
      <div className="font-sans" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1814' }}>{Math.round(day.temperatureMax)}°</span>
        <span style={{ fontSize: 13, color: '#a09d99', marginLeft: 4 }}>{Math.round(day.temperatureMin)}°</span>
      </div>

      {/* Rain */}
      <div className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 48, justifyContent: 'flex-end' }}>
        <i className="ti ti-droplet" style={{ fontSize: 12, color: day.precipitationProbabilityMax > 40 ? '#378ADD' : '#c0bcb8' }} aria-hidden="true" />
        <span style={{ fontSize: 12, color: day.precipitationProbabilityMax > 40 ? '#378ADD' : '#a09d99' }}>
          {Math.round(day.precipitationProbabilityMax)}%
        </span>
      </div>

      {/* Wind */}
      <div className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 60, justifyContent: 'flex-end' }}>
        <i className="ti ti-wind" style={{ fontSize: 12, color: '#a09d99' }} aria-hidden="true" />
        <span style={{ fontSize: 12, color: '#6b6760' }}>{Math.round(day.windspeedMax)} km/h</span>
      </div>
    </div>
  );
}

function WeekForecast({ daily }: { daily: WeatherDaily[] }) {
  return (
    <div style={card}>
      <h2 className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        7-Tage-Vorschau
      </h2>
      {daily.map((day, i) => (
        <DailyRow key={day.date} day={day} isFirst={i === 0} />
      ))}
    </div>
  );
}

export default function WeatherPage() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/weather`).then(r => r.json());
      if (res?.data) {
        setData(res.data);
        setFetchedAt(res.fetched_at);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchWeather();
    const iv = setInterval(fetchWeather, 5 * 60_000);
    return () => clearInterval(iv);
  }, [fetchWeather]);

  const todayStr = todayBerlin();
  const todayDaily = data?.daily?.find(d => d.date === todayStr);

  const staleIndicator = fetchedAt && Date.now() - new Date(fetchedAt).getTime() > 60 * 60 * 1000;

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Wetter" variant="page" />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[180, 140, 320].map((h, i) => (
              <div key={i} className="animate-pulse" style={{ ...card, height: h, background: '#e8e4de' }} />
            ))}
          </div>
        ) : !data ? (
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p className="font-sans" style={{ color: '#a09d99' }}>Wetterdaten nicht verfügbar</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {staleIndicator && (
              <div className="font-sans" style={{ fontSize: 11, color: '#e0a020', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0a020', display: 'inline-block' }} />
                Daten veraltet – aktualisiere…
              </div>
            )}

            <TodayBlock data={data} todayDaily={todayDaily} />

            {data.hourly && data.hourly.length > 0 && (
              <HourlyTimeline hourly={data.hourly} />
            )}

            {data.daily && data.daily.length > 0 && (
              <WeekForecast daily={data.daily} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
