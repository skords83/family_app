# Geburtstags-Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Geburtstags-Widget auf dem Haupt-Dashboard zeigen, das Familienmitglieder-Geburtstage (aus `users.birthdate`) und externe Kontakte (aus einem CardDAV-Adressbuch-Sync) für die nächsten 7 Tage anzeigt.

**Architecture:** Neue `birthdays`-Tabelle für Nicht-User-Personen (Familie kommt direkt aus `users.birthdate`, keine Doppelpflege). Ein täglicher CardDAV-Sync-Job (analog zum bestehenden CalDAV-Kalender-Sync) füllt `birthdays` aus einem Adressbuch. Eine öffentliche Route kombiniert beide Quellen für das Widget; eine PIN-geschützte Admin-Route erlaubt manuelle Einträge und das Ausblenden einzelner synchronisierter Kontakte.

**Tech Stack:** Express + `pg` (Backend), Next.js/React (Frontend), Zod (`@family/shared`), `node-cron`, natives `fetch` für CardDAV (kein neues npm-Paket).

## Global Constraints

- Diese Codebase hat **kein Test-Framework** (kein jest/vitest, keine `.test.ts`-Dateien irgendwo im Repo). Verifikation läuft über `tsc --noEmit`/`npm run build`, `curl` gegen den laufenden Dev-Server und `psql`-Checks — nicht über automatisierte Unit-Tests. Führe keine neue Testinfrastruktur ein, das wäre eine unrelated Scope-Erweiterung.
- Deutsche UI-Texte und Fehlermeldungen (bestehende Konvention in allen Routen).
- Frontend importiert **nie** aus `@family/shared` — Typen werden lokal pro Datei als einfache TS-Interfaces dupliziert (siehe `WasteWidget.tsx`, `page.tsx`). Neue Frontend-Dateien folgen demselben Muster.
- `shared/` wird nach jeder Änderung an `shared/types/index.ts` neu gebaut (`npm run build --workspace=shared`), da `@family/shared` über `dist/index.js` aufgelöst wird (siehe `shared/package.json`), nicht über die TS-Quellen.
- Alle DB-Änderungen gehören in den einen `schema`-Template-String in `backend/src/db/schema.ts` (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`) — es gibt keine separaten Migrationsdateien in diesem Projekt.
- Spec: `docs/superpowers/specs/2026-07-05-birthday-widget-design.md` — bei Widerspruch zwischen Plan und Spec gilt die Spec als Quelle der Wahrheit; dieser Plan setzt sie 1:1 um (die "Gratulieren"-Task aus dem Nicht-Ziele-Abschnitt der Spec ist bewusst **nicht** Teil dieses Plans).

---

### Task 1: Datenbank-Schema — `birthdays`-Tabelle

**Files:**
- Modify: `backend/src/db/schema.ts` (Ende der Datei, vor dem schließenden Backtick des `schema`-Strings, Zeile ~344)

**Interfaces:**
- Produces: Tabelle `birthdays(id, name, birth_month, birth_day, birth_year, source, external_uid, active, fetched_at)` mit `UNIQUE INDEX birthdays_source_uid_uq ON (source, external_uid) WHERE external_uid IS NOT NULL` — wird von allen folgenden Tasks per SQL angesprochen.

- [ ] **Step 1: SQL-Block an `schema.ts` anhängen**

Öffne `backend/src/db/schema.ts`. Füge unmittelbar vor dem schließenden `` `; `` am Dateiende (nach dem letzten `END $$;`) folgenden Block ein:

```sql
-- Geburtstage von Personen ohne User-Account (CardDAV-Sync + manuelle Eintraege).
-- Familienmitglieder-Geburtstage kommen direkt aus users.birthdate, keine Duplizierung hier.
CREATE TABLE IF NOT EXISTS birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_month SMALLINT NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_day SMALLINT NOT NULL CHECK (birth_day BETWEEN 1 AND 31),
  birth_year SMALLINT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'carddav')),
  external_uid TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  fetched_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS birthdays_source_uid_uq
  ON birthdays (source, external_uid) WHERE external_uid IS NOT NULL;
```

- [ ] **Step 2: Migration laufen lassen**

Run: `cd backend && npm run migrate`
Expected: `Migrations completed successfully.` ohne Fehler.

- [ ] **Step 3: Tabelle verifizieren**

Run: `docker compose exec postgres psql -U family -d family_organizer -c "\d birthdays"`
Expected: Tabellendefinition mit allen Spalten (`id`, `name`, `birth_month`, `birth_day`, `birth_year`, `source`, `external_uid`, `active`, `fetched_at`) und dem Index `birthdays_source_uid_uq`.

(Falls der Postgres-Container nicht über `docker compose` läuft, ersetze den Befehl durch die lokale `psql`-Verbindung aus `DATABASE_URL` in `backend/.env`.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat: birthdays-Tabelle für Geburtstags-Widget hinzufügen"
```

---

### Task 2: Shared Zod-Schemas

**Files:**
- Modify: `shared/types/index.ts` (Ende der Datei, nach dem Waste-Abschnitt, Zeile ~137)

**Interfaces:**
- Produces: `BirthdaysResponseSchema` (Typ `BirthdaysResponse`), `BirthdayAdminEntrySchema` (Typ `BirthdayAdminEntry`) — exportiert über `@family/shared`, genutzt von Backend-Routen in Task 4/5.

- [ ] **Step 1: Schemas anhängen**

Füge am Ende von `shared/types/index.ts` an:

```ts
// --- Geburtstage ------------------------------------

export const BirthdayTodaySchema = z.object({
  name: z.string(),
  age: z.number().int().nullable(),
});
export type BirthdayToday = z.infer<typeof BirthdayTodaySchema>;

export const BirthdayUpcomingSchema = z.object({
  name: z.string(),
  age: z.number().int().nullable(),
  daysUntil: z.number().int(),
});
export type BirthdayUpcoming = z.infer<typeof BirthdayUpcomingSchema>;

export const BirthdaysResponseSchema = z.object({
  today: BirthdayTodaySchema.nullable(),
  upcoming: z.array(BirthdayUpcomingSchema),
  fetched_at: z.string().datetime(),
});
export type BirthdaysResponse = z.infer<typeof BirthdaysResponseSchema>;

export const BirthdayAdminEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birth_month: z.number().int().min(1).max(12),
  birth_day: z.number().int().min(1).max(31),
  birth_year: z.number().int().nullable(),
  source: z.enum(['manual', 'carddav']),
  active: z.boolean(),
});
export type BirthdayAdminEntry = z.infer<typeof BirthdayAdminEntrySchema>;
```

- [ ] **Step 2: Shared-Package bauen**

Run: `cd shared && npm run build`
Expected: Kein Fehler, `shared/dist/index.js` und `shared/dist/index.d.ts` werden aktualisiert (Zeitstempel prüfen: `ls -la dist/index.d.ts`).

- [ ] **Step 3: Typecheck des Backends gegen die neuen Typen**

Run: `cd backend && npx tsc --noEmit`
Expected: Keine Fehler (die neuen Typen werden noch nirgends importiert, das ist nur eine Kontrolle, dass `shared/dist` konsistent ist).

- [ ] **Step 4: Commit**

```bash
git add shared/types/index.ts shared/dist
git commit -m "feat: Zod-Schemas für Geburtstags-Widget zu @family/shared hinzufügen"
```

---

### Task 3: Reine Datumslogik (`lib/birthdays.ts`)

**Files:**
- Create: `backend/src/lib/birthdays.ts`

**Interfaces:**
- Consumes: nichts (reine Funktionen, keine DB-Zugriffe) — Vorbild: `backend/src/lib/age-factor.ts`.
- Produces: `nextOccurrence(month, day, todayStr)`, `dedupeByName(userEntries, contactEntries)`, `buildBirthdayWindow(entries, todayStr)` — genutzt von der Widget-Route in Task 4.

- [ ] **Step 1: Datei schreiben**

```ts
/**
 * Reine Datumslogik für das Geburtstags-Widget — keine DB-Zugriffe.
 *
 * "Nächstes Vorkommen" von Monat/Tag ab heute: fällt der 29. Februar in ein
 * Nicht-Schaltjahr, weicht die Berechnung auf den 28. Februar aus.
 */

export interface BirthdaySource {
  name: string;
  month: number; // 1–12
  day: number;   // 1–31
  year: number | null;
}

export interface BirthdayWindowEntry {
  name: string;
  age: number | null;
  daysUntil: number;
}

export interface BirthdayWindow {
  today: { name: string; age: number | null } | null;
  upcoming: BirthdayWindowEntry[];
}

const WINDOW_DAYS = 7;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function safeDayForYear(month: number, day: number, year: number): number {
  if (month === 2 && day === 29 && !isLeapYear(year)) return 28;
  return day;
}

export interface NextOccurrence {
  year: number;
  daysUntil: number;
}

/** Nächstes Vorkommen von Monat/Tag ab (inklusive) `todayStr` (YYYY-MM-DD). */
export function nextOccurrence(month: number, day: number, todayStr: string): NextOccurrence {
  const today = new Date(todayStr + 'T12:00:00Z');
  const todayYear = today.getUTCFullYear();

  let year = todayYear;
  let candidate = new Date(Date.UTC(year, month - 1, safeDayForYear(month, day, year), 12));
  if (candidate.getTime() < today.getTime()) {
    year = todayYear + 1;
    candidate = new Date(Date.UTC(year, month - 1, safeDayForYear(month, day, year), 12));
  }

  const daysUntil = Math.round((candidate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return { year, daysUntil };
}

/**
 * Dedupliziert nach Name (case-insensitive, getrimmt). Bei einer Kollision
 * gewinnt der User-Eintrag — verhindert Doppelanzeige, falls die eigene
 * Familie zusätzlich im synchronisierten Adressbuch steht.
 */
export function dedupeByName(
  userEntries: BirthdaySource[],
  contactEntries: BirthdaySource[],
): BirthdaySource[] {
  const userNames = new Set(userEntries.map(e => e.name.trim().toLowerCase()));
  const filteredContacts = contactEntries.filter(e => !userNames.has(e.name.trim().toLowerCase()));
  return [...userEntries, ...filteredContacts];
}

/**
 * Baut die Widget-Antwort aus einer bereits deduplizierten Liste.
 * `today` = daysUntil 0, `upcoming` = daysUntil 1..WINDOW_DAYS, aufsteigend sortiert.
 */
export function buildBirthdayWindow(entries: BirthdaySource[], todayStr: string): BirthdayWindow {
  const withOccurrence = entries
    .map(e => {
      const occ = nextOccurrence(e.month, e.day, todayStr);
      const age = e.year != null ? occ.year - e.year : null;
      return { name: e.name, age, daysUntil: occ.daysUntil };
    })
    .filter(e => e.daysUntil <= WINDOW_DAYS);

  withOccurrence.sort((a, b) => a.daysUntil - b.daysUntil);

  const todayEntry = withOccurrence.find(e => e.daysUntil === 0);
  const upcoming = withOccurrence.filter(e => e.daysUntil > 0);

  return {
    today: todayEntry ? { name: todayEntry.name, age: todayEntry.age } : null,
    upcoming,
  };
}
```

- [ ] **Step 2: Manuell verifizieren (kein Test-Framework vorhanden)**

Erstelle eine Wegwerf-Datei `/tmp/verify-birthdays.ts`:

```ts
import { nextOccurrence, buildBirthdayWindow, dedupeByName } from '../home/skords/Dokumente/Projekte/family_app/backend/src/lib/birthdays';

// Heute = 2026-07-05 (fix für den Test)
console.log('today exact match:', nextOccurrence(7, 5, '2026-07-05')); // { year: 2026, daysUntil: 0 }
console.log('in 3 days:', nextOccurrence(7, 8, '2026-07-05')); // { year: 2026, daysUntil: 3 }
console.log('wrapped to next year:', nextOccurrence(1, 1, '2026-07-05')); // { year: 2027, daysUntil: ~180 }
console.log('feb 29 in non-leap year:', nextOccurrence(2, 29, '2027-02-01')); // faellt auf 28. Feb 2027

const window = buildBirthdayWindow(
  [
    { name: 'Johanna', month: 7, day: 5, year: 2017 },
    { name: 'Papa', month: 7, day: 9, year: 1984 },
    { name: 'Weihnachtsmann', month: 12, day: 24, year: null },
  ],
  '2026-07-05',
);
console.log('window:', JSON.stringify(window, null, 2));
// erwartet: today = { name: 'Johanna', age: 9 }, upcoming = [{ name: 'Papa', age: 42, daysUntil: 4 }]

console.log('dedupe:', dedupeByName(
  [{ name: 'Papa', month: 7, day: 9, year: 1984 }],
  [{ name: ' papa ', month: 7, day: 9, year: null }, { name: 'Oma', month: 3, day: 1, year: null }],
));
// erwartet: nur 2 Eintraege (Papa vom User, Oma vom Kontakt) — der doppelte "papa"-Kontakt wird rausgefiltert
```

Run: `cd backend && npx ts-node /tmp/verify-birthdays.ts`
Expected: Die vier `console.log`-Ausgaben entsprechen exakt den Kommentaren (insbesondere `today.age === 9`, `upcoming[0].age === 42`, Feb-29-Fallback auf 28, und die Dedupe-Liste enthält "Papa" nur einmal). Lösche `/tmp/verify-birthdays.ts` danach wieder.

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/birthdays.ts
git commit -m "feat: reine Datumslogik für Geburtstags-Fenster (nextOccurrence, buildBirthdayWindow, dedupeByName)"
```

---

### Task 4: Öffentliche Widget-Route `GET /api/widgets/birthdays`

**Files:**
- Create: `backend/src/widgets/contacts.ts`
- Modify: `backend/src/index.ts` (Router-Registrierung)

**Interfaces:**
- Consumes: `dedupeByName`, `buildBirthdayWindow` aus `../lib/birthdays` (Task 3); `BirthdaysResponseSchema` aus `@family/shared` (Task 2); `getTodayInAppTz` aus `../utils/date`.
- Produces: `export const birthdaysWidgetRouter` (Router), gemountet unter `/api/widgets/birthdays`. Wird in Task 7 um den CardDAV-Sync in derselben Datei ergänzt.

- [ ] **Step 1: Datei anlegen mit Router**

```ts
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { getTodayInAppTz } from '../utils/date';
import { dedupeByName, buildBirthdayWindow, type BirthdaySource } from '../lib/birthdays';
import { BirthdaysResponseSchema } from '@family/shared';

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
```

- [ ] **Step 2: Route in `index.ts` registrieren**

In `backend/src/index.ts`, ergänze den Import bei den anderen Widget-Imports (nach `import { wasteRouter, ... } from './widgets/waste';`):

```ts
import { birthdaysWidgetRouter } from './widgets/contacts';
```

Und die Registrierung bei den anderen `app.use('/api/widgets/...)`-Zeilen (nach `app.use('/api/widgets/waste', wasteRouter);`):

```ts
app.use('/api/widgets/birthdays', birthdaysWidgetRouter);
```

- [ ] **Step 3: Backend starten und Route manuell verifizieren**

Run: `cd backend && npm run dev` (im Hintergrund laufen lassen)

Lege testweise einen Eintrag ohne Wartezeit auf den echten CardDAV-Sync an:

Run: `docker compose exec postgres psql -U family -d family_organizer -c "INSERT INTO birthdays (name, birth_month, birth_day, birth_year, source, active) VALUES ('Testoma', EXTRACT(MONTH FROM NOW())::int, EXTRACT(DAY FROM NOW())::int, 1950, 'manual', true);"`

Run: `curl -s http://localhost:3001/api/widgets/birthdays | python3 -m json.tool`
Expected: JSON mit `"today": {"name": "Testoma", "age": <aktuelles Jahr - 1950>}`, `"upcoming": []`, `"fetched_at"` gesetzt.

Räume den Test-Eintrag wieder auf:

Run: `docker compose exec postgres psql -U family -d family_organizer -c "DELETE FROM birthdays WHERE name = 'Testoma';"`

- [ ] **Step 4: Commit**

```bash
git add backend/src/widgets/contacts.ts backend/src/index.ts
git commit -m "feat: GET /api/widgets/birthdays - kombiniert Familie und externe Kontakte"
```

---

### Task 5: Admin-CRUD-Routen (`routes/birthdays.ts`)

**Files:**
- Create: `backend/src/routes/birthdays.ts`
- Modify: `backend/src/index.ts` (Router-Registrierung)

**Interfaces:**
- Consumes: `requireParentAuth` aus `../middleware/auth` (liest `pin` aus dem Request-Body oder ein Bearer-JWT, identisch zu `configRouter`/`tasksRouter`).
- Produces: `export const birthdaysRouter` (Router), gemountet unter `/api/birthdays`.

- [ ] **Step 1: Datei anlegen**

```ts
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { requireParentAuth } from '../middleware/auth';

export const birthdaysRouter = Router();

// GET /api/birthdays - vollstaendige Liste (inkl. inaktive) fuers Verwaltungs-UI
birthdaysRouter.get('/', requireParentAuth, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, name, birth_month, birth_day, birth_year, source, active
      FROM birthdays
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/birthdays - manueller Eintrag
birthdaysRouter.post('/', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { name, birth_month, birth_day, birth_year } = req.body as {
      name?: string;
      birth_month?: number;
      birth_day?: number;
      birth_year?: number | null;
    };

    if (!name || !birth_month || !birth_day) {
      return res.status(400).json({ error: 'name, birth_month und birth_day sind erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO birthdays (name, birth_month, birth_day, birth_year, source, active)
      VALUES ($1, $2, $3, $4, 'manual', true)
      RETURNING id, name, birth_month, birth_day, birth_year, source, active
    `, [name, birth_month, birth_day, birth_year ?? null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating birthday:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/birthdays/:id - bei source='carddav' ist nur `active` aenderbar
birthdaysRouter.put('/:id', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT source FROM birthdays WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Birthday not found' });
    }

    const { name, birth_month, birth_day, birth_year, active } = req.body as {
      name?: string;
      birth_month?: number;
      birth_day?: number;
      birth_year?: number | null;
      active?: boolean;
    };

    if (existing.rows[0].source === 'carddav') {
      if (name !== undefined || birth_month !== undefined || birth_day !== undefined || birth_year !== undefined) {
        return res.status(400).json({ error: 'Bei CardDAV-Kontakten ist nur "active" aenderbar' });
      }
      const result = await pool.query(`
        UPDATE birthdays SET active = COALESCE($1, active) WHERE id = $2
        RETURNING id, name, birth_month, birth_day, birth_year, source, active
      `, [active ?? null, id]);
      return res.json(result.rows[0]);
    }

    const yearProvided = birth_year !== undefined;
    const result = await pool.query(`
      UPDATE birthdays SET
        name        = COALESCE($1, name),
        birth_month = COALESCE($2, birth_month),
        birth_day   = COALESCE($3, birth_day),
        birth_year  = CASE WHEN $4::boolean THEN $5::smallint ELSE birth_year END,
        active      = COALESCE($6, active)
      WHERE id = $7
      RETURNING id, name, birth_month, birth_day, birth_year, source, active
    `, [name ?? null, birth_month ?? null, birth_day ?? null, yearProvided, birth_year ?? null, active ?? null, id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating birthday:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/birthdays/:id - nur fuer source='manual'
birthdaysRouter.delete('/:id', requireParentAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT source FROM birthdays WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Birthday not found' });
    }
    if (existing.rows[0].source === 'carddav') {
      return res.status(400).json({ error: 'CardDAV-Kontakte koennen nur ueber active=false ausgeblendet werden' });
    }

    await pool.query(`DELETE FROM birthdays WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting birthday:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 2: Route in `index.ts` registrieren**

Import (bei den anderen Route-Imports, nach `import { configRouter } from './routes/config';`):

```ts
import { birthdaysRouter } from './routes/birthdays';
```

Registrierung (bei den anderen `app.use('/api/...)`-Zeilen, nach `app.use('/api/config', configRouter);`):

```ts
app.use('/api/birthdays', birthdaysRouter);
```

- [ ] **Step 3: Manuell verifizieren**

Backend muss laufen (`cd backend && npm run dev`). Ersetze `<ADMIN_PIN>` durch den Wert aus deiner lokalen `backend/.env`.

Run: `curl -s -X POST http://localhost:3001/api/birthdays -H "Content-Type: application/json" -d '{"name":"Testfreund","birth_month":3,"birth_day":14,"birth_year":1990,"pin":"<ADMIN_PIN>"}'`
Expected: `201` mit JSON-Objekt, `"source":"manual"`, `"active":true`. Notiere die zurückgegebene `id`.

Run: `curl -s http://localhost:3001/api/birthdays -H "Content-Type: application/json" -d '{"pin":"<ADMIN_PIN>"}' -X GET`
Expected: Array enthält den eben erstellten Eintrag "Testfreund".

Run: `curl -s -X DELETE http://localhost:3001/api/birthdays/<id> -H "Content-Type: application/json" -d '{"pin":"<ADMIN_PIN>"}'`
Expected: `{"ok":true}`.

Run: `curl -s -X POST http://localhost:3001/api/birthdays -H "Content-Type: application/json" -d '{"name":"Ohne Pin","birth_month":1,"birth_day":1}'`
Expected: `401` — bestätigt, dass die Route ohne PIN/JWT tatsächlich blockiert.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/birthdays.ts backend/src/index.ts
git commit -m "feat: PIN-geschützte Admin-CRUD-Routen für manuelle Geburtstags-Einträge"
```

---

### Task 6: vCard-Parsing (reine Funktionen)

**Files:**
- Modify: `backend/src/widgets/contacts.ts` (ergänzt Task 4)

**Interfaces:**
- Produces: `parseVCard(vcardText: string): ParsedContact | null`, `ParsedContact { uid, name, month, day, year }` — genutzt vom Sync in Task 7.

- [ ] **Step 1: Parsing-Funktionen ergänzen**

Füge in `backend/src/widgets/contacts.ts` (nach den Imports, vor `birthdaysWidgetRouter`) ein:

```ts
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

  const unknownYearMatch = value.match(/^--(\d{2})-?(\d{2})$/);
  if (unknownYearMatch) {
    return { month: Number(unknownYearMatch[1]), day: Number(unknownYearMatch[2]), year: null };
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return { year: Number(compactMatch[1]), month: Number(compactMatch[2]), day: Number(compactMatch[3]) };
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
```

- [ ] **Step 2: Manuell verifizieren**

Erstelle eine Wegwerf-Datei `/tmp/verify-vcard.ts`:

```ts
import { parseVCard } from '/home/skords/Dokumente/Projekte/family_app/backend/src/widgets/contacts';

console.log('ISO-Datum:', parseVCard(
  'BEGIN:VCARD\nVERSION:3.0\nUID:abc-123\nFN:Oma Erika\nBDAY:1950-03-15\nEND:VCARD'
));
// erwartet: { uid: 'abc-123', name: 'Oma Erika', month: 3, day: 15, year: 1950 }

console.log('Kompaktes Datum:', parseVCard(
  'BEGIN:VCARD\nUID:def-456\nFN:Bester Freund\nBDAY:19960415\nEND:VCARD'
));
// erwartet: { uid: 'def-456', name: 'Bester Freund', month: 4, day: 15, year: 1996 }

console.log('Jahr unbekannt:', parseVCard(
  'BEGIN:VCARD\nUID:ghi-789\nFN:Nachbar Klaus\nBDAY:--0704\nEND:VCARD'
));
// erwartet: { uid: 'ghi-789', name: 'Nachbar Klaus', month: 7, day: 4, year: null }

console.log('BDAY mit VALUE-Parameter:', parseVCard(
  'BEGIN:VCARD\nUID:jkl-012\nFN:Tante Mia\nBDAY;VALUE=DATE:1975-11-02\nEND:VCARD'
));
// erwartet: { uid: 'jkl-012', name: 'Tante Mia', month: 11, day: 2, year: 1975 }

console.log('Kein BDAY -> null:', parseVCard(
  'BEGIN:VCARD\nUID:mno-345\nFN:Ohne Geburtstag\nEND:VCARD'
));
// erwartet: null
```

Run: `cd backend && npx ts-node /tmp/verify-vcard.ts`
Expected: Alle fünf Ausgaben entsprechen exakt den Kommentaren. Lösche `/tmp/verify-vcard.ts` danach wieder.

- [ ] **Step 3: Commit**

```bash
git add backend/src/widgets/contacts.ts
git commit -m "feat: vCard-Parsing (UID/FN/BDAY) für CardDAV-Kontaktsync"
```

---

### Task 7: CardDAV-Discovery, -Fetch und Sync-Persistenz

**Files:**
- Modify: `backend/src/widgets/contacts.ts` (ergänzt Task 4 + 6)

**Interfaces:**
- Consumes: `ParsedContact`, `parseVCard` (Task 6, gleiche Datei); `pool` aus `../db/pool`.
- Produces: `export async function fetchAndStoreContactBirthdays(): Promise<void>` — genutzt vom Cron-Job in Task 8 und dem Startup-Fetch in `index.ts`.

- [ ] **Step 1: Discovery/Fetch/Sync-Funktionen ergänzen**

Füge in `backend/src/widgets/contacts.ts` (nach den Parsing-Funktionen aus Task 6, vor `birthdaysWidgetRouter`) ein:

```ts
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
  const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop>
    <D:getetag/>
    <C:address-data/>
  </D:prop>
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

  if (!response.ok && response.status !== 207) return [];

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

  const contacts: ParsedContact[] = [];
  for (const addressbookUrl of addressbooks) {
    const vcards = await fetchVCards(addressbookUrl, auth);
    for (const vcard of vcards) {
      const parsed = parseVCard(vcard);
      if (parsed) contacts.push(parsed);
    }
  }

  console.log(`[contacts] ${contacts.length} Kontakte mit Geburtstag gefunden`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const contact of contacts) {
      await client.query(`
        INSERT INTO birthdays (name, birth_month, birth_day, birth_year, source, external_uid, fetched_at)
        VALUES ($1, $2, $3, $4, 'carddav', $5, NOW())
        ON CONFLICT (source, external_uid) DO UPDATE SET
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
```

- [ ] **Step 2: Gegen den echten CardDAV-Server verifizieren**

Voraussetzung: `CALDAV_URL`/`CALDAV_USER`/`CALDAV_PASS` sind in `backend/.env` gesetzt (bereits vorhanden für den Kalender-Sync) und mindestens ein Kontakt im Adressbuch hat ein `BDAY`-Feld gesetzt.

Run: `cd backend && npx ts-node -e "import('./src/widgets/contacts').then(m => m.fetchAndStoreContactBirthdays())"`
Expected: Log-Zeilen `[contacts] Discovering addressbooks...`, `[contacts] N Kontakte mit Geburtstag gefunden`, `[contacts] Sync abgeschlossen. N Kontakte gespeichert.` — keine geworfenen Fehler.

Run: `docker compose exec postgres psql -U family -d family_organizer -c "SELECT name, birth_month, birth_day, birth_year, source FROM birthdays WHERE source = 'carddav';"`
Expected: Mindestens eine Zeile mit einem echten Kontakt aus deinem Adressbuch.

Falls `resolveCarddavUrl()` mit deinem Server nicht funktioniert (die automatische `/calendars/` → `/addressbooks/`-Ableitung schlägt fehl): setze `CARDDAV_URL` explizit in `backend/.env` auf die korrekte Adressbuch-URL deines Servers und wiederhole den Schritt.

- [ ] **Step 3: Commit**

```bash
git add backend/src/widgets/contacts.ts
git commit -m "feat: CardDAV-Discovery, -Fetch und Sync-Persistenz für Kontakte"
```

---

### Task 8: Cron-Job, Startup-Fetch, `CARDDAV_URL`-Env-Var

**Files:**
- Create: `backend/src/jobs/refreshContacts.ts`
- Modify: `backend/src/index.ts`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `fetchAndStoreContactBirthdays` aus `../widgets/contacts` (Task 7).
- Produces: `export function startContactsCron(): void`.

- [ ] **Step 1: Cron-Datei anlegen**

```ts
import cron from 'node-cron';
import { fetchAndStoreContactBirthdays } from '../widgets/contacts';

/**
 * Startet den täglichen Cronjob für den CardDAV-Kontakte-Sync.
 * Läuft um 03:10 Europe/Berlin — 10 Minuten nach dem Müll-Sync (03:00),
 * um Ressourcen-Überschneidung zu vermeiden.
 */
export function startContactsCron(): void {
  cron.schedule(
    '10 3 * * *',
    async () => {
      try {
        await fetchAndStoreContactBirthdays();
      } catch (err) {
        console.error('[contacts-cron] Sync fehlgeschlagen:', err);
      }
    },
    { timezone: 'Europe/Berlin' },
  );

  console.log('[cron] Kontakte-Sync für 03:10 Europe/Berlin geplant');
}
```

- [ ] **Step 2: In `index.ts` verdrahten**

Imports ergänzen (nach `import { startWasteCron } from './jobs/refreshWaste';`):

```ts
import { fetchAndStoreContactBirthdays } from './widgets/contacts';
import { startContactsCron } from './jobs/refreshContacts';
```

In der `start()`-Funktion, nach dem bestehenden Block `fetchAndStoreWasteEvents().catch(...)`, ergänzen:

```ts
    // Initialer Kontakte-Sync beim Start — füllt birthdays beim ersten Deploy.
    // Danach übernimmt der Cronjob. Non-fatal: Server startet auch ohne CardDAV.
    fetchAndStoreContactBirthdays().catch(err =>
      console.error('[contacts] Initial fetch failed (non-fatal):', err),
    );
```

Und direkt nach `startWasteCron();`:

```ts
    startContactsCron();
```

- [ ] **Step 3: `docker-compose.yml` um `CARDDAV_URL` ergänzen**

Direkt nach der Zeile `CALDAV_PASS: ${CALDAV_PASS}` im `backend`-Service ergänzen:

```yaml
      CARDDAV_URL: ${CARDDAV_URL}
```

- [ ] **Step 4: Backend-Start verifizieren**

Run: `cd backend && npm run dev`
Expected: Log-Zeilen enthalten `[cron] Kontakte-Sync für 03:10 Europe/Berlin geplant` sowie (non-fatal, falls CardDAV noch nicht erreichbar) höchstens eine Warnung, aber **keinen Absturz** des Servers.

Run: `npx tsc --noEmit` (im `backend`-Verzeichnis)
Expected: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add backend/src/jobs/refreshContacts.ts backend/src/index.ts docker-compose.yml
git commit -m "feat: täglichen CardDAV-Kontakte-Sync-Cronjob verdrahten"
```

---

### Task 9: Frontend — `BirthdayWidget.tsx`

**Files:**
- Create: `frontend/components/widgets/BirthdayWidget.tsx`

**Interfaces:**
- Consumes: `useClientDateStr` aus `@/hooks/useClientDate`.
- Produces: `export default function BirthdayWidget({ data, loading }: BirthdayWidgetProps)` mit `data?: { today: { name: string; age: number | null } | null; upcoming: { name: string; age: number | null; daysUntil: number }[]; fetched_at: string }` — genutzt von `page.tsx` in Task 10.

- [ ] **Step 1: Komponente schreiben**

```tsx
'use client';

import { useClientDateStr } from '@/hooks/useClientDate';

interface BirthdayToday {
  name: string;
  age: number | null;
}

interface BirthdayUpcoming {
  name: string;
  age: number | null;
  daysUntil: number;
}

interface BirthdaysData {
  today: BirthdayToday | null;
  upcoming: BirthdayUpcoming[];
  fetched_at: string;
}

interface BirthdayWidgetProps {
  data?: BirthdaysData;
  loading?: boolean;
}

const MAX_UPCOMING_SHOWN = 2;

function weekdayShort(daysUntil: number, todayStr: string): string {
  const target = new Date(todayStr + 'T00:00:00');
  target.setDate(target.getDate() + daysUntil);
  return target.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
}

function ageLabel(name: string, age: number | null): string {
  return age != null ? `${name} wird ${age}` : `${name} hat Geburtstag`;
}

export default function BirthdayWidget({ data, loading }: BirthdayWidgetProps) {
  const todayStr = useClientDateStr();

  const card = {
    background: 'var(--family-surface)',
    border: '0.5px solid var(--family-border)',
    borderRadius: 16,
    padding: 16,
  };

  if (loading) {
    return (
      <div style={{ ...card, height: 64 }} className="animate-pulse">
        <div style={{ background: '#e8e4de', borderRadius: 4, height: 14, width: '60%' }} />
      </div>
    );
  }

  // Kein Geburtstag heute oder diese Woche -> kein Wrapper, keine Hoehe.
  // Kritisch wegen overflow:hidden im Dashboard-Grid (frontend/app/page.tsx).
  if (!data || (!data.today && data.upcoming.length === 0)) {
    return null;
  }

  // Client-Datum noch nicht hydriert -> Platzhalter, um Layout-Sprung zu vermeiden.
  if (!todayStr) {
    return <div style={{ height: 64 }} />;
  }

  const shownUpcoming = data.upcoming.slice(0, MAX_UPCOMING_SHOWN);
  const extraCount = data.upcoming.length - shownUpcoming.length;

  const upcomingLine = shownUpcoming
    .map(e => `${ageLabel(e.name, e.age)} · ${weekdayShort(e.daysUntil, todayStr)}`)
    .join(' · ');

  return (
    <div style={card}>
      {data.today && (
        <div className="flex items-center gap-2">
          <i className="ti ti-gift" style={{ fontSize: 20, color: '#ec4899' }} aria-hidden="true" />
          <p className="font-sans font-medium" style={{ fontSize: 16, color: '#1a1814', margin: 0 }}>
            Heute: {ageLabel(data.today.name, data.today.age)}
          </p>
        </div>
      )}
      {data.upcoming.length > 0 && (
        <p
          className="text-[12px] font-sans truncate"
          style={{ color: '#a09d99', margin: data.today ? '4px 0 0' : 0 }}
        >
          {upcomingLine}
          {extraCount > 0 ? ` · +${extraCount} weitere` : ''}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript-Check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/widgets/BirthdayWidget.tsx
git commit -m "feat: BirthdayWidget-Komponente (Heute-Zeile + kompakte Wochen-Zeile)"
```

---

### Task 10: Einbindung in `page.tsx`

**Files:**
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: `BirthdayWidget` aus Task 9, `GET /api/widgets/birthdays` aus Task 4.

- [ ] **Step 1: Import ergänzen**

Nach `import WasteWidget from '@/components/widgets/WasteWidget';` einfügen:

```ts
import BirthdayWidget from '@/components/widgets/BirthdayWidget';
```

- [ ] **Step 2: Typ + State ergänzen**

Nach der bestehenden `WasteTodayData`-Interface-Zeile einfügen:

```ts
interface BirthdaysData {
  today: { name: string; age: number | null } | null;
  upcoming: { name: string; age: number | null; daysUntil: number }[];
  fetched_at: string;
}
```

Nach `const [waste, setWaste] = useState<WasteTodayData | undefined>();` einfügen:

```ts
  const [birthdays, setBirthdays] = useState<BirthdaysData | undefined>();
```

- [ ] **Step 3: Fetch ergänzen**

In `fetchAll`, das `Promise.allSettled`-Array erweitern — aus:

```ts
      const [ur, tr, cr, mr, wasteR] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals?range=month`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/waste/today`).then(r => r.json()),
      ]);
```

wird:

```ts
      const [ur, tr, cr, mr, wasteR, birthdaysR] = await Promise.allSettled([
        fetch(`${API_BASE}/api/users`).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/calendar`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/meals?range=month`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/waste/today`).then(r => r.json()),
        fetch(`${API_BASE}/api/widgets/birthdays`).then(r => r.json()),
      ]);
```

Und nach der Zeile `if (wasteR.status === 'fulfilled' && wasteR.value?.fetched_at) setWaste(wasteR.value);` ergänzen:

```ts
      if (birthdaysR.status === 'fulfilled' && birthdaysR.value?.fetched_at) setBirthdays(birthdaysR.value);
```

- [ ] **Step 4: Rendering ergänzen**

Im linken Spalten-`div` (`{/* ── LINKS: HEUTE ... */}`), direkt vor `<CalendarWidget`, einfügen:

```tsx
          <BirthdayWidget data={birthdays} loading={loading} />
```

Die vollständige linke Spalte sieht danach so aus:

```tsx
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BirthdayWidget data={birthdays} loading={loading} />
          <CalendarWidget
            events={calendar.events}
            fetched_at={calendar.fetched_at}
            loading={loading}
            daysAhead={1}
          />
          <div style={{ flexShrink: 0 }}>
            <MealsWidget byDate={meals.byDate} fetched_at={meals.fetched_at} loading={loading} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <WasteWidget data={waste} fetched_at={waste?.fetched_at} loading={loading} />
          </div>
        </div>
```

- [ ] **Step 5: TypeScript-Check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 6: Im Browser verifizieren**

Backend (`cd backend && npm run dev`) und Frontend (`cd frontend && npm run dev`) laufen lassen.

Lege testweise einen Geburtstag für heute an (ersetze `<ADMIN_PIN>`):

Run: `curl -s -X POST http://localhost:3001/api/birthdays -H "Content-Type: application/json" -d "{\"name\":\"Testkind\",\"birth_month\":$(date +%-m),\"birth_day\":$(date +%-d),\"birth_year\":2015,\"pin\":\"<ADMIN_PIN>\"}"`

Öffne `http://localhost:3000` im Browser. Erwartet: Oberhalb des Kalender-Widgets erscheint die Zeile "Heute: Testkind wird 11" (bzw. aktuelles Jahr − 2015) mit Geschenk-Icon in Pink — ohne dass Kalender/Essensplan/Müll aus dem sichtbaren Bereich verdrängt werden (Fenster bleibt scrollfrei).

Räume den Test-Eintrag wieder auf (ersetze `<id>` durch die aus der POST-Antwort zurückgegebene ID):

Run: `curl -s -X DELETE http://localhost:3001/api/birthdays/<id> -H "Content-Type: application/json" -d '{"pin":"<ADMIN_PIN>"}'`

Lade die Seite neu. Erwartet: Die Widget-Zeile verschwindet vollständig (kein leerer Bereich, keine Höhenänderung im Layout).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: BirthdayWidget im Dashboard oberhalb des Kalenders einbinden"
```

---

## Selbst-Review (durchgeführt)

- **Spec-Abdeckung:** Datenmodell → Task 1. Zod-Schemas → Task 2. CardDAV-Sync → Task 6+7+8. Widget-API → Task 4. Admin-CRUD → Task 5. Frontend → Task 9+10. Alle Abschnitte der Spec sind abgedeckt; die "Gratulieren"-Task aus dem ursprünglichen Auftrag ist laut Nicht-Ziele-Abschnitt der Spec bewusst ausgeschlossen.
- **Typkonsistenz geprüft:** `BirthdaySource`/`BirthdayWindow`/`BirthdayWindowEntry` (Task 3) werden identisch in Task 4 (`widgets/contacts.ts`) verwendet. `ParsedContact` aus Task 6 wird 1:1 in Task 7 (`fetchAndStoreContactBirthdays`) konsumiert. `BirthdaysData`-Shape in Task 9 (Frontend) entspricht exakt `BirthdaysResponseSchema` aus Task 2.
- **Korrektur während der Planerstellung:** Der ursprüngliche Entwurf für `fetchAndStoreContactBirthdays` hätte bei einem leeren Sync-Ergebnis (0 Kontakte, z.B. wegen eines transienten Netzwerkfehlers) versehentlich **alle** bestehenden `carddav`-Zeilen gelöscht (`NOT (external_uid = ANY('{}'))` ist für jede Zeile wahr). Task 7 schützt das jetzt explizit mit `if (contacts.length > 0)`.
