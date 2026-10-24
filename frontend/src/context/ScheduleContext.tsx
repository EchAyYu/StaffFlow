import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import {
  Branch,
  BusinessRole,
  Employee,
  LineConfig,
  LineRequirement,
  AvailabilityRegistration,
  WeeklySchedule,
  ShiftAssignment,
  ShiftRequest,
  PayrollRecord,
  AuditLog,
  RoleType,
  DayOfWeek,
  LineCode,
  AvailabilityChoice,
  ScheduleStatus,
} from '../types';
import {
  MOCK_BRANCHES,
  MOCK_ROLES,
  MOCK_LINE_CONFIGS,
  MOCK_LINE_REQUIREMENTS,
  MOCK_EMPLOYEES,
  MOCK_REGISTRATIONS,
  MOCK_SHIFT_REQUESTS,
  MOCK_AUDIT_LOGS,
} from '../data/mockData';
import {
  CURRENT_WEEK_START,
  CURRENT_WEEK_END,
  DAYS_OF_WEEK,
  calculateHoursBetween,
  calculateShiftHourlyRate,
  checkShiftEligibility,
} from '../utils/formatters';
import { runBusinessScheduler, SolverStepLog } from '../utils/schedulerSolver';
import { BranchEntity } from '../domain/BranchModel';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
}

interface ScheduleContextType {
  // 1. Auth & Branches
  currentUser: Employee | null;
  currentRoleType: RoleType;
  currentBranchId: string;
  branches: Branch[];
  switchBranch: (branchId: string) => void;
  loginAs: (userId: string) => void;
  loginWithUser: (user: Employee, branch?: Branch | null) => void;
  logout: () => void;
  switchRoleType: (role: RoleType) => void;

  // 2. Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // 3. Branches (Super Admin)
  addBranch: (branch: Omit<Branch, 'id'>) => void;
  updateBranch: (id: string, updates: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  resetAllDataClean: () => void;

  // 4. Employees & Capabilities
  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  toggleEmployeeStatus: (id: string) => void;

  // 5. Roles & Skills
  roles: BusinessRole[];
  addRole: (role: Omit<BusinessRole, 'id'>) => void;
  updateRole: (id: string, updates: Partial<BusinessRole>) => void;

  // 6. Line Configs (O, M, D) & Requirements
  lineConfigs: LineConfig[];
  lineRequirements: LineRequirement[];
  updateLineConfig: (lineCode: LineCode, updates: Partial<LineConfig>) => void;
  updateLineRequirement: (lineCode: LineCode, roleId: string, count: number) => void;

  // 7. Registrations (O/M/D/A/OFF)
  registrations: AvailabilityRegistration[];
  saveAvailability: (
    userId: string,
    slots: Record<DayOfWeek, AvailabilityChoice>,
    note?: string,
    dayCustomHours?: Partial<Record<DayOfWeek, string>>
  ) => void;

  // 8. Master Schedule Grid (Draft -> Published -> Changed)
  schedule: WeeklySchedule;
  schedulesByBranch: Record<string, WeeklySchedule>;
  autoGenerateSchedule: () => Promise<void>;
  publishSchedule: () => void;
  manualAssignSlot: (
    assignmentId: string,
    userId: string | null,
    reason?: string,
    customHours?: { startTime?: string; endTime?: string }
  ) => void;
  confirmOverride: (assignmentId: string, userId: string, reason: string) => void;
  clearSchedule: () => void;

  // 9. Shift Requests (Đổi ca / Bán ca / Chợ ca công khai / Peer Handshake)
  shiftRequests: ShiftRequest[];
  createShiftRequest: (req: Omit<ShiftRequest, 'id' | 'status' | 'createdAt' | 'branchId'>) => void;
  respondToPeerRequest: (requestId: string, decision: 'accept' | 'decline') => void;
  reviewShiftRequest: (requestId: string, status: 'approved' | 'rejected', reviewNote: string) => void;
  claimOpenMarketShift: (requestId: string, employeeId: string, employeeName: string) => void;

  // 10. Payroll & Automatic Hours
  payrollRecords: PayrollRecord[];
  updateEmployeeOT: (userId: string, otHours: number) => void;

  // 11. Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (actionType: string, entityType: string, details: string) => void;

  // 12. Solver Simulation State
  isSolving: boolean;
  solverLogs: SolverStepLog[];
  showSolverModal: boolean;
  closeSolverModal: () => void;

  // 13. System Utilities
  resetToMockData: () => void;
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'warning' | 'info' | 'error', title: string, message: string) => void;
  removeToast: (id: string) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

const API_BASE_URL =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:5000';

const LEGACY_STORAGE_PREFIX = 'optishift_clean_v4_';
const STORAGE_PREFIX = 'staffflow_v1_';
const SYNC_CHANNEL_NAME = 'staffflow_cross_tab_sync';

function createEmptySchedule(branchId: string): WeeklySchedule {
  return {
    id: `SCH-${branchId || 'INIT'}-${CURRENT_WEEK_START}`,
    branchId: branchId || '',
    weekStartDate: CURRENT_WEEK_START,
    weekEndDate: CURRENT_WEEK_END,
    status: 'draft',
    version: 1,
    publishedAt: undefined,
    publishedBy: undefined,
    lastModifiedAt: new Date().toISOString(),
    assignments: [],
    shortageWarnings: [],
    overrideProposals: [],
  };
}

// Unique session ID for each opened browser tab
const tabSessionId =
  typeof window !== 'undefined'
    ? ((window as unknown as { __STAFFFLOW_TAB_ID__?: string }).__STAFFFLOW_TAB_ID__ =
        (window as unknown as { __STAFFFLOW_TAB_ID__?: string }).__STAFFFLOW_TAB_ID__ ||
        Math.random().toString(36).substring(2, 9))
    : 'server';

function broadcastSync(keys: string | string[]) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    const keyList = Array.isArray(keys) ? keys : [keys];
    channel.postMessage({
      senderId: tabSessionId,
      keys: keyList,
      timestamp: Date.now(),
    });
    setTimeout(() => {
      try {
        channel.close();
      } catch {}
    }, 100);
  } catch (err) {
    console.warn('[CrossTabSync] broadcast failed:', err);
  }
}

function getStoredJson<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(`${STORAGE_PREFIX}${key}`) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${key}`);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export const ScheduleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'warning' | 'info' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // 1. Branches & Selected Branch
  const [branches, setBranches] = useState<Branch[]>(() => {
    return getStoredJson<Branch[]>('branches', MOCK_BRANCHES);
  });

  // 2. Roles & Skills
  const [roles, setRoles] = useState<BusinessRole[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}roles`) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}roles`);
      if (saved) {
        const parsed: BusinessRole[] = JSON.parse(saved);
        // If there are branch-specific roles, filter out legacy orphaned template roles with empty branchId
        const hasBranchRoles = parsed.some((r) => Boolean(r.branchId));
        if (hasBranchRoles) {
          return parsed.filter((r) => {
            if (!r.branchId) {
              return !parsed.some((other) => Boolean(other.branchId) && other.code === r.code);
            }
            return true;
          });
        }
        return parsed;
      }
      return MOCK_ROLES;
    } catch {
      return MOCK_ROLES;
    }
  });

  // 3. Employees
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}employees`) || localStorage.getItem(`${LEGACY_STORAGE_PREFIX}employees`);
      if (saved) {
        const parsed: Employee[] = JSON.parse(saved);
        // Dọn dẹp dữ liệu rác cũ: Giữ lại Admin Tổng và các nhân sự thuộc các chi nhánh thực tế đang tồn tại
        const branchIds = new Set(branches.map((b) => b.id));
        const cleanList = parsed.filter(
          (e) => e.roleType === 'super_admin' || e.id === 'USR-SUPER-01' || (e.branchId && branchIds.has(e.branchId))
        );
        return cleanList.length > 0 ? cleanList : MOCK_EMPLOYEES;
      }
      return MOCK_EMPLOYEES;
    } catch {
      return MOCK_EMPLOYEES;
    }
  });

  // 4. Current User & Role Type - Isolated per browser tab using sessionStorage
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const sessionUserId = sessionStorage.getItem(`${STORAGE_PREFIX}currentUserId`);
      if (sessionUserId) {
        const found = employees.find((e) => e.id === sessionUserId);
        if (found) return found;
      }
      const localUserId = localStorage.getItem(`${STORAGE_PREFIX}currentUserId`);
      if (localUserId) {
        const found = employees.find((e) => e.id === localUserId);
        if (found) {
          sessionStorage.setItem(`${STORAGE_PREFIX}currentUserId`, found.id);
          return found;
        }
      }
    } catch {}
    return null;
  });

  const [currentRoleType, setCurrentRoleType] = useState<RoleType>(() => {
    try {
      const sessionRole = sessionStorage.getItem(`${STORAGE_PREFIX}currentRoleType`) as RoleType;
      if (sessionRole) return sessionRole;
    } catch {}
    return currentUser?.roleType || 'super_admin';
  });

  const [currentBranchId, setCurrentBranchId] = useState<string>(() => {
    try {
      const sessionBranch = sessionStorage.getItem(`${STORAGE_PREFIX}currentBranchId`);
      if (sessionBranch) return sessionBranch;
      const saved = localStorage.getItem(`${STORAGE_PREFIX}branches`);
      const parsed = saved ? JSON.parse(saved) : MOCK_BRANCHES;
      return parsed[0]?.id || '';
    } catch {
      return '';
    }
  });

  // Navigation tab (Admin tổng defaults to 'branches', others to 'schedule')
  const [activeTab, setActiveTab] = useState<string>(() => {
    return currentRoleType === 'super_admin' ? 'branches' : 'schedule';
  });

  // 5. Line Configs & Requirements
  const [lineConfigs, setLineConfigs] = useState<LineConfig[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}lineConfigs`);
      return saved ? JSON.parse(saved) : MOCK_LINE_CONFIGS;
    } catch {
      return MOCK_LINE_CONFIGS;
    }
  });

  const [lineRequirements, setLineRequirements] = useState<LineRequirement[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}lineRequirements`);
      return saved ? JSON.parse(saved) : MOCK_LINE_REQUIREMENTS;
    } catch {
      return MOCK_LINE_REQUIREMENTS;
    }
  });

  // 6. Availability Registrations
  const [registrations, setRegistrations] = useState<AvailabilityRegistration[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}registrations`);
      return saved ? JSON.parse(saved) : MOCK_REGISTRATIONS;
    } catch {
      return MOCK_REGISTRATIONS;
    }
  });

  // 7. Shift Requests (Swap & Sale)
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}shiftRequests`);
      return saved ? JSON.parse(saved) : MOCK_SHIFT_REQUESTS;
    } catch {
      return MOCK_SHIFT_REQUESTS;
    }
  });

  // 8. Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}auditLogs`);
      return saved ? JSON.parse(saved) : MOCK_AUDIT_LOGS;
    } catch {
      return MOCK_AUDIT_LOGS;
    }
  });

  const addAuditLog = (actionType: string, entityType: string, details: string) => {
    const newLog: AuditLog = {
      id: `LOG-${Date.now()}`,
      branchId: currentBranchId,
      actorName: currentUser ? currentUser.name : 'Hệ thống tự động',
      actionType,
      entityType,
      details,
      timestamp: new Date().toLocaleString('vi-VN'),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // 9. Master Weekly Schedule per Branch (persisted to localStorage & Neon PostgreSQL)
  const [schedulesByBranch, setSchedulesByBranch] = useState<Record<string, WeeklySchedule>>(() => {
    const map: Record<string, WeeklySchedule> = {};
    try {
      const savedMap = localStorage.getItem(`${STORAGE_PREFIX}schedulesByBranch`);
      if (savedMap) {
        const parsedMap = JSON.parse(savedMap);
        if (parsedMap && typeof parsedMap === 'object') {
          Object.assign(map, parsedMap);
        }
      }
      const savedSingle = localStorage.getItem(`${STORAGE_PREFIX}schedule`);
      if (savedSingle) {
        const parsed = JSON.parse(savedSingle);
        const targetBranch = parsed?.branchId || currentBranchId || '';
        if (targetBranch && (!map[targetBranch] || (parsed.assignments?.length || 0) >= (map[targetBranch].assignments?.length || 0))) {
          map[targetBranch] = {
            ...parsed,
            branchId: targetBranch,
            assignments: (parsed.assignments || []).map((a: ShiftAssignment) => ({
              ...a,
              branchId: a.branchId || targetBranch,
            })),
          };
        }
      }
    } catch {}
    return map;
  });

  const schedule = useMemo<WeeklySchedule>(() => {
    if (currentBranchId && schedulesByBranch[currentBranchId]) {
      return schedulesByBranch[currentBranchId];
    }
    return createEmptySchedule(currentBranchId);
  }, [schedulesByBranch, currentBranchId]);

  const syncScheduleToBackend = useCallback((sched: WeeklySchedule) => {
    if (!sched.branchId) return;
    fetch(`${API_BASE_URL}/api/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sched),
    }).catch((err) => {
      console.warn('[ScheduleSync] Failed to sync schedule to Neon DB:', err);
    });
  }, []);

  const updateBranchSchedule = useCallback(
    (
      branchId: string,
      updater: (prev: WeeklySchedule) => WeeklySchedule,
      syncRemote = true
    ) => {
      if (!branchId) return;
      setSchedulesByBranch((prevMap) => {
        const current = prevMap[branchId] || createEmptySchedule(branchId);
        const updated = updater(current);
        const nextMap = { ...prevMap, [branchId]: updated };
        try {
          localStorage.setItem(`${STORAGE_PREFIX}schedulesByBranch`, JSON.stringify(nextMap));
          localStorage.setItem(`${STORAGE_PREFIX}schedule`, JSON.stringify(updated));
          broadcastSync(['schedulesByBranch', 'schedule']);
        } catch {}
        if (syncRemote) {
          syncScheduleToBackend(updated);
        }
        return nextMap;
      });
    },
    [syncScheduleToBackend]
  );

  // 10. Scoped roles for current branch (Deduplicated, zero ghost duplicates)
  const branchRoles = useMemo(() => {
    if (!currentBranchId) {
      // If no branch selected (Super Admin view), deduplicate by code
      const seen = new Set<string>();
      return roles.filter((r) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      });
    }
    const forBranch = roles.filter((r) => r.branchId === currentBranchId);
    if (forBranch.length > 0) return forBranch;

    // Fallback: templates deduplicated
    const seen = new Set<string>();
    return roles.filter((r) => {
      if (seen.has(r.code)) return false;
      seen.add(r.code);
      return true;
    });
  }, [roles, currentBranchId]);

  // 11. Solver UI state
  const [isSolving, setIsSolving] = useState(false);
  const [solverLogs, setSolverLogs] = useState<SolverStepLog[]>([]);
  const [showSolverModal, setShowSolverModal] = useState(false);

  // 11b. Persistent OT hours map (userId -> otHours)
  const [otHoursMap, setOtHoursMap] = useState<Record<string, number>>(() => {
    return getStoredJson<Record<string, number>>('otHoursMap', {});
  });

  // 12. Cross-tab Synchronization Architecture (BroadcastChannel + storage + visibilitychange + focus)
  const isSyncingFromRemoteRef = useRef(false);

  const reloadEntityFromStorage = useCallback((key: string) => {
    try {
      if (key === 'all') {
        [
          'branches',
          'employees',
          'roles',
          'lineConfigs',
          'lineRequirements',
          'registrations',
          'shiftRequests',
          'schedulesByBranch',
          'schedule',
          'auditLogs',
          'otHoursMap',
        ].forEach((k) => reloadEntityFromStorage(k));
        return;
      }
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      isSyncingFromRemoteRef.current = true;
      switch (key) {
        case 'branches':
          setBranches(raw ? JSON.parse(raw) : []);
          break;
        case 'employees':
          setEmployees(raw ? JSON.parse(raw) : MOCK_EMPLOYEES);
          break;
        case 'roles':
          setRoles(raw ? JSON.parse(raw) : MOCK_ROLES);
          break;
        case 'lineConfigs':
          setLineConfigs(raw ? JSON.parse(raw) : MOCK_LINE_CONFIGS);
          break;
        case 'lineRequirements':
          setLineRequirements(raw ? JSON.parse(raw) : MOCK_LINE_REQUIREMENTS);
          break;
        case 'registrations':
          setRegistrations(raw ? JSON.parse(raw) : []);
          break;
        case 'shiftRequests':
          setShiftRequests(raw ? JSON.parse(raw) : []);
          break;
        case 'schedulesByBranch':
          if (raw) {
            setSchedulesByBranch(JSON.parse(raw));
          }
          break;
        case 'schedule': {
          if (raw) {
            const parsed = JSON.parse(raw);
            const targetBranch = parsed.branchId || currentBranchId || '';
            if (targetBranch) {
              setSchedulesByBranch((prev) => ({
                ...prev,
                [targetBranch]: {
                  ...parsed,
                  branchId: targetBranch,
                  assignments: (parsed.assignments || []).map((a: ShiftAssignment) => ({
                    ...a,
                    branchId: a.branchId || targetBranch,
                  })),
                },
              }));
            }
          }
          break;
        }
        case 'auditLogs':
          setAuditLogs(raw ? JSON.parse(raw) : []);
          break;
        case 'otHoursMap':
          setOtHoursMap(raw ? JSON.parse(raw) : {});
          break;
      }
      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 60);
    } catch (err) {
      console.warn(`[CrossTabSync] Failed to reload ${key}:`, err);
    }
  }, [currentBranchId]);

  const reloadAllFromStorage = useCallback(() => {
    [
      'branches',
      'employees',
      'roles',
      'lineConfigs',
      'lineRequirements',
      'registrations',
      'shiftRequests',
      'schedulesByBranch',
      'schedule',
      'auditLogs',
      'otHoursMap',
    ].forEach((k) => reloadEntityFromStorage(k));
  }, [reloadEntityFromStorage]);

  // Sync to local storage & broadcast to other tabs
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}branches`, JSON.stringify(branches));
    if (!isSyncingFromRemoteRef.current) broadcastSync('branches');
  }, [branches]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}roles`, JSON.stringify(roles));
    if (!isSyncingFromRemoteRef.current) broadcastSync('roles');
  }, [roles]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}employees`, JSON.stringify(employees));
    if (!isSyncingFromRemoteRef.current) broadcastSync('employees');
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}lineConfigs`, JSON.stringify(lineConfigs));
    if (!isSyncingFromRemoteRef.current) broadcastSync('lineConfigs');
  }, [lineConfigs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}lineRequirements`, JSON.stringify(lineRequirements));
    if (!isSyncingFromRemoteRef.current) broadcastSync('lineRequirements');
  }, [lineRequirements]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}registrations`, JSON.stringify(registrations));
    if (!isSyncingFromRemoteRef.current) broadcastSync('registrations');
  }, [registrations]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}shiftRequests`, JSON.stringify(shiftRequests));
    if (!isSyncingFromRemoteRef.current) broadcastSync('shiftRequests');
  }, [shiftRequests]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}auditLogs`, JSON.stringify(auditLogs));
    if (!isSyncingFromRemoteRef.current) broadcastSync('auditLogs');
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}schedulesByBranch`, JSON.stringify(schedulesByBranch));
    if (currentBranchId && schedulesByBranch[currentBranchId]) {
      localStorage.setItem(`${STORAGE_PREFIX}schedule`, JSON.stringify(schedulesByBranch[currentBranchId]));
    }
    if (!isSyncingFromRemoteRef.current) broadcastSync(['schedulesByBranch', 'schedule']);
  }, [schedulesByBranch, currentBranchId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}otHoursMap`, JSON.stringify(otHoursMap));
    if (!isSyncingFromRemoteRef.current) broadcastSync('otHoursMap');
  }, [otHoursMap]);

  // Real-time Cross-tab Synchronization Listener (BroadcastChannel + storage + visibilitychange + focus)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel: Instant cross-tab sync (< 1ms)
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        channel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.senderId === tabSessionId) return;
          if (Array.isArray(data.keys)) {
            data.keys.forEach((k: string) => {
              if (k === 'all') reloadAllFromStorage();
              else reloadEntityFromStorage(k);
            });
          }
        };
      } catch (err) {
        console.warn('[CrossTabSync] channel setup failed:', err);
      }
    }

    // 2. Storage Event: Standard browser fallback for changes made in other tabs
    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
      const entityKey = e.key.replace(STORAGE_PREFIX, '');
      reloadEntityFromStorage(entityKey);
    };
    window.addEventListener('storage', handleStorageEvent);

    // 3. Tab Visibility & Focus: Reload when user switches tabs to ensure instant up-to-date UI
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        reloadAllFromStorage();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      if (channel) {
        try {
          channel.close();
        } catch {}
      }
      window.removeEventListener('storage', handleStorageEvent);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [reloadEntityFromStorage, reloadAllFromStorage]);

  // Keep currentUser in sync if their employee profile is modified elsewhere
  useEffect(() => {
    if (currentUser) {
      const freshUser = employees.find((e) => e.id === currentUser.id);
      if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(freshUser);
      }
    }
  }, [employees, currentUser]);

  // Synchronize live data from Neon PostgreSQL backend on startup
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/initial-state`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        // 1. Branches
        if (Array.isArray(data.branches) && data.branches.length > 0) {
          setBranches((prev) => {
            const remoteMap = new Map<string, Branch>();
            data.branches.forEach((b: Branch) => remoteMap.set(b.id, b));
            const merged = data.branches.slice();
            prev.forEach((p) => {
              if (!remoteMap.has(p.id)) merged.push(p);
            });
            return merged;
          });
          setCurrentBranchId((prevBranchId) => {
            if (prevBranchId && data.branches.some((b: Branch) => b.id === prevBranchId)) {
              return prevBranchId;
            }
            return data.branches[0]?.id || prevBranchId;
          });
        }

        // 2. Employees
        if (Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees((prev) => {
            const merged: Employee[] = data.employees.slice();
            prev.forEach((p) => {
              const alreadyInRemote = merged.some(
                (r) =>
                  r.id === p.id ||
                  (r.username && p.username && r.username.toLowerCase() === p.username.toLowerCase()) ||
                  (r.employeeCode === p.employeeCode && (r.branchId || '') === (p.branchId || '') && r.roleType === p.roleType)
              );
              if (!alreadyInRemote) {
                merged.push(p);
                // Auto-sync unsaved local employee to Neon DB
                fetch(`${API_BASE_URL}/api/users`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: p.id,
                    branchId: p.branchId,
                    employeeCode: p.employeeCode,
                    fullName: p.name,
                    email: p.email,
                    username: p.username,
                    password: p.password || '123456',
                    roleType: p.roleType,
                    gender: p.gender,
                    dob: p.dob,
                    joinedDate: p.joinedDate,
                    employmentType: p.employmentType,
                    phone: p.phone,
                    skills: p.skills,
                    baseHourlyRate: p.baseHourlyRate,
                  }),
                }).catch(() => {});
              }
            });
            return merged;
          });
        }

        // 3. Business Roles
        if (Array.isArray(data.roles) && data.roles.length > 0) {
          setRoles((prev) => {
            const remoteMap = new Map<string, BusinessRole>();
            data.roles.forEach((r: BusinessRole) => remoteMap.set(r.id, r));
            const merged = data.roles.slice();
            prev.forEach((r) => {
              if (!remoteMap.has(r.id)) merged.push(r);
            });
            return merged;
          });
        }

        // 4. Line Configs
        if (Array.isArray(data.lineConfigs) && data.lineConfigs.length > 0) {
          setLineConfigs((prev) => {
            const remoteMap = new Map<string, LineConfig>();
            data.lineConfigs.forEach((l: LineConfig) => remoteMap.set(`${l.branchId}_${l.lineCode}`, l));
            const merged = data.lineConfigs.slice();
            prev.forEach((l) => {
              if (!remoteMap.has(`${l.branchId}_${l.lineCode}`)) merged.push(l);
            });
            return merged;
          });
        }

        // 5. Line Requirements
        if (Array.isArray(data.lineRequirements) && data.lineRequirements.length > 0) {
          setLineRequirements((prev) => {
            const remoteMap = new Map<string, LineRequirement>();
            data.lineRequirements.forEach((lr: LineRequirement) =>
              remoteMap.set(`${lr.branchId}_${lr.lineCode}_${lr.roleId}`, lr)
            );
            const merged = data.lineRequirements.slice();
            prev.forEach((lr) => {
              if (!remoteMap.has(`${lr.branchId}_${lr.lineCode}_${lr.roleId}`)) merged.push(lr);
            });
            return merged;
          });
        }

        // 6. Availability Registrations (with automatic backup of local-only registrations to Neon DB)
        if (Array.isArray(data.registrations)) {
          setRegistrations((prev) => {
            const remoteMap = new Map<string, AvailabilityRegistration>();
            data.registrations.forEach((reg: AvailabilityRegistration) =>
              remoteMap.set(`${reg.userId}_${reg.weekStartDate}`, reg)
            );
            const merged = data.registrations.slice();
            prev.forEach((localReg) => {
              const key = `${localReg.userId}_${localReg.weekStartDate}`;
              if (!remoteMap.has(key)) {
                merged.push(localReg);
                fetch(`${API_BASE_URL}/api/availability`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: localReg.userId,
                    branchId: localReg.branchId,
                    weekStartDate: localReg.weekStartDate,
                    slots: localReg.slots,
                    dayCustomHours: localReg.dayCustomHours,
                    note: localReg.note,
                  }),
                }).catch(() => {});
              }
            });
            return merged;
          });
        }

        // 7. Weekly Schedules per Branch (with automatic backup of local-only schedules to Neon DB)
        if (Array.isArray(data.schedules)) {
          setSchedulesByBranch((prevMap) => {
            const nextMap: Record<string, WeeklySchedule> = { ...prevMap };
            const remoteBranches = new Set<string>();

            data.schedules.forEach((remoteSched: WeeklySchedule) => {
              if (!remoteSched.branchId) return;
              remoteBranches.add(remoteSched.branchId);
              const existingLocal = prevMap[remoteSched.branchId];
              // Prefer remote schedule if it has assignments or if local is empty
              if (
                (remoteSched.assignments && remoteSched.assignments.length > 0) ||
                !existingLocal ||
                existingLocal.assignments.length === 0
              ) {
                nextMap[remoteSched.branchId] = remoteSched;
              } else if (existingLocal && existingLocal.assignments.length > 0 && remoteSched.assignments.length === 0) {
                // Local has assignments whereas remote is empty -> push local schedule to Neon DB!
                syncScheduleToBackend(existingLocal);
              }
            });

            // Push any local branch schedules that do not exist on remote yet
            Object.values(prevMap).forEach((localSched) => {
              if (
                localSched &&
                localSched.branchId &&
                localSched.assignments &&
                localSched.assignments.length > 0 &&
                !remoteBranches.has(localSched.branchId)
              ) {
                syncScheduleToBackend(localSched);
              }
            });

            return nextMap;
          });
        }

        // 8. Shift Requests
        if (Array.isArray(data.shiftRequests)) {
          setShiftRequests((prev) => {
            const remoteMap = new Map<string, ShiftRequest>();
            data.shiftRequests.forEach((sr: ShiftRequest) => remoteMap.set(sr.id, sr));
            const merged = data.shiftRequests.slice();
            prev.forEach((localSr) => {
              if (!remoteMap.has(localSr.id)) {
                merged.push(localSr);
                fetch(`${API_BASE_URL}/api/shift-requests`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(localSr),
                }).catch(() => {});
              }
            });
            return merged;
          });
        }

        // 9. Payroll OT Map
        if (data.payrollOtMap && typeof data.payrollOtMap === 'object') {
          setOtHoursMap((prev) => ({ ...prev, ...data.payrollOtMap }));
        }

        // 10. Audit Logs
        if (Array.isArray(data.auditLogs) && data.auditLogs.length > 0) {
          setAuditLogs((prev) => {
            const remoteMap = new Map<string, AuditLog>();
            data.auditLogs.forEach((l: AuditLog) => remoteMap.set(l.id, l));
            const merged = data.auditLogs.slice();
            prev.forEach((l) => {
              if (!remoteMap.has(l.id)) merged.push(l);
            });
            return merged.slice(0, 150);
          });
        }
      } catch {
        // Backend might be booting or offline
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, [syncScheduleToBackend]);

  // Auth / Login session
  const loginAs = (userId: string) => {
    const found = employees.find((e) => e.id === userId);
    if (found) {
      setCurrentUser(found);
      setCurrentRoleType(found.roleType);
      if (found.branchId) {
        setCurrentBranchId(found.branchId);
      }
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}currentUserId`, found.id);
        sessionStorage.setItem(`${STORAGE_PREFIX}currentRoleType`, found.roleType);
        if (found.branchId) {
          sessionStorage.setItem(`${STORAGE_PREFIX}currentBranchId`, found.branchId);
        }
      } catch {}
    }
  };

  const loginWithUser = (user: Employee, branch?: Branch | null) => {
    setEmployees((prev) => {
      const idx = prev.findIndex((e) => e.id === user.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = user;
        return next;
      }
      return [...prev, user];
    });
    if (branch) {
      setBranches((prev) => {
        const idx = prev.findIndex((b) => b.id === branch.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = branch;
          return next;
        }
        return [...prev, branch];
      });
    }
    setCurrentUser(user);
    setCurrentRoleType(user.roleType);
    if (user.branchId) {
      setCurrentBranchId(user.branchId);
    }
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}currentUserId`, user.id);
      sessionStorage.setItem(`${STORAGE_PREFIX}currentRoleType`, user.roleType);
      if (user.branchId) {
        sessionStorage.setItem(`${STORAGE_PREFIX}currentBranchId`, user.branchId);
      }
    } catch {}
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(`${STORAGE_PREFIX}currentUserId`);
      sessionStorage.removeItem(`${STORAGE_PREFIX}currentRoleType`);
      sessionStorage.removeItem(`${STORAGE_PREFIX}currentBranchId`);
      localStorage.removeItem(`${STORAGE_PREFIX}currentUserId`);
    } catch {}
    addToast('info', 'Đã đăng xuất', 'Quay lại màn hình đăng nhập hệ thống.');
  };

  const switchRoleType = (role: RoleType) => {
    setCurrentRoleType(role);
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}currentRoleType`, role);
    } catch {}
  };

  const switchBranch = (branchId: string) => {
    setCurrentBranchId(branchId);
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}currentBranchId`, branchId);
    } catch {}
    const branch = branches.find((b) => b.id === branchId);
    addToast('info', 'Chuyển chi nhánh vận hành', `Đang xem: ${branch?.name || branchId}`);
  };

  // Branch CRUD (Super Admin)
  const addBranch = (bData: Omit<Branch, 'id'>) => {
    const id = `BR-${bData.code}`;
    const newBranch: Branch = { ...bData, id };
    setBranches((prev) => [...prev, newBranch]);

    // 1. Tự động cấp tài khoản Admin Chi Nhánh vào danh sách nhân sự (Duy nhất 1 tài khoản quản trị)
    if (bData.adminUsername) {
      const adminUserId = `USR-ADMIN-${bData.code}`;
      const newAdminUser: Employee = {
        id: adminUserId,
        branchId: id,
        employeeCode: `ADM-${bData.code}`,
        name: bData.adminName || `Admin ${bData.name}`,
        email: bData.adminEmail || `${bData.adminUsername}@company.com`,
        username: bData.adminUsername,
        password: bData.adminPassword,
        roleType: 'branch_admin',
        gender: 'male',
        dob: '1990-01-01',
        joinedDate: new Date().toISOString().split('T')[0],
        employmentType: 'full_time',
        skills: [],
        wageRates: {},
        status: 'active',
        phone: bData.phone,
      };
      setEmployees((prev) => {
        const filtered = prev.filter((e) => e.id !== adminUserId);
        return [...filtered, newAdminUser];
      });
    }

    // 2. Khởi tạo danh mục vai trò chuẩn tối thiểu (để chi nhánh có thể tùy chỉnh hoặc thêm mới)
    const newBranchRoles: BusinessRole[] = [
      { id: `ROLE-SEC-${bData.code}`, branchId: id, code: 'SEC', name: 'Bảo Vệ', description: 'An ninh, dắt xe và hướng dẫn khách hàng (Chỉ Nam)', genderRequirement: 'male_only', defaultHourlyRate: 35000, isSystemDefault: true, salaryCalculationType: 'employee_seniority_rate' },
      { id: `ROLE-BAR-${bData.code}`, branchId: id, code: 'BAR', name: 'Pha Chế', description: 'Barista chuyên pha chế trà sữa, cà phê', genderRequirement: 'any', defaultHourlyRate: 55000, isSystemDefault: true, salaryCalculationType: 'employee_seniority_rate' },
      { id: `ROLE-SRV-${bData.code}`, branchId: id, code: 'SRV', name: 'Phục Vụ', description: 'Tiếp đón khách hàng, order và dọn bàn', genderRequirement: 'any', defaultHourlyRate: 45000, isSystemDefault: true, salaryCalculationType: 'employee_seniority_rate' },
      { id: `ROLE-KIT-${bData.code}`, branchId: id, code: 'KIT', name: 'Bếp', description: 'Chuẩn bị đồ ăn nhanh và topping tươi', genderRequirement: 'any', defaultHourlyRate: 50000, isSystemDefault: true, salaryCalculationType: 'fixed_role_rate' },
      { id: `ROLE-INV-${bData.code}`, branchId: id, code: 'INV', name: 'Soạn Hàng', description: 'Kiểm kê, xuất nhập kho và đóng gói', genderRequirement: 'any', defaultHourlyRate: 46000, isSystemDefault: true, salaryCalculationType: 'fixed_role_rate' },
    ];
    setRoles((prev) => [...prev, ...newBranchRoles]);

    // 3. Khởi tạo 3 Line ca làm việc chuẩn (O, M, D) cho chi nhánh
    const branchLines: LineConfig[] = [
      { id: `LINE-${bData.code}-O`, branchId: id, lineCode: 'O', lineName: 'Line O — Open (Ca Mở Cửa / Sáng)', startTime: '05:30', endTime: '12:00', durationHours: 6.5, description: 'Mở cửa quầy, nhận giao nhận nguyên liệu đá tươi và phục vụ khách sáng' },
      { id: `LINE-${bData.code}-M`, branchId: id, lineCode: 'M', lineName: 'Line M — Mid (Ca Giữa / Trưa)', startTime: '11:00', endTime: '18:00', durationHours: 7.0, description: 'Khung giờ giao lưu trưa, tiếp đón khách văn phòng và bàn ăn' },
      { id: `LINE-${bData.code}-D`, branchId: id, lineCode: 'D', lineName: 'Line D — Down (Ca Tối / Đóng Cửa)', startTime: '17:00', endTime: '23:30', durationHours: 6.5, description: 'Khung giờ cao điểm tối, vệ sinh máy pha và đóng quầy kiểm kê' },
    ];
    setLineConfigs((prev) => [...prev, ...branchLines]);

    // 4. Định mức headcount ban đầu theo line
    const branchRequirements: LineRequirement[] = [
      { id: `REQ-${bData.code}-O-SEC`, branchId: id, lineCode: 'O', roleId: `ROLE-SEC-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-O-BAR`, branchId: id, lineCode: 'O', roleId: `ROLE-BAR-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-O-SRV`, branchId: id, lineCode: 'O', roleId: `ROLE-SRV-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-O-KIT`, branchId: id, lineCode: 'O', roleId: `ROLE-KIT-${bData.code}`, headcountRequired: 1 },

      { id: `REQ-${bData.code}-M-SEC`, branchId: id, lineCode: 'M', roleId: `ROLE-SEC-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-M-BAR`, branchId: id, lineCode: 'M', roleId: `ROLE-BAR-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-M-SRV`, branchId: id, lineCode: 'M', roleId: `ROLE-SRV-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-M-INV`, branchId: id, lineCode: 'M', roleId: `ROLE-INV-${bData.code}`, headcountRequired: 1 },

      { id: `REQ-${bData.code}-D-SEC`, branchId: id, lineCode: 'D', roleId: `ROLE-SEC-${bData.code}`, headcountRequired: 1 },
      { id: `REQ-${bData.code}-D-BAR`, branchId: id, lineCode: 'D', roleId: `ROLE-BAR-${bData.code}`, headcountRequired: 2 },
      { id: `REQ-${bData.code}-D-SRV`, branchId: id, lineCode: 'D', roleId: `ROLE-SRV-${bData.code}`, headcountRequired: 1 },
    ];
    setLineRequirements((prev) => [...prev, ...branchRequirements]);

    // Gán branchId hiện tại nếu chưa có
    if (!currentBranchId) {
      setCurrentBranchId(id);
    }

    // Đồng bộ lên Neon Backend
    fetch(`${API_BASE_URL}/api/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        code: bData.code,
        name: bData.name,
        address: bData.address,
        phone: bData.phone,
        standard_monthly_hours: bData.standardMonthlyHours,
        max_fulltime_off_days: bData.maxFulltimeOffDays,
        max_parttime_off_days: bData.maxParttimeOffDays,
        admin_name: bData.adminName,
        admin_username: bData.adminUsername,
        admin_password: bData.adminPassword,
        admin_email: bData.adminEmail,
      }),
    }).catch(() => {});

    addAuditLog(
      'CREATE_BRANCH_WITH_ADMIN',
      'Branch',
      `Tạo chi nhánh mới: ${newBranch.name} (${newBranch.code}) & Cấp tài khoản Admin: ${bData.adminUsername || 'N/A'}`
    );
    addToast('success', 'Tạo chi nhánh & cấp tài khoản thành công', `Đã kích hoạt ${newBranch.name} với tài khoản Admin [${bData.adminUsername}]. Dữ liệu nhân sự và lịch làm hoàn toàn sạch để bạn bắt đầu.`);
  };

  const updateBranch = (id: string, updates: Partial<Branch>) => {
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));

    // Đồng bộ thông tin Admin Chi Nhánh nếu có cập nhật
    if (updates.adminName || updates.adminUsername || updates.adminEmail || updates.adminPassword) {
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.branchId === id && e.roleType === 'branch_admin') {
            return {
              ...e,
              name: updates.adminName || e.name,
              email: updates.adminEmail || e.email,
              username: updates.adminUsername || e.username,
              password: updates.adminPassword || e.password,
              phone: updates.phone || e.phone,
            };
          }
          return e;
        })
      );
    }

    // Đồng bộ lên Neon Backend
    fetch(`${API_BASE_URL}/api/branches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updates.name,
        address: updates.address,
        phone: updates.phone,
        standard_monthly_hours: updates.standardMonthlyHours,
        max_fulltime_off_days: updates.maxFulltimeOffDays,
        max_parttime_off_days: updates.maxParttimeOffDays,
        admin_name: updates.adminName,
        admin_username: updates.adminUsername,
        admin_password: updates.adminPassword,
        admin_email: updates.adminEmail,
      }),
    }).catch(() => {});

    addAuditLog('UPDATE_BRANCH_CONFIG', 'Branch', `Cập nhật thông tin chi nhánh và tài khoản Admin: ${id}`);
    addToast('success', 'Cập nhật thành công', `Thông tin chi nhánh và quyền kiểm soát Admin đã được lưu.`);
  };

  const deleteBranch = async (id: string) => {
    const branchToDelete = branches.find((b) => b.id === id);
    if (!branchToDelete) {
      addToast('error', 'Lỗi thao tác', 'Không tìm thấy chi nhánh cần xóa.');
      return;
    }

    // [OOP DOMAIN INVARIANT RULE]
    // Một chi nhánh (Branch Entity) không thể bị xóa khi vẫn còn nhân sự trực thuộc!
    const branchEntity = new BranchEntity(branchToDelete);
    const branchEmployees = employees.filter((e) => e.branchId === id);
    const branchSched = schedulesByBranch[id];
    const branchAssignments = (branchSched?.assignments || []).filter((a) => a.branchId === id && Boolean(a.userId));

    const validation = branchEntity.canBeDeleted(branchEmployees.length, branchAssignments.length);
    if (!validation.allowed) {
      addToast('error', 'Ràng buộc nghiệp vụ OOP', validation.message || 'Không thể xóa chi nhánh còn nhân sự.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/branches/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        addToast('error', 'Không thể xóa chi nhánh', errData?.error || 'Máy chủ từ chối thao tác.');
        return;
      }
    } catch (e) {
      console.warn('Backend delete branch offline, proceeding with local memory:', e);
    }

    setBranches((prev) => prev.filter((b) => b.id !== id));
    setRoles((prev) => prev.filter((r) => r.branchId !== id));
    setLineConfigs((prev) => prev.filter((l) => l.branchId !== id));
    setLineRequirements((prev) => prev.filter((lr) => lr.branchId !== id));
    setRegistrations((prev) => prev.filter((r) => !employees.some((e) => e.branchId === id && e.id === r.userId)));
    setShiftRequests((prev) => prev.filter((sr) => sr.branchId !== id));
    setSchedulesByBranch((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (currentBranchId === id) {
      const remaining = branches.filter((b) => b.id !== id);
      setCurrentBranchId(remaining[0]?.id || '');
    }

    addAuditLog(
      'DELETE_BRANCH',
      'Branch',
      `Đã giải thể chi nhánh ${branchToDelete?.name || id} (${branchToDelete?.code || id}) theo chuẩn OOP.`
    );
    addToast('success', 'Đã xóa chi nhánh', `Chi nhánh ${branchToDelete?.name || id} đã được xóa sạch khỏi hệ thống.`);
  };

  const resetAllDataClean = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('staffflow_') || key.startsWith('optishift_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    setBranches([]);
    setEmployees(MOCK_EMPLOYEES);
    setRoles(MOCK_ROLES);
    setLineConfigs(MOCK_LINE_CONFIGS);
    setLineRequirements(MOCK_LINE_REQUIREMENTS);
    setRegistrations([]);
    setShiftRequests([]);
    setAuditLogs([]);
    setSchedulesByBranch({});
    setOtHoursMap({});
    setCurrentUser(MOCK_EMPLOYEES[0]);
    setCurrentRoleType('super_admin');
    setCurrentBranchId('');
    setActiveTab('branches');

    fetch(`${API_BASE_URL}/api/reset-data`, {
      method: 'POST',
    }).catch(() => {});

    broadcastSync('all');

    addToast('success', 'Đã làm sạch toàn bộ dữ liệu', 'Toàn bộ dữ liệu mẫu đã được xóa hoàn toàn. Sẵn sàng bắt đầu!');
  };

  // Employee CRUD
  const addEmployee = (empData: Omit<Employee, 'id'>) => {
    const id = `EMP-${empData.branchId || 'BR'}-${Date.now().toString().slice(-4)}`;
    const newEmp: Employee = { ...empData, id };
    setEmployees((prev) => [...prev, newEmp]);
    addAuditLog('CREATE_EMPLOYEE', 'Employee', `Tạo hồ sơ nhân viên: ${newEmp.name} (${newEmp.employeeCode})`);
    addToast('success', 'Tạo nhân viên thành công', `Đã thêm ${newEmp.name} (${newEmp.employeeCode}) vào chi nhánh.`);

    fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        branchId: newEmp.branchId,
        employeeCode: newEmp.employeeCode,
        fullName: newEmp.name,
        email: newEmp.email,
        username: newEmp.username,
        password: newEmp.password,
        roleType: newEmp.roleType,
        gender: newEmp.gender,
        dob: newEmp.dob,
        joinedDate: newEmp.joinedDate,
        employmentType: newEmp.employmentType,
        phone: newEmp.phone,
        skills: newEmp.skills,
        baseHourlyRate: newEmp.baseHourlyRate,
      }),
    }).catch(() => {});
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    const existingEmp = employees.find((e) => e.id === id);
    const mergedEmp: Employee | undefined = existingEmp ? { ...existingEmp, ...updates } : undefined;

    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
    }
    addAuditLog('UPDATE_EMPLOYEE', 'Employee', `Cập nhật thông tin tài khoản/nhân sự ${mergedEmp?.name || id}`);
    addToast('success', 'Cập nhật thành công', `Thông tin hồ sơ ${mergedEmp?.name || id} đã được lưu vào hệ thống.`);

    fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        branchId: mergedEmp?.branchId,
        employeeCode: updates.employeeCode ?? mergedEmp?.employeeCode,
        fullName: updates.name ?? mergedEmp?.name,
        email: updates.email ?? mergedEmp?.email,
        username: updates.username ?? mergedEmp?.username,
        password: updates.password ? updates.password : undefined,
        roleType: updates.roleType ?? mergedEmp?.roleType,
        gender: updates.gender ?? mergedEmp?.gender,
        dob: updates.dob ?? mergedEmp?.dob,
        joinedDate: updates.joinedDate ?? mergedEmp?.joinedDate,
        phone: updates.phone ?? mergedEmp?.phone,
        employmentType: updates.employmentType ?? mergedEmp?.employmentType,
        baseHourlyRate: updates.baseHourlyRate ?? mergedEmp?.baseHourlyRate,
        skills: updates.skills ?? mergedEmp?.skills,
        status: updates.status ?? mergedEmp?.status,
      }),
    }).catch(() => {});
  };

  const deleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    addAuditLog('DELETE_EMPLOYEE', 'Employee', `Xoá nhân viên ${id}`);
    addToast('info', 'Đã xoá nhân sự', `Đã loại bỏ hồ sơ ${id}.`);

    fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  const toggleEmployeeStatus = (id: string) => {
    const targetEmp = employees.find((e) => e.id === id);
    if (!targetEmp) return;
    const nextStatus = targetEmp.status === 'active' ? 'inactive' : 'active';

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: nextStatus } : e))
    );
    addAuditLog('TOGGLE_EMPLOYEE_STATUS', 'Employee', `Đổi trạng thái ${targetEmp.name} sang ${nextStatus}`);

    fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        branchId: targetEmp.branchId,
        employeeCode: targetEmp.employeeCode,
        fullName: targetEmp.name,
        email: targetEmp.email,
        username: targetEmp.username,
        roleType: targetEmp.roleType,
        gender: targetEmp.gender,
        dob: targetEmp.dob,
        joinedDate: targetEmp.joinedDate,
        phone: targetEmp.phone,
        employmentType: targetEmp.employmentType,
        baseHourlyRate: targetEmp.baseHourlyRate,
        skills: targetEmp.skills,
        status: nextStatus,
      }),
    }).catch(() => {});
  };

  // Role CRUD
  const addRole = (rData: Omit<BusinessRole, 'id'>) => {
    const id = `ROLE-${rData.code}-${Date.now().toString().slice(-4)}`;
    const newRole: BusinessRole = {
      ...rData,
      id,
      branchId: rData.branchId || currentBranchId,
    };
    setRoles((prev) => [...prev, newRole]);
    addAuditLog('CREATE_ROLE', 'BusinessRole', `Tạo vai trò mới: ${newRole.name} (${newRole.code})`);
    addToast('success', 'Tạo vai trò thành công', `Đã thêm vai trò ${newRole.name}.`);

    fetch(`${API_BASE_URL}/api/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRole),
    }).catch(() => {});
  };

  const updateRole = (id: string, updates: Partial<BusinessRole>) => {
    const existing = roles.find((r) => r.id === id);
    const updatedRole = existing ? { ...existing, ...updates } : undefined;
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    addAuditLog('UPDATE_ROLE', 'BusinessRole', `Cập nhật vai trò ${id}`);
    addToast('success', 'Lưu vai trò', `Đã cập nhật thông tin vai trò.`);

    if (updatedRole) {
      fetch(`${API_BASE_URL}/api/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRole),
      }).catch(() => {});
    }
  };

  // Line Configs & Requirements
  const updateLineConfig = (lineCode: LineCode, updates: Partial<LineConfig>) => {
    let updatedLine: LineConfig | undefined;
    setLineConfigs((prev) =>
      prev.map((l) => {
        if (l.lineCode === lineCode && l.branchId === currentBranchId) {
          updatedLine = { ...l, ...updates };
          return updatedLine;
        }
        return l;
      })
    );
    addAuditLog('UPDATE_LINE_CONFIG', 'LineConfig', `Cập nhật thời gian Line ${lineCode}`);
    addToast('success', 'Lưu cấu hình Line', `Đã cập nhật thông số Line ${lineCode}.`);

    const existing = lineConfigs.find((l) => l.lineCode === lineCode && l.branchId === currentBranchId);
    const payload = updatedLine || (existing ? { ...existing, ...updates } : undefined);
    if (payload) {
      fetch(`${API_BASE_URL}/api/line-configs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  };

  const updateLineRequirement = (lineCode: LineCode, roleId: string, count: number) => {
    const headcountRequired = Math.max(0, count);
    const reqId = `REQ-${currentBranchId}-${lineCode}-${roleId}`;

    setLineRequirements((prev) => {
      const idx = prev.findIndex(
        (r) => r.branchId === currentBranchId && r.lineCode === lineCode && r.roleId === roleId
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], headcountRequired };
        return next;
      } else {
        return [
          ...prev,
          {
            id: reqId,
            branchId: currentBranchId,
            lineCode,
            roleId,
            headcountRequired,
          },
        ];
      }
    });

    fetch(`${API_BASE_URL}/api/line-requirements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reqId,
        branchId: currentBranchId,
        lineCode,
        roleId,
        headcountRequired,
      }),
    }).catch(() => {});
  };

  // Registrations
  const saveAvailability = (
    userId: string,
    slots: Record<DayOfWeek, AvailabilityChoice>,
    note?: string,
    dayCustomHours?: Partial<Record<DayOfWeek, string>>
  ) => {
    const emp = employees.find((e) => e.id === userId);
    const targetBranchId = emp?.branchId || currentBranchId;
    const regId = `REG-${userId}-${CURRENT_WEEK_START}`;
    const newReg: AvailabilityRegistration = {
      id: regId,
      userId,
      branchId: targetBranchId,
      weekStartDate: CURRENT_WEEK_START,
      slots,
      dayCustomHours,
      note,
      submittedAt: new Date().toLocaleString('vi-VN'),
    };

    setRegistrations((prev) => {
      const idx = prev.findIndex((r) => r.userId === userId && r.weekStartDate === CURRENT_WEEK_START);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newReg;
        return next;
      }
      return [...prev, newReg];
    });

    fetch(`${API_BASE_URL}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        branchId: targetBranchId,
        weekStartDate: CURRENT_WEEK_START,
        slots,
        dayCustomHours,
        note,
      }),
    }).catch((err) => {
      console.warn('[AvailabilitySync] Failed to sync availability to Neon DB:', err);
    });

    addAuditLog('SUBMIT_AVAILABILITY', 'AvailabilityRegistration', `Nhân viên ${userId} đã nộp phiếu đăng ký ca`);
    addToast('success', 'Gửi đăng ký ca thành công', 'Phiếu nguyện vọng của bạn đã được lưu trữ lên hệ thống đám mây và chuyển tới Quản lý.');
  };

  // Master Schedule (Draft -> Publish -> Changed)
  const autoGenerateSchedule = async () => {
    setIsSolving(true);
    setShowSolverModal(true);
    setSolverLogs([
      { step: 1, message: 'Khởi động Scheduler Level 2: Phân tích ràng buộc O/M/D...', category: 'info' },
    ]);

    await new Promise((r) => setTimeout(r, 400));
    setSolverLogs((prev) => [
      ...prev,
      {
        step: 2,
        message: 'Kiểm tra Hard Constraints: Loại trừ đăng ký OFF, kiểm tra kỹ năng và ràng buộc giới tính...',
        category: 'progress',
      },
    ]);

    await new Promise((r) => setTimeout(r, 450));
    setSolverLogs((prev) => [
      ...prev,
      {
        step: 3,
        message: 'Thực thi quy tắc tối ưu: Cân bằng số giờ, phân bổ ngày làm việc và tạo lịch nháp (Draft)...',
        category: 'progress',
      },
    ]);

    await new Promise((r) => setTimeout(r, 400));

    // Run scheduler
    const branchStaff = employees.filter(
      (e) => e.branchId === currentBranchId && e.status === 'active'
    );
    const branchRolesToUse = branchRoles;
    const branchLinesToUse = lineConfigs.filter((l) => l.branchId === currentBranchId);
    const branchReqsToUse = lineRequirements.filter((r) => r.branchId === currentBranchId);
    const branchRegs = registrations.filter(
      (r) => r.branchId === currentBranchId || branchStaff.some((s) => s.id === r.userId)
    );

    const result = runBusinessScheduler(
      branchStaff,
      branchRolesToUse,
      branchLinesToUse.length > 0 ? branchLinesToUse : MOCK_LINE_CONFIGS,
      branchReqsToUse.length > 0 ? branchReqsToUse : MOCK_LINE_REQUIREMENTS,
      branchRegs,
      { branchId: currentBranchId }
    );

    setSolverLogs(result.stepLogs);

    const updatedAssignments = result.assignments.map((a) => ({
      ...a,
      branchId: a.branchId || currentBranchId,
    }));

    // Save as DRAFT and persist to Neon PostgreSQL
    const newSchedule: WeeklySchedule = {
      id: `SCH-${currentBranchId}-${CURRENT_WEEK_START}`,
      branchId: currentBranchId,
      weekStartDate: CURRENT_WEEK_START,
      weekEndDate: CURRENT_WEEK_END,
      status: 'draft',
      version: 1,
      lastModifiedAt: new Date().toISOString(),
      assignments: updatedAssignments,
      shortageWarnings: result.shortageWarnings,
      overrideProposals: result.overrideProposals,
    };

    updateBranchSchedule(currentBranchId, () => newSchedule, true);

    setIsSolving(false);
    addAuditLog(
      'RUN_SCHEDULER',
      'Schedule',
      `Tạo lịch Draft tự động: ${result.metrics.filledSlots}/${result.metrics.totalRequiredSlots} vị trí được xếp.`
    );

    if (result.shortageWarnings.length === 0) {
      addToast('success', 'Xếp lịch nháp hoàn tất!', 'Lịch Draft đã được lưu trữ an toàn trên cơ sở dữ liệu đám mây.');
    } else {
      addToast(
        'warning',
        'Lịch nháp có cảnh báo thiếu nhân sự',
        `Phát hiện ${result.shortageWarnings.length} vị trí thiếu người. Lịch đã được lưu trên hệ thống.`
      );
    }
  };

  const publishSchedule = () => {
    const targetBranch = schedule.branchId || currentBranchId;
    const nextStatus: ScheduleStatus = schedule.status === 'published' ? 'draft' : 'published';

    updateBranchSchedule(
      targetBranch,
      (prev) => {
        const updatedAssignments = prev.assignments.map((a) => ({
          ...a,
          branchId: a.branchId || targetBranch,
        }));
        return {
          ...prev,
          branchId: targetBranch,
          status: nextStatus,
          publishedAt: nextStatus === 'published' ? new Date().toLocaleString('vi-VN') : undefined,
          publishedBy: currentUser ? currentUser.name : 'Admin',
          assignments: updatedAssignments,
          lastModifiedAt: new Date().toISOString(),
        };
      },
      true
    );

    addAuditLog(
      nextStatus === 'published' ? 'PUBLISH_SCHEDULE' : 'UNPUBLISH_SCHEDULE',
      'Schedule',
      nextStatus === 'published'
        ? `Xuất bản lịch tuần cho toàn thể nhân viên chi nhánh ${targetBranch}`
        : 'Chuyển lịch về trạng thái nháp (Draft)'
    );

    addToast(
      nextStatus === 'published' ? 'success' : 'info',
      nextStatus === 'published' ? 'Đã xuất bản lịch chính thức' : 'Chuyển về trạng thái nháp',
      nextStatus === 'published'
        ? 'Nhân viên trên mọi thiết bị đã có thể xem lịch chính thức trong Employee Portal.'
        : 'Lịch hiện đang được chỉnh sửa nội bộ.'
    );
  };

  const manualAssignSlot = (
    assignmentId: string,
    userId: string | null,
    reason?: string,
    customHours?: { startTime?: string; endTime?: string }
  ) => {
    const targetBranch = schedule.branchId || currentBranchId;

    updateBranchSchedule(
      targetBranch,
      (prev) => {
        const isPostPublish = prev.status === 'published' || prev.status === 'changed';
        const nextStatus: ScheduleStatus = isPostPublish ? 'changed' : prev.status;
        const nextVersion = isPostPublish ? prev.version + 1 : prev.version;

        const nextAssignments = prev.assignments.map((a) => {
          if (a.id === assignmentId) {
            return {
              ...a,
              userId,
              branchId: a.branchId || targetBranch,
              isOverride: false,
              overrideReason: reason,
              customStartTime: customHours?.startTime,
              customEndTime: customHours?.endTime,
            };
          }
          return {
            ...a,
            branchId: a.branchId || targetBranch,
          };
        });

        const nextWarnings = prev.shortageWarnings.filter(
          (w) => !assignmentId.includes(w.roleId) || !assignmentId.includes(w.lineCode)
        );

        return {
          ...prev,
          branchId: targetBranch,
          status: nextStatus,
          version: nextVersion,
          assignments: nextAssignments,
          shortageWarnings: nextWarnings,
          lastModifiedAt: new Date().toISOString(),
        };
      },
      true
    );

    addAuditLog(
      'MANUAL_ASSIGN_SLOT',
      'ShiftAssignment',
      `Admin thay đổi vị trí ca [${assignmentId}]: Giao cho ${userId || 'Bỏ trống'}. Lý do: ${reason || 'Điều chỉnh thủ công'}`
    );

    addToast('info', 'Cập nhật phân công ca', 'Bảng lịch đã được lưu tự động lên cơ sở dữ liệu.');
  };

  const confirmOverride = (assignmentId: string, userId: string, reason: string) => {
    const targetBranch = schedule.branchId || currentBranchId;

    updateBranchSchedule(
      targetBranch,
      (prev) => {
        const isPostPublish = prev.status === 'published' || prev.status === 'changed';
        const nextStatus: ScheduleStatus = isPostPublish ? 'changed' : prev.status;
        const nextVersion = isPostPublish ? prev.version + 1 : prev.version;

        const nextAssignments = prev.assignments.map((a) => {
          if (a.id === assignmentId) {
            return {
              ...a,
              userId,
              branchId: a.branchId || targetBranch,
              isOverride: true,
              overrideReason: reason,
            };
          }
          return {
            ...a,
            branchId: a.branchId || targetBranch,
          };
        });

        const nextProposals = prev.overrideProposals.filter((p) => p.assignmentId !== assignmentId);

        return {
          ...prev,
          branchId: targetBranch,
          status: nextStatus,
          version: nextVersion,
          assignments: nextAssignments,
          overrideProposals: nextProposals,
          lastModifiedAt: new Date().toISOString(),
        };
      },
      true
    );

    addAuditLog(
      'CONFIRM_OVERRIDE',
      'ShiftAssignment',
      `Admin xác nhận Override: Bổ nhiệm ${userId} vào ca [${assignmentId}]. Lý do: ${reason}`
    );

    addToast('success', 'Xác nhận đề xuất Override thành công', 'Đã bổ nhiệm nhân viên vào vị trí theo phê duyệt của Admin.');
  };

  const clearSchedule = () => {
    const targetBranch = schedule.branchId || currentBranchId;
    updateBranchSchedule(
      targetBranch,
      (prev) => ({
        ...prev,
        status: 'draft',
        assignments: prev.assignments.map((a) => ({ ...a, userId: null })),
        shortageWarnings: [],
        overrideProposals: [],
        lastModifiedAt: new Date().toISOString(),
      }),
      true
    );
    addAuditLog('CLEAR_SCHEDULE', 'Schedule', 'Làm trống toàn bộ phân công ca trong tuần.');
    addToast('warning', 'Đã làm trống lịch', 'Toàn bộ ca làm đã được huỷ phân công.');
  };

  // Shift Requests (Đổi ca / Bán ca / Peer Handshake)
  const createShiftRequest = (
    reqData: Omit<ShiftRequest, 'id' | 'status' | 'createdAt' | 'branchId'>
  ) => {
    // Nghiệp vụ 4: Xác nhận 2 bước từ đồng nghiệp (Peer Handshake) cho Bán chỉ định & Đổi ca
    const needsPeerHandshake =
      (reqData.requestType === 'swap' || (reqData.requestType === 'sale' && !reqData.isOpenMarket)) &&
      Boolean(reqData.targetUserId);

    const newReq: ShiftRequest = {
      ...reqData,
      id: `REQ-${reqData.requestType.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      branchId: currentBranchId,
      status: 'pending',
      peerStatus: needsPeerHandshake ? 'waiting_peer' : 'not_required',
      createdAt: new Date().toLocaleString('vi-VN'),
    };

    const updated = [newReq, ...shiftRequests];
    setShiftRequests(updated);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}shiftRequests`, JSON.stringify(updated));
      broadcastSync('shiftRequests');
    } catch {}

    fetch(`${API_BASE_URL}/api/shift-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq),
    }).catch(() => {});

    addAuditLog(
      'CREATE_SHIFT_REQUEST',
      'ShiftRequest',
      `Tạo phiếu ${reqData.requestType === 'swap' ? 'Đổi ca' : reqData.requestType === 'sale' ? 'Bán ca' : 'Xin nghỉ'} từ ${reqData.requesterName}${
        needsPeerHandshake ? ` (Chờ đồng nghiệp ${reqData.targetUserName} xác nhận đồng ý — Peer Handshake)` : ''
      }`
    );
    addToast(
      'success',
      'Đã gửi phiếu yêu cầu',
      needsPeerHandshake
        ? `Đã gửi lời mời tới đồng nghiệp ${reqData.targetUserName}. Sau khi đồng nghiệp bấm Đồng Ý, phiếu sẽ trình Quản lý phê duyệt.`
        : 'Phiếu đã được chuyển vào hàng đợi phê duyệt của Admin chi nhánh.'
    );
  };

  // Nghiệp vụ 4: Đồng nghiệp xác nhận Đồng ý hoặc Từ chối lời mời Đổi ca / Bán ca chỉ định (Peer Handshake)
  const respondToPeerRequest = (requestId: string, decision: 'accept' | 'decline') => {
    const req = shiftRequests.find((r) => r.id === requestId);
    if (!req) return;

    let updatedReqObj: ShiftRequest | undefined;
    const updated = shiftRequests.map((r) => {
      if (r.id === requestId) {
        if (decision === 'accept') {
          updatedReqObj = {
            ...r,
            peerStatus: 'peer_accepted' as const,
            peerRespondedAt: new Date().toLocaleString('vi-VN'),
          };
          return updatedReqObj;
        } else {
          updatedReqObj = {
            ...r,
            peerStatus: 'peer_declined' as const,
            peerRespondedAt: new Date().toLocaleString('vi-VN'),
            status: 'rejected' as const,
            reviewNote: `Đồng nghiệp ${r.targetUserName} đã từ chối lời mời ${
              r.requestType === 'swap' ? 'đổi ca' : 'nhận ca'
            } (Bước Peer Handshake).`,
            reviewedAt: new Date().toLocaleString('vi-VN'),
          };
          return updatedReqObj;
        }
      }
      return r;
    });

    setShiftRequests(updated);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}shiftRequests`, JSON.stringify(updated));
      broadcastSync('shiftRequests');
    } catch {}

    if (updatedReqObj) {
      fetch(`${API_BASE_URL}/api/shift-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReqObj),
      }).catch(() => {});
    }

    if (decision === 'accept') {
      addAuditLog(
        'PEER_HANDSHAKE_ACCEPT',
        'ShiftRequest',
        `Đồng nghiệp ${req.targetUserName} đã ĐỒNG Ý xác nhận phiếu [${req.id}] từ ${req.requesterName}. Phiếu chính thức chuyển sang Admin duyệt.`
      );
      addToast(
        'success',
        'Đã xác nhận đồng ý (Peer Handshake)',
        'Phiếu đã hoàn tất xác nhận 2 bên và chuyển thẳng tới Quản lý chi nhánh để phê duyệt.'
      );
    } else {
      addAuditLog(
        'PEER_HANDSHAKE_DECLINE',
        'ShiftRequest',
        `Đồng nghiệp ${req.targetUserName} đã TỪ CHỐI lời mời [${req.id}] từ ${req.requesterName}.`
      );
      addToast('info', 'Đã từ chối lời mời', `Bạn đã từ chối lời mời từ ${req.requesterName}.`);
    }
  };

  const reviewShiftRequest = (
    requestId: string,
    status: 'approved' | 'rejected',
    reviewNote: string
  ) => {
    const req = shiftRequests.find((r) => r.id === requestId);
    if (!req) return;

    const targetBranch = req.branchId || schedule.branchId || currentBranchId;
    let updatedReqObj: ShiftRequest | undefined;

    const updatedRequests = shiftRequests.map((r) => {
      if (r.id === requestId) {
        updatedReqObj = {
          ...r,
          status,
          reviewerId: currentUser?.id,
          reviewNote,
          reviewedAt: new Date().toLocaleString('vi-VN'),
        };
        return updatedReqObj;
      }
      return r;
    });

    setShiftRequests(updatedRequests);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}shiftRequests`, JSON.stringify(updatedRequests));
      broadcastSync('shiftRequests');
    } catch {}

    if (updatedReqObj) {
      fetch(`${API_BASE_URL}/api/shift-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReqObj),
      }).catch(() => {});
    }

    // If approved, automatically update the schedule assignments and sync to Neon DB!
    if (status === 'approved') {
      updateBranchSchedule(
        targetBranch,
        (prevSchedule) => {
          const nextAssignments = prevSchedule.assignments.map((a) => {
            // Bán ca: Requester gives shift to target user (or claimed user from Open Market)
            if (req.requestType === 'sale') {
              const matchesShift =
                (req.assignmentId && a.id === req.assignmentId) ||
                (a.day === req.day && a.lineCode === req.lineCode && a.userId === req.requesterId);

              if (matchesShift) {
                const recipientId = req.targetUserId || req.claimedByUserId || null;
                return {
                  ...a,
                  userId: recipientId,
                  branchId: a.branchId || targetBranch,
                  isOverride: true,
                  overrideReason: `Chuyển ca theo phiếu bán ca [${req.id}] đã duyệt`,
                };
              }
            }

            // Đổi ca: Swap two users
            if (req.requestType === 'swap') {
              if (
                (req.assignmentId && a.id === req.assignmentId) ||
                (a.day === req.day && a.lineCode === req.lineCode && a.userId === req.requesterId)
              ) {
                return {
                  ...a,
                  userId: req.targetUserId || null,
                  branchId: a.branchId || targetBranch,
                  isOverride: true,
                  overrideReason: `Đổi ca theo phiếu [${req.id}] đã duyệt`,
                };
              }
              if (
                req.targetDay &&
                req.targetLineCode &&
                a.day === req.targetDay &&
                a.lineCode === req.targetLineCode &&
                a.userId === req.targetUserId
              ) {
                return {
                  ...a,
                  userId: req.requesterId,
                  branchId: a.branchId || targetBranch,
                  isOverride: true,
                  overrideReason: `Đổi ca theo phiếu [${req.id}] đã duyệt`,
                };
              }
            }

            // Xin nghỉ phép / Nghỉ thêm quá hạn mức (Leave request)
            if (req.requestType === 'leave') {
              if (a.day === req.day && a.userId === req.requesterId && (!req.lineCode || a.lineCode === req.lineCode)) {
                return {
                  ...a,
                  userId: null,
                  branchId: a.branchId || targetBranch,
                  isOverride: false,
                  overrideReason: `Trống ca do phiếu xin nghỉ [${req.id}] đã duyệt`,
                };
              }
            }

            return {
              ...a,
              branchId: a.branchId || targetBranch,
            };
          });

          return {
            ...prevSchedule,
            branchId: targetBranch,
            status: 'changed' as ScheduleStatus,
            version: prevSchedule.version + 1,
            assignments: nextAssignments,
            lastModifiedAt: new Date().toISOString(),
          };
        },
        true
      );

      if (req.requestType === 'leave') {
        setRegistrations((prev) =>
          prev.map((r) => {
            if (r.userId === req.requesterId && r.weekStartDate === CURRENT_WEEK_START) {
              const updatedReg: AvailabilityRegistration = {
                ...r,
                slots: {
                  ...r.slots,
                  [req.day]: 'OFF',
                },
              };
              fetch(`${API_BASE_URL}/api/availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: updatedReg.userId,
                  branchId: updatedReg.branchId || targetBranch,
                  weekStartDate: updatedReg.weekStartDate,
                  slots: updatedReg.slots,
                  dayCustomHours: updatedReg.dayCustomHours,
                  note: updatedReg.note,
                }),
              }).catch(() => {});
              return updatedReg;
            }
            return r;
          })
        );
      }

      addAuditLog(
        'APPROVE_SHIFT_REQUEST',
        'ShiftRequest',
        `Duyệt phiếu [${req.id}]: Đã tự động cập nhật lại lịch phân công, bảng giờ làm và tính lại bảng lương chuẩn xác.`
      );
      addToast(
        'success',
        'Duyệt phiếu thành công',
        'Lịch làm việc và bảng giờ/lương của toàn bộ nhân viên liên quan đã được tự động cập nhật lại.'
      );
    } else {
      addAuditLog('REJECT_SHIFT_REQUEST', 'ShiftRequest', `Từ chối phiếu [${req.id}]. Lý do: ${reviewNote}`);
      addToast('info', 'Từ chối phiếu yêu cầu', `Phiếu [${req.id}] đã bị từ chối.`);
    }
  };

  // Claim an Open Market Shift with Strict Business Qualification Check
  const claimOpenMarketShift = (requestId: string, employeeId: string, employeeName: string) => {
    const req = shiftRequests.find((r) => r.id === requestId);
    if (!req) return;

    const targetEmp = employees.find((e) => e.id === employeeId);
    if (!targetEmp) return;

    const assign = req.assignmentId
      ? schedule.assignments.find((a) => a.id === req.assignmentId)
      : schedule.assignments.find(
          (a) => a.day === req.day && a.lineCode === req.lineCode && a.userId === req.requesterId
        );

    const shiftRole = assign?.roleId
      ? roles.find((r) => r.id === assign.roleId)
      : req.roleId
      ? roles.find((r) => r.id === req.roleId)
      : undefined;

    const line = req.lineCode ? lineConfigs.find((l) => l.lineCode === req.lineCode) : undefined;
    const startTime = req.customStartTime || line?.startTime || '06:00';
    const endTime = req.customEndTime || line?.endTime || '14:00';

    const roleMap = new Map<string, BusinessRole>();
    roles.forEach((r) => roleMap.set(r.id, r));

    // Strict Qualification & Same Shift Conflict Check
    const check = checkShiftEligibility({
      targetEmployee: targetEmp,
      shiftRole,
      shiftDay: req.day,
      shiftLineCode: req.lineCode,
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      allAssignments: schedule.assignments,
      roleMap,
      excludeAssignmentId: req.assignmentId,
    });

    if (!check.isEligible) {
      addToast(
        'error',
        'Không thể nhận ca này',
        check.reasons[0] || 'Bạn không đủ điều kiện theo nghiệp vụ phân ca.'
      );
      return;
    }

    let updatedReqObj: ShiftRequest | undefined;
    const updated = shiftRequests.map((r) => {
      if (r.id === requestId) {
        updatedReqObj = {
          ...r,
          targetUserId: employeeId,
          targetUserName: employeeName,
          claimedByUserId: employeeId,
          claimedByUserName: employeeName,
          peerStatus: 'peer_accepted' as const,
          peerRespondedAt: new Date().toLocaleString('vi-VN'),
        };
        return updatedReqObj;
      }
      return r;
    });

    setShiftRequests(updated);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}shiftRequests`, JSON.stringify(updated));
      broadcastSync('shiftRequests');
    } catch {}

    if (updatedReqObj) {
      fetch(`${API_BASE_URL}/api/shift-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReqObj),
      }).catch(() => {});
    }

    addAuditLog(
      'CLAIM_OPEN_MARKET_SHIFT',
      'ShiftRequest',
      `Đồng nghiệp ${employeeName} (${employeeId}) đã bấm nhận ca mở bán [${requestId}]. Đã vượt qua kiểm tra nghiệp vụ và chuyển Admin chi nhánh phê duyệt.`
    );
    addToast('success', 'Nhận ca thành công', 'Phiếu đã được chuyển vào hàng đợi phê duyệt của Quản lý chi nhánh.');
  };

  // 10. Automatic Hours & Payroll Calculation Engine
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  // Calculate payroll on the fly based on schedule assignments and past day completion!
  useEffect(() => {
    const lineMap = new Map<LineCode, number>();
    lineConfigs.forEach((l) => lineMap.set(l.lineCode, l.durationHours));

    const roleRateMap = new Map<string, number>();
    roles.forEach((r) => roleRateMap.set(r.id, r.defaultHourlyRate));

    const records: PayrollRecord[] = employees
      .filter((e) => e.branchId === currentBranchId)
      .map((emp) => {
        let completedHours = 0;
        let projectedHours = 0;
        let basePay = 0;

        schedule.assignments.forEach((a) => {
          if (a.userId === emp.id) {
            let duration = lineMap.get(a.lineCode) || 6.5;
            if (a.customStartTime && a.customEndTime) {
              const custom = calculateHoursBetween(a.customStartTime, a.customEndTime);
              if (custom > 0) duration = custom;
            }
            const role = roles.find((r) => r.id === a.roleId || r.code === a.roleId || a.roleId.includes(r.code));
            const { rate } = calculateShiftHourlyRate(role, emp);
            const dayObj = DAYS_OF_WEEK.find((d) => d.key === a.day);

            if (dayObj?.isPast) {
              // End-of-day automatic hours accumulation!
              completedHours += duration;
              basePay += duration * rate;
            } else {
              // Projected future shifts in the week
              projectedHours += duration;
              basePay += duration * rate;
            }
          }
        });

        const otHours = otHoursMap[emp.id] ?? 0;
        const otMultiplier = 1.5;
        const avgRate = emp.baseHourlyRate || emp.wageRates[Object.keys(emp.wageRates)[0]] || 35000;
        const otPay = otHours * avgRate * otMultiplier;

        // Full-time deduction check if shortfall below standard rate
        let shortageDeduction = 0;
        const totalWeekHours = completedHours + projectedHours;
        const standardWeeklyRate = 40; // 208 / 4 = 52 or 40h/week
        if (emp.employmentType === 'full_time' && totalWeekHours < standardWeeklyRate) {
          const missingHours = standardWeeklyRate - totalWeekHours;
          shortageDeduction = missingHours * (avgRate * 0.7); // illustrative deduction rule
        }

        const totalPay = Math.max(0, basePay + otPay - shortageDeduction);

        return {
          userId: emp.id,
          employeeCode: emp.employeeCode,
          name: emp.name,
          branchId: emp.branchId,
          employmentType: emp.employmentType,
          completedHours,
          projectedHours,
          otHours,
          otMultiplier,
          basePay,
          otPay,
          shortageDeduction,
          totalPay,
          status: 'draft',
        };
      });

    setPayrollRecords(records);
  }, [schedule.assignments, lineConfigs, roles, employees, currentBranchId, otHoursMap]);

  const updateEmployeeOT = (userId: string, otHours: number) => {
    setOtHoursMap((prev) => ({ ...prev, [userId]: otHours }));

    const existingRec = payrollRecords.find((p) => p.userId === userId);
    fetch(`${API_BASE_URL}/api/payroll-ot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        branchId: currentBranchId,
        otHours,
        completedHours: existingRec?.completedHours || 0,
        projectedHours: existingRec?.projectedHours || 0,
        basePay: existingRec?.basePay || 0,
        otPay: existingRec?.otPay || 0,
        shortageDeduction: existingRec?.shortageDeduction || 0,
        totalPay: existingRec?.totalPay || 0,
      }),
    }).catch(() => {});

    addAuditLog('UPDATE_OT', 'Payroll', `Admin nhập OT cho nhân viên ${userId}: ${otHours} giờ`);
    addToast('success', 'Lưu giờ tăng ca (OT)', `Đã cập nhật ${otHours}h OT cho nhân viên.`);
  };

  const closeSolverModal = () => setShowSolverModal(false);

  const resetToMockData = () => {
    localStorage.clear();
    setBranches(MOCK_BRANCHES);
    setRoles(MOCK_ROLES);
    setEmployees(MOCK_EMPLOYEES);
    setLineConfigs(MOCK_LINE_CONFIGS);
    setLineRequirements(MOCK_LINE_REQUIREMENTS);
    setRegistrations(MOCK_REGISTRATIONS);
    setShiftRequests(MOCK_SHIFT_REQUESTS);
    setAuditLogs(MOCK_AUDIT_LOGS);
    setOtHoursMap({});

    const initialBranchStaff = MOCK_EMPLOYEES.filter(
      (e) => e.branchId === 'BR-HCM-01' && e.status === 'active'
    );
    const result = runBusinessScheduler(
      initialBranchStaff,
      MOCK_ROLES,
      MOCK_LINE_CONFIGS,
      MOCK_LINE_REQUIREMENTS,
      MOCK_REGISTRATIONS
    );

    const mockSched: WeeklySchedule = {
      id: 'SCH-WEEK-42',
      branchId: 'BR-HCM-01',
      weekStartDate: CURRENT_WEEK_START,
      weekEndDate: CURRENT_WEEK_END,
      status: 'published',
      version: 1,
      publishedAt: '2026-10-15 16:30',
      publishedBy: 'Lê Quốc Bảo (Admin Chi Nhánh Q1)',
      lastModifiedAt: new Date().toISOString(),
      assignments: result.assignments,
      shortageWarnings: result.shortageWarnings,
      overrideProposals: result.overrideProposals,
    };

    setSchedulesByBranch({ 'BR-HCM-01': mockSched });

    const admin = MOCK_EMPLOYEES.find((e) => e.roleType === 'branch_admin') || MOCK_EMPLOYEES[0];
    setCurrentUser(admin);
    setCurrentRoleType('branch_admin');
    setCurrentBranchId('BR-HCM-01');
    broadcastSync('all');

    addToast('info', 'Đặt lại dữ liệu chuẩn', 'Hệ thống đã phục hồi trạng thái mẫu theo đặc tả nghiệp vụ.');
  };

  return (
    <ScheduleContext.Provider
      value={{
        currentUser,
        currentRoleType,
        currentBranchId,
        branches,
        switchBranch,
        loginAs,
        loginWithUser,
        logout,
        switchRoleType,
        activeTab,
        setActiveTab,
        addBranch,
        updateBranch,
        deleteBranch,
        resetAllDataClean,
        employees,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        toggleEmployeeStatus,
        roles: branchRoles,
        addRole,
        updateRole,
        lineConfigs,
        lineRequirements,
        updateLineConfig,
        updateLineRequirement,
        registrations,
        saveAvailability,
        schedule,
        schedulesByBranch,
        autoGenerateSchedule,
        publishSchedule,
        manualAssignSlot,
        confirmOverride,
        clearSchedule,
        shiftRequests,
        createShiftRequest,
        respondToPeerRequest,
        reviewShiftRequest,
        claimOpenMarketShift,
        payrollRecords,
        updateEmployeeOT,
        auditLogs,
        addAuditLog,
        isSolving,
        solverLogs,
        showSolverModal,
        closeSolverModal,
        resetToMockData,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};
