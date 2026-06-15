import cron from 'node-cron';
import { pool } from '../db/pool';
import { getTodayInAppTz, getDayOfWeek, pgDateToStr } from '../utils/date';

/**
 * Generates today's task instances from all active templates.
 *
 * — Anchored to Europe/Berlin (see utils/date.ts) regardless of container TZ.
 * — Wrapped in a transaction with a Postgres advisory lock so concurrent
 *   callers (cron + lazy guard) are serialised. The second caller sees the
 *   idempotency rows of the first and exits cleanly.
 * — Safe to call any number of times. Idempotent.
 *
 * Recurrence values supported:
 *   'daily'                  → every day
 *   'weekly'                 → every Monday
 *   'once'                   → exactly once (gated by due_date)
 *   'weekdays:mon,wed,fri'   → every selected weekday
 *   'biweekly:sun'           → every 14 days on the given weekday(s),
 *                              anchored to valid_from. valid_from is required.
 */
export async function generateDailyTasks(dateOverride?: string): Promise<void> {
  const today = dateOverride ?? getTodayInAppTz();
  const dayOfWeek = getDayOfWeek(today); // 0=Sunday, 1=Monday, …
  const isMonday = dayOfWeek === 1;

  console.log(`[generateDailyTasks] Generating tasks for ${today} (day ${dayOfWeek})`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Advisory lock held until COMMIT/ROLLBACK — prevents two generators from
    // racing on rotation pick or duplicate inserts. Waiters block briefly then
    // see an empty work-list because of the idempotency checks below.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('generate-daily-tasks'))`);

    // Get all active task templates
    const templatesResult = await client.query(`
      SELECT * FROM task_templates WHERE active = true
    `);
    const templates = templatesResult.rows;

    // Get all users for templates with assigned_to = null
    const usersResult = await client.query(`SELECT id FROM users`);
    const allUserIds: string[] = usersResult.rows.map((r: any) => r.id);

    // Weekday key for today: 0=sun→'sun', 1=mon→'mon', …
    const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayKey = WEEKDAY_KEYS[dayOfWeek];

    let created = 0;
    let skipped = 0;

    for (const template of templates) {
      // ── Date-range gate (valid_from / valid_until) ──
      // Applies to recurring templates. For 'once', due_date is the gate.
      const validFrom = pgDateToStr(template.valid_from);
      const validUntil = pgDateToStr(template.valid_until);

      if (template.recurrence !== 'once') {
        if (validFrom && today < validFrom) continue;  // not yet valid
        if (validUntil && today > validUntil) continue; // expired
      }

      // ── Normalise assigned_to: JSONB array, legacy single UUID, or null → string[] ──
      let userIds: string[];
      const raw = template.assigned_to;
      if (!raw || (Array.isArray(raw) && raw.length === 0)) {
        userIds = allUserIds;
      } else if (Array.isArray(raw)) {
        userIds = raw.map(String);
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          userIds = Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : allUserIds;
        } catch {
          userIds = [raw]; // plain UUID string (legacy)
        }
      } else {
        userIds = allUserIds;
      }

      // ── Recurrence check ──
      let shouldCreate = false;
      if (template.recurrence === 'daily') {
        shouldCreate = true;
      } else if (template.recurrence === 'weekly') {
        shouldCreate = isMonday;
      } else if (template.recurrence === 'once') {
        // One-off templates: gated by due_date if set, else "first run wins"
        const existingAny = await client.query(`
          SELECT COUNT(*) FROM task_instances WHERE template_id = $1
        `, [template.id]);
        const hasExisting = parseInt(existingAny.rows[0].count) > 0;
        if (hasExisting) {
          shouldCreate = false;
        } else {
          const dueStr = pgDateToStr(template.due_date);
          if (dueStr) {
            shouldCreate = dueStr === today; // only on the exact date
          } else {
            shouldCreate = true; // no date set → create on first generation
          }
        }
      } else if (template.recurrence.startsWith('weekdays:')) {
        // e.g. "weekdays:mon,wed,fri"
        const days = template.recurrence.replace('weekdays:', '').split(',');
        shouldCreate = days.includes(todayKey);
      } else if (template.recurrence.startsWith('biweekly:')) {
        // e.g. "biweekly:sun" — every 14 days on the given weekday(s),
        // anchored to valid_from. Without an anchor we cannot tell which
        // "every other week" we're in, so we skip.
        const days = template.recurrence.replace('biweekly:', '').split(',');
        if (!days.includes(todayKey)) {
          shouldCreate = false;
        } else if (!validFrom) {
          console.warn(
            `[generateDailyTasks] Template ${template.id} ("${template.title}") is biweekly ` +
            `but has no valid_from anchor. Skipping.`
          );
          shouldCreate = false;
        } else {
          // Group days since anchor into 7-day buckets; even bucket = active week.
          // Use noon UTC to dodge DST edge-cases for date-only diffs.
          const anchorMs = new Date(validFrom + 'T12:00:00Z').getTime();
          const todayMs = new Date(today + 'T12:00:00Z').getTime();
          const daysDiff = Math.floor((todayMs - anchorMs) / (1000 * 60 * 60 * 24));
          if (daysDiff < 0) {
            shouldCreate = false;
          } else {
            const weekIndex = Math.floor(daysDiff / 7);
            shouldCreate = weekIndex % 2 === 0;
          }
        }
      }

      if (!shouldCreate) continue;

      // ── Rotation: pick least-loaded user from pool ──
      // Only kicks in when rotation flag is set AND pool has 2+ candidates.
      // Fairness = (lowest historical count) → (longest gap since last assignment).
      // New pool members win automatically (count=0 beats everyone).
      if (template.rotation && userIds.length > 1) {
        const counts = await client.query(`
          SELECT
            assigned_to::text AS user_id,
            COUNT(*)::int AS cnt,
            MAX(date) AS last_date
          FROM task_instances
          WHERE template_id = $1
            AND assigned_to::text = ANY($2)
          GROUP BY assigned_to
        `, [template.id, userIds]);

        const stats = new Map<string, { cnt: number; last: string | null }>();
        for (const uid of userIds) stats.set(uid, { cnt: 0, last: null });
        for (const r of counts.rows) {
          stats.set(r.user_id, {
            cnt: r.cnt,
            last: pgDateToStr(r.last_date),
          });
        }

        const sorted = [...stats.entries()].sort((a, b) => {
          if (a[1].cnt !== b[1].cnt) return a[1].cnt - b[1].cnt;
          // Tie: longest-ago wins (null = never assigned → highest priority)
          if (!a[1].last && !b[1].last) return 0;
          if (!a[1].last) return -1;
          if (!b[1].last) return 1;
          return a[1].last.localeCompare(b[1].last);
        });

        userIds = [sorted[0][0]]; // pick the winner only
      }

      // ── Create instances ──
      for (const userId of userIds) {
        // Idempotency check
        const existingResult = await client.query(`
          SELECT COUNT(*) FROM task_instances
          WHERE template_id = $1 AND assigned_to = $2 AND date = $3
        `, [template.id, userId, today]);

        const count = parseInt(existingResult.rows[0].count);

        if (count > 0) {
          skipped++;
          continue;
        }

        await client.query(`
          INSERT INTO task_instances (template_id, assigned_to, date)
          VALUES ($1, $2, $3)
        `, [template.id, userId, today]);

        created++;
      }
    }

    await client.query('COMMIT');
    console.log(`[generateDailyTasks] Done. Created: ${created}, Skipped (already exist): ${skipped}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* noop */ });
    console.error('[generateDailyTasks] Error:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Self-healing guard. Cheap to call (one COUNT query when there's nothing to
 * do). If no instances exist for today, runs `generateDailyTasks` once.
 *
 * Memoised per date so route handlers calling it on every request only pay
 * for the DB check on the first call of a new day.
 */
let lastEnsuredDate: string | null = null;
let inFlight: Promise<void> | null = null;

export async function ensureTodayTasksGenerated(): Promise<void> {
  const today = getTodayInAppTz();

  // Hot path: already ensured for today, no work.
  if (lastEnsuredDate === today) return;

  // A second concurrent caller piggy-backs on the in-flight Promise so we
  // never run two checks in parallel for the same date.
  if (inFlight) {
    await inFlight;
    return;
  }

  inFlight = (async () => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM task_instances WHERE date = $1`,
        [today]
      );

      if (result.rows[0].cnt > 0) {
        // Already generated (by cron or earlier startup). Just mark done.
        lastEnsuredDate = today;
        return;
      }

      // Anything to generate at all?
      const active = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM task_templates WHERE active = true`
      );
      if (active.rows[0].cnt === 0) {
        lastEnsuredDate = today;
        return;
      }

      console.log(`[ensureTodayTasksGenerated] Catch-up generation for ${today}`);
      await generateDailyTasks(today);
      lastEnsuredDate = today;
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;
}

export function startDailyTaskCron(): void {
  // Run at 00:05 every day (Europe/Berlin). Uses ensureTodayTasksGenerated so
  // a re-fire (e.g. clock jump, daylight-saving artefact) is a no-op.
  cron.schedule('5 0 * * *', async () => {
    console.log('[cron] Running daily task generation…');
    // Reset memo so the cron always re-checks (in case the process kept
    // running across midnight without an ensure call in between).
    lastEnsuredDate = null;
    try {
      await ensureTodayTasksGenerated();
    } catch (err) {
      console.error('[cron] Daily task generation failed:', err);
    }
  }, {
    timezone: 'Europe/Berlin',
  });

  console.log('[cron] Daily task generation scheduled for 00:05 Europe/Berlin');
}
