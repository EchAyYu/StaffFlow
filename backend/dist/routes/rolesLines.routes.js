import { Router } from 'express';
import { pool, isNeonConfigured } from '../db.js';
export const rolesRouter = Router();
export const lineConfigsRouter = Router();
export const lineRequirementsRouter = Router();
// ============================================================================
// 3. VAI TRÒ & KỸ NĂNG (Roles per Branch with Gender Constraints)
// ============================================================================
rolesRouter.get('/', async (req, res) => {
    const { branchId } = req.query;
    if (isNeonConfigured) {
        try {
            const query = branchId
                ? 'SELECT * FROM roles WHERE branch_id = $1 ORDER BY code ASC'
                : 'SELECT * FROM roles ORDER BY code ASC';
            const params = branchId ? [branchId] : [];
            const result = await pool.query(query, params);
            return res.json(result.rows);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json([]);
});
rolesRouter.post('/', async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.status(201).json({ id, ...req.body });
});
rolesRouter.put('/:id', async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json({ id, ...req.body });
});
// ============================================================================
// 4. CẤU HÌNH LINE (O, M, D) & ĐỊNH MỨC NHÂN SỰ
// ============================================================================
lineConfigsRouter.get('/', async (req, res) => {
    const { branchId } = req.query;
    if (isNeonConfigured) {
        try {
            const query = branchId
                ? 'SELECT * FROM line_configs WHERE branch_id = $1 ORDER BY line_code ASC'
                : 'SELECT * FROM line_configs ORDER BY line_code ASC';
            const params = branchId ? [branchId] : [];
            const result = await pool.query(query, params);
            return res.json(result.rows);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json([]);
});
lineConfigsRouter.put('/', async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json(req.body);
});
lineRequirementsRouter.get('/', async (req, res) => {
    const { branchId } = req.query;
    if (isNeonConfigured) {
        try {
            const query = branchId
                ? 'SELECT * FROM line_requirements WHERE branch_id = $1'
                : 'SELECT * FROM line_requirements';
            const params = branchId ? [branchId] : [];
            const result = await pool.query(query, params);
            return res.json(result.rows);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json([]);
});
lineRequirementsRouter.put('/', async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json(req.body);
});
