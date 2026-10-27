import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate } from '../../lib/utils.js';

export async function renderStudentDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const allStudents = await db.getStudents();
  const allLeaves = await db.getLeaves();
  const exams = await db.getExams();

  // Identify student record
  const student = allStudents.find(s => 
    (user?.admission_number && s.admission_number === user.admission_number) ||
    (user?.email && s.email && s.email.toLowerCase() === user.email.toLowerCase()) ||
    (user?.full_name && s.full_name && s.full_name.toLowerCase() === user.full_name.toLowerCase()) ||
    s.admission_number === 'TPS-2026-001'
  ) || allStudents[0] || {
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

  const studentLeaves = allLeaves.filter(l => l.student_id === student.id);
  const displayLeaves = studentLeaves.length > 0 ? studentLeaves : [
    {
      leave_register_number: 'LR-2026-055',
      reason: 'Weekend Home Visit',
      expected_return_date: '2026-10-28',
      status: 'Active Pass'
    }
  ];

  // Daily timetable schedule for the student
  const todayClasses = [
    { time: '06:00 - 07:00 AM', subject: 'Hostel Moral Class', topic: 'Morning Hadith & Character', room: 'Moral Hall A1', teacher: 'Rashid Sir' },
    { time: '09:00 - 10:00 AM', subject: 'Mathematics', topic: 'Number Operations & Geometry', room: 'Classroom 101', teacher: 'Usthad Usman' },
    { time: '11:00 - 12:00 PM', subject: 'Arabic Language', topic: 'Grammar & Vocabulary', room: 'Language Lab', teacher: 'Rashid Sir' },
    { time: '04:30 - 06:00 PM', subject: 'Hostel Supervised Study', topic: 'Evening Homework & Revision', room: 'Study Hall', teacher: 'Hostel Mentor' }
  ];

  const activeExam = exams[0] || { title: 'Mid-Term Examination 2026' };
  const mockMarks = [
    { subject: 'Moral Studies & Ethics', max_marks: 100, scored: 94, grade: 'A+' },
    { subject: 'Arabic Language', max_marks: 100, scored: 88, grade: 'A' },
    { subject: 'Mathematics', max_marks: 100, scored: 92, grade: 'A+' },
    { subject: 'General Science', max_marks: 100, scored: 90, grade: 'A+' },
    { subject: 'English', max_marks: 100, scored: 86, grade: 'A' }
  ];

  container.innerHTML = `
    <!-- Student Welcome Hero Banner Card -->
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 1.25rem;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: #ECFDF5; border: 2px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 26px; overflow: hidden; flex-shrink: 0;">
          ${student.photo_url 
            ? `<img src="${student.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${student.full_name}" />` 
            : '🎓'}
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0;">Welcome, ${student.full_name}</h3>
            <span style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 2px 8px; border-radius: 6px; border: 1px solid #A7F3D0;">
              ${student.admission_number}
            </span>
            <span style="background: #EFF6FF; color: #2563EB; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
              ${student.school_class || 'STD-I'} (${student.school_section || 'A'})
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.8rem; color: #64748B; margin-top: 0.35rem; flex-wrap: wrap;">
            <span>Hostel: <strong>${student.hostel_unit || 'Thaiba Boys Block A'}</strong></span>
            <span>Room: <strong>${student.hostel_room || 'Room 101'}</strong> (${student.hostel_bed || 'Bed 1'})</span>
            <span>Mentor: <strong>Usthad Usman</strong></span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 0.5rem 1rem; border-radius: var(--radius-md); text-align: right;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #166534; text-transform: uppercase;">Hostel Status</div>
          <div style="font-size: 0.92rem; font-weight: 800; color: #15803D;">● In Residence (Present)</div>
        </div>
      </div>
    </div>

    <!-- SECTION 1: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">📚</div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Attendance records, class schedule & exam results</span>
        </div>
      </div>
      <span class="dash-section-badge">Student Studies</span>
    </div>

    <!-- Student Quick Metrics Grid -->
    <div class="grid-stats">
      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">My Attendance</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>
        <div class="stat-value">96.5%</div>
        <div class="stat-footer">
          <span>27 Days Present • 1 Leave</span>
        </div>
      </div>

      <div class="stat-card" data-route="marks" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Exam Grade</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
        </div>
        <div class="stat-value">A+</div>
        <div class="stat-footer">
          <span>Mid-Term 2026 Score: <strong>90.0%</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="leaves" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Gate Pass Status</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value" style="font-size: 1.4rem;">In Campus</div>
        <div class="stat-footer">
          <span style="color: #059669; font-weight: 600;">No Overdue Fines</span>
        </div>
      </div>

      <div class="stat-card" data-route="discipline" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Conduct Standing</span>
          <div class="stat-icon-wrapper" style="background: #FAF5FF; color: #7C3AED;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: #059669; font-size: 1.4rem;">Clean</div>
        <div class="stat-footer">
          <span>0 Black Marks Recorded</span>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Schedule & Academic Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
      <!-- Today's Class Schedule -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Today's Class Schedule</h3>
          <span class="badge badge-active">${todayClasses.length} Classes Today</span>
        </div>
        <div class="card-panel-body" style="padding: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${todayClasses.map(c => `
              <div style="border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.75rem 1rem; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div>
                  <div style="font-size: 0.9rem; font-weight: 700; color: #0F172A;">${c.subject}</div>
                  <div style="font-size: 0.78rem; color: #64748B; margin-top: 0.1rem;">
                    ${c.topic} • ${c.room} • <em>${c.teacher}</em>
                  </div>
                </div>
                <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid #A7F3D0; white-space: nowrap;">
                  ${c.time}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- My Academic Results & Performance -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            My Results • ${activeExam.title}
          </h3>
          <button class="btn btn-outline btn-sm" id="btn-student-view-marks">View Report Card</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Max</th>
                  <th>My Score</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${mockMarks.map(m => `
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

    </div>

    <!-- SECTION 2: Hostel Operations -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">🏢</div>
        <div>
          <h3 class="dash-section-title">Hostel Operations</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Dormitory living, gate passes, curfew safety & announcements</span>
        </div>
      </div>
      <span class="dash-section-badge">Dormitory Life</span>
    </div>

    <!-- Student Noticeboard -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 18px;">📢</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Hostel & School Announcements</h3>
        </div>
        <button class="btn btn-outline btn-sm" id="btn-student-view-notices">All Notices</button>
      </div>
      <div class="card-panel-body" style="padding: 1.25rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <strong style="color: #0F172A; font-size: 0.88rem;">🕌 Maghrib & Night Study Schedule</strong>
            <p style="font-size: 0.8rem; color: #475569; margin-top: 0.2rem;">
              Supervised evening study begins promptly at 07:15 PM in the Study Lab. Bring all textbooks.
            </p>
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <strong style="color: #0F172A; font-size: 0.88rem;">📅 Upcoming Weekend Leave Request Deadline</strong>
            <p style="font-size: 0.8rem; color: #475569; margin-top: 0.2rem;">
              Parents must submit weekend hostel leave requests by Thursday 05:00 PM through the parent portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach handlers
  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#btn-student-view-marks')?.addEventListener('click', () => onNavigate('marks'));
  container.querySelector('#btn-student-view-notices')?.addEventListener('click', () => onNavigate('notices'));
}
