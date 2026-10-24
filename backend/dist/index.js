import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, isNeonConfigured } from './db.js';
import { runStartupMigrations } from './migrations/schemaMigration.js';
import { authRouter } from './routes/auth.routes.js';
import { branchesRouter } from './routes/branches.routes.js';
import { rolesRouter, lineConfigsRouter, lineRequirementsRouter } from './routes/rolesLines.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { availabilityRouter } from './routes/availability.routes.js';
import { schedulesRouter } from './routes/schedules.routes.js';
import { shiftRequestsRouter } from './routes/shiftRequests.routes.js';
import { systemRouter } from './routes/system.routes.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// Standard Middlewares
app.use(cors());
app.use(express.json());
// Startup Schema Sync & Password Migrations
if (isNeonConfigured) {
    runStartupMigrations(pool).catch((err) => {
        console.warn('[Startup Migration Warning]:', err.message);
    });
}
// Route Registrations
app.use('/api/auth', authRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/line-configs', lineConfigsRouter);
app.use('/api/line-requirements', lineRequirementsRouter);
app.use('/api/users', usersRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/shift-requests', shiftRequestsRouter);
app.use('/api', systemRouter);
// Start Server
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 StaffFlow Node.js Backend Server chạy tại: http://localhost:${PORT}`);
        console.log(`📡 Neon PostgreSQL: ${isNeonConfigured ? 'ĐÃ KẾT NỐI VÀ HOẠT ĐỘNG' : 'Sử dụng Mock State'}`);
        console.log(`====================================================`);
    });
}
export default app;
