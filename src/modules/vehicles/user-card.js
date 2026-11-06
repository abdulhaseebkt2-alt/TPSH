import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { formatDate, formatCurrency, getTodayDateStr } from '../../lib/utils.js';
import { enhanceDateInput } from '../../components/date-picker.js';
import { openModal } from '../../lib/dialog.js';
import { normalizeVehicleCategory, getVehicleTypeIcon } from './index.js';

export async function renderVehicleUserCardModule(container, options = {}) {
  const onNavigate = options.onNavigate;
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
  // ALWAYS default to passed userId option or currentUser (so it never opens for a random user with 0 trips!)
  let selectedUserId = options.userId || currentUser?.id || eligibleUsers[0]?.id;
  let selectedUser = eligibleUsers.find(u => 
    u.id === selectedUserId || 
    (u.tps_id && u.tps_id === selectedUserId) || 
    (u.email && u.email === selectedUserId) || 
    (u.full_name && u.full_name === selectedUserId)
  ) || currentUser;

  function render() {
    // Current user's trips: Robust matching by ID, TPS ID, Email, or Full Name
    const userTrips = allTrips
      .filter(t => {
        if (!t) return false;
        const sId = String(selectedUser?.id || '').trim().toLowerCase();
        const sTpsId = String(selectedUser?.tps_id || '').trim().toLowerCase();
        const sEmail = String(selectedUser?.email || '').trim().toLowerCase();
        const sName = String(selectedUser?.full_name || '').trim().toLowerCase();
        
        const tUserId = String(t.user_id || '').trim().toLowerCase();
        const tUserEmail = String(t.user_email || '').trim().toLowerCase();
        const tUserName = String(t.user_name || '').trim().toLowerCase();
        
        return (
          (sId && tUserId === sId) ||
          (sTpsId && tUserId === sTpsId) ||
          (sEmail && (tUserId === sEmail || tUserEmail === sEmail)) ||
          (sName && tUserName === sName)
        );
      })
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
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.15);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4"/><path d="M14 14h3"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Vehicle User Ledger & Card</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                Trip history, distance logs, and bill settlement ledger (Student Leave Card format)
              </p>
            </div>
          </div>
        </div>

        <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-card-book-trip" style="font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Book / Short Ride
          </button>
          ${isAdmin ? `
            <button class="btn btn-secondary" id="btn-card-all-trips" style="font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              All Trips Master
            </button>
            <button class="btn btn-secondary" id="btn-card-fleet-admin" style="font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              Fleet Console
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 1. SECTION-STYLE USER SELECTOR CARD (MATCHES SECTION & CLASSROOMS DESIGN PATTERN) -->
      ${isAdmin && eligibleUsers.length > 1 ? `
        <div class="sections-mobile-card rbac-mobile-role-card" style="margin-bottom: 1.25rem;">
          <button type="button" class="rbac-mobile-role-trigger" id="sec-user-trigger" aria-label="Select staff or driver to view ledger">
            <div class="rbac-trigger-left" style="gap: 0.85rem;">
              <div class="rbac-trigger-icon" style="background: #EEF2FF; color: #4F46E5; border: 1.5px solid #C7D2FE; width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; font-weight: 800; flex-shrink: 0;">
                ${(selectedUser.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div class="rbac-trigger-text">
                <span class="rbac-trigger-kicker">VIEWING USAGE CARD FOR</span>
                <div class="rbac-trigger-name-row" style="gap: 0.5rem; flex-wrap: wrap;">
                  <span class="rbac-trigger-name" style="font-size: 0.95rem; font-weight: 700;">${selectedUser.full_name}</span>
                  <span class="rbac-trigger-badge" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-weight: 700;">
                    ${selectedUser.role === 'vehicle_user' ? 'Driver / Staff' : selectedUser.role.toUpperCase()}
                  </span>
                  <span class="badge" style="font-size: 0.68rem; font-family: monospace; background: #0F172A; color: #FFFFFF; padding: 2px 6px;">
                    ${selectedUser.tps_id || 'TPS-VUS'}
                  </span>
                </div>
              </div>
            </div>
            <div class="rbac-trigger-right">
              <span class="rbac-trigger-action-pill">
                <span>Switch</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
          </button>
        </div>
      ` : ''}

      <!-- User Profile Header Card (Small Mobile Optimized Layout) -->
      <div class="card-panel" style="background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); color: #FFFFFF; border-radius: var(--radius-lg); padding: 1.15rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 4px 14px rgba(49, 46, 129, 0.2);">
        <!-- Top Row: User Avatar & Identification -->
        <div style="display: flex; align-items: center; gap: 0.85rem; width: 100%;">
          <div style="width: 46px; height: 46px; border-radius: 50%; background: #4338CA; border: 2px solid #6366F1; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; color: #FFFFFF; flex-shrink: 0;">
            ${(selectedUser.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">
                ${selectedUser.full_name}
              </h3>
              <span class="badge" style="background: rgba(99, 102, 241, 0.4); color: #E0E7FF; border: 1px solid rgba(165, 180, 252, 0.4); font-size: 0.65rem; font-weight: 700;">
                ${selectedUser.role === 'vehicle_user' ? 'Driver' : selectedUser.role.toUpperCase()}
              </span>
              <span style="font-family: monospace; font-size: 0.68rem; background: rgba(0,0,0,0.35); padding: 1px 5px; border-radius: 4px; color: #C7D2FE;">
                ${selectedUser.tps_id || 'TPS-VUS'}
              </span>
            </div>
            <div style="font-size: 0.74rem; color: #C7D2FE; margin-top: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${selectedUser.phone ? `📞 ${selectedUser.phone} ` : ''}${selectedUser.email ? `• ${selectedUser.email}` : ''}
            </div>
          </div>
        </div>

        <!-- Bottom Row: 3-Pillar KPI Metrics Grid (Fits any small mobile screen without awkward line breaks) -->
        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; width: 100%; box-sizing: border-box; margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.15);">
          <!-- Metric 1: Distance -->
          <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 0.45rem 0.25rem; text-align: center;">
            <div style="font-size: 0.64rem; color: #C7D2FE; text-transform: uppercase; font-weight: 700; letter-spacing: 0.02em;">Distance</div>
            <div style="font-size: 0.92rem; font-weight: 800; font-family: monospace; color: #FFFFFF; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${totalKmDriven.toLocaleString('en-IN')} KM
            </div>
          </div>

          <!-- Metric 2: Total Billed -->
          <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 0.45rem 0.25rem; text-align: center;">
            <div style="font-size: 0.64rem; color: #C7D2FE; text-transform: uppercase; font-weight: 700; letter-spacing: 0.02em;">Total Billed</div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #FFFFFF; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${formatCurrency(totalBilled)}
            </div>
          </div>

          <!-- Metric 3: Pending Dues -->
          <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 0.45rem 0.25rem; text-align: center;">
            <div style="font-size: 0.64rem; color: #C7D2FE; text-transform: uppercase; font-weight: 700; letter-spacing: 0.02em;">Pending Dues</div>
            <div style="font-size: 0.92rem; font-weight: 800; color: ${pendingDues > 0 ? '#F87171' : '#34D399'}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${formatCurrency(pendingDues)}
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Student-Leave-Card Style Compact Mobile Table (Zero Horizontal Scrollbar) -->
      <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 0.75rem 0.85rem; box-shadow: var(--shadow-sm); margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Vehicle Usage & Settlement Ledger</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
            ${userTrips.length} recorded trip(s)
          </span>
        </div>

        ${userTrips.length === 0 ? `
          <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            No vehicle usage trips logged for ${selectedUser.full_name} yet.
          </div>
        ` : `
          <div class="table-responsive" style="overflow-x: hidden; width: 100%;">
            <table class="data-table user-card-table" style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 0.78rem;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                  <th style="padding: 0.55rem 0.25rem; width: 8%; text-align: center; font-size: 0.7rem; font-weight: 800; color: #64748B;">#</th>
                  <th style="padding: 0.55rem 0.35rem; width: 44%; font-size: 0.7rem; font-weight: 800; color: #64748B;">
                    Date & Vehicle
                  </th>
                  <th style="padding: 0.55rem 0.35rem; width: 26%; font-size: 0.7rem; font-weight: 800; color: #64748B;">
                    KM & Amount
                  </th>
                  <th style="padding: 0.55rem 0.35rem; width: 22%; text-align: right; font-size: 0.7rem; font-weight: 800; color: #64748B;">
                    Payment / Action
                  </th>
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
                  const tripDateStr = formatDate(t.start_time || t.created_at);

                  return `
                    <tr class="user-card-row ${isCompleted && !isPaid ? 'has-due' : ''}" 
                      data-id="${t.id}"
                      data-code="${t.trip_id}"
                      data-total="${totalAmt}"
                      data-due="${remainingDue}"
                      data-user="${selectedUser.full_name}"
                      style="border-bottom: 1px solid var(--border-subtle); vertical-align: top; cursor: ${isCompleted && !isPaid && isAdmin ? 'pointer' : 'default'}; transition: background 0.15s;" 
                      onmouseover="this.style.background='var(--bg-surface-subtle)'" 
                      onmouseout="this.style.background='transparent'">
                      <!-- SL No -->
                      <td style="padding: 0.55rem 0.25rem; text-align: center; font-weight: 700; color: var(--text-muted); font-size: 0.72rem;">
                        ${idx + 1}
                      </td>

                      <!-- Column 1: Date & Vehicle -->
                      <td style="padding: 0.55rem 0.35rem; min-width: 0; overflow: hidden;">
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.8rem; line-height: 1.25;">
                          ${tripDateStr}
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.25rem; margin-top: 0.2rem; flex-wrap: wrap;">
                          <span style="color: #4F46E5; font-weight: 600; font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                            ${getVehicleTypeIcon(veh?.vehicle_type)} ${veh?.vehicle_name || 'Vehicle'}
                          </span>
                          <span style="font-family: monospace; font-size: 0.64rem; background: #0F172A; color: #FFF; padding: 1px 4px; border-radius: 3px;">
                            ${veh?.reg_number || ''}
                          </span>
                        </div>
                        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${t.destination || 'Short ride'}">
                          ${t.destination ? `📍 ${t.destination}` : 'Short ride'}
                        </div>
                      </td>

                      <!-- Column 2: Distance & Amount -->
                      <td style="padding: 0.55rem 0.35rem; min-width: 0;">
                        <div style="font-family: monospace; font-weight: 700; font-size: 0.82rem; color: #0F172A;">
                          ${t.total_km !== null && t.total_km !== undefined ? `${t.total_km} KM` : (t.status === 'In Progress' ? '<span style="color: #2563EB;">Driving</span>' : '—')}
                        </div>
                        <div style="margin-top: 0.15rem;">
                          <span style="font-weight: 800; font-size: 0.88rem; color: ${isPaid ? '#059669' : '#DC2626'};">
                            ${totalAmt > 0 ? formatCurrency(totalAmt) : '₹0.00'}
                          </span>
                          ${t.applied_rate_per_km ? `
                            <div style="font-size: 0.64rem; color: var(--text-muted);">
                              @ ₹${Number(t.applied_rate_per_km).toFixed(2)}/km
                            </div>
                          ` : ''}
                        </div>
                      </td>

                      <!-- Column 3: Payment Status & Admin Action -->
                      <td style="padding: 0.55rem 0.35rem; text-align: right; min-width: 0;">
                        ${!isCompleted ? `
                          <span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.64rem; padding: 1px 4px;">
                            ${t.status}
                          </span>
                        ` : isPaid ? `
                          <div>
                            <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700; font-size: 0.65rem; padding: 1px 4px; display: inline-block;">
                              ✓ Paid
                            </span>
                            ${t.payment_received_by ? `
                              <div style="font-size: 0.58rem; color: #047857; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Received by ${t.payment_received_by}">
                                By: ${t.payment_received_by}
                              </div>
                            ` : ''}
                          </div>
                        ` : isPartial ? `
                          <div>
                            ${isAdmin ? `
                              <button type="button" class="btn btn-sm btn-outline btn-settle-due" 
                                data-id="${t.id}" 
                                data-code="${t.trip_id}"
                                data-total="${totalAmt}"
                                data-due="${remainingDue}"
                                data-user="${selectedUser.full_name}"
                                style="color: #D97706; border-color: #FDE68A; background: #FEF3C7; font-size: 0.66rem; padding: 2px 5px; font-weight: 700; border-radius: 5px; white-space: nowrap;">
                                Bal ₹${remainingDue}
                              </button>
                            ` : `
                              <span class="badge" style="background: #FEF3C7; color: #D97706; font-size: 0.64rem;">Bal ₹${remainingDue}</span>
                            `}
                          </div>
                        ` : `
                          <div>
                            ${isAdmin ? `
                              <button type="button" class="btn btn-sm btn-primary btn-settle-due" 
                                data-id="${t.id}" 
                                data-code="${t.trip_id}"
                                data-total="${totalAmt}"
                                data-due="${remainingDue}"
                                data-user="${selectedUser.full_name}"
                                style="background: #059669; border-color: #059669; font-size: 0.7rem; padding: 2px 6px; font-weight: 700; border-radius: 5px; white-space: nowrap; box-shadow: 0 1px 3px rgba(5,150,105,0.25);">
                                Pay / Settle
                              </button>
                            ` : `
                              <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-size: 0.65rem; font-weight: 700; padding: 1px 4px;">Due</span>
                            `}
                          </div>
                        `}
                      </td>
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
    // Navigation handlers
    container.querySelector('#btn-card-book-trip')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_trips');
    });
    container.querySelector('#btn-card-all-trips')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_all_trips');
    });
    container.querySelector('#btn-card-fleet-admin')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicles');
    });

    // 1. SECTION-STYLE USER SELECTOR MODAL DIALOG (MATCHING SECTION & CLASSROOMS MODAL PATTERN)
    container.querySelector('#sec-user-trigger')?.addEventListener('click', () => {
      openModal({
        title: 'Select Staff / Driver',
        modalClass: 'role-picker-modal-dialog',
        contentHtml: `
          <div style="margin-bottom: 0.5rem;">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Select an authorized staff member or driver to view their personal trip ledger:
            </p>
            <div class="role-picker-list">
              ${eligibleUsers.map(u => {
                const isSelected = u.id === selectedUser.id;
                const uTrips = allTrips.filter(t => {
                  const sId = String(u.id || '').trim().toLowerCase();
                  const sTpsId = String(u.tps_id || '').trim().toLowerCase();
                  const sEmail = String(u.email || '').trim().toLowerCase();
                  const sName = String(u.full_name || '').trim().toLowerCase();
                  const tId = String(t.user_id || '').trim().toLowerCase();
                  const tEmail = String(t.user_email || '').trim().toLowerCase();
                  const tName = String(t.user_name || '').trim().toLowerCase();
                  return (sId && tId === sId) || (sTpsId && tId === sTpsId) || (sEmail && (tId === sEmail || tEmail === sEmail)) || (sName && tName === sName);
                });
                const dueCount = uTrips.filter(t => t.status === 'Completed' && t.payment_status !== 'Paid').length;

                return `
                  <div class="role-picker-item ${isSelected ? 'active' : ''}" data-user-id="${u.id}" role="button" tabindex="0" style="cursor: pointer; padding: 0.85rem 1rem;">
                    <div class="role-picker-item-left" style="gap: 0.85rem;">
                      <div class="role-picker-item-icon" style="background: #EEF2FF; color: #4F46E5; border: 1.5px solid #C7D2FE; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0;">
                        ${(u.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div class="role-picker-item-info">
                        <div class="role-picker-item-title-row" style="gap: 0.45rem; flex-wrap: wrap;">
                          <span class="role-picker-item-name" style="font-weight: 700; font-size: 0.92rem;">${u.full_name}</span>
                          ${isSelected ? `<span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">CURRENT</span>` : ''}
                          <span class="badge" style="font-size: 0.65rem; background: #F1F5F9; color: #475569;">
                            ${u.role === 'vehicle_user' ? 'Driver / Staff' : u.role.toUpperCase()}
                          </span>
                        </div>
                        <span class="role-picker-item-desc" style="font-size: 0.78rem; color: #64748B; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                          <span>${uTrips.length} Trips logged</span>
                          <span>•</span>
                          ${dueCount > 0 ? `<span style="color: #DC2626; font-weight: 700;">${dueCount} payment due</span>` : '<span style="color: #059669; font-weight: 600;">✓ No dues</span>'}
                        </span>
                      </div>
                    </div>
                    <div class="role-picker-item-radio">
                      <div class="role-radio-circle ${isSelected ? 'active' : ''}">
                        ${isSelected ? `<div class="role-radio-dot"></div>` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelectorAll('.role-picker-item').forEach(item => {
            item.addEventListener('click', () => {
              const uid = item.getAttribute('data-user-id');
              if (uid && uid !== selectedUser.id) {
                selectedUserId = uid;
                selectedUser = eligibleUsers.find(u => u.id === uid) || currentUser;
                close();
                render();
              } else {
                close();
              }
            });
          });
        }
      });
    });

    // Settle / Pay Button (Supports Full and Partial Payments)
    container.querySelectorAll('.btn-settle-due').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
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

    // Row click to settle payment (like Student Leave Card)
    if (isAdmin) {
      container.querySelectorAll('.user-card-row.has-due').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return; // handled by button
          const tripId = row.getAttribute('data-id');
          const tripCode = row.getAttribute('data-code');
          const remainingDue = parseFloat(row.getAttribute('data-due')) || 0;
          const totalAmount = parseFloat(row.getAttribute('data-total')) || 0;
          const userName = row.getAttribute('data-user');

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
  }

  // Modal: Pay or Partial Pay for Admin
  function openSettlePaymentModal({ tripId, tripCode, remainingDue, totalAmount, userName }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Record Payment / Partial Settlement</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <!-- Form with Scrollable Content & Frozen Bottom Submit Bar -->
        <form id="form-card-settle-payment" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 0.72rem; color: #065F46; font-weight: 600;">TRIP REFERENCE</div>
                  <div style="font-weight: 700; font-family: monospace; font-size: 0.95rem;">${tripCode}</div>
                  <div style="font-size: 0.78rem; color: #047857;">User: ${userName}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.72rem; color: #065F46; font-weight: 600;">REMAINING DUE</div>
                  <div style="font-size: 1.25rem; font-weight: 800; color: #065F46;">${formatCurrency(remainingDue)}</div>
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.25rem;">Amount Received (₹) *</label>
              <input type="number" id="pay-card-amount" class="form-control" step="0.5" min="1" max="${remainingDue}" value="${remainingDue}" required style="width: 100%; font-size: 1.05rem; font-weight: 700; color: #059669;" />
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

            <div class="form-group" style="margin-bottom: 0.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Receipt / Transaction Notes</label>
              <input type="text" id="pay-card-notes" class="form-control" placeholder="e.g. Cash received at office" style="width: 100%;" />
            </div>
          </div>

          <!-- Frozen Bottom Submit Bar -->
          <div style="flex-shrink: 0; padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--bg-surface); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04); z-index: 10;">
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
