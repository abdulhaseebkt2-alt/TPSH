import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { promptDialog } from '../../lib/dialog.js';
import { getVehicleTypeIcon } from '../vehicles/index.js';

export async function renderVehicleHeadDashboard(container, { onNavigate }) {
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; min-height: 280px;">
      <div class="loading-spinner" style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #4F46E5; border-radius: 50%; animation: tpsSpin 0.8s linear infinite;"></div>
    </div>
  `;

  const user = getCurrentUser();
  const userName = user?.full_name || 'Vehicle Department Head';
  const userId = user?.id;

  // Pull latest cloud sync for vehicles, head assignments, trips, and payments
  await db.pullCloudKeys(['tps_vehicles', 'tps_vehicle_head_assignments', 'tps_trip_logs', 'tps_vehicle_payments'], false);

  const [allVehicles, allTrips, allPayments, vHeadMap] = await Promise.all([
    db.getVehicles(),
    db.getTripLogs(),
    db.getVehiclePayments(),
    db.getVehicleHeadAssignedVehicles ? db.getVehicleHeadAssignedVehicles(userId, user?.email) : []
  ]);

  // Determine assigned vehicles for this department head
  const assignmentsFromStorage = (db && typeof db.get === 'function') ? (db.get('tps_vehicle_head_assignments') || {}) : {};
  const cloudAssigned = assignmentsFromStorage[userId] || (user?.email && assignmentsFromStorage[user.email.toLowerCase()]) || [];
  let assignedVehicleIds = [];
  if (Array.isArray(user?.assigned_vehicle_ids) && user.assigned_vehicle_ids.length > 0) {
    assignedVehicleIds = user.assigned_vehicle_ids;
  } else if (Array.isArray(vHeadMap) && vHeadMap.length > 0) {
    assignedVehicleIds = vHeadMap;
  } else if (Array.isArray(cloudAssigned) && cloudAssigned.length > 0) {
    assignedVehicleIds = cloudAssigned;
  } else if (Array.isArray(user?.metadata?.assigned_vehicle_ids) && user.metadata.assigned_vehicle_ids.length > 0) {
    assignedVehicleIds = user.metadata.assigned_vehicle_ids;
  } else if (Array.isArray(user?.vehicle_ids) && user.vehicle_ids.length > 0) {
    assignedVehicleIds = user.vehicle_ids;
  } else if (user?.is_dev_profile) {
    assignedVehicleIds = allVehicles.slice(0, 2).map(v => v.id);
  }

  const assignedSet = new Set(Array.isArray(assignedVehicleIds) ? assignedVehicleIds : []);
  const myVehicles = allVehicles.filter(v => assignedSet.has(v.id));

  // Scoped Trips and Payments strictly to assigned vehicles
  const myFleetTrips = allTrips.filter(t => assignedSet.has(t.vehicle_id));
  const myFleetTripIds = new Set(myFleetTrips.map(t => t.id || t.trip_id));
  const myFleetPayments = allPayments.filter(p => myFleetTripIds.has(p.trip_id));

  // KPIs
  const availableCount = myVehicles.filter(v => v.status === 'Available').length;
  const onTripCount = myVehicles.filter(v => v.status === 'On Trip').length;

  const pendingRequests = myFleetTrips.filter(t => t.status === 'Pending Approval');
  const activeTrips = myFleetTrips.filter(t => t.status === 'In Progress');
  const completedTrips = myFleetTrips.filter(t => t.status === 'Completed');

  // Collectable Dues Calculation
  const unpaidTrips = completedTrips.filter(t => {
    const total = Number(t.total_amount) || 0;
    const paid = Number(t.amount_paid) || (t.payment_status === 'Paid' ? total : 0);
    return (total - paid) > 0.01 && t.payment_status !== 'Official Exemption' && t.discrepancy_status !== 'Approved Exemption';
  });

  const totalDuesCollectable = unpaidTrips.reduce((sum, t) => {
    const total = Number(t.total_amount) || 0;
    const paid = Number(t.amount_paid) || (t.payment_status === 'Paid' ? total : 0);
    return sum + Math.max(0, total - paid);
  }, 0);

  const totalSettledAmount = myFleetPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const totalKmDriven = completedTrips.reduce((sum, t) => sum + (Number(t.total_km) || 0), 0);

  function render() {
    container.innerHTML = `
      <div class="vehicle-head-dashboard" style="display: flex; flex-direction: column; gap: 1.25rem; max-width: 1200px; margin: 0 auto; padding-bottom: 2rem;">
        
        <!-- 1. Executive Hero Header -->
        <div style="background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%); border-radius: 16px; padding: 1.35rem 1.25rem; color: #FFFFFF; box-shadow: 0 4px 16px rgba(15,23,42,0.18);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.85rem; min-width: 0;">
              <div class="user-avatar" style="width: 48px; height: 48px; font-size: 18px; font-weight: 800; border-radius: 12px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); color: #FFFFFF; flex-shrink: 0;">
                ${user?.avatar_url ? `<img src="${user.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" alt="" />` : (userName[0] || 'V').toUpperCase()}
              </div>
              <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #FFFFFF; letter-spacing: -0.01em;">${userName}</h2>
                  <span class="badge" style="background: #4F46E5; color: #FFFFFF; font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.2);">
                    🚗 Vehicle Department Head
                  </span>
                </div>
                <div style="font-size: 0.8rem; color: #CBD5E1; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                  <span>Oversight Fleet: <strong>${myVehicles.length} Managed Vehicles</strong></span>
                  ${myVehicles.length > 0 ? `<span>•</span><span style="color: #93C5FD;">(${myVehicles.map(v => v.name || v.plate_number).slice(0, 3).join(', ')}${myVehicles.length > 3 ? ` +${myVehicles.length - 3} more` : ''})</span>` : ''}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-sm" id="btn-head-refresh" style="background: rgba(255,255,255,0.12); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.25); font-weight: 600; font-size: 0.78rem; padding: 0.4rem 0.75rem; border-radius: 8px;">
                ↻ Sync Fleet
              </button>
              <button type="button" class="btn btn-sm btn-primary" id="btn-head-goto-trips" style="background: #4F46E5; border-color: #6366F1; font-weight: 700; font-size: 0.78rem; padding: 0.4rem 0.85rem; border-radius: 8px;">
                + Book / Ride
              </button>
            </div>
          </div>

          ${myVehicles.length === 0 ? `
            <div style="margin-top: 1rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 10px; padding: 0.75rem 0.95rem; font-size: 0.8rem; color: #FCA5A5; display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">⚠️</span>
              <span>No vehicles assigned to your department yet. An institutional administrator can link vehicles to your oversight via <strong>Users & Permissions &gt; Assign Vehicles</strong>.</span>
            </div>
          ` : ''}
        </div>

        <!-- 2. Responsive 6-Card KPI Bento Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem;">
          
          <!-- Card 1: Managed Fleet -->
          <div class="card-panel" style="padding: 1rem; border-radius: 14px; background: var(--bg-surface); border: 1.5px solid var(--border-subtle); display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">Managed Fleet</span>
              <span style="width: 28px; height: 28px; border-radius: 6px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; font-size: 13px;">🚗</span>
            </div>
            <div style="margin-top: 0.65rem;">
              <div style="font-size: 1.55rem; font-weight: 800; color: var(--text-main); line-height: 1.1;">${myVehicles.length}</div>
              <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 0.25rem;">
                ${availableCount} Avail • ${onTripCount} On Trip
              </div>
            </div>
          </div>

          <!-- Card 2: Pending Requests -->
          <div class="card-panel" style="padding: 1rem; border-radius: 14px; background: var(--bg-surface); border: 1.5px solid ${pendingRequests.length > 0 ? '#FDE68A' : 'var(--border-subtle)'}; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">Pending Requests</span>
              <span style="width: 28px; height: 28px; border-radius: 6px; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; font-size: 13px;">📋</span>
            </div>
            <div style="margin-top: 0.65rem;">
              <div style="font-size: 1.55rem; font-weight: 800; color: ${pendingRequests.length > 0 ? '#D97706' : 'var(--text-main)'}; line-height: 1.1;">
                ${pendingRequests.length}
              </div>
              <div style="font-size: 0.72rem; color: ${pendingRequests.length > 0 ? '#B45309' : 'var(--text-muted)'}; font-weight: 600; margin-top: 0.25rem;">
                ${pendingRequests.length > 0 ? 'Action required' : 'Queue clear'}
              </div>
            </div>
          </div>

          <!-- Card 3: Active Trips -->
          <div class="card-panel" style="padding: 1rem; border-radius: 14px; background: var(--bg-surface); border: 1.5px solid ${activeTrips.length > 0 ? '#93C5FD' : 'var(--border-subtle)'}; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">Active Journeys</span>
              <span style="width: 28px; height: 28px; border-radius: 6px; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 13px;">🛣️</span>
            </div>
            <div style="margin-top: 0.65rem;">
              <div style="font-size: 1.55rem; font-weight: 800; color: ${activeTrips.length > 0 ? '#2563EB' : 'var(--text-main)'}; line-height: 1.1;">
                ${activeTrips.length}
              </div>
              <div style="font-size: 0.72rem; color: ${activeTrips.length > 0 ? '#1E40AF' : 'var(--text-muted)'}; font-weight: 600; margin-top: 0.25rem;">
                ${activeTrips.length > 0 ? 'Vehicles on road' : 'All parked in campus'}
              </div>
            </div>
          </div>

          <!-- Card 4: Collectable Dues -->
          <div class="card-panel" style="padding: 1rem; border-radius: 14px; background: var(--bg-surface); border: 1.5px solid ${totalDuesCollectable > 0 ? '#FECACA' : 'var(--border-subtle)'}; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">Collectable Dues</span>
              <span style="width: 28px; height: 28px; border-radius: 6px; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; font-size: 13px;">💰</span>
            </div>
            <div style="margin-top: 0.65rem;">
              <div style="font-size: 1.55rem; font-weight: 800; color: ${totalDuesCollectable > 0 ? '#DC2626' : '#059669'}; line-height: 1.1;">
                ${formatCurrency(totalDuesCollectable)}
              </div>
              <div style="font-size: 0.72rem; color: ${totalDuesCollectable > 0 ? '#DC2626' : '#059669'}; font-weight: 600; margin-top: 0.25rem;">
                ${unpaidTrips.length} Trip${unpaidTrips.length === 1 ? '' : 's'} Pending
              </div>
            </div>
          </div>

          <!-- Card 5: Total Distance -->
          <div class="card-panel" style="padding: 1rem; border-radius: 14px; background: var(--bg-surface); border: 1.5px solid var(--border-subtle); display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">Distance Driven</span>
              <span style="width: 28px; height: 28px; border-radius: 6px; background: #F1F5F9; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 13px;">⏱️</span>
            </div>
            <div style="margin-top: 0.65rem;">
              <div style="font-size: 1.55rem; font-weight: 800; color: var(--text-main); font-family: monospace; line-height: 1.1;">
                ${totalKmDriven} <span style="font-size: 0.85rem; font-weight: 600;">KM</span>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-top: 0.25rem;">
                Across ${completedTrips.length} trips
              </div>
            </div>
          </div>

          <!-- Card 6: Total Settled -->
          <div class="card-panel" style="padding: 1rem; border-radius: 14px; background: var(--bg-surface); border: 1.5px solid var(--border-subtle); display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;">Settled Funds</span>
              <span style="width: 28px; height: 28px; border-radius: 6px; background: #ECFDF5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 13px;">✓</span>
            </div>
            <div style="margin-top: 0.65rem;">
              <div style="font-size: 1.55rem; font-weight: 800; color: #059669; line-height: 1.1;">
                ${formatCurrency(totalSettledAmount)}
              </div>
              <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 0.25rem;">
                ${myFleetPayments.length} Payment Receipts
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Quick Operations Bar -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <a href="#vehicle_requests" class="btn btn-outline" style="font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0.5rem 0.85rem; border-radius: 8px;">
            <span>📋</span>
            <span>Review Requests (${pendingRequests.length})</span>
          </a>
          <a href="#vehicle_billing" class="btn btn-outline" style="font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0.5rem 0.85rem; border-radius: 8px; color: #059669; border-color: #A7F3D0;">
            <span>💰</span>
            <span>Billing & Dues (${unpaidTrips.length})</span>
          </a>
          <a href="#vehicle_expenses" class="btn btn-outline" style="font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0.5rem 0.85rem; border-radius: 8px;">
            <span>⛽</span>
            <span>Log Fuel / Expense</span>
          </a>
          <a href="#vehicles" class="btn btn-outline" style="font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0.5rem 0.85rem; border-radius: 8px;">
            <span>🛠️</span>
            <span>Fleet Registry</span>
          </a>
        </div>

        <!-- 4. Managed Fleet Roster (Cards View) -->
        <div class="card-panel" style="padding: 1.25rem; border-radius: 16px; background: var(--bg-surface); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                <span>🚗</span>
                <span>Assigned Fleet Roster (${myVehicles.length})</span>
              </h3>
              <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                Vehicles assigned exclusively to your department oversight.
              </p>
            </div>
            <a href="#vehicles" class="btn btn-sm btn-outline" style="font-size: 0.76rem; font-weight: 600; padding: 0.3rem 0.65rem; border-radius: 6px;">
              Manage in Fleet Console →
            </a>
          </div>

          ${myVehicles.length === 0 ? `
            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
              No vehicles assigned yet. Use <strong>Users & Permissions &gt; Assign Vehicles</strong> to link vehicles.
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.85rem;">
              ${myVehicles.map(v => {
                const vTrips = myFleetTrips.filter(t => t.vehicle_id === v.id && t.status === 'Completed');
                const vDues = vTrips.filter(t => {
                  const tot = Number(t.total_amount) || 0;
                  const pd = Number(t.amount_paid) || (t.payment_status === 'Paid' ? tot : 0);
                  return (tot - pd) > 0.01;
                }).reduce((s, t) => s + Math.max(0, (Number(t.total_amount) || 0) - (Number(t.amount_paid) || 0)), 0);

                return `
                  <div style="background: var(--bg-surface-subtle); border: 1.5px solid var(--border-subtle); border-radius: 12px; padding: 0.95rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                      <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 42px; height: 42px; border-radius: 8px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; overflow: hidden;">
                          ${v.photo_url || v.image ? `<img src="${v.photo_url || v.image}" style="width: 100%; height: 100%; object-fit: cover;" alt="" />` : getVehicleTypeIcon(v.category || v.vehicle_type)}
                        </div>
                        <div>
                          <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-main); line-height: 1.2;">${v.name || v.vehicle_name || 'Vehicle'}</div>
                          <div style="font-family: monospace; font-size: 0.72rem; color: #4F46E5; font-weight: 700; margin-top: 2px;">${v.plate_number || v.reg_number || 'No Plate'}</div>
                        </div>
                      </div>
                      <span class="badge" style="font-size: 0.68rem; padding: 2px 7px; border-radius: 9999px; background: ${v.status === 'On Trip' ? '#FEF3C7' : (v.status === 'In Service' ? '#FEE2E2' : '#ECFDF5')}; color: ${v.status === 'On Trip' ? '#92400E' : (v.status === 'In Service' ? '#DC2626' : '#065F46')};">
                        ${v.status || 'Available'}
                      </span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; padding-top: 0.6rem; border-top: 1px solid var(--border-subtle); font-size: 0.76rem;">
                      <div>
                        <div style="color: var(--text-muted); font-size: 0.68rem;">LIVE ODOMETER</div>
                        <div style="font-weight: 700; font-family: monospace; color: var(--text-main);">${v.current_odometer || 0} KM</div>
                      </div>
                      <div style="text-align: right;">
                        <div style="color: var(--text-muted); font-size: 0.68rem;">RATE / KM</div>
                        <div style="font-weight: 700; color: #059669;">₹${Number(v.rate_per_km || v.fallback_rate_per_km || 16).toFixed(2)}</div>
                      </div>
                    </div>

                    ${vDues > 0 ? `
                      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 0.35rem 0.55rem; font-size: 0.72rem; color: #DC2626; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                        <span>Pending Dues:</span>
                        <span>${formatCurrency(vDues)}</span>
                      </div>
                    ` : `
                      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 0.35rem 0.55rem; font-size: 0.72rem; color: #059669; font-weight: 600;">
                        ✓ Dues settled up to date
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- 5. Pending Trip Requests Queue -->
        <div class="card-panel" style="padding: 1.25rem; border-radius: 16px; background: var(--bg-surface); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                <span>📋</span>
                <span>Pending Trip Requests (${pendingRequests.length})</span>
              </h3>
              <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                Travel requests awaiting your approval for your assigned fleet.
              </p>
            </div>
          </div>

          ${pendingRequests.length === 0 ? `
            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; background: var(--bg-surface-subtle); border-radius: 12px; border: 1px dashed var(--border-subtle);">
              ✓ All clear! There are no pending trip approval requests for your vehicles.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${pendingRequests.map(req => {
                const veh = myVehicles.find(v => v.id === req.vehicle_id);
                return `
                  <div class="head-request-card" style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 0.95rem 1.1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem;">
                    <div style="min-width: 0;">
                      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <strong style="font-size: 0.92rem; color: #92400E;">${req.user_name || 'Staff User'}</strong>
                        <span class="badge" style="background: #FEF3C7; color: #B45309; font-weight: 700; font-size: 0.7rem;">${req.trip_id}</span>
                        <span class="badge" style="background: #EEF2FF; color: #4338CA; font-weight: 700; font-size: 0.7rem;">${req.trip_category || 'Personal'}</span>
                      </div>
                      <div style="font-size: 0.8rem; color: #78350F; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                        <span>🚗 <strong>${veh?.name || veh?.vehicle_name || 'Assigned Vehicle'}</strong> (${veh?.plate_number || 'No plate'})</span>
                        <span>•</span>
                        <span>📍 ${req.destination || 'Short Ride'}</span>
                        ${req.date ? `<span>•</span><span>📅 ${formatDate(req.date)}</span>` : ''}
                      </div>
                      ${req.purpose || req.reason ? `
                        <div style="font-size: 0.74rem; color: #92400E; margin-top: 0.25rem; font-style: italic;">
                          Purpose: "${req.purpose || req.reason}"
                        </div>
                      ` : ''}
                    </div>

                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;">
                      <button type="button" class="btn btn-sm btn-outline btn-head-reject-req" data-id="${req.id}" style="color: #DC2626; border-color: #FECACA; background: #FFFFFF; font-weight: 700; font-size: 0.78rem; padding: 0.35rem 0.65rem; border-radius: 6px;">
                        ✕ Reject
                      </button>
                      <button type="button" class="btn btn-sm btn-primary btn-head-approve-req" data-id="${req.id}" data-rate="${veh?.rate_per_km || veh?.fallback_rate_per_km || 16.00}" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 0.78rem; padding: 0.35rem 0.85rem; border-radius: 6px;">
                        ✓ Approve Trip
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- 6. Pending Dues Collection Console -->
        <div class="card-panel" style="padding: 1.25rem; border-radius: 16px; background: var(--bg-surface); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                <span>💰</span>
                <span>Collectable Payment Dues (${unpaidTrips.length})</span>
              </h3>
              <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                Completed journeys on your assigned fleet awaiting payment settlement.
              </p>
            </div>
            <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-weight: 800; font-size: 0.82rem; padding: 4px 10px; border-radius: 9999px;">
              Total Due: ${formatCurrency(totalDuesCollectable)}
            </span>
          </div>

          ${unpaidTrips.length === 0 ? `
            <div style="text-align: center; padding: 2rem 1rem; color: #059669; font-size: 0.85rem; background: #F0FDF4; border-radius: 12px; border: 1px dashed #BBF7D0;">
              ✓ Excellent! All trips on your assigned vehicles are completely paid and settled.
            </div>
          ` : `
            <!-- Desktop Table View -->
            <div class="table-container desktop-only" style="overflow-x: auto;">
              <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-subtle); text-align: left;">
                    <th style="padding: 0.6rem 0.5rem;">Staff / Driver</th>
                    <th style="padding: 0.6rem 0.5rem;">Vehicle</th>
                    <th style="padding: 0.6rem 0.5rem;">Date & Dest</th>
                    <th style="padding: 0.6rem 0.5rem;">Distance</th>
                    <th style="padding: 0.6rem 0.5rem;">Total</th>
                    <th style="padding: 0.6rem 0.5rem; text-align: right;">Remaining Due</th>
                    <th style="padding: 0.6rem 0.5rem; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${unpaidTrips.map(t => {
                    const veh = myVehicles.find(v => v.id === t.vehicle_id);
                    const totalAmt = Number(t.total_amount) || 0;
                    const paidAmt = Number(t.amount_paid) || 0;
                    const remainingDue = Math.max(0, totalAmt - paidAmt);

                    return `
                      <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 0.65rem 0.5rem;">
                          <strong>${t.user_name || 'Staff User'}</strong>
                          <div style="font-size: 0.7rem; font-family: monospace; color: var(--text-muted);">${t.trip_id}</div>
                        </td>
                        <td style="padding: 0.65rem 0.5rem;">
                          <div style="font-weight: 600; color: #4F46E5;">${veh?.name || veh?.vehicle_name || 'Vehicle'}</div>
                          <div style="font-size: 0.68rem; font-family: monospace; color: var(--text-muted);">${veh?.plate_number || ''}</div>
                        </td>
                        <td style="padding: 0.65rem 0.5rem;">
                          <div>${t.date ? formatDate(t.date) : 'Recent'}</div>
                          <div style="font-size: 0.72rem; color: var(--text-muted);">${t.destination || 'Short Ride'}</div>
                        </td>
                        <td style="padding: 0.65rem 0.5rem; font-family: monospace; font-weight: 700;">
                          ${t.total_km || 0} KM
                        </td>
                        <td style="padding: 0.65rem 0.5rem; font-weight: 700;">
                          ${formatCurrency(totalAmt)}
                        </td>
                        <td style="padding: 0.65rem 0.5rem; text-align: right; font-weight: 800; color: #DC2626; font-size: 0.88rem;">
                          ${formatCurrency(remainingDue)}
                        </td>
                        <td style="padding: 0.65rem 0.5rem; text-align: right;">
                          <button type="button" class="btn btn-sm btn-primary btn-head-collect-due" data-id="${t.id}" data-code="${t.trip_id}" data-due="${remainingDue}" data-total="${totalAmt}" data-user="${t.user_name || 'Staff'}" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 0.74rem; padding: 0.35rem 0.75rem; border-radius: 6px;">
                            Collect & Settle
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Card View -->
            <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.65rem;">
              ${unpaidTrips.map(t => {
                const veh = myVehicles.find(v => v.id === t.vehicle_id);
                const totalAmt = Number(t.total_amount) || 0;
                const paidAmt = Number(t.amount_paid) || 0;
                const remainingDue = Math.max(0, totalAmt - paidAmt);

                return `
                  <div style="background: var(--bg-surface-subtle); border: 1.5px solid #FECACA; border-radius: 12px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.65rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div>
                        <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-main);">${t.user_name || 'Staff User'}</div>
                        <div style="font-size: 0.72rem; color: #4F46E5; font-weight: 600; margin-top: 2px;">
                          ${veh?.name || veh?.vehicle_name || 'Vehicle'} • <span style="font-family: monospace;">${veh?.plate_number || ''}</span>
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                          📍 ${t.destination || 'Short Ride'} • ${t.total_km || 0} KM
                        </div>
                      </div>
                      <div style="text-align: right;">
                        <div style="font-size: 0.66rem; color: var(--text-muted);">REMAINING DUE</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: #DC2626;">${formatCurrency(remainingDue)}</div>
                      </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
                      <span style="font-size: 0.7rem; font-family: monospace; color: var(--text-muted);">${t.trip_id}</span>
                      <button type="button" class="btn btn-sm btn-primary btn-head-collect-due" data-id="${t.id}" data-code="${t.trip_id}" data-due="${remainingDue}" data-total="${totalAmt}" data-user="${t.user_name || 'Staff'}" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 0.74rem; padding: 0.35rem 0.85rem; border-radius: 6px;">
                        Collect & Settle
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;

    // Listeners
    container.querySelector('#btn-head-refresh')?.addEventListener('click', () => {
      renderVehicleHeadDashboard(container, { onNavigate });
    });

    container.querySelector('#btn-head-goto-trips')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_trips');
    });

    // Approve Trip Request
    container.querySelectorAll('.btn-head-approve-req').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tripId = btn.getAttribute('data-id');
        const appliedRate = parseFloat(btn.getAttribute('data-rate')) || 16.00;
        const targetTrip = myFleetTrips.find(t => t.id === tripId);
        if (!targetTrip) return;

        targetTrip.status = 'Approved';
        targetTrip.applied_rate_per_km = appliedRate;
        targetTrip.approved_by = userName;
        targetTrip.approved_at = new Date().toISOString();

        await db.saveTripLog(targetTrip);
        toast.success(`Trip ${targetTrip.trip_id} approved at ₹${appliedRate.toFixed(2)}/km!`);
        renderVehicleHeadDashboard(container, { onNavigate });
      });
    });

    // Reject Trip Request
    container.querySelectorAll('.btn-head-reject-req').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tripId = btn.getAttribute('data-id');
        const reason = await promptDialog({
          title: 'Reject Trip Request',
          message: 'Provide an optional reason for declining this trip request:',
          placeholder: 'e.g. Vehicle not available or reserved for school event',
          confirmText: 'Reject Request',
          cancelText: 'Cancel'
        });
        if (reason === null) return;

        const targetTrip = myFleetTrips.find(t => t.id === tripId);
        if (!targetTrip) return;

        targetTrip.status = 'Rejected';
        targetTrip.rejection_reason = reason.trim() || 'Declined by Vehicle Department Head';

        await db.saveTripLog(targetTrip);
        toast.info(`Trip request ${targetTrip.trip_id} rejected.`);
        renderVehicleHeadDashboard(container, { onNavigate });
      });
    });

    // Collect & Settle Dues Modal
    container.querySelectorAll('.btn-head-collect-due').forEach(btn => {
      btn.addEventListener('click', () => {
        const tripId = btn.getAttribute('data-id');
        const tripCode = btn.getAttribute('data-code');
        const remainingDue = parseFloat(btn.getAttribute('data-due')) || 0;
        const totalAmount = parseFloat(btn.getAttribute('data-total')) || 0;
        const targetUserName = btn.getAttribute('data-user');

        openHeadSettlementModal({
          tripId,
          tripCode,
          remainingDue,
          totalAmount,
          targetUserName
        });
      });
    });
  }

  // Head Settlement Modal
  function openHeadSettlementModal({ tripId, tripCode, remainingDue, totalAmount, targetUserName }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel modal-mobile-responsive" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 480px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Collect Trip Payment</h3>
            <div style="font-size: 0.74rem; color: #4F46E5; font-weight: 600; margin-top: 2px;">Department Head Collection: ${userName}</div>
          </div>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <form id="form-head-settle" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 0.72rem; color: #92400E; font-weight: 600;">TRIP CODE</div>
                  <div style="font-weight: 700; font-family: monospace; font-size: 0.95rem;">${tripCode}</div>
                  <div style="font-size: 0.78rem; color: #B45309;">Driver / Staff: ${targetUserName}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.72rem; color: #92400E; font-weight: 600;">REMAINING DUE</div>
                  <div style="font-size: 1.25rem; font-weight: 800; color: #DC2626;">${formatCurrency(remainingDue)}</div>
                </div>
              </div>
            </div>

            <!-- Payment Options Strip -->
            <div style="margin-bottom: 0.85rem;">
              <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem; display: block;">Select Payment Option</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <label id="label-head-pay-full" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #059669; background: #ECFDF5; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #065F46;">
                  <input type="radio" name="head_pay_option" value="full" checked style="accent-color: #059669;" />
                  Full Payment
                </label>
                <label id="label-head-pay-partial" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #E2E8F0; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #334155;">
                  <input type="radio" name="head_pay_option" value="partial" style="accent-color: #D97706;" />
                  Partial Payment
                </label>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.25rem;">Amount Collecting (₹) *</label>
              <input type="number" id="pay-head-amount" class="form-control" step="0.5" min="1" max="${remainingDue}" value="${remainingDue}" readonly required style="width: 100%; height: 40px; font-size: 1rem; font-weight: 700; color: #059669;" />
              <div id="head-pay-balance-preview" style="font-size: 0.76rem; font-weight: 600; color: #059669; margin-top: 0.35rem; padding: 4px 8px; background: #F0FDF4; border-radius: 6px; border: 1px solid #BBF7D0;">
                Remaining balance after payment: <strong>₹0.00</strong>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Payment Method *</label>
              <select id="pay-head-method" class="form-control" required style="width: 100%; height: 40px; font-size: 0.84rem;">
                <option value="Cash">Cash (Received by Head)</option>
                <option value="Google Pay">Google Pay</option>
                <option value="PhonePe">PhonePe</option>
                <option value="UPI / QR Scan">UPI / QR Scan</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="Salary Deduction">Staff Salary Deduction</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Receipt / Notes</label>
              <input type="text" id="pay-head-notes" class="form-control" placeholder="e.g. Received cash at campus office" style="width: 100%; height: 40px; font-size: 0.84rem;" />
            </div>
          </div>

          <div style="flex-shrink: 0; padding: 0.75rem 0.85rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--bg-surface);">
            <button type="button" class="btn btn-secondary btn-close-modal" style="font-size: 0.82rem; padding: 0.45rem 0.75rem;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 0.84rem; padding: 0.45rem 0.95rem;">
              Record & Settle Due
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    const fullRadio = modalOverlay.querySelector('input[value="full"]');
    const partialRadio = modalOverlay.querySelector('input[value="partial"]');
    const labelFull = modalOverlay.querySelector('#label-head-pay-full');
    const labelPartial = modalOverlay.querySelector('#label-head-pay-partial');
    const payAmtInput = modalOverlay.querySelector('#pay-head-amount');
    const balPreview = modalOverlay.querySelector('#head-pay-balance-preview');

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
      } else {
        labelFull.style.borderColor = '#E2E8F0';
        labelFull.style.background = '#FFFFFF';
        labelFull.style.color = '#334155';
        labelPartial.style.borderColor = '#D97706';
        labelPartial.style.background = '#FFFBEB';
        labelPartial.style.color = '#92400E';
        payAmtInput.readOnly = false;
        payAmtInput.focus();
        updateBalance();
      }
    }

    function updateBalance() {
      const val = parseFloat(payAmtInput.value) || 0;
      const rem = Math.max(0, remainingDue - val);
      balPreview.innerHTML = `Remaining balance after payment: <strong style="color: ${rem > 0 ? '#DC2626' : '#059669'};">₹${rem.toFixed(2)}</strong>`;
    }

    fullRadio?.addEventListener('change', updatePayModeUI);
    partialRadio?.addEventListener('change', updatePayModeUI);
    payAmtInput?.addEventListener('input', updateBalance);

    modalOverlay.querySelector('#form-head-settle').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountToPay = parseFloat(payAmtInput.value) || 0;
      const method = modalOverlay.querySelector('#pay-head-method').value;
      const notes = modalOverlay.querySelector('#pay-head-notes').value.trim();

      if (amountToPay <= 0 || amountToPay > remainingDue) {
        toast.error(`Please enter an amount up to ${formatCurrency(remainingDue)}.`);
        return;
      }

      await db.recordVehiclePayment({
        trip_id: tripId,
        amount_paid: amountToPay,
        payment_method: method,
        received_by_admin_id: user?.id || 'vehicle_head',
        received_by_admin_name: userName,
        notes: notes ? `${notes} (Collected by Vehicle Head)` : 'Collected by Vehicle Department Head'
      });

      modalOverlay.remove();
      toast.success(`Payment of ${formatCurrency(amountToPay)} recorded for trip ${tripCode}!`);
      renderVehicleHeadDashboard(container, { onNavigate });
    });
  }

  // Initial render
  render();
}
