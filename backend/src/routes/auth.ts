import { timingSafeEqual } from 'crypto';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { parse as parseCookie } from 'cookie';
import { pool } from '../db/pool';
import { verifyParentAuth } from '../lib/auth';
import { createTicket, peekPending, tryClaim } from '../lib/nfcLoginTickets';
import {
  generateParentToken,
  generateSiteSessionToken,
  verifySiteSessionToken,
  getSiteSessionMaxAgeMs,
} from '../middleware/auth';
import { emitSSE } from '../sse';

export const authRouter = Router();

const SESSION_COOKIE_NAME = 'family_session';

const USER_COLUMNS = 'id, name, avatar, photo, color, role, birthdate';

const authRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Die Login-Seite pollt alle 1,5s (siehe frontend POLL_INTERVAL_MS) - das sind
// bereits 40 Requests/Minute ohne jede sensible Wirkung, deshalb eigener,
// grosszuegiger Limiter statt des strengen authRateLimiter.
const pollRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function isValidDeviceKey(provided: string | undefined): boolean {
  const expected = process.env.ESP32_DEVICE_KEY;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function setSessionCookie(res: Response, userId: string): void {
  const token = generateSiteSessionToken(userId);
  if (!token) return;
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: getSiteSessionMaxAgeMs(),
    path: '/',
  });
}

/**
 * POST /api/auth/nfc
 * Body: { nfc_uid: string }
 * Returns the user associated with the given NFC UID, or 404 if not found.
 * In-App-Unlock-Geste (z.B. /user/[id]) — KEIN Login, bleibt unverändert.
 */
authRouter.post('/nfc', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { nfc_uid } = req.body as { nfc_uid?: string };

    if (!nfc_uid) {
      return res.status(400).json({ error: 'nfc_uid ist erforderlich' });
    }

    const result = await pool.query(
      `SELECT ${USER_COLUMNS}
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
 * POST /api/auth/nfc-login
 * Body: { nfc_uid: string }
 * Header: X-Device-Key
 * ESP32-Ziel für den Site-Login: identifiziert den Tag wie /nfc (inkl. SSE-Broadcast
 * für die bestehende In-App-Unlock-Geste), legt zusätzlich ein kurzlebiges Login-Ticket
 * an, falls der Tag einem Elternteil gehört.
 */
authRouter.post('/nfc-login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const deviceKeyHeader = req.headers['x-device-key'];
    const deviceKey = typeof deviceKeyHeader === 'string' ? deviceKeyHeader : undefined;
    if (!isValidDeviceKey(deviceKey)) {
      return res.status(401).json({ error: 'Ungültiger Device-Key' });
    }

    const { nfc_uid } = req.body as { nfc_uid?: string };
    if (!nfc_uid) {
      return res.status(400).json({ error: 'nfc_uid ist erforderlich' });
    }

    const result = await pool.query(
      `SELECT ${USER_COLUMNS}
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

    if (user.role === 'parent' || user.role === 'admin') {
      createTicket(user.id);
    }

    res.json({ user });
  } catch (err) {
    console.error('Error in POST /api/auth/nfc-login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/nfc-login/poll
 * Von der /login-Seite gepollt, um auf ein per NFC ausgelöstes Login-Ticket zu warten.
 */
authRouter.get('/nfc-login/poll', pollRateLimiter, (_req: Request, res: Response) => {
  res.json({ pending: peekPending() });
});

/**
 * POST /api/auth/nfc-login/claim
 * Konsumiert das ausstehende Login-Ticket (einmalig, atomar) und setzt bei Erfolg
 * das Session-Cookie auf DIESE Antwort — die tatsächlich vom Browser kommt.
 */
authRouter.post('/nfc-login/claim', authRateLimiter, async (_req: Request, res: Response) => {
  try {
    const claimed = tryClaim();
    if (!claimed) {
      return res.status(410).json({ error: 'Kein gültiges Login-Ticket vorhanden' });
    }

    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
      [claimed.userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = result.rows[0];
    setSessionCookie(res, user.id);
    res.json({ user });
  } catch (err) {
    console.error('Error in POST /api/auth/nfc-login/claim:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { pin: string }
 * Klassischer PIN-Fallback-Login für Fremdgeräte. Nutzt verifyParentAuth wie das
 * bestehende /verify-pin, akzeptiert aber NUR Treffer mit konkretem userId —
 * ein reiner ADMIN_PIN-Match (ohne Nutzerbindung) erzeugt bewusst keine Session.
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin) {
      return res.status(400).json({ error: 'pin ist erforderlich' });
    }

    const result = await verifyParentAuth(pin);
    if (!result.valid || !result.userId) {
      return res.status(401).json({ error: 'Ungültige PIN' });
    }

    const userResult = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
      [result.userId],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];
    setSessionCookie(res, user.id);
    res.json({ user });
  } catch (err) {
    console.error('Error in POST /api/auth/login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.status(204).end();
});

const PUBLIC_PATH_PREFIXES = [
  '/api/auth/',
  '/login',
  '/_next/',
  '/manifest.json',
  '/sw.js',
  '/workbox-',
  '/icon-',
  '/favicon.ico',
];

function isPublicPath(forwardedUri: string): boolean {
  const path = forwardedUri.split('?')[0];
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * GET /api/auth/verify
 * Traefik-ForwardAuth-Ziel. Wird von Traefik direkt (Container-zu-Container) aufgerufen,
 * NICHT über den family-backend-Router selbst — keine Rekursionsgefahr.
 */
authRouter.get('/verify', (req: Request, res: Response) => {
  const forwardedUriHeader = req.headers['x-forwarded-uri'];
  const forwardedUri = typeof forwardedUriHeader === 'string' ? forwardedUriHeader : '';

  if (isPublicPath(forwardedUri)) {
    return res.status(200).end();
  }

  const cookies = parseCookie(req.headers.cookie ?? '');
  const token = cookies[SESSION_COOKIE_NAME];
  const session = token ? verifySiteSessionToken(token) : null;

  if (session) {
    return res.status(200).end();
  }

  if (forwardedUri.startsWith('/api')) {
    return res.status(401).json({ error: 'Authentifizierung erforderlich' });
  }

  // Absolute URL statt relativem Pfad: Traefiks ForwardAuth ruft diesen Endpunkt
  // Container-intern auf (http://backend:3001/...), und Go's http.Client löst einen
  // relativen Location-Header beim Weiterreichen gegen genau diese interne Request-URL
  // auf (-> "http://backend:3001/login" statt "/login" beim Client). Deshalb hier
  // explizit den öffentlichen Host aus den von Traefik gesetzten X-Forwarded-*-Headern
  // zusammensetzen.
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0] : 'https';
  const host = typeof forwardedHost === 'string' ? forwardedHost.split(',')[0] : req.headers.host;

  res.redirect(302, `${proto}://${host}/login`);
});

/**
 * POST /api/auth/verify-pin
 * Body: { pin: string }
 * Returns { valid: boolean, token?: string, userId?: string }
 */
authRouter.post('/verify-pin', authRateLimiter, async (req: Request, res: Response) => {
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
