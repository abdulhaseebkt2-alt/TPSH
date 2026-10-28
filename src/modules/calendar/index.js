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

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper: Month days breakdown for calendar grid (Sun - Sat)
  function getCalendarGridDays(year, month) {
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const totalDays = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

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
      const isCustom = Array.isArray(calendar?.events) && calendar.events.some(e => e.date === dateStr);

      grid.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
        isWorkingDay: dayInfo.isWorkingDay,
        isHoliday: dayInfo.isHoliday,
        isSpecialWorking: dayInfo.isSpecialWorking,
        title: dayInfo.title || '',
        hasCustomEvent: isCustom,
        type: dayInfo.type
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

  function renderFullUI() {
    const gridDays = getCalendarGridDays(currentYear, currentMonth);
    const events = (calendar.events || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1));

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

    container.innerHTML = `
      <div class="calendar-module-container" style="padding-bottom: 2rem;">
        
        <!-- HEADER ROW: TITLE & MONTH NAVIGATION CONTROLS -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border: 1.5px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.12);">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.2; letter-spacing: -0.01em;">Academic Calendar</h2>
                <p style="font-size: 0.8rem; color: #64748B; margin: 2px 0 0 0;">Institutional academic schedule, working days, official holidays & events</p>
              </div>
            </div>
          </div>

          <!-- Month & Year Selector Navigation Toolbar -->
          <div style="display: flex; align-items: center; gap: 0.4rem; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 10px; padding: 0.3rem 0.45rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <button type="button" class="btn btn-ghost btn-xs" id="cal-btn-prev-month" title="Previous Month" style="padding: 0.35rem 0.65rem; font-weight: 800; font-size: 1.15rem; border-radius: 6px; color: #475569;">
              ‹
            </button>
            <span style="font-weight: 800; font-size: 0.95rem; color: #0F172A; min-width: 145px; text-align: center;">
              ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
            </span>
            <button type="button" class="btn btn-ghost btn-xs" id="cal-btn-next-month" title="Next Month" style="padding: 0.35rem 0.65rem; font-weight: 800; font-size: 1.15rem; border-radius: 6px; color: #475569;">
              ›
            </button>
            <button type="button" class="btn btn-outline btn-xs" id="cal-btn-today" style="margin-left: 0.35rem; font-weight: 700; font-size: 0.75rem; border-radius: 6px; padding: 0.35rem 0.65rem; color: #059669; border-color: #A7F3D0; background: #ECFDF5;">
              Today
            </button>
          </div>
        </div>

        <!-- TWO-COLUMN EXECUTIVE MASTER-COMPANION WORKSPACE -->
        <div class="cal-workspace-layout">
          
          <!-- LEFT COLUMN: MASTER CALENDAR CANVAS (~72%) -->
          <div class="cal-main-stage">
            
            <div class="cal-fluent-grid-card">
              
              <!-- 7-Day Header Row (Sun - Sat) -->
              <div style="display: grid; grid-template-columns: repeat(7, 1fr); background: #F8FAFC; border-bottom: 1.5px solid #CBD5E1; text-align: center;">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `
                  <div style="padding: 0.65rem 0.2rem; font-weight: 800; font-size: 0.78rem; color: ${i === 0 ? '#E11D48' : '#475569'}; text-transform: uppercase; letter-spacing: 0.05em; background: ${i === 0 ? '#FFF1F2' : 'transparent'};">
                    <span class="cal-dow-full">${d}</span>
                    <span class="cal-dow-short">${d.substring(0, 1)}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Cells Grid -->
              <div style="display: grid; grid-template-columns: repeat(7, 1fr);" class="cal-month-grid">
                ${gridDays.map(cell => {
                  if (!cell.isCurrentMonth) {
                    return `
                      <div class="cal-pad-cell" style="border-right: 1px solid #F1F5F9; border-bottom: 1px solid #F1F5F9; background: #FAFAFC; opacity: 0.4; display: flex; align-items: flex-start; justify-content: flex-start;">
                        <span style="font-size: 0.75rem; color: #94A3B8; font-weight: 600; padding: 0.25rem 0.35rem;">${cell.dayNumber}</span>
                      </div>
                    `;
                  }

                  const isToday = cell.dateStr === todayStr;
                  const isHol = cell.isHoliday;
                  const isWork = cell.isWorkingDay;
                  const isSpecialWork = cell.isSpecialWorking;
                  const isSunday = new Date(cell.dateStr + 'T00:00:00').getDay() === 0;
                  const isWeekendOff = !isWork && !isSpecialWork && isSunday;

                  // Clean elegant background
                  let cellBg = '#FFFFFF';
                  if (isHol && cell.hasCustomEvent) {
                    cellBg = '#FFFDF5';
                  } else if (isSpecialWork) {
                    cellBg = '#F0FDF4';
                  } else if (isSunday) {
                    cellBg = '#FAFAFC';
                  }

                  const showHolidayTitle = isHol && cell.title && !cell.title.includes('Weekend Off');

                  return `
                    <div 
                      class="cal-inst-day-cell cal-day-box" 
                      data-date="${cell.dateStr}"
                      data-is-holiday="${isHol}"
                      role="button"
                      tabindex="0"
                      title="${cell.dateStr}: ${cell.title || (isHol ? 'Holiday' : isWork ? 'Working Day' : 'Off')} (Click to inspect)"
                      style="border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; background: ${cellBg}; cursor: pointer;"
                    >
                      <!-- Desktop Content: Clean, Uncluttered, Modern -->
                      <div class="cal-cell-desktop">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                          <span class="cal-day-num-wrap ${isToday ? 'today-pill' : ''}">
                            ${cell.dayNumber}
                          </span>
                          ${isSpecialWork ? `
                            <span class="badge" style="background: #CCFBF1; color: #0F766E; border: 1px solid #99F6E4; font-size: 0.65rem; font-weight: 800; border-radius: 4px; padding: 1px 5px;">
                              ⚡ Special
                            </span>
                          ` : showHolidayTitle ? `
                            <span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 0.65rem; font-weight: 800; border-radius: 4px; padding: 1px 5px;">
                              Holiday
                            </span>
                          ` : isWeekendOff ? `
                            <span style="font-size: 0.68rem; color: #CBD5E1; font-weight: 600;">Off</span>
                          ` : ''}
                        </div>

                        ${showHolidayTitle ? `
                          <div class="cal-event-pill holiday" title="${cell.title}">
                            <span class="cal-event-dot"></span>
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cell.title}</span>
                          </div>
                        ` : isSpecialWork ? `
                          <div class="cal-event-pill special-work" title="${cell.title}">
                            <span class="cal-event-dot"></span>
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cell.title}</span>
                          </div>
                        ` : ''}
                      </div>

                      <!-- Mobile Content: Minimal Day Number + Color Dot Indicator -->
                      <div class="cal-cell-mobile">
                        <span class="cal-mobile-day-num ${isToday ? 'today' : ''}">
                          ${cell.dayNumber}
                        </span>
                        <span class="cal-mobile-dot ${isHol ? 'dot-holiday' : isWork ? (cell.isSpecialWorking ? 'dot-special-work' : 'dot-working') : 'dot-off'}" title="${cell.title || (isHol ? 'Holiday' : isWork ? 'Working' : 'Off')}"></span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Quick Footer Legend -->
              <div style="padding: 0.65rem 1rem; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; font-size: 0.74rem;">
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #047857; font-weight: 600;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
                    Working Session
                  </span>
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #B45309; font-weight: 600;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span>
                    Official Holiday
                  </span>
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #0F766E; font-weight: 600;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #0D9488;"></span>
                    Special Working Day
                  </span>
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #64748B; font-weight: 600;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #CBD5E1;"></span>
                    Weekend Off
                  </span>
                </div>
                <span style="color: #94A3B8; font-size: 0.72rem;">💡 Tap any date to inspect or edit schedule</span>
              </div>

            </div>

          </div>

          <!-- RIGHT COLUMN: EXECUTIVE COMPANION SIDEBAR (~28%) -->
          <div class="cal-side-companion">
            
            <!-- 1. TODAY SNAPSHOT CARD -->
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 14px; padding: 1.1rem 1.25rem; color: #FFFFFF; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.22);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                <span style="font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #A7F3D0;">
                  Today's Institutional Schedule
                </span>
                <span class="badge" style="background: rgba(255,255,255,0.22); color: #FFFFFF; border: none; font-size: 0.68rem; font-weight: 700; padding: 2px 7px;">
                  Active
                </span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 0.55rem; margin-top: 0.25rem;">
                <span style="font-size: 2.2rem; font-weight: 900; line-height: 1; letter-spacing: -0.02em;">
                  ${now.getDate()}
                </span>
                <div>
                  <div style="font-weight: 800; font-size: 0.95rem; line-height: 1.2;">
                    ${todayDayName}, ${MONTH_NAMES[now.getMonth()]}
                  </div>
                  <div style="font-size: 0.74rem; color: #D1FAE5; margin-top: 2px;">
                    ${todayInfo.isHoliday ? '🌴 Official Holiday' : (todayInfo.isSpecialWorking ? '⚡ Special Working Day' : '⚡ Regular Academic Working Session')}
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. MONTHLY BREAKDOWN METRICS CARD -->
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1rem 1.15rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                <h4 style="font-weight: 800; font-size: 0.88rem; color: #0F172A; margin: 0;">
                  ${MONTH_NAMES[currentMonth - 1]} Overview
                </h4>
                <span style="font-size: 0.75rem; color: #64748B; font-weight: 600;">${currentMonthDays.length} Days</span>
              </div>

              <!-- 4 Metrics Chips -->
              <div class="cal-metrics-grid">
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.6rem 0.75rem;">
                  <span style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Days</span>
                  <div style="font-weight: 800; font-size: 1.15rem; color: #0F172A;">${currentMonthDays.length}</div>
                </div>
                <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.6rem 0.75rem;">
                  <span style="font-size: 0.68rem; font-weight: 700; color: #047857; text-transform: uppercase;">Working Days</span>
                  <div style="font-weight: 800; font-size: 1.15rem; color: #059669;">${workingDaysCount}</div>
                </div>
                <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 0.6rem 0.75rem;">
                  <span style="font-size: 0.68rem; font-weight: 700; color: #B45309; text-transform: uppercase;">Official Holidays</span>
                  <div style="font-weight: 800; font-size: 1.15rem; color: #D97706;">${holidaysCount}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.6rem 0.75rem;">
                  <span style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Weekend Offs</span>
                  <div style="font-weight: 800; font-size: 1.15rem; color: #475569;">${weekendOffCount}</div>
                </div>
              </div>

              <!-- Segmented Progress Bar -->
              <div style="background: #F1F5F9; border-radius: 6px; height: 7px; overflow: hidden; display: flex; margin-bottom: 0.4rem;">
                <div style="background: #10B981; width: ${workingPct}%;" title="Working Days: ${workingPct}%"></div>
                <div style="background: #F59E0B; width: ${holidayPct}%;" title="Holidays: ${holidayPct}%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748B; font-weight: 600;">
                <span>⚡ ${workingPct}% Working Days</span>
                <span>🌴 ${holidayPct}% Holidays</span>
              </div>
            </div>

            <!-- 3. SCHEDULED HOLIDAYS & SPECIAL EVENTS AGENDA -->
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1rem 1.15rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
                <h4 style="font-weight: 800; font-size: 0.9rem; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 0.45rem;">
                  <span>🌴</span>
                  <span>Holidays & Events</span>
                  <span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 0.68rem; font-weight: 800; padding: 1px 6px;">${events.length}</span>
                </h4>
                ${!isViewOnly ? `
                  <button type="button" class="btn btn-ghost btn-xs" id="btn-add-cal-holiday-inline" style="color: #059669; font-weight: 700; font-size: 0.75rem; padding: 2px 6px;">
                    + Add
                  </button>
                ` : ''}
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto; padding-right: 2px;">
                ${events.length > 0 ? events.map(ev => {
                  const isHol = ev.type === 'holiday';
                  return `
                    <div class="cal-agenda-card" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.55rem 0.7rem; border-radius: 8px; border: 1px solid ${isHol ? '#FDE68A' : '#A7F3D0'}; background: ${isHol ? '#FFFDF5' : '#F0FDF4'};">
                      <div style="min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${ev.name}
                        </div>
                        <div style="font-size: 0.72rem; color: #64748B;">
                          ${formatDate(ev.date)} • <span style="color: ${isHol ? '#B45309' : '#047857'}; font-weight: 600;">${isHol ? 'Official Holiday' : 'Special Session'}</span>
                        </div>
                      </div>
                      ${!isViewOnly ? `
                        <button type="button" class="btn btn-ghost btn-xs btn-del-event" data-event-id="${ev.id}" title="Delete Holiday" style="color: #DC2626; padding: 2px 6px; font-size: 0.74rem; flex-shrink: 0; font-weight: 700;">
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

            <!-- 4. CALENDAR MANAGEMENT HUB -->
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1rem 1.15rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <h4 style="font-weight: 800; font-size: 0.82rem; color: #64748B; margin: 0 0 0.65rem 0; text-transform: uppercase; letter-spacing: 0.05em;">
                Quick Management
              </h4>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${!isViewOnly ? `
                  <button type="button" class="btn btn-outline btn-sm" id="btn-open-working-schedule" style="font-weight: 700; font-size: 0.8rem; justify-content: flex-start; gap: 0.5rem; border-color: #CBD5E1; color: #1E293B;">
                    <span>⚙️</span>
                    <span>Configure Weekly Days</span>
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" id="btn-add-cal-holiday" style="font-weight: 700; font-size: 0.8rem; justify-content: flex-start; gap: 0.5rem;">
                    <span>+</span>
                    <span>Add Holiday / Special Session</span>
                  </button>
                ` : ''}
                <button type="button" class="btn btn-outline btn-sm" id="btn-goto-student-attendance-report" style="font-weight: 700; font-size: 0.8rem; justify-content: flex-start; gap: 0.5rem; color: #1D4ED8; border-color: #BFDBFE; background: #EFF6FF;">
                  <span>👨‍🎓</span>
                  <span>Open Attendance Reports →</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- Hidden tokens for backward compatibility -->
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
      renderFullUI();
    });

    container.querySelector('#cal-btn-next-month')?.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      renderFullUI();
    });

    container.querySelector('#cal-btn-today')?.addEventListener('click', () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth() + 1;
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
    container.querySelector('#btn-add-cal-holiday')?.addEventListener('click', openAddHolidayModal);
    container.querySelector('#btn-add-cal-holiday-inline')?.addEventListener('click', openAddHolidayModal);

    // Event delegation for deleting holidays
    container.querySelectorAll('.btn-del-event').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-event-id');
        calendar = await db.removeCalendarHoliday(id);
        toast.success('Calendar holiday deleted.');
        renderFullUI();
      });
    });

    // Clicking date in institutional calendar opens holiday toggle / inspection modal
    container.querySelectorAll('.cal-day-box').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.getAttribute('data-date');
        if (dateStr) openQuickDateEditModal(dateStr);
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

  // --- MODAL 2: ADD HOLIDAY ---
  function openAddHolidayModal() {
    const defaultDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    openModal({
      title: 'Add Institutional Holiday or Event',
      contentHtml: `
        <form id="modal-form-add-holiday" style="display: flex; flex-direction: column; gap: 0.85rem;">
          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Date</label>
            <input type="date" id="modal-holiday-date" class="form-control" value="${defaultDate}" required style="height: 38px;" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Holiday / Event Title</label>
            <input type="text" id="modal-holiday-title" class="form-control" placeholder="e.g. Gandhi Jayanti, Diwali Vacation" required style="height: 38px;" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Type</label>
            <select id="modal-holiday-type" class="form-control" style="height: 38px;">
              <option value="holiday">Official Holiday (School Closed)</option>
              <option value="working_day">Special Working Day (Compensatory)</option>
              <option value="event">Campus Event (Regular Duty)</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="modal-btn-cancel-holiday">Cancel</button>
            <button type="submit" class="btn btn-primary">+ Add to Calendar</button>
          </div>
        </form>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody?.querySelector?.('#modal-btn-cancel-holiday')?.addEventListener('click', close);

        modalBody?.querySelector?.('#modal-form-add-holiday')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const date = modalBody.querySelector('#modal-holiday-date')?.value;
          const name = modalBody.querySelector('#modal-holiday-title')?.value.trim();
          const type = modalBody.querySelector('#modal-holiday-type')?.value;

          calendar = await db.addCalendarHoliday({ date, name, type });
          toast.success(`Holiday "${name}" added to calendar.`);
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
                <button type="button" class="btn btn-outline btn-sm" id="btn-set-holiday" style="color: #D97706; border-color: #FDE68A; background: #FFFBEB; font-weight: 700;">
                  🌴 Set as Holiday
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
      }
    });
  }

  // Initial render
  renderFullUI();
}
