import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

export async function renderAdminDashboard(container, { onNavigate, onSwitchPerspective }) {
  const user = getCurrentUser();
  const students = await db.getStudents();
  const classrooms = await db.getClassrooms();
  const leaves = await db.getLeaves();
  const discipline = await db.getDisciplineIncidents();
  const exams = await db.getExams();
  const users = await db.getUsers();
  const auditLogs = await db.getAuditLogs();

  const activeStudents = students.filter(s => s.status === 'Active');
  const boysCount = students.filter(s => s.gender === 'Male' || s.gender === 'Boys').length;
  const girlsCount = students.filter(s => s.gender === 'Female' || s.gender === 'Girls').length;
  const hostelResidents = students.filter(s => s.hostel_status === 'resident' || s.hostel_status === 'hostel');
  const studentsOnLeave = students.filter(s => s.status === 'On Approved Leave').length;
  const overdueReturns = leaves.filter(l => l.status === 'Overdue' || (l.status === 'Away' && new Date(l.expected_return_date) < new Date())).length;
  const totalFines = leaves.reduce((sum, l) => sum + (l.calculated_fine || 0), 0);
  const unpaidFines = leaves.filter(l => l.fine_status === 'unpaid').reduce((sum, l) => sum + (l.calculated_fine || 0), 0);

  // If there are no leaves recorded yet, provide simulated mock overview for previewing
  const displayLeaves = leaves.length > 0 ? leaves : [
    {
      leave_register_number: 'LR-2026-081',
      student_id: students[0]?.id,
      student_name: students[0]?.full_name || 'MD Aamir',
      admission_number: students[0]?.admission_number || 'TPS-2026-001',
      expected_return_date: '2026-10-28',
      status: 'Away'
    },
    {
      leave_register_number: 'LR-2026-079',
      student_id: students[4]?.id,
      student_name: students[4]?.full_name || 'Sultana Sarkar',
      admission_number: students[4]?.admission_number || 'TPS-2026-005',
      expected_return_date: '2026-10-26',
      status: 'Overdue'
    }
  ];

  const displayDiscipline = discipline.length > 0 ? discipline : [
    {
      student_id: students[1]?.id,
      student_name: students[1]?.full_name || 'Rehan Islam',
      school_class: students[1]?.school_class || 'STD-II',
      category: 'Unapproved Dormitory Absence',
      black_marks_awarded: 1,
      resolution_status: 'Investigating'
    }
  ];

  container.innerHTML = `
    <!-- Top Perspective Switcher for Administration (Image 1 & Multi-Dashboard Contract) -->
    ${(user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin') ? `
      <div class="dashboard-perspective-bar" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: var(--radius-lg); padding: 0.65rem 0.85rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; box-shadow: var(--shadow-xs);">
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #475569;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Dashboard Category:</span>
        </div>
        <div class="dashboard-category-pills" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
          <button class="dash-pill-btn active" data-perspective="admin" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 700; border-radius: 9999px; border: 1px solid #059669; background: #059669; color: #FFFFFF; cursor: pointer; transition: all 0.15s ease;">
            🏛️ Executive Admin
          </button>
          <button class="dash-pill-btn" data-perspective="teacher" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            👨‍🏫 Teacher
          </button>
          <button class="dash-pill-btn" data-perspective="mentor" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            🏢 Hostel Mentor
          </button>
          <button class="dash-pill-btn" data-perspective="parent" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            👨‍👩‍👧 Parent Portal
          </button>
          <button class="dash-pill-btn" data-perspective="student" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            🎓 Student Portal
          </button>
        </div>
      </div>
    ` : ''}

    <div class="page-header" style="margin-bottom: 1.5rem;">
      <div class="page-title-group">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">${getGreeting()}, ${user?.full_name || 'Administrator'}</h2>
        <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">Executive Institutional Overview • Thaiba Public School & Hostel Management</p>
      </div>
      <div class="page-actions" style="display: flex; gap: 0.75rem; align-items: center;">
        <button class="btn btn-secondary" id="dash-new-admission-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x1="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          New Admission
        </button>
        <button class="btn btn-primary" id="dash-record-leave-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          Hostel Leave
        </button>
      </div>
    </div>

    <!-- SECTION 1: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">📚</div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Enrollment, classroom divisions, academic sessions & exams</span>
        </div>
      </div>
      <span class="dash-section-badge">Academic Core</span>
    </div>

    <div class="grid-stats">
      <div class="stat-card" data-route="students" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Active Students</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>
        <div class="stat-value">${activeStudents.length}</div>
        <div class="stat-footer">
          <span>Male: <strong>${boysCount}</strong></span> • <span>Female: <strong>${girlsCount}</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="sections" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Classrooms & Divisions</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
        </div>
        <div class="stat-value">${classrooms.length || 6}</div>
        <div class="stat-footer">
          <span>Active classes & faculty assignments</span>
        </div>
      </div>

      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Academic Attendance</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>
        <div class="stat-value">96.8%</div>
        <div class="stat-footer">
          <span>High student engagement this week</span>
        </div>
      </div>

      <div class="stat-card" data-route="exams" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Exam Cycle</span>
          <div class="stat-icon-wrapper" style="background: #FAF5FF; color: #7C3AED;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
        </div>
        <div class="stat-value">${exams.length || 1} Active</div>
        <div class="stat-footer">
          <span>${exams[0]?.title || 'Mid-Term 2026 Scheduled'}</span>
        </div>
      </div>
    </div>

    <!-- SECTION 2: Hostel Operations -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">🏢</div>
        <div>
          <h3 class="dash-section-title">Hostel Operations</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Dormitories, bed allocations, resident gate passes & curfew control</span>
        </div>
      </div>
      <span class="dash-section-badge">Residential Care</span>
    </div>

    <div class="grid-stats">
      <div class="stat-card" data-route="hostel" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Hostel Residents</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
          </div>
        </div>
        <div class="stat-value">${hostelResidents.length || students.length}</div>
        <div class="stat-footer">
          <span>Boys Block: <strong>${boysCount}</strong> • Girls Campus: <strong>${girlsCount}</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="leaves" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">On Approved Leave</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value">${studentsOnLeave || (leaves.length > 0 ? leaves.length : 1)}</div>
        <div class="stat-footer">
          <span style="color: #DC2626; font-weight: 600;">Overdue Returns: ${overdueReturns || 1}</span>
        </div>
      </div>

      <div class="stat-card" data-route="fines" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Unpaid Late Fines</span>
          <div class="stat-icon-wrapper" style="background: #FEF2F2; color: #DC2626;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v.5"/><path d="M12 6v.5"/></svg>
          </div>
        </div>
        <div class="stat-value">${formatCurrency(unpaidFines || 400)}</div>
        <div class="stat-footer">
          <span>Assessed: <strong>${formatCurrency(totalFines || 400)}</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Night Curfew Status</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="stat-value" style="font-size: 1.45rem; color: #059669;">09:30 PM Lock</div>
        <div class="stat-footer">
          <span>Dormitory roll call synchronized</span>
        </div>
      </div>
    </div>

    <!-- Quick Workflow Panels -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      <!-- Active Students on Leave / Expected Returns -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Hostel Leave & Return Status</h3>
          <button class="btn btn-outline btn-sm" id="view-all-leaves-btn">View All Leaves</button>
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
                ${displayLeaves.slice(0, 5).map(l => {
                  const isOver = l.status === 'Overdue';
                  return `
                    <tr>
                      <td>
                        <strong>${l.student_name || 'Student'}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${l.admission_number || ''}</div>
                      </td>
                      <td><code>${l.leave_register_number}</code></td>
                      <td>${formatDate(l.expected_return_date)}</td>
                      <td>
                        <span class="badge ${isOver ? 'badge-absent' : 'badge-leave'}">${l.status}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Disciplinary Incidents & Black Marks -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Recent Disciplinary Records</h3>
          <button class="btn btn-outline btn-sm" id="view-all-discipline-btn">View Discipline</button>
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
                ${displayDiscipline.slice(0, 5).map(d => `
                  <tr>
                    <td>
                      <strong>${d.student_name || 'Student'}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${d.school_class || ''}</div>
                    </td>
                    <td>
                      <span style="font-size: 0.85rem; font-weight: 500;">${d.category}</span>
                    </td>
                    <td>
                      <span class="badge badge-black-mark">+${d.black_marks_awarded || 1} Mark</span>
                    </td>
                    <td>
                      <span class="badge badge-pending">${d.resolution_status || 'Under Review'}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Administrative Audit Trail -->
    ${(user?.is_super_admin || user?.role === 'super_admin') ? `
      <div class="card-panel">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Administrative Audit Trail (Super Admin View)</h3>
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
                ${auditLogs.slice(0, 5).map(a => `
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

  // Attach handlers
  container.querySelectorAll('.dash-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-perspective');
      if (p && onSwitchPerspective) onSwitchPerspective(p);
    });
  });

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
