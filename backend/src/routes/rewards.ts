import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { emitSSE } from '../sse';
import { ageFactorFromBirthdate, effectiveRewardCost } from '../lib/age-factor';

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

/** Look up a user's birthdate (or null). Returns null if user not found. */
async function getUserBirthdate(userId: string): Promise<Date | null> {
  const r = await pool.query<{ birthdate: Date | null }>(
    `SELECT birthdate FROM users WHERE id = $1`,
    [userId]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0].birthdate;
}

// GET /api/rewards - all active rewards with available_to filter.
// When `user_id` is provided, each reward is annotated with `effective_cost`
// and `age_factor` computed from that user's birthdate.
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

    // Annotate with effective_cost based on user's age (1.0× if no user_id given)
    let factor = 1.0;
    if (user_id) {
      const birthdate = await getUserBirthdate(user_id as string);
      factor = ageFactorFromBirthdate(birthdate);
    }

    const rows = result.rows.map((r) => ({
      ...r,
      effective_cost: effectiveRewardCost(r.points_cost, factor),
      age_factor: Number(factor.toFixed(2)),
    }));

    res.json(rows);
  } catch (err) {
    console.error('Error fetching rewards:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rewards/claims - get claims (admin: all; user: filtered by user_id)
// `points_cost` reflects the actual amount spent (falls back to reward base for legacy claims).
rewardsRouter.get('/claims', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    let query = `
      SELECT
        rc.id,
        rc.reward_id,
        rc.user_id,
        rc.claimed_at,
        rc.approved_at,
        rc.rejected_at,
        rc.reject_reason,
        rc.points_spent,
        r.title AS reward_title,
        COALESCE(rc.points_spent, r.points_cost) AS points_cost,
        r.points_cost AS base_cost,
        u.name AS user_name,
        u.avatar AS user_avatar,
        u.photo AS user_photo,
        u.color AS user_color
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      JOIN users u ON rc.user_id = u.id
    `;
    const params: string[] = [];

    if (user_id) {
      query += ` WHERE rc.user_id = $1`;
      params.push(user_id as string);
    }

    query += ` ORDER BY rc.claimed_at DESC`;

    const result = await pool.query(query, params);
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
      ? `{${available_to.join(',')}}`
      : null;

    const result = await pool.query(`
      INSERT INTO rewards (title, points_cost, available_to, active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, points_cost, availableToValue, active !== false]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rewards/:id/claim - claim a reward (user)
// NOTE: :id here is the reward id. Charges effective_cost = points_cost × age_factor.
rewardsRouter.post('/:id/claim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Get reward
    const rewardResult = await pool.query(`
      SELECT * FROM rewards WHERE id = $1 AND active = true
    `, [id]);

    if (rewardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found or inactive' });
    }

    const reward = rewardResult.rows[0];

    // Check if reward is available to this user (null = everyone, array = specific users)
    const availableTo: string[] | null = reward.available_to;
    if (availableTo && availableTo.length > 0 && !availableTo.includes(user_id)) {
      return res.status(403).json({ error: 'Reward not available to this user' });
    }

    // Compute effective cost from user's age
    const birthdate = await getUserBirthdate(user_id);
    const factor = ageFactorFromBirthdate(birthdate);
    const cost = effectiveRewardCost(reward.points_cost, factor);

    // Get user's current point balance
    const balanceResult = await pool.query(`
      SELECT COALESCE(SUM(points), 0)::integer AS balance
      FROM point_events
      WHERE user_id = $1
    `, [user_id]);

    const balance = balanceResult.rows[0].balance;

    if (balance < cost) {
      return res.status(400).json({
        error: 'Insufficient points',
        balance,
        required: cost,
      });
    }

    // Insert claim with the actual amount spent
    const claimResult = await pool.query(`
      INSERT INTO reward_claims (reward_id, user_id, points_spent)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, user_id, cost]);

    // Deduct points immediately
    await pool.query(`
      INSERT INTO point_events (user_id, points, reason)
      VALUES ($1, $2, $3)
    `, [user_id, -cost, `reward:${claimResult.rows[0].id}`]);

    emitSSE({ type: 'reward_claimed', data: { reward_id: id, user_id } });
    emitSSE({ type: 'points_updated', data: { user_id } });
    res.status(201).json({
      ...claimResult.rows[0],
      reward_title: reward.title,
      points_spent: cost,
      base_cost: reward.points_cost,
      age_factor: Number(factor.toFixed(2)),
    });
  } catch (err) {
    console.error('Error claiming reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rewards/:id/approve - approve a reward claim (parent only)
// NOTE: :id here is the claim id
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

    const result = await pool.query(`
      UPDATE reward_claims
      SET approved_at = NOW()
      WHERE id = $1 AND approved_at IS NULL AND rejected_at IS NULL
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found or already processed' });
    }

    const claim = result.rows[0];
    emitSSE({ type: 'reward_claimed', data: { claim_id: id, user_id: claim.user_id } });
    res.json(claim);
  } catch (err) {
    console.error('Error approving reward claim:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rewards/:id/reject - reject a reward claim + refund points (parent only)
// NOTE: :id here is the claim id. Refunds the actual amount spent (points_spent),
// falling back to the reward's base points_cost for legacy claims (pre-age-factor).
rewardsRouter.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin, reason } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    // Fetch the claim — refund uses points_spent if present, else falls back to base cost
    const claimResult = await pool.query(`
      SELECT
        rc.*,
        r.title AS reward_title,
        COALESCE(rc.points_spent, r.points_cost)::integer AS refund_amount
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      WHERE rc.id = $1 AND rc.approved_at IS NULL AND rc.rejected_at IS NULL
    `, [id]);

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found or already processed' });
    }

    const claim = claimResult.rows[0];
    const refundAmount: number = claim.refund_amount;

    // Mark as rejected
    await pool.query(`
      UPDATE reward_claims
      SET rejected_at = NOW(), reject_reason = $1
      WHERE id = $2
    `, [reason ?? null, id]);

    // Refund points
    await pool.query(`
      INSERT INTO point_events (user_id, points, reason)
      VALUES ($1, $2, $3)
    `, [claim.user_id, refundAmount, `reward_rejected:${id}`]);

    emitSSE({ type: 'reward_claimed', data: { claim_id: id, user_id: claim.user_id } });
    emitSSE({ type: 'points_updated', data: { user_id: claim.user_id } });

    res.json({ success: true, refunded: refundAmount });
  } catch (err) {
    console.error('Error rejecting reward claim:', err);
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

    const availableToValue = available_to === null || available_to === undefined
      ? null
      : Array.isArray(available_to) && available_to.length > 0
        ? `{${available_to.join(',')}}`
        : null;

    const result = await pool.query(`
      UPDATE rewards
      SET
        title       = $1,
        points_cost = $2,
        available_to = $3,
        active      = $4
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

    const existing = await pool.query(`SELECT id FROM rewards WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    await pool.query(`DELETE FROM rewards WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting reward:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
