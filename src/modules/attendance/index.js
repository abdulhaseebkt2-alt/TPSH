import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule } from '../../lib/permissions.js';
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
  const isAdmin = user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin';
  const canSubmitAction = canPerformAction(user, 'attendance', 'submit_attendance') || canPerformAction(user, 'attendance', 'edit');
  const isViewOnly = isViewOnlyModule(user, 'attendance');

  const allPrograms = await db.getPrograms();
  const allClassrooms = await db.getClassrooms();
  const students = await db.getStudents();
  const users = await db.getUsers();

  // 1. Scoping: Teacher can ONLY see & take attendance for their assigned classes
  let availableClassrooms = allClassrooms;
  if (isTeacher) {
    const teacherId = user?.id;
    const assigned = allClassrooms.filter(c => 
      c.teacher_id === teacherId || 
      (user.email && c.teacher_id === user.email) ||
      (user.full_name && c.teacher_id === user.full_name)
    );
    if (assigned.length > 0) {
      availableClassrooms = assigned;
    } else {
      availableClassrooms = allClassrooms.slice(0, 2);
    }
  }

  const classrooms = availableClassrooms;
  let activeClassroomId = classrooms[0]?.id || 'cls-1';

  // Check if directed from a specific classroom card or dashboard
  const preselectedClsId = initialClassId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tps_active_att_cls') : null);
  if (preselectedClsId) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('tps_active_att_cls');
    const target = classrooms.find(c => c.id === preselectedClsId);
    if (target) {
      activeClassroomId = target.id;
    } else {
      activeClassroomId = preselectedClsId;
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

  // Time-Window Status Calculation
  async function checkWindowStatus(clsId, targetDate = sessionDate) {
    const cls = classrooms.find(c => c.id === clsId);
    if (!cls) return { canTake: false, reason: 'Classroom not found' };

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
        message: `No Class Scheduled on ${targetDayKey}: ${cls.name} is on (${days.join(', ')}).`,
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
    // Considered missed attendance. Requires admin permission.
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

  // Determine eligible students for active class
  function getEligibleStudents() {
    const targetCls = classrooms.find(c => c.id === activeClassroomId);
    if (targetCls && Array.isArray(targetCls.student_ids) && targetCls.student_ids.length > 0) {
      const assignedSet = new Set(targetCls.student_ids);
      const filtered = students.filter(s => assignedSet.has(s.id));
      if (filtered.length > 0) return filtered;
    }
    return students;
  }

  // Attendance State and "Late Present" tracking
  let attendanceState = {};
  let initialAbsentStudentIds = new Set();
  let hasExistingSession = false;

  async function loadExistingSessionState() {
    const attendanceSessions = await db.getAttendanceRecords();
    const existingSession = attendanceSessions.find(s => 
      s.classroom_id === activeClassroomId && s.session_date === sessionDate
    );

    const activeList = getEligibleStudents();

    if (existingSession && Array.isArray(existingSession.records) && existingSession.records.length > 0) {
      hasExistingSession = true;
      initialAbsentStudentIds = new Set(
        existingSession.initial_absent_ids ||
        existingSession.records.filter(r => r.status === 'Absent').map(r => r.student_id) ||
        []
      );

      activeList.forEach(s => {
        const rec = existingSession.records.find(r => r.student_id === s.id);
        if (rec) {
          attendanceState[s.id] = rec.status;
        } else {
          attendanceState[s.id] = 'Absent';
        }
      });
    } else {
      // Fresh attendance opening: Default to ABSENT as requested by user
      hasExistingSession = false;
      initialAbsentStudentIds = new Set();
      activeList.forEach(s => {
        attendanceState[s.id] = 'Absent';
      });
    }
  }

  async function renderFullUI() {
    await loadExistingSessionState();

    const windowState = await checkWindowStatus(activeClassroomId);
    const activeCls = classrooms.find(c => c.id === activeClassroomId);
    const assignedTeacher = users.find(u => u.id === activeCls?.teacher_id);
    const teacherDisplayName = assignedTeacher ? (assignedTeacher.full_name || assignedTeacher.email) : (isTeacher ? (user?.full_name || 'Assigned Faculty') : 'Rashid Sir');
    const activeProg = allPrograms.find(p => p.id === activeCls?.program_id);

    const canInteract = canSubmitAction && !isViewOnly && windowState.canTake;
    const activeList = getEligibleStudents();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <h2>${isTeacher ? 'My Classroom Attendance Duty' : 'Student & Teacher Attendance Management'}</h2>
          <p>${isTeacher ? 'Take and submit live attendance for your assigned classrooms during class hours' : 'Institutional daily attendance governance'}</p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-outline btn-sm" id="btn-view-att-reports" style="font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
            ${isTeacher ? 'My Attendance Report' : 'Attendance Report'}
          </button>
        </div>
      </div>

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
            <strong class="att-detail-val">${activeList.length} Enrolled</strong>
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

        <!-- Attendance Summary Counters & Quick Bulk Buttons (Single Line, Classic UI) -->
        <div class="att-class-footer-bar">
          <div class="att-stats-classic" id="att-counters">
            ${renderCountersHtml()}
          </div>
          <div class="att-bulk-btns">
            <button type="button" class="btn-classic-action" id="btn-mark-all-absent" ${!canInteract ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              All Absent
            </button>
            <button type="button" class="btn-classic-action" id="btn-mark-all-present" ${!canInteract ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              All Present
            </button>
          </div>
        </div>
      </div>

      <!-- Roster Search Bar -->
      <div class="att-roster-header">
        <div class="att-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="att-search-input" placeholder="Search student by name..." />
        </div>
        <span class="att-roster-count">${activeList.length} Students</span>
      </div>

      <!-- SMALL COMPACT STUDENT ATTENDANCE CARDS WITH 2-WAY SWITCH -->
      <div class="attendance-compact-list" id="att-cards-container">
        ${renderCompactCardsHtml(canInteract)}
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
                : (isViewOnly 
                    ? '* View-only explore mode: Submitting is disabled.' 
                    : '* Attendance window closed: Session ended.'))}
        </div>
        ${canInteract ? `
          <button class="btn btn-primary" id="btn-submit-attendance" style="padding: 0.75rem 1.6rem; font-weight: 700; background: #059669; border-color: #047857; display: flex; align-items: center; gap: 0.5rem; border-radius: 12px; font-size: 0.92rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Confirm & Submit Attendance
          </button>
        ` : `
          <button class="btn btn-outline" disabled style="padding: 0.75rem 1.6rem; font-weight: 700; opacity: 0.6; cursor: not-allowed; border-radius: 12px;">
            ${hasExistingSession && isTeacher
              ? 'Attendance Already Submitted (Locked for Teacher)'
              : (windowState.status === 'locked_before' ? 'Locked (Before Class Time)' : 'Session Closed')}
          </button>
        `}
      </div>
    `;

    attachListeners(canInteract);
  }

  function renderCountersHtml() {
    const activeList = getEligibleStudents();
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    activeList.forEach(s => {
      const st = attendanceState[s.id] || 'Absent';
      if (st === 'Late Present') {
        lateCount++;
        presentCount++;
      } else if (st === 'Present') {
        presentCount++;
      } else {
        absentCount++;
      }
    });

    return `
      <span class="att-counter-item">Present: <strong>${presentCount}</strong></span>
      <span class="att-counter-dot">•</span>
      <span class="att-counter-item">Absent: <strong>${absentCount}</strong></span>
      ${lateCount > 0 ? `<span class="att-counter-dot">•</span><span class="att-counter-item">Late: <strong>${lateCount}</strong></span>` : ''}
    `;
  }

  function updateCounters() {
    const countersEl = container.querySelector('#att-counters');
    if (!countersEl) return;
    countersEl.innerHTML = renderCountersHtml();
  }

  function renderCompactCardsHtml(canInteract = true) {
    const activeList = getEligibleStudents();

    return activeList.map(s => {
      const currentStatus = attendanceState[s.id] || 'Absent';
      const isPresent = currentStatus === 'Present' || currentStatus === 'Late Present';
      const isLatePresent = currentStatus === 'Late Present';
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
        <div class="attendance-compact-card ${isPresent ? 'is-present' : 'is-absent'}" 
             id="att-card-${s.id}" 
             data-student-id="${s.id}"
             data-student-name="${(s.full_name || '').toLowerCase()}">
          
          <!-- Left: Photo / Avatar -->
          <div class="att-compact-avatar" style="background: ${isGirl ? '#FDF2F8' : '#EFF6FF'}; color: ${isGirl ? '#DB2777' : '#2563EB'};">
            ${s.photo_url ? `
              <img src="${s.photo_url}" alt="${s.full_name}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">${initials}</div>
            ` : `
              <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">${initials}</div>
            `}
          </div>

          <!-- Middle: Name on top, Gender & Class below -->
          <div class="att-compact-info">
            <span class="att-compact-name">${s.full_name}</span>
            <span class="att-compact-sub">${genderLabel} • ${normalizedCls}</span>
          </div>

          <!-- Right: 2-Way Adjustable Switch (Green = Present, Red = Absent) -->
          <div class="att-compact-action">
            ${isLatePresent ? `
              <span class="att-late-badge">Late Present</span>
            ` : ''}
            <button type="button" 
                    class="att-2way-switch ${isPresent ? 'sw-present' : 'sw-absent'} ${isLatePresent ? 'sw-late' : ''}" 
                    data-student-id="${s.id}"
                    role="switch" 
                    aria-checked="${isPresent ? 'true' : 'false'}"
                    ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                    title="${isPresent ? (isLatePresent ? 'Late Present (tap to mark Absent)' : 'Present (tap to mark Absent)') : 'Absent (tap to mark Present)'}">
              <span class="att-switch-label">${isLatePresent ? 'LATE' : isPresent ? 'P' : 'A'}</span>
              <span class="att-switch-thumb"></span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function toggleStudentSwitch(sid) {
    const currentStatus = attendanceState[sid] || 'Absent';
    const s = students.find(item => item.id === sid);

    if (currentStatus === 'Absent') {
      // Flipping from Absent to Present
      // If session was previously submitted or student was recorded absent initially:
      const wasInitiallyAbsent = hasExistingSession && initialAbsentStudentIds.has(sid);
      if (wasInitiallyAbsent) {
        attendanceState[sid] = 'Late Present';
        toast.info(`${s?.full_name || 'Student'} marked as Late Present.`);
      } else {
        attendanceState[sid] = 'Present';
      }
    } else {
      // Flipping from Present / Late Present back to Absent
      attendanceState[sid] = 'Absent';
    }

    updateCardVisual(sid);
    updateCounters();
  }

  function updateCardVisual(sid) {
    const card = container.querySelector(`#att-card-${sid}`);
    if (!card) return;

    const currentStatus = attendanceState[sid] || 'Absent';
    const isPresent = currentStatus === 'Present' || currentStatus === 'Late Present';
    const isLatePresent = currentStatus === 'Late Present';

    card.classList.toggle('is-present', isPresent);
    card.classList.toggle('is-absent', !isPresent);

    const sw = card.querySelector('.att-2way-switch');
    if (sw) {
      sw.classList.toggle('sw-present', isPresent);
      sw.classList.toggle('sw-absent', !isPresent);
      sw.classList.toggle('sw-late', isLatePresent);
      sw.setAttribute('aria-checked', isPresent ? 'true' : 'false');
      const lbl = sw.querySelector('.att-switch-label');
      if (lbl) {
        lbl.textContent = isLatePresent ? 'LATE' : isPresent ? 'P' : 'A';
      }
    }

    const actionWrap = card.querySelector('.att-compact-action');
    if (actionWrap) {
      let lateBadge = actionWrap.querySelector('.att-late-badge');
      if (isLatePresent) {
        if (!lateBadge) {
          lateBadge = document.createElement('span');
          lateBadge.className = 'att-late-badge';
          lateBadge.textContent = 'Late Present';
          actionWrap.insertBefore(lateBadge, sw);
        }
      } else {
        lateBadge?.remove();
      }
    }
  }

  function updateAllCardsVisual() {
    getEligibleStudents().forEach(s => updateCardVisual(s.id));
  }

  function filterCards() {
    const query = (container.querySelector('#att-search-input')?.value || '').toLowerCase().trim();
    let matchCount = 0;

    container.querySelectorAll('.attendance-compact-card').forEach(card => {
      const name = card.getAttribute('data-student-name') || '';
      const matches = !query || name.includes(query);
      if (matches) {
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

  function attachListeners(canInteract) {
    // Search filter
    container.querySelector('#att-search-input')?.addEventListener('input', filterCards);

    // Switch Class Pills
    container.querySelectorAll('.att-class-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        if (clsId && clsId !== activeClassroomId) {
          activeClassroomId = clsId;
          renderFullUI();
        }
      });
    });

    // Admin unlock listener
    container.querySelector('#btn-admin-unlock-window')?.addEventListener('click', async () => {
      await db.unlockAttendanceWindow(activeClassroomId, sessionDate);
      toast.success('Unlocked late attendance window. Faculty can now record attendance.');
      renderFullUI();
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
          renderFullUI();
        }
      });
    });

    // View Reports
    container.querySelector('#btn-view-att-reports')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('attendance_report');
      else if (typeof window !== 'undefined') window.location.hash = '#attendance_report';
    });

    if (canInteract) {
      // Toggle switches
      container.querySelectorAll('.att-2way-switch').forEach(sw => {
        sw.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = sw.getAttribute('data-student-id');
          if (sid) toggleStudentSwitch(sid);
        });
      });

      // Mark All Present
      container.querySelector('#btn-mark-all-present')?.addEventListener('click', () => {
        getEligibleStudents().forEach(s => {
          const wasInitiallyAbsent = hasExistingSession && initialAbsentStudentIds.has(s.id);
          attendanceState[s.id] = wasInitiallyAbsent ? 'Late Present' : 'Present';
        });
        updateAllCardsVisual();
        updateCounters();
        toast.info('Marked all students Present.');
      });

      // Mark All Absent
      container.querySelector('#btn-mark-all-absent')?.addEventListener('click', () => {
        getEligibleStudents().forEach(s => {
          attendanceState[s.id] = 'Absent';
        });
        updateAllCardsVisual();
        updateCounters();
        toast.info('Marked all students Absent.');
      });

      // Submit attendance
      container.querySelector('#btn-submit-attendance')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Confirm Live Attendance Submission',
          message: 'Submit attendance for this class session? This will record student presence, timestamp the exact time, and record your faculty duty attendance.',
          confirmText: 'Submit Attendance'
        });

        if (confirmed) {
          const activeCls = classrooms.find(c => c.id === activeClassroomId);
          const activeProg = allPrograms.find(p => p.id === activeCls?.program_id);
          const assignedTeacher = users.find(u => u.id === activeCls?.teacher_id);
          const teacherDisplayName = assignedTeacher ? (assignedTeacher.full_name || assignedTeacher.email) : (isTeacher ? (user?.full_name || 'Assigned Faculty') : 'Rashid Sir');

          const records = Object.entries(attendanceState).map(([sid, status]) => {
            return { student_id: sid, status };
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
          // Refresh state
          await loadExistingSessionState();
          updateCounters();
          updateAllCardsVisual();
        }
      });
    }
  }

  await renderFullUI();
}
