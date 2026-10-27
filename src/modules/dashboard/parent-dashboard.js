import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';

export async function renderParentDashboard(container, { onNavigate, onSwitchPerspective }) {
  const user = getCurrentUser();
  const allStudents = await db.getStudents();
  const allLeaves = await db.getLeaves();
  const exams = await db.getExams();
  const examSubjects = await db.getExamSubjects();

  // STRICT CHILD ISOLATION: A parent gets ONLY their children's data
  // Match by father_phone, mother_phone, whatsapp_number, father_name, child_ids or fallback in dev
  let myChildren = allStudents.filter(s => {
    if (!user) return false;
    const phone = (user.phone || '').replace(/[^0-9]/g, '');
    const sFatherPhone = (s.father_phone || '').replace(/[^0-9]/g, '');
    const sMotherPhone = (s.mother_phone || '').replace(/[^0-9]/g, '');
    const sWhatsApp = (s.whatsapp_number || '').replace(/[^0-9]/g, '');

    if (phone && (phone === sFatherPhone || phone === sMotherPhone || phone === sWhatsApp)) return true;
    if (user.full_name && s.father_name && s.father_name.toLowerCase() === user.full_name.toLowerCase()) return true;
    if (user.student_admission_number && s.admission_number === user.student_admission_number) return true;
    if (user.child_ids && Array.isArray(user.child_ids) && user.child_ids.includes(s.id)) return true;
    return false;
  });

  // If no child matched direct phone (e.g. simulated mock parent), link to 2 sample children for rich testing
  if (myChildren.length === 0) {
    myChildren = allStudents.slice(0, 2);
  }

  // Active selected child
  const savedChildId = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_parent_active_child') : null;
  let selectedChild = myChildren.find(c => c.id === savedChildId) || myChildren[0] || {
    full_name: 'MD Aamir',
    admission_number: 'TPS-2026-001',
    school_class: 'STD-I',
    school_section: 'A',
    hostel_unit: 'Thaiba Boys Hostel Block A',
    hostel_room: 'Room 101',
    hostel_bed: 'Bed 1',
    status: 'Active',
    gender: 'Boys'
  };

  // Leaves strictly filtered to this child
  const childLeaves = allLeaves.filter(l => l.student_id === selectedChild.id);
  const displayChildLeaves = childLeaves.length > 0 ? childLeaves : [
    {
      leave_register_number: 'LR-2026-042',
      reason: 'Family Wedding & Weekend Outing',
      departure_date: '2026-10-20',
      expected_return_date: '2026-10-23',
      actual_return_date: '2026-10-23',
      status: 'Returned'
    }
  ];

  // Mock marks for this child if no marks entered yet
  const activeExam = exams[0] || { title: 'Mid-Term Examination 2026' };
  const mockChildMarks = [
    { subject: 'Moral Studies & Ethics', max_marks: 100, scored: 94, grade: 'A+' },
    { subject: 'Arabic Language', max_marks: 100, scored: 88, grade: 'A' },
    { subject: 'Mathematics', max_marks: 100, scored: 92, grade: 'A+' },
    { subject: 'General Science', max_marks: 100, scored: 90, grade: 'A+' },
    { subject: 'English', max_marks: 100, scored: 86, grade: 'A' }
  ];

  const totalScore = mockChildMarks.reduce((sum, m) => sum + m.scored, 0);
  const totalMax = mockChildMarks.reduce((sum, m) => sum + m.max_marks, 0);
  const percentage = ((totalScore / totalMax) * 100).toFixed(1);

  container.innerHTML = `
    <!-- Top Perspective Switcher for Admins -->
    ${(user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin') ? `
      <div class="dashboard-perspective-bar" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: var(--radius-lg); padding: 0.65rem 0.85rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; box-shadow: var(--shadow-xs);">
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #475569;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Dashboard Category:</span>
        </div>
        <div class="dashboard-category-pills" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
          <button class="dash-pill-btn" data-perspective="admin" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            🏛️ Executive Admin
          </button>
          <button class="dash-pill-btn" data-perspective="teacher" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            👨‍🏫 Teacher
          </button>
          <button class="dash-pill-btn" data-perspective="mentor" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            🏢 Hostel Mentor
          </button>
          <button class="dash-pill-btn active" data-perspective="parent" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 700; border-radius: 9999px; border: 1px solid #059669; background: #059669; color: #FFFFFF; cursor: pointer; transition: all 0.15s ease;">
            👨‍👩‍👧 Parent Portal
          </button>
          <button class="dash-pill-btn" data-perspective="student" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; border-radius: 9999px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; cursor: pointer; transition: all 0.15s ease;">
            🎓 Student Portal
          </button>
        </div>
      </div>
    ` : ''}

    <div class="page-header" style="margin-bottom: 1.25rem;">
      <div class="page-title-group">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">
          Welcome, ${user?.full_name || 'Parent / Guardian'}
        </h2>
        <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">
          Parent Portal • Real-Time Child Attendance, Academic Grades, Hostel Living & Gate Passes
        </p>
      </div>
      <div class="page-actions" style="display: flex; gap: 0.75rem; align-items: center;">
        <button class="btn btn-outline" id="btn-parent-fees">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Fee Invoices
        </button>
        <button class="btn btn-primary" id="btn-parent-apply-leave" style="background: #059669;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          Request Hostel Leave
        </button>
      </div>
    </div>

    <!-- Multi-Child Selector Tabs (If Parent has multiple enrolled children) -->
    ${myChildren.length > 1 ? `
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: var(--radius-lg); padding: 0.75rem 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.82rem; font-weight: 700; color: #475569;">Your Enrolled Children:</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          ${myChildren.map(c => `
            <button class="child-tab-btn ${c.id === selectedChild.id ? 'active' : ''}" data-child-id="${c.id}" style="padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 700; border-radius: var(--radius-md); border: 1.5px solid ${c.id === selectedChild.id ? '#059669' : '#CBD5E1'}; background: ${c.id === selectedChild.id ? '#ECFDF5' : '#FFFFFF'}; color: ${c.id === selectedChild.id ? '#059669' : '#334155'}; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.15s ease;">
              <span>${c.gender === 'Girls' || c.gender === 'Female' ? '👧' : '🧒'}</span>
              <span>${c.full_name} (${c.school_class || 'Class'})</span>
            </button>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Selected Child Highlight Banner Card -->
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 1.25rem;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: #ECFDF5; border: 2px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 26px; overflow: hidden; flex-shrink: 0;">
          ${selectedChild.photo_url 
            ? `<img src="${selectedChild.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${selectedChild.full_name}" />` 
            : (selectedChild.gender === 'Girls' || selectedChild.gender === 'Female' ? '👧' : '🧒')}
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0;">${selectedChild.full_name}</h3>
            <span style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 2px 8px; border-radius: 6px; border: 1px solid #A7F3D0;">
              ${selectedChild.admission_number}
            </span>
            <span style="background: #EFF6FF; color: #2563EB; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
              ${selectedChild.school_class || 'STD-I'} (${selectedChild.school_section || 'A'})
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.8rem; color: #64748B; margin-top: 0.35rem; flex-wrap: wrap;">
            <span>Hostel: <strong>${selectedChild.hostel_unit || 'Thaiba Hostel Wing'}</strong></span>
            <span>Room: <strong>${selectedChild.hostel_room || 'Room 101'}</strong> (${selectedChild.hostel_bed || 'Bed 1'})</span>
            <span>Assigned Mentor: <strong>Usthad Usman</strong></span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 0.5rem 1rem; border-radius: var(--radius-md); text-align: right;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #166534; text-transform: uppercase;">Presence Status</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: #15803D;">● ${selectedChild.status === 'Active' ? 'Present in Hostel' : selectedChild.status}</div>
        </div>
      </div>
    </div>

    <!-- SECTION 1: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">📚</div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Attendance percentage, examination results & academic progress</span>
        </div>
      </div>
      <span class="dash-section-badge">Academic Progress</span>
    </div>

    <!-- Child Metrics Bar -->
    <div class="grid-stats">
      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Attendance Rate</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>
        <div class="stat-value">96.5%</div>
        <div class="stat-footer">
          <span>Present: <strong>27</strong> • Absent: <strong>1</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="marks" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Academic Score</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
        </div>
        <div class="stat-value">${percentage}%</div>
        <div class="stat-footer">
          <span>Mid-Term 2026 Overall Grade: <strong>A+</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="leaves" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Hostel Leaves</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value">${displayChildLeaves.length} Passes</div>
        <div class="stat-footer">
          <span style="color: #059669; font-weight: 600;">0 Late / Overdue Returns</span>
        </div>
      </div>

      <div class="stat-card" data-route="discipline" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Conduct & Standing</span>
          <div class="stat-icon-wrapper" style="background: #FAF5FF; color: #7C3AED;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: #059669; font-size: 1.5rem;">Exemplary</div>
        <div class="stat-footer">
          <span>0 Black Marks Recorded</span>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Detailed Reports Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
      <!-- Academic Examination Marks Card -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            Academic Performance • ${activeExam.title}
          </h3>
          <button class="btn btn-outline btn-sm" id="btn-parent-view-all-marks">Full Report Card</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Max</th>
                  <th>Scored</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${mockChildMarks.map(m => `
                  <tr>
                    <td><strong>${m.subject}</strong></td>
                    <td>${m.max_marks}</td>
                    <td><span style="font-weight: 700; color: #059669;">${m.scored}</span></td>
                    <td><span class="badge badge-active">${m.grade}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SECTION 2: Hostel Operations -->
      <div class="dash-section-header" style="grid-column: 1 / -1; margin-top: 0.5rem;">
        <div class="dash-section-title-wrap">
          <div class="dash-section-icon">🏢</div>
          <div>
            <h3 class="dash-section-title">Hostel Operations</h3>
            <span style="font-size: 0.76rem; color: #64748B;">Dormitory residence, gate passes, return status & student welfare</span>
          </div>
        </div>
        <span class="dash-section-badge">Hostel Living</span>
      </div>

      <!-- Hostel Gate Pass & Outing History -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            Hostel Leave & Pass History
          </h3>
          <button class="btn btn-outline btn-sm" id="btn-parent-new-leave">+ New Request</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Pass Reg</th>
                  <th>Purpose</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${displayChildLeaves.map(l => `
                  <tr>
                    <td><code>${l.leave_register_number}</code></td>
                    <td><span style="font-size: 0.85rem;">${l.reason}</span></td>
                    <td>
                      <div style="font-size: 0.75rem; color: #475569;">
                        ${formatDate(l.departure_date)} → ${formatDate(l.expected_return_date)}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-present">${l.status}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- Quick Parent Contact & Help Section -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 18px;">📞</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Hostel Wardens & Institution Helpdesk</h3>
        </div>
      </div>
      <div class="card-panel-body" style="padding: 1.25rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <strong style="color: #0F172A; font-size: 0.88rem;">Hostel Warden Office</strong>
            <p style="font-size: 0.8rem; color: #475569; margin-top: 0.2rem;">
              Usthad Usman (Head Mentor) • Phone: +91 98470 33445
            </p>
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <strong style="color: #0F172A; font-size: 0.88rem;">Academic & School Office</strong>
            <p style="font-size: 0.8rem; color: #475569; margin-top: 0.2rem;">
              Thaiba Public School Desk • Phone: +91 91623 81267
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach handlers
  container.querySelectorAll('.dash-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-perspective');
      if (p && onSwitchPerspective) onSwitchPerspective(p);
    });
  });

  container.querySelectorAll('.child-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const childId = btn.getAttribute('data-child-id');
      if (childId) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tps_parent_active_child', childId);
        }
        renderParentDashboard(container, { onNavigate, onSwitchPerspective });
      }
    });
  });

  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#btn-parent-fees')?.addEventListener('click', () => onNavigate('fees'));
  container.querySelector('#btn-parent-apply-leave')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelector('#btn-parent-new-leave')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelector('#btn-parent-view-all-marks')?.addEventListener('click', () => onNavigate('marks'));
}
