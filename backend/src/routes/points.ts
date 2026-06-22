import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { emitSSE } from '../sse';
import { requireParentAuth } from '../middleware/auth';

// Router for /api/points routes
export const pointsRouter = Router();

// Router for routes nested under /api/users/:id
export const userPointsRouter = Router({ mergeParams: true });



// GET /api/users/:id/points - point history for user
// This is mounted on userPointsRouter at '/' and that router at /api/users/:id/points
userPointsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const userResult = await pool.query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(`
      SELECT
        id,
        user_id,
        points,
        reason,
        created_at
      FROM point_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [id]);

    const totalResult = await pool.query(`
      SELECT COALESCE(SUM(points), 0)::integer AS total
      FROM point_events
      WHERE user_id = $1
    `, [id]);

    res.json({
      events: result.rows,
      total: totalResult.rows[0].total,
    });
  } catch (err) {
    console.error('Error fetching point history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/points/manual - manual point adjustment (parent only)
pointsRouter.post('/manual', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { user_id, points, reason } = req.body;

    if (!user_id || points === undefined) {
      return res.status(400).json({ error: 'user_id and points are required' });
    }

    // Verify target user exists
    const userResult = await pool.query(`SELECT id FROM users WHERE id = $1`, [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(`
      INSERT INTO point_events (user_id, points, reason)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [user_id, points, reason ?? 'manual']);

    emitSSE({ type: 'points_updated', data: { user_id } });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating manual point event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});