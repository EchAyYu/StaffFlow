import React, { useState, useMemo } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { ShiftAssignment, LineCode, DayOfWeek, OverrideProposal } from '../../types';
import {
  DAYS_OF_WEEK,
  LINE_ORDER,
  LINE_META,
  makeAssignmentId,
  calculateHoursBetween,
  calculateShiftHourlyRate,
  formatVND,
} from '../../utils/formatters';
import { RoleBadge, LineBadge, ScheduleStatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import {
  Sparkles,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Check,
  Sliders,
  Edit2,
  Plus,
} from 'lucide-react';

export const ScheduleMasterTab: React.FC = () => {
  const {
    schedule,
    employees,
    roles,
    lineConfigs,
    lineRequirements,
    currentBranchId,
    autoGenerateSchedule,
    publishSchedule,
    manualAssignSlot,
    confirmOverride,
    clearSchedule,
    isSolving,
    solverLogs,
    showSolverModal,
    closeSolverModal,
  } = useSchedule();

  // View mode & Day selection
  const [viewMode, setViewMode] = useState<'daily_timeline' | 'weekly_grid'>('daily_timeline');
  const [selectedDayKey, setSelectedDayKey] = useState<DayOfWeek>('monday');

  // Slot modal state
  const [selectedSlot, setSelectedSlot] = useState<ShiftAssignment | null>(null);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);

  // Ca gãy / Custom hours state for modal
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customStart, setCustomStart] = useState('06:00');
  const [customEnd, setCustomEnd] = useState('10:00');
  const [copyNotice, setCopyNotice] = useState(false);

  // Override proposal confirm modal
  const [activeProposal, setActiveProposal] = useState<OverrideProposal | null>(null);
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Shortage breakdown by Line
  const [showShortageDetails, setShowShortageDetails] = useState(false);
  // Override proposals collapsibility
  const [showOverrideDetails, setShowOverrideDetails] = useState(false);
  const [isOverrideDismissed, setIsOverrideDismissed] = useState(false);

  const totalMissingCount = useMemo(() => {
    return schedule.shortageWarnings.reduce((sum, w) => sum + w.missingCount, 0);
  }, [schedule.shortageWarnings]);

  const shortagesByLine = useMemo(() => {
    const counts: Record<LineCode, number> = { O: 0, M: 0, D: 0 };
    schedule.shortageWarnings.forEach((w) => {
      counts[w.lineCode] = (counts[w.lineCode] || 0) + w.missingCount;
    });
    return counts;
  }, [schedule.shortageWarnings]);

  const empMap = useMemo(() => {
    const map = new Map<string, typeof employees[0]>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const roleMap = useMemo(() => {
    const map = new Map<string, typeof roles[0]>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const lineMap = useMemo(() => {
    const map = new Map<LineCode, typeof lineConfigs[0]>();
    lineConfigs.forEach((l) => map.set(l.lineCode, l));
    return map;
  }, [lineConfigs]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, ShiftAssignment>();
    schedule.assignments.forEach((a) => map.set(a.id, a));
    return map;
  }, [schedule.assignments]);

  const totalSlots = schedule.assignments.length;
  const filledSlots = schedule.assignments.filter((a) => a.userId !== null).length;
  const unassignedSlots = totalSlots - filledSlots;
  const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  // Hourly timeline columns for Operation Shift Sheet (~05 to ~24)
  const TIMELINE_HOURS = [
    '05', '06', '07', '08', '09', '10', '11', '12',
    '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24'
  ];

  // Selected Day Computations
  const selectedDayObj = useMemo(() => {
    return DAYS_OF_WEEK.find((d) => d.key === selectedDayKey) || DAYS_OF_WEEK[0];
  }, [selectedDayKey]);

  const currentDayAssignments = useMemo(() => {
    return schedule.assignments.filter((a) => a.day === selectedDayKey);
  }, [schedule.assignments, selectedDayKey]);

  const currentDayAssigned = useMemo(() => {
    return currentDayAssignments.filter((a) => a.userId !== null);
  }, [currentDayAssignments]);

  const currentDayUnassigned = useMemo(() => {
    return currentDayAssignments.filter((a) => a.userId === null);
  }, [currentDayAssignments]);

  const currentDayTotalHours = useMemo(() => {
    return currentDayAssigned.reduce((sum, a) => {
      const line = lineMap.get(a.lineCode);
      const st = a.customStartTime || line?.startTime || '06:00';
      const et = a.customEndTime || line?.endTime || '12:00';
      return sum + calculateHoursBetween(st, et);
    }, 0);
  }, [currentDayAssigned, lineMap]);

  const currentDayStaffCount = useMemo(() => {
    return new Set(currentDayAssigned.map((a) => a.userId)).size;
  }, [currentDayAssigned]);

  const handleSlotClick = (assignment: ShiftAssignment) => {
    setSelectedSlot(assignment);
    const line = lineMap.get(assignment.lineCode);
    const hasCustom = Boolean(assignment.customStartTime && assignment.customEndTime);
    setIsCustomTime(hasCustom);
    setCustomStart(assignment.customStartTime || line?.startTime || '06:00');
    setCustomEnd(assignment.customEndTime || line?.endTime || '12:00');
    setIsSlotModalOpen(true);
  };

  const handleCopyDaySummary = () => {
    const lines = [
      `📋 LỊCH LÀM VIỆC NGÀY ${selectedDayObj.label.toUpperCase()} (${selectedDayObj.dateStr}) - CHI NHÁNH ${currentBranchId}:`,
      `----------------------------------------------------`,
    ];
    if (currentDayAssigned.length === 0) {
      lines.push(`(Chưa có nhân sự nào được xếp ca)`);
    } else {
      currentDayAssigned.forEach((a, idx) => {
        const emp = empMap.get(a.userId!);
        const role = roleMap.get(a.roleId);
        const line = lineMap.get(a.lineCode);
        const st = a.customStartTime || line?.startTime || '06:00';
        const et = a.customEndTime || line?.endTime || '12:00';
        const hours = calculateHoursBetween(st, et);
        const isCustom = Boolean(a.customStartTime && a.customEndTime);
        lines.push(
          `${idx + 1}. [${emp?.employeeCode || 'NV'}] ${emp?.name || 'N/A'} - ${role?.name || a.roleId}: ${st} - ${et} (${hours}h)${isCustom ? ' [Ca gãy]' : ''}`
        );
      });
    }
    lines.push(`----------------------------------------------------`);
    lines.push(`Tổng nhân sự: ${currentDayStaffCount} | Tổng giờ: ${currentDayTotalHours.toFixed(1)}h | Còn thiếu: ${currentDayUnassigned.length} vị trí`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopyNotice(true);
    setTimeout(() => setCopyNotice(false), 2500);
  };

  const handleConfirmOverrideClick = (proposal: OverrideProposal) => {
    setActiveProposal(proposal);
    setOverrideReasonInput(
      `Admin phê duyệt đặc cách cho ${proposal.proposedUserName} hỗ trợ ca do thiếu nhân sự chuyên môn.`
    );
  };

  const executeOverrideConfirm = () => {
    if (!activeProposal) return;
    confirmOverride(
      activeProposal.assignmentId,
      activeProposal.proposedUserId,
      overrideReasonInput
    );
    setActiveProposal(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['Ngay', 'Line', 'Khung Gio', 'Vai Tro', 'Ma NV', 'Ten Nhan Vien', 'Ghi Chu'],
    ];

    DAYS_OF_WEEK.forEach((day) => {
      LINE_ORDER.forEach((lineCode) => {
        const line = lineMap.get(lineCode);
        const reqs = lineRequirements.filter(
          (r) => r.branchId === currentBranchId && r.lineCode === lineCode
        );

        reqs.forEach((req) => {
          const role = roleMap.get(req.roleId);
          for (let i = 0; i < req.headcountRequired; i++) {
            const slotId = makeAssignmentId(day.key, lineCode, req.roleId, i);
            const a = assignmentMap.get(slotId);
            const emp = a?.userId ? empMap.get(a.userId) : null;

            rows.push([
              day.label,
              line?.lineName || lineCode,
              `${line?.startTime} - ${line?.endTime}`,
              role?.name || req.roleId,
              emp ? emp.employeeCode : 'CHUA_XEP',
              emp ? emp.name : 'Vị trí trống',
              a?.isOverride ? `Override: ${a.overrideReason}` : '',
            ]);
          }
        });
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `StaffFlow_Master_${schedule.branchId}_${schedule.weekStartDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Action Header Bar */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Left: Schedule status & version */}
        <div className="flex flex-wrap items-center gap-2.5">
          <ScheduleStatusBadge status={schedule.status} version={schedule.version} />

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-600">
            <span>Tiến độ lấp đầy:</span>
            <span
              className={`font-mono font-bold ${
                fillRate === 100 ? 'text-emerald-700' : 'text-blue-700'
              }`}
            >
              {filledSlots}/{totalSlots} ({fillRate}%)
            </span>
            <div className="w-16 h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${fillRate === 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                style={{ width: `${fillRate}%` }}
              />
            </div>
          </div>

          {isOverrideDismissed && schedule.overrideProposals.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsOverrideDismissed(false);
                setShowOverrideDetails(true);
              }}
              className="text-[11px] font-mono px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100 flex items-center gap-1 cursor-pointer transition-colors"
              title="Bấm để xem lại danh sách đề xuất đặc cách"
            >
              <ShieldAlert size={12} className="text-blue-600" />
              <span>{schedule.overrideProposals.length} đề xuất đặc cách</span>
            </button>
          )}
        </div>

        {/* Right: Operational controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Scheduler Level 2 Button */}
          <Button
            variant="accent"
            size="sm"
            icon={<Sparkles size={14} />}
            isLoading={isSolving}
            onClick={() => autoGenerateSchedule()}
            className="font-bold tracking-wide shadow-xs"
          >
            ⚡ Chạy Auto-Scheduler (Level 2)
          </Button>

          {/* Publish / Draft Toggle */}
          <Button
            variant={schedule.status === 'published' ? 'secondary' : 'primary'}
            size="sm"
            onClick={publishSchedule}
          >
            {schedule.status === 'published' ? 'Chuyển về Bản Nháp' : 'Duyệt & Công Khai (Publish)'}
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={13} />}
            onClick={handleExportCSV}
          >
            Xuất Excel
          </Button>

          {/* Clear */}
          <button
            onClick={() => {
              if (window.confirm('Làm trống toàn bộ phân công ca trong tuần này?')) {
                clearSchedule();
              }
            }}
            title="Làm trống phân công"
            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-zinc-200 transition-colors"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Shortage Warnings Banner (Section 11 Requirement - Compact Summary) */}
      {schedule.shortageWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-2.5 px-3.5 rounded-none shadow-xs text-xs text-amber-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-amber-900">
                  Phát hiện {totalMissingCount} vị trí thiếu nhân sự trong tuần:
                </span>{' '}
                <span className="font-mono text-[11px] text-amber-800">
                  Line O ({shortagesByLine['O'] || 0}) • Line M ({shortagesByLine['M'] || 0}) • Line D ({shortagesByLine['D'] || 0})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShortageDetails(!showShortageDetails)}
              className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-mono text-[11px] flex items-center gap-1.5 self-start sm:self-auto shrink-0 transition-colors cursor-pointer"
            >
              <span>{showShortageDetails ? 'Thu gọn' : `Chi tiết (${schedule.shortageWarnings.length} mục)`}</span>
              {showShortageDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {showShortageDetails && (
            <div className="mt-2.5 pt-2 border-t border-amber-200">
              <div className="max-h-36 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
                {schedule.shortageWarnings.map((w) => {
                  const r = roleMap.get(w.roleId);
                  const dayObj = DAYS_OF_WEEK.find((d) => d.key === w.day);
                  const dayLabel = dayObj ? dayObj.shortLabel : w.day.toUpperCase();
                  return (
                    <span
                      key={w.id}
                      className="px-2 py-0.5 bg-white border border-amber-300 text-amber-900 font-mono text-[11px]"
                    >
                      {dayLabel} • Line {w.lineCode}: Thiếu {w.missingCount} {r?.name || w.roleId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Override Proposals Banner (Section 11 Requirement: Requires Admin confirmation - Compact & Scrollable) */}
      {schedule.overrideProposals.length > 0 && !isOverrideDismissed && (
        <div className="bg-blue-50/90 border border-blue-200 p-2.5 px-3.5 rounded-none shadow-xs text-xs text-blue-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert size={15} className="text-blue-700 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-blue-950">
                  Đề xuất đặc cách (Override Proposals):
                </span>{' '}
                <span className="text-blue-800">
                  Hệ thống tìm thấy {schedule.overrideProposals.length} đề xuất nhân sự rảnh có thể lấp vào ca thiếu.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowOverrideDetails(!showOverrideDetails)}
                className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-100 text-blue-900 font-mono text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{showOverrideDetails ? 'Thu gọn' : `Chi tiết (${schedule.overrideProposals.length} đề xuất)`}</span>
                {showOverrideDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <button
                type="button"
                onClick={() => setIsOverrideDismissed(true)}
                className="px-2 py-1 bg-transparent hover:bg-blue-100/70 text-blue-700 font-mono text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                title="Tạm ẩn đề xuất"
              >
                <X size={12} />
                <span>Ẩn</span>
              </button>
            </div>
          </div>

          {showOverrideDetails && (
            <div className="mt-2.5 pt-2 border-t border-blue-200">
              <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5">
                {schedule.overrideProposals.map((prop) => {
                  const r = roleMap.get(prop.roleId);
                  const dayObj = DAYS_OF_WEEK.find((d) => d.key === prop.day);
                  const dayLabel = dayObj ? dayObj.label : prop.day;

                  return (
                    <div
                      key={prop.assignmentId}
                      className="p-2 bg-white border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-900 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 border border-zinc-200">
                            {dayLabel} • Line {prop.lineCode}
                          </span>
                          <span className="font-semibold text-blue-900">
                            Vị trí: {r?.name || prop.roleId}
                          </span>
                        </div>
                        <p className="text-zinc-600 text-[11px] mt-0.5 leading-relaxed">
                          {prop.reason}
                        </p>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConfirmOverrideClick(prop)}
                        className="shrink-0 h-7 text-xs bg-blue-700 hover:bg-blue-800 border-blue-700 font-medium"
                      >
                        Xác nhận Override
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Switcher & Day Selector Bar */}
      <div className="space-y-3">
        {/* View Mode Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200/80 p-3 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chế độ xem:</span>
            <div className="inline-flex border border-slate-200 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('daily_timeline')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'daily_timeline'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-white/60'
                }`}
              >
                <span>📊 Bảng Điều Hành Theo Ngày (Timeline Ngang)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly_grid')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'weekly_grid'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-white/60'
                }`}
              >
                <span>📅 Lưới Tuần O/M/D (Weekly Grid)</span>
              </button>
            </div>
          </div>

          {/* Quick info */}
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <span>Chi nhánh: <strong className="text-indigo-700">{currentBranchId}</strong></span>
            <span>•</span>
            <span>Tuần: <strong className="text-slate-800">19/10 - 25/10/2026</strong></span>
          </div>
        </div>

        {/* Day Selector Buttons with Staffing Badges (Monday to Sunday) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDayKey === day.key;
            const dayAssignments = schedule.assignments.filter((a) => a.day === day.key);
            const dayFilled = dayAssignments.filter((a) => a.userId !== null).length;
            const dayTotal = dayAssignments.length;
            const isFull = dayTotal > 0 && dayFilled === dayTotal;

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => {
                  setSelectedDayKey(day.key);
                  if (viewMode === 'weekly_grid') {
                    setViewMode('daily_timeline');
                  }
                }}
                className={`p-2.5 text-left border rounded-xl transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30'
                    : 'bg-white text-slate-800 border-slate-200/80 hover:bg-indigo-50/40 hover:border-indigo-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{day.label}</span>
                  <span className={`font-mono text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {day.dateStr}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-lg font-bold ${
                      isFull
                        ? isSelected
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isSelected
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isFull ? `✓ Đủ ${dayFilled}/${dayTotal}` : `⚠️ Thiếu ${dayTotal - dayFilled}`}
                  </span>
                  {day.isPast && (
                    <span className={`text-[9px] ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                      Đã qua
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW MODE 1: Daily Horizontal Operation Timeline Table (Image 4) */}
      {viewMode === 'daily_timeline' && (
        <div className="space-y-2">
          {/* Daily Table Actions Header */}
          <div className="bg-slate-100 border border-zinc-300 p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs uppercase tracking-wide text-zinc-900 bg-white px-2 py-1 border border-zinc-300">
                BẢNG ĐIỀU HÀNH CA THEO GIỜ
              </span>
              <span className="font-bold text-xs text-blue-900">
                {selectedDayObj.label.toUpperCase()} ({selectedDayObj.dateStr})
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                • {currentDayAssigned.length}/{currentDayAssignments.length} vị trí đã giao
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyDaySummary}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-zinc-300 text-zinc-800 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="Sao chép danh sách ca hôm nay để gửi nhóm Zalo/Telegram"
              >
                {copyNotice ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copyNotice ? 'Đã sao chép!' : 'Sao chép tóm tắt'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-zinc-300 text-zinc-800 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Printer size={13} />
                <span>In Bảng Ca Ngày</span>
              </button>
            </div>
          </div>

          {/* Mobile swipe helper hint */}
          <div className="sm:hidden flex items-center gap-1.5 px-3 py-2 bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-[11px] rounded-xl font-medium">
            <span>👉 <b>Mẹo trên điện thoại:</b> Vuốt ngang bảng để xem toàn bộ 20 khung giờ từ 05:00 đến 24:00.</span>
          </div>

          {/* Operation Table with 20 Timeline Columns */}
          <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-x-auto overflow-hidden">
            <table className="w-full border-collapse text-xs select-none min-w-[1100px]">
              <thead>
                {/* Yellow Header Row directly matching Image 4 */}
                <tr className="bg-amber-300 text-zinc-950 font-black border-b-2 border-zinc-900 text-center uppercase tracking-wide">
                  <th className="p-2 border-r border-zinc-900 w-10 text-center font-mono">
                    NO
                  </th>
                  <th className="p-2 border-r border-zinc-900 w-44 text-left">
                    NOTE (NHÂN VIÊN)
                  </th>
                  <th className="p-2 border-r border-zinc-900 w-32 text-left">
                    NOTE CÔNG VIỆC
                  </th>
                  <th className="p-2 border-r border-zinc-900 w-40 text-left">
                    MÔ TẢ CÔNG VIỆC / LINE
                  </th>
                  {TIMELINE_HOURS.map((h) => (
                    <th
                      key={h}
                      className="p-1 border-r border-zinc-800 w-9 text-center font-mono text-[11px]"
                    >
                      ~{h}
                    </th>
                  ))}
                  <th className="p-2 border-r border-zinc-900 w-16 text-center font-mono">
                    TOTAL
                  </th>
                  <th className="p-2 w-24 text-center">
                    THAO TÁC
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-300">
                {/* 1. Assigned Shifts */}
                {currentDayAssigned.map((assignment, index) => {
                  const emp = empMap.get(assignment.userId!);
                  const role = roleMap.get(assignment.roleId);
                  const line = lineMap.get(assignment.lineCode);
                  const startTime = assignment.customStartTime || line?.startTime || '06:00';
                  const endTime = assignment.customEndTime || line?.endTime || '12:00';
                  const durationHours = calculateHoursBetween(startTime, endTime);
                  const isCustom = Boolean(assignment.customStartTime && assignment.customEndTime);

                  // Calculate covered hourly column indices
                  const [sh, sm] = startTime.split(':').map(Number);
                  const [eh, em] = endTime.split(':').map(Number);
                  const startVal = sh + sm / 60;
                  let endVal = eh + em / 60;
                  if (endVal < startVal) endVal += 24;

                  const coveredIndices: number[] = [];
                  TIMELINE_HOURS.forEach((hStr, idx) => {
                    const hNum = parseInt(hStr, 10);
                    if (startVal < hNum + 1 && endVal > hNum) {
                      coveredIndices.push(idx);
                    }
                  });

                  const firstIdx = coveredIndices.length > 0 ? coveredIndices[0] : -1;
                  const lastIdx = coveredIndices.length > 0 ? coveredIndices[coveredIndices.length - 1] : -1;
                  const midIdx = coveredIndices.length > 0 ? coveredIndices[Math.floor(coveredIndices.length / 2)] : -1;

                  // Bar color theme
                  let barBgClass = 'bg-blue-600 text-white';
                  if (isCustom) {
                    barBgClass = 'bg-emerald-600 text-white';
                  } else if (assignment.lineCode === 'O') {
                    barBgClass = 'bg-amber-500 text-white';
                  } else if (assignment.lineCode === 'M') {
                    barBgClass = 'bg-blue-600 text-white';
                  } else if (assignment.lineCode === 'D') {
                    barBgClass = 'bg-indigo-600 text-white';
                  }

                  const wageInfo = calculateShiftHourlyRate(role, emp);

                  return (
                    <tr
                      key={assignment.id}
                      className="hover:bg-slate-50 transition-colors border-b border-zinc-200"
                    >
                      {/* NO */}
                      <td className="p-2 border-r border-zinc-300 text-center font-mono font-bold text-zinc-700 bg-slate-50">
                        {index + 1}
                      </td>

                      {/* NOTE (NHÂN VIÊN) */}
                      <td className="p-2 border-r border-zinc-300">
                        <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                          <span>{emp?.name || 'N/A'}</span>
                          <span className="font-mono text-[10px] text-zinc-400">({emp?.employeeCode})</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold">{emp?.employmentType === 'full_time' ? 'Full-Time' : 'Part-Time'}</span>
                          {assignment.isOverride && (
                            <span className="bg-purple-100 text-purple-800 px-1 font-bold text-[9px] border border-purple-200">
                              OVERRIDE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* NOTE CÔNG VIỆC */}
                      <td className="p-2 border-r border-zinc-300">
                        <div className="flex flex-col gap-1 items-start">
                          <RoleBadge
                            roleCode={role?.code || 'ROLE'}
                            roleName={role?.name || assignment.roleId}
                            size="sm"
                          />
                          {wageInfo.isFixedRole ? (
                            <span
                              className="font-mono text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1 py-0.5 leading-none"
                              title="Lương cố định vị trí (Đã ẩn lương thâm niên cá nhân)"
                            >
                              {formatVND(wageInfo.rate)}/h (Vị trí)
                            </span>
                          ) : (
                            <span
                              className="font-mono text-[9px] text-zinc-500 bg-slate-100 border border-zinc-200 px-1 py-0.5 leading-none"
                              title="Lương tính theo thâm niên cá nhân của nhân viên"
                            >
                              {formatVND(wageInfo.rate)}/h (Thâm niên)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* MÔ TẢ CÔNG VIỆC / LINE */}
                      <td className="p-2 border-r border-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <LineBadge lineCode={assignment.lineCode} size="sm" />
                          <span className="font-mono font-bold text-zinc-800 text-[11px]">
                            {startTime} - {endTime}
                          </span>
                        </div>
                        {isCustom ? (
                          <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                            ⚡ Ca gãy / Tự chọn
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            Theo chuẩn {line?.lineName.split('—')[1] || assignment.lineCode}
                          </div>
                        )}
                      </td>

                      {/* 20 Hourly Columns: Visual Shift Bar with < Duration > */}
                      {TIMELINE_HOURS.map((hStr, idx) => {
                        const isCovered = coveredIndices.includes(idx);
                        const isFirst = idx === firstIdx;
                        const isLast = idx === lastIdx;
                        const isMid = idx === midIdx;

                        if (isCovered) {
                          return (
                            <td
                              key={hStr}
                              className={`p-0 border-y border-zinc-900 text-center font-mono font-bold text-[10px] ${barBgClass} ${
                                isLast ? 'border-r border-zinc-900' : ''
                              }`}
                              title={`${emp?.name}: ${startTime} - ${endTime} (${durationHours}h)`}
                            >
                              <div className="h-7 flex items-center justify-center relative">
                                {isFirst && (
                                  <span className="absolute left-0.5 text-xs font-black select-none opacity-90">
                                    &lt;
                                  </span>
                                )}
                                {isMid && (
                                  <span className="font-bold text-[10px] tracking-tight whitespace-nowrap px-0.5">
                                    {durationHours}H
                                  </span>
                                )}
                                {isLast && (
                                  <span className="absolute right-0.5 text-xs font-black select-none opacity-90">
                                    &gt;
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={hStr}
                            className="p-0 border-r border-zinc-200 bg-slate-50/40 text-center text-zinc-200 text-[9px]"
                          >
                            <div className="h-7" />
                          </td>
                        );
                      })}

                      {/* TOTAL HOURS */}
                      <td className="p-2 border-r border-zinc-300 text-center font-mono font-bold text-xs text-zinc-900 bg-slate-50">
                        {durationHours.toFixed(1)}H
                      </td>

                      {/* ACTIONS */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleSlotClick(assignment)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-zinc-300 text-zinc-800 text-[11px] font-semibold cursor-pointer shadow-2xs transition-colors flex items-center justify-center gap-1 mx-auto"
                        >
                          <Edit2 size={11} />
                          <span>Sửa / Giờ</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* 2. Unassigned Slots (Missing Staff Warning Rows) */}
                {currentDayUnassigned.map((assignment, uIdx) => {
                  const role = roleMap.get(assignment.roleId);
                  const line = lineMap.get(assignment.lineCode);
                  const rowNum = currentDayAssigned.length + uIdx + 1;

                  return (
                    <tr
                      key={assignment.id}
                      className="bg-amber-50/40 hover:bg-amber-50 transition-colors border-b border-dashed border-amber-300"
                    >
                      {/* NO */}
                      <td className="p-2 border-r border-amber-300 text-center font-mono font-bold text-amber-800 bg-amber-100/50">
                        {rowNum}
                      </td>

                      {/* NOTE (NHÂN VIÊN) */}
                      <td className="p-2 border-r border-amber-300">
                        <div className="font-bold text-rose-700 flex items-center gap-1.5">
                          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                          <span>CHƯA PHÂN CÔNG</span>
                        </div>
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          Vị trí trống cần xếp người
                        </div>
                      </td>

                      {/* NOTE CÔNG VIỆC */}
                      <td className="p-2 border-r border-amber-300">
                        <RoleBadge
                          roleCode={role?.code || 'ROLE'}
                          roleName={role?.name || assignment.roleId}
                          size="sm"
                        />
                      </td>

                      {/* MÔ TẢ CÔNG VIỆC / LINE */}
                      <td className="p-2 border-r border-amber-300">
                        <div className="flex items-center gap-1.5">
                          <LineBadge lineCode={assignment.lineCode} size="sm" />
                          <span className="font-mono font-semibold text-zinc-700 text-[11px]">
                            {line?.startTime} - {line?.endTime}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          Mặc định {line?.durationHours} tiếng
                        </div>
                      </td>

                      {/* 20 Empty Dashed Columns */}
                      {TIMELINE_HOURS.map((hStr) => (
                        <td
                          key={hStr}
                          className="p-0 border-r border-dashed border-amber-200 text-center bg-amber-50/20"
                        >
                          <div className="h-7" />
                        </td>
                      ))}

                      {/* TOTAL */}
                      <td className="p-2 border-r border-amber-300 text-center font-mono font-bold text-xs text-amber-800 bg-amber-100/40">
                        0.0H
                      </td>

                      {/* ACTIONS */}
                      <td className="p-2 text-center">
                        <Button
                          variant="accent"
                          size="sm"
                          icon={<Plus size={11} />}
                          onClick={() => handleSlotClick(assignment)}
                          className="h-6 text-[11px] font-bold px-2 mx-auto rounded-md shadow-2xs"
                        >
                          Bổ nhiệm
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty State if no assignments at all */}
                {currentDayAssignments.length === 0 && (
                  <tr>
                    <td
                      colSpan={26}
                      className="p-8 text-center text-zinc-500 font-mono text-xs bg-slate-50"
                    >
                      Không có ca làm việc nào được cấu hình cho ngày {selectedDayObj.label}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Red Operational Footer Bar directly matching Image 4 */}
          <div className="bg-rose-600 text-white p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="font-black text-sm uppercase tracking-wide bg-rose-700 px-2.5 py-1 border border-rose-400">
                CHỤP BÁO CÁO / IN CA LÀM
              </span>
              <span className="font-semibold text-xs text-rose-100">
                {selectedDayObj.label.toUpperCase()} ({selectedDayObj.dateStr}) • Chi nhánh {currentBranchId}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-rose-200">Nhân sự: </span>
                <span className="font-bold text-white text-sm">{currentDayStaffCount} người</span>
              </div>
              <div className="border-l border-rose-500 pl-4">
                <span className="text-rose-200">Tổng giờ công: </span>
                <span className="font-bold text-white text-sm">{currentDayTotalHours.toFixed(1)} tiếng</span>
              </div>
              <div className="border-l border-rose-500 pl-4">
                <span className="text-rose-200">Trạng thái ca: </span>
                <span
                  className={`font-bold px-1.5 py-0.5 text-xs ${
                    currentDayUnassigned.length === 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-400 text-zinc-950 font-black'
                  }`}
                >
                  {currentDayUnassigned.length === 0
                    ? `✓ Đủ ${currentDayAssigned.length}/${currentDayAssignments.length} ca (100%)`
                    : `⚠️ Thiếu ${currentDayUnassigned.length} vị trí!`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 font-bold font-sans text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ml-auto md:ml-0"
              >
                <Printer size={13} />
                <span>In Bảng Ca</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Main Weekly Master Timetable Grid (Classic View) */}
      {viewMode === 'weekly_grid' && (
        <div className="bg-white border border-zinc-200 rounded-none shadow-xs overflow-x-auto">
          <table className="w-full border-collapse text-xs select-none">
            <thead>
              <tr className="bg-slate-100 border-b border-zinc-200">
                <th className="p-3 border-r border-zinc-200 w-36 font-mono uppercase text-[11px] text-zinc-600 font-bold sticky left-0 bg-slate-100 z-10 text-left">
                  Khung Line
                </th>
                {DAYS_OF_WEEK.map((day) => (
                  <th
                    key={day.key}
                    className={`p-3 border-r border-zinc-200 min-w-[180px] text-left ${
                      day.isPast ? 'bg-slate-100/70' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900">{day.label}</span>
                      <span className="font-mono text-[11px] text-zinc-400 font-normal">
                        {day.dateStr}
                      </span>
                    </div>
                    <div className="mt-0.5">
                      {day.isPast ? (
                        <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                          ✓ Đã kết thúc (Chốt giờ)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-400">
                          Dự kiến
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200">
              {LINE_ORDER.map((lineCode) => {
                const line = lineMap.get(lineCode);
                const reqs = lineRequirements.filter(
                  (r) => r.branchId === currentBranchId && r.lineCode === lineCode
                );

                return (
                  <tr key={lineCode} className="align-top">
                    {/* Sticky Line Header */}
                    <td className="p-3 border-r border-zinc-200 bg-slate-50 sticky left-0 z-10 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <LineBadge lineCode={lineCode} size="md" />
                        <span className="font-bold text-xs text-zinc-900">{line?.lineName.split('—')[1] || lineCode}</span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-600 font-semibold mt-1">
                        {line?.startTime} - {line?.endTime}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                        {line?.durationHours} tiếng / ca
                      </div>
                    </td>

                    {/* 7 Days Columns */}
                    {DAYS_OF_WEEK.map((day) => (
                      <td
                        key={`${day.key}_${lineCode}`}
                        className={`p-2 border-r border-zinc-200 ${
                          day.isPast ? 'bg-slate-50/40' : 'bg-white hover:bg-slate-50/50'
                        } transition-colors`}
                      >
                        <div className="space-y-1.5">
                          {reqs.map((req) => {
                            const role = roleMap.get(req.roleId);
                            const elements = [];

                            for (let i = 0; i < req.headcountRequired; i++) {
                              const slotId = makeAssignmentId(day.key, lineCode, req.roleId, i);
                              const assignment = assignmentMap.get(slotId) || {
                                id: slotId,
                                scheduleId: 'SCH',
                                day: day.key,
                                lineCode,
                                roleId: req.roleId,
                                slotIndex: i,
                                userId: null,
                              };

                              const emp = assignment.userId ? empMap.get(assignment.userId) : null;
                              const isAssigned = !!emp;
                              const isCustom = Boolean(assignment.customStartTime && assignment.customEndTime);

                              elements.push(
                                <div
                                  key={slotId}
                                  onClick={() => handleSlotClick(assignment)}
                                  className={`p-1.5 border rounded-none cursor-pointer transition-all ${
                                    isAssigned
                                      ? assignment.isOverride
                                        ? 'bg-purple-50/70 border-purple-300 hover:border-purple-600'
                                        : 'bg-white border-zinc-300 hover:border-zinc-900 shadow-2xs'
                                      : 'bg-zinc-50 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50/30'
                                  }`}
                                  title="Bấm để thay đổi hoặc bổ nhiệm nhân sự"
                                >
                                  {/* Role tag */}
                                  <div className="flex items-center justify-between mb-1">
                                    <RoleBadge
                                      roleCode={role?.code || 'ROLE'}
                                      roleName={`${role?.name || ''} ${req.headcountRequired > 1 ? `#${i + 1}` : ''}`}
                                      size="sm"
                                    />
                                    {assignment.isOverride && (
                                      <span className="text-[9px] font-mono px-1 bg-purple-100 text-purple-800 font-bold">
                                        OVERRIDE
                                      </span>
                                    )}
                                  </div>

                                  {/* Assigned Employee */}
                                  {isAssigned ? (
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-zinc-900 truncate">
                                          {emp.name}
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                                          {emp.employeeCode}
                                        </span>
                                      </div>
                                      {isCustom && (
                                        <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                                          ⏱️ {assignment.customStartTime} - {assignment.customEndTime}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] font-mono text-slate-400 italic flex items-center justify-between">
                                      <span>(Chưa xếp ca)</span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return elements;
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Slot Assignment & Ca Gãy (Split Shift) Modal (Images 2 & 3) */}
      {selectedSlot && (
        <Modal
          isOpen={isSlotModalOpen}
          onClose={() => setIsSlotModalOpen(false)}
          title={`Phân công ca: ${roleMap.get(selectedSlot.roleId)?.name} (${LINE_META[selectedSlot.lineCode].shortName})`}
          subtitle={`Thứ ${selectedSlot.day.toUpperCase()} • Tuân thủ điều kiện Kỹ năng & Giới tính • Hỗ trợ xếp Ca Gãy`}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-between w-full">
              {selectedSlot.userId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    manualAssignSlot(selectedSlot.id, null);
                    setIsSlotModalOpen(false);
                  }}
                  className="text-rose-600 hover:bg-rose-50 border-rose-300"
                >
                  Gỡ nhân viên khỏi ca
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setIsSlotModalOpen(false)}>
                Đóng
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5 text-xs">
            {/* Ca gãy / Custom hours section */}
            <div className="p-3 bg-slate-50 border border-zinc-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" />
                  <span>Khung giờ làm việc & Ca gãy</span>
                </span>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCustomTime}
                    onChange={(e) => setIsCustomTime(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-none border-zinc-300"
                  />
                  <span>Tùy chỉnh ca gãy (Giờ lẻ)</span>
                </label>
              </div>

              {isCustomTime ? (
                <div className="space-y-2 pt-1.5 border-t border-zinc-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">
                        Giờ bắt đầu
                      </label>
                      <input
                        type="time"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full px-2 py-1 border border-zinc-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">
                        Giờ kết thúc
                      </label>
                      <input
                        type="time"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full px-2 py-1 border border-zinc-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Quick preset chips */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase">Chọn nhanh ca gãy:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: '06:00 - 10:00 (4h Sáng)', s: '06:00', e: '10:00' },
                        { label: '07:00 - 11:00 (4h Sáng)', s: '07:00', e: '11:00' },
                        { label: '11:00 - 15:00 (4h Trưa)', s: '11:00', e: '15:00' },
                        { label: '14:00 - 18:00 (4h Chiều)', s: '14:00', e: '18:00' },
                        { label: '18:00 - 22:00 (4h Tối)', s: '18:00', e: '22:00' },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            setCustomStart(chip.s);
                            setCustomEnd(chip.e);
                            setIsCustomTime(true);
                          }}
                          className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-zinc-300 hover:bg-blue-50 hover:border-blue-400 text-zinc-700 cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const line = lineMap.get(selectedSlot.lineCode);
                          if (line) {
                            setCustomStart(line.startTime);
                            setCustomEnd(line.endTime);
                            setIsCustomTime(false);
                          }
                        }}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-200 border border-zinc-300 hover:bg-zinc-300 text-zinc-700 cursor-pointer"
                      >
                        Khôi phục chuẩn Line
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono font-semibold text-emerald-700 pt-1 flex items-center justify-between">
                    <span>⏱️ Thời lượng tính công: {calculateHoursBetween(customStart, customEnd)} tiếng / ca</span>
                    <span className="text-[10px] text-zinc-500">(Tự động tích lũy bảng lương)</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-600 flex items-center justify-between">
                  <span>
                    Chuẩn theo {LINE_META[selectedSlot.lineCode].shortName}:{' '}
                    <strong className="font-mono text-zinc-900">
                      {lineMap.get(selectedSlot.lineCode)?.startTime} - {lineMap.get(selectedSlot.lineCode)?.endTime}
                    </strong>
                  </span>
                  <span className="font-mono text-zinc-700 font-semibold">
                    ({lineMap.get(selectedSlot.lineCode)?.durationHours} tiếng)
                  </span>
                </div>
              )}

              {/* If employee is already assigned, show button to save updated hours */}
              {selectedSlot.userId && (
                <div className="pt-2 border-t border-zinc-200 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-600">
                    Đang giao cho: <strong className="text-zinc-900">{empMap.get(selectedSlot.userId)?.name}</strong>
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      manualAssignSlot(
                        selectedSlot.id,
                        selectedSlot.userId,
                        isCustomTime ? `Cập nhật giờ: ${customStart} - ${customEnd}` : 'Khôi phục giờ Line',
                        isCustomTime ? { startTime: customStart, endTime: customEnd } : { startTime: undefined, endTime: undefined }
                      );
                      setIsSlotModalOpen(false);
                    }}
                    className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 border-emerald-700 font-semibold"
                  >
                    💾 Lưu Khung Giờ
                  </Button>
                </div>
              )}
            </div>

            <p className="text-zinc-600">
              Chọn nhân viên để giao ca. Hệ thống đánh dấu độ phù hợp dựa trên:
              (1) Có kỹ năng, (2) Đăng ký availability rảnh, (3) Đáp ứng giới tính:
            </p>

            <div className="divide-y divide-zinc-200 border border-zinc-200 max-h-64 overflow-y-auto">
              {employees
                .filter((e) => e.branchId === currentBranchId && e.status === 'active')
                .map((emp) => {
                  const role = roleMap.get(selectedSlot.roleId);
                  const hasSkill = emp.skills.includes(selectedSlot.roleId);
                  const isGenderMatched =
                    role?.genderRequirement === 'male_only'
                      ? emp.gender === 'male'
                      : role?.genderRequirement === 'female_only'
                      ? emp.gender === 'female'
                      : true;

                  const isCurrent = emp.id === selectedSlot.userId;

                  const candidateWage = calculateShiftHourlyRate(role, emp);

                  return (
                    <div
                      key={emp.id}
                      className={`p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                          <span>{emp.name}</span>
                          <span className="font-mono text-zinc-400">({emp.employeeCode})</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className={hasSkill ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                            {hasSkill ? '✓ Có kỹ năng' : '✗ Chưa tick kỹ năng'}
                          </span>
                          <span>•</span>
                          <span className={isGenderMatched ? 'text-emerald-700' : 'text-rose-600 font-semibold'}>
                            {isGenderMatched ? '✓ Hợp giới tính' : '✗ Sai giới tính'}
                          </span>
                          <span>•</span>
                          {candidateWage.isFixedRole ? (
                            <span className="text-amber-800 font-bold bg-amber-100/80 px-1 border border-amber-200">
                              Lương vị trí: {formatVND(candidateWage.rate)}/h (Ẩn lương cá nhân)
                            </span>
                          ) : (
                            <span className="text-blue-800 font-semibold bg-blue-50 px-1 border border-blue-200">
                              Lương thâm niên: {formatVND(candidateWage.rate)}/h
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant={isCurrent ? 'secondary' : 'primary'}
                        size="sm"
                        disabled={isCurrent}
                        onClick={() => {
                          manualAssignSlot(
                            selectedSlot.id,
                            emp.id,
                            isCustomTime ? `Ca gãy: ${customStart} - ${customEnd}` : 'Phân công thủ công',
                            isCustomTime ? { startTime: customStart, endTime: customEnd } : undefined
                          );
                          setIsSlotModalOpen(false);
                        }}
                        className="h-7 text-xs"
                      >
                        {isCurrent ? 'Đang chọn' : 'Bổ nhiệm'}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Override Modal */}
      {activeProposal && (
        <Modal
          isOpen={!!activeProposal}
          onClose={() => setActiveProposal(null)}
          title="Xác Nhận Đề Xuất Đặc Cách (Override Confirmation)"
          subtitle="Quy tắc Level 2: Mọi trường hợp override phải được Admin chi nhánh chủ động phê duyệt"
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setActiveProposal(null)}>
                Huỷ bỏ
              </Button>
              <Button variant="primary" size="sm" onClick={executeOverrideConfirm}>
                Xác Nhận Bổ Nhiệm Override
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900">
              <span className="font-bold">Lý do hệ thống đề xuất:</span>
              <p className="mt-1 leading-relaxed">{activeProposal.reason}</p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Lý do phê duyệt của Admin (Ghi vào Audit Log) *
              </label>
              <textarea
                value={overrideReasonInput}
                onChange={(e) => setOverrideReasonInput(e.target.value)}
                rows={3}
                className="w-full p-2 border border-zinc-300 text-xs"
                required
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Solver Loading Simulation Modal */}
      {showSolverModal && (
        <Modal
          isOpen={showSolverModal}
          onClose={isSolving ? () => {} : closeSolverModal}
          title="Thuật Toán Scheduler Level 2 Đang Xếp Lịch"
          subtitle="Thực thi Hard Constraints (Giới tính, Kỹ năng, OFF) và Soft Constraints (Cân bằng giờ & ngày làm)"
          maxWidth="md"
          footer={
            <Button variant="primary" size="sm" disabled={isSolving} onClick={closeSolverModal}>
              {isSolving ? 'Đang giải thuật...' : 'Xem Lịch Draft'}
            </Button>
          }
        >
          <div className="bg-zinc-950 text-zinc-100 font-mono text-xs p-3.5 space-y-1.5 max-h-56 overflow-y-auto">
            {solverLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-zinc-500">[{log.step}]</span>
                <span
                  className={
                    log.category === 'success'
                      ? 'text-emerald-400 font-bold'
                      : log.category === 'warning'
                      ? 'text-amber-300'
                      : 'text-zinc-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
