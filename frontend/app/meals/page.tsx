'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface MealDay {
  date: string;
  lunch: string;
  dinner: string;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === tomorrowStr) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function MealsPage() {
  const [days, setDays] = useState<MealDay[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/widgets/meals`)
      .then(r => r.json())
      .then(data => {
        if (data?.data?.days) {
          setDays(data.data.days);
          setFetchedAt(data.fetched_at);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const upcoming = days.filter(d => d.date >= today).slice(0, 7);

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>
            Essensplan
          </h1>
          <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>
            {fetchedAt
              ? `Aktualisiert: ${new Date(fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Norish-Synchronisation'}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); setError(false); window.location.reload(); }}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/5"
          style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760' }}
          title="Aktualisieren"
        >
          <i className="ti ti-refresh" style={{ fontSize: 17 }} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#e8e4de' }} />
          ))}
        </div>
      )}

      {/* Error / no data */}
      {!loading && (error || upcoming.length === 0) && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
        >
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-sm font-sans font-medium mb-1" style={{ color: '#1a1814' }}>
            Kein Essensplan verfügbar
          </p>
          <p className="text-xs font-sans" style={{ color: '#a09d99' }}>
            Norish ist noch nicht verbunden oder liefert keine Daten.
          </p>
          <div
            className="mt-4 rounded-xl px-4 py-3 flex items-center gap-2 text-left"
            style={{ background: '#fff5f3', border: '0.5px solid #e85d3a30' }}
          >
            <i className="ti ti-plug" style={{ fontSize: 15, color: '#e85d3a', flexShrink: 0 }} />
            <span className="text-xs font-sans" style={{ color: '#e85d3a' }}>
              Trage die Norish-API-URL in den Einstellungen ein um den Essensplan zu synchronisieren.
            </span>
          </div>
        </div>
      )}

      {/* Meal days */}
      {!loading && !error && upcoming.length > 0 && (
        <div className="space-y-3">
          {upcoming.map(day => {
            const tod = isToday(day.date);
            return (
              <div
                key={day.date}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: '#fff',
                  border: tod ? '1.5px solid #e85d3a' : '0.5px solid rgba(0,0,0,0.07)',
                }}
              >
                {/* Day header */}
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{
                    background: tod ? '#fff5f3' : '#fafaf9',
                    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
                  }}
                >
                  <span
                    className="text-sm font-sans font-semibold"
                    style={{ color: tod ? '#e85d3a' : '#1a1814' }}
                  >
                    {formatDateLabel(day.date)}
                  </span>
                  <span className="text-xs font-sans" style={{ color: '#a09d99' }}>
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {/* Meals */}
                <div className="px-5 py-3 space-y-2">
                  {day.lunch ? (
                    <div className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: '#fff5f3' }}
                      >
                        🍽️
                      </div>
                      <div>
                        <div className="text-[10px] font-sans font-semibold uppercase tracking-wide" style={{ color: '#a09d99' }}>Mittag</div>
                        <div className="text-sm font-sans" style={{ color: '#1a1814' }}>{day.lunch}</div>
                      </div>
                    </div>
                  ) : null}

                  {day.dinner ? (
                    <div className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: '#f0f7ff' }}
                      >
                        🌙
                      </div>
                      <div>
                        <div className="text-[10px] font-sans font-semibold uppercase tracking-wide" style={{ color: '#a09d99' }}>Abend</div>
                        <div className="text-sm font-sans" style={{ color: '#1a1814' }}>{day.dinner}</div>
                      </div>
                    </div>
                  ) : null}

                  {!day.lunch && !day.dinner && (
                    <p className="text-sm font-sans py-1" style={{ color: '#a09d99' }}>Keine Einträge</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
