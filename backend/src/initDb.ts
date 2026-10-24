import fs from 'fs';
import path from 'path';
import { pool, checkDbConnection, isNeonConfigured } from './db';

async function initDatabase() {
  console.log('--- KHỞI TẠO NEON POSTGRESQL DATABASE ---');

  if (!isNeonConfigured) {
    console.error('❌ Lỗi: DATABASE_URL chưa được thiết lập trong server/.env');
    console.log('👉 Vui lòng mở server/.env và dán connection string từ Neon vào biến DATABASE_URL');
    process.exit(1);
  }

  const health = await checkDbConnection();
  if (!health.connected) {
    console.error(`❌ ${health.message}`);
    process.exit(1);
  }

  console.log(`✅ ${health.message}`);
  console.log(`📡 Database Version: ${health.version}`);

  const schemaPath = path.resolve(__dirname, '../schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Không tìm thấy file schema tại: ${schemaPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('⏳ Đang thực thi migration schema & seed data lên Neon...');

  try {
    const client = await pool.connect();
    await client.query(sql);
    client.release();
    console.log('🎉 Khởi tạo cơ sở dữ liệu Neon thành công 100%!');
    console.log('   Các bảng: branches, roles, users, line_configs, line_requirements, schedules, shift_requests, payroll_records, audit_logs đã sẵn sàng.');
  } catch (err: any) {
    console.error('❌ Lỗi khi thực thi SQL schema:', err.message);
  } finally {
    await pool.end();
  }
}

initDatabase();
