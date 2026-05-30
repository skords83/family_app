import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

export const usersRouter = Router();

// GET /api/users – all users with points + today's task progress
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

// GET /api/users/:id – single user with points + task progress
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

// POST /api/users/:id/photo – upload base64 photo
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

// PUT /api/users/:id – update name / avatar / color / pin
usersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, avatar, color, pin } = req.body as {
      name?: string; avatar?: string; color?: string; pin?: string;
    };

    const result = await pool.query(`
      UPDATE users
      SET
        name   = COALESCE($1, name),
        avatar = COALESCE($2, avatar),
        color  = COALESCE($3, color),
        pin    = COALESCE($4, pin)
      WHERE id = $5
      RETURNING id, name, avatar, photo, color, role
    `, [name, avatar, color, pin, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users – create new user (admin)
usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, avatar, color, pin, role } = req.body as {
      name: string; avatar?: string; color?: string; pin?: string; role?: string;
    };

    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(`
      INSERT INTO users (name, avatar, color, pin, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, avatar, photo, color, role
    `, [
      name,
      avatar ?? '👤',
      color ?? '#6366f1',
      pin ?? null,
      role ?? 'child',
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
usersRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});