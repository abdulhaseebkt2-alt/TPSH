import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { 
  calculateDynamicRatePerKm, 
  calculateTripBill 
} from '../../lib/fleet-engine.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

export async function renderUserVehicleTripsModule(container, { onNavigate }) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    container.innerHTML = `<div class="p-4 text-center">Please log in to view vehicle trips.</div>`;
    return;
  }

  // Load data
  let vehicles = await db.getVehicles();
  let expenses = await db.getVehicleExpenses();
  let allTrips = await db.getTripLogs();

  function render() {
    // Current user's trips
    const userTrips = allTrips.filter(t => t.user_id === currentUser.id || t.user_name === currentUser.full_name);

    // Active trip (Pending Approval, Approved, or In Progress)
    const activeTrip = userTrips.find(t => ['Pending Approval', 'Approved', 'In Progress'].includes(t.status));

    // KPI Metrics for user
    const completedTrips = userTrips.filter(t => t.status === 'Completed');
    const pendingDues = completedTrips
      .filter(t => t.payment_status === 'Unpaid')
      .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalPaid = completedTrips
      .filter(t => t.payment_status === 'Paid')
      .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalKmDriven = completedTrips.reduce((sum, t) => sum + (Number(t.total_km) || 0), 0);

    const isAdmin = currentUser.is_super_admin || currentUser.role === 'super_admin' || currentUser.role === 'admin';

    container.innerHTML = `
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Vehicle Booking & Personal Trip Dues</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                Logged in as <strong>${currentUser.full_name}</strong> (${currentUser.role}) • 100% Billable Usage System
              </p>
            </div>
          </div>
        </div>

        <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${isAdmin ? `
            <button class="btn btn-secondary" id="btn-back-fleet-admin">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              Fleet Management Console
            </button>
          ` : ''}
          <button class="btn btn-primary" id="btn-scroll-to-book">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Book a Vehicle
          </button>
        </div>
      </div>

      <!-- Policy Banner: 100% Billable Usage (Strictly Personal / Billable Use) -->
      <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.65rem;">
        <span style="font-size: 1.25rem;">ℹ️</span>
        <div style="font-size: 0.82rem; color: #92400E; line-height: 1.4;">
          <strong>Institutional Vehicle Policy:</strong> All vehicle usage in this module is strictly for <strong>Personal / Billable Use</strong>. Completed trips automatically compute personal dues based on actual kilometers driven and the vehicle's dynamic rate. Settle dues with school administration.
        </div>
      </div>

      <!-- SECTION 2: ACTIVE TRIP CONTROL BOX (STATE TRANSITION LIFECYCLE) -->
      ${renderActiveTripBox(activeTrip)}

      <!-- SECTION 3: MY DUES & KPI SUMMARY CARDS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1.15rem; box-shadow: var(--shadow-sm);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Pending Dues</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: ${pendingDues > 0 ? '#DC2626' : '#059669'}; margin-top: 0.25rem;">
            ${formatCurrency(pendingDues)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">
            ${pendingDues > 0 ? '⚠️ Unsettled trips awaiting payment' : '✓ No outstanding payments'}
          </div>
        </div>

        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1.15rem; box-shadow: var(--shadow-sm);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Paid to Date</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #059669; margin-top: 0.25rem;">
            ${formatCurrency(totalPaid)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">
            Verified and audited settlements
          </div>
        </div>

        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1.15rem; box-shadow: var(--shadow-sm);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Distance Driven</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #4F46E5; margin-top: 0.25rem; font-family: monospace;">
            ${totalKmDriven.toLocaleString('en-IN')} <span style="font-size: 0.85rem; font-weight: normal;">KM</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">
            Across ${completedTrips.length} completed trips
          </div>
        </div>

        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1.15rem; box-shadow: var(--shadow-sm);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Trips Logged</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">
            ${userTrips.length}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">
            Personal usage history
          </div>
        </div>
      </div>

      <!-- SECTION 1: BOOK A VEHICLE (FORM & REAL-TIME AVAILABILITY) -->
      <div id="section-book-vehicle" class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.75rem; box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Section 1: Book a Vehicle for Personal Trip</h3>
            <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
              Select an available school vehicle. Real-time rates are dynamically calculated based on rolling expenses and odometer history.
            </p>
          </div>
        </div>

        <form id="form-book-vehicle">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.35rem;">
              Choose Vehicle * (Shows Real-Time Live Status, Current Odometer, and Dynamic ₹/KM Rate)
            </label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
              ${vehicles.filter(v => v.status !== 'Inactive').map(v => {
                const dynamic = calculateDynamicRatePerKm(v, expenses, allTrips);
                const isAvail = v.status === 'Available';

                return `
                  <label style="cursor: ${isAvail ? 'pointer' : 'not-allowed'}; border: 2px solid var(--border-subtle); border-radius: 8px; padding: 0.85rem; background: ${isAvail ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)'}; opacity: ${isAvail ? '1' : '0.6'}; display: block;" class="vehicle-select-card">
                    <input type="radio" name="selected_vehicle_id" value="${v.id}" data-rate="${dynamic.rate}" data-odo="${v.current_odometer}" ${isAvail ? '' : 'disabled'} style="margin-right: 0.5rem;" required />
                    <strong>${v.vehicle_name}</strong>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem; font-size: 0.78rem;">
                      <span style="font-family: monospace; background: #0F172A; color: #FFF; padding: 1px 6px; border-radius: 4px;">${v.reg_number}</span>
                      <span style="font-weight: 700; color: #4F46E5;">₹${dynamic.rate.toFixed(2)}/km</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem; font-size: 0.74rem; color: var(--text-muted);">
                      <span>Odo: ${Number(v.current_odometer || 0).toLocaleString('en-IN')} KM</span>
                      <span class="badge" style="font-size: 0.7rem; ${isAvail ? 'background: #ECFDF5; color: #059669;' : 'background: #FEF3C7; color: #D97706;'}">
                        ${v.status || 'Available'}
                      </span>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Destination / Route *</label>
              <input type="text" id="trip-destination" class="form-control" required placeholder="e.g. Kozhikode Medical College & Return" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Purpose of Personal Travel *</label>
              <input type="text" id="trip-purpose" class="form-control" required placeholder="e.g. Family medical appointment / Personal errand" style="width: 100%;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Departure Date & Time *</label>
              <input type="datetime-local" id="trip-start-time" class="form-control" required style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Expected Return Date & Time *</label>
              <input type="datetime-local" id="trip-end-time" class="form-control" required style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Estimated Round Distance (KM)</label>
              <input type="number" id="trip-est-km" class="form-control" min="1" placeholder="e.g. 75" style="width: 100%;" />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary" style="padding: 0.65rem 1.5rem; font-weight: 700;">
              Submit Trip Request for Admin Approval
            </button>
          </div>
        </form>
      </div>

      <!-- SECTION 3: MY COMPLETED TRIPS & DUES HISTORY TABLE -->
      <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
        <h3 style="margin: 0 0 1rem; font-size: 1.15rem; font-weight: 700;">My Trips & Settlement History</h3>

        ${userTrips.length === 0 ? `
          <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            You have not booked or completed any vehicle trips yet.
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-medium); text-align: left;">
                  <th style="padding: 0.65rem;">Trip ID</th>
                  <th style="padding: 0.65rem;">Date</th>
                  <th style="padding: 0.65rem;">Vehicle</th>
                  <th style="padding: 0.65rem;">Destination</th>
                  <th style="padding: 0.65rem;">Distance</th>
                  <th style="padding: 0.65rem;">Rate</th>
                  <th style="padding: 0.65rem;">Total Bill</th>
                  <th style="padding: 0.65rem;">Status / Audit Verification</th>
                </tr>
              </thead>
              <tbody>
                ${userTrips.map(t => {
                  const veh = vehicles.find(v => v.id === t.vehicle_id);

                  let statusBadge = '';
                  if (t.status === 'Pending Approval') {
                    statusBadge = `<span class="badge badge-warning">Pending Approval</span>`;
                  } else if (t.status === 'Approved') {
                    statusBadge = `<span class="badge" style="background: #EFF6FF; color: #2563EB;">Approved (Ready to Start)</span>`;
                  } else if (t.status === 'In Progress') {
                    statusBadge = `<span class="badge" style="background: #EEF2FF; color: #4F46E5;">In Progress</span>`;
                  } else if (t.status === 'Rejected') {
                    statusBadge = `<span class="badge badge-danger" title="${t.rejection_reason || ''}">Rejected</span>`;
                  } else if (t.status === 'Completed') {
                    if (t.payment_status === 'Paid') {
                      statusBadge = `
                        <div>
                          <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700;">
                            ✓ Paid (${t.payment_method || 'Settled'})
                          </span>
                          ${t.payment_received_by ? `
                            <div style="font-size: 0.72rem; color: #047857; margin-top: 0.15rem;">
                              Verified by: ${t.payment_received_by}
                            </div>
                          ` : ''}
                        </div>
                      `;
                    } else {
                      statusBadge = `
                        <div>
                          <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; font-weight: 700;">
                            Payment Due
                          </span>
                          <div style="font-size: 0.72rem; color: #B91C1C; margin-top: 0.15rem;">
                            Settle at Admin Office
                          </div>
                        </div>
                      `;
                    }
                  }

                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                      <td style="padding: 0.65rem; font-family: monospace; font-weight: 700;">${t.trip_id}</td>
                      <td style="padding: 0.65rem;">${formatDate(t.start_time || t.created_at)}</td>
                      <td style="padding: 0.65rem;">
                        <strong>${veh?.vehicle_name || 'Vehicle'}</strong>
                        <div style="font-family: monospace; font-size: 0.74rem; color: var(--text-muted);">${veh?.reg_number || ''}</div>
                      </td>
                      <td style="padding: 0.65rem;">
                        <div style="font-weight: 600;">${t.destination}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${t.purpose || ''}</div>
                      </td>
                      <td style="padding: 0.65rem; font-family: monospace;">
                        ${t.total_km !== null && t.total_km !== undefined ? `${t.total_km} KM` : '—'}
                      </td>
                      <td style="padding: 0.65rem;">
                        ${t.applied_rate_per_km ? `₹${Number(t.applied_rate_per_km).toFixed(2)}/km` : '—'}
                      </td>
                      <td style="padding: 0.65rem; font-weight: 800; font-size: 0.95rem; color: ${t.payment_status === 'Paid' ? '#059669' : (t.total_amount > 0 ? '#DC2626' : 'var(--text-main)')};">
                        ${t.total_amount ? formatCurrency(t.total_amount) : '—'}
                      </td>
                      <td style="padding: 0.65rem;">
                        ${statusBadge}
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

    attachEvents(activeTrip);
  }

  // Helper to render the Active Trip Control Box (Section 2)
  function renderActiveTripBox(activeTrip) {
    if (!activeTrip) return '';

    const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);

    if (activeTrip.status === 'Pending Approval') {
      return `
        <div class="card-panel" style="background: #FEF3C7; border: 2px solid #F59E0B; border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.25rem;">⏳</span>
                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #92400E;">Active Trip Control: Pending Admin Approval</h4>
              </div>
              <p style="margin: 0.35rem 0 0; font-size: 0.85rem; color: #78350F;">
                Trip <strong>${activeTrip.trip_id}</strong> to <strong>${activeTrip.destination}</strong> with <strong>${veh?.vehicle_name || 'vehicle'}</strong> (${veh?.reg_number}) is awaiting review by school administration. You will be able to enter starting odometer once approved.
              </p>
            </div>
            <button class="btn btn-sm btn-outline btn-cancel-trip" data-id="${activeTrip.id}" style="color: #DC2626; border-color: #FECACA;">
              Cancel Request
            </button>
          </div>
        </div>
      `;
    }

    if (activeTrip.status === 'Approved') {
      const minOdo = Number(veh?.current_odometer || 0);

      return `
        <div class="card-panel" style="background: #ECFDF5; border: 2px solid #10B981; border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
            <span style="font-size: 1.25rem;">🎉</span>
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #065F46;">
              Active Trip Control: Request Approved — Ready to Depart!
            </h4>
          </div>
          <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #047857;">
            Your trip <strong>${activeTrip.trip_id}</strong> is approved! Locked rate: <strong>₹${Number(activeTrip.applied_rate_per_km || 15).toFixed(2)}/km</strong>. Please verify and enter the starting odometer reading before you drive.
          </p>

          <form id="form-start-trip" style="display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #065F46; margin-bottom: 0.25rem;">
                Starting Odometer (KM) * (Vehicle Current: ${minOdo} KM)
              </label>
              <input type="number" id="start-km-input" class="form-control" required min="${minOdo}" value="${minOdo}" style="width: 220px; font-weight: 700; font-family: monospace;" />
            </div>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669; padding: 0.55rem 1.25rem; font-weight: 700;">
              Start Trip (Begin Journey)
            </button>
          </form>
        </div>
      `;
    }

    if (activeTrip.status === 'In Progress') {
      const startKm = Number(activeTrip.start_km || 0);
      const rate = Number(activeTrip.applied_rate_per_km || 15);

      return `
        <div class="card-panel" style="background: #EFF6FF; border: 2px solid #3B82F6; border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">🚗</span>
              <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1E40AF;">
                Active Trip Control: Journey In Progress
              </h4>
            </div>
            <span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700;">
              Started at ${startKm} KM • Rate: ₹${rate.toFixed(2)}/km
            </span>
          </div>

          <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #1E3A8A;">
            Destination: <strong>${activeTrip.destination}</strong> with <strong>${veh?.vehicle_name || 'Vehicle'}</strong> (${veh?.reg_number}). When you return to campus, enter the final odometer reading below to complete the trip and automatically compute your bill.
          </p>

          <form id="form-complete-trip" style="background: #FFFFFF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 1rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: flex-end;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1E40AF; margin-bottom: 0.25rem;">
                  Ending Odometer Reading (KM) * (Must be >= ${startKm})
                </label>
                <input type="number" id="end-km-input" class="form-control" required min="${startKm}" placeholder="e.g. ${startKm + 45}" style="width: 100%; font-weight: 700; font-family: monospace;" />
              </div>

              <!-- Live bill computation preview -->
              <div id="live-bill-calc-preview" style="font-size: 0.85rem; color: #1E40AF; padding: 0.5rem 0.75rem; background: #F8FAFC; border-radius: 6px; border: 1px dashed #CBD5E1;">
                <div>Distance: <strong id="preview-distance">0 KM</strong></div>
                <div>Estimated Bill: <strong id="preview-cost" style="color: #DC2626;">₹0.00</strong></div>
              </div>

              <div>
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.65rem 1rem; font-weight: 700; background: #2563EB;">
                  Complete Trip & Generate Bill
                </button>
              </div>
            </div>
          </form>
        </div>
      `;
    }

    return '';
  }

  function attachEvents(activeTrip) {
    // Back to fleet admin console (for admins)
    container.querySelector('#btn-back-fleet-admin')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicles');
    });

    // Scroll to booking form
    container.querySelector('#btn-scroll-to-book')?.addEventListener('click', () => {
      const el = container.querySelector('#section-book-vehicle');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });

    // Cancel trip request (Pending Approval)
    container.querySelector('.btn-cancel-trip')?.addEventListener('click', async () => {
      if (confirm('Cancel this pending trip request?')) {
        await db.deleteTripLog(activeTrip.id);
        allTrips = await db.getTripLogs();
        toast.info('Trip request cancelled.');
        render();
      }
    });

    // Booking submission
    container.querySelector('#form-book-vehicle')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (activeTrip) {
        toast.error('You already have an active or pending trip. Please complete or cancel it before booking another.');
        return;
      }

      const selectedRadio = container.querySelector('input[name="selected_vehicle_id"]:checked');
      if (!selectedRadio) {
        toast.error('Please select an available vehicle.');
        return;
      }

      const vehicleId = selectedRadio.value;
      const destination = container.querySelector('#trip-destination').value.trim();
      const purpose = container.querySelector('#trip-purpose').value.trim();
      const startTime = container.querySelector('#trip-start-time').value;
      const endTime = container.querySelector('#trip-end-time').value;
      const estKm = parseFloat(container.querySelector('#trip-est-km').value) || null;

      const veh = vehicles.find(v => v.id === vehicleId);
      const dynamicRateInfo = calculateDynamicRatePerKm(veh, expenses, allTrips);

      await db.saveTripLog({
        vehicle_id: vehicleId,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_role: currentUser.role,
        destination,
        purpose,
        start_time: startTime,
        end_time: endTime,
        estimated_km: estKm,
        applied_rate_per_km: dynamicRateInfo.rate,
        status: 'Pending Approval'
      });

      allTrips = await db.getTripLogs();
      toast.success('Trip request submitted! It will appear in the Admin Approval Queue.');
      render();
    });

    // Start Trip (Approved -> In Progress)
    container.querySelector('#form-start-trip')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const startKm = parseFloat(container.querySelector('#start-km-input').value);
      const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);

      if (isNaN(startKm) || startKm < Number(veh?.current_odometer || 0)) {
        toast.error(`Start KM cannot be less than vehicle's current odometer (${veh?.current_odometer || 0} KM).`);
        return;
      }

      activeTrip.start_km = startKm;
      activeTrip.status = 'In Progress';
      activeTrip.started_at = new Date().toISOString();

      // Update vehicle status to 'On Trip'
      if (veh) {
        veh.status = 'On Trip';
        await db.saveVehicle(veh);
      }

      await db.saveTripLog(activeTrip);
      allTrips = await db.getTripLogs();
      vehicles = await db.getVehicles();
      toast.success('Trip started! Drive safely.');
      render();
    });

    // In Progress: Live bill computation preview
    const endKmInput = container.querySelector('#end-km-input');
    const previewDistance = container.querySelector('#preview-distance');
    const previewCost = container.querySelector('#preview-cost');

    if (endKmInput && activeTrip?.status === 'In Progress') {
      const startKm = Number(activeTrip.start_km || 0);
      const rate = Number(activeTrip.applied_rate_per_km || 15);

      endKmInput.addEventListener('input', () => {
        const end = parseFloat(endKmInput.value);
        if (!isNaN(end) && end >= startKm) {
          const bill = calculateTripBill(startKm, end, rate);
          if (previewDistance) previewDistance.textContent = `${bill.totalKm} KM`;
          if (previewCost) previewCost.textContent = formatCurrency(bill.totalAmount);
        } else {
          if (previewDistance) previewDistance.textContent = '0 KM';
          if (previewCost) previewCost.textContent = '₹0.00';
        }
      });
    }

    // Complete Trip (In Progress -> Completed & Auto-billed)
    container.querySelector('#form-complete-trip')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const startKm = Number(activeTrip.start_km || 0);
      const endKm = parseFloat(endKmInput.value);
      const rate = Number(activeTrip.applied_rate_per_km || 15);

      if (isNaN(endKm) || endKm < startKm) {
        toast.error(`Ending odometer must be greater than or equal to starting odometer (${startKm} KM).`);
        return;
      }

      const bill = calculateTripBill(startKm, endKm, rate);

      activeTrip.end_km = endKm;
      activeTrip.total_km = bill.totalKm;
      activeTrip.total_amount = bill.totalAmount;
      activeTrip.status = 'Completed';
      activeTrip.payment_status = 'Unpaid';
      activeTrip.completed_at = new Date().toISOString();

      // Update vehicle status back to Available and odometer to end_km
      const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);
      if (veh) {
        veh.status = 'Available';
        veh.current_odometer = endKm;
        await db.saveVehicle(veh);
      }

      await db.saveTripLog(activeTrip);
      allTrips = await db.getTripLogs();
      vehicles = await db.getVehicles();

      // Show Instant Bill Summary Modal
      openBillSummaryModal({
        tripCode: activeTrip.trip_id,
        vehicleName: veh?.vehicle_name || 'Vehicle',
        regNumber: veh?.reg_number || '',
        startKm,
        endKm,
        totalKm: bill.totalKm,
        rate,
        totalAmount: bill.totalAmount
      });

      render();
    });
  }

  // --- MODAL: INSTANT TRIP BILL SUMMARY ---
  function openBillSummaryModal({ tripCode, vehicleName, regNumber, startKm, endKm, totalKm, rate, totalAmount }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 480px; box-shadow: var(--shadow-xl); overflow: hidden; text-align: center;">
        <div style="background: #059669; color: #FFFFFF; padding: 1.5rem 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Trip Completed Successfully!</h3>
          <p style="margin: 0.25rem 0 0; opacity: 0.9; font-size: 0.85rem;">Invoice Bill Generated • 100% Personal Usage</p>
        </div>

        <div style="padding: 1.5rem; text-align: left;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">Trip Reference</span>
            <strong style="font-family: monospace;">${tripCode}</strong>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">Vehicle</span>
            <strong>${vehicleName} (${regNumber})</strong>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">Odometer Span</span>
            <span style="font-family: monospace;">${startKm} KM → ${endKm} KM</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">Total Distance Driven</span>
            <strong style="font-family: monospace; font-size: 0.95rem;">${totalKm} KM</strong>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">Applied Dynamic Rate</span>
            <span>₹${rate.toFixed(2)} / KM</span>
          </div>

          <!-- Total Bill Box -->
          <div style="background: #F8FAFC; border: 2px solid #E2E8F0; border-radius: 8px; padding: 1rem; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 0.95rem;">Total Amount Due</span>
            <span style="font-size: 1.5rem; font-weight: 800; color: #DC2626;">${formatCurrency(totalAmount)}</span>
          </div>

          <div style="font-size: 0.76rem; color: #64748B; margin-top: 0.75rem; line-height: 1.4; text-align: center;">
            Please visit the administration office or scan the official school QR code to settle this trip bill.
          </div>

          <div style="margin-top: 1.25rem;">
            <button class="btn btn-primary btn-close-modal" style="width: 100%; padding: 0.65rem;">
              Close & View My Trips
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);
    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });
  }

  // Initial render
  render();
}
