import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { isNeonConfigured, pool } from './db';
import { runStartupMigrations } from './migrations/schemaMigration';
import { authRouter } from './routes/auth.routes';
import { branchesRouter } from './routes/branches.routes';
import { rolesRouter, lineConfigsRouter, lineRequirementsRouter } from './routes/rolesLines.routes';
import { usersRouter } from './routes/users.routes';
import { availabilityRouter } from './routes/availability.routes';
import { schedulesRouter } from './routes/schedules.routes';
import { shiftRequestsRouter } from './routes/shiftRequests.routes';
import { systemRouter } from './routes/system.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Startup Schema Sync & Password Migrations (chỉ chạy khi server khởi động ở dev/local, tránh lock DB trên serverless cold start)
if (isNeonConfigured && !process.env.VERCEL) {
  runStartupMigrations(pool).catch((err) => {
    console.warn('[Startup Migration Warning]:', err.message);
  });
}

// Router gom toàn bộ API routes
const apiRouter = express.Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/branches', branchesRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/line-configs', lineConfigsRouter);
apiRouter.use('/line-requirements', lineRequirementsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/availability', availabilityRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/shift-requests', shiftRequestsRouter);
apiRouter.use('/', systemRouter);

// Đăng ký ở cả '/api' và '/' để tương thích cả localhost lẫn Vercel Serverless (nếu route prefix bị strip)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Start Server khi chạy dev/local
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 StaffFlow Node.js Backend Server chạy tại: http://localhost:${PORT}`);
    console.log(`📡 Neon PostgreSQL: ${isNeonConfigured ? 'ĐÃ KẾT NỐI VÀ HOẠT ĐỘNG' : 'Sử dụng Mock State'}`);
    console.log(`====================================================`);
  });
}

// Export cho Vercel Serverless Function
export default app;
