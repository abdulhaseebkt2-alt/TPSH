import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatTime, formatDate, formatDaysSingleLetters } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';

export async function renderTeacherDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const [
    classrooms,
    programs,
    exams,
    examSubjects,
    students,
    attendanceRecords,
    facultyLeaves
  ] = await Promise.all([
    db.getClassrooms(),
    db.getPrograms(),
    db.getExams(),
    db.getExamSubjects(),
    db.getStudents(),
    db.getAttendanceRecords(),
    db.getFacultyLeaves()
  ]);

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

  // Sort today's classes chronologically
  const sortedTodayClasses = [...todayClasses].sort((a, b) => parseMinutes(a.start_time) - parseMinutes(b.start_time));

  // Calculate upcoming class within 20 minutes and currently in-session class
  const inSessionClass = sortedTodayClasses.find(c => {
    const s = parseMinutes(c.start_time);
    const e = parseMinutes(c.end_time);
    return currentMinutes >= s && currentMinutes <= e;
  });

  const upcomingSoonClass = sortedTodayClasses.find(c => {
    const s = parseMinutes(c.start_time);
    return currentMinutes >= (s - 20) && currentMinutes < s;
  });

  const nextUpcomingToday = sortedTodayClasses.find(c => {
    return parseMinutes(c.start_time) > currentMinutes;
  });

  // Selected target class to show in "Your upcoming class" card
  const displayClass = inSessionClass || upcomingSoonClass || nextUpcomingToday || sortedTodayClasses[0] || myClassrooms[0] || classrooms[0];
  const targetProg = programs.find(p => p.id === displayClass?.program_id);
  const targetProgName = targetProg?.name || 'Academic Class';
  const sMin = parseMinutes(displayClass?.start_time || '06:30');
  const eMin = parseMinutes(displayClass?.end_time || '07:30');
  const isNowActive = Boolean(displayClass && currentMinutes >= sMin && currentMinutes <= eMin);
  const isSoon = Boolean(displayClass && currentMinutes >= (sMin - 20) && currentMinutes < sMin);
  const isLater = Boolean(displayClass && currentMinutes < sMin);

  // Calculate weekly slots
  let weeklySlotCount = 0;
  myClassrooms.forEach(c => {
    const days = Array.isArray(c.days) && c.days.length > 0 ? c.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weeklySlotCount += days.length;
  });

  // Check if this teacher is currently on authorized faculty leave today
  const todayDateStr = now.toISOString().split('T')[0];
  const activeFacultyLeaveToday = db.isFacultyOnApprovedLeave(user, todayDateStr, facultyLeaves);

  // Calculate pending attendance for today's scheduled classes
  // If the teacher is on approved leave today, pending attendance is 0 (duties officially waived, no alert notification)
  const pendingAttendanceCount = activeFacultyLeaveToday ? 0 : todayClasses.filter(c => 
    !attendanceRecords.some(r => r.classroom_id === c.id && r.session_date === todayDateStr)
  ).length;

  const totalStudentsTaught = students.filter(s => s.status === 'Active').length;
  const activeExam = exams[0] || { title: 'Mid-Term Examination 2026' };
  const myExamSubjects = examSubjects.slice(0, 2);

  container.innerHTML = `
  <div class="teacher-dashboard-wrap">
    <div class="page-header" style="margin-bottom: 1.5rem;">
      <div class="page-title-group">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #ECFDF5; border: 1.5px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <div>
            <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">Welcome, ${teacherName}</h2>
            <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">Faculty & Academic Dashboard • Attendance Windows, Classrooms & Marks Entry</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Dedicated "Your upcoming class" Card (Portion Design Spec: Replaced by Authorized Leave Notice when on Leave) -->
    ${activeFacultyLeaveToday ? `
      <div class="teacher-upcoming-card is-leave" 
           id="card-teacher-upcoming-class" 
           data-on-leave="true"
           role="button" 
           tabindex="0"
           title="You are currently on authorized faculty leave. Attendance duties are officially waived."
           style="background: #F0FDF4; border: 1.5px solid #BBF7D0; border-left: 5px solid #059669; box-shadow: 0 4px 16px rgba(5, 150, 105, 0.08); cursor: pointer;">
        
        <!-- Top Portion: Leave Heading, Icon & Waived Status Badge -->
        <div class="upcoming-card-top">
          <div class="upcoming-card-title-group">
            <div class="upcoming-card-icon-pill" style="background: #ECFDF5; color: #059669; border: 1.5px solid #A7F3D0; font-size: 1.25rem;">
              ✈️
            </div>
            <div>
              <h3 class="upcoming-card-heading" style="color: #065F46;">Faculty Leave Active</h3>
              <span class="upcoming-card-subtitle" style="color: #047857;">You are on authorized leave today • All attendance duties waived</span>
            </div>
          </div>

          <div class="upcoming-card-status-badge">
            <span class="badge" style="background: #DCFCE7; color: #15803D; border: 1.5px solid #86EFAC; font-weight: 800; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px;">
              ✓ Approved Leave
            </span>
          </div>
        </div>

        <!-- Clean Divider Line -->
        <div class="upcoming-divider" style="background: #BBF7D0;"></div>

        <!-- Primary Leave Information -->
        <div class="upcoming-class-primary">
          <h4 class="upcoming-class-name" style="color: #0F172A;">${activeFacultyLeaveToday.leave_type || 'Authorized Absence'}</h4>
          <span class="upcoming-prog-pill" style="background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC;">Duty Waived by Administration</span>
        </div>

        <div class="upcoming-details-grid">
          <div class="upcoming-detail-cell">
            <span class="detail-label">Leave Duration</span>
            <span class="detail-value">${activeFacultyLeaveToday.is_multiple_days ? `${formatDate(activeFacultyLeaveToday.start_date)} to ${formatDate(activeFacultyLeaveToday.end_date)}` : formatDate(activeFacultyLeaveToday.start_date)}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="detail-label">Permitted Timings</span>
            <span class="detail-value">${formatTime(activeFacultyLeaveToday.departure_time || '08:00')} – ${formatTime(activeFacultyLeaveToday.return_time || '16:30')}</span>
          </div>
          <div class="upcoming-detail-cell" style="grid-column: span 2;">
            <span class="detail-label">Approved Reason</span>
            <span class="detail-value" style="font-weight: 500; font-style: italic;">"${activeFacultyLeaveToday.reason || 'Official duty leave'}"</span>
          </div>
        </div>

        <!-- Bottom Action: Attendance Disabled -->
        <div class="upcoming-card-footer" style="display: flex; justify-content: flex-end; align-items: center;">
          <span class="badge" style="background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; padding: 0.45rem 1rem; border-radius: 8px; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 0.35rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Attendance Taking Disabled (On Leave)
          </span>
        </div>
      </div>
    ` : `
      <div class="teacher-upcoming-card ${isNowActive ? 'is-live' : isSoon ? 'is-soon' : 'is-default'}" 
           id="card-teacher-upcoming-class" 
           data-cls-id="${displayClass?.id || ''}" 
           role="button" 
           tabindex="0"
           title="Tap to take attendance for ${displayClass?.name || 'Class'}">
        
        <!-- Top Portion (Prominent Heading, Icon & Time Badge) -->
        <div class="upcoming-card-top">
          <div class="upcoming-card-title-group">
            <div class="upcoming-card-icon-pill ${isNowActive ? 'is-live' : isSoon ? 'is-soon' : 'is-default'}">
              ${isNowActive ? '🟢' : isSoon ? '🔔' : '⏱️'}
            </div>
            <div>
              <h3 class="upcoming-card-heading">Your upcoming class</h3>
              <span class="upcoming-card-subtitle">${isNowActive ? 'Class in session now' : isSoon ? `Starts in ${sMin - currentMinutes} mins` : 'Scheduled teaching session'}</span>
            </div>
          </div>

          <div class="upcoming-card-status-badge">
            ${isNowActive ? `
              <span class="badge" style="background: #ECFDF5; color: #059669; border: 1.5px solid #34D399; font-weight: 800; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.35rem;">
                <span class="live-pulse-dot"></span> Live In-Session Now
              </span>
            ` : isSoon ? `
              <span class="badge" style="background: #FFFBEB; color: #B45309; border: 1.5px solid #FCD34D; font-weight: 800; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px;">
                Starts in ${sMin - currentMinutes} min
              </span>
            ` : isLater ? `
              <span class="badge" style="background: #EFF6FF; color: #1E40AF; border: 1.5px solid #93C5FD; font-weight: 700; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px;">
                Today at ${formatTime(displayClass?.start_time)}
              </span>
            ` : `
              <span class="badge" style="background: #F8FAFC; color: #475569; border: 1px solid #CBD5E1; font-weight: 600; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px;">
                Scheduled Class
              </span>
            `}
          </div>
        </div>

        <!-- Clean Divider Line After "Today at ... PM" Portion -->
        <div class="upcoming-divider"></div>

        <!-- Class Details Directly Inside Card (No Separate Inner Card) -->
        <div class="upcoming-class-primary">
          <h4 class="upcoming-class-name">${displayClass?.name || 'Classroom Session'}</h4>
          <span class="upcoming-prog-pill">${targetProgName}</span>
        </div>

        <div class="upcoming-details-grid">
          <div class="upcoming-detail-cell">
            <span class="detail-label">Schedule Time</span>
            <span class="detail-value">${formatTime(displayClass?.start_time || '06:30')} – ${formatTime(displayClass?.end_time || '07:30')}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="detail-label">Classroom / Hall</span>
            <span class="detail-value">${displayClass?.room_number ? 'Room ' + displayClass.room_number : 'Campus Hall'}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="detail-label">Enrolled Roster</span>
            <span class="detail-value">${displayClass?.student_ids?.length || totalStudentsTaught} Students</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="detail-label">Scheduled Days</span>
            <span class="detail-value" style="white-space: nowrap;">${formatDaysSingleLetters(displayClass?.days)}</span>
          </div>
        </div>

        <!-- Bottom Right Short Action Button -->
        <div class="upcoming-card-footer">
          <span class="btn btn-primary btn-sm upcoming-attend-btn">
            Take Attendance →
          </span>
        </div>
      </div>
    `}

    <!-- SECTION 1: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Classrooms, examination grade sheets & academic circulars</span>
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

      <div class="stat-card" data-route="${activeFacultyLeaveToday ? 'faculty_leaves' : 'attendance'}" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Pending Attendance</span>
          <div class="stat-icon-wrapper" style="background: ${pendingAttendanceCount > 0 ? '#FEF2F2' : '#ECFDF5'}; color: ${pendingAttendanceCount > 0 ? '#DC2626' : '#059669'};">
            ${activeFacultyLeaveToday ? `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ` : `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            `}
          </div>
        </div>
        <div class="stat-value" style="color: ${pendingAttendanceCount > 0 ? '#DC2626' : '#059669'}; font-weight: 800;">${pendingAttendanceCount}</div>
        <div class="stat-footer">
          <span style="color: ${pendingAttendanceCount > 0 ? '#DC2626' : '#059669'}; font-weight: 600;">
            ${activeFacultyLeaveToday 
              ? '✓ Attendance officially waived (On Leave)' 
              : (pendingAttendanceCount > 0 ? 'Sessions pending submission' : 'All sessions marked')}
          </span>
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

      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Attendance</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>
        <div class="stat-value">98.5%</div>
        <div class="stat-footer">
          <span style="color: #059669; font-weight: 600;">Active student presence</span>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Academic & Examination Duties Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
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

      <!-- Teacher Guidelines & Academic Circulars -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Teacher Guidelines & Academic Circulars</h3>
          <button class="btn btn-outline btn-sm" id="btn-view-faculty-notices">View All Notices</button>
        </div>
        <div class="card-panel-body" style="padding: 1rem 1.25rem;">
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                <span style="font-size: 16px;">📖</span>
                <strong style="color: #0F172A; font-size: 0.88rem;">Morning Moral Class Protocol</strong>
              </div>
              <p style="font-size: 0.8rem; color: #475569; line-height: 1.4;">
                Ensure student presence is locked by 06:15 AM in Attendance Management. Any late arrivals must be flagged with a late marker in the register.
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

    </div>

    <!-- Mobile Floating Bottom Pill Navigation Bar -->
    <div class="m-floating-bottom-nav">
      <button class="m-nav-pill-btn active" data-nav="dashboard" title="Dashboard">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </button>
      <button class="m-nav-pill-btn" data-nav="timetable" title="Timetable">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>Schedule</span>
      </button>
      <button class="m-nav-pill-btn" data-nav="attendance" title="Attendance">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span>Attendance</span>
      </button>
      <button class="m-nav-pill-btn" data-nav="marks" title="Marks">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Marks</span>
      </button>
      <button class="m-nav-pill-btn" data-nav="reports" title="Reports">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        <span>Reports</span>
      </button>
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

  // Mobile Floating Bottom Nav buttons
  container.querySelectorAll('.m-nav-pill-btn[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const navTarget = btn.getAttribute('data-nav');
      if (navTarget) onNavigate(navTarget);
    });
  });

  container.querySelectorAll('.btn-dash-goto-att').forEach(b => {
    b.addEventListener('click', () => {
      if (activeFacultyLeaveToday) {
        toast.info(`You are currently on authorized faculty leave (${activeFacultyLeaveToday.leave_type || 'Leave'}). Attendance taking is locked and waived.`);
        return;
      }
      const clsId = b.getAttribute('data-cls-id');
      if (clsId && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('tps_active_att_cls', clsId);
      }
      onNavigate('attendance');
    });
  });

  // Tap on "Your upcoming class" card navigates directly to attendance for that class (unless on approved leave)
  const upcomingCard = container.querySelector('#card-teacher-upcoming-class');
  upcomingCard?.addEventListener('click', () => {
    if (activeFacultyLeaveToday) {
      toast.info(`You are currently on authorized faculty leave (${activeFacultyLeaveToday.leave_type || 'Leave'}). Attendance taking is locked and waived.`);
      return;
    }
    if (displayClass?.id && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('tps_active_att_cls', displayClass.id);
    }
    onNavigate('attendance');
  });

  container.querySelector('#btn-quick-window-attendance')?.addEventListener('click', () => onNavigate('attendance'));
  container.querySelector('#btn-open-marks-module')?.addEventListener('click', () => onNavigate('marks'));
  container.querySelector('#btn-view-faculty-notices')?.addEventListener('click', () => onNavigate('notices'));

  container.querySelectorAll('.btn-grade-subject').forEach(b => {
    b.addEventListener('click', () => onNavigate('marks'));
  });
}
