import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { verifyParentAuth, hashPin } from '../lib/auth';
import { requireParentAuth } from '../middleware/auth';

export const usersRouter = Router();

// GET /api/users — all users with points + today's task progress
usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.avatar,
        u.photo,
        u.color,
        u.role,
        u.birthdate,
        COALESCE(pe.total_points, 0)::integer AS points,
        COALESCE(ti.tasks_total, 0)::integer AS tasks_total,
        COALESCE(ti.tasks_done, 0)::integer AS tasks_done
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(points) AS total_points
        FROM point_events
        GROUP BY user_id
      ) pe ON pe.user_id = u.id
      LEFT JOIN (
        SELECT
          assigned_to,
          COUNT(id) AS tasks_total,
          COUNT(completed_at) AS tasks_done
        FROM task_instances
        WHERE date = $1
        GROUP BY assigned_to
      ) ti ON ti.assigned_to = u.id
      ORDER BY u.name ASC
    `, [today]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id — single user with points + task progress
usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.avatar,
        u.photo,
        u.color,
        u.role,
        u.birthdate,
        COALESCE(pe.total_points, 0)::integer AS points,
        COALESCE(ti.tasks_total, 0)::integer AS tasks_total,
        COALESCE(ti.tasks_done, 0)::integer AS tasks_done
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(points) AS total_points
        FROM point_events
        GROUP BY user_id
      ) pe ON pe.user_id = u.id
      LEFT JOIN (
        SELECT
          assigned_to,
          COUNT(id) AS tasks_total,
          COUNT(completed_at) AS tasks_done
        FROM task_instances
        WHERE date = $1
        GROUP BY assigned_to
      ) ti ON ti.assigned_to = u.id
      WHERE u.id = $2
    `, [today, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:id/photo — upload base64 photo
usersRouter.post('/:id/photo', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { photo } = req.body as { photo?: string };

    if (!photo) {
      return res.status(400).json({ error: 'Missing photo field (base64 data URL)' });
    }

    await pool.query(
      'UPDATE users SET photo = $1 WHERE id = $2',
      [photo, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating photo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id — update name / avatar / color / pin / birthdate
usersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, avatar, color, pin, birthdate } = req.body as {
      name?: string;
      avatar?: string;
      color?: string;
      pin?: string;
      birthdate?: string | null;
    };

    // PIN changes require admin_pin verification
    let hashedPin: string | undefined;
    if (pin !== undefined) {
      const adminPinInput = req.body.admin_pin as string | undefined;
      if (!adminPinInput) {
        return res.status(400).json({ error: 'admin_pin ist für PIN-Änderungen erforderlich' });
      }
      const auth = await verifyParentAuth(adminPinInput);
      if (!auth.valid) {
        return res.status(401).json({ error: 'Ungültiger Admin-PIN' });
      }
      hashedPin = await hashPin(pin);
    }

    // birthdate explicitly nullable — treat null as "clear", undefined as "leave alone"
    const birthdateSql = birthdate === undefined ? null : birthdate;
    const birthdateChanged = birthdate !== undefined;

    const result = await pool.query(`
      UPDATE users
      SET
        name      = COALESCE($1, name),
        avatar    = COALESCE($2, avatar),
        color     = COALESCE($3, color),
        pin       = COALESCE($4, pin),
        birthdate = CASE WHEN $6::boolean THEN $5::date ELSE birthdate END
      WHERE id = $7
      RETURNING id, name, avatar, photo, color, role, birthdate
    `, [name, avatar, color, hashedPin ?? null, birthdateSql, birthdateChanged, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — create new user (admin)
usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, avatar, color, pin, role, birthdate, admin_pin } = req.body as {
      name: string;
      avatar?: string;
      color?: string;
      pin?: string;
      role?: string;
      birthdate?: string | null;
      admin_pin?: string;
    };

    if (!name) return res.status(400).json({ error: 'name is required' });

    if (!admin_pin) return res.status(400).json({ error: 'admin_pin ist erforderlich' });
    const adminAuth = await verifyParentAuth(admin_pin);
    if (!adminAuth.valid) return res.status(401).json({ error: 'Ungültiger Admin-PIN' });

    const pinToStore = pin ? await hashPin(pin) : null;

    const result = await pool.query(`
      INSERT INTO users (name, avatar, color, pin, role, birthdate)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, avatar, photo, color, role, birthdate
    `, [
      name,
      avatar ?? '👤',
      color ?? '#6366f1',
      pinToStore,
      role ?? 'child',
      birthdate ?? null,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id — requires parent auth (JWT or PIN)
usersRouter.delete('/:id', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
