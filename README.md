# 🚀 STAFFFLOW ENTERPRISE — HỆ THỐNG QUẢN LÝ NHÂN SỰ & TỰ ĐỘNG XẾP LỊCH ĐA CHI NHÁNH

[![React 19](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21+-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-Serverless-00E599?logo=postgresql&logoColor=black)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

StaffFlow Enterprise là giải pháp phần mềm B2B SaaS chuyên nghiệp dành cho chuỗi bán lẻ, chuỗi F&B và dịch vụ. Hệ thống giải quyết bài toán phức tạp về phân ca nhân viên, tự động xếp lịch dựa trên ràng buộc năng lực (Constraint-Satisfaction Solver), tối ưu chi phí tiền lương, xử lý đổi ca linh hoạt và bảo vệ tính toàn vẹn dữ liệu đa chi nhánh.

---

## 🌟 ĐẶC ĐIỂM NỔI BẬT & TƯ DUY KIẾN TRÚC

Hệ thống được thiết kế theo các tiêu chuẩn kỹ thuật hiện đại:
- **Clean Architecture & Separation of Concerns**: Tách biệt hoàn toàn tầng Dữ liệu (Database), Nghiệp vụ (Domain Logic), Giao tiếp mạng (API Services) và Giao diện (UI Views).
- **OOP Domain Invariants**: Mô hình thực thể chi nhánh [BranchEntity](file:///d:/StaffFlow/StaffFlow/frontend/src/domain/BranchModel.ts) tự động bảo vệ tính toàn vẹn (nghiêm cấm giải thể chi nhánh khi còn nhân sự hoặc ca trực đang hoạt động).
- **Bcrypt Security**: Toàn bộ mật khẩu nhân viên và quản lý được mã hoá bằng giải thuật Bcrypt với cơ chế tự động nâng cấp mật khẩu cũ (Graceful auto-migration).
- **Constraint-Satisfaction Scheduler (Level 2 Solver)**: Tự động xếp lịch tuần dựa trên thuật toán Heuristic, cân bằng giữa Hard Constraints (Ràng buộc cứng bắt buộc) và Soft Constraints (Tối ưu nguyện vọng và công bằng số giờ).
- **Quy trình Đổi/Bán ca 2 bước (Peer Handshake)**: Nhân viên đổi hoặc nhượng ca bắt buộc phải có sự đồng ý của đồng nghiệp trước khi trình Quản lý phê duyệt.
- **Tự động hóa Bảng lương & OT Real-time**: Tích lũy giờ làm theo ngày thực tế, áp dụng hệ số làm thêm giờ (OT 1.5x) và quy tắc khấu trừ thiếu giờ chuẩn công.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

```
StaffFlow/
├── backend/                              # [BACKEND] NODE.JS & NEON POSTGRESQL
│   ├── .env                              # Biến môi trường (DATABASE_URL, PORT)
│   ├── package.json                      # Scripts: dev, build, start, test:business
│   ├── tsconfig.json                     # Cấu hình TypeScript NodeNext (ES Modules)
│   ├── schema.sql                        # DDL 13 Bảng PostgreSQL + Seed data mẫu
│   └── src/
│       ├── db.ts                         # Neon PostgreSQL Connection Pool (SSL Enabled)
│       ├── auth.ts                       # Tiện ích mã hoá Bcrypt & migration mật khẩu
│       ├── index.ts                      # Express App bootstrap & Router mounting (45 lines)
│       ├── migrations/
│       │   └── schemaMigration.ts        # Tự động đồng bộ schema và mã hoá mật khẩu lúc khởi động
│       ├── routes/                       # Modular Routers độc lập
│       │   ├── auth.routes.ts            # POST /api/auth/login
│       │   ├── branches.routes.ts        # GET, POST, PUT, DELETE /api/branches
│       │   ├── rolesLines.routes.ts      # Quản lý roles, line-configs, line-requirements
│       │   ├── users.routes.ts           # GET, POST, PUT, DELETE /api/users
│       │   ├── availability.routes.ts    # GET, POST /api/availability
│       │   ├── schedules.routes.ts       # GET, POST /api/schedules, PUT /:id/publish
│       │   ├── shiftRequests.routes.ts   # GET, POST, PUT, approve, reject /api/shift-requests
│       │   └── system.routes.ts          # /health, /initial-state, /reset-data, /payroll-ot, /audit-logs
│       └── businessTestSuite.ts          # Bộ kiểm thử tự động 17 use case nghiệp vụ cốt lõi
│
└── frontend/                             # [FRONTEND] REACT 19 + TYPESCRIPT + VITE
    ├── package.json                      # React 19, Tailwind CSS v4, Lucide React
    ├── vite.config.ts                    # Vite bundler configuration
    ├── tsconfig.json                     # Strict TypeScript configuration
    └── src/
        ├── types.ts                      # Hệ thống Types & Interfaces chuẩn 1:1 với Backend
        ├── services/                     # TẦNG API CLIENT SERVICES TẬP TRUNG
        │   ├── apiClient.ts              # Fetch wrapper chuẩn, xử lý Base URL & ApiError
        │   ├── auth.service.ts           # Dịch vụ xác thực đăng nhập
        │   ├── branch.service.ts         # Dịch vụ quản lý chi nhánh
        │   ├── user.service.ts           # Dịch vụ nhân sự & tài khoản
        │   ├── rolesLines.service.ts     # Dịch vụ vai trò & cấu hình ca
        │   ├── availability.service.ts   # Dịch vụ đăng ký nguyện vọng làm việc
        │   ├── schedule.service.ts       # Dịch vụ lưu & phát hành lịch tuần
        │   ├── shiftRequest.service.ts   # Dịch vụ đổi ca, nhượng ca & chợ ca
        │   ├── system.service.ts         # Dịch vụ trạng thái hệ thống, OT, audit logs
        │   └── index.ts                  # Export tập trung toàn bộ services
        ├── hooks/                        # CUSTOM HOOKS TÁI SỬ DỤNG
        │   ├── useToastState.ts          # Quản lý thông báo Toast UI nổi
        │   └── usePayrollEngine.ts       # Engine tính toán giờ công & bảng lương tự động
        ├── domain/
        │   └── BranchModel.ts            # OOP Domain Model BranchEntity (Bảo toàn Invariants)
        ├── context/
        │   └── ScheduleContext.tsx       # Unified State Facade cho toàn bộ ứng dụng
        ├── components/                   # UI COMPONENTS CHUYÊN BIỆT
        │   ├── admin/                    # Views dành cho Admin Chi Nhánh & Admin Tổng
        │   │   ├── SuperAdminDashboard.tsx  # Bảng điều khiển Admin Tổng toàn quyền
        │   │   ├── StaffTab.tsx             # Quản lý danh sách nhân sự & kỹ năng
        │   │   ├── LineAndRolesTab.tsx      # Cấu hình ca O/M/D & định mức vai trò
        │   │   ├── ScheduleTab.tsx          # Bảng phân ca tuần, solver modal & publish
        │   │   ├── ShiftRequestsTab.tsx     # Hàng đợi phê duyệt đổi ca, bán ca
        │   │   ├── PayrollTab.tsx           # Bảng lương tự động, xuất Excel/PDF, nhập OT
        │   │   └── AuditLogsTab.tsx         # Nhật ký kiểm toán hệ thống bất biến
        │   ├── staff/                    # Views dành cho Nhân Viên
        │   │   ├── StaffScheduleView.tsx    # Xem lịch tuần cá nhân & đồng nghiệp
        │   │   ├── StaffAvailabilityView.tsx# Đăng ký ca làm việc tuần tới
        │   │   ├── StaffShiftExchangeView.tsx# Tạo yêu cầu đổi ca, bán ca & vào Chợ ca
        │   │   └── StaffPayrollView.tsx     # Bảng theo dõi giờ làm & thu nhập cá nhân
        │   ├── auth/
        │   │   └── LoginView.tsx            # Form đăng nhập Bcrypt an toàn
        │   └── common/                      # Nút bấm, Modal, Badge, Header thanh điều hướng
        └── utils/
            ├── formatters.ts             # Định dạng tiền tệ VND, giờ giấc, badge trạng thái
            └── schedulerSolver.ts        # Thuật toán Auto-Scheduler Level 2 (Constraint-Satisfaction)
```

---

## 🔑 PHÂN QUYỀN 3 CẤP (ROLE-BASED ACCESS CONTROL)

| Cấp Bậc | Quyền Hạn Chính | Tài Khoản Demo | Mật Khẩu |
| :--- | :--- | :--- | :--- |
| **Admin Tổng (Super Admin)** | Toàn quyền hệ thống, tạo và quản lý chi nhánh, cấp tài khoản Admin chi nhánh, giám sát quỹ lương và thiếu hụt nhân sự toàn quốc, Reset dữ liệu sạch. | `admin.tong` | `Admin@2026` |
| **Admin Chi Nhánh (Branch Admin)** | Quản lý nhân viên chi nhánh, vai trò/kỹ năng, cấu hình 3 Line (O, M, D), chạy Auto-Scheduler, duyệt Override, Publish lịch tuần, duyệt Đổi ca & Bán ca, nhập OT và kết xuất bảng lương. | `admin.hcm01` / `admin.hcm02` / `admin.hn01` | `Admin@2026` |
| **Nhân Viên (Employee)** | Đăng ký nguyện vọng làm việc (O, M, D, A, OFF), xem lịch tuần chính thức, theo dõi giờ tích lũy vs dự kiến, gửi lời mời đổi ca/bán ca, nhận ca từ Chợ ca công khai. | Mã NV hoặc username (vd: `EMP-001`, `EMP-002`, `ngan.nguyen`) | `123456` |

---

## ⚙️ HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN

### 1. Yêu cầu môi trường
- **Node.js**: Phiên bản 18.x hoặc 20.x trở lên.
- **NPM**: Phiên bản 9.x hoặc 10.x trở lên.
- **Neon PostgreSQL**: Tài khoản miễn phí tại [neon.tech](https://neon.tech/) (hoặc bất kỳ PostgreSQL server nào).

### 2. Cài đặt Backend
```bash
# Di chuyển vào thư mục backend
cd StaffFlow/backend

# Cài đặt các gói phụ thuộc
npm install

# Tạo file .env và cấu hình kết nối database
# Ví dụ:
# DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
# PORT=5000

# (Tùy chọn) Khởi tạo cấu trúc bảng mẫu ban đầu nếu chạy lần đầu
npm run db:init

# Khởi chạy server Backend ở chế độ phát triển
npm run dev
# Server sẽ lắng nghe tại: http://localhost:5000
```

### 3. Cài đặt Frontend
```bash
# Mở một cửa sổ terminal mới và di chuyển vào thư mục frontend
cd StaffFlow/frontend

# Cài đặt các gói phụ thuộc
npm install

# Khởi chạy ứng dụng Frontend
npm run dev
# Giao diện sẽ hiển thị tại: http://localhost:5173
```

---

## 🧪 BỘ KIỂM THỬ TỰ ĐỘNG CÁC USE CASE NGHIỆP VỤ

Hệ thống tích hợp bộ kiểm thử nghiệp vụ tự động độc lập [businessTestSuite.ts](file:///d:/StaffFlow/StaffFlow/backend/src/businessTestSuite.ts) giúp xác minh tính đúng đắn của toàn bộ quy tắc hệ thống:

```bash
cd StaffFlow/backend
npm run test:business
```

### Danh mục 17 Use Case được kiểm chứng tự động:
1. **Branch Invariant (OOP)**: Chặn xóa chi nhánh khi còn nhân viên đang trực thuộc (`errorCode: BRANCH_HAS_ACTIVE_EMPLOYEES`).
2. **Branch Invariant (OOP)**: Chặn xóa chi nhánh khi còn ca làm việc được phân công trong lịch (`errorCode: BRANCH_HAS_ACTIVE_ASSIGNMENTS`).
3. **Branch Invariant (OOP)**: Cho phép giải thể an toàn chi nhánh khi không còn ràng buộc dữ liệu.
4. **Branch Invariant (OOP)**: Tự động sinh mã nhân viên kế tiếp tuần tự (`EMP-001` -> `EMP-002` -> `EMP-003` -> `EMP-004`).
5. **Auth Bcrypt**: Mã hóa mật khẩu đạt chuẩn chuỗi Bcrypt 60 ký tự an toàn.
6. **Auth Bcrypt**: Xác thực chính xác mật khẩu đăng nhập của người dùng.
7. **Auth Bcrypt**: Từ chối tuyệt đối khi người dùng nhập sai mật khẩu.
8. **Auth Bcrypt**: Tương thích ngược và tự động chuyển đổi mật khẩu plaintext cũ sang Bcrypt.
9. **Hard Constraint (Giới tính)**: Chặn xếp nhân viên Nữ vào vai trò Bảo Vệ (`male_only`).
10. **Hard Constraint (Giới tính)**: Cho phép nhân viên Nam đủ kỹ năng đảm nhiệm vai trò Bảo Vệ.
11. **Hard Constraint (Kỹ năng)**: Chặn xếp nhân viên vào vị trí mà họ chưa được đào tạo kỹ năng.
12. **Shift Exchange**: Phiếu đổi ca chỉ định bắt buộc khởi tạo ở trạng thái `waiting_peer` (chờ đồng nghiệp xác nhận).
13. **Shift Exchange**: Khi đồng nghiệp bấm Từ chối, phiếu tự động bị từ chối (`rejected`) và dừng quy trình.
14. **Shift Exchange**: Khi đồng nghiệp bấm Đồng ý (`peer_accepted`), phiếu mới được đẩy lên hàng đợi Quản lý duyệt.
15. **Payroll Engine**: Tính lương cơ bản chính xác theo ca làm thực tế (Số giờ x Đơn giá theo thâm niên/vai trò).
16. **Payroll Engine**: Tính hệ số tăng ca OT chuẩn xác 1.5x trên đơn giá cơ bản.
17. **Payroll Engine**: Tự động tính toán khoản khấu trừ thiếu giờ chuẩn công (40h/tuần đối với nhân sự Full-time).

---

## 🌐 BẢNG THAM CHIẾU RESTful API

| Method | Endpoint | Mô Tả Chức Năng |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Xác thực đăng nhập an toàn với mã hoá Bcrypt |
| `GET` | `/api/initial-state` | Đồng bộ toàn bộ dữ liệu khởi động cho Frontend |
| `GET` | `/api/branches` | Lấy danh sách tất cả chi nhánh |
| `POST` | `/api/branches` | Tạo chi nhánh mới và tự động cấp tài khoản Admin chi nhánh |
| `PUT` | `/api/branches/:id` | Cập nhật cấu hình chi nhánh và mật khẩu Admin |
| `DELETE`| `/api/branches/:id` | Xóa/giải thể chi nhánh (bảo vệ ràng buộc OOP) |
| `GET` | `/api/users` | Lấy danh sách nhân sự (lọc theo `branchId`, `roleType`) |
| `POST` | `/api/users` | Thêm mới nhân sự và đồng bộ kỹ năng an toàn |
| `PUT` | `/api/users/:id` | Cập nhật hồ sơ, vai trò, trạng thái hoặc mật khẩu nhân viên |
| `DELETE`| `/api/users/:id` | Xóa hồ sơ nhân sự |
| `GET` | `/api/roles` | Lấy danh sách vai trò công việc |
| `POST` | `/api/roles` | Thêm mới vai trò và thiết lập giới tính/đơn giá |
| `PUT` | `/api/roles/:id` | Cập nhật vai trò |
| `GET` | `/api/line-configs` | Lấy khung giờ 3 ca chuẩn Line O (Open), M (Mid), D (Down) |
| `PUT` | `/api/line-configs` | Cập nhật giờ bắt đầu, kết thúc ca |
| `GET` | `/api/line-requirements` | Lấy định mức số lượng nhân sự theo ca |
| `PUT` | `/api/line-requirements` | Cập nhật định mức nhân sự |
| `GET` | `/api/availability` | Lấy danh sách đăng ký nguyện vọng làm việc tuần |
| `POST` | `/api/availability` | Nộp/lưu phiếu đăng ký nguyện vọng theo ngày |
| `GET` | `/api/schedules` | Lấy lịch làm việc tuần của chi nhánh |
| `POST` | `/api/schedules` | Lưu bản nháp lịch và toàn bộ phân công ca (shift assignments) |
| `PUT` | `/api/schedules/:id/publish` | Xuất bản lịch chính thức tới toàn bộ nhân viên |
| `GET` | `/api/shift-requests` | Lấy danh sách phiếu đổi ca, bán ca |
| `POST` | `/api/shift-requests` | Tạo phiếu đổi ca, nhượng ca hoặc mở bán trên Chợ ca |
| `PUT` | `/api/shift-requests/:id` | Cập nhật trạng thái phiếu (Peer Handshake / Nhận ca) |
| `PUT` | `/api/shift-requests/:id/approve` | Quản lý phê duyệt phiếu và tự động đảo ca trong lịch |
| `PUT` | `/api/shift-requests/:id/reject` | Quản lý từ chối phiếu |
| `POST` | `/api/payroll-ot` | Nhập và lưu số giờ tăng ca (OT) của nhân viên |
| `GET` | `/api/audit-logs` | Lấy danh sách nhật ký kiểm toán hệ thống bất biến |
| `POST` | `/api/reset-data` | Làm sạch toàn bộ dữ liệu mẫu (chỉ dành cho Super Admin) |
| `GET` | `/api/health` | Kiểm tra trạng thái máy chủ và kết nối Neon PostgreSQL |

---

## 🚢 HƯỚNG DẪN TRIỂN KHAI PRODUCTION (DEPLOYMENT)

### 1. Cơ sở dữ liệu (Neon PostgreSQL)
- Khởi tạo project miễn phí trên [Neon Console](https://console.neon.tech).
- Lấy chuỗi kết nối dạng `postgresql://...&sslmode=require`.

### 2. Triển khai Backend (Render / Railway / VPS)
- Đặt `Root Directory` là `backend`.
- Lệnh Build: `npm run build`.
- Lệnh Start: `npm run start`.
- Biến môi trường: Thiết lập `DATABASE_URL` và `PORT=5000`.

### 3. Triển khai Frontend (Vercel / Netlify / Cloudflare Pages)
- Đặt `Root Directory` là `frontend`.
- Lệnh Build: `npm run build`.
- Output Directory: `dist`.
- Biến môi trường: `VITE_API_URL=https://your-backend-api-domain.com`.

---

