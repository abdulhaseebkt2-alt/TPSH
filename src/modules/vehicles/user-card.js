import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { formatDate, formatCurrency, getTodayDateStr } from '../../lib/utils.js';
import { enhanceDateInput } from '../../components/date-picker.js';

export async function renderVehicleUserCardModule(container, options = {}) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 280px;">
      <div class="loading-spinner" style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #4F46E5; border-radius: 50%; animation: tpsSpin 0.8s linear infinite;"></div>
    </div>
  `;

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  // Load all required data
  const [users, allTrips, vehicles, payments] = await Promise.all([
    db.getUsers(),
    db.getTripLogs(),
    db.getVehicles(),
    db.getVehiclePayments()
  ]);

  // All users eligible for vehicle usage: vehicle_user, teacher, admin
  const eligibleUsers = users.filter(u => ['vehicle_user', 'teacher', 'admin', 'super_admin'].includes(u.role));

  // Determine currently selected user:
  // If non-admin, always force currentUser
  let selectedUserId = options.userId || (isAdmin ? (eligibleUsers[0]?.id || currentUser?.id) : currentUser?.id);
  let selectedUser = eligibleUsers.find(u => u.id === selectedUserId) || currentUser;

  function render() {
    // Current user's trips
    const userTrips = allTrips
      .filter(t => t.user_id === selectedUser.id || (selectedUser.email && t.user_id === selectedUser.email) || t.user_name === selectedUser.full_name)
      .sort((a, b) => new Date(b.created_at || b.start_time || 0) - new Date(a.created_at || a.start_time || 0));

    // Calculate User KPI Metrics
    const completedTrips = userTrips.filter(t => t.status === 'Completed');
    const totalBilled = completedTrips.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalPaid = completedTrips.reduce((sum, t) => sum + (Number(t.amount_paid) || (t.payment_status === 'Paid' ? Number(t.total_amount) || 0 : 0)), 0);
    const pendingDues = Math.max(0, totalBilled - totalPaid);
    const totalKmDriven = completedTrips.reduce((sum, t) => sum + (Number(t.total_km) || 0), 0);

    container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4"/><path d="M14 14h3"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Vehicle User Ledger & Usage Card</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                Official trip history, distance logs, and bill settlement card (Mirroring student leave card format)
              </p>
            </div>
          </div>
        </div>

        ${isAdmin ? `
          <div class="page-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <label style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted);">Select Staff / Driver:</label>
            <select id="user-card-selector" class="form-control" style="font-weight: 600; min-width: 200px;">
              ${eligibleUsers.map(u => `
                <option value="${u.id}" ${u.id === selectedUser.id ? 'selected' : ''}>
                  ${u.full_name} (${u.role === 'vehicle_user' ? 'Driver / Staff' : u.role})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <!-- User Profile Header Card -->
      <div class="card-panel" style="background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); color: #FFFFFF; border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 4px 14px rgba(49, 46, 129, 0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: #4338CA; border: 2px solid #6366F1; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; font-weight: 800; color: #FFFFFF;">
              ${(selectedUser.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #FFFFFF;">${selectedUser.full_name}</h3>
                <span class="badge" style="background: rgba(99, 102, 241, 0.35); color: #E0E7FF; border: 1px solid rgba(165, 180, 252, 0.4); font-size: 0.72rem;">
                  ${selectedUser.role === 'vehicle_user' ? 'Vehicle Staff / Driver' : selectedUser.role.toUpperCase()}
                </span>
                <span style="font-family: monospace; font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 4px; color: #C7D2FE;">
                  ${selectedUser.tps_id || 'TPS-VUS'}
                </span>
              </div>
              <div style="font-size: 0.8rem; color: #C7D2FE; margin-top: 0.25rem;">
                ${selectedUser.phone ? `📞 ${selectedUser.phone} • ` : ''}${selectedUser.email || ''}
              </div>
            </div>
          </div>

          <!-- Financial Snapshot -->
          <div style="display: flex; gap: 1.5rem; text-align: right; flex-wrap: wrap;">
            <div>
              <div style="font-size: 0.72rem; color: #A5B4FC; text-transform: uppercase; font-weight: 600;">Total Distance</div>
              <div style="font-size: 1.25rem; font-weight: 800; font-family: monospace;">${totalKmDriven.toLocaleString('en-IN')} KM</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: #A5B4FC; text-transform: uppercase; font-weight: 600;">Total Billed</div>
              <div style="font-size: 1.25rem; font-weight: 800;">${formatCurrency(totalBilled)}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: #A5B4FC; text-transform: uppercase; font-weight: 600;">Pending Dues</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: ${pendingDues > 0 ? '#FCA5A5' : '#34D399'};">
                ${formatCurrency(pendingDues)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Student-Leave-Card Style Table -->
      <!-- Columns: 
           Col 1: SL No
           Col 2: Date (Under the date: Vehicle Name & Reg Plate)
           Col 3: Distance (Under that: Amount Due / Billed)
           Col 4: Paid or Not Paid (Clean status badge with Partial support)
           Col 5: Admin Action (Mark Paid / Partial Settle)
      -->
      <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Vehicle Usage & Settlement Ledger</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            Showing ${userTrips.length} recorded trips
          </span>
        </div>

        ${userTrips.length === 0 ? `
          <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            No vehicle usage trips logged for ${selectedUser.full_name} yet.
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                  <th style="padding: 0.65rem 0.5rem; width: 45px; text-align: center;">#</th>
                  <th style="padding: 0.65rem;">
                    <div>Date of Trip</div>
                    <div style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">Vehicle Assigned</div>
                  </th>
                  <th style="padding: 0.65rem;">
                    <div>Distance (KM)</div>
                    <div style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">Total Bill Amount</div>
                  </th>
                  <th style="padding: 0.65rem; text-align: center;">
                    <div>Payment Status</div>
                    <div style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">Settlement Audit</div>
                  </th>
                  ${isAdmin ? `<th style="padding: 0.65rem; text-align: right;">Admin Action</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${userTrips.map((t, idx) => {
                  const veh = vehicles.find(v => v.id === t.vehicle_id);
                  const isCompleted = t.status === 'Completed';
                  const isPaid = t.payment_status === 'Paid';
                  const isPartial = t.payment_status === 'Partial';
                  const totalAmt = Number(t.total_amount) || 0;
                  const paidAmt = Number(t.amount_paid) || (isPaid ? totalAmt : 0);
                  const remainingDue = Math.max(0, totalAmt - paidAmt);

                  // Paid / Not Paid Badge
                  let paymentBadge = '';
                  if (!isCompleted) {
                    paymentBadge = `<span class="badge" style="background: #F1F5F9; color: #64748B;">${t.status}</span>`;
                  } else if (isPaid) {
                    paymentBadge = `
                      <div>
                        <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700;">
                          ✓ Paid (Full)
                        </span>
                        ${t.payment_received_by ? `
                          <div style="font-size: 0.7rem; color: #047857; margin-top: 0.15rem;">
                            By: ${t.payment_received_by}
                          </div>
                        ` : ''}
                      </div>
                    `;
                  } else if (isPartial) {
                    paymentBadge = `
                      <div>
                        <span class="badge" style="background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; font-weight: 700;">
                          Partially Paid (₹${paidAmt})
                        </span>
                        <div style="font-size: 0.72rem; color: #DC2626; font-weight: 600; margin-top: 0.15rem;">
                          Bal: ₹${remainingDue}
                        </div>
                      </div>
                    `;
                  } else {
                    paymentBadge = `
                      <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-weight: 700;">
                        ✕ Not Paid (Due)
                      </span>
                    `;
                  }

                  const tripDateStr = formatDate(t.start_time || t.created_at);

                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-surface-subtle)'" onmouseout="this.style.background='transparent'">
                      <!-- SL No -->
                      <td style="padding: 0.65rem 0.5rem; text-align: center; font-weight: 700; color: var(--text-muted); font-size: 0.78rem;">
                        ${idx + 1}
                      </td>

                      <!-- Column 1: Date & under date Vehicle -->
                      <td style="padding: 0.65rem;">
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem;">
                          ${tripDateStr}
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
                          <span style="color: #4F46E5; font-weight: 600; font-size: 0.8rem;">
                            🚗 ${veh?.vehicle_name || 'Vehicle'}
                          </span>
                          <span style="font-family: monospace; font-size: 0.72rem; background: #0F172A; color: #FFF; padding: 1px 5px; border-radius: 3px;">
                            ${veh?.reg_number || ''}
                          </span>
                        </div>
                        <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem;">
                          ${t.destination ? `📍 ${t.destination}` : 'Short ride'}
                        </div>
                      </td>

                      <!-- Column 2: Distance & under that Amount -->
                      <td style="padding: 0.65rem;">
                        <div style="font-family: monospace; font-weight: 700; font-size: 0.95rem; color: #0F172A;">
                          ${t.total_km !== null && t.total_km !== undefined ? `${t.total_km} KM` : (t.status === 'In Progress' ? '<span style="color: #2563EB;">Driving...</span>' : '—')}
                        </div>
                        <div style="margin-top: 0.2rem;">
                          <span style="font-weight: 800; font-size: 1rem; color: ${isPaid ? '#059669' : '#DC2626'};">
                            ${totalAmt > 0 ? formatCurrency(totalAmt) : '₹0.00'}
                          </span>
                          ${t.applied_rate_per_km ? `
                            <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 0.25rem;">
                              (@ ₹${Number(t.applied_rate_per_km).toFixed(2)}/km)
                            </span>
                          ` : ''}
                        </div>
                      </td>

                      <!-- Column 3: Paid or Not Paid -->
                      <td style="padding: 0.65rem; text-align: center;">
                        ${paymentBadge}
                      </td>

                      <!-- Column 4: Admin Action -->
                      ${isAdmin ? `
                        <td style="padding: 0.65rem; text-align: right;">
                          ${isCompleted && !isPaid ? `
                            <button class="btn btn-sm btn-primary btn-settle-due" 
                              data-id="${t.id}" 
                              data-code="${t.trip_id}"
                              data-total="${totalAmt}"
                              data-due="${remainingDue}"
                              data-user="${selectedUser.full_name}"
                              style="background: #059669; border-color: #059669; font-size: 0.78rem; padding: 4px 10px;">
                              Settle / Pay
                            </button>
                          ` : (isPaid ? `
                            <span style="font-size: 0.74rem; color: #059669; font-weight: 600;">✓ Settled</span>
                          ` : '—')}
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Admin selector to switch user
    const userSelector = container.querySelector('#user-card-selector');
    userSelector?.addEventListener('change', (e) => {
      const uId = e.target.value;
      const found = eligibleUsers.find(u => u.id === uId);
      if (found) {
        selectedUser = found;
        render();
      }
    });

    // Settle / Pay Button (Supports Full and Partial Payments)
    container.querySelectorAll('.btn-settle-due').forEach(btn => {
      btn.addEventListener('click', () => {
        const tripId = btn.getAttribute('data-id');
        const tripCode = btn.getAttribute('data-code');
        const remainingDue = parseFloat(btn.getAttribute('data-due')) || 0;
        const totalAmount = parseFloat(btn.getAttribute('data-total')) || 0;
        const userName = btn.getAttribute('data-user');

        openSettlePaymentModal({
          tripId,
          tripCode,
          remainingDue,
          totalAmount,
          userName
        });
      });
    });
  }

  // Modal: Pay or Partial Pay for Admin
  function openSettlePaymentModal({ tripId, tripCode, remainingDue, totalAmount, userName }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 480px; box-shadow: var(--shadow-xl); overflow: hidden;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Record Payment / Partial Settlement</h3>
          <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">✕</button>
        </div>

        <form id="form-card-settle-payment" style="padding: 1.5rem;">
          <div style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.85rem; margin-bottom: 1.15rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">TRIP REF</div>
                <div style="font-weight: 700; font-family: monospace; font-size: 0.95rem;">${tripCode}</div>
                <div style="font-size: 0.8rem; color: var(--text-main); font-weight: 600;">${userName}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">OUTSTANDING DUE</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #DC2626;">${formatCurrency(remainingDue)}</div>
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.25rem;">
              Amount to Pay (₹) * (Full or Partial)
            </label>
            <input type="number" id="pay-card-amount" class="form-control" step="0.5" min="1" max="${remainingDue}" value="${remainingDue}" required style="width: 100%; font-size: 1.1rem; font-weight: 700; color: #059669;" />
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">
              You can enter the full due amount (${formatCurrency(remainingDue)}) or a partial amount.
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Payment Method *</label>
            <select id="pay-card-method" class="form-control" required style="width: 100%;">
              <option value="Cash">Cash (Received at School Office)</option>
              <option value="UPI / GPay">UPI / GPay (School QR Scan)</option>
              <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
              <option value="Salary Deduction">Staff Salary Deduction</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Transaction Ref / Receipt Note</label>
            <input type="text" id="pay-card-notes" class="form-control" placeholder="e.g. UPI Ref #49281982 or Part payment #1" style="width: 100%;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669;">
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#form-card-settle-payment').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountToPay = parseFloat(modalOverlay.querySelector('#pay-card-amount').value) || 0;
      const method = modalOverlay.querySelector('#pay-card-method').value;
      const notes = modalOverlay.querySelector('#pay-card-notes').value.trim();

      if (amountToPay <= 0 || amountToPay > remainingDue) {
        toast.error(`Please enter a valid amount up to ${formatCurrency(remainingDue)}.`);
        return;
      }

      await db.recordVehiclePayment({
        trip_id: tripId,
        amount_paid: amountToPay,
        payment_method: method,
        received_by_admin_id: currentUser?.id || 'admin',
        received_by_admin_name: currentUser?.full_name || 'Admin',
        notes
      });

      // Reload fresh trips
      const freshTrips = await db.getTripLogs();
      modalOverlay.remove();
      toast.success(`Payment of ${formatCurrency(amountToPay)} recorded for trip ${tripCode}!`);
      
      // Update local allTrips reference and re-render
      allTrips.length = 0;
      allTrips.push(...freshTrips);
      render();
    });
  }

  // Initial render
  render();
}
