/**
 * DOMAIN MODEL: Branch (Chi Nhánh)
 * Áp dụng đầy đủ các nguyên tắc Lập Trình Hướng Đối Tượng (OOP):
 * 1. Encapsulation (Đóng gói): Đóng gói dữ liệu và các quy tắc nghiệp vụ nội tại.
 * 2. Domain Invariants (Bảo toàn tính bất biến): Không cho phép thực hiện hành động vi phạm toàn vẹn (như xóa chi nhánh còn nhân sự).
 * 3. Single Responsibility: Chịu trách nhiệm về định danh, cấu hình và tính hợp lệ của chi nhánh.
 */

export interface IBranchValidationResult {
  allowed: boolean;
  errorCode?: 'BRANCH_HAS_ACTIVE_EMPLOYEES' | 'BRANCH_HAS_ACTIVE_ASSIGNMENTS' | 'BRANCH_NOT_FOUND';
  message?: string;
  details?: {
    employeeCount?: number;
    assignmentCount?: number;
  };
}

export class BranchEntity {
  public readonly id: string;
  public readonly code: string;
  public name: string;
  public address: string;
  public phone: string;
  public standardMonthlyHours: number;
  public maxFulltimeOffDays: number;
  public maxParttimeOffDays: number;
  public adminName?: string;
  public adminUsername?: string;
  public adminEmail?: string;
  public adminPassword?: string;

  constructor(data: {
    id: string;
    code: string;
    name: string;
    address?: string;
    phone?: string;
    standardMonthlyHours?: number;
    maxFulltimeOffDays?: number;
    maxParttimeOffDays?: number;
    adminName?: string;
    adminUsername?: string;
    adminEmail?: string;
    adminPassword?: string;
  }) {
    this.id = data.id;
    this.code = data.code.toUpperCase().trim();
    this.name = data.name.trim();
    this.address = data.address || '';
    this.phone = data.phone || '';
    this.standardMonthlyHours = data.standardMonthlyHours ?? 208;
    this.maxFulltimeOffDays = data.maxFulltimeOffDays ?? 4;
    this.maxParttimeOffDays = data.maxParttimeOffDays ?? 8;
    this.adminName = data.adminName;
    this.adminUsername = data.adminUsername;
    this.adminEmail = data.adminEmail;
    this.adminPassword = data.adminPassword;
  }

  /**
   * [OOP Domain Invariant Rule]
   * Kiểm tra điều kiện tiên quyết trước khi giải thể / xóa chi nhánh:
   * - Nếu chi nhánh còn bất kỳ nhân viên nào (activeEmployeeCount > 0) => TỪ CHỐI XÓA.
   * - Nếu chi nhánh còn ca làm việc trong lịch (activeAssignmentCount > 0) => TỪ CHỐI XÓA.
   */
  public canBeDeleted(activeEmployeeCount: number, activeAssignmentCount: number = 0): IBranchValidationResult {
    if (activeEmployeeCount > 0) {
      return {
        allowed: false,
        errorCode: 'BRANCH_HAS_ACTIVE_EMPLOYEES',
        message: `Ràng buộc toàn vẹn OOP: Không thể giải thể chi nhánh "${this.name}" (${this.code}) vì hiện vẫn còn ${activeEmployeeCount} nhân sự trực thuộc. Bạn phải điều chuyển hoặc xóa hồ sơ nhân sự trước khi xóa chi nhánh.`,
        details: { employeeCount: activeEmployeeCount },
      };
    }

    if (activeAssignmentCount > 0) {
      return {
        allowed: false,
        errorCode: 'BRANCH_HAS_ACTIVE_ASSIGNMENTS',
        message: `Ràng buộc toàn vẹn OOP: Không thể xóa chi nhánh "${this.name}" vì vẫn còn ${activeAssignmentCount} ca làm việc được phân bổ trong lịch trình.`,
        details: { assignmentCount: activeAssignmentCount },
      };
    }

    return { allowed: true };
  }

  /**
   * [OOP Behavior]
   * Tự động sinh mã nhân viên kế tiếp duy nhất cho chi nhánh theo chuỗi tuần tự EMP-001, EMP-002,...
   * Bảo đảm không bị can thiệp thủ công dẫn đến trùng mã.
   */
  public generateNextEmployeeCode(existingBranchEmployeeCodes: string[]): string {
    let maxSeq = 0;
    for (const code of existingBranchEmployeeCodes) {
      if (!code) continue;
      const match = code.match(/EMP-(\d+)/i) || code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `EMP-${String(nextSeq).padStart(3, '0')}`;
  }
}
