import React, { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { Shield, Clock, Search, History, Filter } from 'lucide-react';

export const AuditLogTab: React.FC = () => {
  const { auditLogs, currentBranchId } = useSchedule();
  const [searchQuery, setSearchQuery] = useState('');

  const branchLogs = auditLogs.filter((log) => {
    if (log.branchId !== currentBranchId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.actionType.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
            <History size={16} className="text-zinc-700" />
            Nhật Ký Kiểm Toán & Lịch Sử Nghiệp Vụ (Audit Trail)
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Lưu vết tự động toàn bộ thay đổi lịch làm, phê duyệt đổi/bán ca, cấu hình định mức và cập nhật lương.
          </p>
        </div>

        <span className="font-mono text-xs px-2.5 py-1 bg-slate-50 border border-zinc-200">
          {branchLogs.length} sự kiện ghi nhận
        </span>
      </div>

      <div className="bg-white border border-zinc-200 p-2.5 rounded-none flex items-center justify-between gap-3 shadow-xs">
        <div className="relative min-w-[240px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo người thực hiện, hành động..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-300 font-mono"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-zinc-200 rounded-none shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-zinc-600 font-semibold border-b border-zinc-200 uppercase font-mono text-[11px]">
                <th className="py-2.5 px-4 w-44">Thời Gian</th>
                <th className="py-2.5 px-4 w-52">Người Thực Hiện</th>
                <th className="py-2.5 px-4 w-48">Hành Động Nghiệp Vụ</th>
                <th className="py-2.5 px-4">Chi Tiết Thay Đổi & Lý Do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-mono">
              {branchLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-zinc-400">
                    Chưa có nhật ký ghi nhận nào.
                  </td>
                </tr>
              ) : (
                branchLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-zinc-500 font-medium">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-zinc-900">
                      {log.actorName}
                    </td>
                    <td className="py-3 px-4 font-bold text-zinc-800">
                      <span className="px-1.5 py-0.5 bg-slate-100 border border-zinc-300 text-[10px]">
                        {log.actionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-zinc-700 leading-relaxed">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
