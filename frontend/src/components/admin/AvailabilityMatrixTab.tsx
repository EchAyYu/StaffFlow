import React, { useState, useMemo } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { AvailabilityChoice, DayOfWeek, ShiftRequest } from '../../types';
import { DAYS_OF_WEEK } from '../../utils/formatters';
import { AvailabilityBadge, ContractBadge, RoleBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Calendar,
  Search,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Filter,
  Users,
  Check,
  CheckCircle2,
  FileText,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const AvailabilityMatrixTab: React.FC = () => {
  const {
    employees,
    registrations,
    roles,
    currentBranchId,
    branches,
    shiftRequests,
    createShiftRequest,
    reviewShiftRequest,
    addToast,
  } = useSchedule();

  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedEmpId, setInspectedEmpId] = useState<string | null>(null);

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const maxFtOff = currentBranch?.maxFulltimeOffDays ?? 4;
  const maxPtOff = currentBranch?.maxParttimeOffDays ?? 8;
  const ftWeeklyLimit = Math.max(1, Math.round(maxFtOff / 4));
  const ptWeeklyLimit = Math.max(1, Math.round(maxPtOff / 4));

  const branchStaff = useMemo(() => {
    return employees.filter((e) => e.branchId === currentBranchId && e.status === 'active');
  }, [employees, currentBranchId]);

  const regMap = useMemo(() => {
    const map = new Map<string, typeof registrations[0]>();
    registrations.forEach((r) => map.set(r.userId, r));
    return map;
  }, [registrations]);

  const roleMap = useMemo(() => {
    const map = new Map<string, typeof roles[0]>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const filteredStaff = useMemo(() => {
    return branchStaff.filter((emp) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.employeeCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [branchStaff, searchQuery]);

  const inspectedEmp = branchStaff.find((e) => e.id === inspectedEmpId);
  const inspectedReg = inspectedEmp ? regMap.get(inspectedEmp.id) : null;

  // Check stats for inspected employee
  const inspectedOffDays = useMemo(() => {
    if (!inspectedReg) return [];
    return DAYS_OF_WEEK.filter((d) => inspectedReg.slots[d.key] === 'OFF');
  }, [inspectedReg]);

  const inspectedLeaveReq = useMemo(() => {
    if (!inspectedEmp) return null;
    return shiftRequests.find(
      (r) => r.requesterId === inspectedEmp.id && r.requestType === 'leave' && r.branchId === currentBranchId
    );
  }, [shiftRequests, inspectedEmp, currentBranchId]);

  const handleAdminApproveExtraLeave = (empId: string, empName: string, offDay: DayOfWeek) => {
    if (inspectedLeaveReq && inspectedLeaveReq.status === 'pending') {
      reviewShiftRequest(inspectedLeaveReq.id, 'approved', 'Admin chi nhánh đã trực tiếp phê duyệt nghỉ thêm.');
    } else {
      createShiftRequest({
        requestType: 'leave',
        requesterId: empId,
        requesterName: empName,
        day: offDay,
        reason: 'Admin chi nhánh cấp phép nghỉ vượt hạn mức theo thỏa thuận nhân sự',
      });
      // Tự động tìm phiếu vừa tạo và duyệt
      setTimeout(() => {
        const newlyCreated = shiftRequests.find((r) => r.requesterId === empId && r.requestType === 'leave' && r.status === 'pending');
        if (newlyCreated) {
          reviewShiftRequest(newlyCreated.id, 'approved', 'Admin phê duyệt hợp lệ');
        }
      }, 100);
    }
    addToast('success', 'Đã duyệt phiếu nghỉ phép', `Đã cấp phép cho ${empName} nghỉ hợp lệ.`);
  };

  return (
    <div className="space-y-4">
      {/* Header Info & Branch Rules Banner */}
      <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users size={16} />
            </span>
            Ma Trận Đăng Ký Ca Làm Việc & Giám Sát Hạn Mức Nghỉ OFF (Tuần 42)
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Hạn mức quy định: <b>Full-time tối đa {maxFtOff} ngày/tháng (~{ftWeeklyLimit} ngày/tuần)</b> • <b>Part-time tối đa {maxPtOff} ngày/tháng (~{ptWeeklyLimit} ngày/tuần)</b>.
            Nhân viên Full-time nghỉ quá hạn mức bắt buộc phải có <b>Phiếu Yêu Cầu</b> gửi Admin duyệt.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500">Đã nộp: </span>
            <span className="font-mono font-bold text-slate-900">
              {branchStaff.filter((emp) => regMap.has(emp.id)).length} / {branchStaff.length}
            </span>
          </div>
          {(() => {
            const submittedCount = branchStaff.filter((emp) => regMap.has(emp.id)).length;
            const rate = branchStaff.length > 0 ? Math.round((submittedCount / branchStaff.length) * 100) : 0;
            return (
              <div
                className={`px-3.5 py-1.5 border rounded-xl text-xs font-bold ${
                  rate === 100
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : rate > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                Tỷ lệ: {rate}%
              </div>
            );
          })()}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm nhân viên theo tên, mã NV..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 font-medium"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium self-end sm:self-center">
          Tuần 42 (19/10 - 25/10/2026) • Chi Nhánh: <span className="font-semibold text-slate-700">{currentBranch?.name || currentBranchId}</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-zinc-700 font-semibold border-b border-zinc-200">
              <th className="p-3 border-r border-zinc-200 uppercase font-mono text-[11px] min-w-[210px] sticky left-0 bg-slate-100 z-10">
                Nhân Viên & Kỹ Năng
              </th>
              {DAYS_OF_WEEK.map((day) => (
                <th
                  key={day.key}
                  className="p-3 text-center border-r border-zinc-200 min-w-[100px]"
                >
                  <div className="font-bold text-zinc-900">{day.label}</div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">{day.dateStr}</div>
                </th>
              ))}
              <th className="p-3 text-center uppercase font-mono text-[11px] min-w-[150px] border-r border-zinc-200">
                Kiểm Tra Hạn Mức OFF
              </th>
              <th className="p-3 text-center uppercase font-mono text-[11px] w-16">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredStaff.map((emp) => {
              const reg = regMap.get(emp.id);

              // Calculate OFF days count
              let offCount = 0;
              DAYS_OF_WEEK.forEach((d) => {
                if (reg && reg.slots[d.key] === 'OFF') {
                  offCount++;
                }
              });

              const weeklyLimit = emp.employmentType === 'full_time' ? ftWeeklyLimit : ptWeeklyLimit;
              const isExceeded = offCount > weeklyLimit;

              // Check if employee has a leave request ticket
              const leaveReq = shiftRequests.find(
                (r) => r.requesterId === emp.id && r.requestType === 'leave' && r.branchId === currentBranchId
              );

              return (
                <tr
                  key={emp.id}
                  onClick={() => setInspectedEmpId(emp.id === inspectedEmpId ? null : emp.id)}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                    inspectedEmpId === emp.id ? 'bg-blue-50/40' : ''
                  }`}
                >
                  {/* Sticky Staff Info */}
                  <td className="p-3 border-r border-zinc-200 sticky left-0 bg-white z-10 shadow-xs">
                    <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                      <span>{emp.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">({emp.employeeCode})</span>
                      <ContractBadge type={emp.employmentType} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(() => {
                        const seenCodes = new Set<string>();
                        return emp.skills.map((sId) => {
                          const r = roleMap.get(sId) || roles.find((item) => item.code === sId || item.code === sId.split('-')[1]);
                          if (!r || seenCodes.has(r.code)) return null;
                          seenCodes.add(r.code);
                          return <RoleBadge key={r.code} roleCode={r.code} roleName={r.name} size="sm" />;
                        });
                      })()}
                    </div>
                  </td>

                  {/* 7 Days Availability Badges */}
                  {DAYS_OF_WEEK.map((day) => {
                    if (!reg) {
                      return (
                        <td
                          key={`${emp.id}_${day.key}`}
                          className="p-2.5 text-center border-r border-zinc-200 bg-slate-50/40"
                        >
                          <span className="font-mono text-[11px] text-zinc-300 select-none">—</span>
                        </td>
                      );
                    }

                    const choice: AvailabilityChoice = reg.slots[day.key];
                    const isOff = choice === 'OFF';

                    return (
                      <td
                        key={`${emp.id}_${day.key}`}
                        className={`p-2 text-center border-r border-zinc-200 ${
                          isOff ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <AvailabilityBadge choice={choice} size="md" />
                        {reg.dayCustomHours?.[day.key] && (
                          <div
                            className="text-[10px] font-mono text-blue-700 font-bold mt-1 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded truncate"
                            title={reg.dayCustomHours[day.key]}
                          >
                            ⏱️ {reg.dayCustomHours[day.key]}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* OFF Limit & Request Ticket Compliance */}
                  <td className="p-2.5 border-r border-zinc-200 text-center">
                    {!reg ? (
                      <span className="font-mono text-[10px] text-zinc-400 italic px-2 py-0.5 bg-slate-100 border border-zinc-200 inline-block">
                        Chưa nộp lịch
                      </span>
                    ) : isExceeded ? (
                      leaveReq?.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={12} /> Đã duyệt nghỉ ({offCount} ngày)
                        </span>
                      ) : leaveReq?.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                          <Clock size={12} /> Chờ duyệt phiếu ({offCount}/{weeklyLimit})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-300">
                          <AlertTriangle size={12} /> Vượt ({offCount}/{weeklyLimit}) • Chưa nộp phiếu
                        </span>
                      )
                    ) : (
                      <span className="font-mono text-[11px] text-zinc-500 font-semibold px-2 py-0.5 bg-slate-50 border border-zinc-200 inline-block">
                        {offCount} / {weeklyLimit} ngày OFF
                      </span>
                    )}
                  </td>

                  <td className="p-2.5 text-center">
                    {reg?.note ? (
                      <span title={reg.note} className="text-blue-600 inline-block">
                        <MessageSquare size={14} />
                      </span>
                    ) : (
                      <span className="text-zinc-300 font-mono">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Inspected Employee Details Drawer */}
      {inspectedEmp && inspectedReg && (
        <div className="p-4 bg-white border border-blue-300 rounded-none shadow-xs text-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <span className="font-bold text-zinc-900 flex items-center gap-2">
              <span>Hồ sơ đăng ký khả dụng: {inspectedEmp.name}</span>
              <span className="font-mono text-zinc-500">({inspectedEmp.employeeCode})</span>
              <ContractBadge type={inspectedEmp.employmentType} />
            </span>
            <button
              onClick={() => setInspectedEmpId(null)}
              className="text-zinc-400 hover:text-zinc-700 font-mono text-xs cursor-pointer"
            >
              [Đóng chi tiết]
            </button>
          </div>

          {/* Alert if exceeded quota without ticket */}
          {inspectedOffDays.length > (inspectedEmp.employmentType === 'full_time' ? ftWeeklyLimit : ptWeeklyLimit) && (
            <div className="p-3 bg-amber-50 border border-amber-300 flex items-start justify-between gap-3 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">
                    Cảnh Báo Hạn Mức Nghỉ: Nhân viên đăng ký {inspectedOffDays.length} ngày OFF trong tuần (Định mức tối đa: {inspectedEmp.employmentType === 'full_time' ? ftWeeklyLimit : ptWeeklyLimit} ngày).
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {inspectedEmp.employmentType === 'full_time'
                      ? 'Quy định Full-time: Bắt buộc làm đủ tối thiểu 8h/ngày và phải có Phiếu Yêu Cầu được Admin phê duyệt nếu nghỉ thêm.'
                      : 'Quy định Part-time: Đăng ký linh hoạt nhưng không vượt quá hạn mức do Admin chi nhánh thiết lập.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                {inspectedLeaveReq?.status === 'approved' ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] inline-flex items-center gap-1">
                    <CheckCircle2 size={12} /> Đã Phê Duyệt Phiếu
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAdminApproveExtraLeave(inspectedEmp.id, inspectedEmp.name, inspectedOffDays[0]?.key || 'sunday')}
                    className="bg-amber-800 hover:bg-amber-900 border-amber-800 text-xs py-1 h-7"
                  >
                    {inspectedLeaveReq?.status === 'pending' ? 'Duyệt Phiếu Yêu Cầu' : 'Cấp Phiếu Phê Duyệt Nghỉ Thêm'}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-zinc-500 font-semibold mb-1">Ghi chú gửi Admin chi nhánh:</p>
              <p className="font-medium text-zinc-800 italic bg-slate-50 p-2.5 border border-zinc-200">
                "{inspectedReg.note || 'Không có ghi chú thêm.'}"
              </p>
            </div>
            <div>
              <p className="text-zinc-500 font-semibold mb-1">Thời điểm nộp phiếu nguyện vọng:</p>
              <p className="font-mono font-medium text-zinc-800 bg-slate-50 p-2.5 border border-zinc-200">
                {inspectedReg.submittedAt}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
