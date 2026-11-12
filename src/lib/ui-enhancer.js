import { enhanceDateInput } from '../components/date-picker.js';
import { enhanceSelect, getSelectStorageKey } from '../components/custom-select.js';
import { initAllWheelTimePickers } from './wheelTimePicker.js';
import { initGlobalFormValidation } from './validation.js';

/**
 * Universal Button & Segmented Tab Memory
 * Remembers the user's active filter tab / segmented button choice (e.g. Live / Today / Weekly,
 * status filters, destination tabs) across sessions on mobile and desktop.
 */
export function enhanceTabButtons(root = document.body) {
  if (typeof window === 'undefined' || !root) return;

  const tabButtons = root.querySelectorAll ? root.querySelectorAll('button[data-tab], .tab-item[data-tab], .filter-btn[data-tab], .att-timetable-tab-btn[data-tab], [data-filter-tab]') : [];

  tabButtons.forEach(btn => {
    if (btn.hasAttribute('data-tps-tab-memory-applied')) return;
    btn.setAttribute('data-tps-tab-memory-applied', 'true');

    const tabValue = btn.getAttribute('data-tab') || btn.getAttribute('data-filter') || btn.getAttribute('data-filter-tab');
    if (!tabValue) return;

    // Determine group key from container
    const container = btn.closest('.att-timetable-tabs, .tabs-container, .tab-bar, .segmented-control, .filter-bar, .tab-group, .dest-tabs-nav') || btn.parentElement;
    if (!container) return;

    const groupKey = container.id || container.getAttribute('data-tab-group') || (container.className || '').split(' ').filter(c => c && !c.includes('flex') && !c.includes('grid'))[0] || 'tabs';
    const mod = window.location.hash.replace('#', '') || 'app';
    const storageKey = `tps_tab_mem_${mod}_${groupKey}`;

    // Restore saved active tab on load if available
    try {
      const savedTab = localStorage.getItem(storageKey);
      if (savedTab && savedTab === tabValue && !btn.classList.contains('active') && !btn.classList.contains('is-active')) {
        setTimeout(() => {
          if (!btn.classList.contains('active') && !btn.classList.contains('is-active')) {
            btn.click();
          }
        }, 40);
      }
    } catch {}

    // Save user tab choice on click
    btn.addEventListener('click', () => {
      try {
        localStorage.setItem(storageKey, tabValue);
      } catch {}
    });
  });
}

/**
 * Global Institutional UI Enhancer
 * Automatically upgrades all date inputs to the PhonePe 3-column drum wheel / calendar UI,
 * all time inputs to the custom institutional wheel clock UI,
 * all <select> elements to the Image 2 Pill & Mint Dropdown pattern with memory persistence,
 * and all segmented/filter buttons with cross-session memory!
 */
export function enhanceAllUI(root = document.body) {
  if (typeof window === 'undefined' || !root) return;

  // Enhance all date inputs (both native type="date" and text date pickers)
  const dateInputs = root.querySelectorAll ? root.querySelectorAll('input[type="date"], input[data-datepicker]') : [];
  dateInputs.forEach(input => {
    enhanceDateInput(input);
  });

  // Enhance all time inputs to custom institutional wheel clock UI
  initAllWheelTimePickers(root);

  // Enhance all select elements with custom styling & memory
  const selects = root.querySelectorAll ? root.querySelectorAll('select:not([data-tps-enhanced-select]):not(.native-select)') : [];
  selects.forEach(select => {
    enhanceSelect(select);
  });

  // Apply memory to any native selects that opted out of custom trigger
  const nativeSelects = root.querySelectorAll ? root.querySelectorAll('select.native-select:not([data-tps-memory-applied])') : [];
  nativeSelects.forEach(select => {
    select.setAttribute('data-tps-memory-applied', 'true');
    const memKey = getSelectStorageKey(select);
    if (memKey && typeof localStorage !== 'undefined') {
      try {
        const savedVal = localStorage.getItem(memKey);
        if (savedVal !== null && savedVal !== undefined && savedVal !== '') {
          const hasOption = Array.from(select.options).some(o => o.value === savedVal);
          if (hasOption && select.value !== savedVal) {
            select.value = savedVal;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      } catch {}
      select.addEventListener('change', () => {
        try {
          localStorage.setItem(memKey, select.value);
        } catch {}
      });
    }
  });

  // Enhance segmented and tab buttons with state memory
  enhanceTabButtons(root);
}

export function enhanceModalInputs(root = document.body) {
  enhanceAllUI(root);
}

export function initGlobalUIObserver() {
  if (typeof window === 'undefined') return;

  // Run initial enhancement
  enhanceAllUI(document.body);
  initGlobalFormValidation();

  // Observe all future DOM changes (modals, module switches, dynamic forms)
  const observer = new MutationObserver((mutations) => {
    let shouldEnhance = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.matches && (node.matches('select, input[type="date"], input[type="time"], button[data-tab], .tab-item') || node.querySelector('select, input[type="date"], input[type="time"], button[data-tab], .tab-item'))) {
              shouldEnhance = true;
              break;
            }
          }
        }
      }
      if (shouldEnhance) break;
    }

    if (shouldEnhance) {
      enhanceAllUI(document.body);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
