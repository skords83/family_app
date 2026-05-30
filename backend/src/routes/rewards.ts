import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

export const rewardsRouter = Router();

async function verifyParentPin(pin: string): Promise<boolean> {
  const adminPin = process.env.ADMIN_PIN;
  if (adminPin) {
    return pin === adminPin;
  }
  // Fallback: check against any parent user's pin in DB
  const result = await pool.query(
    `SELECT id FROM users WHERE role = 'parent' AND pin = $1`,
    [pin]
  );
  return result.rows.length > 0;
}

// GET /api/rewards - all active rewards with available_to filter
rewardsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, admin } = req.query;

    let query = `
      SELECT
        r.*,
        COALESCE(
          (SELECT array_agg(u.name ORDER BY u.name)
           FROM users u
           WHERE u.id = ANY(r.available_to)),
          ARRAY[]::text[]
        ) AS available_to_names
      FROM rewards r
      WHERE ${admin === 'true' ? 'true' : 'r.active = true'}
    `;
    const params: string[] = [];

    if (user_id) {
      query += ` AND (r.available_to IS NULL OR r.available_to = '{}' OR $1 = ANY(r.available_to))`;
      params.push(user_id as string);
    }

    query += ` ORDER BY r.points_cost ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rewards:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rewards/claims - get all pending claims (admin)
rewardsRouter.get('/claims', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        rc.id,
        rc.reward_id,
        rc.user_id,
        rc.claimed_at,
        rc.approved_at,
        r.title AS reward_title,
        r.points_cost,
        u.name AS user_name,
        u.avatar AS user_avatar,
        u.color AS user_color
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      JOIN users u ON rc.user_id = u.id
      ORDER BY rc.claimed_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching claims:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rewards - create reward (admin)
rewardsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, points_cost, available_to, active, pin } = req.body;

    if (!title || points_cost === undefined || !pin) {
      return res.status(400).json({ error: 'title, points_cost, and pin are required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    // Normalize: null/undefined → null, [] → null, array → UUID[]
    const availableToValue = Array.isArray(available_to) && available_to.length > 0
      ? available_to
      : null;

    const result = await pool.query(`
      INSERT INTO rewards (title, points_cost, available_to, active)
      VALUES ($1, $2, $3::uuid[], $4)
      RETURNING *
    `, [title, points_cost, availableToValue, active ?? true]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/rewards/:id - update reward (admin)
rewardsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, points_cost, available_to, active, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    const existing = await pool.query(`SELECT * FROM rewards WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    const current = existing.rows[0];

    // Normalize available_to the same way as POST
    let availableToValue = current.available_to;
    if (available_to !== undefined) {
      availableToValue = Array.isArray(available_to) && available_to.length > 0
        ? available_to
        : null;
    }

    const result = await pool.query(`
      UPDATE rewards
      SET
        title = $1,
        points_cost = $2,
        available_to = $3::uuid[],
        active = $4
      WHERE id = $5
      RETURNING *
    `, [
      title ?? current.title,
      points_cost ?? current.points_cost,
      availableToValue,
      active !== undefined ? active : current.active,
      id,
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rewards/:id - delete reward (admin)
rewardsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    await pool.query(`DELETE FROM rewards WHERE id = $1`, [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Error deleting reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rewards/:id/claim - claim a reward
rewardsRouter.post('/:id/claim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Get the reward
    const rewardResult = await pool.query(`SELECT * FROM rewards WHERE id = $1 AND active = true`, [id]);
    if (rewardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found or inactive' });
    }

    const reward = rewardResult.rows[0];

    // Check if reward is available to this user (null = everyone, array = specific users)
    const availableTo: string[] | null = reward.available_to;
    if (availableTo && availableTo.length > 0 && !availableTo.includes(user_id)) {
      return res.status(403).json({ error: 'Reward not available to this user' });
    }

    // Get user's current point balance
    const balanceResult = await pool.query(`
      SELECT COALESCE(SUM(points), 0)::integer AS balance
      FROM point_events
      WHERE user_id = $1
    `, [user_id]);

    const balance = balanceResult.rows[0].balance;

    if (balance < reward.points_cost) {
      return res.status(400).json({
        error: 'Insufficient points',
        balance,
        required: reward.points_cost,
      });
    }

    // Insert claim and deduct points
    const claimResult = await pool.query(`
      INSERT INTO reward_claims (reward_id, user_id)
      VALUES ($1, $2)
      RETURNING *
    `, [id, user_id]);

    // Deduct points
    await pool.query(`
      INSERT INTO point_events (user_id, points, reason)
      VALUES ($1, $2, $3)
    `, [user_id, -reward.points_cost, `reward:${claimResult.rows[0].id}`]);

    res.status(201).json({
      ...claimResult.rows[0],
      reward_title: reward.title,
      points_spent: reward.points_cost,
    });
  } catch (err) {
    console.error('Error claiming reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rewards/:id/approve - approve a reward claim (parent only)
rewardsRouter.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    // id here is the claim id
    const result = await pool.query(`
      UPDATE reward_claims
      SET approved_at = NOW()
      WHERE id = $1 AND approved_at IS NULL
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found or already approved' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error approving reward claim:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});