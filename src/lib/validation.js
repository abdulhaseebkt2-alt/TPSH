import { toast } from './toast.js';

/**
 * Universal Mandatory Form Validation & Red Indication Engine
 * Automatically highlights any empty mandatory field in prominent red with shake animation,
 * displays a red warning message, focuses the field, and clears the red indication dynamically
 * once valid data is entered.
 */

export function markFieldInvalid(field, message = 'This field is required') {
  if (!field) return;
  field.classList.add('is-invalid', 'field-invalid', 'field-invalid-shake');

  // If inside a custom select or datepicker, highlight the visual wrapper/trigger
  const parentGroup = field.closest('.form-group') || field.parentElement;
  if (parentGroup) {
    parentGroup.classList.add('has-error');
    let errorMsg = parentGroup.querySelector('.mandatory-error-msg');
    if (!errorMsg) {
      errorMsg = document.createElement('div');
      errorMsg.className = 'mandatory-error-msg';
      errorMsg.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${message}`;
      parentGroup.appendChild(errorMsg);
    }
  }

  // Remove shake class after animation completes so it can re-trigger on subsequent attempts
  setTimeout(() => {
    field.classList.remove('field-invalid-shake');
  }, 400);
}

export function clearFieldValidation(field) {
  if (!field) return;
  field.classList.remove('is-invalid', 'field-invalid', 'field-invalid-shake');
  const parentGroup = field.closest('.form-group') || field.parentElement;
  if (parentGroup) {
    parentGroup.classList.remove('has-error');
    const errorMsg = parentGroup.querySelector('.mandatory-error-msg');
    if (errorMsg) errorMsg.remove();
  }
}

export function isFieldMandatory(field) {
  if (!field || field.disabled || field.type === 'hidden') return false;
  if (typeof field.hasAttribute === 'function' && field.hasAttribute('required')) return true;
  if (field.required) return true;
  if (typeof field.getAttribute === 'function' && field.getAttribute('aria-required') === 'true') return true;
  if (field.dataset && field.dataset.required === 'true') return true;

  if (typeof field.closest === 'function') {
    const parentGroup = field.closest('.form-group');
    if (parentGroup) {
      const label = parentGroup.querySelector ? parentGroup.querySelector('label, .form-label') : null;
      if (label && (label.classList?.contains('required') || (label.textContent || '').includes('*'))) {
        return true;
      }
    }
  }
  return false;
}

export function isFieldEmpty(field) {
  if (!field) return false;
  const val = field.value;
  if (field.type === 'checkbox' || field.type === 'radio') {
    return !field.checked;
  }
  return val === null || val === undefined || String(val).trim() === '';
}

export function validateMandatoryForm(container = document, showToast = true) {
  if (typeof document === 'undefined' || !container) return true;

  const inputs = container.querySelectorAll
    ? container.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
    : [];

  const invalidFields = [];

  inputs.forEach(field => {
    if (isFieldMandatory(field)) {
      if (isFieldEmpty(field)) {
        markFieldInvalid(field);
        invalidFields.push(field);
      } else {
        clearFieldValidation(field);
      }
    }
  });

  if (invalidFields.length > 0) {
    // Focus the first invalid mandatory field
    try {
      invalidFields[0].focus();
      if (invalidFields[0].scrollIntoView) {
        invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_) {}

    if (showToast && typeof toast !== 'undefined' && toast.error) {
      toast.error('Please complete all mandatory fields indicated in red.');
    }
    return false;
  }

  return true;
}

let isGlobalValidationInitialized = false;

export function initGlobalFormValidation() {
  if (typeof document === 'undefined' || isGlobalValidationInitialized) return;
  isGlobalValidationInitialized = true;

  // 1. Intercept standard form submit events
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form && form.tagName === 'FORM') {
      const isValid = validateMandatoryForm(form, true);
      if (!isValid) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);

  // 2. Intercept HTML5 native invalid events to apply rich red styling
  document.addEventListener('invalid', (e) => {
    const field = e.target;
    if (field) {
      markFieldInvalid(field);
    }
  }, true);

  // 3. Intercept clicks on any submit / save / create / generate / confirm buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"]');
    if (!btn || btn.disabled) return;

    // Check if button is an action button that saves or submits data
    const isSaveOrSubmit = btn.type === 'submit' ||
      btn.classList.contains('btn-primary') ||
      btn.classList.contains('btn-save') ||
      btn.classList.contains('btn-submit') ||
      /submit|save|confirm|generate|apply|create/i.test(btn.id || '') ||
      /submit|save|confirm|generate|apply|create/i.test(btn.className || '') ||
      /submit|save|confirm|generate|apply|create/i.test(btn.textContent || '');

    if (!isSaveOrSubmit) return;

    // Ignore cancel, close, details, back, delete, or dismiss buttons
    const btnText = (btn.textContent || '').trim();
    if (/cancel|close|delete|dismiss|back|reject|details|search/i.test(btn.id || '') ||
        /cancel|close|delete|dismiss|back|reject|details|search/i.test(btnText)) {
      return;
    }

    const container = btn.closest('form') ||
                      btn.closest('.modal-body') ||
                      btn.closest('.modal-dialog') ||
                      btn.closest('.form-card') ||
                      btn.closest('.card') ||
                      btn.parentElement;

    if (!container) return;

    const isValid = validateMandatoryForm(container, true);
    if (!isValid) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // 4. Live clearing: as soon as user types or changes value, remove the red indication
  document.addEventListener('input', (e) => {
    const field = e.target;
    if (field && (field.classList.contains('is-invalid') || field.classList.contains('field-invalid'))) {
      if (!isFieldEmpty(field)) {
        clearFieldValidation(field);
      }
    }
  }, true);

  document.addEventListener('change', (e) => {
    const field = e.target;
    if (field && (field.classList.contains('is-invalid') || field.classList.contains('field-invalid'))) {
      if (!isFieldEmpty(field)) {
        clearFieldValidation(field);
      }
    }
  }, true);
}
