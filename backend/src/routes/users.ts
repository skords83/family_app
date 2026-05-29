import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

export const usersRouter = Router();

// GET /api/users - return all users with current point balance
usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.avatar,
        u.color,
        u.pin,
        u.role,
        COALESCE(SUM(pe.points), 0)::integer AS points
      FROM users u
      LEFT JOIN point_events pe ON pe.user_id = u.id
      GROUP BY u.id, u.name, u.avatar, u.color, u.pin, u.role
      ORDER BY u.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id - get single user with point balance
usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.avatar,
        u.color,
        u.pin,
        u.role,
        COALESCE(SUM(pe.points), 0)::integer AS points
      FROM users u
      LEFT JOIN point_events pe ON pe.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, u.name, u.avatar, u.color, u.pin, u.role
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
