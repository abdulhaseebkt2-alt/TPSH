import { getCurrentUser, switchDevRole, canSwitchRoles } from '../lib/auth.js';
import { openProfileModal } from './profile-modal.js';

const ROLE_POSITION_TITLES = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  mentor: 'Hostel Mentor',
  parent: 'Parent',
  student: 'Student',
  hostel_leader: 'Hostel Leader'
};

export function renderNavbar(container, { onToggleSidebar, onNavigate }) {
  const user = getCurrentUser();
  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayPosition = (user?.role && ROLE_POSITION_TITLES[user.role])
    ? ROLE_POSITION_TITLES[user.role]
    : (user?.is_super_admin ? 'Super Admin' : (user?.role || 'User').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));

  const avatarLetter = (displayName || 'U')[0].toUpperCase();

  container.innerHTML = `
    <header class="navbar">
      <div class="navbar-left">
        <button class="menu-toggle-btn" id="menu-toggle" aria-label="Toggle navigation">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="navbar-portal-badge">
          <span class="portal-badge-title">TPS Hostel ERP</span>
          <span class="portal-badge-tagline">• Integrated Institutional Portal</span>
        </div>
      </div>

      <div class="navbar-right">
        ${canSwitchRoles() ? `
          <div class="navbar-role-switcher" style="display: flex; align-items: center; gap: 0.45rem; background: #F8FAFC; padding: 4px 10px; border-radius: var(--radius-md); border: 1.5px solid #CBD5E1;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span style="font-size: 0.7rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em;">Role View:</span>
            <select id="navbar-role-selector" style="border: none; background: transparent; font-size: 0.8rem; font-weight: 700; color: #0F172A; cursor: pointer; outline: none;">
              <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="teacher" ${user?.role === 'teacher' ? 'selected' : ''}>Teacher</option>
              <option value="mentor" ${user?.role === 'mentor' ? 'selected' : ''}>Hostel Mentor</option>
              <option value="parent" ${user?.role === 'parent' ? 'selected' : ''}>Parent</option>
              <option value="student" ${user?.role === 'student' ? 'selected' : ''}>Student</option>
              <option value="hostel_leader" ${user?.role === 'hostel_leader' ? 'selected' : ''}>Hostel Leader</option>
            </select>
          </div>
        ` : ''}

        <!-- Profile Widget: Name & Position before Photo -->
        <div class="user-profile-widget" id="user-profile-btn" style="cursor: pointer;" title="Click to view & edit your institutional profile">
          <div class="user-meta">
            <span class="user-name">${displayName}</span>
            <span class="user-role-caption">${displayPosition}</span>
          </div>
          <div class="user-avatar" style="overflow: hidden;">
            ${user?.avatar_url ? `<img src="${user.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Avatar" />` : avatarLetter}
          </div>
        </div>
      </div>
    </header>
  `;

  container.querySelector('#menu-toggle')?.addEventListener('click', onToggleSidebar);

  container.querySelector('#navbar-role-selector')?.addEventListener('change', (e) => {
    switchDevRole(e.target.value);
  });

  // Open Institutional Profile Window when clicking the avatar / profile widget
  container.querySelector('#user-profile-btn')?.addEventListener('click', () => {
    openProfileModal({
      profile: getCurrentUser(),
      isInitialSetup: false,
      onSaved: () => {
        renderNavbar(container, { onToggleSidebar, onNavigate });
      }
    });
  });
}
