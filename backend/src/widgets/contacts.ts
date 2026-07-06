import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { getTodayInAppTz } from '../utils/date';
import { dedupeByName, buildBirthdayWindow, type BirthdaySource } from '../lib/birthdays';
import { BirthdaysResponseSchema } from '@family/shared';

export interface ParsedContact {
  uid: string;
  name: string;
  month: number;
  day: number;
  year: number | null;
}

// vCard erlaubt Zeilenumbruch-Fortsetzungen (Zeile beginnt mit Leerzeichen/Tab).
function unfoldVCardLines(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

interface ParsedBday {
  month: number;
  day: number;
  year: number | null;
}

/**
 * Unterstuetzte BDAY-Formate (RFC 6350):
 *   YYYYMMDD     - z.B. 19960415
 *   YYYY-MM-DD   - z.B. 1996-04-15
 *   --MMDD/--MM-DD - Jahr unbekannt, z.B. --0415 / --04-15
 */
function parseVCardBirthday(raw: string): ParsedBday | null {
  const value = raw.trim();

  // Unabhaengige Bereichspruefung je Feld (1-12 / 1-31) — bewusst KEINE
  // Kalender-Validierung (z.B. 30. Februar), das ist ausserhalb des Scopes.
  const inRange = (month: number, day: number): boolean =>
    month >= 1 && month <= 12 && day >= 1 && day <= 31;

  const unknownYearMatch = value.match(/^--(\d{2})-?(\d{2})$/);
  if (unknownYearMatch) {
    const month = Number(unknownYearMatch[1]);
    const day = Number(unknownYearMatch[2]);
    if (!inRange(month, day)) return null;
    return { month, day, year: null };
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!inRange(month, day)) return null;
    return { year: Number(isoMatch[1]), month, day };
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const month = Number(compactMatch[2]);
    const day = Number(compactMatch[3]);
    if (!inRange(month, day)) return null;
    return { year: Number(compactMatch[1]), month, day };
  }

  return null;
}

/** Extrahiert UID/FN/BDAY aus einem einzelnen BEGIN:VCARD...END:VCARD-Block. */
export function parseVCard(vcardText: string): ParsedContact | null {
  const unfolded = unfoldVCardLines(vcardText);

  const uidMatch = unfolded.match(/^UID:(.+)$/mi);
  const fnMatch = unfolded.match(/^FN:(.+)$/mi);
  const bdayMatch = unfolded.match(/^BDAY(?:;[^:]*)?:(.+)$/mi);

  if (!uidMatch || !fnMatch || !bdayMatch) return null;

  const parsedBday = parseVCardBirthday(bdayMatch[1]);
  if (!parsedBday) return null;

  return {
    uid: uidMatch[1].trim(),
    name: fnMatch[1].trim(),
    month: parsedBday.month,
    day: parsedBday.day,
    year: parsedBday.year,
  };
}

// PROPFIND: findet alle Adressbuch-Collections unterhalb der Basis-URL.
async function discoverAddressbooks(baseUrl: string, auth: string): Promise<string[]> {
  const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
  </D:prop>
</D:propfind>`;

  const response = await fetch(baseUrl, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      Depth: '1',
    },
    body: propfindBody,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok && response.status !== 207) {
    throw new Error(`PROPFIND failed with status ${response.status}`);
  }

  const xml = await response.text();
  const addressbooks: string[] = [];
  const basePath = new URL(baseUrl).pathname.replace(/\/?$/, '/');

  const blocks = xml.match(/<D:response[\s\S]*?<\/D:response>/gi) ?? [];

  for (const block of blocks) {
    if (!block.match(/<[^>]*:?resourcetype[^>]*>[\s\S]*?addressbook/i)) continue;

    const hrefMatch = block.match(/<D:href[^>]*>([^<]+)<\/D:href>/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1].trim();
    const hrefPath = href.replace(/\/?$/, '/');
    if (hrefPath === basePath) continue;

    const fullUrl = href.startsWith('http') ? href : `${new URL(baseUrl).origin}${href}`;
    addressbooks.push(fullUrl);
  }

  return addressbooks;
}

// REPORT: liefert rohe vCard-Bloecke aus einem einzelnen Adressbuch.
async function fetchVCards(addressbookUrl: string, auth: string): Promise<string[]> {
  // RFC 6352 verlangt ein <C:filter>-Kindelement in addressbook-query; ohne
  // Filter antworten manche sabre/dav-basierten Server (Nextcloud, Baikal)
  // mit einem leeren Ergebnis statt einem Fehler. UID ist bei jeder vCard
  // Pflichtfeld, ein reiner Existenz-Test matcht also effektiv alle Kontakte.
  const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop>
    <D:getetag/>
    <C:address-data/>
  </D:prop>
  <C:filter test="anyof">
    <C:prop-filter name="UID"/>
  </C:filter>
</C:addressbook-query>`;

  const response = await fetch(addressbookUrl, {
    method: 'REPORT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      Depth: '1',
    },
    body: reportBody,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok && response.status !== 207) {
    throw new Error(`REPORT failed with status ${response.status}`);
  }

  const xml = await response.text();
  const vcards: string[] = [];

  const addressDataMatches = xml.match(/<[^>]*:?address-data[^>]*>([\s\S]*?)<\/[^>]*:?address-data>/gi) ?? [];
  for (const match of addressDataMatches) {
    const inner = match.match(/<[^>]*:?address-data[^>]*>([\s\S]*?)<\/[^>]*:?address-data>/i);
    if (!inner?.[1]) continue;
    const vcardMatches = inner[1].match(/BEGIN:VCARD[\s\S]*?END:VCARD/g);
    if (vcardMatches) vcards.push(...vcardMatches);
  }

  return vcards;
}

/**
 * Adressbuch-URL: CARDDAV_URL falls gesetzt, sonst aus CALDAV_URL abgeleitet
 * (ersetzt "/calendars/" durch "/addressbooks/" - deckt Nextcloud/Baikal ab).
 * Gibt null zurueck, wenn keine Ableitung moeglich ist.
 */
function resolveCarddavUrl(): string | null {
  const explicit = process.env.CARDDAV_URL;
  if (explicit) return explicit;

  const caldavUrl = process.env.CALDAV_URL;
  if (!caldavUrl || !caldavUrl.includes('/calendars/')) return null;
  return caldavUrl.replace('/calendars/', '/addressbooks/');
}

/**
 * Fetcht alle Adressbuecher, parst Kontakte mit BDAY und upserted sie nach
 * `birthdays` (source='carddav'). Kontakte, die im aktuellen Durchlauf nicht
 * mehr vorkommen, werden geloescht — AUSSER der Durchlauf lieferte 0 Kontakte
 * (dann vermutlich ein transienter Fehler; bestehende Zeilen bleiben unangetastet,
 * um nicht bei jedem Netzwerk-Hickser das ganze Adressbuch zu leeren).
 */
export async function fetchAndStoreContactBirthdays(): Promise<void> {
  const carddavUrl = resolveCarddavUrl();
  const caldavUser = process.env.CALDAV_USER;
  const caldavPass = process.env.CALDAV_PASS;

  if (!carddavUrl || !caldavUser || !caldavPass) {
    console.warn('[contacts] CardDAV-Konfiguration unvollständig — Sync übersprungen');
    return;
  }

  const auth = Buffer.from(`${caldavUser}:${caldavPass}`).toString('base64');

  console.log('[contacts] Discovering addressbooks...');
  const addressbooks = await discoverAddressbooks(carddavUrl, auth);
  if (addressbooks.length === 0) {
    console.warn('[contacts] Keine Adressbücher gefunden via PROPFIND');
    return;
  }
  console.log(`[contacts] ${addressbooks.length} Adressbuch/-bücher gefunden`);

  const contacts: ParsedContact[] = [];
  let missingUid = 0;
  let missingFn = 0;
  let noBdayLine = 0;
  let unparsableBday = 0;
  const unparsableSamples: string[] = [];
  for (const addressbookUrl of addressbooks) {
    const vcards = await fetchVCards(addressbookUrl, auth);
    console.log(`[contacts] ${vcards.length} vCard(s) aus ${addressbookUrl}`);
    for (const vcard of vcards) {
      const parsed = parseVCard(vcard);
      if (parsed) {
        contacts.push(parsed);
        continue;
      }
      const unfolded = unfoldVCardLines(vcard);
      if (!/^UID:(.+)$/mi.test(unfolded)) {
        missingUid++;
        continue;
      }
      if (!/^FN:(.+)$/mi.test(unfolded)) {
        missingFn++;
        continue;
      }
      const bdayMatch = unfolded.match(/^BDAY(?:;[^:]*)?:(.+)$/mi);
      if (!bdayMatch) {
        noBdayLine++;
        continue;
      }
      unparsableBday++;
      if (unparsableSamples.length < 5) unparsableSamples.push(JSON.stringify(bdayMatch[0]));
    }
  }

  console.log(`[contacts] ${contacts.length} Kontakte mit Geburtstag gefunden`);
  if (contacts.length === 0 && (missingUid || missingFn || noBdayLine || unparsableBday)) {
    console.log(`[contacts] Debug: ${missingUid} ohne UID, ${missingFn} ohne FN, ${noBdayLine} ohne BDAY-Zeile, ${unparsableBday} mit unparsbarem BDAY-Wert`);
    if (unparsableSamples.length > 0) {
      console.log(`[contacts] Debug BDAY-Rohwerte (Beispiele): ${unparsableSamples.join(' | ')}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const contact of contacts) {
      await client.query(`
        INSERT INTO birthdays (name, birth_month, birth_day, birth_year, source, external_uid, fetched_at)
        VALUES ($1, $2, $3, $4, 'carddav', $5, NOW())
        ON CONFLICT (source, external_uid) WHERE external_uid IS NOT NULL DO UPDATE SET
          name        = EXCLUDED.name,
          birth_month = EXCLUDED.birth_month,
          birth_day   = EXCLUDED.birth_day,
          birth_year  = EXCLUDED.birth_year,
          fetched_at  = NOW()
      `, [contact.name, contact.month, contact.day, contact.year, contact.uid]);
    }

    if (contacts.length > 0) {
      const seenUids = contacts.map(c => c.uid);
      await client.query(`
        DELETE FROM birthdays
        WHERE source = 'carddav' AND NOT (external_uid = ANY($1::text[]))
      `, [seenUids]);
    } else {
      console.warn('[contacts] Keine Kontakte gefunden — bestehende carddav-Einträge bleiben unangetastet');
    }

    await client.query('COMMIT');
    console.log(`[contacts] Sync abgeschlossen. ${contacts.length} Kontakte gespeichert.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* noop */ });
    console.error('[contacts] Sync fehlgeschlagen:', err);
    throw err;
  } finally {
    client.release();
  }
}

export const birthdaysWidgetRouter = Router();

/**
 * GET /api/widgets/birthdays
 *
 * Kombiniert Familienmitglieder (users.birthdate) mit externen Kontakten
 * (birthdays-Tabelle, source='carddav' oder 'manual', active=true).
 * Fenster: heute bis einschließlich +7 Tage.
 */
birthdaysWidgetRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const today = getTodayInAppTz();

    const usersResult = await pool.query<{ name: string; month: number; day: number; year: number | null }>(`
      SELECT
        name,
        EXTRACT(MONTH FROM birthdate)::int AS month,
        EXTRACT(DAY FROM birthdate)::int AS day,
        EXTRACT(YEAR FROM birthdate)::int AS year
      FROM users
      WHERE birthdate IS NOT NULL
    `);

    const contactsResult = await pool.query<{ name: string; month: number; day: number; year: number | null }>(`
      SELECT name, birth_month AS month, birth_day AS day, birth_year AS year
      FROM birthdays
      WHERE active = true
    `);

    const userEntries: BirthdaySource[] = usersResult.rows;
    const contactEntries: BirthdaySource[] = contactsResult.rows;
    const combined = dedupeByName(userEntries, contactEntries);
    const window = buildBirthdayWindow(combined, today);

    res.json(BirthdaysResponseSchema.parse({
      ...window,
      fetched_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[birthdays] Fehler in /:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
