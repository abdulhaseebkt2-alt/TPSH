import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { formatTime } from '../../lib/utils.js';

const DAYS_MAP = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday'
};

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function renderTimetableModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const classrooms = await db.getClassrooms();
  const programs = await db.getPrograms();
  const users = await db.getUsers();

  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin';

  // Build dynamic slots from classrooms
  let allSlots = [];
  classrooms.forEach(c => {
    const prog = programs.find(p => p.id === c.program_id);
    const teacher = users.find(u => u.id === c.teacher_id);
    const teacherName = teacher ? (teacher.full_name || teacher.email) : (c.teacher_id ? 'Assigned Faculty' : 'Unassigned');
    const days = Array.isArray(c.days) && c.days.length > 0 ? c.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    days.forEach(dayKey => {
      const dayFull = DAYS_MAP[dayKey] || dayKey;
      allSlots.push({
        id: `slot-${c.id}-${dayKey}`,
        classroom_id: c.id,
        day: dayFull,
        dayKey,
        start_time: c.start_time || '06:30',
        end_time: c.end_time || '07:30',
        program: prog?.name || 'Academic Program',
        program_id: c.program_id,
        classroom: c.name,
        room_number: c.room_number || '',
        teacher_id: c.teacher_id || '',
        teacher: teacherName,
        session_title: `${c.name} (${prog?.name || 'Class'})`
      });
    });
  });

  // Sort slots by day of week then start time
  allSlots.sort((a, b) => {
    const dDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dDiff !== 0) return dDiff;
    return parseMinutes(a.start_time) - parseMinutes(b.start_time);
  });

  // Role visibility: Teacher can ONLY see their assigned timetable
  let selectedFacultyFilter = 'all';
  let visibleSlots = [];

  if (isTeacher) {
    visibleSlots = allSlots.filter(s => 
      s.teacher_id === user.id || 
      (user.email && s.teacher_id === user.email) ||
      (user.full_name && s.teacher.toLowerCase().includes(user.full_name.toLowerCase()))
    );
  } else {
    visibleSlots = allSlots;
  }

  // Get current day & time to calculate live status
  const now = new Date();
  const currentDayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function getSlotLiveStatus(s) {
    if (s.dayKey !== currentDayKey) {
      return { label: 'Scheduled', badgeClass: 'badge-default', canAttend: false };
    }
    const sMin = parseMinutes(s.start_time);
    const eMin = parseMinutes(s.end_time);

    if (currentMinutes >= (sMin - 20) && currentMinutes < sMin) {
      const diff = sMin - currentMinutes;
      return { label: `Starts in ${diff}m`, badgeClass: 'badge-leave', canAttend: false, isSoon: true };
    }
    if (currentMinutes >= sMin && currentMinutes <= eMin) {
      return { label: '🟢 Live (In Session)', badgeClass: 'badge-active', canAttend: true, isLive: true };
    }
    if (currentMinutes > eMin) {
      return { label: 'Session Closed', badgeClass: 'badge-default', canAttend: false, isClosed: true };
    }
    return { label: 'Today', badgeClass: 'badge-default', canAttend: false };
  }

  function renderUI() {
    let displaySlots = visibleSlots;
    if (isAdmin && selectedFacultyFilter !== 'all') {
      displaySlots = displaySlots.filter(s => s.teacher_id === selectedFacultyFilter);
    }

    const eligibleTeachers = users.filter(u => u.approval_status === 'approved' && (u.role === 'teacher' || u.role === 'mentor' || u.role === 'hostel_leader'));

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h2>${isTeacher ? 'My Teaching Timetable' : 'Faculty Timetable & Schedule Governance'}</h2>
          <p>${isTeacher ? `Personal weekly teaching schedule and class timetable for ${user?.full_name || 'Faculty'}` : 'Institutional visual timetable builder with double-booking prevention and attendance window rules'}</p>
        </div>
        <div class="page-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${isAdmin ? `
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">Faculty:</span>
              <select id="timetable-faculty-filter" class="form-control" style="width: 200px; height: 36px; font-size: 0.82rem;">
                <option value="all">All Faculty (${allSlots.length} sessions)</option>
                ${eligibleTeachers.map(t => `<option value="${t.id}" ${selectedFacultyFilter === t.id ? 'selected' : ''}>${t.full_name || t.email}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-add-slot">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Timetable Slot
            </button>
          ` : ''}
        </div>
      </div>

      ${isTeacher ? `
        <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <span style="font-size: 20px;">🔒</span>
            <div>
              <strong style="color: #1E40AF; font-size: 0.88rem;">Personal Faculty Timetable Active</strong>
              <p style="font-size: 0.78rem; color: #2563EB; margin: 0.1rem 0 0;">
                Showing only your assigned classrooms (${displaySlots.length} weekly sessions). Live attendance is locked to your assigned class times.
              </p>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-quick-att-shortcut" style="background: #FFFFFF; font-weight: 700; color: #1E40AF; border-color: #93C5FD;">
            Open Live Attendance →
          </button>
        </div>
      ` : `
        <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: var(--radius-lg); padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 20px;">⏱️</span>
            <div>
              <strong style="color: #047857;">Class-Time Locked Attendance Windows Enabled</strong>
              <p style="font-size: 0.8rem; color: #065F46; margin-top: 0.1rem;">
                Teachers receive notifications 20 minutes before class and can only submit attendance during class hours. Admins can unlock overdue sessions if needed.
              </p>
            </div>
          </div>
        </div>
      `}

      <!-- Timetable Slots Table -->
      <div class="card-panel">
        <div class="card-panel-header" style="flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="margin: 0;">${isTeacher ? `Assigned Schedule (${displaySlots.length} Sessions)` : 'Master Institutional Timetable'}</h3>
            <span style="font-size: 0.78rem; color: var(--text-muted);">Current server day: <strong>${DAYS_MAP[currentDayKey]}</strong></span>
          </div>
          <span class="badge ${displaySlots.length > 0 ? 'badge-active' : 'badge-default'}">
            ${displaySlots.length} Active Weekly Sessions
          </span>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          ${displaySlots.length === 0 ? `
            <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 0.5rem;">📅</div>
              <h4 style="color: #1E293B; margin-bottom: 0.25rem;">No Timetable Sessions Found</h4>
              <p style="font-size: 0.85rem; max-width: 480px; margin: 0 auto;">
                ${isTeacher ? 'You currently have no classrooms assigned to your faculty account. Please request an administrator to assign classrooms to you in the Sections & Classrooms module.' : 'No classrooms match the selected filter.'}
              </p>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time Slot</th>
                    <th>Program / Section</th>
                    <th>Classroom</th>
                    <th>Assigned Faculty</th>
                    <th>Live Window Status</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${displaySlots.map(s => {
                    const status = getSlotLiveStatus(s);
                    const isMyClass = !isTeacher || s.teacher_id === user.id;

                    return `
                      <tr>
                        <td><strong>${s.day}</strong></td>
                        <td><code>${formatTime(s.start_time)} — ${formatTime(s.end_time)}</code></td>
                        <td><span class="badge badge-leave">${s.program}</span></td>
                        <td>
                          <strong>${s.classroom}</strong>
                          ${s.room_number ? `<span style="font-size: 0.72rem; color: #64748B; margin-left: 4px;">(Room ${s.room_number})</span>` : ''}
                        </td>
                        <td>${s.teacher}</td>
                        <td>
                          <span class="badge ${status.badgeClass}">
                            ${status.label}
                          </span>
                        </td>
                        <td style="text-align: right;">
                          <button class="btn ${status.canAttend || isAdmin ? 'btn-primary' : 'btn-outline'} btn-sm btn-open-attendance" 
                                  data-cls-id="${s.classroom_id}"
                                  ${(!status.canAttend && !isAdmin) ? 'title="Attendance window opens during class time"' : ''}>
                            Take Attendance
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    // Attach listeners
    container.querySelectorAll('.btn-open-attendance').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        if (clsId) {
          sessionStorage.setItem('tps_active_att_cls', clsId);
        }
        onNavigate('attendance');
      });
    });

    container.querySelector('#btn-quick-att-shortcut')?.addEventListener('click', () => onNavigate('attendance'));

    container.querySelector('#timetable-faculty-filter')?.addEventListener('change', (e) => {
      selectedFacultyFilter = e.target.value;
      renderUI();
    });

    // Add timetable slot (Admins only)
    container.querySelector('#btn-add-slot')?.addEventListener('click', () => {
      openModal({
        title: 'Schedule Timetable Slot',
        contentHtml: `
          <div class="form-grid" style="margin-bottom: 1rem;">
            <div class="form-group">
              <label class="form-label required">Day of Week</label>
              <select id="slot-day" class="form-control">
                ${DAY_ORDER.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Section / Program</label>
              <select id="slot-program" class="form-control">
                ${programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-grid" style="margin-bottom: 1rem;">
            <div class="form-group">
              <label class="form-label required">Start Time</label>
              <input type="time" id="slot-start" class="form-control" value="06:30" required />
            </div>
            <div class="form-group">
              <label class="form-label required">End Time</label>
              <input type="time" id="slot-end" class="form-control" value="07:30" required />
            </div>
          </div>
          <div class="form-grid" style="margin-bottom: 1.5rem;">
            <div class="form-group">
              <label class="form-label required">Classroom</label>
              <select id="slot-cls" class="form-control">
                ${classrooms.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Assigned Faculty</label>
              <select id="slot-teacher" class="form-control">
                ${eligibleTeachers.map(t => `<option value="${t.id}">${t.full_name || t.email}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-primary" id="btn-save-slot">Save & Update Classroom Schedule</button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-save-slot').addEventListener('click', async () => {
            const clsId = modalBody.querySelector('#slot-cls').value;
            const teacherId = modalBody.querySelector('#slot-teacher').value;
            const start = modalBody.querySelector('#slot-start').value;
            const end = modalBody.querySelector('#slot-end').value;

            await db.updateClassroom(clsId, {
              teacher_id: teacherId,
              start_time: start,
              end_time: end
            });

            toast.success('Classroom timetable schedule updated.');
            close();
            renderTimetableModule(container, { onNavigate });
          });
        }
      });
    });
  }

  renderUI();
}
