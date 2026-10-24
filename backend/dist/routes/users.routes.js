import { Router } from 'express';
import { pool, isNeonConfigured } from '../db.js';
import { hashPassword } from '../auth.js';
export const usersRouter = Router();
export const DEFAULT_ROLE_META = {
    SEC: { name: 'Bảo Vệ', desc: 'An ninh, dắt xe và hướng dẫn khách hàng (Chỉ Nam)', gender: 'male_only', rate: 35000, calc: 'employee_seniority_rate' },
    BAR: { name: 'Pha Chế', desc: 'Barista chuyên pha chế trà sữa, cà phê', gender: 'any', rate: 55000, calc: 'employee_seniority_rate' },
    SRV: { name: 'Phục Vụ', desc: 'Tiếp đón khách hàng, order và dọn bàn', gender: 'any', rate: 45000, calc: 'employee_seniority_rate' },
    KIT: { name: 'Bếp', desc: 'Chuẩn bị đồ ăn nhanh và topping tươi', gender: 'any', rate: 50000, calc: 'fixed_role_rate' },
    INV: { name: 'Soạn Hàng', desc: 'Kiểm kê, xuất nhập kho và đóng gói', gender: 'any', rate: 46000, calc: 'fixed_role_rate' },
};
export async function syncUserSkillsSafely(client, userId, branchId, skills) {
    if (!Array.isArray(skills))
        return;
    await client.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);
    for (const skillId of skills) {
        if (!skillId)
            continue;
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
                if (bCheck.rows.length === 0)
                    validBranchId = null;
            }
            await client.query(`
        INSERT INTO roles (id, branch_id, code, name, description, gender_requirement, default_hourly_rate, salary_calculation_type, is_system_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        ON CONFLICT (id) DO NOTHING
      `, [skillId, validBranchId, code, meta.name, meta.desc, meta.gender, meta.rate, meta.calc]);
        }
        await client.query('INSERT INTO user_skills (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, skillId]);
    }
}
// ============================================================================
// 5. NHÂN SỰ & KỸ NĂNG (Users, Skills, Wages)
// ============================================================================
usersRouter.get('/', async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json([]);
});
usersRouter.post('/', async (req, res) => {
    const { id, branchId, employeeCode, fullName, email, username, password, roleType, gender, dob, joinedDate, employmentType, phone, skills, wageRates, baseHourlyRate } = req.body;
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
            const checkRes = await client.query(`SELECT id FROM users 
         WHERE id = $1 
            OR (username IS NOT NULL AND LOWER(username) = $2)
            OR (employee_code IS NOT NULL AND employee_code = $3 AND COALESCE(branch_id, '') = COALESCE($4, '') AND role_type = $5)`, [userId, finalUsername, employeeCode || null, validBranchId || '', targetRoleType]);
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
            }
            else {
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
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('[POST /api/users Error]:', err);
            return res.status(500).json({ error: err.message });
        }
        finally {
            client.release();
        }
    }
    res.status(201).json({ id, ...req.body });
});
usersRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { branchId, employeeCode, fullName, email, username, password, roleType, gender, dob, joinedDate, phone, employmentType, baseHourlyRate, skills, status } = req.body;
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
            const checkRes = await client.query(`SELECT id FROM users 
         WHERE id = $1 
            OR (username IS NOT NULL AND LOWER(username) = $2)
            OR (employee_code IS NOT NULL AND employee_code = $3 AND COALESCE(branch_id, '') = COALESCE($4, '') AND role_type = $5)`, [id, finalUsername, employeeCode || id, validBranchId || '', targetRoleType]);
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
            }
            else {
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
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('[PUT /api/users/:id Error]:', err);
            return res.status(500).json({ error: err.message });
        }
        finally {
            client.release();
        }
    }
    res.json({ id, ...req.body });
});
usersRouter.delete('/:id', async (req, res) => {
    const { id } = req.params;
    if (isNeonConfigured) {
        try {
            await pool.query('DELETE FROM users WHERE id = $1', [id]);
            return res.json({ success: true, message: `Đã xóa nhân viên ${id}` });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json({ success: true, message: `Đã xóa nhân viên ${id}` });
});
