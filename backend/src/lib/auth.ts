import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';

export interface AuthResult {
  valid: boolean;
  userId?: string;
}

const BCRYPT_ROUNDS = 12;

function isBcryptHash(value: string): boolean {
  return value.startsWith('$2b$') || value.startsWith('$2a$');
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyParentAuth(pin: string): Promise<AuthResult> {
  if (!pin) return { valid: false };

  const adminPin = process.env.ADMIN_PIN;
  if (adminPin && pin === adminPin) return { valid: true };

  const result = await pool.query<{ id: string; pin: string | null }>(
    `SELECT id, pin FROM users WHERE role = 'parent'`,
  );

  for (const row of result.rows) {
    const stored = row.pin;
    if (!stored) continue;

    let match = false;

    if (isBcryptHash(stored)) {
      match = await bcrypt.compare(pin, stored);
    } else {
      // Plaintext PIN — lazy migration path
      match = pin === stored;
      if (match) {
        const hashed = await hashPin(pin);
        await pool.query(`UPDATE users SET pin = $1 WHERE id = $2`, [hashed, row.id]);
      }
    }

    if (match) return { valid: true, userId: row.id };
  }

  return { valid: false };
}
