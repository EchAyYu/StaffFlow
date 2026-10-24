import { Router } from 'express';
import { pool, isNeonConfigured } from '../db.js';
export const availabilityRouter = Router();
// ============================================================================
// 6. ĐĂNG KÝ NGUYỆN VỌNG LÀM VIỆC (Availability Registrations)
// ============================================================================
availabilityRouter.get('/', async (req, res) => {
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
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json([]);
});
availabilityRouter.post('/', async (req, res) => {
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
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('[POST /api/availability Error]:', err);
            return res.status(500).json({ error: err.message });
        }
        finally {
            client.release();
        }
    }
    res.json({ success: true });
});
