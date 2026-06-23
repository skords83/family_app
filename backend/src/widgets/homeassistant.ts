import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import {
  HaClimateEntitySchema,
  HaSensorEntitySchema,
  HaClimateResponseSchema,
  type HaClimateEntity,
  type HaSensorEntity,
} from '@family/shared';

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
    device_class?: string;
    unit_of_measurement?: string;
    [key: string]: unknown;
  };
}

async function fetchAllStates(): Promise<HaStateRaw[]> {
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
  return response.json() as Promise<HaStateRaw[]>;
}

function parseClimateEntities(states: HaStateRaw[]): HaClimateEntity[] {
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

function parseSensorEntities(states: HaStateRaw[]): HaSensorEntity[] {
  return states
    .filter(s =>
      s.entity_id.startsWith('sensor.') &&
      (s.attributes.device_class === 'temperature' || s.attributes.device_class === 'humidity'),
    )
    .flatMap(s => {
      const raw = parseFloat(s.state);
      if (isNaN(raw)) return [];
      const dc = s.attributes.device_class as 'temperature' | 'humidity';
      return [HaSensorEntitySchema.parse({
        entity_id: s.entity_id,
        name: s.attributes.friendly_name
          ?? s.entity_id.replace('sensor.', '').replace(/_/g, ' '),
        value: raw,
        unit: s.attributes.unit_of_measurement ?? (dc === 'temperature' ? '°C' : '%'),
        device_class: dc,
      })];
    });
}

interface CachePayload { entities: HaClimateEntity[]; sensors: HaSensorEntity[] }

async function getCached(): Promise<(CachePayload & { fetched_at: string }) | null> {
  const result = await pool.query(
    `SELECT data, fetched_at FROM widget_cache WHERE widget_type = $1`,
    [CACHE_TYPE],
  );
  if (!result.rows.length) return null;
  const age = Date.now() - new Date(result.rows[0].fetched_at).getTime();
  if (age > CACHE_MAX_AGE_MS) return null;
  return { ...result.rows[0].data, fetched_at: result.rows[0].fetched_at };
}

async function updateCache(payload: CachePayload): Promise<string> {
  const result = await pool.query(
    `INSERT INTO widget_cache (widget_type, data, fetched_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (widget_type)
     DO UPDATE SET data = $2, fetched_at = NOW()
     RETURNING fetched_at`,
    [CACHE_TYPE, JSON.stringify(payload)],
  );
  return result.rows[0].fetched_at;
}

async function callHaService(service: string, data: Record<string, unknown>): Promise<void> {
  const haUrl = process.env.HA_URL;
  const haToken = process.env.HA_TOKEN;
  if (!haUrl || !haToken) throw new Error('HA_URL or HA_TOKEN not configured');

  const response = await fetch(`${haUrl.replace(/\/$/, '')}/api/services/${service}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${haToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`HA service call returned ${response.status}`);
}

// GET /api/widgets/homeassistant/climate
homeassistantRouter.get('/climate', async (_req: Request, res: Response) => {
  try {
    const cached = await getCached();
    if (cached) {
      return res.json(HaClimateResponseSchema.parse({
        entities: cached.entities,
        sensors: cached.sensors,
        fetched_at: new Date(cached.fetched_at).toISOString(),
      }));
    }

    let payload: CachePayload;
    let fetched_at: string;

    try {
      const states = await fetchAllStates();
      payload = {
        entities: parseClimateEntities(states),
        sensors: parseSensorEntities(states),
      };
      fetched_at = await updateCache(payload);
    } catch (fetchErr) {
      console.error('[ha] Fetch failed:', fetchErr);
      return res.status(503).json({ error: 'Home Assistant not reachable' });
    }

    return res.json(HaClimateResponseSchema.parse({
      ...payload,
      fetched_at: new Date(fetched_at).toISOString(),
    }));
  } catch (err) {
    console.error('[ha] Error in climate handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/widgets/homeassistant/climate/:entityId/temperature
homeassistantRouter.post('/climate/:entityId/temperature', async (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { temperature } = req.body as { temperature: unknown };

  if (typeof temperature !== 'number' || temperature < 5 || temperature > 30) {
    return res.status(400).json({ error: 'temperature must be a number between 5 and 30' });
  }
  if (!entityId.startsWith('climate.')) {
    return res.status(400).json({ error: 'Invalid entity_id' });
  }

  try {
    await callHaService('climate/set_temperature', {
      entity_id: entityId,
      temperature,
    });
    // Invalidate cache so next GET fetches fresh data from HA
    await pool.query(`DELETE FROM widget_cache WHERE widget_type = $1`, [CACHE_TYPE]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[ha] set_temperature failed:', err);
    res.status(503).json({ error: 'Home Assistant not reachable' });
  }
});
