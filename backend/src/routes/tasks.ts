import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';
import { emitSSE } from '../sse';
import { generateDailyTasks, ensureTodayTasksGenerated } from '../jobs/generateDailyTasks';
import { getTodayInAppTz, pgDateToStr } from '../utils/date';

export const tasksRouter = Router();

/**
 * Normalise assigned_to coming from DB (JSONB) or request body.
 * Always returns string[] | null.
 *   null / undefined / []  → null  (means "all users")
 *   "uuid"                 → ["uuid"]   (legacy single value)
 *   ["uuid1","uuid2"]      → ["uuid1","uuid2"]
 */
function normaliseAssignedTo(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? value.map(String) : null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.length > 0 ? parsed.map(String) : null;
    } catch {}
    return [value]; // plain UUID string
  }
  return null;
}

/**
 * Extract a single UUID string from assigned_to.
 * task_instances.assigned_to is a scalar UUID column (not JSONB),
 * but after joining through task_templates it can occasionally arrive
 * as a JS array if pg deserialises it unexpectedly.
 * Always use this helper before writing to point_events.user_id.
 */
function extractUserId(value: unknown): string {
  if (Array.isArray(value)) return String(value[0]);
  return String(value);
}

async function verifyParentPin(pin: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT id FROM users WHERE role = 'parent' AND pin = $1`,
    [pin]
  );
  return result.rows.length > 0;
}

// GET /api/tasks/today - return task_instances for today, joined with template
tasksRouter.get('/today', async (_req: Request, res: Response) => {
  try {
    // Self-heal: if cron was missed / failed, generate now.
    // Memoised per date — no DB cost once today is covered.
    await ensureTodayTasksGenerated();

    const today = getTodayInAppTz();
    const result = await pool.query(`
      SELECT
        ti.id,
        ti.template_id,
        ti.assigned_to,
        ti.date,
        ti.completed_at,
        ti.completed_by,
        ti.approved_at,
        ti.approved_by,
        tt.title,
        tt.points,
        tt.due_time,
        tt.requires_approval,
        tt.icon,
        tt.category,
        u.name AS assigned_to_name,
        u.avatar AS assigned_to_avatar,
        u.color AS assigned_to_color
      FROM task_instances ti
      JOIN task_templates tt ON ti.template_id = tt.id
      JOIN users u ON ti.assigned_to = u.id
      WHERE ti.date = $1
      ORDER BY tt.due_time ASC NULLS LAST, tt.title ASC
    `, [today]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching today tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/instances/pending-approval - all completed but not yet approved instances
// IMPORTANT: must be registered before /:id/... routes to prevent Express matching
// "pending-approval" as :id
tasksRouter.get('/instances/pending-approval', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        ti.id,
        ti.template_id,
        ti.assigned_to,
        ti.date,
        ti.completed_at,
        tt.title,
        tt.points,
        tt.icon,
        u.name        AS user_name,
        u.avatar      AS user_avatar,
        u.photo       AS user_photo,
        u.color       AS user_color
      FROM task_instances ti
      JOIN task_templates tt ON ti.template_id = tt.id
      JOIN users u           ON ti.assigned_to  = u.id
      WHERE ti.completed_at IS NOT NULL
        AND ti.approved_at  IS NULL
        AND tt.requires_approval = true
      ORDER BY ti.completed_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending approvals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/complete - mark task as completed (or pending if requires_approval)
tasksRouter.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Get the task instance and its template
    const taskResult = await pool.query(`
      SELECT ti.*, tt.points, tt.title, tt.requires_approval
      FROM task_instances ti
      JOIN task_templates tt ON ti.template_id = tt.id
      WHERE ti.id = $1
    `, [id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task instance not found' });
    }

    const task = taskResult.rows[0];
    // assigned_to is a scalar UUID on task_instances, but extract safely
    const assignedTo = extractUserId(task.assigned_to);

    if (task.completed_at) {
      return res.status(400).json({ error: 'Task already completed' });
    }

    // Mark task as completed
    await pool.query(`
      UPDATE task_instances
      SET completed_at = NOW(), completed_by = $1
      WHERE id = $2
    `, [user_id, id]);

    // Only grant points immediately if no approval required
    if (!task.requires_approval) {
      await pool.query(`
        INSERT INTO point_events (user_id, points, reason)
        VALUES ($1, $2, $3)
      `, [assignedTo, task.points, `task:${id}`]);
      emitSSE({ type: 'task_updated', data: { task_id: id, date: task.date } });
      emitSSE({ type: 'points_updated', data: { user_id: assignedTo } });
      return res.json({ success: true, points_earned: task.points, pending_approval: false });
    }

    emitSSE({ type: 'task_updated', data: { task_id: id, date: task.date } });
    return res.json({ success: true, points_earned: 0, pending_approval: true });
  } catch (err) {
    console.error('Error completing task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/approve - parent approves a pending task (grants points)
tasksRouter.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'pin is required' });
    }

    const isParent = await verifyParentPin(pin);
    if (!isParent) {
      return res.status(401).json({ error: 'Invalid parent PIN' });
    }

    // Get parent id for approved_by
    const parentResult = await pool.query(
      `SELECT id FROM users WHERE role = 'parent' AND pin = $1 LIMIT 1`,
      [pin]
    );
    const parentId = parentResult.rows[0]?.id;

    const taskResult = await pool.query(`
      SELECT ti.*, tt.points, tt.title, tt.requires_approval
      FROM task_instances ti
      JOIN task_templates tt ON ti.template_id = tt.id
      WHERE ti.id = $1
    `, [id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task instance not found' });
    }

    const task = taskResult.rows[0];
    const assignedTo = extractUserId(task.assigned_to);

    if (!task.completed_at) {
      return res.status(400).json({ error: 'Task is not completed yet' });
    }
    if (task.approved_at) {
      return res.status(400).json({ error: 'Task already approved' });
    }

    // Mark as approved
    await pool.query(`
      UPDATE task_instances
      SET approved_at = NOW(), approved_by = $1
      WHERE id = $2
    `, [parentId, id]);

    // Now grant the points
    await pool.query(`
      INSERT INTO point_events (user_id, points, reason)
      VALUES ($1, $2, $3)
    `, [assignedTo, task.points, `task:${id}`]);

    emitSSE({ type: 'task_updated', data: { task_id: id } });
    emitSSE({ type: 'points_updated', data: { user_id: assignedTo } });
    res.json({ success: true, points_earned: task.points });
  } catch (err) {
    console.error('Error approving task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/uncomplete - reverse completion (anyone, no PIN needed)
tasksRouter.post('/:id/uncomplete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const taskResult = await pool.query(`
      SELECT ti.*, tt.points, tt.requires_approval
      FROM task_instances ti
      JOIN task_templates tt ON ti.template_id = tt.id
      WHERE ti.id = $1
    `, [id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task instance not found' });
    }

    const task = taskResult.rows[0];
    const assignedTo = extractUserId(task.assigned_to);

    if (!task.completed_at) {
      return res.status(400).json({ error: 'Task is not completed' });
    }

    // Only remove points if they were already granted
    // (no approval required → points given on complete)
    // (approval required → points given on approve, so only remove if approved)
    const pointsWereGranted = !task.requires_approval || task.approved_at;
    if (pointsWereGranted) {
      await pool.query(`
        DELETE FROM point_events
        WHERE reason = $1 AND user_id = $2
      `, [`task:${id}`, assignedTo]);
    }

    // Clear completed + approval state
    await pool.query(`
      UPDATE task_instances
      SET completed_at = NULL, completed_by = NULL, approved_at = NULL, approved_by = NULL
      WHERE id = $1
    `, [id]);

    emitSSE({ type: 'task_updated', data: { task_id: id } });
    if (pointsWereGranted) {
      emitSSE({ type: 'points_updated', data: { user_id: assignedTo } });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error uncompleting task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/templates - all templates
tasksRouter.get('/templates', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT tt.*
      FROM task_templates tt
      ORDER BY tt.title ASC
    `);

    // Normalise assigned_to + date columns to YYYY-MM-DD strings
    const rows = result.rows.map((t) => ({
      ...t,
      assigned_to: normaliseAssignedTo(t.assigned_to),
      due_date: pgDateToStr(t.due_date),
      valid_from: pgDateToStr(t.valid_from),
      valid_until: pgDateToStr(t.valid_until),
    }));

    res.json(rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/templates - create template
tasksRouter.post('/templates', async (req: Request, res: Response) => {
  try {
    const {
      title,
      points,
      assigned_to,
      recurrence,
      due_time,
      active,
      requires_approval,
      icon,
      category,
      due_date,
      valid_from,
      valid_until,
      rotation,
    } = req.body;

    if (!title || !recurrence) {
      return res.status(400).json({ error: 'title and recurrence are required' });
    }

    // Validate recurrence value
    const validRecurrence = /^(daily|weekly|once|weekdays:[a-z,]+)$/.test(recurrence);
    if (!validRecurrence) {
      return res.status(400).json({ error: 'Invalid recurrence value' });
    }

    // Normalise assigned_to → JSONB array or null
    const assignedToJson = normaliseAssignedTo(assigned_to);
    const assignedToParam = assignedToJson ? JSON.stringify(assignedToJson) : null;

    const result = await pool.query(`
      INSERT INTO task_templates (
        title, points, assigned_to, recurrence, due_time, active, requires_approval,
        icon, category, due_date, valid_from, valid_until, rotation
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      title,
      points ?? 1,
      assignedToParam,
      recurrence,
      due_time ?? null,
      active ?? true,
      requires_approval ?? false,
      icon ?? null,
      category ?? null,
      due_date ?? null,
      valid_from ?? null,
      valid_until ?? null,
      rotation ?? false,
    ]);

    const createdRow = result.rows[0];
    const created = {
      ...createdRow,
      assigned_to: normaliseAssignedTo(createdRow.assigned_to),
      due_date: pgDateToStr(createdRow.due_date),
      valid_from: pgDateToStr(createdRow.valid_from),
      valid_until: pgDateToStr(createdRow.valid_until),
    };

    res.status(201).json(created);

    // For once-templates with no due_date OR due_date <= today, trigger immediate
    // instance generation so the task appears right away (no waiting for cron).
    // Fire-and-forget: the response is already sent.
    // Direct generateDailyTasks() — not ensureTodayTasksGenerated() — because we
    // want to bypass the per-day memo cache (a new template may need new rows
    // even if today was already "ensured" earlier).
    if (recurrence === 'once') {
      const today = getTodayInAppTz();
      const dueStr = pgDateToStr(createdRow.due_date);
      if (!dueStr || dueStr <= today) {
        generateDailyTasks().catch((err) =>
          console.error('[tasks] Immediate generation after create failed:', err),
        );
      }
    } else if (active !== false) {
      // For recurring templates starting today (valid_from in the past or null),
      // also trigger an immediate run so the row appears on today's list.
      const today = getTodayInAppTz();
      const fromStr = pgDateToStr(createdRow.valid_from);
      if (!fromStr || fromStr <= today) {
        generateDailyTasks().catch((err) =>
          console.error('[tasks] Immediate generation after create failed:', err),
        );
      }
    }
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/templates/:id - update template
tasksRouter.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      points,
      assigned_to,
      recurrence,
      due_time,
      active,
      requires_approval,
      icon,
      category,
      due_date,
      valid_from,
      valid_until,
      rotation,
    } = req.body;

    const existing = await pool.query(`SELECT * FROM task_templates WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const current = existing.rows[0];

    const newAssigned = assigned_to !== undefined
      ? normaliseAssignedTo(assigned_to)
      : normaliseAssignedTo(current.assigned_to);
    const assignedParam = newAssigned ? JSON.stringify(newAssigned) : null;

    const result = await pool.query(`
      UPDATE task_templates
      SET
        title = $1,
        points = $2,
        assigned_to = $3::jsonb,
        recurrence = $4,
        due_time = $5,
        active = $6,
        requires_approval = $7,
        icon = $8,
        category = $9,
        due_date = $10,
        valid_from = $11,
        valid_until = $12,
        rotation = $13
      WHERE id = $14
      RETURNING *
    `, [
      title ?? current.title,
      points ?? current.points,
      assignedParam,
      recurrence ?? current.recurrence,
      due_time !== undefined ? due_time : current.due_time,
      active !== undefined ? active : current.active,
      requires_approval !== undefined ? requires_approval : current.requires_approval,
      icon !== undefined ? icon : current.icon,
      category !== undefined ? category : current.category,
      due_date !== undefined ? due_date : current.due_date,
      valid_from !== undefined ? valid_from : current.valid_from,
      valid_until !== undefined ? valid_until : current.valid_until,
      rotation !== undefined ? rotation : current.rotation,
      id,
    ]);

    const updatedRow = result.rows[0];
    res.json({
      ...updatedRow,
      assigned_to: normaliseAssignedTo(updatedRow.assigned_to),
      due_date: pgDateToStr(updatedRow.due_date),
      valid_from: pgDateToStr(updatedRow.valid_from),
      valid_until: pgDateToStr(updatedRow.valid_until),
    });

    // If the patch changes the template into "should be visible today" state,
    // trigger an immediate generation. Cheap due to idempotency (UNIQUE constraint).
    // Direct generateDailyTasks() to bypass the per-day memo cache.
    if (updatedRow.active) {
      const today = getTodayInAppTz();
      const recur = updatedRow.recurrence;
      const dueStr = pgDateToStr(updatedRow.due_date);
      const fromStr = pgDateToStr(updatedRow.valid_from);
      const untilStr = pgDateToStr(updatedRow.valid_until);

      const inRange = (!fromStr || fromStr <= today) && (!untilStr || untilStr >= today);
      const onceMatch = recur === 'once' && (!dueStr || dueStr <= today);

      if (onceMatch || (recur !== 'once' && inRange)) {
        generateDailyTasks().catch((err) =>
          console.error('[tasks] Immediate generation after patch failed:', err),
        );
      }
    }
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/templates/:id - delete template + all its instances
tasksRouter.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(`SELECT id FROM task_templates WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Instances are deleted via ON DELETE CASCADE
    await pool.query(`DELETE FROM task_templates WHERE id = $1`, [id]);

    emitSSE({ type: 'task_updated', data: { template_id: id, deleted: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/instances - create one-off instance (ad-hoc, not via template generation)
tasksRouter.post('/instances', async (req: Request, res: Response) => {
  try {
    const { template_id, assigned_to, date } = req.body;

    if (!template_id || !assigned_to || !date) {
      return res.status(400).json({ error: 'template_id, assigned_to, and date are required' });
    }

    // Check if instance already exists
    const existing = await pool.query(`
      SELECT id FROM task_instances
      WHERE template_id = $1 AND assigned_to = $2 AND date = $3
    `, [template_id, assigned_to, date]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Instance already exists for this date' });
    }

    const result = await pool.query(`
      INSERT INTO task_instances (template_id, assigned_to, date)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [template_id, assigned_to, date]);

    emitSSE({ type: 'task_updated', data: { task_id: result.rows[0].id } });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task instance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
