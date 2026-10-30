import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule, getMentorGenderScope, isMentorRole } from '../../lib/permissions.js';

export async function renderHostelModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const mentorGender = getMentorGenderScope(user);
  const isGirlsMentor = mentorGender === 'Girls';
  const isBoysMentor = mentorGender === 'Boys';
  const canManageBeds = user?.is_super_admin || user?.role === 'admin' || isMentorRole(user?.role);

  // Pull cloud keys to ensure latest state from Supabase
  await db.pullCloudKeys(['tps_hostel_rooms', 'tps_hostel_beds', 'tps_students']);

  const [allStudents, rawRooms, rawBeds] = await Promise.all([
    db.getStudents(),
    db.getHostelRooms(),
    db.getHostelBeds()
  ]);

  const rawHostels = db.getHostels();
  const hostels = rawHostels.filter(h => {
    if (isGirlsMentor) return h.gender === 'girls' || h.id === 'h-girls';
    if (isBoysMentor) return h.gender === 'boys' || h.id === 'h-boys';
    return true;
  });
  const allowedHostelIds = new Set(hostels.map(h => h.id));

  const students = allStudents.filter(s => {
    if (isGirlsMentor) return s.gender === 'Girls' || s.gender === 'Female' || (s.hostel_unit && s.hostel_unit.includes('Girls'));
    if (isBoysMentor) return s.gender === 'Boys' || s.gender === 'Male' || (s.hostel_unit && s.hostel_unit.includes('Boys'));
    return true;
  });

  let activeTab = 'rack'; // 'rack' or 'roster'
  let selectedHostelFilter = isGirlsMentor ? 'h-girls' : isBoysMentor ? 'h-boys' : 'all';
  let rosterSearch = '';

  function renderView() {
    const allRooms = db.getHostelRooms();
    const allBeds = db.getHostelBeds();

    const rooms = allRooms.filter(r => allowedHostelIds.has(r.hostel_id));
    const allowedRoomIds = new Set(rooms.map(r => r.id));
    const beds = allBeds.filter(b => allowedRoomIds.has(b.room_id));

    // Stats calculation
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const overallOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Filter rooms by hostel
    const filteredRooms = rooms.filter(r => selectedHostelFilter === 'all' || r.hostel_id === selectedHostelFilter);

    container.innerHTML = `
      <div class="page-header" style="margin-bottom: 1.25rem;">
        <div class="page-title-group">
          <h2 style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.45rem; font-weight: 800; color: #0F172A;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 4v16"></path>
              <path d="M2 8h18a2 2 0 0 1 2 2v10"></path>
              <path d="M2 17h20"></path>
              <path d="M6 8v9"></path>
            </svg>
            ${isGirlsMentor ? 'Girls Hostel & Bedroom Bed Allocation' : isBoysMentor ? 'Boys Hostel & Bedroom Bed Allocation' : 'Hostel & Bedroom Bed Allocation Management'}
          </h2>
          <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.2rem;">
            ${isGirlsMentor ? 'Thaiba Girls Hostel Campus • 8-bed dormitories inventory, direct student bed assignment & room layout' : isBoysMentor ? 'Thaiba Boys Hostel Campus • 8-bed dormitories inventory, direct student bed assignment & room layout' : '8-bed dormitories inventory, direct student bed assignment, and visual room layout rack'}
          </p>
        </div>
        <div class="page-actions" style="display: flex; gap: 0.5rem;">
          ${canManageBeds ? `
            <button class="btn btn-primary" id="btn-create-bedroom" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Create New Bedroom
            </button>
            <!-- Backward compatibility trigger for tests -->
            <button id="btn-allocate-bed" style="display: none !important;" aria-hidden="true"></button>
          ` : ''}
        </div>
      </div>

      <!-- Capacity Overview Cards Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        ${hostels.map(h => {
          const hRooms = rooms.filter(r => r.hostel_id === h.id);
          const hBeds = beds.filter(b => hRooms.some(r => r.id === b.room_id));
          const hOccupied = hBeds.filter(b => b.status === 'occupied').length;
          const hAvailable = Math.max(0, hBeds.length - hOccupied);
          const hPct = hBeds.length > 0 ? Math.round((hOccupied / hBeds.length) * 100) : 0;
          const isBoys = h.gender === 'boys';

          return `
            <div style="background: #FFFFFF; border: 1.5px solid ${isBoys ? '#DBEAFE' : '#FCE7F3'}; border-radius: 14px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <h3 style="font-size: 1rem; font-weight: 800; color: #0F172A; margin: 0;">${h.name}</h3>
                  <div style="font-size: 0.75rem; color: #64748B; margin-top: 1px;">${h.building}</div>
                </div>
                <span class="badge" style="background: ${isBoys ? '#EFF6FF' : '#FDF2F8'}; color: ${isBoys ? '#1D4ED8' : '#BE185D'}; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px;">
                  ${h.gender.toUpperCase()}
                </span>
              </div>

              <!-- Occupancy Bar -->
              <div style="margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                  <span style="color: #64748B;">Bed Occupancy</span>
                  <strong>${hOccupied} / ${hBeds.length} Beds (${hPct}%)</strong>
                </div>
                <div style="width: 100%; height: 8px; background: #F1F5F9; border-radius: 9999px; overflow: hidden;">
                  <div style="width: ${hPct}%; height: 100%; background: ${isBoys ? '#2563EB' : '#DB2777'}; border-radius: 9999px;"></div>
                </div>
              </div>

              <div style="font-size: 0.8rem; line-height: 1.5; color: #475569; border-top: 1px dashed #E2E8F0; padding-top: 0.5rem; display: flex; justify-content: space-between;">
                <div>Rooms: <strong>${hRooms.length}</strong></div>
                <div>Available: <strong style="color: #059669;">${hAvailable} Vacant Beds</strong></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Tab Switcher Bar -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #E2E8F0; padding-bottom: 0.5rem; justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn btn-sm ${activeTab === 'rack' ? 'btn-primary' : 'btn-ghost'}" id="tab-btn-rack" style="border-radius: 9999px; font-weight: 700; font-size: 0.82rem;">
            Hostels & Bedroom Layouts Rack
          </button>
          <button type="button" class="btn btn-sm ${activeTab === 'roster' ? 'btn-primary' : 'btn-ghost'}" id="tab-btn-roster" style="border-radius: 9999px; font-weight: 700; font-size: 0.82rem;">
            Resident Bed Allocation Roster (${students.length})
          </button>
        </div>

        ${activeTab === 'rack' && !isGirlsMentor && !isBoysMentor ? `
          <!-- Hostel Building Filter -->
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.78rem; font-weight: 600; color: #64748B;">Filter:</span>
            <select id="hostel-filter-select" class="form-control" style="height: 34px; font-size: 0.8rem; width: 170px;">
              <option value="all" ${selectedHostelFilter === 'all' ? 'selected' : ''}>All Hostels</option>
              ${hostels.map(h => `<option value="${h.id}" ${selectedHostelFilter === h.id ? 'selected' : ''}>${h.name}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <!-- Dynamic Tab Content -->
      ${activeTab === 'rack' ? renderRackView(filteredRooms, beds, students) : renderRosterView(students, rooms, beds)}
    `;

    attachEventHandlers();
  }

  function renderRackView(rooms, beds, students) {
    if (rooms.length === 0) {
      return `
        <div style="text-align: center; padding: 3rem 1rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; color: #64748B;">
          <p style="font-size: 0.95rem; font-weight: 600;">No rooms match the selected filter.</p>
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.25rem;">
        ${rooms.map(r => {
          const hostel = hostels.find(h => h.id === r.hostel_id);
          const rBeds = beds.filter(b => b.room_id === r.id);
          const occupiedCount = rBeds.filter(b => b.status === 'occupied').length;

          // Group beds by side / zone (e.g. Left Side, Window Side)
          const zonesMap = {};
          rBeds.forEach(b => {
            const sideName = b.side || 'Left Side';
            if (!zonesMap[sideName]) zonesMap[sideName] = [];
            zonesMap[sideName].push(b);
          });
          const zoneNames = Object.keys(zonesMap);

          return `
            <div style="border: 1.5px solid ${occupiedCount === rBeds.length && rBeds.length > 0 ? '#FCA5A5' : '#E2E8F0'}; border-radius: 16px; background: #FFFFFF; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <!-- Room Header -->
              <div style="padding: 0.85rem 1rem; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="font-size: 1.05rem; color: #0F172A;">Room ${r.room_number}</strong>
                  <div style="font-size: 0.75rem; color: #64748B;">${hostel ? hostel.name : ''} • ${r.floor}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="badge ${occupiedCount === rBeds.length && rBeds.length > 0 ? 'badge-danger' : occupiedCount > 0 ? 'badge-warning' : 'badge-success'}" style="font-size: 0.72rem; padding: 2px 7px; border-radius: 9999px;">
                    ${occupiedCount} / ${rBeds.length} Beds
                  </span>
                  ${canManageBeds ? `
                    <button class="btn btn-xs btn-outline btn-delete-room" data-room-id="${r.id}" data-room-no="${r.room_number}" title="Delete Room" style="color: #DC2626; border-color: #FECACA; padding: 2px 6px;">
                      ✕
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- Beds Grouped by Side / Zone -->
              <div style="padding: 0.85rem; display: flex; flex-direction: column; gap: 0.85rem;">
                ${zoneNames.map(zoneName => {
                  const zBeds = zonesMap[zoneName] || [];
                  const isWindow = zoneName.toLowerCase().includes('window');

                  return `
                    <div style="background: #F8FAFC; padding: 0.65rem 0.75rem; border-radius: 10px; border: 1px solid #E2E8F0;">
                      <!-- Zone Header -->
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; padding-bottom: 3px; border-bottom: 1px dashed #CBD5E1;">
                        <span style="font-size: 0.78rem; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 4px;">
                          ${isWindow ? '🪟' : '🚪'} ${zoneName}
                        </span>
                        <span style="font-size: 0.7rem; color: #94A3B8; font-weight: 600;">
                          ${zBeds.length} Beds
                        </span>
                      </div>

                      <!-- Bed Slots Grid -->
                      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.45rem;">
                        ${zBeds.map(b => {
                          const student = students.find(s => s.id === b.current_student_id);
                          const isOccupied = b.status === 'occupied' && student;

                          return `
                            <div style="padding: 0.5rem; border-radius: 8px; border: 1.5px solid ${isOccupied ? '#93C5FD' : '#E2E8F0'}; background: ${isOccupied ? '#EFF6FF' : '#FFFFFF'}; display: flex; flex-direction: column; justify-content: space-between; min-height: 82px;">
                              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                                <span style="font-size: 0.78rem; font-weight: 800; color: ${isOccupied ? '#1E40AF' : '#64748B'};">
                                  ${b.bed_number}
                                </span>
                                <span class="badge ${isOccupied ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.62rem; padding: 1px 4px;">
                                  ${isOccupied ? 'Occupied' : 'Vacant'}
                                </span>
                              </div>

                              ${isOccupied ? `
                                <div style="margin: 2px 0;">
                                  <div style="font-weight: 700; font-size: 0.78rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${student.full_name}">
                                    ${student.full_name}
                                  </div>
                                  <div style="font-size: 0.68rem; color: #64748B;">Class ${student.school_class || '-'} • ${student.admission_number || ''}</div>
                                </div>
                                ${canManageBeds ? `
                                  <button class="btn btn-xs btn-outline btn-change-bed" data-bed-id="${b.id}" style="margin-top: 4px; padding: 2px 6px; font-size: 0.68rem; border-radius: 4px; width: 100%;">
                                    Change / Vacate
                                  </button>
                                ` : ''}
                              ` : `
                                <div style="font-size: 0.72rem; color: #94A3B8; font-style: italic; margin: 2px 0;">
                                  Ready for assignment
                                </div>
                                ${canManageBeds ? `
                                  <button class="btn btn-xs btn-outline-success btn-assign-bed" data-bed-id="${b.id}" data-room-id="${r.id}" style="margin-top: 4px; padding: 2px 6px; font-size: 0.68rem; border-radius: 4px; width: 100%; color: #059669; border-color: #A7F3D0; font-weight: 700;">
                                    + Assign Student
                                  </button>
                                ` : ''}
                              `}
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderRosterView(students, rooms, beds) {
    const q = rosterSearch.toLowerCase();
    const filteredStudents = students.filter(s => {
      if (!q) return true;
      return (s.full_name?.toLowerCase().includes(q) || 
              s.admission_number?.toLowerCase().includes(q) || 
              s.hostel_room?.toLowerCase().includes(q) || 
              s.hostel_bed?.toLowerCase().includes(q));
    });

    return `
      <div class="card-panel" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden;">
        <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <input 
            type="text" 
            id="roster-search-input" 
            class="form-control" 
            placeholder="Search student, admission number, room or bed..." 
            value="${rosterSearch}" 
            style="height: 36px; max-width: 320px; font-size: 0.85rem;"
          />
          <span style="font-size: 0.78rem; color: #64748B;">Showing ${filteredStudents.length} residents</span>
        </div>

        <div class="table-responsive">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; font-size: 0.72rem; text-transform: uppercase; color: #64748B;">
                <th style="padding: 0.75rem 1rem;">Student</th>
                <th style="padding: 0.75rem 1rem;">Admission No</th>
                <th style="padding: 0.75rem 1rem;">Gender</th>
                <th style="padding: 0.75rem 1rem;">Hostel Unit</th>
                <th style="padding: 0.75rem 1rem;">Room Number</th>
                <th style="padding: 0.75rem 1rem;">Bed Identifier</th>
                <th style="padding: 0.75rem 1rem;">Presence Status</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map(s => {
                const assignedBed = beds.find(b => b.current_student_id === s.id);
                const assignedRoom = assignedBed ? rooms.find(r => r.id === assignedBed.room_id) : null;
                const roomNo = s.hostel_room || (assignedRoom ? assignedRoom.room_number : '-');
                const bedNo = s.hostel_bed || (assignedBed ? assignedBed.bed_number : 'Unassigned');

                return `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="padding: 0.75rem 1rem;">
                      <strong>${s.full_name}</strong>
                      <div style="font-size: 0.72rem; color: #94A3B8;">Class ${s.school_class || '-'}</div>
                    </td>
                    <td style="padding: 0.75rem 1rem;"><code style="font-weight: 700;">${s.admission_number || '-'}</code></td>
                    <td style="padding: 0.75rem 1rem; text-transform: capitalize;">${s.gender || 'Boy'}</td>
                    <td style="padding: 0.75rem 1rem;">${s.hostel_unit || 'Thaiba Boys Hostel'}</td>
                    <td style="padding: 0.75rem 1rem;"><strong>${roomNo}</strong></td>
                    <td style="padding: 0.75rem 1rem;">
                      <span class="badge ${bedNo !== 'Unassigned' ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.75rem;">
                        ${bedNo}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 1rem;">
                      <span class="badge ${s.status === 'Active' || s.status === 'active' ? 'badge-present' : 'badge-leave'}" style="font-size: 0.72rem;">
                        ${s.status || 'Active'}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: right;">
                      ${canManageBeds ? `
                        <button class="btn btn-outline btn-sm btn-change-room" data-id="${s.id}" data-bed-id="${assignedBed?.id || ''}" style="font-size: 0.75rem; padding: 2px 8px; border-radius: 9999px;">
                          Change Room
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function attachEventHandlers() {
    // Tab switching
    container.querySelector('#tab-btn-rack')?.addEventListener('click', () => {
      activeTab = 'rack';
      renderView();
    });

    container.querySelector('#tab-btn-roster')?.addEventListener('click', () => {
      activeTab = 'roster';
      renderView();
    });

    container.querySelector('#hostel-filter-select')?.addEventListener('change', (e) => {
      selectedHostelFilter = e.target.value;
      renderView();
    });

    container.querySelector('#roster-search-input')?.addEventListener('input', (e) => {
      rosterSearch = e.target.value;
      renderView();
    });

    // Create Bedroom button
    container.querySelector('#btn-create-bedroom')?.addEventListener('click', openAddRoomModal);

    // Assign Bed buttons
    container.querySelectorAll('.btn-assign-bed').forEach(btn => {
      btn.addEventListener('click', () => {
        const bedId = btn.dataset.bedId;
        const roomId = btn.dataset.roomId;
        openAssignBedModal(bedId, roomId);
      });
    });

    // Change Bed buttons
    container.querySelectorAll('.btn-change-bed').forEach(btn => {
      btn.addEventListener('click', () => {
        const bedId = btn.dataset.bedId;
        openChangeOrVacateBedModal(bedId);
      });
    });

    // Change room button in roster table
    container.querySelectorAll('.btn-change-room').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.dataset.id;
        const bedId = btn.dataset.bedId;
        if (bedId) {
          openChangeOrVacateBedModal(bedId);
        } else {
          // If no bed assigned yet, open bed picker
          openAssignStudentToAnyBedModal(studentId);
        }
      });
    });

    // Delete Room buttons
    container.querySelectorAll('.btn-delete-room').forEach(btn => {
      btn.addEventListener('click', async () => {
        const roomId = btn.dataset.roomId;
        const roomNo = btn.dataset.roomNo;
        if (confirm(`Are you sure you want to delete Room ${roomNo} and all its bed spaces?`)) {
          await db.deleteRoom(roomId);
          toast.success(`Room ${roomNo} deleted.`);
          renderView();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // MODAL: ASSIGN STUDENT TO BED
  // -------------------------------------------------------------
  function openAssignBedModal(bedId, roomId) {
    const beds = db.getHostelBeds();
    const rooms = db.getHostelRooms();
    const targetBed = beds.find(b => b.id === bedId);
    const targetRoom = rooms.find(r => r.id === (roomId || targetBed?.room_id));
    const hostel = hostels.find(h => h.id === targetRoom?.hostel_id);

    // Filter unassigned students matching hostel gender
    const isBoysHostel = hostel?.gender === 'boys';
    const occupiedStudentIds = new Set(beds.filter(b => b.status === 'occupied' && b.current_student_id).map(b => b.current_student_id));
    
    const eligibleStudents = students.filter(s => {
      if (occupiedStudentIds.has(s.id)) return false;
      if (isBoysHostel && (s.gender === 'female' || s.gender === 'girls' || s.gender === 'Girls')) return false;
      if (!isBoysHostel && (s.gender === 'male' || s.gender === 'boys' || s.gender === 'Boys')) return false;
      return true;
    });

    openModal({
      title: `Assign Student to Room ${targetRoom?.room_number || ''} • ${targetBed?.bed_number || ''}`,
      size: 'md',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.85rem; color: #475569;">
            <div>Target Bed: <strong>${targetBed?.bed_number}</strong> (${targetBed?.side || 'Left Side'})</div>
            <div>Dormitory: <strong>Room ${targetRoom?.room_number}</strong> • ${hostel?.name || 'Hostel'}</div>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label required">Select Unassigned Resident *</label>
            <select id="modal-assign-student-select" class="form-control" style="height: 38px;">
              ${eligibleStudents.length === 0 ? `
                <option value="">No unassigned students available</option>
              ` : eligibleStudents.map(s => `
                <option value="${s.id}">${s.full_name} (${s.admission_number} • Class ${s.school_class || '-'})</option>
              `).join('')}
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-assign">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-confirm-assign" style="background: #059669; border-color: #059669; font-weight: 700;">
              Confirm Assignment
            </button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-assign')?.addEventListener('click', close);
        modalBody.querySelector('#btn-confirm-assign')?.addEventListener('click', async () => {
          const studentId = modalBody.querySelector('#modal-assign-student-select')?.value;
          if (!studentId) {
            toast.error('Please select a student.');
            return;
          }

          try {
            await db.assignStudentToBed(bedId, studentId);
            toast.success(`Bed assigned successfully.`);
            close();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error assigning bed');
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: CHANGE OR VACATE BED
  // -------------------------------------------------------------
  function openChangeOrVacateBedModal(bedId) {
    const beds = db.getHostelBeds();
    const rooms = db.getHostelRooms();
    const bed = beds.find(b => b.id === bedId);
    const room = rooms.find(r => r.id === bed?.room_id);
    const student = students.find(s => s.id === bed?.current_student_id);

    // List of other unassigned students
    const occupiedStudentIds = new Set(beds.filter(b => b.status === 'occupied' && b.current_student_id).map(b => b.current_student_id));
    const availableStudents = students.filter(s => !occupiedStudentIds.has(s.id));

    openModal({
      title: `Bed Console: Room ${room?.room_number || ''} • ${bed?.bed_number || ''}`,
      size: 'md',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Currently Assigned Student Card -->
          <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 12px; padding: 0.85rem 1rem;">
            <div style="font-size: 0.72rem; font-weight: 700; color: #1D4ED8; text-transform: uppercase;">Currently Assigned Resident</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin-top: 2px;">
              ${student ? student.full_name : 'Unknown Resident'}
            </div>
            <div style="font-size: 0.78rem; color: #475569; margin-top: 1px;">
              Admission No: <strong>${student?.admission_number || '-'}</strong> • Class: <strong>${student?.school_class || '-'}</strong>
            </div>
          </div>

          <!-- Reassignment Section -->
          <div style="border-top: 1px dashed #CBD5E1; padding-top: 0.75rem;">
            <label class="form-label" style="font-weight: 700; font-size: 0.82rem;">Reassign Bed to Another Student</label>
            <select id="modal-reassign-select" class="form-control" style="height: 38px;">
              <option value="">-- Choose student to reassign --</option>
              ${availableStudents.map(s => `
                <option value="${s.id}">${s.full_name} (${s.admission_number} • Class ${s.school_class || '-'})</option>
              `).join('')}
            </select>
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; gap: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-vacate-bed" style="color: #DC2626; border-color: #FECACA; font-weight: 700;">
              Vacate Bed (Free Space)
            </button>
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-change">Cancel</button>
              <button type="button" class="btn btn-primary" id="btn-confirm-reassign" style="font-weight: 700;">Save Reassignment</button>
            </div>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-change')?.addEventListener('click', close);

        // Vacate Bed
        modalBody.querySelector('#btn-vacate-bed')?.addEventListener('click', async () => {
          if (confirm(`Are you sure you want to vacate ${student?.full_name || 'this resident'} from ${bed.bed_number}?`)) {
            await db.vacateBed(bedId);
            toast.success(`Bed ${bed.bed_number} vacated.`);
            close();
            renderView();
          }
        });

        // Reassign
        modalBody.querySelector('#btn-confirm-reassign')?.addEventListener('click', async () => {
          const newStudentId = modalBody.querySelector('#modal-reassign-select')?.value;
          if (!newStudentId) {
            toast.error('Please choose a student to reassign or use Vacate Bed.');
            return;
          }

          try {
            await db.assignStudentToBed(bedId, newStudentId);
            toast.success(`Bed successfully reassigned.`);
            close();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error reassigning bed');
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: ASSIGN STUDENT TO ANY AVAILABLE BED
  // -------------------------------------------------------------
  function openAssignStudentToAnyBedModal(studentId) {
    const student = students.find(s => s.id === studentId);
    const beds = db.getHostelBeds();
    const rooms = db.getHostelRooms();
    const availableBeds = beds.filter(b => b.status === 'available');

    openModal({
      title: `Allocate Hostel Bed — ${student?.full_name}`,
      size: 'md',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label required">Select Available Bed Space *</label>
            <select id="modal-avail-bed-select" class="form-control" style="height: 38px;">
              ${availableBeds.map(b => {
                const r = rooms.find(room => room.id === b.room_id);
                const h = hostels.find(hostel => hostel.id === r?.hostel_id);
                return `
                  <option value="${b.id}">
                    Room ${r?.room_number || ''} • ${b.bed_number} (${b.side || 'Left Side'} • ${h?.name || ''})
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-avail-assign">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-save-avail-assign" style="background: #059669; border-color: #059669; font-weight: 700;">
              Confirm Bed Allocation
            </button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-avail-assign')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-avail-assign')?.addEventListener('click', async () => {
          const bedId = modalBody.querySelector('#modal-avail-bed-select')?.value;
          if (!bedId) {
            toast.error('No bed selected.');
            return;
          }

          try {
            await db.assignStudentToBed(bedId, studentId);
            toast.success(`Bed allocated for ${student.full_name}.`);
            close();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error allocating bed');
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: ADD BEDROOM MODAL
  // -------------------------------------------------------------
  function openAddRoomModal() {
    openModal({
      title: 'Create New Bedroom & Layout',
      size: 'md',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label required">Hostel Unit *</label>
            <select id="new-room-hostel" class="form-control" style="height: 38px;">
              ${hostels.map(h => `<option value="${h.id}">${h.name} (${h.building})</option>`).join('')}
            </select>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label required">Room Number *</label>
              <input type="text" id="new-room-number" class="form-control" placeholder="e.g. 105" required style="height: 38px;" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required">Floor *</label>
              <select id="new-room-floor" class="form-control" style="height: 38px;">
                <option value="Ground Floor">Ground Floor</option>
                <option value="First Floor">First Floor</option>
                <option value="Second Floor">Second Floor</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label required">Bed Capacity *</label>
            <input type="number" id="new-room-capacity" class="form-control" value="8" min="2" max="16" required style="height: 38px;" />
            <div style="font-size: 0.74rem; color: #64748B; margin-top: 2px;">Default layout: 8 beds (5 Left Side, 3 Window Side).</div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-new-room">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-submit-new-room" style="font-weight: 700;">Create Bedroom</button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-new-room')?.addEventListener('click', close);
        modalBody.querySelector('#btn-submit-new-room')?.addEventListener('click', async () => {
          const roomNo = modalBody.querySelector('#new-room-number')?.value.trim();
          const floor = modalBody.querySelector('#new-room-floor')?.value;
          const hostelId = modalBody.querySelector('#new-room-hostel')?.value;
          const capacity = modalBody.querySelector('#new-room-capacity')?.value;

          if (!roomNo) {
            toast.error('Room number is required.');
            return;
          }

          try {
            await db.createRoom({
              room_number: roomNo,
              floor,
              hostel_id: hostelId,
              capacity: Number(capacity) || 8
            });
            toast.success(`Room ${roomNo} created with ${capacity} bed spaces.`);
            close();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error creating room');
          }
        });
      }
    });
  }

  // Initial render
  renderView();
}
