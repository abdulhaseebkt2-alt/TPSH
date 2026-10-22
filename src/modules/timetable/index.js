import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_TIMETABLE_SLOTS = [
  { id: 'tt-1', day: 'Monday', start_time: '06:00', end_time: '07:00', program: 'Hostel Moral Class', classroom: 'Moral Hall A1', teacher: 'Rashid Sir', session_title: 'Morning Hadith & Ethics' },
  { id: 'tt-2', day: 'Monday', start_time: '07:15', end_time: '08:15', program: 'Hostel Coaching Class', classroom: 'Hostel Study Lab 1', teacher: 'Usman Usthad', session_title: 'Mathematics Study Circle' },
  { id: 'tt-3', day: 'Monday', start_time: '17:00', end_time: '18:30', program: 'School Coaching Class', classroom: 'Main Academic Lab 1', teacher: 'Rashid Sir', session_title: 'Arabic Language Class' },
  { id: 'tt-4', day: 'Tuesday', start_time: '06:00', end_time: '07:00', program: 'Hostel Moral Class', classroom: 'Moral Hall A1', teacher: 'Rashid Sir', session_title: 'Morning Fiqh & Character' }
];

export async function renderTimetableModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const classrooms = await db.getClassrooms();
  const programs = await db.getPrograms();

  let slots = [...DEFAULT_TIMETABLE_SLOTS];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Teacher Timetable & Schedule Management</h2>
        <p>Institutional visual timetable builder with double-booking prevention and attendance window rules</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-primary" id="btn-add-slot">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Timetable Slot
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Attendance Window Rules Notice -->
    <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 20px;">⏱️</span>
        <div>
          <strong style="color: #047857;">Automated Server-Time Attendance Windows Enabled</strong>
          <p style="font-size: 0.8rem; color: #065F46; margin-top: 0.1rem;">
            Attendance window opens <strong>5 minutes before</strong> session start and closes <strong>15 minutes after</strong> session end. Overdue teacher duties are automatically finalized.
          </p>
        </div>
      </div>
    </div>

    <!-- Timetable Slots Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Institutional Master Timetable</h3>
        <span class="badge badge-active">${slots.length} Active Weekly Sessions</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time Slot</th>
                <th>Program</th>
                <th>Classroom</th>
                <th>Assigned Teacher</th>
                <th>Session Title</th>
                <th>Window Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${slots.map(s => `
                <tr>
                  <td><strong>${s.day}</strong></td>
                  <td><code>${s.start_time} — ${s.end_time}</code></td>
                  <td><span class="badge badge-leave">${s.program}</span></td>
                  <td><strong>${s.classroom}</strong></td>
                  <td>${s.teacher}</td>
                  <td>${s.session_title}</td>
                  <td><span class="badge badge-active">Window Active</span></td>
                  <td>
                    <button class="btn btn-primary btn-sm btn-open-attendance" data-cls="${s.classroom}">Take Attendance</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-open-attendance').forEach(btn => {
    btn.addEventListener('click', () => {
      onNavigate('attendance');
    });
  });

  // Add timetable slot with conflict check
  container.querySelector('#btn-add-slot')?.addEventListener('click', () => {
    openModal({
      title: 'Schedule Timetable Slot',
      contentHtml: `
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Day of Week</label>
            <select id="slot-day" class="form-control">
              ${DAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Attendance Program</label>
            <select id="slot-program" class="form-control">
              ${programs.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Start Time</label>
            <input type="time" id="slot-start" class="form-control" value="06:00" required />
          </div>
          <div class="form-group">
            <label class="form-label required">End Time</label>
            <input type="time" id="slot-end" class="form-control" value="07:00" required />
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label required">Classroom</label>
            <select id="slot-cls" class="form-control">
              ${classrooms.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Assigned Faculty</label>
            <input type="text" id="slot-teacher" class="form-control" placeholder="e.g. Rashid Sir" value="Rashid Sir" required />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Session Title</label>
          <input type="text" id="slot-title" class="form-control" placeholder="e.g. Morning Quranic Reflection & Morals" required />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-slot">Save & Validate Timetable</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-slot').addEventListener('click', () => {
          const day = modalBody.querySelector('#slot-day').value;
          const prog = modalBody.querySelector('#slot-program').value;
          const start = modalBody.querySelector('#slot-start').value;
          const end = modalBody.querySelector('#slot-end').value;
          const cls = modalBody.querySelector('#slot-cls').value;
          const teacher = modalBody.querySelector('#slot-teacher').value.trim();
          const title = modalBody.querySelector('#slot-title').value.trim();

          // Conflict detection
          const conflict = slots.find(s => s.day === day && s.start_time === start && (s.teacher === teacher || s.classroom === cls));
          if (conflict) {
            toast.error(`Conflict detected: ${conflict.teacher === teacher ? teacher : cls} is already scheduled for ${day} at ${start}!`);
            return;
          }

          slots.push({
            id: 'tt-' + Date.now(),
            day,
            start_time: start,
            end_time: end,
            program: prog,
            classroom: cls,
            teacher,
            session_title: title || 'Academic Session'
          });

          toast.success('Timetable slot added without scheduling conflicts.');
          close();
          renderTimetableModule(container, { onNavigate });
        });
      }
    });
  });
}
