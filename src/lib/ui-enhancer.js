import { enhanceDateInput } from '../components/date-picker.js';
import { enhanceSelect } from '../components/custom-select.js';

/**
 * Global Institutional UI Enhancer
 * Automatically upgrades all date inputs to the Image 1 Calendar UI,
 * and all <select> elements to the Image 2 Pill & Mint Dropdown pattern.
 * Uses a MutationObserver to ensure ALL dynamic and upcoming UI automatically inherits this pattern!
 */

export function enhanceAllUI(root = document.body) {
  if (typeof window === 'undefined' || !root) return;

  // Enhance all date inputs (both native type="date" and text date pickers)
  const dateInputs = root.querySelectorAll ? root.querySelectorAll('input[type="date"], input[data-datepicker]') : [];
  dateInputs.forEach(input => {
    enhanceDateInput(input);
  });

  // Enhance all select elements
  const selects = root.querySelectorAll ? root.querySelectorAll('select:not([data-tps-enhanced-select]):not(.native-select)') : [];
  selects.forEach(select => {
    enhanceSelect(select);
  });
}

export function initGlobalUIObserver() {
  if (typeof window === 'undefined') return;

  // Run initial enhancement
  enhanceAllUI(document.body);

  // Observe all future DOM changes (modals, module switches, dynamic forms)
  const observer = new MutationObserver((mutations) => {
    let shouldEnhance = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.matches && (node.matches('select, input[type="date"]') || node.querySelector('select, input[type="date"]'))) {
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
