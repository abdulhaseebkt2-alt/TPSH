import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog, openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { openProfileModal } from '../../components/profile-modal.js';
import { 
  getRBACMatrix, 
  saveRBACMatrix, 
  resetRBACMatrix, 
  normalizeRBACMatrix,
  getUserCustomPermissions,
  saveUserCustomPermissions,
  clearUserCustomPermissions,
  MODULE_DEFINITIONS 
} from '../../lib/permissions.js';

// Module-level preserved tab state so user never loses their active view
let savedUsersTab = null;
let savedActiveRbacRole = 'teacher';

export const RBAC_ROLES = [
  {
    key: 'admin',
    label: 'Master Admin',
    subtitle: 'Academic & Records Governance',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`
  },
  {
    key: 'teacher',
    label: 'Teacher / Faculty',
    subtitle: 'Timetable, Attendance & Marks',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`
  },
  {
    key: 'mentor',
    label: 'Hostel Mentor',
    subtitle: 'Hostel Operations, Leaves & Welfare',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  },
  {
    key: 'hostel_leader',
    label: 'Hostel Leader',
    subtitle: 'Peer Roll-Call & Room Monitoring',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  },
  {
    key: 'parent',
    label: 'Parents',
    subtitle: 'Ward Academic, Attendance & Fees',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
  },
  {
    key: 'student',
    label: 'Students',
    subtitle: 'Personal Attendance & Study Portal',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`
  }
];

export const RBAC_ROLE_THEMES = {
  admin: { color: '#059669', light: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeColor: '#065F46' },
  teacher: { color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE', badgeBg: '#DBEAFE', badgeColor: '#1E40AF' },
  mentor: { color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE', badgeBg: '#EDE9FE', badgeColor: '#5B21B6' },
  hostel_leader: { color: '#D97706', light: '#FFFBEB', border: '#FDE68A', badgeBg: '#FEF3C7', badgeColor: '#92400E' },
  parent: { color: '#E11D48', light: '#FFF1F2', border: '#FECDD3', badgeBg: '#FFE4E6', badgeColor: '#9F1239' },
  student: { color: '#0891B2', light: '#ECFEFF', border: '#A5F3FC', badgeBg: '#CFFAFE', badgeColor: '#155E75' }
};

export const RBAC_WINDOW_GROUPS = [
  {
    title: 'Student & Academic Windows',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    modules: [
      {
        key: 'timetable',
        label: 'Teacher Timetable',
        desc: 'View assigned class schedules and coaching periods',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
      },
      {
        key: 'attendance',
        label: 'Attendance Management',
        desc: 'Daily classroom roll-call, coaching & teacher duty register',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
      },
      {
        key: 'exams',
        label: 'Exam Management',
        desc: 'Examination dates, syllabi, seating arrangements & timings',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
      },
      {
        key: 'marks',
        label: 'Marks & Results',
        desc: 'Enter subject marks, grade calculation and official report cards',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`
      },
      {
        key: 'admissions',
        label: 'Student Admissions',
        desc: 'Process new student admission forms, parents data & documents',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y1="11"/></svg>`
      },
      {
        key: 'students',
        label: 'Student Directory',
        desc: 'Browse complete student directory, guardian contacts & history',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
      },
      {
        key: 'sections',
        label: 'Sections & Classrooms',
        desc: 'Manage classrooms, standards, and batch divisions',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
      },
      {
        key: 'assignments',
        label: 'Student Assignments',
        desc: 'Review hostel coaching homework and assign academic tasks',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`
      }
    ]
  },
  {
    title: 'Hostel Operations Windows',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    modules: [
      {
        key: 'leaves',
        label: 'Hostel Leave Register',
        desc: 'Request, approve & record student leaves, departures & returns',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>`
      },
      {
        key: 'fines',
        label: 'Late Fine Management',
        desc: 'Track ₹200/day delay penalties and fine collections',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
      },
      {
        key: 'discipline',
        label: 'Discipline & Black Marks',
        desc: 'Log behavioural infractions, demerits, and warnings',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
      },
      {
        key: 'hostel',
        label: 'Hostel Rooms & Beds',
        desc: 'Dormitory room layout, bunk beds & student room allocations',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`
      },
      {
        key: 'maintenance',
        label: 'Hostel Maintenance',
        desc: 'Submit and track hostel repairs, electrical & plumbing issues',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
      }
    ]
  },
  {
    title: 'Administration & Communication Windows',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    modules: [
      {
        key: 'notices',
        label: 'Notices & WhatsApp',
        desc: 'Send school notifications, reminders and circulars',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`
      },
      {
        key: 'fees',
        label: 'Fees & Payments',
        desc: 'Monitor student fee balances and collect payments',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`
      },
      {
        key: 'reports',
        label: 'Reports Center',
        desc: 'Generate monthly attendance and fine register reports',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
      },
      {
        key: 'settings',
        label: 'Institution Settings',
        desc: 'Configure institutional details, logo, and fine rates',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
      }
    ]
  }
];

export async function renderUsersModule(container, { onNavigate, initialTab } = {}) {
  const currentUser = getCurrentUser();
  if (!currentUser?.is_super_admin && currentUser?.role !== 'super_admin') {
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon" style="color: #DC2626;">✕</div>
        <h4>Access Restricted</h4>
        <p>Only the verified Initial Super Admin has institutional authorization to access User & Permission Management.</p>
      </div>
    `;
    return;
  }

  const users = await db.getUsers();
  const pendingUsers = users.filter(u => u.approval_status === 'pending');
  const activeUsers = users.filter(u => u.approval_status === 'approved');
  const suspendedUsers = users.filter(u => u.approval_status === 'suspended');

  // Determine active tab: respect explicit parameter, saved state, or pending queue
  let activeTab = initialTab || savedUsersTab || (pendingUsers.length > 0 ? 'pending' : 'active');
  savedUsersTab = activeTab;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>User Accounts & Permissions</h2>
        <p>Institutional identity governance, pending approval queue, and role window assignment</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-create-invitation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x1="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          Pre-Authorize Email
        </button>
      </div>
    </div>

    <!-- Pending Approvals Alert Banner -->
    ${pendingUsers.length > 0 ? `
      <div class="users-pending-alert-banner" style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 20px;">⚠️</span>
          <div>
            <strong style="color: #B45309;">${pendingUsers.length} Account(s) Awaiting Approval</strong>
            <p style="font-size: 0.8rem; color: #92400E; margin-top: 0.1rem;">These users have authenticated with Google but are blocked from accessing school data until reviewed.</p>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Tabs: Pending Approvals, Active Accounts, Suspended Accounts & Assign Windows (RBAC) -->
    <div class="card-panel">
      <div class="card-panel-header" style="padding: 0.75rem 1rem;">
        <div class="user-sub-tabs-bar">
          <button class="btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-pending-btn">
            <span class="tab-label-full">Pending Approvals (${pendingUsers.length})</span>
            <span class="tab-label-short">Pending (${pendingUsers.length})</span>
          </button>
          <button class="btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-active-btn">
            <span class="tab-label-full">Active Accounts (${activeUsers.length})</span>
            <span class="tab-label-short">Active (${activeUsers.length})</span>
          </button>
          <button class="btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-suspended-btn">
            <span class="tab-label-full">Suspended Accounts (${suspendedUsers.length})</span>
            <span class="tab-label-short">Suspended (${suspendedUsers.length})</span>
          </button>
          <button class="btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-rbac-btn" style="display: flex; align-items: center; gap: 0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span class="tab-label-full">Assign Windows (RBAC)</span>
            <span class="tab-label-short">RBAC</span>
          </button>
        </div>
      </div>
      <div class="card-panel-body" style="padding: 0;" id="users-tab-content">
        <!-- Rendered via sub-functions -->
      </div>
    </div>
  `;

  function updateTabButtons() {
    const pendingBtn = container.querySelector('#tab-pending-btn');
    const activeBtn = container.querySelector('#tab-active-btn');
    const suspendedBtn = container.querySelector('#tab-suspended-btn');
    const rbacBtn = container.querySelector('#tab-rbac-btn');

    if (pendingBtn) pendingBtn.className = `btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    if (activeBtn) activeBtn.className = `btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    if (suspendedBtn) suspendedBtn.className = `btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    if (rbacBtn) rbacBtn.className = `btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'} btn-sm`;
  }

  function renderTabContent() {
    const tabContent = container.querySelector('#users-tab-content');
    if (!tabContent) return;

    if (activeTab === 'rbac') {
      renderSimpleRBACView(tabContent);
      return;
    }

    if (activeTab === 'pending') {
      if (pendingUsers.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✓</div>
            <h4>Queue Clear</h4>
            <p>There are no pending user authorization requests at this time.</p>
          </div>
        `;
        return;
      }

      tabContent.innerHTML = `
        <!-- Desktop Table View -->
        <div class="desktop-user-table table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pendingUsers.map(u => `
                <tr>
                  <td>
                    <strong>${u.full_name || 'Pending User'}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${u.phone_number || 'No phone recorded'}</div>
                  </td>
                  <td>${u.email}</td>
                  <td><span class="badge badge-leave">Pending Approval</span></td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      <button class="btn btn-sm btn-primary btn-approve" data-id="${u.id}" data-email="${u.email}" data-role="${u.role || 'teacher'}">Approve & Assign Role</button>
                      <button class="btn btn-sm btn-outline btn-reject" data-id="${u.id}" style="color: #DC2626; border-color: #FECACA;">Reject</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile Responsive Cards View -->
        <div class="mobile-user-cards">
          ${pendingUsers.map(u => `
            <div class="user-card-item">
              <div class="user-card-header">
                <div class="user-card-avatar-col">
                  <div class="user-avatar" style="width: 40px; height: 40px; font-size: 14px; font-weight: 700; border-radius: 10px;">
                    ${(u.full_name || 'P')[0].toUpperCase()}
                  </div>
                </div>
                <div class="user-card-info-col">
                  <div class="user-card-name-row">
                    <span class="user-card-name">${u.full_name || 'Pending Applicant'}</span>
                  </div>
                  <div class="user-card-meta-row">
                    <span class="badge badge-leave" style="font-size: 0.68rem; padding: 0.15rem 0.45rem; font-weight: 700;">
                      Awaiting Review
                    </span>
                  </div>
                </div>
              </div>

              <div class="user-card-contact">
                <div class="user-card-contact-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span class="user-card-email-text">${u.email}</span>
                </div>
                ${u.phone_number ? `
                  <div class="user-card-contact-item" style="color: var(--text-muted);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>${u.phone_number}</span>
                  </div>
                ` : `
                  <div class="user-card-contact-item" style="color: var(--text-muted); font-size: 0.72rem;">
                    <span>No phone recorded</span>
                  </div>
                `}
              </div>

              <div class="user-card-actions" style="grid-template-columns: 1fr 1fr;">
                <button class="btn btn-sm btn-primary btn-approve" data-id="${u.id}" data-email="${u.email}" data-role="${u.role || 'teacher'}" style="font-weight: 700;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Approve & Role
                </button>
                <button class="btn btn-sm btn-outline btn-reject" data-id="${u.id}" style="color: #DC2626; border-color: #FECACA;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Reject
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      tabContent.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const email = btn.getAttribute('data-email');
          const currentRole = btn.getAttribute('data-role');
          showApprovalModal(id, email, currentRole);
        });
      });

      tabContent.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const confirmed = await confirmDialog({
            title: 'Reject User Application',
            message: 'Are you sure you want to reject this authorization request?',
            confirmText: 'Reject Application',
            isDanger: true
          });
          if (confirmed) {
            await db.updateUserApproval(id, { approval_status: 'rejected' });
            toast.info('User application marked as rejected.');
            savedUsersTab = 'pending';
            renderUsersModule(container, { onNavigate });
          }
        });
      });
    }

    if (activeTab === 'suspended') {
      if (suspendedUsers.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✓</div>
            <h4>No Suspended Accounts</h4>
            <p>All institutional accounts are in good standing.</p>
          </div>
        `;
        return;
      }

      tabContent.innerHTML = `
        <!-- Desktop Table View -->
        <div class="desktop-user-table table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${suspendedUsers.map(u => `
                <tr>
                  <td>
                    <strong>${u.full_name || 'User'}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${u.phone_number || 'No phone'}</div>
                  </td>
                  <td><span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 700;">${(u.role || 'Staff').toUpperCase()}</span></td>
                  <td>${u.email}</td>
                  <td><span class="badge badge-absent">Suspended</span></td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      <button class="btn btn-sm btn-outline btn-reactivate" data-id="${u.id}" style="color: #059669; border-color: #A7F3D0;">Reactivate</button>
                      <button class="btn btn-sm btn-outline btn-profile" data-id="${u.id}">Profile</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile Responsive Cards View -->
        <div class="mobile-user-cards">
          ${suspendedUsers.map(u => `
            <div class="user-card-item">
              <div class="user-card-header">
                <div class="user-card-avatar-col">
                  <div class="user-avatar" style="width: 40px; height: 40px; font-size: 14px; font-weight: 700; border-radius: 10px;">
                    ${(u.full_name || 'U')[0].toUpperCase()}
                  </div>
                </div>
                <div class="user-card-info-col">
                  <div class="user-card-name-row">
                    <span class="user-card-name">${u.full_name || 'User'}</span>
                  </div>
                  <div class="user-card-meta-row">
                    <span class="badge" style="background: #F1F5F9; color: #475569; font-size: 0.68rem; padding: 0.15rem 0.45rem; font-weight: 700;">
                      ${(u.role || 'Staff').toUpperCase()}
                    </span>
                    <span class="badge badge-absent" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">
                      Suspended
                    </span>
                  </div>
                </div>
              </div>

              <div class="user-card-contact">
                <div class="user-card-contact-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span class="user-card-email-text">${u.email}</span>
                </div>
                ${u.phone_number ? `
                  <div class="user-card-contact-item" style="color: var(--text-muted);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>${u.phone_number}</span>
                  </div>
                ` : ''}
              </div>

              <div class="user-card-actions" style="grid-template-columns: 1fr 1fr;">
                <button class="btn btn-sm btn-outline btn-reactivate" data-id="${u.id}" style="color: #059669; border-color: #A7F3D0; font-weight: 600;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Reactivate
                </button>
                <button class="btn btn-sm btn-outline btn-profile" data-id="${u.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      tabContent.querySelectorAll('.btn-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = suspendedUsers.find(item => item.id === id);
          if (u) {
            openProfileModal({
              profile: u,
              isInitialSetup: false,
              onSaved: () => renderUsersModule(container, { onNavigate })
            });
          }
        });
      });

      tabContent.querySelectorAll('.btn-reactivate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const confirmed = await confirmDialog({
            title: 'Reactivate Account',
            message: 'Are you sure you want to restore active institutional access for this account?',
            confirmText: 'Reactivate Account'
          });
          if (confirmed) {
            await db.updateUserApproval(id, { approval_status: 'approved' });
            toast.success('Account reactivated successfully.');
            savedUsersTab = 'suspended';
            renderUsersModule(container, { onNavigate });
          }
        });
      });
    }

    if (activeTab === 'active') {
      tabContent.innerHTML = `
        <!-- Desktop Table View -->
        <div class="desktop-user-table table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${activeUsers.map(u => {
                const userCustom = getUserCustomPermissions(u.id);
                const hasCustom = Boolean(userCustom && Object.keys(userCustom).length > 0);
                return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div class="user-avatar" style="width: 32px; height: 32px; font-size: 12px;">
                        ${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="" />` : (u.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <strong>${u.full_name || 'User'}</strong>
                        ${u.is_super_admin ? `<span class="badge" style="background: #0F172A; color: #FFFFFF; font-size: 0.65rem; margin-left: 0.35rem;">SUPER ADMIN</span>` : ''}
                        ${hasCustom ? `<span class="badge" style="background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; margin-left: 0.35rem; font-weight: 700;">CUSTOM PERMS</span>` : ''}
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${u.phone_number || 'No phone recorded'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge ${u.is_super_admin ? 'badge-present' : 'badge-leave'}" style="font-weight: 700;">
                      ${(u.role || 'Staff').toUpperCase()}
                    </span>
                  </td>
                  <td>${u.email}</td>
                  <td><span class="badge badge-present">Active</span></td>
                  <td>
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
                      ${!u.is_super_admin ? `
                        <button class="btn btn-sm btn-outline btn-change-role" data-id="${u.id}" data-email="${u.email}" data-role="${u.role || 'teacher'}">Role</button>
                        <button class="btn btn-sm ${hasCustom ? 'btn-primary' : 'btn-outline'} btn-custom-perm" data-id="${u.id}" style="${hasCustom ? 'box-shadow: 0 1px 4px rgba(16,185,129,0.3);' : 'color: #059669; border-color: #A7F3D0;'}" title="Customize specific window access for ${u.full_name || u.email}">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                          Permissions
                        </button>
                      ` : ''}
                      <button class="btn btn-sm btn-outline btn-profile" data-id="${u.id}">Profile</button>
                      ${!u.is_super_admin ? `
                        <button class="btn btn-sm btn-outline btn-suspend" data-id="${u.id}" style="color: #DC2626; border-color: #FECACA;">Suspend</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile Responsive Cards View -->
        <div class="mobile-user-cards">
          ${activeUsers.map(u => {
            const userCustom = getUserCustomPermissions(u.id);
            const hasCustom = Boolean(userCustom && Object.keys(userCustom).length > 0);
            return `
            <div class="user-card-item">
              <div class="user-card-header">
                <div class="user-card-avatar-col">
                  <div class="user-avatar" style="width: 40px; height: 40px; font-size: 14px; font-weight: 700; border-radius: 10px;">
                    ${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;" alt="" />` : (u.full_name || 'U')[0].toUpperCase()}
                  </div>
                </div>
                <div class="user-card-info-col">
                  <div class="user-card-name-row">
                    <span class="user-card-name">${u.full_name || 'User'}</span>
                    ${u.is_super_admin ? `<span class="badge" style="background: #0F172A; color: #FFFFFF; font-size: 0.62rem; padding: 0.15rem 0.4rem; font-weight: 700;">SUPER ADMIN</span>` : ''}
                    ${hasCustom ? `<span class="badge" style="background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.62rem; padding: 0.15rem 0.4rem; font-weight: 700;">CUSTOM PERMS</span>` : ''}
                  </div>
                  <div class="user-card-meta-row">
                    <span class="badge ${u.is_super_admin ? 'badge-present' : 'badge-leave'}" style="font-size: 0.68rem; padding: 0.15rem 0.45rem; font-weight: 700;">
                      ${(u.role || 'Staff').toUpperCase()}
                    </span>
                    <span class="user-card-status-dot">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
                      <span style="font-size: 0.74rem; color: #059669; font-weight: 600;">Active</span>
                    </span>
                  </div>
                </div>
              </div>

              <div class="user-card-contact">
                <div class="user-card-contact-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span class="user-card-email-text">${u.email}</span>
                </div>
                ${u.phone_number ? `
                  <div class="user-card-contact-item" style="color: var(--text-muted);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>${u.phone_number}</span>
                  </div>
                ` : `
                  <div class="user-card-contact-item" style="color: var(--text-muted); font-size: 0.72rem;">
                    <span>No phone recorded</span>
                  </div>
                `}
              </div>

              <div class="user-card-actions ${u.is_super_admin ? 'user-card-actions-single' : ''}">
                ${!u.is_super_admin ? `
                  <button class="btn btn-sm btn-outline btn-change-role" data-id="${u.id}" data-email="${u.email}" data-role="${u.role || 'teacher'}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                    Role
                  </button>
                  <button class="btn btn-sm ${hasCustom ? 'btn-primary' : 'btn-outline'} btn-custom-perm" data-id="${u.id}" style="${hasCustom ? 'box-shadow: 0 1px 4px rgba(16,185,129,0.3);' : 'color: #059669; border-color: #A7F3D0; font-weight: 600;'}" title="Customize specific window access for ${u.full_name || u.email}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                    Permissions
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-outline btn-profile" data-id="${u.id}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile
                </button>
                ${!u.is_super_admin ? `
                  <button class="btn btn-sm btn-outline btn-suspend" data-id="${u.id}" style="color: #DC2626; border-color: #FECACA;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    Suspend
                  </button>
                ` : ''}
              </div>
            </div>
          `;
          }).join('')}
        </div>
      `;

      tabContent.querySelectorAll('.btn-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = activeUsers.find(item => item.id === id);
          if (u) {
            openProfileModal({
              profile: u,
              isInitialSetup: false,
              onSaved: () => renderUsersModule(container, { onNavigate })
            });
          }
        });
      });

      tabContent.querySelectorAll('.btn-change-role').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const email = btn.getAttribute('data-email');
          const currentRole = btn.getAttribute('data-role');
          showApprovalModal(id, email, currentRole);
        });
      });

      tabContent.querySelectorAll('.btn-custom-perm').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = activeUsers.find(item => item.id === id);
          if (u) {
            showUserCustomPermissionsModal(u);
          }
        });
      });

      tabContent.querySelectorAll('.btn-suspend').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const u = activeUsers.find(item => item.id === id);
          const confirmed = await confirmDialog({
            title: 'Suspend User Account',
            message: `Suspending this account will immediately revoke all access to student and academic records for ${u?.full_name || u?.email || 'this user'}.`,
            confirmText: 'Suspend Access',
            isDanger: true
          });
          if (confirmed) {
            await db.updateUserApproval(id, { approval_status: 'suspended' });
            toast.info('Account suspended and moved to Suspended Accounts.');
            savedUsersTab = 'active';
            renderUsersModule(container, { onNavigate });
          }
        });
      });
    }
  }

  // ==========================================================
  // MULTI-FUNCTION 3-POSITION WINDOW ASSIGNMENT (RBAC)
  // Left: OFF (Role cannot see window)
  // Middle: VIEW (Explore / View-only, cannot edit or apply)
  // Right: FULL (Full Access to view, create, edit, apply)
  // ==========================================================
  function renderSimpleRBACView(tabContent) {
    let localMatrix = normalizeRBACMatrix(getRBACMatrix());
    let selectedRoleKey = savedActiveRbacRole || 'teacher';

    const ROLES = RBAC_ROLES;
    const WINDOW_GROUPS = RBAC_WINDOW_GROUPS;

    const getLevel = (roleKey, modKey) => {
      const roleMap = localMatrix[roleKey] || {};
      return roleMap[modKey] || 'off';
    };

    const setLevel = (roleKey, modKey, level) => {
      if (!localMatrix[roleKey]) localMatrix[roleKey] = {};
      localMatrix[roleKey][modKey] = level;
      // Always ensure dashboard stays full/common
      localMatrix[roleKey].dashboard = 'full';
    };

    const getRoleCounts = (roleKey) => {
      const roleMap = localMatrix[roleKey] || {};
      let fullCount = 0;
      let viewCount = 0;
      let offCount = 0;
      for (const grp of WINDOW_GROUPS) {
        for (const mod of grp.modules) {
          const lvl = roleMap[mod.key] || 'off';
          if (lvl === 'full') fullCount++;
          else if (lvl === 'view') viewCount++;
          else offCount++;
        }
      }
      return { fullCount, viewCount, offCount };
    };

    function drawSimpleView() {
      const activeRoleObj = ROLES.find(r => r.key === selectedRoleKey) || ROLES[1];
      const activeTheme = RBAC_ROLE_THEMES[selectedRoleKey] || RBAC_ROLE_THEMES.teacher;
      const currCounts = getRoleCounts(selectedRoleKey);

      tabContent.innerHTML = `
        <div class="rbac-container">
          <!-- 1. DESKTOP HEADER (Previous horizontal pills + large active role card with badges, legend & full controls) -->
          <div class="rbac-desktop-header">
            <!-- Top Role Selection Pills -->
            <div style="margin-bottom: 1.5rem;">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
                Select Role to Configure Windows:
              </div>
              <div class="role-pill-nav">
                ${ROLES.map(role => {
                  const counts = getRoleCounts(role.key);
                  const isSelected = role.key === selectedRoleKey;
                  return `
                    <button type="button" class="role-pill-btn ${isSelected ? 'active' : ''}" data-role-key="${role.key}">
                      <span class="role-pill-icon">${role.icon}</span>
                      <span>${role.label}</span>
                      <span class="role-pill-badge" style="font-size: 0.68rem; padding: 0.15rem 0.5rem;">
                        ${counts.fullCount} Full • ${counts.viewCount} View
                      </span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Active Role Header & Switch Legend -->
            <div style="background: #F8FAFC; border: 1.5px solid var(--border-subtle); border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.9rem;">
                <div class="role-avatar-badge">
                  ${activeRoleObj.icon.replace('width="18" height="18"', 'width="24" height="24"')}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0F172A;">${activeRoleObj.label}</h3>
                    <span class="badge badge-present" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">
                      ${currCounts.fullCount} Full Access
                    </span>
                    <span class="badge badge-late" style="font-size: 0.72rem; padding: 0.2rem 0.6rem; background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A;">
                      ${currCounts.viewCount} View Only
                    </span>
                    <span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.72rem; padding: 0.2rem 0.6rem;">
                      ${currCounts.offCount} Off
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.85rem; font-size: 0.78rem; color: #64748B; margin-top: 6px; flex-wrap: wrap;">
                    <span>${activeRoleObj.subtitle}</span>
                    <span>•</span>
                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                      <span style="width: 9px; height: 9px; border-radius: 50%; background: #CBD5E1; display: inline-block;"></span>
                      <span>Left: Off</span>
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                      <span style="width: 9px; height: 9px; border-radius: 50%; background: #EAB308; display: inline-block;"></span>
                      <span style="font-weight: 600; color: #854D0E;">Mid: View Only (Yellow)</span>
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                      <span style="width: 9px; height: 9px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
                      <span style="font-weight: 600; color: #065F46;">Right: Full Access (Green)</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Desktop Action Buttons -->
              <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                <button class="btn btn-outline btn-sm btn-role-full-all" title="Grant full access to all windows for this role">
                  Full Access All
                </button>
                <button class="btn btn-outline btn-sm btn-role-view-all" title="Set all windows to Explore / View-only for this role">
                  View Only All
                </button>
                <button class="btn btn-outline btn-sm btn-role-off-all" style="color: #DC2626; border-color: #FECACA;" title="Turn off all windows for this role">
                  Turn Off All
                </button>
                <button class="btn btn-outline btn-sm btn-role-reset" title="Reset this role to default institutional windows">
                  Reset Defaults
                </button>
                <button class="btn btn-primary btn-save-role-matrix" style="font-weight: 700; padding: 0.55rem 1.25rem; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Save Permissions
                </button>
              </div>
            </div>
          </div>

          <!-- 2. MOBILE ROLE SELECTOR: Visible only on mobile <= 768px -->
          <div class="rbac-mobile-toolbar rbac-mobile-role-card">
            <button type="button" class="rbac-mobile-role-trigger" id="rbac-mobile-role-trigger" aria-label="Select role to configure windows">
              <div class="rbac-trigger-left">
                <div class="rbac-trigger-icon" style="background: ${activeTheme.light}; color: ${activeTheme.color}; border: 1.5px solid ${activeTheme.border};">
                  ${activeRoleObj.icon}
                </div>
                <div class="rbac-trigger-text">
                  <span class="rbac-trigger-kicker">CONFIGURING ROLE</span>
                  <div class="rbac-trigger-name-row">
                    <span class="rbac-trigger-name">${activeRoleObj.label}</span>
                    <span class="rbac-trigger-badge" style="background: ${activeTheme.badgeBg}; color: ${activeTheme.badgeColor};">
                      ${activeRoleObj.subtitle.split(',')[0]}
                    </span>
                  </div>
                </div>
              </div>
              <div class="rbac-trigger-right">
                <span class="rbac-trigger-action-pill">
                  <span>Switch</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </div>
            </button>
            <select id="rbac-role-select" style="display: none;" aria-hidden="true">
              ${ROLES.map(role => `<option value="${role.key}" ${role.key === selectedRoleKey ? 'selected' : ''}>${role.label}</option>`).join('')}
            </select>
          </div>

          <!-- Base Navigation Window (Common to All Categories) -->
          <div class="perm-category-card" style="margin-bottom: 1rem;">
            <div class="perm-category-header" style="background: #F8FAFC;">
              <div class="perm-category-title" style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="perm-category-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  </span>
                  <span style="font-weight: 800; color: #0F172A;">Base Institutional Window</span>
                </div>
                <span class="badge badge-active" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">
                  ✓ Common to All Categories (Always Active)
                </span>
              </div>
            </div>
            <div class="perm-grid">
              <div class="perm-item state-full" style="cursor: default;" title="Dedicated category dashboard for ${activeRoleObj.label}">
                <div class="perm-item-left">
                  <div class="perm-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  </div>
                  <div class="perm-item-info">
                    <span class="perm-item-name">Role Dashboard</span>
                    <span class="perm-item-desc">Personalized dashboard tailored for ${activeRoleObj.label} (Always active for all categories)</span>
                  </div>
                </div>
                <div class="perm-switch pos-full" style="pointer-events: none;" title="Always active for all categories"></div>
              </div>
            </div>
          </div>

          <!-- Category Grouped Assignable Windows -->
          ${WINDOW_GROUPS.map(grp => `
            <div class="perm-category-card">
              <div class="perm-category-header">
                <div class="perm-category-title">
                  <span class="perm-category-icon">${grp.icon}</span>
                  <span>${grp.title}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-left: 0.4rem;">
                    (${grp.modules.filter(m => getLevel(selectedRoleKey, m.key) !== 'off').length}/${grp.modules.length} Assigned)
                  </span>
                </div>
              </div>

              <div class="perm-grid">
                ${grp.modules.map(mod => {
                  const level = getLevel(selectedRoleKey, mod.key);
                  return `
                    <div class="perm-item state-${level}" data-mod-key="${mod.key}" data-level="${level}" title="${mod.label} • ${level === 'off' ? 'Off (Click to cycle)' : level === 'view' ? 'View Only (Yellow)' : 'Full Access (Green)'}">
                      <div class="perm-item-left">
                        <div class="perm-item-icon">${mod.icon}</div>
                        <div class="perm-item-info">
                          <span class="perm-item-name">${mod.label}</span>
                          <span class="perm-item-desc">${mod.desc}</span>
                        </div>
                      </div>

                      <!-- 3-Position Old Button (44px x 24px: Off=Gray, View=Yellow, Full=Green) -->
                      <div class="perm-switch pos-${level}" data-mod-key="${mod.key}" role="button" aria-label="${mod.label} Access"></div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}

          <!-- Bottom Action Bar -->
          <div class="rbac-bottom-bar">
            <div class="rbac-bottom-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Tap any window card or switch to cycle: <strong>Off → View Only (Yellow) → Full Access (Green)</strong>.</span>
            </div>
            <button class="btn btn-primary" id="btn-save-role-matrix-bottom" style="font-weight: 700;">
              Save Permissions
            </button>
          </div>
        </div>
      `;

      // Role select dropdown change (for testing / programmatic triggers)
      tabContent.querySelector('#rbac-role-select')?.addEventListener('change', (e) => {
        selectedRoleKey = e.target.value;
        savedActiveRbacRole = selectedRoleKey;
        drawSimpleView();
      });

      // Mobile custom role picker modal
      tabContent.querySelector('#rbac-mobile-role-trigger')?.addEventListener('click', () => {
        openModal({
          title: 'Select Role to Configure',
          modalClass: 'role-picker-modal-dialog',
          contentHtml: `
            <div style="margin-bottom: 0.5rem;">
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.85rem;">
                Select an institutional role to review or assign its accessible windows:
              </p>
              <div class="role-picker-list">
                ${ROLES.map(role => {
                  const theme = RBAC_ROLE_THEMES[role.key] || RBAC_ROLE_THEMES.teacher;
                  const isSelected = role.key === selectedRoleKey;
                  return `
                    <div class="role-picker-item ${isSelected ? 'active' : ''}" data-role-key="${role.key}" role="button" tabindex="0">
                      <div class="role-picker-item-left">
                        <div class="role-picker-item-icon" style="background: ${theme.light}; color: ${theme.color}; border: 1.5px solid ${theme.border};">
                          ${role.icon}
                        </div>
                        <div class="role-picker-item-info">
                          <div class="role-picker-item-title-row">
                            <span class="role-picker-item-name">${role.label}</span>
                            ${isSelected ? `<span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">CURRENT</span>` : ''}
                          </div>
                          <span class="role-picker-item-desc">${role.subtitle}</span>
                        </div>
                      </div>
                      <div class="role-picker-item-radio">
                        <div class="role-radio-circle ${isSelected ? 'active' : ''}">
                          ${isSelected ? `<div class="role-radio-dot"></div>` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `,
          onMount: ({ container: modalBody, close }) => {
            modalBody.querySelectorAll('.role-picker-item').forEach(item => {
              item.addEventListener('click', () => {
                const roleKey = item.getAttribute('data-role-key');
                if (roleKey && roleKey !== selectedRoleKey) {
                  selectedRoleKey = roleKey;
                  savedActiveRbacRole = selectedRoleKey;
                  close();
                  drawSimpleView();
                } else {
                  close();
                }
              });
            });
          }
        });
      });

      // Tapping switch or card cycles through:
      // Once tap -> comes to Middle (View Only, Yellow)
      // Then tap -> comes to Right (Full Access, Green)
      // Then tap -> comes to Left (Off, Gray)
      tabContent.querySelectorAll('.perm-item').forEach(item => {
        item.addEventListener('click', () => {
          const modKey = item.getAttribute('data-mod-key');
          if (!modKey) return;

          const current = getLevel(selectedRoleKey, modKey);
          let next = 'view';
          if (current === 'off') {
            next = 'view';     // 1. Once tap -> comes to middle (View Only, Yellow)
          } else if (current === 'view') {
            next = 'full';     // 2. Then tap -> Full access (Right, Green)
          } else {
            next = 'off';      // 3. Then tap -> Off (Left, Gray)
          }

          setLevel(selectedRoleKey, modKey, next);
          drawSimpleView();
        });
      });

      // Desktop: Role pill click
      tabContent.querySelectorAll('.role-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedRoleKey = btn.getAttribute('data-role-key');
          savedActiveRbacRole = selectedRoleKey;
          drawSimpleView();
        });
      });

      // Full Access All for this role (both desktop & mobile)
      tabContent.querySelectorAll('.btn-role-full-all').forEach(btn => {
        btn.addEventListener('click', () => {
          for (const grp of WINDOW_GROUPS) {
            for (const mod of grp.modules) {
              setLevel(selectedRoleKey, mod.key, 'full');
            }
          }
          drawSimpleView();
        });
      });

      // View Only All for this role (both desktop & mobile)
      tabContent.querySelectorAll('.btn-role-view-all').forEach(btn => {
        btn.addEventListener('click', () => {
          for (const grp of WINDOW_GROUPS) {
            for (const mod of grp.modules) {
              setLevel(selectedRoleKey, mod.key, 'view');
            }
          }
          drawSimpleView();
        });
      });

      // Turn Off All for this role (both desktop & mobile)
      tabContent.querySelectorAll('.btn-role-off-all').forEach(btn => {
        btn.addEventListener('click', () => {
          for (const grp of WINDOW_GROUPS) {
            for (const mod of grp.modules) {
              setLevel(selectedRoleKey, mod.key, 'off');
            }
          }
          drawSimpleView();
        });
      });

      // Reset Defaults for this role (both desktop & mobile)
      tabContent.querySelectorAll('.btn-role-reset').forEach(btn => {
        btn.addEventListener('click', async () => {
          const confirmed = await confirmDialog({
            title: 'Reset Role Windows',
            message: `Restore default institutional window assignments for ${activeRoleObj.label}?`,
            confirmText: 'Restore Defaults'
          });
          if (confirmed) {
            const freshDefaults = resetRBACMatrix();
            localMatrix[selectedRoleKey] = { ...(freshDefaults[selectedRoleKey] || {}) };
            drawSimpleView();
            toast.info(`Restored default windows for ${activeRoleObj.label}.`);
          }
        });
      });

      // Save handlers (both desktop & mobile)
      const handleSave = () => {
        saveRBACMatrix(localMatrix);
        db.logAudit('UPDATE_RBAC_MATRIX', 'permissions', selectedRoleKey, `Updated window permissions for ${activeRoleObj.label}`);
        toast.success(`Saved! Window permissions updated for ${activeRoleObj.label}.`);
        window.dispatchEvent(new Event('tps:permissions-updated'));
        drawSimpleView();
      };

      tabContent.querySelectorAll('.btn-save-role-matrix').forEach(btn => {
        btn.addEventListener('click', handleSave);
      });
      tabContent.querySelector('#btn-save-role-matrix-bottom')?.addEventListener('click', handleSave);
    }

    drawSimpleView();
  }

  function showUserCustomPermissionsModal(targetUser) {
    const roleKey = targetUser.role || 'teacher';
    const roleObj = RBAC_ROLES.find(r => r.key === roleKey) || RBAC_ROLES[1];
    const roleMatrix = (getRBACMatrix()[roleKey]) || {};

    // Get current custom overrides
    let userOverrides = { ...(getUserCustomPermissions(targetUser.id) || {}) };

    const getEffectiveLevel = (modKey) => {
      if (userOverrides[modKey] !== undefined) return userOverrides[modKey];
      return roleMatrix[modKey] || 'off';
    };

    openModal({
      title: `Customize Window Permissions: ${targetUser.full_name || targetUser.email}`,
      contentHtml: `
        <div style="margin-bottom: 1.25rem;">
          <!-- User Info Banner -->
          <div style="background: #F8FAFC; border: 1.5px solid var(--border-subtle); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="user-avatar" style="width: 38px; height: 38px; font-size: 14px;">
                ${targetUser.avatar_url ? `<img src="${targetUser.avatar_url}" style="width:100%;height:100%;object-fit:cover;" alt=""/>` : (targetUser.full_name || 'U')[0].toUpperCase()}
              </div>
              <div>
                <strong style="font-size: 0.95rem; color: #0F172A;">${targetUser.full_name || 'User'}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${targetUser.email} • Role: <span class="badge badge-present" style="font-weight: 700;">${(targetUser.role || 'Staff').toUpperCase()}</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-outline btn-xs" id="btn-modal-reset-defaults" style="color: #475569;" title="Reset this user's windows back to ${roleObj.label} defaults">
                Reset to Role Defaults
              </button>
            </div>
          </div>

          <!-- Description Hint Banner -->
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 0.7rem 0.9rem; font-size: 0.8rem; color: #1E40AF; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.1rem; flex-shrink: 0;">💡</span>
            <span>Customize specific window access for <strong>${targetUser.full_name || targetUser.email}</strong>. Overrides apply ONLY to this user; other ${roleObj.label} accounts remain untouched.</span>
          </div>

          <!-- Micro Legend -->
          <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; color: #64748B; margin-bottom: 1rem; flex-wrap: wrap;">
            <span><strong style="color: #0F172A;">Switch:</strong></span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #CBD5E1;"></span>
              <span>Gray (Left) = Off</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #EAB308;"></span>
              <span style="font-weight: 600; color: #854D0E;">Yellow (Center) = View Only</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
              <span style="font-weight: 600; color: #065F46;">Green (Right) = Full Access</span>
            </span>
            <span style="color: #059669; font-weight: 600; margin-left: 0.3rem;">• Tap card to cycle</span>
          </div>

          <!-- Modal Scrollable Windows List -->
          <div id="modal-user-perm-list" style="max-height: 52vh; overflow-y: auto; padding-right: 4px;">
            <!-- Rendered via drawModalList -->
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm" id="btn-modal-cancel">Cancel</button>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline btn-sm" id="btn-modal-grant-all">Grant All Full</button>
            <button class="btn btn-primary btn-sm" id="btn-modal-save-perm" style="font-weight: 700; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
              Save Custom Permissions
            </button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        function drawModalList() {
          const listEl = modalBody.querySelector('#modal-user-perm-list');
          if (!listEl) return;

          listEl.innerHTML = RBAC_WINDOW_GROUPS.map(grp => `
            <div style="margin-bottom: 1rem; background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.85rem 1rem;">
              <div style="font-size: 0.85rem; font-weight: 800; color: #0F172A; margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.4rem;">
                <span style="color: #059669; display: inline-flex;">${grp.icon}</span>
                <span>${grp.title}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
                ${grp.modules.map(mod => {
                  const level = getEffectiveLevel(mod.key);
                  const roleDefLevel = roleMatrix[mod.key] || 'off';
                  const isOverride = userOverrides[mod.key] !== undefined && userOverrides[mod.key] !== roleDefLevel;

                  return `
                    <div class="perm-item state-${level} modal-perm-item" data-mod-key="${mod.key}" style="padding: 0.65rem 0.85rem;" title="${mod.label} • Click to cycle">
                      <div class="perm-item-left">
                        <div class="perm-item-icon" style="width: 32px; height: 32px;">${mod.icon}</div>
                        <div class="perm-item-info">
                          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                            <span class="perm-item-name" style="font-size: 0.85rem;">${mod.label}</span>
                            ${isOverride ? `
                              <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.62rem; padding: 0.1rem 0.4rem; font-weight: 700;">
                                Special Override
                              </span>
                            ` : `
                              <span style="font-size: 0.68rem; color: #94A3B8;">(Role Default: ${roleDefLevel.toUpperCase()})</span>
                            `}
                          </div>
                          <span class="perm-item-desc" style="font-size: 0.7rem;">${mod.desc}</span>
                        </div>
                      </div>
                      <div class="perm-switch pos-${level}" data-mod-key="${mod.key}"></div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('');

          // Bind switch cycle clicks
          listEl.querySelectorAll('.modal-perm-item').forEach(item => {
            item.addEventListener('click', () => {
              const modKey = item.getAttribute('data-mod-key');
              if (!modKey) return;
              const current = getEffectiveLevel(modKey);
              let next = 'view';
              if (current === 'off') next = 'view';
              else if (current === 'view') next = 'full';
              else next = 'off';

              userOverrides[modKey] = next;
              drawModalList();
            });
          });
        }

        drawModalList();

        // Reset to Role Defaults
        modalBody.querySelector('#btn-modal-reset-defaults')?.addEventListener('click', () => {
          userOverrides = {};
          drawModalList();
          toast.info(`Reset switches to default ${roleObj.label} permissions.`);
        });

        // Grant All Full
        modalBody.querySelector('#btn-modal-grant-all')?.addEventListener('click', () => {
          for (const grp of RBAC_WINDOW_GROUPS) {
            for (const mod of grp.modules) {
              userOverrides[mod.key] = 'full';
            }
          }
          drawModalList();
        });

        // Cancel
        modalBody.querySelector('#btn-modal-cancel')?.addEventListener('click', () => {
          close();
        });

        // Save Custom Permissions
        modalBody.querySelector('#btn-modal-save-perm')?.addEventListener('click', async () => {
          // Check if overrides match defaults
          let hasAnyOverride = false;
          const cleanedOverrides = {};
          for (const grp of RBAC_WINDOW_GROUPS) {
            for (const mod of grp.modules) {
              const current = userOverrides[mod.key];
              const def = roleMatrix[mod.key] || 'off';
              if (current !== undefined && current !== def) {
                cleanedOverrides[mod.key] = current;
                hasAnyOverride = true;
              }
            }
          }

          if (!hasAnyOverride) {
            clearUserCustomPermissions(targetUser.id);
            const users = db.get('tps_users') || [];
            const idx = users.findIndex(u => u.id === targetUser.id);
            if (idx >= 0) {
              delete users[idx].custom_modules;
              db.set('tps_users', users);
            }
            toast.info(`Restored default permissions for ${targetUser.full_name || targetUser.email}.`);
          } else {
            saveUserCustomPermissions(targetUser.id, cleanedOverrides);
            const users = db.get('tps_users') || [];
            const idx = users.findIndex(u => u.id === targetUser.id);
            if (idx >= 0) {
              users[idx].custom_modules = cleanedOverrides;
              db.set('tps_users', users);
            }
            db.logAudit('USER_CUSTOM_PERM_SAVE', 'permissions', targetUser.id, `Saved individual custom window permissions for ${targetUser.full_name || targetUser.email}`);
            toast.success(`Saved custom window permissions for ${targetUser.full_name || targetUser.email}.`);
          }

          close();
          savedUsersTab = 'active';
          renderUsersModule(container, { onNavigate });
        });
      }
    });
  }

  function showApprovalModal(userId, email, currentRole = 'teacher') {
    openModal({
      title: 'Assign Role & Grant Permissions',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">User Email</label>
          <input type="text" class="form-control" value="${email}" disabled style="background: var(--bg-surface-subtle);" />
        </div>
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label required">Assign Institutional Role</label>
          <select id="modal-role-select" class="form-control">
            <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin (Academic / Records Administrator)</option>
            <option value="mentor" ${currentRole === 'mentor' ? 'selected' : ''}>Hostel Mentor / Warden (Hostel Operations & Discipline)</option>
            <option value="teacher" ${currentRole === 'teacher' ? 'selected' : ''}>Teacher (Class Attendance & Examination Marks)</option>
            <option value="hostel_leader" ${currentRole === 'hostel_leader' ? 'selected' : ''}>Hostel Leader (Student Assistant)</option>
            <option value="parent" ${currentRole === 'parent' ? 'selected' : ''}>Parent (Linked Student View Only)</option>
            <option value="student" ${currentRole === 'student' ? 'selected' : ''}>Student (Self Records View Only)</option>
          </select>
          <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.35rem;">
            * Windows accessible to this role can be customized in the Assign Windows (RBAC) tab.
          </small>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Scope / Class Assignment</label>
          <input type="text" id="modal-scope-input" class="form-control" placeholder="e.g. Hostel Moral Class, Study Lab 1, Boys Block A" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-confirm-approve">Save & Authorize Access</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-confirm-approve').addEventListener('click', async () => {
          const role = modalBody.querySelector('#modal-role-select').value;
          await db.updateUserApproval(userId, { approval_status: 'approved', role });
          toast.success(`Account approved with role: ${role.toUpperCase()}`);
          close();
          renderUsersModule(container, { onNavigate });
        });
      }
    });
  }

  // Pre-authorization invitation modal
  container.querySelector('#btn-create-invitation')?.addEventListener('click', () => {
    openModal({
      title: 'Pre-Authorize User Email',
      contentHtml: `
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          When an invited user signs in with Google, they will immediately be approved with their assigned role without waiting in the pending queue.
        </p>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">User Google Email</label>
          <input type="email" id="invite-email" class="form-control" placeholder="name@gmail.com or school domain" required />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Pre-Assigned Role</label>
          <select id="invite-role" class="form-control">
            <option value="teacher">Teacher (Class Attendance & Marks)</option>
            <option value="mentor">Hostel Mentor / Warden (Hostel & Leave Register)</option>
            <option value="admin">Admin (Operational & Records Administrator)</option>
            <option value="hostel_leader">Hostel Leader (Student Assistant)</option>
            <option value="parent">Parent</option>
            <option value="student">Student</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-invitation">Issue Pre-Authorization</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-invitation').addEventListener('click', async () => {
          const email = modalBody.querySelector('#invite-email').value.trim();
          const role = modalBody.querySelector('#invite-role').value;
          if (!email) {
            toast.error('Please enter a valid email address.');
            return;
          }
          const users = await db.getUsers();
          users.push({
            id: 'u-' + Date.now(),
            email,
            full_name: email.split('@')[0],
            role,
            approval_status: 'approved',
            is_super_admin: false
          });
          db.set('tps_users', users);
          toast.success(`Pre-authorization created for ${email}`);
          close();
          savedUsersTab = 'active'; // View the new account in Active Accounts
          renderUsersModule(container, { onNavigate });
        });
      }
    });
  });

  // Tab switching handlers
  container.querySelector('#tab-pending-btn')?.addEventListener('click', () => {
    activeTab = 'pending';
    savedUsersTab = 'pending';
    updateTabButtons();
    renderTabContent();
  });

  container.querySelector('#tab-active-btn')?.addEventListener('click', () => {
    activeTab = 'active';
    savedUsersTab = 'active';
    updateTabButtons();
    renderTabContent();
  });

  container.querySelector('#tab-suspended-btn')?.addEventListener('click', () => {
    activeTab = 'suspended';
    savedUsersTab = 'suspended';
    updateTabButtons();
    renderTabContent();
  });

  container.querySelector('#tab-rbac-btn')?.addEventListener('click', () => {
    activeTab = 'rbac';
    savedUsersTab = 'rbac';
    updateTabButtons();
    renderTabContent();
  });

  renderTabContent();
}
