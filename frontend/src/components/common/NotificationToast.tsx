import React from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { CheckCircle2, AlertTriangle, Info, AlertOctagon, X } from 'lucide-react';

export const NotificationToastContainer: React.FC = () => {
  const { toasts, removeToast } = useSchedule();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';

        const borderClass = isSuccess
          ? 'border-emerald-300 bg-white text-zinc-900'
          : isWarning
          ? 'border-amber-300 bg-white text-zinc-900'
          : isError
          ? 'border-rose-300 bg-white text-zinc-900'
          : 'border-zinc-300 bg-white text-zinc-900';

        const iconColor = isSuccess
          ? 'text-emerald-600'
          : isWarning
          ? 'text-amber-600'
          : isError
          ? 'text-rose-600'
          : 'text-blue-600';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 border shadow-md rounded-sm ${borderClass} transition-all animate-in slide-in-from-bottom-2 duration-200`}
          >
            <div className={`shrink-0 mt-0.5 ${iconColor}`}>
              {isSuccess && <CheckCircle2 size={16} />}
              {isWarning && <AlertTriangle size={16} />}
              {isError && <AlertOctagon size={16} />}
              {isInfo && <Info size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold tracking-tight">{toast.title}</h4>
              <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
