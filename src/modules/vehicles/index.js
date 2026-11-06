import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { 
  calculateBillToBillMileage, 
  calculateDynamicRatePerKm, 
  getDocumentExpiryStatus 
} from '../../lib/fleet-engine.js';
import { formatCurrency, formatDate, compressImage } from '../../lib/utils.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';

export function normalizeVehicleCategory(type = '') {
  const t = String(type || '').trim().toLowerCase();
  if (t === '2 wheeler' || t.includes('2') || t.includes('bike') || t.includes('scooter') || t.includes('unicorn')) return '2 Wheeler';
  if (t === '3 wheeler' || t.includes('3') || t.includes('auto') || t.includes('rickshaw')) return '3 Wheeler';
  if (t === 'heavy' || t.includes('heavy') || t.includes('bus') || t.includes('truck')) return 'Heavy';
  return '4 Wheeler';
}

export function getVehicleTypeIcon(type = '') {
  const norm = normalizeVehicleCategory(type);
  if (norm === '2 Wheeler') return '🏍️';
  if (norm === '3 Wheeler') return '🛺';
  if (norm === 'Heavy') return '🚌';
  return '🚗';
}
import { enhanceDateInput } from '../../components/date-picker.js';

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
  let selectedExpenseVehicleId = vehicles[0]?.id || '';

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
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">${
                activeTab === 'fleet' ? 'Fleet Overview & Documents' :
                activeTab === 'requests' ? 'Trip Approval Queue' :
                activeTab === 'expenses' ? 'Log Vehicle Expense' :
                activeTab === 'expense_ledger' ? 'Fuel & Expense Ledger' :
                activeTab === 'billing' ? 'Usage Billing & Settlement Ledger' :
                'Authorized Drivers & Staff'
              }</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                ${
                  activeTab === 'fleet' ? 'Vehicle master registry, photos, live odometers, and compliance document tracking' :
                  activeTab === 'requests' ? 'Review and approve/reject vehicle travel requests from staff and drivers' :
                  activeTab === 'expenses' ? 'Record fuel fills and maintenance expenses with bill-to-bill metrics' :
                  activeTab === 'expense_ledger' ? 'Real-time bill-to-bill fuel efficiency (km/L) and maintenance records' :
                  activeTab === 'billing' ? 'Unpaid trip dues settlement (with partial payment support) and immutable audit ledger' :
                  'Directory of campus drivers and transport personnel'
                }
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

      <div style="margin: 0.75rem 0 1.25rem;"></div>

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
      case 'expense_ledger':
        return renderExpenseLedgerTab();
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

    const statusColors = {
      Available: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
      'On Trip': { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
      Maintenance: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
      Inactive: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' }
    };

    return `
      <div>
        <!-- Desktop View (Only): Master Institutional Table -->
        <div class="card-panel fleet-desktop-table" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; overflow-x: auto; box-shadow: var(--shadow-sm); margin-bottom: 1.5rem;">
          <table class="data-table fleet-desktop-table-el" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                <th style="padding: 0.75rem 0.65rem;">Vehicle</th>
                <th style="padding: 0.75rem 0.65rem;">Category</th>
                <th style="padding: 0.75rem 0.65rem;">Current Odometer</th>
                <th style="padding: 0.75rem 0.65rem;">Fuel Mileage (B2B)</th>
                <th style="padding: 0.75rem 0.65rem;">Dynamic Rate</th>
                <th style="padding: 0.75rem 0.65rem;">Short Ride Mode</th>
                <th style="padding: 0.75rem 0.65rem;">Compliance Status</th>
                <th style="padding: 0.75rem 0.65rem;">Status</th>
                <th style="padding: 0.75rem 0.65rem; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${vehicles.map(v => {
                const vDocs = documents.filter(d => d.vehicle_id === v.id);
                const vExpenses = expenses.filter(e => e.vehicle_id === v.id);
                const dynamicRateInfo = calculateDynamicRatePerKm(v, expenses, trips);
                const fuelLogs = vExpenses
                  .filter(e => e.expense_type === 'Fuel' && e.odometer_at_expense)
                  .sort((a, b) => Number(b.odometer_at_expense) - Number(a.odometer_at_expense));
                const latestMileage = fuelLogs.find(e => e.calculated_mileage_kmpl !== null && e.calculated_mileage_kmpl !== undefined);
                const docAlerts = vDocs.map(d => ({ ...d, exp: getDocumentExpiryStatus(d.expiry_date) }))
                  .filter(d => d.exp.status === 'expired' || d.exp.status === 'warning');
                const sc = statusColors[v.status] || statusColors.Available;

                return `
                  <tr style="border-bottom: 1px solid var(--border-subtle); vertical-align: middle;">
                    <td style="padding: 0.75rem 0.65rem;">
                      <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 44px; height: 38px; border-radius: 6px; background: #F1F5F9; border: 1px solid var(--border-medium); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                          ${v.photo_url ? `
                            <img src="${v.photo_url}" alt="${v.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                          ` : `
                            <span style="font-size: 1.25rem;">${getVehicleTypeIcon(v.vehicle_type)}</span>
                          `}
                        </div>
                        <div>
                          <div style="font-weight: 700; color: #0F172A; font-size: 0.9rem;">${v.vehicle_name}</div>
                          <span style="font-family: monospace; font-size: 0.74rem; font-weight: 700; background: #0F172A; color: #FFFFFF; padding: 1px 5px; border-radius: 3px;">
                            ${v.reg_number}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style="padding: 0.75rem 0.65rem;">
                      <span class="badge" style="font-size: 0.72rem; background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; font-weight: 700;">
                        ${normalizeVehicleCategory(v.vehicle_type)}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 0.65rem; font-family: monospace; font-weight: 700; font-size: 0.88rem; color: #0F172A;">
                      ${Number(v.current_odometer || 0).toLocaleString('en-IN')} KM
                    </td>
                    <td style="padding: 0.75rem 0.65rem;">
                      ${latestMileage?.calculated_mileage_kmpl ? `
                        <span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-weight: 800; font-size: 0.78rem;">
                          ${latestMileage.calculated_mileage_kmpl} km/L
                        </span>
                      ` : '<span style="font-size: 0.75rem; color: var(--text-muted);">Awaiting fills</span>'}
                    </td>
                    <td style="padding: 0.75rem 0.65rem;">
                      <div style="font-size: 0.95rem; font-weight: 800; color: #4F46E5; line-height: 1.1;">
                        ₹${dynamicRateInfo.rate.toFixed(2)}<span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted);">/km</span>
                      </div>
                      <span class="badge" style="font-size: 0.64rem; background: ${dynamicRateInfo.isFallback ? '#F1F5F9' : '#EEF2FF'}; color: ${dynamicRateInfo.isFallback ? '#64748B' : '#4F46E5'}; padding: 1px 4px; margin-top: 2px;">
                        ${dynamicRateInfo.isFallback ? 'Fallback' : 'Rolling 90d'}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 0.65rem;">
                      ${v.allow_instant_short_ride !== false ? `
                        <span class="badge" style="background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; font-size: 0.7rem; font-weight: 700;">
                          Instant Ride
                        </span>
                      ` : `
                        <span class="badge" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-size: 0.7rem; font-weight: 700;">
                          Approval Req
                        </span>
                      `}
                    </td>
                    <td style="padding: 0.75rem 0.65rem;">
                      ${docAlerts.length > 0 ? `
                        <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-size: 0.7rem; font-weight: 700;">
                          ${docAlerts.length} Expiry Alert(s)
                        </span>
                      ` : `
                        <span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-size: 0.7rem; font-weight: 600;">
                          ✓ Up to Date
                        </span>
                      `}
                    </td>
                    <td style="padding: 0.75rem 0.65rem;">
                      <span class="badge" style="background: ${sc.bg}; color: ${sc.text}; border: 1px solid ${sc.border}; font-weight: 700; font-size: 0.72rem; padding: 2px 7px;">
                        ${v.status || 'Available'}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 0.65rem; text-align: right; white-space: nowrap;">
                      <button class="btn btn-sm btn-outline btn-manage-docs" data-id="${v.id}" style="font-size: 0.74rem; padding: 3px 8px; margin-right: 4px;">
                        Docs (${vDocs.length})
                      </button>
                      <button class="btn btn-sm btn-secondary btn-edit-vehicle" data-id="${v.id}" style="font-size: 0.74rem; padding: 3px 8px; margin-right: 4px;">
                        Edit
                      </button>
                      <button class="btn btn-sm btn-outline btn-delete-vehicle" data-id="${v.id}" style="font-size: 0.74rem; padding: 3px 8px; color: #DC2626; border-color: #FECACA;">
                        Delete
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile View (Only): Responsive Fleet Cards Grid -->
        <div class="fleet-mobile-cards" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
          ${vehicles.map(v => {
            const vDocs = documents.filter(d => d.vehicle_id === v.id);
            const vExpenses = expenses.filter(e => e.vehicle_id === v.id);
            const dynamicRateInfo = calculateDynamicRatePerKm(v, expenses, trips);
            const fuelLogs = vExpenses
              .filter(e => e.expense_type === 'Fuel' && e.odometer_at_expense)
              .sort((a, b) => Number(b.odometer_at_expense) - Number(a.odometer_at_expense));
            const latestMileage = fuelLogs.find(e => e.calculated_mileage_kmpl !== null && e.calculated_mileage_kmpl !== undefined);
            const docAlerts = vDocs.map(d => ({ ...d, exp: getDocumentExpiryStatus(d.expiry_date) }))
              .filter(d => d.exp.status === 'expired' || d.exp.status === 'warning');
            const sc = statusColors[v.status] || statusColors.Available;

            return `
              <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); position: relative;">
                <div>
                  <div style="display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div style="width: 64px; height: 54px; border-radius: 8px; background: #F1F5F9; border: 1px solid var(--border-medium); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                      ${v.photo_url ? `
                        <img src="${v.photo_url}" alt="${v.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                      ` : `
                        <span style="font-size: 1.6rem;">${getVehicleTypeIcon(v.vehicle_type)}</span>
                      `}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.35rem;">
                        <div style="min-width: 0;">
                          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                            <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.vehicle_name}</h4>
                            <span class="badge" style="background: ${sc.bg}; color: ${sc.text}; border: 1px solid ${sc.border}; font-weight: 600; font-size: 0.68rem; padding: 1px 5px;">
                              ${v.status || 'Available'}
                            </span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 0.35rem; margin-top: 0.2rem; flex-wrap: wrap;">
                            <span style="font-family: monospace; font-size: 0.76rem; font-weight: 700; background: #0F172A; color: #F8FAFC; padding: 1px 5px; border-radius: 3px;">
                              ${v.reg_number}
                            </span>
                            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">${normalizeVehicleCategory(v.vehicle_type)}</span>
                          </div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                          <div style="font-size: 1.05rem; font-weight: 800; color: #4F46E5; line-height: 1.1;">
                            ₹${dynamicRateInfo.rate.toFixed(2)}<span style="font-size: 0.68rem; font-weight: 600; color: var(--text-muted);">/km</span>
                          </div>
                          <span class="badge" style="font-size: 0.62rem; background: ${dynamicRateInfo.isFallback ? '#F1F5F9' : '#EEF2FF'}; color: ${dynamicRateInfo.isFallback ? '#64748B' : '#4F46E5'}; padding: 1px 4px;">
                            ${dynamicRateInfo.isFallback ? 'Fallback' : 'Rolling 90d'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; background: var(--bg-surface-subtle); padding: 0.65rem; border-radius: 8px; margin: 0.65rem 0 0.5rem; border: 1px solid var(--border-subtle);">
                    <div>
                      <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Current Odometer</div>
                      <div style="font-size: 0.98rem; font-weight: 700; color: var(--text-main); font-family: monospace;">
                        ${Number(v.current_odometer || 0).toLocaleString('en-IN')} <span style="font-size: 0.72rem; font-weight: normal;">KM</span>
                      </div>
                    </div>
                    <div>
                      <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Fuel Mileage (B2B)</div>
                      <div style="font-size: 0.98rem; font-weight: 700; color: #059669;">
                        ${latestMileage?.calculated_mileage_kmpl ? `${latestMileage.calculated_mileage_kmpl} <span style="font-size: 0.72rem; font-weight: normal;">km/L</span>` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Awaiting fills</span>'}
                      </div>
                    </div>
                  </div>

                  <div style="margin-bottom: 0.65rem;">
                    ${v.allow_instant_short_ride !== false ? `
                      <span class="badge" style="background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; font-size: 0.7rem; font-weight: 700;">
                        Instant Short Ride (No Approval Needed)
                      </span>
                    ` : `
                      <span class="badge" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-size: 0.7rem; font-weight: 700;">
                        Trip Request & Approval Required
                      </span>
                    `}
                  </div>

                  ${docAlerts.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem;">
                      ${docAlerts.map(a => `
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; padding: 3px 6px; border-radius: 6px; background: ${a.exp.status === 'expired' ? '#FEE2E2' : '#FEF3C7'}; color: ${a.exp.color}; border: 1px solid ${a.exp.status === 'expired' ? '#FCA5A5' : '#FDE68A'};">
                          <span style="font-weight: 700;">${a.document_type}: ${a.exp.label}</span>
                          <span style="font-size: 0.68rem; opacity: 0.85;">${formatDate(a.expiry_date)}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <div style="font-size: 0.72rem; color: #059669; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.75rem;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>All compliance documents up to date</span>
                    </div>
                  `}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.65rem; border-top: 1px solid var(--border-subtle); gap: 0.4rem; flex-wrap: wrap;">
                  <button class="btn btn-sm btn-outline btn-manage-docs" data-id="${v.id}" style="font-size: 0.74rem;">
                    Documents (${vDocs.length})
                  </button>
                  <div style="display: flex; gap: 0.3rem;">
                    <button class="btn btn-sm btn-secondary btn-edit-vehicle" data-id="${v.id}" style="font-size: 0.74rem;">
                      Edit
                    </button>
                    <button class="btn btn-sm btn-outline btn-delete-vehicle" data-id="${v.id}" style="font-size: 0.74rem; color: #DC2626; border-color: #FECACA;">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
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
          <span class="badge" style="background: ${pendingTrips.length > 0 ? '#FEE2E2' : '#ECFDF5'}; color: ${pendingTrips.length > 0 ? '#DC2626' : '#059669'}; font-weight: 700; padding: 4px 10px; border-radius: 9999px;">
            ${pendingTrips.length} Pending Approval
          </span>
        </div>

        ${pendingTrips.length === 0 ? `
          <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" style="margin-bottom: 0.75rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div style="font-weight: 600; color: var(--text-main);">No pending trip requests</div>
            <div style="font-size: 0.78rem; margin-top: 0.25rem;">All driver and staff submissions have been reviewed and approved.</div>
          </div>
        ` : `
          <!-- Responsive Mobile Cards for Trip Approval Queue -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${pendingTrips.map(t => {
              const veh = vehicles.find(v => v.id === t.vehicle_id);
              const dynamicRate = calculateDynamicRatePerKm(veh, expenses, trips);

              return `
                <div style="background: #FFFFFF; border: 1px solid var(--border-medium); border-left: 4px solid #F59E0B; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-family: monospace; font-weight: 700; font-size: 0.85rem; background: #0F172A; color: #FFF; padding: 2px 7px; border-radius: 4px;">${t.trip_id}</span>
                        <strong style="font-size: 0.95rem; color: #0F172A;">${t.user_name}</strong>
                        <span class="badge" style="font-size: 0.7rem; background: #EEF2FF; color: #4F46E5;">${t.user_role}</span>
                      </div>
                      <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span>🚗 <strong>${veh?.vehicle_name || 'Vehicle'}</strong> (${veh?.reg_number || ''})</span>
                      </div>
                    </div>
                    <div style="text-align: right;">
                      <span style="font-size: 1.05rem; font-weight: 800; color: #4F46E5;">₹${dynamicRate.rate.toFixed(2)}<span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted);">/km</span></span>
                      <div style="font-size: 0.7rem; color: var(--text-muted);">Dynamic Rate</div>
                    </div>
                  </div>

                  <div style="background: #F8FAFC; border-radius: 6px; padding: 0.65rem 0.85rem; margin: 0.75rem 0; font-size: 0.82rem; border: 1px solid var(--border-subtle);">
                    <div>📍 <strong>Destination:</strong> ${t.destination}</div>
                    ${t.purpose ? `<div style="color: var(--text-muted); margin-top: 0.2rem;">📝 <strong>Purpose:</strong> ${t.purpose}</div>` : ''}
                    <div style="margin-top: 0.35rem; font-size: 0.76rem; color: #475569; display: flex; gap: 1rem; flex-wrap: wrap;">
                      <span>📅 <strong>Dep:</strong> ${formatDate(t.start_time)}</span>
                      <span>🏁 <strong>Ret:</strong> ${formatDate(t.end_time)}</span>
                      ${t.estimated_km ? `<span>📏 <strong>Est:</strong> ${t.estimated_km} KM</span>` : ''}
                    </div>
                  </div>

                  <div style="display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 0.5rem;">
                    <button class="btn btn-outline btn-reject-trip" data-id="${t.id}" style="color: #DC2626; border-color: #FECACA; padding: 0.5rem 1.15rem; font-weight: 600; font-size: 0.82rem;">
                      ✕ Reject
                    </button>
                    <button class="btn btn-primary btn-approve-trip" data-id="${t.id}" data-rate="${dynamicRate.rate}" style="background: #059669; border-color: #059669; padding: 0.5rem 1.35rem; font-weight: 700; font-size: 0.82rem;">
                      ✓ Approve Trip
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  // --- TAB 3: FUEL & MAINTENANCE (ADMISSION FORM STYLE DESKTOP GRID) ---
  function renderExpensesTab() {
    const selectedVeh = vehicles.find(v => v.id === selectedExpenseVehicleId) || vehicles[0];
    if (selectedVeh && !selectedExpenseVehicleId) {
      selectedExpenseVehicleId = selectedVeh.id;
    }

    return `
      <div style="width: 100%; max-width: 1080px; margin: 0 auto;">
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
          <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle);">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">Log Vehicle Expense</h3>
              <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
                Record fuel refills and maintenance costs with automated bill-to-bill fuel efficiency (km/L).
              </p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-goto-expense-ledger" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; padding: 0.45rem 0.9rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              View Expense Ledger (${expenses.length})
            </button>
          </div>

          <div class="card-panel-body" style="padding: 1.5rem;">
            <form id="form-add-expense">
              <!-- 2-COLUMN DESKTOP GRID (Like Student Admission Form) -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 1.25rem;">
                <!-- LEFT COLUMN: VEHICLE, EXPENSE TYPE & FINANCIALS -->
                <div>
                  <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--brand-navy); margin: 0 0 1rem 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.45rem;">
                    1. Vehicle & Financial Details
                  </h4>

                  <!-- Assigned Vehicle Trigger Card -->
                  <div class="form-group" style="margin-bottom: 0.85rem;">
                    <label class="form-label required" style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Assigned Vehicle *</label>
                    <input type="hidden" id="exp-vehicle-id" value="${selectedVeh ? selectedVeh.id : ''}" />
                    
                    <div class="sections-mobile-card rbac-mobile-role-card" style="margin-bottom: 0;">
                      <button type="button" class="rbac-mobile-role-trigger" id="sec-expense-vehicle-trigger" aria-label="Select vehicle to record expense" style="min-height: 48px;">
                        <div class="rbac-trigger-left" style="gap: 0.85rem;">
                          <div class="rbac-trigger-icon" style="background: #ECFDF5; color: #059669; border: 1.5px solid #A7F3D0; overflow: hidden; padding: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 8px;">
                            ${selectedVeh?.photo_url ? `
                              <img src="${selectedVeh.photo_url}" alt="${selectedVeh.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                            ` : `
                              <span style="font-size: 1.35rem;">${getVehicleTypeIcon(selectedVeh?.vehicle_type)}</span>
                            `}
                          </div>
                          <div class="rbac-trigger-text">
                            <span class="rbac-trigger-kicker">RECORD EXPENSE FOR</span>
                            <div class="rbac-trigger-name-row" style="gap: 0.5rem; flex-wrap: wrap;">
                              <span class="rbac-trigger-name" style="font-size: 0.95rem; font-weight: 700;">${selectedVeh ? selectedVeh.vehicle_name : 'Choose Vehicle'}</span>
                              <span class="badge" style="font-size: 0.68rem; font-family: monospace; background: #0F172A; color: #FFFFFF; padding: 2px 6px;">
                                ${selectedVeh ? selectedVeh.reg_number : ''}
                              </span>
                              <span class="badge" style="font-size: 0.68rem; background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE;">
                                ${normalizeVehicleCategory(selectedVeh?.vehicle_type)}
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
                  </div>

                  <!-- Expense Type -->
                  <div class="form-group" style="margin-bottom: 0.85rem;">
                    <label class="form-label required" style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Expense Type *</label>
                    <select id="exp-type" class="form-control" required style="width: 100%; height: 40px; font-size: 0.84rem;">
                      <option value="Fuel">Fuel (Petrol / Diesel / CNG)</option>
                      <option value="Maintenance">Maintenance & Service</option>
                      <option value="Toll/Tax">Toll & Road Tax</option>
                      <option value="Insurance">Insurance Premium</option>
                      <option value="Other">Other Operational Expense</option>
                    </select>
                  </div>

                  <!-- Amount & Date (2 columns) -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label required" style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Amount (₹) *</label>
                      <input type="number" id="exp-amount" class="form-control" step="0.01" min="1" required placeholder="e.g. 500" style="width: 100%; height: 40px; font-size: 0.84rem;" />
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label required" style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Date of Expense *</label>
                      <input type="date" id="exp-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}" style="width: 100%; height: 40px; font-size: 0.84rem;" />
                    </div>
                  </div>
                </div>

                <!-- RIGHT COLUMN: BILL-TO-BILL FUEL METRICS & NOTES -->
                <div>
                  <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--brand-navy); margin: 0 0 1rem 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.45rem;">
                    2. Bill-to-Bill Fuel Metrics & Notes
                  </h4>

                  <!-- CONDITIONAL BILL-TO-BILL FUEL METRICS -->
                  <div id="fuel-fields-box" style="background: #F8FAFC; border: 1.5px solid var(--border-medium); border-radius: 10px; padding: 1rem; margin-bottom: 0.85rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #0F172A; margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.35rem;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #059669;"><path d="M3 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V2"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
                      <span>Fuel Metrics (Auto Mileage Calculation)</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                      <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label required" style="display: block; font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Fuel Liters Added</label>
                        <input type="number" id="exp-liters" class="form-control" step="0.01" min="0.1" placeholder="e.g. 4.42" style="width: 100%; height: 40px; font-size: 0.84rem;" />
                      </div>

                      <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label required" style="display: block; font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Odometer (KM)</label>
                        <input type="number" id="exp-odometer" class="form-control" min="0" placeholder="e.g. 32609" style="width: 100%; height: 40px; font-size: 0.84rem;" />
                      </div>
                    </div>

                    <div id="mileage-live-preview" style="font-size: 0.8rem; color: #059669; font-weight: 600; padding: 6px 10px; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; display: none; margin-top: 0.65rem;">
                      <!-- Real-time mileage calculation preview -->
                    </div>
                  </div>

                  <!-- NOTES & REFERENCE -->
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Notes / Invoice Reference</label>
                    <textarea id="exp-notes" class="form-control" rows="3" placeholder="e.g. Indian Oil Fuel Pump invoice #4812" style="width: 100%; font-size: 0.84rem;"></textarea>
                  </div>
                </div>
              </div>

              <!-- Frozen Bottom Action Bar -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-subtle); padding-top: 1.15rem; margin-top: 0.5rem;">
                <button type="submit" class="btn btn-primary" style="padding: 0.65rem 1.75rem; font-weight: 700; font-size: 0.9rem; min-width: 200px;">
                  Save Expense & Update Fleet
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB: EXPENSE & FUEL EFFICIENCY LEDGER (DEDICATED MOBILE FRIENDLY WINDOW) ---
  function renderExpenseLedgerTab() {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <span class="badge" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-weight: 700; font-size: 0.76rem;">
              Total Logged Records: ${expenses.length}
            </span>
          </div>
          <button type="button" class="btn btn-primary" id="btn-goto-log-expense" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 700;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Log New Expense
          </button>
        </div>

        ${expenses.length === 0 ? `
          <div class="empty-state" style="padding: 3rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-medium); text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1rem;">No vehicle expenses or fuel fills recorded yet.</p>
            <button type="button" class="btn btn-primary" id="btn-empty-log-expense">Log First Vehicle Expense</button>
          </div>
        ` : `
          <!-- Desktop View (Only): Clean Full Data Table -->
          <div class="card-panel expense-desktop-table" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; overflow-x: auto; box-shadow: var(--shadow-sm);">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                  <th style="padding: 0.75rem 0.65rem;">Date</th>
                  <th style="padding: 0.75rem 0.65rem;">Vehicle</th>
                  <th style="padding: 0.75rem 0.65rem;">Category</th>
                  <th style="padding: 0.75rem 0.65rem;">Type</th>
                  <th style="padding: 0.75rem 0.65rem;">Amount</th>
                  <th style="padding: 0.75rem 0.65rem;">Fuel Liters</th>
                  <th style="padding: 0.75rem 0.65rem;">Odometer</th>
                  <th style="padding: 0.75rem 0.65rem;">Mileage (B2B)</th>
                  <th style="padding: 0.75rem 0.65rem;">Notes / Ref</th>
                  <th style="padding: 0.75rem 0.65rem;">Logged By</th>
                  <th style="padding: 0.75rem 0.65rem; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map(e => {
                  const veh = vehicles.find(v => v.id === e.vehicle_id);
                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                      <td style="padding: 0.75rem 0.65rem; white-space: nowrap; font-size: 0.8rem;">${formatDate(e.date)}</td>
                      <td style="padding: 0.75rem 0.65rem;">
                        <div style="font-weight: 700; color: #1E293B;">${veh?.vehicle_name || 'Vehicle'}</div>
                        <span style="font-family: monospace; font-size: 0.72rem; font-weight: 700; background: #0F172A; color: #FFFFFF; padding: 1px 5px; border-radius: 3px;">
                          ${veh?.reg_number || ''}
                        </span>
                      </td>
                      <td style="padding: 0.75rem 0.65rem;">
                        <span class="badge" style="font-size: 0.7rem; background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE;">
                          ${normalizeVehicleCategory(veh?.vehicle_type)}
                        </span>
                      </td>
                      <td style="padding: 0.75rem 0.65rem;">
                        <span class="badge" style="font-size: 0.72rem; font-weight: 700; ${e.expense_type === 'Fuel' ? 'background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE;' : 'background: #F8FAFC; color: #475569; border: 1px solid #CBD5E1;'}">
                          ${e.expense_type}
                        </span>
                      </td>
                      <td style="padding: 0.75rem 0.65rem; font-weight: 700; font-size: 0.95rem; color: #0F172A; white-space: nowrap;">
                        ${formatCurrency(e.amount)}
                      </td>
                      <td style="padding: 0.75rem 0.65rem;">
                        ${e.fuel_liters ? `<strong>${e.fuel_liters}</strong> L` : '<span style="color: var(--text-muted);">—</span>'}
                      </td>
                      <td style="padding: 0.75rem 0.65rem; font-family: monospace; font-weight: 600;">
                        ${e.odometer_at_expense ? `${Number(e.odometer_at_expense).toLocaleString('en-IN')} KM` : '<span style="color: var(--text-muted);">—</span>'}
                      </td>
                      <td style="padding: 0.75rem 0.65rem;">
                        ${e.calculated_mileage_kmpl ? `
                          <span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-weight: 800; font-size: 0.78rem;">
                            ${e.calculated_mileage_kmpl} km/L
                          </span>
                        ` : (e.expense_type === 'Fuel' ? '<span class="badge" style="background: #EFF6FF; color: #2563EB; font-size: 0.7rem;">Baseline Fill</span>' : '<span style="color: var(--text-muted);">—</span>')}
                      </td>
                      <td style="padding: 0.75rem 0.65rem; font-size: 0.78rem; color: #475569; max-width: 220px;">
                        ${e.notes || '<span style="color: var(--text-muted);">—</span>'}
                      </td>
                      <td style="padding: 0.75rem 0.65rem; font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
                        ${e.logged_by || 'Admin'}
                      </td>
                      <td style="padding: 0.75rem 0.65rem; text-align: right; white-space: nowrap;">
                        <button type="button" class="btn btn-sm btn-outline btn-delete-expense" data-id="${e.id}" style="color: #DC2626; border-color: #FECACA; padding: 2px 8px; font-size: 0.74rem;">
                          Delete
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile View (Only): Responsive Cards Grid (Zero Horizontal Scroll) -->
          <div class="expense-cards-grid expense-mobile-cards" style="display: none; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.85rem;">
            ${expenses.map(e => {
              const veh = vehicles.find(v => v.id === e.vehicle_id);
              return `
                <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
                  <div>
                    <!-- Top Row: Date, Expense Type Badge & Amount -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 0.5rem;">
                      <div style="display: flex; align-items: center; gap: 0.45rem;">
                        <span class="badge" style="font-size: 0.72rem; font-weight: 700; ${e.expense_type === 'Fuel' ? 'background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE;' : 'background: #F8FAFC; color: #475569; border: 1px solid #CBD5E1;'}">
                          ${e.expense_type}
                        </span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${formatDate(e.date)}</span>
                      </div>
                      <strong style="font-size: 1.05rem; color: #0F172A; font-weight: 700;">${formatCurrency(e.amount)}</strong>
                    </div>

                    <!-- Vehicle Info Row -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.65rem; background: #F8FAFC; padding: 0.4rem 0.65rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <div style="font-weight: 700; font-size: 0.86rem; color: #1E293B; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${veh?.vehicle_name || 'Vehicle'}</div>
                      <span style="font-family: monospace; font-size: 0.75rem; font-weight: 700; background: #0F172A; color: #FFFFFF; padding: 1px 6px; border-radius: 4px;">
                        ${veh?.reg_number || ''}
                      </span>
                      <span class="badge" style="font-size: 0.68rem; background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE;">
                        ${normalizeVehicleCategory(veh?.vehicle_type)}
                      </span>
                    </div>

                    <!-- Fuel Metrics & Bill-to-Bill Mileage -->
                    ${e.expense_type === 'Fuel' ? `
                      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-bottom: 0.5rem; text-align: center; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 0.5rem;">
                        <div>
                          <div style="font-size: 0.68rem; color: #166534; font-weight: 600;">LITERS</div>
                          <div style="font-size: 0.85rem; font-weight: 700; color: #0F172A;">${e.fuel_liters ? `${e.fuel_liters} L` : '—'}</div>
                        </div>
                        <div>
                          <div style="font-size: 0.68rem; color: #166534; font-weight: 600;">ODOMETER</div>
                          <div style="font-size: 0.82rem; font-weight: 700; font-family: monospace; color: #0F172A;">${e.odometer_at_expense ? `${Number(e.odometer_at_expense).toLocaleString('en-IN')} KM` : '—'}</div>
                        </div>
                        <div>
                          <div style="font-size: 0.68rem; color: #166534; font-weight: 600;">MILEAGE (B2B)</div>
                          <div style="font-size: 0.88rem; font-weight: 800; color: #059669;">
                            ${e.calculated_mileage_kmpl ? `${e.calculated_mileage_kmpl} km/L` : '<span style="font-size: 0.72rem; color: #64748B;">Baseline</span>'}
                          </div>
                        </div>
                      </div>
                    ` : (e.odometer_at_expense ? `
                      <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                        Odometer at service: <strong style="font-family: monospace; color: #0F172A;">${Number(e.odometer_at_expense).toLocaleString('en-IN')} KM</strong>
                      </div>
                    ` : '')}

                    <!-- Notes / Invoice Reference -->
                    ${e.notes ? `
                      <div style="font-size: 0.76rem; color: #475569; background: #F1F5F9; border-radius: 6px; padding: 0.4rem 0.6rem; margin-bottom: 0.5rem; line-height: 1.35;">
                        ${e.notes}
                      </div>
                    ` : ''}
                  </div>

                  <!-- Footer: Logged By & Delete Action -->
                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.5rem; font-size: 0.72rem; color: var(--text-muted);">
                    <span>Logged by: <strong>${e.logged_by || 'Admin'}</strong></span>
                    <button type="button" class="btn btn-sm btn-outline btn-delete-expense" data-id="${e.id}" style="color: #DC2626; border-color: #FECACA; padding: 2px 8px; font-size: 0.72rem;">
                      Delete
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
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
              <!-- Desktop Table View (> 768px) -->
              <div class="settlement-desktop-table" style="overflow-x: auto;">
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

              <!-- Mobile Card View (<= 768px, Rearranged for phone screens) -->
              <div class="settlement-mobile-cards">
                ${unpaidTrips.map(t => {
                  const veh = vehicles.find(v => v.id === t.vehicle_id);
                  return `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.45rem;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                          <span style="font-family: monospace; font-size: 0.78rem; font-weight: 700; color: #4F46E5; background: #EEF2FF; padding: 2px 6px; border-radius: 4px;">
                            ${t.trip_id}
                          </span>
                          <span style="font-size: 0.76rem; color: var(--text-muted);">${formatDate(t.end_time || t.completed_at || t.created_at)}</span>
                        </div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #DC2626;">
                          ${formatCurrency(t.total_amount || 0)}
                        </div>
                      </div>

                      <div style="margin-bottom: 0.45rem;">
                        <strong style="font-size: 0.92rem; color: var(--text-main);">${t.user_name}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted);"> (${t.user_role})</span>
                        <div style="font-size: 0.78rem; color: #64748B; margin-top: 0.15rem;">
                          ${veh?.vehicle_name || 'Vehicle'} • <span style="font-family: monospace;">${veh?.reg_number || ''}</span>
                        </div>
                      </div>

                      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-subtle); padding-top: 0.45rem;">
                        <span style="font-size: 0.78rem; font-weight: 600; color: #0F172A; font-family: monospace;">
                          ${t.total_km || 0} KM @ ₹${Number(t.applied_rate_per_km || 0).toFixed(2)}/km
                        </span>
                        <button class="btn btn-sm btn-primary btn-mark-paid" data-id="${t.id}" data-amount="${t.total_amount}" data-user="${t.user_name}" data-trip="${t.trip_id}" style="background: #059669; border-color: #059669; font-weight: 700; padding: 3px 10px; font-size: 0.76rem;">
                          Mark as Paid
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
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
              <!-- Desktop Table View (> 768px) -->
              <div class="settlement-desktop-table" style="overflow-x: auto;">
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
                      <th style="padding: 0.65rem; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${payments.map(p => {
                      const trip = trips.find(t => t.id === p.trip_id || t.trip_id === p.trip_id);
                      return `
                        <tr class="btn-open-settlement-modal" data-id="${p.id}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;">
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
                          <td style="padding: 0.65rem; text-align: right;">
                            <button type="button" class="btn btn-sm btn-outline btn-open-settlement-modal" data-id="${p.id}" style="color: #4F46E5; border-color: #C7D2FE; font-size: 0.75rem; padding: 2px 8px;">
                              Details & Delete
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Mobile Card View (<= 768px, Rearranged for phone screens) -->
              <div class="settlement-mobile-cards">
                ${payments.map(p => {
                  const trip = trips.find(t => t.id === p.trip_id || t.trip_id === p.trip_id);
                  return `
                    <div class="btn-open-settlement-modal" data-id="${p.id}" role="button" tabindex="0" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); cursor: pointer;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.45rem;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                          <span style="font-size: 0.76rem; color: var(--text-muted);">${formatDate(p.payment_date || p.created_at)}</span>
                          <span class="badge" style="background: #F1F5F9; color: #334155; font-size: 0.68rem; font-weight: 700; padding: 1px 6px;">
                            ${p.payment_method || 'Cash'}
                          </span>
                        </div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #059669;">
                          ${formatCurrency(p.amount_paid)}
                        </div>
                      </div>

                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                        <div>
                          <span style="font-family: monospace; font-size: 0.78rem; font-weight: 700; color: #4F46E5; background: #EEF2FF; padding: 2px 6px; border-radius: 4px;">
                            ${trip?.trip_id || p.trip_id}
                          </span>
                          <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-main); margin-left: 0.4rem;">
                            ${trip?.user_name || 'Staff User'}
                          </span>
                        </div>
                      </div>

                      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-subtle); padding-top: 0.45rem; font-size: 0.74rem;">
                        <span style="color: #065F46; font-weight: 600;">
                          ✓ Admin: ${p.received_by_admin_name || 'Admin'}
                        </span>
                        <span style="color: #4F46E5; font-weight: 600; font-size: 0.74rem; display: flex; align-items: center; gap: 3px;">
                          View / Delete ➔
                        </span>
                      </div>
                    </div>
                  `;
                }).join('')}
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
        const confirmed = await confirmDialog({
          title: 'Delete Vehicle',
          message: 'Are you sure you want to delete this vehicle from the fleet? This action cannot be undone.',
          confirmText: 'Delete Vehicle',
          cancelText: 'Cancel',
          isDanger: true
        });
        if (confirmed) {
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
        // Expense Vehicle Trigger (Sections-style modal picker)
    container.querySelector('#sec-expense-vehicle-trigger')?.addEventListener('click', () => {
      openModal({
        title: 'Select Vehicle for Expense',
        modalClass: 'role-picker-modal-dialog',
        contentHtml: `
          <div style="margin-bottom: 0.5rem;">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Choose a vehicle from the fleet to record fuel or maintenance expenses:
            </p>
            <div class="role-picker-list">
              ${vehicles.map(v => {
                const isSelected = v.id === selectedExpenseVehicleId;
                const vType = normalizeVehicleCategory(v.vehicle_type);
                const icon = getVehicleTypeIcon(v.vehicle_type);
                return `
                  <div class="role-picker-item ${isSelected ? 'active' : ''}" data-veh-id="${v.id}" role="button" tabindex="0" style="cursor: pointer; padding: 0.85rem 1rem;">
                    <div class="role-picker-item-left" style="gap: 0.85rem;">
                      <div class="role-picker-item-icon" style="background: #ECFDF5; color: #059669; border: 1.5px solid #A7F3D0; width: 44px; height: 44px; border-radius: 8px; overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${v.photo_url ? `
                          <img src="${v.photo_url}" alt="${v.vehicle_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='🚗';" />
                        ` : `
                          <span style="font-size: 1.35rem;">${icon}</span>
                        `}
                      </div>
                      <div class="role-picker-item-info">
                        <div class="role-picker-item-title-row" style="gap: 0.45rem; flex-wrap: wrap;">
                          <span class="role-picker-item-name" style="font-weight: 700; font-size: 0.92rem;">${v.vehicle_name}</span>
                          ${isSelected ? `<span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">SELECTED</span>` : ''}
                          <span class="badge" style="font-size: 0.65rem; font-family: monospace; background: #0F172A; color: #FFF; padding: 1px 5px;">${v.reg_number}</span>
                        </div>
                        <div class="role-picker-item-desc" style="font-size: 0.78rem; color: #64748B; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                          <span>${vType}</span>
                          <span>•</span>
                          <span>Current Odo: ${Number(v.current_odometer || 0).toLocaleString('en-IN')} KM</span>
                          <span>•</span>
                          <span style="color: ${v.status === 'Available' ? '#059669' : '#D97706'}; font-weight: 600;">${v.status || 'Available'}</span>
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
              if (vid) {
                selectedExpenseVehicleId = vid;
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

    // Navigation buttons between Log Expense and Expense Ledger
    container.querySelector('#btn-goto-expense-ledger')?.addEventListener('click', () => {
      activeTab = 'expense_ledger';
      render();
    });
    container.querySelector('#btn-goto-log-expense')?.addEventListener('click', () => {
      activeTab = 'expenses';
      render();
    });
    container.querySelector('#btn-empty-log-expense')?.addEventListener('click', () => {
      activeTab = 'expenses';
      render();
    });

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

    const expDateEl = container.querySelector('#exp-date');
    if (expDateEl) enhanceDateInput(expDateEl);

    // Save Expense Form
    container.querySelector('#form-add-expense')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const vId = vehicleSelect?.value || selectedExpenseVehicleId;
      if (!vId) {
        toast.error('Please choose a vehicle to log this expense.');
        return;
      }
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
      activeTab = 'expense_ledger';
      render();
    });

    // Delete Expense
    container.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = await confirmDialog({
          title: 'Delete Expense',
          message: 'Are you sure you want to delete this expense record? Fleet metrics and rolling costs will be recalculated.',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          isDanger: true
        });
        if (confirmed) {
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

    // Sub-Tab 4B Settlement Item Click (Open Settlement Details & Deletion Modal)
    container.querySelectorAll('.btn-open-settlement-modal').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button') && !e.target.classList.contains('btn-open-settlement-modal')) return;
        const id = el.getAttribute('data-id');
        const payment = payments.find(p => p.id === id);
        if (payment) {
          openSettlementDetailsModal(payment);
        }
      });
    });

    // Vehicle Users: Onboard
    container.querySelector('#btn-add-vehicle-user')?.addEventListener('click', openAddVehicleUserModal);

    // Vehicle Users: Delete
    container.querySelectorAll('.btn-delete-vehicle-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = await confirmDialog({
          title: 'Remove User Account',
          message: 'Are you sure you want to remove this vehicle user account?',
          confirmText: 'Remove',
          cancelText: 'Cancel',
          isDanger: true
        });
        if (confirmed) {
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
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel modal-mobile-responsive" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 520px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Add Vehicle to School Fleet</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <!-- Form with Scrollable Content & Frozen Bottom Submit Bar -->
        <form id="form-create-vehicle" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Display Name *</label>
              <input type="text" id="v-name" class="form-control" required placeholder="e.g. Campus Honda Unicorn or Tata Winger" style="width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Photo (Upload Image)</label>
              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <input type="file" id="v-photo-file" accept="image/*" class="form-control" style="width: 100%; font-size: 0.8rem;" />
                <div id="v-photo-preview" style="width: 50px; height: 40px; border-radius: 6px; background: #F1F5F9; border: 1px dashed #CBD5E1; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                  <span style="font-size: 1.1rem;">🚗</span>
                </div>
              </div>
              <input type="hidden" id="v-photo-data" />
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Registration Plate *</label>
                <input type="text" id="v-reg" class="form-control" required placeholder="e.g. KL-55-XY-7890" style="width: 100%; text-transform: uppercase;" />
              </div>
              <div style="grid-column: 1 / -1;">
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Vehicle Category *</label>
                <div class="vehicle-category-selector" id="add-v-type-pills">
                  <button type="button" class="btn-category-pill" data-cat="2 Wheeler">🏍️ 2 Wheeler</button>
                  <button type="button" class="btn-category-pill" data-cat="3 Wheeler">🛺 3 Wheeler</button>
                  <button type="button" class="btn-category-pill active" data-cat="4 Wheeler">🚗 4 Wheeler</button>
                  <button type="button" class="btn-category-pill" data-cat="Heavy">🚌 Heavy</button>
                </div>
                <input type="hidden" id="v-type" value="4 Wheeler" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Current Odometer (KM) *</label>
                <input type="number" id="v-odo" class="form-control" required min="0" placeholder="e.g. 45000" style="width: 100%;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Fallback Rate (₹/KM) *</label>
                <input type="number" id="v-rate" class="form-control" required min="1" step="0.5" value="16.00" style="width: 100%;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
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

            <!-- Instant Short Ride Permission Setting -->
            <div style="margin-bottom: 0.5rem; padding: 0.75rem 0.85rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
              <label style="display: flex; align-items: flex-start; gap: 0.65rem; cursor: pointer; margin: 0;">
                <input type="checkbox" id="v-instant-ride" checked style="margin-top: 0.2rem; width: 17px; height: 17px; accent-color: #4F46E5; cursor: pointer;" />
                <div>
                  <span style="font-weight: 700; font-size: 0.85rem; color: #1E293B;">Allow Instant Short Ride Without Admin Approval</span>
                  <p style="margin: 0.2rem 0 0; font-size: 0.74rem; color: var(--text-muted); line-height: 1.35;">
                    If checked, drivers and staff can take instant meter-to-meter rides immediately. If unchecked, every trip requires submitting a request and waiting for admin approval.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Frozen Bottom Submit Bar -->
          <div style="flex-shrink: 0; padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--bg-surface); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04); z-index: 10;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669;">Save Vehicle</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

        modalOverlay.querySelectorAll('#add-v-type-pills .btn-category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        modalOverlay.querySelectorAll('#add-v-type-pills .btn-category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const hidden = modalOverlay.querySelector('#v-type');
        if (hidden) hidden.value = pill.getAttribute('data-cat');
      });
    });

    const photoFileInput = modalOverlay.querySelector('#v-photo-file');
    const photoHidden = modalOverlay.querySelector('#v-photo-data');
    const photoPreview = modalOverlay.querySelector('#v-photo-preview');

    photoFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const compressed = await compressImage(file, 400, 300, 0.75);
        if (compressed) {
          photoHidden.value = compressed;
          if (photoPreview) photoPreview.innerHTML = `<img src="${compressed}" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      }
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

      const vAllowInstant = modalOverlay.querySelector('#v-instant-ride')?.checked ?? true;

      await db.saveVehicle({
        vehicle_name: vName,
        reg_number: vReg,
        vehicle_type: vType,
        photo_url: modalOverlay.querySelector('#v-photo-data')?.value || '',
        current_odometer: vOdo,
        fallback_rate_per_km: vRate,
        buffer_percentage: vBuffer,
        status: vStatus,
        allow_instant_short_ride: modalOverlay.querySelector('#ev-instant-ride')?.checked ?? true,
        allow_instant_short_ride: vAllowInstant
      });

      vehicles = await db.getVehicles();
      modalOverlay.remove();
      toast.success('New vehicle added to fleet!');
      render();
    });
  }

  // --- MODAL: EDIT VEHICLE ---
  function openEditVehicleModal(v) {
    const normCategory = normalizeVehicleCategory(v.vehicle_type);
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel modal-mobile-responsive" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 520px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Edit Vehicle — ${v.vehicle_name}</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <!-- Form with Scrollable Content & Frozen Bottom Submit Bar -->
        <form id="form-edit-vehicle" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Display Name *</label>
              <input type="text" id="ev-name" class="form-control" required value="${v.vehicle_name}" style="width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Vehicle Photo</label>
              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <input type="file" id="ev-photo-file" accept="image/*" class="form-control" style="width: 100%; font-size: 0.8rem;" />
                <div id="ev-photo-preview" style="width: 50px; height: 40px; border-radius: 6px; background: #F1F5F9; border: 1px dashed #CBD5E1; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                  ${v.photo_url ? `<img src="${v.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" />` : '<span style="font-size: 1.1rem;">🚗</span>'}
                </div>
              </div>
              <input type="hidden" id="ev-photo-data" value="${v.photo_url || ''}" />
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Registration Plate *</label>
                <input type="text" id="ev-reg" class="form-control" required value="${v.reg_number}" style="width: 100%; text-transform: uppercase;" />
              </div>
              <div style="grid-column: 1 / -1;">
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Vehicle Category *</label>
                <div class="vehicle-category-selector" id="edit-v-type-pills">
                  <button type="button" class="btn-category-pill ${normCategory === '2 Wheeler' ? 'active' : ''}" data-cat="2 Wheeler">🏍️ 2 Wheeler</button>
                  <button type="button" class="btn-category-pill ${normCategory === '3 Wheeler' ? 'active' : ''}" data-cat="3 Wheeler">🛺 3 Wheeler</button>
                  <button type="button" class="btn-category-pill ${normCategory === '4 Wheeler' ? 'active' : ''}" data-cat="4 Wheeler">🚗 4 Wheeler</button>
                  <button type="button" class="btn-category-pill ${normCategory === 'Heavy' ? 'active' : ''}" data-cat="Heavy">🚌 Heavy</button>
                </div>
                <input type="hidden" id="ev-type" value="${normCategory}" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Current Odometer (KM) *</label>
                <input type="number" id="ev-odo" class="form-control" required min="0" value="${v.current_odometer || 0}" style="width: 100%;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Fallback Rate (₹/KM) *</label>
                <input type="number" id="ev-rate" class="form-control" required min="1" step="0.5" value="${v.fallback_rate_per_km || 15}" style="width: 100%;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
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

            <!-- Instant Short Ride Permission Setting -->
            <div style="margin-bottom: 0.5rem; padding: 0.75rem 0.85rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
              <label style="display: flex; align-items: flex-start; gap: 0.65rem; cursor: pointer; margin: 0;">
                <input type="checkbox" id="ev-instant-ride" ${v.allow_instant_short_ride !== false ? 'checked' : ''} style="margin-top: 0.2rem; width: 17px; height: 17px; accent-color: #4F46E5; cursor: pointer;" />
                <div>
                  <span style="font-weight: 700; font-size: 0.85rem; color: #1E293B;">Allow Instant Short Ride Without Admin Approval</span>
                  <p style="margin: 0.2rem 0 0; font-size: 0.74rem; color: var(--text-muted); line-height: 1.35;">
                    If checked, drivers and staff can take instant meter-to-meter rides immediately. If unchecked, every trip requires submitting a request and waiting for admin approval.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Frozen Bottom Submit Bar -->
          <div style="flex-shrink: 0; padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--bg-surface); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04); z-index: 10;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669;">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    const evPhotoInput = modalOverlay.querySelector('#ev-photo-file');
    const evPhotoHidden = modalOverlay.querySelector('#ev-photo-data');
    const evPhotoPreview = modalOverlay.querySelector('#ev-photo-preview');

    evPhotoInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const compressed = await compressImage(file, 400, 300, 0.75);
        if (compressed) {
          evPhotoHidden.value = compressed;
          if (evPhotoPreview) evPhotoPreview.innerHTML = `<img src="${compressed}" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      }
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
        photo_url: modalOverlay.querySelector('#ev-photo-data')?.value || v.photo_url || '',
        current_odometer: vOdo,
        fallback_rate_per_km: vRate,
        buffer_percentage: vBuffer,
        status: vStatus,
        allow_instant_short_ride: modalOverlay.querySelector('#ev-instant-ride')?.checked ?? true
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
        <div class="card-panel" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 640px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
          <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Compliance Documents — ${v.vehicle_name}</h3>
              <p style="margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">${v.reg_number}</p>
            </div>
            <button class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
          </div>

          <div style="padding: 1.25rem; overflow-y: auto; flex: 1 1 auto; min-height: 0; -webkit-overflow-scrolling: touch;">
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

          <div style="padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; flex-shrink: 0; background: var(--bg-surface); z-index: 10; box-shadow: 0 -4px 12px rgba(0,0,0,0.04);">
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
    const targetTrip = trips.find(t => t.id === tripId || t.trip_id === tripCode);
    const totalAmount = Number(targetTrip?.total_amount || amount);
    const alreadyPaid = Number(targetTrip?.amount_paid || 0);
    const remainingDue = Math.max(0, totalAmount - alreadyPaid);

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel modal-mobile-responsive" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 480px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Record Trip Settlement</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <!-- Form with Scrollable Content & Frozen Bottom Submit Bar -->
        <form id="form-settle-payment" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1.15rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 0.75rem; color: #065F46; font-weight: 600;">TRIP REFERENCE</div>
                  <div style="font-weight: 700; font-family: monospace; font-size: 1rem;">${tripCode}</div>
                  <div style="font-size: 0.8rem; color: #047857;">User: ${userName}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.75rem; color: #065F46; font-weight: 600;">REMAINING DUE</div>
                  <div style="font-size: 1.35rem; font-weight: 800; color: #DC2626;">${formatCurrency(remainingDue)}</div>
                </div>
              </div>
            </div>

            <!-- Payment Options Strip (Full vs Partial like Student Leave Card) -->
            <div style="margin-bottom: 0.85rem;">
              <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem; display: block;">Select Payment Option</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <label id="label-idx-pay-full" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #059669; background: #ECFDF5; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #065F46;">
                  <input type="radio" name="idx_trip_pay_option" value="full" checked style="accent-color: #059669;" />
                  Full Payment
                </label>
                <label id="label-idx-pay-partial" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #E2E8F0; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #334155;">
                  <input type="radio" name="idx_trip_pay_option" value="partial" style="accent-color: #D97706;" />
                  Partial Payment
                </label>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.25rem;">Amount Paying Now (₹) *</label>
              <input type="number" id="pay-amount-input" class="form-control" step="0.5" min="1" max="${remainingDue}" value="${remainingDue}" readonly required style="width: 100%; height: 40px; font-size: 1rem; font-weight: 700; color: #059669;" />
              <div id="idx-pay-balance-preview" style="font-size: 0.76rem; font-weight: 600; color: #059669; margin-top: 0.35rem; padding: 4px 8px; background: #F0FDF4; border-radius: 6px; border: 1px solid #BBF7D0;">
                Remaining balance after payment: <strong>₹0.00</strong>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Payment Method *</label>
              <select id="pay-method" class="form-control" required style="width: 100%; height: 40px; font-size: 0.84rem;">
                <option value="Cash">Cash (Received at School Office)</option>
                <option value="Google Pay">Google Pay</option>
                <option value="PhonePe">PhonePe</option>
                <option value="UPI / QR Scan">UPI / QR Scan</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="Salary Deduction">Staff Salary Deduction</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Transaction Ref / Receipt Notes</label>
              <input type="text" id="pay-notes" class="form-control" placeholder="e.g. UPI Ref #49281982 or Office Receipt #0912" style="width: 100%; height: 40px; font-size: 0.84rem;" />
            </div>
          </div>

          <!-- Frozen Bottom Submit Bar with Delete Trip option -->
          <div style="flex-shrink: 0; padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; background: var(--bg-surface); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04); z-index: 10;">
            <button type="button" id="btn-delete-trip-from-due-modal" class="btn btn-outline" style="color: #DC2626; border-color: #FECACA; background: #FFF5F5; font-weight: 700; padding: 0.5rem 0.85rem; font-size: 0.82rem;">
              🗑️ Delete Trip
            </button>
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
              <button type="submit" id="btn-idx-confirm-settle" class="btn btn-primary" style="background: #059669; border-color: #059669; font-weight: 700;">
                Record Payment (${formatCurrency(remainingDue)})
              </button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#btn-delete-trip-from-due-modal')?.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Delete Trip',
        message: `Permanently delete trip ${tripCode}? This will remove this trip record.`,
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
        trips = await db.getTripLogs();
        payments = await db.getVehiclePayments();
        modalOverlay.remove();
        toast.success(`Trip ${tripCode} deleted successfully.`);
        render();
      }
    });

    const fullRadio = modalOverlay.querySelector('input[value="full"]');
    const partialRadio = modalOverlay.querySelector('input[value="partial"]');
    const labelFull = modalOverlay.querySelector('#label-idx-pay-full');
    const labelPartial = modalOverlay.querySelector('#label-idx-pay-partial');
    const payAmtInput = modalOverlay.querySelector('#pay-amount-input');
    const balPreview = modalOverlay.querySelector('#idx-pay-balance-preview');
    const confirmBtn = modalOverlay.querySelector('#btn-idx-confirm-settle');

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
        if (confirmBtn) confirmBtn.textContent = 'Record Payment (' + formatCurrency(remainingDue) + ')';
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
      if (confirmBtn) confirmBtn.textContent = 'Record Payment (₹' + val.toFixed(2) + ')';
    }

    fullRadio?.addEventListener('change', updatePayModeUI);
    partialRadio?.addEventListener('change', updatePayModeUI);
    payAmtInput?.addEventListener('input', updateBalancePreview);

    modalOverlay.querySelector('#form-settle-payment').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountPaid = parseFloat(modalOverlay.querySelector('#pay-amount-input').value) || 0;
      const method = modalOverlay.querySelector('#pay-method').value;
      const notes = modalOverlay.querySelector('#pay-notes').value.trim();

      if (amountPaid <= 0 || amountPaid > remainingDue) {
        toast.error(`Please enter a valid amount up to ${formatCurrency(remainingDue)}.`);
        return;
      }

      await db.recordVehiclePayment({
        trip_id: tripId,
        amount_paid: amountPaid,
        payment_method: method,
        received_by_admin_id: currentUser?.id || 'admin',
        received_by_admin_name: currentUser?.full_name || 'Admin',
        notes
      });

      trips = await db.getTripLogs();
      payments = await db.getVehiclePayments();
      modalOverlay.remove();
      toast.success(`Payment of ${formatCurrency(amountPaid)} recorded for ${userName}!`);
      render();
    });
  }

  // --- MODAL: SETTLEMENT AUDIT DETAILS & DELETION ---
  function openSettlementDetailsModal(payment) {
    const trip = trips.find(t => t.id === payment.trip_id || t.trip_id === payment.trip_id);
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel modal-mobile-responsive" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 480px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Settlement Audit Record</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 1rem; margin-bottom: 1.15rem; text-align: center;">
            <div style="font-size: 0.75rem; color: #065F46; font-weight: 700;">AMOUNT SETTLED</div>
            <div style="font-size: 2rem; font-weight: 800; color: #059669; margin: 0.2rem 0;">${formatCurrency(payment.amount_paid)}</div>
            <div style="font-size: 0.8rem; color: #047857;">${payment.payment_method || 'Cash'} • ${formatDate(payment.payment_date || payment.created_at)}</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.65rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
              <span style="color: var(--text-muted);">Trip Reference</span>
              <strong style="font-family: monospace; color: #4F46E5;">${trip?.trip_id || payment.trip_id}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
              <span style="color: var(--text-muted);">Payer User</span>
              <strong>${trip?.user_name || 'Staff User'}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
              <span style="color: var(--text-muted);">Received By Admin</span>
              <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700;">
                ✓ ${payment.received_by_admin_name || 'Admin'}
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
              <span style="color: var(--text-muted);">Transaction Ref / Notes</span>
              <span>${payment.notes || '—'}</span>
            </div>

            <div style="display: flex; justify-content: space-between; padding-top: 0.2rem; font-size: 0.78rem; color: var(--text-muted);">
              <span>Payment ID</span>
              <span style="font-family: monospace;">${payment.id}</span>
            </div>
          </div>
        </div>

        <!-- Frozen Bottom Action Bar with Delete Option -->
        <div style="padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <button type="button" id="btn-delete-settlement-modal" class="btn btn-outline" style="color: #DC2626; border-color: #FECACA; background: #FFF5F5; font-weight: 700; padding: 0.5rem 0.85rem; font-size: 0.82rem;">
            🗑️ Delete Settlement
          </button>
          <button type="button" class="btn btn-secondary btn-close-modal">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);
    modalOverlay.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalOverlay.remove());
    });

    modalOverlay.querySelector('#btn-delete-settlement-modal')?.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Delete Settlement Record',
        message: `Permanently delete this settlement record of ${formatCurrency(payment.amount_paid)}? The trip's remaining balance will be recalculated.`,
        confirmText: 'Delete Settlement',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (confirmed) {
        await db.deleteVehiclePayment(payment.id);
        payments = await db.getVehiclePayments();
        trips = await db.getTripLogs();
        modalOverlay.remove();
        toast.success('Settlement record deleted successfully.');
        render();
      }
    });
  }

  function openAddVehicleUserModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-backdrop';
    modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;';

    modalOverlay.innerHTML = `
      <div class="card-panel" style="background: var(--bg-surface); border-radius: 16px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; margin: auto;">
        <!-- Frozen Top Header -->
        <div style="padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--bg-surface); z-index: 10;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Onboard Vehicle User</h3>
          <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px;">✕</button>
        </div>

        <!-- Form with Scrollable Content & Frozen Bottom Submit Bar -->
        <form id="form-create-vu" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; margin: 0;">
          <div style="flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 1.25rem;">
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Full Name *</label>
              <input type="text" id="vu-name" class="form-control" required placeholder="e.g. Sameer Driver" style="width: 100%;" />
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Phone Number *</label>
                <input type="tel" id="vu-phone" class="form-control" required placeholder="e.g. +91 98470 12345" style="width: 100%;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Email Address</label>
                <input type="email" id="vu-email" class="form-control" placeholder="sameer@example.com" style="width: 100%;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Driver / Staff ID *</label>
                <input type="text" id="vu-id" class="form-control" required placeholder="e.g. DRV-01" style="width: 100%; text-transform: uppercase;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Designation / Category</label>
                <input type="text" id="vu-desig" class="form-control" value="Campus Driver" style="width: 100%;" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem;">Notes / License Details</label>
              <input type="text" id="vu-notes" class="form-control" placeholder="e.g. Heavy vehicle driving license holder" style="width: 100%;" />
            </div>
          </div>

          <!-- Frozen Bottom Submit Bar -->
          <div style="flex-shrink: 0; padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--bg-surface); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04); z-index: 10;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669;">Onboard User</button>
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
