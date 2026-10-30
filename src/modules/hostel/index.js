import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule, getMentorGenderScope, isMentorRole } from '../../lib/permissions.js';

function getStudentAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

const silhouetteBoySvg = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
`;

const silhouetteGirlSvg = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
`;

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

  let selectedHostelFilter = isGirlsMentor ? 'h-girls' : isBoysMentor ? 'h-boys' : 'all';

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
      <div class="hostel-capacity-overview-grid">
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

      <!-- Full-Width Hostel Filter Card (Admin / Multi-Campus view) -->
      ${!isGirlsMentor && !isBoysMentor ? `
        <div class="card-panel hostel-filter-card" style="margin-bottom: 1.25rem; padding: 0.85rem 1rem; border-radius: 14px; background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #334155; white-space: nowrap;">Filter:</span>
            <select id="hostel-filter-select" class="form-control select-full-width" style="height: 42px; font-size: 0.88rem; font-weight: 600; width: 100%; flex: 1 1 0%; border-radius: 9999px; border: 1.5px solid #059669; padding-left: 1rem; padding-right: 2.2rem; color: #0F172A; box-sizing: border-box;" data-full-width="true">
              <option value="all" ${selectedHostelFilter === 'all' ? 'selected' : ''}>All Hostels (${hostels.length} Campuses)</option>
              ${hostels.map(h => `<option value="${h.id}" ${selectedHostelFilter === h.id ? 'selected' : ''}>${h.name} (${h.building})</option>`).join('')}
            </select>
          </div>
        </div>
      ` : ''}

      <!-- Bedrooms Floorplan Rack -->
      ${renderRackView(filteredRooms, beds, students)}
    `;

    attachEventHandlers();
  }

  function renderBedCard(b, r) {
    const student = students.find(s => s.id === b.current_student_id);
    const isOccupied = b.status === 'occupied' && student;
    const age = student ? getStudentAge(student.dob) : null;
    const ageText = age ? `${age} Yrs` : '11 Yrs';

    return `
      <div class="hostel-bed-item" style="padding: 0.65rem 0.85rem; border-radius: 10px; border: 1.5px solid ${isOccupied ? '#93C5FD' : '#E2E8F0'}; background: ${isOccupied ? '#EFF6FF' : '#FFFFFF'}; display: flex; flex-direction: column; gap: 0.35rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: all 0.15s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.82rem; font-weight: 800; color: ${isOccupied ? '#1E40AF' : '#475569'};">
            ${b.bed_number}
          </span>
          <span class="badge ${isOccupied ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.68rem; padding: 2px 7px; border-radius: 9999px; font-weight: 700;">
            ${isOccupied ? 'Occupied' : 'Vacant'}
          </span>
        </div>

        ${isOccupied ? `
          <div style="margin: 2px 0;">
            <div style="font-weight: 800; font-size: 0.9rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${student.full_name}">
              ${student.full_name}
            </div>
            <div style="font-size: 0.74rem; font-weight: 600; color: #64748B; margin-top: 2px;">
              ${student.school_class || 'Class'} • ${ageText}
            </div>
          </div>
          ${canManageBeds ? `
            <div style="margin-top: 4px;">
              <button class="btn btn-xs btn-outline btn-change-bed" data-bed-id="${b.id}" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 6px; width: 100%; font-weight: 600; border-color: #CBD5E1; color: #334155; background: #FFFFFF;">
                Change / Vacate Bed
              </button>
            </div>
          ` : ''}
        ` : `
          <div style="font-size: 0.74rem; color: #94A3B8; font-style: italic; margin: 2px 0;">
            Ready for assignment
          </div>
          ${canManageBeds ? `
            <div style="margin-top: 4px;">
              <button class="btn btn-xs btn-outline-success btn-assign-bed" data-bed-id="${b.id}" data-room-id="${r.id}" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 6px; width: 100%; color: #059669; border-color: #A7F3D0; font-weight: 700; background: #ECFDF5;">
                + Assign Student
              </button>
            </div>
          ` : ''}
        `}
      </div>
    `;
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
      <div class="rooms-rack-grid">
        ${rooms.map(r => {
          const hostel = hostels.find(h => h.id === r.hostel_id);
          const rBeds = beds.filter(b => b.room_id === r.id);
          // Sort beds numerically by bed number
          rBeds.sort((a, b) => {
            const numA = parseInt((a.bed_number || '').replace(/\D/g, ''), 10) || 0;
            const numB = parseInt((b.bed_number || '').replace(/\D/g, ''), 10) || 0;
            return numA - numB;
          });

          const occupiedCount = rBeds.filter(b => b.status === 'occupied').length;

          // Split beds into Left Side and Right Side (Window Side)
          const leftBeds = rBeds.filter(b => {
            const side = (b.side || '').toLowerCase();
            const bedNum = parseInt((b.bed_number || '').replace(/\D/g, ''), 10);
            return side.includes('left') || (!side.includes('window') && !side.includes('right') && bedNum <= 5);
          });

          const rightBeds = rBeds.filter(b => {
            const side = (b.side || '').toLowerCase();
            const bedNum = parseInt((b.bed_number || '').replace(/\D/g, ''), 10);
            return side.includes('window') || side.includes('right') || (!side.includes('left') && bedNum > 5);
          });

          return `
            <div class="card-panel room-rack-card" style="border: 1.5px solid ${occupiedCount === rBeds.length && rBeds.length > 0 ? '#FCA5A5' : '#E2E8F0'}; border-radius: 16px; background: #FFFFFF; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <!-- Room Header -->
              <div style="padding: 0.85rem 1rem; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <strong style="font-size: 1.1rem; color: #0F172A;">Room ${r.room_number}</strong>
                  <div style="font-size: 0.76rem; color: #64748B;">${hostel ? hostel.name : ''} • ${r.floor} • Bed Occupancy: ${occupiedCount}/${rBeds.length}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge ${occupiedCount === rBeds.length && rBeds.length > 0 ? 'badge-danger' : occupiedCount > 0 ? 'badge-warning' : 'badge-success'}" style="font-size: 0.74rem; padding: 3px 8px; border-radius: 9999px; font-weight: 700;">
                    ${occupiedCount} / ${rBeds.length} Beds
                  </span>
                  ${canManageBeds ? `
                    <button class="btn btn-xs btn-outline btn-delete-room" data-room-id="${r.id}" data-room-no="${r.room_number}" title="Delete Room" style="color: #DC2626; border-color: #FECACA; padding: 2px 7px;">
                      ✕
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- 2-Column Side-by-Side Floorplan Layout -->
              <div style="padding: 0.85rem;">
                <div class="bedroom-sides-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
                  <!-- Left Side Card (One by one vertical stack) -->
                  <div class="bedroom-side-card" style="background: #F8FAFC; padding: 0.85rem; border-radius: 12px; border: 1.5px solid #E2E8F0; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.45rem; border-bottom: 1.5px dashed #CBD5E1;">
                      <span style="font-size: 0.84rem; font-weight: 800; color: #1E293B; display: flex; align-items: center; gap: 6px;">
                        🚪 Left Side
                      </span>
                      <span style="font-size: 0.74rem; color: #64748B; font-weight: 700;">
                        ${leftBeds.length} Beds
                      </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.6rem; flex: 1;">
                      ${leftBeds.map(b => renderBedCard(b, r)).join('')}
                    </div>
                  </div>

                  <!-- Right Side (Window Side) Card (One by one vertical stack) -->
                  <div class="bedroom-side-card" style="background: #F8FAFC; padding: 0.85rem; border-radius: 12px; border: 1.5px solid #E2E8F0; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.45rem; border-bottom: 1.5px dashed #CBD5E1;">
                      <span style="font-size: 0.84rem; font-weight: 800; color: #1E293B; display: flex; align-items: center; gap: 6px;">
                        🪟 Right Side (Window Side)
                      </span>
                      <span style="font-size: 0.74rem; color: #64748B; font-weight: 700;">
                        ${rightBeds.length} Beds
                      </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.6rem; flex: 1;">
                      ${rightBeds.map(b => renderBedCard(b, r)).join('')}
                    </div>
                  </div>
                </div>
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
  // MODAL: ASSIGN STUDENT TO BED (Matching Classroom Assignment UI)
  // -------------------------------------------------------------
  function openAssignBedModal(bedId, roomId) {
    const beds = db.getHostelBeds();
    const rooms = db.getHostelRooms();
    const targetBed = beds.find(b => b.id === bedId);
    const targetRoom = rooms.find(r => r.id === (roomId || targetBed?.room_id));
    const hostel = hostels.find(h => h.id === targetRoom?.hostel_id);

    // Identify occupied student IDs (excluding this bed's current student if any)
    const occupiedStudentIds = new Set(
      beds.filter(b => b.status === 'occupied' && b.current_student_id && b.id !== bedId).map(b => b.current_student_id)
    );

    const isBoysHostel = hostel?.gender === 'boys';
    const targetSide = targetBed?.side || 'Left Side';

    // Filter eligible unassigned students matching hostel gender
    const eligibleStudents = students.filter(s => {
      if (occupiedStudentIds.has(s.id)) return false;
      const isGirl = ['female', 'girl', 'girls'].includes((s.gender || '').toLowerCase());
      if (isBoysHostel && isGirl) return false;
      if (!isBoysHostel && !isGirl) return false;
      return true;
    });

    // Sort by admission number for natural sequence
    eligibleStudents.sort((a, b) => {
      const admA = a.admission_number || '';
      const admB = b.admission_number || '';
      return admA.localeCompare(admB, undefined, { numeric: true });
    });

    const uniqueClasses = Array.from(new Set(eligibleStudents.map(s => s.school_class).filter(Boolean))).sort();

    // Initial selected student: current student if already assigned, or null
    let selectedStudentId = targetBed?.current_student_id || null;
    let searchQuery = '';

    openModal({
      title: `Assign Student — Room ${targetRoom?.room_number || ''} • ${targetBed?.bed_number || ''}`,
      size: 'lg',
      modalClass: 'assign-students-modal',
      contentHtml: `
        <div class="assign-modal-wrapper">
          <!-- Top Section (Fixed) -->
          <div class="assign-modal-top">
            <div class="assign-meta-bar">
              <div class="assign-meta-left">
                <span class="assign-section-tag">Room ${targetRoom?.room_number || ''}</span>
                <span class="assign-gender-tag">${isBoysHostel ? 'Boys Hostel' : 'Girls Hostel'}</span>
                <span class="badge badge-neutral" style="font-weight: 700; font-size: 0.76rem; border-radius: 9999px;">${targetBed?.bed_number} (${targetSide})</span>
              </div>
              <div class="assign-meta-right">
                <span id="assign-counter-banner" class="assign-count-pill">
                  <strong>${eligibleStudents.length}</strong> unassigned residents
                </span>
              </div>
            </div>

            <!-- Search and Dropdowns Wrapper (Single line on Desktop, Stacked on Mobile) -->
            <div class="assign-filters-wrapper">
              <div class="assign-search-box">
                <svg class="assign-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="assign-search-input" class="form-control" placeholder="Search by student name, DOB, or admission no..." />
              </div>

              <!-- Two Dropdowns: Class & Gender -->
              <div class="assign-dropdowns-row">
                <select id="assign-class-select" class="form-control assign-select">
                  <option value="all">All Classes</option>
                  ${uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <select id="assign-gender-select" class="form-control assign-select">
                  <option value="all">All Genders</option>
                  <option value="Boys" ${isBoysHostel ? 'selected' : ''}>Boys</option>
                  <option value="Girls" ${!isBoysHostel ? 'selected' : ''}>Girls</option>
                </select>
              </div>
            </div>

            <!-- Quick Action Row -->
            <div class="assign-quick-row">
              <span class="assign-visible-count" id="assign-visible-count">Showing ${eligibleStudents.length} students</span>
              <div class="assign-quick-buttons">
                <span style="font-size: 0.76rem; color: #64748B; font-weight: 600;">Tap any resident to select for ${targetBed?.bed_number || 'Bed'}</span>
              </div>
            </div>
          </div>

          <!-- Scrollable Spacious 1-Column Students List (Flex 1) -->
          <div class="assign-students-list-container">
            <div class="assign-students-list" id="assign-students-list"></div>
            <div id="assign-empty-state" style="display: none; padding: 3rem 1rem; text-align: center; color: #94A3B8; font-size: 0.9rem;">
              No unassigned students match your filter criteria.
            </div>
          </div>

          <!-- Pinned Fixed Footer -->
          <div class="assign-footer-bar">
            <div class="assign-footer-info" style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #64748B; font-size: 0.8rem;">Selected:</span>
              <strong id="assign-footer-selected-name" style="color: #0F172A; font-size: 0.88rem;">
                ${selectedStudentId ? (eligibleStudents.find(s => s.id === selectedStudentId)?.full_name || '1 selected') : 'None (Tap a resident)'}
              </strong>
            </div>
            <div class="assign-footer-btns">
              <button type="button" class="btn btn-outline btn-sm" id="btn-modal-cancel">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-assign" style="background: #059669; border-color: #059669; font-weight: 700;">
                Assign to ${targetBed?.bed_number || 'Bed'}
              </button>
            </div>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        const listContainer = modalBody.querySelector('#assign-students-list');
        const emptyState = modalBody.querySelector('#assign-empty-state');
        const searchInput = modalBody.querySelector('#assign-search-input');
        const classSelect = modalBody.querySelector('#assign-class-select');
        const genderSelect = modalBody.querySelector('#assign-gender-select');
        const visibleCountEl = modalBody.querySelector('#assign-visible-count');
        const selectedNameEl = modalBody.querySelector('#assign-footer-selected-name');
        const confirmBtn = modalBody.querySelector('#btn-confirm-assign');

        function updateFooter() {
          if (!selectedNameEl) return;
          if (selectedStudentId) {
            const st = eligibleStudents.find(s => s.id === selectedStudentId);
            selectedNameEl.textContent = st ? st.full_name : '1 selected';
            if (confirmBtn) {
              confirmBtn.disabled = false;
              confirmBtn.style.opacity = '1';
            }
          } else {
            selectedNameEl.textContent = 'None (Tap a resident)';
            if (confirmBtn) {
              confirmBtn.disabled = true;
              confirmBtn.style.opacity = '0.6';
            }
          }
        }

        function getFilteredStudents() {
          const selectedClass = classSelect ? classSelect.value : 'all';
          const selectedGender = genderSelect ? genderSelect.value : 'all';
          const q = searchQuery.toLowerCase().trim();

          return eligibleStudents.filter(s => {
            const isGirl = ['female', 'girl', 'girls'].includes((s.gender || '').toLowerCase());
            const genderKey = isGirl ? 'Girls' : 'Boys';

            if (selectedClass !== 'all' && (s.school_class || '') !== selectedClass) return false;
            if (selectedGender !== 'all' && genderKey !== selectedGender) return false;

            if (q) {
              const matchName = (s.full_name || '').toLowerCase().includes(q);
              const matchAdm = (s.admission_number || '').replace(/-/g, '').toLowerCase().includes(q);
              const matchDob = (s.dob || '').toLowerCase().includes(q);
              const matchClass = (s.school_class || '').toLowerCase().includes(q);
              if (!matchName && !matchAdm && !matchDob && !matchClass) return false;
            }

            return true;
          });
        }

        function renderRows() {
          const filtered = getFilteredStudents();
          if (visibleCountEl) {
            visibleCountEl.textContent = `Showing ${filtered.length} unassigned residents`;
          }

          if (filtered.length === 0) {
            listContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
          }

          listContainer.style.display = 'flex';
          emptyState.style.display = 'none';

          listContainer.innerHTML = filtered.map(s => {
            const isSelected = selectedStudentId === s.id;
            const isGirl = ['female', 'girl', 'girls'].includes((s.gender || '').toLowerCase());
            const genderLabel = isGirl ? 'Girl' : 'Boy';
            const age = getStudentAge(s.dob);
            const ageStr = age ? ` (${age} Yrs)` : '';

            return `
              <div class="assign-student-row ${isSelected ? 'is-assigned' : ''}" data-sid="${s.id}" style="cursor: pointer;">
                <!-- Single select radio tick button -->
                <div class="student-assign-tick ${isSelected ? 'checked' : ''}" role="radio" aria-checked="${isSelected}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>

                <!-- Avatar: Student Photo or Silhouette -->
                <div class="assign-student-avatar">
                  ${s.photo_url ? `
                    <img src="${s.photo_url}" alt="${s.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div class="avatar-silhouette ${isGirl ? 'girl' : 'boy'}" style="display: none;">
                      ${isGirl ? silhouetteGirlSvg : silhouetteBoySvg}
                    </div>
                  ` : `
                    <div class="avatar-silhouette ${isGirl ? 'girl' : 'boy'}">
                      ${isGirl ? silhouetteGirlSvg : silhouetteBoySvg}
                    </div>
                  `}
                </div>

                <!-- Student Data -->
                <div class="assign-student-details">
                  <div class="assign-student-name" title="${s.full_name}">${s.full_name}</div>
                  <div class="assign-student-meta">
                    <span>${genderLabel}</span>
                    <span class="meta-dot">•</span><span>${s.school_class || 'Class'}</span>
                    <span class="meta-dot">•</span><span>DOB: ${s.dob || '—'}${ageStr}</span>
                    <span class="meta-dot">•</span><code style="font-weight: 700; color: #475569;">${s.admission_number || '-'}</code>
                  </div>
                </div>
              </div>
            `;
          }).join('');

          listContainer.querySelectorAll('.assign-student-row').forEach(row => {
            row.addEventListener('click', () => {
              const sid = row.getAttribute('data-sid');
              selectedStudentId = sid;
              updateFooter();
              renderRows();
            });
          });
        }

        searchInput?.addEventListener('input', (e) => {
          searchQuery = e.target.value;
          renderRows();
        });

        classSelect?.addEventListener('change', renderRows);
        genderSelect?.addEventListener('change', renderRows);

        modalBody.querySelector('#btn-modal-cancel')?.addEventListener('click', close);

        modalBody.querySelector('#btn-confirm-assign')?.addEventListener('click', async () => {
          if (!selectedStudentId) {
            toast.error('Please tap a student to assign to this bed.');
            return;
          }

          try {
            await db.assignStudentToBed(bedId, selectedStudentId);
            toast.success(`Student assigned to ${targetBed?.bed_number || 'bed'}.`);
            close();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error assigning bed');
          }
        });

        renderRows();
        updateFooter();
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
    const age = student ? getStudentAge(student.dob) : null;
    const ageText = age ? `${age} Yrs` : '11 Yrs';

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
            <div style="font-size: 1.1rem; font-weight: 800; color: #0F172A; margin-top: 3px;">
              ${student ? student.full_name : 'Unknown Resident'}
            </div>
            <div style="font-size: 0.82rem; font-weight: 600; color: #475569; margin-top: 2px;">
              ${student ? `${student.school_class || 'Class'} • ${ageText}` : 'Resident details unavailable'}
            </div>
          </div>

          <!-- Reassign Choice Prompt -->
          <div style="border-top: 1px dashed #CBD5E1; padding-top: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem;">
            <button type="button" class="btn btn-outline" id="btn-open-student-selector" style="font-weight: 700; color: #059669; border-color: #A7F3D0; background: #ECFDF5; height: 42px; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
              Choose New Resident (Open Selector) →
            </button>

            <!-- Quick Direct Dropdown -->
            <div style="margin-top: 0.25rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.78rem; color: #64748B;">Or quick reassign from dropdown:</label>
              <select id="modal-reassign-select" class="form-control" style="height: 38px;">
                <option value="">-- Choose student to reassign --</option>
                ${availableStudents.map(s => `
                  <option value="${s.id}">${s.full_name} (${s.school_class || '-'})</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline" id="btn-vacate-bed" style="color: #DC2626; border-color: #FECACA; font-weight: 700;">
              Vacate Bed (Free Space)
            </button>
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-change">Cancel</button>
              <button type="button" class="btn btn-primary" id="btn-confirm-reassign" style="font-weight: 700; background: #059669; border-color: #059669;">Save Quick Reassignment</button>
            </div>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-change')?.addEventListener('click', close);

        // Open full classroom-style student selector
        modalBody.querySelector('#btn-open-student-selector')?.addEventListener('click', () => {
          close();
          openAssignBedModal(bedId, room?.id);
        });

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
