import cron from 'node-cron';
import { pool } from '../db/pool';

export async function generateDailyTasks(dateOverride?: string): Promise<void> {
  const today = dateOverride ?? new Date().toISOString().split('T')[0];
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
      // Normalise assigned_to: JSONB array, legacy single UUID, or null → string[]
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

      // Check recurrence
      let shouldCreate = false;
      if (template.recurrence === 'daily') {
        shouldCreate = true;
      } else if (template.recurrence === 'weekly') {
        shouldCreate = isMonday;
      } else if (template.recurrence === 'once') {
        // One-off templates: only create if there are no existing instances
        const existingAny = await client.query(`
          SELECT COUNT(*) FROM task_instances WHERE template_id = $1
        `, [template.id]);
        shouldCreate = parseInt(existingAny.rows[0].count) === 0;
      } else if (template.recurrence.startsWith('weekdays:')) {
        // e.g. "weekdays:mon,wed,fri"
        const days = template.recurrence.replace('weekdays:', '').split(',');
        shouldCreate = days.includes(todayKey);
      }

      if (!shouldCreate) continue;

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