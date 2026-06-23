import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { HaClimateEntitySchema, HaClimateResponseSchema, type HaClimateEntity } from '@family/shared';

export const homeassistantRouter = Router();

const CACHE_TYPE = 'ha_climate';
const CACHE_MAX_AGE_MS = 2 * 60 * 1000;

interface HaStateRaw {
  entity_id: string;
  state: string;
  attributes: {
    current_temperature?: number | null;
    temperature?: number | null;
    friendly_name?: string;
    [key: string]: unknown;
  };
}

async function fetchClimateEntities(): Promise<HaClimateEntity[]> {
  const haUrl = process.env.HA_URL;
  const haToken = process.env.HA_TOKEN;

  if (!haUrl || !haToken) throw new Error('HA_URL or HA_TOKEN not configured');

  const response = await fetch(`${haUrl.replace(/\/$/, '')}/api/states`, {
    headers: {
      Authorization: `Bearer ${haToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`HA API returned ${response.status}`);

  const states = await response.json() as HaStateRaw[];

  return states
    .filter(s => s.entity_id.startsWith('climate.'))
    .map(s => HaClimateEntitySchema.parse({
      entity_id: s.entity_id,
      name: s.attributes.friendly_name
        ?? s.entity_id.replace('climate.', '').replace(/_/g, ' '),
      current_temperature: s.attributes.current_temperature ?? null,
      target_temperature: s.attributes.temperature ?? null,
      hvac_mode: s.state,
    }));
}

async function getCached(): Promise<{ entities: HaClimateEntity[]; fetched_at: string } | null> {
  const result = await pool.query(
    `SELECT data, fetched_at FROM widget_cache WHERE widget_type = $1`,
    [CACHE_TYPE],
  );
  if (!result.rows.length) return null;
  const age = Date.now() - new Date(result.rows[0].fetched_at).getTime();
  if (age > CACHE_MAX_AGE_MS) return null;
  return { entities: result.rows[0].data, fetched_at: result.rows[0].fetched_at };
}

async function updateCache(entities: HaClimateEntity[]): Promise<string> {
  const result = await pool.query(
    `INSERT INTO widget_cache (widget_type, data, fetched_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (widget_type)
     DO UPDATE SET data = $2, fetched_at = NOW()
     RETURNING fetched_at`,
    [CACHE_TYPE, JSON.stringify(entities)],
  );
  return result.rows[0].fetched_at;
}

// GET /api/widgets/homeassistant/climate
homeassistantRouter.get('/climate', async (_req: Request, res: Response) => {
  try {
    const cached = await getCached();
    if (cached) {
      return res.json(HaClimateResponseSchema.parse({
        entities: cached.entities,
        fetched_at: new Date(cached.fetched_at).toISOString(),
      }));
    }

    let entities: HaClimateEntity[];
    let fetched_at: string;

    try {
      entities = await fetchClimateEntities();
      fetched_at = await updateCache(entities);
    } catch (fetchErr) {
      console.error('[ha] Climate fetch failed:', fetchErr);
      return res.status(503).json({ error: 'Home Assistant not reachable' });
    }

    return res.json(HaClimateResponseSchema.parse({
      entities,
      fetched_at: new Date(fetched_at).toISOString(),
    }));
  } catch (err) {
    console.error('[ha] Error in climate handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
