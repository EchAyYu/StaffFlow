import React, { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { Branch } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { formatVND } from '../../utils/formatters';
import { BranchEntity } from '../../domain/BranchModel';
import {
  exportPayrollExcel,
  exportStaffExcel,
  exportBranchesExcel,
  exportScheduleReportExcel,
} from '../../utils/excelExporter';
import {
  Building2,
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  Plus,
  FileSpreadsheet,
  Edit,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Filter,
  ShieldCheck,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  CalendarDays,
  ArrowUpRight,
  Lock,
  Trash2,
  Settings,
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const {
    currentUser,
    branches,
    addBranch,
    updateBranch,
    deleteBranch,
    employees,
    updateEmployee,
    switchBranch,
    currentBranchId,
    switchRoleType,
    payrollRecords,
    schedule,
    schedulesByBranch,
    roles,
    lineConfigs,
    addToast,
  } = useSchedule();

  const superAdminUser =
    (currentUser?.roleType === 'super_admin' ? currentUser : undefined) ||
    employees.find((e) => e.roleType === 'super_admin' || e.id === 'USR-SUPER-01') ||
    currentUser;

  // Navigation tab within Super Admin
  const [activeTab, setActiveTab] = useState<'branches' | 'payroll' | 'staff' | 'schedules'>('branches');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  // Modal State for Super Admin Settings (Chỉnh sửa thông tin Admin Tổng)
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [saName, setSaName] = useState('');
  const [saEmployeeCode, setSaEmployeeCode] = useState('');
  const [saUsername, setSaUsername] = useState('');
  const [saEmail, setSaEmail] = useState('');
  const [saPhone, setSaPhone] = useState('');
  const [saGender, setSaGender] = useState<'male' | 'female'>('male');
  const [saDob, setSaDob] = useState('');
  const [saNewPassword, setSaNewPassword] = useState('');
  const [showSaPassword, setShowSaPassword] = useState(false);

  const handleOpenAdminSettings = () => {
    if (!superAdminUser) return;
    setSaName(superAdminUser.name || '');
    setSaEmployeeCode(superAdminUser.employeeCode || 'ADM-000');
    setSaUsername(superAdminUser.username || 'admin.tong');
    setSaEmail(superAdminUser.email || 'admin.tong@company.com');
    setSaPhone(superAdminUser.phone || '');
    setSaGender(superAdminUser.gender || 'male');
    setSaDob(superAdminUser.dob || '1985-02-14');
    setSaNewPassword('');
    setShowSaPassword(false);
    setIsAdminSettingsOpen(true);
  };

  const handleSaveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdminUser) return;
    if (!saName.trim() || !saUsername.trim() || !saEmail.trim()) {
      addToast('warning', 'Thiếu thông tin bắt buộc', 'Vui lòng nhập đầy đủ Họ tên, Tài khoản đăng nhập và Email của Admin Tổng.');
      return;
    }

    const updates: Partial<typeof superAdminUser> = {
      name: saName.trim(),
      employeeCode: saEmployeeCode.trim() || 'ADM-000',
      username: saUsername.trim(),
      email: saEmail.trim(),
      phone: saPhone.trim(),
      gender: saGender,
      dob: saDob,
    };

    if (saNewPassword.trim()) {
      updates.password = saNewPassword.trim();
    }

    updateEmployee(superAdminUser.id, updates);
    setIsAdminSituationUpdated();
  };

  const setIsAdminSituationUpdated = () => {
    setIsAdminSettingsOpen(false);
    setSaNewPassword('');
  };

  // Modal State for Delete Branch Confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  // Modal State for Inspect Branch Detail
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectingBranch, setInspectingBranch] = useState<Branch | null>(null);
  const [inspectSubTab, setInspectSubTab] = useState<'overview' | 'staff' | 'payroll'>('overview');

  const handleInspectBranch = (branch: Branch) => {
    setInspectingBranch(branch);
    setInspectSubTab('overview');
    setIsInspectModalOpen(true);
  };

  // Modal State for Create Branch & Provision Admin
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAdminName, setCreateAdminName] = useState('');
  const [createAdminUsername, setCreateAdminUsername] = useState('');
  const [createAdminPassword, setCreateAdminPassword] = useState('');
  const [createAdminEmail, setCreateAdminEmail] = useState('');
  const [createStandardHours, setCreateStandardHours] = useState(208);
  const [createMaxFtOff, setCreateMaxFtOff] = useState(4);
  const [createMaxPtOff, setCreateMaxPtOff] = useState(8);

  // Modal State for Edit Branch & Admin
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editStandardHours, setEditStandardHours] = useState(208);
  const [editMaxFtOff, setEditMaxFtOff] = useState(4);
  const [editMaxPtOff, setEditMaxPtOff] = useState(8);

  // Password visibility toggle per branch row
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Excel Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'payroll' | 'staff' | 'branches' | 'schedules'>('payroll');
  const [exportBranchScope, setExportBranchScope] = useState<string>('ALL');

  // Aggregated system-wide stats
  const totalEmployees = employees.length;
  const totalCompletedHours = payrollRecords.reduce((acc, p) => acc + p.completedHours, 0);
  const totalProjectedHours = payrollRecords.reduce((acc, p) => acc + p.projectedHours, 0);
  const totalPayroll = payrollRecords.reduce((acc, p) => acc + p.totalPay, 0);
  const totalShortages = schedule.shortageWarnings.length;

  const togglePasswordVisibility = (branchId: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    addToast('info', 'Đã sao chép', `Đã chép thông tin vào bộ nhớ tạm.`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setEditName(branch.name);
    setEditAddress(branch.address);
    setEditPhone(branch.phone);
    setEditAdminName(branch.adminName || '');
    setEditAdminUsername(branch.adminUsername || '');
    setEditAdminPassword(branch.adminPassword || '');
    setEditAdminEmail(branch.adminEmail || '');
    setEditStandardHours(branch.standardMonthlyHours);
    setEditMaxFtOff(branch.maxFulltimeOffDays);
    setEditMaxPtOff(branch.maxParttimeOffDays);
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCode.trim() || !createName.trim()) {
      addToast('warning', 'Thiếu thông tin', 'Vui lòng nhập Mã và Tên chi nhánh.');
      return;
    }
    if (!createAdminUsername.trim() || !createAdminPassword.trim()) {
      addToast('warning', 'Thiếu thông tin Admin', 'Vui lòng cung cấp Tài khoản và Mật khẩu cho Admin Chi Nhánh.');
      return;
    }

    addBranch({
      code: createCode.trim().toUpperCase(),
      name: createName.trim(),
      address: createAddress.trim(),
      phone: createPhone.trim(),
      standardMonthlyHours: Number(createStandardHours),
      maxFulltimeOffDays: Number(createMaxFtOff),
      maxParttimeOffDays: Number(createMaxPtOff),
      adminName: createAdminName.trim() || `Admin ${createName.trim()}`,
      adminUsername: createAdminUsername.trim(),
      adminPassword: createAdminPassword.trim(),
      adminEmail: createAdminEmail.trim() || `${createAdminUsername.trim()}@company.com`,
    });

    setIsCreateModalOpen(false);
    // Reset form
    setCreateCode('');
    setCreateName('');
    setCreateAddress('');
    setCreatePhone('');
    setCreateAdminName('');
    setCreateAdminUsername('');
    setCreateAdminPassword('');
    setCreateAdminEmail('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    updateBranch(editingBranch.id, {
      name: editName.trim(),
      address: editAddress.trim(),
      phone: editPhone.trim(),
      standardMonthlyHours: Number(editStandardHours),
      maxFulltimeOffDays: Number(editMaxFtOff),
      maxParttimeOffDays: Number(editMaxPtOff),
      adminName: editAdminName.trim(),
      adminUsername: editAdminUsername.trim(),
      adminPassword: editAdminPassword.trim(),
      adminEmail: editAdminEmail.trim(),
    });

    setIsEditModalOpen(false);
    setEditingBranch(null);
  };

  const handleOpenDelete = (branch: Branch) => {
    setBranchToDelete(branch);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!branchToDelete) return;
    deleteBranch(branchToDelete.id);
    setIsDeleteModalOpen(false);
    setBranchToDelete(null);
  };

  const handleTriggerExport = () => {
    if (exportType === 'payroll') {
      exportPayrollExcel({
        payrollRecords,
        employees,
        branches,
        filterBranchId: exportBranchScope,
      });
      addToast('success', 'Xuất Excel Thành Công', 'Đã tải xuống Bảng lương thống kê.');
    } else if (exportType === 'staff') {
      exportStaffExcel({
        employees,
        branches,
        roles,
        filterBranchId: exportBranchScope,
      });
      addToast('success', 'Xuất Excel Thành Công', 'Đã tải xuống Báo cáo danh sách nhân sự.');
    } else if (exportType === 'branches') {
      exportBranchesExcel(branches);
      addToast('success', 'Xuất Excel Thành Công', 'Đã tải xuống Danh sách Chi nhánh & Tài khoản Admin.');
    } else if (exportType === 'schedules') {
      exportScheduleReportExcel({
        schedule,
        branches,
        roles,
        employees,
        lineConfigs,
      });
      addToast('success', 'Xuất Excel Thành Công', 'Đã tải xuống Báo cáo ca làm việc & độ phủ.');
    }
    setIsExportModalOpen(false);
  };

  // Filtered lists
  const filteredBranches = branches.filter((b) => {
    const matchSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.adminName && b.adminName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.adminUsername && b.adminUsername.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchSearch;
  });

  const filteredPayrollRecords = selectedBranchFilter === 'ALL'
    ? payrollRecords
    : payrollRecords.filter((p) => p.branchId === selectedBranchFilter);

  const filteredStaff = selectedBranchFilter === 'ALL'
    ? employees
    : employees.filter((e) => e.branchId === selectedBranchFilter);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 font-bold uppercase tracking-wider rounded-md">
              QUYỀN HẠN CAO NHẤT: ADMIN TỔNG (SUPER ADMIN)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {superAdminUser?.name || 'Admin Tổng'} • @{superAdminUser?.username || 'admin.tong'} ({superAdminUser?.email || 'admin.tong@company.com'})
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Quản Lý Toàn Bộ Chi Nhánh & Kiểm Soát Tài Khoản Admin Chi Nhánh
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin Tổng quản lý phân quyền, tạo/chỉnh sửa/xoá chi nhánh và cấp tài khoản/mật khẩu quản trị. Xem báo cáo lương, nhân sự, lịch làm việc toàn hệ thống và xuất Excel theo điều kiện.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Super Admin Profile & Credentials Settings Button */}
          <Button
            variant="outline"
            size="sm"
            icon={<Settings size={14} className="text-purple-600" />}
            onClick={handleOpenAdminSettings}
            className="rounded-xl border-purple-200 bg-purple-50/50 text-purple-800 hover:bg-purple-100/70 font-semibold"
          >
            Cài Đặt Admin Tổng
          </Button>

          {/* Export Excel Button with condition dialog */}
          <Button
            variant="outline"
            size="sm"
            icon={<FileSpreadsheet size={14} className="text-emerald-600" />}
            onClick={() => setIsExportModalOpen(true)}
            className="rounded-xl"
          >
            Xuất Báo Cáo Excel
          </Button>

          {/* Create Branch & Admin Modal */}
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-xl font-semibold shadow-xs"
          >
            Tạo Chi Nhánh & Cấp Admin
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chi Nhánh Hoạt Động
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Building2 size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {branches.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600">Đã kích hoạt</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tổng Nhân Sự Hệ Thống
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {totalEmployees}
            </span>
            <span className="text-xs font-medium text-slate-500">nhân sự</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quỹ Lương Toàn Bộ
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatVND(totalPayroll)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tổng Giờ Làm (Chốt + Dự kiến)
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {(totalCompletedHours + totalProjectedHours).toFixed(1)}h
            </span>
            <span className="text-xs font-mono text-slate-500">
              (Thực tế: {totalCompletedHours.toFixed(1)}h)
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 pt-2 rounded-t-2xl overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'branches'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 size={15} />
            Quản Lý Chi Nhánh & Admin ({branches.length})
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'payroll'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <DollarSign size={15} />
            Báo Cáo Bảng Lương Thống Kê
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users size={15} />
            Báo Cáo Nhân Sự & Kỹ Năng
          </button>

          <button
            onClick={() => setActiveTab('schedules')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'schedules'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarDays size={15} />
            Báo Cáo Lịch Làm & Độ Phủ Ca
          </button>
        </div>

        {/* Quick Excel Action for current view */}
        <div className="pb-1.5 pr-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<FileSpreadsheet size={13} className="text-emerald-700" />}
            onClick={() => {
              if (activeTab === 'branches') exportBranchesExcel(branches);
              else if (activeTab === 'payroll') exportPayrollExcel({ payrollRecords, employees, branches, filterBranchId: selectedBranchFilter });
              else if (activeTab === 'staff') exportStaffExcel({ employees, branches, roles, filterBranchId: selectedBranchFilter });
              else exportScheduleReportExcel({ schedule, branches, roles, employees, lineConfigs });
              addToast('success', 'Xuất Excel', 'Đã tải xuống file Excel báo cáo.');
            }}
          >
            Xuất Excel Tab Này
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUẢN LÝ CHI NHÁNH & TÀI KHOẢN ADMIN CHI NHÁNH                       */}
      {/* ========================================================================= */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white border border-slate-200/80 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã, tên chi nhánh, tên hoặc username admin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Chỉ <strong className="text-slate-800">Admin Tổng</strong> có thẩm quyền cấp và chỉnh sửa thông tin tài khoản Admin Chi Nhánh.</span>
            </div>
          </div>

          {/* Branches & Admin Credentials Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-slate-200/80 text-slate-600 uppercase font-mono text-[10px] tracking-wider">
                    <th className="py-3 px-3.5 font-bold">Mã CN</th>
                    <th className="py-3 px-3.5 font-bold">Tên Chi Nhánh</th>
                    <th className="py-3 px-3.5 font-bold">Địa Chỉ & Hotline</th>
                    <th className="py-3 px-3.5 font-bold">Admin Chi Nhánh</th>
                    <th className="py-3 px-3.5 font-bold">Tài Khoản Đăng Nhập</th>
                    <th className="py-3 px-3.5 font-bold">Mật Khẩu Cung Cấp</th>
                    <th className="py-3 px-3.5 font-bold text-right">Thao Tác Quản Trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBranches.map((branch) => {
                    const isShowingPassword = Boolean(showPasswordMap[branch.id]);
                    const branchStaffCount = employees.filter((e) => e.branchId === branch.id).length;

                    return (
                      <tr key={branch.id} className="hover:bg-indigo-50/30 transition-colors">
                        {/* Branch Code */}
                        <td className="py-3.5 px-3.5 font-mono font-bold text-indigo-700">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg">
                            {branch.code}
                          </span>
                        </td>

                        {/* Branch Name & Staff badge */}
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleInspectBranch(branch)}
                            className="font-semibold text-zinc-900 hover:text-blue-600 hover:underline text-left block cursor-pointer"
                            title="Nhấn để xem chi tiết chi nhánh này"
                          >
                            {branch.name}
                          </button>
                          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                            <Users size={11} /> {branchStaffCount} nhân sự trực thuộc
                          </div>
                        </td>

                        {/* Address & Phone */}
                        <td className="py-3 px-3 text-zinc-600 max-w-xs">
                          <div className="flex items-center gap-1 text-[11px] truncate">
                            <MapPin size={11} className="text-zinc-400 shrink-0" />
                            <span className="truncate">{branch.address}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono mt-0.5">
                            <Phone size={11} className="text-zinc-400 shrink-0" />
                            <span>{branch.phone}</span>
                          </div>
                        </td>

                        {/* Admin Name */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-zinc-900 flex items-center gap-1">
                            <UserCheck size={12} className="text-blue-600" />
                            {branch.adminName || 'Chưa thiết lập'}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                            {branch.adminEmail || `${branch.adminUsername || 'admin'}@company.com`}
                          </div>
                        </td>

                        {/* Username */}
                        <td className="py-3 px-3 font-mono text-zinc-800">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 px-2 py-0.5 border border-zinc-200 select-all font-semibold">
                              {branch.adminUsername || 'N/A'}
                            </span>
                            {branch.adminUsername && (
                              <button
                                onClick={() => copyToClipboard(branch.adminUsername || '', `usr-${branch.id}`)}
                                title="Sao chép tài khoản"
                                className="text-zinc-400 hover:text-zinc-700"
                              >
                                {copiedKey === `usr-${branch.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Password (Masked with toggle & Bcrypt recognition) */}
                        <td className="py-3 px-3 font-mono">
                          {(() => {
                            const isHashed = Boolean(
                              branch.adminPassword &&
                              (branch.adminPassword.startsWith('$2a$') ||
                               branch.adminPassword.startsWith('$2b$') ||
                               branch.adminPassword.startsWith('$2y$'))
                            );
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-lg border text-xs select-all min-w-[80px] ${
                                  isHashed 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' 
                                    : 'bg-slate-100 border-slate-200 text-slate-800'
                                }`}>
                                  {isShowingPassword
                                    ? isHashed
                                      ? 'Mã Bcrypt (Đã bảo mật)'
                                      : branch.adminPassword || 'Chưa cấp'
                                    : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(branch.id)}
                                  title={isShowingPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                                >
                                  {isShowingPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                {branch.adminPassword && (
                                  <button
                                    onClick={() => copyToClipboard(branch.adminPassword || '', `pwd-${branch.id}`)}
                                    title="Sao chép mật khẩu / hash"
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                                  >
                                    {copiedKey === `pwd-${branch.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Branch & Admin */}
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Edit size={12} />}
                              onClick={() => handleOpenEdit(branch)}
                              title="Chỉnh sửa thông tin chi nhánh & đổi tài khoản/mật khẩu Admin"
                            >
                              Sửa
                            </Button>

                            {/* Delete Branch */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                              icon={<Trash2 size={12} className="text-red-600" />}
                              onClick={() => handleOpenDelete(branch)}
                              title="Xóa bỏ chi nhánh và toàn bộ nhân sự, dữ liệu liên quan"
                            >
                              Xoá
                            </Button>

                            {/* Inspect branch details without changing role */}
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Eye size={12} />}
                              onClick={() => handleInspectBranch(branch)}
                              title="Xem chi tiết toàn diện của chi nhánh này (Nhân sự, Bảng lương, Lịch làm)"
                            >
                              Chi Tiết
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 size={28} className="text-zinc-300" />
                          <p className="font-semibold text-zinc-700">Chưa có chi nhánh nào trong hệ thống</p>
                          <p className="text-xs text-zinc-400">Nhấn nút "Tạo Chi Nhánh & Cấp Admin" ở phía trên để bắt đầu khởi tạo chi nhánh đầu tiên.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BÁO CÁO BẢNG LƯƠNG THỐNG KÊ (PAYROLL OVERSIGHT)                     */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600">Lọc theo chi nhánh:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-none text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
              >
                <option value="ALL">-- Tất cả chi nhánh ({branches.length}) --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet size={13} className="text-emerald-700" />}
              onClick={() =>
                exportPayrollExcel({
                  payrollRecords,
                  employees,
                  branches,
                  filterBranchId: selectedBranchFilter,
                })
              }
            >
              Xuất Excel Bảng Lương Này
            </Button>
          </div>

          {/* Payroll Table */}
          <div className="bg-white border border-zinc-200 rounded-none overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-zinc-200 text-zinc-600 uppercase font-mono text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 font-semibold">Chi Nhánh</th>
                    <th className="py-2.5 px-3 font-semibold">Mã NV</th>
                    <th className="py-2.5 px-3 font-semibold">Họ và Tên</th>
                    <th className="py-2.5 px-3 font-semibold">Loại HĐ</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Giờ Thực Tế (T2-T5)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Giờ Dự Kiến (T6-CN)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Giờ OT (1.5x)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lương Cơ Bản</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lương OT</th>
                    <th className="py-2.5 px-3 font-semibold text-right font-bold text-zinc-900">
                      Tổng Lương (VNĐ)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-mono">
                  {filteredPayrollRecords.map((rec) => {
                    const emp = employees.find((e) => e.id === rec.userId);
                    const branch = branches.find((b) => b.id === rec.branchId);

                    return (
                      <tr key={rec.userId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-zinc-700">
                          {branch?.code || rec.branchId}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600">{emp?.employeeCode}</td>
                        <td className="py-2.5 px-3 font-sans font-medium text-zinc-900">
                          {emp?.name}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-zinc-600">
                          {emp?.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                          {rec.completedHours.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-700">
                          {rec.projectedHours.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-700 font-bold">
                          {rec.otHours.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-700">
                          {formatVND(rec.basePay)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-800">
                          {formatVND(rec.otPay)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-zinc-900 bg-slate-50">
                          {formatVND(rec.totalPay)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-sans font-medium border ${
                              rec.status === 'finalized'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {rec.status === 'finalized' ? 'Đã Chốt' : 'Bản Nháp'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BÁO CÁO NHÂN SỰ & KỸ NĂNG (STAFF CAPACITY)                           */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600">Lọc theo chi nhánh:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-none text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
              >
                <option value="ALL">-- Tất cả chi nhánh ({branches.length}) --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet size={13} className="text-emerald-700" />}
              onClick={() =>
                exportStaffExcel({
                  employees,
                  branches,
                  roles,
                  filterBranchId: selectedBranchFilter,
                })
              }
            >
              Xuất Excel Danh Sách Nhân Sự
            </Button>
          </div>

          {/* Staff Table */}
          <div className="bg-white border border-zinc-200 rounded-none overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-zinc-200 text-zinc-600 uppercase font-mono text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 font-semibold">Chi Nhánh</th>
                    <th className="py-2.5 px-3 font-semibold">Mã NV</th>
                    <th className="py-2.5 px-3 font-semibold">Họ và Tên</th>
                    <th className="py-2.5 px-3 font-semibold">Tài Khoản</th>
                    <th className="py-2.5 px-3 font-semibold">Giới Tính</th>
                    <th className="py-2.5 px-3 font-semibold">Hợp Đồng</th>
                    <th className="py-2.5 px-3 font-semibold">Chức Vụ</th>
                    <th className="py-2.5 px-3 font-semibold">Kỹ Năng Đảm Nhiệm</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredStaff.map((emp) => {
                    const branch = branches.find((b) => b.id === emp.branchId);

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-zinc-700">
                          {branch?.code || emp.branchId}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-600">{emp.employeeCode}</td>
                        <td className="py-2.5 px-3 font-medium text-zinc-900">{emp.name}</td>
                        <td className="py-2.5 px-3 font-mono text-zinc-500">{emp.username}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                              emp.gender === 'male'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-pink-50 text-pink-700 border-pink-200'
                            }`}
                          >
                            {emp.gender === 'male' ? 'Nam' : 'Nữ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600">
                          {emp.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 text-[10px] bg-zinc-100 border border-zinc-300 font-mono text-zinc-700">
                            {emp.roleType === 'super_admin'
                              ? 'Admin Tổng'
                              : emp.roleType === 'branch_admin'
                              ? 'Admin Chi Nhánh'
                              : 'Nhân Viên'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {emp.skills.map((sId) => {
                              const role = roles.find((r) => r.id === sId);
                              return (
                                <span
                                  key={sId}
                                  className="px-1.5 py-0.2 bg-slate-50 border border-zinc-200 text-[10px] font-mono text-zinc-700"
                                >
                                  {role?.name || sId}
                                </span>
                              );
                            })}
                            {emp.skills.length === 0 && (
                              <span className="text-zinc-400 text-[11px] italic">Quản trị</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                              emp.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-zinc-100 text-zinc-500 border-zinc-300'
                            }`}
                          >
                            {emp.status === 'active' ? 'Hoạt động' : 'Đã nghỉ'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BÁO CÁO LỊCH LÀM VIỆC & ĐỘ PHỦ CA                                    */}
      {/* ========================================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">
                  Tình Trạng Lịch Làm Việc Tuần Hiện Tại Các Chi Nhánh
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Dữ liệu lịch công bố được các Admin Chi Nhánh gửi lên Admin Tổng.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                icon={<FileSpreadsheet size={13} className="text-emerald-700" />}
                onClick={() =>
                  exportScheduleReportExcel({
                    schedule,
                    branches,
                    roles,
                    employees,
                    lineConfigs,
                  })
                }
              >
                Xuất Excel Báo Cáo Ca Làm
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {branches.map((b) => {
                const branchSchedule = schedulesByBranch[b.id] || (b.id === schedule.branchId ? schedule : undefined);
                const totalSlots = branchSchedule?.assignments?.length || 0;
                const assignedSlots = (branchSchedule?.assignments || []).filter((a) => a.userId).length;
                const fillRate = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0;
                const statusLabel = !branchSchedule || totalSlots === 0
                  ? 'Chưa Xếp Lịch'
                  : branchSchedule.status === 'published'
                  ? 'Đã Công Khai'
                  : branchSchedule.status === 'changed'
                  ? 'Có Điều Chỉnh'
                  : 'Bản Nháp';

                return (
                  <div key={b.id} className="border border-zinc-200 p-3 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-xs text-zinc-900">{b.code}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                            branchSchedule?.status === 'published'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : totalSlots > 0
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-300'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-zinc-900 truncate">{b.name}</div>
                      <div className="text-[11px] text-zinc-500 mt-2">
                        Tỷ lệ lấp đầy ca: <strong className="font-mono text-zinc-900">{fillRate}%</strong> ({assignedSlots}/{totalSlots} ca)
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-200 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">
                        Admin: <strong>{b.adminName || 'Chưa gán'}</strong>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUpRight size={11} />}
                        onClick={() => {
                          switchBranch(b.id);
                          switchRoleType('branch_admin');
                        }}
                      >
                        Xem Lịch
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TẠO CHI NHÁNH & CẤP TÀI KHOẢN ADMIN                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="TẠO CHI NHÁNH MỚI & CẤP TÀI KHOẢN ADMIN CHI NHÁNH"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {/* Thông báo quyền hạn của Admin Tổng */}
          <div className="bg-purple-50 border border-purple-200 p-2.5 text-purple-900 flex items-start gap-2">
            <Lock size={15} className="shrink-0 mt-0.5 text-purple-700" />
            <div>
              <strong>Quy chuẩn Admin Tổng:</strong> Mọi chi nhánh được tạo sẽ đồng thời được tạo ngay tài khoản và mật khẩu quản trị chi nhánh. Chỉ Admin Tổng mới có thể thay đổi hoặc cấp lại mật khẩu này.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CỘT 1: THÔNG TIN CHI NHÁNH */}
            <div className="space-y-3 border-r md:pr-4 border-zinc-200">
              <h4 className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200">
                1. Thông Tin Chi Nhánh
              </h4>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Mã Chi Nhánh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: HCM03, DN01..."
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Tên Chi Nhánh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chi Nhánh Thảo Điền"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Địa Chỉ Chi Nhánh</label>
                <input
                  type="text"
                  placeholder="Số nhà, tên đường, phường, quận..."
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Số Điện Thoại Hotline</label>
                <input
                  type="text"
                  placeholder="028 xxxx xxxx"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs"
                />
              </div>
            </div>

            {/* CỘT 2: TÀI KHOẢN VÀ MẬT KHẨU CỦA ADMIN CHI NHÁNH */}
            <div className="space-y-3">
              <h4 className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200">
                2. Cấp Tài Khoản Admin Chi Nhánh
              </h4>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Họ và Tên Admin Phụ Trách <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={createAdminName}
                  onChange={(e) => setCreateAdminName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Tài Khoản Đăng Nhập (Username) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: admin.thaodien"
                  value={createAdminUsername}
                  onChange={(e) => setCreateAdminUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Mật Khẩu Cung Cấp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Admin@2026..."
                  value={createAdminPassword}
                  onChange={(e) => setCreateAdminPassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Email Nhận Báo Cáo Admin</label>
                <input
                  type="email"
                  placeholder="admin.thaodien@company.com"
                  value={createAdminEmail}
                  onChange={(e) => setCreateAdminEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div className="pt-2 text-[11px] text-zinc-500 bg-slate-50 p-2 border border-zinc-200">
                🔒 <em>Lưu ý:</em> Tài khoản sau khi tạo sẽ có quyền quản trị riêng đối với chi nhánh mới, nhưng không thể can thiệp sang các chi nhánh khác.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Plus size={14} />}>
              Kích Hoạt Chi Nhánh & Cấp Tài Khoản
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CHỈNH SỬA CHI NHÁNH & ĐỔI TÀI KHOẢN/MẬT KHẨU ADMIN               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`CHỈNH SỬA THÔNG TIN CHI NHÁNH & ADMIN [${editingBranch?.code}]`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="bg-amber-50 border border-amber-200 p-2.5 text-amber-900 flex items-start gap-2">
            <Key size={15} className="shrink-0 mt-0.5 text-amber-700" />
            <div>
              <strong>Kiểm soát độc quyền Admin Tổng:</strong> Bạn có thể đổi tên admin, cấp lại mật khẩu hoặc đổi username đăng nhập của chi nhánh này bất cứ lúc nào.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* THÔNG TIN CHI NHÁNH */}
            <div className="space-y-3 border-r md:pr-4 border-zinc-200">
              <h4 className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200">
                1. Thông Tin Chi Nhánh
              </h4>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Tên Chi Nhánh</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Địa Chỉ</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Hotline</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs"
                />
              </div>
            </div>

            {/* THÔNG TIN TÀI KHOẢN ADMIN */}
            <div className="space-y-3">
              <h4 className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200">
                2. Quản Trị Tài Khoản Admin Chi Nhánh
              </h4>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Tên Admin Phụ Trách</label>
                <input
                  type="text"
                  required
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Tài Khoản Đăng Nhập</label>
                <input
                  type="text"
                  required
                  value={editAdminUsername}
                  onChange={(e) => setEditAdminUsername(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Mật Khẩu Mới (Hoặc giữ nguyên)
                </label>
                <input
                  type="text"
                  required
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Email Admin</label>
                <input
                  type="email"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-none text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Check size={14} />}>
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: XUẤT EXCEL TÙY CHỌN THEO ĐIỀU KIỆN                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="XUẤT BÁO CÁO EXCEL TÙY BIẾN THEO ĐIỀU KIỆN"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">1. Chọn Loại Báo Cáo Cần Xuất:</label>
            <div className="space-y-2 border border-zinc-200 p-3 bg-slate-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="payroll"
                  checked={exportType === 'payroll'}
                  onChange={() => setExportType('payroll')}
                  className="accent-zinc-900"
                />
                <div>
                  <div className="font-semibold text-zinc-900">Bảng Lương Thống Kê Chi Tiết</div>
                  <div className="text-[11px] text-zinc-500">
                    Bao gồm giờ hoàn thành, giờ dự kiến, giờ OT 1.5x, lương cơ bản và thực nhận từng nhân viên.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-zinc-200">
                <input
                  type="radio"
                  name="exportType"
                  value="staff"
                  checked={exportType === 'staff'}
                  onChange={() => setExportType('staff')}
                  className="accent-zinc-900"
                />
                <div>
                  <div className="font-semibold text-zinc-900">Danh Sách Nhân Sự & Kỹ Năng</div>
                  <div className="text-[11px] text-zinc-500">
                    Bao gồm mã nhân sự, phân loại hợp đồng (FT/PT), kỹ năng đảm nhiệm và tình trạng hoạt động.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-zinc-200">
                <input
                  type="radio"
                  name="exportType"
                  value="branches"
                  checked={exportType === 'branches'}
                  onChange={() => setExportType('branches')}
                  className="accent-zinc-900"
                />
                <div>
                  <div className="font-semibold text-zinc-900">Danh Sách Chi Nhánh & Tài Khoản Admin Cung Cấp</div>
                  <div className="text-[11px] text-zinc-500">
                    Bảng kiểm kê mã, tên chi nhánh, tài khoản, mật khẩu và định mức vận hành.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-zinc-200">
                <input
                  type="radio"
                  name="exportType"
                  value="schedules"
                  checked={exportType === 'schedules'}
                  onChange={() => setExportType('schedules')}
                  className="accent-zinc-900"
                />
                <div>
                  <div className="font-semibold text-zinc-900">Báo Cáo Ca Làm & Tình Hình Thiếu Hụt Nhân Sự</div>
                  <div className="text-[11px] text-zinc-500">
                    Chi tiết từng vị trí ca O/M/D từ Thứ 2 đến Chủ nhật, độ phủ ca và đề xuất Override.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">2. Phạm Vi Chi Nhánh:</label>
            <select
              value={exportBranchScope}
              onChange={(e) => setExportBranchScope(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-zinc-300 rounded-none font-medium text-xs text-zinc-900"
            >
              <option value="ALL">-- Toàn Bộ Hệ Thống (Tất cả chi nhánh) --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 text-[11px]">
            ℹ️ File được xuất dưới định dạng <strong>CSV chuẩn mã hóa UTF-8 BOM</strong>, tương thích 100% với Microsoft Excel, hiển thị đầy đủ dấu tiếng Việt không bị lỗi font chữ.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<FileSpreadsheet size={14} />}
              onClick={handleTriggerExport}
            >
              Tải Xuống File Excel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: XÁC NHẬN XOÁ CHI NHÁNH (RÀNG BUỘC NGHIỆP VỤ OOP CHẶT CHẼ)         */}
      {/* ========================================================================= */}
      {branchToDelete && (() => {
        const branchStaff = employees.filter((e) => e.branchId === branchToDelete.id);
        const branchAssignments = schedule.assignments.filter((a) => a.branchId === branchToDelete.id);
        const branchEntity = new BranchEntity(branchToDelete);
        const oopCheck = branchEntity.canBeDeleted(branchStaff.length, branchAssignments.length);

        return (
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setBranchToDelete(null);
            }}
            title={oopCheck.allowed ? 'XÁC NHẬN XOÁ CHI NHÁNH' : 'KHÔNG THỂ XÓA CHI NHÁNH (RÀNG BUỘC OOP)'}
            subtitle={oopCheck.allowed ? 'Chi nhánh hợp lệ để giải thể vì không còn nhân sự' : 'Quy tắc toàn vẹn Domain: Cấm giải thể chi nhánh khi còn nhân viên trực thuộc'}
            maxWidth="lg"
          >
            <div className="space-y-4 text-xs">
              {/* Alert Box: OOP Invariant Violation or Warning */}
              {!oopCheck.allowed ? (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 flex items-start gap-3 shadow-xs">
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                    <ShieldCheck size={20} className="text-rose-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold uppercase tracking-wider text-xs text-rose-700 flex items-center gap-1.5">
                      <span>Ràng Buộc Nghiệp Vụ OOP (Domain Invariant)</span>
                      <span className="bg-rose-200/80 text-rose-900 px-1.5 py-0.2 rounded font-mono text-[10px]">
                        KHÓA THAO TÁC
                      </span>
                    </div>
                    <p className="leading-relaxed text-rose-800">
                      Chi nhánh <strong>{branchToDelete.name}</strong> ({branchToDelete.code}) hiện đang có{' '}
                      <strong className="text-rose-900 underline font-mono">{branchStaff.length} nhân sự</strong> trực thuộc.
                    </p>
                    <p className="text-[11px] text-rose-700/90 leading-relaxed font-medium">
                      Theo nguyên tắc đóng gói và tính toàn vẹn dữ liệu hướng đối tượng (OOP Invariant), hệ thống không cho phép xóa/giải thể bất kỳ chi nhánh nào khi vẫn còn nhân sự hoặc quản lý. Bạn cần phải điều chuyển công tác hoặc xóa hồ sơ nhân viên trước khi thực hiện xóa chi nhánh.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-3">
                  <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
                      Cảnh Báo Xóa Vĩnh Viễn Chi Nhánh Rỗng
                    </div>
                    <p className="mt-1 leading-relaxed text-amber-800">
                      Chi nhánh <strong>{branchToDelete.name}</strong> ({branchToDelete.code}) hiện không còn nhân sự trực thuộc (0 nhân sự). Bạn có chắc chắn muốn giải thể và xóa vĩnh viễn chi nhánh này khỏi hệ thống?
                    </p>
                  </div>
                </div>
              )}

              {/* Thông tin tóm tắt chi nhánh */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 text-[11px]">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Mã Chi Nhánh:</span>
                  <span className="font-bold font-mono text-indigo-700">{branchToDelete.code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Tên Chi Nhánh:</span>
                  <span className="font-bold text-slate-900">{branchToDelete.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Tài Khoản Quản Trị CN:</span>
                  <span className="font-bold font-mono text-slate-800">{branchToDelete.adminUsername || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Số Nhân Sự Hiện Còn:</span>
                  <span className={`font-bold font-mono ${branchStaff.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {branchStaff.length} nhân sự ({branchStaff.filter((e) => e.roleType === 'employee').length} NV, {branchStaff.filter((e) => e.roleType === 'branch_admin').length} Quản lý)
                  </span>
                </div>
              </div>

              {/* Danh sách nhân sự cần điều chuyển (nếu còn nhân sự) */}
              {branchStaff.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 uppercase">
                      Danh Sách Nhân Sự Cần Xử Lý Trước ({branchStaff.length})
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">Cần điều chuyển hoặc xóa</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase sticky top-0">
                        <tr>
                          <th className="p-2">Mã NV</th>
                          <th className="p-2">Họ và Tên</th>
                          <th className="p-2">Vai Trò</th>
                          <th className="p-2 text-right">Lương Thâm Niên</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {branchStaff.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-indigo-700">{emp.employeeCode}</td>
                            <td className="p-2 font-sans font-medium text-slate-900">{emp.name}</td>
                            <td className="p-2 font-sans">
                              {emp.roleType === 'branch_admin' ? (
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Quản Lý CN</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">Nhân Viên</span>
                              )}
                            </td>
                            <td className="p-2 text-right font-bold text-slate-700">{formatVND(emp.baseHourlyRate || 30000)}/h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setBranchToDelete(null);
                  }}
                >
                  {oopCheck.allowed ? 'Hủy Bỏ' : 'Đã Hiểu / Đóng'}
                </Button>

                {oopCheck.allowed ? (
                  <button
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Xác Nhận Xoá Chi Nhánh
                  </button>
                ) : (
                  <button
                    disabled
                    title="Bị khóa theo ràng buộc OOP: Chi nhánh vẫn còn nhân sự trực thuộc"
                    className="px-3.5 py-2 bg-slate-200 text-slate-400 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-not-allowed select-none"
                  >
                    <Lock size={13} />
                    Khóa Xóa (Vi phạm ràng buộc OOP)
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 5: XEM CHI TIẾT VẬN HÀNH CHI NHÁNH (ADMIN TỔNG GIÁM SÁT)            */}
      {/* ========================================================================= */}
      {inspectingBranch && (
        <Modal
          isOpen={isInspectModalOpen}
          onClose={() => {
            setIsInspectModalOpen(false);
            setInspectingBranch(null);
          }}
          title={`CHI TIẾT VẬN HÀNH: ${inspectingBranch.name} (${inspectingBranch.code})`}
          subtitle="Giám sát số liệu nhân sự, bảng lương và quy định của riêng chi nhánh này"
          maxWidth="4xl"
          footer={
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileSpreadsheet size={13} className="text-white" />}
                  onClick={() => {
                    exportPayrollExcel({
                      payrollRecords,
                      employees,
                      branches,
                      filterBranchId: inspectingBranch.id,
                    });
                    addToast('success', 'Xuất Excel', `Đã tải xuống bảng lương riêng của ${inspectingBranch.name}`);
                  }}
                >
                  Xuất Báo Cáo Riêng Chi Nhánh Này
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileSpreadsheet size={13} className="text-emerald-700" />}
                  onClick={() => {
                    exportPayrollExcel({
                      payrollRecords,
                      employees,
                      branches,
                      filterBranchId: 'ALL',
                    });
                    addToast('success', 'Xuất Excel', 'Đã tải xuống bảng lương tổng hợp toàn bộ hệ thống');
                  }}
                >
                  Xuất Tổng Hợp Toàn Hệ Thống
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsInspectModalOpen(false);
                  setInspectingBranch(null);
                }}
              >
                Đóng
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* KPI Cards for this specific branch */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-zinc-200 p-2.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Nhân Sự Trực Thuộc</span>
                <p className="text-base font-bold font-mono text-zinc-900 mt-1">
                  {employees.filter((e) => e.branchId === inspectingBranch.id).length} NV
                </p>
              </div>
              <div className="bg-slate-50 border border-zinc-200 p-2.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Quỹ Lương Tuần 42</span>
                <p className="text-base font-bold font-mono text-zinc-900 mt-1">
                  {formatVND(
                    payrollRecords
                      .filter((p) => p.branchId === inspectingBranch.id)
                      .reduce((acc, p) => acc + p.totalPay, 0)
                  )}
                </p>
              </div>
              <div className="bg-slate-50 border border-zinc-200 p-2.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Giờ Đã Chốt (T2-T5)</span>
                <p className="text-base font-bold font-mono text-emerald-700 mt-1">
                  {payrollRecords
                    .filter((p) => p.branchId === inspectingBranch.id)
                    .reduce((acc, p) => acc + p.completedHours, 0)
                    .toFixed(1)}h
                </p>
              </div>
              <div className="bg-slate-50 border border-zinc-200 p-2.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Định Mức Công Chuẩn</span>
                <p className="text-base font-bold font-mono text-zinc-900 mt-1">
                  {inspectingBranch.standardMonthlyHours}h/tháng
                </p>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex border-b border-zinc-200 gap-1 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setInspectSubTab('overview')}
                className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                  inspectSubTab === 'overview'
                    ? 'bg-white border-zinc-300 text-zinc-900 shadow-2xs'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                1. Thông Tin & Quản Trị Viên
              </button>
              <button
                type="button"
                onClick={() => setInspectSubTab('staff')}
                className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                  inspectSubTab === 'staff'
                    ? 'bg-white border-zinc-300 text-zinc-900 shadow-2xs'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                2. Danh Sách Nhân Sự ({employees.filter((e) => e.branchId === inspectingBranch.id).length})
              </button>
              <button
                type="button"
                onClick={() => setInspectSubTab('payroll')}
                className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                  inspectSubTab === 'payroll'
                    ? 'bg-white border-zinc-300 text-zinc-900 shadow-2xs'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                3. Bảng Lương Chi Nhánh
              </button>
            </div>

            {/* Sub-tab 1: Overview */}
            {inspectSubTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white border border-zinc-200 p-3.5">
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 uppercase text-[11px] border-b border-zinc-200 pb-1">
                    Thông Tin Cơ Sở Chi Nhánh
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <p><span className="text-zinc-500">Mã chi nhánh:</span> <strong className="font-mono">{inspectingBranch.code}</strong></p>
                    <p><span className="text-zinc-500">Tên chi nhánh:</span> <strong>{inspectingBranch.name}</strong></p>
                    <p><span className="text-zinc-500">Địa chỉ:</span> {inspectingBranch.address || 'Chưa cập nhật'}</p>
                    <p><span className="text-zinc-500">Số điện thoại hotline:</span> <span className="font-mono">{inspectingBranch.phone || 'Chưa cập nhật'}</span></p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 uppercase text-[11px] border-b border-zinc-200 pb-1">
                    Tài Khoản Quản Lý Chi Nhánh (Cung Cấp Bởi Admin Tổng)
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <p><span className="text-zinc-500">Người quản lý:</span> <strong>{inspectingBranch.adminName || 'Chưa thiết lập'}</strong></p>
                    <p><span className="text-zinc-500">Tên đăng nhập:</span> <code className="bg-slate-100 px-1 py-0.5 border border-zinc-300 font-bold">{inspectingBranch.adminUsername || 'N/A'}</code></p>
                    <p><span className="text-zinc-500">Email nhận thông báo:</span> <span className="font-mono">{inspectingBranch.adminEmail || 'N/A'}</span></p>
                    <p><span className="text-zinc-500">Hạn mức OFF:</span> Full-time tối đa <strong className="font-mono">{inspectingBranch.maxFulltimeOffDays}</strong> ngày/tháng • Part-time tối đa <strong className="font-mono">{inspectingBranch.maxParttimeOffDays}</strong> ngày/tháng</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Staff */}
            {inspectSubTab === 'staff' && (
              <div className="bg-white border border-zinc-200 overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-zinc-200 text-zinc-600 font-mono text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="p-2">Mã NV</th>
                      <th className="p-2">Họ và Tên</th>
                      <th className="p-2 text-center">Giới tính</th>
                      <th className="p-2">Loại HĐ</th>
                      <th className="p-2">Kỹ năng đảm nhiệm</th>
                      <th className="p-2 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {employees
                      .filter((e) => e.branchId === inspectingBranch.id)
                      .map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-zinc-900">{emp.employeeCode}</td>
                          <td className="p-2 font-medium text-zinc-900">{emp.name}</td>
                          <td className="p-2 text-center font-mono">
                            <span className={emp.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}>
                              {emp.gender === 'male' ? 'Nam' : 'Nữ'}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-zinc-600">
                            {emp.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {emp.skills.map((sId) => {
                                const r = roles.find((role) => role.id === sId || role.code === sId.split('-')[1]);
                                return (
                                  <span key={sId} className="px-1.5 py-0.2 bg-slate-100 border border-zinc-200 text-[10px] font-mono">
                                    {r?.name || sId}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-2 text-center font-mono">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px]">
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {employees.filter((e) => e.branchId === inspectingBranch.id).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-400">
                          Chi nhánh chưa có nhân sự nào được thêm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub-tab 3: Payroll */}
            {inspectSubTab === 'payroll' && (
              <div className="bg-white border border-zinc-200 overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-zinc-200 text-zinc-600 font-mono text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="p-2">Mã NV</th>
                      <th className="p-2">Họ và Tên</th>
                      <th className="p-2 text-right">Giờ Thực Tế</th>
                      <th className="p-2 text-right">Giờ Dự Kiến</th>
                      <th className="p-2 text-right">Giờ OT</th>
                      <th className="p-2 text-right font-bold">Tổng Lương</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono">
                    {payrollRecords
                      .filter((p) => p.branchId === inspectingBranch.id)
                      .map((rec) => {
                        const emp = employees.find((e) => e.id === rec.userId);
                        return (
                          <tr key={rec.userId} className="hover:bg-slate-50">
                            <td className="p-2 text-zinc-600">{emp?.employeeCode}</td>
                            <td className="p-2 font-sans font-medium text-zinc-900">{emp?.name}</td>
                            <td className="p-2 text-right text-emerald-700 font-bold">{rec.completedHours.toFixed(1)}h</td>
                            <td className="p-2 text-right text-blue-700">{rec.projectedHours.toFixed(1)}h</td>
                            <td className="p-2 text-right text-purple-700 font-bold">{rec.otHours.toFixed(1)}h</td>
                            <td className="p-2 text-right font-bold text-zinc-900 bg-slate-50">{formatVND(rec.totalPay)}</td>
                          </tr>
                        );
                      })}
                    {payrollRecords.filter((p) => p.branchId === inspectingBranch.id).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-400">
                          Chưa có dữ liệu bảng lương cho chi nhánh này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CÀI ĐẶT & CHỈNH SỬA THÔNG TIN CÁ NHÂN / TÀI KHOẢN ADMIN TỔNG       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        title="CÀI ĐẶT THÔNG TIN TÀI KHOẢN ADMIN TỔNG (SUPER ADMIN)"
        subtitle="Cập nhật hồ sơ cá nhân, tài khoản đăng nhập và mật khẩu bảo mật của Admin Tổng (đồng bộ trực tiếp lên Neon PostgreSQL)"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveAdminSettings} className="space-y-4 text-xs">
          <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-900 flex items-start gap-2.5">
            <ShieldCheck size={17} className="shrink-0 mt-0.5 text-purple-700" />
            <div className="space-y-0.5">
              <div className="font-bold text-purple-900">Hồ sơ Quản Trị Hệ Thống Cao Nhất (Super Admin)</div>
              <p className="text-[11px] text-purple-800/90 leading-relaxed">
                Mọi thay đổi về họ tên, tài khoản đăng nhập (username), email và mật khẩu của Admin Tổng sẽ được lưu trữ vĩnh viễn trên cơ sở dữ liệu đám mây Neon PostgreSQL và có hiệu lực ngay lập tức trên mọi thiết bị.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CỘT 1: HỒ SƠ CÁ NHÂN ADMIN TỔNG */}
            <div className="space-y-3 border-r md:pr-4 border-zinc-200">
              <h4 className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200">
                1. Thông Tin Cá Nhân Admin Tổng
              </h4>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Họ và Tên Admin Tổng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Minh Quân (Admin Tổng)"
                  value={saName}
                  onChange={(e) => setSaName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Mã Định Danh</label>
                  <input
                    type="text"
                    placeholder="ADM-000"
                    value={saEmployeeCode}
                    onChange={(e) => setSaEmployeeCode(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg font-mono text-xs uppercase focus:bg-white focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Giới Tính</label>
                  <select
                    value={saGender}
                    onChange={(e) => setSaGender(e.target.value as 'male' | 'female')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Ngày Sinh</label>
                <input
                  type="date"
                  value={saDob}
                  onChange={(e) => setSaDob(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg font-mono text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Số Điện Thoại Liên Hệ</label>
                <input
                  type="text"
                  placeholder="0909 xxx xxx"
                  value={saPhone}
                  onChange={(e) => setSaPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg font-mono text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            {/* CỘT 2: THÔNG TIN ĐĂNG NHẬP & BẢO MẬT */}
            <div className="space-y-3">
              <h4 className="font-bold font-mono text-zinc-900 uppercase text-[11px] pb-1 border-b border-zinc-200">
                2. Tài Khoản Đăng Nhập & Mật Khẩu
              </h4>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Tên Đăng Nhập (Username) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="admin.tong"
                  value={saUsername}
                  onChange={(e) => setSaUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg font-mono text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Email Quản Trị Hệ Thống <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin.tong@company.com"
                  value={saEmail}
                  onChange={(e) => setSaEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg font-mono text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">
                  Đổi Mật Khẩu Mới <span className="text-zinc-400 font-normal">(Để trống nếu giữ nguyên mật khẩu cũ)</span>
                </label>
                <div className="relative">
                  <input
                    type={showSaPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu mới nếu muốn thay đổi..."
                    value={saNewPassword}
                    onChange={(e) => setSaNewPassword(e.target.value)}
                    className="w-full pl-2.5 pr-9 py-1.5 bg-slate-50 border border-zinc-300 rounded-lg font-mono text-xs focus:bg-white focus:outline-none focus:border-purple-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSaPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    title={showSaPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showSaPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-zinc-200 rounded-lg text-[11px] text-zinc-600 space-y-1">
                <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                  <Key size={12} className="text-purple-600" />
                  <span>Ghi chú bảo mật Bcrypt:</span>
                </div>
                <p>
                  Nếu bạn nhập mật khẩu mới, hệ thống sẽ tự động mã hóa <strong>Bcrypt</strong> và cập nhật trực tiếp lên Neon PostgreSQL. Bạn có thể đăng nhập bằng cả Username hoặc Email.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <Button variant="ghost" size="sm" onClick={() => setIsAdminSettingsOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Check size={14} />}>
              Lưu Thông Tin Admin Tổng
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
