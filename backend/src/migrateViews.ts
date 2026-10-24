import { pool } from './db';

async function run() {
  const client = await pool.connect();
  try {
    // 1. Add username column if not exists
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);');

    // 2. Create convenient VIEWs for employees / nhan_vien so that anyone browsing Neon DB sees them immediately
    await client.query(`
      CREATE OR REPLACE VIEW employees AS 
      SELECT 
        id, 
        branch_id, 
        employee_code, 
        full_name, 
        email, 
        username, 
        password_hash, 
        role_type, 
        gender, 
        dob, 
        joined_date, 
        employment_type, 
        phone, 
        base_hourly_rate, 
        status, 
        created_at, 
        updated_at
      FROM users;
    `);

    await client.query('CREATE OR REPLACE VIEW nhan_vien AS SELECT * FROM employees;');

    console.log('Successfully updated Neon DB schema: added username column and employees/nhan_vien views.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
