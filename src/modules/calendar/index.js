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
      grid.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
        isWorkingDay: dayInfo.isWorkingDay,
        isHoliday: dayInfo.isHoliday,
        isSpecialWorking: dayInfo.isSpecialWorking,
        title: dayInfo.title || '',
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
    const events = calendar.events || [];

    // Summary counts
    const currentMonthDays = gridDays.filter(d => d.isCurrentMonth);
    const workingDaysCount = currentMonthDays.filter(d => d.isWorkingDay).length;
    const holidaysCount = currentMonthDays.filter(d => d.isHoliday).length;
    const weekendOffCount = currentMonthDays.filter(d => !d.isWorkingDay && !d.isHoliday).length;

    container.innerHTML = `
      <div class="calendar-module-container" style="padding-bottom: 2rem;">
        
        <!-- HEADER ROW: TITLE & MONTH NAVIGATION CONTROLS -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.15rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 38px; height: 38px; border-radius: 8px; background: #ECFDF5; border: 1.5px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.2;">Academic Calendar</h2>
                <p style="font-size: 0.78rem; color: #64748B; margin: 0;">Institutional academic schedule, working days, official holidays & events</p>
              </div>
            </div>
          </div>

          <!-- Month & Year Selector Navigation -->
          <div style="display: flex; align-items: center; gap: 0.5rem; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px; padding: 0.25rem 0.4rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <button type="button" class="btn btn-ghost btn-xs" id="cal-btn-prev-month" title="Previous Month" style="padding: 0.35rem 0.55rem; font-weight: 800; font-size: 1rem; border-radius: 6px;">
              ‹
            </button>
            <span style="font-weight: 800; font-size: 0.92rem; color: #0F172A; min-width: 135px; text-align: center;">
              ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
            </span>
            <button type="button" class="btn btn-ghost btn-xs" id="cal-btn-next-month" title="Next Month" style="padding: 0.35rem 0.55rem; font-weight: 800; font-size: 1rem; border-radius: 6px;">
              ›
            </button>
            <button type="button" class="btn btn-outline btn-xs" id="cal-btn-today" style="margin-left: 0.25rem; font-weight: 700; font-size: 0.75rem; border-radius: 6px; padding: 0.3rem 0.6rem;">
              Today
            </button>
          </div>
        </div>

        <!-- QUICK NOTICE & ACTION BAR -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <!-- Quick Bridge Link to Student Attendance in Reports -->
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 0.45rem 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.8rem; color: #1E40AF; font-weight: 600;">👨‍🎓 Looking for Student Attendance?</span>
            <button type="button" class="btn btn-xs btn-outline" id="btn-goto-student-attendance-report" style="font-size: 0.75rem; font-weight: 700; color: #1D4ED8; border-color: #93C5FD; background: #FFFFFF; padding: 2px 8px;">
              Open Attendance Reports →
            </button>
          </div>

          ${!isViewOnly ? `
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <button type="button" class="btn btn-outline btn-xs" id="btn-open-working-schedule" style="font-weight: 700; border-radius: 8px; padding: 0.45rem 0.85rem;">
                ⚙️ Weekly Working Days
              </button>
              <button type="button" class="btn btn-primary btn-xs" id="btn-add-cal-holiday" style="font-weight: 700; border-radius: 8px; padding: 0.45rem 0.85rem;">
                + Add Holiday
              </button>
            </div>
          ` : ''}
        </div>

        <!-- 1. SUMMARY METRICS BAR -->
        <div class="cal-metrics-grid">
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem 1rem;">
            <span style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Days</span>
            <div style="font-weight: 800; font-size: 1.3rem; color: #0F172A;">${currentMonthDays.length}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #A7F3D0; border-radius: 10px; padding: 0.75rem 1rem;">
            <span style="font-size: 0.72rem; font-weight: 700; color: #047857; text-transform: uppercase;">Working Days</span>
            <div style="font-weight: 800; font-size: 1.3rem; color: #059669;">${workingDaysCount}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #FDE68A; border-radius: 10px; padding: 0.75rem 1rem;">
            <span style="font-size: 0.72rem; font-weight: 700; color: #B45309; text-transform: uppercase;">Official Holidays</span>
            <div style="font-weight: 800; font-size: 1.3rem; color: #D97706;">${holidaysCount}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem 1rem;">
            <span style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Weekend Offs</span>
            <div style="font-weight: 800; font-size: 1.3rem; color: #475569;">${weekendOffCount}</div>
          </div>
        </div>

        <!-- 2. VISUAL MONTHLY CALENDAR GRID -->
        <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1.25rem;">
          
          <!-- Days Header -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); background: #F8FAFC; border-bottom: 1.5px solid #CBD5E1; text-align: center;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `
              <div style="padding: 0.55rem 0.15rem; font-weight: 800; font-size: 0.78rem; color: ${i === 0 ? '#DC2626' : '#475569'}; text-transform: uppercase; letter-spacing: 0.05em;">
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
                  <div class="cal-pad-cell" style="border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; background: #F8FAFC; opacity: 0.35; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 0.75rem; color: #94A3B8; font-weight: 600;">${cell.dayNumber}</span>
                  </div>
                `;
              }

              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
              const isHol = cell.isHoliday;
              const isWork = cell.isWorkingDay;

              return `
                <div 
                  class="cal-inst-day-cell cal-day-box" 
                  data-date="${cell.dateStr}"
                  data-is-holiday="${isHol}"
                  role="button"
                  tabindex="0"
                  title="${cell.dateStr}: ${cell.title || (isHol ? 'Holiday' : isWork ? 'Working Day' : 'Off')} (Tap to inspect)"
                  style="border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; background: ${isHol ? '#FFFBEB' : (!isWork ? '#F8FAFC' : '#FFFFFF')}; cursor: pointer; transition: background 0.15s ease;"
                >
                  <!-- Desktop Content -->
                  <div class="cal-cell-desktop">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
                      <span style="font-weight: 800; font-size: 0.92rem; color: ${isToday ? '#059669' : '#0F172A'}; ${isToday ? 'background: #ECFDF5; padding: 1px 6px; border-radius: 4px; border: 1px solid #A7F3D0;' : ''}">
                        ${cell.dayNumber}
                      </span>
                      ${isHol ? `
                        <span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 0.65rem; font-weight: 700;">
                          Holiday
                        </span>
                      ` : isWork ? `
                        <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">
                          Working
                        </span>
                      ` : `
                        <span style="font-size: 0.7rem; color: #94A3B8; font-weight: 600;">Off</span>
                      `}
                    </div>

                    ${cell.title ? `
                      <div style="margin-top: 0.25rem;">
                        <div style="font-size: 0.72rem; font-weight: 700; color: ${isHol ? '#B45309' : '#047857'}; background: ${isHol ? '#FEF3C7' : '#ECFDF5'}; padding: 3px 6px; border-radius: 4px; border: 1px solid ${isHol ? '#FDE68A' : '#A7F3D0'}; line-height: 1.2;">
                          ${isHol ? '🌴' : '⚡'} ${cell.title}
                        </div>
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

        </div>

        <!-- 3. UPCOMING HOLIDAYS LIST -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1rem 1.25rem;">
          <h4 style="font-weight: 800; font-size: 0.95rem; color: #0F172A; margin: 0 0 0.75rem 0;">
            Scheduled Academic Holidays & Special Events (${events.length})
          </h4>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.65rem;">
            ${events.map(ev => {
              const isHol = ev.type === 'holiday';
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC;">
                  <div>
                    <span style="font-weight: 700; font-size: 0.85rem; color: #0F172A; display: block;">${ev.name}</span>
                    <span style="font-size: 0.74rem; color: #64748B;">${formatDate(ev.date)} • ${isHol ? 'Official Holiday' : 'Special Session'}</span>
                  </div>
                  ${!isViewOnly ? `
                    <button type="button" class="btn btn-ghost btn-xs btn-del-event" data-event-id="${ev.id}" style="color: #DC2626; font-weight: 700; font-size: 0.72rem;">
                      Delete
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
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
