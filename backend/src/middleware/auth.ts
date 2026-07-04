import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyParentAuth } from '../lib/auth';

declare global {
  namespace Express {
    interface Request {
      parentAuth?: { userId?: string };
    }
  }
}

interface JwtPayload {
  userId?: string;
  role: string;
  kind?: string;
}

interface SiteSessionPayload {
  userId: string;
  kind: 'site_session';
}

export function generateParentToken(userId?: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '4h') as string;
  return jwt.sign({ userId, role: 'parent' }, secret, { expiresIn } as jwt.SignOptions);
}

export function generateSiteSessionToken(userId: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const expiresIn = (process.env.SITE_SESSION_EXPIRES_IN ?? '30d') as string;
  const payload: SiteSessionPayload = { userId, kind: 'site_session' };
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifySiteSessionToken(token: string): { userId: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as SiteSessionPayload;
    if (payload.kind !== 'site_session' || !payload.userId) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// Teilt sich den Rohwert mit generateSiteSessionToken, damit Cookie-maxAge und
// JWT-Ablauf nie auseinanderlaufen können.
export function getSiteSessionMaxAgeMs(): number {
  const raw = process.env.SITE_SESSION_EXPIRES_IN ?? '30d';
  const match = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!match) return 30 * DURATION_UNIT_MS.d;
  return Number(match[1]) * DURATION_UNIT_MS[match[2]];
}

export async function requireParentAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'JWT_SECRET nicht konfiguriert' });
      return;
    }
    try {
      const payload = jwt.verify(authHeader.slice(7), secret) as JwtPayload;
      if (payload.kind === 'site_session') {
        res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
        return;
      }
      req.parentAuth = { userId: payload.userId };
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
      return;
    }
  }

  // Fallback: PIN im Body (rückwärtskompatibel während Frontend-Migration)
  const pin = req.body?.pin as string | undefined;
  if (pin) {
    const result = await verifyParentAuth(pin);
    if (result.valid) {
      req.parentAuth = { userId: result.userId };
      next();
      return;
    }
  }

  res.status(401).json({ error: 'Authentifizierung erforderlich' });
}
