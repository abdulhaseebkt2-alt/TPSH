import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule, getMentorGenderScope, isMentorRole } from '../../lib/permissions.js';
import { formatDate, formatTime, normalizeClassPattern, formatDaysSingleLetters } from '../../lib/utils.js';
import { openMobileWheelPicker, formatDateYMD } from '../../components/date-picker.js';

function parseMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function renderAttendanceModule(container, { onNavigate, initialClassId, initialDate } = {}) {
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';
  const isMentor = isMentorRole(user?.role);
  const mentorGender = isMentor ? getMentorGenderScope(user) : null;
  const isBoysMentor = mentorGender === 'Boys';
  const isGirlsMentor = mentorGender === 'Girls';
  const isFaculty = isTeacher || isMentor;
  const isAdmin = user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin';
  const canSubmitAction = canPerformAction(user, 'attendance', 'submit_attendance') || canPerformAction(user, 'attendance', 'edit');
  const isViewOnly = isViewOnlyModule(user, 'attendance');

  const [allPrograms, allClassrooms, students, users, leaves, facultyLeaves] = await Promise.all([
    db.getPrograms(),
    db.getClassrooms(),
    db.getStudents(),
    db.getUsers(),
    db.getLeaves(),
    db.getFacultyLeaves()
  ]);

  // Eligible teachers list for Admin filter
  const eligibleTeachers = users.filter(u => 
    u.approval_status === 'approved' && 
    (u.role === 'teacher' || u.role === 'admin' || u.role === 'super_admin' || !u.role)
  );

  // Helper: Find classrooms assigned to a given user
  function getAssignedClassroomsForUser(targetUser) {
    if (!targetUser) return [];
    const tId = targetUser.id;
    const tEmail = targetUser.email;
    const tName = targetUser.full_name;

    return allClassrooms.filter(c => {
      if (c.teacher_id === tId) return true;
      if (tEmail && c.teacher_id === tEmail) return true;
      if (tName && c.teacher_id === tName) return true;
      if ((tId === 'u-2' || tEmail === 'teacher@thaibaschool.edu.in') && c.teacher_id === '3ba0d909-6656-43eb-87fb-fe8e30088d55') return true;
      return false;
    });
  }

  // 1. Scoping: Teacher / Mentor can ONLY see their own assigned classes / timetable (not others)
  let availableClassrooms = allClassrooms;
  let selectedAdminTeacherId = 'all';

  if (isTeacher) {
    const assigned = getAssignedClassroomsForUser(user);
    if (assigned.length > 0) {
      availableClassrooms = assigned;
    } else {
      // Fallback only if no classrooms have any teacher assigned yet
      const anyAssigned = allClassrooms.some(c => Boolean(c.teacher_id));
      availableClassrooms = anyAssigned ? [] : allClassrooms.slice(0, 2);
    }
  } else if (isMentor) {
    // "boys mentor can access only boys hostel data and his class... same to girls mentor"
    const assigned = getAssignedClassroomsForUser(user);
    if (assigned.length > 0) {
      availableClassrooms = assigned;
    } else {
      // If no specific classroom is mapped by teacher_id, allow classrooms matching mentor's gender scope
      availableClassrooms = allClassrooms.filter(c => !c.gender_eligibility || c.gender_eligibility === mentorGender || c.gender_eligibility === 'Mixed');
    }
  }

  // Today's Date & Time Check
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  let sessionDate = initialDate || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tps_active_att_date')) || todayIso;
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('tps_active_att_date');

  const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayKey = DAY_KEYS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Active view: 'cards' (the teaching timetable cards matching the screenshot) or 'roster' (student attendance taking & details)
  const preselectedClsId = initialClassId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tps_active_att_cls') : null);
  if (preselectedClsId && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('tps_active_att_cls');
  }

  let activeClassroomId = preselectedClsId || availableClassrooms[0]?.id || 'cls-1';
  let currentView = preselectedClsId ? 'roster' : 'cards';
  let timetableFilterTab = 'today'; // 'today' | 'weekly' | 'live'
  let rosterFilterMode = 'all'; // 'all' | 'in_class' | 'on_leave'

  // Time-Window Status Calculation for a classroom on targetDate
  async function checkWindowStatus(clsId, targetDate = sessionDate) {
    const cls = allClassrooms.find(c => c.id === clsId) || availableClassrooms.find(c => c.id === clsId);
    if (!cls) return { canTake: false, reason: 'Classroom not found' };

    // RULE 0: Faculty tenure check (cannot record attendance before assignment or after removal)
    const teacherAssignments = await db.getTeacherAssignments();
    const isAssigned = db.isTeacherAssignedOnDate(user?.id, cls, targetDate, teacherAssignments);
    if (isTeacher && !isAssigned) {
      const assignedStart = cls.teacher_assigned_date || '2026-10-01';
      const removedEnd = cls.teacher_removed_date || null;
      if (targetDate < assignedStart) {
        return {
          canTake: false,
          status: 'not_assigned_yet',
          message: `Classroom assignment started on ${formatDate(assignedStart)}. You cannot record attendance for dates prior to assignment.`,
          badgeClass: 'is-locked-after'
        };
      } else if (removedEnd && targetDate > removedEnd) {
        return {
          canTake: false,
          status: 'tenure_ended',
          message: `Your assignment to ${cls.name} ended on ${formatDate(removedEnd)}. Attendance duties have concluded.`,
          badgeClass: 'is-locked-after'
        };
      }
    }

    const isToday = targetDate === todayIso;
    const isPast = targetDate < todayIso;

    const days = Array.isArray(cls.days) && cls.days.length > 0 ? cls.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetDateObj = new Date(targetDate + 'T00:00:00');
    const targetDayKey = DAY_KEYS[targetDateObj.getDay()];
    const isTargetScheduled = days.includes(targetDayKey);

    const startMin = parseMinutes(cls.start_time || '06:30');
    const endMin = parseMinutes(cls.end_time || '07:30');

    const isInWindow = isToday && currentMinutes >= startMin && currentMinutes <= endMin;
    const isBefore = isToday && currentMinutes < startMin;
    const isAfter = (isToday && currentMinutes > endMin) || isPast;

    const isUnlockedByAdmin = await db.isAttendanceWindowUnlocked(cls.id, targetDate);

    // Check if attendance already exists for this date
    const allSessions = await db.getAttendanceRecords();
    const existingSession = allSessions.find(s => s.classroom_id === cls.id && s.session_date === targetDate);
    const hasExisting = Boolean(existingSession && Array.isArray(existingSession.records) && existingSession.records.length > 0);

    // RULE 1: If attendance is already taken:
    // Teachers CANNOT edit taken attendance (Admin permission only).
    // Admin CAN edit taken attendance.
    if (hasExisting) {
      if (isTeacher) {
        return {
          canTake: false,
          status: 'taken_locked_for_teacher',
          message: `Attendance already submitted on ${formatDate(targetDate)}. Only Administrators are permitted to edit recorded attendance.`,
          badgeClass: 'is-locked-after',
          isTaken: true
        };
      } else if (isAdmin) {
        return {
          canTake: true,
          status: 'admin_edit_taken',
          message: `Admin Override Mode: Editing previously recorded attendance for ${formatDate(targetDate)}.`,
          badgeClass: 'is-live',
          isTaken: true
        };
      }
    }

    // RULE 1-B: Faculty on Approved Leave Check (when no existing attendance recorded)
    // If the faculty member is currently on authorized leave on targetDate, attendance taking is locked & waived
    const facultyLeaveOnDate = db.isFacultyOnApprovedLeave(user, targetDate, facultyLeaves);
    if (!isAdmin && facultyLeaveOnDate) {
      return {
        canTake: false,
        status: 'faculty_on_leave',
        message: `Attendance Locked: You are on authorized faculty leave on ${formatDate(targetDate)} (${facultyLeaveOnDate.leave_type || 'Leave'}). Attendance duties are waived by Administration.`,
        badgeClass: 'is-locked-leave',
        isFacultyOnLeave: true,
        leaveData: facultyLeaveOnDate
      };
    }

    // RULE 2: If unlocked by Admin (e.g. for missed attendance):
    if (isUnlockedByAdmin) {
      return {
        canTake: true,
        status: 'admin_unlocked',
        message: `Admin Exception Granted: Missed/Late attendance unlocked for ${formatDate(targetDate)}.`,
        badgeClass: 'is-live',
        isUnlockedByAdmin: true
      };
    }

    // RULE 3: Day is not scheduled in timetable
    if (!isTargetScheduled) {
      return {
        canTake: false,
        status: 'not_scheduled_today',
        message: `No Class Scheduled on ${targetDayKey}: ${cls.name} meets on (${days.join(', ')}).`,
        badgeClass: 'is-locked-after'
      };
    }

    // RULE 4: If today and before class start time:
    // Mandatory for all classes (including when admins have class):
    if (isBefore) {
      const diff = startMin - currentMinutes;
      return {
        canTake: false,
        status: 'locked_before',
        message: `Attendance Locked: Class starts in ${diff} minutes at ${formatTime(cls.start_time)}. Attendance opens only during class hours.`,
        badgeClass: 'is-locked-before'
      };
    }

    // RULE 5: If class window has elapsed (after class end time today, or past date):
    if (isAfter) {
      return {
        canTake: false,
        status: 'locked_after',
        message: isToday
          ? `Attendance Window Closed: Session ended at ${formatTime(cls.end_time)}. Attendance missed. Requires Admin permission to unlock.`
          : `Attendance Window Closed: Past date ${formatDate(targetDate)} was missed. Requires Admin permission to unlock.`,
        badgeClass: 'is-locked-after',
        isAfter: true,
        isUnlockedByAdmin: false
      };
    }

    // RULE 6: Currently live between start and end time!
    return {
      canTake: true,
      status: 'live_open',
      message: `Live Attendance Window Active: Live until ${formatTime(cls.end_time)}.`,
      badgeClass: 'is-live'
    };
  }

  // Determine eligible students for an active class
  function getEligibleStudents(clsId = activeClassroomId) {
    const targetCls = allClassrooms.find(c => c.id === clsId) || availableClassrooms.find(c => c.id === clsId);
    let list = students;
    if (targetCls && Array.isArray(targetCls.student_ids) && targetCls.student_ids.length > 0) {
      const assignedSet = new Set(targetCls.student_ids);
      const filtered = students.filter(s => assignedSet.has(s.id));
      if (filtered.length > 0) list = filtered;
    } else if (targetCls?.gender_eligibility && targetCls.gender_eligibility !== 'Mixed') {
      list = students.filter(s => (s.gender || 'Boys').toLowerCase() === targetCls.gender_eligibility.toLowerCase());
    }
    if (isMentor && mentorGender) {
      list = list.filter(s => (s.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase());
    }
    return list;
  }

  // Attendance State and "Late Present" tracking
  let attendanceState = {};
  let studentLateMinutes = {};
  let initialAbsentStudentIds = new Set();
  let hasExistingSession = false;

  // Helper to determine if a student is on approved leave on target date
  function isStudentOnLeave(studentOrId, dateStr = sessionDate) {
    if (!studentOrId) return false;
    const s = typeof studentOrId === 'object' ? studentOrId : students.find(item => item.id === studentOrId);
    if (!s) return false;

    // 1. Direct student profile status flag
    if (s.status === 'On Approved Leave' && (dateStr === todayIso || !dateStr)) {
      return true;
    }

    // 2. Active leave records in tps_leaves covering dateStr
    if (Array.isArray(leaves) && leaves.length > 0) {
      return leaves.some(l => {
        let isAssociated = false;
        let studentEntry = null;

        if (l.student_id === s.id) {
          isAssociated = true;
        } else if (Array.isArray(l.student_ids) && l.student_ids.includes(s.id)) {
          isAssociated = true;
        }

        if (Array.isArray(l.student_entries)) {
          const entry = l.student_entries.find(e => e.student_id === s.id);
          if (entry) {
            isAssociated = true;
            studentEntry = entry;
          }
        }

        if (!isAssociated) return false;

        const departs = l.departure_date;
        if (!departs) return false;

        const isEntryReturned = studentEntry ? Boolean(studentEntry.is_returned) : false;
        const entryReturnDate = studentEntry?.actual_return_date;
        const actualReturn = entryReturnDate || l.actual_return_date;
        const expectedReturn = l.expected_return_date;
        const isReturned = l.status === 'Returned' || isEntryReturned;

        // If returned, leave was active between departure and actual return
        if (isReturned && actualReturn) {
          return dateStr >= departs && dateStr <= actualReturn;
        }

        // If not returned yet (Away or Overdue)
        if (dateStr >= departs) {
          if (expectedReturn && dateStr > expectedReturn && l.status !== 'Overdue' && l.status !== 'Away') {
            return false;
          }
          return true;
        }

        return false;
      });
    }

    return s.status === 'On Approved Leave';
  }

  async function loadExistingSessionState() {
    const attendanceSessions = await db.getAttendanceRecords();
    const existingSession = attendanceSessions.find(s => 
      s.classroom_id === activeClassroomId && s.session_date === sessionDate
    );

    const activeList = getEligibleStudents(activeClassroomId);
    studentLateMinutes = {};

    if (existingSession && Array.isArray(existingSession.records) && existingSession.records.length > 0) {
      hasExistingSession = true;
      initialAbsentStudentIds = new Set(
        existingSession.initial_absent_ids ||
        existingSession.records.filter(r => r.status === 'Absent').map(r => r.student_id) ||
        []
      );

      const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);
      const clsStartMin = parseMinutes(activeCls?.start_time || '06:30');

      activeList.forEach(s => {
        const onLeave = isStudentOnLeave(s, sessionDate);
        const rec = existingSession.records.find(r => r.student_id === s.id);
        if (rec) {
          attendanceState[s.id] = onLeave ? 'Leave' : rec.status;
          if (rec.status === 'Late Present' && !onLeave) {
            if (rec.late_minutes != null) {
              studentLateMinutes[s.id] = Number(rec.late_minutes);
            } else if (existingSession.recorded_at) {
              const recDate = new Date(existingSession.recorded_at);
              const recMin = recDate.getHours() * 60 + recDate.getMinutes();
              studentLateMinutes[s.id] = Math.max(1, recMin - clsStartMin);
            } else {
              studentLateMinutes[s.id] = 15;
            }
          }
        } else {
          attendanceState[s.id] = onLeave ? 'Leave' : 'Absent';
        }
      });
    } else {
      // Fresh attendance opening: Default to ABSENT, except students on approved leave
      hasExistingSession = false;
      initialAbsentStudentIds = new Set();
      activeList.forEach(s => {
        const onLeave = isStudentOnLeave(s, sessionDate);
        attendanceState[s.id] = onLeave ? 'Leave' : 'Absent';
      });
    }
  }

  // -------------------------------------------------------------
  // VIEW 1: TIMETABLE CARDS VIEW (MATCHING THE UPLOADED SCREENSHOT)
  // -------------------------------------------------------------
  async function renderTimetableCardsUI() {
    const allSessions = await db.getAttendanceRecords();
    const unlocks = await db.getAttendanceUnlocks();

    // Determine classrooms to show
    let displayList = availableClassrooms;
    if (isAdmin && selectedAdminTeacherId !== 'all') {
      const tUser = users.find(u => u.id === selectedAdminTeacherId);
      displayList = getAssignedClassroomsForUser(tUser);
    }

    // Counts for tabs
    const todayList = displayList.filter(c => {
      const days = Array.isArray(c.days) && c.days.length > 0 ? c.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days.includes(todayKey);
    });

    const liveList = todayList.filter(c => {
      const s = parseMinutes(c.start_time || '06:30');
      const e = parseMinutes(c.end_time || '07:30');
      return currentMinutes >= s && currentMinutes <= e;
    });

    // Apply tab filter
    let filteredCards = displayList;
    if (timetableFilterTab === 'today') {
      filteredCards = todayList.length > 0 ? todayList : displayList;
    } else if (timetableFilterTab === 'live') {
      filteredCards = liveList;
    } else {
      filteredCards = displayList;
    }

    container.innerHTML = `
      <div class="attendance-module-container" style="padding-bottom: 2.5rem;">
        
        <!-- HEADER -->
        <div class="page-header" style="margin-bottom: 1.25rem;">
          <div class="page-title-group">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0;">
                ${isTeacher ? 'My Teaching Timetable & Attendance' : isMentor ? `${isBoysMentor ? 'Boys' : 'Girls'} Mentor Class Timetable & Attendance` : 'Faculty Timetable & Attendance Duty'}
              </h2>
              <span class="badge ${isFaculty ? 'badge-active' : 'badge-default'}" style="font-size: 0.72rem; font-weight: 700;">
                ${isTeacher ? 'Personal Timetable' : isMentor ? `${isBoysMentor ? 'Boys' : 'Girls'} Mentor Class Schedule` : 'Administrative Governance'}
              </span>
            </div>
            <p style="font-size: 0.8rem; color: #64748B; margin-top: 2px;">
              ${isFaculty 
                ? 'Your assigned class timetable cards. Live attendance is strictly enabled only during class hours.' 
                : 'All faculty teaching schedule cards with strict timetable attendance window governance.'}
            </p>
          </div>

          <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <!-- Date Badge Picker -->
            <button type="button" class="btn btn-outline btn-sm" id="att-cards-date-trigger" style="font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem;" title="Select date for attendance schedule">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${sessionDate}</span>
            </button>

            <!-- Go to Attendance Report -->
            <button type="button" class="btn btn-outline btn-sm" id="btn-goto-att-report" style="font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
              ${isTeacher ? 'My Attendance Report' : 'Attendance Report'}
            </button>
          </div>
        </div>

        <!-- ADMIN TEACHER FILTER BAR (Admin Only, never shown to teachers) -->
        ${isAdmin ? `
          <div style="margin-bottom: 1rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="font-size: 0.78rem; font-weight: 700; color: #475569;">Faculty Timetable Filter:</span>
              <select id="att-admin-teacher-select" class="form-control" style="border-radius: 8px; font-weight: 600; font-size: 0.84rem; padding: 0.35rem 0.75rem; cursor: pointer;">
                <option value="all" ${selectedAdminTeacherId === 'all' ? 'selected' : ''}>All Faculty Classrooms (${allClassrooms.length})</option>
                ${eligibleTeachers.map(t => `
                  <option value="${t.id}" ${t.id === selectedAdminTeacherId ? 'selected' : ''}>
                    ${t.full_name || t.email} (${t.role || 'faculty'})
                  </option>
                `).join('')}
              </select>
            </div>
            <span style="font-size: 0.72rem; color: #059669; font-weight: 700;">
              ⚡ Admin can inspect any faculty timetable & unlock sessions
            </span>
          </div>
        ` : ''}

        <!-- TIMETABLE SCHEDULE TABS -->
        <div class="att-timetable-tabs">
          <button type="button" class="att-timetable-tab-btn ${timetableFilterTab === 'today' ? 'is-active' : ''}" data-tab="today">
            Today's Schedule (${todayList.length})
          </button>
          <button type="button" class="att-timetable-tab-btn ${timetableFilterTab === 'weekly' ? 'is-active' : ''}" data-tab="weekly">
            Full Weekly Timetable (${displayList.length})
          </button>
          <button type="button" class="att-timetable-tab-btn ${timetableFilterTab === 'live' ? 'is-active' : ''}" data-tab="live">
            ${liveList.length > 0 ? `<span class="live-pulse-dot" style="margin-right: 2px;"></span>` : ''}
            Live In-Session (${liveList.length})
          </button>
        </div>

        <!-- TIMETABLE CARDS GRID (MATCHING SCREENSHOT 100%) -->
        <div class="att-timetable-cards-list">
          ${filteredCards.length === 0 ? `
            <div style="background: #FFFFFF; border: 1.5px dashed #CBD5E1; border-radius: 16px; padding: 2.5rem; text-align: center; color: #64748B;">
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏱️</div>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: #0F172A; margin: 0 0 0.4rem 0;">
                No Classes Found for this Tab
              </h3>
              <p style="font-size: 0.85rem; margin: 0 0 1rem 0;">
                ${isTeacher 
                  ? 'No assigned classrooms found for this filter. Check the Full Weekly Timetable tab.' 
                  : 'No classrooms found matching the selected filter.'}
              </p>
              <button type="button" class="btn btn-outline btn-sm att-timetable-tab-btn" data-tab="weekly" style="display: inline-flex;">
                View Full Weekly Timetable
              </button>
            </div>
          ` : filteredCards.map(cls => {
            const prog = allPrograms.find(p => p.id === cls.program_id);
            const progName = prog?.name || 'Academic Class';
            const teacher = users.find(u => u.id === cls.teacher_id);
            const teacherName = teacher ? (teacher.full_name || teacher.email) : 'Assigned Faculty';

            const sMin = parseMinutes(cls.start_time || '06:30');
            const eMin = parseMinutes(cls.end_time || '07:30');

            const days = Array.isArray(cls.days) && cls.days.length > 0 ? cls.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const isToday = sessionDate === todayIso;
            const isTodayScheduled = days.includes(todayKey);

            const isLive = isToday && isTodayScheduled && currentMinutes >= sMin && currentMinutes <= eMin;
            const isBefore = isToday && isTodayScheduled && currentMinutes < sMin;
            const isAfter = isToday && isTodayScheduled && currentMinutes > eMin;
            const isPastDate = sessionDate < todayIso;

            const hasSessionRecorded = allSessions.some(s => 
              s.classroom_id === cls.id && s.session_date === sessionDate && Array.isArray(s.records) && s.records.length > 0
            );
            const isUnlocked = unlocks.includes(`${cls.id}_${sessionDate}`);

            // Faculty leave check for this class session
            const facultyLeaveForCls = db.isFacultyOnApprovedLeave(user, sessionDate, facultyLeaves) ||
                                       (isAdmin ? db.isFacultyOnApprovedLeave(cls.teacher_id, sessionDate, facultyLeaves) : null);
            const isFacultyOnLeaveForCard = !isAdmin && Boolean(facultyLeaveForCls);

            // Live Attendance button rule:
            // "if any faculty at leave the could not abelee to take attendence at the time of leave"
            const canTakeNow = !isFacultyOnLeaveForCard && (isLive || (isAdmin && (hasSessionRecorded || isAfter)) || isUnlocked);

            // Enrolled students count
            const enrolledStudents = getEligibleStudents(cls.id);
            const enrolledCount = enrolledStudents.length;

            // Status Badge HTML
            let statusBadgeHtml = '';
            let cardHeading = 'Scheduled Teaching Session';
            let cardSubtitle = `Meets on ${cls.days?.join(', ')}`;

            if (isFacultyOnLeaveForCard) {
              cardHeading = 'Faculty Leave Active';
              cardSubtitle = `Authorized ${facultyLeaveForCls.leave_type || 'Duty Leave'} • Attendance officially waived`;
              statusBadgeHtml = `
                <span class="badge" style="background: #ECFDF5; color: #059669; border: 1.5px solid #34D399; font-weight: 800; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px;">
                  ✓ On Approved Leave (Waived)
                </span>
              `;
            } else if (isLive) {
              cardHeading = 'Active Class In-Session';
              cardSubtitle = `Live attendance window active • Ends at ${formatTime(cls.end_time)}`;
              statusBadgeHtml = `
                <span class="badge" style="background: #ECFDF5; color: #059669; border: 1.5px solid #34D399; font-weight: 800; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.35rem;">
                  <span class="live-pulse-dot"></span> Live In-Session Now
                </span>
              `;
            } else if (hasSessionRecorded) {
              cardHeading = 'Attendance Recorded';
              cardSubtitle = `Submitted for ${formatDate(sessionDate)}`;
              statusBadgeHtml = `
                <span class="badge badge-active" style="border-radius: 9999px; padding: 0.35rem 0.8rem; font-size: 0.74rem;">
                  ✓ Attendance Recorded
                </span>
              `;
            } else if (isBefore) {
              const diffMin = sMin - currentMinutes;
              cardHeading = diffMin <= 30 ? 'Your upcoming class' : 'Scheduled Teaching Session';
              cardSubtitle = diffMin <= 30 ? `Starts in ${diffMin} mins` : `Starts today at ${formatTime(cls.start_time)}`;
              statusBadgeHtml = `
                <span class="badge" style="background: #EFF6FF; color: #1E40AF; border: 1.5px solid #93C5FD; font-weight: 700; font-size: 0.76rem; padding: 0.35rem 0.8rem; border-radius: 9999px;">
                  Today at ${formatTime(cls.start_time)}
                </span>
              `;
            } else if (isAfter || isPastDate) {
              cardHeading = `Past Session (${formatTime(cls.end_time)})`;
              cardSubtitle = `Attendance window closed • ${isUnlocked ? 'Unlocked by Admin' : 'Session ended'}`;
              statusBadgeHtml = isUnlocked ? `
                <span class="badge" style="background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; font-weight: 800; font-size: 0.74rem; border-radius: 9999px; padding: 0.35rem 0.8rem;">
                  🔓 Unlocked by Admin
                </span>
              ` : `
                <span class="badge" style="background: #F8FAFC; color: #64748B; border: 1px solid #CBD5E1; font-weight: 700; font-size: 0.74rem; border-radius: 9999px; padding: 0.35rem 0.8rem;">
                  Session Closed
                </span>
              `;
            } else {
              cardHeading = 'Timetable Session';
              cardSubtitle = `Scheduled on ${cls.days?.join(', ')}`;
              statusBadgeHtml = `
                <span class="badge" style="background: #F8FAFC; color: #64748B; border: 1px solid #CBD5E1; font-weight: 600; font-size: 0.74rem; border-radius: 9999px; padding: 0.35rem 0.8rem;">
                  ${cls.days?.join(', ')}
                </span>
              `;
            }

            return `
              <!-- DEDICATED TIMETABLE CARD MATCHING SCREENSHOT EXACTLY -->
              <div class="teacher-upcoming-card ${isLive ? 'is-live' : isBefore && (sMin - currentMinutes <= 30) ? 'is-soon' : ''}" 
                   id="card-att-class-${cls.id}" 
                   data-cls-id="${cls.id}" 
                   role="button" 
                   tabindex="0"
                   style="cursor: pointer; margin-bottom: 1.25rem;">
                
                <!-- Top Portion: Icon, Title & Time Badge -->
                <div class="upcoming-card-top">
                  <div class="upcoming-card-title-group">
                    <div class="upcoming-card-icon-pill ${isLive ? 'is-live' : isBefore && (sMin - currentMinutes <= 30) ? 'is-soon' : ''}">
                      ${isLive ? '🟢' : hasSessionRecorded ? '✓' : '⏱️'}
                    </div>
                    <div>
                      <h3 class="upcoming-card-heading">${cardHeading}</h3>
                      <span class="upcoming-card-subtitle">${cardSubtitle}</span>
                    </div>
                  </div>

                  <div class="upcoming-card-status-badge">
                    ${statusBadgeHtml}
                  </div>
                </div>

                <!-- Clean Divider Line -->
                <div class="upcoming-divider"></div>

                <!-- Class Primary: Large Green Name & Program Pill -->
                <div class="upcoming-class-primary">
                  <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
                    <h4 class="upcoming-class-name">${cls.name}</h4>
                    ${isAdmin ? `
                      <span class="badge" style="background: #F1F5F9; color: #475569; font-size: 0.72rem; font-weight: 700;">
                        Faculty: ${teacherName}
                      </span>
                    ` : ''}
                  </div>
                  <div style="margin-top: 0.2rem;">
                    <span class="upcoming-prog-pill">${progName}</span>
                  </div>
                </div>

                <!-- 2x2 Details Grid (Timetable Specifications) -->
                <div class="upcoming-details-grid">
                  <div class="upcoming-detail-cell">
                    <span class="detail-label">Schedule Time</span>
                    <span class="detail-value">${formatTime(cls.start_time || '06:30')} – ${formatTime(cls.end_time || '07:30')}</span>
                  </div>
                  <div class="upcoming-detail-cell">
                    <span class="detail-label">Classroom / Hall</span>
                    <span class="detail-value">${cls.room_number ? 'Room ' + cls.room_number : 'Campus Hall'}</span>
                  </div>
                  <div class="upcoming-detail-cell">
                    <span class="detail-label">Enrolled Roster</span>
                    <span class="detail-value">${enrolledCount} Students</span>
                  </div>
                  <div class="upcoming-detail-cell">
                    <span class="detail-label">Scheduled Days</span>
                    <span class="detail-value" style="white-space: nowrap;">${formatDaysSingleLetters(cls.days)}</span>
                  </div>
                </div>

                <!-- Actions Footer: View Details & Take Attendance (Faded except during class time) -->
                <div class="upcoming-card-footer" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem; margin-top: 0.5rem;">
                  <!-- View Details Button: Enters to the details after the time -->
                  <button type="button" class="btn btn-outline btn-sm btn-card-view-details" data-cls-id="${cls.id}" style="font-weight: 700; border-radius: 10px; padding: 0.5rem 1.05rem; font-size: 0.85rem; color: #1E40AF; border-color: #BFDBFE; background: #F8FAFC;">
                    View Details →
                  </button>

                  <!-- Take Attendance Button: Disabled/locked if on leave, or faded except during class time -->
                  ${isFacultyOnLeaveForCard ? `
                    <button type="button" 
                            class="btn btn-outline btn-sm btn-card-take-att is-on-leave" 
                            data-cls-id="${cls.id}"
                            data-can-take="false"
                            data-on-leave="true"
                            disabled
                            style="font-weight: 800; border-radius: 10px; padding: 0.55rem 1.35rem; font-size: 0.88rem; background: #F1F5F9; color: #64748B; border-color: #CBD5E1; opacity: 0.7; cursor: not-allowed;"
                            title="You are currently on authorized faculty leave. Attendance taking is disabled.">
                      🔒 Attendance Waived (On Leave)
                    </button>
                  ` : `
                    <button type="button" 
                            class="btn btn-primary btn-sm btn-card-take-att ${canTakeNow ? '' : 'is-faded'}" 
                            data-cls-id="${cls.id}"
                            data-can-take="${canTakeNow ? 'true' : 'false'}"
                            style="font-weight: 800; border-radius: 10px; padding: 0.55rem 1.35rem; font-size: 0.88rem; background: #059669; border-color: #047857; ${canTakeNow ? 'box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3); cursor: pointer;' : 'opacity: 0.38; filter: grayscale(40%); cursor: not-allowed;'}"
                            title="${canTakeNow ? 'Take live attendance for this session' : `Attendance window locked outside class hours (${formatTime(cls.start_time)} – ${formatTime(cls.end_time)}). Tap to view class details.`}">
                      Take Attendance →
                    </button>
                  `}
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;

    attachTimetableCardsListeners();
  }

  function attachTimetableCardsListeners() {
    if (!container || typeof container.querySelector !== 'function') return;

    // Date badge picker trigger
    container.querySelector('#att-cards-date-trigger')?.addEventListener('click', () => {
      openMobileWheelPicker({
        initialDate: sessionDate,
        title: 'Timetable Date',
        onSelect: async (selectedDate) => {
          sessionDate = formatDateYMD(selectedDate);
          renderTimetableCardsUI();
        }
      });
    });

    // Go to Attendance Report
    container.querySelector('#btn-goto-att-report')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('attendance_report');
      else if (typeof window !== 'undefined') window.location.hash = '#attendance_report';
    });

    // Admin teacher filter
    container.querySelector('#att-admin-teacher-select')?.addEventListener('change', (e) => {
      selectedAdminTeacherId = e.target.value;
      renderTimetableCardsUI();
    });

    // Tabs switcher
    container.querySelectorAll('.att-timetable-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          timetableFilterTab = tab;
          renderTimetableCardsUI();
        }
      });
    });

    // Card View Details Button
    container.querySelectorAll('.btn-card-view-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clsId = btn.getAttribute('data-cls-id');
        if (clsId) {
          activeClassroomId = clsId;
          currentView = 'roster';
          renderClassRosterUI();
        }
      });
    });

    // Card Take Attendance Button (Handles active, faded, and on-leave states)
    container.querySelectorAll('.btn-card-take-att').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.getAttribute('data-on-leave') === 'true') {
          toast.warning('Attendance taking is locked because you are currently on authorized faculty leave.');
          return;
        }
        const clsId = btn.getAttribute('data-cls-id');
        const canTake = btn.getAttribute('data-can-take') === 'true';
        if (clsId) {
          activeClassroomId = clsId;
          currentView = 'roster';
          if (!canTake) {
            const cls = allClassrooms.find(c => c.id === clsId) || availableClassrooms.find(c => c.id === clsId);
            toast.info(`Attendance can only be taken during class hours (${formatTime(cls?.start_time || '06:30')} – ${formatTime(cls?.end_time || '07:30')}). Viewing class details & roster.`);
          }
          renderClassRosterUI();
        }
      });
    });

    // Clicking anywhere on the card enters the details
    container.querySelectorAll('.teacher-upcoming-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // already handled
        const clsId = card.getAttribute('data-cls-id');
        if (clsId) {
          activeClassroomId = clsId;
          currentView = 'roster';
          renderClassRosterUI();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // VIEW 2: CLASS DETAILS & STUDENT ATTENDANCE ROSTER VIEW
  // -------------------------------------------------------------
  async function renderClassRosterUI() {
    await loadExistingSessionState();

    const windowState = await checkWindowStatus(activeClassroomId);
    const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);
    const assignedTeacher = users.find(u => u.id === activeCls?.teacher_id);
    const teacherDisplayName = assignedTeacher ? (assignedTeacher.full_name || assignedTeacher.email) : (isFaculty ? (user?.full_name || 'Assigned Faculty') : 'Rashid Sir');
    const activeProg = allPrograms.find(p => p.id === activeCls?.program_id);

    // Faculty approved leave check for this class session
    const assignedTeacherId = activeCls?.teacher_id || (user.role === 'teacher' ? user.id : '');
    const facultyLeaveRecord = db.isFacultyOnApprovedLeave(user, sessionDate, facultyLeaves) || 
                               db.isFacultyOnApprovedLeave(assignedTeacherId, sessionDate, facultyLeaves);
    const isCurrentUserOnLeave = !isAdmin && Boolean(db.isFacultyOnApprovedLeave(user, sessionDate, facultyLeaves));

    const canInteract = canSubmitAction && !isViewOnly && windowState.canTake && !isCurrentUserOnLeave;
    const activeList = getEligibleStudents(activeClassroomId);
    const onLeaveList = activeList.filter(s => isStudentOnLeave(s, sessionDate));
    const onLeaveCount = onLeaveList.length;
    const inClassCount = activeList.length - onLeaveCount;

    container.innerHTML = `
      <div class="attendance-roster-view-container" style="padding-bottom: 2.5rem;">
        
        <!-- TOP BREADCRUMB / BACK ACTION -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <button type="button" class="btn btn-outline btn-sm" id="btn-back-to-cards" style="font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.45rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Timetable Cards
          </button>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" class="btn btn-outline btn-sm" id="btn-view-att-reports" style="font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
              ${isTeacher ? 'My Attendance Report' : 'Attendance Report'}
            </button>
          </div>
        </div>

        ${facultyLeaveRecord ? `
          <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 12px; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: #D1FAE5; color: #059669; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <strong style="color: #065F46; font-size: 0.88rem; display: block;">Authorized Faculty Leave</strong>
                <span style="font-size: 0.78rem; color: #047857;">${facultyLeaveRecord.faculty_name} has authorized ${facultyLeaveRecord.leave_type} (${formatTime(facultyLeaveRecord.departure_time || '08:00')} – ${formatTime(facultyLeaveRecord.return_time || '16:30')}). Attendance is officially waived by Administration.</span>
              </div>
            </div>
            <span class="badge" style="background: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7; font-weight: 700; font-size: 0.75rem; padding: 0.25rem 0.65rem; border-radius: 9999px;">
              ✓ Approved Waiver
            </span>
          </div>
        ` : ''}

        <!-- BIG CLASS DESCRIPTION CARD ON TOP (NO DROPDOWNS SPEC) -->
        <div class="att-big-class-card" id="att-big-class-card">
          <div class="att-class-top">
            <div class="att-class-top-left">
              <h2 class="att-class-title">${activeCls?.name || 'Classroom Session'}</h2>
              <div class="att-class-sub">${activeProg?.name || 'Class Session'}</div>
            </div>
            <div class="att-card-date-badge" id="att-date-badge-trigger" style="cursor: pointer;" title="Tap to select session date">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${sessionDate}</span>
            </div>
          </div>

          <!-- Class Details Bar -->
          <div class="att-class-details-bar">
            <div class="att-detail-box">
              <span class="att-detail-lbl">Class Time</span>
              <strong class="att-detail-val">${formatTime(activeCls?.start_time || '06:30')} – ${formatTime(activeCls?.end_time || '07:30')}</strong>
            </div>
            <div class="att-detail-box">
              <span class="att-detail-lbl">Room / Hall</span>
              <strong class="att-detail-val">${activeCls?.room_number ? 'Room ' + activeCls.room_number : 'Campus Hall'}</strong>
            </div>
            <div class="att-detail-box">
              <span class="att-detail-lbl">Class Days</span>
              <strong class="att-detail-val" style="white-space: nowrap;">${formatDaysSingleLetters(activeCls?.days)}</strong>
            </div>
            <div class="att-detail-box">
              <span class="att-detail-lbl">Total Students</span>
              <strong class="att-detail-val">${activeList.length} Enrolled ${onLeaveCount > 0 ? `<span style="font-size: 0.72rem; color: #2563EB; font-weight: 700;">(${onLeaveCount} on leave)</span>` : ''}</strong>
            </div>
          </div>

          <!-- Window Status Banner Inside Card -->
          <div class="att-window-status-pill ${windowState.badgeClass}">
            ${windowState.canTake ? `
              <span class="live-pulse-dot" style="margin-right: 0.25rem;"></span>
            ` : `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            `}
            <span style="flex: 1;">${windowState.message}</span>
            ${(isAdmin && windowState.isAfter && !windowState.isUnlockedByAdmin) ? `
              <button class="btn btn-outline btn-xs" id="btn-admin-unlock-window" style="background: #FFFFFF; font-weight: 700; color: #DC2626; border-color: #FECACA; white-space: nowrap;">
                Unlock Late Attendance
              </button>
            ` : (isAdmin && windowState.isUnlockedByAdmin) ? `
              <span class="badge badge-active" style="white-space: nowrap;">✓ Unlocked by Admin</span>
            ` : ''}
          </div>

          <!-- Attendance Summary Counters at Bottom of Card (Present, Absent, On Leave, Total Students) -->
          <div class="att-class-footer-bar">
            <div class="att-stats-classic" id="att-counters">
              ${renderCountersHtml(activeList)}
            </div>
          </div>
        </div>

        <!-- Search Bar (3/5 of line) + All Present (1/5) + Clear (1/5) -->
        <div class="att-search-actions-bar">
          <!-- 3/5: Search Input -->
          <div class="att-search-col-3-5">
            <div class="att-search-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="att-search-input" placeholder="Search student by name..." />
            </div>
          </div>

          <!-- 1/5: All Present Button -->
          <button type="button" 
                  class="btn btn-primary att-btn-col-1-5" 
                  id="btn-mark-all-present" 
                  ${!canInteract ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                  title="Mark all physically present in-class students as Present (skips students on leave)">
            All Present
          </button>

          <!-- 1/5: Clear Button -->
          <button type="button" 
                  class="btn btn-outline att-btn-col-1-5" 
                  id="btn-clear-attendance" 
                  ${!canInteract ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                  title="Clear all marked attendance back to default (Absent)">
            Clear
          </button>
        </div>

        <!-- Roster Filter Segmented Tabs & Count Subbar -->
        <div class="att-roster-subbar">
          <div class="att-roster-filter-pills">
            <button type="button" class="btn btn-xs ${rosterFilterMode === 'all' ? 'btn-primary' : 'btn-outline'} att-roster-tab" data-roster-filter="all" style="border-radius: 8px; font-weight: 700; font-size: 0.72rem; padding: 0.3rem 0.65rem;">
              All (${activeList.length})
            </button>
            <button type="button" class="btn btn-xs ${rosterFilterMode === 'in_class' ? 'btn-primary' : 'btn-outline'} att-roster-tab" data-roster-filter="in_class" style="border-radius: 8px; font-weight: 700; font-size: 0.72rem; padding: 0.3rem 0.65rem;" title="Show only students physically in class (hide students on leave)">
              In Class (${inClassCount})
            </button>
            ${onLeaveCount > 0 ? `
              <button type="button" class="btn btn-xs ${rosterFilterMode === 'on_leave' ? 'btn-primary' : 'btn-outline'} att-roster-tab" data-roster-filter="on_leave" style="border-radius: 8px; font-weight: 700; font-size: 0.72rem; padding: 0.3rem 0.65rem; color: ${rosterFilterMode === 'on_leave' ? '#FFFFFF' : '#2563EB'}; border-color: #BFDBFE;" title="Show only students on approved leave">
                ✈️ On Leave (${onLeaveCount})
              </button>
            ` : ''}
          </div>

          <span class="att-roster-count">${activeList.length} Students</span>
        </div>

        <!-- SMALL COMPACT STUDENT ATTENDANCE CARDS WITH 2-WAY SWITCH -->
        <div class="attendance-compact-list" id="att-cards-container">
          ${renderCompactCardsHtml(activeList, canInteract)}
        </div>
        <div id="att-no-matches" style="display: none; padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.95rem;">
          No students match your search.
        </div>

        <!-- Bottom Submit Bar -->
        <div class="att-submit-bar">
          <div class="att-submit-info">
            ${canInteract
              ? `* Submitting attendance officially records student presence for this session, saves exact timestamp, and logs your faculty duty attendance (${teacherDisplayName}).`
              : (hasExistingSession && isTeacher
                  ? `* Attendance already submitted on this date. Only Administrators are permitted to edit recorded attendance.`
                  : (isCurrentUserOnLeave
                      ? `* You are currently on authorized faculty leave (${facultyLeaveRecord?.leave_type || 'Leave'}). Attendance duty is waived by Administration.`
                      : (isViewOnly 
                          ? '* View-only explore mode: Submitting is disabled.' 
                          : '* Attendance window closed: Session ended.')))}
          </div>
          ${canInteract ? `
            <button class="btn btn-primary" id="btn-submit-attendance" style="padding: 0.75rem 1.6rem; font-weight: 700; background: #059669; border-color: #047857; display: flex; align-items: center; gap: 0.5rem; border-radius: 12px; font-size: 0.92rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Confirm & Submit Attendance
            </button>
          ` : `
            <button class="btn btn-outline" disabled style="padding: 0.75rem 1.6rem; font-weight: 700; opacity: 0.6; cursor: not-allowed; border-radius: 12px; background: #F1F5F9; color: #64748B;">
              ${hasExistingSession && isTeacher
                ? 'Attendance Already Submitted (Locked for Teacher)'
                : (isCurrentUserOnLeave
                    ? '🔒 Attendance Waived (Faculty On Approved Leave)'
                    : (windowState.status === 'locked_before' ? 'Locked (Before Class Time)' : 'Session Closed'))}
            </button>
          `}
        </div>

      </div>
    `;

    attachRosterListeners(canInteract, activeList);
  }

  function renderCountersHtml(activeList = getEligibleStudents(activeClassroomId)) {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    activeList.forEach(s => {
      const onLeave = isStudentOnLeave(s, sessionDate);
      const st = attendanceState[s.id] || (onLeave ? 'Leave' : 'Absent');
      if (onLeave || st === 'Leave' || st === 'On Leave') {
        leaveCount++;
      } else if (st === 'Late Present') {
        lateCount++;
        presentCount++;
      } else if (st === 'Present') {
        presentCount++;
      } else {
        absentCount++;
      }
    });

    const inClassCount = activeList.length - leaveCount;

    return `
      <span class="att-counter-item">Present: <strong style="color: #059669;">${presentCount}</strong></span>
      <span class="att-counter-dot">•</span>
      <span class="att-counter-item">Absent: <strong style="color: #DC2626;">${absentCount}</strong></span>
      ${leaveCount > 0 ? `<span class="att-counter-dot">•</span><span class="att-counter-item" style="color: #2563EB;">On Leave: <strong>${leaveCount}</strong></span>` : ''}
      <span class="att-counter-dot">•</span>
      <span class="att-counter-item" style="color: #0F172A;">Total Students: <strong>${activeList.length}</strong> ${leaveCount > 0 ? `<span style="font-size: 0.74rem; color: #64748B; font-weight: 600;">(${inClassCount} in class)</span>` : ''}</span>
      ${lateCount > 0 ? `<span class="att-counter-dot">•</span><span class="att-counter-item" style="color: #D97706;">Late: <strong>${lateCount}</strong></span>` : ''}
    `;
  }

  function updateCounters(activeList = getEligibleStudents(activeClassroomId)) {
    const countersEl = container.querySelector('#att-counters');
    if (!countersEl) return;
    countersEl.innerHTML = renderCountersHtml(activeList);
  }

  function renderCompactCardsHtml(activeList = getEligibleStudents(activeClassroomId), canInteract = true) {
    const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);

    return activeList.map(s => {
      const onLeave = isStudentOnLeave(s, sessionDate);
      const currentStatus = attendanceState[s.id] || (onLeave ? 'Leave' : 'Absent');
      const isPresent = !onLeave && (currentStatus === 'Present' || currentStatus === 'Late Present');
      const isLatePresent = !onLeave && (currentStatus === 'Late Present');
      const lateMins = studentLateMinutes[s.id] || 15;
      const isGirl = s.gender === 'Female' || s.gender === 'Girls' || s.gender === 'Girl';
      const genderLabel = isGirl ? 'Girl' : 'Boy';
      const initials = (s.full_name || 'Student')
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase();

      const normalizedCls = normalizeClassPattern(s.school_class) || 'STD-I';

      return `
        <div class="attendance-compact-card ${onLeave ? 'is-on-leave is-faded' : (isPresent ? 'is-present' : 'is-absent')} ${isLatePresent ? 'is-late' : ''}" 
             id="att-card-${s.id}" 
             data-student-id="${s.id}"
             data-student-name="${(s.full_name || '').toLowerCase()}"
             data-is-on-leave="${onLeave ? 'true' : 'false'}"
             ${onLeave ? 'style="opacity: 0.55; background: #F8FAFC; border-color: #CBD5E1;"' : ''}>
          
          <!-- Left: Photo / Avatar -->
          <div class="att-compact-avatar" style="background: ${onLeave ? '#F1F5F9' : (isGirl ? '#FDF2F8' : '#EFF6FF')}; color: ${onLeave ? '#64748B' : (isGirl ? '#DB2777' : '#2563EB')};">
            ${s.photo_url ? `
              <img src="${s.photo_url}" alt="${s.full_name}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">${initials}</div>
            ` : `
              <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">${initials}</div>
            `}
          </div>

          <!-- Middle: Name on top, Gender & Class below + Admin visibility of minutes late -->
          <div class="att-compact-info">
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span class="att-compact-name" style="${onLeave ? 'color: #475569;' : ''}">${s.full_name}</span>
              ${onLeave ? `
                <span class="badge att-on-leave-pill" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 3px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                  On Leave
                </span>
              ` : ''}
            </div>
            <span class="att-compact-sub">${genderLabel} • ${normalizedCls} ${onLeave ? '• (Approved Hostel Leave)' : ''}</span>
            ${isLatePresent && isAdmin ? `
              <div class="att-late-admin-note" id="att-late-note-${s.id}">
                ⏱️ ${lateMins} min late (Class: ${formatTime(activeCls?.start_time || '06:30')})
              </div>
            ` : ''}
          </div>

          <!-- Right: 2-Way Adjustable Switch or Locked Leave Badge -->
          <div class="att-compact-action">
            ${onLeave ? `
              <div class="att-leave-locked-badge" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.65rem; background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 9999px; color: #64748B; font-size: 0.72rem; font-weight: 800; cursor: not-allowed;" title="Student is on approved hostel leave. Teachers cannot record attendance.">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>On Leave</span>
              </div>
              <button type="button" 
                      class="att-2way-switch sw-leave" 
                      data-student-id="${s.id}"
                      role="switch" 
                      aria-checked="false"
                      aria-disabled="true"
                      disabled
                      style="display: none; opacity: 0.6; cursor: not-allowed;"
                      title="Student is on approved leave. Attendance cannot be recorded.">
                <span class="att-switch-label">LV</span>
                <span class="att-switch-thumb"></span>
              </button>
            ` : `
              ${isLatePresent ? `
                <span class="att-late-badge" id="att-late-badge-${s.id}" title="Late arrival by ${lateMins} min after class started">${lateMins}m late</span>
              ` : ''}
              <button type="button" 
                      class="att-2way-switch ${isPresent ? 'sw-present' : 'sw-absent'} ${isLatePresent ? 'sw-late' : ''}" 
                      data-student-id="${s.id}"
                      role="switch" 
                      aria-checked="${isPresent ? 'true' : 'false'}"
                      ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                      title="${isLatePresent ? 'Late Present (L) - tap to mark Absent' : isPresent ? 'Present (P) - tap to mark Late' : 'Absent (A) - tap to mark Present'}">
                <span class="att-switch-label">${isLatePresent ? 'L' : isPresent ? 'P' : 'A'}</span>
                <span class="att-switch-thumb"></span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function toggleStudentSwitch(sid, activeList = getEligibleStudents(activeClassroomId)) {
    const isCurrentUserOnLeave = !isAdmin && Boolean(db.isFacultyOnApprovedLeave(user, sessionDate, facultyLeaves));
    if (isCurrentUserOnLeave) {
      toast.warning('Attendance taking is disabled because you are currently on authorized faculty leave.');
      return;
    }

    const s = students.find(item => item.id === sid);
    if (isStudentOnLeave(s, sessionDate)) {
      toast.warning(`${s?.full_name || 'This student'} is on approved hostel leave. Teachers cannot record attendance.`);
      return;
    }

    const currentStatus = attendanceState[sid] || 'Absent';
    const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);
    const clsStartMin = parseMinutes(activeCls?.start_time || '06:30');
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const calculatedLateMinutes = Math.max(1, nowMin - clsStartMin);

    if (currentStatus === 'Absent') {
      const wasInitiallyAbsent = hasExistingSession && initialAbsentStudentIds.has(sid);
      if (wasInitiallyAbsent) {
        attendanceState[sid] = 'Late Present';
        if (!studentLateMinutes[sid]) studentLateMinutes[sid] = calculatedLateMinutes;
        toast.info(`${s?.full_name || 'Student'} marked as Late (L) — ${studentLateMinutes[sid]}m late.`);
      } else {
        attendanceState[sid] = 'Present';
      }
    } else if (currentStatus === 'Present') {
      attendanceState[sid] = 'Late Present';
      if (!studentLateMinutes[sid]) studentLateMinutes[sid] = calculatedLateMinutes;
      toast.info(`${s?.full_name || 'Student'} marked as Late (L) — ${studentLateMinutes[sid]}m late.`);
    } else {
      attendanceState[sid] = 'Absent';
    }

    updateCardVisual(sid);
    updateCounters(activeList);
  }

  function updateCardVisual(sid) {
    const card = container.querySelector(`#att-card-${sid}`);
    if (!card) return;

    const s = students.find(item => item.id === sid);
    const onLeave = isStudentOnLeave(s, sessionDate);
    if (onLeave) {
      card.classList.add('is-on-leave', 'is-faded');
      card.classList.remove('is-present', 'is-absent', 'is-late');
      return;
    }

    const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);
    const currentStatus = attendanceState[sid] || 'Absent';
    const isPresent = currentStatus === 'Present' || currentStatus === 'Late Present';
    const isLatePresent = currentStatus === 'Late Present';
    const lateMins = studentLateMinutes[sid] || 15;

    if (typeof card.classList?.toggle === 'function') {
      card.classList.toggle('is-present', isPresent);
      card.classList.toggle('is-absent', !isPresent);
      card.classList.toggle('is-late', isLatePresent);
    } else {
      if (isPresent) card.classList?.add?.('is-present'); else card.classList?.remove?.('is-present');
      if (!isPresent) card.classList?.add?.('is-absent'); else card.classList?.remove?.('is-absent');
      if (isLatePresent) card.classList?.add?.('is-late'); else card.classList?.remove?.('is-late');
    }

    const sw = typeof card.querySelector === 'function' ? card.querySelector('.att-2way-switch') : null;
    if (sw) {
      if (typeof sw.classList?.toggle === 'function') {
        sw.classList.toggle('sw-present', isPresent && !isLatePresent);
        sw.classList.toggle('sw-absent', !isPresent);
        sw.classList.toggle('sw-late', isLatePresent);
      }
      sw.setAttribute('aria-checked', isPresent ? 'true' : 'false');
      const lbl = typeof sw.querySelector === 'function' ? sw.querySelector('.att-switch-label') : null;
      if (lbl) {
        lbl.textContent = isLatePresent ? 'L' : isPresent ? 'P' : 'A';
      }
      sw.setAttribute('title', isLatePresent ? 'Late Present (L) - tap to mark Absent' : isPresent ? 'Present (P) - tap to mark Late' : 'Absent (A) - tap to mark Present');
    }

    const actionWrap = typeof card.querySelector === 'function' ? card.querySelector('.att-compact-action') : null;
    if (actionWrap) {
      let lateBadge = typeof actionWrap.querySelector === 'function' ? actionWrap.querySelector('.att-late-badge') : null;
      if (isLatePresent) {
        if (!lateBadge && typeof document !== 'undefined') {
          lateBadge = document.createElement('span');
          lateBadge.className = 'att-late-badge';
          lateBadge.id = `att-late-badge-${sid}`;
          actionWrap.insertBefore(lateBadge, sw);
        }
        if (lateBadge) {
          lateBadge.textContent = `${lateMins}m late`;
          lateBadge.setAttribute('title', `Late arrival by ${lateMins} min after class started`);
        }
      } else {
        lateBadge?.remove?.();
      }
    }

    const infoWrap = typeof card.querySelector === 'function' ? card.querySelector('.att-compact-info') : null;
    if (infoWrap && isAdmin) {
      let adminNote = typeof infoWrap.querySelector === 'function' ? infoWrap.querySelector('.att-late-admin-note') : null;
      if (isLatePresent) {
        if (!adminNote && typeof document !== 'undefined') {
          adminNote = document.createElement('div');
          adminNote.className = 'att-late-admin-note';
          adminNote.id = `att-late-note-${sid}`;
          infoWrap.appendChild(adminNote);
        }
        if (adminNote) {
          adminNote.innerHTML = `⏱️ ${lateMins} min late (Class: ${formatTime(activeCls?.start_time || '06:30')})`;
        }
      } else {
        adminNote?.remove?.();
      }
    }
  }

  function updateAllCardsVisual(activeList = getEligibleStudents(activeClassroomId)) {
    activeList.forEach(s => updateCardVisual(s.id));
  }

  function filterCards() {
    const query = (container.querySelector('#att-search-input')?.value || '').toLowerCase().trim();
    let matchCount = 0;

    container.querySelectorAll('.attendance-compact-card').forEach(card => {
      const name = card.getAttribute('data-student-name') || '';
      const isOnLeave = card.getAttribute('data-is-on-leave') === 'true';

      let matchesFilter = true;
      if (rosterFilterMode === 'in_class' && isOnLeave) matchesFilter = false;
      if (rosterFilterMode === 'on_leave' && !isOnLeave) matchesFilter = false;

      const matchesQuery = !query || name.includes(query);
      const visible = matchesFilter && matchesQuery;

      if (visible) {
        card.style.display = 'flex';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const noMatchesEl = container.querySelector('#att-no-matches');
    if (noMatchesEl) {
      noMatchesEl.style.display = matchCount === 0 ? 'block' : 'none';
    }
  }

  function attachRosterListeners(canInteract, activeList) {
    if (!container || typeof container.querySelector !== 'function') return;

    // Back button to Timetable Cards
    container.querySelector('#btn-back-to-cards')?.addEventListener('click', () => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('tps_active_att_cls');
        sessionStorage.removeItem('tps_active_att_date');
      }
      currentView = 'cards';
      renderTimetableCardsUI();
    });

    // View Reports
    container.querySelector('#btn-view-att-reports')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('attendance_report');
      else if (typeof window !== 'undefined') window.location.hash = '#attendance_report';
    });

    // Search filter
    container.querySelector('#att-search-input')?.addEventListener('input', filterCards);

    // Roster filter pills (All / In Class / On Leave)
    container.querySelectorAll('.att-roster-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        rosterFilterMode = btn.getAttribute('data-roster-filter') || 'all';
        container.querySelectorAll('.att-roster-tab').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
        filterCards();
      });
    });

    // Guard clicks on leave cards to inform teachers
    container.querySelectorAll('.attendance-compact-card.is-on-leave').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = card.getAttribute('data-student-id');
        const s = students.find(item => item.id === sid);
        toast.warning(`${s?.full_name || 'This student'} is on approved hostel leave. Teachers cannot record attendance.`);
      });
    });

    // Admin unlock listener
    container.querySelector('#btn-admin-unlock-window')?.addEventListener('click', async () => {
      await db.unlockAttendanceWindow(activeClassroomId, sessionDate);
      toast.success('Unlocked late attendance window. Faculty can now record attendance.');
      renderClassRosterUI();
    });

    // Date badge picker trigger
    container.querySelector('#att-date-badge-trigger')?.addEventListener('click', () => {
      openMobileWheelPicker({
        initialDate: sessionDate,
        title: 'Attendance Date',
        onSelect: async (selectedDate) => {
          const selectedStr = formatDateYMD(selectedDate);
          if (isTeacher && selectedStr !== todayIso) {
            const isUnlocked = await db.isAttendanceWindowUnlocked(activeClassroomId, selectedStr);
            if (!isUnlocked) {
              toast.warning(`Date ${selectedStr} is locked. Teachers can only select Admin-unlocked missed attendance dates.`);
              return;
            }
          }
          sessionDate = selectedStr;
          renderClassRosterUI();
        }
      });
    });

    // Mark All Present (Skips students on approved leave)
    container.querySelector('#btn-mark-all-present')?.addEventListener('click', () => {
      if (!canInteract) return;
      const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);
      const clsStartMin = parseMinutes(activeCls?.start_time || '06:30');
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const minutesLate = Math.max(1, nowMin - clsStartMin);

      let markedCount = 0;
      activeList.forEach(s => {
        if (isStudentOnLeave(s, sessionDate)) return; // Strictly skip students on leave
        const wasInitiallyAbsent = hasExistingSession && initialAbsentStudentIds.has(s.id);
        if (wasInitiallyAbsent) {
          attendanceState[s.id] = 'Late Present';
          if (!studentLateMinutes[s.id]) studentLateMinutes[s.id] = minutesLate;
        } else {
          attendanceState[s.id] = 'Present';
        }
        markedCount++;
      });
      updateAllCardsVisual(activeList);
      updateCounters(activeList);
      toast.info(`Marked in-class students (${markedCount}) Present.`);
    });

    // Clear Attendance (Resets in-class students back to default Absent & clears late minutes and search)
    const handleClearAttendance = () => {
      if (!canInteract) return;
      let clearedCount = 0;
      activeList.forEach(s => {
        if (isStudentOnLeave(s, sessionDate)) return; // Strictly leave students on approved leave untouched
        attendanceState[s.id] = 'Absent';
        delete studentLateMinutes[s.id];
        clearedCount++;
      });

      const searchInput = container.querySelector('#att-search-input');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        filterCards();
      }

      updateAllCardsVisual(activeList);
      updateCounters(activeList);
      toast.info(`Attendance cleared: In-class students (${clearedCount}) reset to default (Absent).`);
    };

    container.querySelector('#btn-clear-attendance')?.addEventListener('click', handleClearAttendance);
    container.querySelector('#btn-mark-all-absent')?.addEventListener('click', handleClearAttendance);

    if (canInteract) {
      // Toggle switches
      container.querySelectorAll('.att-2way-switch').forEach(sw => {
        sw.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = sw.getAttribute('data-student-id');
          if (sid) toggleStudentSwitch(sid, activeList);
        });
      });

      // Submit attendance
      container.querySelector('#btn-submit-attendance')?.addEventListener('click', async () => {
        const isCurrentUserOnLeave = !isAdmin && Boolean(db.isFacultyOnApprovedLeave(user, sessionDate, facultyLeaves));
        if (isCurrentUserOnLeave) {
          toast.error('Cannot submit attendance: You are on authorized faculty leave.');
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Confirm Live Attendance Submission',
          message: 'Submit attendance for this class session? This will record student presence, timestamp the exact time, and record your faculty duty attendance.',
          confirmText: 'Submit Attendance'
        });

        if (confirmed) {
          const activeCls = allClassrooms.find(c => c.id === activeClassroomId) || availableClassrooms.find(c => c.id === activeClassroomId);
          const activeProg = allPrograms.find(p => p.id === activeCls?.program_id);
          const assignedTeacher = users.find(u => u.id === activeCls?.teacher_id);
          const teacherDisplayName = assignedTeacher ? (assignedTeacher.full_name || assignedTeacher.email) : (isFaculty ? (user?.full_name || 'Assigned Faculty') : 'Rashid Sir');

          const records = activeList.map(s => {
            const sid = s.id;
            const onLeave = isStudentOnLeave(s, sessionDate);
            const status = onLeave ? 'Leave' : (attendanceState[sid] || 'Absent');
            return { 
              student_id: sid, 
              status,
              late_minutes: status === 'Late Present' ? (studentLateMinutes[sid] || 15) : null
            };
          });

          const recordedAtIso = new Date().toISOString();

          await db.saveAttendanceSession({
            program_id: activeProg?.id || 'prog-1',
            classroom_id: activeClassroomId,
            session_date: sessionDate,
            teacher_id: activeCls?.teacher_id || user?.id || 'u-2',
            teacher_name: teacherDisplayName,
            recorded_at: recordedAtIso,
            records
          });

          toast.success(`Attendance submitted! Exact time (${formatTime(new Date().toTimeString().slice(0, 5))}) stored and faculty duty marked Present.`);
          hasExistingSession = true;
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('tps_active_att_cls');
            sessionStorage.removeItem('tps_active_att_date');
          }
          // Close students list window and return to timetable cards view
          currentView = 'cards';
          await renderTimetableCardsUI();
        }
      });
    }
  }

  // Initial Dispatcher
  if (currentView === 'roster') {
    await renderClassRosterUI();
  } else {
    await renderTimetableCardsUI();
  }
}
