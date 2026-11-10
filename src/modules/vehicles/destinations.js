import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';

export async function renderVehicleDestinationsModule(container, options = {}) {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  if (!isAdmin) {
    container.innerHTML = `
      <div class="card-panel" style="padding: 2.5rem; text-align: center;">
        <h3 style="color: #DC2626;">Access Restricted</h3>
        <p style="color: var(--text-muted);">Only administrators can manage preset destinations and review trip discrepancies.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 280px;">
      <div class="loading-spinner" style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #4F46E5; border-radius: 50%; animation: tpsSpin 0.8s linear infinite;"></div>
    </div>
  `;

  let [destinations, allTrips, vehicles] = await Promise.all([
    db.getVehicleDestinations(),
    db.getTripLogs(),
    db.getVehicles()
  ]);

  let activeTab = options.initialTab || 'destinations'; // 'destinations' | 'pending_reviews' | 'history'

  function render() {
    const pendingTrips = allTrips.filter(t => t.discrepancy_status === 'Pending Review');
    const reviewedTrips = allTrips.filter(t => ['Approved Exemption', 'Rejected Exemption'].includes(t.discrepancy_status));

    container.innerHTML = `
      <!-- Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.15);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700;">Preset Destinations & Official Reviews</h2>
              <p style="margin: 0.15rem 0 0; color: var(--text-muted); font-size: 0.85rem;">
                Manage official institutional destination benchmarks and review odometer discrepancy justifications.
              </p>
            </div>
          </div>
        </div>

        <div class="page-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-add-destination" style="font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Preset Destination
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-medium); margin-bottom: 1.25rem; overflow-x: auto; padding-bottom: 2px;">
        <button class="tab-item ${activeTab === 'destinations' ? 'active' : ''}" data-tab="destinations" style="padding: 0.65rem 1rem; border: none; background: transparent; font-size: 0.88rem; font-weight: ${activeTab === 'destinations' ? '700' : '600'}; color: ${activeTab === 'destinations' ? '#4F46E5' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeTab === 'destinations' ? '#4F46E5' : 'transparent'}; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
          <span>📍 Preset Destinations</span>
          <span class="badge" style="background: #EEF2FF; color: #4338CA; font-size: 0.72rem;">${destinations.length}</span>
        </button>
        <button class="tab-item ${activeTab === 'pending_reviews' ? 'active' : ''}" data-tab="pending_reviews" style="padding: 0.65rem 1rem; border: none; background: transparent; font-size: 0.88rem; font-weight: ${activeTab === 'pending_reviews' ? '700' : '600'}; color: ${activeTab === 'pending_reviews' ? '#D97706' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeTab === 'pending_reviews' ? '#D97706' : 'transparent'}; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
          <span>⏳ Pending Discrepancy Reviews</span>
          ${pendingTrips.length > 0 ? `<span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 0.72rem; font-weight: 700;">${pendingTrips.length} Action Needed</span>` : '<span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.72rem;">0</span>'}
        </button>
        <button class="tab-item ${activeTab === 'history' ? 'active' : ''}" data-tab="history" style="padding: 0.65rem 1rem; border: none; background: transparent; font-size: 0.88rem; font-weight: ${activeTab === 'history' ? '700' : '600'}; color: ${activeTab === 'history' ? '#059669' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeTab === 'history' ? '#059669' : 'transparent'}; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
          <span>📋 Reviewed History</span>
          <span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.72rem;">${reviewedTrips.length}</span>
        </button>
      </div>

      <!-- Tab 1: Preset Destinations -->
      ${activeTab === 'destinations' ? `
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Official Office Route Benchmarks</h3>
              <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
                When staff book an official trip to any of these preset destinations, only distance exceeding the standard distance is flagged as an excess surcharge.
              </p>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                  <th style="padding: 0.65rem 0.75rem;">Destination Name</th>
                  <th style="padding: 0.65rem 0.75rem; text-align: center;">Standard Distance</th>
                  <th style="padding: 0.65rem 0.75rem;">Description / Department</th>
                  <th style="padding: 0.65rem 0.75rem; text-align: center;">Status</th>
                  <th style="padding: 0.65rem 0.75rem; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${destinations.map(d => `
                  <tr style="border-bottom: 1px solid var(--border-subtle);">
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 700; color: #0F172A; font-size: 0.9rem;">
                        📍 ${d.name}
                      </div>
                    </td>
                    <td style="padding: 0.75rem; text-align: center;">
                      <span class="badge" style="background: #EEF2FF; color: #4338CA; font-weight: 800; font-family: monospace; font-size: 0.84rem; padding: 4px 8px;">
                        ${d.standard_distance_km} KM
                      </span>
                    </td>
                    <td style="padding: 0.75rem; color: var(--text-muted); font-size: 0.82rem;">
                      ${d.description || 'Official campus travel route'}
                    </td>
                    <td style="padding: 0.75rem; text-align: center;">
                      ${d.is_active !== false ? `
                        <span class="badge" style="background: #ECFDF5; color: #065F46; font-weight: 700; font-size: 0.72rem;">Active</span>
                      ` : `
                        <span class="badge" style="background: #F1F5F9; color: #64748B; font-weight: 600; font-size: 0.72rem;">Inactive</span>
                      `}
                    </td>
                    <td style="padding: 0.75rem; text-align: right; white-space: nowrap;">
                      <button class="btn btn-sm btn-outline btn-edit-dest" data-id="${d.id}" style="padding: 3px 8px; font-size: 0.76rem; margin-right: 4px;">Edit</button>
                      <button class="btn btn-sm btn-outline btn-delete-dest" data-id="${d.id}" style="padding: 3px 8px; font-size: 0.76rem; color: #DC2626; border-color: #FECACA;">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Tab 2: Pending Reviews -->
      ${activeTab === 'pending_reviews' ? `
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Pending Odometer Discrepancy Requests</h3>
            <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
              Drivers or staff who completed official trips exceeding the standard destination benchmark have submitted justifications. Review and decide whether to approve exemption or uphold the surcharge.
            </p>
          </div>

          ${pendingTrips.length === 0 ? `
            <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem; background: #F8FAFC; border-radius: 8px;">
              <span style="font-size: 1.8rem;">🎉</span>
              <div style="font-weight: 700; color: #0F172A; margin-top: 0.5rem;">All Discrepancy Reviews Cleared</div>
              <div style="font-size: 0.82rem; margin-top: 0.25rem;">There are no pending official trip excess requests awaiting administrator decision.</div>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${pendingTrips.map(t => {
                const veh = vehicles.find(v => v.id === t.vehicle_id);
                const standardKm = Number(t.standard_km || 0);
                const actualKm = Number(t.total_km || 0);
                const excessKm = Number(t.excess_km || Math.max(0, actualKm - standardKm));
                const excessAmount = Number(t.total_amount || 0);

                return `
                  <div class="card-panel" style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <span class="badge" style="background: #FEF3C7; color: #92400E; font-weight: 800; font-size: 0.72rem; font-family: monospace;">${t.trip_id}</span>
                          <strong style="font-size: 1rem; color: #0F172A;">${t.user_name}</strong>
                          <span class="badge" style="background: #EEF2FF; color: #4338CA; font-size: 0.7rem;">${t.user_role || 'Staff'}</span>
                          <span style="color: var(--text-muted); font-size: 0.78rem;">• ${formatDate(t.start_time || t.created_at)}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: #475569; margin-top: 0.35rem;">
                          Vehicle: <strong>${veh?.vehicle_name || 'Vehicle'}</strong> (${veh?.reg_number}) • Official Destination: <strong>${t.destination}</strong>
                        </div>
                      </div>

                      <div style="text-align: right;">
                        <span style="font-size: 0.72rem; color: #92400E; font-weight: 700; text-transform: uppercase;">Excess Surcharge</span>
                        <div style="font-size: 1.35rem; font-weight: 800; color: #DC2626;">${formatCurrency(excessAmount)}</div>
                        <div style="font-size: 0.72rem; color: #B45309;">@ ₹${Number(t.applied_rate_per_km || 16).toFixed(2)}/km</div>
                      </div>
                    </div>

                    <!-- Comparison Matrix -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; background: #FFFFFF; border: 1px solid #FDE68A; border-radius: 8px; padding: 0.75rem; margin-bottom: 0.85rem; font-size: 0.8rem;">
                      <div>
                        <span style="color: #64748B; font-size: 0.72rem; display: block;">Standard Distance</span>
                        <strong style="color: #0F172A; font-family: monospace;">${standardKm} KM</strong>
                      </div>
                      <div>
                        <span style="color: #64748B; font-size: 0.72rem; display: block;">Actual Distance</span>
                        <strong style="color: #2563EB; font-family: monospace;">${actualKm} KM</strong>
                      </div>
                      <div>
                        <span style="color: #64748B; font-size: 0.72rem; display: block;">Excess Distance</span>
                        <strong style="color: #DC2626; font-family: monospace;">+${excessKm} KM</strong>
                      </div>
                      <div>
                        <span style="color: #64748B; font-size: 0.72rem; display: block;">Odometer Span</span>
                        <span style="font-family: monospace; font-size: 0.75rem;">${t.start_km} ➔ ${t.end_km}</span>
                      </div>
                    </div>

                    <!-- Justification Box -->
                    <div style="background: #FEF9C3; border-left: 3px solid #CA8A04; padding: 0.65rem 0.85rem; border-radius: 0 6px 6px 0; margin-bottom: 1rem; font-size: 0.84rem;">
                      <div style="font-size: 0.74rem; font-weight: 700; color: #854D0E; margin-bottom: 0.2rem;">STAFF REASON / JUSTIFICATION:</div>
                      <div style="color: #713F12; font-style: italic;">"${t.discrepancy_reason || 'No written reason provided'}"</div>
                    </div>

                    <!-- Action Controls -->
                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;">
                      <button type="button" class="btn btn-outline btn-reject-discrepancy" data-id="${t.id}" data-user="${t.user_name}" data-amount="${excessAmount}" style="color: #DC2626; border-color: #FECACA; background: #FFF; font-weight: 700; font-size: 0.82rem; padding: 0.45rem 0.85rem;">
                        ✕ Reject Exemption (Charge User)
                      </button>
                      <button type="button" class="btn btn-primary btn-approve-discrepancy" data-id="${t.id}" data-user="${t.user_name}" style="background: #059669; border-color: #059669; font-weight: 700; font-size: 0.82rem; padding: 0.45rem 1rem;">
                        ✓ Approve Exemption (Waive Fee)
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      ` : ''}

      <!-- Tab 3: Reviewed History -->
      ${activeTab === 'history' ? `
        <div class="card-panel" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Discrepancy Decision History</h3>
            <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
              Audit log of all resolved official trip excess reviews.
            </p>
          </div>

          ${reviewedTrips.length === 0 ? `
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
              No reviewed discrepancy records found.
            </div>
          ` : `
            <div class="table-responsive">
              <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-medium); text-align: left; background: var(--bg-surface-subtle);">
                    <th style="padding: 0.6rem;">Trip & Staff</th>
                    <th style="padding: 0.6rem;">Destination</th>
                    <th style="padding: 0.6rem; text-align: center;">Distance Span</th>
                    <th style="padding: 0.6rem; text-align: center;">Decision</th>
                    <th style="padding: 0.6rem;">Review Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${reviewedTrips.map(t => {
                    const isApproved = t.discrepancy_status === 'Approved Exemption';
                    return `
                      <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 0.65rem;">
                          <div style="font-weight: 700; color: #0F172A;">${t.user_name}</div>
                          <span style="font-family: monospace; font-size: 0.72rem; color: #64748B;">${t.trip_id}</span>
                        </td>
                        <td style="padding: 0.65rem;">
                          <div>📍 ${t.destination}</div>
                          <span style="font-size: 0.72rem; color: var(--text-muted);">Std: ${t.standard_km || 0} KM</span>
                        </td>
                        <td style="padding: 0.65rem; text-align: center;">
                          <div style="font-family: monospace; font-weight: 700;">${t.total_km} KM</div>
                          <span style="font-size: 0.7rem; color: #DC2626;">+${t.excess_km || 0} KM</span>
                        </td>
                        <td style="padding: 0.65rem; text-align: center;">
                          ${isApproved ? `
                            <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700; font-size: 0.72rem;">✓ Waived</span>
                          ` : `
                            <span class="badge" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; font-weight: 700; font-size: 0.72rem;">✕ Charged</span>
                          `}
                        </td>
                        <td style="padding: 0.65rem; font-size: 0.78rem; color: var(--text-muted);">
                          <div>By: <strong>${t.discrepancy_reviewed_by || 'Admin'}</strong> on ${formatDate(t.discrepancy_reviewed_at)}</div>
                          ${t.discrepancy_admin_notes ? `<div style="color: #475569; font-style: italic; margin-top: 2px;">"${t.discrepancy_admin_notes}"</div>` : ''}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      ` : ''}
    `;

    attachEvents();
  }

  function attachEvents() {
    // Tab switching
    container.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // Add Destination Modal
    container.querySelector('#btn-add-destination')?.addEventListener('click', () => {
      openDestinationModal();
    });

    // Edit Destination Modal
    container.querySelectorAll('.btn-edit-dest').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const target = destinations.find(d => d.id === id);
        if (target) openDestinationModal(target);
      });
    });

    // Delete Destination
    container.querySelectorAll('.btn-delete-dest').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const target = destinations.find(d => d.id === id);
        if (!target) return;

        const confirmed = await confirmDialog({
          title: 'Delete Preset Destination',
          message: `Are you sure you want to delete benchmark for "${target.name}"?`,
          confirmText: 'Delete Destination',
          cancelText: 'Cancel',
          isDanger: true
        });

        if (confirmed) {
          await db.deleteVehicleDestination(id);
          destinations = await db.getVehicleDestinations();
          toast.success(`Destination "${target.name}" deleted.`);
          render();
        }
      });
    });

    // Approve Exemption
    container.querySelectorAll('.btn-approve-discrepancy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tripId = btn.getAttribute('data-id');
        const userName = btn.getAttribute('data-user');

        const confirmed = await confirmDialog({
          title: 'Approve Excess Exemption',
          message: `Approve official justification for ${userName}? This will waive the excess surcharge completely, setting the bill to ₹0.00.`,
          confirmText: 'Approve & Waive Fee',
          cancelText: 'Cancel'
        });

        if (confirmed) {
          await db.resolveTripDiscrepancy(tripId, {
            decision: 'exempt',
            adminNotes: 'Official excess travel approved by administration',
            adminName: currentUser.full_name
          });
          allTrips = await db.getTripLogs();
          toast.success(`Exemption approved for ${userName}. Charge waived.`);
          render();
        }
      });
    });

    // Reject Exemption
    container.querySelectorAll('.btn-reject-discrepancy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tripId = btn.getAttribute('data-id');
        const userName = btn.getAttribute('data-user');
        const amount = btn.getAttribute('data-amount');

        const confirmed = await confirmDialog({
          title: 'Reject Exemption Request',
          message: `Reject justification for ${userName}? The excess amount of ₹${amount} will remain charged to their Vehicle Card as an unpaid debt.`,
          confirmText: 'Reject & Charge User',
          cancelText: 'Cancel',
          isDanger: true
        });

        if (confirmed) {
          await db.resolveTripDiscrepancy(tripId, {
            decision: 'reject',
            adminNotes: 'Excess travel justification rejected by administration',
            adminName: currentUser.full_name
          });
          allTrips = await db.getTripLogs();
          toast.info(`Exemption rejected. Extra amount remains charged to ${userName}.`);
          render();
        }
      });
    });
  }

  // Modal to Add / Edit Destination
  function openDestinationModal(dest = null) {
    const isEdit = !!dest;
    openModal({
      title: isEdit ? 'Edit Preset Destination' : 'Add New Preset Destination',
      contentHtml: `
        <form id="form-dest-save" style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.3rem;">
              Destination / Office Location Name *
            </label>
            <input type="text" id="dest-name" class="form-control" required value="${dest?.name || ''}" placeholder="e.g. DEO Office Manjeri" style="width: 100%;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.3rem;">
              Standard Benchmark Distance (Round-Trip KM) *
            </label>
            <input type="number" id="dest-km" class="form-control" required min="1" step="0.5" value="${dest?.standard_distance_km || 20}" placeholder="e.g. 22" style="width: 100%; font-family: monospace; font-weight: 700;" />
            <span style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.25rem; display: block;">
              Total expected round-trip distance from campus to this destination.
            </span>
          </div>

          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.3rem;">
              Description & Purpose
            </label>
            <input type="text" id="dest-desc" class="form-control" value="${dest?.description || ''}" placeholder="e.g. District Education Office paperwork & liaison" style="width: 100%;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="submit" class="btn btn-primary" style="font-weight: 700;">
              ${isEdit ? 'Save Changes' : 'Create Destination'}
            </button>
          </div>
        </form>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#form-dest-save')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = modalBody.querySelector('#dest-name').value.trim();
          const km = parseFloat(modalBody.querySelector('#dest-km').value);
          const desc = modalBody.querySelector('#dest-desc').value.trim();

          if (!name || isNaN(km) || km <= 0) {
            toast.error('Please enter valid name and standard distance.');
            return;
          }

          await db.saveVehicleDestination({
            ...(dest || {}),
            name,
            standard_distance_km: km,
            description: desc,
            is_active: true
          });

          destinations = await db.getVehicleDestinations();
          toast.success(isEdit ? 'Destination updated successfully!' : 'New preset destination created!');
          close();
          render();
        });
      }
    });
  }

  // Initial render
  render();
}
