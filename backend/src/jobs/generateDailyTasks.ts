import cron from 'node-cron';
import { pool } from '../db/pool';

/**
 * Convert a DATE value from PG (Date object or string) to YYYY-MM-DD in local time.
 */
function dateToLocalStr(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).split('T')[0];
}

export async function generateDailyTasks(dateOverride?: string): Promise<void> {
  const today = dateOverride ?? (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  // dayOfWeek: lock to noon UTC of the target date to avoid TZ edge cases
  const dayOfWeek = new Date(today + 'T12:00:00Z').getDay(); // 0=Sunday, 1=Monday
  const isMonday = dayOfWeek === 1;

  console.log(`[generateDailyTasks] Generating tasks for ${today} (day ${dayOfWeek})`);

  const client = await pool.connect();
  try {
    // Get all active task templates
    const templatesResult = await client.query(`
      SELECT * FROM task_templates WHERE active = true
    `);
    const templates = templatesResult.rows;

    // Get all users for templates with assigned_to = null
    const usersResult = await client.query(`SELECT id FROM users`);
    const allUserIds: string[] = usersResult.rows.map((r: any) => r.id);

    // Weekday key for today: 0=sun→'sun', 1=mon→'mon', ...
    const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayKey = WEEKDAY_KEYS[dayOfWeek];

    let created = 0;
    let skipped = 0;

    for (const template of templates) {
      // ── Date-range gate (valid_from / valid_until) ──
      // Applies to recurring templates. For 'once', due_date is the gate.
      const validFrom = dateToLocalStr(template.valid_from);
      const validUntil = dateToLocalStr(template.valid_until);

      if (template.recurrence !== 'once') {
        if (validFrom && today < validFrom) {
          continue; // not yet valid
        }
        if (validUntil && today > validUntil) {
          continue; // expired
        }
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
        // One-off templates: gated by due_date if set, otherwise legacy "first run wins"
        const existingAny = await client.query(`
          SELECT COUNT(*) FROM task_instances WHERE template_id = $1
        `, [template.id]);
        const hasExisting = parseInt(existingAny.rows[0].count) > 0;
        if (hasExisting) {
          shouldCreate = false;
        } else {
          const dueStr = dateToLocalStr(template.due_date);
          if (dueStr) {
            // Only create on the exact date
            shouldCreate = dueStr === today;
          } else {
            // No date set → create on first generation (immediate / next cron)
            shouldCreate = true;
          }
        }
      } else if (template.recurrence.startsWith('weekdays:')) {
        // e.g. "weekdays:mon,wed,fri"
        const days = template.recurrence.replace('weekdays:', '').split(',');
        shouldCreate = days.includes(todayKey);
      }

      if (!shouldCreate) continue;

      // ── Rotation: pick least-loaded user from pool ──
      // Only kicks in when rotation flag is set AND pool has 2+ candidates.
      // Fairness = (lowest historical count for this template) → (longest gap since last assignment).
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
            last: dateToLocalStr(r.last_date),
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

    console.log(`[generateDailyTasks] Done. Created: ${created}, Skipped (already exist): ${skipped}`);
  } catch (err) {
    console.error('[generateDailyTasks] Error:', err);
    throw err;
  } finally {
    client.release();
  }
}

export function startDailyTaskCron(): void {
  // Run at 00:05 every day
  cron.schedule('5 0 * * *', async () => {
    console.log('[cron] Running daily task generation...');
    try {
      await generateDailyTasks();
    } catch (err) {
      console.error('[cron] Daily task generation failed:', err);
    }
  }, {
    timezone: 'Europe/Berlin',
  });

  console.log('[cron] Daily task generation scheduled for 00:05 Europe/Berlin');
}