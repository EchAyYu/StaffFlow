import { Branch, Employee, PayrollRecord, WeeklySchedule, BusinessRole, LineConfig } from '../types';
import { formatVND } from './formatters';

// Helper to trigger browser download for CSV with UTF-8 BOM
export function downloadCSV(filename: string, csvContent: string) {
  // UTF-8 BOM (\uFEFF) ensures Microsoft Excel displays Vietnamese diacritics correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 1. XUẤT BẢNG LƯƠNG THỐNG KÊ (PAYROLL EXCEL)
export function exportPayrollExcel(options: {
  payrollRecords: PayrollRecord[];
  employees: Employee[];
  branches: Branch[];
  filterBranchId?: string; // 'ALL' or specific branchId
}) {
  const { payrollRecords, employees, branches, filterBranchId } = options;

  const filteredRecords = filterBranchId && filterBranchId !== 'ALL'
    ? payrollRecords.filter((p) => p.branchId === filterBranchId)
    : payrollRecords;

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const headers = [
    'Mã Chi Nhánh',
    'Tên Chi Nhánh',
    'Mã Nhân Viên',
    'Họ và Tên',
    'Loại Hợp Đồng',
    'Giờ Thực Tế Đã Làm (h)',
    'Giờ Dự Kiến Còn Lại (h)',
    'Giờ Làm Thêm OT (h)',
    'Hệ Số OT',
    'Lương Cơ Bản (VNĐ)',
    'Lương OT (VNĐ)',
    'Khấu Trừ / Phạt (VNĐ)',
    'Tổng Lương Thực Nhận (VNĐ)',
    'Trạng Thái Chốt',
  ];

  const rows = filteredRecords.map((rec) => {
    const branch = branchMap.get(rec.branchId);
    const emp = empMap.get(rec.userId);
    return [
      `"${branch?.code || rec.branchId}"`,
      `"${branch?.name || ''}"`,
      `"${emp?.employeeCode || rec.userId}"`,
      `"${emp?.name || ''}"`,
      `"${emp?.employmentType === 'full_time' ? 'Toàn thời gian (Full-time)' : 'Bán thời gian (Part-time)'}"`,
      rec.completedHours.toFixed(1),
      rec.projectedHours.toFixed(1),
      rec.otHours.toFixed(1),
      `${rec.otMultiplier}x`,
      Math.round(rec.basePay),
      Math.round(rec.otPay),
      Math.round(rec.shortageDeduction),
      Math.round(rec.totalPay),
      `"${rec.status === 'finalized' ? 'Đã Quyết Toán' : 'Bản Nháp (Dự Toán)'}"`,
    ].join(',');
  });

  // Calculate summary row
  const totalCompleted = filteredRecords.reduce((acc, r) => acc + r.completedHours, 0);
  const totalProjected = filteredRecords.reduce((acc, r) => acc + r.projectedHours, 0);
  const totalOT = filteredRecords.reduce((acc, r) => acc + r.otHours, 0);
  const totalBasePay = filteredRecords.reduce((acc, r) => acc + r.basePay, 0);
  const totalOTPay = filteredRecords.reduce((acc, r) => acc + r.otPay, 0);
  const grandTotal = filteredRecords.reduce((acc, r) => acc + r.totalPay, 0);

  const summaryRow = [
    '"TỔNG CỘNG"',
    '""',
    '""',
    `"${filteredRecords.length} Nhân sự"`,
    '""',
    totalCompleted.toFixed(1),
    totalProjected.toFixed(1),
    totalOT.toFixed(1),
    '""',
    Math.round(totalBasePay),
    Math.round(totalOTPay),
    '0',
    Math.round(grandTotal),
    '""',
  ].join(',');

  const csvContent = [headers.join(','), ...rows, summaryRow].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  const branchSuffix = filterBranchId && filterBranchId !== 'ALL' ? `_${filterBranchId}` : '_Toan_He_Thong';
  downloadCSV(`Bang_Luong_Thong_Ke${branchSuffix}_${dateStr}.csv`, csvContent);
}

// 2. XUẤT BÁO CÁO NHÂN SỰ TOÀN HỆ THỐNG / CHI NHÁNH
export function exportStaffExcel(options: {
  employees: Employee[];
  branches: Branch[];
  roles: BusinessRole[];
  filterBranchId?: string;
}) {
  const { employees, branches, roles, filterBranchId } = options;

  const filteredEmployees = filterBranchId && filterBranchId !== 'ALL'
    ? employees.filter((e) => e.branchId === filterBranchId)
    : employees;

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const roleMap = new Map(roles.map((r) => [r.id, r]));

  const headers = [
    'Mã Chi Nhánh',
    'Tên Chi Nhánh',
    'Mã Nhân Viên',
    'Họ và Tên',
    'Tài Khoản Đăng Nhập',
    'Email Liên Hệ',
    'Số Điện Thoại',
    'Giới Tính',
    'Ngày Sinh',
    'Ngày Vào Làm',
    'Phân Loại Hợp Đồng',
    'Vai Trò Hệ Thống',
    'Các Kỹ Năng Đảm Nhiệm',
    'Trạng Thái',
  ];

  const rows = filteredEmployees.map((emp) => {
    const branch = branchMap.get(emp.branchId);
    const skillNames = emp.skills.map((sId) => roleMap.get(sId)?.name || sId).join('; ');
    return [
      `"${branch?.code || emp.branchId}"`,
      `"${branch?.name || ''}"`,
      `"${emp.employeeCode}"`,
      `"${emp.name}"`,
      `"${emp.username}"`,
      `"${emp.email}"`,
      `"${emp.phone || ''}"`,
      `"${emp.gender === 'male' ? 'Nam' : 'Nữ'}"`,
      `"${emp.dob}"`,
      `"${emp.joinedDate}"`,
      `"${emp.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}"`,
      `"${emp.roleType === 'super_admin' ? 'Admin Tổng' : emp.roleType === 'branch_admin' ? 'Admin Chi Nhánh' : 'Nhân Viên'}"`,
      `"${skillNames}"`,
      `"${emp.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  const branchSuffix = filterBranchId && filterBranchId !== 'ALL' ? `_${filterBranchId}` : '_Toan_He_Thong';
  downloadCSV(`Danh_Sach_Nhan_Su${branchSuffix}_${dateStr}.csv`, csvContent);
}

// 3. XUẤT DANH SÁCH CHI NHÁNH & TÀI KHOẢN ADMIN CHI NHÁNH
export function exportBranchesExcel(branches: Branch[]) {
  const headers = [
    'Mã Chi Nhánh',
    'Tên Chi Nhánh',
    'Địa Chỉ',
    'Số Điện Thoại',
    'Họ Tên Admin Chi Nhánh',
    'Tài Khoản Đăng Nhập Admin',
    'Mật Khẩu Cung Cấp',
    'Email Admin',
    'Định Mức Giờ/Tháng (h)',
    'Max Ngày Nghỉ FT',
    'Max Ngày Nghỉ PT',
    'Quyền Quản Trị',
  ];

  const rows = branches.map((b) => [
    `"${b.code}"`,
    `"${b.name}"`,
    `"${b.address}"`,
    `"${b.phone}"`,
    `"${b.adminName || 'Chưa thiết lập'}"`,
    `"${b.adminUsername || 'Chưa thiết lập'}"`,
    `"${b.adminPassword || '********'}"`,
    `"${b.adminEmail || ''}"`,
    b.standardMonthlyHours,
    b.maxFulltimeOffDays,
    b.maxParttimeOffDays,
    '"Do Admin Tổng kiểm soát và phân quyền"',
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCSV(`Danh_Sach_Chi_Nhanh_Va_Tai_Khoan_Admin_${dateStr}.csv`, csvContent);
}

// 4. XUẤT BÁO CÁO LỊCH CA & TÌNH HÌNH THIẾU HỤT NHÂN SỰ
export function exportScheduleReportExcel(options: {
  schedule: WeeklySchedule;
  branches: Branch[];
  roles: BusinessRole[];
  employees: Employee[];
  lineConfigs: LineConfig[];
}) {
  const { schedule, branches, roles, employees, lineConfigs } = options;
  const branch = branches.find((b) => b.id === schedule.branchId);
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const lineMap = new Map(lineConfigs.map((l) => [l.lineCode, l]));

  const headers = [
    'Mã Chi Nhánh',
    'Tên Chi Nhánh',
    'Tuần',
    'Thứ',
    'Line Ca',
    'Khung Giờ Ca',
    'Vị Trí Phân Công',
    'Nhân Viên Đảm Nhiệm',
    'Tình Trạng',
    'Ghi Chú Override',
  ];

  const dayTranslations: Record<string, string> = {
    monday: 'Thứ 2',
    tuesday: 'Thứ 3',
    wednesday: 'Thứ 4',
    thursday: 'Thứ 5',
    friday: 'Thứ 6',
    saturday: 'Thứ 7',
    sunday: 'Chủ Nhật',
  };

  const rows = schedule.assignments.map((a) => {
    const role = roleMap.get(a.roleId);
    const emp = a.userId ? empMap.get(a.userId) : null;
    const line = lineMap.get(a.lineCode);
    const dayLabel = dayTranslations[a.day] || a.day;
    const timeSlot = line ? `${line.startTime} - ${line.endTime}` : '';

    return [
      `"${branch?.code || schedule.branchId}"`,
      `"${branch?.name || ''}"`,
      `"${schedule.weekStartDate} đến ${schedule.weekEndDate}"`,
      `"${dayLabel}"`,
      `"Line ${a.lineCode}"`,
      `"${timeSlot}"`,
      `"${role?.name || a.roleId}"`,
      `"${emp ? emp.name : 'TRỐNG (Chưa xếp được)'}"`,
      `"${emp ? 'Đã xếp nhân sự' : 'CẢNH BÁO: Thiếu nhân sự'}"`,
      `"${a.isOverride ? `Đề xuất Override: ${a.overrideReason || ''}` : ''}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCSV(`Bao_Cao_Lich_Lam_${branch?.code || 'ChiNhanh'}_${dateStr}.csv`, csvContent);
}
