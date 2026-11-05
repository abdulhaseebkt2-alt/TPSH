import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate, formatCurrency, getTodayDateStr } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { calculateTripBill } from '../../lib/fleet-engine.js';
import { confirmDialog } from '../../lib/dialog.js';

export async function renderVehicleUserDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const userName = user?.full_name || 'Vehicle User';
  const userId = user?.id || 'v-driver';

  // Pull latest fleet, trips, and vehicles from db
  const [vehicles, allTrips, allPayments] = await Promise.all([
    db.getVehicles(),
    db.getTripLogs(),
    db.getVehiclePayments()
  ]);

  // Filter personal trips for this vehicle user / driver
  const myTrips = allTrips.filter(t => t.user_id === userId || (user.email && t.user_id === user.email) || t.user_name === userName);
  const myCompletedTrips = myTrips.filter(t => t.status === 'Completed');
  const myPendingTrips = myTrips.filter(t => t.status === 'Pending Approval');
  const myActiveTrip = myTrips.find(t => t.status === 'Approved' || t.status === 'In Progress' || t.status === 'Pending Approval');

  // Compute personal financial dues
  const pendingDues = myCompletedTrips
    .filter(t => !t.is_paid && t.payment_status !== 'Paid')
    .reduce((sum, t) => sum + (Number(t.total_bill) || 0), 0);

  const totalPaid = myCompletedTrips
    .filter(t => t.is_paid || t.payment_status === 'Paid')
    .reduce((sum, t) => sum + (Number(t.total_bill) || 0), 0);

  const totalKmDriven = myCompletedTrips.reduce((sum, t) => sum + (Number(t.total_km) || 0), 0);

  // Available vehicles count
  const availableVehiclesCount = vehicles.filter(v => v.status === 'Available').length;

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  container.innerHTML = `
    <!-- Driver / Staff Hero Header -->
    <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); border-radius: 16px; padding: 1.35rem 1.25rem; color: #FFFFFF; margin-bottom: 1.25rem; box-shadow: 0 4px 14px rgba(15,23,42,0.15);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #059669; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; font-weight: 700; color: #FFFFFF; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
            ${userName.charAt(0)}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #FFFFFF;">${userName}</h2>
              <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: rgba(16,185,129,0.2); color: #34D399; border: 1px solid rgba(16,185,129,0.3); font-weight: 600;">
                Driver & Staff
              </span>
            </div>
            <div style="font-size: 0.8rem; color: #94A3B8; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>ID: <strong>${user?.tps_id || 'VUS001'}</strong></span>
              <span>•</span>
              <span>${todayStr}</span>
            </div>
          </div>
        </div>

        <button class="btn btn-sm btn-primary" id="btn-dash-book-vehicle" style="background: #059669; border-color: #059669; display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.95rem; font-weight: 600;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
          Book Vehicle
        </button>
      </div>
    </div>

    <!-- KPI Metric Summary Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.85rem; margin-bottom: 1.25rem;">
      <!-- Active Trip Status -->
      <div style="background: #FFFFFF; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-subtle); box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.35rem;">
          Trip Status
        </div>
        <div style="font-size: 1rem; font-weight: 700; color: ${myActiveTrip ? (myActiveTrip.status === 'In Progress' ? '#2563EB' : '#D97706') : '#059669'};">
          ${myActiveTrip ? myActiveTrip.status : 'Ready / Idle'}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">
          ${myActiveTrip ? myActiveTrip.destination : 'No active trip running'}
        </div>
      </div>

      <!-- Outstanding Dues -->
      <div style="background: #FFFFFF; border-radius: 12px; padding: 1rem; border: 1px solid ${pendingDues > 0 ? '#FECACA' : 'var(--border-subtle)'}; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.35rem;">
          Pending Dues
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: ${pendingDues > 0 ? '#DC2626' : '#059669'};">
          ${formatCurrency(pendingDues)}
        </div>
        <div style="font-size: 0.72rem; color: ${pendingDues > 0 ? '#DC2626' : '#059669'}; font-weight: 600; margin-top: 0.25rem;">
          ${pendingDues > 0 ? '⚠ Settle with Admin' : '✓ All cleared'}
        </div>
      </div>

      <!-- Distance Driven -->
      <div style="background: #FFFFFF; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-subtle); box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.35rem;">
          Total Distance
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #0F172A;">
          ${totalKmDriven.toLocaleString()} <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">KM</span>
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">
          ${myCompletedTrips.length} completed trips
        </div>
      </div>

      <!-- Campus Fleet Status -->
      <div style="background: #FFFFFF; border-radius: 12px; padding: 1rem; border: 1px solid var(--border-subtle); box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.35rem;">
          Available Fleet
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #059669;">
          ${availableVehiclesCount} <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">/ ${vehicles.length}</span>
        </div>
        <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 0.25rem;">
          Ready to drive
        </div>
      </div>
    </div>

    <!-- Active Trip Interactive Card (if any active trip) -->
    ${myActiveTrip ? `
      <div style="background: #FFFFFF; border: 2px solid ${myActiveTrip.status === 'In Progress' ? '#2563EB' : '#D97706'}; border-radius: 14px; padding: 1.15rem; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">${myActiveTrip.status === 'In Progress' ? '🚗' : '⏳'}</span>
            <div>
              <strong style="font-size: 0.95rem; color: #0F172A;">${myActiveTrip.vehicle_name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${myActiveTrip.trip_id || myActiveTrip.id} • Destination: <strong>${myActiveTrip.destination}</strong></div>
            </div>
          </div>
          <span class="badge" style="background: ${myActiveTrip.status === 'In Progress' ? '#EFF6FF' : '#FEF3C7'}; color: ${myActiveTrip.status === 'In Progress' ? '#1D4ED8' : '#B45309'}; font-weight: 700; padding: 4px 10px; border-radius: 999px;">
            ${myActiveTrip.status}
          </span>
        </div>

        ${myActiveTrip.status === 'Pending Approval' ? `
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 0.85rem; font-size: 0.82rem; color: #92400E; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <span>Awaiting administrator approval before starting your trip.</span>
            <button class="btn btn-sm btn-outline" id="btn-dash-cancel-trip" data-trip-id="${myActiveTrip.id}" style="color: #DC2626; border-color: #FECACA;">Cancel Request</button>
          </div>
        ` : ''}

        ${myActiveTrip.status === 'Approved' ? `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 0.85rem;">
            <div style="font-size: 0.82rem; color: #166534; font-weight: 600; margin-bottom: 0.5rem;">
              Trip approved! Inspect odometer reading and start your journey:
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <input type="number" id="dash-start-km" class="form-control" placeholder="Start Odometer (KM)" style="max-width: 200px;" value="${vehicles.find(v => v.id === myActiveTrip.vehicle_id)?.current_odometer || ''}" />
              <button class="btn btn-sm btn-primary" id="btn-dash-start-trip" data-trip-id="${myActiveTrip.id}">Start Journey Now</button>
            </div>
          </div>
        ` : ''}

        ${myActiveTrip.status === 'In Progress' ? `
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <span style="font-size: 0.82rem; color: #1E40AF; font-weight: 600;">
                Journey In Progress • Started at: <strong>${myActiveTrip.start_km} KM</strong>
              </span>
              <span style="font-size: 0.75rem; color: #1E40AF;">Rate: ₹${myActiveTrip.rate_per_km}/km</span>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <input type="number" id="dash-end-km" class="form-control" placeholder="Ending Odometer (KM)" style="max-width: 200px;" min="${myActiveTrip.start_km || 0}" />
              <button class="btn btn-sm btn-primary" id="btn-dash-end-trip" data-trip-id="${myActiveTrip.id}" style="background: #1D4ED8; border-color: #1D4ED8;">
                End Trip & Calculate Bill
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}

    <!-- Quick Action Navigation Tiles -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem; margin-bottom: 1.25rem;">
      <div id="tile-book-vehicle" style="background: #FFFFFF; border-radius: 12px; padding: 1.15rem; border: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="width: 44px; height: 44px; border-radius: 10px; background: #ECFDF5; color: #059669; display: flex; align-items: center; justify-content: center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
        </div>
        <div>
          <strong style="font-size: 0.92rem; display: block; color: #0F172A;">Book a Vehicle</strong>
          <span style="font-size: 0.74rem; color: var(--text-muted);">Reserve available fleet for your trip</span>
        </div>
      </div>

      <div id="tile-my-trips" style="background: #FFFFFF; border-radius: 12px; padding: 1.15rem; border: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div style="width: 44px; height: 44px; border-radius: 10px; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div>
          <strong style="font-size: 0.92rem; display: block; color: #0F172A;">My Trips & Dues Ledger</strong>
          <span style="font-size: 0.74rem; color: var(--text-muted);">View billing breakdown & receipts</span>
        </div>
      </div>
    </div>

    <!-- Recent Trips Card Panel -->
    <div class="card-panel" style="background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.15rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
        <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0F172A;">Recent Completed Trips</h3>
        <button class="btn btn-sm btn-ghost" id="btn-dash-view-all-trips" style="font-size: 0.78rem; color: #059669;">View All →</button>
      </div>

      ${myCompletedTrips.length === 0 ? `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.82rem;">
          No completed trips yet. Book your first journey using the button above.
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${myCompletedTrips.slice(0, 5).map(trip => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.85rem; background: var(--bg-surface-subtle); border-radius: 8px; border: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div style="width: 34px; height: 34px; border-radius: 6px; background: #FFFFFF; border: 1px solid var(--border-medium); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                  🚗
                </div>
                <div>
                  <strong style="font-size: 0.85rem; color: #0F172A; display: block;">${trip.destination}</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">
                    ${trip.vehicle_name} • ${formatDate(trip.end_time || trip.created_at)} • <strong>${trip.total_km || 0} KM</strong>
                  </span>
                </div>
              </div>

              <div style="text-align: right;">
                <div style="font-size: 0.88rem; font-weight: 700; color: #0F172A;">
                  ${formatCurrency(trip.total_bill || 0)}
                </div>
                <span class="badge" style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; ${trip.is_paid || trip.payment_status === 'Paid' ? 'background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0;' : 'background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA;'}">
                  ${trip.is_paid || trip.payment_status === 'Paid' ? '✓ Paid' : 'Pending Dues'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  // Attach Interactive Handlers
  container.querySelector('#btn-dash-book-vehicle')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('vehicle_trips');
  });

  container.querySelector('#tile-book-vehicle')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('vehicle_trips');
  });

  container.querySelector('#tile-my-trips')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('vehicle_trips');
  });

  container.querySelector('#btn-dash-view-all-trips')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('vehicle_trips');
  });

  // Cancel pending trip
  container.querySelector('#btn-dash-cancel-trip')?.addEventListener('click', async (e) => {
    const tripId = e.currentTarget.getAttribute('data-trip-id');
    const confirmed = await confirmDialog({
      title: 'Cancel Trip Request?',
      message: 'Are you sure you want to cancel this pending vehicle request?',
      confirmText: 'Yes, Cancel Request',
      cancelText: 'Keep Request'
    });
    if (confirmed) {
      await db.deleteTripLog(tripId);
      toast.success('Trip request cancelled successfully.');
      renderVehicleUserDashboard(container, { onNavigate });
    }
  });

  // Start trip
  container.querySelector('#btn-dash-start-trip')?.addEventListener('click', async (e) => {
    const tripId = e.currentTarget.getAttribute('data-trip-id');
    const startKm = Number(container.querySelector('#dash-start-km').value);
    if (isNaN(startKm) || startKm < 0) {
      toast.error('Please enter a valid start odometer reading (KM)');
      return;
    }
    const trips = await db.getTripLogs();
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    trip.status = 'In Progress';
    trip.start_km = startKm;
    trip.start_time = new Date().toISOString();
    await db.saveTripLog(trip);

    // Update vehicle status
    const vList = await db.getVehicles();
    const veh = vList.find(v => v.id === trip.vehicle_id);
    if (veh) {
      veh.status = 'On Trip';
      veh.current_odometer = startKm;
      await db.saveVehicle(veh);
    }

    toast.success('Journey started! Drive safely.');
    renderVehicleUserDashboard(container, { onNavigate });
  });

  // End trip
  container.querySelector('#btn-dash-end-trip')?.addEventListener('click', async (e) => {
    const tripId = e.currentTarget.getAttribute('data-trip-id');
    const endKm = Number(container.querySelector('#dash-end-km').value);
    const trips = await db.getTripLogs();
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    if (isNaN(endKm) || endKm <= (trip.start_km || 0)) {
      toast.error(`Ending odometer must be greater than starting odometer (${trip.start_km || 0} KM)`);
      return;
    }

    const bill = calculateTripBill(trip.start_km, endKm, trip.rate_per_km);
    trip.status = 'Completed';
    trip.end_km = endKm;
    trip.end_time = new Date().toISOString();
    trip.total_km = bill.totalKm;
    trip.total_bill = bill.totalAmount;
    trip.is_paid = false;
    trip.payment_status = 'Unpaid';
    await db.saveTripLog(trip);

    // Update vehicle status back to Available
    const vList = await db.getVehicles();
    const veh = vList.find(v => v.id === trip.vehicle_id);
    if (veh) {
      veh.status = 'Available';
      veh.current_odometer = endKm;
      await db.saveVehicle(veh);
    }

    toast.success(`Trip completed! Distance: ${bill.totalKm} KM • Total Bill: ${formatCurrency(bill.totalAmount)}`);
    renderVehicleUserDashboard(container, { onNavigate });
  });
}
