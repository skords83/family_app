import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

// ─── Types (1:1 aus der Norish OpenAPI-Spec) ────────────────────────────────

type Slot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface PlannedRecipe {
  id: string;
  date: string;         // 'YYYY-MM-DD'
  slot: Slot;
  sortOrder: number;
  recipeId: string;
  version: number;
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
}

interface GroceryItem {
  id: string;
  name: string | null;
  unit: string | null;
  amount: number | null;
  isDone: boolean;
  storeId: string | null;
  version: number;
}

interface GroceryCreateInput {
  name: string | null;
  unit?: string | null;
  amount?: number | null;
  isDone?: boolean;
  storeId?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function norishFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = process.env.NORISH_URL?.replace(/\/$/, '');
  const apiKey = process.env.NORISH_API_KEY;

  if (!base) throw new Error('NORISH_URL not configured');
  if (!apiKey) throw new Error('NORISH_API_KEY not configured');

  return fetch(`${base}/api/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

// ─── Norish API calls ────────────────────────────────────────────────────────

async function fetchPlannedRecipes(range: 'today' | 'week' | 'month'): Promise<PlannedRecipe[]> {
  const res = await norishFetch(`/planned-recipes/${range}`);
  if (!res.ok) throw new Error(`Norish /planned-recipes/${range} → ${res.status}`);
  return res.json() as Promise<PlannedRecipe[]>;
}

async function fetchGroceries(): Promise<GroceryItem[]> {
  const res = await norishFetch('/groceries');
  if (!res.ok) throw new Error(`Norish /groceries → ${res.status}`);
  return res.json() as Promise<GroceryItem[]>;
}

async function addGroceryItem(item: GroceryCreateInput): Promise<GroceryItem> {
  const res = await norishFetch('/groceries', {
    method: 'POST',
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Norish POST /groceries → ${res.status}: ${body}`);
  }
  return res.json() as Promise<GroceryItem>;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

async function getCache<T>(widgetType: string): Promise<{ data: T; fetched_at: string } | null> {
  const result = await pool.query(
    `SELECT data, fetched_at FROM widget_cache WHERE widget_type = $1`,
    [widgetType]
  );
  if (result.rows.length === 0) return null;
  return { data: result.rows[0].data as T, fetched_at: result.rows[0].fetched_at };
}

async function setCache<T>(widgetType: string, data: T): Promise<string> {
  const result = await pool.query(
    `INSERT INTO widget_cache (widget_type, data, fetched_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (widget_type)
     DO UPDATE SET data = $2, fetched_at = NOW()
     RETURNING fetched_at`,
    [widgetType, JSON.stringify(data)]
  );
  return result.rows[0].fetched_at;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const norishRouter = Router();

/**
 * GET /api/widgets/meals?range=today|week|month
 *
 * Gibt geplante Rezepte zurück, gruppiert nach Datum und Slot.
 * Fällt bei Fehler auf den DB-Cache zurück.
 */
norishRouter.get('/', async (req: Request, res: Response) => {
  const range = (['today', 'week', 'month'].includes(req.query.range as string)
    ? req.query.range
    : 'week') as 'today' | 'week' | 'month';

  const cacheKey = `meals_${range}`;

  try {
    let items: PlannedRecipe[];
    let fetched_at: string;
    let from_cache = false;

    try {
      items = await fetchPlannedRecipes(range);
      fetched_at = await setCache(cacheKey, items);
    } catch (fetchErr) {
      console.error('Norish meals fetch failed, trying cache:', fetchErr);
      const cached = await getCache<PlannedRecipe[]>(cacheKey);
      if (!cached) {
        return res.status(503).json({ error: 'Meal data unavailable', items: [] });
      }
      items = cached.data;
      fetched_at = cached.fetched_at;
      from_cache = true;
    }

    // Gruppieren nach Datum für einfacheres Rendering im Frontend
    const byDate = items.reduce<Record<string, Partial<Record<Slot, PlannedRecipe[]>>>>(
      (acc, item) => {
        if (!acc[item.date]) acc[item.date] = {};
        if (!acc[item.date][item.slot]) acc[item.date][item.slot] = [];
        acc[item.date][item.slot]!.push(item);
        return acc;
      },
      {}
    );

    res.json({ items, byDate, fetched_at, from_cache });
  } catch (err) {
    console.error('Error in meals handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/widgets/meals/groceries
 *
 * Gibt die aktuelle Einkaufsliste zurück.
 */
norishRouter.get('/groceries', async (_req: Request, res: Response) => {
  try {
    let items: GroceryItem[];
    let fetched_at: string;
    let from_cache = false;

    try {
      items = await fetchGroceries();
      fetched_at = await setCache('groceries', items);
    } catch (fetchErr) {
      console.error('Norish groceries fetch failed, trying cache:', fetchErr);
      const cached = await getCache<GroceryItem[]>('groceries');
      if (!cached) {
        return res.status(503).json({ error: 'Grocery data unavailable', items: [] });
      }
      items = cached.data;
      fetched_at = cached.fetched_at;
      from_cache = true;
    }

    res.json({ items, fetched_at, from_cache });
  } catch (err) {
    console.error('Error in groceries handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/widgets/meals/groceries
 *
 * Fügt einen Eintrag zur Einkaufsliste hinzu.
 * Body: { name, unit?, amount?, storeId? }
 */
norishRouter.post('/groceries', async (req: Request, res: Response) => {
  const { name, unit, amount, storeId } = req.body as Partial<GroceryCreateInput>;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const item = await addGroceryItem({
      name: name.trim(),
      unit: unit ?? null,
      amount: amount != null ? Number(amount) : null,
      isDone: false,
      storeId: storeId ?? null,
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error('Error adding grocery item:', err);
    res.status(502).json({ error: 'Failed to add item to Norish' });
  }
});