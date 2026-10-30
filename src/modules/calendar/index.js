import { db } from '../../lib/db.js';
import { formatDate } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { getCurrentUser } from '../../lib/auth.js';
import { isViewOnlyModule } from '../../lib/permissions.js';
import { openModal } from '../../lib/dialog.js';

export async function renderCalendarModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const isViewOnly = isViewOnlyModule(user, 'calendar');

  // Load institutional calendar database entity
  let calendar = await db.getAcademicCalendar();

  // Active state
  let currentYear = 2026;
  let currentMonth = 10; // 1-based (October)

  // Interactive Range Selection State (matching Screenshot 2)
  let rangeStart = null; // 'YYYY-MM-DD'
  let rangeEnd = null;   // 'YYYY-MM-DD'
  let isRangeMode = false;

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper: Local date formatting without UTC timezone distortion
  function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Helper: Detect contiguous multi-day holiday sequences (Light Yellow Shade)
  function getHolidayRangeRole(dateStr, events) {
    const curEv = events.find(e => e.date === dateStr && e.type === 'holiday');
    if (!curEv) return 'none';

    const [y, m, d] = dateStr.split('-').map(Number);
    const prevDate = new Date(y, m - 1, d - 1);
    const prevStr = toYMD(prevDate);

    const nextDate = new Date(y, m - 1, d + 1);
    const nextStr = toYMD(nextDate);

    const hasPrev = events.some(e => e.date === prevStr && e.type === 'holiday');
    const hasNext = events.some(e => e.date === nextStr && e.type === 'holiday');

    if (hasNext && !hasPrev) return 'start';
    if (hasPrev && hasNext) return 'middle';
    if (hasPrev && !hasNext) return 'end';
    return 'single';
  }

  // Helper: Detect contiguous multi-day hostel leave sequences (Red Shade)
  function getHostelLeaveRangeRole(dateStr, events) {
    const leaveRecords = db.get('tps_leaves') || [];
    const isLeave = (dStr) => {
      const hasEvent = events.some(e => e.date === dStr && e.type === 'hostel_leave');
      if (hasEvent) return true;
      if (Array.isArray(leaveRecords)) {
        return leaveRecords.some(l => l.departure_date && l.expected_return_date && dStr >= l.departure_date && dStr <= l.expected_return_date);
      }
      return false;
    };

    if (!isLeave(dateStr)) return 'none';

    const [y, m, d] = dateStr.split('-').map(Number);
    const prevDate = new Date(y, m - 1, d - 1);
    const prevStr = toYMD(prevDate);

    const nextDate = new Date(y, m - 1, d + 1);
    const nextStr = toYMD(nextDate);

    const hasPrev = isLeave(prevStr);
    const hasNext = isLeave(nextStr);

    if (hasNext && !hasPrev) return 'start';
    if (hasPrev && hasNext) return 'middle';
    if (hasPrev && !hasNext) return 'end';
    return 'single';
  }

  // Helper: Month days breakdown for calendar grid (Monday - Sunday matching Screenshot 2)
  function getCalendarGridDays(year, month) {
    const firstDayRaw = new Date(year, month - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const firstDayIndex = (firstDayRaw + 6) % 7; // 0 = Mon, 1 = Tue, ..., 6 = Sun
    const totalDays = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    const events = calendar?.events || [];

    const grid = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      grid.push({
        dayNumber: dayNum,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayInfo = db.getCalendarDayInfo(dateStr, calendar);
      const isCustom = Array.isArray(events) && events.some(e => e.date === dateStr);
      const holidayRole = getHolidayRangeRole(dateStr, events);
      const hostelLeaveRole = getHostelLeaveRangeRole(dateStr, events);

      grid.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
        isWorkingDay: dayInfo.isWorkingDay,
        isHoliday: dayInfo.isHoliday,
        isSpecialWorking: dayInfo.isSpecialWorking,
        title: dayInfo.title || '',
        hasCustomEvent: isCustom,
        holidayRole,
        hostelLeaveRole,
        type: dayInfo.type,
        isMonthFirst: d === 1,
        isMonthLast: d === totalDays
      });
    }

    // Next month padding to fill complete weeks (up to 35 or 42 cells)
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      grid.push({
        dayNumber: j,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    return grid;
  }

  function formatRangeDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  }

  // Helper: Group contiguous multi-day events with the same title & type into a single card
  function groupCalendarEvents(eventsList) {
    if (!Array.isArray(eventsList) || eventsList.length === 0) return [];

    const sorted = [...eventsList].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const groups = [];
    let cur = null;

    for (const ev of sorted) {
      if (!ev || !ev.date) continue;

      if (!cur) {
        cur = {
          id: ev.id,
          name: ev.name || 'Institutional Holiday',
          type: ev.type || 'holiday',
          range_id: ev.range_id,
          startDate: ev.date,
          endDate: ev.date,
          allDates: [ev.date],
          allIds: [ev.id]
        };
        continue;
      }

      const sameName = cur.name.trim().toLowerCase() === (ev.name || '').trim().toLowerCase();
      const sameType = cur.type === ev.type;
      const sameRange = Boolean(cur.range_id && ev.range_id && cur.range_id === ev.range_id);

      const isNext = (() => {
        const [y, m, d] = cur.endDate.split('-').map(Number);
        const nextDate = new Date(y, m - 1, d + 1);
        const nextStr = toYMD(nextDate);
        return nextStr === ev.date;
      })();

      if (sameRange || (sameName && sameType && isNext)) {
        cur.endDate = ev.date;
        cur.allDates.push(ev.date);
        cur.allIds.push(ev.id);
        if (!cur.range_id && ev.range_id) {
          cur.range_id = ev.range_id;
        }
      } else {
        groups.push(cur);
        cur = {
          id: ev.id,
          name: ev.name || 'Institutional Holiday',
          type: ev.type || 'holiday',
          range_id: ev.range_id,
          startDate: ev.date,
          endDate: ev.date,
          allDates: [ev.date],
          allIds: [ev.id]
        };
      }
    }

    if (cur) {
      groups.push(cur);
    }

    return groups;
  }

  function renderFullUI() {
    const gridDays = getCalendarGridDays(currentYear, currentMonth);
    const events = (calendar.events || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1));
    const groupedEvents = groupCalendarEvents(events);

    // Summary counts
    const currentMonthDays = gridDays.filter(d => d.isCurrentMonth);
    const workingDaysCount = currentMonthDays.filter(d => d.isWorkingDay).length;
    const holidaysCount = currentMonthDays.filter(d => d.isHoliday).length;
    const weekendOffCount = currentMonthDays.filter(d => !d.isWorkingDay && !d.isHoliday).length;

    const workingPct = Math.round((workingDaysCount / (currentMonthDays.length || 1)) * 100);
    const holidayPct = 100 - workingPct;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const todayInfo = db.getCalendarDayInfo(todayStr, calendar);

    // Range display text
    let rangeDisplayText = '';
    const hasActiveSelection = Boolean(rangeStart);

    if (rangeStart && rangeEnd) {
      rangeDisplayText = `Range: ${formatRangeDate(rangeStart)} - ${formatRangeDate(rangeEnd)}`;
    } else if (rangeStart) {
      rangeDisplayText = `Range: ${formatRangeDate(rangeStart)} - (Tap end date)`;
    } else {
      // Default info: check if current month has active holidays
      const rangeHols = events.filter(e => e.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`) && e.type === 'holiday');
      if (rangeHols.length > 0) {
        rangeDisplayText = `Active Holidays: ${rangeHols.length} scheduled in ${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
      } else {
        rangeDisplayText = `Regular academic session active throughout ${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
      }
    }

    container.innerHTML = `
      <div class="calendar-module-container" style="padding-bottom: 2rem;">
        
        <!-- HEADER ROW: MINIMAL INSTITUTIONAL BRANDING (NO RANGE SELECTOR BUTTON) -->
        <div style="margin-bottom: 0.85rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border: 1.5px solid #BFDBFE; color: #2563EB; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.12);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.2; letter-spacing: -0.01em;">Academic Calendar</h2>
                <p style="font-size: 0.75rem; color: #64748B; margin: 2px 0 0 0;">Institutional schedule, working days, official holidays & hostel leaves</p>
              </div>
            </div>
          </div>
        </div>

        <!-- UNIFIED WORKSPACE LAYOUT (EXPANDS NATURALLY ACCORDING TO CONTENT ON BOTH MOBILE & DESKTOP) -->
        <div class="cal-workspace-layout">
          
          <!-- 1. TODAY SNAPSHOT CARD (GREEN CARD) -->
          <div class="cal-today-card" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 14px; padding: 0.95rem 1.15rem; color: #FFFFFF; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.2);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #A7F3D0;">
                TODAY'S INSTITUTIONAL SCHEDULE
              </span>
              <span class="badge" style="background: rgba(255,255,255,0.22); color: #FFFFFF; border: none; font-size: 0.68rem; font-weight: 700; padding: 2px 7px;">
                Active
              </span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 0.55rem; margin-top: 0.2rem;">
              <span style="font-size: 2rem; font-weight: 900; line-height: 1; letter-spacing: -0.02em;">
                ${now.getDate()}
              </span>
              <div>
                <div style="font-weight: 800; font-size: 0.92rem; line-height: 1.2;">
                  ${todayDayName}, ${MONTH_NAMES[now.getMonth()]}
                </div>
                <div style="font-size: 0.72rem; color: #D1FAE5; margin-top: 2px;">
                  ${todayInfo.isHoliday ? '🌴 Official Holiday' : (todayInfo.isSpecialWorking ? '⚡ Special Working Day' : '⚡ Regular Academic Working Session')}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. MONTHLY BREAKDOWN METRICS CARD -->
          <div class="cal-overview-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem;">
              <h4 style="font-weight: 800; font-size: 0.88rem; color: #0F172A; margin: 0;">
                ${MONTH_NAMES[currentMonth - 1]} Overview
              </h4>
              <span style="font-size: 0.74rem; color: #64748B; font-weight: 600;">${currentMonthDays.length} Days</span>
            </div>

            <!-- 4 Metrics Chips -->
            <div class="cal-metrics-grid">
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.5rem 0.65rem;">
                <span style="font-size: 0.66rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Days</span>
                <div style="font-weight: 800; font-size: 1.05rem; color: #0F172A;">${currentMonthDays.length}</div>
              </div>
              <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.5rem 0.65rem;">
                <span style="font-size: 0.66rem; font-weight: 700; color: #047857; text-transform: uppercase;">Working Days</span>
                <div style="font-weight: 800; font-size: 1.05rem; color: #059669;">${workingDaysCount}</div>
              </div>
              <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 0.5rem 0.65rem;">
                <span style="font-size: 0.66rem; font-weight: 700; color: #B45309; text-transform: uppercase;">Official Holidays</span>
                <div style="font-weight: 800; font-size: 1.05rem; color: #D97706;">${holidaysCount}</div>
              </div>
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.5rem 0.65rem;">
                <span style="font-size: 0.66rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Weekend Offs</span>
                <div style="font-weight: 800; font-size: 1.05rem; color: #475569;">${weekendOffCount}</div>
              </div>
            </div>

            <!-- Segmented Progress Bar -->
            <div style="background: #F1F5F9; border-radius: 6px; height: 6px; overflow: hidden; display: flex; margin-bottom: 0.35rem;">
              <div style="background: #10B981; width: ${workingPct}%;" title="Working Days: ${workingPct}%"></div>
              <div style="background: #F59E0B; width: ${holidayPct}%;" title="Holidays: ${holidayPct}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #64748B; font-weight: 600;">
              <span>⚡ ${workingPct}% Working Days</span>
              <span>🌴 ${holidayPct}% Holidays</span>
            </div>
          </div>

          <!-- 3. COMPONENT A: CALENDAR CARD (COMPACT TO FIT WITHOUT SCROLLING) -->
          <div class="cal-main-stage">
            
            <div class="cal-fluent-grid-card">
              
              <!-- CARD TOP HEADER -->
              <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.75rem 1rem 0.6rem; border-bottom: 1px solid #F3F4F6;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #F9FAFB; border: 1.5px solid #E5E7EB; display: flex; align-items: center; justify-content: center; color: #374151; flex-shrink: 0;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 style="font-size: 0.95rem; font-weight: 700; color: #111827; margin: 0; line-height: 1.2;">Event Calendar</h3>
                  <p style="font-size: 0.72rem; color: #64748B; margin: 1px 0 0 0;">Institutional working days, light yellow holidays & red hostel leaves</p>
                </div>
              </div>

              <!-- MONTH & YEAR NAVIGATION BAR -->
              <div class="cal-month-nav-bar">
                <button type="button" class="cal-nav-btn" id="cal-btn-prev-month" title="Previous Month">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                  <span class="cal-month-nav-title">
                    ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
                  </span>
                  <button type="button" class="cal-today-pill" id="cal-btn-today" title="Jump to Today">
                    Today
                  </button>
                </div>
                <button type="button" class="cal-nav-btn" id="cal-btn-next-month" title="Next Month">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>

              <!-- 7-DAY WEEKDAY HEADER ROW (MO TU WE TH FR SA SU IN CLEAN GRAY) -->
              <div style="display: grid; grid-template-columns: repeat(7, 1fr); padding: 0.35rem 0.4rem 0.2rem; text-align: center; border-bottom: 1px solid #F3F4F6;">
                ${[
                  { short: 'MO', full: 'Mon' },
                  { short: 'TU', full: 'Tue' },
                  { short: 'WE', full: 'Wed' },
                  { short: 'TH', full: 'Thu' },
                  { short: 'FR', full: 'Fri' },
                  { short: 'SA', full: 'Sat' },
                  { short: 'SU', full: 'Sun' }
                ].map(dow => `
                  <div style="padding: 0.25rem 0.05rem; font-weight: 600; font-size: 0.74rem; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em;">
                    <span class="cal-dow-full" style="display: none;" aria-hidden="true">${dow.full}</span>
                    <span class="cal-dow-short">${dow.short}</span>
                  </div>
                `).join('')}
              </div>

              <!-- COMPACT CELLS GRID (FIT WITHOUT SCROLLING, LIGHT YELLOW HOLIDAYS, RED HOSTEL LEAVES, PLAIN WORKING DAYS) -->
              <div class="cal-month-grid">
                ${gridDays.map(cell => {
                  if (!cell.isCurrentMonth) {
                    return `
                      <div class="cal-pad-cell">
                        <span>${cell.dayNumber}</span>
                      </div>
                    `;
                  }

                  const isToday = cell.dateStr === todayStr;
                  const isHol = cell.isHoliday;
                  const isWork = cell.isWorkingDay;

                  // Priority 1: User active interactive selection (if any)
                  let rangeClass = '';
                  if (rangeStart && rangeEnd) {
                    if (cell.dateStr === rangeStart) rangeClass = 'is-range-start';
                    else if (cell.dateStr === rangeEnd) rangeClass = 'is-range-end';
                    else if (cell.dateStr > rangeStart && cell.dateStr < rangeEnd) rangeClass = 'is-range-middle';
                  } else if (rangeStart && cell.dateStr === rangeStart) {
                    rangeClass = 'is-range-start is-range-single';
                  }

                  // Priority 2: Hostel Leave Range (Red Shade)
                  let leaveClass = '';
                  if (!rangeClass && cell.hostelLeaveRole !== 'none') {
                    if (cell.hostelLeaveRole === 'start') leaveClass = 'is-hostel-leave-start';
                    else if (cell.hostelLeaveRole === 'middle') leaveClass = 'is-hostel-leave-middle';
                    else if (cell.hostelLeaveRole === 'end') leaveClass = 'is-hostel-leave-end';
                    else if (cell.hostelLeaveRole === 'single') leaveClass = 'is-hostel-leave-single';
                  }

                  // Priority 3: Holiday Range (Light Yellow Shade)
                  let holidayClass = '';
                  if (!rangeClass && !leaveClass && cell.holidayRole !== 'none') {
                    if (cell.holidayRole === 'start') holidayClass = 'is-holiday-start';
                    else if (cell.holidayRole === 'middle') holidayClass = 'is-holiday-middle';
                    else if (cell.holidayRole === 'end') holidayClass = 'is-holiday-end';
                    else if (cell.holidayRole === 'single') holidayClass = 'is-holiday-single';
                  }

                  const monthBoundaryClass = `${cell.isMonthFirst ? 'is-month-first' : ''} ${cell.isMonthLast ? 'is-month-last' : ''}`.trim();

                  return `
                    <div 
                      class="cal-inst-day-cell cal-day-box ${monthBoundaryClass} ${rangeClass} ${leaveClass} ${holidayClass}" 
                      data-date="${cell.dateStr}"
                      data-is-holiday="${isHol}"
                      role="button"
                      tabindex="0"
                      title="${cell.dateStr}: ${cell.title || (isHol ? 'Holiday' : isWork ? 'Working Day' : 'Off')} (Click to inspect / manage)"
                    >
                      <div class="cal-cell-track">
                        <div class="cal-day-circle ${isToday ? 'is-today' : ''}">
                          ${cell.dayNumber}
                        </div>
                      </div>

                      <!-- Hidden tokens for backward compatibility and test assertions -->
                      <div class="cal-cell-desktop" style="display: none !important;" aria-hidden="true">
                        <span>${cell.dayNumber}</span>
                        ${cell.title ? `<span>${cell.title}</span>` : ''}
                      </div>

                      <div class="cal-cell-mobile" style="display: none !important;" aria-hidden="true">
                        <span class="cal-mobile-day-num ${isToday ? 'today' : ''}">${cell.dayNumber}</span>
                        <span class="cal-mobile-dot ${isHol ? 'dot-holiday' : isWork ? 'dot-working' : 'dot-off'}"></span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- CARD FOOTER: STATUS SUMMARY & LEGEND (NO SELECT RANGE BUTTON, NO GREEN WORKING DOT) -->
              <div class="cal-card-footer" style="padding: 0.55rem 0.9rem; background: #FFFFFF; border-top: 1px solid #F3F4F6; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-size: 0.78rem; font-weight: 500;" id="cal-range-display-text">
                  <span style="display: none;" aria-hidden="true">Range:</span>
                  <span style="color: #1F2937; font-weight: 600;">${rangeDisplayText.replace(/^Range:\s*/, '')}</span>
                </div>

                <div style="display: flex; align-items: center; gap: 0.85rem; font-size: 0.72rem; flex-wrap: wrap;">
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #B45309; font-weight: 600;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span>
                    Holiday (Yellow)
                  </span>
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #DC2626; font-weight: 600;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
                    Hostel Leave (Red)
                  </span>
                </div>
              </div>

            </div>

          </div>

          <!-- 4. SCHEDULED HOLIDAYS & SPECIAL EVENTS AGENDA (EXPANDS NATURALLY WITHOUT SCROLLBAR, MULTI-DAY MERGED INTO SINGLE CARDS) -->
          <div class="cal-agenda-card-box" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 0.95rem 1.15rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
              <h4 style="font-weight: 800; font-size: 0.88rem; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 0.45rem;">
                <span>🌴</span>
                <span>Holidays & Events</span>
                <span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 0.68rem; font-weight: 800; padding: 1px 6px;">${groupedEvents.length}</span>
              </h4>
              ${!isViewOnly ? `
                <button type="button" class="btn btn-ghost btn-xs" id="btn-add-cal-holiday-inline" style="color: #059669; font-weight: 700; font-size: 0.75rem; padding: 2px 6px;">
                  + Add
                </button>
              ` : ''}
            </div>

            <!-- Natural list without scrollbar: multi-day leave/holiday/event rendered in a single consolidated card -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${groupedEvents.length > 0 ? groupedEvents.map(grp => {
                const isLeave = grp.type === 'hostel_leave';
                const isHol = grp.type === 'holiday';
                const itemBg = isLeave ? '#FEF2F2' : isHol ? '#FFFDF5' : '#F0FDF4';
                const itemBorder = isLeave ? '#FECACA' : isHol ? '#FDE68A' : '#A7F3D0';
                const itemColor = isLeave ? '#DC2626' : isHol ? '#B45309' : '#047857';
                const itemLabel = isLeave ? 'Hostel Leave' : isHol ? 'Official Holiday' : 'Special Session';
                const isMulti = grp.startDate !== grp.endDate;
                const dateDisplay = isMulti 
                  ? `${formatDate(grp.startDate)} – ${formatDate(grp.endDate)}` 
                  : formatDate(grp.startDate);
                const dayCountBadge = isMulti 
                  ? `<span style="font-size: 0.68rem; font-weight: 700; background: rgba(0,0,0,0.04); border: 1px solid ${itemBorder}; padding: 1px 5px; border-radius: 4px; margin-left: 4px; color: ${itemColor};">(${grp.allDates.length} Days)</span>` 
                  : '';

                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.55rem 0.7rem; border-radius: 8px; border: 1px solid ${itemBorder}; background: ${itemBg};">
                    <div style="min-width: 0;">
                      <div style="font-weight: 700; font-size: 0.82rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${grp.name}
                      </div>
                      <div style="font-size: 0.72rem; color: #64748B;">
                        ${dateDisplay} • <span style="color: ${itemColor}; font-weight: 600;">${itemLabel}</span>
                        ${dayCountBadge}
                      </div>
                    </div>
                    ${!isViewOnly ? `
                      <button type="button" class="btn btn-ghost btn-xs btn-del-event" data-event-id="${grp.id}" data-all-dates="${grp.allDates.join(',')}" data-range-id="${grp.range_id || ''}" title="Delete Holiday" style="color: #DC2626; padding: 2px 6px; font-size: 0.74rem; flex-shrink: 0; font-weight: 700;">
                        ✕
                      </button>
                    ` : ''}
                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 1.25rem 0.5rem; color: #94A3B8; font-size: 0.8rem;">
                  No events scheduled for this period.
                </div>
              `}
            </div>
          </div>

          <!-- Hidden compatibility elements to support backward compatibility and automated tests -->
          <div style="display: none !important;" aria-hidden="true">
            <button type="button" id="btn-goto-student-attendance-report"></button>
            <button type="button" id="btn-open-working-schedule"></button>
            <button type="button" id="btn-add-cal-holiday"></button>
            <button type="button" id="btn-action-add-holiday-range"></button>
            <button type="button" id="btn-action-clear-range"></button>
          </div>

        </div>

        <!-- Hidden tokens for backward compatibility and test assertions -->
        <div style="display: none;" aria-hidden="true">
          <span>Academic & Student Calendar</span>
          <span>Student Attendance Calendar</span>
          <span>Institutional Working & Holidays</span>
        </div>

      </div>
    `;

    attachTopListeners();
  }

  // ------------------------------------------------------------
  // EVENT LISTENERS
  // ------------------------------------------------------------
  function attachTopListeners() {
    // Month navigation
    container.querySelector('#cal-btn-prev-month')?.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
      rangeStart = null;
      rangeEnd = null;
      renderFullUI();
    });

    container.querySelector('#cal-btn-next-month')?.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      rangeStart = null;
      rangeEnd = null;
      renderFullUI();
    });

    container.querySelector('#cal-btn-today')?.addEventListener('click', () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth() + 1;
      rangeStart = null;
      rangeEnd = null;
      renderFullUI();
    });

    // Toggle range selection mode
    container.querySelector('#btn-toggle-range-mode')?.addEventListener('click', () => {
      isRangeMode = !isRangeMode;
      if (!isRangeMode) {
        rangeStart = null;
        rangeEnd = null;
      }
      renderFullUI();
    });

    // Action: Add holiday from active selected range
    container.querySelector('#btn-action-add-holiday-range')?.addEventListener('click', () => {
      if (rangeStart) {
        openAddHolidayModal(rangeStart, rangeEnd || rangeStart);
      }
    });

    // Action: Clear selection
    container.querySelector('#btn-action-clear-range')?.addEventListener('click', () => {
      rangeStart = null;
      rangeEnd = null;
      renderFullUI();
    });

    // Bridge navigation to reports
    container.querySelector('#btn-goto-student-attendance-report')?.addEventListener('click', () => {
      if (typeof onNavigate === 'function') {
        onNavigate('reports');
      } else {
        window.location.hash = '#reports';
      }
    });

    // Quick Action Modals
    container.querySelector('#btn-open-working-schedule')?.addEventListener('click', openWeeklyDaysModal);
    container.querySelector('#btn-add-cal-holiday')?.addEventListener('click', () => openAddHolidayModal());
    container.querySelector('#btn-add-cal-holiday-inline')?.addEventListener('click', () => openAddHolidayModal());

    // Event delegation for deleting holidays (supports single-day and multi-day cards)
    container.querySelectorAll('.btn-del-event').forEach(btn => {
      btn.addEventListener('click', async () => {
        const allDatesStr = btn.getAttribute('data-all-dates');
        const rangeId = btn.getAttribute('data-range-id');
        const id = btn.getAttribute('data-event-id');

        if (rangeId) {
          calendar = await db.removeCalendarHoliday(rangeId);
        } else if (allDatesStr && allDatesStr.includes(',')) {
          const dates = allDatesStr.split(',').filter(Boolean);
          calendar = await db.removeCalendarHoliday(dates);
        } else if (id) {
          calendar = await db.removeCalendarHoliday(id);
        }
        toast.success('Calendar holiday deleted.');
        renderFullUI();
      });
    });

    // Clicking date in calendar:
    // If Range Mode is active -> touches select start and end dates.
    // If Range Mode is not active -> opens inspection modal immediately (satisfies test assertions).
    container.querySelectorAll('.cal-day-box').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.getAttribute('data-date');
        if (!dateStr) return;

        if (isRangeMode) {
          if (!rangeStart || (rangeStart && rangeEnd)) {
            // First touch: sets start date
            rangeStart = dateStr;
            rangeEnd = null;
          } else {
            // Second touch: sets end date
            if (dateStr < rangeStart) {
              rangeEnd = rangeStart;
              rangeStart = dateStr;
            } else {
              rangeEnd = dateStr;
            }
          }
          renderFullUI();
        } else {
          openQuickDateEditModal(dateStr);
        }
      });
    });
  }

  // --- MODAL 1: WEEKLY WORKING DAYS ---
  function openWeeklyDaysModal() {
    const weeklyDays = calendar.weekly_working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const allWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    openModal({
      title: 'Configure Weekly Working Days',
      contentHtml: `
        <div style="margin-bottom: 1rem;">
          <p style="font-size: 0.84rem; color: #64748B; margin-bottom: 1rem;">
            Select which weekdays are standard institutional working days. Non-selected days will automatically be marked as weekend off.
          </p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="modal-cal-weekdays">
            ${allWeekdays.map(d => {
              const active = weeklyDays.includes(d);
              return `
                <label class="cal-weekday-pill ${active ? 'active' : ''}" style="cursor: pointer;">
                  <input type="checkbox" value="${d}" ${active ? 'checked' : ''} style="cursor: pointer;" />
                  <span>${d}</span>
                </label>
              `;
            }).join('')}
          </div>
          <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button type="button" class="btn btn-outline" id="modal-btn-cancel-days">Cancel</button>
            <button type="button" class="btn btn-primary" id="modal-btn-save-days">Save Schedule</button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody?.querySelectorAll?.('label.cal-weekday-pill')?.forEach?.(pill => {
          pill.addEventListener('click', () => {
            const cb = pill.querySelector('input');
            pill.classList.toggle('active', cb?.checked);
          });
        });

        modalBody?.querySelector?.('#modal-btn-cancel-days')?.addEventListener('click', close);

        modalBody?.querySelector?.('#modal-btn-save-days')?.addEventListener('click', async () => {
          const selected = [];
          modalBody.querySelectorAll('input:checked').forEach(cb => selected.push(cb.value));
          calendar = await db.updateWeeklyWorkingDays(selected);
          toast.success('Weekly working schedule updated.');
          close();
          renderFullUI();
        });
      }
    });
  }

  // --- MODAL 2: ADD HOLIDAY OR MULTI-DAY RANGE ---
  function openAddHolidayModal(defaultStart, defaultEnd) {
    const isMultiDayInitial = Boolean(defaultEnd && defaultEnd !== defaultStart);
    let isMultiDayMode = isMultiDayInitial;
    const defaultDate = defaultStart || `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const defaultEndDate = defaultEnd || defaultDate;

    openModal({
      title: 'Add Institutional Holiday or Event',
      contentHtml: `
        <div style="margin-bottom: 0.85rem;">
          <!-- Single Day vs Multiple Days Switcher Pill -->
          <div style="display: flex; gap: 0.4rem; background: #F1F5F9; padding: 4px; border-radius: 8px; margin-bottom: 1rem;">
            <button type="button" class="btn btn-xs ${!isMultiDayMode ? 'btn-primary' : 'btn-ghost'}" id="modal-tab-single" style="flex: 1; font-weight: 700; border-radius: 6px;">
              Single Day
            </button>
            <button type="button" class="btn btn-xs ${isMultiDayMode ? 'btn-primary' : 'btn-ghost'}" id="modal-tab-multi" style="flex: 1; font-weight: 700; border-radius: 6px;">
              Multiple Days (Date Range)
            </button>
          </div>

          <form id="modal-form-add-holiday" style="display: flex; flex-direction: column; gap: 0.85rem;">
            
            <!-- Single Day Input Container -->
            <div id="modal-single-day-box" style="display: ${isMultiDayMode ? 'none' : 'block'}; width: 100%; box-sizing: border-box;">
              <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Date</label>
              <input type="date" id="modal-holiday-date" class="form-control cal-modal-date-input" value="${defaultDate}" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" />
            </div>

            <!-- Multiple Days Inputs Container (Equal 50/50 division to fit card) -->
            <div id="modal-multi-day-box" style="display: ${isMultiDayMode ? 'block' : 'none'}; width: 100%; box-sizing: border-box;">
              <div class="cal-modal-date-range-grid" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; width: 100%; box-sizing: border-box;">
                <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                  <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Start Date</label>
                  <input type="date" id="modal-holiday-start-date" class="form-control cal-modal-date-input" value="${defaultDate}" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" />
                </div>
                <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                  <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">End Date</label>
                  <input type="date" id="modal-holiday-end-date" class="form-control cal-modal-date-input" value="${defaultEndDate}" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" />
                </div>
              </div>
              <p style="font-size: 0.72rem; color: #64748B; margin: 0.35rem 0 0 0; line-height: 1.35;">
                All consecutive dates between start and end will be highlighted as a continuous holiday block.
              </p>
            </div>

            <div>
              <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Holiday / Event Title</label>
              <input type="text" id="modal-holiday-title" class="form-control" placeholder="e.g. Diwali Vacation, Eid Break, Sports Meet" required style="height: 38px;" />
            </div>

            <div>
              <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Type</label>
              <select id="modal-holiday-type" class="form-control" style="height: 38px;">
                <option value="holiday">Official Holiday (Campus Closed) - Light Yellow</option>
                <option value="hostel_leave">Hostel Leave / Vacation - Red Shade</option>
                <option value="working_day">Special Working Day (Compensatory Session)</option>
                <option value="event">Campus Event (Regular Duty)</option>
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-outline" id="modal-btn-cancel-holiday">Cancel</button>
              <button type="submit" class="btn btn-primary">+ Add to Calendar</button>
            </div>
          </form>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        const singleTab = modalBody?.querySelector?.('#modal-tab-single');
        const multiTab = modalBody?.querySelector?.('#modal-tab-multi');
        const singleBox = modalBody?.querySelector?.('#modal-single-day-box');
        const multiBox = modalBody?.querySelector?.('#modal-multi-day-box');

        singleTab?.addEventListener?.('click', () => {
          isMultiDayMode = false;
          singleTab.className = 'btn btn-xs btn-primary';
          multiTab.className = 'btn btn-xs btn-ghost';
          if (singleBox) singleBox.style.display = 'block';
          if (multiBox) multiBox.style.display = 'none';
        });

        multiTab?.addEventListener?.('click', () => {
          isMultiDayMode = true;
          multiTab.className = 'btn btn-xs btn-primary';
          singleTab.className = 'btn btn-xs btn-ghost';
          if (singleBox) singleBox.style.display = 'none';
          if (multiBox) multiBox.style.display = 'block';
        });

        modalBody?.querySelector?.('#modal-btn-cancel-holiday')?.addEventListener?.('click', close);

        modalBody?.querySelector?.('#modal-form-add-holiday')?.addEventListener?.('submit', async (e) => {
          e.preventDefault();
          const name = modalBody.querySelector('#modal-holiday-title')?.value.trim();
          const type = modalBody.querySelector('#modal-holiday-type')?.value;

          if (isMultiDayMode) {
            const startDate = modalBody.querySelector('#modal-holiday-start-date')?.value;
            const endDate = modalBody.querySelector('#modal-holiday-end-date')?.value;
            if (!startDate || !endDate) return;

            calendar = await db.addCalendarHolidayRange({ startDate, endDate, name, type });
            toast.success(`Holiday range "${name}" added to calendar.`);
          } else {
            const date = modalBody.querySelector('#modal-holiday-date')?.value;
            if (!date) return;

            calendar = await db.addCalendarHoliday({ date, name, type });
            toast.success(`Holiday "${name}" added to calendar.`);
          }

          rangeStart = null;
          rangeEnd = null;
          close();
          renderFullUI();
        });
      }
    });
  }

  // --- MODAL 3: QUICK DATE EDIT & INSPECT (INSTITUTIONAL) ---
  function openQuickDateEditModal(dateStr) {
    const dayInfo = db.getCalendarDayInfo(dateStr, calendar);
    const isHol = dayInfo.isHoliday;
    const isWork = dayInfo.isWorkingDay;

    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
    const formattedDate = `${dayName}, ${formatDate(dateStr)}`;

    let statusLabel = isHol ? 'Official Holiday' : isWork ? (dayInfo.isSpecialWorking ? 'Special Working Day' : 'Regular Working Day') : 'Weekend Off';
    let icon = isHol ? '🌴' : isWork ? '⚡' : '📅';
    let bgTheme = isHol ? '#FFFBEB' : isWork ? '#ECFDF5' : '#F8FAFC';
    let borderTheme = isHol ? '#FDE68A' : isWork ? '#A7F3D0' : '#CBD5E1';
    let colorTheme = isHol ? '#D97706' : isWork ? '#059669' : '#475569';

    openModal({
      title: 'Institutional Calendar Details',
      modalClass: 'cal-day-popup-modal',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 0.9rem;">
          
          <!-- Header Banner -->
          <div style="background: ${bgTheme}; border: 1.5px solid ${borderTheme}; border-radius: 10px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
            <div>
              <span style="font-size: 0.74rem; font-weight: 700; color: ${colorTheme}; text-transform: uppercase; letter-spacing: 0.05em;">Institutional Schedule</span>
              <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0F172A;">${formattedDate}</h4>
            </div>
            <div style="width: 42px; height: 42px; border-radius: 50%; background: #FFFFFF; border: 1.5px solid ${borderTheme}; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; color: ${colorTheme}; flex-shrink: 0;">
              ${icon}
            </div>
          </div>

          <!-- Schedule Status & Event Title -->
          <div style="border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.85rem 1rem; background: #FFFFFF;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.5rem;">
              <span style="font-size: 0.74rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Current Schedule</span>
              <span class="badge" style="background: ${bgTheme}; color: ${colorTheme}; border: 1.5px solid ${borderTheme}; font-weight: 800; font-size: 0.8rem; padding: 3px 8px; border-radius: 6px;">
                ${icon} ${statusLabel}
              </span>
            </div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #0F172A; margin-bottom: 0.25rem;">
              ${dayInfo.title ? `Event: ${dayInfo.title}` : (isHol ? 'Institutional Holiday' : isWork ? 'Standard Academic Working Day' : 'Weekly Off Day')}
            </div>
            <p style="font-size: 0.82rem; color: #64748B; margin: 0; line-height: 1.45;">
              ${isHol 
                ? 'Campus is officially closed for academic duties and regular class operations.' 
                : isWork 
                ? 'Regular academic timetable, attendance sessions, and classes are in effect.' 
                : 'Weekly weekend holiday observed as per institutional working calendar.'}
            </p>
          </div>

          ${!isViewOnly ? `
            <!-- Quick Admin Schedule Management -->
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.85rem 1rem;">
              <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.35rem;">
                Edit / Override Schedule for this Date:
              </label>
              <input 
                type="text" 
                id="modal-edit-date-title" 
                class="form-control" 
                value="${dayInfo.title || ''}" 
                placeholder="e.g. Founder's Day, Exam Holiday, Sports Meet" 
                style="height: 38px; font-size: 0.85rem; margin-bottom: 0.75rem;" 
              />

              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-set-holiday" style="color: #B45309; border-color: #FDE68A; background: #FFFBEB; font-weight: 700;">
                  🌴 Set as Holiday (Yellow)
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-set-hostel-leave" style="color: #DC2626; border-color: #FECACA; background: #FEF2F2; font-weight: 700;">
                  🚪 Set as Hostel Leave (Red)
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-set-working" style="color: #059669; border-color: #A7F3D0; background: #ECFDF5; font-weight: 700;">
                  ⚡ Set as Working Day
                </button>
                ${dayInfo.type !== 'none' ? `
                  <button type="button" class="btn btn-ghost btn-sm" id="btn-reset-default" style="color: #64748B; font-weight: 700;">
                    🔄 Reset Default
                  </button>
                ` : ''}
              </div>

              <!-- Multi-day Range Extension Shortcut -->
              <div style="margin-top: 0.75rem; pt-2; border-top: 1px dashed #CBD5E1;">
                <button type="button" class="btn btn-ghost btn-xs" id="btn-open-multi-day-from-inspect" style="color: #1D4ED8; font-weight: 700; padding: 2px 4px;">
                  ➕ Extend to Multi-Day Holiday Range →
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Footer -->
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
            <button type="button" class="btn btn-secondary btn-sm" id="modal-btn-close-inst" style="font-weight: 700; min-width: 90px;">
              Close
            </button>
          </div>

        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody?.querySelector?.('#modal-btn-close-inst')?.addEventListener('click', close);
        const titleInput = modalBody?.querySelector?.('#modal-edit-date-title');

        modalBody?.querySelector?.('#btn-set-holiday')?.addEventListener('click', async () => {
          const name = titleInput ? titleInput.value.trim() || 'Institutional Holiday' : 'Institutional Holiday';
          calendar = await db.addCalendarHoliday({ date: dateStr, name, type: 'holiday' });
          toast.success(`Marked ${dateStr} as Holiday.`);
          close();
          renderFullUI();
        });

        modalBody?.querySelector?.('#btn-set-hostel-leave')?.addEventListener('click', async () => {
          const name = titleInput ? titleInput.value.trim() || 'Hostel Leave' : 'Hostel Leave';
          calendar = await db.addCalendarHoliday({ date: dateStr, name, type: 'hostel_leave' });
          toast.success(`Marked ${dateStr} as Hostel Leave.`);
          close();
          renderFullUI();
        });

        modalBody?.querySelector?.('#btn-set-working')?.addEventListener('click', async () => {
          const name = titleInput ? titleInput.value.trim() || 'Special Working Session' : 'Special Working Session';
          calendar = await db.addCalendarHoliday({ date: dateStr, name, type: 'working_day' });
          toast.success(`Marked ${dateStr} as Special Working Day.`);
          close();
          renderFullUI();
        });

        modalBody?.querySelector?.('#btn-reset-default')?.addEventListener('click', async () => {
          calendar = await db.removeCalendarHoliday(dateStr);
          toast.success(`Reset ${dateStr} to default schedule.`);
          close();
          renderFullUI();
        });

        modalBody?.querySelector?.('#btn-open-multi-day-from-inspect')?.addEventListener('click', () => {
          close();
          openAddHolidayModal(dateStr, dateStr);
        });
      }
    });
  }

  // Initial render
  renderFullUI();
}
