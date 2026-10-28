/**
 * TPS Hostel ERP — Custom Institutional Date Picker
 * Dual-Mode Intelligent Date Picker:
 * 1. Mobile UI: Pixel-perfect PhonePe 3-column Drum / Wheel Roller Modal Dialog
 *    - Centered white rounded modal dialog with dimmed backdrop
 *    - Contextual header ("Date of Birth (as per PAN)", "Admission Date", etc.)
 *    - 3-column scrollable drum/wheel picker (Day, Month, Year)
 *    - 5 visible rows with optical scaling, center selected item in bold black
 *    - Two horizontal divider lines framing the active center slot
 *    - Bottom full-width border with CANCEL and DONE action buttons in PhonePe purple (#5F259F)
 * 2. Desktop UI: Emerald Institutional Calendar with 3D day-badge and month/year jumps
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const safeRAF = typeof requestAnimationFrame !== 'undefined'
  ? requestAnimationFrame
  : (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame : (fn) => setTimeout(fn, 16));

let activePopup = null;
let activeCleanup = null;

export function isMobileDatePicker() {
  if (typeof window === 'undefined') return false;
  if (window.__TPS_FORCE_MOBILE_PICKER__ === true) return true;
  if (window.__TPS_FORCE_DESKTOP_PICKER__ === true) return false;

  const isSmallScreen = window.innerWidth <= 768;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  return isSmallScreen || isTouch || isMobileUA;
}

if (typeof window !== 'undefined') {
  window.isMobileDatePicker = isMobileDatePicker;
  window.setMobileDatePickerForce = (force) => {
    window.__TPS_FORCE_MOBILE_PICKER__ = force;
  };
}

export function closeActiveDatePicker() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (typeof document !== 'undefined') {
    document.body.classList.remove('tps-wheel-open');
  }
}

// Global click outside listener for desktop popups
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!activePopup) return;
    // Mobile modal backdrop handles its own dismiss
    if (activePopup.classList && activePopup.classList.contains('tps-wheel-backdrop')) {
      return;
    }
    if (activePopup.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.tps-date-picker-trigger')) return;
    closeActiveDatePicker();
  });

  // Global capture click listener to intercept any date input on mobile
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const trigger = target.closest ? target.closest('.tps-date-picker-trigger, input[type="date"], input[data-datepicker], .tps-date-input-field') : null;
    if (trigger) {
      const dateInput = trigger.tagName === 'INPUT' ? trigger : trigger.querySelector('input');
      if (dateInput) {
        if (!dateInput.hasAttribute('data-tps-datepicker')) {
          enhanceDateInput(dateInput);
        }
        if (isMobileDatePicker()) {
          e.preventDefault();
          e.stopPropagation();
          closeActiveDatePicker();
          showMobileDatePickerModal(dateInput);
        }
      }
    }
  }, true);
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

  // Format initial date value
  if (input.value) {
    const parsed = parseDateString(input.value);
    if (parsed) {
      input.value = formatDateYMD(parsed);
      input.setAttribute('data-date-raw', formatDateYMD(parsed));
      input.setAttribute('data-date-formatted', formatDateCustom(parsed));
    }
  }

  let wrapper = input.parentElement;
  if (!wrapper || !wrapper.classList.contains('tps-date-input-wrapper')) {
    wrapper = document.createElement('div');
    wrapper.className = 'tps-date-input-wrapper tps-date-picker-trigger';
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
  } else {
    wrapper.classList.add('tps-date-picker-trigger');
  }

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

    if (isMobileDatePicker() || input.dataset.picker === 'wheel') {
      showMobileDatePickerModal(input);
    } else {
      showDatePickerPopup(input, wrapper);
    }
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

function applyDateToInput(input, dateInput) {
  let dateObj = dateInput;
  if (typeof dateInput === 'string') {
    dateObj = parseDateString(dateInput) || new Date();
  }
  const ymd = formatDateYMD(dateObj);
  const formatted = formatDateCustom(dateObj);
  input.value = ymd;
  input.setAttribute('data-date-raw', ymd);
  input.setAttribute('data-date-formatted', formatted);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeActiveDatePicker();
}

function getFieldTitle(input) {
  if (input.dataset && input.dataset.title) return input.dataset.title;
  if (input.getAttribute('data-title')) return input.getAttribute('data-title');

  const id = (input.id || '').toLowerCase();
  let labelText = '';

  if (input.id) {
    const labelEl = document.querySelector(`label[for="${input.id}"]`);
    if (labelEl && labelEl.textContent.trim()) {
      labelText = labelEl.textContent.replace(/[*:]/g, '').trim();
    }
  }

  if (!labelText && input.closest) {
    const formGroup = input.closest('.form-group, .input-group, .form-field');
    if (formGroup) {
      const labelEl = formGroup.querySelector('label');
      if (labelEl && labelEl.textContent.trim()) {
        labelText = labelEl.textContent.replace(/[*:]/g, '').trim();
      }
    }
  }

  if (!labelText && input.placeholder && input.placeholder.trim()) {
    labelText = input.placeholder.trim();
  }

  const isDob = id.includes('dob') || id.includes('birth') || (labelText && labelText.toLowerCase().includes('birth'));
  if (isDob) {
    return 'Date of Birth (as per PAN)';
  }

  return labelText || 'Select Date';
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ============================================================
// MOBILE PHONEPE 3-COLUMN DRUM / WHEEL ROLLER PICKER MODAL
// ============================================================
export function openMobileWheelPicker({ initialDate, title = 'Select Date', onSelect, onCancel }) {
  closeActiveDatePicker();

  const selectedDate = (initialDate instanceof Date && !isNaN(initialDate.getTime()))
    ? initialDate
    : (parseDateString(initialDate) || new Date());

  const START_YEAR = 1920;
  const END_YEAR = 2050;
  const yearsList = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    yearsList.push(y);
  }

  let curYear = selectedDate.getFullYear();
  if (curYear < START_YEAR) curYear = START_YEAR;
  if (curYear > END_YEAR) curYear = END_YEAR;

  let curMonth = selectedDate.getMonth();
  let curMaxDays = getDaysInMonth(curYear, curMonth);
  let curDay = Math.min(selectedDate.getDate(), curMaxDays);

  const backdrop = document.createElement('div');
  backdrop.className = 'tps-wheel-backdrop';
  backdrop.id = 'tps-mobile-wheel-modal';

  backdrop.innerHTML = `
    <div class="tps-wheel-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="tps-wheel-header">
        <h3 class="tps-wheel-title">${escapeHtml(title)}</h3>
      </div>

      <div class="tps-wheel-container">
        <!-- Top and Bottom Gradient Fade Masks -->
        <div class="tps-wheel-gradient-top"></div>
        <div class="tps-wheel-gradient-bottom"></div>

        <!-- 2 Horizontal Divider Lines Framing Center Selection Row -->
        <div class="tps-wheel-selection-frame" aria-hidden="true">
          <div class="tps-wheel-frame-col col-day"></div>
          <div class="tps-wheel-frame-col col-month"></div>
          <div class="tps-wheel-frame-col col-year"></div>
        </div>

        <!-- Column 1: DAY (01 .. 31) -->
        <div class="tps-wheel-col col-day" data-wheel="day" tabindex="0">
          <div class="tps-wheel-spacer"></div>
          <div class="tps-wheel-items" data-items="day"></div>
          <div class="tps-wheel-spacer"></div>
        </div>

        <!-- Column 2: MONTH (Jan .. Dec) -->
        <div class="tps-wheel-col col-month" data-wheel="month" tabindex="0">
          <div class="tps-wheel-spacer"></div>
          <div class="tps-wheel-items" data-items="month"></div>
          <div class="tps-wheel-spacer"></div>
        </div>

        <!-- Column 3: YEAR (1920 .. 2050) -->
        <div class="tps-wheel-col col-year" data-wheel="year" tabindex="0">
          <div class="tps-wheel-spacer"></div>
          <div class="tps-wheel-items" data-items="year"></div>
          <div class="tps-wheel-spacer"></div>
        </div>
      </div>

      <div class="tps-wheel-footer">
        <button type="button" class="tps-wheel-btn btn-cancel" id="tps-wheel-cancel-btn">CANCEL</button>
        <div class="tps-wheel-btn-divider"></div>
        <button type="button" class="tps-wheel-btn btn-done" id="tps-wheel-done-btn">DONE</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('tps-wheel-open');
  activePopup = backdrop;

  const dayCol = backdrop.querySelector('.col-day');
  const dayItemsList = backdrop.querySelector('[data-items="day"]');
  const monthCol = backdrop.querySelector('.col-month');
  const monthItemsList = backdrop.querySelector('[data-items="month"]');
  const yearCol = backdrop.querySelector('.col-year');
  const yearItemsList = backdrop.querySelector('[data-items="year"]');

  const ITEM_HEIGHT = 42;

  function setupWheelColumn({ colEl, itemsListEl, getItems, getIndex, onIndexChanged }) {
    let currentIdx = getIndex();

    function renderItems() {
      const items = getItems();
      itemsListEl.innerHTML = items.map((val, idx) => `
        <div class="tps-wheel-item" data-index="${idx}">${val}</div>
      `).join('');
      updateVisuals();
    }

    function updateVisuals() {
      const itemEls = itemsListEl.querySelectorAll('.tps-wheel-item');
      if (itemEls.length === 0) return;

      const scrollTop = colEl.scrollTop;
      const activeIdx = Math.max(0, Math.min(itemEls.length - 1, Math.round(scrollTop / ITEM_HEIGHT)));

      itemEls.forEach((el, idx) => {
        const dist = Math.abs(idx - activeIdx);
        el.className = 'tps-wheel-item';
        if (dist === 0) {
          el.classList.add('state-center');
        } else if (dist === 1) {
          el.classList.add('state-near');
        } else if (dist === 2) {
          el.classList.add('state-far');
        } else {
          el.classList.add('state-hidden');
        }
      });

      if (activeIdx !== currentIdx) {
        currentIdx = activeIdx;
        onIndexChanged(activeIdx);
      }
    }

    function scrollToIdx(idx, smooth = false) {
      const maxIdx = getItems().length - 1;
      const targetIdx = Math.max(0, Math.min(maxIdx, idx));
      currentIdx = targetIdx;
      colEl.scrollTo({
        top: targetIdx * ITEM_HEIGHT,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setTimeout(updateVisuals, smooth ? 120 : 10);
    }

    // Scroll listener with RAF throttle
    let ticking = false;
    colEl.addEventListener('scroll', () => {
      if (!ticking) {
        safeRAF(() => {
          updateVisuals();
          ticking = false;
        });
        ticking = true;
      }
    });

    // Tap on item to snap to center
    itemsListEl.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.tps-wheel-item');
      if (itemEl) {
        const idx = parseInt(itemEl.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          scrollToIdx(idx, true);
        }
      }
    });

    // Mouse drag support for desktop browsers testing mobile
    let isMouseDown = false;
    let startY = 0;
    let startScroll = 0;

    colEl.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      startY = e.clientY;
      startScroll = colEl.scrollTop;
      colEl.style.scrollSnapType = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const deltaY = e.clientY - startY;
      colEl.scrollTop = startScroll - deltaY;
    });

    window.addEventListener('mouseup', () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      colEl.style.scrollSnapType = 'y mandatory';
      const nearestIdx = Math.round(colEl.scrollTop / ITEM_HEIGHT);
      scrollToIdx(nearestIdx, true);
    });

    return {
      renderItems,
      scrollToIdx,
      getCurrentIdx: () => currentIdx
    };
  }

  // 1. Day Column Controller
  const dayController = setupWheelColumn({
    colEl: dayCol,
    itemsListEl: dayItemsList,
    getItems: () => {
      const days = [];
      for (let d = 1; d <= curMaxDays; d++) {
        days.push(pad2(d));
      }
      return days;
    },
    getIndex: () => curDay - 1,
    onIndexChanged: (newIdx) => {
      curDay = newIdx + 1;
    }
  });

  // 2. Month Column Controller
  const monthController = setupWheelColumn({
    colEl: monthCol,
    itemsListEl: monthItemsList,
    getItems: () => SHORT_MONTHS,
    getIndex: () => curMonth,
    onIndexChanged: (newIdx) => {
      curMonth = newIdx;
      updateDaysForMonthYear();
    }
  });

  // 3. Year Column Controller
  const yearController = setupWheelColumn({
    colEl: yearCol,
    itemsListEl: yearItemsList,
    getItems: () => yearsList,
    getIndex: () => curYear - START_YEAR,
    onIndexChanged: (newIdx) => {
      curYear = START_YEAR + newIdx;
      updateDaysForMonthYear();
    }
  });

  function updateDaysForMonthYear() {
    curMaxDays = getDaysInMonth(curYear, curMonth);
    dayController.renderItems();
    if (curDay > curMaxDays) {
      curDay = curMaxDays;
      dayController.scrollToIdx(curDay - 1, true);
    }
  }

  // Initial render
  dayController.renderItems();
  monthController.renderItems();
  yearController.renderItems();

  // Scroll to initial selected position
  safeRAF(() => {
    dayController.scrollToIdx(curDay - 1, false);
    monthController.scrollToIdx(curMonth, false);
    yearController.scrollToIdx(curYear - START_YEAR, false);
  });

  // Footer Buttons Listeners
  backdrop.querySelector('#tps-wheel-done-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const finalDate = new Date(curYear, curMonth, curDay);
    if (onSelect) {
      onSelect(finalDate);
    }
    closeActiveDatePicker();
  });

  backdrop.querySelector('#tps-wheel-cancel-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (onCancel) onCancel();
    closeActiveDatePicker();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      if (onCancel) onCancel();
      closeActiveDatePicker();
    }
  });
}

export function showMobileDatePickerModal(input) {
  const initialDateStr = input.getAttribute('data-date-raw') || input.value || '';
  const initialDate = parseDateString(initialDateStr) || new Date();
  const title = getFieldTitle(input);

  openMobileWheelPicker({
    initialDate,
    title,
    onSelect: (selectedDate) => {
      applyDateToInput(input, selectedDate);
    }
  });
}

// ============================================================
// DESKTOP INSTITUTIONAL CALENDAR POPUP
// ============================================================
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

  // 1. DAYS VIEW
  function renderDaysView() {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === viewYear && now.getMonth() === viewMonth;
    const todayDate = now.getDate();

    let daysHtml = '';

    // Prev month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      daysHtml += `
        <div class="tps-cal-day other-month" data-day="${d}" data-nav="prev">
          ${pad2(d)}
        </div>
      `;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = selectedDate.getFullYear() === viewYear &&
                         selectedDate.getMonth() === viewMonth &&
                         selectedDate.getDate() === d;
      const isToday = isCurrentMonth && d === todayDate;
      const dayOfWeek = (firstDayOfWeek + d - 1) % 7;
      const isSunday = dayOfWeek === 0;

      let classes = 'tps-cal-day';
      if (isSelected) classes += ' selected';
      if (isToday) classes += ' today';
      if (isSunday) classes += ' sun-col';

      const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      daysHtml += `
        <div class="${classes}" data-day="${d}" data-date="${dateStr}">
          ${pad2(d)}
        </div>
      `;
    }

    // Next month leading days (fill 42 cells total for consistent 6 rows)
    const totalFilled = firstDayOfWeek + daysInMonth;
    const nextDays = (totalFilled > 35 ? 42 : 35) - totalFilled;
    for (let d = 1; d <= nextDays; d++) {
      daysHtml += `
        <div class="tps-cal-day other-month" data-day="${d}" data-nav="next">
          ${pad2(d)}
        </div>
      `;
    }

    popup.innerHTML = `
      <div class="tps-cal-top-section">
        <div class="tps-cal-top-left">
          <div class="tps-cal-main-title">Select Date</div>
          <div class="tps-cal-pills-row">
            <button type="button" class="tps-cal-pill-btn btn-trigger-month">
              <span>${SHORT_MONTHS[viewMonth]}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button type="button" class="tps-cal-pill-btn btn-trigger-year">
              <span>${viewYear}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <div class="tps-cal-badge-card" aria-hidden="true">
          <div class="tps-cal-badge-tabs">
            <div class="tps-cal-tab"></div>
            <div class="tps-cal-tab"></div>
          </div>
          <div class="tps-cal-badge-num">${pad2(selectedDate.getDate())}</div>
        </div>
      </div>

      <div class="tps-cal-grid-header">
        <span class="tps-cal-wh sun">SUN</span>
        <span class="tps-cal-wh">MON</span>
        <span class="tps-cal-wh">TUE</span>
        <span class="tps-cal-wh">WED</span>
        <span class="tps-cal-wh">THU</span>
        <span class="tps-cal-wh">FRI</span>
        <span class="tps-cal-wh">SAT</span>
      </div>

      <div class="tps-cal-days-grid">
        ${daysHtml}
      </div>

      <div class="tps-cal-action-bar">
        <button type="button" class="tps-cal-confirm-btn">
          Confirm
        </button>
      </div>
    `;

    // Event handlers
    popup.querySelector('.btn-trigger-month')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewMode = 'months';
      renderView();
    });

    popup.querySelector('.btn-trigger-year')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewMode = 'years';
      renderView();
    });

    popup.querySelectorAll('.tps-cal-day').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const nav = cell.getAttribute('data-nav');
        const dayVal = parseInt(cell.getAttribute('data-day'), 10);

        if (nav === 'prev') {
          viewMonth--;
          if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
          }
          selectedDate = new Date(viewYear, viewMonth, dayVal);
          renderView();
        } else if (nav === 'next') {
          viewMonth++;
          if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
          }
          selectedDate = new Date(viewYear, viewMonth, dayVal);
          renderView();
        } else {
          const dateStr = cell.getAttribute('data-date');
          if (dateStr) {
            const newDate = parseDateString(dateStr);
            if (newDate) selectedDate = newDate;
          } else {
            selectedDate = new Date(viewYear, viewMonth, dayVal);
          }

          if (selectedDate.getMonth() !== viewMonth || selectedDate.getFullYear() !== viewYear) {
            viewMonth = selectedDate.getMonth();
            viewYear = selectedDate.getFullYear();
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
        if (dateStr) applyDateToInput(input, dateStr);
      });
    });

    popup.querySelector('.tps-cal-confirm-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      applyDateToInput(input, formatDateYMD(selectedDate));
    });
  }

  // 2. YEARS SELECTION VIEW
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

export function parseDateString(str) {
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
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10) - 1;
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }

  // DD-MM-YYYY
  if (dashParts.length === 3 && dashParts[0].length <= 2 && dashParts[2].length === 4) {
    const d = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10) - 1;
    const y = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateYMD(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
