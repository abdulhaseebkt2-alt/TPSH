import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog, openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { openProfileModal } from '../../components/profile-modal.js';

// Module-level preserved tab state so user never loses their active view
let savedUsersTab = null;

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
        <p>Institutional identity governance, pending approval queue, and role assignment</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-create-invitation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
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

    <!-- Tabs: Pending Approvals, Active Accounts & Suspended Accounts -->
    <div class="card-panel">
      <div class="card-panel-header">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-pending-btn">Pending Approvals (${pendingUsers.length})</button>
          <button class="btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-active-btn">Active Accounts (${activeUsers.length})</button>
          <button class="btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-suspended-btn">Suspended Accounts (${suspendedUsers.length})</button>
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

    if (pendingBtn) {
      pendingBtn.className = `btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
    if (activeBtn) {
      activeBtn.className = `btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
    if (suspendedBtn) {
      suspendedBtn.className = `btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
  }

  function renderTabContent() {
    const tabContent = container.querySelector('#users-tab-content');
    if (!tabContent) return;

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
                    <strong>${u.full_name || 'Applicant'}</strong>
                  </td>
                  <td><code>${u.email}</code></td>
                  <td><span class="badge badge-pending">Pending Review</span></td>
                  <td>
                    <button class="btn btn-primary btn-sm btn-approve" data-id="${u.id}" data-email="${u.email}">Approve & Assign Role</button>
                    <button class="btn btn-outline btn-sm btn-reject" data-id="${u.id}" style="color: #DC2626;">Reject</button>
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
          showApprovalModal(id, email);
        });
      });

      tabContent.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const confirmed = await confirmDialog({
            title: 'Reject User Application',
            message: 'Are you sure you want to reject this account? The user will remain blocked from accessing the application.',
            confirmText: 'Reject Account',
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

    } else if (activeTab === 'suspended') {
      // Suspended Accounts Tab
      if (suspendedUsers.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✓</div>
            <h4>No Suspended Accounts</h4>
            <p>There are currently no suspended institutional accounts.</p>
          </div>
        `;
        return;
      }

      tabContent.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Institutional User</th>
                <th>Staff / Student ID</th>
                <th>Contact</th>
                <th>Role & Blood</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${suspendedUsers.map(u => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div class="user-avatar" style="width: 32px; height: 32px; font-size: 12px; overflow: hidden; flex-shrink: 0; opacity: 0.7;">
                        ${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; filter: grayscale(1);" alt="" />` : (u.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <strong>${u.full_name || 'User'}</strong>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    ${u.tps_id ? `<span class="badge" style="background: #EEF2FF; color: #3742FA; border: 1px solid #C7D2FE;">${u.tps_id}</span>` : '<span style="color: var(--text-muted); font-size: 0.75rem;">Not Set</span>'}
                  </td>
                  <td>
                    <div style="font-size: 0.8rem;">${u.phone || '—'}</div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <span class="badge" style="background: #F1F5F9; color: #64748B;">${(u.role || '').toUpperCase()}</span>
                      ${u.blood_group ? `<span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA;">${u.blood_group}</span>` : ''}
                    </div>
                  </td>
                  <td><span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-weight: 700;">Suspended</span></td>
                  <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      <button class="btn btn-outline btn-sm btn-edit-user-profile" data-id="${u.id}" title="Edit Profile Details">Edit Profile</button>
                      <button class="btn btn-outline btn-sm btn-edit-role" data-id="${u.id}">Role</button>
                      <button class="btn btn-primary btn-sm btn-reactivate" data-id="${u.id}" style="background: #059669; border-color: #059669;">Reactivate</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      tabContent.querySelectorAll('.btn-edit-user-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = suspendedUsers.find(item => item.id === id);
          if (u) {
            openProfileModal({
              profile: u,
              isInitialSetup: false,
              onSaved: () => {
                savedUsersTab = 'suspended';
                renderUsersModule(container, { onNavigate });
              }
            });
          }
        });
      });

      tabContent.querySelectorAll('.btn-edit-role').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = suspendedUsers.find(item => item.id === id);
          if (u) showApprovalModal(id, u.email, u.role);
        });
      });

      tabContent.querySelectorAll('.btn-reactivate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const u = suspendedUsers.find(item => item.id === id);
          const confirmed = await confirmDialog({
            title: 'Reactivate User Account',
            message: `Are you sure you want to reactivate access for ${u?.full_name || u?.email || 'this user'}? They will immediately regain authorization to sign in.`,
            confirmText: 'Reactivate Access',
            isDanger: false
          });
          if (confirmed) {
            await db.updateUserApproval(id, { approval_status: 'approved' });
            toast.success('Account reactivated successfully.');
            savedUsersTab = 'suspended';
            renderUsersModule(container, { onNavigate });
          }
        });
      });

    } else {
      // Active Accounts Tab
      if (activeUsers.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: #F1F5F9; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: #64748B;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <h4>No Active Accounts</h4>
            <p>There are no active approved accounts found.</p>
          </div>
        `;
        return;
      }

      tabContent.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Institutional User</th>
                <th>Staff / Student ID</th>
                <th>Contact</th>
                <th>Role & Blood</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${activeUsers.map(u => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div class="user-avatar" style="width: 32px; height: 32px; font-size: 12px; overflow: hidden; flex-shrink: 0;">
                        ${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="" />` : (u.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <strong>${u.full_name || 'User'}</strong>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    ${u.tps_id ? `<span class="badge" style="background: #EEF2FF; color: #3742FA; border: 1px solid #C7D2FE;">${u.tps_id}</span>` : '<span style="color: var(--text-muted); font-size: 0.75rem;">Not Set</span>'}
                  </td>
                  <td>
                    <div style="font-size: 0.8rem;">${u.phone || '—'}</div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <span class="badge ${u.is_super_admin ? 'badge-super' : 'badge-active'}">${(u.role || '').toUpperCase()}</span>
                      ${u.blood_group ? `<span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA;">${u.blood_group}</span>` : ''}
                    </div>
                  </td>
                  <td><span class="badge badge-present">Approved</span></td>
                  <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      <button class="btn btn-outline btn-sm btn-edit-user-profile" data-id="${u.id}" title="Edit Profile Details">Edit Profile</button>
                      ${!u.is_super_admin ? `
                        <button class="btn btn-outline btn-sm btn-edit-role" data-id="${u.id}">Role</button>
                        <button class="btn btn-outline btn-sm btn-suspend" data-id="${u.id}" style="color: #DC2626;">Suspend</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      tabContent.querySelectorAll('.btn-edit-user-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = activeUsers.find(item => item.id === id);
          if (u) {
            openProfileModal({
              profile: u,
              isInitialSetup: false,
              onSaved: () => {
                savedUsersTab = 'active';
                renderUsersModule(container, { onNavigate });
              }
            });
          }
        });
      });

      tabContent.querySelectorAll('.btn-edit-role').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = activeUsers.find(item => item.id === id);
          if (u) showApprovalModal(id, u.email, u.role);
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
            savedUsersTab = 'active'; // Stay on Active Accounts tab!
            renderUsersModule(container, { onNavigate });
          }
        });
      });
    }
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
            <option value="parent" ${currentRole === 'parent' ? 'selected' : ''}>Parent (Linked Student View Only)</option>
            <option value="student" ${currentRole === 'student' ? 'selected' : ''}>Student (Self Records View Only)</option>
          </select>
          <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.35rem;">
            * Security Rule: Super Admin role can only be bootstrapped by the initial verified institution account.
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

  renderTabContent();
}
