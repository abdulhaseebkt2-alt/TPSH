import { db } from '../../lib/db.js';
import { formatDate, formatTime, formatDaysSingleLetters } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { getCurrentUser } from '../../lib/auth.js';
import { openModal } from '../../lib/dialog.js';

export async function renderAttendanceReportModule(container, { onNavigate } = {}) {
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin';

  // 1. Fetch DB entities in parallel for high-speed instant load
  const [
    users,
    allClassrooms,
    allSections,
    allPrograms,
    calendar,
    leaves,
    attendanceSessions,
    allStudents,
    teacherAssignments
  ] = await Promise.all([
    db.getUsers(),
    db.getClassrooms(),
    db.getSections(),
    db.getPrograms(),
    db.getAcademicCalendar(),
    db.getLeaves(),
    db.getAttendanceRecords(),
    db.getStudents(),
    db.getTeacherAssignments()
  ]);

  // Helper to match teacher IDs with seeded UUID aliases
  function isTeacherAssignedToClass(u, c) {
    if (!u || !c) return false;
    const uIds = [u.id, u.email, u.full_name].filter(Boolean);
    if (u.id === 'u-2' || u.id === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || u.email === 'teacher@thaibaschool.edu.in' || (u.full_name && u.full_name.includes('Rashid'))) {
      uIds.push('u-2', '3ba0d909-6656-43eb-87fb-fe8e30088d55', 'teacher@thaibaschool.edu.in');
    }
    const cTeacher = c.teacher_id;
    if (cTeacher && uIds.includes(cTeacher)) return true;
    if (Array.isArray(teacherAssignments) && teacherAssignments.some(a => 
      a.classroom_id === c.id && uIds.includes(a.teacher_id) && !a.removed_date
    )) {
      return true;
    }
    return false;
  }

  // 2. Prepare eligible teachers list: ONLY users who are actually assigned to at least one classroom
  const eligibleTeachers = users.filter(u => {
    if (u.approval_status !== 'approved') return false;
    return allClassrooms.some(c => isTeacherAssignedToClass(u, c));
  }).sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));

  // If logged-in user is a teacher and not yet in list, ensure they are present
  if (isTeacher && user && !eligibleTeachers.some(t => t.id === user.id)) {
    eligibleTeachers.unshift(user);
  }

  // Safety fallback if no teachers found with assignments yet
  if (eligibleTeachers.length === 0) {
    const fallback = users.filter(u => u.approval_status === 'approved' && (u.role === 'teacher' || u.role === 'admin'));
    eligibleTeachers.push(...fallback);
  }

  // State
  // Teachers are strictly scoped to their own account; Admin can select any assigned faculty
  let selectedTeacherId = isTeacher ? user.id : (eligibleTeachers.find(t => allClassrooms.some(c => isTeacherAssignedToClass(t, c)))?.id || eligibleTeachers[0]?.id || 'u-2');
  let selectedSectionId = '';
  let selectedClassroomId = '';

  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1; // 1-based

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper: Find classrooms assigned to a teacher
  function getAssignedClassroomsForTeacher(teacherId) {
    const tUser = users.find(u => u.id === teacherId) || { id: teacherId };
    const assigned = allClassrooms.filter(c => isTeacherAssignedToClass(tUser, c));

    if (assigned.length > 0) return assigned;

    // Fallback if teacher doesn't have explicit classrooms assigned yet
    if (isTeacher) {
      return allClassrooms.slice(0, 1);
    }
    return [];
  }

  // Helper: Get sections assigned to a teacher (strictly sections with their assigned classes)
  function getAssignedSectionsForTeacher(teacherId) {
    const teacherCls = getAssignedClassroomsForTeacher(teacherId);
    const secIds = new Set(teacherCls.map(c => c.section_id).filter(Boolean));
    const progIds = new Set(teacherCls.map(c => c.program_id).filter(Boolean));

    // Gather matching sections strictly from the teacher's assigned classrooms
    let matchingSections = allSections.filter(s => secIds.has(s.id));
    if (matchingSections.length === 0) {
      matchingSections = allSections.filter(s => progIds.has(s.program_id));
      if (matchingSections.length === 0) {
        matchingSections = allPrograms
          .filter(p => progIds.has(p.id) || secIds.has(p.id))
          .map(p => ({ id: p.id, name: p.name, program_id: p.id }));
      }
    }
    return matchingSections;
  }

  // Helper: Get classes assigned to a teacher in a given section
  function getAssignedClassesForTeacherAndSection(teacherId, sectionId) {
    const teacherCls = getAssignedClassroomsForTeacher(teacherId);
    const filtered = teacherCls.filter(c => c.section_id === sectionId || c.program_id === sectionId);
    if (filtered.length > 0) return filtered;
    return teacherCls;
  }

  // Initialize cascading selection
  function syncCascadingSelections() {
    const assignedSections = getAssignedSectionsForTeacher(selectedTeacherId);
    if (!assignedSections.some(s => s.id === selectedSectionId)) {
      selectedSectionId = assignedSections[0]?.id || '';
    }

    const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
    if (!assignedClasses.some(c => c.id === selectedClassroomId)) {
      selectedClassroomId = assignedClasses[0]?.id || '';
    }
  }

  syncCascadingSelections();

  // Helper: Format YMD
  function toYMD(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Helper: parse minutes
  function parseMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  // Helper: Detect if date has hostel leave
  function isHostelLeaveDate(dateStr) {
    if (!Array.isArray(leaves) || leaves.length === 0) return false;
    return leaves.some(l => 
      l.departure_date && 
      l.expected_return_date && 
      dateStr >= l.departure_date && 
      dateStr <= l.expected_return_date
    );
  }

  // Helper: Month days breakdown for calendar grid (Monday - Sunday)
  function getCalendarGridDays(year, month, selectedClass) {
    const firstDayRaw = new Date(year, month - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const firstDayIndex = (firstDayRaw + 6) % 7; // 0 = Mon, 1 = Tue, ..., 6 = Sun
    const totalDays = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    const events = calendar?.events || [];
    const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const todayStr = toYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const classDays = Array.isArray(selectedClass?.days) && selectedClass.days.length > 0 
      ? selectedClass.days 
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const classEndMin = parseMinutes(selectedClass?.end_time || '07:30');

    const grid = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = toYMD(year, month, d);
      const dayDate = new Date(dateStr + 'T00:00:00');
      const dayKey = DAY_KEYS[dayDate.getDay()];

      // 1. Timetable working day check for this specific classroom
      const isClassScheduledDay = classDays.includes(dayKey);

      // 2. Academic calendar holiday check
      const dayInfo = db.getCalendarDayInfo(dateStr, calendar);
      const isHoliday = dayInfo.isHoliday;

      // 3. Hostel leave check (Text only)
      const isHostelLeave = isHostelLeaveDate(dateStr);

      // 4. Attendance session check
      const hasAttendanceSession = attendanceSessions.some(s => 
        s.classroom_id === selectedClass?.id && s.session_date === dateStr
      );

      // 5. Faculty assignment tenure check:
      // Missed attendance only evaluates from the date the teacher was assigned to this class,
      // and ends if an administrator removed them from the class.
      const isTeacherAssigned = db.isTeacherAssignedOnDate(selectedTeacherId, selectedClass, dateStr, teacherAssignments);

      // 6. Missed attendance ("Losen Attendance" / Teacher Leave)
      // Criteria: Teacher was assigned on this date, class was scheduled on this day,
      // it was not an institutional holiday, and either date is in the past OR today after class time ended,
      // but attendance was NOT recorded
      const isPastDate = dateStr < todayStr;
      const isTodayAfter = dateStr === todayStr && currentMinutes > classEndMin;
      const isElapsed = isPastDate || isTodayAfter;
      const isMissedAttendance = isTeacherAssigned && isClassScheduledDay && !isHoliday && isElapsed && !hasAttendanceSession;

      grid.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
        dayKey,
        isClassScheduledDay,
        isHoliday,
        holidayTitle: isHoliday ? (dayInfo.title || 'Official Holiday') : '',
        isHostelLeave,
        hasAttendanceSession,
        isMissedAttendance,
        isTeacherAssigned,
        isToday: dateStr === todayStr
      });
    }

    // Next month padding
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      grid.push({
        dayNumber: j,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    return grid;
  }

  async function renderFullUI() {
    syncCascadingSelections();

    const assignedSections = getAssignedSectionsForTeacher(selectedTeacherId);
    const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
    const activeClass = assignedClasses.find(c => c.id === selectedClassroomId) || assignedClasses[0];
    const activeTeacher = users.find(u => u.id === selectedTeacherId) || eligibleTeachers[0];
    const activeProgram = allPrograms.find(p => p.id === activeClass?.program_id);

    const gridDays = getCalendarGridDays(currentYear, currentMonth, activeClass);
    const currentMonthDays = gridDays.filter(d => d.isCurrentMonth);
    const unlocks = await db.getAttendanceUnlocks();

    // Summary counts for this class in this month (scoped to faculty tenure)
    const totalScheduled = currentMonthDays.filter(d => d.isClassScheduledDay && !d.isHoliday && d.isTeacherAssigned).length;
    const takenSessions = currentMonthDays.filter(d => d.hasAttendanceSession).length;
    const missedSessions = currentMonthDays.filter(d => d.isMissedAttendance).length;
    const unlockedSessions = currentMonthDays.filter(d => d.isMissedAttendance && unlocks.includes(`${activeClass?.id}_${d.dateStr}`)).length;
    const allMonthMissedUnlocked = missedSessions > 0 && unlockedSessions === missedSessions;

    container.innerHTML = `
      <div class="attendance-report-container" style="padding-bottom: 2.5rem;">
        
        <!-- HEADER -->
        <div class="page-header" style="margin-bottom: 1.25rem;">
          <div class="page-title-group">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0;">
                ${isTeacher ? 'My Classroom Attendance Report' : 'Classroom & Teacher Attendance Report'}
              </h2>
              <span class="badge ${isTeacher ? 'badge-active' : 'badge-default'}" style="font-size: 0.72rem; font-weight: 700;">
                ${isTeacher ? 'Personal Faculty Duty' : 'Administrative Governance'}
              </span>
            </div>
            <p style="font-size: 0.8rem; color: #64748B; margin-top: 2px;">
              Visual duty calendar, class timetable unworking days fading, holiday indicators, hostel leaves & missed attendance unlocking
            </p>
          </div>
          <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-sm" id="btn-rep-goto-attendance" style="font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Live Attendance Duty
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-rep-goto-calendar" style="font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Academic Calendar
            </button>
          </div>
        </div>

        <!-- CASCADING HIERARCHY SELECTOR CARD -->
        <div class="card-panel" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.15rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.05);">
          <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B; margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
            <span style="display: flex; align-items: center; gap: 0.4rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Cascading Attendance Filter
            </span>
            <span style="font-size: 0.68rem; color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">Role Scoped</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem;">
            
            <!-- 1. Teacher Selector -->
            <div>
              <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">
                Faculty / Teacher ${isTeacher ? '(Locked)' : ''}
              </label>
              ${isAdmin ? `
                <select id="att-rep-teacher-select" class="form-control" style="width: 100%; border-radius: 10px; font-weight: 600; font-size: 0.86rem; cursor: pointer; border-color: #CBD5E1;">
                  ${eligibleTeachers.map(t => `<option value="${t.id}" ${t.id === selectedTeacherId ? 'selected' : ''}>${t.full_name || t.email}</option>`).join('')}
                </select>
              ` : `
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; padding: 0.55rem 0.75rem; font-weight: 700; font-size: 0.86rem; color: #0F172A; display: flex; align-items: center; justify-content: space-between;">
                  <span>${activeTeacher?.full_name || user?.full_name || 'My Faculty Duty'}</span>
                  <span class="badge badge-active" style="font-size: 0.65rem;">My Account</span>
                </div>
              `}
            </div>

            <!-- 2. Section Selector -->
            <div>
              <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">
                Assigned Section
              </label>
              <select id="att-rep-section-select" class="form-control" style="width: 100%; border-radius: 10px; font-weight: 600; font-size: 0.86rem; cursor: pointer; border-color: #CBD5E1;">
                ${assignedSections.map(s => `<option value="${s.id}" ${s.id === selectedSectionId ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>

            <!-- 3. Class Selector -->
            <div>
              <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">
                Assigned Classroom Session
              </label>
              <select id="att-rep-class-select" class="form-control" style="width: 100%; border-radius: 10px; font-weight: 600; font-size: 0.86rem; cursor: pointer; border-color: #CBD5E1;">
                ${assignedClasses.map(c => `<option value="${c.id}" ${c.id === selectedClassroomId ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>

          </div>

          <!-- Classroom Timetable Specs Ribbon -->
          ${activeClass ? `
            <div style="margin-top: 0.9rem; padding-top: 0.8rem; border-top: 1px dashed #E2E8F0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; font-size: 0.78rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                <span style="color: #64748B; font-weight: 600;">Meeting Days:</span>
                <div style="display: inline-flex; align-items: center; gap: 4px;" title="Scheduled class meeting days">
                  ${[
                    { key: 'Mon', short: 'M', title: 'Monday' },
                    { key: 'Tue', short: 'T', title: 'Tuesday' },
                    { key: 'Wed', short: 'W', title: 'Wednesday' },
                    { key: 'Thu', short: 'T', title: 'Thursday' },
                    { key: 'Fri', short: 'F', title: 'Friday' },
                    { key: 'Sat', short: 'S', title: 'Saturday' },
                    { key: 'Sun', short: 'S', title: 'Sunday' }
                  ].map(d => {
                    const isMeeting = (activeClass?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).includes(d.key);
                    return `<span class="day-round ${isMeeting ? 'active' : 'inactive'}" title="${d.title}: ${isMeeting ? 'Active Class Day' : 'Off'}">${d.short}</span>`;
                  }).join('')}
                </div>

                <span style="color: #CBD5E1; margin: 0 2px;">•</span>

                <span style="color: #64748B; font-weight: 600;">Timing:</span>
                <strong style="color: #0F172A; font-family: var(--font-mono); font-size: 0.82rem; background: #F8FAFC; padding: 2px 7px; border-radius: 6px; border: 1px solid #E2E8F0;">
                  ${formatTime(activeClass?.start_time || '06:00')} – ${formatTime(activeClass?.end_time || '07:00')}
                </strong>
              </div>

              <div style="color: #059669; font-weight: 700; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; background: #ECFDF5; padding: 3px 9px; border-radius: 6px; border: 1px solid #A7F3D0;">
                <span>⚡ Attendance restricted strictly between ${formatTime(activeClass?.start_time || '06:00')} and ${formatTime(activeClass?.end_time || '07:00')}</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- 4-METRICS STATS ROW -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 0.9rem;">
            <span style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Scheduled</span>
            <div style="font-weight: 900; font-size: 1.3rem; color: #0F172A;">${totalScheduled}</div>
            <span style="font-size: 0.68rem; color: #64748B;">Working Sessions</span>
          </div>
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 0.75rem 0.9rem;">
            <span style="font-size: 0.68rem; font-weight: 700; color: #047857; text-transform: uppercase;">Taken</span>
            <div style="font-weight: 900; font-size: 1.3rem; color: #059669;">${takenSessions}</div>
            <span style="font-size: 0.68rem; color: #047857;">Submitted</span>
          </div>
          <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 0.75rem 0.9rem;">
            <span style="font-size: 0.68rem; font-weight: 700; color: #DC2626; text-transform: uppercase;">Missed (Losen)</span>
            <div style="font-weight: 900; font-size: 1.3rem; color: #DC2626;">${missedSessions}</div>
            <span style="font-size: 0.68rem; color: #DC2626;">Red Round Circles</span>
          </div>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 0.75rem 0.9rem;">
            <span style="font-size: 0.68rem; font-weight: 700; color: #B45309; text-transform: uppercase;">Admin Unlocked</span>
            <div style="font-weight: 900; font-size: 1.3rem; color: #D97706;">${unlockedSessions}</div>
            <span style="font-size: 0.68rem; color: #B45309;">Permitted Missed</span>
          </div>
        </div>

        <!-- COMPACT VISUAL CALENDAR CARD (EXACT MATCHING ACADEMIC CALENDAR SCREENSHOT 2) -->
        <div class="cal-fluent-grid-card" style="margin-bottom: 1.5rem;">
          
          <!-- CARD TOP HEADER -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.15rem 0.65rem; border-bottom: 1px solid #F3F4F6; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #F0FDF4; border: 1.5px solid #BBF7D0; display: flex; align-items: center; justify-content: center; color: #059669; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <h3 style="font-size: 0.96rem; font-weight: 800; color: #111827; margin: 0; line-height: 1.2;">
                  ${activeClass?.name || 'Classroom'} Attendance Calendar
                </h3>
                <p style="font-size: 0.72rem; color: #64748B; margin: 2px 0 0 0;">
                  ${activeProgram?.name || 'Class'} • Faculty: ${activeTeacher?.full_name || 'Assigned'}
                </p>
              </div>
            </div>

            <div>
              ${isAdmin ? `
                ${missedSessions > 0 ? (
                  !allMonthMissedUnlocked ? `
                    <button 
                      type="button" 
                      class="btn btn-sm" 
                      id="btn-bulk-unlock-month" 
                      style="background: #059669; color: #FFFFFF; font-weight: 700; font-size: 0.78rem; padding: 0.45rem 0.95rem; border-radius: 9px; border: none; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; box-shadow: 0 1px 3px rgba(5,150,105,0.25);"
                      title="Allow teacher to submit missed attendance for all ${missedSessions} missed sessions in ${MONTH_NAMES[currentMonth - 1]}"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      Allow Month Missed Attendance (${missedSessions})
                    </button>
                  ` : `
                    <button 
                      type="button" 
                      class="btn btn-sm" 
                      id="btn-bulk-lock-month" 
                      style="background: #FEF2F2; color: #DC2626; border: 1.5px solid #FECACA; font-weight: 700; font-size: 0.78rem; padding: 0.45rem 0.95rem; border-radius: 9px; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;"
                      title="Close/Lock all unlocked missed attendance sessions in ${MONTH_NAMES[currentMonth - 1]}"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Close / Lock Month Missed (${missedSessions})
                    </button>
                  `
                ) : `
                  <span style="font-size: 0.74rem; color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; background: #ECFDF5; padding: 0.35rem 0.75rem; border-radius: 9999px; border: 1px solid #A7F3D0;">
                    ✓ No Missed Attendance
                  </span>
                `}
              ` : `
                ${missedSessions > 0 && unlockedSessions > 0 ? `
                  <span style="font-size: 0.74rem; color: #047857; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; background: #FEF3C7; padding: 0.35rem 0.75rem; border-radius: 9999px; border: 1px solid #FDE68A;">
                    🔓 ${unlockedSessions} Missed Session(s) Unlocked by Admin
                  </span>
                ` : `
                  <span style="font-size: 0.74rem; color: #64748B; font-weight: 600;">
                    Tap dates to view / submit duty
                  </span>
                `}
              `}
            </div>
          </div>

          <!-- MONTH & YEAR NAVIGATION BAR -->
          <div class="cal-month-nav-bar">
            <button type="button" class="cal-nav-btn" id="att-rep-btn-prev-month" title="Previous Month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span class="cal-month-nav-title">
                ${MONTH_NAMES[currentMonth - 1]} ${currentYear}
              </span>
              <button type="button" class="cal-today-pill" id="att-rep-btn-today" title="Jump to Today">
                Today
              </button>
            </div>
            <button type="button" class="cal-nav-btn" id="att-rep-btn-next-month" title="Next Month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          <!-- 7-DAY WEEKDAY HEADER ROW (MO TU WE TH FR SA SU) -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); padding: 0.35rem 0.4rem 0.2rem; text-align: center; border-bottom: 1px solid #F3F4F6;">
            ${[
              { short: 'MO', full: 'Mon' },
              { short: 'TU', full: 'Tue' },
              { short: 'WE', full: 'Wed' },
              { short: 'TH', full: 'Thu' },
              { short: 'FR', full: 'Fri' },
              { short: 'SA', full: 'Sat' },
              { short: 'SU', full: 'Sun' }
            ].map(dow => `
              <div style="padding: 0.25rem 0.05rem; font-weight: 600; font-size: 0.74rem; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em;">
                <span>${dow.short}</span>
              </div>
            `).join('')}
          </div>

          <!-- COMPACT CALENDAR CELLS GRID -->
          <div class="cal-month-grid">
            ${gridDays.map(cell => {
              if (!cell.isCurrentMonth) {
                return `
                  <div class="cal-pad-cell">
                    <span>${cell.dayNumber}</span>
                  </div>
                `;
              }

              const isUnlocked = unlocks.includes(`${activeClass?.id}_${cell.dateStr}`);

              // RULE 1: Unworking Day for this class from timetable settings -> FADE
              const isClassOffDay = !cell.isClassScheduledDay;

              // RULE 2: Holiday from Academic Calendar -> Light Yellow
              const isHol = cell.isHoliday;

              // RULE 3: Hostel Leave -> FADED RED TEXT ONLY (No circle / round!)
              const isHostelLeaveTextOnly = cell.isHostelLeave && !cell.isMissedAttendance;

              // RULE 4: Missed Attendance -> RED COLOUR ROUND
              const isMissedRound = cell.isMissedAttendance;

              // RULE 5: Taken Attendance -> Emerald
              const isTaken = cell.hasAttendanceSession;

              // RULE 6: Faculty Not Assigned on Date (Prior to assignment or after removal) -> Neutral/Faded
              const isNotAssigned = !cell.isTeacherAssigned;

              let cellClasses = 'cal-inst-day-cell cal-day-box';
              if (isClassOffDay) cellClasses += ' is-class-off-day';
              if (isHol) cellClasses += ' is-holiday-single';
              if (isNotAssigned) cellClasses += ' is-not-assigned-day';

              let circleClasses = 'cal-day-circle';
              if (cell.isToday) circleClasses += ' is-today';
              if (isClassOffDay) circleClasses += ' is-class-off';
              if (isMissedRound) circleClasses += ' is-missed-attendance';
              else if (isHostelLeaveTextOnly) circleClasses += ' is-hostel-leave-text';
              else if (isTaken) circleClasses += ' is-attendance-taken';
              else if (isNotAssigned) circleClasses += ' is-not-assigned';

              let tooltip = `${cell.dateStr}: `;
              if (isMissedRound) tooltip += `MISSED ATTENDANCE (${isUnlocked ? 'Unlocked by Admin' : 'Locked'}). Tap to manage.`;
              else if (isTaken) tooltip += `Attendance Taken. Tap to inspect.`;
              else if (isHol) tooltip += `Academic Holiday (${cell.holidayTitle})`;
              else if (isHostelLeaveTextOnly) tooltip += `Hostel Leave active (fade red text)`;
              else if (isClassOffDay) tooltip += `No Class Scheduled (Unworking day for this classroom)`;
              else if (isNotAssigned) tooltip += `Faculty not assigned to classroom on this date.`;
              else tooltip += `Scheduled Class Day`;

              return `
                <div 
                  class="${cellClasses}" 
                  data-date="${cell.dateStr}"
                  data-missed="${isMissedRound}"
                  data-unlocked="${isUnlocked}"
                  data-taken="${isTaken}"
                  role="button"
                  tabindex="0"
                  title="${tooltip}"
                  style="cursor: pointer;"
                >
                  <div class="cal-cell-track">
                    <div class="${circleClasses}" ${isUnlocked && isMissedRound ? 'style="border: 2px solid #F59E0B !important;"' : ''}>
                      ${cell.dayNumber}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- CARD FOOTER: LEGEND & INSTRUCTIONS -->
          <div class="cal-card-footer" style="padding: 0.65rem 0.95rem; background: #FFFFFF; border-top: 1px solid #F3F4F6; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
            <div style="font-size: 0.74rem; color: #475569; font-weight: 600;">
              Tap any date to inspect details or unlock missed attendance.
            </div>

            <!-- Visual Legend -->
            <div style="display: flex; align-items: center; gap: 0.85rem; font-size: 0.72rem; flex-wrap: wrap;">
              <span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #DC2626; font-weight: 700;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #EF4444;"></span>
                Missed Attendance (Red Round)
              </span>
              <span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #047857; font-weight: 700;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #10B981;"></span>
                Attendance Taken
              </span>
              <span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #B45309; font-weight: 700;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #F59E0B;"></span>
                Holiday (Yellow)
              </span>
              <span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #EF4444; opacity: 0.7; font-weight: 700;">
                <span style="font-size: 0.72rem; font-weight: 800;">15</span>
                Hostel Leave (Fade Red Text)
              </span>
              <span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #94A3B8; font-weight: 600;">
                <span style="font-size: 0.72rem; opacity: 0.4;">18</span>
                Class Off Day (Faded)
              </span>
            </div>
          </div>

        </div>

      </div>
    `;

    attachListeners();
  }

  // Interactive Date Inspector Popup
  async function openDayInspectionModal(dateStr) {
    const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
    const activeClass = assignedClasses.find(c => c.id === selectedClassroomId) || assignedClasses[0];
    const activeTeacher = users.find(u => u.id === selectedTeacherId) || eligibleTeachers[0];

    const dayDate = new Date(dateStr + 'T00:00:00');
    const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = DAY_KEYS[dayDate.getDay()];
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayDate.getDay()];

    const classDays = Array.isArray(activeClass?.days) && activeClass.days.length > 0 
      ? activeClass.days 
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isClassScheduledDay = classDays.includes(dayKey);

    const dayInfo = db.getCalendarDayInfo(dateStr, calendar);
    const isHoliday = dayInfo.isHoliday;
    const isHostelLeave = isHostelLeaveDate(dateStr);

    const session = attendanceSessions.find(s => 
      s.classroom_id === activeClass?.id && s.session_date === dateStr
    );
    const hasAttendanceSession = Boolean(session);

    const isTeacherAssigned = db.isTeacherAssignedOnDate(selectedTeacherId, activeClass, dateStr, teacherAssignments);
    const isPastDate = dateStr < toYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const isTodayAfter = dateStr === toYMD(now.getFullYear(), now.getMonth() + 1, now.getDate()) && 
      (now.getHours() * 60 + now.getMinutes()) > parseMinutes(activeClass?.end_time || '07:30');
    const isElapsed = isPastDate || isTodayAfter;
    const isMissed = isTeacherAssigned && isClassScheduledDay && !isHoliday && isElapsed && !hasAttendanceSession;

    const isUnlocked = await db.isAttendanceWindowUnlocked(activeClass?.id, dateStr);

    let statusTitle = 'Scheduled Academic Session';
    let statusDesc = 'Class is scheduled in timetable.';
    let statusBadge = '<span class="badge badge-default">Scheduled</span>';

    if (!isTeacherAssigned) {
      const assignedStart = activeClass?.teacher_assigned_date || '2026-10-01';
      const removedEnd = activeClass?.teacher_removed_date || null;
      if (dateStr < assignedStart) {
        statusTitle = 'Faculty Not Assigned (Prior to Class Assignment)';
        statusDesc = `${activeTeacher?.full_name || 'Faculty'} was assigned to ${activeClass?.name} on ${formatDate(assignedStart)}. Dates prior to assignment date have no missed attendance obligations.`;
        statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1;">Not Assigned</span>';
      } else if (removedEnd && dateStr > removedEnd) {
        statusTitle = 'Faculty Tenure Ended (Removed from Classroom)';
        statusDesc = `${activeTeacher?.full_name || 'Faculty'} was removed from ${activeClass?.name} by Administrator on ${formatDate(removedEnd)}. Attendance duties concluded on that date.`;
        statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1;">Tenure Ended</span>';
      } else {
        statusTitle = 'Faculty Not Assigned to Classroom';
        statusDesc = `This teacher is not assigned to ${activeClass?.name} on this date.`;
        statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1;">Not Assigned</span>';
      }
    } else if (!isClassScheduledDay) {
      statusTitle = 'Unworking Day for this Classroom';
      statusDesc = `${activeClass?.name} is scheduled on (${classDays.join(', ')}). ${dayName} is an off-day for this class.`;
      statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B;">Class Off Day (Faded)</span>';
    } else if (isHoliday) {
      statusTitle = `Official Academic Holiday (${dayInfo.title || 'Holiday'})`;
      statusDesc = 'Institutional holiday as per Academic Calendar. No academic duties.';
      statusBadge = '<span class="badge" style="background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A;">🌴 Official Holiday</span>';
    } else if (isMissed) {
      statusTitle = 'Missed Attendance (Teacher Duty Unrecorded)';
      statusDesc = `Class scheduled from ${formatTime(activeClass?.start_time)} to ${formatTime(activeClass?.end_time)}, but attendance was not submitted during the session window.`;
      statusBadge = '<span class="badge" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; font-weight: 800;">🔴 Missed Attendance (Red Round)</span>';
    } else if (hasAttendanceSession) {
      statusTitle = 'Attendance Successfully Recorded';
      statusDesc = `Recorded by ${session.teacher_name || activeTeacher.full_name} at ${formatTime(session.recorded_at?.slice(11, 16) || '')}. Total ${session.records?.length || 0} students evaluated.`;
      statusBadge = '<span class="badge badge-active">✓ Completed</span>';
    }

    openModal({
      title: 'Class Attendance Day Inspection',
      modalClass: 'cal-day-popup-modal',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 0.9rem;">
          
          <!-- Banner -->
          <div style="background: ${isMissed ? '#FEF2F2' : (hasAttendanceSession ? '#ECFDF5' : '#F8FAFC')}; border: 1.5px solid ${isMissed ? '#FECACA' : (hasAttendanceSession ? '#A7F3D0' : '#E2E8F0')}; border-radius: 12px; padding: 0.9rem 1.1rem; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <span style="font-size: 0.72rem; font-weight: 800; color: ${isMissed ? '#DC2626' : (hasAttendanceSession ? '#047857' : '#64748B')}; text-transform: uppercase;">
                Date Record
              </span>
              <h3 style="margin: 2px 0 0 0; font-size: 1.1rem; font-weight: 900; color: #0F172A;">
                ${dayName}, ${formatDate(dateStr)}
              </h3>
            </div>
            ${statusBadge}
          </div>

          <!-- Class & Faculty Info -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.8rem 1rem; font-size: 0.82rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <div>
                <span style="color: #64748B; font-size: 0.74rem;">Classroom:</span>
                <div style="font-weight: 800; color: #0F172A;">${activeClass?.name}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.74rem;">Assigned Faculty:</span>
                <div style="font-weight: 800; color: #0F172A;">${activeTeacher?.full_name}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.74rem;">Scheduled Timings:</span>
                <div style="font-weight: 700; color: #0F172A;">${formatTime(activeClass?.start_time)} – ${formatTime(activeClass?.end_time)}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.74rem;">Hostel Leaves:</span>
                <div style="font-weight: 700; color: ${isHostelLeave ? '#EF4444' : '#64748B'};">
                  ${isHostelLeave ? '✈ Active (Fade Red Text Only)' : 'None'}
                </div>
              </div>
            </div>
          </div>

          <!-- Status & Explanation -->
          <div style="border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.85rem 1rem; background: #FFFFFF;">
            <strong style="display: block; font-size: 0.86rem; color: #0F172A; margin-bottom: 0.35rem;">
              ${statusTitle}
            </strong>
            <p style="font-size: 0.8rem; color: #475569; line-height: 1.5; margin: 0;">
              ${statusDesc}
            </p>
          </div>

          <!-- Attendance Session Details & Student Breakdown if Taken -->
          ${hasAttendanceSession && session && Array.isArray(session.records) ? `
            <div style="border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.85rem 1rem; background: #FFFFFF;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <span style="font-size: 0.72rem; font-weight: 800; color: #047857; text-transform: uppercase;">
                    Student Attendance Breakdown
                  </span>
                  <div style="font-size: 0.76rem; color: #64748B;">
                    ${session.records.filter(r => r.status === 'Present').length} Present • 
                    ${session.records.filter(r => r.status === 'Late Present').length} Late • 
                    ${session.records.filter(r => r.status === 'Absent').length} Absent
                  </div>
                </div>
                ${isAdmin ? `
                  <button type="button" class="btn btn-outline btn-xs" id="btn-modal-admin-edit-att" style="font-weight: 700; color: #2563EB; border-color: #BFDBFE;">
                    ✏️ Edit Attendance (Admin)
                  </button>
                ` : ''}
              </div>

              <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem;">
                ${session.records.map(r => {
                  const st = allStudents.find(s => s.id === r.student_id);
                  const isLate = r.status === 'Late Present';
                  const isPres = r.status === 'Present';
                  const lateMin = r.late_minutes || 15;
                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; border-radius: 8px; background: ${isLate ? '#FFFDF5' : (isPres ? '#F0FDF4' : '#FEF2F2')}; border: 1px solid ${isLate ? '#FDE68A' : (isPres ? '#BBF7D0' : '#FECACA')}; font-size: 0.78rem;">
                      <div>
                        <strong style="color: #0F172A;">${st?.full_name || 'Student'}</strong>
                        ${isLate && isAdmin ? `
                          <div style="font-size: 0.7rem; color: #D97706; font-weight: 700; margin-top: 1px;">
                            ⏱️ ${lateMin} min late (Class: ${formatTime(activeClass?.start_time || '06:30')})
                          </div>
                        ` : ''}
                      </div>
                      <div>
                        ${isLate ? `
                          <span class="att-late-badge" style="font-size: 0.7rem;">
                            L • ${lateMin}m late
                          </span>
                        ` : isPres ? `
                          <span class="badge badge-active" style="font-size: 0.7rem;">P • Present</span>
                        ` : `
                          <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-size: 0.7rem;">A • Absent</span>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Missed Attendance Admin / Teacher Governance Bar -->
          ${isMissed ? `
            <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 0.85rem 1rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem;">
                <span style="font-size: 0.74rem; font-weight: 800; color: #B45309; text-transform: uppercase;">
                  Admin Unlock Governance
                </span>
                <span class="badge" style="background: ${isUnlocked ? '#ECFDF5' : '#FEF2F2'}; color: ${isUnlocked ? '#047857' : '#DC2626'}; border: 1px solid ${isUnlocked ? '#A7F3D0' : '#FECACA'}; font-weight: 700; font-size: 0.72rem;">
                  ${isUnlocked ? '✓ Unlocked by Administration' : '🔒 Locked'}
                </span>
              </div>
              <p style="font-size: 0.78rem; color: #78350F; line-height: 1.4; margin: 0 0 0.65rem 0;">
                ${isUnlocked 
                  ? 'Administration has unlocked this session. The assigned teacher can now record missed attendance.' 
                  : 'Attendance was not taken within session hours. Only Administration can grant permission to record late attendance.'}
              </p>
              
              <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                ${isAdmin ? `
                  ${isUnlocked ? `
                    <button type="button" class="btn btn-outline btn-sm btn-modal-toggle-lock" data-action="lock" style="color: #DC2626; border-color: #FECACA; font-weight: 700;">
                      Close / Lock Window
                    </button>
                  ` : `
                    <button type="button" class="btn btn-primary btn-sm btn-modal-toggle-lock" data-action="unlock" style="background: #059669; border-color: #047857; font-weight: 700;">
                      Allow Missed Attendance
                    </button>
                  `}
                ` : `
                  ${isUnlocked ? `
                    <button type="button" class="btn btn-primary btn-sm btn-modal-take-missed" style="background: #059669; border-color: #047857; font-weight: 700;">
                      Take Missed Attendance Now
                    </button>
                  ` : `
                    <span style="font-size: 0.76rem; color: #94A3B8; font-weight: 600; align-self: center;">
                      Permission Required
                    </span>
                  `}
                `}
              </div>
            </div>
          ` : ''}

          <!-- Close Action -->
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.35rem;">
            <button type="button" class="btn btn-outline btn-sm" id="modal-btn-close-day" style="font-weight: 700; min-width: 90px;">
              Close
            </button>
          </div>

        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#modal-btn-close-day')?.addEventListener('click', close);

        modalBody.querySelector('.btn-modal-toggle-lock')?.addEventListener('click', async (e) => {
          const action = e.currentTarget.getAttribute('data-action');
          if (action === 'unlock') {
            await db.unlockAttendanceWindow(activeClass?.id, dateStr);
            toast.success(`Allowed missed attendance for ${dateStr}. Assigned faculty can now submit.`);
          } else {
            await db.lockAttendanceWindow(activeClass?.id, dateStr);
            toast.info(`Closed/locked missed attendance window for ${dateStr}.`);
          }
          close();
          renderFullUI();
        });

        modalBody.querySelector('.btn-modal-take-missed')?.addEventListener('click', () => {
          close();
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('tps_active_att_cls', activeClass?.id);
            sessionStorage.setItem('tps_active_att_date', dateStr);
          }
          if (onNavigate) {
            onNavigate('attendance');
          } else if (typeof window !== 'undefined') {
            window.location.hash = '#attendance';
          }
        });

        modalBody.querySelector('#btn-modal-admin-edit-att')?.addEventListener('click', () => {
          close();
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('tps_active_att_cls', activeClass?.id);
            sessionStorage.setItem('tps_active_att_date', dateStr);
          }
          if (onNavigate) {
            onNavigate('attendance');
          } else if (typeof window !== 'undefined') {
            window.location.hash = '#attendance';
          }
        });
      }
    });
  }

  function attachListeners() {
    if (!container || typeof container.querySelector !== 'function') return;
    // 1. Cascading Teacher Dropdown (Admin only)
    container.querySelector('#att-rep-teacher-select')?.addEventListener('change', (e) => {
      selectedTeacherId = e.target.value;
      const assignedSections = getAssignedSectionsForTeacher(selectedTeacherId);
      selectedSectionId = assignedSections[0]?.id || '';
      const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
      selectedClassroomId = assignedClasses[0]?.id || '';
      renderFullUI();
    });

    // 2. Cascading Section Dropdown
    container.querySelector('#att-rep-section-select')?.addEventListener('change', (e) => {
      selectedSectionId = e.target.value;
      const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
      selectedClassroomId = assignedClasses[0]?.id || '';
      renderFullUI();
    });

    // 3. Cascading Class Dropdown
    container.querySelector('#att-rep-class-select')?.addEventListener('change', (e) => {
      selectedClassroomId = e.target.value;
      renderFullUI();
    });

    // 4. Month & Year Navigation
    container.querySelector('#att-rep-btn-prev-month')?.addEventListener('click', () => {
      if (currentMonth === 1) {
        currentMonth = 12;
        currentYear--;
      } else {
        currentMonth--;
      }
      renderFullUI();
    });

    container.querySelector('#att-rep-btn-next-month')?.addEventListener('click', () => {
      if (currentMonth === 12) {
        currentMonth = 1;
        currentYear++;
      } else {
        currentMonth++;
      }
      renderFullUI();
    });

    container.querySelector('#att-rep-btn-today')?.addEventListener('click', () => {
      const todayDate = new Date();
      currentYear = todayDate.getFullYear();
      currentMonth = todayDate.getMonth() + 1;
      renderFullUI();
    });

    // 5. Day cell clicks (Inspection Modal)
    container.querySelectorAll('.cal-inst-day-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.getAttribute('data-date');
        if (dateStr) {
          openDayInspectionModal(dateStr);
        }
      });
    });

    // 6. Navigation buttons
    container.querySelector('#btn-rep-goto-attendance')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('attendance');
      else if (typeof window !== 'undefined') window.location.hash = '#attendance';
    });

    container.querySelector('#btn-rep-goto-calendar')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('calendar');
      else if (typeof window !== 'undefined') window.location.hash = '#calendar';
    });

    // 7. Bulk Month Missed Attendance (Admin)
    container.querySelector('#btn-bulk-unlock-month')?.addEventListener('click', async () => {
      const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
      const activeClass = assignedClasses.find(c => c.id === selectedClassroomId) || assignedClasses[0];
      const gridDays = getCalendarGridDays(currentYear, currentMonth, activeClass);
      const missedDates = gridDays.filter(d => d.isCurrentMonth && d.isMissedAttendance).map(d => d.dateStr);

      if (missedDates.length > 0) {
        await db.unlockAttendanceWindows(activeClass?.id, missedDates);
        toast.success(`Permission granted for all ${missedDates.length} missed sessions in ${MONTH_NAMES[currentMonth - 1]}.`);
        renderFullUI();
      }
    });

    container.querySelector('#btn-bulk-lock-month')?.addEventListener('click', async () => {
      const assignedClasses = getAssignedClassesForTeacherAndSection(selectedTeacherId, selectedSectionId);
      const activeClass = assignedClasses.find(c => c.id === selectedClassroomId) || assignedClasses[0];
      const gridDays = getCalendarGridDays(currentYear, currentMonth, activeClass);
      const missedDates = gridDays.filter(d => d.isCurrentMonth && d.isMissedAttendance).map(d => d.dateStr);

      if (missedDates.length > 0) {
        await db.lockAttendanceWindows(activeClass?.id, missedDates);
        toast.info(`Closed / locked all ${missedDates.length} missed sessions in ${MONTH_NAMES[currentMonth - 1]}.`);
        renderFullUI();
      }
    });
  }

  await renderFullUI();
}
