-- ============================================================================
-- NEON POSTGRESQL SCHEMA — OPTISHIFT MULTI-BRANCH SHIFT MANAGEMENT & SCHEDULER
-- Version: 1.0 (Business Spec Conformant)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CHI NHÁNH (Branches)
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    standard_monthly_hours NUMERIC(6, 2) DEFAULT 208.00,
    max_fulltime_off_days INT DEFAULT 4,
    max_parttime_off_days INT DEFAULT 8,
    admin_name VARCHAR(255),
    admin_username VARCHAR(100),
    admin_password VARCHAR(255),
    admin_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration nếu bảng đã tồn tại
ALTER TABLE branches ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS admin_username VARCHAR(100);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS admin_password VARCHAR(255);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);

-- 2. VAI TRÒ & KỸ NĂNG (Roles / Positions per Branch)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    gender_requirement VARCHAR(20) DEFAULT 'any' CHECK (gender_requirement IN ('any', 'male_only', 'female_only')),
    default_hourly_rate NUMERIC(12, 2) NOT NULL DEFAULT 45000.00,
    salary_calculation_type VARCHAR(30) DEFAULT 'employee_seniority_rate',
    is_system_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS salary_calculation_type VARCHAR(30) DEFAULT 'employee_seniority_rate';

-- 3. NHÂN VIÊN & TÀI KHOẢN (Users / Staff)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
    employee_code VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT 'hashed_default_pass',
    role_type VARCHAR(30) NOT NULL CHECK (role_type IN ('super_admin', 'branch_admin', 'employee')),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    dob DATE,
    joined_date DATE DEFAULT CURRENT_DATE,
    employment_type VARCHAR(20) NOT NULL CHECK (employment_type IN ('full_time', 'part_time')),
    phone VARCHAR(30),
    base_hourly_rate NUMERIC(12, 2) DEFAULT 30000.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS base_hourly_rate NUMERIC(12, 2) DEFAULT 30000.00;

-- 4. KỸ NĂNG NHÂN VIÊN (User Skills - Many to Many)
CREATE TABLE IF NOT EXISTS user_skills (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 5. ĐỊNH MỨC LƯƠNG THEO NHÂN VIÊN VÀ VAI TRÒ (Custom Hourly Wage per Staff & Role)
CREATE TABLE IF NOT EXISTS user_wage_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    hourly_rate NUMERIC(12, 2) NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id, effective_date)
);

-- 6. CẤU HÌNH LINE LÀM VIỆC THEO CHI NHÁNH (O - Open, M - Mid, D - Down)
CREATE TABLE IF NOT EXISTS line_configs (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    line_code VARCHAR(10) NOT NULL CHECK (line_code IN ('O', 'M', 'D')),
    line_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours NUMERIC(4, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, line_code)
);

-- 7. YÊU CẦU NHÂN SỰ THEO LINE (Line Requirements Headcount)
CREATE TABLE IF NOT EXISTS line_requirements (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    line_code VARCHAR(10) NOT NULL CHECK (line_code IN ('O', 'M', 'D')),
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    headcount_required INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, line_code, role_id)
);

-- 8. ĐĂNG KÝ LỊCH LÀM (Availability Registrations)
CREATE TABLE IF NOT EXISTS availability_registrations (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    availability_type VARCHAR(20) NOT NULL CHECK (availability_type IN ('O', 'M', 'D', 'O_M', 'A', 'OFF')),
    note TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, week_start_date, day_of_week)
);

-- 9. LỊCH TUẦN & TRẠNG THÁI (Weekly Schedules: Draft, Published, Changed)
CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(100) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'changed')),
    version INT NOT NULL DEFAULT 1,
    published_at TIMESTAMP WITH TIME ZONE,
    published_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, week_start_date)
);

-- 10. PHÂN CÔNG VỊ TRÍ CA (Shift Assignments)
CREATE TABLE IF NOT EXISTS shift_assignments (
    id VARCHAR(100) PRIMARY KEY,
    schedule_id VARCHAR(100) REFERENCES schedules(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    line_code VARCHAR(10) NOT NULL CHECK (line_code IN ('O', 'M', 'D')),
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    slot_index INT NOT NULL DEFAULT 0,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    custom_start_time TIME,
    custom_end_time TIME,
    is_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. PHIẾU YÊU CẦU ĐỔI CA & BÁN CA (Shift Requests: Swap & Sale)
CREATE TABLE IF NOT EXISTS shift_requests (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('swap', 'sale', 'leave')),
    requester_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    target_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    day_of_week VARCHAR(20) NOT NULL,
    line_code VARCHAR(10),
    target_day_of_week VARCHAR(20),
    target_line_code VARCHAR(10),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    review_note TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. BẢNG TÍNH LƯƠNG & GIỜ LÀM (Payroll & Work Hours)
CREATE TABLE IF NOT EXISTS payroll_records (
    id VARCHAR(100) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    completed_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    projected_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    ot_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    ot_rate_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.50,
    base_pay NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ot_pay NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    deduction_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_pay NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
    finalized_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, user_id, week_start_date)
);

-- 13. LỊCH SỬ THAY ĐỔI & AUDIT LOG (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB NOT NULL,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA TỐI THIỂU: DUY NHẤT TÀI KHOẢN ADMIN TỔNG & VAI TRÒ HỆ THỐNG
-- ============================================================================

-- 1. Tài khoản Admin Tổng (Super Admin)
INSERT INTO users (id, employee_code, full_name, email, password_hash, role_type, gender, dob, joined_date, employment_type, phone, status)
VALUES 
    ('USR-SUPER-01', 'ADM-ALL', 'Trần Minh Tuấn (Admin Tổng)', 'admin.tong@company.com', 'Admin@2026', 'super_admin', 'male', '1988-04-15', '2020-01-01', 'full_time', '0901 000 001', 'active')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- 2. Danh mục vai trò tiêu chuẩn hệ thống (Dùng làm mẫu khởi tạo chi nhánh mới)
INSERT INTO roles (id, code, name, description, gender_requirement, default_hourly_rate, is_system_default)
VALUES 
    ('ROLE-SEC-01', 'SEC', 'Bảo Vệ', 'An ninh trật tự, dắt xe và hướng dẫn khách hàng (Chỉ Nam)', 'male_only', 35000, true),
    ('ROLE-BAR-01', 'BAR', 'Pha Chế', 'Barista chuyên pha chế trà sữa, cà phê, topping', 'any', 55000, true),
    ('ROLE-SRV-01', 'SRV', 'Phục Vụ', 'Tiếp khách, nhận order, dọn bàn và lau dọn sàn', 'any', 45000, true),
    ('ROLE-KIT-01', 'KIT', 'Bếp', 'Chuẩn bị bánh mì, món ăn nhẹ và nguyên liệu tươi', 'any', 50000, true),
    ('ROLE-INV-01', 'INV', 'Soạn Hàng', 'Kiểm kê, xuất nhập kho và đóng gói hàng giao', 'any', 46000, true)
ON CONFLICT (id) DO NOTHING;

