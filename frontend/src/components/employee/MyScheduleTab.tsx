import React, { useState, useMemo, useEffect } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { ShiftAssignment, DayOfWeek, LineCode } from '../../types';
import {
  DAYS_OF_WEEK,
  LINE_META,
  formatVND,
  calculateHoursBetween,
} from '../../utils/formatters';
import { RoleBadge, LineBadge, ScheduleStatusBadge, ContractBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Clock,
  Briefcase,
  Users,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Coffee,
  Printer,
  Calendar,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Sun,
  Moon,
  Star,
} from 'lucide-react';

const TIMELINE_HOURS = [
  '05', '06', '07', '08', '09', '10', '11', '12', '13', '14',
  '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'
];

export const MyScheduleTab: React.FC = () => {
  const {
    currentUser,
    schedule,
    lineConfigs,
    roles,
    employees,
    payrollRecords,
    shiftRequests,
    currentBranchId,
    setActiveTab,
  } = useSchedule();

  if (!currentUser) return null;

  // View Mode: 'daily_timeline' (Image 4) vs 'my_week'
  const [viewMode, setViewMode] = useState<'daily_timeline' | 'my_week'>('daily_timeline');
  const [selectedDayKey, setSelectedDayKey] = useState<DayOfWeek>('monday');

  const roleMap = useMemo(() => {
    const map = new Map<string, (typeof roles)[0]>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const empMap = useMemo(() => {
    const map = new Map<string, (typeof employees)[0]>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const lineMap = useMemo(() => {
    const map = new Map<LineCode, (typeof lineConfigs)[0]>();
    lineConfigs.forEach((l) => map.set(l.lineCode, l));
    return map;
  }, [lineConfigs]);

  // Current employee's assignments in this branch (Safely checking branchId or schedule branch)
  const myAssignments = useMemo(() => {
    return schedule.assignments.filter(
      (a) =>
        a.userId === currentUser.id &&
        (a.branchId ? a.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
    );
  }, [schedule.assignments, schedule.branchId, currentUser.id, currentBranchId]);

  // Current employee's payroll
  const myPayroll = useMemo(() => {
    return payrollRecords.find((p) => p.userId === currentUser.id);
  }, [payrollRecords, currentUser.id]);

  // Auto-focus the first day that has an assignment for the logged-in employee (e.g. Saturday)
  useEffect(() => {
    if (myAssignments.length > 0 && !myAssignments.some((a) => a.day === selectedDayKey)) {
      const firstActiveDay = DAYS_OF_WEEK.find((d) => myAssignments.some((a) => a.day === d.key));
      if (firstActiveDay) {
        setSelectedDayKey(firstActiveDay.key);
      }
    }
  }, [myAssignments]);

  // Open market count
  const openMarketCount = useMemo(() => {
    return shiftRequests.filter(
      (r) => r.branchId === currentBranchId && r.isOpenMarket && r.status === 'pending' && !r.claimedByUserId
    ).length;
  }, [shiftRequests, currentBranchId]);

  // Selected Day Object
  const selectedDayObj = useMemo(() => {
    return DAYS_OF_WEEK.find((d) => d.key === selectedDayKey) || DAYS_OF_WEEK[0];
  }, [selectedDayKey]);

  // Assignments for the selected day across the entire branch
  const currentDayAllAssignments = useMemo(() => {
    return schedule.assignments
      .filter(
        (a) =>
          a.day === selectedDayKey &&
          a.userId !== null &&
          (a.branchId ? a.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
      )
      .sort((a, b) => {
        // Current user first, then by line code
        if (a.userId === currentUser.id) return -1;
        if (b.userId === currentUser.id) return 1;
        return a.lineCode.localeCompare(b.lineCode);
      });
  }, [schedule.assignments, schedule.branchId, selectedDayKey, currentBranchId, currentUser.id]);

  // Current user's assignments on selected day (can be 1 or multiple lines)
  const myCurrentDayAssignments = useMemo(() => {
    return myAssignments.filter((a) => a.day === selectedDayKey);
  }, [myAssignments, selectedDayKey]);

  // Helper to find coworkers on the same shift line on the selected day
  const getCoworkersForAssignment = (assignment: ShiftAssignment) => {
    return schedule.assignments
      .filter(
        (a) =>
          a.day === selectedDayKey &&
          a.lineCode === assignment.lineCode &&
          a.userId !== currentUser.id &&
          a.userId !== null &&
          (a.branchId ? a.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
      )
      .map((a) => {
        const emp = empMap.get(a.userId!);
        const role = roleMap.get(a.roleId);
        return {
          id: a.id,
          name: emp?.name || 'Đồng nghiệp',
          roleName: role?.name || a.roleId,
          roleCode: role?.code || 'ROLE',
        };
      });
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Top Banner: Shift Market Notice (if any open shifts) */}
      {openMarketCount > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-xl shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
              <ShoppingBag size={16} />
            </div>
            <div>
              <span className="font-bold text-xs uppercase tracking-wide">
                Chợ ca làm việc đang mở: Có {openMarketCount} ca cần người hỗ trợ!
              </span>
              <p className="text-[11px] text-blue-100">
                Đồng nghiệp đang mở bán công khai. Nhận ca ngay để giúp đồng đội và tăng thu nhập tuần này.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('exchange')}
            className="px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1 shrink-0"
          >
            <span>Vào Chợ Ca</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Schedule Status & Header Bar */}
      <div
        className={`p-3.5 border rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs ${
          schedule.status === 'published' || schedule.status === 'changed'
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {schedule.status === 'published' || schedule.status === 'changed' ? (
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={20} className="text-amber-600 shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wide">
                {schedule.status === 'published'
                  ? 'Lịch làm việc chính thức đã được công khai'
                  : schedule.status === 'changed'
                  ? `Lịch làm việc đã điều chỉnh mới nhất (v${schedule.version})`
                  : 'Lịch tuần đang ở trạng thái bản nháp (Draft)'}
              </span>
              <ScheduleStatusBadge status={schedule.status} version={schedule.version} />
            </div>
            <p className="text-xs opacity-85 mt-0.5">
              {schedule.status !== 'draft'
                ? `Được phê duyệt bởi ${schedule.publishedBy || 'Quản lý chi nhánh'} lúc ${schedule.publishedAt || ''}.`
                : 'Quản trị viên đang sắp xếp ca. Bạn hãy theo dõi khi lịch được công bố.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-white/90 p-1 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs text-xs">
            <button
              type="button"
              onClick={() => setViewMode('daily_timeline')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'daily_timeline'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Bảng Điều Hành Ca Ngày
            </button>
            <button
              type="button"
              onClick={() => setViewMode('my_week')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'my_week'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Lịch Tuần Của Tôi
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Printer size={13} />}
            onClick={() => window.print()}
            className="rounded-lg bg-white border-slate-300 shadow-xs text-xs"
          >
            In
          </Button>
        </div>
      </div>

      {/* Metric Cards (Hours & Pay) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Giờ đã chốt</span>
            <Clock size={15} className="text-emerald-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {myPayroll?.completedHours || 0}h
            </span>
            <span className="text-[11px] font-mono text-emerald-700">từ ca đã qua</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Giờ sắp tới</span>
            <Calendar size={15} className="text-blue-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {myPayroll?.projectedHours || 0}h
            </span>
            <span className="text-[11px] font-mono text-slate-500">dự kiến</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Tổng số ca tuần</span>
            <Briefcase size={15} className="text-purple-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {myAssignments.length}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              ({currentUser.employmentType === 'full_time' ? 'Full-Time' : 'Part-Time'})
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Lương tạm tính</span>
            <DollarSign size={15} className="text-slate-800" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">
              {formatVND(myPayroll?.totalPay || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: DAILY OPERATION TIMELINE TABLE (IMAGE 4) */}
      {viewMode === 'daily_timeline' && (
        <div className="space-y-3">
          {/* Day Selector Buttons with Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDayKey === day.key;
              const dayMyAssignments = myAssignments.filter((a) => a.day === day.key);
              const hasMyShift = dayMyAssignments.length > 0;
              const dayTotalStaff = schedule.assignments.filter(
                (a) =>
                  a.day === day.key &&
                  a.userId !== null &&
                  (a.branchId ? a.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
              ).length;

              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDayKey(day.key)}
                  className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500/40'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{day.label}</span>
                    <span className={`font-mono text-[10px] ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                      {day.dateStr}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    {hasMyShift ? (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        <Star size={10} className="fill-current" />
                        {dayMyAssignments.length > 1 ? `${dayMyAssignments.length} ca làm` : 'Có ca làm'}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected ? 'text-slate-400' : 'text-slate-400'
                        }`}
                      >
                        Nghỉ (Off)
                      </span>
                    )}

                    <span
                      className={`text-[9px] font-mono ${
                        isSelected ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      {dayTotalStaff} NV
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Focused Shift Card(s) for the Logged-in Employee */}
          {myCurrentDayAssignments.length > 0 ? (
            <div className="space-y-2.5">
              {myCurrentDayAssignments.map((assignment, idx) => {
                const line = lineMap.get(assignment.lineCode);
                const role = roleMap.get(assignment.roleId);
                const coworkers = getCoworkersForAssignment(assignment);
                const startTime = assignment.customStartTime || line?.startTime || '06:00';
                const endTime = assignment.customEndTime || line?.endTime || '14:00';
                const duration = line?.durationHours || calculateHoursBetween(startTime, endTime) || 8;

                return (
                  <div
                    key={assignment.id}
                    className="p-4 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50/90 to-white shadow-xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                          <Star size={17} className="fill-current" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <span>
                              Lịch làm của bạn {myCurrentDayAssignments.length > 1 ? `(Ca ${idx + 1}/${myCurrentDayAssignments.length})` : ''} — {selectedDayObj.label.toUpperCase()} ({selectedDayObj.dateStr})
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            Vị trí phân công: <strong>{role?.name || assignment.roleId}</strong> tại Line <strong>{assignment.lineCode}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <LineBadge lineCode={assignment.lineCode} size="md" />
                        <RoleBadge
                          roleCode={role?.code || 'ROLE'}
                          roleName={role?.name || assignment.roleId}
                          size="md"
                        />
                      </div>
                    </div>

                    {/* Hours and Coworkers */}
                    <div className="pt-2 border-t border-amber-200/60 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <Clock size={14} className="text-amber-700 shrink-0" />
                        <span className="font-bold text-slate-900">
                          Thời gian ca: {startTime} - {endTime}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-amber-800 font-semibold">
                          ({duration} tiếng)
                        </span>
                      </div>

                      {coworkers.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                          <Users size={13} className="text-slate-400 shrink-0" />
                          <span>Đồng đội cùng ca:</span>
                          {coworkers.map((c) => (
                            <span
                              key={c.id}
                              className="bg-white border border-amber-200 px-2 py-0.5 rounded font-medium text-slate-800"
                            >
                              {c.name} <span className="text-[9px] text-slate-400 font-mono">({c.roleName})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          (Bạn phụ trách độc lập tại vị trí này trong khung giờ)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                <Coffee size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Hôm nay ({selectedDayObj.label}) bạn được NGHỈ CA (Day Off)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Bạn không có ca làm việc được giao trong ngày này. Dưới đây là bảng vận hành của toàn bộ đồng nghiệp trong chi nhánh.
                </p>
              </div>
            </div>
          )}

          {/* Mobile swipe helper */}
          <div className="md:hidden flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-indigo-900 text-xs font-medium">
            <span>👉</span>
            <span>Vuốt ngang bảng để xem toàn bộ 20 khung giờ từ 05:00 đến 24:00</span>
          </div>

          {/* Operation Table with 20 Timeline Columns */}
          <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  BẢNG ĐIỀU HÀNH CA THEO GIỜ
                </span>
                <span className="font-bold text-xs text-indigo-900">
                  {selectedDayObj.label.toUpperCase()} ({selectedDayObj.dateStr})
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  • {currentDayAllAssignments.length} nhân sự trực ca
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Dòng màu vàng: Ca của bạn
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs select-none min-w-[1100px]">
                <thead>
                  {/* Yellow Header Row directly matching Image 4 */}
                  <tr className="bg-amber-300 text-slate-950 font-black border-b-2 border-slate-900 text-center uppercase tracking-wide">
                    <th className="p-2 border-r border-slate-900 w-10 text-center font-mono">
                      NO
                    </th>
                    <th className="p-2 border-r border-slate-900 w-48 text-left">
                      NOTE (NHÂN VIÊN)
                    </th>
                    <th className="p-2 border-r border-slate-900 w-36 text-left">
                      NOTE CÔNG VIỆC
                    </th>
                    <th className="p-2 border-r border-slate-900 w-44 text-left">
                      MÔ TẢ CÔNG VIỆC / LINE
                    </th>
                    {TIMELINE_HOURS.map((h) => (
                      <th
                        key={h}
                        className="p-1 border-r border-slate-800 w-9 text-center font-mono text-[11px]"
                      >
                        ~{h}
                      </th>
                    ))}
                    <th className="p-2 w-16 text-center font-mono">
                      TOTAL
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {currentDayAllAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={25} className="py-10 text-center text-slate-400">
                        Chưa có lịch phân công cho ngày này.
                      </td>
                    </tr>
                  ) : (
                    currentDayAllAssignments.map((assignment, index) => {
                      const emp = empMap.get(assignment.userId!);
                      const role = roleMap.get(assignment.roleId);
                      const line = lineMap.get(assignment.lineCode);
                      const startTime = assignment.customStartTime || line?.startTime || '06:00';
                      const endTime = assignment.customEndTime || line?.endTime || '12:00';
                      const durationHours = calculateHoursBetween(startTime, endTime);
                      const isCustom = Boolean(assignment.customStartTime && assignment.customEndTime);
                      const isMe = assignment.userId === currentUser.id;

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
                      let barBgClass = isMe
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : isCustom
                        ? 'bg-emerald-600 text-white'
                        : assignment.lineCode === 'O'
                        ? 'bg-amber-600 text-white'
                        : assignment.lineCode === 'M'
                        ? 'bg-blue-600 text-white'
                        : 'bg-indigo-600 text-white';

                      return (
                        <tr
                          key={assignment.id}
                          className={`transition-colors border-b border-slate-200 ${
                            isMe
                              ? 'bg-amber-50/90 font-medium border-l-4 border-l-amber-500'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* NO */}
                          <td className="p-2 border-r border-slate-300 text-center font-mono font-bold text-slate-700 bg-slate-50/70">
                            {index + 1}
                          </td>

                          {/* NOTE (NHÂN VIÊN) */}
                          <td className="p-2 border-r border-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold ${isMe ? 'text-amber-950' : 'text-slate-900'}`}>
                                {emp?.name || 'N/A'}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                ({emp?.employeeCode})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              {isMe && (
                                <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded font-mono shadow-2xs">
                                  ⭐ BẠN
                                </span>
                              )}
                              <span>{emp?.employmentType === 'full_time' ? 'Full-Time' : 'Part-Time'}</span>
                            </div>
                          </td>

                          {/* NOTE CÔNG VIỆC */}
                          <td className="p-2 border-r border-slate-300">
                            <RoleBadge
                              roleCode={role?.code || 'ROLE'}
                              roleName={role?.name || assignment.roleId}
                              size="sm"
                            />
                          </td>

                          {/* MÔ TẢ CÔNG VIỆC / LINE */}
                          <td className="p-2 border-r border-slate-300">
                            <div className="flex items-center gap-1.5">
                              <LineBadge lineCode={assignment.lineCode} size="sm" />
                              <span className="font-mono font-bold text-slate-800 text-[11px]">
                                {startTime} - {endTime}
                              </span>
                            </div>
                            {isCustom ? (
                              <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                                ⚡ Ca gãy / Tự chọn
                              </div>
                            ) : (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                Chuẩn {line?.lineName.split('—')[1] || assignment.lineCode}
                              </div>
                            )}
                          </td>

                          {/* 20 Hourly Columns: Visual Shift Bar with < Duration > */}
                          {TIMELINE_HOURS.map((hStr, idx) => {
                            const isCovered = coveredIndices.includes(idx);
                            const isFirst = idx === firstIdx;
                            const isLast = idx === lastIdx;
                            const isMid = idx === midIdx;

                            if (!isCovered) {
                              return (
                                <td
                                  key={hStr}
                                  className="p-0 border-r border-slate-200 text-center bg-slate-50/20"
                                />
                              );
                            }

                            return (
                              <td
                                key={hStr}
                                className={`p-0 border-r border-slate-200 text-center relative ${barBgClass}`}
                              >
                                {isFirst && (
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/30" />
                                )}
                                {isMid && (
                                  <span className="text-[10px] font-mono font-bold leading-none select-none">
                                    &lt;{durationHours}h&gt;
                                  </span>
                                )}
                                {isLast && (
                                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/30" />
                                )}
                              </td>
                            );
                          })}

                          {/* TOTAL */}
                          <td className="p-2 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                            {durationHours}h
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: MY PERSONAL WEEK AGENDA */}
      {viewMode === 'my_week' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
              Lịch Làm Việc Chi Tiết Của Bạn Trong Toàn Tuần
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Tuần hiện tại</span>
          </div>

          <div className="divide-y divide-slate-100">
            {DAYS_OF_WEEK.map((day) => {
              const dayAssignments = myAssignments.filter((a) => a.day === day.key);
              const hasShift = dayAssignments.length > 0;

              return (
                <div
                  key={day.key}
                  className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                    hasShift ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/30 opacity-70'
                  }`}
                >
                  {/* Day Header */}
                  <div className="w-44 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{day.label}</span>
                      <span className="font-mono text-xs text-slate-400">({day.dateStr})</span>
                    </div>
                    <div className="mt-1">
                      {day.isPast ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 font-semibold">
                          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                          Đã hoàn thành ca
                        </span>
                      ) : hasShift ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-700 font-semibold">
                          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                          Ca sắp tới ({dayAssignments.length} line)
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">
                          Nghỉ ca (Day Off)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assigned Shifts */}
                  <div className="flex-1 w-full space-y-2">
                    {hasShift ? (
                      dayAssignments.map((a) => {
                        const line = lineMap.get(a.lineCode);
                        const role = roleMap.get(a.roleId);
                        const coworkers = schedule.assignments
                          .filter(
                            (ca) =>
                              ca.day === a.day &&
                              ca.lineCode === a.lineCode &&
                              ca.id !== a.id &&
                              ca.userId !== null &&
                              (ca.branchId ? ca.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
                          )
                          .map((ca) => ({
                            name: empMap.get(ca.userId!)?.name || 'Đồng nghiệp',
                            roleCode: roleMap.get(ca.roleId)?.code || 'ROLE',
                          }));

                        return (
                          <div
                            key={a.id}
                            className="p-3 border border-slate-200 bg-white rounded-lg shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center min-w-[70px]">
                                <LineBadge lineCode={a.lineCode} size="sm" />
                                <p className="text-xs font-mono font-bold text-slate-900 mt-1">
                                  {line?.durationHours}h
                                </p>
                              </div>

                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900 font-mono">
                                    {a.customStartTime || line?.startTime} - {a.customEndTime || line?.endTime}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <RoleBadge
                                    roleCode={role?.code || 'ROLE'}
                                    roleName={role?.name || a.roleId}
                                    size="md"
                                  />
                                </div>

                                {/* Coworkers */}
                                {coworkers.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                                    <Users size={12} className="text-slate-400 shrink-0" />
                                    <span>Cùng ca:</span>
                                    {coworkers.map((c, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded font-medium text-slate-700"
                                      >
                                        {c.name}
                                        <span className="text-[9px] font-mono uppercase text-slate-400">
                                          ({c.roleCode})
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  day.isPast
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                                    : 'bg-blue-50 text-blue-800 border-blue-300'
                                }`}
                              >
                                {day.isPast ? 'ĐÃ HOÀN THÀNH' : 'SẮP DIỄN RA'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-400 italic py-1">
                        Không có ca làm việc được chỉ định cho ngày này.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
