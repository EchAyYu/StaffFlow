import { Router } from 'express';
import { pool, isNeonConfigured, checkDbConnection } from '../db';
import { hashPassword } from '../auth';

export const systemRouter = Router();

// ============================================================================
// 1. HEALTHCHECK & DATABASE STATUS
// ============================================================================

systemRouter.get('/health', async (req, res) => {
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
// 1.2 KHỞI TẠO ĐỒNG BỘ DỮ LIỆU ĐẦU TIÊN (Initial State for Frontend)
// ============================================================================

systemRouter.get('/initial-state', async (req, res) => {
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
// RESET DATA
// ============================================================================

systemRouter.post('/reset-data', async (req, res) => {
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
// 8.1 BẢNG LƯƠNG & GIỜ TĂNG CA (Payroll OT Persistence)
// ============================================================================

systemRouter.post('/payroll-ot', async (req, res) => {
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

systemRouter.get('/audit-logs', async (req, res) => {
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
