import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule } from '../../lib/permissions.js';
import { formatTime } from '../../lib/utils.js';

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
    // If teacher has assigned classrooms, restrict strictly to them
    if (assigned.length > 0) {
      availableClassrooms = assigned;
    } else {
      // Demo fallback if teacher not yet assigned to any specific classroom
      availableClassrooms = allClassrooms.slice(0, 2);
    }
  }

  // Filter available programs to only those having available classrooms
  const availableProgIds = new Set(availableClassrooms.map(c => c.program_id));
  const programs = allPrograms.filter(p => availableProgIds.has(p.id) || availableProgIds.size === 0);
  const classrooms = availableClassrooms;

  let activeProgramId = programs[0]?.id || allPrograms[0]?.id || 'prog-1';
  const initialProgCls = classrooms.filter(c => c.program_id === activeProgramId);
  let activeClassroomId = initialProgCls[0]?.id || classrooms[0]?.id || 'cls-1';

  // Check if directed from a specific classroom card or dashboard
  const preselectedClsId = sessionStorage.getItem('tps_active_att_cls');
  if (preselectedClsId) {
    sessionStorage.removeItem('tps_active_att_cls');
    const target = classrooms.find(c => c.id === preselectedClsId);
    if (target) {
      activeClassroomId = target.id;
      if (target.program_id) activeProgramId = target.program_id;
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
        badgeClass: 'badge-active',
        isAfter,
        isUnlockedByAdmin
      };
    }

    if (isUnlockedByAdmin) {
      return {
        canTake: true,
        status: 'admin_unlocked',
        message: '🔓 Admin Exception Granted: Late attendance window has been unlocked by administration.',
        badgeClass: 'badge-active'
      };
    }

    if (!isTodayScheduled) {
      return {
        canTake: false,
        status: 'not_scheduled_today',
        message: `📅 No Class Scheduled Today: ${cls.name} is scheduled on (${days.join(', ')}). Today is ${todayKey}.`,
        badgeClass: 'badge-default'
      };
    }

    if (isBefore) {
      const diff = startMin - currentMinutes;
      return {
        canTake: false,
        status: 'locked_before',
        message: `🔒 Attendance Locked: Class starts in ${diff} minutes at ${formatTime(cls.start_time)}. Attendance opens only during assigned class time.`,
        badgeClass: 'badge-leave'
      };
    }

    if (isAfter) {
      return {
        canTake: false,
        status: 'locked_after',
        message: `⛔ Attendance Window Closed: Class session ended at ${formatTime(cls.end_time)}. Attendance cannot be taken after class time unless unlocked by Administrator.`,
        badgeClass: 'badge-default',
        isAfter: true
      };
    }

    return {
      canTake: true,
      status: 'live_open',
      message: `🟢 LIVE Class Attendance Window Active: Live until ${formatTime(cls.end_time)}. Submitting confirms your teacher duty attendance.`,
      badgeClass: 'badge-active'
    };
  }

  // Default to ABSENT when opening attendance module as requested by user
  let attendanceState = {};
  students.forEach(s => {
    if (s.status === 'On Approved Leave' || s.status === 'Temporary Break') {
      attendanceState[s.id] = 'Leave';
    } else {
      attendanceState[s.id] = 'Absent';
    }
  });

  // Extract unique classes for filtering
  const uniqueClasses = Array.from(new Set(students.map(s => s.school_class || 'STD-I'))).sort();

  async function renderFullUI() {
    const windowState = await checkWindowStatus(activeClassroomId);
    const activeCls = classrooms.find(c => c.id === activeClassroomId);
    const assignedTeacher = users.find(u => u.id === activeCls?.teacher_id);
    const teacherDisplayName = assignedTeacher ? (assignedTeacher.full_name || assignedTeacher.email) : (isTeacher ? (user?.full_name || 'Assigned Faculty') : 'No teacher assigned');

    const canInteract = canSubmitAction && !isViewOnly && windowState.canTake;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h2>${isTeacher ? 'My Classroom Attendance Duty' : 'Student & Teacher Attendance Management'}</h2>
          <p>${isTeacher ? 'Take and submit live attendance for your assigned classrooms during class hours' : 'Independent daily attendance governance for Moral Class, Hostel Coaching, and School Coaching'}</p>
        </div>
        <div class="page-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-outline" id="btn-view-att-reports">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Attendance Reports
          </button>
        </div>
      </div>

      <!-- Time Window Status Banner -->
      <div style="background: ${windowState.canTake ? '#ECFDF5' : (windowState.status === 'locked_before' ? '#FFFBEB' : '#FEF2F2')}; border: 1.5px solid ${windowState.canTake ? '#A7F3D0' : (windowState.status === 'locked_before' ? '#FDE68A' : '#FECACA')}; border-radius: 12px; padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <span style="font-size: 20px;">${windowState.canTake ? '⏱️' : (windowState.status === 'locked_before' ? '⏳' : '🔒')}</span>
          <div>
            <strong style="color: ${windowState.canTake ? '#065F46' : (windowState.status === 'locked_before' ? '#92400E' : '#991B1B')}; font-size: 0.88rem;">
              ${windowState.message}
            </strong>
            <div style="font-size: 0.78rem; color: ${windowState.canTake ? '#047857' : (windowState.status === 'locked_before' ? '#B45309' : '#B91C1C')}; margin-top: 0.15rem;">
              Class: <strong>${activeCls?.name || 'Classroom'}</strong> • Schedule: <strong>${formatTime(activeCls?.start_time || '06:30')} – ${formatTime(activeCls?.end_time || '07:30')}</strong> • Assigned Faculty: <strong>${teacherDisplayName}</strong>
            </div>
          </div>
        </div>

        ${(isAdmin && windowState.isAfter && !windowState.isUnlockedByAdmin) ? `
          <button class="btn btn-outline btn-sm" id="btn-admin-unlock-window" style="background: #FFFFFF; font-weight: 700; color: #DC2626; border-color: #FECACA;">
            🔓 Unlock Late Attendance for Teachers
          </button>
        ` : (isAdmin && windowState.isUnlockedByAdmin) ? `
          <span class="badge badge-active" style="padding: 0.35rem 0.65rem;">
            ✓ Late Attendance Unlocked by Admin
          </span>
        ` : ''}
      </div>

      <!-- Attendance Modules / Sections Tabs -->
      <div style="display: flex; gap: 0.75rem; overflow-x: auto; margin-bottom: 1.5rem;" id="att-prog-tabs">
        ${programs.map(p => `
          <button class="btn ${p.id === activeProgramId ? 'btn-primary' : 'btn-outline'}" data-pid="${p.id}" style="border-radius: var(--radius-full);">
            ${p.name}
          </button>
        `).join('')}
      </div>

      <!-- Active Session Banner & Controls -->
      <div class="card-panel" style="margin-bottom: 1.5rem;">
        <div class="card-panel-body" style="padding: 1.25rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
              <label class="form-label" style="font-weight: 700; margin: 0;">Classroom Session:</label>
              <select id="att-cls-select" class="form-control" style="width: 250px;">
                ${(classrooms.filter(c => c.program_id === activeProgramId).length > 0 
                  ? classrooms.filter(c => c.program_id === activeProgramId) 
                  : classrooms).map(c => `<option value="${c.id}" ${c.id === activeClassroomId ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">Date: <strong>${sessionDate}</strong></span>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" id="btn-mark-all-absent" ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : 'style="color: #DC2626; border-color: #FECACA;"'} title="Mark all students Absent">
                Mark All Absent
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-mark-all-present" ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''} title="Mark all eligible students Present">
                Mark All Present
              </button>
              <button class="btn btn-outline btn-sm" id="btn-reset-attendance" ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''} title="Reset all to initial Absent status">
                Reset to Absent
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Attendance Summary Counters -->
      <div style="display: flex; gap: 0.85rem; flex-wrap: wrap; margin-bottom: 1.5rem;" id="att-counters">
        <!-- Populated via updateCounters() -->
      </div>

      <!-- Roster Header with Search & Quick Filters -->
      <div class="card-panel" style="margin-bottom: 1.5rem;">
        <div class="card-panel-header" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Classroom Attendance Roster</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Assigned Faculty: <strong>${teacherDisplayName}</strong> • Tap <strong>P</strong> (Present), <strong>A</strong> (Absent), or <strong>L</strong> (Leave)</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div style="position: relative; width: 240px;">
              <svg style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="att-search-input" class="form-control" placeholder="Search student or ID..." style="padding-left: 2rem; height: 36px; font-size: 0.82rem;" />
            </div>

            <select id="att-class-filter" class="form-control" style="width: 140px; height: 36px; font-size: 0.82rem;">
              <option value="all">All Classes</option>
              ${uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>

            <select id="att-gender-filter" class="form-control" style="width: 120px; height: 36px; font-size: 0.82rem;">
              <option value="all">All Genders</option>
              <option value="Boy">Boys</option>
              <option value="Girl">Girls</option>
            </select>
          </div>
        </div>

        <!-- Students Card Grid -->
        <div class="card-panel-body" style="padding: 1.5rem;">
          <div class="attendance-grid" id="att-cards-container">
            <!-- Rendered via renderCards() -->
          </div>
          <div id="att-no-matches" style="display: none; padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.95rem;">
            No students match your filter criteria.
          </div>
        </div>

        <!-- Submit Footer -->
        <div class="card-panel-body" style="background: var(--bg-surface-subtle); border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div style="font-size: 0.82rem; color: var(--text-secondary); max-width: 600px;">
            ${canInteract
              ? `* Submitting officially records student presence for this session, saves the exact recorded timestamp, and confirms your faculty duty attendance (${teacherDisplayName}).`
              : (isViewOnly 
                  ? '* View-only mode: Exploration access only.'
                  : (windowState.status === 'locked_before'
                      ? `* Attendance locked: Window opens at ${formatTime(activeCls?.start_time)}.`
                      : '* Attendance window closed: Only administrators can unlock or record attendance after class time.'))}
          </div>
          ${canInteract ? `
            <button class="btn btn-primary" id="btn-submit-attendance" style="padding: 0.75rem 1.5rem; font-weight: 700; background: #059669; border-color: #047857;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Confirm & Submit Attendance
            </button>
          ` : `
            <button class="btn btn-outline" disabled style="padding: 0.75rem 1.5rem; font-weight: 700; opacity: 0.6; cursor: not-allowed;">
              ${windowState.status === 'locked_before' ? 'Locked (Before Class Time)' : (windowState.status === 'locked_after' ? 'Window Expired (Session Closed)' : 'Locked')}
            </button>
          `}
        </div>
      </div>
    `;

    // Admin unlock listener
    container.querySelector('#btn-admin-unlock-window')?.addEventListener('click', async () => {
      await db.unlockAttendanceWindow(activeClassroomId, sessionDate);
      toast.success(`Unlocked late attendance window for ${activeCls?.name}. Faculty can now submit attendance.`);
      renderFullUI();
    });

    renderCards(canInteract);
    updateCounters();
    attachEventListeners(canInteract);
  }

  function getEligibleStudents() {
    const targetCls = classrooms.find(c => c.id === activeClassroomId);
    if (targetCls && Array.isArray(targetCls.student_ids) && targetCls.student_ids.length > 0) {
      const assignedSet = new Set(targetCls.student_ids);
      const filtered = students.filter(s => assignedSet.has(s.id));
      if (filtered.length > 0) return filtered;
    }
    return students;
  }

  function updateCounters() {
    const activeList = getEligibleStudents();
    const counts = { Present: 0, Absent: 0, Leave: 0 };
    activeList.forEach(s => {
      const st = attendanceState[s.id] || 'Absent';
      if (st === 'Leave' || st === 'Approved Leave' || st === 'Late' || st === 'Excused') {
        counts.Leave = (counts.Leave || 0) + 1;
      } else if (st === 'Present') {
        counts.Present = (counts.Present || 0) + 1;
      } else {
        counts.Absent = (counts.Absent || 0) + 1;
      }
    });

    const total = activeList.length;
    const countersContainer = container.querySelector('#att-counters');
    if (!countersContainer) return;

    countersContainer.innerHTML = `
      <div style="background: #FEF2F2; border: 1.5px solid #FECACA; padding: 0.6rem 1.15rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 800; color: #DC2626; display: flex; align-items: center; gap: 0.5rem; box-shadow: var(--shadow-xs);">
        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #DC2626;"></span>
        Absent: ${counts.Absent || 0}
      </div>
      <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; padding: 0.6rem 1.15rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 800; color: #047857; display: flex; align-items: center; gap: 0.5rem; box-shadow: var(--shadow-xs);">
        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #10B981;"></span>
        Present: ${counts.Present || 0}
      </div>
      <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; padding: 0.6rem 1.15rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 800; color: #D97706; display: flex; align-items: center; gap: 0.5rem; box-shadow: var(--shadow-xs);">
        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #F59E0B;"></span>
        Leave: ${counts.Leave || 0}
      </div>
      <div style="background: var(--bg-surface); border: 1.5px solid var(--border-subtle); padding: 0.6rem 1.15rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 700; color: var(--text-secondary); margin-left: auto;">
        Total Students: <strong>${total}</strong>
      </div>
    `;
  }

  function formatMeta(student) {
    const rawAdm = student.admission_number || 'TPS';
    const admNo = rawAdm.replace(/-/g, '');
    let cls = student.school_class || 'STD-I';
    if (!cls.toLowerCase().startsWith('class')) {
      cls = `Class ${cls}`;
    }
    const isGirl = student.gender === 'Female' || student.gender === 'Girls' || student.gender === 'Girl';
    const gen = isGirl ? 'Girl' : 'Boy';
    return `${admNo} • ${cls} (${gen})`;
  }

  function renderCards(canInteract = true) {
    const cardsContainer = container.querySelector('#att-cards-container');
    if (!cardsContainer) return;

    const activeList = getEligibleStudents();
    cardsContainer.innerHTML = activeList.map(s => {
      const currentStatus = attendanceState[s.id] || 'Absent';
      const isGirl = s.gender === 'Female' || s.gender === 'Girls' || s.gender === 'Girl';
      const genderLabel = isGirl ? 'Girl' : 'Boy';
      const initials = (s.full_name || 'Student')
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase();

      const metaText = formatMeta(s);

      return `
        <div class="attendance-card" 
             id="att-card-${s.id}" 
             data-student-id="${s.id}"
             data-student-name="${(s.full_name || '').toLowerCase()}"
             data-student-adm="${(s.admission_number || '').replace(/-/g, '').toLowerCase()}"
             data-student-class="${s.school_class || ''}"
             data-student-gender="${genderLabel}">
          
          <div class="attendance-card-header">
            <div class="attendance-avatar">
              ${s.photo_url ? `
                <img src="${s.photo_url}" alt="${s.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <div class="attendance-avatar-fallback ${isGirl ? 'girl' : 'boy'}" style="display: none;">${initials}</div>
              ` : `
                <div class="attendance-avatar-fallback ${isGirl ? 'girl' : 'boy'}">${initials}</div>
              `}
            </div>
            <div class="attendance-student-info">
              <h4 class="attendance-student-name" title="${s.full_name}">${s.full_name}</h4>
              <div class="attendance-student-meta" title="${metaText}">${metaText}</div>
            </div>
          </div>

          <div class="attendance-btn-row" data-student-id="${s.id}">
            <button type="button" 
                    class="att-status-btn att-btn-p ${currentStatus === 'Present' ? 'active' : ''}" 
                    data-status="Present" 
                    ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                    title="Mark Present (P)">
              P
            </button>
            <button type="button" 
                    class="att-status-btn att-btn-a ${currentStatus === 'Absent' ? 'active' : ''}" 
                    data-status="Absent" 
                    ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                    title="Mark Absent (A)">
              A
            </button>
            <button type="button" 
                    class="att-status-btn att-btn-l ${currentStatus === 'Leave' || currentStatus === 'Approved Leave' ? 'active' : ''}" 
                    data-status="Leave" 
                    ${!canInteract ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                    title="Mark Leave (L)">
              L
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (canInteract) {
      cardsContainer.querySelectorAll('.att-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = btn.closest('.attendance-btn-row');
          if (!row) return;
          const sid = row.getAttribute('data-student-id');
          const st = btn.getAttribute('data-status');
          setStudentStatus(sid, st);
        });
      });
    }
  }

  function setStudentStatus(sid, status) {
    attendanceState[sid] = status;
    const card = container.querySelector(`#att-card-${sid}`);
    if (card) {
      card.querySelectorAll('.att-status-btn').forEach(btn => {
        const btnSt = btn.getAttribute('data-status');
        btn.classList.toggle('active', btnSt === status);
      });
    }
    updateCounters();
  }

  function updateAllCardsVisualState() {
    container.querySelectorAll('.attendance-card').forEach(card => {
      const sid = card.getAttribute('data-student-id');
      const st = attendanceState[sid] || 'Absent';
      card.querySelectorAll('.att-status-btn').forEach(btn => {
        const btnSt = btn.getAttribute('data-status');
        btn.classList.toggle('active', btnSt === st);
      });
    });
  }

  function applyFilters() {
    const q = (container.querySelector('#att-search-input')?.value || '').toLowerCase().trim();
    const cls = container.querySelector('#att-class-filter')?.value || 'all';
    const gen = container.querySelector('#att-gender-filter')?.value || 'all';

    let matchCount = 0;
    container.querySelectorAll('.attendance-card').forEach(card => {
      const name = card.getAttribute('data-student-name') || '';
      const adm = card.getAttribute('data-student-adm') || '';
      const studentClass = card.getAttribute('data-student-class') || '';
      const studentGender = card.getAttribute('data-student-gender') || '';

      const matchQ = !q || name.includes(q) || adm.includes(q);
      const matchCls = cls === 'all' || studentClass === cls;
      const matchGen = gen === 'all' || studentGender === gen;

      if (matchQ && matchCls && matchGen) {
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

  function attachEventListeners(canInteract) {
    // Filter Event Listeners
    container.querySelector('#att-search-input')?.addEventListener('input', applyFilters);
    container.querySelector('#att-class-filter')?.addEventListener('change', applyFilters);
    container.querySelector('#att-gender-filter')?.addEventListener('change', applyFilters);

    if (canInteract) {
      // Mark all present
      container.querySelector('#btn-mark-all-present')?.addEventListener('click', () => {
        students.forEach(s => {
          if (s.status !== 'On Approved Leave' && s.status !== 'Temporary Break') {
            attendanceState[s.id] = 'Present';
          }
        });
        updateAllCardsVisualState();
        updateCounters();
        toast.info('Marked all eligible students Present.');
      });

      // Mark all absent
      container.querySelector('#btn-mark-all-absent')?.addEventListener('click', () => {
        students.forEach(s => {
          attendanceState[s.id] = 'Absent';
        });
        updateAllCardsVisualState();
        updateCounters();
        toast.info('Marked all students Absent.');
      });

      // Reset roster to Absent
      container.querySelector('#btn-reset-attendance')?.addEventListener('click', () => {
        students.forEach(s => {
          attendanceState[s.id] = 'Absent';
        });
        updateAllCardsVisualState();
        updateCounters();
        toast.info('Reset roster: all students marked Absent.');
      });

      // Submit attendance
      container.querySelector('#btn-submit-attendance')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Confirm Live Attendance Submission',
          message: 'Are you sure you want to submit attendance for this class? This will record student attendance, store the exact submission timestamp, and log your faculty duty attendance.',
          confirmText: 'Submit Attendance'
        });

        if (confirmed) {
          const records = Object.entries(attendanceState).map(([sid, status]) => {
            const finalStatus = status === 'Leave' ? 'Approved Leave' : status;
            return { student_id: sid, status: finalStatus };
          });

          const activeCls = classrooms.find(c => c.id === activeClassroomId);
          const recordedAtIso = new Date().toISOString();

          await db.saveAttendanceSession({
            program_id: activeProgramId,
            classroom_id: activeClassroomId,
            session_date: sessionDate,
            teacher_id: activeCls?.teacher_id || user?.id || 'u-2',
            teacher_name: user?.full_name || 'Faculty',
            recorded_at: recordedAtIso,
            records
          });

          toast.success(`Attendance submitted! Exact time (${formatTime(new Date().toTimeString().slice(0, 5))}) stored and faculty duty marked Present.`);
          onNavigate('reports');
        }
      });
    }

    container.querySelector('#btn-view-att-reports')?.addEventListener('click', () => onNavigate('reports'));

    // Program tabs click
    container.querySelectorAll('#att-prog-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        activeProgramId = btn.getAttribute('data-pid');
        const progCls = classrooms.filter(c => c.program_id === activeProgramId);
        const list = progCls.length > 0 ? progCls : classrooms;
        activeClassroomId = list[0]?.id || classrooms[0]?.id || '';
        renderFullUI();
      });
    });

    // Classroom dropdown change
    container.querySelector('#att-cls-select')?.addEventListener('change', (e) => {
      activeClassroomId = e.target.value;
      renderFullUI();
    });
  }

  await renderFullUI();
}
