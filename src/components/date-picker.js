/**
 * TPS Hostel ERP — Custom Institutional Date Picker
 * Pixel-perfect implementation matching user-provided "Select Date" pattern:
 * - Bold "Select Date" header
 * - 3D Emerald Institutional Calendar day-badge on top-right with binder tabs
 * - Side-by-side Month & Year pill dropdown triggers
 * - Sunday-first weekday row with accented SUN
 * - 2-digit days grid (01..31) with accented Sunday column & today underline
 * - Centered prominent emerald Confirm button
 * - Instant 1-step Year & Month jumping
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

let activePopup = null;
let activeCleanup = null;

export function closeActiveDatePicker() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
}

// Global click outside listener
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!activePopup) return;
    if (activePopup.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.tps-date-picker-trigger')) return;
    closeActiveDatePicker();
  });
}

export function enhanceDateInput(input) {
  if (!input || input.hasAttribute('data-tps-datepicker')) return;
  input.setAttribute('data-tps-datepicker', 'true');

  // Switch to text so browser native ugly picker is disabled
  if (input.type === 'date') {
    input.type = 'text';
  }

  input.readOnly = true;
  input.classList.add('tps-date-input-field');

  // Format initial date value as DD.MMM.YYYY
  if (input.value) {
    const parsed = parseDateString(input.value);
    if (parsed) {
      input.value = formatDateCustom(parsed);
    }
  }

  let wrapper = input.parentElement;
  if (!wrapper || !wrapper.classList.contains('tps-date-input-wrapper')) {
    wrapper = document.createElement('div');
    wrapper.className = 'tps-date-input-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const calIcon = document.createElement('span');
    calIcon.className = 'tps-date-icon';
    calIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    `;
    wrapper.appendChild(calIcon);
  }

  wrapper.classList.add('tps-date-picker-trigger');
  wrapper.style.cursor = 'pointer';

  let lastToggleTime = 0;

  function togglePicker(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const now = Date.now();
    if (now - lastToggleTime < 250) return;
    lastToggleTime = now;

    if (activePopup && activePopup.__forInput === input) {
      closeActiveDatePicker();
      return;
    }

    closeActiveDatePicker();
    showDatePickerPopup(input, wrapper);
  }

  wrapper.addEventListener('click', togglePicker);
  input.addEventListener('click', togglePicker);

  wrapper.setAttribute('tabindex', '0');
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePicker(e);
    }
  });
}

function pad2(num) {
  return String(num).padStart(2, '0');
}

function showDatePickerPopup(input, anchorEl) {
  const initialDateStr = input.value ? input.value.trim() : '';
  let selectedDate = parseDateString(initialDateStr) || new Date();

  let viewYear = selectedDate.getFullYear();
  let viewMonth = selectedDate.getMonth();
  let viewMode = 'days'; // 'days' | 'months' | 'years'
  let decadeStart = Math.floor(viewYear / 12) * 12;

  const popup = document.createElement('div');
  popup.className = 'tps-calendar-popup tps-cal-reference-pattern';
  popup.__forInput = input;

  function renderView() {
    if (viewMode === 'years') {
      renderYearsView();
    } else if (viewMode === 'months') {
      renderMonthsView();
    } else {
      renderDaysView();
    }
  }

  // 1. DAYS VIEW (Exact Reference Pattern)
  function renderDaysView() {
    const today = new Date();
    const todayStr = formatDateYMD(today);
    const selectedStr = formatDateYMD(selectedDate);

    // Sunday-based start index (0 = Sun, 1 = Mon ... 6 = Sat)
    const startOffset = new Date(viewYear, viewMonth, 1).getDay();

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    let daysHtml = '';

    // Overflow days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      const prevDateStr = formatDateYMD(prevDate);
      daysHtml += `
        <div class="tps-cal-day other-month" data-date="${prevDateStr}">${pad2(d)}</div>
      `;
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const curDate = new Date(viewYear, viewMonth, day);
      const curDateStr = formatDateYMD(curDate);
      const isSunday = curDate.getDay() === 0;
      const isSelected = curDateStr === selectedStr;
      const isToday = curDateStr === todayStr;

      daysHtml += `
        <div class="tps-cal-day current-month ${isSunday ? 'col-sun' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-date="${curDateStr}">
          <span>${pad2(day)}</span>
        </div>
      `;
    }

    // Overflow days for next month
    const totalRendered = startOffset + daysInCurrentMonth;
    const remainingSlots = (7 - (totalRendered % 7)) % 7;
    const targetSlots = totalRendered + remainingSlots < 35 ? remainingSlots + 7 : remainingSlots;

    for (let nextDay = 1; nextDay <= targetSlots; nextDay++) {
      const nextDate = new Date(viewYear, viewMonth + 1, nextDay);
      const nextDateStr = formatDateYMD(nextDate);
      daysHtml += `
        <div class="tps-cal-day other-month" data-date="${nextDateStr}">${pad2(nextDay)}</div>
      `;
    }

    const badgeDay = pad2(selectedDate.getDate());

    popup.innerHTML = `
      <!-- Top Header: Title & Dropdown Pills (Left) + 3D Calendar Day Badge (Right) -->
      <div class="tps-cal-top-section">
        <div class="tps-cal-top-left">
          <div class="tps-cal-main-title">Select Date</div>
          <div class="tps-cal-pills-row">
            <button type="button" class="tps-cal-pill-btn btn-open-months" title="Choose Month">
              <span>${MONTH_NAMES[viewMonth]}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button type="button" class="tps-cal-pill-btn btn-open-years" title="Choose Year in 1 Step">
              <span>${viewYear}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <div class="tps-cal-badge-card" title="Selected Day: ${badgeDay}">
          <div class="tps-cal-badge-tabs">
            <span class="tps-cal-tab"></span>
            <span class="tps-cal-tab"></span>
          </div>
          <div class="tps-cal-badge-num">${badgeDay}</div>
        </div>
      </div>

      <!-- Sunday-First Weekday Header -->
      <div class="tps-cal-weekdays">
        <span class="weekday-sun">SUN</span>
        <span>MON</span>
        <span>TUE</span>
        <span>WED</span>
        <span>THU</span>
        <span>FRI</span>
        <span>SAT</span>
      </div>

      <!-- Days Grid (2-digit numbers) -->
      <div class="tps-cal-days-grid">
        ${daysHtml}
      </div>

      <!-- Centered Prominent Confirm Button (Theme Emerald) -->
      <div class="tps-cal-actions">
        <button type="button" class="tps-cal-confirm-btn">Confirm</button>
      </div>
    `;

    // Dropdown pill interactions
    popup.querySelector('.btn-open-months')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewMode = 'months';
      renderView();
    });

    popup.querySelector('.btn-open-years')?.addEventListener('click', (e) => {
      e.stopPropagation();
      decadeStart = Math.floor(viewYear / 12) * 12;
      viewMode = 'years';
      renderView();
    });

    // Day Selection
    popup.querySelectorAll('.tps-cal-day').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = cell.getAttribute('data-date');
        if (!dateStr) return;

        const newDate = parseDateString(dateStr);
        if (newDate) {
          selectedDate = newDate;

          // If clicked day belongs to other month, navigate to that month
          if (newDate.getMonth() !== viewMonth || newDate.getFullYear() !== viewYear) {
            viewMonth = newDate.getMonth();
            viewYear = newDate.getFullYear();
            renderView();
            return;
          }

          popup.querySelectorAll('.tps-cal-day.selected').forEach(el => el.classList.remove('selected'));
          cell.classList.add('selected');

          const badgeEl = popup.querySelector('.tps-cal-badge-num');
          if (badgeEl) {
            badgeEl.textContent = pad2(selectedDate.getDate());
          }
        }
      });

      cell.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const dateStr = cell.getAttribute('data-date');
        if (dateStr) applyDate(dateStr);
      });
    });

    popup.querySelector('.tps-cal-confirm-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      applyDate(formatDateYMD(selectedDate));
    });
  }

  // 2. YEARS SELECTION VIEW (Instant 1-Step Jump)
  function renderYearsView() {
    let yearsHtml = '';
    for (let y = decadeStart; y < decadeStart + 12; y++) {
      const isSelected = y === viewYear;
      yearsHtml += `
        <div class="tps-cal-grid-item ${isSelected ? 'selected' : ''}" data-year="${y}">
          ${y}
        </div>
      `;
    }

    popup.innerHTML = `
      <div class="tps-cal-header">
        <button type="button" class="tps-cal-nav-btn btn-prev-decade" title="Previous 12 Years">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="tps-cal-title">${decadeStart} – ${decadeStart + 11}</span>
        <button type="button" class="tps-cal-nav-btn btn-next-decade" title="Next 12 Years">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="tps-cal-divider"></div>

      <div class="tps-cal-grid-select">
        ${yearsHtml}
      </div>

      <div class="tps-cal-divider" style="margin-top: 0.75rem;"></div>

      <div class="tps-cal-footer">
        <button type="button" class="tps-cal-today-action btn-back-days">← Back to Days</button>
      </div>
    `;

    popup.querySelector('.btn-prev-decade')?.addEventListener('click', (e) => {
      e.stopPropagation();
      decadeStart -= 12;
      renderView();
    });

    popup.querySelector('.btn-next-decade')?.addEventListener('click', (e) => {
      e.stopPropagation();
      decadeStart += 12;
      renderView();
    });

    popup.querySelector('.btn-back-days')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewMode = 'days';
      renderView();
    });

    popup.querySelectorAll('.tps-cal-grid-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        viewYear = parseInt(item.getAttribute('data-year'), 10);
        viewMode = 'days';
        renderView();
      });
    });
  }

  // 3. MONTHS SELECTION VIEW
  function renderMonthsView() {
    let monthsHtml = '';
    SHORT_MONTHS.forEach((m, idx) => {
      const isSelected = idx === viewMonth;
      monthsHtml += `
        <div class="tps-cal-grid-item ${isSelected ? 'selected' : ''}" data-month="${idx}">
          ${m}
        </div>
      `;
    });

    popup.innerHTML = `
      <div class="tps-cal-header">
        <button type="button" class="tps-cal-nav-btn btn-prev-m-year" title="Previous Year">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="tps-cal-title">Select Month (${viewYear})</span>
        <button type="button" class="tps-cal-nav-btn btn-next-m-year" title="Next Year">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="tps-cal-divider"></div>

      <div class="tps-cal-grid-select">
        ${monthsHtml}
      </div>

      <div class="tps-cal-divider" style="margin-top: 0.75rem;"></div>

      <div class="tps-cal-footer">
        <button type="button" class="tps-cal-today-action btn-back-days">← Back to Days</button>
      </div>
    `;

    popup.querySelector('.btn-prev-m-year')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewYear--;
      renderView();
    });

    popup.querySelector('.btn-next-m-year')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewYear++;
      renderView();
    });

    popup.querySelector('.btn-back-days')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewMode = 'days';
      renderView();
    });

    popup.querySelectorAll('.tps-cal-grid-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        viewMonth = parseInt(item.getAttribute('data-month'), 10);
        viewMode = 'days';
        renderView();
      });
    });
  }

  function applyDate(dateInput) {
    let dateObj = dateInput;
    if (typeof dateInput === 'string') {
      dateObj = parseDateString(dateInput) || new Date();
    }
    const formatted = formatDateCustom(dateObj);
    input.value = formatted;
    input.setAttribute('data-date-raw', formatDateYMD(dateObj));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeActiveDatePicker();
  }

  document.body.appendChild(popup);
  activePopup = popup;

  positionPopup(popup, anchorEl);

  renderView();
}

function positionPopup(popup, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const popupWidth = 340;
  const popupHeight = 440;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 8;

  if (left + popupWidth > window.innerWidth - 12) {
    left = window.innerWidth - popupWidth - 12;
  }
  if (left < 12) left = 12;

  if (rect.bottom + popupHeight > window.innerHeight && rect.top > popupHeight) {
    top = rect.top + window.scrollY - popupHeight - 8;
  }

  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

export function formatDateCustom(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = pad2(d.getDate());
  const month = SHORT_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function parseDateString(str) {
  if (!str) return null;
  if (str instanceof Date) return isNaN(str.getTime()) ? null : str;
  const s = String(str).trim();

  // DD.MMM.YYYY (e.g. 22.Oct.2026, 22.OCT.2026)
  const dotParts = s.split('.');
  if (dotParts.length === 3) {
    const day = parseInt(dotParts[0], 10);
    const mStr = dotParts[1].toLowerCase();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let month = months.indexOf(mStr);
    if (month === -1 && !isNaN(parseInt(dotParts[1], 10))) {
      month = parseInt(dotParts[1], 10) - 1;
    }
    const year = parseInt(dotParts[2], 10);
    if (!isNaN(day) && month >= 0 && month <= 11 && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  // YYYY-MM-DD
  const dashParts = s.split('T')[0].split('-');
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10) - 1;
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateYMD(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
