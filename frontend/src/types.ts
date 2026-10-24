// ============================================================================
// STAFFFLOW ENTERPRISE — CORE DOMAIN TYPES & SPECIFICATION INTERFACES
// ============================================================================

export type RoleType = 'super_admin' | 'branch_admin' | 'employee';

export type EmploymentType = 'full_time' | 'part_time';

export type Gender = 'male' | 'female';

export type GenderRequirement = 'any' | 'male_only' | 'female_only';

export type LineCode = 'O' | 'M' | 'D'; // O = Open, M = Mid, D = Down

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type AvailabilityChoice = 'O' | 'M' | 'D' | 'O_M' | 'O_D' | 'M_D' | 'A' | 'OFF';

export type ScheduleStatus = 'draft' | 'published' | 'changed';

export type ShiftRequestType = 'swap' | 'sale' | 'leave'; // Đổi ca | Bán ca | Xin nghỉ thêm vượt hạn mức

export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected';

export type PeerHandshakeStatus = 'waiting_peer' | 'peer_accepted' | 'peer_declined' | 'not_required';

// 1. Chi Nhánh (Branch)
export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  standardMonthlyHours: number; // e.g. 208h/month for Full-time
  maxFulltimeOffDays: number;   // e.g. 4 days/month
  maxParttimeOffDays: number;   // e.g. 8 days/month
  // Thông tin tài khoản Admin Chi Nhánh do Admin Tổng cấp & quản lý:
  adminName?: string;
  adminUsername?: string;
  adminPassword?: string;
  adminEmail?: string;
}

export type SalaryPolicy = 'fixed_role_rate' | 'employee_seniority_rate';

// 2. Vai Trò & Chuyên Môn (Role / Position)
export interface BusinessRole {
  id: string;
  branchId: string;
  code: string; // SEC, BAR, SRV, KIT, INV
  name: string; // Bảo Vệ, Pha Chế, Phục Vụ, Bếp, Soạn Hàng
  description?: string;
  genderRequirement: GenderRequirement; // male_only for Bảo vệ
  defaultHourlyRate: number; // VND per hour
  isSystemDefault?: boolean;
  salaryCalculationType?: SalaryPolicy; // 'fixed_role_rate' (Bếp, Soạn Hàng) | 'employee_seniority_rate' (Bảo Vệ, Phục Vụ, Pha Chế)
}

// 3. Nhân Viên (Employee Profile)
export interface Employee {
  id: string;
  branchId: string;
  employeeCode: string; // e.g. EMP-001
  name: string;
  email: string;
  username: string;
  roleType: RoleType;
  gender: Gender;
  dob: string;        // Ngày sinh: YYYY-MM-DD
  joinedDate: string; // Ngày vào làm: YYYY-MM-DD
  employmentType: EmploymentType; // Full-time | Part-time
  skills: string[];   // Array of Role IDs (e.g. ['ROLE-BAR-01', 'ROLE-SRV-01'])
  wageRates: Record<string, number>; // Custom wage per roleId: { 'ROLE-BAR-01': 55000 }
  baseHourlyRate?: number; // Mức lương cá nhân theo thâm niên (VNĐ/giờ) - Áp dụng cho vai trò linh hoạt
  status: 'active' | 'inactive';
  phone?: string;
  password?: string;
}

// 4. Cấu Hình Line (O - Open, M - Mid, D - Down)
export interface LineConfig {
  id: string;
  branchId: string;
  lineCode: LineCode;
  lineName: string;
  startTime: string; // "05:30"
  endTime: string;   // "12:00"
  durationHours: number; // 6.5
  description: string;
}

// 5. Yêu Cầu Nhân Sự Theo Line (Headcount Requirement)
export interface LineRequirement {
  id: string;
  branchId: string;
  lineCode: LineCode;
  roleId: string;
  headcountRequired: number; // Số lượng người cần
}

// 6. Đăng Ký Khả Dụng (Availability Registration)
export interface AvailabilityRegistration {
  id: string;
  userId: string;
  branchId: string;
  weekStartDate: string; // "2026-10-19"
  slots: Record<DayOfWeek, AvailabilityChoice>; // Mon -> 'O', Tue -> 'M', etc.
  dayCustomHours?: Partial<Record<DayOfWeek, string>>; // e.g. "06:00 - 10:00" hoặc "Chỉ rảnh đến 10:00"
  note?: string;
  submittedAt: string;
}

// 7. Phân Công Vị Trí Ca (Shift Assignment)
export interface ShiftAssignment {
  id: string;
  scheduleId: string;
  branchId?: string;
  day: DayOfWeek;
  lineCode: LineCode;
  roleId: string;
  slotIndex: number;
  userId: string | null; // null if unassigned
  customStartTime?: string;
  customEndTime?: string;
  isOverride?: boolean;
  overrideReason?: string;
  isCompleted?: boolean; // Past days automatically marked as completed for payroll!
}

// 8. Cảnh Báo Thiếu Nhân Sự (Shortage Alert)
export interface ShortageWarning {
  id: string;
  day: DayOfWeek;
  lineCode: LineCode;
  roleId: string;
  missingCount: number;
}

// 9. Đề Xuất Override (Override Proposal)
export interface OverrideProposal {
  assignmentId: string;
  day: DayOfWeek;
  lineCode: LineCode;
  roleId: string;
  proposedUserId: string;
  proposedUserName: string;
  reason: string;
  requiresAdminConfirm: boolean;
}

// 10. Lịch Tuần (Weekly Schedule: Draft -> Published -> Changed)
export interface WeeklySchedule {
  id: string;
  branchId: string;
  weekStartDate: string;
  weekEndDate: string;
  status: ScheduleStatus;
  version: number;
  publishedAt?: string;
  publishedBy?: string;
  lastModifiedAt?: string;
  assignments: ShiftAssignment[];
  shortageWarnings: ShortageWarning[];
  overrideProposals: OverrideProposal[];
}

// 11. Phiếu Đổi Ca & Bán Ca (Shift Requests: Swap & Sale)
export interface ShiftRequest {
  id: string;
  branchId: string;
  requestType: ShiftRequestType; // 'swap' (Đổi ca) | 'sale' (Bán ca) | 'leave' (Nghỉ thêm)
  assignmentId?: string; // ID ca làm việc thực tế được đổi/bán
  roleId?: string;       // ID vai trò/chuyên môn của ca (Bảo Vệ, Bếp, Pha Chế, v.v.)
  requesterId: string;
  requesterName: string;
  targetUserId?: string; // Người đổi cùng hoặc người mua/làm thay
  targetUserName?: string;
  day: DayOfWeek;
  lineCode?: LineCode;
  customStartTime?: string;
  customEndTime?: string;
  targetDay?: DayOfWeek;
  targetLineCode?: LineCode;
  reason: string;
  status: ShiftRequestStatus; // 'pending' | 'approved' | 'rejected'
  reviewerId?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  isOpenMarket?: boolean; // Mở bán công khai trên Chợ Ca cho toàn chi nhánh
  claimedByUserId?: string; // Đồng nghiệp đã bấm nhận ca trên chợ ca (chờ Admin duyệt)
  claimedByUserName?: string;
  peerStatus?: PeerHandshakeStatus; // Cơ chế xác nhận 2 bước từ đồng nghiệp (Peer Handshake)
  peerRespondedAt?: string;         // Thời điểm đồng nghiệp xác nhận
}

// 12. Bảng Tính Lương & Giờ Làm (Payroll)
export interface PayrollRecord {
  userId: string;
  employeeCode: string;
  name: string;
  branchId: string;
  employmentType: EmploymentType;
  completedHours: number; // Giờ đã làm thực tế từ các ngày đã kết thúc
  projectedHours: number; // Giờ dự kiến từ các ca còn lại trong tuần
  otHours: number;        // Giờ OT do Admin chi nhánh nhập
  otMultiplier: number;   // Hệ số OT (1.5x)
  basePay: number;        // Tiền lương theo giờ & role
  otPay: number;          // Tiền tăng ca
  shortageDeduction: number; // Khấu trừ nếu Full-time thiếu giờ chuẩn
  totalPay: number;       // Tổng thu nhập
  status: 'draft' | 'finalized';
}

// 13. Audit Log (Lịch Sử Thay Đổi Nghiệp Vụ)
export interface AuditLog {
  id: string;
  branchId: string;
  actorName: string;
  actionType: string;
  entityType: string;
  details: string;
  timestamp: string;
}

export interface DayInfo {
  key: DayOfWeek;
  shortLabel: string;
  label: string;
  dateStr: string;
  fullDate: string;
  isPast: boolean; // Flag indicating if this day is ended
}
