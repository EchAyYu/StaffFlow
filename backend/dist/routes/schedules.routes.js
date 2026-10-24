import { Router } from 'express';
import { pool, isNeonConfigured } from '../db.js';
export const schedulesRouter = Router();
// ============================================================================
// 7. LỊCH LÀM VIỆC & PHÂN CÔNG CA (Schedules & Shift Assignments)
// ============================================================================
schedulesRouter.get('/', async (req, res) => {
    const { branchId, weekStartDate } = req.query;
    if (isNeonConfigured) {
        try {
            const schedRes = await pool.query(`SELECT * FROM schedules WHERE ($1::varchar IS NULL OR branch_id = $1) AND ($2::date IS NULL OR week_start_date = $2) ORDER BY last_modified_at DESC`, [branchId || null, weekStartDate || null]);
            const schedule = schedRes.rows[0];
            if (!schedule) {
                return res.json(null);
            }
            const assignRes = await pool.query(`SELECT sa.*, u.full_name as user_name, r.name as role_name, r.code as role_code
         FROM shift_assignments sa
         LEFT JOIN users u ON sa.user_id = u.id
         LEFT JOIN roles r ON sa.role_id = r.id
         WHERE sa.schedule_id = $1
         ORDER BY sa.slot_index ASC`, [schedule.id]);
            return res.json({
                ...schedule,
                assignments: assignRes.rows,
            });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json(null);
});
schedulesRouter.post('/', async (req, res) => {
    const { id, branchId, weekStartDate, weekEndDate, status, version, publishedAt, publishedBy, assignments, shortageWarnings, overrideProposals, } = req.body;
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
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('[POST /api/schedules Error]:', err);
            return res.status(500).json({ error: err.message });
        }
        finally {
            client.release();
        }
    }
    res.json({ success: true, scheduleId: id });
});
schedulesRouter.put('/:id/publish', async (req, res) => {
    const { id } = req.params;
    const { publishedBy, branchId, status, publishedAt } = req.body;
    if (isNeonConfigured) {
        try {
            const result = await pool.query(`UPDATE schedules 
         SET status = COALESCE($1, 'published'),
             published_at = CURRENT_TIMESTAMP,
             published_at_str = COALESCE($2, published_at_str),
             published_by = COALESCE($3, published_by),
             last_modified_at = CURRENT_TIMESTAMP
         WHERE id = $4 OR branch_id = $5
         RETURNING *`, [status || 'published', publishedAt || null, publishedBy || 'Admin', id, branchId || null]);
            return res.json(result.rows[0] || { id, status: status || 'published' });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json({ id, status: 'published' });
});
