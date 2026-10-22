// TPS Hostel ERP Dialog & Modal Manager

export function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';

    overlay.innerHTML = `
      <div class="modal-dialog" style="max-width: 440px;">
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          <p style="color: var(--text-secondary); line-height: 1.6;">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="dialog-cancel-btn">${cancelText}</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="dialog-confirm-btn">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('#dialog-cancel-btn').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#dialog-confirm-btn').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

export function openModal({ title, contentHtml, size = 'md', onMount, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';

  overlay.innerHTML = `
    <div class="modal-dialog ${sizeClass}">
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

  overlay.querySelector('#modal-close-x').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (onMount) {
    onMount({
      container: overlay.querySelector('#modal-content-container'),
      close
    });
  }

  return { close };
}
