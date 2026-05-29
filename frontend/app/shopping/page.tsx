'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface ShopItem {
  id: string;
  name: string;
  done: boolean;
  category: string;
}

const CATEGORIES = ['Kühlregal', 'Obst & Gemüse', 'Backwaren', 'Getränke', 'Trockenwaren', 'Haushalt', 'Sonstiges'];

export default function ShoppingPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('Sonstiges');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from backend (Norish integration placeholder)
  useEffect(() => {
    // TODO: fetch from Norish API once endpoint is known
    // For now use localStorage as interim storage
    try {
      const stored = localStorage.getItem('family_shopping');
      if (stored) setItems(JSON.parse(stored));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  function save(newItems: ShopItem[]) {
    setItems(newItems);
    try { localStorage.setItem('family_shopping', JSON.stringify(newItems)); } catch { /* ignore */ }
  }

  function addItem() {
    const name = input.trim();
    if (!name) return;
    const newItem: ShopItem = {
      id: crypto.randomUUID(),
      name,
      done: false,
      category,
    };
    save([...items, newItem]);
    setInput('');
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    save(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }

  function remove(id: string) {
    save(items.filter(i => i.id !== id));
  }

  function clearDone() {
    save(items.filter(i => !i.done));
  }

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  const cats = CATEGORIES.filter(c => items.some(i => i.category === c));

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-[Georgia] tracking-tight" style={{ color: '#1a1814' }}>Einkaufsliste</h1>
          <p className="text-sm font-sans mt-1" style={{ color: '#a09d99' }}>
            {pending.length} Artikel offen
            {done.length > 0 && ` · ${done.length} erledigt`}
          </p>
        </div>
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

      {/* Add item */}
      <div
        className="rounded-2xl p-4 mb-6 flex gap-3"
        style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Produkt hinzufügen..."
          className="flex-1 text-sm font-sans outline-none bg-transparent"
          style={{ color: '#1a1814' }}
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="text-xs font-sans outline-none rounded-lg px-2 py-1 border-none"
          style={{ background: '#f0ede8', color: '#6b6760' }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={addItem}
          className="px-4 py-2 rounded-xl text-sm font-sans font-medium text-white transition-all active:scale-95"
          style={{ background: '#e85d3a' }}
        >
          + Hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: '#e8e4de' }} />)}
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
          {/* Group by category */}
          {cats.map(cat => {
            const catItems = items.filter(i => i.category === cat);
            return (
              <div key={cat} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                <div className="px-5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: '#a09d99', borderBottom: '0.5px solid rgba(0,0,0,0.07)', background: '#fafaf9' }}>
                  {cat}
                </div>
                {catItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-all"
                    style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)', opacity: item.done ? 0.55 : 1 }}
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
                      {item.done && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} />}
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

          {/* Uncategorized items not in known cats */}
          {items.filter(i => !cats.includes(i.category)).map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 rounded-2xl" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>
              <button onClick={() => toggle(item.id)} className="w-5 h-5 rounded flex-shrink-0" style={{ border: '1.5px solid rgba(0,0,0,0.2)' }} />
              <span className="flex-1 text-sm font-sans">{item.name}</span>
              <button onClick={() => remove(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#a09d99' }}>
                <i className="ti ti-x" style={{ fontSize: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Norish sync hint */}
      <div className="mt-6 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: '#fff5f3', border: '0.5px solid #e85d3a30' }}>
        <i className="ti ti-plug" style={{ fontSize: 16, color: '#e85d3a' }} />
        <span className="text-xs font-sans" style={{ color: '#e85d3a' }}>
          Norish-Synchronisation: Sobald der API-Endpunkt bekannt ist, wird die Liste automatisch mit Norish abgeglichen.
        </span>
      </div>
    </div>
  );
}
