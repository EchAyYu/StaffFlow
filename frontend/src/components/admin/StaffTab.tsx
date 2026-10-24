import React, { useState, useMemo } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { Employee, EmploymentType, Gender } from '../../types';
import { RoleBadge, ContractBadge, GenderBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { formatVND } from '../../utils/formatters';
import { BranchEntity } from '../../domain/BranchModel';
import {
  Users,
  Search,
  Plus,
  Clock,
  Briefcase,
  Edit2,
  Trash2,
  Power,
  Shield,
  Check,
  Eye,
  EyeOff,
  Key,
  Lock,
} from 'lucide-react';

export const StaffTab: React.FC = () => {
  const {
    employees,
    branches,
    roles,
    currentBranchId,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
    payrollRecords,
  } = useSchedule();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [dob, setDob] = useState('2000-01-01');
  const [joinedDate, setJoinedDate] = useState('2023-01-01');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [baseHourlyRate, setBaseHourlyRate] = useState<number>(30000);

  // Filtered staff of current branch
  const branchEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (e.branchId !== currentBranchId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !e.employeeCode.toLowerCase().includes(q) &&
          !e.email.toLowerCase().includes(q) &&
          !e.username?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (roleFilter !== 'all' && !e.skills.includes(roleFilter)) return false;
      if (typeFilter !== 'all' && e.employmentType !== typeFilter) return false;
      if (genderFilter !== 'all' && e.gender !== genderFilter) return false;

      return true;
    });
  }, [employees, currentBranchId, searchQuery, roleFilter, typeFilter, genderFilter]);

  const roleMap = useMemo(() => {
    const map = new Map<string, typeof roles[0]>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const handleOpenCreate = () => {
    setEditingEmp(null);

    // Lọc danh sách nhân viên thuộc chi nhánh hiện tại (chỉ tính roleType === 'employee')
    const currentBranchEmployees = employees.filter(
      (e) => e.branchId === currentBranchId && e.roleType === 'employee'
    );
    const branchCodes = currentBranchEmployees.map((e) => e.employeeCode);

    // Sử dụng Domain Entity OOP để sinh mã nhân viên tuần tự chuẩn xác và bất biến
    const currentBranchObj = branches.find((b) => b.id === currentBranchId);
    const branchEntity = new BranchEntity(
      currentBranchObj || { id: currentBranchId, code: currentBranchId.replace('BR-', ''), name: 'Chi Nhánh' }
    );
    const nextCode = branchEntity.generateNextEmployeeCode(branchCodes);

    setCode(nextCode);
    setName('');
    setEmail('');
    setUsername('');
    setPassword('123456');
    setShowPassword(false);
    setGender('male');
    setDob('2000-01-01');
    setJoinedDate(new Date().toISOString().split('T')[0]);
    setEmploymentType('full_time');
    setBaseHourlyRate(30000);
    setPhone('');
    
    // Tự động tick sẵn kỹ năng Phục Vụ (vai trò cơ bản mọi nhân viên đều đảm nhiệm)
    const srvRole = roles.find((r) => r.code === 'SRV');
    setSelectedSkills(srvRole ? [srvRole.id] : []);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setCode(emp.employeeCode);
    setName(emp.name);
    setEmail(emp.email);
    setUsername(emp.username || emp.email.split('@')[0] || emp.employeeCode.toLowerCase());
    setPassword(emp.password || '123456');
    setShowPassword(false);
    setGender(emp.gender);
    setDob(emp.dob);
    setJoinedDate(emp.joinedDate);
    setEmploymentType(emp.employmentType);
    setBaseHourlyRate(emp.baseHourlyRate || 30000);

    // Chuẩn hóa và làm sạch kỹ năng, tránh trùng lặp
    const seenCodes = new Set<string>();
    const cleanSkills: string[] = [];
    emp.skills.forEach((sId) => {
      const r = roleMap.get(sId) || roles.find((item) => item.code === sId || item.code === sId.split('-')[1]);
      if (r && !seenCodes.has(r.code)) {
        seenCodes.add(r.code);
        cleanSkills.push(r.id);
      }
    });

    setSelectedSkills(cleanSkills);
    setPhone(emp.phone || '');
    setIsModalOpen(true);
  };

  const toggleSkill = (roleId: string) => {
    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;

    setSelectedSkills((prev) => {
      const exists = prev.some((id) => {
        if (id === roleId) return true;
        const r = roles.find((item) => item.id === id);
        return Boolean(r && r.code === targetRole.code);
      });

      if (exists) {
        return prev.filter((id) => {
          if (id === roleId) return false;
          const r = roles.find((item) => item.id === id);
          return !(r && r.code === targetRole.code);
        });
      } else {
        return [...prev, targetRole.id];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const finalUsername = (username.trim() || email.split('@')[0] || code).toLowerCase().replace(/\s+/g, '');
    const finalPassword = password.trim() || '123456';

    // Đảm bảo kỹ năng luôn duy nhất và khớp với danh mục vai trò
    const seenCodes = new Set<string>();
    const cleanSkills: string[] = [];
    selectedSkills.forEach((sId) => {
      const r = roles.find((item) => item.id === sId || item.code === sId || item.code === sId.split('-')[1]);
      if (r && !seenCodes.has(r.code)) {
        seenCodes.add(r.code);
        cleanSkills.push(r.id);
      }
    });

    if (editingEmp) {
      updateEmployee(editingEmp.id, {
        employeeCode: code,
        name: name.trim(),
        email: email.trim(),
        username: finalUsername,
        password: finalPassword,
        gender,
        dob,
        joinedDate,
        employmentType,
        skills: cleanSkills,
        baseHourlyRate: Number(baseHourlyRate) || 30000,
        phone,
      });
    } else {
      addEmployee({
        branchId: currentBranchId,
        employeeCode: code,
        name: name.trim(),
        email: email.trim(),
        username: finalUsername,
        password: finalPassword,
        roleType: 'employee',
        gender,
        dob,
        joinedDate,
        employmentType,
        skills: cleanSkills,
        wageRates: {},
        baseHourlyRate: Number(baseHourlyRate) || 30000,
        status: 'active',
        phone,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, mã NV, email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl font-medium bg-slate-50/70 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          {/* Skill Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/70 font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả kỹ năng</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/70 font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả hợp đồng</option>
            <option value="full_time">Full-time (8h/ngày)</option>
            <option value="part_time">Part-time (Linh hoạt)</option>
          </select>

          {/* Gender Filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/70 font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Mọi giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={handleOpenCreate}
          className="rounded-xl font-semibold shadow-sm"
        >
          Thêm Nhân Viên
        </Button>
      </div>

      {/* Staff Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 text-slate-600 font-bold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 w-24">Mã NV</th>
                <th className="py-3 px-4">Họ và Tên / Email</th>
                <th className="py-3 px-4 text-center">Giới tính</th>
                <th className="py-3 px-4">Hợp đồng</th>
                <th className="py-3 px-4">Kỹ năng / Vai trò duyệt</th>
                <th className="py-3 px-4 font-mono text-center">Ngày vào làm</th>
                <th className="py-3 px-4 font-mono text-right">Lương Thâm Niên</th>
                <th className="py-3 px-4 font-mono text-right">Giờ tuần</th>
                <th className="py-3 px-4 text-right w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Không tìm thấy nhân viên nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                branchEmployees.map((emp) => {
                  const payroll = payrollRecords.find((p) => p.userId === emp.id);
                  const totalWeekHours = (payroll?.completedHours || 0) + (payroll?.projectedHours || 0);

                  return (
                    <tr key={emp.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        <span className="bg-indigo-50/80 border border-indigo-200/70 px-2 py-0.5 rounded-lg">
                          {emp.employeeCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold shadow-xs shrink-0">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{emp.name}</span>
                              {emp.roleType === 'branch_admin' && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span>{emp.email}</span>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1 bg-indigo-50/70 text-indigo-900 px-1.5 py-0.5 rounded-md border border-indigo-200/60">
                                <Key size={10} className="text-indigo-500" />
                                TK: <strong className="text-indigo-700">{emp.username || emp.email.split('@')[0]}</strong>
                              </span>
                              {emp.phone && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500">{emp.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <GenderBadge gender={emp.gender} />
                      </td>

                      <td className="py-3 px-4">
                        <ContractBadge type={emp.employmentType} />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
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

                      <td className="py-3 px-4 font-mono text-center text-zinc-600">
                        {emp.joinedDate}
                      </td>

                      <td className="py-3 px-4 font-mono text-right font-bold text-blue-900">
                        {formatVND(emp.baseHourlyRate || 30000)}/h
                      </td>

                      <td className="py-3 px-4 font-mono text-right font-bold text-zinc-900">
                        {totalWeekHours}h{' '}
                        <span className="text-[10px] text-zinc-400 font-normal">
                          ({payroll?.completedHours || 0}h đã chốt)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent hover:border-zinc-200"
                            title="Sửa hồ sơ"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => toggleEmployeeStatus(emp.id)}
                            className={`p-1 border border-transparent ${
                              emp.status === 'active' ? 'text-zinc-400 hover:text-amber-600' : 'text-emerald-600'
                            }`}
                            title={emp.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                          >
                            <Power size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Xoá nhân viên ${emp.name}?`)) {
                                deleteEmployee(emp.id);
                              }
                            }}
                            className="p-1 text-zinc-400 hover:text-rose-600"
                            title="Xoá"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit Employee */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmp ? `Sửa hồ sơ nhân viên: ${editingEmp.employeeCode}` : 'Thêm Nhân Viên Mới'}
        subtitle="Quản lý thông tin bắt buộc: Giới tính, ngày sinh, ngày vào làm, hợp đồng & kỹ năng đảm nhiệm"
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Huỷ
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {editingEmp ? 'Lưu Thay Đổi' : 'Tạo Nhân Viên'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Mã Nhân Viên *</label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold flex items-center gap-1 shadow-2xs">
                  <Lock size={10} /> Gán Cứng (Khóa)
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  readOnly
                  disabled
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl font-mono text-xs uppercase bg-slate-100 text-indigo-700 font-bold select-none cursor-not-allowed shadow-2xs"
                  required
                />
                <Lock size={13} className="absolute left-2.5 top-2.5 text-indigo-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-1">
                🔒 Tự động cấp phát tuần tự theo chi nhánh, không thể chỉnh sửa.
              </p>
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Họ và Tên *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn Nam"
                className="w-full px-2.5 py-1.5 border border-zinc-300 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Email nội bộ *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmail(val);
                  // Auto-suggest username if creating a new employee
                  if (!editingEmp && (!username || username === email.split('@')[0])) {
                    setUsername(val.split('@')[0]);
                  }
                }}
                placeholder="name@company.com"
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Số điện thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0901 234 567"
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-xs"
              />
            </div>
          </div>

          {/* Cấp Tài Khoản Đăng Nhập & Mật Khẩu (Cổng Nhân Viên) */}
          <div className="grid grid-cols-2 gap-3 border border-zinc-200 p-2.5 bg-slate-50">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Tài khoản đăng nhập (Username) *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vd: ntbt hoặc tram.nguyen"
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-xs bg-white"
                required
              />
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">Dùng đăng nhập Cổng Nhân Viên</p>
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Mật khẩu đăng nhập *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mặc định: 123456"
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-300 font-mono text-xs bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">Mặc định: 123456 (có thể đổi)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Giới tính *</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-1.5 px-3 text-xs font-semibold border rounded-xl text-center transition-all cursor-pointer ${
                    gender === 'male'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Nam
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGender('female');
                    // Tự động bỏ chọn các vai trò chỉ dành cho Nam (như Bảo Vệ)
                    const maleOnlyRoleIds = roles.filter((r) => r.genderRequirement === 'male_only').map((r) => r.id);
                    const maleOnlyCodes = roles.filter((r) => r.genderRequirement === 'male_only').map((r) => r.code);
                    setSelectedSkills((prev) =>
                      prev.filter((id) => {
                        if (maleOnlyRoleIds.includes(id)) return false;
                        const r = roles.find((item) => item.id === id);
                        if (r && maleOnlyCodes.includes(r.code)) return false;
                        return true;
                      })
                    );
                  }}
                  className={`py-1.5 px-3 text-xs font-semibold border rounded-xl text-center transition-all cursor-pointer ${
                    gender === 'female'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Nữ
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                {gender === 'female' ? '⚠️ Nữ: Hệ thống khóa vai trò Bảo Vệ' : '✓ Nam: Đủ điều kiện làm mọi vị trí'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Loại hình làm việc *</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 bg-white text-xs h-[33px]"
              >
                <option value="full_time">Full-time (≥ 8h/ngày, 208h/tháng)</option>
                <option value="part_time">Part-time (Linh hoạt)</option>
              </select>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                {employmentType === 'full_time' ? 'Bắt buộc tối thiểu 8h/ngày' : 'Đăng ký theo lịch rảnh'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Ngày sinh (DOB)</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-xs bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Ngày vào làm</label>
              <input
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 font-mono text-xs bg-white"
              />
            </div>
          </div>

          {/* MỨC LƯƠNG THEO GIỜ CỦA NHÂN VIÊN THEO THÂM NIÊN */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-bold text-slate-900 uppercase text-[11px] tracking-wide">
                  Mức Lương Theo Giờ Theo Thâm Niên (VNĐ/giờ) *
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Áp dụng khi nhân viên làm các vai trò linh hoạt (Phục Vụ, Pha Chế, Bảo Vệ...)
                </p>
              </div>
              <span className="font-mono text-xs font-black text-blue-700 bg-white px-2.5 py-1 border border-blue-300 rounded-lg shadow-2xs">
                {formatVND(baseHourlyRate)}/h
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="number"
                step={1000}
                min={15000}
                max={500000}
                value={baseHourlyRate}
                onChange={(e) => setBaseHourlyRate(Number(e.target.value) || 0)}
                placeholder="vd: 30000 hoặc 45000"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-white text-slate-900 font-bold"
                required
              />

              {/* Quick preset buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {[25000, 30000, 35000, 40000, 45000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBaseHourlyRate(preset)}
                    className={`px-2 py-1 text-[10px] font-mono rounded-md border transition-all cursor-pointer ${
                      baseHourlyRate === preset
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset / 1000}k
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-blue-100">
              <span className="font-bold text-slate-800">📌 Quy tắc phân bổ lương:</span> Khi nhân viên làm các vai trò như <b>Bảo Vệ, Phục Vụ, Pha Chế</b> sẽ tính theo mức lương thâm niên này. Riêng các vị trí có <b>Lương cố định theo vị trí</b> (như <b>Bếp & Soạn Hàng</b>), hệ thống sẽ tự động tính theo đơn giá cố định của vị trí đó.
            </div>
          </div>

          {/* Multi-Skill Checkbox Assignment */}
          <div className="border border-zinc-200 p-3 bg-slate-50">
            <label className="block font-bold text-zinc-900 uppercase text-[11px] mb-1">
              Kỹ Năng & Vai Trò Đảm Nhiệm (Đầu vào trực tiếp của Scheduler)
            </label>
            <p className="text-[11px] text-zinc-500 mb-2.5 leading-relaxed">
              Theo quy tắc Hard Constraint: Scheduler chỉ xếp nhân viên vào line/vị trí khớp kỹ năng đã được tick dưới đây.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => {
                const isChecked = selectedSkills.some((sId) => {
                  if (sId === r.id) return true;
                  const itemRole = roles.find((item) => item.id === sId);
                  return Boolean(itemRole && itemRole.code === r.code);
                });
                const isGenderIncompatible = r.genderRequirement === 'male_only' && gender === 'female';

                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => !isGenderIncompatible && toggleSkill(r.id)}
                    disabled={isGenderIncompatible}
                    className={`p-2.5 text-left border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                      isGenderIncompatible
                        ? 'opacity-40 bg-slate-100 cursor-not-allowed border-slate-200'
                        : isChecked
                        ? 'bg-indigo-50/70 border-indigo-500 text-indigo-950 shadow-2xs font-semibold'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center text-white transition-colors ${
                          isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span>{r.name}</span>
                    </div>

                    {isGenderIncompatible && (
                      <span className="text-[9px] font-mono text-rose-600">Chỉ Nam</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
