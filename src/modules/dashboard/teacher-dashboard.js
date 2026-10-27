import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';

export async function renderTeacherDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const classrooms = await db.getClassrooms();
  const programs = await db.getPrograms();
  const exams = await db.getExams();
  const examSubjects = await db.getExamSubjects();
  const students = await db.getStudents();

  // Determine teacher name & assigned subjects
  const teacherName = user?.full_name || 'Rashid Sir';

  // Timetable slots assigned to this teacher
  const allTeacherSlots = [
    { id: 'tt-1', day: 'Monday', start_time: '06:00', end_time: '07:00', program: 'Hostel Moral Class', classroom: 'Moral Hall A1', teacher: 'Rashid Sir', session_title: 'Morning Hadith & Ethics', room: '101' },
    { id: 'tt-3', day: 'Monday', start_time: '17:00', end_time: '18:30', program: 'School Coaching Class', classroom: 'Main Academic Lab 1', teacher: 'Rashid Sir', session_title: 'Arabic Language Class', room: '301' },
    { id: 'tt-4', day: 'Tuesday', start_time: '06:00', end_time: '07:00', program: 'Hostel Moral Class', classroom: 'Moral Hall A1', teacher: 'Rashid Sir', session_title: 'Morning Fiqh & Character', room: '101' },
    { id: 'tt-5', day: 'Wednesday', start_time: '17:00', end_time: '18:30', program: 'School Coaching Class', classroom: 'Main Academic Lab 1', teacher: 'Rashid Sir', session_title: 'Tajweed & Recitation', room: '301' },
    { id: 'tt-6', day: 'Thursday', start_time: '06:00', end_time: '07:00', program: 'Hostel Moral Class', classroom: 'Moral Hall A1', teacher: 'Rashid Sir', session_title: 'Islamic History & Values', room: '101' }
  ];

  // Filter slots for this teacher (or show default teacher slots)
  const mySlots = allTeacherSlots.filter(s => 
    s.teacher.toLowerCase().includes(teacherName.toLowerCase().split(' ')[0]) || 
    teacherName.toLowerCase().includes('rashid') ||
    user?.is_super_admin || user?.role === 'admin'
  );

  const todaySlots = mySlots.slice(0, 2);
  const myClassrooms = classrooms.slice(0, 3);
  const activeExam = exams[0] || { title: 'Mid-Term Examination 2026' };
  const myExamSubjects = examSubjects.slice(0, 2);

  // Calculate enrolled students in teacher's classes
  const totalStudentsTaught = students.filter(s => s.status === 'Active').length;

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 1.5rem;">
      <div class="page-title-group">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #ECFDF5; border: 1.5px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            👨‍🏫
          </div>
          <div>
            <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">Welcome, ${teacherName}</h2>
            <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">Faculty & Academic Dashboard • Teaching Schedule, Attendance Windows & Marks Entry</p>
          </div>
        </div>
      </div>
      <div class="page-actions" style="display: flex; gap: 0.75rem; align-items: center;">
        <button class="btn btn-outline" id="teacher-view-timetable-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Full Timetable
        </button>
        <button class="btn btn-primary" id="teacher-mark-attendance-btn" style="background: #059669;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Take Attendance
        </button>
      </div>
    </div>

    <!-- SECTION 1: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">📚</div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Teaching schedule, attendance windows, classrooms & grade sheets</span>
        </div>
      </div>
      <span class="dash-section-badge">Faculty Load</span>
    </div>

    <!-- Attendance Window Rules Banner -->
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-lg); padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 22px;">⏱️</span>
        <div>
          <strong style="color: #166534; font-size: 0.9rem;">Server-Synchronized Attendance Windows Active</strong>
          <p style="font-size: 0.8rem; color: #15803D; margin-top: 0.1rem;">
            Attendance window opens <strong>5 minutes before</strong> class and closes <strong>15 minutes after</strong> class completion.
          </p>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-quick-window-attendance" style="background: #FFFFFF; font-weight: 700; color: #166534; border-color: #86EFAC;">
        Take Live Attendance Now →
      </button>
    </div>

    <!-- Teacher Statistical Metrics Bar -->
    <div class="grid-stats">
      <div class="stat-card" data-route="timetable" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Today's Sessions</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="stat-value">${todaySlots.length}</div>
        <div class="stat-footer">
          <span>Scheduled sessions today</span>
        </div>
      </div>

      <div class="stat-card" data-route="timetable" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Weekly Load</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <div class="stat-value">${mySlots.length}</div>
        <div class="stat-footer">
          <span>Total teaching hours / week</span>
        </div>
      </div>

      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Students Taught</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="stat-value">${totalStudentsTaught}</div>
        <div class="stat-footer">
          <span>Enrolled across active batches</span>
        </div>
      </div>

      <div class="stat-card" data-route="marks" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Exam Grading</span>
          <div class="stat-icon-wrapper" style="background: #FAF5FF; color: #7C3AED;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
        </div>
        <div class="stat-value">${myExamSubjects.length} Subj</div>
        <div class="stat-footer">
          <span style="color: #059669; font-weight: 600;">Mid-Term 2026 Ready</span>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Content -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
      <!-- Today's Teaching Schedule -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Today's Teaching Schedule</h3>
          <span class="badge badge-active">${todaySlots.length} Sessions Today</span>
        </div>
        <div class="card-panel-body" style="padding: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${todaySlots.map((slot, idx) => `
              <div style="border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="width: 36px; height: 36px; border-radius: 8px; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">
                    0${idx + 1}
                  </div>
                  <div>
                    <h4 style="font-size: 0.92rem; font-weight: 700; color: #0F172A; margin: 0;">${slot.session_title}</h4>
                    <div style="font-size: 0.78rem; color: #64748B; margin-top: 0.15rem;">
                      <span>${slot.program}</span> • <span>Room ${slot.room || '101'}</span>
                    </div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid #A7F3D0;">
                    ${slot.start_time} - ${slot.end_time}
                  </span>
                  <button class="btn btn-outline btn-sm btn-mark-slot-attendance" data-slot="${slot.id}" style="font-size: 0.78rem; font-weight: 600;">
                    Mark Attendance
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- My Assigned Classes & Examination Subjects -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Assigned Examination Subjects</h3>
          <button class="btn btn-outline btn-sm" id="btn-open-marks-module">Enter Marks</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Max Marks</th>
                  <th>Pass Mark</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${myExamSubjects.map(sub => `
                  <tr>
                    <td>
                      <strong>${sub.subject}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${activeExam.title}</div>
                    </td>
                    <td><span style="font-weight: 700;">${sub.max_marks}</span></td>
                    <td><span style="color: #059669; font-weight: 600;">${sub.passing_marks}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm btn-grade-subject" data-subject="${sub.subject}" style="font-size: 0.75rem;">
                        Grading Sheet →
                      </button>
                    </td>
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
          <span style="font-size: 0.76rem; color: #64748B;">Supervised evening study halls & hostel coaching coordination</span>
        </div>
      </div>
      <span class="dash-section-badge">Residential Support</span>
    </div>

    <!-- Faculty Guidelines & Notices -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Teacher Guidelines & Academic Circulars</h3>
        <button class="btn btn-outline btn-sm" id="btn-view-faculty-notices">View All Notices</button>
      </div>
      <div class="card-panel-body" style="padding: 1rem 1.25rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span style="font-size: 16px;">📖</span>
              <strong style="color: #0F172A; font-size: 0.88rem;">Morning Moral Class Protocol</strong>
            </div>
            <p style="font-size: 0.8rem; color: #475569; line-height: 1.4;">
              Ensure student presence is locked by 06:15 AM. Any late arrivals must be flagged with a late marker in the register.
            </p>
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span style="font-size: 16px;">📝</span>
              <strong style="color: #0F172A; font-size: 0.88rem;">Mid-Term Evaluation Window</strong>
            </div>
            <p style="font-size: 0.8rem; color: #475569; line-height: 1.4;">
              Subject mark entry for Moral Studies & Arabic closes on Friday. Verify scores before publishing results.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#teacher-view-timetable-btn')?.addEventListener('click', () => onNavigate('timetable'));
  container.querySelector('#teacher-mark-attendance-btn')?.addEventListener('click', () => onNavigate('attendance'));
  container.querySelector('#btn-quick-window-attendance')?.addEventListener('click', () => onNavigate('attendance'));
  container.querySelector('#btn-open-marks-module')?.addEventListener('click', () => onNavigate('marks'));
  container.querySelector('#btn-view-faculty-notices')?.addEventListener('click', () => onNavigate('notices'));

  container.querySelectorAll('.btn-mark-slot-attendance').forEach(b => {
    b.addEventListener('click', () => onNavigate('attendance'));
  });

  container.querySelectorAll('.btn-grade-subject').forEach(b => {
    b.addEventListener('click', () => onNavigate('marks'));
  });
}
