import React, { useState, useMemo } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { ShiftRequest } from '../../types';
import { RequestStatusBadge, LineBadge, RoleBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import {
  formatVND,
  calculateShiftHourlyRate,
  checkShiftEligibility,
  calculateHoursBetween,
  MAX_WEEKLY_HOURS_CAP,
  MIN_REST_PERIOD_HOURS,
} from '../../utils/formatters';
import {
  ArrowLeftRight,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
  AlertTriangle,
  FileText,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export const ShiftRequestsTab: React.FC = () => {
  const {
    shiftRequests,
    reviewShiftRequest,
    currentBranchId,
    employees,
    roles,
    lineConfigs,
    schedule,
  } = useSchedule();

  const [typeFilter, setTypeFilter] = useState<'all' | 'swap' | 'sale' | 'leave'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const [activeRequest, setActiveRequest] = useState<ShiftRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');

  const branchRequests = useMemo(() => {
    return shiftRequests.filter((r) => {
      if (r.branchId !== currentBranchId) return false;
      if (typeFilter !== 'all' && r.requestType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [shiftRequests, currentBranchId, typeFilter, statusFilter]);

  const pendingCount = shiftRequests.filter(
    (r) => r.branchId === currentBranchId && r.status === 'pending'
  ).length;

  const roleMap = useMemo(() => {
    const map = new Map<string, (typeof roles)[0]>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const lineMap = useMemo(() => {
    const map = new Map<string, (typeof lineConfigs)[0]>();
    lineConfigs.forEach((l) => map.set(l.lineCode, l));
    return map;
  }, [lineConfigs]);

  const requestDetails = useMemo(() => {
    if (!activeRequest) return null;

    const assign = activeRequest.assignmentId
      ? schedule.assignments.find((a) => a.id === activeRequest.assignmentId)
      : schedule.assignments.find(
          (a) =>
            a.day === activeRequest.day &&
            a.lineCode === activeRequest.lineCode &&
            a.userId === activeRequest.requesterId
        );

    const shiftRole = activeRequest.roleId
      ? roleMap.get(activeRequest.roleId)
      : assign
      ? roleMap.get(assign.roleId)
      : undefined;

    const line = activeRequest.lineCode ? lineMap.get(activeRequest.lineCode) : undefined;
    const startTime = activeRequest.customStartTime || line?.startTime || '06:00';
    const endTime = activeRequest.customEndTime || line?.endTime || '14:00';
    const duration = line?.durationHours || calculateHoursBetween(startTime, endTime) || 8;

    const requesterEmp = employees.find((e) => e.id === activeRequest.requesterId);
    const recipientId = activeRequest.targetUserId || activeRequest.claimedByUserId;
    const recipientEmp = recipientId ? employees.find((e) => e.id === recipientId) : undefined;

    const requesterRateInfo = calculateShiftHourlyRate(shiftRole, requesterEmp);
    const recipientRateInfo = recipientEmp ? calculateShiftHourlyRate(shiftRole, recipientEmp) : undefined;

    const requesterPayChange = duration * requesterRateInfo.rate;
    const recipientPayChange = recipientRateInfo ? duration * recipientRateInfo.rate : 0;

    const eligibilityCheck = recipientEmp
      ? checkShiftEligibility({
          targetEmployee: recipientEmp,
          shiftRole,
          shiftDay: activeRequest.day,
          shiftLineCode: activeRequest.lineCode,
          shiftStartTime: startTime,
          shiftEndTime: endTime,
          allAssignments: schedule.assignments,
          roleMap,
          excludeAssignmentId: activeRequest.assignmentId,
        })
      : null;

    return {
      assign,
      shiftRole,
      line,
      startTime,
      endTime,
      duration,
      requesterEmp,
      recipientEmp,
      requesterRateInfo,
      recipientRateInfo,
      requesterPayChange,
      recipientPayChange,
      eligibilityCheck,
    };
  }, [activeRequest, schedule.assignments, roleMap, lineMap, employees]);

  const handleOpenReview = (req: ShiftRequest, action: 'approved' | 'rejected') => {
    setActiveRequest(req);
    setReviewAction(action);
    if (req.requestType === 'leave') {
      setReviewNote(
        action === 'approved'
          ? 'Đã đối chiếu định mức và chấp thuận cho nhân viên nghỉ thêm ca/ngày theo nguyện vọng.'
          : 'Không thể duyệt nghỉ do ca làm việc này đang thiếu hụt nhân sự nghiêm trọng.'
      );
    } else {
      setReviewNote(
        action === 'approved'
          ? 'Đã kiểm tra điều kiện kỹ năng, sự phù hợp giới tính và không trùng ca. Chấp thuận yêu cầu.'
          : 'Không phù hợp với tình hình điều phối nhân sự của chi nhánh.'
      );
    }
  };

  const handleExecuteReview = () => {
    if (!activeRequest) return;
    reviewShiftRequest(activeRequest.id, reviewAction, reviewNote);
    setActiveRequest(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <ArrowLeftRight size={16} />
            </span>
            Hàng Đợi Phê Duyệt Phiếu: Đổi Ca, Bán Ca & Xin Nghỉ Thêm
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Khi Admin duyệt: Hệ thống tự động cập nhật Master Schedule, hoán đổi/điều chuyển giờ làm, ghi nhận Audit Log và tính lương minh bạch.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="text-xs font-mono px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            Tổng: <b className="text-slate-800">{shiftRequests.filter((r) => r.branchId === currentBranchId).length}</b>
          </div>
          {pendingCount > 0 ? (
            <div className="text-xs font-mono font-bold px-3.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl animate-pulse">
              {pendingCount} chờ duyệt
            </div>
          ) : (
            <div className="text-xs font-mono font-bold px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl">
              Đã xử lý hết
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Filter size={13} /> Lọc:
          </span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả loại phiếu</option>
            <option value="swap">Đổi ca (Swap)</option>
            <option value="sale">Bán ca (Sale)</option>
            <option value="leave">Xin nghỉ thêm (Leave)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Mọi trạng thái</option>
            <option value="pending">Chờ phê duyệt</option>
            <option value="approved">Đã chấp thuận</option>
            <option value="rejected">Bị từ chối</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium self-end sm:self-center">
          Hiển thị: <b className="text-slate-800">{branchRequests.length}</b> phiếu
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-zinc-600 font-semibold border-b border-zinc-200 uppercase font-mono text-[11px]">
                <th className="py-2.5 px-4 w-28">Mã Phiếu</th>
                <th className="py-2.5 px-4">Loại Phiếu</th>
                <th className="py-2.5 px-4">Nhân viên yêu cầu</th>
                <th className="py-2.5 px-4">Ca ban đầu</th>
                <th className="py-2.5 px-4">Nhân viên nhận / Đổi cùng</th>
                <th className="py-2.5 px-4">Lý do</th>
                <th className="py-2.5 px-4 text-center">Trạng thái</th>
                <th className="py-2.5 px-4 text-right w-36">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {branchRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-zinc-400">
                    Không có phiếu yêu cầu nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                branchRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-zinc-800">
                      {req.id}
                    </td>

                    <td className="py-3 px-4">
                      {req.requestType === 'swap' ? (
                        <span className="inline-flex items-center gap-1 font-bold font-mono text-purple-700 bg-purple-50 px-2 py-0.5 border border-purple-200">
                          <ArrowLeftRight size={11} /> ĐỔI CA
                        </span>
                      ) : req.requestType === 'sale' ? (
                        <span className="inline-flex items-center gap-1 font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 border border-blue-200">
                          <DollarSign size={11} /> BÁN CA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold font-mono text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-300">
                          <FileText size={11} /> NGHỈ THÊM
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-semibold text-zinc-900">
                      {req.requesterName}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-zinc-800 uppercase">Thứ {req.day}</span>
                        {req.lineCode && <LineBadge lineCode={req.lineCode} size="sm" />}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {req.requestType === 'leave' ? (
                        <span className="text-zinc-500 font-mono text-[11px] italic">
                          Admin chi nhánh phê duyệt
                        </span>
                      ) : req.isOpenMarket ? (
                        req.claimedByUserId ? (
                          <div>
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                              🛒 Chợ Ca: Đã nhận
                            </span>
                            <p className="font-bold text-zinc-900 mt-0.5">{req.claimedByUserName}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">Đăng ký nhận ca thay</p>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              🛒 Chợ Ca: Chưa có người nhận
                            </span>
                            <p className="text-[10px] text-zinc-400 italic mt-0.5">Đang mở bán công khai</p>
                          </div>
                        )
                      ) : req.targetUserName ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-zinc-900">{req.targetUserName}</p>
                          {req.targetDay && req.targetLineCode && (
                            <p className="font-mono text-[10px] text-zinc-400">
                              Đổi lấy: Thứ {req.targetDay} ({req.targetLineCode})
                            </p>
                          )}
                          {req.peerStatus === 'waiting_peer' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              ⏳ Chờ đồng nghiệp đồng ý (Bước 1/2)
                            </span>
                          )}
                          {req.peerStatus === 'peer_accepted' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              🤝 Đồng nghiệp đã đồng ý (Bước 2/2)
                            </span>
                          )}
                          {req.peerStatus === 'peer_declined' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              ✗ Đồng nghiệp đã từ chối
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Mở bán công khai</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-zinc-600 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <RequestStatusBadge status={req.status} />
                    </td>

                    <td className="py-3 px-4 text-right">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {req.isOpenMarket && !req.claimedByUserId ? (
                            <span
                              className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded"
                              title="Chờ nhân viên nhận ca trước khi Admin có thể phê duyệt chuyển giao"
                            >
                              Chờ người nhận
                            </span>
                          ) : req.peerStatus === 'waiting_peer' ? (
                            <span
                              className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded"
                              title="Quy tắc 4: Đồng nghiệp được chỉ định cần bấm Đồng Ý trước khi Admin phê duyệt"
                            >
                              Chờ đồng nghiệp
                            </span>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenReview(req, 'approved')}
                              className="h-7 text-xs px-2.5 bg-emerald-700 hover:bg-emerald-800 border-emerald-700 rounded-md"
                            >
                              Duyệt
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReview(req, 'rejected')}
                            className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 border-rose-300 rounded-md"
                          >
                            Từ chối
                          </Button>
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-zinc-400">
                          {req.reviewedAt ? `Đã xử lý lúc ${req.reviewedAt}` : 'Đã xử lý'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Dialog */}
      {activeRequest && (
        <Modal
          isOpen={!!activeRequest}
          onClose={() => setActiveRequest(null)}
          title={`Phê Duyệt Phiếu ${
            activeRequest.requestType === 'swap'
              ? 'Đổi Ca'
              : activeRequest.requestType === 'sale'
              ? 'Bán Ca'
              : 'Xin Nghỉ Phép / Nghỉ Thêm'
          }: ${activeRequest.id}`}
          subtitle={
            activeRequest.requestType === 'leave'
              ? 'Xác nhận cấp phép nghỉ thêm ngoài định mức quy định cho nhân viên'
              : 'Quy trình chuẩn: Kiểm tra kỹ năng người thay, không trùng ca và điều chỉnh giờ/lương'
          }
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setActiveRequest(null)}>
                Đóng
              </Button>
              <Button
                variant={reviewAction === 'approved' ? 'primary' : 'danger'}
                size="sm"
                onClick={handleExecuteReview}
              >
                {reviewAction === 'approved' ? 'Xác Nhận Phê Duyệt & Cập Nhật Lịch' : 'Xác Nhận Từ Chối'}
              </Button>
            </>
          }
        >
          <div className="space-y-3.5 text-xs">
            {/* Shift & Employee Basic Information */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900 uppercase font-mono text-[11px]">
                  Thông tin ca yêu cầu:
                </span>
                <div className="flex items-center gap-1.5">
                  {requestDetails?.line && <LineBadge lineCode={requestDetails.line.lineCode} size="sm" />}
                  {requestDetails?.shiftRole && (
                    <RoleBadge
                      roleCode={requestDetails.shiftRole.code}
                      roleName={requestDetails.shiftRole.name}
                      size="sm"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500">Khung giờ ca:</span>
                  <p className="font-bold font-mono text-slate-800">
                    {requestDetails?.startTime} - {requestDetails?.endTime} ({requestDetails?.duration}h)
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Ngày làm việc:</span>
                  <p className="font-bold text-slate-800 uppercase font-mono">
                    Thứ {activeRequest.day}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200/80 pt-2 text-[11px] space-y-1">
                <p>
                  <b>Người chuyển nhượng:</b> <span className="font-semibold text-slate-900">{activeRequest.requesterName}</span>
                </p>
                {activeRequest.requestType !== 'leave' && (
                  <p>
                    <b>Người nhận / đổi cùng:</b>{' '}
                    <span className="font-semibold text-indigo-900">
                      {activeRequest.claimedByUserName
                        ? `${activeRequest.claimedByUserName} (Đã nhận từ Chợ Ca)`
                        : activeRequest.targetUserName || 'Chưa chỉ định'}
                    </span>
                  </p>
                )}
                <p className="italic text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                  <b>Lý do ghi trên phiếu:</b> "{activeRequest.reason}"
                </p>
              </div>
            </div>

            {/* Invariant & Eligibility Verification Report */}
            {requestDetails?.eligibilityCheck && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  requestDetails.eligibilityCheck.isEligible
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50/80 border-rose-300 text-rose-950'
                }`}
              >
                {requestDetails.eligibilityCheck.isEligible ? (
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>
                      {requestDetails.eligibilityCheck.isEligible
                        ? 'Đạt chuẩn nghiệp vụ: Đủ kỹ năng, đúng giới tính & không trùng ca'
                        : 'Cảnh báo vi phạm nghiệp vụ phân ca:'}
                    </span>
                  </div>
                  {requestDetails.eligibilityCheck.isEligible ? (
                    <div className="space-y-1">
                      <p className="text-emerald-800">
                        Nhân viên <b>{requestDetails.recipientEmp?.name}</b> đáp ứng đầy đủ năng lực cho vị trí <b>{requestDetails.shiftRole?.name}</b>, không trùng ca, đảm bảo nghỉ giữa 2 ngày ≥ {MIN_REST_PERIOD_HOURS}h.
                      </p>
                      <p className="font-mono text-[10px] text-emerald-900 bg-white/80 px-2 py-1 rounded border border-emerald-200 inline-block">
                        ⏱️ Tổng giờ tuần của người nhận: {requestDetails.eligibilityCheck.currentWeeklyHours}h → <b>{requestDetails.eligibilityCheck.projectedWeeklyHours}h / {MAX_WEEKLY_HOURS_CAP}h</b> (Đạt chuẩn ≤ {MAX_WEEKLY_HOURS_CAP}h)
                      </p>
                    </div>
                  ) : (
                    <ul className="list-disc pl-4 text-rose-800 space-y-0.5">
                      {requestDetails.eligibilityCheck.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Payroll & Hours Impact Preview */}
            {activeRequest.requestType !== 'leave' && requestDetails?.recipientEmp && (
              <div className="p-3 bg-gradient-to-r from-indigo-50/60 to-blue-50/60 border border-indigo-200/80 rounded-xl space-y-2">
                <span className="font-bold text-indigo-950 uppercase font-mono text-[10px] tracking-wide flex items-center gap-1.5">
                  <DollarSign size={13} className="text-indigo-600" />
                  Dự toán biến động giờ làm & Lương (Tự động cập nhật sau duyệt):
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/90 p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Người chuyển ca</span>
                    <strong className="text-slate-900 block truncate">{activeRequest.requesterName}</strong>
                    <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                      <span className="text-rose-600 font-bold">-{requestDetails.duration}h</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-rose-600 font-semibold text-[11px]">-{formatVND(requestDetails.requesterPayChange)}</span>
                    </div>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Người nhận ca</span>
                    <strong className="text-slate-900 block truncate">{requestDetails.recipientEmp.name}</strong>
                    <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                      <span className="text-emerald-600 font-bold">+{requestDetails.duration}h</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-emerald-700 font-semibold text-[11px]">+{formatVND(requestDetails.recipientPayChange)}</span>
                    </div>
                  </div>
                </div>

                {requestDetails.recipientRateInfo && (
                  <p className="text-[10px] text-indigo-700/80 font-mono italic">
                    Áp dụng: {requestDetails.recipientRateInfo.appliedPolicy}
                  </p>
                )}
              </div>
            )}

            {/* Admin Review Note */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ý kiến phê duyệt của Admin (Ghi vào Audit Log chi nhánh) *
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
                required
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
