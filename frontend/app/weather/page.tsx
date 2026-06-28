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

function getWeatherBg(code: number): string {
  if (code === 0) return 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 100%)';
  if (code <= 3) return 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)';
  if (code <= 48) return 'linear-gradient(160deg, #f3f4f6 0%, #e9eaec 100%)';
  if (code <= 67) return 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)';
  if (code <= 77) return 'linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 100%)';
  if (code <= 82) return 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)';
  if (code <= 99) return 'linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%)';
  return 'linear-gradient(160deg, #f7f5f2 0%, #f0ece8 100%)';
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

function tempBarColor(max: number): string {
  if (max <= 5) return '#93c5fd';
  if (max <= 15) return '#60a5fa';
  if (max <= 22) return '#34d399';
  if (max <= 28) return '#f59e0b';
  return '#f97316';
}

const card: CSSProperties = {
  background: '#fff',
  border: '0.5px solid rgba(0,0,0,0.07)',
  borderRadius: 16,
  padding: 20,
};

function StatCell({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 13, color: '#a09d99' }} aria-hidden="true" />
        <span className="font-sans" style={{ fontSize: 10, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <span className="font-sans" style={{ fontSize: 17, fontWeight: 600, color: valueColor ?? '#1a1814' }}>
        {value}
      </span>
    </div>
  );
}

function TodayBlock({ data, todayDaily }: { data: WeatherData; todayDaily?: WeatherDaily }) {
  const uv = data.uvIndex ?? todayDaily?.uvIndexMax;
  const bg = getWeatherBg(data.weathercode);

  return (
    <div style={{ ...card, position: 'relative', overflow: 'hidden', flexShrink: 0, padding: '28px 36px' }}>
      {/* Dekoratives Emoji im Hintergrund */}
      <span style={{
        position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
        fontSize: 112, lineHeight: 1, opacity: 0.06, pointerEvents: 'none', userSelect: 'none',
      }}>
        {getWeatherEmoji(data.weathercode)}
      </span>

      {/* Temperatur + Beschreibung */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 60, fontWeight: 700, color: '#1a1814', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
          {Math.round(data.temperature)}°
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <span className="font-sans" style={{ fontSize: 18, color: '#6b6760' }}>
          {getWeatherDesc(data.weathercode)}
        </span>
        {todayDaily && (
          <span className="font-sans" style={{ fontSize: 14, color: '#a09d99' }}>
            {Math.round(todayDaily.temperatureMax)}° / {Math.round(todayDaily.temperatureMin)}° heute
          </span>
        )}
      </div>

      {/* Stats – 2 Zeilen à 3 Werte */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 0',
        paddingTop: 18, borderTop: '0.5px solid rgba(0,0,0,0.09)',
      }}>
        <StatCell icon="ti-temperature" label="Gefühlt" value={`${Math.round(data.apparentTemperature)}°`} />
        <StatCell icon="ti-droplet" label="Regen" value={`${Math.round(data.precipitationProbability)}%`} />
        <StatCell icon="ti-wind" label="Wind" value={`${Math.round(data.windspeed)} km/h`} />
        {data.pressure !== undefined && (
          <StatCell icon="ti-gauge" label="Luftdruck" value={`${Math.round(data.pressure)} hPa`} />
        )}
        {uv !== undefined && (
          <StatCell icon="ti-sun" label="UV-Index" value={`${Math.round(uv)} ${uvLabel(uv)}`} valueColor={uvColor(uv)} />
        )}
        {todayDaily && (
          <StatCell icon="ti-sunrise" label="Sonne" value={`${formatHHMM(todayDaily.sunrise)} – ${formatHHMM(todayDaily.sunset)}`} />
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
    <div style={{ ...card, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h2 className="font-sans" style={{ fontSize: 10, fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, flexShrink: 0 }}>
        Nächste 12 Stunden
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 5 }}>
        {items.map((h, i) => {
          const dateStr = h.time.slice(0, 10);
          const isNewDay = dateStr !== today && dateStr !== lastDate;
          if (dateStr !== lastDate) lastDate = dateStr;

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {isNewDay
                ? <span className="font-sans" style={{ fontSize: 9, color: '#378ADD', fontWeight: 700, flexShrink: 0 }}>{formatDayName(dateStr).slice(0, 2)}</span>
                : <span style={{ fontSize: 9, flexShrink: 0 }}>&nbsp;</span>
              }
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: isNewDay ? 'rgba(55,138,221,0.07)' : 'var(--family-surface2)',
                border: isNewDay ? '0.5px solid rgba(55,138,221,0.2)' : 'none',
                borderRadius: 10, padding: '8px 4px', width: '100%',
              }}>
                <span className="font-sans" style={{ fontSize: 10, color: '#a09d99' }}>{h.time.slice(11, 16)}</span>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{getWeatherEmoji(h.weathercode)}</span>
                <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: '#1a1814' }}>{Math.round(h.temperature)}°</span>
                {h.precipitationProbability > 0
                  ? <span className="font-sans" style={{ fontSize: 10, color: '#378ADD' }}>
                      <i className="ti ti-droplet" style={{ fontSize: 8 }} aria-hidden="true" /> {Math.round(h.precipitationProbability)}%
                    </span>
                  : <span style={{ fontSize: 10 }}>&nbsp;</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TempBar({ min, max, globalMin, globalMax }: { min: number; max: number; globalMin: number; globalMax: number }) {
  const range = globalMax - globalMin || 1;
  const leftPct = ((min - globalMin) / range) * 100;
  const widthPct = Math.max(((max - min) / range) * 100, 8);
  const color = tempBarColor(max);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
      <div style={{ width: '100%', height: 7, background: 'rgba(0,0,0,0.07)', borderRadius: 4, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          height: '100%',
          background: `linear-gradient(90deg, #93c5fd, ${color})`,
          borderRadius: 4,
        }} />
      </div>
    </div>
  );
}

function WeekForecast({ daily }: { daily: WeatherDaily[] }) {
  const globalMin = Math.min(...daily.map(d => d.temperatureMin));
  const globalMax = Math.max(...daily.map(d => d.temperatureMax));
  const today = todayBerlin();

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <h2 className="font-sans" style={{ fontSize: 10, fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, flexShrink: 0 }}>
        7-Tage-Vorschau
      </h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {daily.map((day) => {
          const isToday = day.date === today;
          const rainHigh = day.precipitationProbabilityMax > 40;
          return (
            <div
              key={day.date}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 26px 85px 1fr 50px 38px',
                alignItems: 'center',
                gap: 6,
                padding: '8px 0',
                borderRadius: isToday ? 8 : 0,
                background: isToday ? 'rgba(0,0,0,0.04)' : 'transparent',
              }}
            >
              <div>
                <div className="font-sans" style={{ fontSize: isToday ? 14 : 13, fontWeight: isToday ? 700 : 400, color: '#1a1814' }}>
                  {isToday ? 'Heute' : formatDayName(day.date).slice(0, 2)}
                </div>
                <div className="font-sans" style={{ fontSize: 10, color: '#a09d99' }}>{formatShortDate(day.date)}</div>
              </div>

              <span style={{ fontSize: 26, textAlign: 'center', lineHeight: 1 }}>{getWeatherEmoji(day.weathercode)}</span>

              <div className="font-sans" style={{ fontSize: 12, color: '#6b6760', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getWeatherDesc(day.weathercode)}
              </div>

              <TempBar min={day.temperatureMin} max={day.temperatureMax} globalMin={globalMin} globalMax={globalMax} />

              <div className="font-sans" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1814' }}>{Math.round(day.temperatureMax)}°</span>
                <span style={{ fontSize: 12, color: '#a09d99', marginLeft: 3 }}>{Math.round(day.temperatureMin)}°</span>
              </div>

              <div className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                <i className="ti ti-droplet" style={{ fontSize: 11, color: rainHigh ? '#378ADD' : '#c0bcb8' }} aria-hidden="true" />
                <span style={{ fontSize: 12, fontWeight: rainHigh ? 600 : 400, color: rainHigh ? '#378ADD' : '#a09d99' }}>
                  {Math.round(day.precipitationProbabilityMax)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
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

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 12,
        padding: '0 24px 24px',
        overflow: 'hidden',
      }}>
        {loading ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="animate-pulse" style={{ ...card, height: 180, background: '#e8e4de' }} />
              <div className="animate-pulse" style={{ ...card, flex: 1, background: '#e8e4de' }} />
            </div>
            <div className="animate-pulse" style={{ ...card, background: '#e8e4de' }} />
          </>
        ) : !data ? (
          <div style={{ gridColumn: '1 / -1', ...card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="font-sans" style={{ color: '#a09d99' }}>Wetterdaten nicht verfügbar</p>
          </div>
        ) : (
          <>
            {/* Links: Heute + Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
              {staleIndicator && (
                <div className="font-sans" style={{ fontSize: 11, color: '#e0a020', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0a020', display: 'inline-block' }} />
                  Daten veraltet
                </div>
              )}
              <TodayBlock data={data} todayDaily={todayDaily} />
              {data.hourly && data.hourly.length > 0 && (
                <HourlyTimeline hourly={data.hourly} />
              )}
            </div>

            {/* Rechts: 7-Tage */}
            {data.daily && data.daily.length > 0 && (
              <WeekForecast daily={data.daily} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
