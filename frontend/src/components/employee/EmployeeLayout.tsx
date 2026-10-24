import React, { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { MyScheduleTab } from './MyScheduleTab';
import { RegisterAvailabilityTab } from './RegisterAvailabilityTab';
import { ShiftExchangeTab } from './ShiftExchangeTab';
import {
  CalendarDays,
  CalendarCheck,
  ArrowLeftRight,
  ChevronRight,
  User,
  Clock,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { ContractBadge } from '../common/Badge';

export const EmployeeLayout: React.FC = () => {
  const {
    currentUser,
    schedule,
    payrollRecords,
    shiftRequests,
    activeTab: contextTab,
    setActiveTab: setContextTab,
    currentBranchId,
  } = useSchedule();

  const [localTab, setLocalTab] = useState<'schedule' | 'register' | 'exchange'>('schedule');

  if (!currentUser) return null;

  const activeTab: 'schedule' | 'register' | 'exchange' =
    contextTab === 'schedule' || contextTab === 'register' || contextTab === 'exchange'
      ? contextTab
      : localTab;

  const handleTabChange = (tab: 'schedule' | 'register' | 'exchange') => {
    setLocalTab(tab);
    setContextTab(tab);
  };

  const myPayroll = payrollRecords.find((p) => p.userId === currentUser.id);
  const myAssignedCount = schedule.assignments.filter(
    (a) =>
      a.userId === currentUser.id &&
      (a.branchId ? a.branchId === currentBranchId : schedule.branchId ? schedule.branchId === currentBranchId : true)
  ).length;
  const myPendingRequests = shiftRequests.filter(
    (r) => r.requesterId === currentUser.id && r.branchId === currentBranchId && r.status === 'pending'
  ).length;
  const openMarketCount = shiftRequests.filter(
    (r) => r.branchId === currentBranchId && r.isOpenMarket && r.status === 'pending' && !r.claimedByUserId
  ).length;

  const tabs = [
    {
      id: 'schedule' as const,
      label: 'Lịch Làm Của Tôi',
      sublabel: 'Bảng ca ngày & Lịch tuần',
      icon: <CalendarDays size={17} />,
      badge: `${myAssignedCount} ca (${(myPayroll?.completedHours || 0) + (myPayroll?.projectedHours || 0)}h)`,
    },
    {
      id: 'register' as const,
      label: 'Đăng Ký Khả Dụng',
      sublabel: 'Line O/M/D & Giờ tùy chọn',
      icon: <CalendarCheck size={17} />,
    },
    {
      id: 'exchange' as const,
      label: 'Đổi Ca & Chợ Ca',
      sublabel: 'Chợ ca công khai & Đổi ca',
      icon: <ArrowLeftRight size={17} />,
      badge: openMarketCount > 0 ? `Chợ ca: ${openMarketCount}` : myPendingRequests > 0 ? `${myPendingRequests} chờ` : undefined,
      badgeColor: openMarketCount > 0 ? 'bg-blue-600 text-white' : undefined,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-[calc(100vh-3.5rem)] bg-[#f4f6fb]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex w-68 border-r border-slate-200/80 bg-white/90 backdrop-blur-md flex-col justify-between shrink-0 select-none">
        <div className="p-3.5 space-y-1.5">
          <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500/80">
            Cổng Nhân Viên (Staff Portal)
          </div>

          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-950'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100/80 group-hover:text-indigo-600'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <div className="truncate">
                    <p className="text-xs leading-tight">{tab.label}</p>
                    <p
                      className={`text-[10px] font-mono leading-tight mt-0.5 ${
                        isActive ? 'text-indigo-100' : 'text-slate-400'
                      }`}
                    >
                      {tab.sublabel}
                    </p>
                  </div>
                </div>

                {tab.badge && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shadow-2xs ${
                      tab.badgeColor
                        ? tab.badgeColor
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-3.5 border-t border-slate-200/80 text-xs text-slate-500 bg-gradient-to-r from-slate-50 to-indigo-50/30 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold shadow-sm shadow-indigo-500/20">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-xs truncate">{currentUser.name}</p>
              <p className="font-mono text-[10px] text-indigo-600 font-semibold truncate">{currentUser.employeeCode}</p>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 leading-tight">
            Chi Nhánh: <b className="text-slate-800">{currentUser.branchId}</b> • {currentUser.employmentType === 'full_time' ? 'Full-Time (≥8h)' : 'Part-Time'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-5 md:p-6 pb-24 md:pb-6 min-w-0 overflow-y-auto max-w-[1700px]">
        {/* Breadcrumb Header */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3.5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-0.5">
              <span className="text-indigo-600 font-semibold">CỔNG NHÂN VIÊN</span>
              <ChevronRight size={12} className="text-slate-300" />
              <span className="text-slate-700 font-semibold uppercase">
                {tabs.find((t) => t.id === activeTab)?.sublabel}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
        </div>

        {/* Module views */}
        {activeTab === 'schedule' && <MyScheduleTab />}
        {activeTab === 'register' && <RegisterAvailabilityTab />}
        {activeTab === 'exchange' && <ShiftExchangeTab />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
                isActive ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none">
                {tab.id === 'schedule' ? 'Lịch của tôi' : tab.id === 'register' ? 'Đăng ký ca' : 'Đổi / Chợ ca'}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
