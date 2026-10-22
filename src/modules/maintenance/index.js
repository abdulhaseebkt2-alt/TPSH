import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { formatDate, formatCurrency } from '../../lib/utils.js';

const DEFAULT_MAINTENANCE = [
  {
    id: 'maint-1',
    title: 'Dormitory 102 Window Latch Replacement',
    unit: 'Thaiba Boys Hostel Block A',
    room: 'Room 102',
    priority: 'High',
    status: 'In_Progress',
    estimated_cost: 450,
    created_at: '2026-10-18',
    description: 'Window latch loosened due to high wind, required immediate carpenter attention to secure room.'
  },
  {
    id: 'maint-2',
    title: 'Ceiling Fan Regulator Repair in Study Hall',
    unit: 'Thaiba Boys Hostel Block B',
    room: 'Study Room 1',
    priority: 'Medium',
    status: 'Resolved',
    estimated_cost: 350,
    created_at: '2026-10-16',
    description: 'Regulator replaced with new 5-step switch.'
  }
];

export async function renderMaintenanceModule(container, { onNavigate }) {
  const user = getCurrentUser();
  let items = [...DEFAULT_MAINTENANCE];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Hostel Infrastructure & Maintenance Tracking</h2>
        <p>Log property damage repair requests, contractor assignments, estimated costs, and resolution status</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' || user?.role === 'mentor' ? `
          <button class="btn btn-primary" id="btn-create-maintenance">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Log Maintenance Request
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Maintenance Records Table -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Active Maintenance & Work Orders</h3>
        <span class="badge badge-active">${items.length} Active Work Orders</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Hostel Unit & Room</th>
                <th>Priority</th>
                <th>Estimated Cost</th>
                <th>Date Logged</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(m => {
                const prioBadge = m.priority === 'High' ? 'badge-absent' : m.priority === 'Medium' ? 'badge-late' : 'badge-leave';
                const statBadge = m.status === 'Resolved' ? 'badge-present' : 'badge-pending';

                return `
                  <tr>
                    <td>
                      <strong>${m.title}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${m.description}</div>
                    </td>
                    <td>${m.unit} • <strong>${m.room}</strong></td>
                    <td><span class="badge ${prioBadge}">${m.priority}</span></td>
                    <td><strong>${formatCurrency(m.estimated_cost)}</strong></td>
                    <td>${formatDate(m.created_at)}</td>
                    <td><span class="badge ${statBadge}">${m.status.replace('_', ' ')}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm btn-mark-resolved" data-id="${m.id}">Update</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Create maintenance request modal
  container.querySelector('#btn-create-maintenance')?.addEventListener('click', () => {
    openModal({
      title: 'Submit Hostel Maintenance Request',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Issue Title</label>
          <input type="text" id="maint-title" class="form-control" placeholder="e.g. Bathroom tap leakage in Dorm 2" required />
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Hostel Unit</label>
            <select id="maint-unit" class="form-control">
              <option value="Thaiba Boys Hostel Block A">Thaiba Boys Hostel Block A</option>
              <option value="Thaiba Boys Hostel Block B">Thaiba Boys Hostel Block B</option>
              <option value="Thaiba Girls Hostel Campus">Thaiba Girls Hostel Campus</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Room / Location</label>
            <input type="text" id="maint-room" class="form-control" placeholder="Room 105 or Common Mess" required />
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label required">Priority Level</label>
            <select id="maint-priority" class="form-control">
              <option value="Low">Low</option>
              <option value="Medium" selected>Medium</option>
              <option value="High">High (Immediate)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estimated Repair Cost (₹)</label>
            <input type="number" id="maint-cost" class="form-control" value="250" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Detailed Problem Description</label>
          <textarea id="maint-desc" class="form-control" rows="2" placeholder="Specify parts needed and urgency" required></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-maint">Submit Work Order</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-maint').addEventListener('click', () => {
          const title = modalBody.querySelector('#maint-title').value.trim();
          const unit = modalBody.querySelector('#maint-unit').value;
          const room = modalBody.querySelector('#maint-room').value.trim();
          const priority = modalBody.querySelector('#maint-priority').value;
          const cost = modalBody.querySelector('#maint-cost').value;
          const desc = modalBody.querySelector('#maint-desc').value.trim();

          if (!title || !desc) {
            toast.error('Please complete all required fields.');
            return;
          }

          items.unshift({
            id: 'maint-' + Date.now(),
            title,
            unit,
            room,
            priority,
            estimated_cost: Number(cost) || 0,
            status: 'Reported',
            created_at: new Date().toISOString().split('T')[0],
            description: desc
          });

          toast.success('Maintenance work order created.');
          close();
          renderMaintenanceModule(container, { onNavigate });
        });
      }
    });
  });

  container.querySelectorAll('.btn-mark-resolved').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = items.find(i => i.id === id);
      if (item) {
        item.status = item.status === 'Resolved' ? 'In_Progress' : 'Resolved';
        toast.success(`Work order status updated to ${item.status.replace('_', ' ')}.`);
        renderMaintenanceModule(container, { onNavigate });
      }
    });
  });
}
