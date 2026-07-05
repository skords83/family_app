import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { requireParentAuth } from '../middleware/auth';

export const birthdaysRouter = Router();

// GET /api/birthdays - vollstaendige Liste (inkl. inaktive) fuers Verwaltungs-UI
birthdaysRouter.get('/', requireParentAuth, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, name, birth_month, birth_day, birth_year, source, active
      FROM birthdays
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/birthdays - manueller Eintrag
birthdaysRouter.post('/', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { name, birth_month, birth_day, birth_year } = req.body as {
      name?: string;
      birth_month?: number;
      birth_day?: number;
      birth_year?: number | null;
    };

    if (!name || !birth_month || !birth_day) {
      return res.status(400).json({ error: 'name, birth_month und birth_day sind erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO birthdays (name, birth_month, birth_day, birth_year, source, active)
      VALUES ($1, $2, $3, $4, 'manual', true)
      RETURNING id, name, birth_month, birth_day, birth_year, source, active
    `, [name, birth_month, birth_day, birth_year ?? null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating birthday:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/birthdays/:id - bei source='carddav' ist nur `active` aenderbar
birthdaysRouter.put('/:id', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT source FROM birthdays WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Birthday not found' });
    }

    const { name, birth_month, birth_day, birth_year, active } = req.body as {
      name?: string;
      birth_month?: number;
      birth_day?: number;
      birth_year?: number | null;
      active?: boolean;
    };

    if (existing.rows[0].source === 'carddav') {
      if (name !== undefined || birth_month !== undefined || birth_day !== undefined || birth_year !== undefined) {
        return res.status(400).json({ error: 'Bei CardDAV-Kontakten ist nur "active" aenderbar' });
      }
      const result = await pool.query(`
        UPDATE birthdays SET active = COALESCE($1, active) WHERE id = $2
        RETURNING id, name, birth_month, birth_day, birth_year, source, active
      `, [active ?? null, id]);
      return res.json(result.rows[0]);
    }

    const yearProvided = birth_year !== undefined;
    const result = await pool.query(`
      UPDATE birthdays SET
        name        = COALESCE($1, name),
        birth_month = COALESCE($2, birth_month),
        birth_day   = COALESCE($3, birth_day),
        birth_year  = CASE WHEN $4::boolean THEN $5::smallint ELSE birth_year END,
        active      = COALESCE($6, active)
      WHERE id = $7
      RETURNING id, name, birth_month, birth_day, birth_year, source, active
    `, [name ?? null, birth_month ?? null, birth_day ?? null, yearProvided, birth_year ?? null, active ?? null, id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating birthday:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/birthdays/:id - nur fuer source='manual'
birthdaysRouter.delete('/:id', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT source FROM birthdays WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Birthday not found' });
    }
    if (existing.rows[0].source === 'carddav') {
      return res.status(400).json({ error: 'CardDAV-Kontakte koennen nur ueber active=false ausgeblendet werden' });
    }

    await pool.query(`DELETE FROM birthdays WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting birthday:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
