import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatTime } from '../../lib/utils.js';

export async function renderTeacherDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const classrooms = await db.getClassrooms();
  const programs = await db.getPrograms();
  const exams = await db.getExams();
  const examSubjects = await db.getExamSubjects();
  const students = await db.getStudents();

  // Determine teacher name & assigned classrooms
  const teacherName = user?.full_name || 'Rashid Sir';
  const teacherId = user?.id;

  // Filter classrooms assigned to this teacher
  const myClassrooms = classrooms.filter(c => 
    c.teacher_id === teacherId || 
    (user.email && c.teacher_id === user.email) ||
    (!c.teacher_id && user.role === 'teacher') // fallback if demo
  );

  // Current day & time evaluation for 20-minute notification & live windows
  const now = new Date();
  const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayKey = DAY_KEYS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function parseMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  // Today's scheduled classes for this teacher
  const todayClasses = myClassrooms.filter(c => {
    const days = Array.isArray(c.days) && c.days.length > 0 ? c.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.includes(todayKey);
  });

  // Calculate upcoming class within 20 minutes and currently in-session class
  let upcomingSoonClass = null;
  let inSessionClass = null;

  todayClasses.forEach(c => {
    const sMin = parseMinutes(c.start_time);
    const eMin = parseMinutes(c.end_time);

    if (currentMinutes >= (sMin - 20) && currentMinutes < sMin) {
      upcomingSoonClass = { ...c, minutesLeft: sMin - currentMinutes };
    } else if (currentMinutes >= sMin && currentMinutes <= eMin) {
      inSessionClass = { ...c, minutesRemaining: eMin - currentMinutes };
    }
  });

  const todaySlots = todayClasses.length > 0 ? todayClasses.map((c, idx) => {
    const prog = programs.find(p => p.id === c.program_id);
    return {
      id: `slot-${c.id}`,
      session_title: `${c.name} (${prog?.name || 'Class'})`,
      program: prog?.name || 'Academic Program',
      room: c.room_number || 'Campus',
      start_time: formatTime(c.start_time || '06:30'),
      end_time: formatTime(c.end_time || '07:30')
    };
  }) : [
    {
      id: 'slot-default-1',
      session_title: 'Moral Hall A1 (Hostel Moral Class)',
      program: 'Hostel Moral Class',
      room: '101',
      start_time: '06:30 AM',
      end_time: '07:30 AM'
    }
  ];

  // Calculate weekly slots
  let weeklySlotCount = 0;
  myClassrooms.forEach(c => {
    const days = Array.isArray(c.days) && c.days.length > 0 ? c.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weeklySlotCount += days.length;
  });

  const totalStudentsTaught = students.filter(s => s.status === 'Active').length;
  const activeExam = exams[0] || { title: 'Mid-Term Examination 2026' };
  const myExamSubjects = examSubjects.slice(0, 2);

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
          My Timetable
        </button>
        <button class="btn btn-primary" id="teacher-mark-attendance-btn" style="background: #059669;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Take Attendance
        </button>
      </div>
    </div>

    <!-- 20-MINUTE CLASS NOTIFICATION ALERT & IN-SESSION BANNER -->
    ${upcomingSoonClass ? `
      <div class="teacher-alert-card upcoming" style="background: #FFFBEB; border: 2px solid #FCD34D; border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #FEF3C7; border: 1.5px solid #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🔔
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <strong style="color: #92400E; font-size: 0.95rem;">UPCOMING CLASS NOTIFICATION (Starting in ${upcomingSoonClass.minutesLeft} min)</strong>
              <span class="badge" style="background: #F59E0B; color: #FFFFFF; font-weight: 700; font-size: 0.72rem;">Starts at ${formatTime(upcomingSoonClass.start_time)}</span>
            </div>
            <p style="font-size: 0.82rem; color: #B45309; margin-top: 0.2rem;">
              <strong>${upcomingSoonClass.name}</strong> • ${upcomingSoonClass.room_number ? 'Room ' + upcomingSoonClass.room_number : 'Campus'} • Attendance window opens at class start time.
            </p>
          </div>
        </div>
        <button class="btn btn-primary btn-sm btn-dash-goto-att" data-cls-id="${upcomingSoonClass.id}" style="background: #D97706; border-color: #B45309; font-weight: 700; padding: 0.55rem 1.15rem;">
          Ready to Take Attendance →
        </button>
      </div>
    ` : inSessionClass ? `
      <div class="teacher-alert-card live" style="background: #ECFDF5; border: 2px solid #34D399; border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #D1FAE5; border: 1.5px solid #10B981; display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🟢
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <strong style="color: #065F46; font-size: 0.95rem;">LIVE ATTENDANCE WINDOW ACTIVE NOW</strong>
              <span class="badge badge-active" style="font-weight: 700; font-size: 0.72rem;">Active until ${formatTime(inSessionClass.end_time)}</span>
            </div>
            <p style="font-size: 0.82rem; color: #047857; margin-top: 0.2rem;">
              <strong>${inSessionClass.name}</strong> is in session. Take and submit attendance now. Submitting records both student and faculty duty attendance.
            </p>
          </div>
        </div>
        <button class="btn btn-primary btn-sm btn-dash-goto-att" data-cls-id="${inSessionClass.id}" style="background: #059669; border-color: #047857; font-weight: 700; padding: 0.55rem 1.15rem;">
          Take Live Attendance Now →
        </button>
      </div>
    ` : `
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-lg); padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 22px;">⏱️</span>
          <div>
            <strong style="color: #166534; font-size: 0.9rem;">Class-Time Locked Attendance Windows Enabled</strong>
            <p style="font-size: 0.8rem; color: #15803D; margin-top: 0.1rem;">
              Attendance opens automatically at class start time. You will receive an alert <strong>20 minutes before</strong> class.
            </p>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" id="btn-quick-window-attendance" style="background: #FFFFFF; font-weight: 700; color: #166534; border-color: #86EFAC;">
          View Attendance Window →
        </button>
      </div>
    `}

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

    <!-- Teacher Statistical Metrics Bar -->
    <div class="grid-stats">
      <div class="stat-card" data-route="timetable" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Today's Sessions</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="stat-value">${todayClasses.length}</div>
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
        <div class="stat-value">${weeklySlotCount}</div>
        <div class="stat-footer">
          <span>Total teaching sessions / week</span>
        </div>
      </div>

      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">My Classrooms</span>
          <div class="stat-icon-wrapper" style="background: #F5F3FF; color: #7C3AED;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
        </div>
        <div class="stat-value">${myClassrooms.length}</div>
        <div class="stat-footer">
          <span>Assigned teaching classrooms</span>
        </div>
      </div>

      <div class="stat-card" data-route="students" style="cursor: pointer;">
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

  container.querySelectorAll('.btn-dash-goto-att').forEach(b => {
    b.addEventListener('click', () => {
      const clsId = b.getAttribute('data-cls-id');
      if (clsId) {
        sessionStorage.setItem('tps_active_att_cls', clsId);
      }
      onNavigate('attendance');
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
