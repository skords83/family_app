'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// ── Typen ────────────────────────────────────────────────────────────────────

interface ShopItem {
  id: string;
  name: string;
  done: boolean;
  category: string;
  source: 'manual' | 'norish';
  /** Norish-interne ID, falls vorhanden */
  noriishId?: string | number;
}

interface NoriishGroceryItem {
  id?: string | number;
  name: string;
  unit?: string;
  amount?: number;
  checked?: boolean;
}

// ── Konstanten ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Kühlregal',
  'Obst & Gemüse',
  'Backwaren',
  'Getränke',
  'Trockenwaren',
  'Haushalt',
  'Sonstiges',
];

const NORISH_CATEGORY = 'Norish';

const LS_KEY = 'family_shopping';

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function loadLocal(): ShopItem[] {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const parsed: ShopItem[] = JSON.parse(stored);
      // Nur manuelle Items aus localStorage (Norish-Items kommen immer frisch vom Backend)
      return parsed.filter(i => i.source === 'manual');
    }
  } catch { /* ignore */ }
  return [];
}

function saveLocal(items: ShopItem[]) {
  try {
    const manual = items.filter(i => i.source === 'manual');
    localStorage.setItem(LS_KEY, JSON.stringify(manual));
  } catch { /* ignore */ }
}

function noriishToShopItem(ni: NoriishGroceryItem): ShopItem {
  const label = [
    ni.amount != null ? ni.amount : null,
    ni.unit ?? null,
    ni.name,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: `norish-${ni.id ?? ni.name}`,
    name: label,
    done: ni.checked ?? false,
    category: NORISH_CATEGORY,
    source: 'norish',
    noriishId: ni.id,
  };
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function ShoppingPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('Sonstiges');
  const [loading, setLoading] = useState(true);
  const [noriishError, setNoriishError] = useState(false);
  const [addingToNoriish, setAddingToNoriish] = useState(false);
  const [sendToNoriish, setSendToNoriish] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Norish laden ──────────────────────────────────────────────────────────

  const fetchNoriish = useCallback(async (): Promise<ShopItem[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/meals/groceries`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const groceries: NoriishGroceryItem[] = data.items ?? [];
      setNoriishError(false);
      return groceries.map(noriishToShopItem);
    } catch {
      setNoriishError(true);
      return [];
    }
  }, []);

  // ── Initialer Load ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [manual, norish] = await Promise.all([
        Promise.resolve(loadLocal()),
        fetchNoriish(),
      ]);
      setItems([...manual, ...norish]);
      setLoading(false);
    })();
  }, [fetchNoriish]);

  // ── State-Mutations ───────────────────────────────────────────────────────

  function applyAndSave(newItems: ShopItem[]) {
    setItems(newItems);
    saveLocal(newItems);
  }

  function toggle(id: string) {
    applyAndSave(items.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function remove(id: string) {
    applyAndSave(items.filter(i => i.id !== id));
  }

  function clearDone() {
    applyAndSave(items.filter(i => !i.done));
  }

  // ── Item hinzufügen ───────────────────────────────────────────────────────

  async function addItem() {
    const name = input.trim();
    if (!name) return;

    if (sendToNoriish) {
      // → Norish-Backend
      setAddingToNoriish(true);
      try {
        const res = await fetch(`${API_BASE}/api/widgets/meals/groceries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Liste neu laden damit Norish-ID korrekt gesetzt ist
        const fresh = await fetchNoriish();
        applyAndSave([
          ...items.filter(i => i.source === 'manual'),
          ...fresh,
        ]);
      } catch {
        setNoriishError(true);
        // Fallback: lokal speichern
        const fallback: ShopItem = {
          id: crypto.randomUUID(),
          name,
          done: false,
          category,
          source: 'manual',
        };
        applyAndSave([...items, fallback]);
      } finally {
        setAddingToNoriish(false);
      }
    } else {
      // → lokal
      const newItem: ShopItem = {
        id: crypto.randomUUID(),
        name,
        done: false,
        category,
        source: 'manual',
      };
      applyAndSave([...items, newItem]);
    }

    setInput('');
    inputRef.current?.focus();
  }

  // ── Norish manuell neu laden ──────────────────────────────────────────────

  async function refreshNoriish() {
    const fresh = await fetchNoriish();
    applyAndSave([...items.filter(i => i.source === 'manual'), ...fresh]);
  }

  // ── Render-Helfer ─────────────────────────────────────────────────────────

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  // Kategorien in fester Reihenfolge: zuerst Norish, dann manuelle Kategorien
  const allCats = [
    NORISH_CATEGORY,
    ...CATEGORIES,
  ].filter(c => items.some(i => i.category === c));

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>
            Einkaufsliste
          </h1>
          <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>
            {pending.length} Artikel offen
            {done.length > 0 && ` · ${done.length} erledigt`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Norish-Refresh */}
          <button
            onClick={refreshNoriish}
            title="Norish-Liste neu laden"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-black/5"
            style={{ color: noriishError ? '#e85d3a' : '#a09d99', border: '0.5px solid rgba(0,0,0,0.1)' }}
          >
            <i className="ti ti-refresh" style={{ fontSize: 15 }} />
          </button>
          {done.length > 0 && (
            <button
              onClick={clearDone}
              className="text-xs font-sans px-3 py-1.5 rounded-lg transition-all hover:bg-black/5"
              style={{ color: '#a09d99', border: '0.5px solid rgba(0,0,0,0.1)' }}
            >
              Erledigte löschen
            </button>
          )}
        </div>
      </div>

      {/* Norish-Fehlermeldung */}
      {noriishError && (
        <div
          className="mb-4 rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: '#fff5f3', border: '0.5px solid #e85d3a30' }}
        >
          <i className="ti ti-alert-circle" style={{ fontSize: 15, color: '#e85d3a' }} />
          <span className="text-xs font-sans" style={{ color: '#e85d3a' }}>
            Norish konnte nicht geladen werden. Manuelle Items sind trotzdem verfügbar.
          </span>
        </div>
      )}

      {/* Add item */}
      <div
        className="rounded-2xl p-4 mb-6"
        style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
      >
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Produkt hinzufügen..."
            className="flex-1 text-sm font-sans outline-none bg-transparent"
            style={{ color: '#1a1814' }}
          />
          {/* Kategorie nur sichtbar wenn nicht an Norish */}
          {!sendToNoriish && (
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="text-xs font-sans outline-none rounded-lg px-2 py-1"
              style={{ background: '#f0ede8', color: '#6b6760', border: 'none' }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <button
            onClick={addItem}
            disabled={addingToNoriish}
            className="px-4 py-2 rounded-xl text-sm font-sans font-medium text-white transition-all active:scale-95 disabled:opacity-60"
            style={{ background: '#e85d3a' }}
          >
            {addingToNoriish ? '…' : '+ Hinzufügen'}
          </button>
        </div>

        {/* Norish-Toggle */}
        <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
          <button
            onClick={() => setSendToNoriish(v => !v)}
            className="w-8 h-4 rounded-full relative transition-all flex-shrink-0"
            style={{
              background: sendToNoriish ? '#e85d3a' : 'rgba(0,0,0,0.12)',
            }}
          >
            <span
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
              style={{ left: sendToNoriish ? '18px' : '2px' }}
            />
          </button>
          <span className="text-xs font-sans" style={{ color: '#6b6760' }}>
            Direkt zu Norish hinzufügen
          </span>
        </div>
      </div>

      {/* Listen */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: '#e8e4de' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
        >
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-sm font-sans" style={{ color: '#a09d99' }}>Liste ist leer</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allCats.map(cat => {
            const catItems = items.filter(i => i.category === cat);
            if (!catItems.length) return null;
            const isNorish = cat === NORISH_CATEGORY;
            return (
              <div
                key={cat}
                className="rounded-2xl overflow-hidden"
                style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
              >
                {/* Kategorie-Header */}
                <div
                  className="px-5 py-2.5 flex items-center gap-2"
                  style={{
                    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
                    background: isNorish ? '#fff5f3' : '#fafaf9',
                  }}
                >
                  {isNorish && (
                    <i className="ti ti-plug" style={{ fontSize: 12, color: '#e85d3a' }} />
                  )}
                  <span
                    className="text-xs font-sans font-semibold uppercase tracking-wider"
                    style={{ color: isNorish ? '#e85d3a' : '#a09d99' }}
                  >
                    {cat}
                  </span>
                </div>

                {/* Items */}
                {catItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-all"
                    style={{
                      borderBottom:
                        idx < catItems.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none',
                      opacity: item.done ? 0.55 : 1,
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggle(item.id)}
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        border: item.done ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
                        background: item.done ? '#e85d3a' : 'transparent',
                      }}
                    >
                      {item.done && (
                        <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} />
                      )}
                    </button>

                    <span
                      className="flex-1 text-sm font-sans"
                      style={{
                        color: '#1a1814',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}
                    >
                      {item.name}
                    </span>

                    <button
                      onClick={() => remove(item.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
                      style={{ color: '#a09d99' }}
                    >
                      <i className="ti ti-x" style={{ fontSize: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}