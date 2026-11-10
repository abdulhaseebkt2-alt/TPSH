import { db, isDummyOrTestUser } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { 
  calculateDynamicRatePerKm, 
  calculateTripBill 
} from '../../lib/fleet-engine.js';
import { formatCurrency, formatDate, getTodayDateStr } from '../../lib/utils.js';
import { enhanceDateInput } from '../../components/date-picker.js';
import { attachWheelTimePicker } from '../../lib/wheelTimePicker.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { normalizeVehicleCategory, getVehicleTypeIcon } from './index.js';
import { isTripForUser } from './user-card.js';

export async function renderUserVehicleTripsModule(container, { onNavigate } = {}) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    container.innerHTML = `<div class="p-4 text-center">Please log in to view vehicle trips.</div>`;
    return;
  }

  // Load data
  let [vehicles, expenses, allTrips, destinations, allUsers] = await Promise.all([
    db.getVehicles(),
    db.getVehicleExpenses(),
    db.getTripLogs(),
    db.getVehicleDestinations(),
    db.getUsers()
  ]);

  // Active vehicle selection state
  const availableVehicles = vehicles.filter(v => v.status !== 'Inactive');
  let selectedVehicleId = availableVehicles[0]?.id || vehicles[0]?.id;

  function render() {
    // Current user's trips using robust matching
    const userTrips = allTrips.filter(t => isTripForUser(t, currentUser));

    // Active trip persistence: check localStorage first, then active user trips
    const storedActiveTripId = localStorage.getItem('tps_active_trip_id');
    let activeTrip = null;
    if (storedActiveTripId) {
      activeTrip = allTrips.find(t => (t.id === storedActiveTripId || t.trip_id === storedActiveTripId) && ['Pending Approval', 'Approved', 'In Progress'].includes(t.status));
    }
    if (!activeTrip) {
      activeTrip = userTrips.find(t => ['Pending Approval', 'Approved', 'In Progress'].includes(t.status));
    }
    if (activeTrip) {
      localStorage.setItem('tps_active_trip_id', activeTrip.id);
    } else {
      localStorage.removeItem('tps_active_trip_id');
    }

    // Get selected vehicle object
    let selectedVeh = vehicles.find(v => v.id === selectedVehicleId) || availableVehicles[0] || vehicles[0];
    if (selectedVeh) {
      selectedVehicleId = selectedVeh.id;
    }

    const dynamicRateInfo = selectedVeh ? calculateDynamicRatePerKm(selectedVeh, expenses, allTrips) : { rate: 16 };
    const isInstantAllowed = selectedVeh?.allow_instant_short_ride !== false;

    container.innerHTML = `
      <!-- Page Header (Clean & decluttered without 4 top buttons) -->
      <div class="page-header" style="margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.15); flex-shrink: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Vehicle Booking & Short Ride</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.84rem;">
                Logged in as <strong>${currentUser.full_name}</strong> • 100% Personal Billable System
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ACTIVE TRIP CONTROL BOX (IF A TRIP IS PENDING OR RUNNING) -->
      ${renderActiveTripBox(activeTrip)}

      <!-- MAIN FORM CONTAINER -->
      <div id="section-book-vehicle" class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm); margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Ride Booking Form</h3>
            <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
              Select a vehicle and start an instant meter-to-meter ride or schedule in advance.
            </p>
          </div>

          <!-- Ride Mode Toggle: Short Ride vs Scheduled Trip (Responsive 50/50 division on Mobile) -->
          <div class="trip-mode-toggle-bar">
            <button type="button" class="btn-trip-mode active" data-mode="short">
              Instant Short Ride
            </button>
            <button type="button" class="btn-trip-mode" data-mode="scheduled">
              Scheduled Trip
            </button>
          </div>
        </div>

        <!-- 1. VEHICLE SELECTOR CARD -->
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
                  Instant Short Ride Permitted
                </span>
              ` : `
                <span class="badge" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-size: 0.7rem; font-weight: 700;">
                  Requires Admin Approval
                </span>
              `}
            </div>
          </div>
        </div>

        <form id="form-book-vehicle">
          <!-- Short Ride Instant Box (Default mode) -->
          <div id="short-ride-box" style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <!-- Handsome User-Friendly Trip Category Selector Cards -->
            <div style="margin-bottom: 1.25rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">
                Select Trip Type & Nature *
              </label>
              <div class="trip-category-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <!-- Personal Ride Card -->
                <div id="card-cat-personal" class="trip-cat-card active" data-cat="Personal" role="button" tabindex="0" style="position: relative; background: #FFFFFF; border: 2px solid #4F46E5; border-radius: 12px; padding: 0.95rem 1rem; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.12); display: flex; align-items: flex-start; gap: 0.65rem;">
                  <div style="width: 38px; height: 38px; border-radius: 10px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.25rem;">
                      <strong style="font-size: 0.92rem; color: #1E1B4B; font-weight: 700;">Personal Ride</strong>
                      <span class="cat-check-badge" style="display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #4F46E5; color: #FFF; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">✓</span>
                    </div>
                    <p style="margin: 0.25rem 0 0; font-size: 0.74rem; color: #6366F1; line-height: 1.3; font-weight: 500;">
                      Personal travel • 100% Billable
                    </p>
                  </div>
                  <input type="radio" name="short_trip_category" value="Personal" checked style="display: none;" />
                </div>

                <!-- Official Campus Duty Card -->
                <div id="card-cat-official" class="trip-cat-card" data-cat="Official" role="button" tabindex="0" style="position: relative; background: #FFFFFF; border: 2px solid #E2E8F0; border-radius: 12px; padding: 0.95rem 1rem; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: var(--shadow-sm); display: flex; align-items: flex-start; gap: 0.65rem;">
                  <div style="width: 38px; height: 38px; border-radius: 10px; background: #F0FDF4; color: #059669; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/><path d="M14 9h1"/><path d="M14 13h1"/><path d="M14 17h1"/></svg>
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.25rem;">
                      <strong style="font-size: 0.92rem; color: #0F172A; font-weight: 700;">Official Trip</strong>
                      <span class="cat-check-badge" style="display: none; width: 18px; height: 18px; border-radius: 50%; background: #059669; color: #FFF; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">✓</span>
                    </div>
                    <p style="margin: 0.25rem 0 0; font-size: 0.74rem; color: #64748B; line-height: 1.3; font-weight: 500;">
                      Institutional errand & benchmarks
                    </p>
                  </div>
                  <input type="radio" name="short_trip_category" value="Official" style="display: none;" />
                </div>
              </div>
            </div>

            <!-- Official Preset Destination Dropdown (Smoothly revealed when Official is selected) -->
            <div id="short-official-dest-box" style="display: none; background: #F0FDF4; border: 1.5px solid #A7F3D0; border-radius: 10px; padding: 0.95rem; margin-bottom: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem;">
                <span style="font-size: 1rem;">📍</span>
                <label style="font-size: 0.8rem; font-weight: 700; color: #065F46; margin: 0;">
                  Official Preset Destination & Mileage Benchmark *
                </label>
              </div>
              <p style="font-size: 0.75rem; color: #047857; margin: 0 0 0.6rem; line-height: 1.3;">
                Distances within the standard benchmark are 100% institutionally covered. Surcharge applies only if extra distance is recorded.
              </p>
              <select id="short-official-dest-select" class="form-control" style="width: 100%; font-size: 0.86rem; font-weight: 600; margin-bottom: 0.4rem; background: #FFFFFF;">
                ${destinations.filter(d => d.is_active !== false).map(d => `
                  <option value="${d.id}" data-km="${d.standard_distance_km}">📍 ${d.name} (${d.standard_distance_km} KM standard benchmark)</option>
                `).join('')}
                <option value="other">✍️ Other (Custom Destination & Route)</option>
              </select>
              <div id="short-custom-dest-row" style="display: none; grid-template-columns: 2fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
                <input type="text" id="short-custom-dest-name" class="form-control" placeholder="Destination name / office..." style="font-size: 0.82rem; background: #FFF;" />
                <input type="number" id="short-custom-dest-km" class="form-control" min="1" placeholder="Standard KM" style="font-size: 0.82rem; font-family: monospace; background: #FFF;" />
              </div>
            </div>

            <!-- Single Starting Odometer Input in Front Window (No End Meter Here upfront) -->
            <div style="margin-bottom: 1.25rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E1B4B; margin-bottom: 0.35rem;">
                Current Starting Meter Reading (KM) *
              </label>
              <input type="number" id="short-ride-start-km" class="form-control" required 
                value="${selectedVeh?.current_odometer || 0}" 
                min="${selectedVeh?.current_odometer || 0}" 
                placeholder="e.g. ${selectedVeh?.current_odometer || 0}" 
                style="width: 100%; font-weight: 800; font-family: monospace; font-size: 1.15rem; padding: 0.65rem 0.85rem; border: 2px solid #C7D2FE; border-radius: 8px; background: #FFFFFF;" />
              <div style="font-size: 0.74rem; color: #6366F1; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.35rem;">
                <span>ℹ️</span> Pre-filled with <strong>${selectedVeh?.vehicle_name || 'Vehicle'}</strong>'s live odometer (${selectedVeh?.current_odometer || 0} KM). Return meter will be recorded when finishing the trip.
              </div>
            </div>

            <!-- Action Buttons: Start Short Ride & Block Trip for Others -->
            <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
              ${isInstantAllowed ? `
                <button type="button" id="btn-start-short-ride" class="btn btn-primary" style="flex: 1 1 200px; padding: 0.75rem 1rem; font-weight: 700; font-size: 0.92rem; background: #4F46E5; border-color: #4F46E5; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); border-radius: 8px;">
                  🚀 Start Instant Short Ride
                </button>
              ` : `
                <button type="button" id="btn-start-short-ride" class="btn btn-primary" style="flex: 1 1 200px; padding: 0.75rem 1rem; font-weight: 700; font-size: 0.92rem; background: #D97706; border-color: #D97706; border-radius: 8px;">
                  Submit Request for Admin Approval
                </button>
              `}
              <button type="button" id="btn-block-for-others" class="btn btn-outline" style="font-weight: 700; font-size: 0.88rem; padding: 0.75rem 1.1rem; border: 1.5px solid #C7D2FE; color: #4338CA; background: #FFFFFF; white-space: nowrap; border-radius: 8px;">
                👥 Block Trip for Others
              </button>
            </div>
          </div>

          <!-- Scheduled Booking Box -->
          <div id="scheduled-booking-box" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Destination / Route *</label>
                <input type="text" id="trip-destination" class="form-control" placeholder="e.g. Kozhikode Medical College & Return" style="width: 100%;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.25rem;">Purpose of Travel *</label>
                <input type="text" id="trip-purpose" class="form-control" placeholder="e.g. Official campus errand / Personal travel" style="width: 100%;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
              <!-- Departure Schedule -->
              <div style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.85rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #0F172A; margin-bottom: 0.5rem;">
                  Departure Schedule *
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
                  Expected Return *
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

  // Render Active Trip Control Box with Ending Odometer input and persistent Cancel button
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
            <button class="btn btn-sm btn-outline btn-cancel-trip" data-id="${activeTrip.id}" style="color: #DC2626; border-color: #FECACA; background: #FFF; font-weight: 700;">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #065F46;">
              Active Trip Control: Request Approved — Ready to Depart!
            </h4>
          </div>
          <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #047857;">
            Your trip <strong>${activeTrip.trip_id}</strong> is approved! Locked rate: <strong>₹${Number(activeTrip.applied_rate_per_km || 15).toFixed(2)}/km</strong>. Please verify starting odometer reading before you drive.
          </p>

          <form id="form-start-trip" style="display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #065F46; margin-bottom: 0.25rem;">
                Starting Odometer (KM) * (Vehicle: ${minOdo} KM)
              </label>
              <input type="number" id="start-km-input" class="form-control" required min="${minOdo}" value="${minOdo}" style="width: 220px; font-weight: 700; font-family: monospace;" />
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669; padding: 0.55rem 1.25rem; font-weight: 700;">
                Start Trip (Begin Journey)
              </button>
              <button type="button" id="btn-cancel-approved-trip" class="btn btn-outline" style="color: #DC2626; border-color: #FECACA; background: #FFF5F5; padding: 0.55rem 1rem; font-weight: 600;">
                ✕ Cancel Trip
              </button>
            </div>
          </form>
        </div>
      `;
    }

    if (activeTrip.status === 'In Progress') {
      const startKm = Number(activeTrip.start_km || 0);
      const rate = Number(activeTrip.applied_rate_per_km || 15);
      const isOfficial = activeTrip.trip_category === 'Official';
      const standardKm = Number(activeTrip.standard_km || 0);

      return `
        <div class="card-panel" style="background: #EFF6FF; border: 2px solid #3B82F6; border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">🚗</span>
              <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1E40AF;">
                Active Trip Control: Journey In Progress
              </h4>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700;">
                Started at ${startKm} KM • Rate: ₹${rate.toFixed(2)}/km
              </span>
              ${isOfficial ? `<span class="badge" style="background: #ECFDF5; color: #065F46; font-weight: 700;">Official (Benchmark: ${standardKm} KM)</span>` : ''}
            </div>
          </div>

          <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #1E3A8A;">
            Destination: <strong>${activeTrip.destination}</strong> with <strong>${veh?.vehicle_name || 'Vehicle'}</strong> (${veh?.reg_number}). When you return, enter ending odometer reading below to complete the trip.
          </p>

          <form id="form-complete-trip" style="background: #FFFFFF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 1rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; align-items: flex-end;">
              <!-- Start KM Display -->
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #64748B; margin-bottom: 0.25rem;">
                  Starting Odometer (Logged)
                </label>
                <div style="background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0.55rem 0.75rem; font-weight: 800; font-family: monospace; font-size: 1rem; color: #334155;">
                  ${startKm} KM
                </div>
              </div>

              <!-- End KM Input (Prominently displayed after start!) -->
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1E40AF; margin-bottom: 0.25rem;">
                  Ending Odometer Reading (KM) * (>= ${startKm + 1} KM)
                </label>
                <input type="number" id="end-km-input" class="form-control" required min="${startKm + 1}" value="${startKm + 1}" placeholder="e.g. ${startKm + 45}" style="width: 100%; font-weight: 700; font-family: monospace; font-size: 1rem;" />
              </div>

              <!-- Live bill computation preview -->
              <div id="live-bill-calc-preview" style="font-size: 0.85rem; color: #1E40AF; padding: 0.5rem 0.75rem; background: #F8FAFC; border-radius: 6px; border: 1px dashed #CBD5E1;">
                <div>Distance: <strong id="preview-distance">1 KM</strong></div>
                <div>${isOfficial ? 'Excess Discrepancy:' : 'Estimated Bill:'} <strong id="preview-cost" style="color: ${isOfficial ? '#D97706' : '#DC2626'};">₹0.00</strong></div>
              </div>

              <!-- Side-by-Side Action Buttons: Complete & Cancel -->
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="submit" class="btn btn-primary" style="flex: 1 1 auto; padding: 0.65rem 1rem; font-weight: 700; background: #2563EB;">
                  Complete Trip & Finalize
                </button>
                <button type="button" id="btn-cancel-active-trip" class="btn btn-outline" style="color: #DC2626; border-color: #FECACA; background: #FFF5F5; font-weight: 700; padding: 0.65rem 1rem; white-space: nowrap;">
                  ✕ Cancel Trip
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
    // 1. VEHICLE SELECTOR MODAL DIALOG
    container.querySelector('#sec-vehicle-trigger')?.addEventListener('click', () => {
      openModal({
        title: 'Select Vehicle to Ride',
        modalClass: 'role-picker-modal-dialog',
        contentHtml: `
          <div style="margin-bottom: 0.5rem;">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Choose an available school vehicle for your trip:
            </p>
            <div class="role-picker-list">
              ${vehicles.filter(v => v.status !== 'Inactive').map(v => {
                const isSelected = v.id === selectedVehicleId;
                const dynamic = calculateDynamicRatePerKm(v, expenses, allTrips);
                const vehCategory = normalizeVehicleCategory(v.vehicle_type);
                const vehIcon = getVehicleTypeIcon(v.vehicle_type);
                const isInstant = v.allow_instant_short_ride !== false;

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
                            <span style="color: #166534; font-weight: 600;">Instant Short Ride</span>
                          ` : `
                            <span style="color: #B45309; font-weight: 600;">Approval Required</span>
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

    // User-friendly Personal vs Official Trip Selection Cards
    let shortTripCategory = 'Personal';
    const cardPersonal = container.querySelector('#card-cat-personal');
    const cardOfficial = container.querySelector('#card-cat-official');
    const officialDestBox = container.querySelector('#short-official-dest-box');
    const officialDestSelect = container.querySelector('#short-official-dest-select');
    const customDestRow = container.querySelector('#short-custom-dest-row');

    function updateCategoryUI(cat) {
      shortTripCategory = cat;
      const checkPersonal = cardPersonal?.querySelector('.cat-check-badge');
      const checkOfficial = cardOfficial?.querySelector('.cat-check-badge');

      if (cat === 'Personal') {
        if (cardPersonal) {
          cardPersonal.classList.add('active');
          cardPersonal.style.borderColor = '#4F46E5';
          cardPersonal.style.background = '#FFFFFF';
          cardPersonal.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.12)';
        }
        if (checkPersonal) checkPersonal.style.display = 'inline-flex';

        if (cardOfficial) {
          cardOfficial.classList.remove('active');
          cardOfficial.style.borderColor = '#E2E8F0';
          cardOfficial.style.background = '#FFFFFF';
          cardOfficial.style.boxShadow = 'var(--shadow-sm)';
        }
        if (checkOfficial) checkOfficial.style.display = 'none';

        if (officialDestBox) officialDestBox.style.display = 'none';
      } else {
        if (cardOfficial) {
          cardOfficial.classList.add('active');
          cardOfficial.style.borderColor = '#059669';
          cardOfficial.style.background = '#FFFFFF';
          cardOfficial.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.15)';
        }
        if (checkOfficial) checkOfficial.style.display = 'inline-flex';

        if (cardPersonal) {
          cardPersonal.classList.remove('active');
          cardPersonal.style.borderColor = '#E2E8F0';
          cardPersonal.style.background = '#FFFFFF';
          cardPersonal.style.boxShadow = 'var(--shadow-sm)';
        }
        if (checkPersonal) checkPersonal.style.display = 'none';

        if (officialDestBox) officialDestBox.style.display = 'block';
      }
    }

    cardPersonal?.addEventListener('click', () => updateCategoryUI('Personal'));
    cardOfficial?.addEventListener('click', () => updateCategoryUI('Official'));

    officialDestSelect?.addEventListener('change', () => {
      if (customDestRow) {
        customDestRow.style.display = officialDestSelect.value === 'other' ? 'grid' : 'none';
      }
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
          b.classList.toggle('active', isActive);
        });

        if (shortBox) shortBox.style.display = currentMode === 'short' ? 'block' : 'none';
        if (scheduledBox) scheduledBox.style.display = currentMode === 'scheduled' ? 'block' : 'none';
      });
    });

    // "Block Trip for Others" Button Handler
    container.querySelector('#btn-block-for-others')?.addEventListener('click', () => {
      openBlockTripForOthersModal();
    });

    // Start / Request Short Ride Handler (Only prompts for Start Odometer, End Odometer is recorded upon completion!)
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

      let startKm = parseFloat(startKmInput.value);
      if (isNaN(startKm)) {
        startKm = Number(veh.current_odometer || 0);
      }
      if (startKm < Number(veh.current_odometer || 0)) {
        toast.error(`Start meter reading cannot be less than current odometer (${veh.current_odometer || 0} KM).`);
        return;
      }

      // Destination & benchmark configuration
      let tripDestName = 'Short Ride (Local / Campus)';
      let stdKm = 0;
      if (shortTripCategory === 'Official') {
        const destChoice = officialDestSelect?.value;
        if (destChoice === 'other') {
          const customName = container.querySelector('#short-custom-dest-name')?.value.trim();
          const customKm = parseFloat(container.querySelector('#short-custom-dest-km')?.value) || 0;
          tripDestName = customName || 'Official Duty (Custom)';
          stdKm = customKm;
        } else {
          const targetDest = destinations.find(d => d.id === destChoice);
          tripDestName = targetDest?.name || 'Official Duty';
          stdKm = Number(targetDest?.standard_distance_km || 0);
        }
      }

      const dynamicRateInfo = calculateDynamicRatePerKm(veh, expenses, allTrips);
      const isInstantAllowed = veh.allow_instant_short_ride !== false;

      if (isInstantAllowed) {
        // INSTANT START: Directly transitions to 'In Progress' with active trip box
        const saved = await db.saveTripLog({
          vehicle_id: veh.id,
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          user_email: currentUser.email || '',
          user_role: currentUser.role,
          destination: tripDestName,
          purpose: shortTripCategory === 'Official' ? 'Official Campus Travel' : 'Personal Short Travel',
          start_time: new Date().toISOString(),
          start_km: startKm,
          applied_rate_per_km: dynamicRateInfo.rate,
          status: 'In Progress',
          payment_status: 'Unpaid',
          trip_category: shortTripCategory,
          standard_km: stdKm
        });

        localStorage.setItem('tps_active_trip_id', saved.id);

        veh.status = 'On Trip';
        await db.saveVehicle(veh);

        allTrips = await db.getTripLogs();
        vehicles = await db.getVehicles();
        toast.success(`Instant Short Ride started! Meter logged at ${startKm} KM.`);
        render();
      } else {
        // APPROVAL REQUIRED: Saves as 'Pending Approval'
        const saved = await db.saveTripLog({
          vehicle_id: veh.id,
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          user_email: currentUser.email || '',
          user_role: currentUser.role,
          destination: tripDestName,
          purpose: shortTripCategory === 'Official' ? 'Official Campus Travel' : 'Personal Short Travel',
          start_time: new Date().toISOString(),
          start_km: startKm,
          applied_rate_per_km: dynamicRateInfo.rate,
          status: 'Pending Approval',
          payment_status: 'Unpaid',
          trip_category: shortTripCategory,
          standard_km: stdKm
        });

        localStorage.setItem('tps_active_trip_id', saved.id);
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
      const confirmed = await confirmDialog({
        title: 'Cancel Trip Request',
        message: 'Are you sure you want to cancel this pending trip request?',
        confirmText: 'Cancel Request',
        cancelText: 'Keep Request',
        isDanger: true
      });
      if (confirmed) {
        await db.deleteTripLog(activeTrip.id);
        localStorage.removeItem('tps_active_trip_id');
        allTrips = await db.getTripLogs();
        toast.info('Trip request cancelled.');
        render();
      }
    });

    // Cancel active trip (In Progress or Approved - Abort before/during journey & release vehicle)
    const handleCancelActiveTrip = async () => {
      if (!activeTrip) return;
      const confirmed = await confirmDialog({
        title: 'Cancel Active Trip',
        message: 'Cancel this trip? This will abort the trip without generating a bill and release the vehicle back to Available status.',
        confirmText: 'Cancel Trip',
        cancelText: 'Keep Trip',
        isDanger: true
      });
      if (confirmed) {
        const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);
        if (veh) {
          veh.status = 'Available';
          await db.saveVehicle(veh);
        }
        await db.deleteTripLog(activeTrip.id);
        localStorage.removeItem('tps_active_trip_id');
        allTrips = await db.getTripLogs();
        vehicles = await db.getVehicles();
        toast.info('Trip cancelled successfully. Vehicle returned to Available.');
        render();
      }
    };
    container.querySelector('#btn-cancel-active-trip')?.addEventListener('click', handleCancelActiveTrip);
    container.querySelector('#btn-cancel-approved-trip')?.addEventListener('click', handleCancelActiveTrip);

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

      const saved = await db.saveTripLog({
        vehicle_id: veh.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_email: currentUser.email || '',
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

      localStorage.setItem('tps_active_trip_id', saved.id);
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
      const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);
      const rate = Number(activeTrip.applied_rate_per_km) > 0 
        ? Number(activeTrip.applied_rate_per_km) 
        : (Number(veh?.fallback_rate_per_km) > 0 ? Number(veh.fallback_rate_per_km) : 15);
      const isOfficial = activeTrip.trip_category === 'Official';
      const stdKm = Number(activeTrip.standard_km || 0);

      endKmInput.addEventListener('input', () => {
        const val = parseFloat(endKmInput.value);
        if (!isNaN(val) && val >= startKm) {
          // Automatic 1 KM extra logic minimum
          const finalVal = Math.max(val, startKm + 1);
          const dist = Math.round((finalVal - startKm) * 100) / 100;
          if (previewDistance) previewDistance.textContent = `${dist} KM`;

          if (isOfficial && stdKm > 0) {
            const excess = Math.max(0, dist - stdKm);
            const excessAmt = excess * rate;
            if (previewCost) previewCost.textContent = excess > 0 ? `+${excess} KM (₹${excessAmt.toFixed(2)})` : '₹0.00 (Exempt)';
          } else {
            const bill = calculateTripBill(startKm, finalVal, rate);
            const costNum = typeof bill === 'object' && bill !== null ? bill.totalAmount : Number(bill);
            if (previewCost) previewCost.textContent = formatCurrency(costNum);
          }
        } else {
          if (previewDistance) previewDistance.textContent = '1 KM';
          if (previewCost) previewCost.textContent = '₹0.00';
        }
      });
    }

    // Submit Complete Trip
    container.querySelector('#form-complete-trip')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawEndKm = parseFloat(endKmInput.value);
      const startKm = Number(activeTrip.start_km || 0);
      const veh = vehicles.find(v => v.id === activeTrip.vehicle_id);

      // Enforce at least 1 KM extra compared to starting baseline as per current logic
      const endKm = Math.max(isNaN(rawEndKm) ? startKm + 1 : rawEndKm, startKm + 1);
      const totalKm = Math.round((endKm - startKm) * 100) / 100;
      const rate = Number(activeTrip.applied_rate_per_km) > 0 
        ? Number(activeTrip.applied_rate_per_km) 
        : (Number(veh?.fallback_rate_per_km) > 0 ? Number(veh.fallback_rate_per_km) : 15);

      const isOfficial = activeTrip.trip_category === 'Official';
      const stdKm = Number(activeTrip.standard_km || 0);

      // Handle Official trip discrepancy if actual distance exceeds preset benchmark
      if (isOfficial && stdKm > 0 && totalKm > stdKm) {
        const excessKm = Math.round((totalKm - stdKm) * 100) / 100;
        const excessAmount = Math.round(excessKm * rate * 100) / 100;

        openDiscrepancyModal({
          tripCode: activeTrip.trip_id,
          destination: activeTrip.destination,
          standardKm: stdKm,
          actualKm: totalKm,
          excessKm,
          excessAmount,
          rate,
          onConfirm: async () => {
            activeTrip.status = 'Completed';
            activeTrip.end_km = endKm;
            activeTrip.total_km = totalKm;
            activeTrip.excess_km = excessKm;
            activeTrip.applied_rate_per_km = rate;
            activeTrip.total_amount = excessAmount;
            activeTrip.completed_at = new Date().toISOString();
            activeTrip.payment_status = 'Unpaid';
            activeTrip.discrepancy_status = 'Accepted';
            await db.saveTripLog(activeTrip);

            if (veh) {
              veh.current_odometer = endKm;
              veh.status = 'Available';
              await db.saveVehicle(veh);
            }

            allTrips = await db.getTripLogs();
            vehicles = await db.getVehicles();
            localStorage.removeItem('tps_active_trip_id');
            toast.success(`Trip completed! Excess charge of ₹${excessAmount} added to your card.`);
            render();
          },
          onSubmitJustification: async (reason) => {
            activeTrip.status = 'Completed';
            activeTrip.end_km = endKm;
            activeTrip.total_km = totalKm;
            activeTrip.excess_km = excessKm;
            activeTrip.applied_rate_per_km = rate;
            activeTrip.total_amount = excessAmount;
            activeTrip.completed_at = new Date().toISOString();
            activeTrip.payment_status = 'Pending Exemption Review';
            activeTrip.discrepancy_status = 'Pending Review';
            activeTrip.discrepancy_reason = reason;
            await db.saveTripLog(activeTrip);

            if (veh) {
              veh.current_odometer = endKm;
              veh.status = 'Available';
              await db.saveVehicle(veh);
            }

            allTrips = await db.getTripLogs();
            vehicles = await db.getVehicles();
            localStorage.removeItem('tps_active_trip_id');
            toast.info('Trip completed! Justification submitted for administrator review.');
            render();
          }
        });
        return;
      }

      // Normal or Within-Standard Official Trip
      const bill = calculateTripBill(startKm, endKm, rate);
      const billAmt = typeof bill === 'object' && bill !== null ? bill.totalAmount : Number(bill);
      const totalAmount = isOfficial ? 0 : billAmt;

      activeTrip.status = 'Completed';
      activeTrip.end_km = endKm;
      activeTrip.total_km = totalKm;
      activeTrip.applied_rate_per_km = rate;
      activeTrip.total_amount = totalAmount;
      activeTrip.completed_at = new Date().toISOString();
      activeTrip.payment_status = totalAmount > 0 ? 'Unpaid' : 'Official Exemption';
      activeTrip.discrepancy_status = 'None';
      await db.saveTripLog(activeTrip);

      if (veh) {
        veh.current_odometer = endKm;
        veh.status = 'Available';
        await db.saveVehicle(veh);
      }

      allTrips = await db.getTripLogs();
      vehicles = await db.getVehicles();
      localStorage.removeItem('tps_active_trip_id');

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

  // MODAL: BLOCK TRIP FOR OTHERS
  function openBlockTripForOthersModal() {
    const eligibleStaff = allUsers.filter(u => 
      u && !isDummyOrTestUser(u, true) && 
      (u.approval_status === 'approved' || !u.approval_status || u.approval_status === 'active') &&
      u.role !== 'student'
    );

    const targetVeh = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
    const minOdo = Number(targetVeh?.current_odometer || 0);

    openModal({
      title: 'Block / Log Trip for Staff & Faculty',
      contentHtml: `
        <form id="form-block-trip-for-others" style="display: flex; flex-direction: column; gap: 1rem;">
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 0.5rem; line-height: 1.4;">
            Log an official or personal trip on behalf of another teacher, staff member, or driver. The trip and calculated dues will be directly recorded onto their personal Vehicle Card.
          </p>

          <!-- Select Staff / Faculty Member -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.3rem;">
              Select Faculty / Staff User *
            </label>
            <select id="block-user-select" class="form-control" required style="width: 100%; font-size: 0.88rem; font-weight: 600;">
              ${eligibleStaff.map(u => `
                <option value="${u.id}">${u.full_name} (${u.role || 'Staff'})</option>
              `).join('')}
            </select>
          </div>

          <!-- Select Vehicle -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.3rem;">
              Vehicle *
            </label>
            <select id="block-veh-select" class="form-control" required style="width: 100%; font-size: 0.88rem;">
              ${vehicles.filter(v => v.status !== 'Inactive').map(v => `
                <option value="${v.id}" data-odo="${v.current_odometer || 0}" ${v.id === targetVeh.id ? 'selected' : ''}>
                  ${v.vehicle_name} (${v.reg_number}) • Odo: ${v.current_odometer || 0} KM
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Trip Type: Personal vs Official -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 0.3rem;">
              Trip Purpose / Category *
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <label id="block-label-personal" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem; border: 1.5px solid #4F46E5; background: #EEF2FF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #4338CA;">
                <input type="radio" name="block_trip_category" value="Personal" checked style="accent-color: #4F46E5;" />
                Personal Ride
              </label>
              <label id="block-label-official" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem; border: 1.5px solid #CBD5E1; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #475569;">
                <input type="radio" name="block_trip_category" value="Official" style="accent-color: #059669;" />
                Official Duty
              </label>
            </div>
          </div>

          <!-- Official Preset Destination Selector (Shown if Official) -->
          <div id="block-official-dest-box" style="display: none; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 0.75rem;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #065F46; margin-bottom: 0.3rem;">
              Preset Benchmark Destination
            </label>
            <select id="block-official-dest-select" class="form-control" style="width: 100%; font-size: 0.84rem; font-weight: 600;">
              ${destinations.filter(d => d.is_active !== false).map(d => `
                <option value="${d.id}" data-km="${d.standard_distance_km}">${d.name} (${d.standard_distance_km} KM standard benchmark)</option>
              `).join('')}
              <option value="other">Other (Custom Destination)</option>
            </select>
            <div id="block-custom-dest-row" style="display: none; grid-template-columns: 2fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
              <input type="text" id="block-custom-dest-name" class="form-control" placeholder="Destination name..." style="font-size: 0.82rem;" />
              <input type="number" id="block-custom-dest-km" class="form-control" min="1" placeholder="Std KM" style="font-size: 0.82rem; font-family: monospace;" />
            </div>
          </div>

          <!-- Side-by-Side Start KM & End KM in Block for Others Modal -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #1E293B; margin-bottom: 0.25rem;">
                Start Kilometer (KM) *
              </label>
              <input type="number" id="block-start-km" class="form-control" required value="${minOdo}" min="${minOdo}" style="width: 100%; font-weight: 700; font-family: monospace;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #1E293B; margin-bottom: 0.25rem;">
                End Kilometer (KM) * (>= ${minOdo + 1})
              </label>
              <input type="number" id="block-end-km" class="form-control" required value="${minOdo + 1}" min="${minOdo + 1}" style="width: 100%; font-weight: 700; font-family: monospace;" />
            </div>
          </div>

          <!-- Destination / Route Notes -->
          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #1E293B; margin-bottom: 0.25rem;">
              Trip Notes / Destination Description
            </label>
            <input type="text" id="block-notes" class="form-control" placeholder="e.g. Campus errand / local transport" style="width: 100%; font-size: 0.84rem;" />
          </div>

          <!-- Fare Preview Box -->
          <div id="block-fare-preview" style="background: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 8px; padding: 0.75rem; font-size: 0.84rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="color: var(--text-muted); font-size: 0.75rem;">Traveled Distance:</span>
              <strong id="block-calc-dist" style="font-family: monospace; font-size: 0.95rem; color: #4F46E5; margin-left: 4px;">1 KM</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 0.75rem;">Recorded Fare:</span>
              <strong id="block-calc-fare" style="font-size: 1.05rem; color: #DC2626; margin-left: 4px;">₹16.00</strong>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="submit" class="btn btn-primary" style="font-weight: 700; background: #059669; border-color: #059669; padding: 0.65rem 1.25rem;">
              Record on User's Vehicle Card
            </button>
          </div>
        </form>
      `,
      onMount: ({ container: modalBody, close }) => {
        const userSelect = modalBody.querySelector('#block-user-select');
        const vehSelect = modalBody.querySelector('#block-veh-select');
        const startInput = modalBody.querySelector('#block-start-km');
        const endInput = modalBody.querySelector('#block-end-km');
        const notesInput = modalBody.querySelector('#block-notes');
        const calcDistEl = modalBody.querySelector('#block-calc-dist');
        const calcFareEl = modalBody.querySelector('#block-calc-fare');
        const officialBox = modalBody.querySelector('#block-official-dest-box');
        const officialSelect = modalBody.querySelector('#block-official-dest-select');
        const customRow = modalBody.querySelector('#block-custom-dest-row');

        let blockCategory = 'Personal';

        // Toggle category
        modalBody.querySelectorAll('input[name="block_trip_category"]').forEach(r => {
          r.addEventListener('change', () => {
            blockCategory = r.value;
            const pLabel = modalBody.querySelector('#block-label-personal');
            const oLabel = modalBody.querySelector('#block-label-official');
            if (blockCategory === 'Personal') {
              pLabel.style.borderColor = '#4F46E5';
              pLabel.style.color = '#4338CA';
              oLabel.style.borderColor = '#CBD5E1';
              oLabel.style.color = '#475569';
              if (officialBox) officialBox.style.display = 'none';
            } else {
              oLabel.style.borderColor = '#059669';
              oLabel.style.color = '#065F46';
              pLabel.style.borderColor = '#CBD5E1';
              pLabel.style.color = '#475569';
              if (officialBox) officialBox.style.display = 'block';
            }
            recalcPreview();
          });
        });

        officialSelect?.addEventListener('change', () => {
          if (customRow) customRow.style.display = officialSelect.value === 'other' ? 'grid' : 'none';
          recalcPreview();
        });

        // Vehicle switch updates minimum odometer
        vehSelect.addEventListener('change', () => {
          const opt = vehSelect.selectedOptions[0];
          const odo = parseFloat(opt.getAttribute('data-odo')) || 0;
          startInput.value = odo;
          startInput.min = odo;
          endInput.value = odo + 1;
          endInput.min = odo + 1;
          recalcPreview();
        });

        function recalcPreview() {
          const s = parseFloat(startInput.value) || 0;
          const e = parseFloat(endInput.value) || (s + 1);
          const v = vehicles.find(veh => veh.id === vehSelect.value);
          const rateInfo = v ? calculateDynamicRatePerKm(v, expenses, allTrips) : { rate: 16 };
          const dist = Math.max(1, Math.round((e - s) * 100) / 100);
          calcDistEl.textContent = `${dist} KM`;

          if (blockCategory === 'Official') {
            let std = 0;
            if (officialSelect.value === 'other') {
              std = parseFloat(modalBody.querySelector('#block-custom-dest-km')?.value) || 0;
            } else {
              const d = destinations.find(dest => dest.id === officialSelect.value);
              std = Number(d?.standard_distance_km || 0);
            }
            const excess = Math.max(0, dist - std);
            const excessCost = Math.round(excess * rateInfo.rate * 100) / 100;
            calcFareEl.textContent = excess > 0 ? `+${excess} KM (₹${excessCost.toFixed(2)})` : '₹0.00 (Exempt)';
          } else {
            const bill = calculateTripBill(s, e, rateInfo.rate);
            const total = typeof bill === 'object' && bill !== null ? bill.totalAmount : Number(bill);
            calcFareEl.textContent = formatCurrency(total);
          }
        }

        startInput.addEventListener('input', recalcPreview);
        endInput.addEventListener('input', recalcPreview);

        modalBody.querySelector('#form-block-trip-for-others').addEventListener('submit', async (e) => {
          e.preventDefault();
          const targetUserId = userSelect.value;
          const targetUserObj = eligibleStaff.find(u => u.id === targetUserId);
          if (!targetUserObj) {
            toast.error('Please select a valid user.');
            return;
          }

          const targetVehObj = vehicles.find(v => v.id === vehSelect.value);
          const startKm = parseFloat(startInput.value);
          const rawEndKm = parseFloat(endInput.value);

          if (isNaN(startKm) || isNaN(rawEndKm) || rawEndKm <= startKm) {
            toast.error('End Kilometer must be greater than Start Kilometer.');
            return;
          }

          const endKm = Math.max(rawEndKm, startKm + 1);
          const totalKm = Math.round((endKm - startKm) * 100) / 100;
          const rateInfo = targetVehObj ? calculateDynamicRatePerKm(targetVehObj, expenses, allTrips) : { rate: 16 };

          let destTitle = notesInput.value.trim() || 'Short Ride / Campus Errand';
          let stdKm = 0;
          if (blockCategory === 'Official') {
            if (officialSelect.value === 'other') {
              const cName = modalBody.querySelector('#block-custom-dest-name')?.value.trim();
              const cKm = parseFloat(modalBody.querySelector('#block-custom-dest-km')?.value) || 0;
              destTitle = cName || 'Official Duty (Custom)';
              stdKm = cKm;
            } else {
              const d = destinations.find(dest => dest.id === officialSelect.value);
              destTitle = d?.name || 'Official Duty';
              stdKm = Number(d?.standard_distance_km || 0);
            }
          }

          let totalAmount = 0;
          let excessKm = 0;
          let paymentStatus = 'Unpaid';
          let discrepancyStatus = 'None';

          if (blockCategory === 'Official') {
            if (stdKm > 0 && totalKm > stdKm) {
              excessKm = Math.round((totalKm - stdKm) * 100) / 100;
              totalAmount = Math.round(excessKm * rateInfo.rate * 100) / 100;
              discrepancyStatus = 'Accepted';
              paymentStatus = 'Unpaid';
            } else {
              totalAmount = 0;
              paymentStatus = 'Official Exemption';
            }
          } else {
            const bill = calculateTripBill(startKm, endKm, rateInfo.rate);
            totalAmount = typeof bill === 'object' && bill !== null ? bill.totalAmount : Number(bill);
            paymentStatus = 'Unpaid';
          }

          const tripDate = new Date().toISOString();

          await db.saveTripLog({
            vehicle_id: targetVehObj.id,
            user_id: targetUserObj.id,
            user_name: targetUserObj.full_name,
            user_email: targetUserObj.email || '',
            user_role: targetUserObj.role || 'Staff',
            destination: destTitle,
            purpose: `Logged on behalf of ${targetUserObj.full_name} by ${currentUser.full_name}`,
            start_time: tripDate,
            end_time: tripDate,
            start_km: startKm,
            end_km: endKm,
            total_km: totalKm,
            applied_rate_per_km: rateInfo.rate,
            total_amount: totalAmount,
            status: 'Completed',
            payment_status: paymentStatus,
            trip_category: blockCategory,
            standard_km: stdKm,
            excess_km: excessKm,
            discrepancy_status: discrepancyStatus,
            booked_by: currentUser.full_name,
            booked_by_id: currentUser.id,
            completed_at: tripDate
          });

          // Update vehicle odometer
          targetVehObj.current_odometer = endKm;
          targetVehObj.status = 'Available';
          await db.saveVehicle(targetVehObj);

          allTrips = await db.getTripLogs();
          vehicles = await db.getVehicles();

          close();
          toast.success(`Trip recorded directly onto ${targetUserObj.full_name}'s Vehicle Card!`);
          render();
        });
      }
    });
  }

  // MODAL: ODOMETER DISCREPANCY CONFIRMATION & JUSTIFICATION
  function openDiscrepancyModal({ tripCode, destination, standardKm, actualKm, excessKm, excessAmount, rate, onConfirm, onSubmitJustification }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 480px; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Header -->
        <div style="background: #FEF3C7; border-bottom: 2px solid #F59E0B; padding: 1.25rem 1rem; text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #FDE68A; color: #B45309; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem; font-size: 1.5rem;">
            ⚠️
          </div>
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #92400E;">Destination Distance Exceeded</h3>
          <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: #78350F;">Official Trip Benchmark Surcharge Notice</p>
        </div>

        <div style="padding: 1.25rem;">
          <div style="font-size: 0.84rem; color: #475569; margin-bottom: 1rem; line-height: 1.4;">
            Your recorded journey for official destination <strong>${destination}</strong> exceeded the preset standard benchmark. The excess distance is calculated below:
          </div>

          <!-- Breakdown Box -->
          <div style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem; font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.45rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Standard Benchmark Distance</span>
              <strong style="font-family: monospace;">${standardKm} KM</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Recorded Traveled Distance</span>
              <strong style="font-family: monospace; color: #2563EB;">${actualKm} KM</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.35rem;">
              <span style="color: #92400E; font-weight: 700;">Excess Distance</span>
              <strong style="font-family: monospace; color: #DC2626; font-size: 0.95rem;">+${excessKm} KM</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.35rem;">
              <span style="color: #DC2626; font-weight: 800;">Extra Amount Added to Card</span>
              <strong style="font-size: 1.15rem; color: #DC2626;">${formatCurrency(excessAmount)}</strong>
            </div>
          </div>

          <!-- Justification Input Area (Hidden initially, shown when user clicks "Reason") -->
          <div id="discrepancy-reason-box" style="display: none; margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #1E293B; margin-bottom: 0.25rem;">
              Explain Reason for Extra Mileage *
            </label>
            <textarea id="discrepancy-reason-text" class="form-control" rows="3" placeholder="e.g. Road detour due to bridge repair, or official extra stops requested by school administration..." style="width: 100%; font-size: 0.84rem;"></textarea>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; display: block;">
              If administration approves your reason, the extra amount will be waived from your Vehicle Card.
            </span>
          </div>

          <!-- Actions -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div id="discrepancy-primary-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <button type="button" id="btn-show-reason" class="btn btn-outline" style="font-weight: 700; font-size: 0.82rem; padding: 0.55rem; color: #B45309; border-color: #FDE68A; background: #FFFBEB;">
                ✍️ Reason / Justification
              </button>
              <button type="button" id="btn-accept-excess" class="btn btn-primary" style="font-weight: 700; font-size: 0.82rem; padding: 0.55rem; background: #DC2626; border-color: #DC2626;">
                Confirm & Accept Charge
              </button>
            </div>

            <div id="discrepancy-submit-reason-actions" style="display: none; justify-content: flex-end; gap: 0.5rem;">
              <button type="button" id="btn-cancel-reason" class="btn btn-secondary" style="font-size: 0.82rem; padding: 0.5rem 0.85rem;">
                Back
              </button>
              <button type="button" id="btn-submit-reason" class="btn btn-primary" style="font-weight: 700; font-size: 0.82rem; padding: 0.5rem 1rem; background: #059669; border-color: #059669;">
                Submit Justification to Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const reasonBox = modalOverlay.querySelector('#discrepancy-reason-box');
    const primaryActions = modalOverlay.querySelector('#discrepancy-primary-actions');
    const submitActions = modalOverlay.querySelector('#discrepancy-submit-reason-actions');
    const reasonText = modalOverlay.querySelector('#discrepancy-reason-text');

    modalOverlay.querySelector('#btn-show-reason')?.addEventListener('click', () => {
      reasonBox.style.display = 'block';
      primaryActions.style.display = 'none';
      submitActions.style.display = 'flex';
      reasonText.focus();
    });

    modalOverlay.querySelector('#btn-cancel-reason')?.addEventListener('click', () => {
      reasonBox.style.display = 'none';
      primaryActions.style.display = 'grid';
      submitActions.style.display = 'none';
    });

    modalOverlay.querySelector('#btn-accept-excess')?.addEventListener('click', () => {
      modalOverlay.remove();
      onConfirm();
    });

    modalOverlay.querySelector('#btn-submit-reason')?.addEventListener('click', () => {
      const reason = reasonText.value.trim();
      if (!reason) {
        toast.error('Please enter a reason explaining the extra mileage.');
        return;
      }
      modalOverlay.remove();
      onSubmitJustification(reason);
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
          <p style="margin: 0.25rem 0 0; opacity: 0.9; font-size: 0.85rem;">Official Usage Invoice Generated</p>
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
            <span style="font-size: 1.5rem; font-weight: 800; color: ${totalAmount > 0 ? '#DC2626' : '#059669'};">${formatCurrency(totalAmount)}</span>
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
