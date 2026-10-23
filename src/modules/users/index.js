import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog, openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { openProfileModal } from '../../components/profile-modal.js';
import { 
  getRBACMatrix, 
  saveRBACMatrix, 
  resetRBACMatrix, 
  MODULE_DEFINITIONS 
} from '../../lib/permissions.js';

// Module-level preserved tab state so user never loses their active view
let savedUsersTab = null;
let savedActiveRbacRole = 'teacher';

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
      <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
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
      <div class="card-panel-header">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-pending-btn">Pending Approvals (${pendingUsers.length})</button>
          <button class="btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-active-btn">Active Accounts (${activeUsers.length})</button>
          <button class="btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-suspended-btn">Suspended Accounts (${suspendedUsers.length})</button>
          <button class="btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-rbac-btn" style="display: flex; align-items: center; gap: 0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Assign Windows (RBAC)
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
        <div class="table-responsive">
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
        <div class="table-responsive">
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
        <div class="table-responsive">
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
              ${activeUsers.map(u => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div class="user-avatar" style="width: 32px; height: 32px; font-size: 12px;">
                        ${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="" />` : (u.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <strong>${u.full_name || 'User'}</strong>
                        ${u.is_super_admin ? `<span class="badge" style="background: #0F172A; color: #FFFFFF; font-size: 0.65rem; margin-left: 0.35rem;">SUPER ADMIN</span>` : ''}
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
                    <div style="display: flex; gap: 0.5rem;">
                      ${!u.is_super_admin ? `
                        <button class="btn btn-sm btn-outline btn-change-role" data-id="${u.id}" data-email="${u.email}" data-role="${u.role || 'teacher'}">Edit Role</button>
                      ` : ''}
                      <button class="btn btn-sm btn-outline btn-profile" data-id="${u.id}">Profile</button>
                      ${!u.is_super_admin ? `
                        <button class="btn btn-sm btn-outline btn-suspend" data-id="${u.id}" style="color: #DC2626; border-color: #FECACA;">Suspend</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
  // SIMPLE & EASY TO USE WINDOW ASSIGNMENT (RBAC)
  // ==========================================================
  function renderSimpleRBACView(tabContent) {
    let localMatrix = JSON.parse(JSON.stringify(getRBACMatrix()));
    let selectedRoleKey = savedActiveRbacRole || 'teacher';

    const ROLES = [
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

    const WINDOW_GROUPS = [
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
            desc: 'Take daily classroom and coaching attendance',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
          },
          {
            key: 'exams',
            label: 'Exam Management',
            desc: 'View examination dates, syllabi, and timings',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
          },
          {
            key: 'marks',
            label: 'Marks & Results',
            desc: 'Enter student marks and view term report cards',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`
          },
          {
            key: 'admissions',
            label: 'Student Admissions',
            desc: 'Process new student admission forms & documents',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y1="11"/></svg>`
          },
          {
            key: 'students',
            label: 'Student Directory',
            desc: 'Browse complete student directory and profile details',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
          },
          {
            key: 'sections',
            label: 'Sections & Classrooms',
            desc: 'Manage classrooms, standards and batch divisions',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
          },
          {
            key: 'assignments',
            label: 'Student Assignments',
            desc: 'Review hostel coaching homework and assign tasks',
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
            desc: 'Request and record student leaves, departures & returns',
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
            desc: 'View dormitory rooms, bunk beds & room allocations',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`
          },
          {
            key: 'maintenance',
            label: 'Hostel Maintenance',
            desc: 'Submit and track hostel repairs and plumbing issues',
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
      },
      {
        title: 'Main Navigation Window',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
        modules: [
          {
            key: 'dashboard',
            label: 'Dashboard Overview',
            desc: 'Main portal overview with charts and quick stats',
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
          }
        ]
      }
    ];

    function drawSimpleView() {
      const activeRoleObj = ROLES.find(r => r.key === selectedRoleKey) || ROLES[1];
      const currentAllowed = localMatrix[selectedRoleKey] || [];
      const totalAssignable = WINDOW_GROUPS.reduce((acc, g) => acc + g.modules.length, 0);

      tabContent.innerHTML = `
        <div style="padding: 1.5rem;">
          <!-- Top Role Selection Pills -->
          <div style="margin-bottom: 1.5rem;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
              Select Role to Configure Windows:
            </div>
            <div class="role-pill-nav">
              ${ROLES.map(role => {
                const count = (localMatrix[role.key] || []).length;
                const isSelected = role.key === selectedRoleKey;
                return `
                  <button type="button" class="role-pill-btn ${isSelected ? 'active' : ''}" data-role-key="${role.key}">
                    <span class="role-pill-icon">${role.icon}</span>
                    <span>${role.label}</span>
                    <span class="role-pill-badge">${count}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Active Role Header & Quick Controls -->
          <div style="background: #F8FAFC; border: 1.5px solid var(--border-subtle); border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.9rem;">
              <div class="role-avatar-badge">
                ${activeRoleObj.icon.replace('width="18" height="18"', 'width="24" height="24"')}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0F172A;">${activeRoleObj.label}</h3>
                  <span class="badge badge-active" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">
                    ${currentAllowed.length} of ${totalAssignable} Windows Active
                  </span>
                </div>
                <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                  ${activeRoleObj.subtitle} • Click any window card below to toggle access ON or OFF
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" id="btn-role-enable-all" title="Enable all windows for this role">
                Enable All
              </button>
              <button class="btn btn-outline btn-sm" id="btn-role-clear-all" style="color: #DC2626; border-color: #FECACA;" title="Disable all windows for this role">
                Disable All
              </button>
              <button class="btn btn-outline btn-sm" id="btn-role-reset" title="Reset this role to default institutional windows">
                Reset Defaults
              </button>
              <button class="btn btn-primary" id="btn-save-role-matrix" style="font-weight: 700; padding: 0.55rem 1.25rem; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Save Permissions
              </button>
            </div>
          </div>

          <!-- Category Grouped Windows -->
          ${WINDOW_GROUPS.map(grp => `
            <div class="perm-category-card">
              <div class="perm-category-header">
                <div class="perm-category-title">
                  <span class="perm-category-icon">${grp.icon}</span>
                  <span>${grp.title}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-left: 0.4rem;">
                    (${grp.modules.filter(m => currentAllowed.includes(m.key)).length}/${grp.modules.length} Enabled)
                  </span>
                </div>
              </div>

              <div class="perm-grid">
                ${grp.modules.map(mod => {
                  const isEnabled = currentAllowed.includes(mod.key);
                  return `
                    <div class="perm-item ${isEnabled ? 'active' : ''}" data-mod-key="${mod.key}" title="Click to toggle ${mod.label}">
                      <div class="perm-item-left">
                        <div class="perm-item-icon">${mod.icon}</div>
                        <div class="perm-item-info">
                          <span class="perm-item-name">${mod.label}</span>
                          <span class="perm-item-desc">${mod.desc}</span>
                        </div>
                      </div>
                      <div class="perm-switch"></div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}

          <!-- Bottom Action Bar -->
          <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: 14px; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-secondary);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span><strong>Instant Updates:</strong> Click <strong>Save Permissions</strong> to apply changes. Users with this role will immediately see their assigned windows in the sidebar.</span>
            </div>
            <button class="btn btn-primary" id="btn-save-role-matrix-bottom" style="font-weight: 700;">
              Save Permissions
            </button>
          </div>
        </div>
      `;

      // Role pill click
      tabContent.querySelectorAll('.role-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedRoleKey = btn.getAttribute('data-role-key');
          savedActiveRbacRole = selectedRoleKey;
          drawSimpleView();
        });
      });

      // Window card item click -> toggle ON / OFF
      tabContent.querySelectorAll('.perm-item').forEach(item => {
        item.addEventListener('click', () => {
          const modKey = item.getAttribute('data-mod-key');
          if (!localMatrix[selectedRoleKey]) localMatrix[selectedRoleKey] = [];

          const idx = localMatrix[selectedRoleKey].indexOf(modKey);
          if (idx > -1) {
            localMatrix[selectedRoleKey].splice(idx, 1);
          } else {
            localMatrix[selectedRoleKey].push(modKey);
          }

          // Instantly toggle visually
          const isNowActive = localMatrix[selectedRoleKey].includes(modKey);
          item.classList.toggle('active', isNowActive);

          // Update header count badge
          const countBadge = tabContent.querySelector('.role-pill-btn.active .role-pill-badge');
          if (countBadge) {
            countBadge.textContent = localMatrix[selectedRoleKey].length;
          }
        });
      });

      // Enable All for this role
      tabContent.querySelector('#btn-role-enable-all')?.addEventListener('click', () => {
        const allKeys = WINDOW_GROUPS.flatMap(g => g.modules.map(m => m.key));
        localMatrix[selectedRoleKey] = allKeys;
        drawSimpleView();
      });

      // Disable All for this role
      tabContent.querySelector('#btn-role-clear-all')?.addEventListener('click', () => {
        localMatrix[selectedRoleKey] = ['dashboard']; // keep dashboard minimal
        drawSimpleView();
      });

      // Reset Defaults for this role
      tabContent.querySelector('#btn-role-reset')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Reset Role Windows',
          message: `Restore default institutional window assignments for ${activeRoleObj.label}?`,
          confirmText: 'Restore Defaults'
        });
        if (confirmed) {
          const freshDefaults = resetRBACMatrix();
          localMatrix[selectedRoleKey] = freshDefaults[selectedRoleKey] || [];
          drawSimpleView();
          toast.info(`Restored default windows for ${activeRoleObj.label}.`);
        }
      });

      // Save handlers
      const handleSave = () => {
        saveRBACMatrix(localMatrix);
        db.logAudit('UPDATE_RBAC_MATRIX', 'permissions', selectedRoleKey, `Updated window permissions for ${activeRoleObj.label}`);
        toast.success(`Saved! Window permissions updated for ${activeRoleObj.label}.`);
        window.dispatchEvent(new Event('tps:permissions-updated'));
        drawSimpleView();
      };

      tabContent.querySelector('#btn-save-role-matrix')?.addEventListener('click', handleSave);
      tabContent.querySelector('#btn-save-role-matrix-bottom')?.addEventListener('click', handleSave);
    }

    drawSimpleView();
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
          <input type="text" id="modal-scope-input" class="form-control" placeholder="e.g. Moral Category 1, Boys Hostel Block A" />
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
