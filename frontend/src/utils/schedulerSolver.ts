import {
  Employee,
  BusinessRole,
  LineConfig,
  LineRequirement,
  AvailabilityRegistration,
  ShiftAssignment,
  DayOfWeek,
  LineCode,
  ShortageWarning,
  OverrideProposal,
} from '../types';
import { DAYS_OF_WEEK, LINE_ORDER, makeAssignmentId } from './formatters';

export interface SolverStepLog {
  step: number;
  message: string;
  category: 'info' | 'progress' | 'warning' | 'success';
}

export interface SolveResult {
  assignments: ShiftAssignment[];
  shortageWarnings: ShortageWarning[];
  overrideProposals: OverrideProposal[];
  metrics: {
    totalRequiredSlots: number;
    filledSlots: number;
    unassignedSlots: number;
    fairnessScore: number;
    executionTimeMs: number;
  };
  stepLogs: SolverStepLog[];
}

export function runBusinessScheduler(
  employees: Employee[],
  roles: BusinessRole[],
  lineConfigs: LineConfig[],
  lineRequirements: LineRequirement[],
  registrations: AvailabilityRegistration[],
  options?: {
    allowOvertime?: boolean;
    allowMultiLinePerDay?: boolean;
    branchId?: string;
  }
): SolveResult {
  const startTime = performance.now();
  const stepLogs: SolverStepLog[] = [];
  const shortageWarnings: ShortageWarning[] = [];
  const overrideProposals: OverrideProposal[] = [];

  stepLogs.push({
    step: 1,
    message: `Khởi tạo Scheduler Level 2: Quét ${employees.length} nhân viên, ${roles.length} vai trò và ${lineRequirements.length} cấu hình yêu cầu line.`,
    category: 'info',
  });

  const activeEmployees = employees.filter((e) => e.status === 'active');
  const roleMap = new Map<string, BusinessRole>();
  roles.forEach((r) => roleMap.set(r.id, r));

  const lineMap = new Map<LineCode, LineConfig>();
  lineConfigs.forEach((l) => lineMap.set(l.lineCode, l));

  const regMap = new Map<string, AvailabilityRegistration>();
  registrations.forEach((r) => regMap.set(r.userId, r));

  // Tracking assigned hours and days
  const assignedHours: Record<string, number> = {};
  const assignedDaysCount: Record<string, number> = {};
  const dayShiftBookings: Record<string, Set<LineCode>> = {}; // key: `${userId}_${day}`
  const proposedBookings: Record<string, Set<LineCode>> = {}; // key: `${userId}_${day}`
  const dayHours: Record<string, number> = {}; // key: `${userId}_${day}`

  activeEmployees.forEach((e) => {
    assignedHours[e.id] = 0;
    assignedDaysCount[e.id] = 0;
  });

  // Step 1: Generate all slots required across 7 days
  interface SlotToFill {
    id: string;
    day: DayOfWeek;
    lineCode: LineCode;
    roleId: string;
    slotIndex: number;
    duration: number;
    eligibleCandidates: Employee[];
  }

  const allSlots: SlotToFill[] = [];

  for (const dayInfo of DAYS_OF_WEEK) {
    const day = dayInfo.key;

    for (const lineCode of LINE_ORDER) {
      const lineConfig = lineMap.get(lineCode);
      const duration = lineConfig ? lineConfig.durationHours : 6.5;

      // Find requirements for this line
      const reqs = lineRequirements.filter((r) => r.lineCode === lineCode);

      for (const req of reqs) {
        const role = roleMap.get(req.roleId);
        if (!role) continue;

        for (let i = 0; i < req.headcountRequired; i++) {
          const slotId = makeAssignmentId(day, lineCode, req.roleId, i);

          // Find candidate pool satisfying HARD CONSTRAINTS:
          // 1. Not registered OFF
          // 2. Has the required skill/role (by exact roleId or matching role code)
          // 3. Gender restriction (e.g. Bảo vệ: Male only)
          const eligible = activeEmployees.filter((emp) => {
            // Skill constraint: Match by exact roleId OR by matching role code
            const reqRole = roleMap.get(req.roleId);
            const hasSkill = emp.skills.some((sId) => {
              if (sId === req.roleId) return true;
              const sRole = roleMap.get(sId);
              return Boolean(sRole && reqRole && sRole.code === reqRole.code);
            });
            if (!hasSkill) return false;

            // Gender constraint
            if (role.genderRequirement === 'male_only' && emp.gender !== 'male') return false;
            if (role.genderRequirement === 'female_only' && emp.gender !== 'female') return false;

            // Availability constraint: Check not OFF (defaults to 'A' - Available if not explicitly submitted)
            const reg = regMap.get(emp.id);
            const choice = reg ? reg.slots[day] : 'A';
            if (choice === 'OFF') return false;

            return true;
          });

          allSlots.push({
            id: slotId,
            day,
            lineCode,
            roleId: req.roleId,
            slotIndex: i,
            duration,
            eligibleCandidates: eligible,
          });
        }
      }
    }
  }

  stepLogs.push({
    step: 2,
    message: `Phân tích cấu trúc: Cần lấp đầy tổng cộng ${allSlots.length} vị trí line trong tuần.`,
    category: 'info',
  });

  // MRV Heuristic: Sort slots with FEWEST eligible candidates first (scarce slots)
  allSlots.sort((a, b) => a.eligibleCandidates.length - b.eligibleCandidates.length);

  stepLogs.push({
    step: 3,
    message: 'Thực thi thuật toán MRV: Ưu tiên vai trò hiếm (Bảo vệ, Pha chế), tuân thủ Hard Constraints (Skill, Giới tính, OFF).',
    category: 'progress',
  });

  const finalAssignments: ShiftAssignment[] = [];
  let filledCount = 0;

  for (const slot of allSlots) {
    const { id, day, lineCode, roleId, slotIndex, duration } = slot;
    const role = roleMap.get(roleId);

    // Filter viable candidates at this moment:
    // 1. Not already working in this exact line
    // 2. Line preference matching (A, O, M, D, O_M)
    // 3. Avoid excessive lines in same day (unless O+M allowed)
    const viableCandidates = slot.eligibleCandidates.filter((emp) => {
      const dayKey = `${emp.id}_${day}`;
      const bookedLines = dayShiftBookings[dayKey] || new Set<LineCode>();

      // Cannot work same line twice
      if (bookedLines.has(lineCode)) return false;

      // Line availability matching
      const reg = regMap.get(emp.id);
      const choice = reg?.slots[day] || 'A';

      if (choice === 'A') {
        // Can work any line
      } else if (choice === lineCode) {
        // Direct match
      } else if (choice === 'O_M' && (lineCode === 'O' || lineCode === 'M')) {
        // Can work O or M
      } else if (choice === 'O_D' && (lineCode === 'O' || lineCode === 'D')) {
        // Can work O or D
      } else if (choice === 'M_D' && (lineCode === 'M' || lineCode === 'D')) {
        // Can work M or D
      } else {
        // Preference mismatch (soft constraint)
        return false;
      }

      // Check max lines per day & ca gãy (split shift) support
      // Nghiệp vụ: Nhân viên Full-time làm đủ tối thiểu 8h/ngày, có thể làm ca gãy (O: sáng 6h-12h + D: tối 17h-23h)
      if (bookedLines.size >= 1) {
        if (!options?.allowMultiLinePerDay) {
          const isFulltime = emp.employmentType === 'full_time';
          const currentDayHours = dayHours[dayKey] || 0;

          const hasO = bookedLines.has('O');
          const hasM = bookedLines.has('M');
          const hasD = bookedLines.has('D');

          // Ca gãy (Split Shift): O (Open sáng) và D (Down tối) có khoảng nghỉ giữa ca > 5 tiếng,
          // hoặc ca liền O + M khi đăng ký nguyện vọng O_M hoặc A, hoặc M + D
          const isSplitShiftOD = (hasO && lineCode === 'D') || (hasD && lineCode === 'O');
          const isShiftOM = (hasO && lineCode === 'M' && (choice === 'O_M' || choice === 'A'));
          const isShiftMD = (hasM && lineCode === 'D' && (choice === 'M_D' || choice === 'A'));

          if (isFulltime && currentDayHours < 8 && (isSplitShiftOD || isShiftOM || isShiftMD)) {
            // Cho phép xếp ca gãy để nhân viên Full-time đạt tối thiểu 8h/ngày
          } else {
            return false;
          }
        }
      }

      return true;
    });

    if (viableCandidates.length > 0) {
      // Pick best candidate: Fair Load Balancing & Full-time 8h/day priority
      viableCandidates.sort((a, b) => {
        // 0. Ưu tiên nhân viên Full-time đang trong ngày làm việc cần bổ sung ca gãy để đủ 8h
        const dayKeyA = `${a.id}_${day}`;
        const dayKeyB = `${b.id}_${day}`;
        const dayHoursA = dayHours[dayKeyA] || 0;
        const dayHoursB = dayHours[dayKeyB] || 0;
        if (a.employmentType === 'full_time' && dayHoursA > 0 && dayHoursA < 8 && dayHoursB === 0) return -1;
        if (b.employmentType === 'full_time' && dayHoursB > 0 && dayHoursB < 8 && dayHoursA === 0) return 1;

        // 1. Prioritize Full-time needing hours to reach standard weekly quota
        if (a.employmentType !== b.employmentType) {
          if (a.employmentType === 'full_time' && (assignedHours[a.id] || 0) < 40) return -1;
          if (b.employmentType === 'full_time' && (assignedHours[b.id] || 0) < 40) return 1;
        }

        // 2. Lower assigned hours first (balance hours)
        const hoursDiff = (assignedHours[a.id] || 0) - (assignedHours[b.id] || 0);
        if (Math.abs(hoursDiff) > 4) return hoursDiff;

        // 3. Lower assigned days first (balance working days)
        return (assignedDaysCount[a.id] || 0) - (assignedDaysCount[b.id] || 0);
      });

      const selected = viableCandidates[0];

      // Assign!
      finalAssignments.push({
        id,
        scheduleId: `SCH-${slot.day}`,
        branchId: options?.branchId || '',
        day,
        lineCode,
        roleId,
        slotIndex,
        userId: selected.id,
        isCompleted: DAYS_OF_WEEK.find((d) => d.key === day)?.isPast || false,
      });

      assignedHours[selected.id] = (assignedHours[selected.id] || 0) + duration;
      const dayKey = `${selected.id}_${day}`;
      dayHours[dayKey] = (dayHours[dayKey] || 0) + duration;

      if (!dayShiftBookings[dayKey]) {
        dayShiftBookings[dayKey] = new Set<LineCode>();
        assignedDaysCount[selected.id] = (assignedDaysCount[selected.id] || 0) + 1;
      }
      dayShiftBookings[dayKey].add(lineCode);
      filledCount++;
    } else {
      // Unassigned slot -> Create Shortage Warning
      finalAssignments.push({
        id,
        scheduleId: `SCH-${slot.day}`,
        branchId: options?.branchId || '',
        day,
        lineCode,
        roleId,
        slotIndex,
        userId: null,
        isCompleted: false,
      });

      shortageWarnings.push({
        id: `WARN-${id}`,
        day,
        lineCode,
        roleId,
        missingCount: 1,
      });

      // Check if there is an employee who is available but lacks skill tick (propose override)
      const potentialOverride = activeEmployees.find((emp) => {
        const reg = regMap.get(emp.id);
        const choice = reg?.slots[day];
        if (choice === 'OFF') return false;
        // Check gender requirement
        if (role?.genderRequirement === 'male_only' && emp.gender !== 'male') return false;
        const dayKey = `${emp.id}_${day}`;
        
        // Không đề xuất nếu nhân viên đã được phân công hoặc đã có đề xuất ở line này
        if (dayShiftBookings[dayKey]?.has(lineCode)) return false;
        if (proposedBookings[dayKey]?.has(lineCode)) return false;

        // Tránh đề xuất quá tải (tối đa 1 ca/ngày trừ khi cần thiết)
        const totalDayShifts = (dayShiftBookings[dayKey]?.size || 0) + (proposedBookings[dayKey]?.size || 0);
        if (totalDayShifts >= (emp.employmentType === 'full_time' ? 2 : 1)) return false;

        return true;
      });

      if (potentialOverride) {
        const dayKey = `${potentialOverride.id}_${day}`;
        if (!proposedBookings[dayKey]) {
          proposedBookings[dayKey] = new Set<LineCode>();
        }
        proposedBookings[dayKey].add(lineCode);

        const dayObj = DAYS_OF_WEEK.find((d) => d.key === day);
        const dayLabel = dayObj ? dayObj.label : day;

        overrideProposals.push({
          assignmentId: id,
          day,
          lineCode,
          roleId,
          proposedUserId: potentialOverride.id,
          proposedUserName: potentialOverride.name,
          reason: `Nhân viên ${potentialOverride.name} rảnh vào ${dayLabel} (Line ${lineCode}), đáp ứng điều kiện giới tính nhưng chưa được tick kỹ năng ${role?.name || ''}.`,
          requiresAdminConfirm: true,
        });
      }
    }
  }

  // Calculate fairness score based on variance of hours among active staff
  const hoursList = activeEmployees.map((e) => assignedHours[e.id] || 0);
  const avgHours = hoursList.reduce((acc, h) => acc + h, 0) / Math.max(hoursList.length, 1);
  const variance =
    hoursList.reduce((acc, h) => acc + Math.pow(h - avgHours, 2), 0) / Math.max(hoursList.length, 1);
  const fairnessScore = Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(variance) / (avgHours || 1)) * 100)));

  const unassignedCount = allSlots.length - filledCount;
  const executionTimeMs = Math.round(performance.now() - startTime);

  stepLogs.push({
    step: 4,
    message: `Hoàn tất xếp lịch Level 2: Lấp đầy ${filledCount}/${allSlots.length} vị trí (${fairnessScore}% điểm cân bằng). Phát hiện ${unassignedCount} vị trí cần xử lý.`,
    category: unassignedCount === 0 ? 'success' : 'warning',
  });

  return {
    assignments: finalAssignments,
    shortageWarnings,
    overrideProposals,
    metrics: {
      totalRequiredSlots: allSlots.length,
      filledSlots: filledCount,
      unassignedSlots: unassignedCount,
      fairnessScore,
      executionTimeMs,
    },
    stepLogs,
  };
}
