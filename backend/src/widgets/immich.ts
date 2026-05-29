import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

export const immichRouter = Router();

interface ImmichAsset {
  id: string;
  originalPath: string;
  originalFileName: string;
  fileCreatedAt: string;
  type: string;
  exifInfo?: {
    description?: string;
    city?: string;
    country?: string;
  };
}

interface ImmichWidgetData {
  id: string;
  url: string;
  thumbnailUrl: string;
  fileName: string;
  createdAt: string;
  description?: string;
  location?: string;
}

async function fetchRandomPhoto(): Promise<ImmichWidgetData> {
  const immichUrl = process.env.IMMICH_URL;
  const apiKey = process.env.IMMICH_API_KEY;

  if (!immichUrl || !apiKey) {
    throw new Error('Immich configuration missing');
  }

  const baseUrl = immichUrl.replace(/\/$/, '');
  const apiBase = `${baseUrl}/api`;

  const response = await fetch(`${apiBase}/assets/random?count=1`, {
    headers: {
      'x-api-key': apiKey,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Immich API returned ${response.status}`);
  }

  const assets = await response.json() as ImmichAsset[];

  if (!assets || assets.length === 0) {
    throw new Error('No assets returned from Immich');
  }

  const asset = assets[0];

  // Only use images (not videos)
  if (asset.type !== 'IMAGE') {
    throw new Error('Random asset is not an image, retry needed');
  }

  const thumbnailUrl = `${apiBase}/assets/${asset.id}/thumbnail?size=preview`;
  const fullUrl = `${apiBase}/assets/${asset.id}/original`;

  let location: string | undefined;
  if (asset.exifInfo?.city || asset.exifInfo?.country) {
    location = [asset.exifInfo.city, asset.exifInfo.country].filter(Boolean).join(', ');
  }

  return {
    id: asset.id,
    url: fullUrl,
    thumbnailUrl,
    fileName: asset.originalFileName,
    createdAt: asset.fileCreatedAt,
    description: asset.exifInfo?.description,
    location,
  };
}

async function getCachedImmich(): Promise<{ data: ImmichWidgetData; fetched_at: string } | null> {
  const result = await pool.query(`
    SELECT data, fetched_at FROM widget_cache WHERE widget_type = 'immich'
  `);
  if (result.rows.length === 0) return null;
  return {
    data: result.rows[0].data,
    fetched_at: result.rows[0].fetched_at,
  };
}

async function updateImmichCache(data: ImmichWidgetData): Promise<string> {
  const result = await pool.query(`
    INSERT INTO widget_cache (widget_type, data, fetched_at)
    VALUES ('immich', $1, NOW())
    ON CONFLICT (widget_type)
    DO UPDATE SET data = $1, fetched_at = NOW()
    RETURNING fetched_at
  `, [JSON.stringify(data)]);
  return result.rows[0].fetched_at;
}

// GET /api/widgets/immich
immichRouter.get('/', async (_req: Request, res: Response) => {
  try {
    let data: ImmichWidgetData;
    let fetched_at: string;
    let fromCache = false;

    try {
      data = await fetchRandomPhoto();
      fetched_at = await updateImmichCache(data);
    } catch (fetchErr) {
      console.error('Immich fetch failed, trying cache:', fetchErr);
      const cached = await getCachedImmich();
      if (!cached) {
        return res.status(503).json({ error: 'Photo data unavailable' });
      }
      data = cached.data;
      fetched_at = cached.fetched_at;
      fromCache = true;
    }

    // Add the API key as a query param for the frontend to use (since Immich needs auth)
    // We proxy through backend to avoid exposing API key in frontend
    res.json({ data, fetched_at, from_cache: fromCache });
  } catch (err) {
    console.error('Error in immich handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/widgets/immich/refresh - force fetch new photo
immichRouter.get('/refresh', async (_req: Request, res: Response) => {
  try {
    const data = await fetchRandomPhoto();
    const fetched_at = await updateImmichCache(data);
    res.json({ data, fetched_at, from_cache: false });
  } catch (err) {
    console.error('Error refreshing immich photo:', err);
    res.status(503).json({ error: 'Could not fetch new photo' });
  }
});

// GET /api/widgets/immich/proxy/:id - proxy image with auth header
immichRouter.get('/proxy/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { size = 'preview' } = req.query;
    const immichUrl = process.env.IMMICH_URL;
    const apiKey = process.env.IMMICH_API_KEY;

    if (!immichUrl || !apiKey) {
      return res.status(503).json({ error: 'Immich not configured' });
    }

    const baseUrl = immichUrl.replace(/\/$/, '');
    const apiBase = `${baseUrl}/api`;

    const imageUrl = size === 'original'
      ? `${apiBase}/assets/${id}/original`
      : `${apiBase}/assets/${id}/thumbnail?size=${size}`;

    const response = await fetch(imageUrl, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image not found' });
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error proxying immich image:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
