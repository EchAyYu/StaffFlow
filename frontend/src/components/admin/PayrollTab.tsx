import React, { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { formatVND } from '../../utils/formatters';
import { ContractBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import {
  DollarSign,
  Clock,
  Download,
  AlertCircle,
  Plus,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';

export const PayrollTab: React.FC = () => {
  const { payrollRecords, updateEmployeeOT, currentBranchId, branches, employees } = useSchedule();

  // OT modal state
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [otHoursInput, setOtHoursInput] = useState<number>(0);
  const [isOtModalOpen, setIsOtModalOpen] = useState(false);

  const branch = branches.find((b) => b.id === currentBranchId);
  const records = payrollRecords.filter((p) => p.branchId === currentBranchId);

  const totalCompletedHours = records.reduce((acc, r) => acc + r.completedHours, 0);
  const totalProjectedHours = records.reduce((acc, r) => acc + r.projectedHours, 0);
  const totalOtHours = records.reduce((acc, r) => acc + r.otHours, 0);
  const totalNetPay = records.reduce((acc, r) => acc + r.totalPay, 0);

  const handleOpenOT = (userId: string, currentOT: number) => {
    setSelectedUser(userId);
    setOtHoursInput(currentOT);
    setIsOtModalOpen(true);
  };

  const handleSaveOT = () => {
    if (!selectedUser) return;
    updateEmployeeOT(selectedUser, Number(otHoursInput));
    setIsOtModalOpen(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Ma NV',
      'Ten Nhan Vien',
      'Hop Dong',
      'Luong Tham Nien (VND/h)',
      'Gio Da Chot (Past)',
      'Gio Du Kien (Future)',
      'Tong Gio Tuan',
      'Gio Tang Ca (OT)',
      'Luong Co Ban (VND)',
      'Luong OT (VND)',
      'Khau Tru Thieu Gio (VND)',
      'Thuc Lanh (VND)',
    ];

    const rows = records.map((r) => {
      const emp = employees.find((e) => e.id === r.userId);
      const seniorityRate = emp?.baseHourlyRate ?? 30000;
      return [
        r.employeeCode,
        r.name,
        r.employmentType,
        seniorityRate,
        r.completedHours,
        r.projectedHours,
        r.completedHours + r.projectedHours,
        r.otHours,
        r.basePay,
        r.otPay,
        r.shortageDeduction,
        r.totalPay,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `StaffFlow_BangLuong_${currentBranchId}_Tuan42.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Automatic End-of-Day Logic note */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-start gap-3 text-xs text-slate-600">
        <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
          <CheckCircle2 size={16} />
        </span>
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">Cơ chế tính lương theo thâm niên & vị trí cố định:</span>{' '}
          Hệ thống tự động áp dụng: Ca <b>Bếp (KIT)</b> & <b>Soạn Hàng (INV)</b> tính theo mức lương cố định của vị trí (không phụ thuộc nhân sự); các ca khác (<b>Phục Vụ, Pha Chế, Bảo Vệ...</b>) tính theo mức lương thâm niên riêng của từng người. 
          Các ngày từ Thứ 2 đến Thứ 5 đã hoàn thành được ghi nhận vào cột <b>"Giờ Đã Chốt"</b>. Admin có thể nhập giờ tăng ca (OT) hưởng hệ số 150%.
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Giờ làm đã chốt (Past)
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Clock size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {totalCompletedHours}h
            </span>
            <span className="text-xs font-mono text-slate-500">từ T2 đến T5</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Giờ dự kiến (Future)
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {totalProjectedHours}h
            </span>
            <span className="text-xs font-mono text-slate-500">từ T6 đến CN</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tổng giờ tăng ca (OT)
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {totalOtHours}h
            </span>
            <span className="text-xs font-mono text-slate-500">hệ số 1.5x</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tổng chi phí tiền lương
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatVND(totalNetPay)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bảng Tổng Hợp Giờ Công & Lương Tuần 42 ({branch?.name})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Chuẩn Full-time: {branch?.standardMonthlyHours}h/tháng (40h/tuần) • Tự động tính theo mức lương từng role
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<Download size={13} />}
            onClick={handleExportCSV}
          >
            Xuất Bảng Lương (CSV)
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-zinc-600 font-semibold border-b border-zinc-200 uppercase font-mono text-[11px]">
                <th className="py-2.5 px-4 w-24">Mã NV</th>
                <th className="py-2.5 px-4">Họ và Tên</th>
                <th className="py-2.5 px-4">Hợp đồng</th>
                <th className="py-2.5 px-4 text-right font-mono">Đã chốt (Past)</th>
                <th className="py-2.5 px-4 text-right font-mono">Dự kiến</th>
                <th className="py-2.5 px-4 text-right font-mono">Tổng giờ</th>
                <th className="py-2.5 px-4 text-center font-mono">Giờ OT</th>
                <th className="py-2.5 px-4 text-right font-mono">Lương ca</th>
                <th className="py-2.5 px-4 text-right font-mono">Tiền OT</th>
                <th className="py-2.5 px-4 text-right font-mono">Khấu trừ</th>
                <th className="py-2.5 px-4 text-right font-mono">Thực lãnh</th>
                <th className="py-2.5 px-4 text-right w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {records.map((r) => {
                const totalHours = r.completedHours + r.projectedHours;
                const emp = employees.find((e) => e.id === r.userId);
                return (
                  <tr key={r.userId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-zinc-800">
                      {r.employeeCode}
                    </td>

                    <td className="py-3 px-4 font-semibold text-zinc-900">
                      <div>{r.name}</div>
                      <div className="text-[10px] font-mono font-normal text-zinc-500 mt-0.5">
                        Lương thâm niên: <span className="font-semibold text-blue-700">{formatVND(emp?.baseHourlyRate ?? 30000)}/h</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <ContractBadge type={r.employmentType} />
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                      {r.completedHours}h
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-500">
                      {r.projectedHours}h
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900">
                      {totalHours}h
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-700">
                      {r.otHours > 0 ? `${r.otHours}h` : '-'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-700">
                      {formatVND(r.basePay)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-amber-700">
                      {r.otPay > 0 ? formatVND(r.otPay) : '-'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-rose-600">
                      {r.shortageDeduction > 0 ? `-${formatVND(r.shortageDeduction)}` : '-'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 text-sm">
                      {formatVND(r.totalPay)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenOT(r.userId, r.otHours)}
                        className="px-2 py-1 text-[11px] font-mono border border-zinc-300 hover:border-zinc-900 bg-white hover:bg-slate-50 transition-colors"
                      >
                        Nhập OT
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Input OT */}
      {selectedUser && (
        <Modal
          isOpen={isOtModalOpen}
          onClose={() => setIsOtModalOpen(false)}
          title="Nhập Giờ Tăng Ca (OT) Cho Nhân Viên"
          subtitle="Hệ thống tự động nhân hệ số OT (150%) vào bảng lương cuối kỳ"
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsOtModalOpen(false)}>
                Huỷ
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveOT}>
                Lưu Giờ OT
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Số giờ tăng ca phát sinh trong tuần (tiếng):
              </label>
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={otHoursInput}
                onChange={(e) => setOtHoursInput(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-sm font-bold text-zinc-900"
                required
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              * Mức chi trả tăng ca = Giờ OT × Mức lương theo vai trò × Hệ số 1.5
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
