import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { 
  calculateBillToBillMileage, 
  calculateDynamicRatePerKm, 
  getDocumentExpiryStatus 
} from '../../lib/fleet-engine.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

export async function renderVehicleManagementModule(container, { onNavigate, initialTab = 'fleet' }) {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  if (!isAdmin) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon" style="color: #DC2626; display: flex; justify-content: center; margin-bottom: 1rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <h4>Access Restricted</h4>
        <p>Only School Administrators can access the Vehicle Fleet Management & Compliance console.</p>
      </div>
    `;
    return;
  }

  // Load all required vehicle data
  let activeTab = initialTab;
  let vehicles = await db.getVehicles();
  let documents = await db.getVehicleDocuments();
  let expenses = await db.getVehicleExpenses();
  let trips = await db.getTripLogs();
  let payments = await db.getVehiclePayments();
  let vehicleUsers = await db.getVehicleUsers();

  function render() {
    const pendingTripsCount = trips.filter(t => t.status === 'Pending Approval').length;
    const unpaidTripsCount = trips.filter(t => t.status === 'Completed' && t.payment_status === 'Unpaid').length;

    container.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Vehicle Fleet Management & Usage Billing</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                Fleet compliance, dynamic ₹/KM billing rates, fuel efficiency, and admin settlement ledger
              </p>
            </div>
          </div>
        </div>

        <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="btn-open-my-trips">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            My Vehicle Trips
          </button>
          <button class="btn btn-primary" id="btn-add-vehicle-top">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add New Vehicle
          </button>
        </div>
      </div>

      <!-- Tab Navigation Navigation Header -->
      <div class="tps-tabs-bar" style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-subtle); margin: 1rem 0 1.5rem; overflow-x: auto;">
        <button class="tab-btn ${activeTab === 'fleet' ? 'active' : ''}" data-tab="fleet" style="padding: 0.65rem 1.15rem; font-weight: 600; font-size: 0.88rem; background: none; border: none; border-bottom: 2px solid ${activeTab === 'fleet' ? '#4F46E5' : 'transparent'}; color: ${activeTab === 'fleet' ? '#4F46E5' : 'var(--text-muted)'}; cursor: pointer;">
          Fleet & Documents
        </button>
        <button class="tab-btn ${activeTab === 'requests' ? 'active' : ''}" data-tab="requests" style="padding: 0.65rem 1.15rem; font-weight: 600; font-size: 0.88rem; background: none; border: none; border-bottom: 2px solid ${activeTab === 'requests' ? '#4F46E5' : 'transparent'}; color: ${activeTab === 'requests' ? '#4F46E5' : 'var(--text-muted)'}; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
          Trip Requests
          ${pendingTripsCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #DC2626; border-radius: 12px; font-size: 0.72rem; padding: 1px 6px;">${pendingTripsCount}</span>` : ''}
        </button>
        <button class="tab-btn ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses" style="padding: 0.65rem 1.15rem; font-weight: 600; font-size: 0.88rem; background: none; border: none; border-bottom: 2px solid ${activeTab === 'expenses' ? '#4F46E5' : 'transparent'}; color: ${activeTab === 'expenses' ? '#4F46E5' : 'var(--text-muted)'}; cursor: pointer;">
          Fuel & Maintenance
        </button>
        <button class="tab-btn ${activeTab === 'billing' ? 'active' : ''}" data-tab="billing" style="padding: 0.65rem 1.15rem; font-weight: 600; font-size: 0.88rem; background: none; border: none; border-bottom: 2px solid ${activeTab === 'billing' ? '#4F46E5' : 'transparent'}; color: ${activeTab === 'billing' ? '#4F46E5' : 'var(--text-muted)'}; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
          Billing & Payments
          ${unpaidTripsCount > 0 ? `<span class="badge" style="background: #FEF3C7; color: #D97706; border-radius: 12px; font-size: 0.72rem; padding: 1px 6px;">${unpaidTripsCount} Due</span>` : ''}
        </button>
        <button class="tab-btn ${activeTab === 'users' ? 'active' : ''}" data-tab="users" style="padding: 0.65rem 1.15rem; font-weight: 600; font-size: 0.88rem; background: none; border: none; border-bottom: 2px solid ${activeTab === 'users' ? '#4F46E5' : 'transparent'}; color: ${activeTab === 'users' ? '#4F46E5' : 'var(--text-muted)'}; cursor: pointer;">
          Vehicle Users Directory
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="vehicle-tab-content">
        ${renderTabContent()}
      </div>
    `;

    attachTabEvents();
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'fleet':
        return renderFleetTab();
      case 'requests':
        return renderRequestsTab();
      case 'expenses':
        return renderExpensesTab();
      case 'billing':
        return renderBillingTab();
      case 'users':
        return renderUsersTab();
      default:
        return renderFleetTab();
    }
  }

  // --- TAB 1: FLEET & DOCUMENTS ---
  function renderFleetTab() {
    if (vehicles.length === 0) {
      return `
        <div class="empty-state" style="padding: 3rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-medium); text-align: center;">
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1rem;">No vehicles registered in the fleet yet.</p>
          <button class="btn btn-primary" id="btn-add-vehicle-empty">Register First Vehicle</button>
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.25rem;">
        ${vehicles.map(v => {
          const vDocs = documents.filter(d => d.vehicle_id === v.id);
          const vExpenses = expenses.filter(e => e.vehicle_id === v.id);
          const vTrips = trips.filter(t => t.vehicle_id === v.id);

          // Calculate Dynamic Rate
          const dynamicRateInfo = calculateDynamicRatePerKm(v, expenses, trips);

          // Calculate Latest Bill-to-Bill Mileage
          const fuelLogs = vExpenses
            .filter(e => e.expense_type === 'Fuel' && e.odometer_at_expense)
            .sort((a, b) => Number(b.odometer_at_expense) - Number(a.odometer_at_expense));
          const latestMileage = fuelLogs.find(e => e.calculated_mileage_kmpl !== null && e.calculated_mileage_kmpl !== undefined);

          // Find Document Expiry Warnings
          const docAlerts = vDocs.map(d => {
            const exp = getDocumentExpiryStatus(d.expiry_date);
            return { ...d, exp };
          }).filter(d => d.exp.status === 'expired' || d.exp.status === 'warning');

          const statusColors = {
            Available: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
            'On Trip': { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
            Maintenance: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
            Inactive: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' }
          };
          const sc = statusColors[v.status] || statusColors.Available;

          return `
            <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); position: relative;">
              <div>
                <!-- Top Card Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                      <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700;">${v.vehicle_name}</h4>
                      <span class="badge" style="background: ${sc.bg}; color: ${sc.text}; border: 1px solid ${sc.border}; font-weight: 600; font-size: 0.75rem;">
                        ${v.status || 'Available'}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.25rem;">
                      <span style="font-family: monospace; font-size: 0.9rem; font-weight: 700; background: #0F172A; color: #F8FAFC; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">
                        ${v.reg_number}
                      </span>
                      <span style="font-size: 0.8rem; color: var(--text-muted);">${v.vehicle_type || 'Vehicle'}</span>
                    </div>
                  </div>

                  <div style="text-align: right;">
                    <div style="font-size: 1.15rem; font-weight: 800; color: #4F46E5;">
                      ₹${dynamicRateInfo.rate.toFixed(2)}<span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">/km</span>
                    </div>
                    <span class="badge" style="font-size: 0.68rem; background: ${dynamicRateInfo.isFallback ? '#F1F5F9' : '#EEF2FF'}; color: ${dynamicRateInfo.isFallback ? '#64748B' : '#4F46E5'};">
                      ${dynamicRateInfo.isFallback ? 'Fallback Rate' : '90-Day Rolling Rate'}
                    </span>
                  </div>
                </div>

                <!-- Odometer & Fuel Mileage Box -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--bg-surface-subtle); padding: 0.75rem; border-radius: 8px; margin: 0.75rem 0; border: 1px solid var(--border-subtle);">
                  <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Current Odometer</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); font-family: monospace;">
                      ${Number(v.current_odometer || 0).toLocaleString('en-IN')} <span style="font-size: 0.75rem; font-weight: normal;">KM</span>
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Fuel Mileage (B2B)</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: #059669;">
                      ${latestMileage?.calculated_mileage_kmpl ? `${latestMileage.calculated_mileage_kmpl} <span style="font-size: 0.75rem; font-weight: normal;">km/L</span>` : '<span style="font-size: 0.85rem; color: var(--text-muted);">Awaiting fills</span>'}
                    </div>
                  </div>
                </div>

                <!-- Document Expiry Warning Banners -->
                ${docAlerts.length > 0 ? `
                  <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem;">
                    ${docAlerts.map(a => `
                      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; padding: 4px 8px; border-radius: 6px; background: ${a.exp.status === 'expired' ? '#FEE2E2' : '#FEF3C7'}; color: ${a.exp.color}; border: 1px solid ${a.exp.status === 'expired' ? '#FCA5A5' : '#FDE68A'};">
                        <span style="font-weight: 700;">⚠️ ${a.document_type}: ${a.exp.label}</span>
                        <span style="font-size: 0.7rem; opacity: 0.85;">${formatDate(a.expiry_date)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="font-size: 0.74rem; color: #059669; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.85rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>All compliance documents up to date</span>
                  </div>
                `}
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-sm btn-outline btn-manage-docs" data-id="${v.id}" style="font-size: 0.78rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Documents (${vDocs.length})
                </button>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-sm btn-secondary btn-edit-vehicle" data-id="${v.id}" style="font-size: 0.78rem;">
                    Edit
                  </button>
                  <button class="btn btn-sm btn-outline btn-delete-vehicle" data-id="${v.id}" style="font-size: 0.78rem; color: #DC2626; border-color: #FECACA;">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- TAB 2: TRIP REQUESTS (APPROVAL QUEUE) ---
  function renderRequestsTab() {
    const pendingTrips = trips.filter(t => t.status === 'Pending Approval');

    return `
      <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Trip Approval Queue</h3>
            <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.8rem;">
              Review pending requests from staff, teachers, and admins. All trips are 100% personal & billable.
            </p>
          </div>
          <span class="badge" style="background: ${pendingTrips.length > 0 ? '#FEE2E2' : '#ECFDF5'}; color: ${pendingTrips.length > 0 ? '#DC2626' : '#059669'}; font-weight: 700;">
            ${pendingTrips.length} Pending Approval
          </span>
        </div>

        ${pendingTrips.length === 0 ? `
          <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" style="margin-bottom: 0.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div>No pending trip requests. All submissions have been processed.</div>
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-medium); text-align: left;">
                  <th style="padding: 0.65rem;">Trip ID</th>
                  <th style="padding: 0.65rem;">User & Role</th>
                  <th style="padding: 0.65rem;">Vehicle</th>
                  <th style="padding: 0.65rem;">Destination & Purpose</th>
                  <th style="padding: 0.65rem;">Scheduled Date/Time</th>
                  <th style="padding: 0.65rem;">Dynamic Rate</th>
                  <th style="padding: 0.65rem; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${pendingTrips.map(t => {
                  const veh = vehicles.find(v => v.id === t.vehicle_id);
                  const dynamicRate = calculateDynamicRatePerKm(veh, expenses, trips);

                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                      <td style="padding: 0.65rem; font-family: monospace; font-weight: 700;">${t.trip_id}</td>
                      <td style="padding: 0.65rem;">
                        <strong>${t.user_name}</strong>
                        <div style="font-size: 0.74rem; color: var(--text-muted);">${t.user_role}</div>
                      </td>
                      <td style="padding: 0.65rem;">
                        <strong>${veh?.vehicle_name || 'Vehicle'}</strong>
                        <div style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${veh?.reg_number || ''}</div>
                      </td>
                      <td style="padding: 0.65rem;">
                        <div style="font-weight: 600;">${t.destination}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${t.purpose || 'Personal travel'}</div>
                      </td>
                      <td style="padding: 0.65rem;">
                        <div>${formatDate(t.start_time)}</div>
                        <div style="font-size: 0.74rem; color: var(--text-muted);">Return: ${formatDate(t.end_time)}</div>
                      </td>
                      <td style="padding: 0.65rem; font-weight: 700; color: #4F46E5;">
                        ₹${dynamicRate.rate.toFixed(2)}/km
                      </td>
                      <td style="padding: 0.65rem; text-align: right;">
                        <button class="btn btn-sm btn-primary btn-approve-trip" data-id="${t.id}" data-rate="${dynamicRate.rate}" style="margin-right: 0.35rem; background: #059669; border-color: #059669;">
                          Approve
                        </button>
                        <button class="btn btn-sm btn-outline btn-reject-trip" data-id="${t.id}" style="color: #DC2626; border-color: #FECACA;">
                          Reject
                        </button>
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
  }

  // --- TAB 3: FUEL & MAINTENANCE ---
  function renderExpensesTab() {
    return `
      <div style="display: grid; grid-template-columns: 340px 1fr; gap: 1.5rem; align-items: start;">
        <!-- Left: Log Expense Form -->
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem;">
          <h3 style="margin: 0 0 0.5rem; font-size: 1rem; font-weight: 700;">Log Vehicle Expense</h3>
          <p style="margin: 0 0 1rem; font-size: 0.78rem; color: var(--text-muted);">
            Fuel entries compute real-time bill-to-bill fuel efficiency (km/L).
          </p>

          <form id="form-add-expense">
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Select Vehicle *</label>
              <select id="exp-vehicle-id" class="form-control" required style="width: 100%;">
                <option value="">-- Choose Vehicle --</option>
                ${vehicles.map(v => `<option value="${v.id}">${v.vehicle_name} (${v.reg_number})</option>`).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Expense Type *</label>
              <select id="exp-type" class="form-control" required style="width: 100%;">
                <option value="Fuel">Fuel (Petrol / Diesel / CNG)</option>
                <option value="Maintenance">Maintenance & Service</option>
                <option value="Toll/Tax">Toll & Road Tax</option>
                <option value="Insurance">Insurance Premium</option>
                <option value="Other">Other Operational Expense</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Amount (₹) *</label>
              <input type="number" id="exp-amount" class="form-control" step="0.01" min="1" required placeholder="e.g. 3500.00" style="width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Date of Expense *</label>
              <input type="date" id="exp-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}" style="width: 100%;" />
            </div>

            <!-- Conditional Fuel Fields for Bill-to-Bill Formula -->
            <div id="fuel-fields-box" style="background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.85rem;">
              <div style="font-size: 0.78rem; font-weight: 700; color: #0F172A; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V2"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
                Bill-to-Bill Fuel Metrics
              </div>

              <div class="form-group" style="margin-bottom: 0.65rem;">
                <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem;">Fuel Liters Added *</label>
                <input type="number" id="exp-liters" class="form-control" step="0.01" min="0.1" placeholder="e.g. 35.5" style="width: 100%;" />
              </div>

              <div class="form-group" style="margin-bottom: 0.65rem;">
                <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem;">Odometer at Fueling (KM) *</label>
                <input type="number" id="exp-odometer" class="form-control" min="0" placeholder="e.g. 42850" style="width: 100%;" />
              </div>

              <div id="mileage-live-preview" style="font-size: 0.74rem; color: #059669; font-weight: 600; padding: 4px 6px; background: #ECFDF5; border-radius: 4px; display: none;">
                <!-- Real-time mileage calculation preview -->
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Notes / Invoice Reference</label>
              <textarea id="exp-notes" class="form-control" rows="2" placeholder="e.g. Indian Oil Fuel Pump invoice #4812" style="width: 100%;"></textarea>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Save Expense & Update Fleet</button>
          </form>
        </div>

        <!-- Right: Expense History Table -->
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem;">
          <h3 style="margin: 0 0 1rem; font-size: 1.05rem; font-weight: 700;">Expense & Fuel Efficiency Ledger</h3>

          ${expenses.length === 0 ? `
            <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
              No vehicle expenses recorded yet.
            </div>
          ` : `
            <div style="overflow-x: auto;">
              <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.83rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-medium); text-align: left;">
                    <th style="padding: 0.6rem;">Date</th>
                    <th style="padding: 0.6rem;">Vehicle</th>
                    <th style="padding: 0.6rem;">Type</th>
                    <th style="padding: 0.6rem;">Amount</th>
                    <th style="padding: 0.6rem;">Liters</th>
                    <th style="padding: 0.6rem;">Odometer</th>
                    <th style="padding: 0.6rem;">Mileage (B2B)</th>
                    <th style="padding: 0.6rem;">Notes</th>
                    <th style="padding: 0.6rem; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${expenses.map(e => {
                    const veh = vehicles.find(v => v.id === e.vehicle_id);
                    return `
                      <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 0.6rem;">${formatDate(e.date)}</td>
                        <td style="padding: 0.6rem;">
                          <strong>${veh?.vehicle_name || 'Vehicle'}</strong>
                          <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted);">${veh?.reg_number || ''}</div>
                        </td>
                        <td style="padding: 0.6rem;">
                          <span class="badge" style="font-size: 0.72rem; ${e.expense_type === 'Fuel' ? 'background: #EFF6FF; color: #2563EB;' : 'background: #F1F5F9; color: #475569;'}">
                            ${e.expense_type}
                          </span>
                        </td>
                        <td style="padding: 0.6rem; font-weight: 700;">${formatCurrency(e.amount)}</td>
                        <td style="padding: 0.6rem;">${e.fuel_liters ? `${e.fuel_liters} L` : '—'}</td>
                        <td style="padding: 0.6rem; font-family: monospace;">${e.odometer_at_expense ? `${Number(e.odometer_at_expense).toLocaleString('en-IN')} KM` : '—'}</td>
                        <td style="padding: 0.6rem; font-weight: 700; color: #059669;">
                          ${e.calculated_mileage_kmpl ? `${e.calculated_mileage_kmpl} km/L` : (e.expense_type === 'Fuel' ? '<span style="color: var(--text-muted); font-size: 0.74rem;">Baseline Fill</span>' : '—')}
                        </td>
                        <td style="padding: 0.6rem; font-size: 0.75rem; color: var(--text-muted); max-width: 180px;">${e.notes || '—'}</td>
                        <td style="padding: 0.6rem; text-align: right;">
                          <button class="btn btn-sm btn-outline btn-delete-expense" data-id="${e.id}" style="color: #DC2626; border-color: #FECACA; padding: 2px 6px;">
                            Delete
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- TAB 4: BILLING & PAYMENTS ---
  function renderBillingTab() {
    const unpaidTrips = trips.filter(t => t.status === 'Completed' && t.payment_status === 'Unpaid');

    return `
      <div>
        <!-- Notice banner: 100% Billable & Strict Admin Audit -->
        <div style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span style="font-size: 0.85rem; color: #3730A3; font-weight: 600;">
              100% Billable Policy & Admin Parity: All personal vehicle usage by teachers, external users, and admins is billed. Every settlement permanently logs the receiving admin.
            </span>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; border-bottom: 1px solid var(--border-medium); margin-bottom: 1rem;">
          <button class="billing-subtab-btn active" data-subtab="pending" style="padding: 0.5rem 1rem; font-weight: 600; font-size: 0.85rem; border: none; background: none; border-bottom: 2px solid #4F46E5; color: #4F46E5; cursor: pointer;">
            Sub-Tab 4A: Pending Dues (${unpaidTrips.length})
          </button>
          <button class="billing-subtab-btn" data-subtab="ledger" style="padding: 0.5rem 1rem; font-weight: 600; font-size: 0.85rem; border: none; background: none; border-bottom: 2px solid transparent; color: var(--text-muted); cursor: pointer;">
            Sub-Tab 4B: Audit Settlement Ledger (${payments.length})
          </button>
        </div>

        <!-- Sub-Tab 4A: Pending Dues -->
        <div id="subtab-pending-view">
          <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem;">
            ${unpaidTrips.length === 0 ? `
              <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" style="margin-bottom: 0.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div style="font-weight: 600; color: #059669;">All completed vehicle trips are fully paid! No outstanding dues.</div>
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border-medium); text-align: left;">
                      <th style="padding: 0.65rem;">Trip ID</th>
                      <th style="padding: 0.65rem;">Completed Date</th>
                      <th style="padding: 0.65rem;">User & Role</th>
                      <th style="padding: 0.65rem;">Vehicle</th>
                      <th style="padding: 0.65rem;">Distance</th>
                      <th style="padding: 0.65rem;">Rate</th>
                      <th style="padding: 0.65rem;">Total Due</th>
                      <th style="padding: 0.65rem; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${unpaidTrips.map(t => {
                      const veh = vehicles.find(v => v.id === t.vehicle_id);
                      return `
                        <tr style="border-bottom: 1px solid var(--border-subtle);">
                          <td style="padding: 0.65rem; font-family: monospace; font-weight: 700;">${t.trip_id}</td>
                          <td style="padding: 0.65rem;">${formatDate(t.end_time || t.completed_at || t.created_at)}</td>
                          <td style="padding: 0.65rem;">
                            <strong>${t.user_name}</strong>
                            <div style="font-size: 0.74rem; color: var(--text-muted);">${t.user_role}</div>
                          </td>
                          <td style="padding: 0.65rem;">
                            ${veh?.vehicle_name || 'Vehicle'}
                            <div style="font-family: monospace; font-size: 0.74rem; color: var(--text-muted);">${veh?.reg_number || ''}</div>
                          </td>
                          <td style="padding: 0.65rem; font-family: monospace; font-weight: 600;">${t.total_km || 0} KM</td>
                          <td style="padding: 0.65rem;">₹${Number(t.applied_rate_per_km || 0).toFixed(2)}/km</td>
                          <td style="padding: 0.65rem; font-size: 1rem; font-weight: 800; color: #DC2626;">
                            ${formatCurrency(t.total_amount || 0)}
                          </td>
                          <td style="padding: 0.65rem; text-align: right;">
                            <button class="btn btn-sm btn-primary btn-mark-paid" data-id="${t.id}" data-amount="${t.total_amount}" data-user="${t.user_name}" data-trip="${t.trip_id}" style="background: #059669; border-color: #059669;">
                              Mark as Paid
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>

        <!-- Sub-Tab 4B: Audit Settlement Ledger (Hidden by default) -->
        <div id="subtab-ledger-view" style="display: none;">
          <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem;">
            ${payments.length === 0 ? `
              <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                No payment settlements recorded yet in the audit ledger.
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border-medium); text-align: left;">
                      <th style="padding: 0.65rem;">Payment Date</th>
                      <th style="padding: 0.65rem;">Trip ID</th>
                      <th style="padding: 0.65rem;">Payer User</th>
                      <th style="padding: 0.65rem;">Amount Settled</th>
                      <th style="padding: 0.65rem;">Method</th>
                      <th style="padding: 0.65rem;">Received By Admin (Audit Trail)</th>
                      <th style="padding: 0.65rem;">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${payments.map(p => {
                      const trip = trips.find(t => t.id === p.trip_id || t.trip_id === p.trip_id);
                      return `
                        <tr style="border-bottom: 1px solid var(--border-subtle);">
                          <td style="padding: 0.65rem;">${formatDate(p.payment_date || p.created_at)}</td>
                          <td style="padding: 0.65rem; font-family: monospace; font-weight: 700;">${trip?.trip_id || p.trip_id}</td>
                          <td style="padding: 0.65rem;"><strong>${trip?.user_name || 'Staff User'}</strong></td>
                          <td style="padding: 0.65rem; font-weight: 800; color: #059669;">${formatCurrency(p.amount_paid)}</td>
                          <td style="padding: 0.65rem;">
                            <span class="badge" style="background: #F1F5F9; color: #334155; font-size: 0.75rem;">
                              ${p.payment_method || 'Cash'}
                            </span>
                          </td>
                          <td style="padding: 0.65rem;">
                            <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700; font-size: 0.78rem;">
                              ✓ Admin: ${p.received_by_admin_name || 'Admin'}
                            </span>
                          </td>
                          <td style="padding: 0.65rem; font-size: 0.75rem; color: var(--text-muted);">${p.notes || '—'}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB 5: VEHICLE USERS DIRECTORY ---
  function renderUsersTab() {
    return `
      <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Authorized Vehicle Users Directory</h3>
            <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.8rem;">
              Manage campus drivers, transport coordinators, and authorized non-teaching personnel who can book and drive vehicles.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-add-vehicle-user">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            Onboard New Vehicle User
          </button>
        </div>

        ${vehicleUsers.length === 0 ? `
          <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            No vehicle users registered yet.
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-medium); text-align: left;">
                  <th style="padding: 0.65rem;">ID</th>
                  <th style="padding: 0.65rem;">Full Name</th>
                  <th style="padding: 0.65rem;">Designation</th>
                  <th style="padding: 0.65rem;">Contact Number</th>
                  <th style="padding: 0.65rem;">Email</th>
                  <th style="padding: 0.65rem;">Status</th>
                  <th style="padding: 0.65rem; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${vehicleUsers.map(u => `
                  <tr style="border-bottom: 1px solid var(--border-subtle);">
                    <td style="padding: 0.65rem; font-family: monospace; font-weight: 700;">${u.tps_id || 'VUS'}</td>
                    <td style="padding: 0.65rem; font-weight: 600;">${u.full_name}</td>
                    <td style="padding: 0.65rem; color: var(--text-muted);">${u.designation || 'Driver'}</td>
                    <td style="padding: 0.65rem; font-family: monospace;">${u.phone || '—'}</td>
                    <td style="padding: 0.65rem; font-size: 0.8rem; color: var(--text-muted);">${u.email || '—'}</td>
                    <td style="padding: 0.65rem;">
                      <span class="badge" style="background: ${u.status === 'Active' ? '#ECFDF5' : '#F1F5F9'}; color: ${u.status === 'Active' ? '#059669' : '#64748B'}; font-weight: 600;">
                        ${u.status || 'Active'}
                      </span>
                    </td>
                    <td style="padding: 0.65rem; text-align: right;">
                      <button class="btn btn-sm btn-outline btn-edit-vehicle-user" data-id="${u.id}" style="margin-right: 0.35rem; font-size: 0.78rem;">
                        Edit
                      </button>
                      <button class="btn btn-sm btn-outline btn-delete-vehicle-user" data-id="${u.id}" style="color: #DC2626; border-color: #FECACA; font-size: 0.78rem;">
                        Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  // --- EVENT ATTACHMENTS & MODALS ---
  function attachTabEvents() {
    // Tab switching
    container.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // "My Vehicle Trips" navigation shortcut
    container.querySelector('#btn-open-my-trips')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('vehicle_trips');
    });

    // Add Vehicle Modals
    container.querySelector('#btn-add-vehicle-top')?.addEventListener('click', openAddVehicleModal);
    container.querySelector('#btn-add-vehicle-empty')?.addEventListener('click', openAddVehicleModal);

    // Edit Vehicle
    container.querySelectorAll('.btn-edit-vehicle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const v = vehicles.find(item => item.id === id);
        if (v) openEditVehicleModal(v);
      });
    });

    // Delete Vehicle
    container.querySelectorAll('.btn-delete-vehicle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this vehicle from the fleet? This action cannot be undone.')) {
          await db.deleteVehicle(id);
          vehicles = await db.getVehicles();
          toast.success('Vehicle removed from fleet.');
          render();
        }
      });
    });

    // Manage Documents Modal
    container.querySelectorAll('.btn-manage-docs').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const v = vehicles.find(item => item.id === id);
        if (v) openDocumentsModal(v);
      });
    });

    // Trip Requests: Approve
    container.querySelectorAll('.btn-approve-trip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tripId = btn.getAttribute('data-id');
        const appliedRate = parseFloat(btn.getAttribute('data-rate')) || 15.00;
        const targetTrip = trips.find(t => t.id === tripId);
        if (!targetTrip) return;

        targetTrip.status = 'Approved';
        targetTrip.applied_rate_per_km = appliedRate;
        targetTrip.approved_by = currentUser?.full_name || 'Admin';
        targetTrip.approved_at = new Date().toISOString();

        await db.saveTripLog(targetTrip);
        trips = await db.getTripLogs();
        toast.success(`Trip ${targetTrip.trip_id} approved! Locked rate: ₹${appliedRate.toFixed(2)}/km.`);
        render();
      });
    });

    // Trip Requests: Reject
    container.querySelectorAll('.btn-reject-trip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tripId = btn.getAttribute('data-id');
        const reason = prompt('Please enter the reason for rejecting this trip request:');
        if (reason === null) return; // user cancelled prompt

        const targetTrip = trips.find(t => t.id === tripId);
        if (!targetTrip) return;

        targetTrip.status = 'Rejected';
        targetTrip.rejection_reason = reason.trim() || 'Declined by Administrator';

        await db.saveTripLog(targetTrip);
        trips = await db.getTripLogs();
        toast.info(`Trip request ${targetTrip.trip_id} rejected.`);
        render();
      });
    });

    // Fuel Fields Dynamic Toggle & Live Mileage Calculation
    const expTypeSelect = container.querySelector('#exp-type');
    const fuelBox = container.querySelector('#fuel-fields-box');
    const vehicleSelect = container.querySelector('#exp-vehicle-id');
    const litersInput = container.querySelector('#exp-liters');
    const odoInput = container.querySelector('#exp-odometer');
    const liveMileagePreview = container.querySelector('#mileage-live-preview');

    function updateLiveMileage() {
      if (!expTypeSelect || expTypeSelect.value !== 'Fuel') return;
      const vId = vehicleSelect?.value;
      const lit = parseFloat(litersInput?.value);
      const odo = parseFloat(odoInput?.value);

      if (vId && lit > 0 && odo > 0) {
        const res = calculateBillToBillMileage(vId, odo, lit, expenses);
        if (liveMileagePreview) {
          liveMileagePreview.style.display = 'block';
          if (res?.isInitialBaseline) {
            liveMileagePreview.textContent = 'ℹ️ Initial baseline fuel fill (future fills will compute exact mileage)';
            liveMileagePreview.style.color = '#2563EB';
            liveMileagePreview.style.background = '#EFF6FF';
          } else if (res?.mileage) {
            liveMileagePreview.textContent = `🎯 Calculated Mileage: ${res.mileage} km/L (${res.distance} km on ${lit} L)`;
            liveMileagePreview.style.color = '#059669';
            liveMileagePreview.style.background = '#ECFDF5';
          } else {
            liveMileagePreview.style.display = 'none';
          }
        }
      } else if (liveMileagePreview) {
        liveMileagePreview.style.display = 'none';
      }
    }

    expTypeSelect?.addEventListener('change', () => {
      if (fuelBox) {
        fuelBox.style.display = expTypeSelect.value === 'Fuel' ? 'block' : 'none';
      }
    });

    vehicleSelect?.addEventListener('change', updateLiveMileage);
    litersInput?.addEventListener('input', updateLiveMileage);
    odoInput?.addEventListener('input', updateLiveMileage);

    // Save Expense Form
    container.querySelector('#form-add-expense')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const vId = vehicleSelect.value;
      const type = expTypeSelect.value;
      const amount = parseFloat(container.querySelector('#exp-amount').value);
      const date = container.querySelector('#exp-date').value;
      const notes = container.querySelector('#exp-notes').value.trim();

      let fuelLiters = null;
      let odometer = null;
      let calculatedMileage = null;

      if (type === 'Fuel') {
        fuelLiters = parseFloat(litersInput.value);
        odometer = parseFloat(odoInput.value);
        if (isNaN(fuelLiters) || fuelLiters <= 0) {
          toast.error('Please enter valid fuel liters added.');
          return;
        }
        if (isNaN(odometer) || odometer <= 0) {
          toast.error('Please enter the vehicle odometer reading at fueling.');
          return;
        }

        const calc = calculateBillToBillMileage(vId, odometer, fuelLiters, expenses);
        calculatedMileage = calc?.mileage || null;
      }

      await db.saveVehicleExpense({
        vehicle_id: vId,
        expense_type: type,
        amount,
        date,
        fuel_liters: fuelLiters,
        odometer_at_expense: odometer,
        calculated_mileage_kmpl: calculatedMileage,
        notes,
        logged_by: currentUser?.full_name || 'Admin'
      });

      expenses = await db.getVehicleExpenses();
      vehicles = await db.getVehicles();
      toast.success('Vehicle expense logged successfully.');
      render();
    });

    // Delete Expense
    container.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this expense record?')) {
          await db.deleteVehicleExpense(id);
          expenses = await db.getVehicleExpenses();
          toast.success('Expense deleted.');
          render();
        }
      });
    });

    // Sub-tab toggling in Billing Tab
    container.querySelectorAll('.billing-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-subtab');
        container.querySelectorAll('.billing-subtab-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.style.borderBottomColor = b === btn ? '#4F46E5' : 'transparent';
          b.style.color = b === btn ? '#4F46E5' : 'var(--text-muted)';
        });
        const pendView = container.querySelector('#subtab-pending-view');
        const ledgView = container.querySelector('#subtab-ledger-view');
        if (pendView) pendView.style.display = sub === 'pending' ? 'block' : 'none';
        if (ledgView) ledgView.style.display = sub === 'ledger' ? 'block' : 'none';
      });
    });

    // Mark as Paid Button (Audit Settlement Ledger)
    container.querySelectorAll('.btn-mark-paid').forEach(btn => {
      btn.addEventListener('click', () => {
        const tripId = btn.getAttribute('data-id');
        const amount = parseFloat(btn.getAttribute('data-amount')) || 0;
        const userName = btn.getAttribute('data-user');
        const tripCode = btn.getAttribute('data-trip');
        openMarkPaidModal({ tripId, amount, userName, tripCode });
      });
    });

    // Vehicle Users: Onboard
    container.querySelector('#btn-add-vehicle-user')?.addEventListener('click', openAddVehicleUserModal);

    // Vehicle Users: Delete
    container.querySelectorAll('.btn-delete-vehicle-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Remove this vehicle user account?')) {
          await db.deleteVehicleUser(id);
          vehicleUsers = await db.getVehicleUsers();
          toast.success('Vehicle user removed.');
          render();
        }
      });
    });
  }

  // --- MODAL: ADD VEHICLE ---
  function openAddVehicleModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 520px; box-shadow: var(--shadow-xl); overflow: hidden;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Add Vehicle to School Fleet</h3>
          <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">✕</button>
        </div>

        <form id="form-create-vehicle" style="padding: 1.5rem;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Display Name *</label>
            <input type="text" id="v-name" class="form-control" required placeholder="e.g. Thaiba Traveler Bus 2" style="width: 100%;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Registration Plate *</label>
              <input type="text" id="v-reg" class="form-control" required placeholder="e.g. KL-55-XY-7890" style="width: 100%; text-transform: uppercase;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Category *</label>
              <select id="v-type" class="form-control" required style="width: 100%;">
                <option value="Van / Minibus">Van / Minibus</option>
                <option value="Car / Sedan">Car / Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Utility Vehicle">Utility Vehicle</option>
                <option value="School Bus">School Bus</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Current Odometer (KM) *</label>
              <input type="number" id="v-odo" class="form-control" required min="0" placeholder="e.g. 45000" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Fallback Rate (₹/KM) *</label>
              <input type="number" id="v-rate" class="form-control" required min="1" step="0.5" value="16.00" style="width: 100%;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.25rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Cost Buffer (%) *</label>
              <input type="number" id="v-buffer" class="form-control" required min="0" max="50" value="10" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Operational Status *</label>
              <select id="v-status" class="form-control" required style="width: 100%;">
                <option value="Available">Available</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Vehicle</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#form-create-vehicle').addEventListener('submit', async (e) => {
      e.preventDefault();
      const vName = modalOverlay.querySelector('#v-name').value.trim();
      const vReg = modalOverlay.querySelector('#v-reg').value.trim().toUpperCase();
      const vType = modalOverlay.querySelector('#v-type').value;
      const vOdo = parseFloat(modalOverlay.querySelector('#v-odo').value) || 0;
      const vRate = parseFloat(modalOverlay.querySelector('#v-rate').value) || 16.00;
      const vBuffer = parseFloat(modalOverlay.querySelector('#v-buffer').value) || 10;
      const vStatus = modalOverlay.querySelector('#v-status').value;

      await db.saveVehicle({
        vehicle_name: vName,
        reg_number: vReg,
        vehicle_type: vType,
        current_odometer: vOdo,
        fallback_rate_per_km: vRate,
        buffer_percentage: vBuffer,
        status: vStatus
      });

      vehicles = await db.getVehicles();
      modalOverlay.remove();
      toast.success('New vehicle added to fleet!');
      render();
    });
  }

  // --- MODAL: EDIT VEHICLE ---
  function openEditVehicleModal(v) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 520px; box-shadow: var(--shadow-xl); overflow: hidden;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Edit Vehicle — ${v.vehicle_name}</h3>
          <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">✕</button>
        </div>

        <form id="form-edit-vehicle" style="padding: 1.5rem;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Display Name *</label>
            <input type="text" id="ev-name" class="form-control" required value="${v.vehicle_name}" style="width: 100%;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Registration Plate *</label>
              <input type="text" id="ev-reg" class="form-control" required value="${v.reg_number}" style="width: 100%; text-transform: uppercase;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Category *</label>
              <select id="ev-type" class="form-control" required style="width: 100%;">
                <option value="Van / Minibus" ${v.vehicle_type === 'Van / Minibus' ? 'selected' : ''}>Van / Minibus</option>
                <option value="Car / Sedan" ${v.vehicle_type === 'Car / Sedan' ? 'selected' : ''}>Car / Sedan</option>
                <option value="SUV" ${v.vehicle_type === 'SUV' ? 'selected' : ''}>SUV</option>
                <option value="Utility Vehicle" ${v.vehicle_type === 'Utility Vehicle' ? 'selected' : ''}>Utility Vehicle</option>
                <option value="School Bus" ${v.vehicle_type === 'School Bus' ? 'selected' : ''}>School Bus</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Current Odometer (KM) *</label>
              <input type="number" id="ev-odo" class="form-control" required min="0" value="${v.current_odometer || 0}" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Fallback Rate (₹/KM) *</label>
              <input type="number" id="ev-rate" class="form-control" required min="1" step="0.5" value="${v.fallback_rate_per_km || 15}" style="width: 100%;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.25rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Cost Buffer (%) *</label>
              <input type="number" id="ev-buffer" class="form-control" required min="0" max="50" value="${v.buffer_percentage || 10}" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Operational Status *</label>
              <select id="ev-status" class="form-control" required style="width: 100%;">
                <option value="Available" ${v.status === 'Available' ? 'selected' : ''}>Available</option>
                <option value="On Trip" ${v.status === 'On Trip' ? 'selected' : ''}>On Trip</option>
                <option value="Maintenance" ${v.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                <option value="Inactive" ${v.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#form-edit-vehicle').addEventListener('submit', async (e) => {
      e.preventDefault();
      const vName = modalOverlay.querySelector('#ev-name').value.trim();
      const vReg = modalOverlay.querySelector('#ev-reg').value.trim().toUpperCase();
      const vType = modalOverlay.querySelector('#ev-type').value;
      const vOdo = parseFloat(modalOverlay.querySelector('#ev-odo').value) || 0;
      const vRate = parseFloat(modalOverlay.querySelector('#ev-rate').value) || 16.00;
      const vBuffer = parseFloat(modalOverlay.querySelector('#ev-buffer').value) || 10;
      const vStatus = modalOverlay.querySelector('#ev-status').value;

      await db.saveVehicle({
        ...v,
        vehicle_name: vName,
        reg_number: vReg,
        vehicle_type: vType,
        current_odometer: vOdo,
        fallback_rate_per_km: vRate,
        buffer_percentage: vBuffer,
        status: vStatus
      });

      vehicles = await db.getVehicles();
      modalOverlay.remove();
      toast.success('Vehicle updated successfully.');
      render();
    });
  }

  // --- MODAL: COMPLIANCE DOCUMENTS ---
  function openDocumentsModal(v) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    function renderDocsList() {
      const vDocs = documents.filter(d => d.vehicle_id === v.id);

      modalOverlay.innerHTML = `
        <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 640px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden;">
          <div style="padding: 1.15rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Compliance Documents — ${v.vehicle_name}</h3>
              <p style="margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">${v.reg_number}</p>
            </div>
            <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">✕</button>
          </div>

          <div style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1;">
            <!-- Document List -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <strong style="font-size: 0.9rem;">Registered Documents</strong>
              <button class="btn btn-sm btn-outline" id="btn-show-add-doc" style="font-size: 0.75rem;">+ Add Document</button>
            </div>

            <!-- Form: Add/Edit Document (hidden by default) -->
            <div id="add-doc-form-wrap" style="display: none; background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <h4 style="margin: 0 0 0.65rem; font-size: 0.88rem; font-weight: 700;">Add / Update Document</h4>
              <form id="form-add-doc">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.65rem;">
                  <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem;">Document Type *</label>
                    <select id="doc-type" class="form-control" required style="width: 100%;">
                      <option value="RC">RC (Registration Certificate)</option>
                      <option value="Insurance">Insurance Policy</option>
                      <option value="Pollution (PUC)">Pollution (PUC Certificate)</option>
                      <option value="Road Tax">Road Tax Certificate</option>
                      <option value="Fitness Certificate">Fitness Certificate</option>
                      <option value="Permit">Transport Permit</option>
                    </select>
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem;">Document Number *</label>
                    <input type="text" id="doc-num" class="form-control" required placeholder="e.g. POL-KL-2026-99" style="width: 100%; text-transform: uppercase;" />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem;">Expiry Date *</label>
                    <input type="date" id="doc-exp" class="form-control" required style="width: 100%;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem;">Notes / Issuer</label>
                    <input type="text" id="doc-notes" class="form-control" placeholder="e.g. New India Assurance" style="width: 100%;" />
                  </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                  <button type="button" class="btn btn-sm btn-secondary" id="btn-cancel-doc-form">Cancel</button>
                  <button type="submit" class="btn btn-sm btn-primary">Save Document</button>
                </div>
              </form>
            </div>

            <!-- Documents Table -->
            ${vDocs.length === 0 ? `
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                No compliance documents registered yet for this vehicle.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                ${vDocs.map(d => {
                  const exp = getDocumentExpiryStatus(d.expiry_date);
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-surface); flex-wrap: wrap; gap: 0.5rem;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                          <strong style="font-size: 0.9rem;">${d.document_type}</strong>
                          <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-subtle); padding: 1px 6px; border-radius: 4px;">
                            ${d.document_number}
                          </span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                          Expires: <strong>${formatDate(d.expiry_date)}</strong>
                          ${d.notes ? ` • ${d.notes}` : ''}
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span class="badge ${exp.badgeClass}" style="font-size: 0.75rem; font-weight: 600;">
                          ${exp.label}
                        </span>
                        <button class="btn btn-sm btn-outline btn-delete-doc" data-id="${d.id}" style="color: #DC2626; border-color: #FECACA; padding: 2px 6px; font-size: 0.75rem;">
                          ✕
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end;">
            <button class="btn btn-secondary btn-close-modal">Done</button>
          </div>
        </div>
      `;

      modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
        b.addEventListener('click', () => modalOverlay.remove());
      });

      const addDocWrap = modalOverlay.querySelector('#add-doc-form-wrap');
      modalOverlay.querySelector('#btn-show-add-doc')?.addEventListener('click', () => {
        if (addDocWrap) addDocWrap.style.display = 'block';
      });
      modalOverlay.querySelector('#btn-cancel-doc-form')?.addEventListener('click', () => {
        if (addDocWrap) addDocWrap.style.display = 'none';
      });

      // Submit Document
      modalOverlay.querySelector('#form-add-doc')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = modalOverlay.querySelector('#doc-type').value;
        const num = modalOverlay.querySelector('#doc-num').value.trim().toUpperCase();
        const exp = modalOverlay.querySelector('#doc-exp').value;
        const notes = modalOverlay.querySelector('#doc-notes').value.trim();

        await db.saveVehicleDocument({
          vehicle_id: v.id,
          document_type: type,
          document_number: num,
          expiry_date: exp,
          notes
        });

        documents = await db.getVehicleDocuments();
        toast.success(`${type} added successfully.`);
        renderDocsList();
        render(); // update background badge warnings
      });

      // Delete Document
      modalOverlay.querySelectorAll('.btn-delete-doc').forEach(b => {
        b.addEventListener('click', async () => {
          const docId = b.getAttribute('data-id');
          await db.deleteVehicleDocument(docId);
          documents = await db.getVehicleDocuments();
          toast.success('Document deleted.');
          renderDocsList();
          render();
        });
      });
    }

    renderDocsList();
    document.body.appendChild(modalOverlay);
  }

  // --- MODAL: MARK AS PAID (STRICT AUDIT LEDGER) ---
  function openMarkPaidModal({ tripId, amount, userName, tripCode }) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 480px; box-shadow: var(--shadow-xl); overflow: hidden;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Record Trip Bill Settlement</h3>
          <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">✕</button>
        </div>

        <form id="form-settle-payment" style="padding: 1.5rem;">
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1.15rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; color: #065F46; font-weight: 600;">TRIP REFERENCE</div>
                <div style="font-weight: 700; font-family: monospace; font-size: 1rem;">${tripCode}</div>
                <div style="font-size: 0.8rem; color: #047857;">User: ${userName}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.75rem; color: #065F46; font-weight: 600;">AMOUNT DUE</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #065F46;">${formatCurrency(amount)}</div>
              </div>
            </div>
          </div>

          <!-- Strict Financial Audit Notice -->
          <div style="font-size: 0.78rem; color: #3730A3; background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 6px; padding: 0.65rem; margin-bottom: 1rem;">
            <strong>Audit Record:</strong> This payment will be permanently logged with your name (<strong>${currentUser?.full_name || 'Admin'}</strong>) as the receiving officer.
          </div>

          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Payment Method *</label>
            <select id="pay-method" class="form-control" required style="width: 100%;">
              <option value="Cash">Cash (Received at School Office)</option>
              <option value="UPI / GPay">UPI / GPay (School QR Scan)</option>
              <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
              <option value="Salary Deduction">Staff Salary Deduction</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Transaction Ref / Receipt Notes</label>
            <input type="text" id="pay-notes" class="form-control" placeholder="e.g. UPI Ref #49281982 or Office Receipt #0912" style="width: 100%;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669;">
              Confirm Settlement & Mark Paid
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#form-settle-payment').addEventListener('submit', async (e) => {
      e.preventDefault();
      const method = modalOverlay.querySelector('#pay-method').value;
      const notes = modalOverlay.querySelector('#pay-notes').value.trim();

      await db.recordVehiclePayment({
        trip_id: tripId,
        amount_paid: amount,
        payment_method: method,
        received_by_admin_id: currentUser?.id || 'admin',
        received_by_admin_name: currentUser?.full_name || 'Admin',
        notes
      });

      trips = await db.getTripLogs();
      payments = await db.getVehiclePayments();
      modalOverlay.remove();
      toast.success(`Trip ${tripCode} marked as Paid! Audit record logged.`);
      render();
    });
  }

  // --- MODAL: ONBOARD VEHICLE USER ---
  function openAddVehicleUserModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: var(--radius-lg); width: 100%; max-width: 480px; box-shadow: var(--shadow-xl); overflow: hidden;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Onboard Vehicle User</h3>
          <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">✕</button>
        </div>

        <form id="form-create-vu" style="padding: 1.5rem;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Full Name *</label>
            <input type="text" id="vu-name" class="form-control" required placeholder="e.g. Sameer Driver" style="width: 100%;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Phone Number *</label>
              <input type="tel" id="vu-phone" class="form-control" required placeholder="e.g. +91 98470 12345" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Staff / Driver ID</label>
              <input type="text" id="vu-id" class="form-control" placeholder="e.g. VUS003" style="width: 100%; text-transform: uppercase;" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Email Address *</label>
            <input type="email" id="vu-email" class="form-control" required placeholder="e.g. sameer.driver@thaibaschool.edu.in" style="width: 100%;" />
          </div>

          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Designation / Role</label>
            <input type="text" id="vu-desig" class="form-control" placeholder="e.g. Primary School Van Driver" style="width: 100%;" />
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">License Details / Notes</label>
            <textarea id="vu-notes" class="form-control" rows="2" placeholder="e.g. Heavy passenger badge valid through 2029" style="width: 100%;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create User Account</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#form-create-vu').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalOverlay.querySelector('#vu-name').value.trim();
      const phone = modalOverlay.querySelector('#vu-phone').value.trim();
      const email = modalOverlay.querySelector('#vu-email').value.trim().toLowerCase();
      const staffId = modalOverlay.querySelector('#vu-id').value.trim().toUpperCase();
      const designation = modalOverlay.querySelector('#vu-desig').value.trim() || 'Driver';
      const notes = modalOverlay.querySelector('#vu-notes').value.trim();

      await db.saveVehicleUser({
        full_name: name,
        phone,
        email,
        tps_id: staffId,
        designation,
        notes,
        status: 'Active'
      });

      vehicleUsers = await db.getVehicleUsers();
      modalOverlay.remove();
      toast.success(`Vehicle User "${name}" onboarded successfully.`);
      render();
    });
  }

  // Initial render
  render();
}
