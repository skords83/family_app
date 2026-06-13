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
  Lunch:     'Mittag',
  Dinner:    'Abend',
  Snack:     'Snack',
};

const SLOT_PILL_STYLE: Record<Slot, { background: string; color: string }> = {
  Breakfast: { background: '#fef9e3', color: '#8a6500' },
  Lunch:     { background: '#fef4e0', color: '#9a6200' },
  Dinner:    { background: '#eef2fb', color: '#2d5a9e' },
  Snack:     { background: '#eef7ee', color: '#2e7a2e' },
};

const SLOT_ORDER: Slot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayStr() { return toLocalDateStr(new Date()); }

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
}
function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}
function longDayDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

// ── Heute-Block ───────────────────────────────────────────────────────────────
function TodayCard({
  daySlots,
  dateStr,
}: {
  daySlots: Partial<Record<Slot, PlannedRecipe[]>>;
  dateStr: string;
}) {
  const [imgError, setImgError] = useState(false);

  const dinner  = daySlots['Dinner']?.[0] ?? null;
  const hero    = dinner ?? Object.values(daySlots).flat()[0] ?? null;
  const showImg = !!hero?.imageUrl && !imgError;

  const presentSlots = SLOT_ORDER.filter(s => daySlots[s]?.length);

  return (
    <div style={{
      gridColumn: '1',
      gridRow: '1 / 3',
      borderRadius: 16,
      border: '1.5px solid #e85d3a',
      background: 'var(--color-background-primary)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Bild / Fallback */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        background: '#2e2520',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {showImg ? (
          <img
            src={hero!.imageUrl!}
            alt={hero!.recipeName ?? ''}
            onError={() => setImgError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 52 }}>🍽️</span>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: showImg
            ? 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 52%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '14px 18px',
          zIndex: 1,
        }}>
          <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.65)', marginBottom: 5 }}>
            Heute · {longDayDate(dateStr)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 400, color: '#fff', lineHeight: 1.2, fontFamily: 'Georgia, serif' }}>
            {hero?.recipeName ?? 'Kein Gericht geplant'}
          </div>
        </div>
      </div>

      {/* Alle Slots */}
      <div style={{
        padding: '10px 16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        borderTop: '0.5px solid var(--color-border-tertiary)',
        flexShrink: 0,
      }}>
        {presentSlots.map(slot => {
          const recipe = daySlots[slot]![0];
          const pill   = SLOT_PILL_STYLE[slot];
          return (
            <div key={slot} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                fontSize: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                background: pill.background, color: pill.color,
              }}>
                {SLOT_LABELS[slot]}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>
                  {recipe.recipeName ?? '–'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                  {[
                    recipe.servings ? `${recipe.servings} Port.` : null,
                    recipe.calories ? `${recipe.calories} kcal` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          );
        })}
        {presentSlots.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: 0.5, fontStyle: 'italic' }}>
            Keine Einträge für heute
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tages-Kachel ─────────────────────────────────────────────────────────────
function DayCard({
  dateStr,
  daySlots,
}: {
  dateStr: string;
  daySlots: Partial<Record<Slot, PlannedRecipe[]>>;
}) {
  const presentSlots = SLOT_ORDER.filter(s => daySlots[s]?.length);

  return (
    <div style={{
      borderRadius: 16,
      border: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-background-primary)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      padding: '14px 16px',
    }}>
      {/* Kopfzeile: Tag + Datum */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 7,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-secondary)' }}>
          {shortDay(dateStr)}
        </span>
        <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--color-text-primary)', fontFamily: 'Georgia, serif' }}>
          {shortDate(dateStr)}
        </span>
      </div>

      {/* Gerichte */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
        {presentSlots.map(slot => {
          const recipe = daySlots[slot]![0];
          return (
            <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ fontSize: 8.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                {SLOT_LABELS[slot]}
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-primary)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {recipe.recipeName ?? '–'}
              </div>
              {(recipe.servings || recipe.calories) && (
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                  {[
                    recipe.servings ? `${recipe.servings} Port.` : null,
                    recipe.calories ? `${recipe.calories} kcal` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          );
        })}
        {presentSlots.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', opacity: 0.4, fontStyle: 'italic' }}>
            Nicht geplant
          </p>
        )}
      </div>
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function MealsPage() {
  const [byDate, setByDate] = useState<Record<string, Partial<Record<Slot, PlannedRecipe[]>>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/widgets/meals?range=month`)
      .then(r => r.json())
      .then(data => {
        if (data?.byDate) setByDate(data.byDate);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const today       = getTodayStr();
  const sortedDates = Object.keys(byDate).filter(d => d >= today).sort().slice(0, 7);
  const todayDate   = sortedDates[0] === today ? today : null;
  const restDates   = sortedDates.filter(d => d !== today).slice(0, 6);

  // Feste Grid-Positionen für die 6 Rest-Kacheln (3 oben, 3 unten, Spalten 2–4)
  const gridPositions = [
    { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 },
    { col: 2, row: 2 }, { col: 3, row: 2 }, { col: 4, row: 2 },
  ];

  return (
    <div>
      <PageHeader title="Essensplan" variant="page" />

      <div style={{ padding: '0 24px 24px', width: '100%' }}>

        {/* Refresh */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            onClick={load}
            style={{
              width: 34, height: 34, borderRadius: 10,
              border: '0.5px solid var(--color-border-tertiary)',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-secondary)',
            }}
            title="Aktualisieren"
          >
            <i className="ti ti-refresh" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Loading-Skeleton */}
        {loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 8,
            height: 460,
          }}>
            <div style={{ gridColumn: 1, gridRow: '1 / 3', borderRadius: 16, background: 'var(--color-background-secondary)' }} />
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ borderRadius: 16, background: 'var(--color-background-secondary)' }} />
            ))}
          </div>
        )}

        {/* Fehler / leer */}
        {!loading && (error || sortedDates.length === 0) && (
          <div style={{
            borderRadius: 16, padding: 40, textAlign: 'center',
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
          }}>
            <i className="ti ti-bowl" style={{ fontSize: 32, color: '#d8d4cf', display: 'block', marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              Kein Essensplan verfügbar
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Norish liefert noch keine Daten für diese Woche.
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && sortedDates.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 8,
            width: '100%',
            height: 'calc(100vh - 180px)',
            minHeight: 380,
            maxHeight: 520,
          }}>
            {/* Heute-Block */}
            {todayDate ? (
              <TodayCard daySlots={byDate[todayDate] ?? {}} dateStr={todayDate} />
            ) : (
              <div style={{
                gridColumn: 1, gridRow: '1 / 3',
                borderRadius: 16,
                border: '0.5px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.5, fontStyle: 'italic' }}>
                  Kein Eintrag für heute
                </p>
              </div>
            )}

            {/* Rest-Kacheln */}
            {restDates.map((date, idx) => {
              const pos = gridPositions[idx];
              return (
                <div key={date} style={{ gridColumn: pos.col, gridRow: pos.row }}>
                  <DayCard
                    dateStr={date}
                    daySlots={byDate[date] ?? {}}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}