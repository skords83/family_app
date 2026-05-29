import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

interface MealPlan {
  days: { date: string; lunch: string; dinner: string }[];
}

export const norishRouter = Router();

async function fetchMeals(): Promise<MealPlan> {
  const url = process.env.NORISH_URL;
  if (!url) {
    throw new Error('NORISH_URL not configured');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    throw new Error(`Norish API returned ${response.status}`);
  }

  const json = await response.json() as Record<string, unknown>;

  // Normalize the response — Norish may return various formats
  // Try to parse as { days: [...] } or as array directly
  if (json && Array.isArray(json.days)) {
    return { days: json.days };
  }

  if (Array.isArray(json)) {
    return {
      days: json.map((item: any) => ({
        date: item.date ?? item.day ?? '',
        lunch: item.lunch ?? item.mittagessen ?? '',
        dinner: item.dinner ?? item.abendessen ?? '',
      })),
    };
  }

  // Try to extract days from any recognized structure
  if (json && typeof json === 'object') {
    const possibleDays = (json.plan ?? json.meals ?? json.week ?? []) as unknown[];
    if (Array.isArray(possibleDays)) {
      return {
        days: possibleDays.map((item: any) => ({
          date: item.date ?? item.day ?? '',
          lunch: item.lunch ?? item.mittagessen ?? '',
          dinner: item.dinner ?? item.abendessen ?? '',
        })),
      };
    }
  }

  return { days: [] };
}

async function getCachedMeals(): Promise<{ data: MealPlan; fetched_at: string } | null> {
  const result = await pool.query(`
    SELECT data, fetched_at FROM widget_cache WHERE widget_type = 'meals'
  `);
  if (result.rows.length === 0) return null;
  return {
    data: result.rows[0].data,
    fetched_at: result.rows[0].fetched_at,
  };
}

async function updateMealsCache(data: MealPlan): Promise<string> {
  const result = await pool.query(`
    INSERT INTO widget_cache (widget_type, data, fetched_at)
    VALUES ('meals', $1, NOW())
    ON CONFLICT (widget_type)
    DO UPDATE SET data = $1, fetched_at = NOW()
    RETURNING fetched_at
  `, [JSON.stringify(data)]);
  return result.rows[0].fetched_at;
}

// GET /api/widgets/meals
norishRouter.get('/', async (_req: Request, res: Response) => {
  try {
    let data: MealPlan;
    let fetched_at: string;
    let fromCache = false;

    try {
      data = await fetchMeals();
      fetched_at = await updateMealsCache(data);
    } catch (fetchErr) {
      console.error('Norish fetch failed, trying cache:', fetchErr);
      const cached = await getCachedMeals();
      if (!cached) {
        return res.status(503).json({ error: 'Meal data unavailable', days: [] });
      }
      data = cached.data;
      fetched_at = cached.fetched_at;
      fromCache = true;
    }

    res.json({ data, fetched_at, from_cache: fromCache });
  } catch (err) {
    console.error('Error in meals handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
