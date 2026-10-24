import { Pool } from 'pg';
import { migratePlaintextPasswords } from '../auth';

export async function runStartupMigrations(pool: Pool): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_code_key;
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

      ALTER TABLE availability_registrations DROP CONSTRAINT IF EXISTS availability_registrations_availability_type_check;
      ALTER TABLE availability_registrations DROP CONSTRAINT IF EXISTS availability_registrations_user_id_fkey;
      ALTER TABLE availability_registrations ADD COLUMN IF NOT EXISTS custom_hours VARCHAR(100);
      ALTER TABLE availability_registrations ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);

      ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_published_by_fkey;
      ALTER TABLE schedules ALTER COLUMN published_by TYPE VARCHAR(255);
      ALTER TABLE schedules ADD COLUMN IF NOT EXISTS published_at_str VARCHAR(100);
      ALTER TABLE schedules ADD COLUMN IF NOT EXISTS shortage_warnings JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE schedules ADD COLUMN IF NOT EXISTS override_proposals JSONB DEFAULT '[]'::jsonb;

      ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);
      ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS slot_id VARCHAR(150);
      ALTER TABLE shift_assignments DROP CONSTRAINT IF EXISTS shift_assignments_role_id_fkey;
      ALTER TABLE shift_assignments DROP CONSTRAINT IF EXISTS shift_assignments_user_id_fkey;

      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS assignment_id VARCHAR(150);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS role_id VARCHAR(50);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS requester_name VARCHAR(255);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS target_user_name VARCHAR(255);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS custom_start_time VARCHAR(20);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS custom_end_time VARCHAR(20);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS is_open_market BOOLEAN DEFAULT FALSE;
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS claimed_by_user_id VARCHAR(50);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS claimed_by_user_name VARCHAR(255);
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS peer_status VARCHAR(30) DEFAULT 'not_required';
      ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS peer_responded_at VARCHAR(100);
      ALTER TABLE shift_requests DROP CONSTRAINT IF EXISTS shift_requests_requester_id_fkey;
      ALTER TABLE shift_requests DROP CONSTRAINT IF EXISTS shift_requests_target_user_id_fkey;
      ALTER TABLE shift_requests DROP CONSTRAINT IF EXISTS shift_requests_reviewer_id_fkey;
    `);
  } catch (err: any) {
    console.warn('[Startup Schema Sync Warning]:', err.message);
  }

  try {
    await migratePlaintextPasswords(pool);
  } catch (err: any) {
    console.warn('[Startup Migration Warning]:', err.message);
  }
}
