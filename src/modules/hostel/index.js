import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderHostelModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const students = await db.getStudents();

  const units = [
    { id: 'u-1', name: 'Thaiba Boys Hostel Block A', totalRooms: 12, capacity: 48, occupied: 38, vacant: 10 },
    { id: 'u-2', name: 'Thaiba Boys Hostel Block B', totalRooms: 10, capacity: 40, occupied: 32, vacant: 8 },
    { id: 'u-3', name: 'Thaiba Girls Hostel Campus', totalRooms: 15, capacity: 60, occupied: 45, vacant: 15 }
  ];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Hostel Rooms & Bed Allocation</h2>
        <p>Manage hostel units, floor rooms, bed occupancy, and prevent duplicate bed assignments</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' || user?.role === 'mentor' ? `
          <button class="btn btn-primary" id="btn-allocate-bed">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
            Allocate Bed
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Hostel Blocks Summary Cards -->
    <div class="grid-stats">
      ${units.map(u => `
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">${u.name}</span>
            <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">🏠</div>
          </div>
          <div class="stat-value">${u.occupied} / ${u.capacity}</div>
          <div class="stat-footer">
            <span>Rooms: <strong>${u.totalRooms}</strong> • Vacant Beds: <strong>${u.vacant}</strong></span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Current Bed Allocation Register -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Resident Bed Allocation Roster</h3>
        <span class="badge badge-active">${students.length} Allocated Students</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No</th>
                <th>Gender</th>
                <th>Hostel Unit</th>
                <th>Room Number</th>
                <th>Bed Identifier</th>
                <th>Presence Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr>
                  <td><strong>${s.full_name}</strong></td>
                  <td><code>${s.admission_number}</code></td>
                  <td>${s.gender}</td>
                  <td>${s.hostel_unit || 'Boys Block A'}</td>
                  <td><strong>${s.hostel_room || 'Room 101'}</strong></td>
                  <td><code>${s.hostel_bed || 'Bed 1'}</code></td>
                  <td><span class="badge ${s.status === 'Active' ? 'badge-present' : 'badge-leave'}">${s.status}</span></td>
                  <td>
                    <button class="btn btn-outline btn-sm btn-change-room" data-id="${s.id}">Change Room</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Change Room Modal
  container.querySelectorAll('.btn-change-room').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const st = students.find(s => s.id === id);
      openModal({
        title: `Reallocate Room & Bed — ${st?.full_name}`,
        contentHtml: `
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label required">Target Hostel Unit</label>
            <select id="realloc-unit" class="form-control">
              <option value="Thaiba Boys Hostel Block A">Thaiba Boys Hostel Block A</option>
              <option value="Thaiba Boys Hostel Block B">Thaiba Boys Hostel Block B</option>
              <option value="Thaiba Girls Hostel Campus">Thaiba Girls Hostel Campus</option>
            </select>
          </div>
          <div class="form-grid" style="margin-bottom: 1.5rem;">
            <div class="form-group">
              <label class="form-label required">Room Number</label>
              <input type="text" id="realloc-room" class="form-control" placeholder="e.g. Room 104" value="Room 104" required />
            </div>
            <div class="form-group">
              <label class="form-label required">Bed Identifier</label>
              <input type="text" id="realloc-bed" class="form-control" placeholder="e.g. Bed 2" value="Bed 2" required />
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-primary" id="btn-save-realloc">Save Room Reallocation</button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-save-realloc').addEventListener('click', async () => {
            const unit = modalBody.querySelector('#realloc-unit').value;
            const room = modalBody.querySelector('#realloc-room').value.trim();
            const bed = modalBody.querySelector('#realloc-bed').value.trim();

            await db.updateStudent(id, { hostel_unit: unit, hostel_room: room, hostel_bed: bed });
            toast.success(`Room reallocated to ${room} (${bed})`);
            close();
            renderHostelModule(container, { onNavigate });
          });
        }
      });
    });
  });

  // Allocate bed modal
  container.querySelector('#btn-allocate-bed')?.addEventListener('click', () => {
    toast.info('Select a student from the list or use New Admission to assign initial hostel beds.');
  });
}
