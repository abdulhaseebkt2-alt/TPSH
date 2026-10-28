// ============================================================
// WHEEL / DRUM ROLLER TIME PICKER COMPONENT
// Matching exact mobile/iOS drum roller design with faded numbers,
// center guide lines, and top-right cyan dot mode button.
// ============================================================

export function from24Hour(time24) {
  if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) {
    return { hour: 8, minute: 0, period: 'PM' };
  }
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) h = 8;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { hour: h, minute: m, period };
}

export function to24Hour(hour12, minute, period) {
  let h = parseInt(hour12, 10);
  if (isNaN(h)) h = 12;
  const isPM = String(period).toUpperCase() === 'PM';
  if (isPM && h < 12) h += 12;
  if (!isPM && h === 12) h = 0;
  const m = String(minute).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${m}`;
}

export function format12Hour(hour12, minute, period) {
  const h = String(hour12).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function createWheelTimePickerElement({
  initialTime = '20:00',
  onChange,
  onDone,
  onCancel,
  showHeader = true,
  title = 'Time'
}) {
  const parsed = from24Hour(initialTime);
  let currentHour = parsed.hour;
  let currentMinute = parsed.minute;
  let currentPeriod = parsed.period;

  const card = document.createElement('div');
  card.className = 'wheel-time-card';

  card.innerHTML = `
    ${showHeader ? `
      <div class="wheel-time-header">
        <span class="wheel-time-title">${title}</span>
        <div class="wheel-time-dot-btn" title="Confirm Time" role="button" tabindex="0">
          <div class="wheel-time-dot-inner"></div>
        </div>
      </div>
    ` : ''}

    <div class="wheel-picker-body">
      <!-- Horizontal divider lines framing active selection -->
      <div class="wheel-picker-overlay"></div>

      <!-- Hours Column (1-12) -->
      <ul class="wheel-column" data-col="hour">
        <li class="wheel-spacer" style="height: 76px; list-style: none;"></li>
        ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `
          <li class="wheel-item" data-val="${h}">${h}</li>
        `).join('')}
        <li class="wheel-spacer" style="height: 76px; list-style: none;"></li>
      </ul>

      <!-- Minutes Column (00-59) -->
      <ul class="wheel-column" data-col="minute">
        <li class="wheel-spacer" style="height: 76px; list-style: none;"></li>
        ${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => `
          <li class="wheel-item" data-val="${m}">${m}</li>
        `).join('')}
        <li class="wheel-spacer" style="height: 76px; list-style: none;"></li>
      </ul>

      <!-- Period Column (AM/PM) -->
      <ul class="wheel-column" data-col="period">
        <li class="wheel-spacer" style="height: 76px; list-style: none;"></li>
        <li class="wheel-item" data-val="AM">AM</li>
        <li class="wheel-item" data-val="PM">PM</li>
        <li class="wheel-spacer" style="height: 76px; list-style: none;"></li>
      </ul>
    </div>

    <div class="wheel-time-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid #F1F5F9;">
      <button type="button" class="btn btn-outline btn-sm btn-time-cancel" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px;">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm btn-time-done" style="padding: 0.35rem 0.95rem; font-size: 0.8rem; background: #00A3E0; border-color: #00A3E0; border-radius: 6px;">Done</button>
    </div>
  `;

  const hourCol = card.querySelector('[data-col="hour"]');
  const minCol = card.querySelector('[data-col="minute"]');
  const periodCol = card.querySelector('[data-col="period"]');

  const ITEM_HEIGHT = 38;

  function updateVisuals(col) {
    const items = col.querySelectorAll('.wheel-item');
    const scrollPos = col.scrollTop;
    let selectedItem = null;

    items.forEach((item, index) => {
      const itemTop = index * ITEM_HEIGHT;
      const dist = Math.abs(itemTop - scrollPos);

      item.classList.remove('selected', 'near-selected');

      if (dist < ITEM_HEIGHT * 0.5) {
        item.classList.add('selected');
        selectedItem = item;
      } else if (dist < ITEM_HEIGHT * 1.5) {
        item.classList.add('near-selected');
      }
    });

    return selectedItem;
  }

  function scrollToValue(col, val, smooth = false) {
    const items = Array.from(col.querySelectorAll('.wheel-item'));
    const idx = items.findIndex(it => String(it.getAttribute('data-val')) === String(val));
    if (idx !== -1) {
      col.scrollTo({
        top: idx * ITEM_HEIGHT,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setTimeout(() => updateVisuals(col), 50);
    }
  }

  function setupColumnInteractivity(col, onValChange) {
    let scrollTimeout = null;

    col.addEventListener('scroll', () => {
      const active = updateVisuals(col);
      if (active && onValChange) {
        const val = active.getAttribute('data-val');
        onValChange(val);
      }

      // Snap on scroll stop if user dragged without CSS snap support
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const targetIndex = Math.round(col.scrollTop / ITEM_HEIGHT);
        const targetTop = targetIndex * ITEM_HEIGHT;
        if (Math.abs(col.scrollTop - targetTop) > 2) {
          col.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }, 120);
    }, { passive: true });

    // Mouse wheel scrolling
    col.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const targetIndex = Math.round(col.scrollTop / ITEM_HEIGHT) + dir;
      col.scrollTo({ top: targetIndex * ITEM_HEIGHT, behavior: 'smooth' });
    }, { passive: false });

    // Click item to scroll to center
    col.querySelectorAll('.wheel-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        col.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
      });
    });
  }

  // Setup column listeners
  setupColumnInteractivity(hourCol, (val) => {
    currentHour = parseInt(val, 10);
    notifyChange();
  });

  setupColumnInteractivity(minCol, (val) => {
    currentMinute = parseInt(val, 10);
    notifyChange();
  });

  setupColumnInteractivity(periodCol, (val) => {
    currentPeriod = val;
    notifyChange();
  });

  function notifyChange() {
    if (onChange) {
      const time24 = to24Hour(currentHour, currentMinute, currentPeriod);
      const time12 = format12Hour(currentHour, currentMinute, currentPeriod);
      onChange({ time24, time12, hour: currentHour, minute: currentMinute, period: currentPeriod });
    }
  }

  function handleComplete() {
    const time24 = to24Hour(currentHour, currentMinute, currentPeriod);
    const time12 = format12Hour(currentHour, currentMinute, currentPeriod);
    if (onDone) onDone({ time24, time12, hour: currentHour, minute: currentMinute, period: currentPeriod });
  }

  // Button actions
  card.querySelector('.wheel-time-dot-btn')?.addEventListener('click', handleComplete);
  card.querySelector('.btn-time-done')?.addEventListener('click', handleComplete);
  card.querySelector('.btn-time-cancel')?.addEventListener('click', () => {
    if (onCancel) onCancel();
  });

  // Initial scroll positioning after DOM attachment
  requestAnimationFrame(() => {
    scrollToValue(hourCol, currentHour, false);
    scrollToValue(minCol, String(currentMinute).padStart(2, '0'), false);
    scrollToValue(periodCol, currentPeriod, false);
  });

  return card;
}

export function openWheelTimePicker({
  initialTime = '20:00',
  title = 'Time',
  onSelect,
  onCancel
}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'wheel-picker-backdrop';

  const pickerElement = createWheelTimePickerElement({
    initialTime,
    title,
    showHeader: true,
    onDone: (result) => {
      close();
      if (onSelect) onSelect(result.time24, result.time12, result);
    },
    onCancel: () => {
      close();
      if (onCancel) onCancel();
    }
  });

  backdrop.appendChild(pickerElement);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.classList.add('fade-out');
    setTimeout(() => {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }, 150);
  }

  // Click outside to cancel
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      close();
      if (onCancel) onCancel();
    }
  });

  // ESC key to close
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', onKeyDown);
      close();
      if (onCancel) onCancel();
    }
  };
  window.addEventListener('keydown', onKeyDown);
}

/**
 * Attaches the Wheel Time Picker to an existing HTML <input type="time"> or <input>
 * Replaces the native browser picker with the custom mobile drum-roller card.
 */
export function attachWheelTimePicker(input, { onChange } = {}) {
  if (!input || input.__wheelPickerAttached) return;
  input.__wheelPickerAttached = true;

  // Hide the raw input
  input.style.display = 'none';

  // Compute initial 12-hour display value
  const initial24 = input.value || '08:00';
  const parsed = from24Hour(initial24);
  const initial12 = format12Hour(parsed.hour, parsed.minute, parsed.period);

  // Create custom clickable button trigger
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'wheel-time-trigger';
  trigger.innerHTML = `
    <span class="wheel-time-val">${initial12}</span>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #64748B; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  `;

  input.parentNode.insertBefore(trigger, input.nextSibling);

  // Sync when input.value changes externally
  const observer = new MutationObserver(() => {
    const p = from24Hour(input.value);
    trigger.querySelector('.wheel-time-val').textContent = format12Hour(p.hour, p.minute, p.period);
  });
  observer.observe(input, { attributes: true, attributeFilter: ['value'] });

  trigger.addEventListener('click', () => {
    openWheelTimePicker({
      initialTime: input.value || '08:00',
      title: input.getAttribute('data-picker-title') || 'Time',
      onSelect: (time24, time12) => {
        input.value = time24;
        trigger.querySelector('.wheel-time-val').textContent = time12;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (onChange) onChange(time24, time12);
      }
    });
  });
}

/**
 * Global enhancer: auto-attaches Wheel Time Picker to all time inputs in a container.
 */
export function initAllWheelTimePickers(container = document) {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  const inputs = container.querySelectorAll('input[type="time"], input[data-wheel-time="true"]');
  inputs.forEach(input => attachWheelTimePicker(input));
}
