'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

type Slot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface PlannedRecipe {
  id: string;
  date: string;
  slot: Slot;
  recipeName: string | null;
  recipeImage: string | null;
  imageUrl: string | null;
  servings: number | null;
  calories: number | null;
  tags?: string[];
}

const SLOT_LABELS: Record<Slot, string> = {
  Breakfast: 'Früh',
  Lunch: 'Mittag',
  Dinner: 'Abend',
  Snack: 'Snack',
};
const SLOT_ICONS: Record<Slot, string> = {
  Breakfast: '🌅', Lunch: '🍽️', Dinner: '🌙', Snack: '🍎',
};
const SLOT_BG: Record<Slot, string> = {
  Breakfast: '#fef9e3', Lunch: '#fff5f3', Dinner: '#f0f7ff', Snack: '#f2fbf2',
};
const SLOT_ORDER: Slot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayStr() { return toLocalDateStr(new Date()); }
function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}
function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
}
function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

// Passende Hintergrundfarbe je nach Gericht (einfaches Hashing)
const SWATCH_COLORS = ['#f0ede0','#f5ede0','#edeee0','#f5f0e0','#f0e8e8','#e8f0e8','#e8eef0'];
function swatchColor(name: string | null, idx: number): string {
  if (!name) return SWATCH_COLORS[idx % SWATCH_COLORS.length];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return SWATCH_COLORS[Math.abs(h) % SWATCH_COLORS.length];
}

export default function MealsPage() {
  const [byDate, setByDate] = useState<Record<string, Partial<Record<Slot, PlannedRecipe[]>>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/widgets/meals?range=month`)
      .then(r => r.json())
      .then(data => {
        if (data?.byDate) { setByDate(data.byDate); }
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const today = getTodayStr();
  const sortedDates = Object.keys(byDate).filter(d => d >= today).sort().slice(0, 7);
  const todayDate = sortedDates[0] === today ? today : null;
  const restDates = sortedDates.filter(d => d !== today);

  return (
    <div>
      <PageHeader title="Essensplan" variant="page" />

      <div className="px-6 pb-6" style={{ maxWidth: 900 }}>

        {/* Refresh */}
        <div className="flex justify-end mb-4">
          <button onClick={load}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/5"
            style={{ border: '0.5px solid rgba(0,0,0,0.1)', color: '#6b6760' }} title="Aktualisieren">
            <i className="ti ti-refresh" style={{ fontSize: 17 }} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl animate-pulse" style={{ background: '#e8e4de', height: 220 }} />
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[0,1,2,3].map(i => <div key={i} className="rounded-2xl animate-pulse" style={{ background: '#e8e4de', height: 110 }} />)}
            </div>
          </div>
        )}

        {/* Error / leer */}
        {!loading && (error || sortedDates.length === 0) && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
            <i className="ti ti-bowl" style={{ fontSize: 32, color: '#d8d4cf', display: 'block', marginBottom: 12 }} />
            <p className="text-sm font-sans font-medium mb-1" style={{ color: '#1a1814' }}>Kein Essensplan verfügbar</p>
            <p className="text-xs font-sans mb-4" style={{ color: '#a09d99' }}>Norish liefert noch keine Daten für diese Woche.</p>
            <div className="rounded-xl px-4 py-3 flex items-start gap-2 text-left" style={{ background: '#fff5f3', border: '0.5px solid #e85d3a30' }}>
              <i className="ti ti-plug" style={{ fontSize: 15, color: '#e85d3a', flexShrink: 0, marginTop: 1 }} />
              <span className="text-xs font-sans" style={{ color: '#e85d3a' }}>
                Stelle sicher dass <strong>NORISH_URL</strong> in den Umgebungsvariablen gesetzt ist.
              </span>
            </div>
          </div>
        )}

        {!loading && !error && sortedDates.length > 0 && (
          <div className="flex flex-col gap-3">

            {/* ── Heute Banner ── */}
            {todayDate && (() => {
              const daySlots = byDate[todayDate] ?? {};
              const dinner = daySlots['Dinner']?.[0];
              const recipe = dinner ?? Object.values(daySlots).flat()[0];
              if (!recipe) return null;
              const tags: string[] = (recipe as any).tags ?? [];
              const slotLabel = dinner ? 'HEUTE ABEND' : 'HEUTE';
              const dateLabel = new Date(todayDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

              return (
                <TodayBanner
                  key={todayDate}
                  recipe={recipe}
                  tags={tags}
                  slotLabel={slotLabel}
                  dateLabel={dateLabel}
                  swatchFallback={swatchColor(recipe.recipeName, 0)}
                />
              );
            })()}

            {/* ── Rest: 2-Spalten-Grid ── */}
            {restDates.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {restDates.map((date, idx) => {
                  const daySlots = byDate[date] ?? {};
                  const weekend = isWeekend(date);

                  if (weekend) {
                    // Wochenende: alle Slots als Zeilen
                    const presentSlots = SLOT_ORDER.filter(s => daySlots[s]?.length);
                    return (
                      <div key={date} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                        <div className="px-3 py-2.5" style={{ background: '#fafaf9', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                          <div className="font-sans font-semibold" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a7874' }}>{shortDay(date)}</div>
                          <div style={{ fontSize: 15, fontWeight: 400, fontFamily: 'Georgia, serif', color: '#1a1814' }}>{shortDate(date)}</div>
                        </div>
                        <div className="px-3 py-2.5 flex flex-col gap-2">
                          {presentSlots.map(slot => {
                            const r = daySlots[slot]![0];
                            return (
                              <div key={slot} className="flex items-center gap-2">
                                <div className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 22, height: 22, background: SLOT_BG[slot], fontSize: 12 }}>
                                  {SLOT_ICONS[slot]}
                                </div>
                                <div className="font-sans flex-shrink-0" style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#a09d99', width: 36 }}>
                                  {SLOT_LABELS[slot]}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="font-sans" style={{ fontSize: 11, color: '#1a1814', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.recipeName ?? '–'}
                                  </div>
                                  {(r.calories || r.servings) && (
                                    <div className="font-sans" style={{ fontSize: 10, color: '#a09d99' }}>
                                      {[r.calories ? `${r.calories} kcal` : null, r.servings ? `${r.servings} Port.` : null].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {presentSlots.length === 0 && (
                            <p className="font-sans text-center py-1" style={{ fontSize: 11, color: '#c8c4c0' }}>Keine Einträge</p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Wochentag: nur Abendessen, mit Swatch oben
                  const dinner = daySlots['Dinner']?.[0];
                  const recipe = dinner ?? Object.values(daySlots).flat()[0];
                  const slot: Slot = dinner ? 'Dinner' : (Object.keys(daySlots).find(s => daySlots[s as Slot]?.length) as Slot | undefined) ?? 'Dinner';

                  return (
                    <div key={date} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                      {/* Farbfläche */}
                      <div className="flex items-center justify-center" style={{ height: 52, background: recipe ? swatchColor(recipe.recipeName, idx) : '#f0ede8', fontSize: 24 }}>
                        {recipe ? SLOT_ICONS[slot] : ''}
                      </div>
                      {/* Inhalt */}
                      <div className="px-3 pb-3 pt-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-sans font-semibold" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a7874' }}>{shortDay(date)}</span>
                          <span style={{ fontSize: 9, color: '#c8c4c0' }}>·</span>
                          <span className="font-sans" style={{ fontSize: 9, color: '#a09d99' }}>{shortDate(date)}</span>
                        </div>
                        {recipe ? (
                          <>
                            <div className="font-sans line-clamp-2" style={{ fontSize: 13, fontWeight: 500, color: '#1a1814', lineHeight: 1.35 }}>
                              {recipe.recipeName ?? 'Kein Rezeptname'}
                            </div>
                            {(recipe.calories || recipe.servings) && (
                              <div className="font-sans mt-1 flex items-center gap-2" style={{ fontSize: 10, color: '#a09d99' }}>
                                {recipe.calories && <span><i className="ti ti-flame" style={{ fontSize: 10 }} /> {recipe.calories} kcal</span>}
                                {recipe.servings && <span><i className="ti ti-users" style={{ fontSize: 10 }} /> {recipe.servings} Port.</span>}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="font-sans" style={{ fontSize: 11, color: '#c8c4c0' }}>Kein Eintrag</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Heute-Banner als eigene Komponente mit Bild-Fallback ──────────────────────
function TodayBanner({
  recipe,
  tags,
  slotLabel,
  dateLabel,
  swatchFallback,
}: {
  recipe: PlannedRecipe;
  tags: string[];
  slotLabel: string;
  dateLabel: string;
  swatchFallback: string;
}) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!recipe.imageUrl && !imgError;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #e85d3a' }}>
      {/* Bild oder farbige Fläche */}
      <div className="relative" style={{ height: 200 }}>
        {showImage ? (
          <img
            src={recipe.imageUrl!}
            alt={recipe.recipeName ?? ''}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: swatchFallback, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
            🌙
          </div>
        )}
        {/* Overlay-Text unten */}
        <div style={{
          position: 'absolute', inset: 0,
          background: showImage ? 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)' : 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px 20px',
        }}>
          <div className="font-sans font-semibold" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: showImage ? 'rgba(255,255,255,0.75)' : '#a09d99', marginBottom: 4 }}>
            {slotLabel} · {dateLabel}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: showImage ? '#fff' : '#1a1814', lineHeight: 1.2 }}>
            {recipe.recipeName ?? 'Kein Rezeptname'}
          </div>
        </div>
      </div>
      {/* Meta-Zeile */}
      <div className="flex items-center flex-wrap gap-2 px-4 py-3">
        {tags.slice(0, 3).map((t, i) => (
          <span key={i} className="font-sans font-semibold" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#f0ede8', color: '#5f5e5a', border: '0.5px solid #d3d1c7' }}>
            {t.toUpperCase()}
          </span>
        ))}
        {tags.length > 0 && (recipe.calories || recipe.servings) && (
          <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
        )}
        {recipe.calories && (
          <span className="font-sans flex items-center gap-1" style={{ fontSize: 11, color: '#a09d99' }}>
            <i className="ti ti-flame" style={{ fontSize: 12 }} aria-hidden="true" /> {recipe.calories} kcal
          </span>
        )}
        {recipe.servings && (
          <span className="font-sans flex items-center gap-1" style={{ fontSize: 11, color: '#a09d99' }}>
            <i className="ti ti-users" style={{ fontSize: 12 }} aria-hidden="true" /> {recipe.servings} Port.
          </span>
        )}
      </div>
    </div>
  );
}