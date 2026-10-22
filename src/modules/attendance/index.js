import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderAttendanceModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const programs = await db.getPrograms();
  const sections = await db.getSections();
  const classrooms = await db.getClassrooms();
  const students = await db.getStudents();

  let activeProgramId = programs[0]?.id || 'prog-1';
  let activeClassroomId = classrooms[0]?.id || 'cls-1';

  // Local state for attendance taking
  let attendanceState = {};
  students.forEach(s => {
    // If student is on approved leave or temporary break, default to that status
    if (s.status === 'On Approved Leave') {
      attendanceState[s.id] = 'Approved Leave';
    } else if (s.status === 'Temporary Break') {
      attendanceState[s.id] = 'Excused';
    } else {
      attendanceState[s.id] = 'Present';
    }
  });

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

    <!-- Active Session Banner & Classroom Selector -->
    <div class="card-panel" style="margin-bottom: 1.5rem;">
      <div class="card-panel-body" style="padding: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <label class="form-label" style="font-weight: 700;">Classroom Session:</label>
            <select id="att-cls-select" class="form-control" style="width: 260px;">
              ${classrooms.map(c => `<option value="${c.id}" ${c.id === activeClassroomId ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Date: <strong>${new Date().toISOString().split('T')[0]}</strong></span>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" id="btn-mark-all-present">Mark All Present</button>
            <button class="btn btn-outline btn-sm" id="btn-reset-attendance">Reset Roster</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Attendance Summary Counters -->
    <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;" id="att-counters">
      <!-- Populated via updateCounters() -->
    </div>

    <!-- Student Attendance Roster Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Classroom Attendance Roster</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Assigned Faculty: <strong>Rashid Sir</strong></span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No</th>
                <th>Grade</th>
                <th>Hostel Status</th>
                <th>Attendance Marking</th>
              </tr>
            </thead>
            <tbody id="att-roster-body">
              <!-- Populated via renderRoster() -->
            </tbody>
          </table>
        </div>
      </div>
      <div class="card-panel-body" style="background: var(--bg-surface-subtle); display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem;">
        <div style="font-size: 0.8rem; color: var(--text-secondary);">
          * Submitting will verify student presence and automatically record your teacher attendance duty.
        </div>
        <button class="btn btn-primary" id="btn-submit-attendance">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Confirm & Submit Attendance
        </button>
      </div>
    </div>
  `;

  function updateCounters() {
    const counts = { Present: 0, Absent: 0, Late: 0, Excused: 0, 'Approved Leave': 0 };
    Object.values(attendanceState).forEach(st => {
      counts[st] = (counts[st] || 0) + 1;
    });

    const countersContainer = container.querySelector('#att-counters');
    if (!countersContainer) return;

    countersContainer.innerHTML = `
      <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; color: #047857;">
        Present: ${counts.Present || 0}
      </div>
      <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; color: #DC2626;">
        Absent: ${counts.Absent || 0}
      </div>
      <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; color: #D97706;">
        Late: ${counts.Late || 0}
      </div>
      <div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; color: #2563EB;">
        Approved Leave: ${counts['Approved Leave'] || 0}
      </div>
    `;
  }

  function renderRoster() {
    const tbody = container.querySelector('#att-roster-body');
    if (!tbody) return;

    tbody.innerHTML = students.map(s => {
      const currentStatus = attendanceState[s.id] || 'Present';
      return `
        <tr>
          <td>
            <strong>${s.full_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${s.village || 'Kerala'}</div>
          </td>
          <td><code>${s.admission_number}</code></td>
          <td>${s.school_class}</td>
          <td><span class="badge ${s.status === 'Active' ? 'badge-active' : 'badge-leave'}">${s.status}</span></td>
          <td>
            <div style="display: flex; gap: 0.35rem;" class="status-btn-group" data-student-id="${s.id}">
              <button class="btn btn-sm ${currentStatus === 'Present' ? 'btn-primary' : 'btn-outline'}" data-status="Present">Present</button>
              <button class="btn btn-sm ${currentStatus === 'Absent' ? 'btn-danger' : 'btn-outline'}" data-status="Absent">Absent</button>
              <button class="btn btn-sm ${currentStatus === 'Late' ? 'btn-secondary' : 'btn-outline'}" data-status="Late">Late</button>
              <button class="btn btn-sm ${currentStatus === 'Approved Leave' ? 'btn-secondary' : 'btn-outline'}" data-status="Approved Leave">Leave</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach button group events
    tbody.querySelectorAll('.status-btn-group button').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.parentElement.getAttribute('data-student-id');
        const st = btn.getAttribute('data-status');
        attendanceState[sid] = st;
        renderRoster();
        updateCounters();
      });
    });
  }

  // Mark all present
  container.querySelector('#btn-mark-all-present')?.addEventListener('click', () => {
    students.forEach(s => {
      if (s.status !== 'On Approved Leave' && s.status !== 'Temporary Break') {
        attendanceState[s.id] = 'Present';
      }
    });
    renderRoster();
    updateCounters();
    toast.info('Marked all eligible students present.');
  });

  // Reset roster
  container.querySelector('#btn-reset-attendance')?.addEventListener('click', () => {
    students.forEach(s => {
      attendanceState[s.id] = 'Present';
    });
    renderRoster();
    updateCounters();
  });

  // Submit attendance
  container.querySelector('#btn-submit-attendance')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Confirm Attendance Submission',
      message: 'Are you sure you want to submit this attendance session? It will record student presence and finalize your teacher attendance duty.',
      confirmText: 'Submit Attendance'
    });

    if (confirmed) {
      const records = Object.entries(attendanceState).map(([sid, status]) => ({ student_id: sid, status }));
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
      toast.info(`Switched to ${btn.textContent.trim()}`);
    });
  });

  renderRoster();
  updateCounters();
}
