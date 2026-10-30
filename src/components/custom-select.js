/**
 * TPS Hostel ERP — Custom Institutional Dropdown Component
 * Matches Image 2 design: rounded pill trigger with emerald border (#059669),
 * chevron indicator, floating card menu, soft mint selected state (#E6F4EA),
 * deep emerald text (#0F5132), and checkmark indicator.
 */

let activeDropdownMenu = null;
let activeDropdownTrigger = null;

export function closeActiveDropdown() {
  if (activeDropdownMenu) {
    activeDropdownMenu.remove();
    activeDropdownMenu = null;
  }
  if (activeDropdownTrigger) {
    activeDropdownTrigger.classList.remove('open');
    const chevron = activeDropdownTrigger.querySelector('.tps-dropdown-chevron');
    if (chevron) {
      chevron.innerHTML = `<polyline points="6 9 12 15 18 9"/>`;
    }
    activeDropdownTrigger = null;
  }
}

// Global click outside listener
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!activeDropdownMenu) return;
    if (activeDropdownMenu.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.tps-custom-select-trigger')) return;
    closeActiveDropdown();
  });
}

export function enhanceSelect(select) {
  if (typeof document === 'undefined' || !select || select.hasAttribute('data-tps-enhanced-select')) return;
  select.setAttribute('data-tps-enhanced-select', 'true');

  // Hide the native select while keeping it functional in DOM
  select.style.display = 'none';

  // Create custom pill trigger
  const trigger = document.createElement('div');
  trigger.className = 'tps-custom-select-trigger';

  // Inherit full-width behavior when select specifies 100% width or full-width classes/attributes
  if (
    select.style.width === '100%' ||
    select.classList.contains('select-full-width') ||
    select.classList.contains('w-100') ||
    select.classList.contains('w-full') ||
    select.hasAttribute('data-full-width')
  ) {
    trigger.classList.add('w-100');
    trigger.style.width = '100%';
    trigger.style.display = 'flex';
    trigger.style.boxSizing = 'border-box';
  }
  trigger.tabIndex = 0; // Focusable via keyboard
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const labelSpan = document.createElement('span');
  labelSpan.className = 'tps-dropdown-label';

  const chevronSpan = document.createElement('span');
  chevronSpan.className = 'tps-dropdown-chevron';
  chevronSpan.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;

  trigger.appendChild(labelSpan);
  trigger.appendChild(chevronSpan);

  // Insert trigger right after the hidden native select
  select.parentNode.insertBefore(trigger, select.nextSibling);

  function syncTriggerLabel() {
    const selectedOption = select.options[select.selectedIndex];
    labelSpan.innerText = selectedOption ? selectedOption.text : 'Select...';
  }

  syncTriggerLabel();

  // Listen to programmatic or external changes to native select
  select.addEventListener('change', syncTriggerLabel);

  function toggleMenu(e) {
    if (e) e.stopPropagation();

    if (activeDropdownTrigger === trigger) {
      closeActiveDropdown();
      return;
    }

    closeActiveDropdown();
    openDropdownMenu(select, trigger, syncTriggerLabel);
  }

  trigger.addEventListener('click', toggleMenu);

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      toggleMenu(e);
    }
  });
}

function openDropdownMenu(select, trigger, onOptionSelected) {
  trigger.classList.add('open');
  const chevron = trigger.querySelector('.tps-dropdown-chevron svg');
  if (chevron) {
    chevron.innerHTML = `<polyline points="18 15 12 9 6 15"/>`;
  }

  const menu = document.createElement('div');
  menu.className = 'tps-custom-dropdown-menu';
  menu.setAttribute('role', 'listbox');

  const options = Array.from(select.options);
  const selectedIndex = select.selectedIndex;

  options.forEach((opt, idx) => {
    const isSelected = idx === selectedIndex;
    const item = document.createElement('div');
    item.className = `tps-dropdown-item ${isSelected ? 'selected' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    item.innerHTML = `
      <span class="item-text">${opt.text}</span>
      ${isSelected ? `
        <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F5132" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ` : ''}
    `;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      select.selectedIndex = idx;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      if (onOptionSelected) onOptionSelected();
      closeActiveDropdown();
    });

    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  activeDropdownMenu = menu;
  activeDropdownTrigger = trigger;

  positionMenu(menu, trigger);
}

function positionMenu(menu, trigger) {
  const rect = trigger.getBoundingClientRect();
  const triggerWidth = rect.width;
  const menuWidth = Math.max(triggerWidth, 180);

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 6;

  // Prevent right screen edge overflow
  if (left + menuWidth > window.innerWidth - 12) {
    left = window.innerWidth - menuWidth - 12;
  }
  if (left < 12) left = 12;

  // Flip up if bottom screen overflows
  const menuHeight = menu.offsetHeight || 220;
  if (rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight) {
    top = rect.top + window.scrollY - menuHeight - 6;
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.style.minWidth = `${Math.round(triggerWidth)}px`;
  menu.style.maxWidth = `${Math.round(Math.max(triggerWidth, 280))}px`;
  menu.style.boxSizing = 'border-box';
}
