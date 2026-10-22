import { db } from '../../lib/db.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderFeesModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const students = await db.getStudents();

  const invoices = [
    { id: 'inv-1', invoice_number: 'INV-2026-001', student_id: 's-101', fee_type: 'Monthly Hostel Boarding & Mess', amount_due: 4500, amount_paid: 4500, status: 'Paid', due_date: '2026-10-10' },
    { id: 'inv-2', invoice_number: 'INV-2026-002', student_id: 's-102', fee_type: 'Monthly Hostel Boarding & Mess', amount_due: 4500, amount_paid: 4500, status: 'Paid', due_date: '2026-10-10' },
    { id: 'inv-3', invoice_number: 'INV-2026-003', student_id: 's-103', fee_type: 'Monthly Hostel Boarding & Mess', amount_due: 4500, amount_paid: 2000, status: 'Partially_Paid', due_date: '2026-10-10' },
    { id: 'inv-4', invoice_number: 'INV-2026-004', student_id: 's-104', fee_type: 'Monthly Hostel Boarding & Mess', amount_due: 4500, amount_paid: 0, status: 'Unpaid', due_date: '2026-10-10' }
  ];

  const isParent = user?.role === 'parent';
  const displayInvoices = isParent
    ? invoices.filter(i => i.student_id === 's-101')
    : invoices;

  const totalBilled = displayInvoices.reduce((sum, i) => sum + i.amount_due, 0);
  const totalCollected = displayInvoices.reduce((sum, i) => sum + i.amount_paid, 0);
  const totalOutstanding = totalBilled - totalCollected;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Hostel Fees & Payments Ledger</h2>
        <p>Monthly boarding fee invoices, payment receipts, and outstanding balance tracking</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-primary" id="btn-generate-invoices">Generate Monthly Billing</button>
        ` : ''}
      </div>
    </div>

    <!-- Fee Metrics Grid -->
    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Total Invoiced</span>
          <div class="stat-icon-wrapper" style="background: #F1F5F9; color: var(--text-primary);">₹</div>
        </div>
        <div class="stat-value">${formatCurrency(totalBilled)}</div>
        <div class="stat-footer"><span>Current billing cycle</span></div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Fee Collected</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">✓</div>
        </div>
        <div class="stat-value" style="color: #059669;">${formatCurrency(totalCollected)}</div>
        <div class="stat-footer"><span>Deposited</span></div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Outstanding Due</span>
          <div class="stat-icon-wrapper" style="background: #FEF2F2; color: #DC2626;">!</div>
        </div>
        <div class="stat-value" style="color: #DC2626;">${formatCurrency(totalOutstanding)}</div>
        <div class="stat-footer"><span>Pending payment</span></div>
      </div>
    </div>

    <!-- Invoices Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Fee Invoices & Payment Register</h3>
        <span class="badge badge-active">${displayInvoices.length} Invoices</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Student</th>
                <th>Fee Description</th>
                <th>Due Date</th>
                <th>Amount Due</th>
                <th>Amount Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayInvoices.map(inv => {
                const st = students.find(s => s.id === inv.student_id);
                const balance = inv.amount_due - inv.amount_paid;
                const statusBadge = inv.status === 'Paid' ? 'badge-present' : inv.status === 'Partially_Paid' ? 'badge-late' : 'badge-absent';

                return `
                  <tr>
                    <td><code>${inv.invoice_number}</code></td>
                    <td>
                      <strong>${st?.full_name || 'Student'}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${st?.admission_number || ''}</div>
                    </td>
                    <td>${inv.fee_type}</td>
                    <td>${formatDate(inv.due_date)}</td>
                    <td>${formatCurrency(inv.amount_due)}</td>
                    <td style="color: #059669; font-weight: 600;">${formatCurrency(inv.amount_paid)}</td>
                    <td><strong style="color: ${balance > 0 ? '#DC2626' : '#059669'};">${formatCurrency(balance)}</strong></td>
                    <td><span class="badge ${statusBadge}">${inv.status.replace('_', ' ')}</span></td>
                    <td>
                      ${balance > 0 && (user?.is_super_admin || user?.role === 'admin') ? `
                        <button class="btn btn-primary btn-sm btn-pay-fee" data-id="${inv.id}">Pay</button>
                      ` : '<span style="font-size: 0.75rem; color: var(--text-muted);">Cleared</span>'}
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

  container.querySelector('#btn-generate-invoices')?.addEventListener('click', () => {
    toast.success('Generated billing invoices for the current month.');
  });
}
