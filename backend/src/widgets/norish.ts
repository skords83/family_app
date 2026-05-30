import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

// Alias für das globale Fetch-Response, damit kein Konflikt mit Express' Response entsteht
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

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
  recipeImage: string | null;  // relativer Pfad aus Norish
  imageUrl: string | null;     // aufgelöste absolute URL, bereit für <img src>
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

/**
 * Löst einen recipeImage-Pfad zur vollständigen URL auf.
 *
 * Norish speichert Bilder als relativen Pfad, z.B.:
 *   /recipes/abc-123/deadbeef.jpg
 * Diese werden direkt unter der Basis-URL ausgeliefert:
 *   https://norish.skords.de/recipes/abc-123/deadbeef.jpg
 *
 * Gibt null zurück wenn kein Bild vorhanden.
 */
function resolveImageUrl(recipeImage: string | null): string | null {
  if (!recipeImage) return null;
  const base = (process.env.NORISH_URL ?? '').replace(/\/$/, '');
  // Falls das Feld schon eine absolute URL enthält (http/https), direkt zurückgeben
  if (recipeImage.startsWith('http://') || recipeImage.startsWith('https://')) {
    return recipeImage;
  }
  const path = recipeImage.startsWith('/') ? recipeImage : `/${recipeImage}`;
  return `${base}${path}`;
}

function norishFetch(path: string, init?: RequestInit): Promise<FetchResponse> {
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
  const res: FetchResponse = await norishFetch(`/planned-recipes/${range}`);
  if (!res.ok) throw new Error(`Norish /planned-recipes/${range} → ${res.status}`);
  const raw = await res.json() as Omit<PlannedRecipe, 'imageUrl'>[];
  return raw.map(item => ({
    ...item,
    imageUrl: resolveImageUrl(item.recipeImage),
  }));
}

async function fetchGroceries(): Promise<GroceryItem[]> {
  const res: FetchResponse = await norishFetch('/groceries');
  if (!res.ok) throw new Error(`Norish /groceries → ${res.status}`);
  const raw = await res.json() as (GroceryItem & { version?: number })[];
  // version fehlt in der Norish-API-Response → Fallback auf 1
  return raw.map(item => ({ ...item, version: item.version ?? 1 }));
}

async function toggleGroceryDone(id: string, version: number, done: boolean): Promise<void> {
  const path = done ? `/groceries/${id}/done` : `/groceries/${id}/undone`;
  const res: FetchResponse = await norishFetch(path, {
    method: 'PATCH',                          // Norish erwartet PATCH
    body: JSON.stringify({ id, version }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Norish PATCH ${path} → ${res.status}: ${body}`);
  }
}

async function deleteGroceryItem(id: string, version: number): Promise<void> {
  if (!Number.isFinite(version)) {
    throw new Error(`deleteGroceryItem: ungültige version (${version}) für id ${id}`);
  }
  const res: FetchResponse = await norishFetch(`/groceries/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ id, version }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Norish DELETE /groceries/${id} → ${res.status}: ${body}`);
  }
}

async function addGroceryItem(item: GroceryCreateInput): Promise<GroceryItem> {
  const res: FetchResponse = await norishFetch('/groceries', {
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
 * PATCH /api/widgets/meals/groceries/:id
 *
 * Setzt den checked-Status eines Eintrags.
 * Body: { version, isDone }
 */
norishRouter.patch('/groceries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { version, isDone } = req.body as { version?: number; isDone?: boolean };

  if (typeof version !== 'number' || typeof isDone !== 'boolean') {
    return res.status(400).json({ error: 'version (number) and isDone (boolean) are required' });
  }

  try {
    await toggleGroceryDone(id, version, isDone);
    res.json({ success: true });
  } catch (err) {
    console.error('Error toggling grocery item:', err);
    res.status(502).json({ error: 'Failed to update item in Norish' });
  }
});

/**
 * DELETE /api/widgets/meals/groceries/:id
 *
 * Löscht einen Eintrag aus der Einkaufsliste.
 * Body: { version }
 */
norishRouter.delete('/groceries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { version } = req.body as { version?: number };

  if (typeof version !== 'number') {
    return res.status(400).json({ error: 'version (number) is required' });
  }

  try {
    await deleteGroceryItem(id, version);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting grocery item:', err);
    res.status(502).json({ error: 'Failed to delete item in Norish' });
  }
});
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