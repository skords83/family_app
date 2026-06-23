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

function formatTemp(t: number | null): string {
  return t !== null ? `${t.toFixed(1)}°` : '–';
}

function RoomCard({ entity }: { entity: HaClimateEntity }) {
  const isHeating = entity.hvac_mode === 'heat';
  const diff =
    entity.current_temperature !== null && entity.target_temperature !== null
      ? entity.target_temperature - entity.current_temperature
      : null;

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
          {entity.name}
        </span>
        <div className="flex items-center gap-1.5">
          <i
            className={isHeating ? 'ti ti-flame' : 'ti ti-leaf'}
            style={{ fontSize: 16, color: isHeating ? '#e85d3a' : '#5cb85c' }}
            aria-hidden="true"
          />
          <span className="font-sans" style={{ fontSize: 11, color: isHeating ? '#e85d3a' : '#5cb85c' }}>
            {isHeating ? 'Heizt' : 'Aus'}
          </span>
        </div>
      </div>

      {/* Temperaturen */}
      <div className="flex items-end justify-between">
        <div>
          <p className="font-sans" style={{ fontSize: 11, color: '#a09d99', marginBottom: 2 }}>
            Aktuell
          </p>
          <p style={{ fontSize: 36, fontWeight: 700, color: '#1a1814', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
            {formatTemp(entity.current_temperature)}
          </p>
        </div>

        <div className="flex items-center" style={{ gap: 6, paddingBottom: 6 }}>
          <i className="ti ti-arrow-right" style={{ fontSize: 14, color: '#c0bcb8' }} aria-hidden="true" />
        </div>

        <div style={{ textAlign: 'right' }}>
          <p className="font-sans" style={{ fontSize: 11, color: '#a09d99', marginBottom: 2 }}>
            Ziel
          </p>
          <p
            style={{
              fontSize: 36, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1,
              color: isHeating ? '#e85d3a' : '#a09d99',
            }}
          >
            {formatTemp(entity.target_temperature)}
          </p>
        </div>
      </div>

      {/* Differenz-Hinweis */}
      {diff !== null && Math.abs(diff) >= 0.5 && (
        <p className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>
          {diff > 0
            ? `Noch ${diff.toFixed(1)}° bis Zieltemperatur`
            : `${Math.abs(diff).toFixed(1)}° über Zieltemperatur`}
        </p>
      )}
    </div>
  );
}

export default function HeatingPage() {
  const [entities, setEntities] = useState<HaClimateEntity[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClimate = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/homeassistant/climate`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.entities)) {
        setEntities(data.entities);
        setFetchedAt(data.fetched_at);
        setError(null);
      }
    } catch (e) {
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

  const heatingCount = entities.filter(e => e.hvac_mode === 'heat').length;

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PageHeader variant="home" />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
        {/* Seitentitel */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20, paddingTop: 4 }}>
          <div className="flex items-center gap-3">
            <i className="ti ti-home-thermometer" style={{ fontSize: 22, color: '#1a1814' }} aria-hidden="true" />
            <h1 className="font-sans font-semibold" style={{ fontSize: 20, color: '#1a1814' }}>
              Heizung
            </h1>
            {!loading && entities.length > 0 && (
              <span className="font-sans" style={{ fontSize: 13, color: '#a09d99' }}>
                {heatingCount} von {entities.length} aktiv
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {fetchedAt && (
              <span className="font-sans" style={{ fontSize: 11, color: '#a09d99' }}>
                Aktualisiert {new Date(fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
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

        {/* Fehler */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-xl"
            style={{ padding: '12px 16px', background: '#fff5f3', border: '0.5px solid #f9c9be', marginBottom: 16 }}
          >
            <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#e85d3a' }} aria-hidden="true" />
            <span className="font-sans" style={{ fontSize: 13, color: '#e85d3a' }}>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div
            className="grid gap-4 animate-pulse"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl" style={{ height: 160, background: '#e8e4de' }} />
            ))}
          </div>
        )}

        {/* Karten */}
        {!loading && entities.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {entities.map(e => <RoomCard key={e.entity_id} entity={e} />)}
          </div>
        )}

        {!loading && entities.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80, gap: 12 }}>
            <i className="ti ti-home-thermometer" style={{ fontSize: 48, color: '#d8d4ce' }} aria-hidden="true" />
            <p className="font-sans" style={{ fontSize: 14, color: '#a09d99' }}>
              Keine Thermostate gefunden
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
