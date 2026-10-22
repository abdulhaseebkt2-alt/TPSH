import { db } from '../../lib/db.js';
import { formatDate } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderExamsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const exams = await db.getExams();
  const examSubjects = await db.getExamSubjects();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>School Examination Management</h2>
        <p>Configure institutional examinations, subject weightages, passing thresholds, and timetable schedules</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-primary" id="btn-create-exam">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Schedule New Exam
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Exams Master Card Panel -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Institutional Examinations (2026-2027)</h3>
        <span class="badge badge-active">${exams.length} Examination Series</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Examination Title</th>
                <th>Type</th>
                <th>Schedule Period</th>
                <th>Subjects</th>
                <th>Publication Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${exams.map(e => {
                const subCount = examSubjects.filter(s => s.exam_id === e.id).length;
                return `
                  <tr>
                    <td>
                      <strong>${e.title}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">Ranking Policy: ${e.ranking_policy || 'Standard'}</div>
                    </td>
                    <td><span class="badge badge-leave">${e.exam_type}</span></td>
                    <td>${formatDate(e.start_date)} — ${formatDate(e.end_date)}</td>
                    <td><span class="badge badge-active">${subCount} Subjects</span></td>
                    <td>
                      <span class="badge ${e.is_published ? 'badge-present' : 'badge-pending'}">
                        ${e.is_published ? 'Published to Parents' : 'Draft / Unpublished'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-primary btn-sm btn-enter-marks" data-id="${e.id}">Marks Entry</button>
                        <button class="btn btn-outline btn-sm btn-exam-details" data-id="${e.id}">Config</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No examinations scheduled</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-enter-marks').forEach(btn => {
    btn.addEventListener('click', () => {
      onNavigate('marks');
    });
  });

  // Schedule New Exam Modal
  container.querySelector('#btn-create-exam')?.addEventListener('click', () => {
    openModal({
      title: 'Schedule New Examination',
      size: 'md',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Examination Title</label>
          <input type="text" id="exam-title" class="form-control" placeholder="e.g. Annual Moral Assessment 2026" required />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Exam Type</label>
          <select id="exam-type" class="form-control">
            <option value="Half_Yearly">Half-Yearly Examination</option>
            <option value="Annual">Annual Examination</option>
            <option value="Unit_Test">Unit Test</option>
            <option value="Moral_Evaluation">Moral & Ethical Evaluation</option>
          </select>
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Start Date</label>
            <input type="date" id="exam-start" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
          </div>
          <div class="form-group">
            <label class="form-label required">End Date</label>
            <input type="date" id="exam-end" class="form-control" value="${new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]}" required />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Class Ranking Policy</label>
          <select id="exam-ranking" class="form-control">
            <option value="standard">Standard Sequential Ranking</option>
            <option value="competition_tied">Competition Tied Ranking (Equal scores share rank)</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-new-exam">Schedule Examination</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-new-exam').addEventListener('click', async () => {
          const title = modalBody.querySelector('#exam-title').value.trim();
          const type = modalBody.querySelector('#exam-type').value;
          const start = modalBody.querySelector('#exam-start').value;
          const end = modalBody.querySelector('#exam-end').value;
          const ranking = modalBody.querySelector('#exam-ranking').value;

          if (!title) {
            toast.error('Please enter an exam title.');
            return;
          }

          const currentExams = await db.getExams();
          const newExam = {
            id: 'exam-' + Date.now(),
            title,
            exam_type: type,
            start_date: start,
            end_date: end,
            is_published: false,
            ranking_policy: ranking
          };
          currentExams.push(newExam);
          db.set('tps_exams', currentExams);
          toast.success(`Exam "${title}" scheduled successfully.`);
          close();
          renderExamsModule(container, { onNavigate });
        });
      }
    });
  });
}
