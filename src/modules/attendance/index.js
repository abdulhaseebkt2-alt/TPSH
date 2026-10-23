import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderAttendanceModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const programs = await db.getPrograms();
  const classrooms = await db.getClassrooms();
  const students = await db.getStudents();

  let activeProgramId = programs[0]?.id || 'prog-1';
  const initialProgCls = classrooms.filter(c => c.program_id === activeProgramId);
  let activeClassroomId = initialProgCls[0]?.id || classrooms[0]?.id || 'cls-1';

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

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Student & Teacher Attendance Management</h2>
        <p>Independent daily attendance for Moral Class, Hostel Coaching, and School Coaching</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" id="btn-view-att-reports">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          Monthly Reports
        </button>
      </div>
    </div>

    <!-- Attendance Modules Tabs -->
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
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Date: <strong>${new Date().toISOString().split('T')[0]}</strong></span>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" id="btn-mark-all-absent" style="color: #DC2626; border-color: #FECACA;" title="Mark all students Absent">
              Mark All Absent
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-mark-all-present" title="Mark all eligible students Present">
              Mark All Present
            </button>
            <button class="btn btn-outline btn-sm" id="btn-reset-attendance" title="Reset all to initial Absent status">
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
          <span style="font-size: 0.8rem; color: var(--text-muted);">Assigned Faculty: <strong>Rashid Sir</strong> • Tap <strong>P</strong> (Present), <strong>A</strong> (Absent), or <strong>L</strong> (Leave)</span>
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
          * Submitting will officially register student attendance for this session and record your teacher attendance duty.
        </div>
        <button class="btn btn-primary" id="btn-submit-attendance" style="padding: 0.75rem 1.5rem; font-weight: 700;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Confirm & Submit Attendance
        </button>
      </div>
    </div>
  `;

  function updateCounters() {
    const counts = { Present: 0, Absent: 0, Leave: 0 };
    Object.values(attendanceState).forEach(st => {
      if (st === 'Leave' || st === 'Approved Leave' || st === 'Late' || st === 'Excused') {
        counts.Leave = (counts.Leave || 0) + 1;
      } else if (st === 'Present') {
        counts.Present = (counts.Present || 0) + 1;
      } else {
        counts.Absent = (counts.Absent || 0) + 1;
      }
    });

    const total = students.length;
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

  function renderCards() {
    const cardsContainer = container.querySelector('#att-cards-container');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = students.map(s => {
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
                    title="Mark Present (P)">
              P
            </button>
            <button type="button" 
                    class="att-status-btn att-btn-a ${currentStatus === 'Absent' ? 'active' : ''}" 
                    data-status="Absent" 
                    title="Mark Absent (A)">
              A
            </button>
            <button type="button" 
                    class="att-status-btn att-btn-l ${currentStatus === 'Leave' || currentStatus === 'Approved Leave' ? 'active' : ''}" 
                    data-status="Leave" 
                    title="Mark Leave (L)">
              L
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events on action buttons for instant reaction
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

  // Filter Event Listeners
  container.querySelector('#att-search-input')?.addEventListener('input', applyFilters);
  container.querySelector('#att-class-filter')?.addEventListener('change', applyFilters);
  container.querySelector('#att-gender-filter')?.addEventListener('change', applyFilters);

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
      title: 'Confirm Attendance Submission',
      message: 'Are you sure you want to submit this attendance session? It will record student presence and finalize your teacher attendance duty.',
      confirmText: 'Submit Attendance'
    });

    if (confirmed) {
      const records = Object.entries(attendanceState).map(([sid, status]) => {
        const finalStatus = status === 'Leave' ? 'Approved Leave' : status;
        return { student_id: sid, status: finalStatus };
      });

      await db.saveAttendanceSession({
        program_id: activeProgramId,
        classroom_id: activeClassroomId,
        session_date: new Date().toISOString().split('T')[0],
        teacher_id: user?.id || 'd0000000-0000-0000-0000-000000000004',
        records
      });

      toast.success('Attendance submitted successfully! Teacher duty marked Present.');
      onNavigate('reports');
    }
  });

  container.querySelector('#btn-view-att-reports')?.addEventListener('click', () => onNavigate('reports'));

  // Program tabs click
  container.querySelectorAll('#att-prog-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeProgramId = btn.getAttribute('data-pid');
      container.querySelectorAll('#att-prog-tabs button').forEach(b => {
        b.className = b.getAttribute('data-pid') === activeProgramId ? 'btn btn-primary' : 'btn btn-outline';
      });

      // Update Classroom dropdown for the newly selected Section/Program
      const clsSelect = container.querySelector('#att-cls-select');
      if (clsSelect) {
        const progCls = classrooms.filter(c => c.program_id === activeProgramId);
        const list = progCls.length > 0 ? progCls : classrooms;
        clsSelect.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        activeClassroomId = list[0]?.id || '';
      }

      toast.info(`Switched to ${btn.textContent.trim()}`);
    });
  });

  renderCards();
  updateCounters();
}
