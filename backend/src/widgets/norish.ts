import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import {
  PlannedRecipeSchema,
  GroceryItemSchema,
  GroceryCreateInputSchema,
  GroceryToggleInputSchema,
  MealsResponseSchema,
  GroceriesResponseSchema,
  type MealSlot,
  type PlannedRecipe,
  type GroceryItem,
  type GroceryCreateInput,
} from '@family/shared';

// Alias für das globale Fetch-Response, damit kein Konflikt mit Express' Response entsteht
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Löst einen recipeImage-Pfad zur vollständigen URL auf.
 * Die URL bleibt intern (Norish-Server) – der Browser bekommt nur den Proxy-Pfad.
 */
function resolveImageUrl(recipeImage: string | null): string | null {
  if (!recipeImage) return null;
  const base = (process.env.NORISH_URL ?? '').replace(/\/$/, '');
  if (recipeImage.startsWith('http://') || recipeImage.startsWith('https://')) {
    return recipeImage;
  }
  const path = recipeImage.startsWith('/') ? recipeImage : `/${recipeImage}`;
  return `${base}${path}`;
}

/**
 * Gibt den /api/widgets/meals/image?url=... Proxy-Pfad zurück,
 * den der Browser direkt aufrufen kann.
 */
function proxyImageUrl(recipeImage: string | null): string | null {
  const internal = resolveImageUrl(recipeImage);
  if (!internal) return null;
  return `/api/widgets/meals/image?url=${encodeURIComponent(internal)}`;
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
  if (range !== 'month') {
    const res: FetchResponse = await norishFetch(`/planned-recipes/${range}`);
    if (!res.ok) throw new Error(`Norish /planned-recipes/${range} → ${res.status}`);
    const raw = await res.json() as Omit<PlannedRecipe, 'imageUrl'>[];
    return raw.map(item => PlannedRecipeSchema.parse({ ...item, imageUrl: proxyImageUrl(item.recipeImage) }));
  }

  const [monthRes, weekRes] = await Promise.all([
    norishFetch('/planned-recipes/month'),
    norishFetch('/planned-recipes/week'),
  ]);

  if (!monthRes.ok) throw new Error(`Norish /planned-recipes/month → ${monthRes.status}`);

  const monthRaw = await monthRes.json() as Omit<PlannedRecipe, 'imageUrl'>[];
  const weekRaw: Omit<PlannedRecipe, 'imageUrl'>[] = weekRes.ok
    ? (await weekRes.json()) as Omit<PlannedRecipe, 'imageUrl'>[]
    : [];

  if (!weekRes.ok) {
    console.warn(`Norish /planned-recipes/week → ${weekRes.status} (non-fatal, using month only)`);
  }

  const seen = new Set<string>();
  const merged = [...monthRaw, ...weekRaw].filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  merged.sort((a, b) => a.date.localeCompare(b.date));

  return merged.map(item => PlannedRecipeSchema.parse({ ...item, imageUrl: proxyImageUrl(item.recipeImage) }));
}

async function fetchGroceries(): Promise<GroceryItem[]> {
  const res: FetchResponse = await norishFetch('/groceries');
  if (!res.ok) throw new Error(`Norish /groceries → ${res.status}`);
  const raw = await res.json() as unknown[];
  return raw.map(item => GroceryItemSchema.parse(item));
}

async function toggleGroceryDone(id: string, version: number, done: boolean): Promise<void> {
  const path = done ? `/groceries/${id}/done` : `/groceries/${id}/undone`;
  const res: FetchResponse = await norishFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
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
  const res: FetchResponse = await norishFetch(`/groceries/${id}?version=${version}`, {
    method: 'DELETE',
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
  const raw = await res.json() as unknown;
  return GroceryItemSchema.parse(raw);
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
 * GET /api/widgets/meals/image?url=<encoded-internal-url>
 * Proxy: lädt das Bild serverseitig von Norish und reicht es an den Browser durch.
 * So muss der Client die interne Norish-URL nicht erreichen können.
 */
norishRouter.get('/image', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    return res.status(400).send('Missing url parameter');
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    // Sicherheitscheck: nur Norish-URLs erlaubt
    const norish = (process.env.NORISH_URL ?? '').replace(/\/$/, '');
    if (!targetUrl.startsWith(norish)) {
      return res.status(403).send('Forbidden');
    }
  } catch {
    return res.status(400).send('Invalid url parameter');
  }

  try {
    const apiKey = process.env.NORISH_API_KEY ?? '';
    const imgRes = await fetch(targetUrl, {
      signal: AbortSignal.timeout(8_000),
      headers: apiKey ? { 'x-api-key': apiKey } : {},
    });

    if (!imgRes.ok) {
      return res.status(imgRes.status).send('Image fetch failed');
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Image proxy error:', err);
    res.status(502).send('Image proxy failed');
  }
});

/**
 * GET /api/widgets/meals?range=today|week|month
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

    const byDate = items.reduce<Record<string, Partial<Record<MealSlot, PlannedRecipe[]>>>>(
      (acc, item) => {
        if (!acc[item.date]) acc[item.date] = {};
        if (!acc[item.date][item.slot]) acc[item.date][item.slot] = [];
        acc[item.date][item.slot]!.push(item);
        return acc;
      },
      {}
    );

    return res.json(MealsResponseSchema.parse({
      items,
      byDate,
      fetched_at: new Date(fetched_at).toISOString(),
      from_cache,
    }));
  } catch (err) {
    console.error('Error in meals handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/widgets/meals/groceries
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

    return res.json(GroceriesResponseSchema.parse({
      items,
      fetched_at: new Date(fetched_at).toISOString(),
      from_cache,
    }));
  } catch (err) {
    console.error('Error in groceries handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/widgets/meals/groceries/:id
 * Body: { version, isDone }
 */
norishRouter.patch('/groceries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = GroceryToggleInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'version (number) and isDone (boolean) are required' });
  }

  try {
    await toggleGroceryDone(id, parsed.data.version, parsed.data.isDone);
    res.json({ success: true });
  } catch (err) {
    console.error('Error toggling grocery item:', err);
    res.status(502).json({ error: 'Failed to update item in Norish' });
  }
});

/**
 * DELETE /api/widgets/meals/groceries/:id
 * Query: ?version=N
 */
norishRouter.delete('/groceries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rawVersion = req.query.version ?? req.body?.version;
  const version = typeof rawVersion === 'string' ? parseInt(rawVersion, 10) : Number(rawVersion);

  if (!Number.isFinite(version) || version <= 0) {
    return res.status(400).json({ error: 'version (positive number) is required' });
  }

  try {
    await deleteGroceryItem(id, version);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting grocery item:', err);
    res.status(502).json({ error: 'Failed to delete item in Norish' });
  }
});

/**
 * POST /api/widgets/meals/groceries
 * Body: { name, unit?, amount?, storeId? }
 */
norishRouter.post('/groceries', async (req: Request, res: Response) => {
  const parsed = GroceryCreateInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const item = await addGroceryItem({
      name: parsed.data.name,
      unit: parsed.data.unit ?? null,
      amount: parsed.data.amount != null ? Number(parsed.data.amount) : null,
      isDone: false,
      storeId: parsed.data.storeId ?? null,
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error('Error adding grocery item:', err);
    res.status(502).json({ error: 'Failed to add item to Norish' });
  }
});