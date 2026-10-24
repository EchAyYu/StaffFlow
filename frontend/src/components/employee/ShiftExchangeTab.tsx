import React, { useState, useMemo, useEffect } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { ShiftRequestType, DayOfWeek, LineCode, ShiftAssignment } from '../../types';
import {
  DAYS_OF_WEEK,
  LINE_ORDER,
  LINE_META,
  checkShiftEligibility,
  checkShiftCutoffLeadTime,
  checkEmployeeSaleQuota,
  MAX_WEEKLY_HOURS_CAP,
  MIN_REST_PERIOD_HOURS,
  MIN_CUTOFF_LEAD_HOURS,
  ShiftEligibilityResult,
  calculateHoursBetween,
  formatVND,
} from '../../utils/formatters';
import { RequestStatusBadge, LineBadge, RoleBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import {
  ArrowLeftRight,
  DollarSign,
  Plus,
  Clock,
  User,
  MessageSquare,
  Info,
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Check,
  ShieldCheck,
  ShieldAlert,
  Handshake,
  XCircle,
} from 'lucide-react';

export const ShiftExchangeTab: React.FC = () => {
  const {
    currentUser,
    employees,
    roles,
    lineConfigs,
    shiftRequests,
    createShiftRequest,
    respondToPeerRequest,
    claimOpenMarketShift,
    currentBranchId,
    schedule,
  } = useSchedule();

  if (!currentUser) return null;

  const roleMap = useMemo(() => {
    const map = new Map<string, (typeof roles)[0]>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const lineMap = useMemo(() => {
    const map = new Map<LineCode, (typeof lineConfigs)[0]>();
    lineConfigs.forEach((l) => map.set(l.lineCode, l));
    return map;
  }, [lineConfigs]);

  // Current employee's assigned shifts in this branch (All shifts in the week)
  const myAllAssignedShifts = useMemo(() => {
    return schedule.assignments.filter(
      (a) =>
        a.userId === currentUser.id &&
        (a.branchId ? a.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
    );
  }, [schedule.assignments, schedule.branchId, currentUser.id, currentBranchId]);

  // Nghiệp vụ bắt buộc: Chỉ được đổi hoặc bán line mà nhân viên ĐƯỢC SẮP XẾP trong tuần VÀ CHƯA DIỄN RA (Không được bán ca đã qua!)
  const myEligibleUpcomingShifts = useMemo(() => {
    return myAllAssignedShifts.filter((a) => {
      const dayObj = DAYS_OF_WEEK.find((d) => d.key === a.day);
      if (dayObj?.isPast || a.isCompleted) return false;
      return true;
    });
  }, [myAllAssignedShifts]);

  // Backward-compatible reference
  const myAssignedShifts = myEligibleUpcomingShifts;

  // Other staff in this branch
  const otherStaff = useMemo(() => {
    return employees.filter(
      (e) => e.branchId === currentBranchId && e.id !== currentUser.id && e.status === 'active'
    );
  }, [employees, currentBranchId, currentUser.id]);

  // Open Market Shifts in this branch
  const openMarketShifts = useMemo(() => {
    return shiftRequests.filter(
      (r) => r.branchId === currentBranchId && r.isOpenMarket && r.status === 'pending'
    );
  }, [shiftRequests, currentBranchId]);

  // My shift requests
  const myRequests = useMemo(() => {
    return shiftRequests.filter((r) => r.requesterId === currentUser.id && r.branchId === currentBranchId);
  }, [shiftRequests, currentUser.id, currentBranchId]);

  // Nghiệp vụ 4: Lời mời Đổi ca / Bán ca chỉ định từ đồng nghiệp đang chờ Tôi xác nhận (Peer Handshake)
  const incomingPeerRequests = useMemo(() => {
    return shiftRequests.filter(
      (r) =>
        r.branchId === currentBranchId &&
        r.targetUserId === currentUser.id &&
        !r.isOpenMarket &&
        r.status === 'pending' &&
        r.peerStatus === 'waiting_peer'
    );
  }, [shiftRequests, currentBranchId, currentUser.id]);

  // Nghiệp vụ 1: Tổng số giờ làm hiện tại trong tuần của nhân viên đang đăng nhập
  const myCurrentWeeklyHours = useMemo(() => {
    let total = 0;
    myAllAssignedShifts.forEach((a) => {
      const l = lineMap.get(a.lineCode);
      const st = a.customStartTime || l?.startTime || '06:00';
      const et = a.customEndTime || l?.endTime || '14:00';
      const dur = calculateHoursBetween(st, et) || l?.durationHours || 6.5;
      total += dur;
    });
    return Number(total.toFixed(1));
  }, [myAllAssignedShifts, lineMap]);

  // Nghiệp vụ 5: Kiểm tra hạn mức số lần bán ca trong tuần (Full-time: tối đa 2 ca, Part-time: tối đa 4 ca)
  const saleQuotaCheck = useMemo(() => {
    const branchReqs = shiftRequests.filter((r) => r.branchId === currentBranchId);
    return checkEmployeeSaleQuota(currentUser, branchReqs);
  }, [currentUser, shiftRequests, currentBranchId]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<ShiftRequestType>('swap');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [day, setDay] = useState<DayOfWeek>('monday');
  const [lineCode, setLineCode] = useState<LineCode>('O');
  const [saleMode, setSaleMode] = useState<'market' | 'direct'>('market');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [targetDay, setTargetDay] = useState<DayOfWeek>('monday');
  const [targetLineCode, setTargetLineCode] = useState<LineCode>('M');
  const [reason, setReason] = useState('');
  const [claimSuccessNotice, setClaimSuccessNotice] = useState<string | null>(null);

  // Selected shift details for direct sale or swap
  const selectedAssign = useMemo(() => {
    return myAssignedShifts.find((a) => a.id === selectedAssignmentId) || myAssignedShifts[0];
  }, [myAssignedShifts, selectedAssignmentId]);

  const selectedAssignRole = useMemo(() => {
    return selectedAssign ? roleMap.get(selectedAssign.roleId) : undefined;
  }, [selectedAssign, roleMap]);

  const selectedAssignLine = useMemo(() => {
    return selectedAssign ? lineMap.get(selectedAssign.lineCode) : undefined;
  }, [selectedAssign, lineMap]);

  const selectedAssignStartTime = selectedAssign?.customStartTime || selectedAssignLine?.startTime || '06:00';
  const selectedAssignEndTime = selectedAssign?.customEndTime || selectedAssignLine?.endTime || '14:00';

  // Nghiệp vụ 3: Kiểm tra thời hạn Cut-off (Phải gửi yêu cầu trước giờ vào ca ít nhất 4 tiếng)
  const cutoffCheck = useMemo(() => {
    if (!selectedAssign) return { isAllowed: true, hoursRemaining: 24, message: '' };
    return checkShiftCutoffLeadTime(selectedAssign.day, selectedAssignStartTime);
  }, [selectedAssign, selectedAssignStartTime]);

  // Compute qualification and same-shift conflict for all staff in branch
  const staffEligibilityMap = useMemo(() => {
    const map = new Map<string, ShiftEligibilityResult>();
    if (!selectedAssign) return map;

    otherStaff.forEach((emp) => {
      const res = checkShiftEligibility({
        targetEmployee: emp,
        shiftRole: selectedAssignRole,
        shiftDay: selectedAssign.day,
        shiftLineCode: selectedAssign.lineCode,
        shiftStartTime: selectedAssignStartTime,
        shiftEndTime: selectedAssignEndTime,
        allAssignments: schedule.assignments,
        roleMap,
        excludeAssignmentId: selectedAssign.id,
      });
      map.set(emp.id, res);
    });
    return map;
  }, [
    otherStaff,
    selectedAssign,
    selectedAssignRole,
    selectedAssignStartTime,
    selectedAssignEndTime,
    schedule.assignments,
    roleMap,
  ]);

  const eligibleOtherStaff = useMemo(() => {
    return otherStaff.filter((emp) => staffEligibilityMap.get(emp.id)?.isEligible);
  }, [otherStaff, staffEligibilityMap]);

  const ineligibleOtherStaff = useMemo(() => {
    return otherStaff.filter((emp) => !staffEligibilityMap.get(emp.id)?.isEligible);
  }, [otherStaff, staffEligibilityMap]);

  const currentTargetEligibility = useMemo(() => {
    return targetUserId ? staffEligibilityMap.get(targetUserId) : undefined;
  }, [targetUserId, staffEligibilityMap]);

  // When user picks a shift from their assigned shifts
  const handleSelectMyShift = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    const assign = myAssignedShifts.find((a) => a.id === assignmentId);
    if (assign) {
      setDay(assign.day);
      setLineCode(assign.lineCode);

      // Auto-select first eligible target user if current is invalid
      const sRole = roleMap.get(assign.roleId);
      const sLine = lineMap.get(assign.lineCode);
      const st = assign.customStartTime || sLine?.startTime || '06:00';
      const et = assign.customEndTime || sLine?.endTime || '14:00';

      const eligible = otherStaff.filter((emp) => {
        return checkShiftEligibility({
          targetEmployee: emp,
          shiftRole: sRole,
          shiftDay: assign.day,
          shiftLineCode: assign.lineCode,
          shiftStartTime: st,
          shiftEndTime: et,
          allAssignments: schedule.assignments,
          roleMap,
          excludeAssignmentId: assign.id,
        }).isEligible;
      });

      if (eligible.length > 0 && !eligible.some((e) => e.id === targetUserId)) {
        setTargetUserId(eligible[0].id);
      }
    }
  };

  const handleOpenCreate = (type: ShiftRequestType) => {
    setRequestType(type);
    setReason('');
    setSaleMode('market');

    if (type !== 'leave') {
      if (myAssignedShifts.length > 0) {
        const first = myAssignedShifts[0];
        setSelectedAssignmentId(first.id);
        setDay(first.day);
        setLineCode(first.lineCode);

        const fRole = roleMap.get(first.roleId);
        const fLine = lineMap.get(first.lineCode);
        const st = first.customStartTime || fLine?.startTime || '06:00';
        const et = first.customEndTime || fLine?.endTime || '14:00';

        const eligible = otherStaff.filter((emp) => {
          return checkShiftEligibility({
            targetEmployee: emp,
            shiftRole: fRole,
            shiftDay: first.day,
            shiftLineCode: first.lineCode,
            shiftStartTime: st,
            shiftEndTime: et,
            allAssignments: schedule.assignments,
            roleMap,
            excludeAssignmentId: first.id,
          }).isEligible;
        });

        setTargetUserId(eligible[0]?.id || otherStaff[0]?.id || '');
      } else {
        setSelectedAssignmentId('');
        setTargetUserId(otherStaff[0]?.id || '');
      }
    } else {
      setDay('monday');
      setTargetUserId(otherStaff[0]?.id || '');
    }

    setIsModalOpen(true);
  };

  // Evaluate if current logged-in employee can claim an open market shift
  const checkClaimEligibility = (req: (typeof openMarketShifts)[0]) => {
    const assign = req.assignmentId
      ? schedule.assignments.find((a) => a.id === req.assignmentId)
      : schedule.assignments.find(
          (a) => a.day === req.day && a.lineCode === req.lineCode && a.userId === req.requesterId
        );

    const shiftRole = req.roleId
      ? roleMap.get(req.roleId)
      : assign
      ? roleMap.get(assign.roleId)
      : undefined;

    const line = req.lineCode ? lineMap.get(req.lineCode) : undefined;
    const startTime = req.customStartTime || line?.startTime || '06:00';
    const endTime = req.customEndTime || line?.endTime || '14:00';

    return checkShiftEligibility({
      targetEmployee: currentUser,
      shiftRole,
      shiftDay: req.day,
      shiftLineCode: req.lineCode,
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      allAssignments: schedule.assignments,
      roleMap,
      excludeAssignmentId: req.assignmentId,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    if (requestType !== 'leave') {
      // Must have an assigned shift
      if (!selectedAssignmentId || myAssignedShifts.length === 0) {
        alert('Bạn không có ca làm việc nào để đổi hoặc bán!');
        return;
      }

      // Nghiệp vụ 3: Kiểm tra thời hạn Cut-off trước giờ vào ca (ít nhất 4h)
      if (!cutoffCheck.isAllowed) {
        alert(cutoffCheck.message || 'Đã quá thời hạn Cut-off trước giờ vào ca!');
        return;
      }

      // Nghiệp vụ 5: Kiểm tra hạn mức số lần bán ca trong tuần
      if (requestType === 'sale' && !saleQuotaCheck.isAllowed) {
        alert(saleQuotaCheck.message || 'Bạn đã hết hạn mức bán ca trong tuần này!');
        return;
      }

      // Check strict eligibility for direct sale
      if (requestType === 'sale' && saleMode === 'direct') {
        if (!targetUserId) {
          alert('Vui lòng chọn đồng nghiệp nhận ca!');
          return;
        }
        if (currentTargetEligibility && !currentTargetEligibility.isEligible) {
          alert(`Không thể gửi phiếu: ${currentTargetEligibility.reasons[0]}`);
          return;
        }
      }

      // Check strict eligibility for swap
      if (requestType === 'swap') {
        if (!targetUserId) {
          alert('Vui lòng chọn đồng nghiệp đổi ca!');
          return;
        }
        if (currentTargetEligibility && !currentTargetEligibility.isEligible) {
          alert(`Không thể gửi phiếu đổi ca: ${currentTargetEligibility.reasons[0]}`);
          return;
        }
      }
    }

    const targetEmp = employees.find((e) => e.id === targetUserId);
    const line = selectedAssign ? lineMap.get(selectedAssign.lineCode) : undefined;
    const customStartTime = selectedAssign?.customStartTime || line?.startTime;
    const customEndTime = selectedAssign?.customEndTime || line?.endTime;

    const isOpenMarket = requestType === 'sale' && saleMode === 'market';

    createShiftRequest({
      requestType,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      assignmentId: selectedAssignmentId || undefined,
      roleId: selectedAssign ? selectedAssign.roleId : undefined,
      customStartTime,
      customEndTime,
      isOpenMarket,
      targetUserId:
        requestType === 'leave' || isOpenMarket ? undefined : targetUserId || undefined,
      targetUserName:
        requestType === 'leave' || isOpenMarket
          ? undefined
          : targetEmp
          ? targetEmp.name
          : undefined,
      day: selectedAssign ? selectedAssign.day : day,
      lineCode: requestType === 'leave' ? undefined : selectedAssign ? selectedAssign.lineCode : lineCode,
      targetDay: requestType === 'swap' ? targetDay : undefined,
      targetLineCode: requestType === 'swap' ? targetLineCode : undefined,
      reason: reason.trim(),
    });

    setIsModalOpen(false);
  };

  const handleClaim = (requestId: string, shiftDesc: string) => {
    claimOpenMarketShift(requestId, currentUser.id, currentUser.name);
    setClaimSuccessNotice(`Bạn đã nhận thành công ca [${shiftDesc}]. Phiếu đã chuyển đến Admin chi nhánh để duyệt!`);
    setTimeout(() => setClaimSuccessNotice(null), 4000);
  };

  const handlePeerDecision = (requestId: string, decision: 'accept' | 'decline', shiftDesc: string) => {
    respondToPeerRequest(requestId, decision);
    if (decision === 'accept') {
      setClaimSuccessNotice(
        `🤝 Bạn đã ĐỒNG Ý nhận/đổi ca [${shiftDesc}]. Yêu cầu đã được chuyển tiếp lên Quản lý chi nhánh phê duyệt (Bước 2/2)!`
      );
    } else {
      setClaimSuccessNotice(`Bạn đã từ chối lời mời đổi/nhận ca [${shiftDesc}].`);
    }
    setTimeout(() => setClaimSuccessNotice(null), 4500);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Toast Alert for Claim Success */}
      {claimSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-lg shadow-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold">{claimSuccessNotice}</span>
          </div>
          <button
            onClick={() => setClaimSuccessNotice(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <ArrowLeftRight size={17} className="text-blue-600" />
            Quản Lý Phiếu Đổi Ca, Bán Ca & Chợ Ca Chi Nhánh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bán ca công khai lên Chợ Ca hoặc đổi ca trực tiếp với đồng nghiệp. Admin chi nhánh kiểm tra và phê duyệt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeftRight size={13} className="text-purple-600" />}
            onClick={() => handleOpenCreate('swap')}
            className="rounded-xl hover:border-purple-300 hover:bg-purple-50/50"
          >
            Đổi Ca (Swap)
          </Button>
          <Button
            variant="accent"
            size="sm"
            icon={<DollarSign size={13} />}
            onClick={() => handleOpenCreate('sale')}
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
          >
            Bán Ca / Mở Bán Chợ Ca
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenCreate('leave')}
            className="rounded-xl border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100"
          >
            Xin Nghỉ Thêm
          </Button>
        </div>
      </div>

      {/* BẢNG KIỂM SOÁT 5 QUY TẮC NGHIỆP VỤ PHÂN CA & TRAO ĐỔI CA */}
      <div className="bg-white border border-indigo-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Hệ Thống Kiểm Soát 5 Quy Tắc Nghiệp Vụ Đổi & Bán Ca Tự Động
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            Ràng buộc Luật Lao Động & Vận Hành Chuỗi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-[11px]">
          {/* Rule 1: Max Weekly Hours Cap */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-800">
              <span>1. Trần Giờ Tuần</span>
              <span
                className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                  myCurrentWeeklyHours >= MAX_WEEKLY_HOURS_CAP
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {myCurrentWeeklyHours}h / {MAX_WEEKLY_HOURS_CAP}h
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Tối đa {MAX_WEEKLY_HOURS_CAP}h/tuần để chống quá tải nhân sự.
            </p>
          </div>

          {/* Rule 2: Anti-Clopening Rest Period */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-800">
              <span>2. Nghỉ Giữa 2 Ngày</span>
              <span className="font-mono px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800">
                ≥ {MIN_REST_PERIOD_HOURS}h nghỉ
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Chặn làm ca đóng cửa khuya hôm trước tiếp nối ca mở cửa sớm hôm sau.
            </p>
          </div>

          {/* Rule 3: Cut-off Lead Time */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-800">
              <span>3. Hạn Chót Cut-off</span>
              <span className="font-mono px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900">
                Trước ≥ {MIN_CUTOFF_LEAD_HOURS}h
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Gửi phiếu trước giờ vào ca ít nhất {MIN_CUTOFF_LEAD_HOURS} tiếng để Quản lý kịp duyệt.
            </p>
          </div>

          {/* Rule 4: 2-Step Peer Confirmation */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-800">
              <span>4. Xác Nhận 2 Bước</span>
              <span
                className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                  incomingPeerRequests.length > 0
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {incomingPeerRequests.length > 0
                  ? `${incomingPeerRequests.length} chờ bạn`
                  : 'Peer Handshake'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Đồng nghiệp phải bấm "Đồng ý" trước khi trình Quản lý phê duyệt.
            </p>
          </div>

          {/* Rule 5: Sale Quota Limit */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-800">
              <span>5. Hạn Mức Bán Ca</span>
              <span
                className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                  saleQuotaCheck.isAllowed
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                Đã bán {saleQuotaCheck.usedCount}/{saleQuotaCheck.maxLimit} ca
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              {currentUser.employmentType === 'full_time'
                ? 'Full-time bán tối đa 2 ca/tuần (giữ chuẩn hợp đồng).'
                : 'Part-time bán tối đa 4 ca/tuần.'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 0: LỜI MỜI ĐỔI CA / NHẬN CA TỪ ĐỒNG NGHIỆP CẦN BẠN XÁC NHẬN (NGHIỆP VỤ 4: PEER HANDSHAKE) */}
      {incomingPeerRequests.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50/70 to-white border-2 border-purple-300 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-purple-200 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <Handshake size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                    Lời Mời Đổi Ca / Giao Ca Trực Tiếp Cần Bạn Xác Nhận (Bước 1/2)
                  </h3>
                  <span className="bg-rose-600 text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-full">
                    {incomingPeerRequests.length} lời mời mới
                  </span>
                </div>
                <p className="text-[11px] text-purple-800">
                  Đồng nghiệp đã chọn bạn làm người nhận/đổi ca. Bạn cần bấm <b>"Đồng Ý"</b> để phiếu chuyển lên Admin chi nhánh duyệt chính thức.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingPeerRequests.map((req) => {
              const dayObj = DAYS_OF_WEEK.find((d) => d.key === req.day);
              const targetDayObj = req.targetDay
                ? DAYS_OF_WEEK.find((d) => d.key === req.targetDay)
                : undefined;
              const assign = req.assignmentId
                ? schedule.assignments.find((a) => a.id === req.assignmentId)
                : undefined;
              const shiftRole = req.roleId
                ? roleMap.get(req.roleId)
                : assign
                ? roleMap.get(assign.roleId)
                : undefined;
              const peerEligibility = checkClaimEligibility(req);

              return (
                <div
                  key={req.id}
                  className="bg-white border border-purple-200 rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          req.requestType === 'swap'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {req.requestType === 'swap'
                          ? '🔄 ĐỀ NGHỊ ĐỔI CA (SWAP)'
                          : '🎯 BÁN CA TRỰC TIẾP CHO BẠN'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{req.id}</span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-slate-700">
                        Người gửi lời mời: <strong className="text-slate-900">{req.requesterName}</strong>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-600">Ca chuyển cho bạn:</span>
                        <strong className="text-slate-900">
                          Thứ {dayObj?.label || req.day} ({dayObj?.dateStr})
                        </strong>
                        {req.lineCode && <LineBadge lineCode={req.lineCode} size="sm" />}
                        {shiftRole && (
                          <RoleBadge
                            roleCode={shiftRole.code}
                            roleName={shiftRole.name}
                            size="sm"
                          />
                        )}
                      </div>

                      {req.requestType === 'swap' && req.targetDay && req.targetLineCode && (
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] bg-purple-50/70 p-2 rounded-lg border border-purple-200">
                          <span className="text-purple-800">Ca của bạn đổi lại:</span>
                          <strong className="text-purple-950">
                            Thứ {targetDayObj?.label || req.targetDay} • Line {req.targetLineCode}
                          </strong>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                        Lý do: "{req.reason}"
                      </p>

                      {peerEligibility.projectedWeeklyHours !== undefined && (
                        <div className="text-[11px] font-mono text-indigo-800 bg-indigo-50/70 px-2 py-1 rounded border border-indigo-100">
                          ⏱️ Dự kiến giờ tuần của bạn nếu nhận ca:{' '}
                          <strong>
                            {peerEligibility.currentWeeklyHours}h → {peerEligibility.projectedWeeklyHours}h / {MAX_WEEKLY_HOURS_CAP}h
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!peerEligibility.isEligible}
                      onClick={() =>
                        handlePeerDecision(
                          req.id,
                          'accept',
                          `Thứ ${dayObj?.label || req.day} - Line ${req.lineCode}`
                        )
                      }
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      <Check size={14} className="mr-1" /> Đồng Ý Nhận / Đổi Ca
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        handlePeerDecision(
                          req.id,
                          'decline',
                          `Thứ ${dayObj?.label || req.day} - Line ${req.lineCode}`
                        )
                      }
                      className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <XCircle size={14} className="mr-1" /> Từ Chối
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1: CHỢ CA LÀM VIỆC (OPEN SHIFT MARKET) */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Chợ Ca Làm Việc Chi Nhánh (Ca Đang Mở Bán Công Khai)
                </h3>
                <span className="bg-blue-600 text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-full">
                  {openMarketShifts.length} ca
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Đồng nghiệp mở bán khi bận việc. Bạn có thể nhấn <b>"Nhận Ca Này"</b> để hỗ trợ đồng đội và tăng thu nhập!
              </p>
            </div>
          </div>
        </div>

        {openMarketShifts.length === 0 ? (
          <div className="bg-white/80 border border-dashed border-blue-200 rounded-lg p-6 text-center">
            <Sparkles size={24} className="mx-auto text-blue-400 mb-1.5" />
            <p className="text-xs font-medium text-slate-700">
              Hiện tại không có ca nào đang mở bán trên Chợ Ca.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tất cả các ca trong tuần đang có nhân sự đảm nhiệm đầy đủ.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {openMarketShifts.map((req) => {
              const dayObj = DAYS_OF_WEEK.find((d) => d.key === req.day);
              const isMine = req.requesterId === currentUser.id;
              const isClaimedByMe = req.claimedByUserId === currentUser.id;
              const isClaimedByOther = req.claimedByUserId && !isClaimedByMe;

              const assign = req.assignmentId
                ? schedule.assignments.find((a) => a.id === req.assignmentId)
                : schedule.assignments.find(
                    (a) => a.day === req.day && a.lineCode === req.lineCode && a.userId === req.requesterId
                  );
              const shiftRole = req.roleId
                ? roleMap.get(req.roleId)
                : assign
                ? roleMap.get(assign.roleId)
                : undefined;

              const claimCheck = checkClaimEligibility(req);

              return (
                <div
                  key={req.id}
                  className={`bg-white border rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-3 transition-all ${
                    isClaimedByMe
                      ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                      : isMine
                      ? 'border-blue-300 bg-blue-50/20'
                      : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono">
                        <span className="font-bold text-xs text-slate-900 uppercase">
                          Thứ {dayObj?.label || req.day}
                        </span>
                        <span className="text-[10px] text-slate-400">({dayObj?.dateStr})</span>
                        {req.lineCode && <LineBadge lineCode={req.lineCode} size="sm" />}
                        {shiftRole && (
                          <RoleBadge
                            roleCode={shiftRole.code}
                            roleName={shiftRole.name}
                            size="sm"
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {req.id}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2 text-slate-700">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span>Người mở bán:</span>
                        <strong className="text-slate-900">
                          {isMine ? 'Bạn (Chính bạn)' : req.requesterName}
                        </strong>
                      </div>

                      {req.customStartTime && req.customEndTime && (
                        <div className="flex items-center gap-2 text-slate-700 font-mono text-[11px]">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          <span>Khung giờ:</span>
                          <span className="font-bold text-blue-700">
                            {req.customStartTime} - {req.customEndTime}
                          </span>
                        </div>
                      )}

                      {shiftRole && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                          <span className="font-semibold text-blue-900">Yêu cầu vị trí:</span>
                          <span>{shiftRole.name}</span>
                          {shiftRole.genderRequirement === 'male_only' && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[10px]">
                              Nam only
                            </span>
                          )}
                          {shiftRole.code === 'KIT' && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-mono font-bold text-[10px]">
                              Lương cố định Bếp (50.000đ/h)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] italic">
                        <MessageSquare size={13} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">"{req.reason}"</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Status */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isClaimedByMe ? (
                      <div className="w-full text-center py-1.5 px-3 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">
                        <Check size={14} />
                        Bạn đã đăng ký nhận ca này (Chờ Quản lý duyệt)
                      </div>
                    ) : isClaimedByOther ? (
                      <div className="text-xs text-slate-500 font-mono italic">
                        Đồng nghiệp <b>{req.claimedByUserName}</b> đã xin nhận ca này
                      </div>
                    ) : isMine ? (
                      <div className="text-xs text-blue-700 font-semibold flex items-center gap-1.5">
                        <Clock size={13} />
                        Đang mở bán công khai cho đồng nghiệp
                      </div>
                    ) : claimCheck.isEligible ? (
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() =>
                          handleClaim(
                            req.id,
                            `Thứ ${dayObj?.label || req.day} - Line ${req.lineCode}`
                          )
                        }
                        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                      >
                        ✋ Tôi Muốn Nhận Ca Này
                      </Button>
                    ) : (
                      <div className="w-full p-2.5 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-950 text-xs flex items-start gap-2 shadow-2xs">
                        <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-tight">
                          <strong className="block text-amber-900 font-bold">Không thể nhận ca này:</strong>
                          <span className="text-amber-800">{claimCheck.reasons[0]}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: MY SUBMITTED REQUESTS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono">
              Lịch Sử Phiếu Của Tôi ({myRequests.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              (Bao gồm Đổi ca, Bán ca và Xin nghỉ thêm)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Tuần hiện tại</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200 uppercase font-mono text-[11px]">
                <th className="py-2.5 px-4 w-28">Mã Phiếu</th>
                <th className="py-2.5 px-4">Loại Phiếu</th>
                <th className="py-2.5 px-4">Ca Của Tôi</th>
                <th className="py-2.5 px-4">Hình Thức / Người Nhận</th>
                <th className="py-2.5 px-4">Lý Do Đề Xuất</th>
                <th className="py-2.5 px-4 text-center">Trạng Thái</th>
                <th className="py-2.5 px-4">Ý Kiến Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Bạn chưa gửi phiếu đổi ca hay bán ca nào trong tuần này.
                  </td>
                </tr>
              ) : (
                myRequests.map((r) => {
                  const dayObj = DAYS_OF_WEEK.find((d) => d.key === r.day);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.id}</td>

                      <td className="py-3 px-4">
                        {r.requestType === 'swap' ? (
                          <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            ĐỔI CA
                          </span>
                        ) : r.requestType === 'sale' ? (
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            BÁN CA
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                            NGHỈ THÊM
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900 uppercase">
                          Thứ {dayObj?.label || r.day}
                        </span>{' '}
                        {r.lineCode && <LineBadge lineCode={r.lineCode} size="sm" />}
                      </td>

                      <td className="py-3 px-4">
                        {r.isOpenMarket ? (
                          r.claimedByUserId ? (
                            <div>
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                🛒 Chợ Ca: Đã có người nhận
                              </span>
                              <p className="font-semibold text-slate-900 mt-0.5">
                                {r.claimedByUserName}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              🛒 Đang mở bán công khai
                            </span>
                          )
                        ) : r.targetUserName ? (
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">{r.targetUserName}</p>
                            {r.targetDay && r.targetLineCode && (
                              <p className="text-[10px] font-mono text-slate-400">
                                Đổi ca: Thứ {r.targetDay} ({r.targetLineCode})
                              </p>
                            )}
                            {r.peerStatus === 'waiting_peer' && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                ⏳ Bước 1/2: Chờ đồng nghiệp xác nhận
                              </span>
                            )}
                            {r.peerStatus === 'peer_accepted' && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                🤝 Đồng nghiệp đã đồng ý (Bước 2/2)
                              </span>
                            )}
                            {r.peerStatus === 'peer_declined' && (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                ✗ Đồng nghiệp từ chối
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Quản lý xem xét</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={r.reason}>
                        {r.reason}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <RequestStatusBadge status={r.status} />
                      </td>

                      <td className="py-3 px-4 text-slate-600 italic">
                        {r.reviewNote ? (
                          <span className="text-slate-800 font-medium">"{r.reviewNote}"</span>
                        ) : (
                          <span className="text-slate-400">Chờ xem xét...</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE SHIFT REQUEST */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          requestType === 'swap'
            ? 'Tạo Phiếu Đổi Ca (Swap Shift)'
            : requestType === 'sale'
            ? 'Tạo Phiếu Bán Ca (Sell Shift)'
            : 'Tạo Phiếu Xin Nghỉ Thêm (Vượt Hạn Mức OFF)'
        }
        subtitle={
          requestType === 'leave'
            ? 'Gửi yêu cầu xin nghỉ phép bổ sung đến Admin chi nhánh phê duyệt'
            : 'Yêu cầu nhân viên phải có ca làm việc thực tế được xếp trong tuần'
        }
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg"
            >
              Huỷ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={
                requestType !== 'leave' &&
                (myAssignedShifts.length === 0 ||
                  !cutoffCheck.isAllowed ||
                  (requestType === 'sale' && !saleQuotaCheck.isAllowed) ||
                  (requestType === 'sale' && saleMode === 'direct' && currentTargetEligibility && !currentTargetEligibility.isEligible) ||
                  (requestType === 'swap' && currentTargetEligibility && !currentTargetEligibility.isEligible))
              }
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Gửi Phiếu Yêu Cầu
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* CONSTRAINT CHECK: Must have upcoming shifts to swap or sell */}
          {requestType !== 'leave' && myEligibleUpcomingShifts.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <span>Không có ca làm việc sắp tới để đổi hoặc bán!</span>
              </div>
              {myAllAssignedShifts.length > 0 ? (
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Bạn có <strong>{myAllAssignedShifts.length} ca làm việc</strong> trong tuần này, tuy nhiên toàn bộ đều là các ca <strong>ĐÃ DIỄN RA (ĐÃ QUA)</strong>. Theo đúng quy định nghiệp vụ, hệ thống <strong>chỉ cho phép đổi hoặc bán các ca làm việc sắp tới</strong>, tuyệt đối không được bán hoặc đổi ca đã qua.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Bạn chưa được phân bổ ca làm việc nào trong tuần này (hoặc lịch tuần đang ở trạng thái nháp chưa công bố). Theo quy định, bạn chỉ có thể tạo yêu cầu Đổi ca hoặc Bán ca khi thực tế được xếp ca.
                </p>
              )}
            </div>
          ) : requestType === 'leave' ? (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                Ngày bạn muốn xin nghỉ thêm (OFF):
              </span>
              <div>
                <label className="block text-slate-500 mb-1">Chọn ngày trong tuần</label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value as DayOfWeek)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label} ({d.dateStr})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Lưu ý: Đối với Full-time làm tối thiểu 8h/ngày, việc nghỉ vượt quá hạn mức phải có sự phê duyệt của Quản lý chi nhánh.
              </p>
            </div>
          ) : (
            <>
              {/* SELECT ASSIGNED SHIFT */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="block font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                    1. Chọn ca làm việc của bạn cần đổi / bán * :
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                      ✓ Chỉ hiển thị ca sắp tới
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                        cutoffCheck.isAllowed
                          ? 'text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-rose-700 bg-rose-50 border-rose-200'
                      }`}
                    >
                      {cutoffCheck.isAllowed
                        ? `✓ Cut-off: Còn ${cutoffCheck.hoursRemaining}h`
                        : `✗ Vi phạm Cut-off (< ${MIN_CUTOFF_LEAD_HOURS}h)`}
                    </span>
                  </div>
                </div>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => handleSelectMyShift(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-900"
                  required
                >
                  {myEligibleUpcomingShifts.map((a) => {
                    const line = lineMap.get(a.lineCode);
                    const role = roleMap.get(a.roleId);
                    const dayObj = DAYS_OF_WEEK.find((d) => d.key === a.day);
                    const st = a.customStartTime || line?.startTime || '06:00';
                    const et = a.customEndTime || line?.endTime || '14:00';
                    return (
                      <option key={a.id} value={a.id}>
                        Thứ {dayObj?.label || a.day} ({dayObj?.dateStr}) • Line {a.lineCode} ({st} - {et}) • Vị trí: {role?.name || a.roleId}
                      </option>
                    );
                  })}
                </select>
                {!cutoffCheck.isAllowed ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-[11px] flex items-start gap-2">
                    <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-rose-900">Vi phạm Quy tắc 3 (Hạn chót Cut-off trước giờ vào ca):</strong>
                      <span>{cutoffCheck.message}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Tuân thủ nghiệp vụ: Hệ thống chỉ hiển thị ca được sắp xếp trong tuần và chưa diễn ra (trước giờ vào ca ≥ {MIN_CUTOFF_LEAD_HOURS}h).
                  </p>
                )}
              </div>

              {/* SALE OPTIONS */}
              {requestType === 'sale' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="block font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                      2. Phương thức bán ca:
                    </label>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        saleQuotaCheck.isAllowed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      Hạn mức bán ca tuần: {saleQuotaCheck.usedCount}/{saleQuotaCheck.maxLimit} ca ({currentUser.employmentType === 'full_time' ? 'Full-time' : 'Part-time'})
                    </span>
                  </div>

                  {!saleQuotaCheck.isAllowed && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-[11px] flex items-start gap-2">
                      <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-rose-900">Vi phạm Quy tắc 5 (Vượt hạn mức bán ca trong tuần):</strong>
                        <span>{saleQuotaCheck.message}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSaleMode('market')}
                      className={`p-2.5 text-left rounded-lg border text-xs transition-all cursor-pointer ${
                        saleMode === 'market'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <ShoppingBag size={14} /> Mở bán Chợ Ca
                      </div>
                      <div className={`text-[10px] mt-1 ${saleMode === 'market' ? 'text-blue-100' : 'text-slate-400'}`}>
                        Bất kỳ đồng nghiệp nào cũng có thể nhận
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSaleMode('direct')}
                      className={`p-2.5 text-left rounded-lg border text-xs transition-all cursor-pointer ${
                        saleMode === 'direct'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <User size={14} /> Chỉ định cụ thể
                      </div>
                      <div className={`text-[10px] mt-1 ${saleMode === 'direct' ? 'text-blue-100' : 'text-slate-400'}`}>
                        Giao thẳng cho 1 đồng nghiệp đã thỏa thuận
                      </div>
                    </button>
                  </div>

                  {saleMode === 'direct' && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-slate-700 font-bold text-[11px] uppercase tracking-wide">
                          Chọn đồng nghiệp nhận ca:
                        </label>
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                          {eligibleOtherStaff.length} người đủ điều kiện
                        </span>
                      </div>
                      <select
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                      >
                        {eligibleOtherStaff.length > 0 && (
                          <optgroup label="✓ Đủ điều kiện (Đúng chuyên môn, giới tính, giờ tuần ≤ 48h & nghỉ ≥ 8h)">
                            {eligibleOtherStaff.map((emp) => {
                              const el = staffEligibilityMap.get(emp.id);
                              return (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.employeeCode} • {emp.gender === 'male' ? 'Nam' : 'Nữ'} • Giờ tuần: {el?.currentWeeklyHours}h → {el?.projectedWeeklyHours}h/{MAX_WEEKLY_HOURS_CAP}h)
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        {ineligibleOtherStaff.length > 0 && (
                          <optgroup label="✗ Không đủ điều kiện (Cùng ca / Trùng giờ / Thiếu chuyên môn / Vượt 48h / Nghỉ < 8h)">
                            {ineligibleOtherStaff.map((emp) => {
                              const reason = staffEligibilityMap.get(emp.id)?.reasons[0];
                              return (
                                <option key={emp.id} value={emp.id}>
                                  [Không đủ ĐK] {emp.name} ({reason})
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>

                      {currentTargetEligibility && currentTargetEligibility.isEligible && (
                        <div className="p-2 bg-indigo-50/70 border border-indigo-200 rounded-lg text-[11px] text-indigo-900 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            ⏱️ Giờ làm của đồng nghiệp sau nhận ca:{' '}
                            <strong className="font-mono">
                              {currentTargetEligibility.currentWeeklyHours}h → {currentTargetEligibility.projectedWeeklyHours}h / {MAX_WEEKLY_HOURS_CAP}h
                            </strong>
                          </span>
                          <span className="font-semibold text-purple-800">
                            🤝 Bước 1: Đồng nghiệp bấm "Đồng ý" → Bước 2: Quản lý duyệt
                          </span>
                        </div>
                      )}

                      {/* Live Validation Alert for Selected Staff */}
                      {currentTargetEligibility && !currentTargetEligibility.isEligible && (
                        <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-rose-800">
                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                            <span>Đồng nghiệp này không đủ điều kiện nhận ca:</span>
                          </div>
                          <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5">
                            {currentTargetEligibility.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {eligibleOtherStaff.length === 0 && (
                        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                          ⚠️ <strong>Lưu ý:</strong> Hiện không có đồng nghiệp nào trong chi nhánh đủ điều kiện nhận ca trực tiếp này (do tất cả nhân sự hoặc đã có lịch làm cùng ca/trùng giờ, hoặc không đủ kỹ năng chuyên môn/giới tính/vượt trần 48h cho ca này). Bạn hãy chọn phương thức <strong>"Mở bán Chợ Ca"</strong> để thông báo cho toàn chi nhánh.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SWAP OPTIONS */}
              {requestType === 'swap' && (
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                        2. Đổi với đồng nghiệp nào:
                      </label>
                      <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                        {eligibleOtherStaff.length} người đủ điều kiện
                      </span>
                    </div>
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                    >
                      {eligibleOtherStaff.length > 0 && (
                        <optgroup label="✓ Đủ điều kiện nhận ca của bạn (Đúng chuyên môn, giới tính, giờ tuần ≤ 48h & nghỉ ≥ 8h)">
                          {eligibleOtherStaff.map((emp) => {
                            const el = staffEligibilityMap.get(emp.id);
                            return (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.employeeCode} • {emp.gender === 'male' ? 'Nam' : 'Nữ'} • Giờ tuần: {el?.currentWeeklyHours}h → {el?.projectedWeeklyHours}h/{MAX_WEEKLY_HOURS_CAP}h)
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {ineligibleOtherStaff.length > 0 && (
                        <optgroup label="✗ Không đủ điều kiện nhận ca của bạn">
                          {ineligibleOtherStaff.map((emp) => {
                            const reason = staffEligibilityMap.get(emp.id)?.reasons[0];
                            return (
                              <option key={emp.id} value={emp.id}>
                                [Không đủ ĐK] {emp.name} ({reason})
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>

                    {currentTargetEligibility && currentTargetEligibility.isEligible && (
                      <div className="mt-2 p-2 bg-purple-50/70 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          🤝 <strong>Xác nhận 2 bước (Peer Handshake):</strong> Đồng nghiệp phải bấm "Đồng ý" trước khi trình Quản lý phê duyệt.
                        </span>
                      </div>
                    )}

                    {currentTargetEligibility && !currentTargetEligibility.isEligible && (
                      <div className="mt-2 p-2 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs">
                        <span className="font-bold">Không thể đổi ca với nhân sự này:</span> {currentTargetEligibility.reasons.join(' • ')}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-1">
                      3. Ca bạn muốn nhận lại từ đồng nghiệp:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 mb-0.5 text-[11px]">Ngày nhận lại</label>
                        <select
                          value={targetDay}
                          onChange={(e) => setTargetDay(e.target.value as DayOfWeek)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                        >
                          {DAYS_OF_WEEK.map((d) => (
                            <option key={d.key} value={d.key}>
                              {d.label} ({d.dateStr})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-0.5 text-[11px]">Line nhận lại</label>
                        <select
                          value={targetLineCode}
                          onChange={(e) => setTargetLineCode(e.target.value as LineCode)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                        >
                          {LINE_ORDER.map((l) => (
                            <option key={l} value={l}>
                              {LINE_META[l].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Lý do chi tiết gửi Quản lý phê duyệt *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ghi rõ lý do gia đình, lịch thi học kỳ, việc đột xuất..."
              rows={2}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
