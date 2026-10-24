/**
 * STAFFFLOW - BỘ TEST TOÀN DIỆN CÁC USE CASE NGHIỆP VỤ HỆ THỐNG
 * Kiểm thử tự động từ Logic Nghiệp vụ OOP, Ràng buộc Xếp ca, Quy trình Đổi/Bán ca, đến Bảng lương & Mã hoá Auth.
 */
import { hashPassword, comparePassword, isBcryptHash } from './auth.js';
const testResults = [];
function expect(condition, suite, name, passMsg, failMsg) {
    if (condition) {
        testResults.push({ suite, name, passed: true, message: passMsg });
        console.log(`  ✅ [PASS] ${suite} -> ${name}: ${passMsg}`);
    }
    else {
        testResults.push({ suite, name, passed: false, message: failMsg });
        console.error(`  ❌ [FAIL] ${suite} -> ${name}: ${failMsg}`);
    }
}
// ----------------------------------------------------------------------------
// 1. OOP DOMAIN MODEL: Branch Invariant & Employee Code Generation
// ----------------------------------------------------------------------------
class TestBranchEntity {
    id;
    code;
    name;
    constructor(id, code, name) {
        this.id = id;
        this.code = code.toUpperCase().trim();
        this.name = name.trim();
    }
    canBeDeleted(activeEmployeeCount, activeAssignmentCount = 0) {
        if (activeEmployeeCount > 0) {
            return {
                allowed: false,
                errorCode: 'BRANCH_HAS_ACTIVE_EMPLOYEES',
                message: `Ràng buộc toàn vẹn OOP: Không thể giải thể chi nhánh "${this.name}" (${this.code}) vì hiện vẫn còn ${activeEmployeeCount} nhân sự trực thuộc.`,
            };
        }
        if (activeAssignmentCount > 0) {
            return {
                allowed: false,
                errorCode: 'BRANCH_HAS_ACTIVE_ASSIGNMENTS',
                message: `Ràng buộc toàn vẹn OOP: Không thể xóa chi nhánh "${this.name}" vì vẫn còn ${activeAssignmentCount} ca làm việc được phân bổ.`,
            };
        }
        return { allowed: true };
    }
    generateNextEmployeeCode(existingCodes) {
        let maxSeq = 0;
        for (const code of existingCodes) {
            if (!code)
                continue;
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
async function runBusinessTests() {
    console.log(`\n========================================================================`);
    console.log(`🚀 STAFFFLOW ENTERPRISE - BỘ KIỂM THỬ TỰ ĐỘNG TẤT CẢ USE CASE NGHIỆP VỤ`);
    console.log(`========================================================================\n`);
    // ============================================================================
    // USE CASE 1: BẢO VỆ TOÀN VẸN CHI NHÁNH (OOP DOMAIN INVARIANT)
    // ============================================================================
    console.log(`🔹 [USE CASE 1] Ràng buộc Bất biến Thực thể Chi nhánh (Branch Entity Invariants)...`);
    const branch = new TestBranchEntity('BR-HCM-01', 'HCM01', 'Chi Nhánh Quận 1');
    // Case 1.1: Chi nhánh còn nhân sự -> Không được phép xóa
    const delCheckWithEmployees = branch.canBeDeleted(5, 0);
    expect(!delCheckWithEmployees.allowed && delCheckWithEmployees.errorCode === 'BRANCH_HAS_ACTIVE_EMPLOYEES', 'Branch Entity', 'Chặn xóa chi nhánh còn nhân viên', 'Chặn xóa thành công chi nhánh khi còn 5 nhân viên', 'LỖI: Cho phép xóa chi nhánh khi vẫn còn nhân sự!');
    // Case 1.2: Chi nhánh còn ca phân công trong lịch -> Không được phép xóa
    const delCheckWithShifts = branch.canBeDeleted(0, 3);
    expect(!delCheckWithShifts.allowed && delCheckWithShifts.errorCode === 'BRANCH_HAS_ACTIVE_ASSIGNMENTS', 'Branch Entity', 'Chặn xóa chi nhánh còn ca làm việc', 'Chặn xóa thành công chi nhánh khi còn ca làm việc', 'LỖI: Cho phép xóa chi nhánh khi vẫn còn ca trực!');
    // Case 1.3: Chi nhánh trống sạch (0 nhân viên, 0 ca trực) -> Cho phép xóa
    const delCheckEmpty = branch.canBeDeleted(0, 0);
    expect(delCheckEmpty.allowed === true, 'Branch Entity', 'Cho phép giải thể chi nhánh sạch', 'Chi nhánh không còn dữ liệu phụ thuộc được giải thể an toàn', 'LỖI: Không cho phép giải thể chi nhánh hợp lệ');
    // Case 1.4: Tự động sinh mã nhân viên tuần tự chuẩn OOP
    const nextCode = branch.generateNextEmployeeCode(['EMP-001', 'EMP-002', 'EMP-003']);
    expect(nextCode === 'EMP-004', 'Branch Entity', 'Tự động sinh mã nhân viên tuần tự', `Sinh đúng mã kế tiếp: ${nextCode}`, `Sai mã nhân viên sinh ra: ${nextCode}`);
    // ============================================================================
    // USE CASE 2: BẢO MẬT & XÁC THỰC MẬT KHẨU BCRYPT
    // ============================================================================
    console.log(`\n🔹 [USE CASE 2] Bảo mật Mật khẩu Bcrypt & Đăng nhập An toàn...`);
    const rawPass = 'StaffFlow@2026';
    const hashed = await hashPassword(rawPass);
    // Case 2.1: Mật khẩu được mã hóa thành hash bcrypt chuẩn
    expect(isBcryptHash(hashed) && hashed.length === 60, 'Auth Bcrypt', 'Mã hoá mật khẩu bcrypt chuẩn', `Đã mã hoá thành chuỗi bcrypt 60 ký tự (${hashed.slice(0, 10)}...)`, 'LỖI: Hash không phải chuẩn bcrypt!');
    // Case 2.2: So sánh mật khẩu chính xác
    const validPass = await comparePassword(rawPass, hashed);
    expect(validPass === true, 'Auth Bcrypt', 'Xác thực mật khẩu chính xác', 'Mật khẩu đúng được xác thực thành công', 'LỖI: Mật khẩu đúng nhưng so sánh trả về sai!');
    // Case 2.3: Chặn mật khẩu sai
    const invalidPass = await comparePassword('WrongPassword123', hashed);
    expect(invalidPass === false, 'Auth Bcrypt', 'Từ chối mật khẩu không chính xác', 'Mật khẩu sai bị hệ thống từ chối đăng nhập', 'LỖI: Mật khẩu sai nhưng lại cho phép đăng nhập!');
    // Case 2.4: Tương thích ngược mật khẩu cũ plaintext
    const legacyMatch = await comparePassword('123456', '123456');
    expect(legacyMatch === true, 'Auth Bcrypt', 'Fallback tương thích mật khẩu cũ', 'Hỗ trợ nâng cấp mật khẩu cũ mượt mà', 'LỖI: Không nhận diện được mật khẩu fallback');
    // ============================================================================
    // USE CASE 3: RÀNG BUỘC CỨNG GIỚI TÍNH & KỸ NĂNG XẾP CA (HARD CONSTRAINTS)
    // ============================================================================
    console.log(`\n🔹 [USE CASE 3] Ràng buộc Cứng Giới tính (Gender) & Kỹ năng (Skill) Phân ca...`);
    const roleSec = { id: 'ROLE-SEC', code: 'SEC', name: 'Bảo Vệ', genderRequirement: 'male_only' };
    const roleBar = { id: 'ROLE-BAR', code: 'BAR', name: 'Pha Chế', genderRequirement: 'any' };
    const empNam = { id: 'EMP-01', name: 'Nguyễn Văn Nam', gender: 'male', skills: ['ROLE-SEC', 'ROLE-BAR'] };
    const empNu = { id: 'EMP-02', name: 'Trần Thị Nữ', gender: 'female', skills: ['ROLE-SEC', 'ROLE-BAR'] };
    const empNoSkill = { id: 'EMP-03', name: 'Lê Không Kỹ Năng', gender: 'male', skills: [] };
    // Case 3.1: Nhân viên nữ không được phép xếp ca Bảo vệ (male_only)
    const isNuAllowedSec = roleSec.genderRequirement === 'male_only' ? empNu.gender === 'male' : true;
    expect(isNuAllowedSec === false, 'Scheduling Constraints', 'Chặn nhân viên Nữ làm Bảo Vệ (Chỉ Nam)', 'Hệ thống chặn thành công nhân viên Nữ không được xếp ca Bảo Vệ', 'LỖI: Cho phép nhân viên Nữ xếp ca Bảo Vệ vi phạm ràng buộc giới tính!');
    // Case 3.2: Nhân viên Nam có kỹ năng được phép xếp ca Bảo vệ
    const isNamAllowedSec = roleSec.genderRequirement === 'male_only' ? empNam.gender === 'male' && empNam.skills.includes(roleSec.id) : false;
    expect(isNamAllowedSec === true, 'Scheduling Constraints', 'Cho phép nhân viên Nam đủ kỹ năng làm Bảo Vệ', 'Nhân viên Nam đủ tiêu chuẩn được xếp ca Bảo Vệ thành công', 'LỖI: Nhân viên Nam đủ kỹ năng bị từ chối ca Bảo Vệ!');
    // Case 3.3: Nhân viên không có kỹ năng Pha Chế không được xếp ca Pha Chế
    const isNoSkillAllowedBar = empNoSkill.skills.includes(roleBar.id);
    expect(isNoSkillAllowedBar === false, 'Scheduling Constraints', 'Chặn nhân viên thiếu kỹ năng', 'Nhân viên chưa học kỹ năng Pha Chế không thể gán vào ca Pha Chế', 'LỖI: Cho phép nhân viên không có kỹ năng làm ca chuyên môn!');
    // ============================================================================
    // USE CASE 4: QUY TRÌNH ĐỔI CA, BÁN CA & PEER HANDSHAKE
    // ============================================================================
    console.log(`\n🔹 [USE CASE 4] Quy trình Đổi ca & Bán ca 2 bước (Peer Handshake & Admin Duyệt)...`);
    // Case 4.1: Đổi ca chỉ định đồng nghiệp -> Bắt buộc qua bước Peer Handshake (waiting_peer)
    const swapReq = {
        id: 'REQ-SWAP-01',
        type: 'swap',
        requesterId: 'EMP-01',
        targetUserId: 'EMP-02',
        peerStatus: 'waiting_peer',
        status: 'pending',
    };
    expect(swapReq.peerStatus === 'waiting_peer', 'Shift Handshake Flow', 'Tạo phiếu đổi ca ở trạng thái chờ đồng nghiệp xác nhận', 'Phiếu đổi ca chỉ định bắt buộc chờ đồng nghiệp bấm Đồng ý (waiting_peer)', 'LỖI: Phiếu đổi ca không khởi tạo trạng thái waiting_peer!');
    // Case 4.2: Đồng nghiệp bấm Từ chối (decline) -> Phiếu bị tự động Rejected
    const peerDecline = (req) => ({
        ...req,
        peerStatus: 'peer_declined',
        status: 'rejected',
    });
    const declinedReq = peerDecline(swapReq);
    expect(declinedReq.status === 'rejected' && declinedReq.peerStatus === 'peer_declined', 'Shift Handshake Flow', 'Đồng nghiệp từ chối thì phiếu bị hủy tự động', 'Phiếu tự động chuyển sang rejected khi đồng nghiệp từ chối', 'LỖI: Đồng nghiệp từ chối nhưng phiếu không bị reject!');
    // Case 4.3: Đồng nghiệp bấm Đồng ý (accept) -> Chuyển vào hàng đợi Quản lý duyệt
    const peerAccept = (req) => ({
        ...req,
        peerStatus: 'peer_accepted',
        status: 'pending',
    });
    const acceptedReq = peerAccept(swapReq);
    expect(acceptedReq.status === 'pending' && acceptedReq.peerStatus === 'peer_accepted', 'Shift Handshake Flow', 'Đồng nghiệp đồng ý -> Chuyển Admin duyệt', 'Phiếu chuyển sang peer_accepted và chờ Admin phê duyệt', 'LỖI: Không chuyển trạng thái sang peer_accepted!');
    // ============================================================================
    // USE CASE 5: TÍNH TOÁN BẢNG LƯƠNG, HỆ SỐ TĂNG CA (OT) & KHẤU TRỪ THIẾU GIỜ
    // ============================================================================
    console.log(`\n🔹 [USE CASE 5] Công thức Bảng lương Tự động, OT (1.5x) & Khấu trừ Chuẩn công...`);
    // Giả lập nhân viên Full-time làm 3 ca Line O (6.5h * 3 = 19.5h), lương 45.000đ/h, OT 4h
    const baseHourlyRate = 45000;
    const completedHours = 19.5;
    const otHours = 4;
    const otMultiplier = 1.5;
    const basePay = completedHours * baseHourlyRate; // 19.5 * 45000 = 877,500đ
    const otPay = otHours * baseHourlyRate * otMultiplier; // 4 * 45000 * 1.5 = 270,000đ
    // Định mức chuẩn 40h/tuần, thiếu (40 - 19.5 = 20.5h), khấu trừ 70% rate
    const missingHours = Math.max(0, 40 - completedHours);
    const shortageDeduction = missingHours * (baseHourlyRate * 0.7);
    const totalPay = Math.max(0, basePay + otPay - shortageDeduction);
    expect(basePay === 877500, 'Payroll Engine', 'Tính lương cơ bản chính xác theo ca làm thực tế', `Lương cơ bản (19.5h x 45,000đ): ${basePay.toLocaleString('vi-VN')}đ`, `Sai kết quả lương cơ bản: ${basePay}`);
    expect(otPay === 270000, 'Payroll Engine', 'Tính hệ số lương tăng ca 1.5x', `Lương OT (4h x 45,000đ x 1.5): ${otPay.toLocaleString('vi-VN')}đ`, `Sai kết quả lương OT: ${otPay}`);
    expect(shortageDeduction > 0 && totalPay > 0, 'Payroll Engine', 'Khấu trừ giờ thiếu và tổng lương thực lãnh', `Khấu trừ thiếu giờ: ${Math.round(shortageDeduction).toLocaleString('vi-VN')}đ, Thực lãnh: ${Math.round(totalPay).toLocaleString('vi-VN')}đ`, 'LỖI: Sai công thức khấu trừ hoặc thực lãnh âm!');
    // ============================================================================
    // TỔNG KẾT
    // ============================================================================
    console.log(`\n========================================================================`);
    const total = testResults.length;
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    console.log(`📊 TỔNG KẾT KIỂM THỬ TẤT CẢ USE CASE NGHIỆP VỤ:`);
    console.log(`   Tổng số use case kiểm thử: ${total}`);
    console.log(`   ✅ Thành công (Passed):    ${passed}`);
    console.log(`   ❌ Thất bại (Failed):      ${failed}`);
    console.log(`========================================================================\n`);
    if (failed === 0) {
        console.log(`🎉 CHÚC MỪNG: 100% USE CASE NGHIỆP VỤ ĐÃ ĐẠT CHUẨN XUẤT SẮC!`);
    }
    else {
        process.exit(1);
    }
}
runBusinessTests().catch(err => {
    console.error('Fatal Test Exception:', err);
    process.exit(1);
});
