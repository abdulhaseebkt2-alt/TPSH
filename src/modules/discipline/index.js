import { db } from '../../lib/db.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { getMentorGenderScope, isMentorRole } from '../../lib/permissions.js';

export async function renderDisciplineModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const [students, incidents] = await Promise.all([
    db.getStudents(),
    db.getDisciplineIncidents()
  ]);

  const isMentor = isMentorRole(user?.role);
  const mentorGender = isMentor ? getMentorGenderScope(user) : null;

  // Scope students if mentor
  const scopedStudents = mentorGender
    ? students.filter(s => (s.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase())
    : students;

  const isParent = user?.role === 'parent';
  const displayIncidents = isParent
    ? incidents.filter(d => {
        const st = students.find(s => s.id === d.student_id);
        return st?.father_phone === '+91 98470 11223' || st?.full_name === 'Muhammad Rayyan';
      })
    : mentorGender
      ? incidents.filter(d => {
          const st = students.find(s => s.id === d.student_id);
          return st && (st.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase();
        })
      : incidents;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Student Discipline & Incident Register</h2>
        <p>Institutional record of hostel rule violations, black marks ledger, property damage fines, and resolution</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' || isMentor ? `
          <button class="btn btn-primary" id="btn-log-incident">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Record Disciplinary Incident
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Incident List Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Hostel Misconduct & Disciplinary Records</h3>
        <span class="badge badge-active">${displayIncidents.length} Recorded Incidents</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Incident Date</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Description</th>
                <th>Black Marks</th>
                <th>Property Fine</th>
                <th>Resolution Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayIncidents.map(d => {
                const st = students.find(s => s.id === d.student_id);
                const sevBadge = d.severity === 'Critical' ? 'badge-absent' : d.severity === 'Major' ? 'badge-late' : 'badge-leave';
                const resBadge = d.resolution_status === 'Resolved' ? 'badge-present' : 'badge-pending';

                return `
                  <tr>
                    <td>
                      <strong>${st?.full_name || 'Student'}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${st?.admission_number || ''} • ${st?.school_class || ''}</div>
                    </td>
                    <td>${formatDate(d.incident_date)}</td>
                    <td><strong>${d.category}</strong></td>
                    <td><span class="badge ${sevBadge}">${d.severity}</span></td>
                    <td style="max-width: 220px; font-size: 0.8rem; color: var(--text-secondary);">${d.description}</td>
                    <td><span class="badge badge-black-mark">+${d.black_marks_awarded} Mark(s)</span></td>
                    <td>${d.monetary_fine > 0 ? formatCurrency(d.monetary_fine) : 'None'}</td>
                    <td><span class="badge ${resBadge}">${d.resolution_status}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm btn-view-incident" data-id="${d.id}">Details</button>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No disciplinary incidents recorded</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Log Incident Modal
  container.querySelector('#btn-log-incident')?.addEventListener('click', () => {
    openModal({
      title: 'Record Disciplinary Incident',
      size: 'lg',
      contentHtml: `
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Student Involved</label>
            <select id="inc-student" class="form-control">
              ${scopedStudents.map(s => `<option value="${s.id}">${s.full_name} (${s.admission_number}) — ${s.school_class}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Violation Category</label>
            <select id="inc-category" class="form-control">
              <option value="Leaving hostel without permission">Leaving hostel without permission (Major, 3 Marks)</option>
              <option value="Returning late without permission">Returning late without permission (Moderate, 2 Marks)</option>
              <option value="Breaking window glass">Breaking window glass (Property Damage, 2 Marks)</option>
              <option value="Damaging clocks, furniture, or hostel property">Damaging clocks, furniture, or hostel property (2 Marks)</option>
              <option value="Fighting with another student">Fighting with another student (Critical, 5 Marks)</option>
              <option value="Bullying or mistreating other students">Bullying or mistreating other students (Critical, 5 Marks)</option>
              <option value="Possessing a mobile phone in hostel">Possessing a mobile phone in hostel (Moderate, 2 Marks)</option>
              <option value="Violating hostel silence hours">Violating hostel silence hours (Minor, 1 Mark)</option>
              <option value="Other hostel rules violation">Other hostel rules violation</option>
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Incident Date</label>
            <input type="date" id="inc-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
          </div>
          <div class="form-group">
            <label class="form-label required">Severity</label>
            <select id="inc-severity" class="form-control">
              <option value="Minor">Minor</option>
              <option value="Moderate" selected>Moderate</option>
              <option value="Major">Major</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Black Marks to Award</label>
            <input type="number" id="inc-marks" class="form-control" value="2" min="1" max="10" required />
          </div>
          <div class="form-group">
            <label class="form-label">Property Damage Fine (₹) if applicable</label>
            <input type="number" id="inc-fine" class="form-control" value="0" min="0" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Incident Description & Location</label>
          <textarea id="inc-desc" class="form-control" rows="2" placeholder="Describe the incident, exact location, and circumstances" required></textarea>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Action Taken / Disciplinary Decision</label>
          <input type="text" id="inc-action" class="form-control" placeholder="e.g. Property repair cost levied, phone confiscated for 7 days" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-incident">Log Incident & Apply Black Marks</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-incident').addEventListener('click', async () => {
          const sid = modalBody.querySelector('#inc-student').value;
          const category = modalBody.querySelector('#inc-category').value;
          const incident_date = modalBody.querySelector('#inc-date').value;
          const severity = modalBody.querySelector('#inc-severity').value;
          const marks = modalBody.querySelector('#inc-marks').value;
          const fine = modalBody.querySelector('#inc-fine').value;
          const desc = modalBody.querySelector('#inc-desc').value.trim();
          const action = modalBody.querySelector('#inc-action').value.trim();

          if (!desc) {
            toast.error('Please enter an incident description.');
            return;
          }

          await db.logDisciplineIncident({
            student_id: sid,
            category,
            severity,
            incident_date,
            description: desc,
            black_marks: marks,
            fine,
            action_taken: action || 'Documented on record',
            reported_by: user?.full_name || 'Staff'
          });

          toast.success('Disciplinary incident recorded and black mark ledger updated.');
          close();
          renderDisciplineModule(container, { onNavigate });
        });
      }
    });
  });

  // Incident Details Modal
  container.querySelectorAll('.btn-view-incident').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const d = displayIncidents.find(item => item.id === id);
      const student = students.find(s => s.id === d?.student_id);

      openModal({
        title: `Disciplinary Incident Details — ${student?.full_name}`,
        contentHtml: `
          <div style="font-size: 0.9rem; line-height: 1.7; color: var(--text-secondary);">
            <div>Category: <strong style="color: var(--text-primary);">${d.category}</strong></div>
            <div>Date: <strong>${formatDate(d.incident_date)}</strong> • Severity: <strong>${d.severity}</strong></div>
            <div>Reported By: <strong>${d.reported_by || 'Staff'}</strong></div>
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--bg-surface-subtle); border-radius: var(--radius-md);">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Description:</span>
              <p style="color: var(--text-primary); margin-top: 0.25rem;">${d.description}</p>
            </div>
            <div style="margin-top: 0.75rem;">
              <div>Black Marks Awarded: <span class="badge badge-black-mark">+${d.black_marks_awarded}</span></div>
              <div>Property Fine: <strong>${d.monetary_fine > 0 ? formatCurrency(d.monetary_fine) : 'None'}</strong></div>
              <div>Action Taken: <strong>${d.action_taken || 'Under review'}</strong></div>
              <div>Resolution Status: <span class="badge badge-active">${d.resolution_status}</span></div>
            </div>
          </div>
        `
      });
    });
  });
}
