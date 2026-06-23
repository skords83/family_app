'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface HaClimateEntity {
  entity_id: string;
  name: string;
  current_temperature: number | null;
  target_temperature: number | null;
  hvac_mode: string;
}

interface HaSensorEntity {
  entity_id: string;
  name: string;
  value: number | null;
  unit: string;
  device_class: 'temperature' | 'humidity';
}

interface RoomData {
  key: string;
  label: string;
  climate?: HaClimateEntity;
  temperature?: HaSensorEntity;
  humidity?: HaSensorEntity;
}

/** Extract a lowercase room key from an entity_id, e.g. "sensor.buero_temp" → "buero" */
function roomKey(entityId: string): string {
  const withoutDomain = entityId.replace(/^[^.]+\./, '');
  // strip common suffixes
  return withoutDomain
    .replace(/_(temperatur|temperature|temp|luftfeuchtigkeit|humidity|hum|heizung|thermostat)(_.*)?$/, '')
    .toLowerCase();
}

function buildRooms(
  entities: HaClimateEntity[],
  sensors: HaSensorEntity[],
): RoomData[] {
  const map = new Map<string, RoomData>();

  for (const e of entities) {
    const key = roomKey(e.entity_id);
    map.set(key, { key, label: e.name, climate: e });
  }

  for (const s of sensors) {
    const key = roomKey(s.entity_id);
    if (!map.has(key)) {
      // derive label: strip device_class suffix from friendly name
      const label = s.name
        .replace(/\s+(Temperatur|Temperature|Luftfeuchtigkeit|Humidity)$/i, '')
        .trim();
      map.set(key, { key, label });
    }
    const room = map.get(key)!;
    if (s.device_class === 'temperature') room.temperature = s;
    else room.humidity = s;
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

function formatTemp(t: number | null): string {
  return t !== null ? `${t.toFixed(1)}°` : '–';
}

function RoomCard({ room }: { room: RoomData }) {
  const isHeating = room.climate?.hvac_mode === 'heat';
  const hasClimate = !!room.climate;

  // Current temp: prefer external sensor, fall back to thermostat
  const currentTemp = room.temperature?.value ?? room.climate?.current_temperature ?? null;
  const targetTemp = room.climate?.target_temperature ?? null;
  const humidity = room.humidity?.value ?? null;

  const diff =
    currentTemp !== null && targetTemp !== null ? targetTemp - currentTemp : null;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: isHeating ? '#fff5f3' : 'var(--family-surface)',
        border: `0.5px solid ${isHeating ? '#f9c9be' : 'var(--family-border)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-sans font-medium" style={{ fontSize: 15, color: '#1a1814' }}>
          {room.label}
        </span>
        {hasClimate ? (
          <div className="flex items-center gap-1.5">
            <i
              className={isHeating ? 'ti ti-flame' : 'ti ti-leaf'}
              style={{ fontSize: 15, color: isHeating ? '#e85d3a' : '#5cb85c' }}
              aria-hidden="true"
            />
            <span className="font-sans" style={{ fontSize: 11, color: isHeating ? '#e85d3a' : '#5cb85c' }}>
              {isHeating ? 'Heizt' : 'Aus'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <i className="ti ti-wave-sine" style={{ fontSize: 13, color: '#a09d99' }} aria-hidden="true" />
            <span className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>Sensor</span>
          </div>
        )}
      </div>

      {/* Temperaturen */}
      <div className="flex items-end justify-between">
        <div>
          <p className="font-sans" style={{ fontSize: 11, color: '#a09d99', marginBottom: 2 }}>
            {room.temperature ? 'Sensor' : 'Aktuell'}
          </p>
          <p style={{
            fontSize: 36, fontWeight: 700, color: '#1a1814',
            fontFamily: 'Georgia, serif', lineHeight: 1,
          }}>
            {formatTemp(currentTemp)}
          </p>
        </div>

        {targetTemp !== null && (
          <>
            <i className="ti ti-arrow-right" style={{ fontSize: 14, color: '#c0bcb8', paddingBottom: 6 }} aria-hidden="true" />
            <div style={{ textAlign: 'right' }}>
              <p className="font-sans" style={{ fontSize: 11, color: '#a09d99', marginBottom: 2 }}>Ziel</p>
              <p style={{
                fontSize: 36, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1,
                color: isHeating ? '#e85d3a' : '#a09d99',
              }}>
                {formatTemp(targetTemp)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Luftfeuchtigkeit + Differenz-Hinweis */}
      <div className="flex items-center justify-between" style={{ minHeight: 16 }}>
        {humidity !== null ? (
          <span className="flex items-center gap-1 font-sans" style={{ fontSize: 12, color: '#6b6760' }}>
            <i className="ti ti-droplet" style={{ fontSize: 12, color: '#378ADD' }} aria-hidden="true" />
            {humidity.toFixed(0)} %
          </span>
        ) : <span />}

        {diff !== null && Math.abs(diff) >= 0.5 && (
          <span className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>
            {diff > 0
              ? `noch ${diff.toFixed(1)}° bis Ziel`
              : `${Math.abs(diff).toFixed(1)}° über Ziel`}
          </span>
        )}
      </div>
    </div>
  );
}

export default function HeatingPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClimate = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/homeassistant/climate`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.entities)) {
        setRooms(buildRooms(data.entities, data.sensors ?? []));
        setFetchedAt(data.fetched_at);
        setError(null);
      }
    } catch {
      setError('Home Assistant nicht erreichbar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClimate();
    const iv = setInterval(fetchClimate, 2 * 60_000);
    return () => clearInterval(iv);
  }, [fetchClimate]);

  const heatingCount = rooms.filter(r => r.climate?.hvac_mode === 'heat').length;
  const heatingRooms = rooms.filter(r => r.climate?.hvac_mode === 'heat').length;

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader variant="home" />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
        {/* Seitentitel */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20, paddingTop: 4 }}>
          <div className="flex items-center gap-3">
            <i className="ti ti-thermometer" style={{ fontSize: 22, color: '#1a1814' }} aria-hidden="true" />
            <h1 className="font-sans font-semibold" style={{ fontSize: 20, color: '#1a1814' }}>
              Heizung & Klima
            </h1>
            {!loading && rooms.length > 0 && (
              <span className="font-sans" style={{ fontSize: 13, color: '#a09d99' }}>
                {heatingRooms > 0 ? `${heatingCount} Raum${heatingCount !== 1 ? 'räume' : ''} heizt` : 'Keine Heizung aktiv'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {fetchedAt && (
              <span className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>
                {new Date(fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </span>
            )}
            <button
              onClick={fetchClimate}
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'var(--family-surface)', border: '0.5px solid var(--family-border)' }}
              aria-label="Aktualisieren"
            >
              <i className="ti ti-refresh" style={{ fontSize: 16, color: '#6b6760' }} aria-hidden="true" />
            </button>
          </div>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl"
            style={{ padding: '12px 16px', background: '#fff5f3', border: '0.5px solid #f9c9be', marginBottom: 16 }}
          >
            <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#e85d3a' }} aria-hidden="true" />
            <span className="font-sans" style={{ fontSize: 13, color: '#e85d3a' }}>{error}</span>
          </div>
        )}

        {loading && (
          <div className="grid gap-4 animate-pulse" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl" style={{ height: 160, background: '#e8e4de' }} />
            ))}
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {rooms.map(r => <RoomCard key={r.key} room={r} />)}
          </div>
        )}

        {!loading && rooms.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80, gap: 12 }}>
            <i className="ti ti-thermometer" style={{ fontSize: 48, color: '#d8d4ce' }} aria-hidden="true" />
            <p className="font-sans" style={{ fontSize: 14, color: '#a09d99' }}>Keine Geräte gefunden</p>
          </div>
        )}
      </div>
    </div>
  );
}
