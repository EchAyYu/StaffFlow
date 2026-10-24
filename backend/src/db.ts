import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const isNeonConfigured = Boolean(
  connectionString &&
  !connectionString.includes('YOUR_PASSWORD_HERE') &&
  connectionString.startsWith('postgres')
);

export const pool = new Pool({
  connectionString: isNeonConfigured ? connectionString : undefined,
  ssl: isNeonConfigured ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function checkDbConnection(): Promise<{ connected: boolean; message: string; version?: string }> {
  if (!isNeonConfigured) {
    return {
      connected: false,
      message: 'Chưa cấu hình DATABASE_URL trong server/.env (vui lòng dán chuỗi kết nối từ Neon Dashboard).',
    };
  }

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT version();');
    client.release();
    return {
      connected: true,
      message: 'Kết nối Neon PostgreSQL thành công!',
      version: res.rows[0]?.version,
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Lỗi kết nối Neon: ${error.message}`,
    };
  }
}
