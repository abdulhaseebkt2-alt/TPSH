import { getCurrentUser } from '../lib/auth.js';
import { openProfileModal } from './profile-modal.js';
import { db } from '../lib/db.js';
import { toast } from '../lib/toast.js';
import { triggerHaptic } from '../lib/native-bridge.js';

const ROLE_POSITION_TITLES = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  boys_mentor: 'Boys Hostel Mentor',
  girls_mentor: 'Girls Hostel Mentor',
  teacher: 'Teacher',
  mentor: 'Hostel Mentor',
  parent: 'Parent',
  student: 'Student',
  hostel_leader: 'Hostel Leader',
  vehicle_head: 'Vehicle Department Head',
  vehicle_user: 'Driver / Staff'
};

export function renderNavbar(container, { onToggleSidebar, onNavigate }) {
  const user = getCurrentUser();
  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayPosition = (user?.role && ROLE_POSITION_TITLES[user.role])
    ? ROLE_POSITION_TITLES[user.role]
    : (user?.is_super_admin ? 'Super Admin' : (user?.role || 'User').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));

  const avatarLetter = (displayName || 'U')[0].toUpperCase();
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  const outbox = db.getOfflineOutbox ? db.getOfflineOutbox() : [];
  const pendingCount = outbox.length;

  container.innerHTML = `
    <header class="navbar">
      <div class="navbar-left">
        <button class="menu-toggle-btn" id="menu-toggle" aria-label="Toggle navigation" title="Toggle Sidebar (Ctrl+B)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="navbar-portal-badge">
          <span class="portal-badge-title">TPS Hostel ERP</span>
          <span class="portal-badge-tagline">• Integrated Institutional Portal</span>
        </div>
      </div>

      <div class="navbar-right">
        <!-- Live Native Connectivity & Outbox Island Pill -->
        <button type="button" class="navbar-status-pill ${!isOnline ? 'is-offline' : (pendingCount > 0 ? 'is-pending' : 'is-online')}" id="nav-island-pill" title="Tap to check connection & sync outbox">
          <span class="status-pulse-dot"></span>
          <span class="status-pill-text">
            ${!isOnline ? 'Offline' : (pendingCount > 0 ? `${pendingCount} Pending` : 'Online')}
          </span>
        </button>

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

  // Live Connectivity Island Pill Trigger
  container.querySelector('#nav-island-pill')?.addEventListener('click', async () => {
    triggerHaptic('light').catch(() => {});
    const nowOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const currentOutbox = db.getOfflineOutbox ? db.getOfflineOutbox() : [];
    if (!nowOnline) {
      toast.info(`📶 Offline Mode: ${currentOutbox.length} record(s) pending sync safely stored on device.`);
    } else if (currentOutbox.length > 0) {
      toast.info(`🔄 Syncing ${currentOutbox.length} pending offline record(s) to cloud...`);
      await db.flushOfflineOutbox();
      toast.success('Sync complete! All device records updated to cloud.');
      renderNavbar(container, { onToggleSidebar, onNavigate });
    } else {
      toast.success('🟢 Device connected and fully synchronized with Supabase.');
    }
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
