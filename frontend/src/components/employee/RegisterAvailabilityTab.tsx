import React, { useState, useEffect } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { AvailabilityChoice, DayOfWeek, LineCode } from '../../types';
import { DAYS_OF_WEEK, AVAILABILITY_OPTIONS, LINE_META } from '../../utils/formatters';
import { AvailabilityBadge, RoleBadge, ContractBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Calendar,
  Save,
  Info,
  Clock,
  CheckCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const RegisterAvailabilityTab: React.FC = () => {
  const { currentUser, registrations, saveAvailability, roles } = useSchedule();

  if (!currentUser) return null;

  const existingReg = registrations.find(
    (r) => r.userId === currentUser.id && r.weekStartDate === '2026-10-19'
  );

  const [slots, setSlots] = useState<Record<DayOfWeek, AvailabilityChoice>>(() => {
    return (
      existingReg?.slots || {
        monday: 'O',
        tuesday: 'M',
        wednesday: 'D',
        thursday: 'O',
        friday: 'O_M',
        saturday: 'A',
        sunday: 'OFF',
      }
    );
  });

  const [dayCustomHours, setDayCustomHours] = useState<Partial<Record<DayOfWeek, string>>>(() => {
    return existingReg?.dayCustomHours || {};
  });

  const [expandedHoursDay, setExpandedHoursDay] = useState<DayOfWeek | null>(null);
  const [note, setNote] = useState<string>(() => existingReg?.note || '');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const reg = registrations.find(
        (r) => r.userId === currentUser.id && r.weekStartDate === '2026-10-19'
      );
      if (reg) {
        setSlots(reg.slots);
        setDayCustomHours(reg.dayCustomHours || {});
        setNote(reg.note || '');
      }
      setIsSaved(false);
    }
  }, [currentUser.id, registrations]);

  // Convert an AvailabilityChoice into active LineCodes
  const getLinesFromChoice = (choice: AvailabilityChoice): LineCode[] => {
    switch (choice) {
      case 'O':
        return ['O'];
      case 'M':
        return ['M'];
      case 'D':
        return ['D'];
      case 'O_M':
        return ['O', 'M'];
      case 'O_D':
        return ['O', 'D'];
      case 'M_D':
        return ['M', 'D'];
      case 'A':
        return ['O', 'M', 'D'];
      case 'OFF':
      default:
        return [];
    }
  };

  // Convert selected lines into AvailabilityChoice
  const getChoiceFromLines = (lines: LineCode[]): AvailabilityChoice => {
    const hasO = lines.includes('O');
    const hasM = lines.includes('M');
    const hasD = lines.includes('D');

    if (hasO && hasM && hasD) return 'A';
    if (hasO && hasM) return 'O_M';
    if (hasO && hasD) return 'O_D';
    if (hasM && hasD) return 'M_D';
    if (hasO) return 'O';
    if (hasM) return 'M';
    if (hasD) return 'D';
    return 'OFF';
  };

  // Toggle a line (O, M, or D) on/off for a given day
  const toggleLine = (day: DayOfWeek, line: LineCode) => {
    const currentLines = getLinesFromChoice(slots[day]);
    let nextLines: LineCode[];

    if (currentLines.includes(line)) {
      nextLines = currentLines.filter((l) => l !== line);
    } else {
      nextLines = [...currentLines, line];
    }

    const nextChoice = getChoiceFromLines(nextLines);
    setSlots((prev) => ({ ...prev, [day]: nextChoice }));
    setIsSaved(false);
  };

  // Select All Lines (A) for a day
  const handleSelectAllLines = (day: DayOfWeek) => {
    setSlots((prev) => ({ ...prev, [day]: 'A' }));
    setIsSaved(false);
  };

  // Set Day as OFF (Nghỉ)
  const handleSetDayOff = (day: DayOfWeek) => {
    setSlots((prev) => ({ ...prev, [day]: 'OFF' }));
    setIsSaved(false);
  };

  // Quick preset all days in week
  const handlePresetAllDays = (choice: AvailabilityChoice) => {
    setSlots((prev) => {
      const next = { ...prev };
      DAYS_OF_WEEK.forEach((d) => {
        next[d.key] = choice;
      });
      return next;
    });
    setIsSaved(false);
  };

  const handleCustomHoursChange = (day: DayOfWeek, val: string) => {
    setDayCustomHours((prev) => ({ ...prev, [day]: val }));
    setIsSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAvailability(currentUser.id, slots, note, dayCustomHours);
    setIsSaved(true);
  };

  const roleMap = new Map<string, typeof roles[0]>();
  roles.forEach((r) => roleMap.set(r.id, r));

  const offDaysCount = Object.values(slots).filter((s) => s === 'OFF').length;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Staff Summary Card */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">{currentUser.name}</h2>
            <span className="font-mono text-xs text-slate-500 font-semibold">({currentUser.employeeCode})</span>
            <ContractBadge type={currentUser.employmentType} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs text-slate-500 mr-1">Vị trí chuyên môn:</span>
            {currentUser.skills.map((sId) => {
              const r = roleMap.get(sId);
              if (!r) return null;
              return <RoleBadge key={sId} roleCode={r.code} roleName={r.name} size="sm" />;
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-center min-w-[110px]">
            <p className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Đăng ký nghỉ (OFF)</p>
            <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
              {offDaysCount} ngày
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-center min-w-[110px]">
            <p className="text-[10px] text-blue-700 font-mono uppercase font-semibold">Trạng thái phiếu</p>
            <p className="text-xs font-bold font-mono text-blue-900 mt-0.5">
              {existingReg ? 'Đã Nộp Lịch' : 'Chưa Nộp'}
            </p>
          </div>
        </div>
      </div>

      {/* Guide notice */}
      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg flex items-start gap-3 text-xs text-slate-700 shadow-2xs">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">Quy tắc đăng ký nguyện vọng (Mục 7 & Hướng dẫn):</span>{' '}
          Bạn có thể <b>tick chọn một hoặc nhiều ca trong ngày</b> (Ví dụ: Tick O & M $\rightarrow$ Sáng + Trưa, Tick O & D $\rightarrow$ Sáng + Tối làm ca gãy).{' '}
          Tick cả 3 ca hoặc bấm nút <b>A</b> nếu rảnh cả ngày. Bấm <b>OFF</b> nếu muốn đăng ký nghỉ. Nếu chỉ rảnh một khoảng giờ lẻ, hãy bấm{' '}
          <b>"⏱️ Giờ rảnh tùy chọn"</b> để ghi rõ khung giờ (ví dụ: 06:00 - 10:00).
        </div>
      </div>

      {/* Quick Presets */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Chọn nhanh toàn tuần:
          </span>
          <button
            type="button"
            onClick={() => handlePresetAllDays('O')}
            className="px-2.5 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md cursor-pointer transition-colors"
          >
            Tất cả Line O (Sáng)
          </button>
          <button
            type="button"
            onClick={() => handlePresetAllDays('M')}
            className="px-2.5 py-1 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-md cursor-pointer transition-colors"
          >
            Tất cả Line M (Trưa)
          </button>
          <button
            type="button"
            onClick={() => handlePresetAllDays('D')}
            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md cursor-pointer transition-colors"
          >
            Tất cả Line D (Tối)
          </button>
          <button
            type="button"
            onClick={() => handlePresetAllDays('O_M')}
            className="px-2.5 py-1 text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md cursor-pointer transition-colors"
          >
            Sáng + Trưa (O + M)
          </button>
          <button
            type="button"
            onClick={() => handlePresetAllDays('A')}
            className="px-2.5 py-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md cursor-pointer transition-colors"
          >
            Linh hoạt All (A)
          </button>
        </div>

        <div className="font-mono text-xs text-slate-500">
          Tuần 42 (19/10 - 25/10/2026)
        </div>
      </div>

      {/* 7-Day Interactive Matrix */}
      <div className="space-y-2.5">
        {DAYS_OF_WEEK.map((day) => {
          const currentChoice = slots[day.key];
          const activeLines = getLinesFromChoice(currentChoice);
          const isOff = currentChoice === 'OFF';
          const isAll = currentChoice === 'A';
          const isCustomExpanded = expandedHoursDay === day.key || Boolean(dayCustomHours[day.key]);

          return (
            <div
              key={day.key}
              className={`p-3.5 border rounded-lg transition-all ${
                isOff
                  ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Day Header Info */}
                <div className="w-48 shrink-0">
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>{day.label}</span>
                    <span className="font-mono text-xs text-slate-400">({day.dateStr})</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                    <span>Trạng thái:</span>
                    <strong className="font-mono text-slate-900">
                      {AVAILABILITY_OPTIONS[currentChoice]?.label}
                    </strong>
                  </div>
                  {dayCustomHours[day.key] && (
                    <div className="text-[11px] font-mono text-blue-700 font-semibold mt-0.5 flex items-center gap-1">
                      <Clock size={11} />
                      <span>{dayCustomHours[day.key]}</span>
                    </div>
                  )}
                </div>

                {/* Multi-select Buttons for Line O, Line M, Line D, A, and OFF */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Line O Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleLine(day.key, 'O')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeLines.includes('O')
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeLines.includes('O') ? 'bg-white' : 'bg-amber-400'}`} />
                    <span>Line O (Sáng: 05:30 - 12:00)</span>
                  </button>

                  {/* Line M Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleLine(day.key, 'M')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeLines.includes('M')
                        ? 'bg-sky-600 text-white border-sky-700 shadow-xs font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-sky-50 hover:border-sky-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeLines.includes('M') ? 'bg-white' : 'bg-sky-400'}`} />
                    <span>Line M (Trưa: 11:00 - 18:00)</span>
                  </button>

                  {/* Line D Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleLine(day.key, 'D')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeLines.includes('D')
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${activeLines.includes('D') ? 'bg-white' : 'bg-indigo-400'}`} />
                    <span>Line D (Tối: 17:00 - 23:30)</span>
                  </button>

                  {/* All (A) Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectAllLines(day.key)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                      isAll
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                    title="Rảnh cả ngày (Làm được mọi Line O, M, D)"
                  >
                    A (All)
                  </button>

                  {/* OFF Button */}
                  <button
                    type="button"
                    onClick={() => handleSetDayOff(day.key)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                      isOff
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                    title="Nghỉ ca ngày này"
                  >
                    OFF (Nghỉ)
                  </button>

                  {/* Custom Hours Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setExpandedHoursDay(expandedHoursDay === day.key ? null : day.key)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                      dayCustomHours[day.key]
                        ? 'bg-blue-100 text-blue-900 border-blue-300 font-semibold'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                    title="Bấm để ghi rõ khung giờ rảnh lẻ"
                  >
                    <Clock size={12} />
                    <span>{dayCustomHours[day.key] ? 'Đã chỉnh giờ' : 'Khung giờ lẻ'}</span>
                    {expandedHoursDay === day.key ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {/* Expandable Custom Hours & Split Shift Note Input */}
              {isCustomExpanded && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 bg-slate-50/80 p-2.5 rounded-md space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-600" />
                      <span>Khung giờ rảnh tùy chọn / Ghi chú giờ lẻ (Cho {day.label}):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCustomHoursChange(day.key, '')}
                      className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer underline"
                    >
                      Xóa giờ tùy chỉnh
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={dayCustomHours[day.key] || ''}
                      onChange={(e) => handleCustomHoursChange(day.key, e.target.value)}
                      placeholder="Ví dụ: 06:00 - 10:00 (Sáng rảnh đến 10h), hoặc 18:00 - 22:00..."
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {/* Quick preset chips */}
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        '06:00 - 10:00',
                        '07:00 - 11:00',
                        '14:00 - 18:00',
                        '18:00 - 22:00',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleCustomHoursChange(day.key, preset)}
                          className="px-2 py-1 text-[11px] font-mono bg-white border border-slate-300 hover:bg-blue-50 hover:border-blue-400 rounded text-slate-700 cursor-pointer transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note for Admin & Submit */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
            Ghi chú chung gửi Admin Chi Nhánh (Lịch thi cử / Gia đình)
          </label>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setIsSaved(false);
            }}
            placeholder="Ví dụ: Thứ 2 và Thứ 4 có lịch kiểm tra trường nên chỉ làm được ca tối; Cuối tuần sẵn sàng hỗ trợ ca gãy nếu chi nhánh thiếu người..."
            rows={2}
            className="w-full p-2.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-600">
            {existingReg?.submittedAt ? (
              <span>Đã nộp phiếu lúc: <b className="font-mono text-slate-800">{existingReg.submittedAt}</b></span>
            ) : (
              <span>Chưa gửi phiếu đăng ký tuần 42.</span>
            )}
            {isSaved && (
              <span className="text-emerald-700 font-bold ml-2">✓ Đã lưu thành công vào hệ thống!</span>
            )}
          </div>

          <Button type="submit" variant="primary" size="md" icon={<Save size={14} />} className="shadow-xs font-bold">
            Lưu & Gửi Phiếu Nguyện Vọng
          </Button>
        </div>
      </form>
    </div>
  );
};
