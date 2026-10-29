import { db } from '../../lib/db.js';
import { formatCurrency, formatDate, printDocument } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderFinesModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const [students, leaves] = await Promise.all([
    db.getStudents(),
    db.getLeaves()
  ]);
  const payments = db.get('tps_fine_payments');

  // Filter leaves that have fine > 0
  const isParent = user?.role === 'parent';
  const allFineRecords = leaves.filter(l => (l.calculated_fine || 0) > 0);
  const displayFines = isParent
    ? allFineRecords.filter(l => {
        const st = students.find(s => s.id === l.student_id);
        return st?.father_phone === '+91 98470 11223' || st?.full_name === 'Muhammad Rayyan';
      })
    : allFineRecords;

  const totalAssessed = displayFines.reduce((sum, l) => sum + (l.calculated_fine || 0), 0);
  const totalPaid = displayFines.filter(l => l.fine_status === 'paid').reduce((sum, l) => sum + (l.calculated_fine || 0), 0);
  const totalUnpaid = displayFines.filter(l => l.fine_status === 'unpaid').reduce((sum, l) => sum + (l.calculated_fine || 0), 0);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Late-Return Fine Management Engine</h2>
        <p>Institutional calendar-day late return fine ledger, waiver authorizations, and receipt slips</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" id="btn-fine-policy-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Current Fine Policy
        </button>
      </div>
    </div>

    <!-- Fine Metrics Summary -->
    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Total Assessed Fines</span>
          <div class="stat-icon-wrapper" style="background: #F1F5F9; color: var(--text-primary);">₹</div>
        </div>
        <div class="stat-value">${formatCurrency(totalAssessed)}</div>
        <div class="stat-footer"><span>Historical total assessed</span></div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Unpaid Outstanding Fines</span>
          <div class="stat-icon-wrapper" style="background: #FEF2F2; color: #DC2626;">₹</div>
        </div>
        <div class="stat-value" style="color: #DC2626;">${formatCurrency(totalUnpaid)}</div>
        <div class="stat-footer"><span>Due for collection</span></div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Collected Fines</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">✓</div>
        </div>
        <div class="stat-value" style="color: #059669;">${formatCurrency(totalPaid)}</div>
        <div class="stat-footer"><span>Successfully deposited</span></div>
      </div>
    </div>

    <!-- Outstanding Fines Register -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Late-Return Fine Ledger</h3>
        <span class="badge badge-active">${displayFines.length} Fine Assessments</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Leave Reg</th>
                <th>Expected Date</th>
                <th>Actual Return</th>
                <th>Late Days</th>
                <th>Fine Rate</th>
                <th>Assessed Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayFines.map(l => {
                const st = students.find(s => s.id === l.student_id);
                const isPaid = l.fine_status === 'paid';
                const isWaived = l.fine_status === 'waived';
                const statusBadge = isPaid ? 'badge-present' : isWaived ? 'badge-leave' : 'badge-absent';

                return `
                  <tr>
                    <td>
                      <strong>${st?.full_name || 'Student'}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${st?.admission_number || ''}</div>
                    </td>
                    <td><code>${l.leave_register_number}</code></td>
                    <td>${formatDate(l.expected_return_date)}</td>
                    <td>${formatDate(l.actual_return_date || new Date().toISOString())}</td>
                    <td><strong>${l.late_days} Day(s)</strong></td>
                    <td>₹${l.fine_per_day_applied}/day</td>
                    <td><strong style="color: #DC2626; font-size: 1rem;">${formatCurrency(l.calculated_fine)}</strong></td>
                    <td><span class="badge ${statusBadge}">${l.fine_status.toUpperCase()}</span></td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-outline btn-sm btn-print-fine-slip" data-id="${l.id}">Slip</button>
                        ${!isPaid && !isWaived && (user?.is_super_admin || user?.role === 'admin' || user?.role === 'mentor') ? `
                          <button class="btn btn-primary btn-sm btn-collect-fine" data-id="${l.id}">Collect</button>
                          <button class="btn btn-outline btn-sm btn-waive-fine" data-id="${l.id}">Waive</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No late return fines on record</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Policy info popup
  container.querySelector('#btn-fine-policy-info')?.addEventListener('click', () => {
    openModal({
      title: 'Institutional Fine Policy Specification',
      contentHtml: `
        <div style="font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary);">
          <p style="margin-bottom: 0.75rem;">
            <strong>Default Institutional Rule:</strong> Late returns are assessed on a <strong>calendar date basis</strong>, not hours.
          </p>
          <div style="background: var(--bg-surface-subtle); padding: 1rem; border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 1rem;">
            Late Days = MAX(0, Actual Return Date − Expected Return Date)<br/>
            Late Fine = Late Days × Applicable Daily Rate (₹200.00)
          </div>
          <p>
            Returning on the expected calendar date incurs <strong>₹0.00 fine</strong>. Rate snapshot is permanently preserved upon departure to protect past audit integrity.
          </p>
        </div>
      `
    });
  });

  // Collect fine modal
  container.querySelectorAll('.btn-collect-fine').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const leave = displayFines.find(l => l.id === id);
      const student = students.find(s => s.id === leave?.student_id);

      openModal({
        title: `Collect Fine — ${student?.full_name}`,
        contentHtml: `
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label">Total Fine Assessed</label>
            <input type="text" class="form-control" value="${formatCurrency(leave.calculated_fine)}" disabled style="font-weight: 700; color: #DC2626;" />
          </div>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label required">Amount Paid (₹)</label>
            <input type="number" id="pay-amount" class="form-control" value="${leave.calculated_fine}" required />
          </div>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label required">Payment Method</label>
            <select id="pay-method" class="form-control">
              <option value="Cash">Cash at Hostel Office</option>
              <option value="UPI">UPI / Google Pay / PhonePe</option>
              <option value="Bank_Transfer">School Bank Transfer</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Transaction Reference No (Optional)</label>
            <input type="text" id="pay-ref" class="form-control" placeholder="UPI Reference or Bank Ref" />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-primary" id="btn-save-payment">Deposit & Generate Receipt</button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-save-payment').addEventListener('click', async () => {
            const amount = modalBody.querySelector('#pay-amount').value;
            const method = modalBody.querySelector('#pay-method').value;
            const ref = modalBody.querySelector('#pay-ref').value.trim();

            const p = await db.recordFinePayment(id, amount, method, ref);
            toast.success(`Payment recorded! Receipt No: ${p.receipt_number}`);
            close();
            renderFinesModule(container, { onNavigate });
          });
        }
      });
    });
  });

  // Waive fine modal
  container.querySelectorAll('.btn-waive-fine').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const leave = displayFines.find(l => l.id === id);
      const student = students.find(s => s.id === leave?.student_id);

      openModal({
        title: `Authorize Fine Waiver — ${student?.full_name}`,
        contentHtml: `
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Waivers require an authorized justification and are permanently recorded in the institutional audit log.
          </p>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label required">Official Waiver Reason</label>
            <textarea id="waiver-reason" class="form-control" rows="2" placeholder="e.g. Verified hospitalization / genuine transit cancellation"></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-primary" id="btn-confirm-waiver">Authorize Waiver</button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-confirm-waiver').addEventListener('click', async () => {
            const reason = modalBody.querySelector('#waiver-reason').value.trim();
            if (!reason) {
              toast.error('Please enter a justification for waiving the fine.');
              return;
            }

            leave.fine_status = 'waived';
            leave.fine_waiver_reason = reason;
            db.set('tps_leaves', leaves);
            db.logAudit('FINE_WAIVED', 'student_leave_records', id, `Fine waived: ${reason}`);

            toast.info('Fine marked as officially waived.');
            close();
            renderFinesModule(container, { onNavigate });
          });
        }
      });
    });
  });

  // Printable Late Fine Slip Modal
  container.querySelectorAll('.btn-print-fine-slip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const leave = displayFines.find(l => l.id === id);
      const student = students.find(s => s.id === leave?.student_id);

      openModal({
        title: 'Official Late-Return Fine Assessment Slip',
        size: 'md',
        contentHtml: `
          <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
            <button class="btn btn-primary" id="btn-print-fine-slip-a4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Fine Slip
            </button>
          </div>

          <div id="fine-slip-printable" class="printable-card">
            <div class="print-header">
              <div class="institution-logo" style="width: 44px; height: 44px; font-size: 18px;">TPS</div>
              <div class="print-title">
                <h2>Thaiba Public School</h2>
                <p>Hostel Return & Fine Clearance Slip</p>
              </div>
              <div style="font-size: 11px;">
                <div>Slip ID: <strong>FS-${leave.leave_register_number}</strong></div>
                <div>Status: <strong>${leave.fine_status.toUpperCase()}</strong></div>
              </div>
            </div>

            <div class="print-grid">
              <div class="print-field">
                <span class="print-label">Student Name</span>
                <span class="print-value">${student?.full_name}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Admission No</span>
                <span class="print-value">${student?.admission_number}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Expected Return</span>
                <span class="print-value">${formatDate(leave.expected_return_date)}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Actual Return</span>
                <span class="print-value">${formatDate(leave.actual_return_date || new Date().toISOString())}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Late Days Assessed</span>
                <span class="print-value">${leave.late_days} Calendar Day(s)</span>
              </div>
              <div class="print-field">
                <span class="print-label">Fine Per Day</span>
                <span class="print-value">₹${leave.fine_per_day_applied}</span>
              </div>
              <div class="print-field" style="grid-column: span 2; background: #F1F5F9; padding: 12px; border-radius: 6px;">
                <span class="print-label">Total Fine Payable</span>
                <span class="print-value" style="font-size: 18px; color: #DC2626;">${formatCurrency(leave.calculated_fine)}</span>
              </div>
            </div>

            <div class="print-signatures" style="margin-top: 36px;">
              <div class="signature-line">Student Signature</div>
              <div class="signature-line">Hostel Warden / Cashier</div>
            </div>
          </div>
        `,
        onMount: ({ container: modalBody }) => {
          modalBody.querySelector('#btn-print-fine-slip-a4').addEventListener('click', () => {
            printDocument('fine-slip-printable', `Fine_Slip_${leave.leave_register_number}`);
          });
        }
      });
    });
  });
}
