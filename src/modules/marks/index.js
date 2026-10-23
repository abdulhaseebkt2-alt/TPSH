import { db } from '../../lib/db.js';
import { printDocument, exportToExcel } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderMarksModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const exams = await db.getExams();
  const examSubjects = await db.getExamSubjects();
  const students = await db.getStudents();
  const activeExam = exams[0];

  const marks = await db.getMarks(activeExam?.id);

  const isParent = user?.role === 'parent';
  const isStudent = user?.role === 'student';

  // Security rule: Parents and students can only view published marks for their child
  if ((isParent || isStudent) && !activeExam?.is_published) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon" style="color: #64748B; display: flex; justify-content: center; margin-bottom: 1rem;">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h4>Results Not Published</h4>
        <p>Examination results for <strong>${activeExam?.title || 'Current Exam'}</strong> have not been published by the academic administration yet. Please check back later.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Marks Entry, Grade Calculation & Report Cards</h2>
        <p>Subject evaluation, passing thresholds, weighted components, and official student report cards</p>
      </div>
      <div class="page-actions">
        ${!isParent && !isStudent ? `
          <button class="btn btn-outline" id="btn-export-marks">Export Results (.xlsx)</button>
          ${!activeExam?.is_published && (user?.is_super_admin || user?.role === 'admin') ? `
            <button class="btn btn-primary" id="btn-publish-results">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Publish Results to Parents
            </button>
          ` : '<span class="badge badge-present" style="font-size: 0.85rem; padding: 0.5rem 0.85rem;">✓ Results Published to Parents</span>'}
        ` : ''}
      </div>
    </div>

    <!-- Active Examination Banner -->
    <div class="card-panel" style="margin-bottom: 1.5rem;">
      <div class="card-panel-body" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 800;">${activeExam?.title || 'Mid-Term Examination'}</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">Grading Standard: CBSE 8-Point Scale • Passing Threshold: 40%</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span class="badge ${activeExam?.is_published ? 'badge-present' : 'badge-pending'}">
            ${activeExam?.is_published ? 'Published' : 'Draft / Moderation'}
          </span>
        </div>
      </div>
    </div>

    <!-- Marks Spreadsheet / Results Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Class Marks Evaluation Sheet</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted);">STD-V-A Master Roster</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No</th>
                <th>Subject</th>
                <th>Theory (/80)</th>
                <th>Practical (/20)</th>
                <th>Total (/100)</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Report Card</th>
              </tr>
            </thead>
            <tbody id="marks-table-body">
              ${marks.map(m => {
                const st = students.find(s => s.id === m.student_id);
                // If parent, only show child
                if (isParent && st?.full_name !== 'Muhammad Rayyan') return '';

                return `
                  <tr>
                    <td>
                      <strong>${st?.full_name || 'Rayyan Ahmad'}</strong>
                    </td>
                    <td><code>${st?.admission_number || 'TPS-2026-001'}</code></td>
                    <td><strong>${m.subject}</strong></td>
                    <td>${m.theory}</td>
                    <td>${m.practical}</td>
                    <td><strong style="color: #059669; font-size: 1rem;">${m.total}</strong></td>
                    <td><span class="badge badge-active">${m.grade}</span></td>
                    <td><span class="badge ${m.status === 'Published' ? 'badge-present' : 'badge-pending'}">${m.status}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm btn-print-report-card" data-student-id="${m.student_id}">View Card</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Publish results handler
  container.querySelector('#btn-publish-results')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Publish Results to Parents & Students',
      message: 'Publishing results will make report cards, aggregate scores, and rankings visible to parents and students in their dashboards.',
      confirmText: 'Publish Results Now'
    });

    if (confirmed) {
      await db.publishResults(activeExam.id);
      toast.success('Examination results officially published!');
      renderMarksModule(container, { onNavigate });
    }
  });

  // Export marks spreadsheet
  container.querySelector('#btn-export-marks')?.addEventListener('click', () => {
    const exportData = marks.map(m => {
      const st = students.find(s => s.id === m.student_id);
      return {
        'Admission No': st?.admission_number || '',
        'Student Name': st?.full_name || '',
        'Subject': m.subject,
        'Theory (80)': m.theory,
        'Practical (20)': m.practical,
        'Total (100)': m.total,
        'Grade': m.grade,
        'Status': m.status
      };
    });
    exportToExcel('TPS_Exam_Results_Sheet', exportData, 'Marks');
    toast.success('Marks sheet exported to Excel.');
  });

  // Printable Report Card Modal
  container.querySelectorAll('.btn-print-report-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.getAttribute('data-student-id');
      const student = students.find(s => s.id === sid) || students[0];
      const studentMarks = marks.filter(m => m.student_id === student.id);

      const totalMarksObtained = studentMarks.reduce((sum, m) => sum + m.total, 0);
      const maxPossibleMarks = studentMarks.length * 100;
      const percentage = maxPossibleMarks > 0 ? ((totalMarksObtained / maxPossibleMarks) * 100).toFixed(1) : 0;

      openModal({
        title: `Official Examination Report Card — ${student.full_name}`,
        size: 'lg',
        contentHtml: `
          <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
            <button class="btn btn-primary" id="btn-print-report-card-doc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Report Card (A4)
            </button>
          </div>

          <div id="report-card-printable" class="printable-card">
            <div class="print-header">
              <div class="institution-logo" style="width: 50px; height: 50px; font-size: 22px;">TPS</div>
              <div class="print-title">
                <h2>Thaiba Public School</h2>
                <p>Modern Education with Morality • Affiliated Institutional Campus</p>
                <div class="print-doc-name">Student Performance Report Card</div>
              </div>
              <div style="text-align: right; font-size: 11px;">
                <div>Exam: <strong>${activeExam?.title || 'Mid-Term 2026'}</strong></div>
                <div>Class: <strong>${student.school_class} (${student.school_section})</strong></div>
              </div>
            </div>

            <div class="print-grid" style="margin-bottom: 16px;">
              <div class="print-field">
                <span class="print-label">Student Full Name</span>
                <span class="print-value">${student.full_name}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Admission Number</span>
                <span class="print-value">${student.admission_number}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Father's Name</span>
                <span class="print-value">${student.father_name}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Hostel Residence</span>
                <span class="print-value">${student.hostel_unit} (${student.hostel_room})</span>
              </div>
            </div>

            <!-- Subject-wise Score Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
              <thead>
                <tr style="background: #F1F5F9; border-bottom: 2px solid #0F172A;">
                  <th style="padding: 8px; text-align: left;">Subject</th>
                  <th style="padding: 8px; text-align: center;">Max Marks</th>
                  <th style="padding: 8px; text-align: center;">Theory</th>
                  <th style="padding: 8px; text-align: center;">Practical</th>
                  <th style="padding: 8px; text-align: center;">Total</th>
                  <th style="padding: 8px; text-align: center;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${studentMarks.map(m => `
                  <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 8px; font-weight: 600;">${m.subject}</td>
                    <td style="padding: 8px; text-align: center;">100</td>
                    <td style="padding: 8px; text-align: center;">${m.theory}</td>
                    <td style="padding: 8px; text-align: center;">${m.practical}</td>
                    <td style="padding: 8px; text-align: center; font-weight: 700; color: #059669;">${m.total}</td>
                    <td style="padding: 8px; text-align: center; font-weight: 700;">${m.grade}</td>
                  </tr>
                `).join('')}
                <tr style="background: #F8FAFC; font-weight: 800; border-top: 2px solid #0F172A;">
                  <td style="padding: 10px;">Grand Total</td>
                  <td style="padding: 10px; text-align: center;">${maxPossibleMarks}</td>
                  <td colspan="2" style="padding: 10px; text-align: center;">—</td>
                  <td style="padding: 10px; text-align: center; font-size: 15px; color: #059669;">${totalMarksObtained}</td>
                  <td style="padding: 10px; text-align: center; font-size: 14px;">${percentage}% (Rank 1)</td>
                </tr>
              </tbody>
            </table>

            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 12px; border-radius: 6px; font-size: 12px; color: #065F46; margin-bottom: 24px;">
              <strong>Academic & Moral Evaluation Remarks:</strong> Student displays outstanding moral etiquette in hostel prayers and high academic competence in Arabic and Mathematics.
            </div>

            <div class="print-signatures">
              <div class="signature-line">Class Teacher Signature</div>
              <div class="signature-line">Moral Mentor Signature</div>
              <div class="signature-line">Principal / Controller of Exams</div>
            </div>
          </div>
        `,
        onMount: ({ container: modalBody }) => {
          modalBody.querySelector('#btn-print-report-card-doc').addEventListener('click', () => {
            printDocument('report-card-printable', `Report_Card_${student.admission_number}`);
          });
        }
      });
    });
  });
}
