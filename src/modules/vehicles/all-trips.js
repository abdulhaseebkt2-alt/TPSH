import { openModal, confirmDialog } from '../../lib/dialog.js';
import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { normalizeVehicleCategory, getVehicleTypeIcon } from './index.js';
import { isTripForUser } from './user-card.js';

export async function renderAllVehicleTripsModule(container, options = {}) {
  const onNavigate = options.onNavigate;
  const currentUser = getCurrentUser();

  if (!currentUser) {
    container.innerHTML = `<div class="p-4 text-center">Please log in to access this module.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 280px;">
      <div class="loading-spinner" style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #4F46E5; border-radius: 50%; animation: tpsSpin 0.8s linear infinite;"></div>
    </div>
  `;

  // Fetch data
  let [allTrips, vehicles, users] = await Promise.all([
    db.getTripLogs(),
    db.getVehicles(),
    db.getUsers()
  ]);

  // Eligible users / drivers list for the dropdown
  const usersWithTrips = allTrips.map(t => ({
    id: t.user_id,
    full_name: t.user_name || 'Driver / Staff',
    email: t.user_email || '',
    role: t.user_role || 'staff'
  })).filter(u => u.id && u.full_name);

  const eligibleUsers = [...users];
  for (const uwt of usersWithTrips) {
    if (!eligibleUsers.some(u => isTripForUser({ user_id: uwt.id, user_name: uwt.full_name, user_email: uwt.email }, u))) {
      eligibleUsers.push(uwt);
    }
  }

  // Pre-select current logged in user or options.userId
  let selectedDriverId = options.userId || '';
  if (!selectedDriverId && currentUser) {
    const matched = eligibleUsers.find(u => 
      u.id === currentUser.id || 
      isTripForUser({ user_id: currentUser.id, user_name: currentUser.full_name, user_email: currentUser.email }, u)
    );
    if (matched) {
      selectedDriverId = matched.id;
    }
  }

  let selectedVehicleId = options.vehicleId || '';
  let activeFilter = 'all'; // 'all', 'unpaid', 'paid', 'active'

  function render() {
    const selectedDriverUser = selectedDriverId 
      ? (eligibleUsers.find(u => u.id === selectedDriverId) || { id: selectedDriverId, full_name: selectedDriverId })
      : null;

    const selectedVeh = selectedVehicleId
      ? vehicles.find(v => v.id === selectedVehicleId)
      : null;

    // Filter by Selected Driver (or all)
    let targetTrips = allTrips;
    if (selectedDriverUser) {
      targetTrips = targetTrips.filter(t => isTripForUser(t, selectedDriverUser));
    }

    // Filter by Selected Vehicle (or all)
    if (selectedVehicleId) {
      targetTrips = targetTrips.filter(t => t.vehicle_id === selectedVehicleId);
    }

    // Sort descending by date
    let filteredTrips = [...targetTrips].sort(
      (a, b) => new Date(b.created_at || b.start_time || 0) - new Date(a.created_at || a.start_time || 0)
    );

    // Apply Filter Tab
    if (activeFilter === 'unpaid') {
      filteredTrips = filteredTrips.filter(t => t.status === 'Completed' && t.payment_status !== 'Paid');
    } else if (activeFilter === 'paid') {
      filteredTrips = filteredTrips.filter(t => t.status === 'Completed' && t.payment_status === 'Paid');
    } else if (activeFilter === 'active') {
      filteredTrips = filteredTrips.filter(t => ['In Progress', 'Approved', 'Pending Approval'].includes(t.status));
    }

    // KPI Summary (calculated for targetTrips)
    const completedList = targetTrips.filter(t => t.status === 'Completed');
    const totalBilled = completedList.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalPaid = completedList.reduce((sum, t) => sum + (Number(t.amount_paid) || (t.payment_status === 'Paid' ? Number(t.total_amount) || 0 : 0)), 0);
    const totalUnpaid = Math.max(0, totalBilled - totalPaid);
    const totalKm = completedList.reduce((sum, t) => sum + (Number(t.total_km) || 0), 0);
    const unpaidCount = completedList.filter(t => t.payment_status !== 'Paid').length;

    container.innerHTML = `
      <!-- Header (Top buttons removed per request) -->
      <div class="page-header" style="margin-bottom: 0.85rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.15); flex-shrink: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">All Vehicle Trips Master Ledger</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.82rem;">
                Consolidated master log of driver & staff trips, mileage, and settlements
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Vehicle Selection Trigger Card (Screenshot 6 Pattern with All Vehicles support) -->
      <div class="sections-mobile-card rbac-mobile-role-card" style="margin-bottom: 0.65rem;">
        <button type="button" class="rbac-mobile-role-trigger" id="sec-alltrips-vehicle-trigger" aria-label="Filter trips by vehicle">
          <div class="rbac-trigger-left" style="gap: 0.75rem;">
            <div class="rbac-trigger-icon" style="background: #EEF2FF; color: #4F46E5; border: 1.5px solid #C7D2FE; overflow: hidden; padding: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 8px;">
              ${selectedVeh ? (
                selectedVeh.photo_url ? `
                  <img src="${selectedVeh.photo_url}" alt="${selectedVeh.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                ` : `
                  <span style="font-size: 1.35rem;">${getVehicleTypeIcon(selectedVeh.vehicle_type)}</span>
                `
              ) : `
                <span style="font-size: 1.35rem;">🚐</span>
              `}
            </div>
            <div class="rbac-trigger-text">
              <span class="rbac-trigger-kicker">SELECTED VEHICLE</span>
              <div class="rbac-trigger-name-row" style="gap: 0.45rem; flex-wrap: wrap;">
                <span class="rbac-trigger-name" style="font-size: 0.95rem; font-weight: 700;">${selectedVeh ? selectedVeh.vehicle_name : 'All Vehicles'}</span>
                ${selectedVeh ? `
                  <span class="badge" style="font-size: 0.68rem; font-family: monospace; background: #0F172A; color: #FFFFFF; padding: 2px 6px;">
                    ${selectedVeh.reg_number}
                  </span>
                  <span class="badge" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-size: 0.68rem; font-weight: 700;">
                    ${normalizeVehicleCategory(selectedVeh.vehicle_type)}
                  </span>
                ` : `
                  <span class="badge" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-size: 0.68rem; font-weight: 700;">
                    ${vehicles.length} Vehicles in Fleet
                  </span>
                  <span class="badge" style="font-size: 0.68rem; background: #0F172A; color: #FFFFFF; padding: 2px 6px;">
                    All Fleet
                  </span>
                `}
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

      <!-- Quick KPI Strip (Equal size rectangles, close gap, zero excess spacing) -->
      <div class="alltrips-kpi-grid" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; margin-bottom: 0.75rem;">
        <div class="card-panel alltrips-kpi-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem 0.75rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; min-height: 62px; box-sizing: border-box;">
          <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;">Total Trips</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem; line-height: 1.2;">${targetTrips.length}</div>
        </div>
        <div class="card-panel alltrips-kpi-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem 0.75rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; min-height: 62px; box-sizing: border-box;">
          <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;">Total Distance</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #4F46E5; font-family: monospace; margin-top: 0.2rem; line-height: 1.2;">${totalKm.toLocaleString('en-IN')} KM</div>
        </div>
        <div class="card-panel alltrips-kpi-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem 0.75rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; min-height: 62px; box-sizing: border-box;">
          <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;">Total Billed</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem; line-height: 1.2;">${formatCurrency(totalBilled)}</div>
        </div>
        <div class="card-panel alltrips-kpi-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem 0.75rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; min-height: 62px; box-sizing: border-box;">
          <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;">Outstanding Dues</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: ${totalUnpaid > 0 ? '#DC2626' : '#059669'}; margin-top: 0.2rem; line-height: 1.2;">${formatCurrency(totalUnpaid)}</div>
          <div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${unpaidCount} unpaid trip(s)</div>
        </div>
      </div>

      <!-- Filter Controls & Staff/Driver Dropdown (Arranged cleanly on a single screen without overflow) -->
      <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1rem; width: 100%;">
        <!-- Filter Tabs: 4-Column Equal Grid fitting 100% on any mobile screen -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; background: #F1F5F9; padding: 3px; border-radius: 8px; border: 1px solid var(--border-medium); gap: 3px; box-sizing: border-box;">
          <button type="button" class="btn-alltrips-filter ${activeFilter === 'all' ? 'active' : ''}" data-filter="all" style="border: none; background: ${activeFilter === 'all' ? '#4F46E5' : 'transparent'}; color: ${activeFilter === 'all' ? '#FFF' : '#64748B'}; font-weight: ${activeFilter === 'all' ? '700' : '600'}; font-size: 0.76rem; padding: 6px 2px; border-radius: 6px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;">
            All ${targetTrips.length > 0 ? `(${targetTrips.length})` : ''}
          </button>
          <button type="button" class="btn-alltrips-filter ${activeFilter === 'unpaid' ? 'active' : ''}" data-filter="unpaid" style="border: none; background: ${activeFilter === 'unpaid' ? '#DC2626' : 'transparent'}; color: ${activeFilter === 'unpaid' ? '#FFF' : '#64748B'}; font-weight: ${activeFilter === 'unpaid' ? '700' : '600'}; font-size: 0.76rem; padding: 6px 2px; border-radius: 6px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;">
            Unpaid ${unpaidCount > 0 ? `(${unpaidCount})` : ''}
          </button>
          <button type="button" class="btn-alltrips-filter ${activeFilter === 'paid' ? 'active' : ''}" data-filter="paid" style="border: none; background: ${activeFilter === 'paid' ? '#059669' : 'transparent'}; color: ${activeFilter === 'paid' ? '#FFF' : '#64748B'}; font-weight: ${activeFilter === 'paid' ? '700' : '600'}; font-size: 0.76rem; padding: 6px 2px; border-radius: 6px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;">
            Paid
          </button>
          <button type="button" class="btn-alltrips-filter ${activeFilter === 'active' ? 'active' : ''}" data-filter="active" style="border: none; background: ${activeFilter === 'active' ? '#2563EB' : 'transparent'}; color: ${activeFilter === 'active' ? '#FFF' : '#64748B'}; font-weight: ${activeFilter === 'active' ? '700' : '600'}; font-size: 0.76rem; padding: 6px 2px; border-radius: 6px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box;">
            Active
          </button>
        </div>

        <!-- Staff / Driver Dropdown Filter -->
        <div style="position: relative; width: 100%; box-sizing: border-box;">
          <select id="alltrips-driver-filter" class="form-control" style="width: 100%; font-size: 0.85rem; font-weight: 600; padding: 0.48rem 0.75rem; border-radius: 8px; border: 1.5px solid #CBD5E1; background: #FFFFFF; color: #1E293B; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <option value="">All Staff & Drivers</option>
            ${eligibleUsers.map(u => `
              <option value="${u.id}" ${u.id === selectedDriverId ? 'selected' : ''}>
                ${u.full_name || u.name}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- MASTER TABLE: MOBILE-OPTIMIZED & COMPACT (NO HORIZONTAL SCROLLBAR OVERFLOW) -->
      <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 0.5rem; box-shadow: var(--shadow-sm); overflow: hidden; margin-bottom: 2rem;">
        ${filteredTrips.length === 0 ? `
          <div style="padding: 3rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            No trips matching this view or search filter.
          </div>
        ` : `
          <div class="table-responsive" style="overflow-x: hidden; width: 100%;">
            <table class="data-table all-trips-table" style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 0.8rem;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                  <!-- 1st Column: STAFF / DRIVER (32%) -->
                  <th style="padding: 0.55rem 0.45rem; font-weight: 700; color: #1E293B; width: 33%;">
                    Staff / Driver
                  </th>
                  <!-- 2nd Column: DATE & VEHICLE (33%) -->
                  <th style="padding: 0.55rem 0.45rem; font-weight: 700; color: #1E293B; width: 33%;">
                    Date & Vehicle
                  </th>
                  <!-- 3rd Column: KM, AMOUNT & PAYMENT ACTION (34%, RIGHT) -->
                  <th style="padding: 0.55rem 0.45rem; font-weight: 700; color: #1E293B; width: 34%; text-align: right;">
                    KM & Amount / Pay
                  </th>
                </tr>
              </thead>
              <tbody>
                ${filteredTrips.map(t => {
                  const veh = vehicles.find(v => v.id === t.vehicle_id);
                  const isCompleted = t.status === 'Completed';
                  const isPaid = t.payment_status === 'Paid';
                  const isPartial = t.payment_status === 'Partial';
                  const totalAmt = Number(t.total_amount) || 0;
                  const paidAmt = Number(t.amount_paid) || (isPaid ? totalAmt : 0);
                  const remainingDue = Math.max(0, totalAmt - paidAmt);
                  const tripDateStr = formatDate(t.start_time || t.created_at);

                  return `
                    <tr class="all-trips-row ${isCompleted && !isPaid ? 'has-due' : ''}" 
                      data-id="${t.id}" 
                      data-code="${t.trip_id}"
                      data-total="${totalAmt}"
                      data-due="${remainingDue}"
                      data-user="${t.user_name || 'Staff'}"
                      data-completed="${isCompleted}"
                      data-paid="${isPaid}"
                      style="border-bottom: 1px solid var(--border-subtle); vertical-align: top; cursor: ${isCompleted && !isPaid ? 'pointer' : 'default'}; transition: background 0.15s;" 
                      onmouseover="this.style.background='var(--bg-surface-subtle)'" 
                      onmouseout="this.style.background='transparent'">
                      <!-- 1ST COLUMN: NAME & CODE -->
                      <td style="padding: 0.55rem 0.45rem; min-width: 0; overflow: hidden;">
                        <div style="font-weight: 700; color: #0F172A; font-size: 0.84rem; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${t.user_name || 'Driver / Staff'}
                        </div>
                        <div style="margin-top: 0.2rem; display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;">
                          <span style="font-family: monospace; font-size: 0.65rem; color: var(--text-muted);">
                            ${t.trip_id}
                          </span>
                        </div>
                        ${t.destination ? `
                          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${t.destination}">
                            📍 ${t.destination}
                          </div>
                        ` : ''}
                      </td>

                      <!-- 2ND COLUMN: DATE & VEHICLE -->
                      <td style="padding: 0.55rem 0.45rem; min-width: 0; overflow: hidden;">
                        <div style="font-weight: 600; color: var(--text-main); font-size: 0.78rem; line-height: 1.25;">
                          ${tripDateStr}
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.25rem; margin-top: 0.2rem; flex-wrap: wrap;">
                          <span style="color: #4F46E5; font-weight: 700; font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                            ${getVehicleTypeIcon(veh?.vehicle_type)} ${veh?.vehicle_name || 'Vehicle'}
                          </span>
                          <span style="font-family: monospace; font-size: 0.64rem; background: #0F172A; color: #FFF; padding: 1px 4px; border-radius: 3px;">
                            ${veh?.reg_number || ''}
                          </span>
                        </div>
                      </td>

                      <!-- 3RD COLUMN: DISTANCE, AMOUNT & PAYMENT ACTION -->
                      <td style="padding: 0.55rem 0.45rem; text-align: right; min-width: 0;">
                        <div style="font-family: monospace; font-weight: 700; font-size: 0.82rem; color: #0F172A;">
                          ${t.total_km !== null && t.total_km !== undefined ? `${t.total_km} KM` : (t.status === 'In Progress' ? '<span style="color: #2563EB;">Driving</span>' : '—')}
                        </div>
                        <div style="margin-top: 0.1rem;">
                          <span style="font-weight: 800; font-size: 0.9rem; color: ${isPaid ? '#059669' : (totalAmt > 0 ? '#DC2626' : 'var(--text-main)')};">
                            ${totalAmt > 0 ? formatCurrency(totalAmt) : '₹0.00'}
                          </span>
                          ${t.applied_rate_per_km ? `
                            <div style="font-size: 0.64rem; color: var(--text-muted);">
                              @ ₹${Number(t.applied_rate_per_km).toFixed(2)}/km
                            </div>
                          ` : ''}
                        </div>

                        <!-- Integrated Payment Status & Settle Button (Like Student Leave Card) -->
                        <div style="margin-top: 0.25rem;">
                          ${!isCompleted ? `
                            <span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.65rem; padding: 1px 5px;">
                              ${t.status}
                            </span>
                          ` : isPaid ? `
                            <div>
                              <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700; padding: 1px 5px; display: inline-block;">
                                ✓ Paid
                              </span>
                              ${t.payment_received_by ? `
                                <div style="font-size: 0.6rem; color: #047857; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Received by ${t.payment_received_by}">
                                  By: ${t.payment_received_by}
                                </div>
                              ` : ''}
                            </div>
                          ` : isPartial ? `
                            <div>
                              <button type="button" class="btn btn-sm btn-outline btn-master-settle" 
                                data-id="${t.id}" 
                                data-code="${t.trip_id}"
                                data-total="${totalAmt}"
                                data-due="${remainingDue}"
                                data-user="${t.user_name || 'Staff'}"
                                style="color: #D97706; border-color: #FDE68A; background: #FEF3C7; font-size: 0.68rem; padding: 2px 6px; font-weight: 700; border-radius: 5px; white-space: nowrap;">
                                Pay Bal ₹${remainingDue}
                              </button>
                            </div>
                          ` : `
                            <div>
                              <button type="button" class="btn btn-sm btn-primary btn-master-settle" 
                                data-id="${t.id}" 
                                data-code="${t.trip_id}"
                                data-total="${totalAmt}"
                                data-due="${remainingDue}"
                                data-user="${t.user_name || 'Staff'}"
                                style="background: #059669; border-color: #059669; font-size: 0.72rem; padding: 2px 8px; font-weight: 700; border-radius: 5px; white-space: nowrap; box-shadow: 0 1px 3px rgba(5,150,105,0.25);">
                                Pay / Settle
                              </button>
                            </div>
                          `}
                        </div>
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
    // 1. Vehicle Filter Selector Modal Dialog (All Vehicles + individual vehicles)
    container.querySelector('#sec-alltrips-vehicle-trigger')?.addEventListener('click', () => {
      openModal({
        title: 'Filter Ledger by Vehicle',
        modalClass: 'role-picker-modal-dialog',
        contentHtml: `
          <div style="margin-bottom: 0.5rem;">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Select a vehicle to filter the master ledger, or choose All Vehicles for fleet-wide records:
            </p>
            <div class="role-picker-list">
              <!-- All Vehicles Option -->
              <div class="role-picker-item ${!selectedVehicleId ? 'active' : ''}" data-veh-id="" role="button" tabindex="0" style="cursor: pointer; padding: 0.85rem 1rem;">
                <div class="role-picker-item-left" style="gap: 0.85rem;">
                  <div class="role-picker-item-icon" style="background: #EEF2FF; color: #4F46E5; border: 1.5px solid #C7D2FE; width: 44px; height: 44px; border-radius: 8px; overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span style="font-size: 1.35rem;">🚐</span>
                  </div>
                  <div class="role-picker-item-info">
                    <div class="role-picker-item-title-row" style="gap: 0.45rem; flex-wrap: wrap;">
                      <span class="role-picker-item-name" style="font-weight: 700; font-size: 0.92rem;">All Vehicles</span>
                      <span class="badge" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-size: 0.65rem; font-weight: 700;">Fleet-wide</span>
                      ${!selectedVehicleId ? `<span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">SELECTED</span>` : ''}
                    </div>
                    <div class="role-picker-item-desc" style="font-size: 0.78rem; color: #64748B; margin-top: 0.2rem;">
                      Show consolidated trips across all ${vehicles.length} vehicles
                    </div>
                  </div>
                </div>
                <div class="role-picker-item-radio">
                  <div class="role-radio-circle ${!selectedVehicleId ? 'active' : ''}">
                    ${!selectedVehicleId ? `<div class="role-radio-dot"></div>` : ''}
                  </div>
                </div>
              </div>

              <!-- Individual Vehicles -->
              ${vehicles.filter(v => v.status !== 'Inactive').map(v => {
                const isSelected = v.id === selectedVehicleId;
                const vehCategory = normalizeVehicleCategory(v.vehicle_type);
                const vehIcon = getVehicleTypeIcon(v.vehicle_type);

                return `
                  <div class="role-picker-item ${isSelected ? 'active' : ''}" data-veh-id="${v.id}" role="button" tabindex="0" style="cursor: pointer; padding: 0.85rem 1rem;">
                    <div class="role-picker-item-left" style="gap: 0.85rem;">
                      <div class="role-picker-item-icon" style="background: #EEF2FF; color: #4F46E5; border: 1.5px solid #C7D2FE; width: 44px; height: 44px; border-radius: 8px; overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${v.photo_url ? `
                          <img src="${v.photo_url}" alt="${v.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                        ` : `
                          <span style="font-size: 1.35rem;">${vehIcon}</span>
                        `}
                      </div>
                      <div class="role-picker-item-info">
                        <div class="role-picker-item-title-row" style="gap: 0.45rem; flex-wrap: wrap;">
                          <span class="role-picker-item-name" style="font-weight: 700; font-size: 0.92rem;">${v.vehicle_name}</span>
                          <span class="badge" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-size: 0.65rem; font-weight: 700;">${vehCategory}</span>
                          ${isSelected ? `<span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">SELECTED</span>` : ''}
                          <span class="badge" style="font-size: 0.65rem; font-family: monospace; background: #0F172A; color: #FFF; padding: 1px 5px;">${v.reg_number}</span>
                        </div>
                        <div class="role-picker-item-desc" style="font-size: 0.78rem; color: #64748B; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <strong style="color: #4F46E5;">₹${Number(v.fallback_rate_per_km || 15).toFixed(2)} / KM</strong>
                          <span>•</span>
                          <span>Odo: ${Number(v.current_odometer || 0).toLocaleString('en-IN')} KM</span>
                        </div>
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
              const vid = item.getAttribute('data-veh-id') || '';
              selectedVehicleId = vid;
              close();
              render();
            });
          });
        }
      });
    });

    // Header navigations
    container.querySelector('#btn-alltrips-user-card')?.addEventListener('click', () => {
      if (onNavigate) {
        if (selectedDriverId) {
          onNavigate('vehicle_card', { userId: selectedDriverId });
        } else {
          onNavigate('vehicle_card');
        }
      }
    });
    container.querySelector('#btn-alltrips-book')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_trips');
    });
    container.querySelector('#btn-alltrips-fleet')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicles');
    });

    // Filter Buttons
    container.querySelectorAll('.btn-alltrips-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    // Staff / Driver Dropdown Filter
    const driverSelect = container.querySelector('#alltrips-driver-filter');
    driverSelect?.addEventListener('change', (e) => {
      selectedDriverId = e.target.value;
      render();
    });

    // Settle Payment Action Modal (Supports Full and Partial Payments)
    container.querySelectorAll('.btn-master-settle').forEach(btn => {
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

    // Row click to inspect trip details, settle payment, or delete trip
    container.querySelectorAll('.all-trips-row').forEach(row => {
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

  // Payment Settlement Modal & Trip Details Popup (With Student Leave Card Full / Partial Options & Delete Option)
  function openSettlePaymentModal({ tripId, tripCode, remainingDue, totalAmount, userName }) {
    const targetTrip = allTrips.find(t => t.id === tripId || t.trip_id === tripCode);
    const isInProgress = targetTrip?.status === 'In Progress';
    const isCompleted = targetTrip?.status === 'Completed' || (!isInProgress && targetTrip?.status !== 'Pending Approval');
    const isPaid = isCompleted && remainingDue <= 0;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel modal-mobile-responsive" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 480px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">${isPaid ? 'Trip Details & Receipt' : (isInProgress ? 'Active Trip Details' : 'Record Trip Settlement')}</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <form id="form-master-settle-payment" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <!-- Scrollable Form Body -->
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            ${isInProgress ? `
              <div style="background: #EFF6FF; border: 1.5px solid #93C5FD; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.72rem; color: #1E40AF; font-weight: 700;">JOURNEY STATUS</div>
                    <div style="font-size: 1.1rem; color: #1E3A8A; font-weight: 800;">🚗 In Progress</div>
                    <div style="font-family: monospace; font-size: 0.8rem; color: #3B82F6; margin-top: 0.15rem;">${tripCode}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.72rem; color: #1E40AF; font-weight: 700;">START ODOMETER</div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: #1E40AF; font-family: monospace;">${targetTrip?.start_km || 0} KM</div>
                  </div>
                </div>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.85rem;">
                Destination: <strong>${targetTrip?.destination || 'Local Ride'}</strong><br/>
                Driver / User: <strong>${userName}</strong><br/>
                Locked Rate: <strong>₹${Number(targetTrip?.applied_rate_per_km || 16).toFixed(2)}/km</strong>
              </div>
            ` : isPaid ? `
              <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.72rem; color: #065F46; font-weight: 700;">PAYMENT STATUS</div>
                    <div style="font-size: 1.1rem; color: #065F46; font-weight: 800;">✓ Fully Settled</div>
                    <div style="font-family: monospace; font-size: 0.8rem; color: #059669; margin-top: 0.15rem;">${tripCode}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.72rem; color: #065F46; font-weight: 700;">TOTAL BILLED</div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #059669;">${formatCurrency(totalAmount)}</div>
                  </div>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.84rem; margin-bottom: 0.85rem;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.35rem;">
                  <span style="color: var(--text-muted);">Payer User</span>
                  <strong>${userName}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.35rem;">
                  <span style="color: var(--text-muted);">Distance Traveled</span>
                  <span style="font-family: monospace; font-weight: 700;">${targetTrip?.total_km || 0} KM</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.35rem;">
                  <span style="color: var(--text-muted);">Settlement Method</span>
                  <span>${targetTrip?.payment_method || 'Cash'}</span>
                </div>
                ${targetTrip?.payment_received_by ? `
                  <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.35rem;">
                    <span style="color: var(--text-muted);">Received By Admin</span>
                    <strong style="color: #065F46;">✓ ${targetTrip.payment_received_by}</strong>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.72rem; color: #065F46; font-weight: 600;">STAFF / DRIVER</div>
                    <div style="font-size: 0.95rem; color: var(--text-main); font-weight: 700;">${userName}</div>
                    <div style="font-family: monospace; font-size: 0.75rem; color: #4F46E5; margin-top: 0.15rem;">${tripCode}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.72rem; color: #065F46; font-weight: 600;">OUTSTANDING DUE</div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #DC2626;">${formatCurrency(remainingDue)}</div>
                  </div>
                </div>
              </div>

              <!-- Payment Options Strip (Full vs Partial like Student Leave Card) -->
              <div style="margin-bottom: 0.85rem;">
                <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem; display: block;">Select Payment Option</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <label id="label-pay-full" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #059669; background: #ECFDF5; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #065F46;">
                    <input type="radio" name="trip_pay_option" value="full" checked style="accent-color: #059669;" />
                    Full Payment
                  </label>
                  <label id="label-pay-partial" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #E2E8F0; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #334155;">
                    <input type="radio" name="trip_pay_option" value="partial" style="accent-color: #D97706;" />
                    Partial Payment
                  </label>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0.85rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.25rem;">
                  Amount Paying Now (₹) *
                </label>
                <input type="number" id="master-pay-amount" class="form-control" step="0.5" min="1" max="${remainingDue}" value="${remainingDue}" readonly required style="width: 100%; height: 40px; font-size: 1rem; font-weight: 700; color: #059669;" />
                <div id="trip-pay-balance-preview" style="font-size: 0.76rem; font-weight: 600; color: #059669; margin-top: 0.35rem; padding: 4px 8px; background: #F0FDF4; border-radius: 6px; border: 1px solid #BBF7D0;">
                  Remaining balance after payment: <strong>₹0.00</strong>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0.85rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Payment Method *</label>
                <select id="master-pay-method" class="form-control" required style="width: 100%; height: 40px; font-size: 0.84rem;">
                  <option value="Cash">Cash (Received at Office)</option>
                  <option value="Google Pay">Google Pay</option>
                  <option value="PhonePe">PhonePe</option>
                  <option value="UPI / QR Scan">UPI / QR Scan</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                  <option value="Salary Deduction">Staff Salary Deduction</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 0.5rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Transaction Ref / Receipt Note</label>
                <input type="text" id="master-pay-notes" class="form-control" placeholder="e.g. UPI Ref / Cash receipt / note" style="width: 100%; height: 40px; font-size: 0.84rem;" />
              </div>
            `}
          </div>

          <!-- Frozen Bottom Action Bar with Delete Option -->
          <div style="flex-shrink: 0; padding: 0.75rem 0.85rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; background: var(--bg-surface-subtle); z-index: 10;">
            <button type="button" id="btn-master-delete-trip" class="btn btn-outline" style="color: #DC2626; border-color: #FECACA; background: #FFF5F5; font-weight: 600; padding: 0.45rem 0.65rem; font-size: 0.8rem; white-space: nowrap;">
              🗑️ Delete
            </button>
            <div style="display: flex; gap: 0.45rem; align-items: center; justify-content: flex-end; flex: 1; min-width: 0;">
              <button type="button" class="btn btn-secondary btn-close-modal" style="font-size: 0.82rem; padding: 0.45rem 0.65rem; white-space: nowrap;">${isPaid || isInProgress ? 'Close' : 'Cancel'}</button>
              ${!isPaid && !isInProgress ? `
                <button type="submit" id="btn-master-confirm-settle" class="btn btn-primary" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 0.84rem; padding: 0.45rem 0.85rem; white-space: nowrap;">
                  Record Payment
                </button>
              ` : ''}
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    // Delete trip handler
    modalOverlay.querySelector('#btn-master-delete-trip')?.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Delete Trip',
        message: `Permanently delete trip ${tripCode}? This will remove this trip and any recorded settlement.`,
        confirmText: 'Delete Trip',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        if (targetTrip?.vehicle_id) {
          const veh = vehicles.find(v => v.id === targetTrip.vehicle_id);
          if (veh && veh.status === 'On Trip') {
            veh.status = 'Available';
            await db.saveVehicle(veh);
          }
        }
        await db.deleteTripLog(tripId);
        const freshTrips = await db.getTripLogs();
        vehicles = await db.getVehicles();
        modalOverlay.remove();
        toast.success(`Trip ${tripCode} deleted successfully.`);
        allTrips = freshTrips;
        render();
      }
    });

    const fullRadio = modalOverlay.querySelector('input[value="full"]');
    const partialRadio = modalOverlay.querySelector('input[value="partial"]');
    const labelFull = modalOverlay.querySelector('#label-pay-full');
    const labelPartial = modalOverlay.querySelector('#label-pay-partial');
    const payAmtInput = modalOverlay.querySelector('#master-pay-amount');
    const balPreview = modalOverlay.querySelector('#trip-pay-balance-preview');
    const confirmBtn = modalOverlay.querySelector('#btn-master-confirm-settle');

    function updatePayModeUI() {
      if (fullRadio.checked) {
        labelFull.style.borderColor = '#059669';
        labelFull.style.background = '#ECFDF5';
        labelFull.style.color = '#065F46';
        labelPartial.style.borderColor = '#E2E8F0';
        labelPartial.style.background = '#FFFFFF';
        labelPartial.style.color = '#334155';
        payAmtInput.value = remainingDue;
        payAmtInput.readOnly = true;
        balPreview.innerHTML = 'Remaining balance after payment: <strong style="color: #059669;">₹0.00</strong>';
        if (confirmBtn) confirmBtn.textContent = 'Record Payment';
      } else {
        labelFull.style.borderColor = '#E2E8F0';
        labelFull.style.background = '#FFFFFF';
        labelFull.style.color = '#334155';
        labelPartial.style.borderColor = '#D97706';
        labelPartial.style.background = '#FFFBEB';
        labelPartial.style.color = '#92400E';
        payAmtInput.readOnly = false;
        payAmtInput.focus();
        updateBalancePreview();
      }
    }

    function updateBalancePreview() {
      const val = parseFloat(payAmtInput.value) || 0;
      const rem = Math.max(0, remainingDue - val);
      balPreview.innerHTML = 'Remaining balance after payment: <strong style="color: ' + (rem > 0 ? '#DC2626' : '#059669') + ';">₹' + rem.toFixed(2) + '</strong>';
      if (confirmBtn) confirmBtn.textContent = 'Record Payment';
    }

    fullRadio?.addEventListener('change', updatePayModeUI);
    partialRadio?.addEventListener('change', updatePayModeUI);
    payAmtInput?.addEventListener('input', updateBalancePreview);

    modalOverlay.querySelector('#form-master-settle-payment').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountToPay = parseFloat(modalOverlay.querySelector('#master-pay-amount').value) || 0;
      const method = modalOverlay.querySelector('#master-pay-method').value;
      const notes = modalOverlay.querySelector('#master-pay-notes').value.trim();

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
      
      allTrips = freshTrips;
      render();
    });
  }

  // Initial render
  render();
}
