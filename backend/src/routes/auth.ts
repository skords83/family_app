import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { verifyParentAuth } from '../lib/auth';
import { generateParentToken } from '../middleware/auth';
import { emitSSE } from '../sse';

export const authRouter = Router();

/**
 * POST /api/auth/nfc
 * Body: { nfc_uid: string }
 * Returns the user associated with the given NFC UID, or 404 if not found.
 */
authRouter.post('/nfc', async (req: Request, res: Response) => {
  try {
    const { nfc_uid } = req.body as { nfc_uid?: string };

    if (!nfc_uid) {
      return res.status(400).json({ error: 'nfc_uid ist erforderlich' });
    }

    const result = await pool.query(
      `SELECT id, name, avatar, photo, color, role, birthdate
       FROM users
       WHERE nfc_uid = $1
       LIMIT 1`,
      [nfc_uid],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kein Benutzer für diese NFC-UID gefunden' });
    }

    const user = result.rows[0];
    emitSSE({ type: 'nfc_scan', data: { user } });
    res.json({ user });
  } catch (err) {
    console.error('Error in POST /api/auth/nfc:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify-pin
 * Body: { pin: string }
 * Returns { valid: boolean, token?: string, userId?: string }
 */
authRouter.post('/verify-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body as { pin?: string };

    if (!pin) {
      return res.status(400).json({ valid: false, error: 'pin ist erforderlich' });
    }

    const result = await verifyParentAuth(pin);
    if (!result.valid) {
      return res.status(401).json({ valid: false });
    }

    const token = generateParentToken(result.userId);
    res.json({ valid: true, ...(token ? { token } : {}), userId: result.userId ?? null });
  } catch (err) {
    console.error('Error in POST /api/auth/verify-pin:', err);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});
