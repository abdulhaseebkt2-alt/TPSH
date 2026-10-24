import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

export async function renderDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const students = await db.getStudents();
  const leaves = await db.getLeaves();
  const discipline = await db.getDisciplineIncidents();
  const exams = await db.getExams();
  const users = await db.getUsers();
  const auditLogs = await db.getAuditLogs();

  const activeStudents = students.filter(s => s.status === 'Active');
  const boysCount = students.filter(s => s.gender === 'Male' || s.gender === 'Boys').length;
  const girlsCount = students.filter(s => s.gender === 'Female' || s.gender === 'Girls').length;
  const hostelResidents = students.filter(s => s.hostel_status === 'resident' && s.status === 'Active').length;
  const studentsOnLeave = students.filter(s => s.status === 'On Approved Leave').length;
  const studentsOnBreak = students.filter(s => s.status === 'Temporary Break').length;
  const pendingApprovals = users.filter(u => u.approval_status === 'pending').length;
  const overdueReturns = leaves.filter(l => l.status === 'Overdue' || (l.status === 'Away' && new Date(l.expected_return_date) < new Date())).length;
  const totalFines = leaves.reduce((sum, l) => sum + (l.calculated_fine || 0), 0);
  const unpaidFines = leaves.filter(l => l.fine_status === 'unpaid').reduce((sum, l) => sum + (l.calculated_fine || 0), 0);

  // Parent view filter
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';
  const isMentor = user?.role === 'mentor';
  const isStudent = user?.role === 'student';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>${getGreeting()}, ${user?.full_name || 'User'}</h2>
        <p>Welcome to <strong>TPS Hostel ERP</strong> • Thaiba Public School Portal</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-secondary" id="dash-new-admission-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            New Admission
          </button>
          <button class="btn btn-primary" id="dash-record-leave-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
            Hostel Leave
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Real Statistical Metrics Grid -->
    <div class="grid-stats">
      <div class="stat-card" data-route="students">
        <div class="stat-header">
          <span class="stat-title">Active Students</span>
          <div class="stat-icon-wrapper" style="background: var(--brand-primary-light, #F0EEFD); color: var(--brand-primary, #6358DC);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>
        <div class="stat-value">${activeStudents.length}</div>
        <div class="stat-footer">
          <span>Male: <strong>${boysCount}</strong></span> • <span>Female: <strong>${girlsCount}</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="hostel">
        <div class="stat-header">
          <span class="stat-title">Hostel Residents</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
          </div>
        </div>
        <div class="stat-value">${hostelResidents}</div>
        <div class="stat-footer">
          <span>Currently in hostel dormitories</span>
        </div>
      </div>

      <div class="stat-card" data-route="leaves">
        <div class="stat-header">
          <span class="stat-title">On Approved Leave</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value">${studentsOnLeave}</div>
        <div class="stat-footer">
          <span style="color: #DC2626; font-weight: 600;">Overdue Returns: ${overdueReturns}</span>
        </div>
      </div>

      <div class="stat-card" data-route="fines">
        <div class="stat-header">
          <span class="stat-title">Unpaid Late Fines</span>
          <div class="stat-icon-wrapper" style="background: #FEF2F2; color: #DC2626;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v.5"/><path d="M12 6v.5"/></svg>
          </div>
        </div>
        <div class="stat-value">${formatCurrency(unpaidFines)}</div>
        <div class="stat-footer">
          <span>Total Assessed: ${formatCurrency(totalFines)}</span>
        </div>
      </div>
    </div>

    <!-- Quick Workflow Panels -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      <!-- Active Students on Leave / Expected Returns -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header">
          <h3>Hostel Leave & Return Status</h3>
          <button class="btn btn-outline btn-sm" id="view-all-leaves-btn">View All</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Leave Reg</th>
                  <th>Expected Return</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${leaves.slice(0, 5).map(l => {
                  const st = students.find(s => s.id === l.student_id);
                  const isOver = l.status === 'Overdue';
                  return `
                    <tr>
                      <td>
                        <strong>${st?.full_name || 'Student'}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${st?.admission_number || ''}</div>
                      </td>
                      <td><code>${l.leave_register_number}</code></td>
                      <td>${formatDate(l.expected_return_date)}</td>
                      <td>
                        <span class="badge ${isOver ? 'badge-absent' : 'badge-leave'}">${l.status}</span>
                      </td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No active hostel leave records</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Disciplinary Incidents & Black Marks -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header">
          <h3>Recent Disciplinary Records</h3>
          <button class="btn btn-outline btn-sm" id="view-all-discipline-btn">View All</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Incident</th>
                  <th>Marks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${discipline.slice(0, 5).map(d => {
                  const st = students.find(s => s.id === d.student_id);
                  return `
                    <tr>
                      <td>
                        <strong>${st?.full_name || 'Student'}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${st?.school_class || ''}</div>
                      </td>
                      <td>
                        <span style="font-size: 0.85rem; font-weight: 500;">${d.category}</span>
                      </td>
                      <td>
                        <span class="badge badge-black-mark">+${d.black_marks_awarded} Mark</span>
                      </td>
                      <td>
                        <span class="badge badge-pending">${d.resolution_status}</span>
                      </td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No disciplinary incidents recorded</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Administrative Audit Trail -->
    ${user?.is_super_admin || user?.role === 'super_admin' ? `
      <div class="card-panel">
        <div class="card-panel-header">
          <h3>Administrative Audit Trail (Super Admin View)</h3>
          <button class="btn btn-outline btn-sm" id="view-all-audit-btn">Open Audit Log</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Reason / Details</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.slice(0, 6).map(a => `
                  <tr>
                    <td style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(a.created_at)}</td>
                    <td><code>${a.actor_email || 'system'}</code></td>
                    <td><span class="badge badge-active">${a.action}</span></td>
                    <td>${a.entity_type}</td>
                    <td style="color: var(--text-secondary);">${a.reason || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  // Attach interactive navigation handlers
  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#dash-new-admission-btn')?.addEventListener('click', () => onNavigate('admissions'));
  container.querySelector('#dash-record-leave-btn')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelector('#view-all-leaves-btn')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelector('#view-all-discipline-btn')?.addEventListener('click', () => onNavigate('discipline'));
  container.querySelector('#view-all-audit-btn')?.addEventListener('click', () => onNavigate('audit'));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}
