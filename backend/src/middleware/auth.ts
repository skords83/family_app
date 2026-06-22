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
}

export function generateParentToken(userId?: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET nicht konfiguriert');
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '4h') as string;
  return jwt.sign({ userId, role: 'parent' }, secret, { expiresIn } as jwt.SignOptions);
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
