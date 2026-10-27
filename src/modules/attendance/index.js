import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule } from '../../lib/permissions.js';
import { formatTime, normalizeClassPattern } from '../../lib/utils.js';

function parseMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function renderAttendanceModule(container, { onNavigate }) {
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
  const preselectedClsId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tps_active_att_cls') : null;
  if (preselectedClsId) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('tps_active_att_cls');
    const target = classrooms.find(c => c.id === preselectedClsId);
    if (target) {
      activeClassroomId = target.id;
    }
  }

  // Today's Date & Time Check
  const now = new Date();
  const sessionDate = now.toISOString().split('T')[0];
  const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayKey = DAY_KEYS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Time-Window Status Calculation
  async function checkWindowStatus(clsId) {
    const cls = classrooms.find(c => c.id === clsId);
    if (!cls) return { canTake: false, reason: 'Classroom not found' };

    const days = Array.isArray(cls.days) && cls.days.length > 0 ? cls.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isTodayScheduled = days.includes(todayKey);
    const startMin = parseMinutes(cls.start_time || '06:30');
    const endMin = parseMinutes(cls.end_time || '07:30');

    const isInWindow = currentMinutes >= startMin && currentMinutes <= endMin;
    const isBefore = currentMinutes < startMin;
    const isAfter = currentMinutes > endMin;

    const isUnlockedByAdmin = await db.isAttendanceWindowUnlocked(cls.id, sessionDate);

    // Admins always have access. Teachers have access if in window or unlocked by admin.
    if (isAdmin) {
      return {
        canTake: true,
        status: 'admin_override',
        message: 'Admin Oversight Mode: Full access to record or edit attendance at any time.',
        badgeClass: 'is-live',
        isAfter,
        isUnlockedByAdmin
      };
    }

    if (isUnlockedByAdmin) {
      return {
        canTake: true,
        status: 'admin_unlocked',
        message: 'Admin Exception Granted: Late attendance window unlocked by administration.',
        badgeClass: 'is-live'
      };
    }

    if (!isTodayScheduled) {
      return {
        canTake: false,
        status: 'not_scheduled_today',
        message: `No Class Scheduled Today: ${cls.name} is on (${days.join(', ')}). Today is ${todayKey}.`,
        badgeClass: 'is-locked-after'
      };
    }

    if (isBefore) {
      const diff = startMin - currentMinutes;
      return {
        canTake: false,
        status: 'locked_before',
        message: `Attendance Locked: Class starts in ${diff} minutes at ${formatTime(cls.start_time)}. Opens during class time.`,
        badgeClass: 'is-locked-before'
      };
    }

    if (isAfter) {
      return {
        canTake: false,
        status: 'locked_after',
        message: `Attendance Window Closed: Session ended at ${formatTime(cls.end_time)}. Requires Admin unlock to edit.`,
        badgeClass: 'is-locked-after',
        isAfter: true
      };
    }

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
        <div class="page-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-outline" id="btn-view-att-reports">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Attendance Reports
          </button>
        </div>
      </div>

      <!-- BIG CLASS DESCRIPTION CARD ON TOP (NO DROPDOWNS SPEC) -->
      <div class="att-big-class-card" id="att-big-class-card">
        <div class="att-class-top">
          <div>
            <div class="att-class-badge-row">
              <span class="badge" style="background: #ECFDF5; color: #047857; font-weight: 700; border: 1px solid #A7F3D0; font-size: 0.76rem;">${activeProg?.name || 'Class Session'}</span>
              <span class="badge" style="background: #F8FAFC; border: 1px solid #E2E8F0; color: #475569; font-weight: 600; font-size: 0.76rem;">Date: ${sessionDate}</span>
            </div>
            <h2 class="att-class-title">${activeCls?.name || 'Classroom Session'}</h2>
            <div class="att-class-sub">Assigned Faculty: <strong>${teacherDisplayName}</strong></div>
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
            <strong class="att-detail-val">${(activeCls?.days || ['Mon','Tue','Wed','Thu','Fri','Sat']).join(', ')}</strong>
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

        <!-- Switch Class Pills (for teachers with multiple classes or Admin) -->
        ${classrooms.length > 1 ? `
          <div class="att-class-switch-row">
            <span class="att-switch-label-text">Select Class:</span>
            <div class="att-class-pills">
              ${classrooms.map(c => `
                <button type="button" class="att-class-pill-btn ${c.id === activeClassroomId ? 'active' : ''}" data-cls-id="${c.id}">
                  ${c.name}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Attendance Summary Counters & Quick Bulk Buttons -->
        <div class="att-class-footer-bar">
          <div class="att-stats-pills" id="att-counters">
            ${renderCountersHtml()}
          </div>
          <div class="att-bulk-btns">
            <button type="button" class="btn btn-outline btn-xs" id="btn-mark-all-absent" ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : 'style="color: #DC2626; border-color: #FECACA;"'}>
              All Absent
            </button>
            <button type="button" class="btn btn-primary btn-xs" id="btn-mark-all-present" ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : 'style="background: #059669; border-color: #047857;"'}>
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
            : (isViewOnly 
                ? '* View-only explore mode: Submitting is disabled.' 
                : '* Attendance window closed: Session ended.')}
        </div>
        ${canInteract ? `
          <button class="btn btn-primary" id="btn-submit-attendance" style="padding: 0.75rem 1.6rem; font-weight: 700; background: #059669; border-color: #047857; display: flex; align-items: center; gap: 0.5rem; border-radius: 12px; font-size: 0.92rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Confirm & Submit Attendance
          </button>
        ` : `
          <button class="btn btn-outline" disabled style="padding: 0.75rem 1.6rem; font-weight: 700; opacity: 0.6; cursor: not-allowed; border-radius: 12px;">
            ${windowState.status === 'locked_before' ? 'Locked (Before Class Time)' : 'Session Closed'}
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
      <span class="att-stat-pill present">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
        Present: ${presentCount}
      </span>
      ${lateCount > 0 ? `
        <span class="att-stat-pill late">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span>
          Late: ${lateCount}
        </span>
      ` : ''}
      <span class="att-stat-pill absent">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
        Absent: ${absentCount}
      </span>
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

    // View Reports
    container.querySelector('#btn-view-att-reports')?.addEventListener('click', () => onNavigate('reports'));

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
