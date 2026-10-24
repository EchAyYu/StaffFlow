import React from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { NotificationBell } from './NotificationBell';
import {
  CalendarDays,
  LogOut,
  Building2,
  Sparkles,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    currentRoleType,
    currentBranchId,
    branches,
    logout,
    schedule,
  } = useSchedule();

  const currentBranch = branches.find((b) => b.id === currentBranchId) || branches[0];

  return (
    <header className="h-14 bg-white/95 backdrop-blur-md border-b border-indigo-100/80 px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 select-none shadow-xs">
      {/* Brand & Branch Selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-2.5 pr-2 sm:pr-3 border-r border-slate-200/80 shrink-0">
          <img
            src="/StaffFlow.jpg"
            alt="StaffFlow Logo"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo/logo.jpg';
            }}
            className="h-7 sm:h-8 w-auto object-contain rounded-lg shadow-2xs"
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-xs sm:text-sm tracking-tight bg-gradient-to-r from-indigo-950 via-indigo-800 to-blue-700 bg-clip-text text-transparent leading-none">
              StaffFlow
            </span>
            <span className="hidden sm:inline text-[9px] font-medium text-slate-500 tracking-tight leading-none mt-0.5">
              Employee Management
            </span>
          </div>
          <span className="hidden sm:inline text-[10px] font-mono uppercase px-2 py-0.5 bg-indigo-50 border border-indigo-200/80 text-indigo-700 rounded-full font-semibold ml-1">
            v2.0
          </span>
        </div>

        {/* Static Branch / HQ Indicator (No dropdown switcher to protect security boundary) */}
        {currentRoleType === 'super_admin' ? (
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs">
            <Building2 size={13} className="text-indigo-600 shrink-0" />
            <span className="font-bold text-indigo-950 truncate">Hội Sở / Toàn Hệ Thống</span>
            <span className="font-mono text-[10px] text-indigo-600 font-semibold shrink-0">({branches.length})</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-indigo-50/60 border border-indigo-200/70 rounded-xl text-xs max-w-[160px] md:max-w-none">
            <Building2 size={13} className="text-indigo-600 shrink-0" />
            <span className="font-bold text-indigo-950 truncate">{currentBranch?.name || 'Chi Nhánh'}</span>
            {currentBranch?.code && (
              <span className="hidden md:inline font-mono text-[10px] text-indigo-600/80 font-semibold">({currentBranch.code})</span>
            )}
          </div>
        )}

        {/* Schedule Period & Status */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 border-l border-slate-200/80 pl-3">
          <CalendarDays size={14} className="text-indigo-500" />
          <span className="font-mono text-slate-800 font-semibold">Tuần 42</span>
          <span className="text-slate-300">•</span>
          <span className="font-mono text-slate-600">19/10 - 25/10/2026</span>
          <span className="text-slate-300">•</span>
          <span
            className={`font-mono text-[11px] px-2.5 py-0.5 border rounded-full uppercase font-bold shadow-2xs ${
              schedule.status === 'published'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : schedule.status === 'changed'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {schedule.status === 'published'
              ? 'LỊCH ĐÃ CÔNG KHAI'
              : schedule.status === 'changed'
              ? `LỊCH ĐÃ ĐIỀU CHỈNH (v${schedule.version})`
              : 'LỊCH BẢN NHÁP (DRAFT)'}
          </span>
        </div>
      </div>

      {/* Right Controls: Notification Bell, Current User Info & Direct Logout Button */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Notification Bell with red pulse dot */}
        <NotificationBell />

        {/* User Info Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 bg-slate-50/90 border border-slate-200/80 rounded-xl text-left shadow-2xs">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold shadow-xs shadow-indigo-500/20">
            {currentUser?.name.charAt(0) || 'U'}
          </div>
          <div className="max-w-[85px] sm:max-w-none">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
              <span className="truncate">{currentUser?.name || 'Khách'}</span>
              <span
                className={`hidden md:inline text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                  currentRoleType === 'super_admin'
                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                    : currentRoleType === 'branch_admin'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                }`}
              >
                {currentRoleType === 'super_admin'
                  ? 'ADMIN TỔNG'
                  : currentRoleType === 'branch_admin'
                  ? 'ADMIN CHI NHÁNH'
                  : 'NHÂN VIÊN'}
              </span>
            </div>
          </div>
        </div>

        {/* Direct Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl transition-all font-semibold shadow-2xs cursor-pointer"
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};
