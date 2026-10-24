import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  ShoppingBag,
  CalendarDays,
  Clock,
  X,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'request' | 'market' | 'schedule' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionTab?: string;
  badge?: string;
}

export const NotificationBell: React.FC = () => {
  const {
    currentUser,
    currentRoleType,
    currentBranchId,
    shiftRequests,
    schedule,
    setActiveTab,
    branches,
  } = useSchedule();

  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('staffflow_read_notifications');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Save read state to sessionStorage
  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem('staffflow_read_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(new Set(allIds));
    try {
      sessionStorage.setItem('staffflow_read_notifications', JSON.stringify(allIds));
    } catch {}
  };

  // Build notifications dynamically based on role and active events
  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    // ==========================================
    // 1. ROLE: ADMIN CHI NHÁNH (Branch Admin)
    // ==========================================
    if (currentRoleType === 'branch_admin') {
      // A. Pending Shift Requests from Staff
      const pendingReqs = shiftRequests.filter(
        (r) => r.branchId === currentBranchId && r.status === 'pending'
      );
      pendingReqs.forEach((r) => {
        const isMarket = r.isOpenMarket;
        const isWaitingPeer = r.peerStatus === 'waiting_peer';
        const isPeerAccepted = r.peerStatus === 'peer_accepted';
        items.push({
          id: `req-${r.id}-${r.peerStatus || 'none'}`,
          type: 'request',
          title: isMarket
            ? r.claimedByUserId
              ? `Chợ ca: ${r.claimedByUserName} muốn nhận ca`
              : `Chợ ca: ${r.requesterName} mở bán ca`
            : isWaitingPeer
            ? `⏳ Chờ đồng nghiệp xác nhận: ${r.requesterName}`
            : r.requestType === 'swap'
            ? `🤝 Sẵn sàng duyệt đổi ca: ${r.requesterName}`
            : r.requestType === 'sale'
            ? `🤝 Sẵn sàng duyệt bán ca: ${r.requesterName}`
            : `Đơn xin nghỉ ca: ${r.requesterName}`,
          message: isMarket && r.claimedByUserId
            ? `${r.claimedByUserName} đã xin nhận ca [Thứ ${r.day}] từ ${r.requesterName}. Cần bạn phê duyệt.`
            : isWaitingPeer
            ? `${r.requesterName} gửi phiếu cho ${r.targetUserName} [Thứ ${r.day}]. Đang chờ ${r.targetUserName} bấm Đồng Ý (Bước 1/2).`
            : isPeerAccepted && r.targetUserName
            ? `Đồng nghiệp ${r.targetUserName} đã ĐỒNG Ý nhận/đổi ca [Thứ ${r.day}] với ${r.requesterName}. Sẵn sàng để Admin duyệt (Bước 2/2).`
            : `${r.requesterName} gửi yêu cầu cho ca [Thứ ${r.day}]${r.lineCode ? ` (Line ${r.lineCode})` : ''}: "${r.reason}"`,
          timestamp: 'Vừa xong',
          isRead: readIds.has(`req-${r.id}-${r.peerStatus || 'none'}`),
          actionTab: 'requests',
          badge: isMarket ? 'Chợ Ca' : isWaitingPeer ? 'Bước 1/2' : 'Duyệt Ca',
        });
      });

      // B. Shortage Warnings on Schedule
      if (schedule.shortageWarnings.length > 0) {
        items.push({
          id: `shortage-${schedule.id}`,
          type: 'warning',
          title: 'Cảnh báo thiếu nhân sự trong tuần',
          message: `Lịch tuần hiện có ${schedule.shortageWarnings.length} vị trí line chưa đủ người. Hãy kiểm tra đề xuất đặc cách (Override).`,
          timestamp: 'Tuần này',
          isRead: readIds.has(`shortage-${schedule.id}`),
          actionTab: 'schedule',
          badge: 'Thiếu người',
        });
      }
    }

    // ==========================================
    // 2. ROLE: NHÂN VIÊN (Employee)
    // ==========================================
    else if (currentRoleType === 'employee') {
      // A0. Incoming Peer Handshake Requests (Nghiệp vụ 4: Xác nhận 2 bước)
      const incomingPeerReqs = shiftRequests.filter(
        (r) =>
          r.branchId === currentBranchId &&
          r.targetUserId === currentUser?.id &&
          !r.isOpenMarket &&
          r.status === 'pending' &&
          r.peerStatus === 'waiting_peer'
      );
      incomingPeerReqs.forEach((r) => {
        items.push({
          id: `peer-${r.id}`,
          type: 'request',
          title: `🤝 Lời mời ${r.requestType === 'swap' ? 'Đổi ca' : 'Nhận ca'} cần bạn xác nhận`,
          message: `Đồng nghiệp ${r.requesterName} muốn ${r.requestType === 'swap' ? 'đổi ca' : 'chuyển ca'} [Thứ ${r.day} - Line ${r.lineCode}] với bạn. Bấm để Đồng ý hoặc Từ chối (Bước 1/2).`,
          timestamp: 'Cần xác nhận',
          isRead: readIds.has(`peer-${r.id}`),
          actionTab: 'exchange',
          badge: 'Xác Nhận 2 Bước',
        });
      });

      // A. Schedule Published
      if (schedule.status === 'published' || schedule.status === 'changed') {
        items.push({
          id: `pub-${schedule.id}-${schedule.version}`,
          type: 'schedule',
          title: schedule.status === 'published' ? 'Lịch làm việc đã xuất bản' : `Lịch làm việc cập nhật (v${schedule.version})`,
          message: `Quản lý chi nhánh đã xuất bản lịch làm việc chính thức cho Tuần 42. Bấm để xem ca của bạn.`,
          timestamp: schedule.publishedAt || 'Mới cập nhật',
          isRead: readIds.has(`pub-${schedule.id}-${schedule.version}`),
          actionTab: 'schedule',
          badge: 'Lịch Mới',
        });
      }

      // B. My Shift Requests Response (Approved / Rejected)
      const myAnsweredReqs = shiftRequests.filter(
        (r) => r.requesterId === currentUser?.id && r.branchId === currentBranchId && r.status !== 'pending'
      );
      myAnsweredReqs.forEach((r) => {
        items.push({
          id: `res-${r.id}-${r.status}`,
          type: r.status === 'approved' ? 'info' : 'warning',
          title: r.status === 'approved' ? 'Yêu cầu của bạn ĐƯỢC DUYỆT' : 'Yêu cầu của bạn BỊ TỪ CHỐI',
          message: `Phiếu [${r.id}] xin ${r.requestType === 'swap' ? 'đổi ca' : r.requestType === 'sale' ? 'bán ca' : 'nghỉ thêm'} ngày Thứ ${r.day}: "${r.reviewNote || (r.status === 'approved' ? 'Đã duyệt' : 'Từ chối')}"`,
          timestamp: 'Gần đây',
          isRead: readIds.has(`res-${r.id}-${r.status}`),
          actionTab: 'exchange',
          badge: r.status === 'approved' ? 'Thành công' : 'Từ chối',
        });
      });

      // C. Open Market Shifts Available
      const marketShifts = shiftRequests.filter(
        (r) =>
          r.branchId === currentBranchId &&
          r.isOpenMarket &&
          r.status === 'pending' &&
          r.requesterId !== currentUser?.id &&
          !r.claimedByUserId
      );
      marketShifts.forEach((r) => {
        items.push({
          id: `mkt-${r.id}`,
          type: 'market',
          title: `Chợ ca mở: Có ca trống cần người nhận`,
          message: `Đồng nghiệp ${r.requesterName} mở bán ca Thứ ${r.day} Line ${r.lineCode}. Bạn có thể nhận ca ngay để tăng thu nhập!`,
          timestamp: 'Đang mở',
          isRead: readIds.has(`mkt-${r.id}`),
          actionTab: 'exchange',
          badge: 'Chợ Ca',
        });
      });
    }

    // ==========================================
    // 3. ROLE: ADMIN TỔNG (Super Admin)
    // ==========================================
    else if (currentRoleType === 'super_admin') {
      const allPending = shiftRequests.filter((r) => r.status === 'pending');
      if (allPending.length > 0) {
        items.push({
          id: `sa-pending-${allPending.length}`,
          type: 'request',
          title: 'Yêu cầu ca đang chờ duyệt toàn hệ thống',
          message: `Toàn hệ thống hiện có ${allPending.length} phiếu đổi ca/bán ca đang chờ các chi nhánh xử lý.`,
          timestamp: 'Toàn hệ thống',
          isRead: readIds.has(`sa-pending-${allPending.length}`),
          actionTab: 'branches',
          badge: 'Hệ Thống',
        });
      }
      items.push({
        id: `sa-branches-${branches.length}`,
        type: 'info',
        title: 'Trạng thái mạng lưới chi nhánh',
        message: `Hệ thống hiện vận hành ổn định ${branches.length} chi nhánh với kiểm soát OOP chặt chẽ.`,
        timestamp: 'Hôm nay',
        isRead: readIds.has(`sa-branches-${branches.length}`),
        actionTab: 'branches',
        badge: 'Cơ Sở',
      });
    }

    return items;
  }, [currentRoleType, currentBranchId, shiftRequests, schedule, readIds, currentUser, branches]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.actionTab) {
      setActiveTab(item.actionTab);
    }
    setIsOpen(false);
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'request':
        return <ArrowLeftRight size={15} className="text-purple-600" />;
      case 'market':
        return <ShoppingBag size={15} className="text-blue-600" />;
      case 'schedule':
        return <CalendarDays size={15} className="text-emerald-600" />;
      case 'warning':
        return <AlertTriangle size={15} className="text-amber-600" />;
      default:
        return <CheckCircle2 size={15} className="text-indigo-600" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500/20'
            : unreadCount > 0
            ? 'bg-indigo-50/80 text-indigo-600 hover:bg-indigo-100 border border-indigo-200/80 shadow-2xs'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
        }`}
        title="Trung tâm thông báo"
      >
        <Bell size={17} />

        {/* Pulsating Red Badge if unread */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-300/40 z-50 overflow-hidden text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-indigo-100 text-indigo-700">
                <Bell size={14} />
              </span>
              <span className="font-extrabold text-slate-900 tracking-tight text-xs">
                Thông Báo Hệ Thống
              </span>
              {unreadCount > 0 && (
                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border border-rose-200">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1.5">
                <Sparkles size={24} className="mx-auto text-slate-300" />
                <p className="font-medium text-slate-600 text-xs">Bạn đã xem hết thông báo!</p>
                <p className="text-[11px] text-slate-400">Không có thông báo mới nào vào lúc này.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                    !item.isRead
                      ? 'bg-indigo-50/40 hover:bg-indigo-50/70'
                      : 'hover:bg-slate-50/80 opacity-80'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`font-bold truncate text-[11px] ${!item.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                      <span>{item.timestamp}</span>
                      <span className="text-indigo-600 font-sans font-medium flex items-center gap-0.5">
                        Xem chi tiết <ChevronRight size={10} />
                      </span>
                    </div>
                  </div>

                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-mono">
            StaffFlow Smart Alert • Tự động cập nhật thời gian thực
          </div>
        </div>
      )}
    </div>
  );
};
