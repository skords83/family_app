import { pool } from './pool';
import { schema } from './schema';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Running schema migration before seeding...');
    await client.query(schema);

    // Check if already seeded
    const existing = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Database already seeded. Skipping.');
      return;
    }

    console.log('Seeding users...');
    const mamaResult = await client.query(
      `INSERT INTO users (name, avatar, color, pin, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Mama', '👩', '#f59e0b', null, 'parent']
    );
    const mamaId = mamaResult.rows[0].id;

    const papaResult = await client.query(
      `INSERT INTO users (name, avatar, color, pin, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Papa', '👨', '#3b82f6', null, 'parent']
    );
    const papaId = papaResult.rows[0].id;

    const paulResult = await client.query(
      `INSERT INTO users (name, avatar, color, pin, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Paul', '🧒', '#10b981', null, 'child']
    );
    const paulId = paulResult.rows[0].id;

    const johannaResult = await client.query(
      `INSERT INTO users (name, avatar, color, pin, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Johanna', '👧', '#ec4899', null, 'child']
    );
    const johannaId = johannaResult.rows[0].id;

    console.log(`Created users: Mama(${mamaId}), Papa(${papaId}), Paul(${paulId}), Johanna(${johannaId})`);

    console.log('Seeding task templates...');
    await client.query(
      `INSERT INTO task_templates (title, points, assigned_to, recurrence, due_time, active) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Zähne putzen', 2, paulId, 'daily', '08:00', true]
    );
    await client.query(
      `INSERT INTO task_templates (title, points, assigned_to, recurrence, due_time, active) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Zähne putzen', 2, johannaId, 'daily', '08:00', true]
    );
    await client.query(
      `INSERT INTO task_templates (title, points, assigned_to, recurrence, due_time, active) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Zimmer aufräumen', 5, null, 'daily', null, true]
    );
    await client.query(
      `INSERT INTO task_templates (title, points, assigned_to, recurrence, due_time, active) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Hausaufgaben', 3, null, 'daily', null, true]
    );
    await client.query(
      `INSERT INTO task_templates (title, points, assigned_to, recurrence, due_time, active) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Müll rausbringen', 10, null, 'weekly', null, true]
    );

    console.log('Seeding rewards...');
    await client.query(
      `INSERT INTO rewards (title, points_cost, available_to, active) VALUES ($1, $2, $3, $4)`,
      ['1h Extra-Screentime', 50, null, true]
    );
    await client.query(
      `INSERT INTO rewards (title, points_cost, available_to, active) VALUES ($1, $2, $3, $4)`,
      ['Wunschessen', 100, null, true]
    );
    await client.query(
      `INSERT INTO rewards (title, points_cost, available_to, active) VALUES ($1, $2, $3, $4)`,
      ['Ausflug', 200, null, true]
    );

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
