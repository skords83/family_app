'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

type Slot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface PlannedRecipe {
  id: string;
  date: string;
  slot: Slot;
  recipeName: string | null;
  recipeImage: string | null;
  imageUrl: string | null;      // aufgelöste absolute URL vom Backend
  servings: number | null;
  calories: number | null;
}

const SLOT_LABELS: Record<Slot, string> = {
  Breakfast: 'Frühstück',
  Lunch: 'Mittag',
  Dinner: 'Abend',
  Snack: 'Snack',
};

const SLOT_ICONS: Record<Slot, string> = {
  Breakfast: '🌅',
  Lunch: '🍽️',
  Dinner: '🌙',
  Snack: '🍎',
};

const SLOT_BG: Record<Slot, string> = {
  Breakfast: '#fef9e3',
  Lunch: '#fff5f3',
  Dinner: '#f0f7ff',
  Snack: '#f2fbf2',
};

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

const SLOT_ORDER: Slot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function MealsPage() {
  const [byDate, setByDate] = useState<Record<string, Partial<Record<Slot, PlannedRecipe[]>>>>({});
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/widgets/meals?range=week`)
      .then(r => r.json())
      .then(data => {
        if (data?.byDate) {
          setByDate(data.byDate);
          setFetchedAt(data.fetched_at);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().split('T')[0];
  const sortedDates = Object.keys(byDate)
    .filter(d => d >= today)
    .sort()
    .slice(0, 7);

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
          onClick={load}
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
      {!loading && (error || sortedDates.length === 0) && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-sm font-sans font-medium mb-1" style={{ color: '#1a1814' }}>
            Kein Essensplan verfügbar
          </p>
          <p className="text-xs font-sans mb-4" style={{ color: '#a09d99' }}>
            Norish liefert noch keine Daten für diese Woche.
          </p>
          <div className="rounded-xl px-4 py-3 flex items-start gap-2 text-left" style={{ background: '#fff5f3', border: '0.5px solid #e85d3a30' }}>
            <i className="ti ti-plug" style={{ fontSize: 15, color: '#e85d3a', flexShrink: 0, marginTop: 1 }} />
            <span className="text-xs font-sans" style={{ color: '#e85d3a' }}>
              Stelle sicher dass <strong>NORISH_URL</strong> und <strong>NORISH_API_KEY</strong> in den Umgebungsvariablen gesetzt sind.
            </span>
          </div>
        </div>
      )}

      {/* Meal days */}
      {!loading && !error && sortedDates.length > 0 && (
        <div className="space-y-3">
          {sortedDates.map(date => {
            const tod = isToday(date);
            const daySlots = byDate[date] ?? {};
            const presentSlots = SLOT_ORDER.filter(s => daySlots[s]?.length);

            return (
              <div
                key={date}
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
                  <span className="text-sm font-sans font-semibold" style={{ color: tod ? '#e85d3a' : '#1a1814' }}>
                    {formatDateLabel(date)}
                  </span>
                  <span className="text-xs font-sans" style={{ color: '#a09d99' }}>
                    {new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {/* Slots */}
                <div className="px-5 py-3 space-y-2.5">
                  {presentSlots.length === 0 && (
                    <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Keine Einträge</p>
                  )}
                  {presentSlots.map(slot => {
                    const recipes = daySlots[slot]!;
                    return (
                      <div key={slot} className="flex items-start gap-3">
                        {/* Slot-Icon */}
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                          style={{ background: SLOT_BG[slot] }}
                        >
                          {SLOT_ICONS[slot]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-sans font-semibold uppercase tracking-wide mb-1" style={{ color: '#a09d99' }}>
                            {SLOT_LABELS[slot]}
                          </div>

                          {recipes.map(r => (
                            <div key={r.id} className="flex items-center gap-3">
                              {/* Rezeptbild */}
                              {r.imageUrl ? (
                                <img
                                  src={r.imageUrl}
                                  alt={r.recipeName ?? ''}
                                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                  style={{ border: '0.5px solid rgba(0,0,0,0.07)' }}
                                  onError={e => {
                                    // Bild nicht erreichbar → Element ausblenden
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                // Platzhalter wenn kein Bild vorhanden
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                                  style={{ background: SLOT_BG[slot], border: '0.5px solid rgba(0,0,0,0.05)' }}
                                >
                                  {SLOT_ICONS[slot]}
                                </div>
                              )}

                              {/* Name + Meta */}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-sans" style={{ color: '#1a1814' }}>
                                  {r.recipeName ?? 'Unbekanntes Rezept'}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {r.calories && (
                                    <span className="text-xs font-sans" style={{ color: '#a09d99' }}>
                                      {r.calories} kcal
                                    </span>
                                  )}
                                  {r.servings && (
                                    <span className="text-xs font-sans" style={{ color: '#a09d99' }}>
                                      · {r.servings} Port.
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}