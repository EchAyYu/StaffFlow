import React from 'react';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { Header } from './components/common/Header';
import { LoginView } from './components/auth/LoginView';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { AdminLayout } from './components/admin/AdminLayout';
import { EmployeeLayout } from './components/employee/EmployeeLayout';
import { NotificationToastContainer } from './components/common/NotificationToast';

const AppContent: React.FC = () => {
  const { currentUser, currentRoleType } = useSchedule();

  // If user is logged out, show the Minimalist Login View
  if (!currentUser) {
    return (
      <>
        <LoginView />
        <NotificationToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-zinc-900 font-sans">
      {/* Global Operational Header */}
      <Header />

      {/* Role-Based Workspace Routing: Super Admin / Branch Admin / Employee */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentRoleType === 'super_admin' ? (
          <div className="flex-1 p-6 overflow-y-auto">
            <SuperAdminDashboard />
          </div>
        ) : currentRoleType === 'branch_admin' ? (
          <AdminLayout />
        ) : (
          <EmployeeLayout />
        )}
      </div>

      {/* Toast Notification Layer */}
      <NotificationToastContainer />
    </div>
  );
};

export function App() {
  return (
    <ScheduleProvider>
      <AppContent />
    </ScheduleProvider>
  );
}

export default App;
