import { Router } from 'express';
import { pool, isNeonConfigured } from '../db.js';
import { hashPassword } from '../auth.js';

export const branchesRouter = Router();

// ============================================================================
// CHI NHÁNH (Branches - Admin Tổng)
// ============================================================================

branchesRouter.get('/', async (req, res) => {
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

branchesRouter.post('/', async (req, res) => {
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

branchesRouter.put('/:id', async (req, res) => {
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

branchesRouter.delete('/:id', async (req, res) => {
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
