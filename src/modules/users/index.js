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
        <button class="btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'}" id="btn-header-rbac-matrix" style="display: flex; align-items: center; gap: 0.45rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          RBAC Matrix
        </button>
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

    <!-- Tabs: Pending Approvals, Active Accounts, Suspended Accounts & RBAC Matrix -->
    <div class="card-panel">
      <div class="card-panel-header">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-pending-btn">Pending Approvals (${pendingUsers.length})</button>
          <button class="btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-active-btn">Active Accounts (${activeUsers.length})</button>
          <button class="btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-suspended-btn">Suspended Accounts (${suspendedUsers.length})</button>
          <button class="btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-rbac-btn" style="display: flex; align-items: center; gap: 0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Visual RBAC Matrix
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
    const headerRbacBtn = container.querySelector('#btn-header-rbac-matrix');

    if (pendingBtn) {
      pendingBtn.className = `btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
    if (activeBtn) {
      activeBtn.className = `btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
    if (suspendedBtn) {
      suspendedBtn.className = `btn ${activeTab === 'suspended' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
    if (rbacBtn) {
      rbacBtn.className = `btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'} btn-sm`;
    }
    if (headerRbacBtn) {
      headerRbacBtn.className = `btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-outline'}`;
    }
  }

  function renderTabContent() {
    const tabContent = container.querySelector('#users-tab-content');
    if (!tabContent) return;

    if (activeTab === 'rbac') {
      renderRBACMatrix(tabContent);
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

  // Visual RBAC Permission Matrix Renderer (Matches User Provided Photo)
  function renderRBACMatrix(tabContent) {
    let localMatrix = JSON.parse(JSON.stringify(getRBACMatrix()));

    const ROLE_TIERS = [
      { key: 'admin', label: 'Master / Institution Admin', caption: 'Academic & Records Governance', badge: 'Admin Tier' },
      { key: 'teacher', label: 'Teacher / Faculty', caption: 'Timetable, Attendance & Marks', badge: 'Faculty Tier' },
      { key: 'mentor', label: 'Hostel Mentor / Warden', caption: 'Hostel Operations, Leaves & Care', badge: 'Mentor Tier' },
      { key: 'hostel_leader', label: 'Hostel Leader (Student)', caption: 'Peer Roll-Call & Room Monitoring', badge: 'Leader Tier' },
      { key: 'parent', label: 'Parents & Guardians', caption: 'Ward Academic, Hostel & Fee Oversight', badge: 'Parent Tier' },
      { key: 'student', label: 'Students', caption: 'Personal Learning & Leave Requests', badge: 'Student Tier' }
    ];

    // Modules that can be dynamically granted/revoked across institutional roles
    // ('users' and 'audit' are strictly reserved for Super Admin root safety)
    const assignableModules = MODULE_DEFINITIONS.filter(m => !['users', 'audit'].includes(m.key));

    function drawMatrix() {
      tabContent.innerHTML = `
        <div style="padding: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; background: #ECFDF5; color: #059669;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Visual RBAC Permission Matrix</h3>
              </div>
              <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                Configure granular window capabilities and access permissions across institutional roles
              </p>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" id="btn-reset-matrix" title="Reset all roles to factory institutional defaults">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reset Defaults
              </button>
              <button class="btn btn-primary" id="btn-apply-matrix" style="font-weight: 700; padding: 0.6rem 1.4rem; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                Apply Matrix
              </button>
            </div>
          </div>

          <div class="rbac-table-container">
            <table class="rbac-matrix-table">
              <thead>
                <tr>
                  <th class="role-col-header">ROLE TIER</th>
                  ${assignableModules.map(m => `
                    <th title="${m.label}">
                      <div style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">${m.label}</div>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                <!-- Super Admin Root Tier (Permanent Full Access) -->
                <tr style="background: #F8FAFC;">
                  <td class="role-col-cell">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                      <div>
                        <div style="font-size: 0.92rem; font-weight: 800; color: #0F172A;">Initial Super Admin</div>
                        <div style="font-size: 0.72rem; color: #64748B; font-weight: 500;">Root Governance (You)</div>
                      </div>
                      <span class="badge" style="background: #0F172A; color: #FFFFFF; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                        Root 🔒
                      </span>
                    </div>
                  </td>
                  ${assignableModules.map(() => `
                    <td>
                      <div class="rbac-checkbox checked locked" title="Super Admin has locked unrestricted root access">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </td>
                  `).join('')}
                </tr>

                <!-- Configurable Role Tiers -->
                ${ROLE_TIERS.map(role => {
                  const allowedList = localMatrix[role.key] || [];
                  return `
                    <tr>
                      <td class="role-col-cell">
                        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                            <span style="font-size: 0.92rem; font-weight: 800; color: #0F172A;">${role.label}</span>
                            <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #065F46; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.65rem; font-weight: 700; padding: 1px 6px;">
                              ${role.badge}
                            </span>
                          </div>
                          <span style="font-size: 0.72rem; color: #64748B; font-weight: 500;">${role.caption}</span>
                          <div style="display: flex; gap: 0.75rem; margin-top: 2px;">
                            <button type="button" class="btn-role-select-all" data-role="${role.key}" style="background: none; border: none; padding: 0; font-size: 0.7rem; font-weight: 700; color: #059669; cursor: pointer;">Select All</button>
                            <span style="color: #CBD5E1; font-size: 0.7rem;">•</span>
                            <button type="button" class="btn-role-clear-all" data-role="${role.key}" style="background: none; border: none; padding: 0; font-size: 0.7rem; font-weight: 700; color: #DC2626; cursor: pointer;">Clear All</button>
                          </div>
                        </div>
                      </td>

                      ${assignableModules.map(m => {
                        const isChecked = allowedList.includes(m.key);
                        return `
                          <td class="rbac-cell-toggle" data-role="${role.key}" data-module="${m.key}" style="cursor: pointer;" title="Toggle ${m.label} for ${role.label}">
                            <div class="rbac-checkbox ${isChecked ? 'checked' : ''}" id="chk-${role.key}-${m.key}">
                              ${isChecked ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                            </div>
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              💡 <strong>Instant Dynamic Enforcement:</strong> Clicking <strong>Apply Matrix</strong> saves your permissions and immediately re-evaluates the sidebar navigation for all users in real time.
            </div>
            <button class="btn btn-primary btn-sm" id="btn-apply-matrix-bottom" style="font-weight: 700;">
              Apply Matrix
            </button>
          </div>
        </div>
      `;

      // Cell click to toggle
      tabContent.querySelectorAll('.rbac-cell-toggle').forEach(td => {
        td.addEventListener('click', () => {
          const roleKey = td.getAttribute('data-role');
          const modKey = td.getAttribute('data-module');
          if (!localMatrix[roleKey]) localMatrix[roleKey] = [];

          const idx = localMatrix[roleKey].indexOf(modKey);
          if (idx > -1) {
            localMatrix[roleKey].splice(idx, 1);
          } else {
            localMatrix[roleKey].push(modKey);
          }

          const chk = td.querySelector('.rbac-checkbox');
          if (chk) {
            const isNowChecked = localMatrix[roleKey].includes(modKey);
            chk.classList.toggle('checked', isNowChecked);
            chk.innerHTML = isNowChecked ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : '';
          }
        });
      });

      // Role select all
      tabContent.querySelectorAll('.btn-role-select-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const roleKey = btn.getAttribute('data-role');
          localMatrix[roleKey] = assignableModules.map(m => m.key);
          drawMatrix();
        });
      });

      // Role clear all
      tabContent.querySelectorAll('.btn-role-clear-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const roleKey = btn.getAttribute('data-role');
          localMatrix[roleKey] = ['dashboard']; // always keep dashboard
          drawMatrix();
        });
      });

      // Apply Matrix handlers
      const handleApply = () => {
        saveRBACMatrix(localMatrix);
        db.logAudit('UPDATE_RBAC_MATRIX', 'permissions', 'global', 'Super Admin updated Visual RBAC Permission Matrix');
        toast.success('Visual RBAC Matrix applied successfully! All institutional roles updated.');
        window.dispatchEvent(new Event('tps:permissions-updated'));
      };

      tabContent.querySelector('#btn-apply-matrix')?.addEventListener('click', handleApply);
      tabContent.querySelector('#btn-apply-matrix-bottom')?.addEventListener('click', handleApply);

      // Reset Defaults handler
      tabContent.querySelector('#btn-reset-matrix')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Reset RBAC Permission Matrix',
          message: 'Are you sure you want to restore the default institutional permission matrix? This will reset custom window assignments for all roles.',
          confirmText: 'Restore Defaults'
        });
        if (confirmed) {
          localMatrix = resetRBACMatrix();
          drawMatrix();
          toast.info('Restored default institutional RBAC matrix.');
          window.dispatchEvent(new Event('tps:permissions-updated'));
        }
      });
    }

    drawMatrix();
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
            * Windows accessible to this role can be customized in the Visual RBAC Matrix tab.
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

  // Header RBAC Button
  container.querySelector('#btn-header-rbac-matrix')?.addEventListener('click', () => {
    activeTab = 'rbac';
    savedUsersTab = 'rbac';
    updateTabButtons();
    renderTabContent();
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
