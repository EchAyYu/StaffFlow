import React from 'react';
import { LineCode, AvailabilityChoice, ScheduleStatus, ShiftRequestStatus, EmploymentType, Gender } from '../../types';
import {
  LINE_META,
  AVAILABILITY_OPTIONS,
  SCHEDULE_STATUS_CONFIG,
  REQUEST_STATUS_CONFIG,
} from '../../utils/formatters';
import { Shield, Coffee, Utensils, Flame, Package } from 'lucide-react';

// 1. Role Badge
export const RoleBadge: React.FC<{ roleCode: string; roleName: string; size?: 'sm' | 'md' }> = ({
  roleCode,
  roleName,
  size = 'md',
}) => {
  const getRoleStyle = (code: string) => {
    switch (code) {
      case 'SEC':
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <Shield size={11} className="text-slate-600" />,
        };
      case 'BAR':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          icon: <Coffee size={11} className="text-amber-600" />,
        };
      case 'SRV':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          icon: <Utensils size={11} className="text-emerald-600" />,
        };
      case 'KIT':
        return {
          bg: 'bg-orange-50 text-orange-800 border-orange-300',
          icon: <Flame size={11} className="text-orange-600" />,
        };
      case 'INV':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-300',
          icon: <Package size={11} className="text-indigo-600" />,
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: null,
        };
    }
  };

  const style = getRoleStyle(roleCode);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-md font-sans uppercase tracking-wide shadow-2xs ${style.bg} ${sizeClasses}`}
    >
      {style.icon}
      <span>{roleName}</span>
    </span>
  );
};

// 2. Line Badge (Line O, M, D)
export const LineBadge: React.FC<{ lineCode: LineCode; size?: 'sm' | 'md' }> = ({ lineCode, size = 'md' }) => {
  const meta = LINE_META[lineCode];
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs font-bold';

  return (
    <span className={`inline-flex items-center border font-mono rounded-md uppercase shadow-2xs ${meta.badgeClass} ${sizeClasses}`}>
      {meta.shortName}
    </span>
  );
};

// 3. Availability Choice Badge
export const AvailabilityBadge: React.FC<{ choice: AvailabilityChoice; size?: 'sm' | 'md' }> = ({
  choice,
  size = 'md',
}) => {
  const opt = AVAILABILITY_OPTIONS[choice] || AVAILABILITY_OPTIONS.A;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center border font-mono rounded-md uppercase shadow-2xs ${opt.badgeClass} ${sizeClasses}`}>
      {opt.label}
    </span>
  );
};

// 4. Schedule Status Badge (Draft / Published / Changed)
export const ScheduleStatusBadge: React.FC<{ status: ScheduleStatus; version?: number }> = ({
  status,
  version = 1,
}) => {
  const config = SCHEDULE_STATUS_CONFIG[status] || SCHEDULE_STATUS_CONFIG.draft;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[11px] font-bold rounded-lg uppercase tracking-wide shadow-2xs ${config.badgeClass}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{config.label}</span>
      {status === 'changed' && <span className="opacity-80">v{version}</span>}
    </span>
  );
};

// 5. Shift Request Status Badge (Pending / Approved / Rejected)
export const RequestStatusBadge: React.FC<{ status: ShiftRequestStatus }> = ({ status }) => {
  const config = REQUEST_STATUS_CONFIG[status] || REQUEST_STATUS_CONFIG.pending;

  return (
    <span className={`inline-flex items-center border font-mono text-[11px] px-2.5 py-0.5 rounded-md shadow-2xs ${config.badgeClass}`}>
      {config.label}
    </span>
  );
};

// 6. Contract Badge
export const ContractBadge: React.FC<{ type: EmploymentType }> = ({ type }) => {
  const isFullTime = type === 'full_time';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono border shadow-2xs ${
        isFullTime
          ? 'bg-blue-50 text-blue-800 border-blue-200 font-semibold'
          : 'bg-slate-100 text-slate-700 border-slate-300'
      }`}
    >
      {isFullTime ? 'Full-Time (8h/ngày)' : 'Part-Time (Linh hoạt)'}
    </span>
  );
};

// 7. Gender Badge
export const GenderBadge: React.FC<{ gender: Gender }> = ({ gender }) => {
  const isMale = gender === 'male';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono border shadow-2xs ${
        isMale ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-pink-50 text-pink-800 border-pink-200'
      }`}
    >
      {isMale ? 'Nam' : 'Nữ'}
    </span>
  );
};
