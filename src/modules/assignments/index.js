import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderAssignmentsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const programs = await db.getPrograms();
  const sections = await db.getSections();
  const classrooms = await db.getClassrooms();
  const students = await db.getStudents();

  let selectedClsId = classrooms[0]?.id || '';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Student & Teacher Classroom Assignments</h2>
        <p>Assign students to programs and classrooms independently from their actual school grade</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-primary" id="btn-assign-students">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            Enroll Student to Classroom
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Classroom Selector Filter -->
    <div class="card-panel" style="margin-bottom: 1.5rem;">
      <div class="card-panel-body" style="padding: 1rem 1.25rem;">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <label class="form-label" style="font-weight: 700;">Select Target Classroom:</label>
          <select id="classroom-selector" class="form-control" style="max-width: 380px;">
            ${classrooms.map(c => {
              const sec = sections.find(s => s.id === c.section_id);
              const prog = programs.find(p => p.id === sec?.program_id);
              return `<option value="${c.id}" ${c.id === selectedClsId ? 'selected' : ''}>${c.name} — ${sec?.name || ''} (${prog?.name || ''})</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    </div>

    <!-- Roster of Enrolled Students -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3 id="classroom-roster-title">Enrolled Students Roster</h3>
        <span class="badge badge-active" id="classroom-roster-count">${students.length} Active Students Assigned</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No</th>
                <th>School Grade</th>
                <th>Gender</th>
                <th>Effective Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="roster-table-body">
              ${students.map(s => `
                <tr>
                  <td>
                    <strong>${s.full_name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${s.village || 'Kerala'}</div>
                  </td>
                  <td><code>${s.admission_number}</code></td>
                  <td><span class="badge badge-leave">${s.school_class || 'STD-V'}</span></td>
                  <td>${s.gender}</td>
                  <td>2026-06-01</td>
                  <td>
                    <button class="btn btn-outline btn-sm btn-transfer" data-id="${s.id}">Transfer</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Classroom select listener
  container.querySelector('#classroom-selector')?.addEventListener('change', (e) => {
    selectedClsId = e.target.value;
    const c = classrooms.find(item => item.id === selectedClsId);
    if (c) {
      container.querySelector('#classroom-roster-title').textContent = `Enrolled Students Roster — ${c.name}`;
      toast.info(`Loaded roster for ${c.name}`);
    }
  });

  // Assign students modal
  container.querySelector('#btn-assign-students')?.addEventListener('click', () => {
    openModal({
      title: 'Assign Student to Classroom',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Select Student</label>
          <select id="assign-student-select" class="form-control">
            ${students.map(s => `<option value="${s.id}">${s.full_name} (${s.admission_number}) — ${s.school_class}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Assign to Classroom</label>
          <select id="assign-cls-select" class="form-control">
            ${classrooms.map(c => `<option value="${c.id}" ${c.id === selectedClsId ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Effective From Date</label>
          <input type="date" id="assign-effective-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-confirm-assign">Confirm Assignment</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-confirm-assign').addEventListener('click', () => {
          toast.success('Student assignment saved with effective date.');
          close();
        });
      }
    });
  });

  container.querySelectorAll('.btn-transfer').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const st = students.find(s => s.id === id);
      openModal({
        title: `Transfer Student — ${st?.full_name}`,
        contentHtml: `
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Transfers preserve all past attendance and grade history by recording effective assignment dates.
          </p>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label required">Transfer to New Classroom</label>
            <select class="form-control" id="transfer-cls-select">
              ${classrooms.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label required">Transfer Effective Date</label>
            <input type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" id="btn-save-transfer">Complete Transfer</button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-save-transfer').addEventListener('click', () => {
            toast.success(`Transfer for ${st?.full_name} completed.`);
            close();
          });
        }
      });
    });
  });
}
