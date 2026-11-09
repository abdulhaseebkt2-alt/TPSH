import { db } from '../../lib/db.js';
import { printDocument, exportToExcel, formatDate, calculateGrade, calculateRanks, isExamResultActiveForParents } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { isViewOnlyModule } from '../../lib/permissions.js';

export async function renderMarksModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const isViewOnly = isViewOnlyModule(user, 'marks');
  const [exams, allExamSubjects, allStudents] = await Promise.all([
    db.getExams(),
    db.getExamSubjects(),
    db.getStudents()
  ]);

  if (!exams || exams.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon">📝</div>
        <h4>No Examinations Found</h4>
        <p>Please schedule an institutional examination series first before entering marks.</p>
        <button class="btn btn-primary" id="btn-goto-exams" style="margin-top: 1rem;">Go to Exam Management</button>
      </div>
    `;
    container.querySelector('#btn-goto-exams')?.addEventListener('click', () => onNavigate('exams'));
    return;
  }

  // Active Exam Resolution
  let savedExamId = sessionStorage.getItem('tps_active_exam_id');
  let activeExam = exams.find(e => e.id === savedExamId) || exams[0];
  const examSubjects = allExamSubjects.filter(s => s.exam_id === activeExam.id);

  const isParent = user?.role === 'parent';
  const isStudent = user?.role === 'student';
  const isParentOrStudent = isParent || isStudent;
  const isResultActive = isExamResultActiveForParents(activeExam);

  // Security gate: Parents & students cannot access unpublished or expired exam results
  if (isParentOrStudent && (!activeExam.is_published || !isResultActive)) {
    const isExpired = activeExam.is_published && !isResultActive;
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon" style="color: ${isExpired ? '#DC2626' : '#64748B'}; display: flex; justify-content: center; margin-bottom: 1rem;">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h4>${isExpired ? 'Result Display Period Concluded' : 'Results Not Published Yet'}</h4>
        <p>
          ${isExpired 
            ? `The active result viewing period for <strong>${activeExam.title}</strong> has expired and has been removed from the portal as per institutional policy. Please contact the school academic office for inquiries.` 
            : `Examination results for <strong>${activeExam.title}</strong> have not been published by the academic administration yet. Please check back later.`}
        </p>
      </div>
    `;
    return;
  }

  const marks = await db.getMarks(activeExam.id);

  // Resolve parent's children
  let parentChildIds = [];
  if (isParent) {
    const parentAssignments = db.get('tps_parent_assignments') || {};
    parentChildIds = user.assigned_student_ids || user.student_ids || parentAssignments[user.id] || [];
  } else if (isStudent) {
    const myStudent = allStudents.find(s => s.email === user.email || s.admission_number === user.tps_id);
    if (myStudent) parentChildIds = [myStudent.id];
  }

  // Filter students relevant to view
  let relevantStudents = allStudents;
  if (isParentOrStudent) {
    relevantStudents = allStudents.filter(s => parentChildIds.includes(s.id));
  }

  // Calculate student aggregates & class ranks
  const studentTotals = [];
  const passingThreshold = activeExam.passing_marks || 40;
  const examMaxMarks = activeExam.max_marks || 100;

  for (const st of allStudents) {
    const stMarks = marks.filter(m => m.student_id === st.id);
    if (stMarks.length > 0) {
      const totalScore = stMarks.reduce((sum, m) => sum + (Number(m.total) || 0), 0);
      const totalMax = stMarks.reduce((sum, m) => {
        const subDef = examSubjects.find(s => s.subject === m.subject);
        return sum + (Number(subDef?.max_marks) || examMaxMarks);
      }, 0);
      const hasFailedSubject = stMarks.some(m => {
        const subDef = examSubjects.find(s => s.subject === m.subject);
        const subPass = Number(subDef?.passing_marks) || passingThreshold;
        return (Number(m.total) || 0) < subPass;
      });

      studentTotals.push({
        student_id: st.id,
        student_name: st.full_name,
        school_class: st.school_class,
        total: totalScore,
        maxPossible: totalMax,
        percentage: totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : '0.0',
        overall_status: hasFailedSubject ? 'Fail' : 'Pass'
      });
    }
  }

  const rankMap = calculateRanks(studentTotals, activeExam.ranking_policy || 'standard');

  const passedStudentsCount = studentTotals.filter(s => s.overall_status === 'Pass').length;
  const failedStudentsCount = studentTotals.filter(s => s.overall_status === 'Fail').length;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Marks Entry, Grade Calculation & Report Cards</h2>
        <p>Subject evaluation, pass/fail thresholds, automated class ranking & official student report cards</p>
      </div>
      <div class="page-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
        ${!isParentOrStudent ? `
          ${!isViewOnly ? `
            <button class="btn btn-outline" id="btn-export-marks">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Results (.xlsx)
            </button>
            <button class="btn btn-primary" id="btn-enter-marks-dialog" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Enter / Edit Marks
            </button>
          ` : ''}
          ${user?.is_super_admin || user?.role === 'admin' ? `
            <button class="btn btn-outline" id="btn-manage-publish-window" style="font-weight: 700; ${activeExam.is_published ? 'color: #059669; border-color: #A7F3D0;' : 'color: #2563EB; border-color: #BFDBFE;'}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              ${activeExam.is_published ? 'Update Publish / Ranks' : 'Publish to Parents'}
            </button>
          ` : ''}
        ` : ''}
      </div>
    </div>

    <!-- Active Examination Selector & Governance Banner -->
    <div class="card-panel" style="margin-bottom: 1.25rem;">
      <div class="card-panel-body" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <div>
            <label style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">
              Active Examination Series
            </label>
            <select id="marks-exam-select" class="form-control" style="font-weight: 800; font-size: 1rem; color: #0F172A; min-width: 250px; background: #F8FAFC;">
              ${exams.map(e => `
                <option value="${e.id}" ${e.id === activeExam.id ? 'selected' : ''}>
                  ${e.title} (${e.exam_type})
                </option>
              `).join('')}
            </select>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #64748B;">
              Max Marks: <strong>${examMaxMarks}</strong> • 
              Passing Threshold: <strong style="color: #DC2626;">≥ ${passingThreshold} Marks</strong>
            </div>
            <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">
              ${examSubjects.length} Subjects Evaluated • Ranking: <strong>${activeExam.ranking_policy || 'Standard'}</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <span class="badge ${activeExam.is_published ? (isResultActive ? 'badge-present' : 'badge-danger') : 'badge-pending'}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
            ${!activeExam.is_published ? 'Draft / Moderation' : isResultActive ? '✓ Published to Parents' : '⌛ Expired (Hidden from Parents)'}
          </span>
          ${activeExam.publish_ranks !== false ? `
            <span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 0.75rem; padding: 0.35rem 0.65rem;">
              🏆 Ranks Public
            </span>
          ` : `
            <span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.75rem; padding: 0.35rem 0.65rem;">
              Ranks Hidden
            </span>
          `}
          ${activeExam.is_published && activeExam.publish_until ? `
            <span style="font-size: 0.74rem; color: ${isResultActive ? '#059669' : '#DC2626'}; font-weight: 700;">
              ${isResultActive ? 'Visible until:' : 'Ended:'} ${formatDate(activeExam.publish_until.split('T')[0])}
            </span>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Telemetry Strip -->
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 1.25rem;">
      <div class="stat-card" style="padding: 0.75rem 1rem;">
        <span class="stat-title" style="font-size: 0.75rem;">Students Evaluated</span>
        <div class="stat-value" style="font-size: 1.25rem;">${studentTotals.length} / ${allStudents.length}</div>
      </div>
      <div class="stat-card" style="padding: 0.75rem 1rem; border-left: 3px solid #059669;">
        <span class="stat-title" style="font-size: 0.75rem; color: #065F46;">Students Passed</span>
        <div class="stat-value" style="font-size: 1.25rem; color: #059669;">${passedStudentsCount}</div>
      </div>
      <div class="stat-card" style="padding: 0.75rem 1rem; border-left: 3px solid #DC2626;">
        <span class="stat-title" style="font-size: 0.75rem; color: #991B1B;">Students Failed (&lt;${passingThreshold})</span>
        <div class="stat-value" style="font-size: 1.25rem; color: #DC2626;">${failedStudentsCount}</div>
      </div>
      <div class="stat-card" style="padding: 0.75rem 1rem; border-left: 3px solid #2563EB;">
        <span class="stat-title" style="font-size: 0.75rem; color: #1E40AF;">Marks Records</span>
        <div class="stat-value" style="font-size: 1.25rem; color: #2563EB;">${marks.length}</div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
      <div style="flex: 2; min-width: 220px;">
        <input type="text" id="marks-search-input" class="form-control" placeholder="Search student by name or admission number..." style="font-size: 0.85rem;" />
      </div>
      <div style="flex: 1; min-width: 140px;">
        <select id="marks-class-filter" class="form-control" style="font-size: 0.85rem;">
          <option value="All">All Classes</option>
          <option value="STD-I">Class STD-I</option>
          <option value="STD-II">Class STD-II</option>
          <option value="STD-III">Class STD-III</option>
          <option value="STD-IV">Class STD-IV</option>
          <option value="STD-V">Class STD-V</option>
          <option value="STD-VI">Class STD-VI</option>
          <option value="STD-VII">Class STD-VII</option>
          <option value="STD-VIII">Class STD-VIII</option>
          <option value="STD-IX">Class STD-IX</option>
          <option value="STD-X">Class STD-X</option>
        </select>
      </div>
      <div style="flex: 1; min-width: 140px;">
        <select id="marks-status-filter" class="form-control" style="font-size: 0.85rem;">
          <option value="All">All Status (Pass/Fail)</option>
          <option value="Pass">Pass Only</option>
          <option value="Fail">Fail Only</option>
        </select>
      </div>
    </div>

    <!-- Marks Master Evaluation Sheet -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3>Class Marks & Grade Evaluation Sheet</h3>
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            Evaluation scores with automated Pass/Fail thresholds and Class Ranks
          </span>
        </div>
        <span class="badge badge-active" id="marks-table-count">${marks.length} Records</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No</th>
                <th>Subject</th>
                <th>Theory</th>
                <th>Practical</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Pass / Fail</th>
                <th>Class Rank</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="marks-table-body">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Draw Table Rows
  function drawMarksTable() {
    const tbody = container.querySelector('#marks-table-body');
    const countEl = container.querySelector('#marks-table-count');
    if (!tbody) return;

    const query = container.querySelector('#marks-search-input')?.value.toLowerCase().trim() || '';
    const classFilter = container.querySelector('#marks-class-filter')?.value || 'All';
    const statusFilter = container.querySelector('#marks-status-filter')?.value || 'All';

    let filteredMarks = marks.filter(m => {
      const st = allStudents.find(s => s.id === m.student_id);
      if (!st) return false;
      if (isParentOrStudent && !parentChildIds.includes(st.id)) return false;
      if (classFilter !== 'All' && st.school_class !== classFilter) return false;

      const subDef = examSubjects.find(s => s.subject === m.subject);
      const subPass = Number(subDef?.passing_marks) || passingThreshold;
      const isPass = (Number(m.total) || 0) >= subPass;
      if (statusFilter === 'Pass' && !isPass) return false;
      if (statusFilter === 'Fail' && isPass) return false;

      if (query) {
        const matchName = st.full_name?.toLowerCase().includes(query);
        const matchAdm = st.admission_number?.toLowerCase().includes(query);
        const matchSub = m.subject?.toLowerCase().includes(query);
        return matchName || matchAdm || matchSub;
      }
      return true;
    });

    if (countEl) countEl.textContent = `${filteredMarks.length} Records`;

    if (filteredMarks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
            No student marks found matching criteria. ${!isViewOnly && !isParentOrStudent ? 'Click "+ Enter / Edit Marks" above to log scores.' : ''}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredMarks.map(m => {
      const st = allStudents.find(s => s.id === m.student_id);
      const subDef = examSubjects.find(s => s.subject === m.subject);
      const subMax = Number(subDef?.max_marks) || examMaxMarks;
      const subPass = Number(subDef?.passing_marks) || passingThreshold;
      const totalScore = Number(m.total) || 0;

      const { grade, pass_status } = calculateGrade(totalScore, subMax, subPass);
      const studentRank = rankMap[m.student_id];
      const hasRanksPublished = activeExam.publish_ranks !== false;

      let rankBadge = `<span style="color: #94A3B8; font-size: 0.74rem;">—</span>`;
      if (studentRank) {
        if (!hasRanksPublished && isParentOrStudent) {
          rankBadge = `<span style="font-size: 0.72rem; color: #94A3B8;">Hidden</span>`;
        } else if (studentRank === 1) {
          rankBadge = `<span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-weight: 800;">🏆 Rank #1</span>`;
        } else if (studentRank === 2) {
          rankBadge = `<span class="badge" style="background: #F1F5F9; color: #334155; border: 1px solid #CBD5E1; font-weight: 800;">🥈 Rank #2</span>`;
        } else if (studentRank === 3) {
          rankBadge = `<span class="badge" style="background: #FFF7ED; color: #9A3412; border: 1px solid #FFEDD5; font-weight: 800;">🥉 Rank #3</span>`;
        } else {
          rankBadge = `<span class="badge" style="background: #F8FAFC; color: #475569; border: 1px solid #E2E8F0; font-weight: 700;">Rank #${studentRank}</span>`;
        }
      }

      return `
        <tr>
          <td>
            <strong style="color: #0F172A;">${st?.full_name || 'Student'}</strong>
            <div style="font-size: 0.72rem; color: #64748B;">${st?.school_class || 'Class'} (${st?.school_section || 'A'})</div>
          </td>
          <td><code>${st?.admission_number || '—'}</code></td>
          <td><strong>${m.subject}</strong></td>
          <td>${m.theory !== undefined ? m.theory : '—'}</td>
          <td>${m.practical !== undefined ? m.practical : '—'}</td>
          <td>
            <strong style="font-size: 0.95rem; color: ${pass_status === 'Pass' ? '#059669' : '#DC2626'};">
              ${totalScore}
            </strong>
            <span style="font-size: 0.7rem; color: #94A3B8;">/${subMax}</span>
          </td>
          <td>
            <span class="badge ${grade === 'F' ? 'badge-danger' : 'badge-active'}">${grade}</span>
          </td>
          <td>
            <span class="badge ${pass_status === 'Pass' ? 'badge-present' : 'badge-danger'}" style="font-weight: 800; font-size: 0.72rem;">
              ${pass_status === 'Pass' ? '✓ Pass' : '✕ Fail'}
            </span>
          </td>
          <td>${rankBadge}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              ${!isViewOnly && !isParentOrStudent ? `
                <button class="btn btn-outline btn-sm btn-edit-single-mark" data-student-id="${m.student_id}" data-subject="${m.subject}" title="Edit marks for this student">
                  Edit
                </button>
              ` : ''}
              <button class="btn btn-outline btn-sm btn-print-report-card" data-student-id="${m.student_id}" title="View official student report card">
                Card
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Listeners for Edit & Report Card
    tbody.querySelectorAll('.btn-edit-single-mark').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        openEnterMarksModal(activeExam, examSubjects, allStudents, studentId, async () => {
          renderMarksModule(container, { onNavigate });
        });
      });
    });

    tbody.querySelectorAll('.btn-print-report-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-student-id');
        showReportCardModal(sid, activeExam, examSubjects, allStudents, marks, rankMap);
      });
    });
  }

  drawMarksTable();

  // Search & Filter listeners
  container.querySelector('#marks-search-input')?.addEventListener('input', drawMarksTable);
  container.querySelector('#marks-class-filter')?.addEventListener('change', drawMarksTable);
  container.querySelector('#marks-status-filter')?.addEventListener('change', drawMarksTable);

  // Switch Exam listener
  container.querySelector('#marks-exam-select')?.addEventListener('change', (e) => {
    sessionStorage.setItem('tps_active_exam_id', e.target.value);
    renderMarksModule(container, { onNavigate });
  });

  // Enter Marks Dialog
  container.querySelector('#btn-enter-marks-dialog')?.addEventListener('click', () => {
    openEnterMarksModal(activeExam, examSubjects, allStudents, null, async () => {
      renderMarksModule(container, { onNavigate });
    });
  });

  // Publish Window Dialog
  container.querySelector('#btn-manage-publish-window')?.addEventListener('click', () => {
    openPublishConfigModal(activeExam, async () => {
      renderMarksModule(container, { onNavigate });
    });
  });

  // Export to Excel
  container.querySelector('#btn-export-marks')?.addEventListener('click', () => {
    const exportData = marks.map(m => {
      const st = allStudents.find(s => s.id === m.student_id);
      const subDef = examSubjects.find(s => s.subject === m.subject);
      const subMax = Number(subDef?.max_marks) || examMaxMarks;
      const subPass = Number(subDef?.passing_marks) || passingThreshold;
      const { grade, pass_status } = calculateGrade(m.total, subMax, subPass);
      const rank = rankMap[m.student_id] || '';

      return {
        'Admission No': st?.admission_number || '',
        'Student Name': st?.full_name || '',
        'Class': st?.school_class || '',
        'Subject': m.subject,
        'Theory': m.theory,
        'Practical': m.practical,
        'Total Marks': m.total,
        'Max Marks': subMax,
        'Grade': grade,
        'Pass / Fail': pass_status,
        'Class Rank': rank ? `#${rank}` : '',
        'Status': m.status
      };
    });
    exportToExcel(`TPS_${activeExam.title.replace(/\s+/g, '_')}_Marks`, exportData, 'Marks');
    toast.success('Marks evaluation sheet exported to Excel.');
  });
}

/**
 * Interactive Modal to Enter / Edit Student Marks with Live Pass/Fail & Grade Calculation
 */
function openEnterMarksModal(activeExam, examSubjects, allStudents, preselectedStudentId = null, onSaved = () => {}) {
  let selectedStudentId = preselectedStudentId || allStudents[0]?.id;

  openModal({
    title: `Enter Student Examination Marks — ${activeExam.title}`,
    size: 'lg',
    contentHtml: `
      <div style="max-height: 75vh; overflow-y: auto; padding-right: 4px;">
        <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <label class="form-label required" style="font-weight: 800; color: #0F172A; font-size: 0.9rem;">
            Select Student to Evaluate
          </label>
          <select id="modal-select-student" class="form-control" style="font-size: 0.9rem; font-weight: 700; background: #FFFFFF;">
            ${allStudents.map(s => `
              <option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>
                ${s.full_name} (${s.admission_number}) — Class: ${s.school_class || 'STD-V'}
              </option>
            `).join('')}
          </select>
          <div style="font-size: 0.74rem; color: #64748B; margin-top: 4px;">
            Exam Rules: <strong>Pass Threshold ≥ ${activeExam.passing_marks || 40}</strong> • Max Subject Marks: ${activeExam.max_marks || 100}
          </div>
        </div>

        <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
          <h4 style="font-size: 0.9rem; font-weight: 800; color: #0F172A; margin: 0 0 0.85rem 0;">
            Subject Marks Input & Live Grading
          </h4>
          <div id="modal-subjects-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Generated dynamically -->
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid #E2E8F0; padding-top: 1rem; margin-top: 1rem;">
        <button class="btn btn-outline" id="btn-cancel-marks-modal">Cancel</button>
        <button class="btn btn-primary" id="btn-save-student-marks" style="font-weight: 700; padding: 0.55rem 1.5rem;">
          Save Student Marks
        </button>
      </div>
    `,
    onMount: async ({ container: modalBody, close }) => {
      const allExistingMarks = await db.getMarks(activeExam.id);

      function renderSubjectsInputs() {
        const formContainer = modalBody.querySelector('#modal-subjects-form');
        if (!formContainer) return;

        const currentStudentMarks = allExistingMarks.filter(m => m.student_id === selectedStudentId);

        formContainer.innerHTML = examSubjects.map(sub => {
          const existing = currentStudentMarks.find(m => m.subject === sub.subject);
          const theoryVal = existing?.theory !== undefined ? existing.theory : 0;
          const practicalVal = existing?.practical !== undefined ? existing.practical : 0;
          const totalVal = existing?.total !== undefined ? existing.total : (Number(theoryVal) + Number(practicalVal));

          const subMax = Number(sub.max_marks) || Number(activeExam.max_marks) || 100;
          const subPass = Number(sub.passing_marks) || Number(activeExam.passing_marks) || 40;
          const theoryMax = Number(sub.theory_max) || Number(activeExam.theory_max) || 80;
          const practicalMax = Number(sub.practical_max) || Number(activeExam.practical_max) || 20;

          const { grade, pass_status } = calculateGrade(totalVal, subMax, subPass);

          return `
            <div class="sub-input-row" data-subject="${sub.subject}" data-max="${subMax}" data-pass="${subPass}" style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0.75rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
                <div>
                  <strong style="color: #0F172A; font-size: 0.9rem;">${sub.subject}</strong>
                  <span style="font-size: 0.72rem; color: #64748B; margin-left: 6px;">(Max: ${subMax} • Pass: ≥${subPass})</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                  <span class="sub-grade-badge badge ${grade === 'F' ? 'badge-danger' : 'badge-active'}" style="font-size: 0.75rem;">
                    ${grade}
                  </span>
                  <span class="sub-pass-badge badge ${pass_status === 'Pass' ? 'badge-present' : 'badge-danger'}" style="font-weight: 800; font-size: 0.72rem;">
                    ${pass_status === 'Pass' ? '✓ Pass' : '✕ Fail'}
                  </span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; align-items: center;">
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">
                    Theory (/ ${theoryMax})
                  </label>
                  <input type="number" class="form-control sub-theory-input" value="${theoryVal}" min="0" max="${theoryMax}" style="font-size: 0.85rem;" />
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">
                    Practical (/ ${practicalMax})
                  </label>
                  <input type="number" class="form-control sub-practical-input" value="${practicalVal}" min="0" max="${practicalMax}" style="font-size: 0.85rem;" />
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">
                    Total (/ ${subMax})
                  </label>
                  <div class="sub-total-display" style="font-size: 1.05rem; font-weight: 800; color: ${pass_status === 'Pass' ? '#059669' : '#DC2626'}; padding: 0.35rem 0.5rem; background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 6px; text-align: center;">
                    ${totalVal}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Wire live input calculations
        formContainer.querySelectorAll('.sub-input-row').forEach(row => {
          const theoryInput = row.querySelector('.sub-theory-input');
          const practicalInput = row.querySelector('.sub-practical-input');
          const totalDisplay = row.querySelector('.sub-total-display');
          const gradeBadge = row.querySelector('.sub-grade-badge');
          const passBadge = row.querySelector('.sub-pass-badge');

          const subMax = Number(row.getAttribute('data-max')) || 100;
          const subPass = Number(row.getAttribute('data-pass')) || 40;

          const updateRow = () => {
            const tVal = Number(theoryInput.value) || 0;
            const pVal = Number(practicalInput.value) || 0;
            const total = tVal + pVal;
            totalDisplay.textContent = total;

            const { grade, pass_status } = calculateGrade(total, subMax, subPass);

            totalDisplay.style.color = pass_status === 'Pass' ? '#059669' : '#DC2626';
            gradeBadge.textContent = grade;
            gradeBadge.className = `sub-grade-badge badge ${grade === 'F' ? 'badge-danger' : 'badge-active'}`;
            passBadge.textContent = pass_status === 'Pass' ? '✓ Pass' : '✕ Fail';
            passBadge.className = `sub-pass-badge badge ${pass_status === 'Pass' ? 'badge-present' : 'badge-danger'}`;
          };

          theoryInput.addEventListener('input', updateRow);
          practicalInput.addEventListener('input', updateRow);
        });
      }

      renderSubjectsInputs();

      modalBody.querySelector('#modal-select-student')?.addEventListener('change', (e) => {
        selectedStudentId = e.target.value;
        renderSubjectsInputs();
      });

      modalBody.querySelector('#btn-cancel-marks-modal')?.addEventListener('click', close);

      modalBody.querySelector('#btn-save-student-marks')?.addEventListener('click', async () => {
        const rows = modalBody.querySelectorAll('.sub-input-row');
        const studentObj = allStudents.find(s => s.id === selectedStudentId);

        const newMarksArray = [];
        rows.forEach(row => {
          const subject = row.getAttribute('data-subject');
          const subMax = Number(row.getAttribute('data-max')) || 100;
          const subPass = Number(row.getAttribute('data-pass')) || 40;

          const tVal = Number(row.querySelector('.sub-theory-input').value) || 0;
          const pVal = Number(row.querySelector('.sub-practical-input').value) || 0;
          const total = tVal + pVal;

          const { grade, pass_status } = calculateGrade(total, subMax, subPass);

          newMarksArray.push({
            exam_id: activeExam.id,
            student_id: selectedStudentId,
            subject,
            theory: tVal,
            practical: pVal,
            total,
            grade,
            pass_status,
            status: activeExam.is_published ? 'Published' : 'Draft'
          });
        });

        await db.saveMarks(newMarksArray);
        toast.success(`Marks saved successfully for ${studentObj?.full_name || 'student'}.`);
        close();
        onSaved();
      });
    }
  });
}

/**
 * Modal to Configure Result Publication, Ranks, and Expiration Window
 */
function openPublishConfigModal(activeExam, onSaved = () => {}) {
  const defaultUntil = activeExam.publish_until || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16);

  openModal({
    title: `Publication Governance — ${activeExam.title}`,
    size: 'md',
    contentHtml: `
      <div style="margin-bottom: 1.25rem;">
        <p style="font-size: 0.85rem; color: #475569; margin-bottom: 1rem; line-height: 1.4;">
          Manage whether parents and students can view exam report cards, whether class rankings are public, and when results expire.
        </p>

        <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0.85rem; margin-bottom: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.88rem; font-weight: 800; color: #0F172A; margin: 0;">
            <input type="checkbox" id="pub-status-checkbox" ${activeExam.is_published ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span>Publish Examination Results to Parents & Students</span>
          </label>
          <div style="font-size: 0.72rem; color: #64748B; margin-left: 28px; margin-top: 3px;">
            When checked, report cards and grades are visible in the Parent Portal.
          </div>
        </div>

        <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 10px; padding: 0.85rem; margin-bottom: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.88rem; font-weight: 800; color: #92400E; margin: 0;">
            <input type="checkbox" id="pub-ranks-checkbox" ${activeExam.publish_ranks !== false ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span>Publish Class Ranks (1st, 2nd, 3rd Rank)</span>
          </label>
          <div style="font-size: 0.72rem; color: #78350F; margin-left: 28px; margin-top: 3px;">
            Uncheck if you want parents to view marks and grades but keep class ranks confidential.
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required" style="font-weight: 800; color: #0F172A;">
            Display to Parents Until (Result Window Expiry)
          </label>
          <input type="datetime-local" id="pub-until-datetime" class="form-control" value="${defaultUntil}" />
          <div style="font-size: 0.74rem; color: #DC2626; font-weight: 700; margin-top: 5px;">
            ⏱ Automatic Expiry: When this date and time passes, this examination result will automatically be removed from parents' dashboards.
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button class="btn btn-outline" id="btn-cancel-pub-config">Cancel</button>
        <button class="btn btn-primary" id="btn-save-pub-config" style="font-weight: 700; background: #059669;">
          Save Publication Settings
        </button>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      modalBody.querySelector('#btn-cancel-pub-config')?.addEventListener('click', close);

      modalBody.querySelector('#btn-save-pub-config')?.addEventListener('click', async () => {
        const isPublished = modalBody.querySelector('#pub-status-checkbox').checked;
        const publishRanks = modalBody.querySelector('#pub-ranks-checkbox').checked;
        const publishUntil = modalBody.querySelector('#pub-until-datetime').value;

        if (isPublished) {
          await db.publishResults(activeExam.id, {
            publishRanks,
            publishUntil
          });
          toast.success(`Examination results published to parents.`);
        } else {
          await db.unpublishResults(activeExam.id);
          // Still save ranks and until preference
          await db.saveExam({
            ...activeExam,
            is_published: false,
            publish_ranks: publishRanks,
            publish_until: publishUntil
          });
          toast.info(`Results reverted to Draft.`);
        }

        close();
        onSaved();
      });
    }
  });
}

/**
 * Official Printable Report Card Modal
 */
function showReportCardModal(studentId, activeExam, examSubjects, allStudents, marks, rankMap) {
  const student = allStudents.find(s => s.id === studentId) || allStudents[0];
  const studentMarks = marks.filter(m => m.student_id === student.id);

  const passingThreshold = activeExam.passing_marks || 40;
  const examMaxMarks = activeExam.max_marks || 100;

  const totalMarksObtained = studentMarks.reduce((sum, m) => sum + (Number(m.total) || 0), 0);
  const maxPossibleMarks = studentMarks.reduce((sum, m) => {
    const subDef = examSubjects.find(s => s.subject === m.subject);
    return sum + (Number(subDef?.max_marks) || examMaxMarks);
  }, 0);

  const percentage = maxPossibleMarks > 0 ? ((totalMarksObtained / maxPossibleMarks) * 100).toFixed(1) : 0;
  const hasFailedSubject = studentMarks.some(m => {
    const subDef = examSubjects.find(s => s.subject === m.subject);
    const subPass = Number(subDef?.passing_marks) || passingThreshold;
    return (Number(m.total) || 0) < subPass;
  });

  const overallStatus = hasFailedSubject ? 'FAIL' : 'PASS';
  const studentRank = rankMap[student.id];
  const showRank = activeExam.publish_ranks !== false && studentRank;

  openModal({
    title: `Official Examination Report Card — ${student.full_name}`,
    size: 'lg',
    contentHtml: `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
        <button class="btn btn-primary" id="btn-print-report-card-doc" style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print Report Card (A4)
        </button>
      </div>

      <div id="report-card-printable" class="printable-card" style="background: #FFFFFF; border: 2px solid #0F172A; border-radius: 12px; padding: 24px; color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Institutional Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 18px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 56px; height: 56px; background: #059669; color: #FFFFFF; font-weight: 900; font-size: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              TPS
            </div>
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #0F172A; letter-spacing: -0.02em;">Thaiba Public School</h2>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">Modern Education with Morality • Affiliated Residential Campus</p>
              <div style="font-size: 11px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">
                Official Student Examination Performance Transcript
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; line-height: 1.4;">
            <div>Examination: <strong>${activeExam.title}</strong></div>
            <div>Class & Division: <strong>${student.school_class || 'STD-V'} (${student.school_section || 'A'})</strong></div>
            <div>Academic Year: <strong>2026-2027</strong></div>
          </div>
        </div>

        <!-- Student Biographical Information -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; font-size: 12px;">
          <div>
            <span style="color: #64748B; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Student Full Name</span>
            <strong style="color: #0F172A; font-size: 13px;">${student.full_name}</strong>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Admission Number</span>
            <strong style="color: #0F172A; font-family: monospace;">${student.admission_number}</strong>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Guardian / Father</span>
            <strong style="color: #0F172A;">${student.father_name || 'Guardian'}</strong>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Hostel Residence</span>
            <strong style="color: #0F172A;">${student.hostel_unit || 'Campus'} (${student.hostel_room || 'Room'})</strong>
          </div>
        </div>

        <!-- Subject Scores Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background: #F1F5F9; border-bottom: 2px solid #0F172A;">
              <th style="padding: 9px 12px; text-align: left;">Subject</th>
              <th style="padding: 9px 8px; text-align: center;">Max Marks</th>
              <th style="padding: 9px 8px; text-align: center;">Pass Mark</th>
              <th style="padding: 9px 8px; text-align: center;">Theory</th>
              <th style="padding: 9px 8px; text-align: center;">Practical</th>
              <th style="padding: 9px 8px; text-align: center;">Total Scored</th>
              <th style="padding: 9px 8px; text-align: center;">Grade</th>
              <th style="padding: 9px 8px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${studentMarks.map(m => {
              const subDef = examSubjects.find(s => s.subject === m.subject);
              const subMax = Number(subDef?.max_marks) || examMaxMarks;
              const subPass = Number(subDef?.passing_marks) || passingThreshold;
              const { grade, pass_status } = calculateGrade(m.total, subMax, subPass);

              return `
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="padding: 8px 12px; font-weight: 700;">${m.subject}</td>
                  <td style="padding: 8px; text-align: center;">${subMax}</td>
                  <td style="padding: 8px; text-align: center; color: #64748B;">${subPass}</td>
                  <td style="padding: 8px; text-align: center;">${m.theory !== undefined ? m.theory : '—'}</td>
                  <td style="padding: 8px; text-align: center;">${m.practical !== undefined ? m.practical : '—'}</td>
                  <td style="padding: 8px; text-align: center; font-weight: 800; font-size: 13px; color: ${pass_status === 'Pass' ? '#059669' : '#DC2626'};">
                    ${m.total}
                  </td>
                  <td style="padding: 8px; text-align: center; font-weight: 700;">${grade}</td>
                  <td style="padding: 8px; text-align: center;">
                    <span style="font-weight: 800; color: ${pass_status === 'Pass' ? '#059669' : '#DC2626'};">
                      ${pass_status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="8" style="text-align: center; padding: 1.5rem; color: #94A3B8;">No marks recorded yet for this student.</td></tr>'}
            <tr style="background: #F8FAFC; font-weight: 800; border-top: 2px solid #0F172A;">
              <td style="padding: 10px 12px; font-size: 13px;">Grand Total</td>
              <td style="padding: 10px; text-align: center;">${maxPossibleMarks}</td>
              <td colspan="3" style="padding: 10px; text-align: center; color: #64748B;">—</td>
              <td style="padding: 10px; text-align: center; font-size: 15px; color: ${overallStatus === 'PASS' ? '#059669' : '#DC2626'};">
                ${totalMarksObtained}
              </td>
              <td style="padding: 10px; text-align: center; font-size: 13px;">${percentage}%</td>
              <td style="padding: 10px; text-align: center;">
                <span style="padding: 3px 8px; border-radius: 4px; background: ${overallStatus === 'PASS' ? '#DCFCE7' : '#FEE2E2'}; color: ${overallStatus === 'PASS' ? '#166534' : '#991B1B'}; font-size: 12px; font-weight: 900;">
                  ${overallStatus}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Result Highlights & Rank Box -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span style="color: #64748B; font-weight: 600;">Overall Academic Status:</span>
            <strong style="color: ${overallStatus === 'PASS' ? '#059669' : '#DC2626'}; font-size: 13px; margin-left: 6px;">
              ${overallStatus === 'PASS' ? 'Passed with Distinction' : 'Needs Academic Improvement (Failed)'}
            </strong>
          </div>
          ${showRank ? `
            <div style="background: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; padding: 4px 12px; border-radius: 9999px; font-weight: 800;">
              🏆 Official Class Rank: #${studentRank}
            </div>
          ` : ''}
        </div>

        <!-- Remarks -->
        <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 12px 14px; border-radius: 8px; font-size: 12px; color: #065F46; margin-bottom: 32px; line-height: 1.45;">
          <strong>Institutional Moral & Academic Evaluation Remarks:</strong> Student demonstrates diligent participation in daily moral instructions, punctual attendance in hostel coaching, and steady scholastic commitment.
        </div>

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; font-size: 11px; color: #475569; text-align: center;">
          <div style="border-top: 1px dashed #94A3B8; width: 170px; padding-top: 6px;">Class Teacher Signature</div>
          <div style="border-top: 1px dashed #94A3B8; width: 170px; padding-top: 6px;">Moral Mentor Signature</div>
          <div style="border-top: 1px dashed #94A3B8; width: 170px; padding-top: 6px;">Principal / Controller of Exams</div>
        </div>
      </div>
    `,
    onMount: ({ container: modalBody }) => {
      modalBody.querySelector('#btn-print-report-card-doc')?.addEventListener('click', () => {
        printDocument('report-card-printable', `Report_Card_${student.admission_number}`);
      });
    }
  });
}
