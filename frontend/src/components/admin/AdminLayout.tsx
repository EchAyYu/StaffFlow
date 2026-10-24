import React, { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { ScheduleMasterTab } from './ScheduleMasterTab';
import { StaffTab } from './StaffTab';
import { LineAndRolesTab } from './LineAndRolesTab';
import { AvailabilityMatrixTab } from './AvailabilityMatrixTab';
import { ShiftRequestsTab } from './ShiftRequestsTab';
import { PayrollTab } from './PayrollTab';
import { AuditLogTab } from './AuditLogTab';
import {
  CalendarDays,
  Users,
  Clock,
  CalendarCheck2,
  ArrowLeftRight,
  DollarSign,
  History,
  Building2,
  ChevronRight,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { currentBranchId, branches, schedule, employees, shiftRequests } = useSchedule();
  const [activeTab, setActiveTab] = useState<string>('schedule');

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const pendingRequestsCount = shiftRequests.filter(
    (r) => r.branchId === currentBranchId && r.status === 'pending'
  ).length;

  const navItems = [
    {
      id: 'schedule',
      label: 'Lịch Làm Master & AI',
      sublabel: 'Master Timetable Grid',
      icon: <CalendarDays size={16} />,
      badge: `${schedule.assignments.filter((a) => a.userId !== null).length}/${schedule.assignments.length}`,
    },
    {
      id: 'staff',
      label: 'Quản Lý Nhân Sự',
      sublabel: 'Skills & Demographics',
      icon: <Users size={16} />,
      badge: `${employees.filter((e) => e.branchId === currentBranchId).length}`,
    },
    {
      id: 'lines',
      label: 'Line O/M/D & Vai Trò',
      sublabel: 'Line Timing & Headcounts',
      icon: <Clock size={16} />,
    },
    {
      id: 'availability',
      label: 'Đăng Ký Khả Dụng',
      sublabel: 'O / M / D / A / OFF',
      icon: <CalendarCheck2 size={16} />,
    },
    {
      id: 'requests',
      label: 'Duyệt Đổi & Bán Ca',
      sublabel: 'Shift Exchange Review',
      icon: <ArrowLeftRight size={16} />,
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount} chờ` : undefined,
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    },
    {
      id: 'payroll',
      label: 'Bảng Lương & Giờ Làm',
      sublabel: 'End-of-day Calculation & OT',
      icon: <DollarSign size={16} />,
    },
    {
      id: 'audit',
      label: 'Nhật Ký Kiểm Toán',
      sublabel: 'Audit Trail & History',
      icon: <History size={16} />,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-[calc(100vh-3.5rem)] bg-[#f4f6fb]">
      {/* Mobile Top Navigation Scrollable Bar */}
      <div className="md:hidden sticky top-14 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-2xs">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label.split('&')[0].trim()}</span>
              {item.badge && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 font-bold'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex w-68 border-r border-slate-200/80 bg-white/90 backdrop-blur-md flex-col justify-between shrink-0 select-none">
        <div className="p-3.5 space-y-1.5">
          <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500/80 flex items-center gap-1.5">
            <Building2 size={12} />
            <span>Chi Nhánh: {currentBranch?.code || currentBranchId}</span>
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-950'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100/80 group-hover:text-indigo-600'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="truncate">
                    <p className="text-xs leading-tight">{item.label}</p>
                    <p
                      className={`text-[10px] font-mono leading-tight mt-0.5 ${
                        isActive ? 'text-indigo-100' : 'text-slate-400'
                      }`}
                    >
                      {item.sublabel}
                    </p>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shadow-2xs ${
                      item.badgeColor ||
                      (isActive
                        ? 'bg-white/20 text-white border-white/25'
                        : 'bg-slate-100 text-slate-600 border-slate-200/80 group-hover:bg-white')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-200/80 text-xs text-slate-500 bg-gradient-to-r from-slate-50 to-indigo-50/30 space-y-1.5">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-600 font-semibold">Level 2 Scheduler</span>
            <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
              READY
            </span>
          </div>
          <p className="text-[11px] text-indigo-950/70 leading-tight font-semibold">
            {currentBranch?.name || 'Chi Nhánh'}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-5 md:p-6 min-w-0 overflow-y-auto max-w-[1700px]">
        {/* Breadcrumb Header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3.5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-0.5">
              <span className="text-indigo-600 font-semibold">ADMIN CHI NHÁNH</span>
              <ChevronRight size={12} className="text-slate-300" />
              <span className="text-slate-700 font-semibold uppercase">
                {navItems.find((i) => i.id === activeTab)?.sublabel}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {navItems.find((i) => i.id === activeTab)?.label}
            </h1>
          </div>
        </div>

        {/* Tab Router */}
        {activeTab === 'schedule' && <ScheduleMasterTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'lines' && <LineAndRolesTab />}
        {activeTab === 'availability' && <AvailabilityMatrixTab />}
        {activeTab === 'requests' && <ShiftRequestsTab />}
        {activeTab === 'payroll' && <PayrollTab />}
        {activeTab === 'audit' && <AuditLogTab />}
      </main>
    </div>
  );
};
