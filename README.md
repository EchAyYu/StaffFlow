# OPTISHIFT ENTERPRISE — HỆ THỐNG QUẢN LÝ NHÂN SỰ & TỰ ĐỘNG XẾP LỊCH ĐA CHI NHÁNH
Phiên bản 1.0 — Cơ sở nghiệp vụ đặc tả kỹ thuật với Neon PostgreSQL & Node.js

---

## 🌟 TỔNG QUAN HỆ THỐNG

Hệ thống được thiết kế theo đúng **Tài liệu Đặc tả Nghiệp vụ Phiên bản 1.0**:
- **Cấu trúc Monorepo 2 Thư mục Riêng Biệt**:
  - `frontend/`: React 18+, TypeScript, Vite, Tailwind CSS, Lucide React (chuẩn B2B SaaS, sharp edges `rounded-none`, `rounded-sm`).
  - `backend/`: Node.js, Express, TypeScript, PostgreSQL Client (`pg`), Neon Cloud Database.
- **Mô hình Đa Chi Nhánh (Multi-Branch)**: Mỗi nhân viên thuộc 1 chi nhánh, chi nhánh vận hành độc lập.
- **Phân quyền 3 cấp (Role-Based Access Control)**:
  1. **Admin Tổng (Super Admin)**: Quản lý danh sách chi nhánh, tạo Admin chi nhánh, giám sát tổng hợp giờ làm, quỹ lương và tình hình thiếu hụt nhân sự toàn quốc.
  2. **Admin Chi Nhánh (Branch Admin)**: Quản lý nhân viên chi nhánh, vai trò/kỹ năng, cấu hình 3 Line chuẩn (O, M, D), chạy Scheduler Level 2, kiểm tra cảnh báo thiếu người, duyệt đề xuất Override, Publish lịch, duyệt phiếu Đổi ca & Bán ca, nhập OT và xuất bảng lương.
  3. **Nhân Viên (Employee)**: Đăng ký khả năng làm việc theo ngày/line (O, M, D, O_M, A, OFF), xem lịch Published chính thức, xem giờ làm đã chốt vs dự kiến, tạo phiếu đổi ca/bán ca và theo dõi trạng thái.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```
React Learning/
├── package.json                          # Scripts tổng điều phối FE và BE từ gốc
├── README.md                             # Hướng dẫn chi tiết
│
├── backend/                              # [BE] NODE.JS BACKEND & DATABASE NEON
│   ├── .env                              # Đã cấu hình chuỗi kết nối Neon DATABASE_URL
│   ├── .env.example                      # Mẫu hướng dẫn kết nối
│   ├── schema.sql                        # DDL 13 Bảng PostgreSQL + Toàn bộ Seed Data chuẩn nghiệp vụ
│   ├── package.json                      # Scripts: dev, build, start, db:init, test
│   ├── tsconfig.json                     # Cấu hình TypeScript NodeNext
│   └── src/
│       ├── db.ts                         # Neon PostgreSQL Connection Pool với SSL an toàn
│       ├── initDb.ts                     # Migration runner đẩy bảng & dữ liệu lên Neon
│       ├── testRunner.ts                 # Bộ kiểm thử tự động 16 ca test nghiệp vụ với Neon
│       └── index.ts                      # REST API Server đầy đủ các route nghiệp vụ (Port 5000)
│
└── frontend/                             # [FE] REACT 18+ TYPESCRIPT CLIENT
    ├── package.json                      # React 19, Vite, Tailwind CSS, Lucide React
    ├── vite.config.ts                    # Vite config
    ├── tsconfig.json / tsconfig.app.json # TypeScript strict config
    ├── index.html                        # Base HTML
    ├── public/                           # Static assets & icons
    └── src/
        ├── types.ts                      # Domain Models chuẩn hóa 1:1 với schema
        ├── data/mockData.ts              # 10 nhân sự mẫu tiếng Việt, 3 chi nhánh, Line O/M/D
        ├── utils/
        │   ├── formatters.ts             # Format ngày, giờ, tiền tệ VND, badge màu
        │   └── schedulerSolver.ts        # Thuật toán Auto-Scheduler Level 2 (MRV Heuristic)
        ├── context/ScheduleContext.tsx   # Centralized React Context quản lý toàn bộ luồng
        └── components/
            ├── common/                   # Header (với live Neon DB status), Badge, Button, Modal, Toast
            ├── auth/LoginView.tsx        # Đăng nhập 1-Click cho cả 3 vai trò
            ├── superadmin/               # Dashboard Admin Tổng (Cross-Branch Insights)
            ├── admin/                    # 7 Tab quản trị Admin Chi Nhánh (Lịch ca, Nhân sự, Line, Đổi/Bán ca, Lương & OT, Audit)
            └── employee/                 # 3 Tab Cổng Nhân Viên (Lịch làm việc, Đăng ký nguyện vọng, Đổi/Bán ca)
```

---

## ⚡ CÁC LỆNH KHỞI CHẠY NHANH

### Chạy từ thư mục gốc:
```bash
# Khởi chạy Backend (Port 5000):
npm run dev:backend

# Khởi chạy Frontend (Port 5173):
npm run dev:frontend

# Chạy bộ kiểm thử tự động với Neon Database:
npm run test:backend

# Khởi tạo hoặc cập nhật lại bảng và seed data trên Neon:
npm run db:init
```

---

## 🧪 KẾT QUẢ KIỂM THỬ TỰ ĐỘNG ĐỐI CHIẾU ĐẶC TẢ NGHIỆP VỤ

Bộ kiểm thử tự động trong `backend/src/testRunner.ts` chạy trực tiếp trên Neon PostgreSQL của bạn và đã vượt qua **16/16 ca kiểm thử (100% PASS)**:

1. **Test 1 - Toàn vẹn cơ sở dữ liệu**: Sẵn sàng 13/13 bảng: `branches`, `roles`, `users`, `user_skills`, `user_wage_rates`, `line_configs`, `line_requirements`, `availability_registrations`, `schedules`, `shift_assignments`, `shift_requests`, `payroll_records`, `audit_logs`.
2. **Test 2 - Đa chi nhánh**: Phân tách HCM01, HCM02, HN01; định mức 208h/tháng, max 4 ngày OFF Full-time, 8 ngày OFF Part-time.
3. **Test 3 - Ràng buộc Cứng Giới Tính (Hard Constraint - Gender)**: Vai trò Bảo Vệ (SEC) bắt buộc `male_only`. Nhân viên nữ bị hệ thống CHẶN xếp ca theo đúng quy tắc.
4. **Test 4 - Line O/M/D & Gối ca (Overlap Rule)**:
   - Line O: 05:30 - 12:00 (6.5h)
   - Line M: 11:00 - 18:00 (7.0h)
   - Line D: 17:00 - 23:30 (6.5h)
   - Chấp nhận gối ca hợp lệ 11:00-12:00 (O & M) và 17:00-18:00 (M & D) để bàn giao.
5. **Test 5 - Đăng ký Khả dụng & Ràng buộc Cứng OFF**: Nhân viên đăng ký `OFF` (như EMP-001 thứ 7) bị khóa tuyệt đối, thuật toán không được phép xếp ca.
6. **Test 6 - Luồng Đổi ca & Bán ca (Swap/Sale)**: Tạo phiếu, admin duyệt, tự động cập nhật phân công ca và chuyển đổi quỹ giờ.
7. **Test 7 - Tích lũy công & OT hệ số 1.5x**: Phân định công quá khứ đã chốt vs dự kiến; tính OT chính xác theo công thức `giờ OT * đơn giá * 1.5`.
8. **Test 8 - Audit Trail**: Ghi nhận lịch sử kiểm toán bất biến với đầy đủ metadata JSONB.
