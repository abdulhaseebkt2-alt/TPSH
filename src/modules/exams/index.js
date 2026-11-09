import { db } from '../../lib/db.js';
import { formatDate, isExamResultActiveForParents } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { isViewOnlyModule } from '../../lib/permissions.js';

export async function renderExamsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const isViewOnly = isViewOnlyModule(user, 'exams');
  const [exams, examSubjects, classes] = await Promise.all([
    db.getExams(),
    db.getExamSubjects(),
    db.getClassrooms ? db.getClassrooms() : []
  ]);

  const activePublishedCount = exams.filter(e => isExamResultActiveForParents(e)).length;
  const expiredCount = exams.filter(e => e.is_published && !isExamResultActiveForParents(e)).length;
  const draftCount = exams.filter(e => !e.is_published).length;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>School Examination Management</h2>
        <p>Configure institutional examinations, mark weightages, passing thresholds, timetable schedules & parent window visibility</p>
      </div>
      <div class="page-actions">
        ${!isViewOnly && (user?.is_super_admin || user?.role === 'admin') ? `
          <button class="btn btn-primary" id="btn-create-exam" style="display: inline-flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Schedule New Exam
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Telemetry KPI Summary Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="stat-card" style="border-left: 4px solid #2563EB;">
        <div class="stat-header">
          <span class="stat-title">Total Examinations</span>
          <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
        </div>
        <div class="stat-value">${exams.length} Series</div>
        <div class="stat-footer"><span>Institutional Exam Records</span></div>
      </div>

      <div class="stat-card" style="border-left: 4px solid #059669;">
        <div class="stat-header">
          <span class="stat-title">Published (Active)</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: #059669;">${activePublishedCount} Active</div>
        <div class="stat-footer"><span>Currently visible in Parent Portal</span></div>
      </div>

      <div class="stat-card" style="border-left: 4px solid #EA580C;">
        <div class="stat-header">
          <span class="stat-title">Expired Windows</span>
          <div class="stat-icon-wrapper" style="background: #FFF7ED; color: #EA580C;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: #EA580C;">${expiredCount} Closed</div>
        <div class="stat-footer"><span>Auto-removed from Parents</span></div>
      </div>

      <div class="stat-card" style="border-left: 4px solid #64748B;">
        <div class="stat-header">
          <span class="stat-title">Draft / Unpublished</span>
          <div class="stat-icon-wrapper" style="background: #F1F5F9; color: #64748B;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: #64748B;">${draftCount} Drafts</div>
        <div class="stat-footer"><span>Faculty evaluation in progress</span></div>
      </div>
    </div>

    <!-- Exams Master Card Panel -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3>Scheduled Institutional Examinations (2026-2027)</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0;">Configure exam titles, passing marks, ranking rules, and result validity windows</p>
        </div>
        <span class="badge badge-active">${exams.length} Series Configured</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Examination Title</th>
                <th>Type & Scope</th>
                <th>Mark Rules (Max / Pass)</th>
                <th>Schedule Period</th>
                <th>Parent Visibility & Window</th>
                <th>Rank Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${exams.map(e => {
                const subCount = examSubjects.filter(s => s.exam_id === e.id).length;
                const isPublished = !!e.is_published;
                const isActiveForParents = isExamResultActiveForParents(e);
                const hasRanks = e.publish_ranks !== false;

                let pubStatusHtml = '';
                if (!isPublished) {
                  pubStatusHtml = `<span class="badge badge-pending">Draft / Unpublished</span>`;
                } else if (isActiveForParents) {
                  pubStatusHtml = `
                    <span class="badge badge-present">✓ Published (Active)</span>
                    <div style="font-size: 0.7rem; color: #059669; font-weight: 600; margin-top: 3px;">
                      Visible until: ${e.publish_until ? formatDate(e.publish_until.split('T')[0]) + (e.publish_until.includes('T') ? ' ' + e.publish_until.split('T')[1] : '') : 'Permanent'}
                    </div>
                  `;
                } else {
                  pubStatusHtml = `
                    <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA;">⌛ Expired (Hidden)</span>
                    <div style="font-size: 0.7rem; color: #991B1B; margin-top: 3px;">
                      Closed on ${e.publish_until ? formatDate(e.publish_until.split('T')[0]) : 'Passed'}
                    </div>
                  `;
                }

                return `
                  <tr>
                    <td>
                      <strong style="color: #0F172A; font-size: 0.92rem;">${e.title}</strong>
                      <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
                        ${subCount} Subject${subCount === 1 ? '' : 's'} Configured • Rank Policy: ${e.ranking_policy || 'Standard'}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-leave" style="font-size: 0.72rem;">${e.exam_type}</span>
                      <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">
                        ${e.school_class || 'All Classes'}
                      </div>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem; font-weight: 700; color: #0F172A;">
                        Max: <strong>${e.max_marks || 100}</strong>
                        <span style="font-size: 0.72rem; color: #64748B; font-weight: 500;">(T:${e.theory_max || 80} / P:${e.practical_max || 20})</span>
                      </div>
                      <div style="font-size: 0.74rem; color: #DC2626; font-weight: 700; margin-top: 2px;">
                        Pass Mark: ≥ ${e.passing_marks || 40}
                      </div>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem; color: #334155;">${formatDate(e.start_date)} — ${formatDate(e.end_date)}</div>
                    </td>
                    <td>
                      ${pubStatusHtml}
                    </td>
                    <td>
                      ${hasRanks ? `
                        <span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 0.7rem;">🏆 Ranks Public</span>
                      ` : `
                        <span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.7rem;">Ranks Hidden</span>
                      `}
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm btn-enter-marks" data-exam-id="${e.id}" title="Enter and review student marks">
                          Marks Entry
                        </button>
                        ${!isViewOnly && (user?.is_super_admin || user?.role === 'admin') ? `
                          <button class="btn btn-outline btn-sm btn-exam-config" data-exam-id="${e.id}" title="Configure exam, pass mark & subjects">
                            Config
                          </button>
                          ${isPublished ? `
                            <button class="btn btn-outline btn-sm btn-quick-unpublish" data-exam-id="${e.id}" style="color: #D97706; border-color: #FCD34D;" title="Revert to Draft">
                              Unpublish
                            </button>
                          ` : `
                            <button class="btn btn-outline btn-sm btn-quick-publish" data-exam-id="${e.id}" style="color: #059669; border-color: #A7F3D0;" title="Publish to Parents">
                              Publish
                            </button>
                          `}
                          <button class="btn btn-outline btn-sm btn-delete-exam" data-exam-id="${e.id}" style="color: #DC2626; border-color: #FECACA;" title="Delete Exam">
                            ✕
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No examinations scheduled yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Navigate to Marks Entry
  container.querySelectorAll('.btn-enter-marks').forEach(btn => {
    btn.addEventListener('click', () => {
      const examId = btn.getAttribute('data-exam-id');
      if (examId) sessionStorage.setItem('tps_active_exam_id', examId);
      onNavigate('marks');
    });
  });

  // Schedule New Exam
  container.querySelector('#btn-create-exam')?.addEventListener('click', () => {
    openExamFormModal(null, async () => {
      renderExamsModule(container, { onNavigate });
    });
  });

  // Config Existing Exam
  container.querySelectorAll('.btn-exam-config').forEach(btn => {
    btn.addEventListener('click', () => {
      const examId = btn.getAttribute('data-exam-id');
      const exam = exams.find(e => e.id === examId);
      if (exam) {
        openExamFormModal(exam, async () => {
          renderExamsModule(container, { onNavigate });
        });
      }
    });
  });

  // Quick Publish
  container.querySelectorAll('.btn-quick-publish').forEach(btn => {
    btn.addEventListener('click', async () => {
      const examId = btn.getAttribute('data-exam-id');
      const exam = exams.find(e => e.id === examId);
      if (!exam) return;

      openPublishWindowModal(exam, async () => {
        renderExamsModule(container, { onNavigate });
      });
    });
  });

  // Quick Unpublish
  container.querySelectorAll('.btn-quick-unpublish').forEach(btn => {
    btn.addEventListener('click', async () => {
      const examId = btn.getAttribute('data-exam-id');
      const exam = exams.find(e => e.id === examId);
      if (!exam) return;

      const confirmed = await confirmDialog({
        title: `Unpublish "${exam.title}"?`,
        message: 'Unpublishing will immediately remove these examination results and student report cards from the parent and student portals.',
        confirmText: 'Unpublish to Draft'
      });

      if (confirmed) {
        await db.unpublishResults(examId);
        toast.info(`Examination results reverted to Draft.`);
        renderExamsModule(container, { onNavigate });
      }
    });
  });

  // Delete Exam
  container.querySelectorAll('.btn-delete-exam').forEach(btn => {
    btn.addEventListener('click', async () => {
      const examId = btn.getAttribute('data-exam-id');
      const exam = exams.find(e => e.id === examId);
      if (!exam) return;

      const confirmed = await confirmDialog({
        title: `Delete "${exam.title}"?`,
        message: 'This will permanently delete this examination, its subject definitions, and all recorded student marks. This action cannot be undone.',
        confirmText: 'Delete Examination'
      });

      if (confirmed) {
        await db.deleteExam(examId);
        toast.success(`Exam "${exam.title}" deleted.`);
        renderExamsModule(container, { onNavigate });
      }
    });
  });
}

/**
 * Modal to Configure Exam, Mark Settings, Pass/Fail Thresholds, and Subject Definitions
 */
async function openExamFormModal(existingExam = null, onSaved = () => {}) {
  const isEdit = !!existingExam;
  const currentSubjects = isEdit ? await db.getExamSubjects(existingExam.id) : [
    { subject: 'Moral Studies & Ethics', max_marks: 100, passing_marks: 40, theory_max: 80, practical_max: 20 },
    { subject: 'Arabic Language', max_marks: 100, passing_marks: 40, theory_max: 80, practical_max: 20 },
    { subject: 'Mathematics', max_marks: 100, passing_marks: 40, theory_max: 80, practical_max: 20 },
    { subject: 'General Science', max_marks: 100, passing_marks: 40, theory_max: 80, practical_max: 20 },
    { subject: 'English', max_marks: 100, passing_marks: 40, theory_max: 80, practical_max: 20 }
  ];

  let localSubjects = JSON.parse(JSON.stringify(currentSubjects));

  const defaultStart = existingExam?.start_date || new Date().toISOString().split('T')[0];
  const defaultEnd = existingExam?.end_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const defaultUntil = existingExam?.publish_until || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16);

  openModal({
    title: isEdit ? `Configure Examination — ${existingExam.title}` : 'Schedule New Institutional Examination',
    size: 'lg',
    contentHtml: `
      <div style="max-height: 75vh; overflow-y: auto; padding-right: 4px;">
        <!-- SECTION 1: General Details -->
        <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 800; color: #0F172A; margin: 0 0 0.85rem 0; display: flex; align-items: center; gap: 6px;">
            <span>📋</span> 1. Examination Series Details
          </h4>
          <div class="form-group" style="margin-bottom: 0.75rem;">
            <label class="form-label required">Examination Title</label>
            <input type="text" id="cfg-exam-title" class="form-control" placeholder="e.g. Annual Moral Assessment 2026" value="${existingExam?.title || ''}" required />
          </div>
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
            <div class="form-group">
              <label class="form-label required">Exam Type</label>
              <select id="cfg-exam-type" class="form-control">
                <option value="Half_Yearly" ${existingExam?.exam_type === 'Half_Yearly' ? 'selected' : ''}>Half-Yearly Examination</option>
                <option value="Annual" ${existingExam?.exam_type === 'Annual' ? 'selected' : ''}>Annual Examination</option>
                <option value="Unit_Test" ${existingExam?.exam_type === 'Unit_Test' ? 'selected' : ''}>Unit Test</option>
                <option value="Term_Exam" ${existingExam?.exam_type === 'Term_Exam' ? 'selected' : ''}>Terminal Examination</option>
                <option value="Moral_Evaluation" ${existingExam?.exam_type === 'Moral_Evaluation' ? 'selected' : ''}>Moral & Ethical Evaluation</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Target Standard / Class</label>
              <select id="cfg-exam-class" class="form-control">
                <option value="All Classes" ${!existingExam?.school_class || existingExam.school_class === 'All Classes' ? 'selected' : ''}>All Classes (Universal)</option>
                <option value="STD-I" ${existingExam?.school_class === 'STD-I' ? 'selected' : ''}>Class STD-I</option>
                <option value="STD-II" ${existingExam?.school_class === 'STD-II' ? 'selected' : ''}>Class STD-II</option>
                <option value="STD-III" ${existingExam?.school_class === 'STD-III' ? 'selected' : ''}>Class STD-III</option>
                <option value="STD-IV" ${existingExam?.school_class === 'STD-IV' ? 'selected' : ''}>Class STD-IV</option>
                <option value="STD-V" ${existingExam?.school_class === 'STD-V' ? 'selected' : ''}>Class STD-V</option>
                <option value="STD-VI" ${existingExam?.school_class === 'STD-VI' ? 'selected' : ''}>Class STD-VI</option>
                <option value="STD-VII" ${existingExam?.school_class === 'STD-VII' ? 'selected' : ''}>Class STD-VII</option>
                <option value="STD-VIII" ${existingExam?.school_class === 'STD-VIII' ? 'selected' : ''}>Class STD-VIII</option>
                <option value="STD-IX" ${existingExam?.school_class === 'STD-IX' ? 'selected' : ''}>Class STD-IX</option>
                <option value="STD-X" ${existingExam?.school_class === 'STD-X' ? 'selected' : ''}>Class STD-X</option>
              </select>
            </div>
          </div>
          <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label class="form-label required">Start Date</label>
              <input type="date" id="cfg-exam-start" class="form-control" value="${defaultStart}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">End Date</label>
              <input type="date" id="cfg-exam-end" class="form-control" value="${defaultEnd}" required />
            </div>
          </div>
        </div>

        <!-- SECTION 2: Pass/Fail & Mark Settings -->
        <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 800; color: #92400E; margin: 0 0 0.85rem 0; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span> 2. Mark Settings & Pass / Fail Evaluation Rules
          </h4>
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
            <div class="form-group">
              <label class="form-label required">Total Max Marks</label>
              <input type="number" id="cfg-max-marks" class="form-control" value="${existingExam?.max_marks || 100}" min="10" max="1000" />
            </div>
            <div class="form-group">
              <label class="form-label required">Theory Max</label>
              <input type="number" id="cfg-theory-max" class="form-control" value="${existingExam?.theory_max || 80}" min="0" max="1000" />
            </div>
            <div class="form-group">
              <label class="form-label required">Practical Max</label>
              <input type="number" id="cfg-practical-max" class="form-control" value="${existingExam?.practical_max || 20}" min="0" max="1000" />
            </div>
            <div class="form-group">
              <label class="form-label required" style="color: #DC2626; font-weight: 800;">Passing Mark Threshold</label>
              <input type="number" id="cfg-pass-marks" class="form-control" value="${existingExam?.passing_marks || 40}" min="1" max="1000" style="border-color: #F87171;" />
            </div>
          </div>
          <div style="font-size: 0.76rem; color: #78350F; background: rgba(245, 158, 11, 0.15); padding: 0.5rem 0.75rem; border-radius: 8px; line-height: 1.35;">
            💡 <strong>Pass / Fail Rule:</strong> Any student who scores below the <strong>Passing Mark Threshold</strong> in any subject will automatically receive a <span style="color: #DC2626; font-weight: 800;">Fail (Grade F)</span> status. Scores equal or above will be marked <span style="color: #059669; font-weight: 800;">Pass</span>.
          </div>
        </div>

        <!-- SECTION 3: Publishing, Ranking & Removal Window -->
        <div style="background: #F0FDF4; border: 1.5px solid #A7F3D0; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 800; color: #065F46; margin: 0 0 0.85rem 0; display: flex; align-items: center; gap: 6px;">
            <span>📢</span> 3. Result Publishing, Ranking & Parent Window Expiry
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;">
            <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: #065F46;">
              <input type="checkbox" id="cfg-is-published" ${existingExam?.is_published ? 'checked' : ''} style="width: 18px; height: 18px;" />
              <span>Publish Examination Results to Parents & Students</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: #065F46;">
              <input type="checkbox" id="cfg-publish-ranks" ${existingExam?.publish_ranks !== false ? 'checked' : ''} style="width: 18px; height: 18px;" />
              <span>Publish Class Rankings (1st, 2nd, 3rd Rank) to Parents</span>
            </label>
          </div>

          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 800; color: #065F46;">
              Display to Parents Until (Result Window Expiry)
            </label>
            <input type="datetime-local" id="cfg-publish-until" class="form-control" value="${defaultUntil}" />
            <div style="font-size: 0.74rem; color: #047857; margin-top: 4px;">
              ⏱ <strong>Automatic Removal:</strong> When this date and time passes, this examination and its report card will automatically be <strong>removed from parent dashboards</strong>.
            </div>
          </div>
        </div>

        <!-- SECTION 4: Subjects Master List -->
        <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="font-size: 0.9rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 6px;">
              <span>📚</span> 4. Examination Subjects & Max / Pass Marks
            </h4>
            <span class="badge" style="background: #F1F5F9; color: #475569;" id="cfg-subjects-count">${localSubjects.length} Subjects</span>
          </div>

          <!-- Add New Subject Subform -->
          <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 0.65rem 0.85rem; margin-bottom: 0.85rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <input type="text" id="new-sub-name" class="form-control" placeholder="New Subject Name (e.g. Urdu, Social Studies)" style="flex: 2; min-width: 180px; font-size: 0.8rem;" />
            <input type="number" id="new-sub-max" class="form-control" placeholder="Max" value="100" style="flex: 1; min-width: 70px; font-size: 0.8rem;" title="Max Marks" />
            <input type="number" id="new-sub-pass" class="form-control" placeholder="Pass" value="40" style="flex: 1; min-width: 70px; font-size: 0.8rem;" title="Pass Mark" />
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-subject-row" style="font-weight: 700; white-space: nowrap;">+ Add Subject</button>
          </div>

          <!-- Subject rows container -->
          <div id="cfg-subjects-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; border-top: 1px solid #E2E8F0; padding-top: 1rem;">
        <button class="btn btn-outline" id="btn-cancel-exam-cfg">Cancel</button>
        <button class="btn btn-primary" id="btn-save-exam-cfg" style="font-weight: 700; padding: 0.55rem 1.5rem;">
          ${isEdit ? 'Save Changes' : 'Create Examination'}
        </button>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      function renderSubjectsList() {
        const listEl = modalBody.querySelector('#cfg-subjects-list');
        const countEl = modalBody.querySelector('#cfg-subjects-count');
        if (!listEl) return;
        if (countEl) countEl.textContent = `${localSubjects.length} Subjects`;

        if (localSubjects.length === 0) {
          listEl.innerHTML = `<div style="text-align: center; color: #94A3B8; font-size: 0.8rem; padding: 1rem;">No subjects added yet. Add at least one subject above.</div>`;
          return;
        }

        listEl.innerHTML = localSubjects.map((sub, idx) => `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.5rem 0.75rem;">
            <div style="flex: 2; min-width: 140px; font-size: 0.85rem; font-weight: 700; color: #1E293B;">
              ${sub.subject}
            </div>
            <div style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.78rem;">
              <div>Max: <strong style="color: #0F172A;">${sub.max_marks || 100}</strong></div>
              <div>Pass: <strong style="color: #DC2626;">${sub.passing_marks || 40}</strong></div>
              <button type="button" class="btn btn-outline btn-sm btn-remove-sub" data-idx="${idx}" style="padding: 2px 7px; color: #DC2626; border-color: #FECACA;" title="Remove Subject">✕</button>
            </div>
          </div>
        `).join('');

        listEl.querySelectorAll('.btn-remove-sub').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            if (!isNaN(idx)) {
              localSubjects.splice(idx, 1);
              renderSubjectsList();
            }
          });
        });
      }

      renderSubjectsList();

      // Add Subject Row Click
      modalBody.querySelector('#btn-add-subject-row')?.addEventListener('click', () => {
        const nameInput = modalBody.querySelector('#new-sub-name');
        const maxInput = modalBody.querySelector('#new-sub-max');
        const passInput = modalBody.querySelector('#new-sub-pass');

        const subName = nameInput.value.trim();
        const maxVal = Number(maxInput.value) || 100;
        const passVal = Number(passInput.value) || 40;

        if (!subName) {
          toast.error('Please enter a subject name.');
          return;
        }

        if (localSubjects.some(s => s.subject.toLowerCase() === subName.toLowerCase())) {
          toast.error(`Subject "${subName}" is already in this exam.`);
          return;
        }

        localSubjects.push({
          subject: subName,
          max_marks: maxVal,
          passing_marks: passVal,
          theory_max: Math.round(maxVal * 0.8),
          practical_max: Math.round(maxVal * 0.2)
        });

        nameInput.value = '';
        renderSubjectsList();
      });

      // Cancel button
      modalBody.querySelector('#btn-cancel-exam-cfg')?.addEventListener('click', close);

      // Save Exam Config
      modalBody.querySelector('#btn-save-exam-cfg')?.addEventListener('click', async () => {
        const title = modalBody.querySelector('#cfg-exam-title').value.trim();
        const type = modalBody.querySelector('#cfg-exam-type').value;
        const schoolClass = modalBody.querySelector('#cfg-exam-class').value;
        const start = modalBody.querySelector('#cfg-exam-start').value;
        const end = modalBody.querySelector('#cfg-exam-end').value;
        const maxMarks = Number(modalBody.querySelector('#cfg-max-marks').value) || 100;
        const theoryMax = Number(modalBody.querySelector('#cfg-theory-max').value) || 80;
        const practicalMax = Number(modalBody.querySelector('#cfg-practical-max').value) || 20;
        const passMarks = Number(modalBody.querySelector('#cfg-pass-marks').value) || 40;
        const isPublished = modalBody.querySelector('#cfg-is-published').checked;
        const publishRanks = modalBody.querySelector('#cfg-publish-ranks').checked;
        const publishUntil = modalBody.querySelector('#cfg-publish-until').value;

        if (!title) {
          toast.error('Please enter an examination title.');
          return;
        }

        if (localSubjects.length === 0) {
          toast.error('Please add at least one subject to this examination series.');
          return;
        }

        const examId = isEdit ? existingExam.id : 'exam-' + Date.now();
        const examRecord = {
          id: examId,
          title,
          exam_type: type,
          school_class: schoolClass,
          start_date: start,
          end_date: end,
          max_marks: maxMarks,
          theory_max: theoryMax,
          practical_max: practicalMax,
          passing_marks: passMarks,
          is_published: isPublished,
          publish_ranks: publishRanks,
          publish_until: publishUntil,
          ranking_policy: existingExam?.ranking_policy || 'standard',
          published_at: isPublished ? (existingExam?.published_at || new Date().toISOString()) : null
        };

        await db.saveExam(examRecord);
        await db.saveExamSubjects(examId, localSubjects);

        toast.success(`Exam "${title}" saved successfully with ${localSubjects.length} subjects.`);
        close();
        onSaved();
      });
    }
  });
}

/**
 * Modal to Publish Examination Results with custom Expiry Window and Rank Toggle
 */
async function openPublishWindowModal(exam, onPublished = () => {}) {
  const defaultUntil = exam.publish_until || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16);

  openModal({
    title: `Publish Results — ${exam.title}`,
    size: 'md',
    contentHtml: `
      <div style="margin-bottom: 1.25rem;">
        <p style="font-size: 0.85rem; color: #475569; margin-bottom: 1rem; line-height: 1.4;">
          Publishing results makes student scores, report cards, and status immediately visible in parent and student portals.
        </p>

        <div style="background: #F0FDF4; border: 1.5px solid #A7F3D0; border-radius: 10px; padding: 0.85rem; margin-bottom: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: #065F46; margin: 0;">
            <input type="checkbox" id="pub-ranks-toggle" ${exam.publish_ranks !== false ? 'checked' : ''} style="width: 17px; height: 17px;" />
            <span>Publish Student Class Rankings (1st, 2nd, 3rd Rank)</span>
          </label>
          <div style="font-size: 0.72rem; color: #047857; margin-left: 27px; margin-top: 2px;">
            Uncheck to display subject marks and grades while keeping class ranks confidential.
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required" style="font-weight: 700; color: #0F172A;">
            Display to Parents Until (Result Window Expiry)
          </label>
          <input type="datetime-local" id="pub-until-input" class="form-control" value="${defaultUntil}" required />
          <div style="font-size: 0.74rem; color: #DC2626; font-weight: 600; margin-top: 4px;">
            ⏱ If this time is over, the exam result will automatically be removed from parent dashboards.
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button class="btn btn-outline" id="btn-cancel-publish">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-publish" style="background: #059669; font-weight: 700;">
          Publish Results Now
        </button>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      modalBody.querySelector('#btn-cancel-publish')?.addEventListener('click', close);

      modalBody.querySelector('#btn-confirm-publish')?.addEventListener('click', async () => {
        const publishRanks = modalBody.querySelector('#pub-ranks-toggle').checked;
        const publishUntil = modalBody.querySelector('#pub-until-input').value;

        await db.publishResults(exam.id, {
          publishRanks,
          publishUntil
        });

        toast.success(`Results for "${exam.title}" published to parents.`);
        close();
        onPublished();
      });
    }
  });
}
