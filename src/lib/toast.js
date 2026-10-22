// TPS Hostel ERP Toast System

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3500) {
  const c = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-weight: bold; font-size: 16px;">${iconMap[type] || 'ℹ'}</span>
    <span style="flex: 1;">${message}</span>
  `;

  c.appendChild(toast);

  const timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    toast.remove();
  });
}

export const toast = {
  success: (msg, dur) => showToast(msg, 'success', dur),
  error: (msg, dur) => showToast(msg, 'error', dur),
  info: (msg, dur) => showToast(msg, 'info', dur)
};
