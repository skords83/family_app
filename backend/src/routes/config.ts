import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

const DEFAULT_WIDGETS = [
  { type: 'clock', enabled: true, order: 0 },
  { type: 'calendar', enabled: true, order: 1 },
  { type: 'tasks', enabled: true, order: 2 },
  { type: 'weather', enabled: true, order: 3 },
  { type: 'meals', enabled: true, order: 4 },
  { type: 'immich', enabled: true, order: 5 },
];

export const configRouter = Router();

async function verifyParentPin(pin: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT id FROM users WHERE role = 'parent' AND pin = $1`,
    [pin]
  );

  // Also check ADMIN_PIN env var
  if (pin === process.env.ADMIN_PIN) return true;

  return result.rows.length > 0;
}

// GET /api/config/widgets - return widget_config row (or defaults)
configRouter.get('/widgets', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM widget_config ORDER BY id DESC LIMIT 1`);

    if (result.rows.length === 0) {
      return res.json({ widgets: DEFAULT_WIDGETS });
    }

    res.json({ widgets: result.rows[0].widgets });
  } catch (err) {
    console.error('Error fetching widget config:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/config/widgets - upsert widget config (parent only)
configRouter.patch('/widgets', async (req: Request, res: Response) => {
  try {
    const { widgets, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    if (!widgets || !Array.isArray(widgets)) {
      return res.status(400).json({ error: 'widgets array is required' });
    }

    // Check if a config row exists
    const existing = await pool.query(`SELECT id FROM widget_config LIMIT 1`);

    let result;
    if (existing.rows.length === 0) {
      result = await pool.query(`
        INSERT INTO widget_config (widgets)
        VALUES ($1)
        RETURNING *
      `, [JSON.stringify(widgets)]);
    } else {
      result = await pool.query(`
        UPDATE widget_config
        SET widgets = $1
        WHERE id = $2
        RETURNING *
      `, [JSON.stringify(widgets), existing.rows[0].id]);
    }

    res.json({ widgets: result.rows[0].widgets });
  } catch (err) {
    console.error('Error updating widget config:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
