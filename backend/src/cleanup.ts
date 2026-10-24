import { pool, isNeonConfigured } from './db';

async function migrateAndClean() {
  if (!isNeonConfigured) {
    console.log('Neon is not configured.');
    return;
  }
  const client = await pool.connect();
  try {
    console.log('Running schema migrations on Neon PostgreSQL...');
    await client.query(`
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS salary_calculation_type VARCHAR(30) DEFAULT 'employee_seniority_rate';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS base_hourly_rate NUMERIC(12, 2) DEFAULT 30000.00;
    `);
    console.log('Migrations applied successfully.');

    // Check all branches
    const branchRes = await client.query('SELECT * FROM branches');
    console.log('Branches in DB:', branchRes.rows.map(b => ({ id: b.id, code: b.code, name: b.name })));

    // Check all users
    const userRes = await client.query('SELECT id, branch_id, employee_code, full_name, role_type FROM users');
    console.log('Users in DB:', userRes.rows);

    // Keep Admin Tổng
    await client.query(`
      UPDATE users 
      SET branch_id = NULL, role_type = 'super_admin', full_name = 'Trần Minh Tuấn (Admin Tổng)'
      WHERE id = 'USR-SUPER-01' OR employee_code = 'ADM-ALL';
    `);

    // Clean out old dummy employees EMP-001..EMP-010 if they were just seed dummy data
    // Let's delete the old seed dummy users from BR-HCM-01/02
    const deletedSeedUsers = await client.query(`
      DELETE FROM users 
      WHERE id IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005', 'EMP-006', 'EMP-007', 'EMP-008', 'EMP-009', 'EMP-010')
        AND branch_id = 'BR-HCM-01';
    `);
    console.log(`Deleted ${deletedSeedUsers.rowCount} old seed mock employees.`);

    // If USR-ADMIN-NVL has null branch_id, link it to BR-NVL
    await client.query(`
      UPDATE users 
      SET branch_id = 'BR-NVL' 
      WHERE employee_code = 'ADM-NVL' AND branch_id IS NULL;
    `);

    // Clean orphaned records
    await client.query(`DELETE FROM user_skills WHERE user_id NOT IN (SELECT id FROM users);`);
    await client.query(`DELETE FROM user_wage_rates WHERE user_id NOT IN (SELECT id FROM users);`);
    await client.query(`DELETE FROM shift_assignments WHERE user_id NOT IN (SELECT id FROM users);`);
    await client.query(`DELETE FROM shift_requests WHERE requester_id NOT IN (SELECT id FROM users);`);
    await client.query(`DELETE FROM availability_registrations WHERE user_id NOT IN (SELECT id FROM users);`);

    const finalUsers = await client.query('SELECT id, branch_id, employee_code, full_name, role_type FROM users');
    console.log('Remaining clean users in DB:', finalUsers.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAndClean();
