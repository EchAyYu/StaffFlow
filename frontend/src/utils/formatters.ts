import {
  DayInfo,
  DayOfWeek,
  LineCode,
  AvailabilityChoice,
  ScheduleStatus,
  ShiftRequestStatus,
  Employee,
  BusinessRole,
  ShiftAssignment,
} from '../types';

export const CURRENT_WEEK_START = '2026-10-19';
export const CURRENT_WEEK_END = '2026-10-25';

// 7 Days of the Week: Monday 19/10 to Sunday 25/10/2026
// Simulation: Monday, Tuesday, Wednesday, Thursday are PAST (Completed); Friday is TODAY; Sat/Sun are FUTURE
export const DAYS_OF_WEEK: DayInfo[] = [
  { key: 'monday', shortLabel: 'T2', label: 'Thứ Hai', dateStr: '19/10', fullDate: '2026-10-19', isPast: true },
  { key: 'tuesday', shortLabel: 'T3', label: 'Thứ Ba', dateStr: '20/10', fullDate: '2026-10-20', isPast: true },
  { key: 'wednesday', shortLabel: 'T4', label: 'Thứ Tư', dateStr: '21/10', fullDate: '2026-10-21', isPast: true },
  { key: 'thursday', shortLabel: 'T5', label: 'Thứ Năm', dateStr: '22/10', fullDate: '2026-10-22', isPast: true },
  { key: 'friday', shortLabel: 'T6 (Hôm nay)', label: 'Thứ Sáu', dateStr: '23/10', fullDate: '2026-10-23', isPast: false },
  { key: 'saturday', shortLabel: 'T7', label: 'Thứ Bảy', dateStr: '24/10', fullDate: '2026-10-24', isPast: false },
  { key: 'sunday', shortLabel: 'CN', label: 'Chủ Nhật', dateStr: '25/10', fullDate: '2026-10-25', isPast: false },
];

export const LINE_ORDER: LineCode[] = ['O', 'M', 'D'];

export const LINE_META: Record<LineCode, { label: string; shortName: string; timePeriod: string; defaultHours: number; color: string; badgeClass: string }> = {
  O: {
    label: 'Line O — Open (Mở cửa / Sáng)',
    shortName: 'Line O',
    timePeriod: '05:30 - 12:00',
    defaultHours: 6.5,
    color: 'amber',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  M: {
    label: 'Line M — Mid (Ca Giữa / Trưa)',
    shortName: 'Line M',
    timePeriod: '11:00 - 18:00',
    defaultHours: 7.0,
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
  },
  D: {
    label: 'Line D — Down (Ca Tối / Đóng Cửa)',
    shortName: 'Line D',
    timePeriod: '17:00 - 23:30',
    defaultHours: 6.5,
    color: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  },
};

// Availability choices definitions
export const AVAILABILITY_OPTIONS: Record<AvailabilityChoice, { label: string; desc: string; badgeClass: string; isOff: boolean }> = {
  O: {
    label: 'Line O (Sáng)',
    desc: 'Làm được ca mở cửa / sáng',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    isOff: false,
  },
  M: {
    label: 'Line M (Trưa)',
    desc: 'Làm được ca giữa / trưa',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    isOff: false,
  },
  D: {
    label: 'Line D (Tối)',
    desc: 'Làm được ca đóng cửa / tối',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    isOff: false,
  },
  O_M: {
    label: 'O, M (Sáng/Trưa)',
    desc: 'Sẵn sàng làm O hoặc M, hoặc cả O+M',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold',
    isOff: false,
  },
  O_D: {
    label: 'O, D (Sáng/Tối)',
    desc: 'Sẵn sàng làm ca sáng O và ca tối D (Ca gãy)',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
    isOff: false,
  },
  M_D: {
    label: 'M, D (Trưa/Tối)',
    desc: 'Sẵn sàng làm ca trưa M và ca tối D',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300 font-semibold',
    isOff: false,
  },
  A: {
    label: 'A (All / Mọi Line)',
    desc: 'Linh hoạt mọi ca O, M, D trong ngày',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    isOff: false,
  },
  OFF: {
    label: 'OFF (Nghỉ)',
    desc: 'Nghỉ ca — Scheduler không được xếp (Hard Constraint)',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold',
    isOff: true,
  },
};

export const SCHEDULE_STATUS_CONFIG: Record<ScheduleStatus, { label: string; badgeClass: string; desc: string }> = {
  draft: {
    label: 'BẢN NHÁP (DRAFT)',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    desc: 'Lịch vừa được Scheduler tạo. Admin chi nhánh có thể duyệt, thay người, xử lý thiếu ca trước khi công khai.',
  },
  published: {
    label: 'ĐÃ XUẤT BẢN (PUBLISHED)',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    desc: 'Lịch chính thức đã công khai. Nhân viên đã có thể xem. Chỉ Admin mới được can thiệp sửa đổi.',
  },
  changed: {
    label: 'ĐÃ ĐIỀU CHỈNH (CHANGED)',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    desc: 'Lịch đã xuất bản nhưng phát sinh điều chỉnh do sự cố hoặc duyệt đổi/bán ca. Có lưu vết lịch sử.',
  },
};

export const REQUEST_STATUS_CONFIG: Record<ShiftRequestStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: 'Chờ Quản Lý Duyệt',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'Đã Phê Duyệt',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  rejected: {
    label: 'Bị Từ Chối',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function makeAssignmentId(day: DayOfWeek, lineCode: LineCode, roleId: string, index: number): string {
  return `${day}_${lineCode}_${roleId}_${index}`;
}

export function calculateHoursBetween(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // Ca qua đêm
  }
  return Number((totalMinutes / 60).toFixed(1));
}

// ----------------------------------------------------------------------------
// SALARY & ROLE RATE POLICIES
// Bếp (KIT) & Soạn Hàng (INV) = Cố định theo vị trí (Fixed Role Rate)
// Bảo Vệ (SEC), Phục Vụ (SRV), Pha Chế (BAR) = Theo mức lương thâm niên cá nhân
// ----------------------------------------------------------------------------
export const SALARY_POLICY_META = {
  fixed_role_rate: {
    label: 'Cố định theo vị trí',
    shortName: 'Lương cố định vai trò',
    badgeClass: 'bg-amber-100/80 text-amber-900 border-amber-300 font-bold',
    desc: 'Cố định theo vai trò (Bếp, Soạn hàng): Nhân viên làm ca này nhận đúng đơn giá vị trí',
  },
  employee_seniority_rate: {
    label: 'Theo thâm niên nhân viên',
    shortName: 'Theo lương thâm niên',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 font-semibold',
    desc: 'Theo thâm niên nhân sự (Bảo vệ, Phục vụ, Pha chế): Hưởng theo mức lương cá nhân',
  },
};

export function isFixedRateRole(role?: { code?: string; salaryCalculationType?: string }): boolean {
  if (!role) return false;
  if (role.salaryCalculationType === 'fixed_role_rate') return true;
  if (role.salaryCalculationType === 'employee_seniority_rate') return false;
  if (role.code === 'KIT' || role.code === 'INV') return true;
  return false;
}

export function calculateShiftHourlyRate(
  role: { id?: string; code?: string; name?: string; defaultHourlyRate?: number; salaryCalculationType?: string } | undefined,
  employee: { id?: string; name?: string; baseHourlyRate?: number; wageRates?: Record<string, number> } | undefined
): { rate: number; isFixedRole: boolean; appliedPolicy: string } {
  const isFixed = isFixedRateRole(role);
  if (isFixed && role) {
    return {
      rate: role.defaultHourlyRate || 50000,
      isFixedRole: true,
      appliedPolicy: `Lương cố định vị trí ${role.name || role.code} (Đã ẩn lương thâm niên cá nhân)`,
    };
  }

  // Employee seniority rate (Hoàn toàn không phụ thuộc lương cố định vai trò)
  const empRate =
    employee?.baseHourlyRate ??
    (role?.id && employee?.wageRates?.[role.id] ? employee.wageRates[role.id] : undefined) ??
    30000;

  return {
    rate: empRate,
    isFixedRole: false,
    appliedPolicy: `Lương thâm niên (${employee?.name || 'NV'})`,
  };
}

// ----------------------------------------------------------------------------
// ENTERPRISE SHIFT EXCHANGE & SALE POLICY CONSTANTS (5 NGHIỆP VỤ NÂNG CAO)
// 1. Trần giờ làm tối đa: 48h/tuần (Chống quá tải lao động)
// 2. Khoảng nghỉ tối thiểu giữa 2 ca liên tiếp: >= 8h (Chặn "Clopening" Tối -> Sáng)
// 3. Hạn chót gửi phiếu trước giờ vào ca (Cut-off Lead Time): >= 4h
// 4. Xác nhận 2 bước từ đồng nghiệp (Peer Handshake: Đồng nghiệp đồng ý -> Admin duyệt)
// 5. Hạn mức bán ca trong tuần theo hợp đồng (Full-time: tối đa 2 ca, Part-time: tối đa 4 ca)
// ----------------------------------------------------------------------------
export const MAX_WEEKLY_HOURS_CAP = 48;
export const MIN_REST_PERIOD_HOURS = 8;
export const MIN_CUTOFF_LEAD_HOURS = 4;
export const MAX_FULLTIME_SALES_PER_WEEK = 2;
export const MAX_PARTTIME_SALES_PER_WEEK = 4;

const DAY_SEQUENCE: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function getAdjacentDays(day: DayOfWeek): { prevDay?: DayOfWeek; nextDay?: DayOfWeek } {
  const idx = DAY_SEQUENCE.indexOf(day);
  if (idx === -1) return {};
  return {
    prevDay: idx > 0 ? DAY_SEQUENCE[idx - 1] : undefined,
    nextDay: idx < DAY_SEQUENCE.length - 1 ? DAY_SEQUENCE[idx + 1] : undefined,
  };
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

export function doHoursOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  let s1 = timeToMinutes(start1);
  let e1 = timeToMinutes(end1);
  let s2 = timeToMinutes(start2);
  let e2 = timeToMinutes(end2);

  // Ca làm qua đêm (qua 24:00)
  if (e1 <= s1) e1 += 24 * 60;
  if (e2 <= s2) e2 += 24 * 60;

  return s1 < e2 && s2 < e1;
}

export function getDefaultLineTimes(lineCode?: LineCode): { start: string; end: string; duration: number } {
  if (lineCode === 'O') return { start: '05:30', end: '12:00', duration: 6.5 };
  if (lineCode === 'M') return { start: '11:30', end: '18:00', duration: 6.5 };
  if (lineCode === 'D') return { start: '17:00', end: '23:30', duration: 6.5 };
  return { start: '06:00', end: '14:00', duration: 8 };
}

// NGHIỆP VỤ 3 (Nâng cao): Kiểm tra hạn chót gửi phiếu trước giờ vào ca (Cut-off Lead Time >= 4h)
export function checkShiftCutoffLeadTime(
  day: DayOfWeek,
  startTime?: string
): { isAllowed: boolean; hoursRemaining: number; message: string } {
  const dayObj = DAYS_OF_WEEK.find((d) => d.key === day);
  if (!dayObj || dayObj.isPast) {
    return {
      isAllowed: false,
      hoursRemaining: 0,
      message: 'Ca làm việc đã qua thời gian thực hiện.',
    };
  }

  const st = startTime || '06:00';
  const startMin = timeToMinutes(st);

  // Giả lập mốc thời gian hiện tại trong ngày Thứ Sáu (Hôm nay) là 08:00 sáng
  if (day === 'friday') {
    const currentSimMin = 8 * 60; // 08:00
    const diffHours = Number(((startMin - currentSimMin) / 60).toFixed(1));
    if (diffHours < MIN_CUTOFF_LEAD_HOURS) {
      return {
        isAllowed: false,
        hoursRemaining: Math.max(0, diffHours),
        message: `Vi phạm Cut-off Lead Time (${MIN_CUTOFF_LEAD_HOURS}h): Ca bắt đầu lúc ${st} hôm nay, cần báo trước tối thiểu ${MIN_CUTOFF_LEAD_HOURS} tiếng để Quản lý kịp điều phối.`,
      };
    }
    return {
      isAllowed: true,
      hoursRemaining: diffHours,
      message: `Đạt chuẩn Cut-off (Còn ${diffHours}h trước giờ vào ca).`,
    };
  }

  // Thứ Bảy & Chủ Nhật (> 24h - 48h trước giờ vào ca)
  const extraDays = day === 'saturday' ? 1 : 2;
  const hoursRemaining = Number((extraDays * 24 + (startMin - 8 * 60) / 60).toFixed(1));
  return {
    isAllowed: true,
    hoursRemaining,
    message: `Đạt chuẩn Cut-off (Còn ${hoursRemaining}h trước giờ vào ca).`,
  };
}

// NGHIỆP VỤ 5 (Nâng cao): Kiểm tra hạn mức số lần bán ca trong tuần đối với Full-time / Part-time
export function checkEmployeeSaleQuota(
  employee: Employee,
  branchShiftRequests: { requesterId: string; requestType: string; status: string }[]
): { isAllowed: boolean; usedCount: number; maxLimit: number; message: string } {
  const activeSales = branchShiftRequests.filter(
    (r) => r.requesterId === employee.id && r.requestType === 'sale' && r.status !== 'rejected'
  );
  const usedCount = activeSales.length;
  const maxLimit =
    employee.employmentType === 'full_time'
      ? MAX_FULLTIME_SALES_PER_WEEK
      : MAX_PARTTIME_SALES_PER_WEEK;

  if (usedCount >= maxLimit) {
    return {
      isAllowed: false,
      usedCount,
      maxLimit,
      message: `Đã hết hạn mức bán ca (${usedCount}/${maxLimit} ca/tuần cho hợp đồng ${
        employee.employmentType === 'full_time' ? 'Full-Time' : 'Part-Time'
      }) nhằm đảm bảo cam kết giờ công chuẩn. Bạn vẫn có thể dùng tính năng Đổi Ca (Swap).`,
    };
  }

  return {
    isAllowed: true,
    usedCount,
    maxLimit,
    message: `Còn ${maxLimit - usedCount}/${maxLimit} lượt bán ca hợp lệ trong tuần.`,
  };
}

export interface ShiftEligibilityViolation {
  code:
    | 'SAME_SHIFT'
    | 'TIME_CONFLICT'
    | 'LACKS_SKILL'
    | 'GENDER_MISMATCH'
    | 'MAX_HOURS_EXCEEDED'
    | 'CLOPENING_VIOLATION';
  message: string;
}

export interface ShiftEligibilityResult {
  isEligible: boolean;
  violations: ShiftEligibilityViolation[];
  reasons: string[];
  currentWeeklyHours: number;
  projectedWeeklyHours: number;
  minRestHours?: number;
}

export function checkShiftEligibility({
  targetEmployee,
  shiftRole,
  shiftDay,
  shiftLineCode,
  shiftStartTime,
  shiftEndTime,
  allAssignments,
  roleMap,
  excludeAssignmentId,
}: {
  targetEmployee: Employee;
  shiftRole?: BusinessRole;
  shiftDay: DayOfWeek;
  shiftLineCode?: LineCode;
  shiftStartTime?: string;
  shiftEndTime?: string;
  allAssignments: ShiftAssignment[];
  roleMap: Map<string, BusinessRole>;
  excludeAssignmentId?: string;
}): ShiftEligibilityResult {
  const violations: ShiftEligibilityViolation[] = [];

  const defaults = getDefaultLineTimes(shiftLineCode);
  const sStart = shiftStartTime || defaults.start;
  const sEnd = shiftEndTime || defaults.end;
  const shiftDuration = calculateHoursBetween(sStart, sEnd) || defaults.duration;

  // 1. NGHIỆP VỤ CỐT LÕI 1: Nhân viên cùng ca không thể bán ca cho nhau / Không trùng giờ
  const empAssignmentsOnDay = allAssignments.filter(
    (a) => a.userId === targetEmployee.id && a.day === shiftDay && a.id !== excludeAssignmentId
  );

  for (const a of empAssignmentsOnDay) {
    if (shiftLineCode && a.lineCode === shiftLineCode) {
      violations.push({
        code: 'SAME_SHIFT',
        message: `Đồng nghiệp đã có lịch làm việc trong ca ${shiftLineCode} này (nhân viên cùng ca không thể nhận thêm ca).`,
      });
      break;
    }

    const aDefaults = getDefaultLineTimes(a.lineCode);
    const aStart = a.customStartTime || aDefaults.start;
    const aEnd = a.customEndTime || aDefaults.end;
    if (doHoursOverlap(sStart, sEnd, aStart, aEnd)) {
      violations.push({
        code: 'TIME_CONFLICT',
        message: `Bị trùng khung giờ làm việc (${aStart} - ${aEnd} tại Line ${a.lineCode}) trong ngày này.`,
      });
      break;
    }
  }

  // 2. NGHIỆP VỤ CỐT LÕI 2: Phù hợp chuyên môn (Bếp, Bảo vệ...) & Giới tính
  if (shiftRole) {
    const hasSkill = targetEmployee.skills.some((sId) => {
      if (sId === shiftRole.id || sId === shiftRole.code) return true;
      const sRole = roleMap.get(sId);
      return Boolean(sRole && sRole.code === shiftRole.code);
    });

    if (!hasSkill) {
      violations.push({
        code: 'LACKS_SKILL',
        message: `Chưa có kỹ năng chuyên môn cho vị trí ${shiftRole.name} (${shiftRole.code}).`,
      });
    }

    if (shiftRole.genderRequirement === 'male_only' && targetEmployee.gender !== 'male') {
      violations.push({
        code: 'GENDER_MISMATCH',
        message: `Vị trí ${shiftRole.name} có quy định nghiêm ngặt: Chỉ dành cho nhân viên Nam.`,
      });
    } else if (shiftRole.genderRequirement === 'female_only' && targetEmployee.gender !== 'female') {
      violations.push({
        code: 'GENDER_MISMATCH',
        message: `Vị trí ${shiftRole.name} có quy định nghiêm ngặt: Chỉ dành cho nhân viên Nữ.`,
      });
    }
  }

  // 3. NGHIỆP VỤ NÂNG CAO 1: Giới hạn tổng giờ làm tối đa 48h/tuần (Max Weekly Hours Cap)
  let currentWeeklyHours = 0;
  allAssignments.forEach((a) => {
    if (a.userId === targetEmployee.id && a.id !== excludeAssignmentId) {
      const d = getDefaultLineTimes(a.lineCode);
      const st = a.customStartTime || d.start;
      const et = a.customEndTime || d.end;
      const dur = calculateHoursBetween(st, et) || d.duration;
      currentWeeklyHours += dur;
    }
  });
  currentWeeklyHours = Number(currentWeeklyHours.toFixed(1));
  const projectedWeeklyHours = Number((currentWeeklyHours + shiftDuration).toFixed(1));

  if (projectedWeeklyHours > MAX_WEEKLY_HOURS_CAP) {
    violations.push({
      code: 'MAX_HOURS_EXCEEDED',
      message: `Vượt trần giờ làm tối đa trong tuần (${projectedWeeklyHours}h / ${MAX_WEEKLY_HOURS_CAP}h tối đa — Chống kiệt sức lao động).`,
    });
  }

  // 4. NGHIỆP VỤ NÂNG CAO 2: Khoảng nghỉ tối thiểu >= 8h giữa 2 ca liên tiếp (Chặn "Clopening")
  const { prevDay, nextDay } = getAdjacentDays(shiftDay);
  let minRestHours: number | undefined = undefined;

  if (prevDay) {
    const prevDayAssigns = allAssignments.filter(
      (a) => a.userId === targetEmployee.id && a.day === prevDay && a.id !== excludeAssignmentId
    );
    for (const pa of prevDayAssigns) {
      const pd = getDefaultLineTimes(pa.lineCode);
      const paEnd = pa.customEndTime || pd.end;
      const prevEndMin = timeToMinutes(paEnd);
      const currStartMin = timeToMinutes(sStart);
      const restMins = 24 * 60 - prevEndMin + currStartMin;
      const restHrs = Number((restMins / 60).toFixed(1));
      if (minRestHours === undefined || restHrs < minRestHours) {
        minRestHours = restHrs;
      }
      if (restHrs < MIN_REST_PERIOD_HOURS) {
        violations.push({
          code: 'CLOPENING_VIOLATION',
          message: `Vi phạm nghỉ tối thiểu ${MIN_REST_PERIOD_HOURS}h giữa 2 ca (Clopening): Tối hôm trước tan ca lúc ${paEnd}, sáng hôm sau vào ca lúc ${sStart} (chỉ nghỉ ${restHrs}h).`,
        });
        break;
      }
    }
  }

  if (nextDay) {
    const nextDayAssigns = allAssignments.filter(
      (a) => a.userId === targetEmployee.id && a.day === nextDay && a.id !== excludeAssignmentId
    );
    for (const na of nextDayAssigns) {
      const nd = getDefaultLineTimes(na.lineCode);
      const naStart = na.customStartTime || nd.start;
      const currEndMin = timeToMinutes(sEnd);
      const nextStartMin = timeToMinutes(naStart);
      const restMins = 24 * 60 - currEndMin + nextStartMin;
      const restHrs = Number((restMins / 60).toFixed(1));
      if (minRestHours === undefined || restHrs < minRestHours) {
        minRestHours = restHrs;
      }
      if (restHrs < MIN_REST_PERIOD_HOURS) {
        violations.push({
          code: 'CLOPENING_VIOLATION',
          message: `Vi phạm nghỉ tối thiểu ${MIN_REST_PERIOD_HOURS}h giữa 2 ca (Clopening): Ca này kết thúc lúc ${sEnd}, sáng hôm sau đã có ca lúc ${naStart} (chỉ nghỉ ${restHrs}h).`,
        });
        break;
      }
    }
  }

  return {
    isEligible: violations.length === 0,
    violations,
    reasons: violations.map((v) => v.message),
    currentWeeklyHours,
    projectedWeeklyHours,
    minRestHours,
  };
}

