import React, { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { LineCode, GenderRequirement, BusinessRole, SalaryPolicy } from '../../types';
import { LineBadge, RoleBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { formatVND, isFixedRateRole, SALARY_POLICY_META } from '../../utils/formatters';
import {
  Clock,
  Plus,
  Minus,
  Shield,
  Layers,
  Info,
  HelpCircle,
  CheckCircle2,
  Edit2,
  BadgeDollarSign,
} from 'lucide-react';

export const LineAndRolesTab: React.FC = () => {
  const {
    lineConfigs,
    lineRequirements,
    roles,
    currentBranchId,
    branches,
    updateBranch,
    updateLineConfig,
    updateLineRequirement,
    addRole,
    updateRole,
    addToast,
  } = useSchedule();

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const [maxFtOff, setMaxFtOff] = useState(currentBranch?.maxFulltimeOffDays ?? 4);
  const [maxPtOff, setMaxPtOff] = useState(currentBranch?.maxParttimeOffDays ?? 8);
  const [standardHours, setStandardHours] = useState(currentBranch?.standardMonthlyHours ?? 208);

  const handleSaveBranchRules = () => {
    updateBranch(currentBranchId, {
      maxFulltimeOffDays: Number(maxFtOff),
      maxParttimeOffDays: Number(maxPtOff),
      standardMonthlyHours: Number(standardHours),
    });
    addToast('success', 'Đã lưu quy định chi nhánh', 'Thiết lập hạn mức nghỉ OFF và định mức giờ đã được cập nhật.');
  };

  // Modal: Add Role
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [genderReq, setGenderReq] = useState<GenderRequirement>('any');
  const [defaultRate, setDefaultRate] = useState(45000);
  const [roleSalaryPolicy, setRoleSalaryPolicy] = useState<SalaryPolicy>('employee_seniority_rate');

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleCode.trim() || !roleName.trim()) return;

    addRole({
      branchId: currentBranchId,
      code: roleCode.trim().toUpperCase(),
      name: roleName.trim(),
      description: roleDesc.trim(),
      genderRequirement: genderReq,
      defaultHourlyRate: roleSalaryPolicy === 'fixed_role_rate' ? Number(defaultRate) : 0,
      salaryCalculationType: roleSalaryPolicy,
    });

    setIsRoleModalOpen(false);
    setRoleCode('');
    setRoleName('');
    setRoleDesc('');
    setRoleSalaryPolicy('employee_seniority_rate');
  };

  // Modal: Edit Role
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<BusinessRole | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [editGenderReq, setEditGenderReq] = useState<GenderRequirement>('any');
  const [editDefaultRate, setEditDefaultRate] = useState(45000);
  const [editRoleSalaryPolicy, setEditRoleSalaryPolicy] = useState<SalaryPolicy>('employee_seniority_rate');

  const handleOpenEditRole = (role: BusinessRole) => {
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleDesc(role.description || '');
    setEditGenderReq(role.genderRequirement);
    setEditDefaultRate(role.defaultHourlyRate);
    setEditRoleSalaryPolicy(
      role.salaryCalculationType || (isFixedRateRole(role) ? 'fixed_role_rate' : 'employee_seniority_rate')
    );
    setIsEditRoleModalOpen(true);
  };

  const handleSaveEditRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editRoleName.trim()) return;

    updateRole(editingRole.id, {
      name: editRoleName.trim(),
      description: editRoleDesc.trim(),
      genderRequirement: editGenderReq,
      defaultHourlyRate: editRoleSalaryPolicy === 'fixed_role_rate' ? Number(editDefaultRate) : 0,
      salaryCalculationType: editRoleSalaryPolicy,
    });

    setIsEditRoleModalOpen(false);
    setEditingRole(null);
    addToast('success', 'Đã lưu thay đổi vai trò', `Thông tin vai trò [${editRoleName.trim()}] đã được cập nhật thành công.`);
  };

  const linesList: LineCode[] = ['O', 'M', 'D'];

  return (
    <div className="space-y-6">
      {/* Notice on Line Overlap Rule from Specification Section 5 */}
      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
        <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">Quy tắc nghiệp vụ Line O - M - D:</span> Mỗi chi nhánh
          sử dụng ba line chuẩn: <b>O (Open)</b>, <b>M (Mid)</b>, <b>D (Down)</b>. Các line có thể chồng lấn
          thời gian (ví dụ Line O: 05:30–12:00 và Line M: 11:00–18:00; người thay ca vào lúc 11:00 để chuyển giao).
          Việc chồng ca hoàn toàn hợp lệ và phục vụ việc luân chuyển trơn tru.
        </div>
      </div>

      {/* Part 1: Line O / M / D Timing & Headcount Requirement */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              1. Cấu Hình Khung Giờ & Nhu Cầu Nhân Sự 3 Line Chuẩn (O - M - D)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thiết lập giờ bắt đầu, kết thúc và số lượng nhân sự bắt buộc cho từng vai trò theo từng line.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {linesList.map((lineCode) => {
            const config = lineConfigs.find((l) => l.lineCode === lineCode && l.branchId === currentBranchId) || lineConfigs.find((l) => l.lineCode === lineCode);
            if (!config) return null;

            const reqs = lineRequirements.filter(
              (r) => r.branchId === currentBranchId && r.lineCode === lineCode
            );
            const totalHeadcount = reqs.reduce((acc, r) => acc + r.headcountRequired, 0);

            return (
              <div
                key={lineCode}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-3.5 border-b border-zinc-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <LineBadge lineCode={lineCode} size="md" />
                      <h3 className="font-bold text-xs text-zinc-900">{config.lineName}</h3>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">{config.description}</p>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-white border border-zinc-300">
                    {totalHeadcount} người/ca
                  </span>
                </div>

                {/* Timing configuration */}
                <div className="p-3.5 border-b border-zinc-100 bg-slate-50/40">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 mb-0.5">Bắt đầu</label>
                      <input
                        type="time"
                        value={config.startTime}
                        onChange={(e) => updateLineConfig(lineCode, { startTime: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-mono border border-zinc-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 mb-0.5">Kết thúc</label>
                      <input
                        type="time"
                        value={config.endTime}
                        onChange={(e) => updateLineConfig(lineCode, { endTime: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-mono border border-zinc-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 mb-0.5">Thời lượng</label>
                      <input
                        type="number"
                        step={0.5}
                        value={config.durationHours}
                        onChange={(e) => updateLineConfig(lineCode, { durationHours: Number(e.target.value) })}
                        className="w-full px-2 py-1 text-xs font-mono border border-zinc-300 bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Headcount requirement by Role */}
                <div className="p-3.5 space-y-2 flex-1">
                  <h4 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-2">
                    Nhu cầu nhân sự bắt buộc (Hard Requirement):
                  </h4>

                  <div className="space-y-1.5">
                    {roles.map((r) => {
                      const req = reqs.find((item) => {
                        if (item.roleId === r.id) return true;
                        const legacyRole = roles.find((role) => role.id === item.roleId);
                        return Boolean(legacyRole && legacyRole.code === r.code);
                      });
                      const count = req ? req.headcountRequired : 0;

                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-2 border border-zinc-200 bg-white hover:border-zinc-300 transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-xs text-zinc-900 flex items-center gap-1.5">
                              <span>{r.name}</span>
                              <span className="font-mono text-[10px] text-zinc-400">({r.code})</span>
                            </div>
                            {r.genderRequirement === 'male_only' && (
                              <span className="text-[9px] font-mono text-rose-600 block">
                                * Yêu cầu: Nam
                              </span>
                            )}
                          </div>

                          {/* Stepper */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateLineRequirement(lineCode, r.id, count - 1)}
                              disabled={count <= 0}
                              className="w-6 h-6 border border-zinc-300 bg-slate-50 flex items-center justify-center text-zinc-600 disabled:opacity-40"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-7 text-center font-mono font-bold text-xs text-zinc-900">
                              {count}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateLineRequirement(lineCode, r.id, count + 1)}
                              className="w-6 h-6 border border-zinc-300 bg-slate-50 flex items-center justify-center text-zinc-600"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Part 2: Custom Roles & Gender Rules Management */}
      <div className="space-y-4 pt-4 border-t border-zinc-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
              2. Danh Sách Vai Trò & Ràng Buộc Giới Tính (Roles & Skills)
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Admin chi nhánh được phép tạo thêm vai trò mới theo nghiệp vụ thực tế; vai trò dùng để tính lương và xếp lịch.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setIsRoleModalOpen(true)}
            className="rounded-xl font-semibold shadow-xs"
          >
            Tạo Vai Trò Mới
          </Button>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-zinc-600 font-semibold border-b border-zinc-200 uppercase font-mono text-[11px]">
                  <th className="py-2.5 px-4 w-24">Mã Code</th>
                  <th className="py-2.5 px-4">Tên Vai Trò / Chuyên Môn</th>
                  <th className="py-2.5 px-4">Mô tả nghiệp vụ</th>
                  <th className="py-2.5 px-4 text-center">Ràng buộc Giới tính</th>
                  <th className="py-2.5 px-4 font-mono text-right">Lương Cố Định Vị Trí</th>
                  <th className="py-2.5 px-4 text-center">Cơ chế áp dụng lương</th>
                  <th className="py-2.5 px-4 text-center">Phân loại</th>
                  <th className="py-2.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {roles.map((r) => {
                  const isFixed = isFixedRateRole(r);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-800">
                        {r.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-900">
                        {r.name}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 text-[11px]">
                        {r.description || 'Chưa có mô tả chi tiết.'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {r.genderRequirement === 'male_only' ? (
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-300 text-rose-700 font-semibold text-[10px]">
                            Chỉ Nam (Bảo Vệ)
                          </span>
                        ) : r.genderRequirement === 'female_only' ? (
                          <span className="px-2 py-0.5 bg-pink-50 border border-pink-300 text-pink-700 font-semibold text-[10px]">
                            Chỉ Nữ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 border border-zinc-200 text-zinc-600 text-[10px]">
                            Mọi giới tính (Nam/Nữ)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {isFixed ? (
                          <span className="inline-block px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs">
                            {formatVND(r.defaultHourlyRate)}/h
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-slate-100 border border-zinc-200 text-zinc-400 font-sans italic text-[11px]">
                            Không gán cố định (Theo NV)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isFixed ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-800 font-semibold text-[10px] whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Cố định theo vị trí
                            </span>
                            <span className="text-[9px] text-amber-700 font-mono mt-0.5">
                              Lương vị trí: {formatVND(r.defaultHourlyRate)}/h
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-semibold text-[10px] whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              Theo thâm niên nhân sự
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                              Tính theo lương thâm niên từng người
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-zinc-200 text-zinc-600">
                          {r.isSystemDefault ? 'Hệ thống' : 'Chi nhánh'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Edit2 size={12} />}
                          onClick={() => handleOpenEditRole(r)}
                          title="Chỉnh sửa thông tin lương, tên và ràng buộc giới tính của vai trò"
                        >
                          Sửa
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Part 3: Thiết Lập Quy Định Ca Làm & Hạn Mức Nghỉ OFF Chi Nhánh */}
      <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
              <Shield size={16} className="text-zinc-700" />
              3. Thiết Lập Quy Định Ca Làm & Hạn Mức Nghỉ OFF Chi Nhánh
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Cấu hình các ràng buộc công chuẩn, hạn mức ngày nghỉ cho nhân viên Full-time và Part-time theo đặc tả chi nhánh.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveBranchRules}
          >
            Lưu Quy Định Chi Nhánh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Quy định Full-time */}
          <div className="border border-zinc-200 p-3 bg-slate-50 space-y-2.5">
            <div className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200 flex items-center justify-between">
              <span>Nhân Viên Full-time</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 border border-blue-200">FT Rules</span>
            </div>
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Số ngày nghỉ OFF tối đa / tháng:
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={maxFtOff}
                onChange={(e) => setMaxFtOff(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 font-mono text-xs font-bold text-zinc-900"
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              • <strong>Yêu cầu bắt buộc:</strong> Làm đủ ít nhất 8 tiếng/ngày (ca liền hoặc ca gãy O + D).
              <br />
              • <strong>Nghỉ vượt hạn mức:</strong> Nếu nhân viên FT xin nghỉ vượt quá <strong>{maxFtOff} ngày</strong>, hệ thống bắt buộc phải gửi phiếu yêu cầu xin phép Admin Chi Nhánh duyệt.
            </p>
          </div>

          {/* Card 2: Quy định Part-time */}
          <div className="border border-zinc-200 p-3 bg-slate-50 space-y-2.5">
            <div className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200 flex items-center justify-between">
              <span>Nhân Viên Part-time</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 border border-emerald-200">PT Rules</span>
            </div>
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Số ngày nghỉ OFF tối đa / tháng:
              </label>
              <input
                type="number"
                min={0}
                max={25}
                value={maxPtOff}
                onChange={(e) => setMaxPtOff(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 font-mono text-xs font-bold text-zinc-900"
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              • <strong>Linh hoạt:</strong> Đăng ký ca làm tùy theo lịch trình cá nhân thực tế (O, M, D, O_M, A).
              <br />
              • <strong>Hạn mức:</strong> Được phép đăng ký OFF tối đa <strong>{maxPtOff} ngày/tháng</strong>.
            </p>
          </div>

          {/* Card 3: Ca Gãy & Định Mức Chuẩn */}
          <div className="border border-zinc-200 p-3 bg-slate-50 space-y-2.5">
            <div className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200 flex items-center justify-between">
              <span>Ca Gãy & Định Mức Chuẩn</span>
              <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 border border-purple-200">Shift Rules</span>
            </div>
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Định mức giờ chuẩn chi nhánh (h/tháng):
              </label>
              <input
                type="number"
                min={100}
                max={300}
                value={standardHours}
                onChange={(e) => setStandardHours(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 font-mono text-xs font-bold text-zinc-900"
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              • <strong>Ca gãy (Split Shift):</strong> Cho phép xếp ca sáng (05:30-12:00) rồi ca tối (17:00-23:30) cho cùng 1 nhân sự FT khi thiếu người.
              <br />
              • <strong>Ràng buộc giới tính:</strong> Vai trò Bảo Vệ (SEC) chỉ áp dụng cho Nam.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Create Role */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Tạo Vai Trò / Chuyên Môn Mới"
        subtitle="Cấu hình vai trò phục vụ xác định headcount line và cơ sở tính lương"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsRoleModalOpen(false)}>
              Huỷ
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateRole}>
              Tạo Vai Trò
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateRole} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Mã Vai Trò (Code) *</label>
              <input
                type="text"
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                placeholder="Ví dụ: BAR-CHIEF"
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-xs uppercase"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Tên Vai Trò *</label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Ví dụ: Pha Chế Trưởng"
                className="w-full px-2.5 py-1.5 border border-zinc-300 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Mô tả công việc</label>
            <textarea
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              placeholder="Trách nhiệm chuyên môn trong ca..."
              rows={2}
              className="w-full p-2 border border-zinc-300 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Ràng buộc Giới tính (Constraint)</label>
            <select
              value={genderReq}
              onChange={(e) => setGenderReq(e.target.value as GenderRequirement)}
              className="w-full px-2.5 py-1.5 border border-zinc-300 bg-white text-xs"
            >
              <option value="any">Mọi giới tính (Nam / Nữ)</option>
              <option value="male_only">Chỉ Nam (Hard constraint - vd: Bảo Vệ)</option>
              <option value="female_only">Chỉ Nữ</option>
            </select>
          </div>

          {/* Salary policy selector */}
          <div className="p-3 border border-zinc-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 text-xs uppercase tracking-wide">
              <BadgeDollarSign size={15} className="text-zinc-700" />
              <span>Cơ Chế Tính Lương Của Vai Trò *</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Chọn cơ chế tính lương phù hợp với vai trò để hệ thống chấm công chính xác theo đặc tả.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Option 1: Không gán lương cố định */}
              <label
                className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-colors ${
                  roleSalaryPolicy === 'employee_seniority_rate'
                    ? 'bg-blue-50/90 border-blue-400 text-blue-950 ring-1 ring-blue-300 shadow-2xs'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="roleSalaryPolicy"
                  value="employee_seniority_rate"
                  checked={roleSalaryPolicy === 'employee_seniority_rate'}
                  onChange={() => setRoleSalaryPolicy('employee_seniority_rate')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-xs text-blue-950">Không Gán Lương Cố Định</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5 leading-snug">
                    Áp dụng cho <b>Phục Vụ, Pha Chế, Bảo Vệ...</b> Tiền lương được tính theo mức lương thâm niên riêng của từng người làm.
                  </div>
                </div>
              </label>

              {/* Option 2: Cố định theo vị trí */}
              <label
                className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-colors ${
                  roleSalaryPolicy === 'fixed_role_rate'
                    ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-300 shadow-2xs'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="roleSalaryPolicy"
                  value="fixed_role_rate"
                  checked={roleSalaryPolicy === 'fixed_role_rate'}
                  onChange={() => setRoleSalaryPolicy('fixed_role_rate')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="font-bold text-xs text-amber-950">Cố Định Theo Vị Trí (Bếp, Soạn Hàng)</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5 leading-snug">
                    Mọi nhân sự nhận ca đều nhận đúng mức lương cố định của vị trí này (ẩn lương thâm niên cá nhân đi).
                  </div>
                </div>
              </label>
            </div>

            {/* Input lương cố định: Chỉ hiển thị khi chọn Gán lương cố định */}
            {roleSalaryPolicy === 'fixed_role_rate' ? (
              <div className="mt-2.5 p-2.5 bg-white border border-amber-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-amber-950 text-xs">
                    Mức Lương Cố Định Của Vị Trí (VND/giờ) *
                  </label>
                  <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 border border-amber-200">
                    {formatVND(defaultRate)}/h
                  </span>
                </div>
                <input
                  type="number"
                  step={1000}
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(Number(e.target.value))}
                  placeholder="Ví dụ: 50000 cho Bếp, 46000 cho Soạn hàng"
                  className="w-full px-2.5 py-1.5 border border-amber-300 bg-white font-mono text-xs font-bold text-zinc-900 focus:ring-1 focus:ring-amber-500"
                  required
                />
                <p className="text-[10px] text-amber-800 leading-snug">
                  * Bất kỳ nhân sự nào nhận ca này sẽ hưởng đúng mức lương {formatVND(defaultRate)}/h.
                </p>
              </div>
            ) : (
              <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 text-blue-900 flex items-start gap-2 text-xs">
                <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <b>Không gán lương cố định:</b> Tiền lương sẽ được tự động tính theo mức lương thâm niên cá nhân trong hồ sơ của nhân sự nhận ca (không lo lỗi lệch lương giữa các nhân sự).
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Role */}
      <Modal
        isOpen={isEditRoleModalOpen}
        onClose={() => {
          setIsEditRoleModalOpen(false);
          setEditingRole(null);
        }}
        title={`Chỉnh Sửa Vai Trò: ${editingRole?.name || ''} (${editingRole?.code || ''})`}
        subtitle="Cập nhật mức lương tính giờ, ràng buộc giới tính và mô tả chuyên môn"
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsEditRoleModalOpen(false);
                setEditingRole(null);
              }}
            >
              Huỷ
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveEditRole}>
              Lưu Thay Đổi
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveEditRole} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Mã Vai Trò (Code)</label>
              <input
                type="text"
                value={editingRole?.code || ''}
                disabled
                className="w-full px-2.5 py-1.5 border border-zinc-200 bg-slate-100 font-mono text-xs text-zinc-500 uppercase cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Tên Vai Trò / Chuyên Môn *</label>
              <input
                type="text"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                placeholder="Ví dụ: Pha Chế Trưởng"
                className="w-full px-2.5 py-1.5 border border-zinc-300 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Mô tả công việc</label>
            <textarea
              value={editRoleDesc}
              onChange={(e) => setEditRoleDesc(e.target.value)}
              placeholder="Trách nhiệm chuyên môn trong ca..."
              rows={2}
              className="w-full p-2 border border-zinc-300 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Ràng buộc Giới tính (Constraint)</label>
            <select
              value={editGenderReq}
              onChange={(e) => setEditGenderReq(e.target.value as GenderRequirement)}
              className="w-full px-2.5 py-1.5 border border-zinc-300 bg-white text-xs"
            >
              <option value="any">Mọi giới tính (Nam / Nữ)</option>
              <option value="male_only">Chỉ Nam (Hard constraint - vd: Bảo Vệ)</option>
              <option value="female_only">Chỉ Nữ</option>
            </select>
          </div>

          {/* Salary policy selector */}
          <div className="p-3 border border-zinc-200 bg-slate-50 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900 text-[11px] uppercase tracking-wider">
              <BadgeDollarSign size={14} className="text-zinc-700" />
              <span>Cơ Chế Tính Lương Của Vai Trò *</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Chọn cơ chế tính lương áp dụng khi nhân sự được phân công vào vai trò này.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Option 1: Không gán lương cố định */}
              <label
                className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-colors ${
                  editRoleSalaryPolicy === 'employee_seniority_rate'
                    ? 'bg-blue-50/90 border-blue-400 text-blue-950 ring-1 ring-blue-300 shadow-2xs'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="editRoleSalaryPolicy"
                  value="employee_seniority_rate"
                  checked={editRoleSalaryPolicy === 'employee_seniority_rate'}
                  onChange={() => setEditRoleSalaryPolicy('employee_seniority_rate')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-xs text-blue-950">Không Gán Lương Cố Định</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5 leading-snug">
                    Áp dụng cho Bảo Vệ, Pha Chế, Phục Vụ... Lương tính theo thâm niên cá nhân của nhân sự nhận ca.
                  </div>
                </div>
              </label>

              {/* Option 2: Cố định theo vị trí */}
              <label
                className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-colors ${
                  editRoleSalaryPolicy === 'fixed_role_rate'
                    ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-300 shadow-2xs'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="editRoleSalaryPolicy"
                  value="fixed_role_rate"
                  checked={editRoleSalaryPolicy === 'fixed_role_rate'}
                  onChange={() => setEditRoleSalaryPolicy('fixed_role_rate')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="font-bold text-xs text-amber-950">Cố Định Theo Vị Trí (Bếp, Soạn Hàng)</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5 leading-snug">
                    Mọi nhân sự nhận ca đều nhận đúng mức lương cố định của vị trí này (ẩn lương thâm niên cá nhân đi).
                  </div>
                </div>
              </label>
            </div>

            {/* Input lương cố định: Chỉ hiển thị khi chọn Gán lương cố định */}
            {editRoleSalaryPolicy === 'fixed_role_rate' ? (
              <div className="mt-2.5 p-2.5 bg-white border border-amber-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-amber-950 text-xs">
                    Mức Lương Cố Định Của Vị Trí (VND/giờ) *
                  </label>
                  <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 border border-amber-200">
                    {formatVND(editDefaultRate)}/h
                  </span>
                </div>
                <input
                  type="number"
                  step={1000}
                  value={editDefaultRate}
                  onChange={(e) => setEditDefaultRate(Number(e.target.value))}
                  placeholder="Ví dụ: 50000 cho Bếp, 46000 cho Soạn hàng"
                  className="w-full px-2.5 py-1.5 border border-amber-300 bg-white font-mono text-xs font-bold text-zinc-900 focus:ring-1 focus:ring-amber-500"
                  required
                />
                <p className="text-[10px] text-amber-800 leading-snug">
                  * Bất kỳ nhân sự nào nhận ca này sẽ hưởng đúng mức lương {formatVND(editDefaultRate)}/h.
                </p>
              </div>
            ) : (
              <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 text-blue-900 flex items-start gap-2 text-xs">
                <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <b>Không gán lương cố định:</b> Tiền lương sẽ được tự động tính theo mức lương thâm niên cá nhân trong hồ sơ của nhân sự nhận ca (không lo lỗi lệch lương giữa các nhân sự).
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
