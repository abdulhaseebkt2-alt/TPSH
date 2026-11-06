import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { 
  calculateDynamicRatePerKm, 
  calculateTripBill 
} from '../../lib/fleet-engine.js';
import { formatCurrency, formatDate, getTodayDateStr } from '../../lib/utils.js';
import { enhanceDateInput } from '../../components/date-picker.js';
import { attachWheelTimePicker } from '../../lib/wheelTimePicker.js';
import { openModal } from '../../lib/dialog.js';
import { normalizeVehicleCategory, getVehicleTypeIcon } from './index.js';

export async function renderUserVehicleTripsModule(container, { onNavigate } = {}) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    container.innerHTML = `<div class="p-4 text-center">Please log in to view vehicle trips.</div>`;
    return;
  }

  // Load data
  let vehicles = await db.getVehicles();
  let expenses = await db.getVehicleExpenses();
  let allTrips = await db.getTripLogs();

  // Active vehicle selection state
  const availableVehicles = vehicles.filter(v => v.status !== 'Inactive');
  let selectedVehicleId = availableVehicles[0]?.id || vehicles[0]?.id;

  function render() {
    // Current user's trips
    const userTrips = allTrips.filter(t => {
      if (!t) return false;
      const sId = String(currentUser?.id || '').trim().toLowerCase();
      const sTpsId = String(currentUser?.tps_id || '').trim().toLowerCase();
      const sEmail = String(currentUser?.email || '').trim().toLowerCase();
      const sName = String(currentUser?.full_name || '').trim().toLowerCase();
      const tUserId = String(t.user_id || '').trim().toLowerCase();
      const tUserEmail = String(t.user_email || '').trim().toLowerCase();
      const tUserName = String(t.user_name || '').trim().toLowerCase();
      return (
        (sId && tUserId === sId) ||
        (sTpsId && tUserId === sTpsId) ||
        (sEmail && (tUserId === sEmail || tUserEmail === sEmail)) ||
        (sName && tUserName === sName)
      );
    });

    // Active trip for this user (Pending Approval, Approved, or In Progress)
    const activeTrip = userTrips.find(t => ['Pending Approval', 'Approved', 'In Progress'].includes(t.status));

    // Get selected vehicle object
    let selectedVeh = vehicles.find(v => v.id === selectedVehicleId) || availableVehicles[0] || vehicles[0];
    if (selectedVeh) {
      selectedVehicleId = selectedVeh.id;
    }

    const dynamicRateInfo = selectedVeh ? calculateDynamicRatePerKm(selectedVeh, expenses, allTrips) : { rate: 16 };
    const isBike = normalizeVehicleCategory(selectedVeh?.vehicle_type) === '2 Wheeler';
    const isInstantAllowed = selectedVeh?.allow_instant_short_ride !== false;

    const isAdmin = currentUser.is_super_admin || currentUser.role === 'super_admin' || currentUser.role === 'admin';

    container.innerHTML = `
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.15);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Vehicle Booking & Short Ride</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                Logged in as <strong>${currentUser.full_name}</strong> (${currentUser.role === 'vehicle_user' ? 'Driver / Staff' : currentUser.role}) • 100% Personal Billable System
              </p>
            </div>
          </div>
        </div>

        <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-outline" id="btn-view-user-card" style="font-weight: 600; color: #4F46E5; border-color: #C7D2FE; background: #EEF2FF;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4"/><path d="M14 14h3"/></svg>
            My Ledger & Past Trips
          </button>
          ${isAdmin ? `
            <button class="btn btn-secondary" id="btn-all-trips-master" style="font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              All Trips Master
            </button>
            <button class="btn btn-secondary" id="btn-back-fleet-admin" style="font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              Fleet Console
            </button>
          ` : ''}
        </div>
      </div>

      <!-- ACTIVE TRIP CONTROL BOX (IF A TRIP IS PENDING OR RUNNING) -->
      ${renderActiveTripBox(activeTrip)}

      <!-- MAIN FORM CONTAINER (ONLY FORM, CLEAN & UNCLUTTERED) -->
      <div id="section-book-vehicle" class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Ride Booking Form</h3>
            <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
              Select a vehicle and start an instant meter-to-meter ride or schedule in advance.
            </p>
          </div>

          <!-- Ride Mode Toggle: Short Ride vs Scheduled Trip -->
          <div style="display: flex; background: #F1F5F9; padding: 3px; border-radius: 8px; border: 1px solid var(--border-medium);">
            <button type="button" class="btn-trip-mode active" data-mode="short" style="border: none; background: #4F46E5; color: #FFF; font-weight: 700; font-size: 0.78rem; padding: 6px 14px; border-radius: 6px; cursor: pointer;">
              ⚡ Instant Short Ride
            </button>
            <button type="button" class="btn-trip-mode" data-mode="scheduled" style="border: none; background: transparent; color: #64748B; font-weight: 600; font-size: 0.78rem; padding: 6px 14px; border-radius: 6px; cursor: pointer;">
              📅 Scheduled Trip
            </button>
          </div>
        </div>

        <!-- 1. VEHICLE SELECTOR CARD (MATCHING SECTIONS & CLASSROOMS DESIGN PATTERN) -->
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.4rem;">
            Assigned Vehicle
          </label>
          <div class="sections-mobile-card rbac-mobile-role-card" style="margin-bottom: 0.5rem;">
            <button type="button" class="rbac-mobile-role-trigger" id="sec-vehicle-trigger" aria-label="Select vehicle to ride">
              <div class="rbac-trigger-left" style="gap: 0.85rem;">
                <div class="rbac-trigger-icon" style="background: #EEF2FF; color: #4F46E5; border: 1.5px solid #C7D2FE; overflow: hidden; padding: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 8px;">
                  ${selectedVeh?.photo_url ? `
                    <img src="${selectedVeh.photo_url}" alt="${selectedVeh.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                  ` : `
                    <span style="font-size: 1.4rem;">${getVehicleTypeIcon(selectedVeh?.vehicle_type)}</span>
                  `}
                </div>
                <div class="rbac-trigger-text">
                  <span class="rbac-trigger-kicker">SELECTED VEHICLE</span>
                  <div class="rbac-trigger-name-row" style="gap: 0.5rem; flex-wrap: wrap;">
                    <span class="rbac-trigger-name" style="font-size: 0.95rem; font-weight: 700;">${selectedVeh ? selectedVeh.vehicle_name : 'Choose Vehicle'}</span>
                    <span class="rbac-trigger-badge" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-weight: 700;">
                      ₹${dynamicRateInfo.rate.toFixed(2)} / KM
                    </span>
                    <span class="badge" style="font-size: 0.68rem; font-family: monospace; background: #0F172A; color: #FFFFFF; padding: 2px 6px;">
                      ${selectedVeh ? selectedVeh.reg_number : ''}
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

          <!-- Vehicle Status & Permission Pill -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; padding: 0.4rem 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
            <div>
              Current Meter: <strong style="font-family: monospace; color: #0F172A;">${Number(selectedVeh?.current_odometer || 0).toLocaleString('en-IN')} KM</strong>
            </div>
            <div>
              ${isInstantAllowed ? `
                <span class="badge" style="background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; font-size: 0.7rem; font-weight: 700;">
                  ⚡ Instant Short Ride Permitted
                </span>
              ` : `
                <span class="badge" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-size: 0.7rem; font-weight: 700;">
                  🔒 Requires Admin Approval
                </span>
              `}
            </div>
          </div>
        </div>

        <form id="form-book-vehicle">
          <!-- Short Ride Instant Box (Default mode) -->
          <div id="short-ride-box" style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span style="font-size: 1.25rem;">⚡</span>
              <strong style="color: #3730A3; font-size: 0.98rem;">Short Ride Mode (Meter-to-Meter)</strong>
            </div>
            
            <p style="font-size: 0.8rem; color: #4338CA; margin: 0 0 1rem; line-height: 1.4;">
              ${isInstantAllowed 
                ? 'Enter your current starting meter reading (KM) and begin driving immediately. When you return, enter your ending meter reading to compute the exact bill.'
                : `Trips on <strong>${selectedVeh?.vehicle_name}</strong> require administrator review. Submitting below will log your start meter reading and send an approval request to the administration office.`}
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; align-items: flex-end;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E1B4B; margin-bottom: 0.3rem;">
                  Current Starting Meter Reading (KM) *
                </label>
                <input type="number" id="short-ride-start-km" class="form-control" required value="${selectedVeh?.current_odometer || 0}" min="${selectedVeh?.current_odometer || 0}" placeholder="e.g. ${selectedVeh?.current_odometer || 0}" style="width: 100%; font-weight: 700; font-family: monospace; font-size: 1.1rem; padding: 0.55rem 0.75rem;" />
              </div>
              <div>
                ${isInstantAllowed ? `
                  <button type="button" id="btn-start-short-ride" class="btn btn-primary" style="width: 100%; padding: 0.65rem 1rem; font-weight: 700; background: #4F46E5; border-color: #4F46E5; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                    🚀 Start Instant Short Ride
                  </button>
                ` : `
                  <button type="button" id="btn-start-short-ride" class="btn btn-primary" style="width: 100%; padding: 0.65rem 1rem; font-weight: 700; background: #D97706; border-color: #D97706;">
                    📩 Submit Request for Admin Approval
                  </button>
                `}
              </div>
            </div>

            ${!isInstantAllowed ? `
              <div style="margin-top: 0.85rem; font-size: 0.76rem; color: #92400E; display: flex; align-items: center; gap: 0.35rem;">
                <span>ℹ️</span> Note: Once an admin reviews and approves this request, your trip will be activated to start driving.
              </div>
            ` : ''}
          </div>

          <!-- Scheduled Booking Box (Shown when switched to Scheduled Trip) -->
          <div id="scheduled-booking-box" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Destination / Route *</label>
                <input type="text" id="trip-destination" class="form-control" placeholder="e.g. Kozhikode Medical College & Return" style="width: 100%;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Purpose of Personal Travel *</label>
                <input type="text" id="trip-purpose" class="form-control" placeholder="e.g. Personal errand / Family travel" style="width: 100%;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
              <!-- Departure Schedule -->
              <div style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.85rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #0F172A; margin-bottom: 0.5rem;">
                  🚀 Departure Schedule *
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.2rem;">Date</label>
                    <input type="date" id="trip-start-date" class="form-control" required value="${getTodayDateStr()}" style="width: 100%;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.2rem;">Time</label>
                    <input type="time" id="trip-start-clock" class="form-control" required value="08:00" style="width: 100%;" />
                  </div>
                </div>
              </div>

              <!-- Expected Return Schedule -->
              <div style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.85rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #0F172A; margin-bottom: 0.5rem;">
                  🏁 Expected Return *
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.2rem;">Date</label>
                    <input type="date" id="trip-end-date" class="form-control" required value="${getTodayDateStr()}" style="width: 100%;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.2rem;">Time</label>
                    <input type="time" id="trip-end-clock" class="form-control" required value="17:00" style="width: 100%;" />
                  </div>
                </div>
              </div>

              <!-- Estimated KM -->
              <div style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.85rem; display: flex; flex-direction: column; justify-content: center;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #0F172A; margin-bottom: 0.25rem;">
                  Estimated Distance (KM)
                </label>
                <input type="number" id="trip-est-km" class="form-control" min="1" placeholder="e.g. 75" style="width: 100%; margin-top: 0.25rem;" />
                <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">Approximate round-trip distance</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="btn btn-primary" style="padding: 0.65rem 1.5rem; font-weight: 700;">
                Submit Trip Request for Admin Approval
              </button>
            </div>
          </div>
        </form>
      </div>
    `;

    attachEvents(activeTrip);
  }

  // Helper to render the Active Trip Control Box
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
                Trip <strong>${activeTrip.trip_id}</strong> (${activeTrip.destination}) with <strong>${veh?.vehicle_name || 'Vehicle'}</strong> (${veh?.reg_number}) is awaiting review by school administration.
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
    // Top Navigation actions
    container.querySelector('#btn-view-user-card')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_card');
    });
    container.querySelector('#btn-all-trips-master')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_all_trips');
    });
    container.querySelector('#btn-back-fleet-admin')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicles');
    });

    // 1. VEHICLE SELECTOR MODAL DIALOG (MATCHING SECTIONS & CLASSROOMS MODAL PATTERN)
    container.querySelector('#sec-vehicle-trigger')?.addEventListener('click', () => {
      openModal({
        title: 'Select Vehicle to Ride',
        modalClass: 'role-picker-modal-dialog',
        contentHtml: `
          <div style="margin-bottom: 0.5rem;">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Choose an available school vehicle for your personal trip:
            </p>
            <div class="role-picker-list">
              ${vehicles.filter(v => v.status !== 'Inactive').map(v => {
                const isSelected = v.id === selectedVehicleId;
                const dynamic = calculateDynamicRatePerKm(v, expenses, allTrips);
                const vehCategory = normalizeVehicleCategory(v.vehicle_type);
                const vehIcon = getVehicleTypeIcon(v.vehicle_type);
                const isInstant = v.allow_instant_short_ride !== false;
                const isAvail = v.status === 'Available';

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
                          <strong style="color: #4F46E5;">₹${dynamic.rate.toFixed(2)} / KM</strong>
                          <span>•</span>
                          <span>Odo: ${Number(v.current_odometer || 0).toLocaleString('en-IN')} KM</span>
                          <span>•</span>
                          ${isInstant ? `
                            <span style="color: #166534; font-weight: 600;">⚡ Instant Short Ride</span>
                          ` : `
                            <span style="color: #B45309; font-weight: 600;">🔒 Approval Required</span>
                          `}
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
              const vid = item.getAttribute('data-veh-id');
              if (vid && vid !== selectedVehicleId) {
                selectedVehicleId = vid;
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

    // Ride Mode Toggle: Short Ride vs Scheduled
    let currentMode = 'short';
    const shortBox = container.querySelector('#short-ride-box');
    const scheduledBox = container.querySelector('#scheduled-booking-box');
    const startKmInput = container.querySelector('#short-ride-start-km');

    container.querySelectorAll('.btn-trip-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMode = btn.getAttribute('data-mode');
        container.querySelectorAll('.btn-trip-mode').forEach(b => {
          const isActive = b.getAttribute('data-mode') === currentMode;
          b.style.background = isActive ? '#4F46E5' : 'transparent';
          b.style.color = isActive ? '#FFF' : '#64748B';
          b.style.fontWeight = isActive ? '700' : '600';
        });

        if (shortBox) shortBox.style.display = currentMode === 'short' ? 'block' : 'none';
        if (scheduledBox) scheduledBox.style.display = currentMode === 'scheduled' ? 'block' : 'none';
      });
    });

    // Start / Request Short Ride Handler
    container.querySelector('#btn-start-short-ride')?.addEventListener('click', async () => {
      if (activeTrip) {
        toast.error('You already have an active or pending trip in progress. Please complete or cancel it first.');
        return;
      }

      const veh = vehicles.find(v => v.id === selectedVehicleId);
      if (!veh) {
        toast.error('Please select an available vehicle.');
        return;
      }

      const startKm = parseFloat(startKmInput.value);
      if (isNaN(startKm) || startKm < Number(veh.current_odometer || 0)) {
        toast.error(`Start meter reading cannot be less than current odometer (${veh.current_odometer || 0} KM).`);
        return;
      }

      const dynamicRateInfo = calculateDynamicRatePerKm(veh, expenses, allTrips);
      const isInstantAllowed = veh.allow_instant_short_ride !== false;

      if (isInstantAllowed) {
        // INSTANT START: Directly 'In Progress'
        await db.saveTripLog({
          vehicle_id: veh.id,
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          destination: 'Short Ride (Local / Campus)',
          purpose: 'Personal Short Travel',
          start_time: new Date().toISOString(),
          start_km: startKm,
          applied_rate_per_km: dynamicRateInfo.rate,
          status: 'In Progress',
          payment_status: 'Unpaid'
        });

        // Set vehicle to On Trip
        veh.status = 'On Trip';
        await db.saveVehicle(veh);

        allTrips = await db.getTripLogs();
        vehicles = await db.getVehicles();
        toast.success(`🚀 Instant Short Ride started! Meter logged at ${startKm} KM.`);
        render();
      } else {
        // APPROVAL REQUIRED: Saves as 'Pending Approval'
        await db.saveTripLog({
          vehicle_id: veh.id,
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          destination: 'Short Ride (Local / Campus)',
          purpose: 'Personal Short Travel',
          start_time: new Date().toISOString(),
          start_km: startKm,
          applied_rate_per_km: dynamicRateInfo.rate,
          status: 'Pending Approval',
          payment_status: 'Unpaid'
        });

        allTrips = await db.getTripLogs();
        toast.info('Trip request submitted for administrator review and approval.');
        render();
      }
    });

    // Enhance date & wheel time pickers for booking form
    const sDateEl = container.querySelector('#trip-start-date');
    const eDateEl = container.querySelector('#trip-end-date');
    const sTimeEl = container.querySelector('#trip-start-clock');
    const eTimeEl = container.querySelector('#trip-end-clock');

    if (sDateEl) enhanceDateInput(sDateEl);
    if (eDateEl) enhanceDateInput(eDateEl);
    if (sTimeEl) attachWheelTimePicker(sTimeEl);
    if (eTimeEl) attachWheelTimePicker(eTimeEl);

    // Cancel trip request (Pending Approval)
    container.querySelector('.btn-cancel-trip')?.addEventListener('click', async () => {
      if (confirm('Cancel this pending trip request?')) {
        await db.deleteTripLog(activeTrip.id);
        allTrips = await db.getTripLogs();
        toast.info('Trip request cancelled.');
        render();
      }
    });

    // Scheduled Booking submission
    container.querySelector('#form-book-vehicle')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (activeTrip) {
        toast.error('You already have an active or pending trip. Please complete or cancel it before booking another.');
        return;
      }

      const veh = vehicles.find(v => v.id === selectedVehicleId);
      if (!veh) {
        toast.error('Please select an available vehicle.');
        return;
      }

      const dest = container.querySelector('#trip-destination').value.trim();
      const purpose = container.querySelector('#trip-purpose').value.trim();
      const sDate = container.querySelector('#trip-start-date').value;
      const sClock = container.querySelector('#trip-start-clock').value;
      const eDate = container.querySelector('#trip-end-date').value;
      const eClock = container.querySelector('#trip-end-clock').value;
      const estKm = parseFloat(container.querySelector('#trip-est-km').value) || null;

      if (!dest || !purpose) {
        toast.error('Please enter trip destination and purpose.');
        return;
      }

      const startDateTime = new Date(`${sDate}T${sClock}:00`).toISOString();
      const endDateTime = new Date(`${eDate}T${eClock}:00`).toISOString();

      if (new Date(endDateTime) <= new Date(startDateTime)) {
        toast.error('Expected return time must be later than departure time.');
        return;
      }

      const dynamicRateInfo = calculateDynamicRatePerKm(veh, expenses, allTrips);

      await db.saveTripLog({
        vehicle_id: veh.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_role: currentUser.role,
        destination: dest,
        purpose: purpose,
        start_time: startDateTime,
        end_time: endDateTime,
        estimated_km: estKm,
        applied_rate_per_km: dynamicRateInfo.rate,
        status: 'Pending Approval',
        payment_status: 'Unpaid'
      });

      allTrips = await db.getTripLogs();
      toast.success('Trip request submitted for administrator review and approval.');
      render();
    });

    // Start Journey (Begin Journey when Approved)
    container.querySelector('#form-start-trip')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const startKm = parseFloat(container.querySelector('#start-km-input').value);
      const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);

      if (isNaN(startKm) || startKm < Number(veh?.current_odometer || 0)) {
        toast.error(`Starting odometer cannot be less than current odometer (${veh?.current_odometer || 0} KM).`);
        return;
      }

      activeTrip.status = 'In Progress';
      activeTrip.start_km = startKm;
      activeTrip.start_time = new Date().toISOString();
      await db.saveTripLog(activeTrip);

      if (veh) {
        veh.status = 'On Trip';
        await db.saveVehicle(veh);
      }

      allTrips = await db.getTripLogs();
      vehicles = await db.getVehicles();
      toast.success(`Journey started! Starting odometer logged at ${startKm} KM.`);
      render();
    });

    // Complete Trip & Live Bill Preview
    const endKmInput = container.querySelector('#end-km-input');
    const previewDistance = container.querySelector('#preview-distance');
    const previewCost = container.querySelector('#preview-cost');

    if (endKmInput && activeTrip && activeTrip.status === 'In Progress') {
      const startKm = Number(activeTrip.start_km || 0);
      const rate = Number(activeTrip.applied_rate_per_km || 15);

      endKmInput.addEventListener('input', () => {
        const val = parseFloat(endKmInput.value);
        if (!isNaN(val) && val >= startKm) {
          const dist = Math.round((val - startKm) * 100) / 100;
          const bill = calculateTripBill(dist, rate);
          if (previewDistance) previewDistance.textContent = `${dist} KM`;
          if (previewCost) previewCost.textContent = formatCurrency(bill);
        } else {
          if (previewDistance) previewDistance.textContent = '0 KM';
          if (previewCost) previewCost.textContent = '₹0.00';
        }
      });
    }

    // Submit Complete Trip
    container.querySelector('#form-complete-trip')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const endKm = parseFloat(endKmInput.value);
      const startKm = Number(activeTrip.start_km || 0);
      const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);

      if (isNaN(endKm) || endKm < startKm) {
        toast.error(`Ending odometer must be greater than or equal to start odometer (${startKm} KM).`);
        return;
      }

      const totalKm = Math.round((endKm - startKm) * 100) / 100;
      const rate = Number(activeTrip.applied_rate_per_km || 15);
      const totalAmount = calculateTripBill(totalKm, rate);

      // Complete trip log
      activeTrip.status = 'Completed';
      activeTrip.end_km = endKm;
      activeTrip.total_km = totalKm;
      activeTrip.total_amount = totalAmount;
      activeTrip.completed_at = new Date().toISOString();
      activeTrip.payment_status = 'Unpaid';
      await db.saveTripLog(activeTrip);

      // Update vehicle odometer and release status
      if (veh) {
        veh.current_odometer = endKm;
        veh.status = 'Available';
        await db.saveVehicle(veh);
      }

      allTrips = await db.getTripLogs();
      vehicles = await db.getVehicles();

      // Show Completion & Invoice Popup Modal
      openTripBillModal({
        tripCode: activeTrip.trip_id,
        vehicleName: veh?.vehicle_name || 'Vehicle',
        regNumber: veh?.reg_number || '',
        startKm,
        endKm,
        totalKm,
        rate,
        totalAmount
      });

      render();
    });
  }

  // MODAL: TRIP BILL SUMMARY & INVOICE POPUP
  function openTripBillModal({ tripCode, vehicleName, regNumber, startKm, endKm, totalKm, rate, totalAmount }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 480px; box-shadow: var(--shadow-xl); overflow: hidden; text-align: center;">
        <div style="background: #059669; color: #FFFFFF; padding: 1.5rem 1rem;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem;">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Trip Completed Successfully!</h3>
          <p style="margin: 0.25rem 0 0; opacity: 0.9; font-size: 0.85rem;">Official Usage Invoice Generated • Personal Use</p>
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
            <span style="font-family: monospace;">${startKm} KM ➔ ${endKm} KM</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">Distance Traveled</span>
            <strong style="font-family: monospace; font-size: 1rem; color: #4F46E5;">${totalKm} KM</strong>
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
