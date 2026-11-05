import { getCurrentUser, signOut, switchDevRole, canSwitchRoles } from '../lib/auth.js';
import { getVisibleModules } from '../lib/permissions.js';
import { getSavedLogo } from '../lib/logo-utils.js';

export function updateSidebarLogo(logoUrl) {
  const logoEl = document?.querySelector ? document.querySelector('#sidebar-inst-logo') : null;
  if (!logoEl) return;
  const saved = getSavedLogo('tps_institution_logo') || getSavedLogo('tps_mobile_front_logo');
  const effective = (logoUrl && logoUrl !== 'null') ? logoUrl : (saved || '/tps-logo.png');
  logoEl.outerHTML = `<img src="${effective}" class="institution-logo" onerror="this.onerror=null; this.src='/tps-logo.png';" style="object-fit: contain; background: #FFFFFF; padding: 2px; border-radius: var(--radius-md);" alt="Logo" id="sidebar-inst-logo" />`;
}

export function renderSidebar(container, { activeModule, isCollapsed = false, onToggleCollapse, onNavigate, onCloseMobile }) {
  const user = getCurrentUser();
  const savedLogo = getSavedLogo('tps_institution_logo') || getSavedLogo('tps_mobile_front_logo');
  const logoHtml = `<img src="${savedLogo || '/tps-logo.png'}" class="institution-logo" onerror="this.onerror=null; this.src='/tps-logo.png';" style="object-fit: contain; background: #FFFFFF; padding: 2px; border-radius: var(--radius-md);" alt="Logo" id="sidebar-inst-logo" />`;
  const visibleModules = getVisibleModules(user);

  // Group modules into logical sections
  const sections = [
    {
      title: 'Student & Academic',
      keys: ['dashboard', 'admissions', 'students', 'sections', 'timetable', 'calendar', 'attendance', 'attendance_report', 'faculty_leaves']
    },
    {
      title: 'Hostel Operations',
      keys: ['leaves', 'leave_card', 'fines', 'discipline', 'hostel', 'maintenance']
    },
    {
      title: 'Examinations & Results',
      keys: ['exams', 'marks']
    },
    {
      title: 'Administration & Reports',
      keys: ['users', 'fees', 'notices', 'reports', 'audit', 'settings']
    },
    {
      title: 'Fleet & Transport',
      keys: ['vehicles', 'vehicle_requests', 'vehicle_expenses', 'vehicle_billing', 'vehicle_all_trips', 'vehicle_staff', 'vehicle_card', 'vehicle_trips']
    }
  ];

  let navHtml = '';

  for (const sec of sections) {
    const modulesInSec = visibleModules.filter(m => sec.keys.includes(m.key));
    if (modulesInSec.length > 0) {
      navHtml += `<div class="nav-section-title">${sec.title}</div>`;
      for (const mod of modulesInSec) {
        const isActive = mod.key === activeModule;
        navHtml += `
          <a class="nav-item ${isActive ? 'active' : ''}" data-module="${mod.key}" href="#${mod.key}" title="${mod.label}" data-tooltip="${mod.label}">
            <span class="nav-icon">${getIconSvg(mod.icon)}</span>
            <span class="nav-label">${mod.label}</span>
          </a>
        `;
      }
    }
  }

  container.innerHTML = `
    <!-- Frozen Sidebar Header with Institutional Branding -->
    <div class="sidebar-header">
      <div class="institution-brand" style="cursor: pointer;" id="sidebar-brand-link" title="${isCollapsed ? 'Thaiba Public School (Click to expand)' : 'Thaiba Public School'}">
        ${logoHtml}
        <div class="institution-titles">
          <h1>Thaiba Public School</h1>
          <p>Modern Education with Morality</p>
        </div>
      </div>
      <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" aria-label="${isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}" title="${isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isCollapsed 
            ? '<polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline>' 
            : '<polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline>'}
        </svg>
      </button>
      <button class="sidebar-close-btn" id="sidebar-close-btn" aria-label="Close menu">✕</button>
    </div>

    <!-- Scrollable Nav Body -->
    <nav class="sidebar-nav">
      ${navHtml}
    </nav>

    <!-- Frozen Sidebar Footer -->
    <div class="sidebar-footer">
      ${canSwitchRoles() ? `
        <!-- Developing Window / Role Switcher for Super Admin -->
        <div class="sidebar-role-preview">
          <div class="sidebar-role-header">
            <span class="sidebar-role-title">Role View</span>
            <span class="sidebar-role-badge">Dev Mode</span>
          </div>
          <select id="sidebar-role-selector" class="form-control" style="width: 100%; cursor: pointer;">
            <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="boys_mentor" ${user?.role === 'boys_mentor' ? 'selected' : ''}>Boys Hostel Mentor</option>
            <option value="girls_mentor" ${user?.role === 'girls_mentor' ? 'selected' : ''}>Girls Hostel Mentor</option>
            <option value="teacher" ${user?.role === 'teacher' ? 'selected' : ''}>Teacher</option>
            <option value="mentor" ${user?.role === 'mentor' ? 'selected' : ''}>Hostel Mentor (General)</option>
            <option value="parent" ${user?.role === 'parent' ? 'selected' : ''}>Parent</option>
            <option value="student" ${user?.role === 'student' ? 'selected' : ''}>Student</option>
            <option value="hostel_leader" ${user?.role === 'hostel_leader' ? 'selected' : ''}>Hostel Leader</option>
            <option value="vehicle_user" ${user?.role === 'vehicle_user' ? 'selected' : ''}>Vehicle User (Driver / Staff)</option>
          </select>
        </div>
      ` : ''}

      <button class="sidebar-logout-btn" id="sidebar-logout-btn" title="Sign Out" data-tooltip="Sign Out">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        <span class="sidebar-logout-label">Sign Out</span>
      </button>

      <button class="sidebar-footer-collapse-btn" id="sidebar-footer-collapse-btn" title="${isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}" data-tooltip="${isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isCollapsed 
            ? '<polyline points="9 18 15 12 9 6"></polyline>' 
            : '<polyline points="15 18 9 12 15 6"></polyline>'}
        </svg>
        <span class="sidebar-collapse-label">${isCollapsed ? 'Expand' : 'Collapse'}</span>
      </button>
    </div>
  `;

  // Attach navigation listeners
  container.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const mod = item.getAttribute('data-module');
      if (mod) {
        onNavigate(mod);
        if (onCloseMobile) onCloseMobile();
      }
    });
  });

  container.querySelector('#sidebar-collapse-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onToggleCollapse) onToggleCollapse();
  });

  container.querySelector('#sidebar-footer-collapse-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onToggleCollapse) onToggleCollapse();
  });

  container.querySelector('#sidebar-brand-link')?.addEventListener('click', () => {
    if (isCollapsed) {
      if (onToggleCollapse) onToggleCollapse();
    } else {
      onNavigate('dashboard');
      if (onCloseMobile) onCloseMobile();
    }
  });

  container.querySelector('#sidebar-close-btn')?.addEventListener('click', onCloseMobile);

  container.querySelector('#sidebar-role-selector')?.addEventListener('change', (e) => {
    switchDevRole(e.target.value);
  });

  container.querySelector('#sidebar-logout-btn')?.addEventListener('click', () => {
    signOut();
  });
}

function getIconSvg(name) {
  const icons = {
    'layout-dashboard': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    'shield-check': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>',
    'user-plus': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>',
    'users': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'folder-tree': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0-1.1-.9-2-2-2h-6.2a2 2 0 0 1-1.6-.8L9.4 6H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-4"/></svg>',
    'user-check': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
    'calendar-clock': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><circle cx="16" cy="16" r="6"/><polyline points="16 14 16 16 18 17"/></svg>',
    'calendar': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'calendar-check': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>',
    'check-square': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    'clipboard-check': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>',
    'plane-takeoff': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
    'id-card': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4"/><path d="M14 14h3"/><path d="M5.5 17a2.5 2.5 0 0 1 5 0"/></svg>',
    'receipt': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v.5"/><path d="M12 6v.5"/></svg>',
    'alert-triangle': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'shield-alert': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    'file-text': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>',
    'award': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
    'bed': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    'credit-card': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    'bell': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    'wrench': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    'bar-chart-3': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    'history': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    'settings': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    'truck': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    'car': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>'
  };

  return icons[name] || '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
}
