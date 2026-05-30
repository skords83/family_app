import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

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
    const today = new Date().toISOString().split('T')[0];
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
      `, [task.assigned_to, task.points, `task:${id}`]);
      return res.json({ success: true, points_earned: task.points, pending_approval: false });
    }

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
    `, [task.assigned_to, task.points, `task:${id}`]);

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
      `, [`task:${id}`, task.assigned_to]);
    }

    // Clear completed + approval state
    await pool.query(`
      UPDATE task_instances
      SET completed_at = NULL, completed_by = NULL, approved_at = NULL, approved_by = NULL
      WHERE id = $1
    `, [id]);

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

    // Normalise assigned_to: always return a string[] or null
    const rows = result.rows.map((t) => ({
      ...t,
      assigned_to: normaliseAssignedTo(t.assigned_to),
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
    const { title, points, assigned_to, recurrence, due_time, active, requires_approval } = req.body;

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
      INSERT INTO task_templates (title, points, assigned_to, recurrence, due_time, active, requires_approval)
      VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
      RETURNING *
    `, [title, points ?? 1, assignedToParam, recurrence, due_time ?? null, active ?? true, requires_approval ?? false]);

    res.status(201).json({
      ...result.rows[0],
      assigned_to: normaliseAssignedTo(result.rows[0].assigned_to),
    });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/templates/:id - update template
tasksRouter.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, points, assigned_to, recurrence, due_time, active, requires_approval } = req.body;

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
        requires_approval = $7
      WHERE id = $8
      RETURNING *
    `, [
      title ?? current.title,
      points ?? current.points,
      assignedParam,
      recurrence ?? current.recurrence,
      due_time !== undefined ? due_time : current.due_time,
      active !== undefined ? active : current.active,
      requires_approval !== undefined ? requires_approval : current.requires_approval,
      id,
    ]);

    res.json({
      ...result.rows[0],
      assigned_to: normaliseAssignedTo(result.rows[0].assigned_to),
    });
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

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/instances - create one-off instance
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

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task instance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});