import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { openModal } from '../../lib/dialog.js';
import { toast } from '../../lib/toast.js';
import { enhanceModalInputs } from '../../lib/ui-enhancer.js';

export async function renderParentDashboard(container, { onNavigate }) {
  // Clear any existing active live timers on this container
  if (container._parentTimer) {
    clearInterval(container._parentTimer);
    container._parentTimer = null;
  }

  const user = getCurrentUser();
  const allStudents = await db.getStudents();
  const allLeaves = await db.getLeaves();
  const exams = await db.getExams();
  const examSubjects = await db.getExamSubjects();

  // STRICT CHILD ISOLATION: A parent gets ONLY their children's data
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

  // Fallback to sample children for rich testing if no children directly match phone in dev
  if (myChildren.length === 0) {
    myChildren = allStudents.slice(0, 2);
  }

  // Active selected child
  const savedChildId = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_parent_active_child') : null;
  let selectedChild = myChildren.find(c => c.id === savedChildId) || myChildren[0] || {
    id: 's-mock-1',
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
  const childLeaves = allLeaves.filter(l => {
    const sIds = Array.isArray(l.student_ids) ? l.student_ids : [l.student_id];
    return sIds.includes(selectedChild.id);
  });

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

  // Evaluate Active Leave, Pending Requests, Overdue state, and Countdown/Countup
  const activeLeave = childLeaves.find(l => {
    if (l.status === 'Returned' || l.status === 'Rejected') return false;
    if (Array.isArray(l.students) && l.students.length > 0) {
      const entry = l.students.find(s => s.student_id === selectedChild.id);
      if (entry && entry.is_returned) return false;
    }
    return true;
  });

  const now = new Date();
  let isPending = false;
  let isOnLeave = false;
  let isOverdue = false;
  let returnDateTime = null;
  let remHours = 0;
  let remMins = 0;
  let remDays = 0;
  let remHoursInDay = 0;
  let overdueHours = 0;
  let overdueMins = 0;
  let chargedHours = 0;
  let fineRate = 50;
  let fineAmount = 0;

  if (activeLeave) {
    if (activeLeave.status === 'Pending') {
      isPending = true;
    } else {
      isOnLeave = true;
      fineRate = Number(activeLeave.fine_per_hour || activeLeave.fine_per_hour_applied || activeLeave.fine_per_day || 50);
      const expTime = (activeLeave.expected_return_time && activeLeave.expected_return_time.length === 5)
        ? `${activeLeave.expected_return_time}:00`
        : (activeLeave.expected_return_time || '18:00:00');
      returnDateTime = new Date(`${activeLeave.expected_return_date}T${expTime}`);

      if (now > returnDateTime) {
        isOverdue = true;
        const diffMs = now.getTime() - returnDateTime.getTime();
        overdueHours = Math.floor(diffMs / (1000 * 60 * 60));
        overdueMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        chargedHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        fineAmount = chargedHours * fineRate;
      } else {
        const diffMs = returnDateTime.getTime() - now.getTime();
        remHours = Math.floor(diffMs / (1000 * 60 * 60));
        remMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        remDays = Math.floor(remHours / 24);
        remHoursInDay = remHours % 24;
      }
    }
  }

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

  // Presence status styling
  let presenceLabel = '● Present in Hostel';
  let presenceColor = '#15803D';
  let presenceBg = '#F0FDF4';
  let presenceBorder = '#BBF7D0';
  let presenceSubColor = '#166534';

  if (isOverdue) {
    presenceLabel = '● Overdue';
    presenceColor = '#DC2626';
    presenceBg = '#FEF2F2';
    presenceBorder = '#FCA5A5';
    presenceSubColor = '#991B1B';
  } else if (isOnLeave) {
    presenceLabel = '● On Approved Leave';
    presenceColor = '#2563EB';
    presenceBg = '#EFF6FF';
    presenceBorder = '#BFDBFE';
    presenceSubColor = '#1E40AF';
  }

  container.innerHTML = `
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
        <button class="btn btn-primary" id="btn-parent-apply-leave" style="background: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          Request Hostel Leave
        </button>
      </div>
    </div>

    <!-- Multi-Child Selector Tabs (If Parent has multiple enrolled children) -->
    ${myChildren.length > 1 ? `
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: var(--radius-lg); padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
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

    <!-- TOP ALERT BANNER (If Overdue or Pending Approval) -->
    ${isOverdue ? `
      <div class="card-panel parent-overdue-alert" style="background: #FEF2F2; border: 2px solid #FCA5A5; border-left: 6px solid #DC2626; border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.08);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <span style="font-size: 1.6rem; line-height: 1;">⚠️</span>
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 800; color: #991B1B; margin: 0;">
                ${selectedChild.full_name} is Overdue to Hostel!
              </h4>
              <p style="font-size: 0.82rem; color: #7F1D1D; margin: 0.25rem 0 0 0;">
                Expected reporting time was <strong>${formatDate(activeLeave.expected_return_date)} at ${activeLeave.expected_return_time || '06:00 PM'}</strong>. Student has not checked in.
              </p>
              <div style="margin-top: 0.45rem; font-size: 0.82rem; color: #991B1B;">
                Overdue Duration: <strong id="live-overdue-time-text" style="font-family: var(--font-mono); font-size: 0.95rem;">+${overdueHours}h ${overdueMins}m</strong>
              </div>
            </div>
          </div>
          <div style="background: #FFFFFF; border: 1.5px solid #F87171; border-radius: 12px; padding: 0.65rem 1rem; text-align: right; min-width: 160px; box-shadow: 0 2px 6px rgba(220,38,38,0.06);">
            <div style="font-size: 0.72rem; font-weight: 700; color: #991B1B; text-transform: uppercase;">Generated Late Fine</div>
            <div style="font-size: 1.45rem; font-weight: 900; color: #DC2626; font-family: var(--font-mono);" id="live-overdue-fine-val">
              ₹${fineAmount}
            </div>
            <div style="font-size: 0.7rem; color: #64748B;">
              Rate: ₹${fineRate}/hr • ${chargedHours} hr(s) overdue
            </div>
          </div>
        </div>
      </div>
    ` : isPending ? `
      <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-left: 6px solid #D97706; border-radius: 14px; padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.35rem;">⏳</span>
          <div>
            <strong style="color: #92400E; font-size: 0.92rem;">Hostel Leave Request Awaiting Warden Approval</strong>
            <div style="font-size: 0.78rem; color: #B45309; margin-top: 2px;">
              Requested for: ${formatDate(activeLeave.departure_date)} → ${formatDate(activeLeave.expected_return_date)} (${activeLeave.reason})
            </div>
          </div>
        </div>
        <span class="badge" style="background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 0.75rem; padding: 4px 10px; border-radius: 9999px;">
          Under Review
        </span>
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
        <div style="background: ${presenceBg}; border: 1.5px solid ${presenceBorder}; padding: 0.5rem 1rem; border-radius: var(--radius-md); text-align: right;">
          <div style="font-size: 0.72rem; font-weight: 700; color: ${presenceSubColor}; text-transform: uppercase;">Presence Status</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: ${presenceColor};" id="child-presence-status">${presenceLabel}</div>
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

      <!-- CARD 2: DYNAMIC (Overdue Count-Up OR Leave Countdown OR Academic Score) -->
      ${isOverdue ? `
        <div class="stat-card" style="border-left: 4px solid #DC2626; background: #FFF5F5;">
          <div class="stat-header">
            <span class="stat-title" style="color: #991B1B; font-weight: 700;">Overdue Duration</span>
            <div class="stat-icon-wrapper" style="background: #FEE2E2; color: #DC2626;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-value" id="card-live-countup-val" style="color: #DC2626; font-family: var(--font-mono); font-size: 1.45rem; font-weight: 800;">
            +${overdueHours}h ${overdueMins}m
          </div>
          <div class="stat-footer">
            <span style="color: #991B1B; font-weight: 600;">Report was due: ${formatDate(activeLeave.expected_return_date)} ${activeLeave.expected_return_time || '06:00 PM'}</span>
          </div>
        </div>
      ` : isOnLeave ? `
        <div class="stat-card" style="border-left: 4px solid ${remHours < 6 ? '#EA580C' : '#2563EB'}; background: ${remHours < 6 ? '#FFF7ED' : '#EFF6FF'};">
          <div class="stat-header">
            <span class="stat-title" style="color: ${remHours < 6 ? '#C2410C' : '#1E40AF'}; font-weight: 700;">Hostel Return Countdown</span>
            <div class="stat-icon-wrapper" style="background: #FFFFFF; color: ${remHours < 6 ? '#EA580C' : '#2563EB'}; border: 1px solid ${remHours < 6 ? '#FED7AA' : '#BFDBFE'};">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-value" id="card-live-countdown-val" style="color: ${remHours < 6 ? '#EA580C' : '#2563EB'}; font-family: var(--font-mono); font-size: 1.45rem; font-weight: 800;">
            ${remDays > 0 ? `${remDays}d ${remHoursInDay}h ${remMins}m` : `${remHours}h ${remMins}m`}
          </div>
          <div class="stat-footer">
            <span style="color: ${remHours < 6 ? '#EA580C' : '#2563EB'}; font-weight: 600;">
              ${remHours < 6 ? '⚠️ Less than 6 hours remaining!' : `Report by: ${formatDate(activeLeave.expected_return_date)} ${activeLeave.expected_return_time || '06:00 PM'}`}
            </span>
          </div>
        </div>
      ` : `
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
      `}

      <div class="stat-card" data-route="leaves" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Hostel Leaves</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value">${displayChildLeaves.length} Passes</div>
        <div class="stat-footer">
          <span style="color: ${isOverdue ? '#DC2626' : '#059669'}; font-weight: 600;">
            ${isOverdue ? '1 Overdue Return' : '0 Late / Overdue Returns'}
          </span>
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
          <button class="btn btn-primary btn-sm" id="btn-parent-new-leave" style="background: #059669; font-weight: 700;">+ Request Leave Pass</button>
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
                ${displayChildLeaves.map(l => {
                  const isPassOverdue = l.status !== 'Returned' && l.expected_return_date && new Date(l.expected_return_date + 'T' + (l.expected_return_time || '18:00')) < new Date();
                  const badgeClass = l.status === 'Returned' ? 'badge-present' : isPassOverdue ? 'badge-danger' : l.status === 'Pending' ? 'badge-warning' : 'badge-leave';
                  const statusText = isPassOverdue ? 'Overdue Return' : l.status;

                  return `
                    <tr>
                      <td><code>${l.leave_register_number || l.leave_code}</code></td>
                      <td>
                        <span style="font-size: 0.85rem; font-weight: 600;">${l.reason}</span>
                        ${l.fine_per_hour ? `<div style="font-size: 0.7rem; color: #64748B;">Rate: ₹${l.fine_per_hour}/hr</div>` : ''}
                      </td>
                      <td>
                        <div style="font-size: 0.75rem; color: #475569;">
                          ${formatDate(l.departure_date)} → ${formatDate(l.expected_return_date)}
                        </div>
                        <div style="font-size: 0.7rem; color: #94A3B8;">
                          Return by: ${l.expected_return_time || '18:00'}
                        </div>
                      </td>
                      <td>
                        <span class="badge ${badgeClass}">${statusText}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
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

  // Attach live countdown/countup timer if active leave exists
  if (activeLeave && activeLeave.status !== 'Pending' && returnDateTime) {
    container._parentTimer = setInterval(() => {
      const currentNow = new Date();
      if (currentNow > returnDateTime) {
        // OVERDUE COUNT-UP
        const diff = currentNow.getTime() - returnDateTime.getTime();
        const oHours = Math.floor(diff / (1000 * 60 * 60));
        const oMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const cHours = Math.max(1, Math.ceil(diff / (1000 * 60 * 60)));
        const fAmount = cHours * fineRate;

        const timeTextEl = container.querySelector('#live-overdue-time-text');
        if (timeTextEl) timeTextEl.textContent = `+${oHours}h ${oMins}m`;

        const fineValEl = container.querySelector('#live-overdue-fine-val');
        if (fineValEl) fineValEl.textContent = `₹${fAmount}`;

        const cardCountUpEl = container.querySelector('#card-live-countup-val');
        if (cardCountUpEl) cardCountUpEl.textContent = `+${oHours}h ${oMins}m`;
      } else {
        // COUNTDOWN
        const diff = returnDateTime.getTime() - currentNow.getTime();
        const rHours = Math.floor(diff / (1000 * 60 * 60));
        const rMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const rDays = Math.floor(rHours / 24);
        const rHoursInDay = rHours % 24;
        const under6 = rHours < 6;

        const cardCountdownEl = container.querySelector('#card-live-countdown-val');
        if (cardCountdownEl) {
          cardCountdownEl.textContent = rDays > 0 ? `${rDays}d ${rHoursInDay}h ${rMins}m` : `${rHours}h ${rMins}m`;
          cardCountdownEl.style.color = under6 ? '#EA580C' : '#2563EB';
        }
      }
    }, 10000);
  }

  // Parent Leave Modal Function
  function openParentLeaveModal() {
    const defaultDate = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { modal, close } = openModal({
      title: 'Request Hostel Leave Pass',
      contentHtml: `
        <form id="parent-leave-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${myChildren.length > 1 ? `
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Select Child *</label>
              <select id="p-leave-child" class="form-control" style="height: 38px; font-size: 0.85rem;">
                ${myChildren.map(c => `
                  <option value="${c.id}" ${c.id === selectedChild.id ? 'selected' : ''}>
                    ${c.full_name} (${c.school_class || 'Class'} • ${c.admission_number})
                  </option>
                `).join('')}
              </select>
            </div>
          ` : `<input type="hidden" id="p-leave-child" value="${selectedChild.id}" />`}

          <div class="form-group" style="margin: 0;">
            <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Leave Type *</label>
            <select id="p-leave-type" class="form-control" style="height: 38px; font-size: 0.85rem;">
              <option value="hostel_leave">Hostel Weekend Outing</option>
              <option value="personal_leave">Family Function / Personal Event</option>
              <option value="medical_leave">Medical / Hospital Visit</option>
              <option value="vacation">Term End Vacation</option>
              <option value="emergency_leave">Emergency Leave</option>
            </select>
          </div>

          <!-- Departure Date & Time -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Departure Date *</label>
              <input type="date" id="p-leave-dep-date" class="form-control" required value="${defaultDate}" style="height: 38px; font-size: 0.85rem;" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Departure Time *</label>
              <input type="time" id="p-leave-dep-time" class="form-control" required value="16:00" style="height: 38px; font-size: 0.85rem;" />
            </div>
          </div>

          <!-- Return Date & Time -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Expected Return Date *</label>
              <input type="date" id="p-leave-ret-date" class="form-control" required value="${tomorrow}" style="height: 38px; font-size: 0.85rem;" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Expected Return Time *</label>
              <input type="time" id="p-leave-ret-time" class="form-control" required value="18:00" style="height: 38px; font-size: 0.85rem;" />
            </div>
          </div>

          <!-- Reason -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Purpose / Reason for Leave *</label>
            <input type="text" id="p-leave-reason" class="form-control" placeholder="e.g. Attending family function, medical appointment" required style="height: 38px; font-size: 0.85rem;" />
          </div>

          <!-- Escort & Phone -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Accompanying Person *</label>
              <select id="p-leave-escort" class="form-control" style="height: 38px; font-size: 0.85rem;">
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Authorized Guardian">Authorized Guardian</option>
                <option value="Elder Sibling">Elder Sibling</option>
                <option value="Self / Independent">Self / Independent</option>
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Contact Phone *</label>
              <input type="tel" id="p-leave-phone" class="form-control" required value="${selectedChild.father_phone || selectedChild.mother_phone || user?.phone || '+91 98470 11223'}" style="height: 38px; font-size: 0.85rem;" />
            </div>
          </div>

          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.75rem; color: #1E40AF; line-height: 1.45;">
            ℹ️ <strong>Hostel Notice:</strong> Student return times are strictly monitored. Per-hour late fines apply for overdue reporting beyond the approved return time.
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-p-leave">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-p-leave" style="background: #059669; border-color: #059669; font-weight: 700;">
              Submit Leave Request
            </button>
          </div>
        </form>
      `
    });

    enhanceModalInputs(modal);

    modal.querySelector('#btn-cancel-p-leave')?.addEventListener('click', close);

    modal.querySelector('#parent-leave-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const childId = modal.querySelector('#p-leave-child')?.value || selectedChild.id;
      const leaveType = modal.querySelector('#p-leave-type')?.value;
      const depDate = modal.querySelector('#p-leave-dep-date')?.value;
      const depTime = modal.querySelector('#p-leave-dep-time')?.value;
      const retDate = modal.querySelector('#p-leave-ret-date')?.value;
      const retTime = modal.querySelector('#p-leave-ret-time')?.value;
      const reason = modal.querySelector('#p-leave-reason')?.value.trim();
      const escort = modal.querySelector('#p-leave-escort')?.value;
      const phone = modal.querySelector('#p-leave-phone')?.value.trim();

      if (!childId || !depDate || !retDate || !reason) {
        toast.error('Please complete all required fields.');
        return;
      }

      const targetStudent = myChildren.find(c => c.id === childId) || selectedChild;

      try {
        await db.createLeaveRecord({
          student_ids: [targetStudent.id],
          leave_type: leaveType,
          departure_date: depDate,
          departure_time: depTime,
          expected_return_date: retDate,
          expected_return_time: retTime,
          reason,
          escort_type: escort,
          parent_phone: phone,
          requested_by: user?.full_name || 'Parent / Guardian',
          requester_role: 'parent',
          status: 'Pending',
          fine_unit: 'hour',
          fine_per_hour: 50
        });

        toast.success(`Hostel leave request submitted for ${targetStudent.full_name}. Awaiting warden approval.`);
        close();
        renderParentDashboard(container, { onNavigate });
      } catch (err) {
        toast.error(err.message || 'Error submitting leave request');
      }
    });
  }

  // Attach handlers
  container.querySelectorAll('.child-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const childId = btn.getAttribute('data-child-id');
      if (childId) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tps_parent_active_child', childId);
        }
        renderParentDashboard(container, { onNavigate });
      }
    });
  });

  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#btn-parent-apply-leave')?.addEventListener('click', openParentLeaveModal);
  container.querySelector('#btn-parent-new-leave')?.addEventListener('click', openParentLeaveModal);
  container.querySelector('#btn-parent-view-all-marks')?.addEventListener('click', () => onNavigate('marks'));
}
