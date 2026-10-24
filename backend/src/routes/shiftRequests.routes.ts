import { Router } from 'express';
import { pool, isNeonConfigured } from '../db';

export const shiftRequestsRouter = Router();

// ============================================================================
// 8. ĐỔI CA & BÁN CA (Shift Swap & Sale Requests)
// ============================================================================

shiftRequestsRouter.get('/', async (req, res) => {
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

shiftRequestsRouter.post('/', async (req, res) => {
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

shiftRequestsRouter.put('/:id', async (req, res) => {
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

shiftRequestsRouter.put('/:id/approve', async (req, res) => {
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

shiftRequestsRouter.put('/:id/reject', async (req, res) => {
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
