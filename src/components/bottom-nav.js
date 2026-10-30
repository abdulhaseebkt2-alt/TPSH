import { canAccessModule } from '../lib/permissions.js';

/**
 * Mobile Bottom Navigation Component
 * Provides role-scoped accessible windows for every mobile user,
 * stretching edge-to-edge across the bottom of the viewport.
 */
export function getBottomNavItems(profile) {
  const safeProfile = { approval_status: 'approved', ...profile };
  const role = safeProfile?.role || 'admin';
  const isSuperAdmin = safeProfile?.is_super_admin === true;

  let candidates = [];

  if (isSuperAdmin || role === 'super_admin' || role === 'admin') {
    candidates = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'timetable', label: 'Schedule', icon: 'schedule' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'attendance_report', label: 'Reports', icon: 'reports' },
      { key: 'settings', label: 'Settings', icon: 'settings' }
    ];
  } else if (role === 'teacher') {
    candidates = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'timetable', label: 'Schedule', icon: 'schedule' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'attendance_report', label: 'Reports', icon: 'reports' },
      { key: 'marks', label: 'Marks', icon: 'marks' }
    ];
  } else if (role === 'mentor' || role === 'boys_mentor' || role === 'girls_mentor' || role === 'hostel_leader') {
    candidates = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'leaves', label: 'Gate Pass', icon: 'leaves' },
      { key: 'hostel', label: 'Hostel', icon: 'hostel' },
      { key: 'discipline', label: 'Discipline', icon: 'discipline' }
    ];
  } else if (role === 'parent') {
    candidates = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'leaves', label: 'Leaves', icon: 'leaves' },
      { key: 'marks', label: 'Marks', icon: 'marks' },
      { key: 'fees', label: 'Fees', icon: 'fees' }
    ];
  } else if (role === 'student') {
    candidates = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'leaves', label: 'Leave Pass', icon: 'leaves' },
      { key: 'marks', label: 'Marks', icon: 'marks' },
      { key: 'exams', label: 'Exams', icon: 'exams' }
    ];
  } else {
    candidates = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'leaves', label: 'Leaves', icon: 'leaves' },
      { key: 'notices', label: 'Notices', icon: 'notices' }
    ];
  }

  // Filter candidate buttons by user permissions
  const accessible = candidates.filter(item => canAccessModule(safeProfile, item.key));

  // If fewer than 5 items, top up with other accessible modules
  if (accessible.length < 5) {
    const allFallbacks = [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'timetable', label: 'Schedule', icon: 'schedule' },
      { key: 'attendance', label: 'Attendance', icon: 'attendance' },
      { key: 'attendance_report', label: 'Reports', icon: 'reports' },
      { key: 'leaves', label: 'Leaves', icon: 'leaves' },
      { key: 'marks', label: 'Marks', icon: 'marks' },
      { key: 'exams', label: 'Exams', icon: 'exams' },
      { key: 'notices', label: 'Notices', icon: 'notices' },
      { key: 'settings', label: 'Settings', icon: 'settings' }
    ];
    for (const fb of allFallbacks) {
      if (accessible.length >= 5) break;
      if (!accessible.some(a => a.key === fb.key) && canAccessModule(safeProfile, fb.key)) {
        accessible.push(fb);
      }
    }
  }

  return accessible.slice(0, 5);
}

function getIconSvg(type) {
  switch (type) {
    case 'home':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
    case 'schedule':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
    case 'attendance':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;
    case 'reports':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
    case 'settings':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    case 'marks':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`;
    case 'exams':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    case 'leaves':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    case 'hostel':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path></svg>`;
    case 'discipline':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    case 'fees':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
    case 'notices':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    default:
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle></svg>`;
  }
}

export function renderBottomNav(container, { profile, activeModule = 'dashboard', onNavigate }) {
  if (!container) return;

  const items = getBottomNavItems(profile);

  container.innerHTML = items.map(item => {
    const isActive = activeModule === item.key;
    return `
      <button class="m-nav-pill-btn ${isActive ? 'active' : ''}" data-nav="${item.key}" type="button" title="${item.label}">
        <span class="m-nav-icon-wrap">
          ${getIconSvg(item.icon)}
        </span>
        <span>${item.label}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.m-nav-pill-btn[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      if (target && onNavigate) {
        onNavigate(target);
      }
    });
  });
}
