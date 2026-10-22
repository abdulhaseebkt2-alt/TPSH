import { db } from '../../lib/db.js';
import { formatDate, formatTime, formatCurrency, printDocument } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderLeavesModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const students = await db.getStudents();
  const leaves = await db.getLeaves();

  const isParent = user?.role === 'parent';
  const displayLeaves = isParent
    ? leaves.filter(l => {
        const st = students.find(s => s.id === l.student_id);
        return st?.father_phone === '+91 98470 11223' || st?.full_name === 'Muhammad Rayyan';
      })
    : leaves;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Hostel Leave & Return Register</h2>
        <p>Manage Group Leave (Type A), Individual Leave (Type B), gate departures, and return entry</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' || user?.role === 'mentor' ? `
          <button class="btn btn-secondary" id="btn-group-leave">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Type A: Group Leave
          </button>
          <button class="btn btn-primary" id="btn-individual-leave">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            Type B: Individual Leave
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Active Leaves Register Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Hostel Leave & Entry/Exit Registry</h3>
        <span class="badge badge-active">${displayLeaves.length} Total Registered Leaves</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Leave Reg No</th>
                <th>Leave Type</th>
                <th>Departure</th>
                <th>Expected Return</th>
                <th>Actual Return</th>
                <th>Late Days & Fine</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayLeaves.map(l => {
                const st = students.find(s => s.id === l.student_id);
                const isOverdue = l.status === 'Overdue';
                const isReturned = l.status === 'Returned';
                const fineBadge = l.calculated_fine > 0 ? (l.fine_status === 'paid' ? 'badge-present' : 'badge-absent') : 'badge-active';

                return `
                  <tr>
                    <td>
                      <strong>${st?.full_name || 'Student'}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${st?.admission_number || ''} • ${st?.school_class || ''}</div>
                    </td>
                    <td><code>${l.leave_register_number}</code></td>
                    <td><span class="badge badge-leave">${l.leave_type.toUpperCase()}</span></td>
                    <td>
                      <div>${formatDate(l.departure_date)}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${formatTime(l.departure_time)}</div>
                    </td>
                    <td>
                      <div>${formatDate(l.expected_return_date)}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${formatTime(l.expected_return_time)}</div>
                    </td>
                    <td>
                      ${l.actual_return_date ? `
                        <div>${formatDate(l.actual_return_date)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${formatTime(l.actual_return_time)}</div>
                      ` : '<span style="color: var(--text-muted);">Away</span>'}
                    </td>
                    <td>
                      ${l.calculated_fine > 0 ? `
                        <div style="font-weight: 700; color: #DC2626;">${formatCurrency(l.calculated_fine)}</div>
                        <span class="badge ${fineBadge}" style="font-size: 0.65rem;">${l.fine_status.toUpperCase()} (${l.late_days}d)</span>
                      ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">No Fine (0d)</span>'}
                    </td>
                    <td>
                      <span class="badge ${isOverdue ? 'badge-absent' : isReturned ? 'badge-present' : 'badge-late'}">${l.status}</span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-outline btn-sm btn-view-leave-card" data-id="${l.id}">Leave Card</button>
                        ${!isReturned && (user?.is_super_admin || user?.role === 'admin' || user?.role === 'mentor') ? `
                          <button class="btn btn-primary btn-sm btn-checkin-return" data-id="${l.id}">Record Return</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No leave records found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Type A: Group Leave Modal
  container.querySelector('#btn-group-leave')?.addEventListener('click', () => {
    openModal({
      title: 'Type A: Group Hostel Leave (Vacation / Eid / Holiday)',
      size: 'lg',
      contentHtml: `
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Departure Date & Time</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="date" id="grp-dep-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
              <input type="time" id="grp-dep-time" class="form-control" value="08:00" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label required">Expected Return Date & Time</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="date" id="grp-ret-date" class="form-control" value="${new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0]}" required />
              <input type="time" id="grp-ret-time" class="form-control" value="18:00" required />
            </div>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Common Reason</label>
          <input type="text" id="grp-reason" class="form-control" placeholder="e.g. Annual Term Break / Institutional Vacation" value="Term Holiday" required />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Select Students Departing for Group Leave</label>
          <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 0.75rem; background: var(--bg-surface);">
            ${students.map(s => `
              <label style="display: flex; align-items: center; gap: 0.65rem; padding: 0.35rem 0; font-size: 0.85rem; cursor: pointer;">
                <input type="checkbox" name="grp-student" value="${s.id}" checked />
                <strong>${s.full_name}</strong> (${s.admission_number}) — ${s.school_class} [${s.hostel_unit || 'Hostel'}]
              </label>
            `).join('')}
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-group-leave">Submit Group Leave Register</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-group-leave').addEventListener('click', async () => {
          const depDate = modalBody.querySelector('#grp-dep-date').value;
          const depTime = modalBody.querySelector('#grp-dep-time').value;
          const retDate = modalBody.querySelector('#grp-ret-date').value;
          const retTime = modalBody.querySelector('#grp-ret-time').value;
          const reason = modalBody.querySelector('#grp-reason').value.trim();

          const selectedSids = Array.from(modalBody.querySelectorAll('input[name="grp-student"]:checked')).map(cb => cb.value);

          if (selectedSids.length === 0) {
            toast.error('Please select at least one student for group leave.');
            return;
          }

          await db.createLeaveRecord({
            student_ids: selectedSids,
            leave_type: 'group',
            departure_date: depDate,
            departure_time: depTime,
            expected_return_date: retDate,
            expected_return_time: retTime,
            reason: reason || 'Group Hostel Holiday',
            approved_by: user?.full_name || 'Warden'
          });

          toast.success(`Group leave created for ${selectedSids.length} students! Individual leave cards generated.`);
          close();
          renderLeavesModule(container, { onNavigate });
        });
      }
    });
  });

  // Type B: Individual Leave Modal
  container.querySelector('#btn-individual-leave')?.addEventListener('click', () => {
    openModal({
      title: 'Type B: Individual Student Hostel Leave',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Student</label>
          <select id="ind-student" class="form-control">
            ${students.map(s => `<option value="${s.id}">${s.full_name} (${s.admission_number}) — ${s.school_class}</option>`).join('')}
          </select>
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Departure Date & Time</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="date" id="ind-dep-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
              <input type="time" id="ind-dep-time" class="form-control" value="09:00" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label required">Expected Return Date & Time</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="date" id="ind-ret-date" class="form-control" value="${new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0]}" required />
              <input type="time" id="ind-ret-time" class="form-control" value="18:00" required />
            </div>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Reason for Leave</label>
          <input type="text" id="ind-reason" class="form-control" placeholder="e.g. Family wedding ceremony, medical appointment" required />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-ind-leave">Issue Individual Leave</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-ind-leave').addEventListener('click', async () => {
          const sid = modalBody.querySelector('#ind-student').value;
          const depDate = modalBody.querySelector('#ind-dep-date').value;
          const depTime = modalBody.querySelector('#ind-dep-time').value;
          const retDate = modalBody.querySelector('#ind-ret-date').value;
          const retTime = modalBody.querySelector('#ind-ret-time').value;
          const reason = modalBody.querySelector('#ind-reason').value.trim();

          if (!reason) {
            toast.error('Please specify a reason for leave.');
            return;
          }

          await db.createLeaveRecord({
            student_ids: [sid],
            leave_type: 'individual',
            departure_date: depDate,
            departure_time: depTime,
            expected_return_date: retDate,
            expected_return_time: retTime,
            reason,
            approved_by: user?.full_name || 'Warden'
          });

          toast.success('Individual leave issued successfully.');
          close();
          renderLeavesModule(container, { onNavigate });
        });
      }
    });
  });

  // Record Hostel Return Modal (with calendar-day late calculation)
  container.querySelectorAll('.btn-checkin-return').forEach(btn => {
    btn.addEventListener('click', () => {
      const leaveId = btn.getAttribute('data-id');
      const leave = displayLeaves.find(l => l.id === leaveId);
      const student = students.find(s => s.id === leave?.student_id);

      const today = new Date().toISOString().split('T')[0];

      openModal({
        title: `Record Hostel Return — ${student?.full_name}`,
        contentHtml: `
          <div style="background: var(--bg-surface-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem; line-height: 1.6;">
            <div>Leave Reg: <strong>${leave.leave_register_number}</strong> • Student: <strong>${student?.full_name}</strong></div>
            <div>Expected Return Date: <strong>${formatDate(leave.expected_return_date)}</strong> (${formatTime(leave.expected_return_time)})</div>
            <div>Applicable Fine Policy Rate: <strong>₹${leave.fine_per_day_applied} / late day</strong> (Calendar Date basis)</div>
          </div>
          <div class="form-grid" style="margin-bottom: 1rem;">
            <div class="form-group">
              <label class="form-label required">Actual Return Date</label>
              <input type="date" id="ret-actual-date" class="form-control" value="${today}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">Actual Return Time</label>
              <input type="time" id="ret-actual-time" class="form-control" value="16:30" required />
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Gate Operator Remarks</label>
            <input type="text" id="ret-remarks" class="form-control" placeholder="Luggage checked, student arrived safely" />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-primary" id="btn-save-return">Save Entry & Compute Fine</button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-save-return').addEventListener('click', async () => {
            const actualDate = modalBody.querySelector('#ret-actual-date').value;
            const actualTime = modalBody.querySelector('#ret-actual-time').value;
            const remarks = modalBody.querySelector('#ret-remarks').value.trim();

            const updated = await db.recordReturn(leaveId, actualDate, actualTime, remarks);
            if (updated.calculated_fine > 0) {
              toast.error(`Return recorded! Student is ${updated.late_days} day(s) late. Fine assessed: ₹${updated.calculated_fine}`);
            } else {
              toast.success('Return recorded on time! Student marked Active in hostel.');
            }
            close();
            renderLeavesModule(container, { onNavigate });
          });
        }
      });
    });
  });

  // Printable Leave Card Modal
  container.querySelectorAll('.btn-view-leave-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const leaveId = btn.getAttribute('data-id');
      const leave = displayLeaves.find(l => l.id === leaveId);
      const student = students.find(s => s.id === leave?.student_id);

      openModal({
        title: `Official Student Leave Card`,
        size: 'lg',
        contentHtml: `
          <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
            <button class="btn btn-primary" id="btn-print-leave-card">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Leave Card (A4)
            </button>
          </div>

          <div id="leave-card-printable" class="printable-card">
            <div class="print-header">
              <div class="institution-logo" style="width: 50px; height: 50px; font-size: 22px;">TPS</div>
              <div class="print-title">
                <h2>Thaiba Public School</h2>
                <p>Modern Education with Morality • Hostel Boarding Wing</p>
                <div class="print-doc-name">Official Hostel Leave Card</div>
              </div>
              <div style="text-align: right; font-size: 11px;">
                <div>Reg No: <strong>${leave.leave_register_number}</strong></div>
                <div>Date: <strong>${formatDate(leave.departure_date)}</strong></div>
              </div>
            </div>

            <div class="print-grid">
              <div class="print-field">
                <span class="print-label">Student Name</span>
                <span class="print-value">${student?.full_name}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Admission Number</span>
                <span class="print-value">${student?.admission_number}</span>
              </div>
              <div class="print-field">
                <span class="print-label">School Grade & Gender</span>
                <span class="print-value">${student?.school_class} (${student?.school_section}) • ${student?.gender}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Hostel Unit & Room</span>
                <span class="print-value">${student?.hostel_unit || 'Boys Block'} — ${student?.hostel_room || '101'}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Leave Type & Reason</span>
                <span class="print-value">${leave.leave_type.toUpperCase()} — ${leave.reason}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Departure Date & Time</span>
                <span class="print-value">${formatDate(leave.departure_date)} at ${formatTime(leave.departure_time)}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Expected Return</span>
                <span class="print-value">${formatDate(leave.expected_return_date)} at ${formatTime(leave.expected_return_time)}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Actual Return Status</span>
                <span class="print-value">${leave.actual_return_date ? `${formatDate(leave.actual_return_date)} (${leave.late_days} late days)` : 'Still Away'}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Late Fine Assessment</span>
                <span class="print-value">${leave.calculated_fine > 0 ? `${formatCurrency(leave.calculated_fine)} (${leave.fine_status.toUpperCase()})` : '₹0.00 (No Fine)'}</span>
              </div>
              <div class="print-field">
                <span class="print-label">Emergency Parent Contact</span>
                <span class="print-value">${student?.father_name} (${student?.father_phone})</span>
              </div>
            </div>

            <div style="font-size: 11px; color: #475569; margin-top: 16px; border-top: 1px dashed #CBD5E1; padding-top: 8px;">
              * Note: Hostel rules strictly require returning before expected date & time. Every late day incurs ₹${leave.fine_per_day_applied} fine on calendar date basis.
            </div>

            <div class="print-signatures">
              <div class="signature-line">Parent / Guardian Signature</div>
              <div class="signature-line">Hostel Warden Signature</div>
              <div class="signature-line">Principal / Superintendent</div>
            </div>
          </div>
        `,
        onMount: ({ container: modalBody }) => {
          modalBody.querySelector('#btn-print-leave-card').addEventListener('click', () => {
            printDocument('leave-card-printable', `Leave_Card_${leave.leave_register_number}`);
          });
        }
      });
    });
  });
}
