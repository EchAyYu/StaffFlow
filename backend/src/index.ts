import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, checkDbConnection, isNeonConfigured } from './db.js';
import { hashPassword, comparePassword, isBcryptHash, migratePlaintextPasswords } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Auto-migrate schema constraints and plaintext passwords in Neon DB
if (isNeonConfigured) {
  pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
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
  `).catch((err) => {
    console.warn('[Startup Schema Sync Warning]:', err.message);
  });

  migratePlaintextPasswords(pool).catch((err) => {
    console.warn('[Startup Migration Warning]:', err.message);
  });
}

const DEFAULT_ROLE_META: Record<string, { name: string; desc: string; gender: string; rate: number; calc: string }> = {
  SEC: { name: 'Bảo Vệ', desc: 'An ninh, dắt xe và hướng dẫn khách hàng (Chỉ Nam)', gender: 'male_only', rate: 35000, calc: 'employee_seniority_rate' },
  BAR: { name: 'Pha Chế', desc: 'Barista chuyên pha chế trà sữa, cà phê', gender: 'any', rate: 55000, calc: 'employee_seniority_rate' },
  SRV: { name: 'Phục Vụ', desc: 'Tiếp đón khách hàng, order và dọn bàn', gender: 'any', rate: 45000, calc: 'employee_seniority_rate' },
  KIT: { name: 'Bếp', desc: 'Chuẩn bị đồ ăn nhanh và topping tươi', gender: 'any', rate: 50000, calc: 'fixed_role_rate' },
  INV: { name: 'Soạn Hàng', desc: 'Kiểm kê, xuất nhập kho và đóng gói', gender: 'any', rate: 46000, calc: 'fixed_role_rate' },
};

async function syncUserSkillsSafely(client: any, userId: string, branchId: string | null, skills: string[]) {
  if (!Array.isArray(skills)) return;
  await client.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);

  for (const skillId of skills) {
    if (!skillId) continue;
    const roleCheck = await client.query('SELECT id FROM roles WHERE id = $1', [skillId]);
    if (roleCheck.rows.length === 0) {
      const parts = skillId.split('-');
      const code = parts[1] || skillId;
      const meta = DEFAULT_ROLE_META[code] || {
        name: code,
        desc: `Vai trò ${code}`,
        gender: 'any',
        rate: 45000,
        calc: 'employee_seniority_rate',
      };
      let validBranchId = branchId || null;
      if (validBranchId) {
        const bCheck = await client.query('SELECT id FROM branches WHERE id = $1', [validBranchId]);
        if (bCheck.rows.length === 0) validBranchId = null;
      }
      await client.query(`
        INSERT INTO roles (id, branch_id, code, name, description, gender_requirement, default_hourly_rate, salary_calculation_type, is_system_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        ON CONFLICT (id) DO NOTHING
      `, [skillId, validBranchId, code, meta.name, meta.desc, meta.gender, meta.rate, meta.calc]);
    }
    await client.query(
      'INSERT INTO user_skills (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, skillId]
    );
  }
}

// ============================================================================
// 1. HEALTHCHECK & DATABASE STATUS
// ============================================================================
app.get('/api/health', async (req, res) => {
  const dbHealth = await checkDbConnection();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    neonPostgres: dbHealth,
    server: {
      uptime: process.uptime(),
      nodeVersion: process.version,
    },
  });
});

// ============================================================================
// 1.1 AUTHENTICATION & SECURE LOGIN (Bcrypt Verification)
// ============================================================================
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  const query = (identifier || '').trim().toLowerCase();
  const enteredPassword = (password || '').trim();

  if (!query || !enteredPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản/email và mật khẩu.' });
  }

  if (!isNeonConfigured) {
    return res.status(503).json({ error: 'Cơ sở dữ liệu chưa sẵn sàng.' });
  }

  try {
    const client = await pool.connect();
    try {
      // 1. Tìm trong bảng users theo email, employee_code, hoặc username
      const userRes = await client.query(`
        SELECT u.*, b.name as branch_name, b.code as branch_code
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE LOWER(u.email) = $1 
           OR LOWER(u.employee_code) = $1
           OR LOWER(COALESCE(u.username, '')) = $1
           OR LOWER(SPLIT_PART(u.email, '@', 1)) = $1
      `, [query]);

      let user = userRes.rows[0];
      let branch = null;

      // 2. Nếu chưa thấy, tìm kiếm trong bảng branches theo admin_username, admin_email, hoặc code
      if (!user) {
        const branchRes = await client.query(`
          SELECT * FROM branches 
          WHERE LOWER(admin_username) = $1 
             OR LOWER(admin_email) = $1
             OR LOWER(code) = $1
             OR LOWER(SPLIT_PART(admin_email, '@', 1)) = $1
        `, [query]);

        if (branchRes.rows.length > 0) {
          branch = branchRes.rows[0];
          // Tìm user branch_admin tương ứng trong bảng users
          const adminUserRes = await client.query(`
            SELECT * FROM users WHERE branch_id = $1 AND role_type = 'branch_admin'
          `, [branch.id]);

          if (adminUserRes.rows.length > 0) {
            user = adminUserRes.rows[0];
          } else {
            // Tự động đồng bộ tài khoản admin chi nhánh vào bảng users
            const adminUserId = `USR-ADMIN-${branch.code}`;
            const hashedPassword = await hashPassword(branch.admin_password || enteredPassword);
            const createdRes = await client.query(`
              INSERT INTO users (id, branch_id, employee_code, full_name, email, password_hash, role_type, gender, employment_type, status)
              VALUES ($1, $2, $3, $4, $5, $6, 'branch_admin', 'male', 'full_time', 'active')
              ON CONFLICT (id) DO UPDATE 
              SET branch_id = EXCLUDED.branch_id,
                  password_hash = EXCLUDED.password_hash
              RETURNING *
            `, [
              adminUserId,
              branch.id,
              `ADM-${branch.code}`,
              branch.admin_name || `Admin ${branch.name}`,
              branch.admin_email || `${branch.admin_username || 'admin'}@company.com`,
              hashedPassword,
            ]);
            user = createdRes.rows[0];
          }
        }
      }

      if (!user) {
        return res.status(404).json({ error: 'Tài khoản hoặc email không tồn tại trên hệ thống.' });
      }

      // 3. Kiểm tra mật khẩu (hỗ trợ hash bcrypt và graceful fallback cho mật khẩu cũ)
      let passwordToCompare = user.password_hash;
      if (!passwordToCompare && branch?.admin_password) {
        passwordToCompare = branch.admin_password;
      }

      let isValid = await comparePassword(enteredPassword, passwordToCompare);

      if (!isValid && branch?.admin_password) {
        isValid = await comparePassword(enteredPassword, branch.admin_password);
      }

      // Mật khẩu mặc định khởi tạo an toàn (nếu chưa đổi sang mật khẩu mới)
      if (!isValid && user.role_type === 'super_admin' && !isBcryptHash(user.password_hash) && enteredPassword === 'Admin@2026') {
        isValid = true;
      }

      if (!isValid) {
        return res.status(401).json({ error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.' });
      }

      // 4. Tự động mã hóa mật khẩu sang bcrypt trong Neon DB nếu còn là plaintext
      if (!isBcryptHash(user.password_hash)) {
        const newHash = await hashPassword(enteredPassword);
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
        if (branch && !isBcryptHash(branch.admin_password)) {
          await client.query('UPDATE branches SET admin_password = $1 WHERE id = $2', [newHash, branch.id]);
        }
        console.log(`[Auth Login] Automatically upgraded password to bcrypt for: ${user.full_name}`);
      }

      // Lấy danh sách kỹ năng của nhân sự
      const skillsRes = await client.query('SELECT role_id FROM user_skills WHERE user_id = $1', [user.id]);
      const skills = skillsRes.rows.map((r) => r.role_id);

      const sanitizedUser = {
        id: user.id,
        branchId: user.branch_id || (branch ? branch.id : null),
        employeeCode: user.employee_code,
        name: user.full_name,
        email: user.email,
        username: user.username || (user.email ? user.email.split('@')[0] : user.employee_code),
        roleType: user.role_type,
        gender: user.gender,
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '1998-01-01',
        joinedDate: user.joined_date ? new Date(user.joined_date).toISOString().split('T')[0] : '2026-01-01',
        employmentType: user.employment_type,
        phone: user.phone || '',
        status: user.status,
        baseHourlyRate: Number(user.base_hourly_rate) || 30000,
        skills,
        wageRates: {},
      };

      return res.json({
        success: true,
        user: sanitizedUser,
        branch: branch || (user.branch_id ? { id: user.branch_id, name: user.branch_name, code: user.branch_code } : null),
        message: `Đăng nhập thành công! Chào mừng ${user.full_name}.`,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Auth Login Exception]:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập: ' + err.message });
  }
});

// ============================================================================
// 1.2 KHỞI TẠO ĐỒNG BỘ DỮ LIỆU ĐẦU TIÊN (Initial State for Frontend)
// ============================================================================
app.get('/api/initial-state', async (req, res) => {
  if (isNeonConfigured) {
    try {
      const branchesRes = await pool.query('SELECT * FROM branches ORDER BY code ASC');
      const usersRes = await pool.query(`
        SELECT u.*, 
               COALESCE(array_agg(us.role_id) FILTER (WHERE us.role_id IS NOT NULL), '{}') as skills
        FROM users u
        LEFT JOIN user_skills us ON u.id = us.user_id
        GROUP BY u.id
        ORDER BY u.employee_code ASC
      `);
      const rolesRes = await pool.query('SELECT * FROM roles ORDER BY code ASC');
      const lineConfigsRes = await pool.query('SELECT * FROM line_configs ORDER BY line_code ASC');
      const lineReqsRes = await pool.query('SELECT * FROM line_requirements');
      const availRes = await pool.query(`
        SELECT ar.*, u.branch_id as user_branch_id
        FROM availability_registrations ar
        LEFT JOIN users u ON ar.user_id = u.id
        ORDER BY ar.submitted_at DESC
      `);
      const schedulesRes = await pool.query('SELECT * FROM schedules ORDER BY last_modified_at DESC');
      const assignmentsRes = await pool.query('SELECT * FROM shift_assignments ORDER BY slot_index ASC');
      const shiftReqRes = await pool.query(`
        SELECT sr.*,
               COALESCE(sr.requester_name, u1.full_name) as resolved_requester_name,
               COALESCE(sr.target_user_name, u2.full_name) as resolved_target_name
        FROM shift_requests sr
        LEFT JOIN users u1 ON sr.requester_id = u1.id
        LEFT JOIN users u2 ON sr.target_user_id = u2.id
        ORDER BY sr.created_at DESC
      `);
      const payrollRes = await pool.query('SELECT * FROM payroll_records');
      const auditRes = await pool.query(`
        SELECT al.*, u.full_name as actor_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 100
      `);

      const branches = branchesRes.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        address: row.address || '',
        phone: row.phone || '',
        standardMonthlyHours: Number(row.standard_monthly_hours) || 208,
        maxFulltimeOffDays: Number(row.max_fulltime_off_days) || 4,
        maxParttimeOffDays: Number(row.max_parttime_off_days) || 8,
        adminName: row.admin_name || '',
        adminUsername: row.admin_username || '',
        adminPassword: row.admin_password || '',
        adminEmail: row.admin_email || '',
        ...row,
      }));

      const employees = usersRes.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        employeeCode: row.employee_code,
        name: row.full_name,
        email: row.email,
        username: row.username || (row.email ? row.email.split('@')[0] : row.employee_code),
        roleType: row.role_type,
        gender: row.gender,
        dob: row.dob ? new Date(row.dob).toISOString().split('T')[0] : '1998-01-01',
        joinedDate: row.joined_date ? new Date(row.joined_date).toISOString().split('T')[0] : '2026-01-01',
        employmentType: row.employment_type,
        phone: row.phone || '',
        status: row.status,
        baseHourlyRate: Number(row.base_hourly_rate) || 30000,
        skills: Array.isArray(row.skills) ? row.skills : [],
        wageRates: {},
      }));

      const roles = rolesRes.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        code: row.code,
        name: row.name,
        description: row.description || '',
        genderRequirement: row.gender_requirement || 'any',
        defaultHourlyRate: Number(row.default_hourly_rate) || 45000,
        salaryCalculationType: row.salary_calculation_type || 'employee_seniority_rate',
        isSystemDefault: Boolean(row.is_system_default),
      }));

      const lineConfigs = lineConfigsRes.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id || '',
        lineCode: row.line_code,
        lineName: row.line_name,
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : '05:30',
        endTime: row.end_time ? String(row.end_time).slice(0, 5) : '12:00',
        durationHours: Number(row.duration_hours) || 6.5,
        description: row.description || '',
      }));

      const lineRequirements = lineReqsRes.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id || '',
        lineCode: row.line_code,
        roleId: row.role_id,
        headcountRequired: Number(row.headcount_required) ?? 1,
      }));

      // Group availability_registrations by (user_id, week_start_date)
      const regMap = new Map<string, any>();
      for (const row of availRes.rows) {
        const weekStr = row.week_start_date
          ? new Date(row.week_start_date).toISOString().split('T')[0]
          : '2026-10-19';
        const key = `${row.user_id}__${weekStr}`;
        if (!regMap.has(key)) {
          regMap.set(key, {
            id: `REG-${row.user_id}-${weekStr}`,
            userId: row.user_id,
            branchId: row.branch_id || row.user_branch_id || '',
            weekStartDate: weekStr,
            slots: {
              monday: 'A',
              tuesday: 'A',
              wednesday: 'A',
              thursday: 'A',
              friday: 'A',
              saturday: 'A',
              sunday: 'OFF',
            },
            dayCustomHours: {},
            note: row.note || '',
            submittedAt: row.submitted_at
              ? new Date(row.submitted_at).toLocaleString('vi-VN')
              : new Date().toLocaleString('vi-VN'),
          });
        }
        const entry = regMap.get(key);
        if (row.day_of_week) {
          entry.slots[row.day_of_week] = row.availability_type;
          if (row.custom_hours) {
            entry.dayCustomHours[row.day_of_week] = row.custom_hours;
          }
        }
        if (row.note) {
          entry.note = row.note;
        }
      }
      const registrations = Array.from(regMap.values());

      // Format schedules and attach assignments
      const assignmentsBySched = new Map<string, any[]>();
      for (const row of assignmentsRes.rows) {
        const sid = row.schedule_id;
        if (!assignmentsBySched.has(sid)) {
          assignmentsBySched.set(sid, []);
        }
        const rawSlotId =
          row.slot_id ||
          (typeof row.id === 'string' && row.id.includes('__') ? row.id.split('__').slice(1).join('__') : row.id);
        assignmentsBySched.get(sid)!.push({
          id: rawSlotId,
          scheduleId: row.schedule_id,
          branchId: row.branch_id || '',
          day: row.day_of_week,
          lineCode: row.line_code,
          roleId: row.role_id,
          slotIndex: Number(row.slot_index) || 0,
          userId: row.user_id || null,
          customStartTime: row.custom_start_time ? String(row.custom_start_time).slice(0, 5) : undefined,
          customEndTime: row.custom_end_time ? String(row.custom_end_time).slice(0, 5) : undefined,
          isOverride: Boolean(row.is_override),
          overrideReason: row.override_reason || undefined,
        });
      }

      const schedules = schedulesRes.rows.map((row) => {
        const weekStart = row.week_start_date
          ? new Date(row.week_start_date).toISOString().split('T')[0]
          : '2026-10-19';
        const weekEnd = row.week_end_date
          ? new Date(row.week_end_date).toISOString().split('T')[0]
          : '2026-10-25';
        const schedAssignments = (assignmentsBySched.get(row.id) || []).map((a) => ({
          ...a,
          branchId: a.branchId || row.branch_id || '',
        }));
        return {
          id: row.id,
          branchId: row.branch_id || '',
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          status: row.status || 'draft',
          version: Number(row.version) || 1,
          publishedAt:
            row.published_at_str ||
            (row.published_at ? new Date(row.published_at).toLocaleString('vi-VN') : undefined),
          publishedBy: row.published_by || undefined,
          lastModifiedAt: row.last_modified_at
            ? new Date(row.last_modified_at).toISOString()
            : new Date().toISOString(),
          assignments: schedAssignments,
          shortageWarnings: Array.isArray(row.shortage_warnings) ? row.shortage_warnings : [],
          overrideProposals: Array.isArray(row.override_proposals) ? row.override_proposals : [],
        };
      });

      const shiftRequests = shiftReqRes.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id || '',
        requestType: row.request_type,
        assignmentId: row.assignment_id || undefined,
        roleId: row.role_id || undefined,
        requesterId: row.requester_id,
        requesterName: row.resolved_requester_name || row.requester_name || row.requester_id,
        targetUserId: row.target_user_id || undefined,
        targetUserName: row.resolved_target_name || row.target_user_name || undefined,
        day: row.day_of_week,
        lineCode: row.line_code || undefined,
        customStartTime: row.custom_start_time || undefined,
        customEndTime: row.custom_end_time || undefined,
        targetDay: row.target_day_of_week || undefined,
        targetLineCode: row.target_line_code || undefined,
        reason: row.reason || '',
        status: row.status || 'pending',
        reviewerId: row.reviewer_id || undefined,
        reviewNote: row.review_note || undefined,
        createdAt: row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '',
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toLocaleString('vi-VN') : undefined,
        isOpenMarket: Boolean(row.is_open_market),
        claimedByUserId: row.claimed_by_user_id || undefined,
        claimedByUserName: row.claimed_by_user_name || undefined,
        peerStatus: row.peer_status || 'not_required',
        peerRespondedAt: row.peer_responded_at || undefined,
      }));

      const payrollOtMap: Record<string, number> = {};
      for (const row of payrollRes.rows) {
        if (row.user_id) {
          payrollOtMap[row.user_id] = Number(row.ot_hours) || 0;
        }
      }

      const auditLogs = auditRes.rows.map((row) => ({
        id: String(row.id),
        branchId: row.branch_id || '',
        actorName: row.actor_name || (row.details && row.details.actorName) || 'Hệ thống',
        actionType: row.action_type,
        entityType: row.entity_type,
        details:
          typeof row.details === 'object' && row.details !== null
            ? row.details.message || JSON.stringify(row.details)
            : String(row.details || ''),
        timestamp: row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '',
      }));

      return res.json({
        branches,
        employees,
        roles,
        lineConfigs,
        lineRequirements,
        registrations,
        schedules,
        shiftRequests,
        payrollOtMap,
        auditLogs,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({
    branches: [],
    employees: [],
    roles: [],
    lineConfigs: [],
    lineRequirements: [],
    registrations: [],
    schedules: [],
    shiftRequests: [],
    payrollOtMap: {},
    auditLogs: [],
  });
});

// ============================================================================
// 2. CHI NHÁNH (Branches - Admin Tổng)
// ============================================================================
app.get('/api/branches', async (req, res) => {
  if (isNeonConfigured) {
    try {
      const result = await pool.query('SELECT * FROM branches ORDER BY code ASC');
      const formatted = result.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        address: row.address || '',
        phone: row.phone || '',
        standardMonthlyHours: Number(row.standard_monthly_hours) || 208,
        maxFulltimeOffDays: Number(row.max_fulltime_off_days) || 4,
        maxParttimeOffDays: Number(row.max_parttime_off_days) || 8,
        adminName: row.admin_name || '',
        adminUsername: row.admin_username || '',
        adminPassword: row.admin_password || '',
        adminEmail: row.admin_email || '',
        ...row,
      }));
      return res.json(formatted);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.post('/api/branches', async (req, res) => {
  const code = req.body.code;
  const name = req.body.name;
  const address = req.body.address;
  const phone = req.body.phone;
  const standard_monthly_hours = req.body.standard_monthly_hours || req.body.standardMonthlyHours || 208;
  const max_fulltime_off_days = req.body.max_fulltime_off_days || req.body.maxFulltimeOffDays || 4;
  const max_parttime_off_days = req.body.max_parttime_off_days || req.body.maxParttimeOffDays || 8;
  const admin_name = req.body.admin_name || req.body.adminName || null;
  const admin_username = req.body.admin_username || req.body.adminUsername || null;
  const rawAdminPass = req.body.admin_password || req.body.adminPassword || null;
  const admin_email = req.body.admin_email || req.body.adminEmail || null;
  const id = req.body.id;

  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const branchId = id || `BR-${code}`;

      // 1. Mã hóa mật khẩu bằng bcrypt trước khi lưu trữ
      const hashedAdminPassword = rawAdminPass ? await hashPassword(rawAdminPass) : null;

      // 2. Tạo chi nhánh
      const query = `
        INSERT INTO branches (
          id, code, name, address, phone, standard_monthly_hours, 
          max_fulltime_off_days, max_parttime_off_days,
          admin_name, admin_username, admin_password, admin_email
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const branchRes = await client.query(query, [
        branchId,
        code,
        name,
        address,
        phone,
        standard_monthly_hours,
        max_fulltime_off_days,
        max_parttime_off_days,
        admin_name,
        admin_username,
        hashedAdminPassword,
        admin_email,
      ]);

      // 3. Tự động cấp tài khoản Admin Chi Nhánh vào bảng users với mật khẩu bcrypt
      if (admin_username && hashedAdminPassword) {
        const adminUserId = `USR-ADMIN-${code}`;
        const finalEmail = admin_email || `${admin_username}@company.com`;
        await client.query(`
          INSERT INTO users (
            id, branch_id, employee_code, full_name, email, username,
            password_hash, role_type, gender, employment_type, phone, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'branch_admin', 'male', 'full_time', $8, 'active')
          ON CONFLICT (id) DO UPDATE 
          SET branch_id = EXCLUDED.branch_id,
              full_name = EXCLUDED.full_name,
              email = EXCLUDED.email,
              username = EXCLUDED.username,
              password_hash = EXCLUDED.password_hash,
              phone = EXCLUDED.phone
        `, [
          adminUserId,
          branchId,
          `ADM-${code}`,
          admin_name || `Admin ${name}`,
          finalEmail,
          admin_username.toLowerCase().trim(),
          hashedAdminPassword,
          phone || null
        ]);
      }

      // 3.1 Khởi tạo 5 vai trò chuẩn cho chi nhánh trong bảng roles
      const branchRolesToInsert = [
        { id: `ROLE-SEC-${code}`, code: 'SEC', name: 'Bảo Vệ', desc: 'An ninh, dắt xe và hướng dẫn khách hàng (Chỉ Nam)', gender: 'male_only', rate: 35000, calc: 'employee_seniority_rate' },
        { id: `ROLE-BAR-${code}`, code: 'BAR', name: 'Pha Chế', desc: 'Barista chuyên pha chế trà sữa, cà phê', gender: 'any', rate: 55000, calc: 'employee_seniority_rate' },
        { id: `ROLE-SRV-${code}`, code: 'SRV', name: 'Phục Vụ', desc: 'Tiếp đón khách hàng, order và dọn bàn', gender: 'any', rate: 45000, calc: 'employee_seniority_rate' },
        { id: `ROLE-KIT-${code}`, code: 'KIT', name: 'Bếp', desc: 'Chuẩn bị đồ ăn nhanh và topping tươi', gender: 'any', rate: 50000, calc: 'fixed_role_rate' },
        { id: `ROLE-INV-${code}`, code: 'INV', name: 'Soạn Hàng', desc: 'Kiểm kê, xuất nhập kho và đóng gói', gender: 'any', rate: 46000, calc: 'fixed_role_rate' },
      ];
      for (const r of branchRolesToInsert) {
        await client.query(`
          INSERT INTO roles (id, branch_id, code, name, description, gender_requirement, default_hourly_rate, salary_calculation_type, is_system_default)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
          ON CONFLICT (id) DO NOTHING
        `, [r.id, branchId, r.code, r.name, r.desc, r.gender, r.rate, r.calc]);
      }

      // 3.2 Khởi tạo 3 Line làm việc chuẩn (O, M, D) cho chi nhánh
      const branchLinesToInsert = [
        { id: `LINE-${code}-O`, lineCode: 'O', lineName: 'Line O — Open (Ca Mở Cửa / Sáng)', startTime: '05:30:00', endTime: '12:00:00', durationHours: 6.5, desc: 'Mở cửa quầy, nhận giao nhận nguyên liệu đá tươi và phục vụ khách sáng' },
        { id: `LINE-${code}-M`, lineCode: 'M', lineName: 'Line M — Mid (Ca Giữa / Trưa)', startTime: '11:00:00', endTime: '18:00:00', durationHours: 7.0, desc: 'Khung giờ giao lưu trưa, tiếp đón khách văn phòng và bàn ăn' },
        { id: `LINE-${code}-D`, lineCode: 'D', lineName: 'Line D — Down (Ca Tối / Đóng Cửa)', startTime: '17:00:00', endTime: '23:30:00', durationHours: 6.5, desc: 'Khung giờ cao điểm tối, vệ sinh máy pha và đóng quầy kiểm kê' },
      ];
      for (const l of branchLinesToInsert) {
        await client.query(`
          INSERT INTO line_configs (id, branch_id, line_code, line_name, start_time, end_time, duration_hours, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (branch_id, line_code) DO NOTHING
        `, [l.id, branchId, l.lineCode, l.lineName, l.startTime, l.endTime, l.durationHours, l.desc]);
      }

      // 3.3 Khởi tạo định mức nhân sự ban đầu theo Line cho chi nhánh
      const branchReqsToInsert = [
        { id: `REQ-${code}-O-SEC`, lineCode: 'O', roleId: `ROLE-SEC-${code}`, count: 1 },
        { id: `REQ-${code}-O-BAR`, lineCode: 'O', roleId: `ROLE-BAR-${code}`, count: 1 },
        { id: `REQ-${code}-O-SRV`, lineCode: 'O', roleId: `ROLE-SRV-${code}`, count: 1 },
        { id: `REQ-${code}-O-KIT`, lineCode: 'O', roleId: `ROLE-KIT-${code}`, count: 1 },
        { id: `REQ-${code}-M-SEC`, lineCode: 'M', roleId: `ROLE-SEC-${code}`, count: 1 },
        { id: `REQ-${code}-M-BAR`, lineCode: 'M', roleId: `ROLE-BAR-${code}`, count: 1 },
        { id: `REQ-${code}-M-SRV`, lineCode: 'M', roleId: `ROLE-SRV-${code}`, count: 1 },
        { id: `REQ-${code}-M-INV`, lineCode: 'M', roleId: `ROLE-INV-${code}`, count: 1 },
        { id: `REQ-${code}-D-SEC`, lineCode: 'D', roleId: `ROLE-SEC-${code}`, count: 1 },
        { id: `REQ-${code}-D-BAR`, lineCode: 'D', roleId: `ROLE-BAR-${code}`, count: 2 },
        { id: `REQ-${code}-D-SRV`, lineCode: 'D', roleId: `ROLE-SRV-${code}`, count: 1 },
      ];
      for (const reqItem of branchReqsToInsert) {
        await client.query(`
          INSERT INTO line_requirements (id, branch_id, line_code, role_id, headcount_required)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (branch_id, line_code, role_id) DO NOTHING
        `, [reqItem.id, branchId, reqItem.lineCode, reqItem.roleId, reqItem.count]);
      }

      // 4. Ghi nhận Audit Log bất biến của Admin Tổng
      await client.query(`
        INSERT INTO audit_logs (branch_id, user_id, action_type, entity_type, entity_id, details)
        VALUES ($1, NULL, 'CREATE_BRANCH_AND_ADMIN', 'BRANCH', $2, $3)
      `, [
        branchId,
        branchId,
        JSON.stringify({
          code,
          name,
          admin_name,
          admin_username,
          createdBy: 'Admin Tổng'
        })
      ]);

      await client.query('COMMIT');
      return res.status(201).json(branchRes.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.status(201).json({ id: id || `BR-${code}`, ...req.body });
});

app.put('/api/branches/:id', async (req, res) => {
  const { id } = req.params;
  const name = req.body.name;
  const address = req.body.address;
  const phone = req.body.phone;
  const standard_monthly_hours = req.body.standard_monthly_hours || req.body.standardMonthlyHours;
  const max_fulltime_off_days = req.body.max_fulltime_off_days || req.body.maxFulltimeOffDays;
  const max_parttime_off_days = req.body.max_parttime_off_days || req.body.maxParttimeOffDays;
  const admin_name = req.body.admin_name || req.body.adminName;
  const admin_username = req.body.admin_username || req.body.adminUsername;
  const rawAdminPass = req.body.admin_password || req.body.adminPassword;
  const admin_email = req.body.admin_email || req.body.adminEmail;

  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let hashedAdminPass = null;
      if (rawAdminPass) {
        hashedAdminPass = await hashPassword(rawAdminPass);
      }

      const updateQuery = `
        UPDATE branches
        SET name = COALESCE($1, name),
            address = COALESCE($2, address),
            phone = COALESCE($3, phone),
            standard_monthly_hours = COALESCE($4, standard_monthly_hours),
            max_fulltime_off_days = COALESCE($5, max_fulltime_off_days),
            max_parttime_off_days = COALESCE($6, max_parttime_off_days),
            admin_name = COALESCE($7, admin_name),
            admin_username = COALESCE($8, admin_username),
            admin_password = COALESCE($9, admin_password),
            admin_email = COALESCE($10, admin_email),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *
      `;
      const result = await client.query(updateQuery, [
        name,
        address,
        phone,
        standard_monthly_hours,
        max_fulltime_off_days,
        max_parttime_off_days,
        admin_name,
        admin_username,
        hashedAdminPass,
        admin_email,
        id,
      ]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Không tìm thấy chi nhánh' });
      }

      const branch = result.rows[0];

      // Đồng bộ thông tin sang tài khoản Admin Chi Nhánh trong bảng users
      if (hashedAdminPass || admin_name || admin_email || admin_username || phone) {
        await client.query(`
          UPDATE users
          SET full_name = COALESCE($1, full_name),
              email = COALESCE($2, email),
              password_hash = COALESCE($3, password_hash),
              username = COALESCE($4, username),
              phone = COALESCE($5, phone)
          WHERE branch_id = $6 AND role_type = 'branch_admin'
        `, [admin_name, admin_email, hashedAdminPass, admin_username ? admin_username.toLowerCase().trim() : null, phone, id]);
      }

      // Ghi nhận Audit Log
      await client.query(`
        INSERT INTO audit_logs (branch_id, user_id, action_type, entity_type, entity_id, details)
        VALUES ($1, 'USR-SUPER-01', 'UPDATE_BRANCH_CONFIG', 'BRANCH', $2, $3)
      `, [
        id,
        id,
        JSON.stringify({
          updatedBy: 'Admin Tổng',
          updatedFields: { name, address, phone, admin_name, admin_username }
        })
      ]);

      await client.query('COMMIT');
      return res.json(branch);
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.json({ id, ...req.body });
});

app.delete('/api/branches/:id', async (req, res) => {
  const { id } = req.params;
  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Kiểm tra tồn tại chi nhánh
      const branchRes = await client.query('SELECT * FROM branches WHERE id = $1', [id]);
      if (branchRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Không tìm thấy chi nhánh ${id}` });
      }
      const branch = branchRes.rows[0];

      // 2. [OOP DOMAIN INVARIANT RULE] Kiểm tra số lượng nhân sự trực thuộc chi nhánh
      const staffCheck = await client.query(
        `SELECT COUNT(*) as count FROM users WHERE branch_id = $1`,
        [id]
      );
      const activeEmployeeCount = parseInt(staffCheck.rows[0]?.count || '0', 10);

      if (activeEmployeeCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          errorCode: 'ERR_OOP_INVARIANT_BRANCH_HAS_MEMBERS',
          error: `Ràng buộc toàn vẹn dữ liệu OOP: Không thể giải thể chi nhánh "${branch.name}" (${branch.code}) vì hiện vẫn còn ${activeEmployeeCount} nhân sự trực thuộc. Vui lòng điều chuyển công tác hoặc xóa hồ sơ nhân viên trước khi xóa chi nhánh.`,
          details: {
            branchId: id,
            branchName: branch.name,
            branchCode: branch.code,
            activeEmployeeCount,
          },
        });
      }

      // 3. [OOP DOMAIN INVARIANT RULE] Kiểm tra ca trực / phân công còn tồn tại (chỉ tính các vị trí đã gán người)
      const shiftCheck = await client.query(
        `SELECT COUNT(*) as count FROM shift_assignments WHERE branch_id = $1 AND user_id IS NOT NULL`,
        [id]
      );
      const activeAssignmentCount = parseInt(shiftCheck.rows[0]?.count || '0', 10);

      if (activeAssignmentCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          errorCode: 'ERR_OOP_INVARIANT_BRANCH_HAS_ASSIGNMENTS',
          error: `Ràng buộc toàn vẹn dữ liệu OOP: Không thể xóa chi nhánh "${branch.name}" vì vẫn còn ${activeAssignmentCount} ca làm việc được phân công trong lịch.`,
          details: {
            branchId: id,
            activeAssignmentCount,
          },
        });
      }

      // 4. Nếu thỏa mãn toàn bộ điều kiện OOP Invariant, tiến hành xóa sạch dữ liệu phụ thuộc và chi nhánh
      await client.query('DELETE FROM shift_assignments WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM schedules WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM shift_requests WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM payroll_records WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM line_requirements WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM line_configs WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM roles WHERE branch_id = $1', [id]);
      await client.query('DELETE FROM branches WHERE id = $1', [id]);

      // Ghi nhật ký kiểm toán
      await client.query(`
        INSERT INTO audit_logs (branch_id, user_id, action_type, entity_type, entity_id, details)
        VALUES (NULL, 'USR-SUPER-01', 'DELETE_BRANCH_SAFE', 'BRANCH', $1, $2)
      `, [id, JSON.stringify({ branchName: branch.name, branchCode: branch.code, deletedBy: 'Admin Tổng' })]);

      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Đã giải thể và xóa thành công chi nhánh ${branch.name} (${branch.code}) theo đúng chuẩn OOP.`,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[DELETE /api/branches/:id Error]:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.json({ success: true, message: `Đã xóa chi nhánh ${id}` });
});

app.post('/api/reset-data', async (req, res) => {
  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        TRUNCATE TABLE 
          shift_assignments, 
          shift_requests, 
          payroll_records, 
          availability_registrations, 
          schedules, 
          user_wage_rates, 
          user_skills, 
          line_requirements, 
          line_configs, 
          roles, 
          audit_logs, 
          users, 
          branches 
        CASCADE;
      `);

      const hashedAdminPass = await hashPassword('Admin@2026');

      await client.query(`
        INSERT INTO users (
          id, branch_id, employee_code, full_name, email, username, password_hash,
          role_type, gender, dob, joined_date, employment_type, phone, status, base_hourly_rate
        )
        VALUES (
          'USR-SUPER-01', NULL, 'ADM-ALL', 'Trần Minh Tuấn (Admin Tổng)', 'admin.tong@company.com',
          'admin.tong', $1, 'super_admin', 'male', '1988-04-15', '2020-01-01',
          'full_time', '0901 000 001', 'active', 50000.00
        )
      `, [hashedAdminPass]);

      await client.query(`
        INSERT INTO roles (id, branch_id, code, name, description, gender_requirement, default_hourly_rate, salary_calculation_type, is_system_default)
        VALUES 
          ('ROLE-SEC-01', NULL, 'SEC', 'Bảo Vệ', 'An ninh trật tự, dắt xe và hướng dẫn khách hàng (Chỉ Nam)', 'male_only', 35000.00, 'employee_seniority_rate', true),
          ('ROLE-BAR-01', NULL, 'BAR', 'Pha Chế', 'Barista chuyên pha chế trà sữa, cà phê, topping', 'any', 55000.00, 'employee_seniority_rate', true),
          ('ROLE-SRV-01', NULL, 'SRV', 'Phục Vụ', 'Tiếp khách, nhận order tại bàn, phục vụ món và dọn dẹp', 'any', 45000.00, 'employee_seniority_rate', true),
          ('ROLE-KIT-01', NULL, 'KIT', 'Bếp', 'Chuẩn bị bánh mì, món ăn nhẹ, topping và nguyên liệu tươi', 'any', 50000.00, 'fixed_role_rate', true),
          ('ROLE-INV-01', NULL, 'INV', 'Soạn Hàng', 'Kiểm kê, xuất nhập kho và đóng gói hàng giao', 'any', 46000.00, 'fixed_role_rate', true);
      `);

      await client.query(`
        INSERT INTO user_skills (user_id, role_id)
        VALUES 
          ('USR-SUPER-01', 'ROLE-SEC-01'),
          ('USR-SUPER-01', 'ROLE-BAR-01'),
          ('USR-SUPER-01', 'ROLE-SRV-01'),
          ('USR-SUPER-01', 'ROLE-KIT-01'),
          ('USR-SUPER-01', 'ROLE-INV-01');
      `);

      await client.query(`
        INSERT INTO line_configs (id, branch_id, line_code, line_name, start_time, end_time, duration_hours, description)
        VALUES 
          ('LINE-SYS-O', NULL, 'O', 'Line O — Open (Ca Mở Cửa / Sáng)', '05:30:00', '12:00:00', 6.5, 'Mở cửa quầy, nhận giao nhận nguyên liệu đá tươi và phục vụ khách sáng'),
          ('LINE-SYS-M', NULL, 'M', 'Line M — Mid (Ca Giữa / Trưa)', '11:00:00', '18:00:00', 7.0, 'Khung giờ giao lưu trưa, tiếp đón khách văn phòng và bàn ăn'),
          ('LINE-SYS-D', NULL, 'D', 'Line D — Down (Ca Tối / Đóng Cửa)', '17:00:00', '23:30:00', 6.5, 'Khung giờ cao điểm tối, vệ sinh máy pha và đóng quầy kiểm kê');
      `);

      await client.query(`
        INSERT INTO line_requirements (id, branch_id, line_code, role_id, headcount_required)
        VALUES 
          ('REQ-SYS-O-SEC', NULL, 'O', 'ROLE-SEC-01', 1),
          ('REQ-SYS-O-BAR', NULL, 'O', 'ROLE-BAR-01', 1),
          ('REQ-SYS-O-SRV', NULL, 'O', 'ROLE-SRV-01', 1),
          ('REQ-SYS-O-KIT', NULL, 'O', 'ROLE-KIT-01', 1),

          ('REQ-SYS-M-SEC', NULL, 'M', 'ROLE-SEC-01', 1),
          ('REQ-SYS-M-BAR', NULL, 'M', 'ROLE-BAR-01', 1),
          ('REQ-SYS-M-SRV', NULL, 'M', 'ROLE-SRV-01', 1),
          ('REQ-SYS-M-INV', NULL, 'M', 'ROLE-INV-01', 1),

          ('REQ-SYS-D-SEC', NULL, 'D', 'ROLE-SEC-01', 1),
          ('REQ-SYS-D-BAR', NULL, 'D', 'ROLE-BAR-01', 2),
          ('REQ-SYS-D-SRV', NULL, 'D', 'ROLE-SRV-01', 1);
      `);

      await client.query(`
        INSERT INTO audit_logs (id, branch_id, user_id, action_type, entity_type, entity_id, details)
        VALUES (
          gen_random_uuid(),
          NULL,
          'USR-SUPER-01',
          'SYSTEM_RESET_CLEAN',
          'SYSTEM',
          'ALL',
          $1
        );
      `, [JSON.stringify({
        message: 'Hệ thống đã được reset sạch sẽ. Đã giữ lại cấu hình ca, vai trò chuẩn và tài khoản Admin Tổng.',
        admin: 'admin.tong',
        timestamp: new Date().toISOString()
      })]);

      await client.query('COMMIT');
      return res.json({ success: true, message: 'Đã xóa trắng toàn bộ CSDL Neon PostgreSQL thành công! Giữ lại cấu hình ca, lịch làm và Admin Tổng.' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.json({ success: true });
});

// ============================================================================
// 3. VAI TRÒ & KỸ NĂNG (Roles per Branch with Gender Constraints)
// ============================================================================
app.get('/api/roles', async (req, res) => {
  const { branchId } = req.query;
  if (isNeonConfigured) {
    try {
      const query = branchId
        ? 'SELECT * FROM roles WHERE branch_id = $1 ORDER BY code ASC'
        : 'SELECT * FROM roles ORDER BY code ASC';
      const params = branchId ? [branchId] : [];
      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.post('/api/roles', async (req, res) => {
  const { id, branchId, code, name, description, genderRequirement, defaultHourlyRate, salaryCalculationType } = req.body;
  if (isNeonConfigured) {
    try {
      const query = `
        INSERT INTO roles (id, branch_id, code, name, description, gender_requirement, default_hourly_rate, salary_calculation_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            gender_requirement = EXCLUDED.gender_requirement,
            default_hourly_rate = EXCLUDED.default_hourly_rate,
            salary_calculation_type = EXCLUDED.salary_calculation_type
        RETURNING *
      `;
      const result = await pool.query(query, [
        id || `ROLE-${code}-${Date.now().toString().slice(-4)}`,
        branchId || null,
        code,
        name,
        description || '',
        genderRequirement || 'any',
        defaultHourlyRate || 45000,
        salaryCalculationType || 'employee_seniority_rate',
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.status(201).json({ id, ...req.body });
});

app.put('/api/roles/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, genderRequirement, defaultHourlyRate, salaryCalculationType } = req.body;
  if (isNeonConfigured) {
    try {
      const query = `
        UPDATE roles
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            gender_requirement = COALESCE($3, gender_requirement),
            default_hourly_rate = COALESCE($4, default_hourly_rate),
            salary_calculation_type = COALESCE($5, salary_calculation_type)
        WHERE id = $6
        RETURNING *
      `;
      const result = await pool.query(query, [
        name,
        description,
        genderRequirement,
        defaultHourlyRate,
        salaryCalculationType,
        id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy vai trò' });
      }
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ id, ...req.body });
});

// ============================================================================
// 4. CẤU HÌNH LINE (O, M, D) & ĐỊNH MỨC NHÂN SỰ
// ============================================================================
app.get('/api/line-configs', async (req, res) => {
  const { branchId } = req.query;
  if (isNeonConfigured) {
    try {
      const query = branchId
        ? 'SELECT * FROM line_configs WHERE branch_id = $1 ORDER BY line_code ASC'
        : 'SELECT * FROM line_configs ORDER BY line_code ASC';
      const params = branchId ? [branchId] : [];
      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.put('/api/line-configs', async (req, res) => {
  const { id, branchId, lineCode, lineName, startTime, endTime, durationHours, description } = req.body;
  if (isNeonConfigured && branchId && lineCode) {
    try {
      const configId = id || `LINE-${branchId}-${lineCode}`;
      const result = await pool.query(`
        INSERT INTO line_configs (id, branch_id, line_code, line_name, start_time, end_time, duration_hours, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (branch_id, line_code) DO UPDATE
        SET line_name = COALESCE(EXCLUDED.line_name, line_configs.line_name),
            start_time = COALESCE(EXCLUDED.start_time, line_configs.start_time),
            end_time = COALESCE(EXCLUDED.end_time, line_configs.end_time),
            duration_hours = COALESCE(EXCLUDED.duration_hours, line_configs.duration_hours),
            description = COALESCE(EXCLUDED.description, line_configs.description)
        RETURNING *
      `, [
        configId,
        branchId,
        lineCode,
        lineName || `Line ${lineCode}`,
        startTime || '06:00',
        endTime || '12:00',
        durationHours ?? 6.5,
        description || '',
      ]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json(req.body);
});

app.get('/api/line-requirements', async (req, res) => {
  const { branchId } = req.query;
  if (isNeonConfigured) {
    try {
      const query = branchId
        ? 'SELECT * FROM line_requirements WHERE branch_id = $1'
        : 'SELECT * FROM line_requirements';
      const params = branchId ? [branchId] : [];
      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.put('/api/line-requirements', async (req, res) => {
  const { id, branchId, lineCode, roleId, headcountRequired } = req.body;
  if (isNeonConfigured && branchId && lineCode && roleId) {
    try {
      const reqId = id || `REQ-${branchId}-${lineCode}-${roleId}`;
      const result = await pool.query(`
        INSERT INTO line_requirements (id, branch_id, line_code, role_id, headcount_required)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (branch_id, line_code, role_id) DO UPDATE
        SET headcount_required = EXCLUDED.headcount_required
        RETURNING *
      `, [reqId, branchId, lineCode, roleId, Math.max(0, Number(headcountRequired) || 0)]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json(req.body);
});

// ============================================================================
// 5. NHÂN SỰ & KỸ NĂNG (Users, Skills, Wages)
// ============================================================================
app.get('/api/users', async (req, res) => {
  const { branchId, roleType } = req.query;
  if (isNeonConfigured) {
    try {
      let query = `
        SELECT u.*, 
               COALESCE(array_agg(us.role_id) FILTER (WHERE us.role_id IS NOT NULL), '{}') as skills
        FROM users u
        LEFT JOIN user_skills us ON u.id = us.user_id
        WHERE ($1::varchar IS NULL OR u.branch_id = $1)
          AND ($2::varchar IS NULL OR u.role_type = $2)
        GROUP BY u.id
        ORDER BY u.employee_code ASC
      `;
      const result = await pool.query(query, [branchId || null, roleType || null]);
      const formatted = result.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        employeeCode: row.employee_code,
        name: row.full_name,
        email: row.email,
        username: row.username || (row.email ? row.email.split('@')[0] : row.employee_code),
        roleType: row.role_type,
        gender: row.gender,
        dob: row.dob ? new Date(row.dob).toISOString().split('T')[0] : '1998-01-01',
        joinedDate: row.joined_date ? new Date(row.joined_date).toISOString().split('T')[0] : '2026-01-01',
        employmentType: row.employment_type,
        phone: row.phone || '',
        status: row.status,
        baseHourlyRate: Number(row.base_hourly_rate) || 30000,
        skills: Array.isArray(row.skills) ? row.skills : [],
        wageRates: {},
        ...row,
      }));
      return res.json(formatted);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.post('/api/users', async (req, res) => {
  const {
    id, branchId, employeeCode, fullName, email, username, password, roleType, gender, dob, joinedDate,
    employmentType, phone, skills, wageRates, baseHourlyRate
  } = req.body;

  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userId = id || `EMP-${Date.now().toString().slice(-4)}`;
      const rawPass = password || '123456';
      const hashedPass = await hashPassword(rawPass);
      const finalUsername = (username || (email ? email.split('@')[0] : employeeCode) || userId).toLowerCase().trim();
      const targetRoleType = roleType || 'employee';

      let validBranchId = targetRoleType === 'super_admin' ? null : (branchId || null);
      if (validBranchId) {
        const bCheck = await client.query('SELECT id FROM branches WHERE id = $1', [validBranchId]);
        if (bCheck.rows.length === 0) {
          const bCode = validBranchId.replace(/^BR-/, '');
          await client.query(`
            INSERT INTO branches (id, code, name, standard_monthly_hours, max_fulltime_off_days, max_parttime_off_days)
            VALUES ($1, $2, $3, 208, 4, 8)
            ON CONFLICT (id) DO NOTHING
          `, [validBranchId, bCode, `Chi Nhánh ${bCode}`]);
        }
      }

      // Kiểm tra xem user đã tồn tại theo id, username, hoặc (employee_code + branch_id + role_type)
      const checkRes = await client.query(
        `SELECT id FROM users 
         WHERE id = $1 
            OR (username IS NOT NULL AND LOWER(username) = $2)
            OR (employee_code IS NOT NULL AND employee_code = $3 AND COALESCE(branch_id, '') = COALESCE($4, '') AND role_type = $5)`,
        [userId, finalUsername, employeeCode || null, validBranchId || '', targetRoleType]
      );

      let userRes;
      if (checkRes.rows.length > 0) {
        const targetId = checkRes.rows[0].id;
        const updateQuery = `
          UPDATE users
          SET branch_id = COALESCE($1, branch_id),
              employee_code = COALESCE($2, employee_code),
              full_name = COALESCE($3, full_name),
              email = COALESCE($4, email),
              username = COALESCE($5, username),
              password_hash = COALESCE($6, password_hash),
              role_type = COALESCE($7, role_type),
              gender = COALESCE($8, gender),
              dob = COALESCE($9, dob),
              joined_date = COALESCE($10, joined_date),
              employment_type = COALESCE($11, employment_type),
              phone = COALESCE($12, phone),
              base_hourly_rate = COALESCE($13, base_hourly_rate),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $14
          RETURNING *
        `;
        userRes = await client.query(updateQuery, [
          validBranchId, employeeCode || null, fullName, email || null, finalUsername, hashedPass,
          targetRoleType, gender || 'male', dob || null, joinedDate || new Date(),
          employmentType || 'full_time', phone || null, baseHourlyRate || 30000,
          targetId
        ]);
      } else {
        const insertUser = `
          INSERT INTO users (
            id, branch_id, employee_code, full_name, email, username, password_hash,
            role_type, gender, dob, joined_date, employment_type, phone, base_hourly_rate
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `;
        userRes = await client.query(insertUser, [
          userId, validBranchId, employeeCode || userId, fullName, email || null, finalUsername, hashedPass,
          targetRoleType, gender || 'male', dob || null, joinedDate || new Date(),
          employmentType || 'full_time', phone || null, baseHourlyRate || 30000
        ]);
      }

      const finalId = userRes.rows[0].id;

      await syncUserSkillsSafely(client, finalId, validBranchId, skills);

      await client.query(`
        INSERT INTO audit_logs (branch_id, user_id, action_type, entity_type, entity_id, details)
        VALUES ($1, $2, 'CREATE_USER', 'USER', $3, $4)
      `, [validBranchId, finalId, finalId, JSON.stringify({ fullName, roleType: targetRoleType, employmentType, baseHourlyRate, username: finalUsername })]);

      await client.query('COMMIT');
      return res.status(201).json(userRes.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[POST /api/users Error]:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.status(201).json({ id, ...req.body });
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const {
    branchId, employeeCode, fullName, email, username, password,
    roleType, gender, dob, joinedDate, phone, employmentType, baseHourlyRate, skills, status
  } = req.body;

  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let hashedPass = null;
      if (password && String(password).trim().length > 0) {
        hashedPass = await hashPassword(String(password).trim());
      }

      const finalUsername = username ? username.toLowerCase().trim() : (email ? email.split('@')[0] : (employeeCode || id));
      const targetRoleType = roleType || (id === 'USR-SUPER-01' ? 'super_admin' : 'employee');

      let validBranchId = targetRoleType === 'super_admin' ? null : (branchId || null);
      if (validBranchId) {
        const bCheck = await client.query('SELECT id FROM branches WHERE id = $1', [validBranchId]);
        if (bCheck.rows.length === 0) {
          const bCode = validBranchId.replace(/^BR-/, '');
          await client.query(`
            INSERT INTO branches (id, code, name, standard_monthly_hours, max_fulltime_off_days, max_parttime_off_days)
            VALUES ($1, $2, $3, 208, 4, 8)
            ON CONFLICT (id) DO NOTHING
          `, [validBranchId, bCode, `Chi Nhánh ${bCode}`]);
        }
      }

      // Kiểm tra user theo id, username, hoặc (employeeCode + branchId)
      const checkRes = await client.query(
        `SELECT id FROM users 
         WHERE id = $1 
            OR (username IS NOT NULL AND LOWER(username) = $2)
            OR (employee_code IS NOT NULL AND employee_code = $3 AND COALESCE(branch_id, '') = COALESCE($4, '') AND role_type = $5)`,
        [id, finalUsername, employeeCode || id, validBranchId || '', targetRoleType]
      );

      let result;
      if (checkRes.rows.length > 0) {
        const targetId = checkRes.rows[0].id;
        const updateUser = `
          UPDATE users
          SET full_name = COALESCE($1, full_name),
              email = COALESCE($2, email),
              username = COALESCE($3, username),
              phone = COALESCE($4, phone),
              employment_type = COALESCE($5, employment_type),
              base_hourly_rate = COALESCE($6, base_hourly_rate),
              password_hash = COALESCE($7, password_hash),
              branch_id = CASE WHEN $13 = 'super_admin' THEN NULL ELSE COALESCE($8, branch_id) END,
              employee_code = COALESCE($9, employee_code),
              gender = COALESCE($10, gender),
              dob = COALESCE($11, dob),
              joined_date = COALESCE($12, joined_date),
              role_type = COALESCE($13, role_type),
              status = COALESCE($14, status),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $15
          RETURNING *
        `;
        result = await client.query(updateUser, [
          fullName, email, finalUsername, phone, employmentType, baseHourlyRate,
          hashedPass, validBranchId, employeeCode, gender, dob || null, joinedDate || null,
          targetRoleType, status || null, targetId
        ]);
      } else {
        // Upsert nếu chưa có trong DB (tạo mới tài khoản an toàn)
        const insertUser = `
          INSERT INTO users (
            id, branch_id, employee_code, full_name, email, username, password_hash,
            role_type, gender, dob, joined_date, employment_type, phone, base_hourly_rate, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `;
        result = await client.query(insertUser, [
          id, validBranchId, employeeCode || id, fullName || 'Nhân Viên', email || null, finalUsername, hashedPass || await hashPassword('123456'),
          targetRoleType, gender || 'male', dob || null, joinedDate || new Date(),
          employmentType || 'full_time', phone || null, baseHourlyRate || 30000, status || 'active'
        ]);
      }

      const targetId = result.rows[0].id;

      await syncUserSkillsSafely(client, targetId, validBranchId, skills);

      await client.query('COMMIT');
      return res.json(result.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[PUT /api/users/:id Error]:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.json({ id, ...req.body });
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  if (isNeonConfigured) {
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return res.json({ success: true, message: `Đã xóa nhân viên ${id}` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ success: true, message: `Đã xóa nhân viên ${id}` });
});

// ============================================================================
// 6. ĐĂNG KÝ NGUYỆN VỌNG LÀM VIỆC (Availability Registrations)
// ============================================================================
app.get('/api/availability', async (req, res) => {
  const { branchId, weekStartDate } = req.query;
  if (isNeonConfigured) {
    try {
      const query = `
        SELECT ar.*, u.full_name, u.employee_code, u.gender, u.employment_type
        FROM availability_registrations ar
        LEFT JOIN users u ON ar.user_id = u.id
        WHERE ($1::varchar IS NULL OR COALESCE(ar.branch_id, u.branch_id) = $1)
          AND ($2::date IS NULL OR ar.week_start_date = $2)
        ORDER BY ar.submitted_at DESC
      `;
      const result = await pool.query(query, [branchId || null, weekStartDate || null]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.post('/api/availability', async (req, res) => {
  const { userId, branchId, weekStartDate, slots, dayCustomHours, note } = req.body;
  if (isNeonConfigured && userId && slots) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const targetWeek = weekStartDate || '2026-10-19';
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of days) {
        if (slots[day]) {
          const id = `REG-${userId}-${day}-${targetWeek}`;
          const customHrs = dayCustomHours && dayCustomHours[day] ? dayCustomHours[day] : null;
          await client.query(`
            INSERT INTO availability_registrations (id, user_id, branch_id, week_start_date, day_of_week, availability_type, custom_hours, note, submitted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, week_start_date, day_of_week) DO UPDATE 
            SET availability_type = EXCLUDED.availability_type,
                custom_hours = EXCLUDED.custom_hours,
                branch_id = COALESCE(EXCLUDED.branch_id, availability_registrations.branch_id),
                note = EXCLUDED.note,
                submitted_at = CURRENT_TIMESTAMP
          `, [id, userId, branchId || null, targetWeek, day, slots[day], customHrs, note || '']);
        }
      }
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Đăng ký nguyện vọng thành công và đã lưu lên Neon PostgreSQL!' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[POST /api/availability Error]:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.json({ success: true });
});

// ============================================================================
// 7. LỊCH LÀM VIỆC & PHÂN CÔNG CA (Schedules & Shift Assignments)
// ============================================================================
app.get('/api/schedules', async (req, res) => {
  const { branchId, weekStartDate } = req.query;
  if (isNeonConfigured) {
    try {
      const schedRes = await pool.query(
        `SELECT * FROM schedules WHERE ($1::varchar IS NULL OR branch_id = $1) AND ($2::date IS NULL OR week_start_date = $2) ORDER BY last_modified_at DESC`,
        [branchId || null, weekStartDate || null]
      );
      const schedule = schedRes.rows[0];
      if (!schedule) {
        return res.json(null);
      }
      const assignRes = await pool.query(
        `SELECT sa.*, u.full_name as user_name, r.name as role_name, r.code as role_code
         FROM shift_assignments sa
         LEFT JOIN users u ON sa.user_id = u.id
         LEFT JOIN roles r ON sa.role_id = r.id
         WHERE sa.schedule_id = $1
         ORDER BY sa.slot_index ASC`,
        [schedule.id]
      );
      return res.json({
        ...schedule,
        assignments: assignRes.rows,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json(null);
});

app.post('/api/schedules', async (req, res) => {
  const {
    id,
    branchId,
    weekStartDate,
    weekEndDate,
    status,
    version,
    publishedAt,
    publishedBy,
    assignments,
    shortageWarnings,
    overrideProposals,
  } = req.body;

  if (!branchId) {
    return res.status(400).json({ error: 'Thiếu branchId khi lưu lịch tuần.' });
  }

  if (isNeonConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Đảm bảo branchId tồn tại trong bảng branches để không lỗi khoá ngoại
      const bCheck = await client.query('SELECT id FROM branches WHERE id = $1', [branchId]);
      if (bCheck.rows.length === 0) {
        const bCode = branchId.replace(/^BR-/, '');
        await client.query(`
          INSERT INTO branches (id, code, name, standard_monthly_hours, max_fulltime_off_days, max_parttime_off_days)
          VALUES ($1, $2, $3, 208, 4, 8)
          ON CONFLICT (id) DO NOTHING
        `, [branchId, bCode, `Chi Nhánh ${bCode}`]);
      }

      const targetWeekStart = weekStartDate || '2026-10-19';
      const targetWeekEnd = weekEndDate || '2026-10-25';
      const schedId = id || `SCH-${branchId}-${targetWeekStart}`;

      const schedRes = await client.query(`
        INSERT INTO schedules (
          id, branch_id, week_start_date, week_end_date, status, version,
          published_at_str, published_by, shortage_warnings, override_proposals, last_modified_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        ON CONFLICT (branch_id, week_start_date) DO UPDATE
        SET status = EXCLUDED.status,
            version = EXCLUDED.version,
            published_at_str = EXCLUDED.published_at_str,
            published_by = EXCLUDED.published_by,
            shortage_warnings = EXCLUDED.shortage_warnings,
            override_proposals = EXCLUDED.override_proposals,
            last_modified_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        schedId,
        branchId,
        targetWeekStart,
        targetWeekEnd,
        status || 'draft',
        Number(version) || 1,
        publishedAt || null,
        publishedBy || null,
        JSON.stringify(Array.isArray(shortageWarnings) ? shortageWarnings : []),
        JSON.stringify(Array.isArray(overrideProposals) ? overrideProposals : []),
      ]);

      const finalScheduleId = schedRes.rows[0].id;

      // Xoá các phân công cũ của lịch này và lưu mới toàn bộ danh sách phân công ca
      await client.query('DELETE FROM shift_assignments WHERE schedule_id = $1', [finalScheduleId]);

      if (Array.isArray(assignments)) {
        for (const a of assignments) {
          const slotId = a.id || `${a.day}_${a.lineCode}_${a.roleId}_${a.slotIndex || 0}`;
          const dbId = `${finalScheduleId}__${slotId}`;
          await client.query(`
            INSERT INTO shift_assignments (
              id, slot_id, schedule_id, branch_id, day_of_week, line_code, role_id,
              slot_index, user_id, custom_start_time, custom_end_time, is_override, override_reason, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                custom_start_time = EXCLUDED.custom_start_time,
                custom_end_time = EXCLUDED.custom_end_time,
                is_override = EXCLUDED.is_override,
                override_reason = EXCLUDED.override_reason,
                updated_at = CURRENT_TIMESTAMP
          `, [
            dbId,
            slotId,
            finalScheduleId,
            branchId,
            a.day || a.day_of_week,
            a.lineCode || a.line_code,
            a.roleId || a.role_id,
            Number(a.slotIndex ?? a.slot_index ?? 0),
            a.userId || null,
            a.customStartTime || null,
            a.customEndTime || null,
            Boolean(a.isOverride),
            a.overrideReason || null,
          ]);
        }
      }

      await client.query('COMMIT');
      return res.json({
        success: true,
        scheduleId: finalScheduleId,
        message: 'Đã lưu lịch làm việc tuần vào Neon PostgreSQL thành công!',
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[POST /api/schedules Error]:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
  res.json({ success: true, scheduleId: id });
});

app.put('/api/schedules/:id/publish', async (req, res) => {
  const { id } = req.params;
  const { publishedBy, branchId, status, publishedAt } = req.body;
  if (isNeonConfigured) {
    try {
      const result = await pool.query(
        `UPDATE schedules 
         SET status = COALESCE($1, 'published'),
             published_at = CURRENT_TIMESTAMP,
             published_at_str = COALESCE($2, published_at_str),
             published_by = COALESCE($3, published_by),
             last_modified_at = CURRENT_TIMESTAMP
         WHERE id = $4 OR branch_id = $5
         RETURNING *`,
        [status || 'published', publishedAt || null, publishedBy || 'Admin', id, branchId || null]
      );
      return res.json(result.rows[0] || { id, status: status || 'published' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ id, status: 'published' });
});

// ============================================================================
// 8. ĐỔI CA & BÁN CA (Shift Swap & Sale Requests)
// ============================================================================
app.get('/api/shift-requests', async (req, res) => {
  const { branchId } = req.query;
  if (isNeonConfigured) {
    try {
      const query = `
        SELECT sr.*, 
               COALESCE(sr.requester_name, u1.full_name) as requester_name, 
               COALESCE(sr.target_user_name, u2.full_name) as target_user_name
        FROM shift_requests sr
        LEFT JOIN users u1 ON sr.requester_id = u1.id
        LEFT JOIN users u2 ON sr.target_user_id = u2.id
        WHERE ($1::varchar IS NULL OR sr.branch_id = $1)
        ORDER BY sr.created_at DESC
      `;
      const result = await pool.query(query, [branchId || null]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

app.post('/api/shift-requests', async (req, res) => {
  const {
    id,
    branchId,
    requestType,
    assignmentId,
    roleId,
    requesterId,
    requesterName,
    targetUserId,
    targetUserName,
    day,
    dayOfWeek,
    lineCode,
    customStartTime,
    customEndTime,
    targetDay,
    targetDayOfWeek,
    targetLineCode,
    reason,
    status,
    isOpenMarket,
    claimedByUserId,
    claimedByUserName,
    peerStatus,
    peerRespondedAt,
  } = req.body;

  if (isNeonConfigured) {
    try {
      const reqId = id || `REQ-${(requestType || 'SWAP').toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const query = `
        INSERT INTO shift_requests (
          id, branch_id, request_type, assignment_id, role_id,
          requester_id, requester_name, target_user_id, target_user_name,
          day_of_week, line_code, custom_start_time, custom_end_time,
          target_day_of_week, target_line_code, reason, status,
          is_open_market, claimed_by_user_id, claimed_by_user_name, peer_status, peer_responded_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (id) DO UPDATE
        SET status = EXCLUDED.status,
            target_user_id = COALESCE(EXCLUDED.target_user_id, shift_requests.target_user_id),
            target_user_name = COALESCE(EXCLUDED.target_user_name, shift_requests.target_user_name),
            claimed_by_user_id = COALESCE(EXCLUDED.claimed_by_user_id, shift_requests.claimed_by_user_id),
            claimed_by_user_name = COALESCE(EXCLUDED.claimed_by_user_name, shift_requests.claimed_by_user_name),
            peer_status = COALESCE(EXCLUDED.peer_status, shift_requests.peer_status),
            peer_responded_at = COALESCE(EXCLUDED.peer_responded_at, shift_requests.peer_responded_at)
        RETURNING *
      `;
      const result = await pool.query(query, [
        reqId,
        branchId || null,
        requestType || 'swap',
        assignmentId || null,
        roleId || null,
        requesterId,
        requesterName || null,
        targetUserId || null,
        targetUserName || null,
        day || dayOfWeek || 'monday',
        lineCode || null,
        customStartTime || null,
        customEndTime || null,
        targetDay || targetDayOfWeek || null,
        targetLineCode || null,
        reason || '',
        status || 'pending',
        Boolean(isOpenMarket),
        claimedByUserId || null,
        claimedByUserName || null,
        peerStatus || 'not_required',
        peerRespondedAt || null,
      ]);

      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error('[POST /api/shift-requests Error]:', err);
      return res.status(500).json({ error: err.message });
    }
  }
  res.status(201).json({ id: id || `REQ-${Date.now()}`, ...req.body, status: 'pending' });
});

app.put('/api/shift-requests/:id', async (req, res) => {
  const { id } = req.params;
  const {
    status,
    reviewerId,
    reviewNote,
    targetUserId,
    targetUserName,
    claimedByUserId,
    claimedByUserName,
    peerStatus,
    peerRespondedAt,
  } = req.body;

  if (isNeonConfigured) {
    try {
      const result = await pool.query(`
        UPDATE shift_requests
        SET status = COALESCE($1, status),
            reviewer_id = COALESCE($2, reviewer_id),
            review_note = COALESCE($3, review_note),
            target_user_id = COALESCE($4, target_user_id),
            target_user_name = COALESCE($5, target_user_name),
            claimed_by_user_id = COALESCE($6, claimed_by_user_id),
            claimed_by_user_name = COALESCE($7, claimed_by_user_name),
            peer_status = COALESCE($8, peer_status),
            peer_responded_at = COALESCE($9, peer_responded_at),
            reviewed_at = CASE WHEN $1 IN ('approved', 'rejected') THEN CURRENT_TIMESTAMP ELSE reviewed_at END
        WHERE id = $10
        RETURNING *
      `, [
        status || null,
        reviewerId || null,
        reviewNote || null,
        targetUserId || null,
        targetUserName || null,
        claimedByUserId || null,
        claimedByUserName || null,
        peerStatus || null,
        peerRespondedAt || null,
        id,
      ]);
      return res.json(result.rows[0] || { id, ...req.body });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ id, ...req.body });
});

app.put('/api/shift-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { reviewerId, reviewNote } = req.body;
  if (isNeonConfigured) {
    try {
      const query = `
        UPDATE shift_requests 
        SET status = 'approved', reviewer_id = $1, review_note = $2, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const result = await pool.query(query, [reviewerId || 'USR-ADMIN-01', reviewNote || 'Admin đã duyệt', id]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ id, status: 'approved' });
});

app.put('/api/shift-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { reviewerId, reviewNote } = req.body;
  if (isNeonConfigured) {
    try {
      const query = `
        UPDATE shift_requests 
        SET status = 'rejected', reviewer_id = $1, review_note = $2, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const result = await pool.query(query, [reviewerId || 'USR-ADMIN-01', reviewNote || 'Admin từ chối', id]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ id, status: 'rejected' });
});

// ============================================================================
// 8.1 BẢNG LƯƠNG & GIỜ TĂNG CA (Payroll OT Persistence)
// ============================================================================
app.post('/api/payroll-ot', async (req, res) => {
  const { branchId, userId, weekStartDate, otHours } = req.body;
  if (isNeonConfigured && userId) {
    try {
      const targetWeek = weekStartDate || '2026-10-19';
      const recId = `PAY-${userId}-${targetWeek}`;
      const result = await pool.query(`
        INSERT INTO payroll_records (id, branch_id, user_id, week_start_date, ot_hours, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (branch_id, user_id, week_start_date) DO UPDATE
        SET ot_hours = EXCLUDED.ot_hours,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [recId, branchId || null, userId, targetWeek, Number(otHours) || 0]);
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ success: true });
});

// ============================================================================
// 9. NHẬT KÝ KIỂM TOÁN (Audit Logs)
// ============================================================================
app.get('/api/audit-logs', async (req, res) => {
  const { branchId, limit } = req.query;
  if (isNeonConfigured) {
    try {
      const query = `
        SELECT al.*, u.full_name as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE ($1::varchar IS NULL OR al.branch_id = $1)
        ORDER BY al.created_at DESC
        LIMIT $2
      `;
      const result = await pool.query(query, [branchId || null, Number(limit) || 50]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json([]);
});

// ============================================================================
// KHỞI CHẠY SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 StaffFlow Node.js Backend Server chạy tại: http://localhost:${PORT}`);
  console.log(`📡 Neon PostgreSQL: ${isNeonConfigured ? 'ĐÃ KẾT NỐI VÀ HOẠT ĐỘNG' : 'Sử dụng Mock State'}`);
  console.log(`====================================================`);
});
