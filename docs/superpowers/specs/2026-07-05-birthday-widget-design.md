# Geburtstags-Widget — Design

## Kontext

Family Organizer zeigt auf dem Haupt-Dashboard (`frontend/app/page.tsx`) eine feste 100vh-Ansicht ohne Scroll: linke Spalte (fix 440px) mit Kalender → Essensplan → Müll gestapelt, rechte Spalte als 3×2-Familienkarten-Raster. Dieses Projekt fügt ein neues `BirthdayWidget` oberhalb des Kalenders in der linken Spalte ein, das Geburtstage von heute bis in 7 Tagen anzeigt.

## Ziele

- Geburtstage von Familienmitgliedern (bereits als User im System) automatisch anzeigen — ohne Doppelpflege.
- Geburtstage von Personen ohne Account (Großeltern, Freunde, Patenkinder) automatisch aus einem CardDAV-Adressbuch synchronisieren.
- Bei Geburtstag heute: prominente Anzeige. Bei weiteren Geburtstagen diese Woche: kompakte Zusatzzeile.
- Layout-Constraint: Komponente rendert `null` (keine Höhe) wenn nichts anzuzeigen ist — das Dashboard hat `overflow: hidden`, jede ungewollte Höhenänderung verschiebt sichtbare Inhalte aus dem Fenster.

## Nicht-Ziele

- Keine neue Aufgaben-Generierung ("gratulieren"-Task) — die Erinnerung erfolgt ausschließlich über die Widget-Anzeige selbst, nicht über eine zusätzliche Aufgabe in `generateDailyTasks.ts`.
- Kein Bearbeiten von Kontaktdaten zurück ins CardDAV-Adressbuch (nur lesender Sync).
- Keine Unterstützung für Anbieter ohne klassisches CardDAV/Basic-Auth (z.B. Google Contacts via OAuth) — der Nutzer betreibt einen generischen CardDAV-Server mit Basic-Auth, dieselben Zugangsdaten wie der bestehende CalDAV-Kalender-Sync.

## 1. Datenmodell

Erweiterung von `backend/src/db/schema.ts` (idempotent, wie der Rest der Datei):

```sql
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

Abweichungen von der ursprünglichen Anforderung (bewusst, mit Begründung):

- **`birth_month`/`birth_day`/`birth_year` statt einer einzelnen `date`-Spalte.** Postgres `DATE` erfordert immer ein Jahr. Ein Sentinel-Jahr für "Jahr unbekannt" wäre fehleranfällig, insbesondere bei Kontakten mit Geburtstag am 29. Februar. Getrennte Spalten vermeiden das vollständig.
- **Kein `user_id`-FK.** `users.birthdate` existiert bereits (admin-editierbar über `PUT /api/users/:id`, genutzt für die Alters-Faktor-Berechnung bei Rewards) und ist die alleinige Quelle für Familienmitglieder-Geburtstage. `birthdays` enthält ausschließlich Personen ohne Account — automatisch aus dem CardDAV-Sync, optional auch manuell nachgetragen. Das vermeidet zwei Quellen für dieselbe Information.

## 2. CardDAV-Kontaktsync

Neue Dateien, strukturell 1:1 analog zum bestehenden Kalender-Sync (`backend/src/widgets/caldav.ts` + `backend/src/jobs/refreshWaste.ts`):

- `backend/src/widgets/contacts.ts`
- `backend/src/jobs/refreshContacts.ts`

Details:

- **Auth:** Wiederverwendung von `CALDAV_USER`/`CALDAV_PASS` (Basic-Auth) — bereits in der `.env` vorhanden.
- **Adressbuch-URL:** Neue optionale Env-Var `CARDDAV_URL`. Falls nicht gesetzt, wird sie aus `CALDAV_URL` abgeleitet (`/calendars/` → `/addressbooks/` im Pfad ersetzt — deckt die verbreiteten Nextcloud/Baikal-Konventionen ab). Da der Server-Typ unbekannt ist, kann die automatische Ableitung fehlschlagen; `CARDDAV_URL` dient als manueller Override.
- **Discovery:** `discoverAddressbooks(baseUrl, auth)` — PROPFIND mit `Depth: 1`, sucht `resourcetype` mit `addressbook` (analog zu `discoverCalendars` in `caldav.ts`, das nach `calendar` sucht).
- **Fetch:** `fetchContacts(addressbookUrl, auth)` — REPORT mit `addressbook-query` (CardDAV, RFC 6352), fragt `address-data` an, liefert rohe vCard-Textblöcke.
- **Parsing:** `parseVCard(vcardText)` extrahiert `UID`, `FN` (Fallback `N`), `BDAY`. Unterstützte `BDAY`-Formate: `YYYYMMDD`, `YYYY-MM-DD`, `--MMDD` (RFC 6350, "Jahr unbekannt"). Kontakte ohne `BDAY` oder ohne Namen werden übersprungen (kein Fehler, nur Skip).
- **Persistenz:** `fetchAndStoreContactBirthdays()` upserted nach `birthdays` (`source='carddav'`, `external_uid=UID`). `ON CONFLICT (source, external_uid) DO UPDATE` aktualisiert `name`, `birth_month`, `birth_day`, `birth_year`, `fetched_at` — **nicht** `active` (ein Admin kann einen synchronisierten Kontakt dauerhaft ausblenden, z.B. einen Lieferdienst im selben Adressbuch, ohne dass der nächtliche Sync ihn wieder einblendet). Kontakte, die im aktuellen Sync-Durchlauf nicht mehr vorkommen (gelöscht/UID geändert), werden aus `birthdays` entfernt (`source='carddav' AND external_uid NOT IN (aktuell gesehene UIDs)`).
- **Cron:** Täglich 03:10 Europe/Berlin (10 Minuten nach dem bestehenden Müll-Sync um 03:00, um Ressourcen-Überschneidung zu vermeiden), plus ein einmaliger Fetch beim Serverstart (non-fatal bei Fehler — Server startet auch ohne Netzwerk/CardDAV-Erreichbarkeit).

## 3. Backend-API

### `GET /api/widgets/birthdays`

Kombiniert zwei Quellen:
1. `users` mit `birthdate IS NOT NULL` — Monat/Tag + Alter (falls Jahr vorhanden).
2. `birthdays` mit `active = true`.

**Deduplizierung:** Ein `birthdays`-Eintrag wird übersprungen, wenn sein Name (case-insensitive, getrimmt) mit einem vorhandenen User-Namen übereinstimmt — verhindert Doppelanzeige, falls die eigene Familie zusätzlich im synchronisierten Adressbuch steht.

**Fenster:** heute bis einschließlich +7 Tage, mit Jahreswechsel-Behandlung (Dezember → Januar).

**Response:**

```ts
{
  today: { name: string; age: number | null } | null;
  upcoming: Array<{ name: string; age: number | null; daysUntil: number }>;
  fetched_at: string; // ISO datetime
}
```

Zod-Schema in `shared/types/birthdays.ts`, analog zu `shared/types/waste.ts`.

### Admin-CRUD (`backend/src/routes/birthdays.ts`, PIN-geschützt via `requireParentAuth`)

- `GET /api/birthdays` — vollständige Liste (inkl. inaktive, beide `source`-Werte) für die Verwaltungsoberfläche.
- `POST /api/birthdays` — manueller Eintrag (`name`, `birth_month`, `birth_day`, `birth_year?`). `source` wird serverseitig auf `'manual'` gesetzt.
- `PUT /api/birthdays/:id` — bei `source='manual'`: alle Felder änderbar. Bei `source='carddav'`: nur `active` änderbar (Name/Datum werden vom Sync verwaltet; ein Versuch, sie zu ändern, wird ignoriert bzw. mit 400 abgelehnt).
- `DELETE /api/birthdays/:id` — nur für `source='manual'` erlaubt (404/400 für `carddav`-Zeilen — die verschwinden ausschließlich über den Sync selbst, sonst würde ein gelöschter aber noch im Adressbuch vorhandener Kontakt beim nächsten Sync wieder auftauchen).

## 4. Frontend

`frontend/components/widgets/BirthdayWidget.tsx` — Props `{ data, loading }`, strukturell analog zu `WasteWidget.tsx`:

- `data: { today, upcoming, fetched_at } | undefined`.
- Kein Geburtstag heute und `upcoming` leer → `return null` (kein Wrapper-`div`, keine Innenabstände — kritisch wegen `overflow: hidden` im Dashboard-Grid).
- Heute-Zeile (prominent): Geschenk-Icon (`ti ti-gift`), Pink-Akzent (`#ec4899`-Familie, konsistent mit `PASTELS`), Text "Heute: {name} wird {age}" bzw. "Heute: {name} hat Geburtstag" wenn Jahr unbekannt.
- Wochen-Zeile (kompakt, nur wenn `upcoming.length > 0`): "{name} wird {age} · {Wochentag-Kurzform}", mehrere Einträge durch " · " getrennt.
- Fix auf maximal 2 Textzeilen Höhe begrenzt (kein dynamisches Wachsen mit der Anzahl der Einträge).
- Styling: `var(--family-surface)`, `var(--family-border)`, Tabler Icons, deutsche UI-Texte — konsistent zu `WasteWidget.tsx`/`CalendarWidget.tsx`.

`frontend/app/page.tsx`: neuer `birthdays`-State, neuer Fetch-Call im bestehenden `Promise.allSettled` in `fetchAll()`, Komponente eingefügt oberhalb `<CalendarWidget>` im linken Spalten-`div`.

## 5. Migration & Wiring

- Schema-Erweiterung in `backend/src/db/schema.ts` (Abschnitt 1) — läuft automatisch über den bestehenden `migrate`-Mechanismus (`schema`-String, keine separaten Migrationsdateien).
- Neue Env-Var `CARDDAV_URL` (optional) in `docker-compose.yml` unter `environment:`, analog zu `CALDAV_URL`.
- Neue Router-Registrierung in `backend/src/index.ts`: `app.use('/api/widgets/birthdays', birthdaysWidgetRouter)`, `app.use('/api/birthdays', birthdaysAdminRouter)`.
- Neuer Cron-Start in `backend/src/index.ts`: `startContactsCron()` (analog zu `startWasteCron()`), plus initialer `fetchAndStoreContactBirthdays()`-Aufruf beim Start (non-fatal).

## Offene Umsetzungsdetails (für den Implementierungsplan)

- Exakte Regex/Parsing-Grenzfälle für `BDAY`-Varianten unterschiedlicher CardDAV-Clients.
- Sortierung/Kürzung von `upcoming`, falls mehr als 2–3 Geburtstage in einer Woche liegen (Platz ist auf 2 Textzeilen begrenzt).
