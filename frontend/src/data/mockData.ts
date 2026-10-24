import {
  Branch,
  BusinessRole,
  Employee,
  LineConfig,
  LineRequirement,
  AvailabilityRegistration,
  WeeklySchedule,
  ShiftRequest,
  AuditLog,
} from '../types';
import { CURRENT_WEEK_START, CURRENT_WEEK_END } from '../utils/formatters';

// 1. CHI NHÁNH — BAN ĐẦU TRẮNG HOÀN TOÀN (Admin Tổng sẽ tạo mới)
export const MOCK_BRANCHES: Branch[] = [];

// 2. VAI TRÒ & KỸ NĂNG CHUẨN CỦA HỆ THỐNG (Tối thiểu trong phần thiết lập để chi nhánh sử dụng và chỉnh sửa)
export const MOCK_ROLES: BusinessRole[] = [
  {
    id: 'ROLE-SEC-01',
    branchId: '',
    code: 'SEC',
    name: 'Bảo Vệ',
    description: 'An ninh trật tự, dắt xe và hướng dẫn khách hàng (Chỉ Nam)',
    genderRequirement: 'male_only', // Hard constraint: Nữ không được xếp vai trò này
    defaultHourlyRate: 35000,
    isSystemDefault: true,
    salaryCalculationType: 'employee_seniority_rate',
  },
  {
    id: 'ROLE-BAR-01',
    branchId: '',
    code: 'BAR',
    name: 'Pha Chế',
    description: 'Barista chuyên pha chế trà sữa, cà phê và thức uống',
    genderRequirement: 'any',
    defaultHourlyRate: 55000,
    isSystemDefault: true,
    salaryCalculationType: 'employee_seniority_rate',
  },
  {
    id: 'ROLE-SRV-01',
    branchId: '',
    code: 'SRV',
    name: 'Phục Vụ',
    description: 'Tiếp khách, nhận order tại bàn, phục vụ món và dọn dẹp',
    genderRequirement: 'any',
    defaultHourlyRate: 45000,
    isSystemDefault: true,
    salaryCalculationType: 'employee_seniority_rate',
  },
  {
    id: 'ROLE-KIT-01',
    branchId: '',
    code: 'KIT',
    name: 'Bếp',
    description: 'Chuẩn bị bánh mì, món ăn nhẹ, topping và nguyên liệu tươi',
    genderRequirement: 'any',
    defaultHourlyRate: 50000,
    isSystemDefault: true,
    salaryCalculationType: 'fixed_role_rate', // Vị trí cố định lương bếp
  },
  {
    id: 'ROLE-INV-01',
    branchId: '',
    code: 'INV',
    name: 'Soạn Hàng',
    description: 'Kiểm kê, xuất nhập kho và đóng gói hàng giao',
    genderRequirement: 'any',
    defaultHourlyRate: 46000,
    isSystemDefault: true,
    salaryCalculationType: 'fixed_role_rate', // Vị trí cố định lương soạn hàng
  },
];

// 3. CẤU HÌNH 3 LINE CHUẨN CỦA HỆ THỐNG (O / M / D)
export const MOCK_LINE_CONFIGS: LineConfig[] = [
  {
    id: 'LINE-O',
    branchId: '',
    lineCode: 'O',
    lineName: 'Line O — Open (Ca Mở Cửa / Sáng)',
    startTime: '05:30',
    endTime: '12:00',
    durationHours: 6.5,
    description: 'Mở cửa quầy, nhận giao nhận nguyên liệu đá tươi và phục vụ khách sáng',
  },
  {
    id: 'LINE-M',
    branchId: '',
    lineCode: 'M',
    lineName: 'Line M — Mid (Ca Giữa / Trưa)',
    startTime: '11:00',
    endTime: '18:00',
    durationHours: 7.0,
    description: 'Khung giờ giao lưu trưa, tiếp đón khách văn phòng và bàn ăn',
  },
  {
    id: 'LINE-D',
    branchId: '',
    lineCode: 'D',
    lineName: 'Line D — Down (Ca Tối / Đóng Cửa)',
    startTime: '17:00',
    endTime: '23:30',
    durationHours: 6.5,
    description: 'Khung giờ cao điểm tối, vệ sinh máy pha và đóng quầy kiểm kê',
  },
];

// 4. ĐỊNH MỨC NHÂN SỰ GỢI Ý THEO LINE (Headcount Requirements mẫu)
export const MOCK_LINE_REQUIREMENTS: LineRequirement[] = [
  // Line O: 1 Bảo Vệ + 1 Pha Chế + 1 Phục Vụ + 1 Bếp
  { id: 'REQ-O-SEC', branchId: '', lineCode: 'O', roleId: 'ROLE-SEC-01', headcountRequired: 1 },
  { id: 'REQ-O-BAR', branchId: '', lineCode: 'O', roleId: 'ROLE-BAR-01', headcountRequired: 1 },
  { id: 'REQ-O-SRV', branchId: '', lineCode: 'O', roleId: 'ROLE-SRV-01', headcountRequired: 1 },
  { id: 'REQ-O-KIT', branchId: '', lineCode: 'O', roleId: 'ROLE-KIT-01', headcountRequired: 1 },

  // Line M: 1 Bảo Vệ + 1 Pha Chế + 1 Phục Vụ + 1 Soạn Hàng
  { id: 'REQ-M-SEC', branchId: '', lineCode: 'M', roleId: 'ROLE-SEC-01', headcountRequired: 1 },
  { id: 'REQ-M-BAR', branchId: '', lineCode: 'M', roleId: 'ROLE-BAR-01', headcountRequired: 1 },
  { id: 'REQ-M-SRV', branchId: '', lineCode: 'M', roleId: 'ROLE-SRV-01', headcountRequired: 1 },
  { id: 'REQ-M-INV', branchId: '', lineCode: 'M', roleId: 'ROLE-INV-01', headcountRequired: 1 },

  // Line D: 1 Bảo Vệ + 2 Pha Chế + 1 Phục Vụ
  { id: 'REQ-D-SEC', branchId: '', lineCode: 'D', roleId: 'ROLE-SEC-01', headcountRequired: 1 },
  { id: 'REQ-D-BAR', branchId: '', lineCode: 'D', roleId: 'ROLE-BAR-01', headcountRequired: 2 },
  { id: 'REQ-D-SRV', branchId: '', lineCode: 'D', roleId: 'ROLE-SRV-01', headcountRequired: 1 },
];

// 5. DANH SÁCH NHÂN SỰ — DUY NHẤT ADMIN TỔNG (TRẮNG HOÀN TOÀN NHÂN SỰ CHI NHÁNH)
export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'USR-SUPER-01',
    branchId: '',
    employeeCode: 'ADM-ALL',
    name: 'Trần Minh Tuấn (Admin Tổng)',
    email: 'admin.tong@company.com',
    username: 'admin.tong',
    password: 'Admin@2026',
    roleType: 'super_admin',
    gender: 'male',
    dob: '1988-04-15',
    joinedDate: '2020-01-01',
    employmentType: 'full_time',
    skills: ['ROLE-SEC-01', 'ROLE-BAR-01', 'ROLE-SRV-01', 'ROLE-KIT-01', 'ROLE-INV-01'],
    wageRates: {},
    status: 'active',
    phone: '0901 000 001',
  },
];

// 6. ĐĂNG KÝ KHẢ DỤNG — TRẮNG HOÀN TOÀN
export const MOCK_REGISTRATIONS: AvailabilityRegistration[] = [];

// 7. PHIẾU ĐỔI / BÁN CA / NGHỈ PHÉP — TRẮNG HOÀN TOÀN
export const MOCK_SHIFT_REQUESTS: ShiftRequest[] = [];

// 8. NHẬT KÝ HOẠT ĐỘNG — TRẮNG HOÀN TOÀN
export const MOCK_AUDIT_LOGS: AuditLog[] = [];
