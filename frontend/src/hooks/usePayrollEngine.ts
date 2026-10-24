import { useState, useEffect } from 'react';
import {
  Employee,
  BusinessRole,
  LineConfig,
  WeeklySchedule,
  PayrollRecord,
  LineCode,
} from '../types';
import {
  DAYS_OF_WEEK,
  calculateHoursBetween,
  calculateShiftHourlyRate,
} from '../utils/formatters';

interface UsePayrollEngineParams {
  assignments: WeeklySchedule['assignments'];
  lineConfigs: LineConfig[];
  roles: BusinessRole[];
  employees: Employee[];
  currentBranchId: string;
  otHoursMap: Record<string, number>;
}

export function usePayrollEngine({
  assignments,
  lineConfigs,
  roles,
  employees,
  currentBranchId,
  otHoursMap,
}: UsePayrollEngineParams) {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  useEffect(() => {
    const lineMap = new Map<LineCode, number>();
    lineConfigs.forEach((l) => lineMap.set(l.lineCode, l.durationHours));

    const records: PayrollRecord[] = employees
      .filter((e) => e.branchId === currentBranchId)
      .map((emp) => {
        let completedHours = 0;
        let projectedHours = 0;
        let basePay = 0;

        assignments.forEach((a) => {
          if (a.userId === emp.id) {
            let duration = lineMap.get(a.lineCode) || 6.5;
            if (a.customStartTime && a.customEndTime) {
              const custom = calculateHoursBetween(a.customStartTime, a.customEndTime);
              if (custom > 0) duration = custom;
            }
            const role = roles.find(
              (r) => r.id === a.roleId || r.code === a.roleId || a.roleId.includes(r.code)
            );
            const { rate } = calculateShiftHourlyRate(role, emp);
            const dayObj = DAYS_OF_WEEK.find((d) => d.key === a.day);

            if (dayObj?.isPast) {
              completedHours += duration;
              basePay += duration * rate;
            } else {
              projectedHours += duration;
              basePay += duration * rate;
            }
          }
        });

        const otHours = otHoursMap[emp.id] ?? 0;
        const otMultiplier = 1.5;
        const avgRate = emp.baseHourlyRate || emp.wageRates[Object.keys(emp.wageRates)[0]] || 35000;
        const otPay = otHours * avgRate * otMultiplier;

        let shortageDeduction = 0;
        const totalWeekHours = completedHours + projectedHours;
        const standardWeeklyRate = 40;
        if (emp.employmentType === 'full_time' && totalWeekHours < standardWeeklyRate) {
          const missingHours = standardWeeklyRate - totalWeekHours;
          shortageDeduction = missingHours * (avgRate * 0.7);
        }

        const totalPay = Math.max(0, basePay + otPay - shortageDeduction);

        return {
          userId: emp.id,
          employeeCode: emp.employeeCode,
          name: emp.name,
          branchId: emp.branchId,
          employmentType: emp.employmentType,
          completedHours,
          projectedHours,
          otHours,
          otMultiplier,
          basePay,
          otPay,
          shortageDeduction,
          totalPay,
          status: 'draft',
        };
      });

    setPayrollRecords(records);
  }, [assignments, lineConfigs, roles, employees, currentBranchId, otHoursMap]);

  return { payrollRecords, setPayrollRecords };
}
