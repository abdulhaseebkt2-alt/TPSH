// TPS Hostel ERP Dialog & Modal Manager
import { initAllWheelTimePickers } from './wheelTimePicker.js';
import { enhanceDateInput } from '../components/date-picker.js';

export function confirmDialog({ title = 'Confirm Action', message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) {
  if (typeof document === 'undefined') return Promise.resolve(true);
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.zIndex = '10005';

    overlay.innerHTML = `
      <div class="card-panel modal-dialog" style="max-width: 420px; width: 92%; background: #FFFFFF; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1); overflow: hidden; margin: auto; padding: 0; border: 1px solid #E2E8F0;">
        <div style="padding: 1.25rem 1.25rem 0.5rem; display: flex; align-items: flex-start; gap: 0.85rem;">
          ${isDanger ? `
            <div style="width: 42px; height: 42px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          ` : `
            <div style="width: 42px; height: 42px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
          `}
          <div style="flex: 1; min-width: 0;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #0F172A;">${title}</h3>
            <p style="margin: 0.45rem 0 0; color: #475569; font-size: 0.88rem; line-height: 1.5;">${message}</p>
          </div>
        </div>
        <div style="padding: 0.85rem 1.25rem; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 0.75rem;">
          <button type="button" class="btn btn-outline" id="dialog-cancel-btn" style="border-radius: 8px; font-weight: 600; padding: 0.5rem 1rem;">${cancelText}</button>
          <button type="button" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="dialog-confirm-btn" style="${isDanger ? 'background: #DC2626; border-color: #DC2626; color: #FFFFFF;' : ''} border-radius: 8px; font-weight: 700; padding: 0.5rem 1.15rem;">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    overlay.querySelector('#dialog-cancel-btn').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#dialog-confirm-btn').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

export function openModal({ title, contentHtml, size = 'md', modalClass = '', onMount, onClose }) {
  if (typeof document === 'undefined') {
    return {
      close: () => {},
      container: null,
      modal: null,
      overlay: null,
      querySelector: () => null,
      querySelectorAll: () => []
    };
  }
  const overlay = document.createElement('div');
  const overlayClass = modalClass ? `modal-overlay open has-${modalClass}` : 'modal-overlay open';
  overlay.className = overlayClass;

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';
  const dialogClasses = ['modal-dialog', sizeClass, modalClass].filter(Boolean).join(' ');

  overlay.innerHTML = `
    <div class="${dialogClasses}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close-btn" id="modal-close-x">✕</button>
      </div>
      <div class="modal-body" id="modal-content-container">
        ${contentHtml}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.remove();
      if (onClose) onClose();
    }, 200);
  };

  overlay.querySelector('#modal-close-x')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const contentContainer = overlay.querySelector('#modal-content-container');
  initAllWheelTimePickers(contentContainer);
  if (contentContainer.querySelectorAll) {
    contentContainer.querySelectorAll('input[type="date"]').forEach(inp => enhanceDateInput(inp));
  }

  if (onMount) {
    const mountObj = {
      container: contentContainer,
      close,
      querySelector: (...args) => contentContainer.querySelector(...args),
      querySelectorAll: (...args) => contentContainer.querySelectorAll(...args)
    };
    onMount(mountObj, overlay);
    // Ensure any time inputs created dynamically in onMount are also upgraded
    initAllWheelTimePickers(contentContainer);
    if (contentContainer.querySelectorAll) {
      contentContainer.querySelectorAll('input[type="date"]').forEach(inp => enhanceDateInput(inp));
    }
  }

  return {
    close,
    container: contentContainer,
    modal: contentContainer,
    overlay,
    querySelector: (...args) => contentContainer.querySelector(...args),
    querySelectorAll: (...args) => contentContainer.querySelectorAll(...args)
  };
}
