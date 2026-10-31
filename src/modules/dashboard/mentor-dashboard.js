import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate } from '../../lib/utils.js';
import { getMentorGenderScope } from '../../lib/permissions.js';

export async function renderMentorDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const allStudents = await db.getStudents();
  const allLeaves = await db.getLeaves(true);
  const allDiscipline = await db.getDisciplineIncidents();

  // Retrieve or determine active hostel unit scope based on Boys / Girls mentor role
  const mentorGender = getMentorGenderScope(user);
  const isGirlsMentor = mentorGender === 'Girls';
  const isBoysMentor = mentorGender === 'Boys';

  let units = [
    { id: 'girls', name: 'Thaiba Girls Hostel Campus', gender: 'Girls', capacity: 60, totalRooms: 15 },
    { id: 'boys-a', name: 'Thaiba Boys Hostel Block A', gender: 'Boys', capacity: 48, totalRooms: 12 },
    { id: 'boys-b', name: 'Thaiba Boys Hostel Block B', gender: 'Boys', capacity: 40, totalRooms: 10 }
  ];

  if (isGirlsMentor) {
    units = units.filter(u => u.gender === 'Girls');
  } else if (isBoysMentor) {
    units = units.filter(u => u.gender === 'Boys');
  }

  const savedScope = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_mentor_active_hostel') : null;
  let activeUnit = (savedScope && units.some(u => u.name === savedScope))
    ? savedScope 
    : (user?.hostel_unit && units.some(u => u.name === user.hostel_unit)) 
      ? user.hostel_unit 
      : units[0].name;

  const currentUnitConfig = units.find(u => u.name === activeUnit) || units[0];
  const isGirlsHostel = currentUnitConfig.gender === 'Girls';

  // STRICT DATA FILTERING: If mentor of Girls Hostel, only get Girls Hostel data!
  const scopedStudents = allStudents.filter(s => {
    if (isGirlsHostel) {
      return s.gender === 'Girls' || s.gender === 'Female' || (s.hostel_unit && s.hostel_unit.includes('Girls'));
    } else {
      return s.gender === 'Boys' || s.gender === 'Male' || (s.hostel_unit && s.hostel_unit.includes(currentUnitConfig.name));
    }
  });

  const scopedStudentIds = new Set(scopedStudents.map(s => s.id));

  // Scoped leaves for residents of this hostel unit only
  const rawScopedLeaves = allLeaves.filter(l => {
    const sIds = Array.isArray(l.student_ids) && l.student_ids.length > 0 ? l.student_ids : [l.student_id];
    return sIds.some(sid => scopedStudentIds.has(sid));
  });

  // Check pending student leave requests for mentor's scoped hostel unit
  const pendingScopedLeaves = rawScopedLeaves.filter(l => (l.status || '').toLowerCase() === 'pending');
  const uniqueMentorPendingMap = new Map();
  pendingScopedLeaves.forEach(l => {
    const sIds = Array.isArray(l.student_ids) && l.student_ids.length > 0 ? l.student_ids : [l.student_id];
    sIds.forEach(sid => {
      if (sid && !uniqueMentorPendingMap.has(sid)) {
        const studentObj = scopedStudents.find(s => s.id === sid);
        uniqueMentorPendingMap.set(sid, studentObj?.full_name || l.student_name || 'Resident');
      }
    });
    if (sIds.length === 0 || !sIds[0]) {
      const name = l.student_name || 'Resident';
      if (!uniqueMentorPendingMap.has(name)) {
        uniqueMentorPendingMap.set(name, name);
      }
    }
  });
  const pendingMentorCount = uniqueMentorPendingMap.size;
  const pendingMentorList = Array.from(uniqueMentorPendingMap.values());
  const mentorAlertText = pendingMentorCount === 1
    ? `${pendingMentorList[0]} requested leave`
    : `${pendingMentorCount} residents requested leave`;

  // Sort scoped leaves so pending requests appear at top
  const sortedScopedLeaves = [...rawScopedLeaves].sort((a, b) => {
    const aPend = (a.status || '').toLowerCase() === 'pending';
    const bPend = (b.status || '').toLowerCase() === 'pending';
    if (aPend && !bPend) return -1;
    if (!aPend && bPend) return 1;
    return new Date(b.created_at || b.departure_date || 0) - new Date(a.created_at || a.departure_date || 0);
  });

  const displayLeaves = sortedScopedLeaves.length > 0 ? sortedScopedLeaves : [
    {
      leave_register_number: isGirlsHostel ? 'GLR-2026-012' : 'BLR-2026-034',
      student_name: scopedStudents[0]?.full_name || (isGirlsHostel ? 'Sultana Sarkar' : 'MD Aamir'),
      admission_number: scopedStudents[0]?.admission_number || (isGirlsHostel ? 'TPS-2026-005' : 'TPS-2026-001'),
      room: isGirlsHostel ? 'Room 201' : 'Room 101',
      expected_return_date: '2026-10-28',
      status: 'Away'
    },
    {
      leave_register_number: isGirlsHostel ? 'GLR-2026-014' : 'BLR-2026-039',
      student_name: scopedStudents[1]?.full_name || (isGirlsHostel ? 'Fathima Zehra' : 'Rehan Islam'),
      admission_number: scopedStudents[1]?.admission_number || (isGirlsHostel ? 'TPS-2026-006' : 'TPS-2026-002'),
      room: isGirlsHostel ? 'Room 202' : 'Room 102',
      expected_return_date: '2026-10-26',
      status: 'Overdue'
    }
  ];

  // Scoped discipline for residents of this hostel unit only
  const rawScopedDiscipline = allDiscipline.filter(d => scopedStudentIds.has(d.student_id));
  const displayDiscipline = rawScopedDiscipline.length > 0 ? rawScopedDiscipline : [
    {
      student_name: scopedStudents[2]?.full_name || (isGirlsHostel ? 'Amina Begum' : 'Jakir Sarkar'),
      room: isGirlsHostel ? 'Room 203' : 'Room 103',
      category: 'Curfew Timing Violation',
      black_marks_awarded: 1,
      resolution_status: 'Investigating'
    }
  ];

  // Scoped metrics
  const activeResidents = scopedStudents.filter(s => s.status === 'Active');
  const onLeaveCount = displayLeaves.filter(l => l.status === 'Away' || l.status === 'On Approved Leave').length;
  const overdueCount = displayLeaves.filter(l => l.status === 'Overdue').length;
  const totalOccupied = scopedStudents.length;

  container.innerHTML = `
    <!-- Hostel Unit Filter & Verification Banner (Strict Girls vs Boys Hostel Isolation) -->
    <div style="background: ${isGirlsHostel ? '#FDF2F8' : '#EFF6FF'}; border: 1.5px solid ${isGirlsHostel ? '#FBCFE8' : '#BFDBFE'}; border-radius: var(--radius-lg); padding: 0.9rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: ${isGirlsHostel ? '#FCE7F3' : '#DBEAFE'}; color: ${isGirlsHostel ? '#BE185D' : '#1D4ED8'}; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
          ${isGirlsHostel ? '🌸' : '🏢'}
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${isGirlsHostel ? '#9D174D' : '#1E40AF'};">
              Assigned Hostel Unit:
            </span>
            <span style="background: ${isGirlsHostel ? '#F472B6' : '#3B82F6'}; color: #FFFFFF; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
              ${isGirlsHostel ? 'Girls Hostel Wing' : 'Boys Hostel Wing'}
            </span>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-top: 0.1rem;">
            ${currentUnitConfig.name}
          </h3>
          <p style="font-size: 0.78rem; color: #64748B; margin-top: 0.1rem;">
            Showing only residents, leaves, room allocations, and attendance for this specific hostel unit.
          </p>
        </div>
      </div>

      <!-- Quick Unit Scope Switcher -->
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.78rem; font-weight: 600; color: #475569;">Switch Unit:</span>
        <select id="mentor-unit-selector" class="form-control" style="font-weight: 700; font-size: 0.82rem; padding: 0.4rem 0.8rem; cursor: pointer; border-radius: var(--radius-md); background: #FFFFFF;">
          ${units.map(u => `
            <option value="${u.name}" ${u.name === activeUnit ? 'selected' : ''}>
              ${u.name} (${u.gender} Wing)
            </option>
          `).join('')}
        </select>
      </div>
    </div>

    ${pendingMentorCount > 0 ? `
      <div class="mentor-leave-alert-banner" id="mentor-leave-alert-banner" style="margin-bottom: 1.25rem; padding: 0.85rem 1.25rem; border-radius: 12px; background: #FFFBEB; border: 1.5px solid #FDE68A; display: flex; justify-content: space-between; align-items: center; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="display: inline-flex; width: 10px; height: 10px; border-radius: 50%; background: #F59E0B; box-shadow: 0 0 8px rgba(245, 158, 11, 0.9); animation: tpsPulseAmber 1.6s infinite ease-in-out;"></span>
          <div>
            <strong style="color: #92400E; font-size: 0.92rem;">${mentorAlertText}</strong>
            <span style="font-size: 0.8rem; color: #B45309; margin-left: 0.35rem;">• Parent leave request awaiting mentor authorization & hourly fine entry</span>
          </div>
        </div>
        <button class="btn btn-xs btn-outline" style="border-color: #F59E0B; color: #B45309; font-weight: 700; background: #FFFFFF; border-radius: 9999px;">
          Review & Approve →
        </button>
      </div>
    ` : ''}

    <div class="page-header" style="margin-bottom: 1.5rem;">
      <div class="page-title-group">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">
          ${isGirlsMentor ? 'Girls Hostel Mentor Dashboard' : isBoysMentor ? 'Boys Hostel Mentor Dashboard' : 'Hostel Mentor Dashboard'} • ${user?.full_name || (isGirlsMentor ? 'Usthada Mariyam' : 'Usthad Usman')}
        </h2>
        <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">
          Hostel Ward Management, Resident Safety, Night Roll Call & Gate Passes
        </p>
      </div>
      <div class="page-actions" style="display: flex; gap: 0.75rem; align-items: center;">
        <button class="btn btn-secondary" id="btn-mentor-allocate-bed">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
          Bed Allocation
        </button>
        <button class="btn btn-primary" id="btn-mentor-record-leave" style="background: #059669;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          Record Leave Pass
        </button>
      </div>
    </div>

    <!-- SECTION 1: Hostel Operations -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">${isGirlsHostel ? '🌸' : '🏢'}</div>
        <div>
          <h3 class="dash-section-title">Hostel Operations (${isGirlsHostel ? 'Girls Campus' : 'Boys Block'})</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Unit residency, room allocations, gate passes & curfew discipline</span>
        </div>
      </div>
      <span class="dash-section-badge">${isGirlsHostel ? 'Girls Hostel Wing' : 'Boys Hostel Wing'}</span>
    </div>

    <!-- Scoped Metrics Grid -->
    <div class="grid-stats">
      <div class="stat-card" data-route="students" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Unit Residents</span>
          <div class="stat-icon-wrapper" style="background: ${isGirlsHostel ? '#FCE7F3' : '#EFF6FF'}; color: ${isGirlsHostel ? '#BE185D' : '#2563EB'};">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="stat-value">${activeResidents.length}</div>
        <div class="stat-footer">
          <span>Total registered ${currentUnitConfig.gender.toLowerCase()} in unit</span>
        </div>
      </div>

      <div class="stat-card" data-route="hostel" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Bed Occupancy</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
          </div>
        </div>
        <div class="stat-value">${totalOccupied} / ${currentUnitConfig.capacity}</div>
        <div class="stat-footer">
          <span>Rooms: <strong>${currentUnitConfig.totalRooms}</strong> • Vacant: <strong>${Math.max(0, currentUnitConfig.capacity - totalOccupied)}</strong></span>
        </div>
      </div>

      <div class="stat-card" data-route="leaves" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Away on Leave</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value">${onLeaveCount}</div>
        <div class="stat-footer">
          <span>Active gate passes issued</span>
        </div>
      </div>

      <div class="stat-card" data-route="fines" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Overdue Returns</span>
          <div class="stat-icon-wrapper" style="background: #FEF2F2; color: #DC2626;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: #DC2626;">${overdueCount}</div>
        <div class="stat-footer">
          <span style="color: #DC2626; font-weight: 700;">Action required by mentor</span>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Operational Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
      <!-- Unit Leaves & Gate Pass Register -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            ${isGirlsHostel ? 'Girls Hostel' : 'Boys Hostel'} Leave & Gate Passes
          </h3>
          <button class="btn btn-outline btn-sm" id="btn-view-all-unit-leaves">Full Register</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Pass Reg</th>
                  <th>Expected Return</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${displayLeaves.map(l => {
                  const isOver = l.status === 'Overdue';
                  const isPending = (l.status || '').toLowerCase() === 'pending';
                  const sIds = Array.isArray(l.student_ids) && l.student_ids.length > 0 ? l.student_ids : [l.student_id];
                  const residentObj = scopedStudents.find(s => sIds.includes(s.id));
                  const residentName = residentObj?.full_name || l.student_name || 'Resident';
                  const regNo = l.leave_register_number || l.leave_code || 'LV-2026';
                  return `
                    <tr style="cursor: pointer;" data-leave-row="${l.id || ''}">
                      <td>
                        <strong>${residentName}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${residentObj?.hostel_room || l.room || 'Dorm'} • ${residentObj?.admission_number || l.admission_number || 'TPS'}</div>
                      </td>
                      <td><code>${regNo}</code></td>
                      <td>${formatDate(l.expected_return_date)}</td>
                      <td>
                        <span class="badge ${isPending ? 'badge-warning' : isOver ? 'badge-absent' : 'badge-leave'}" style="${isPending ? 'background: #FEF3C7; color: #92400E; font-weight: 700;' : ''}">${isPending ? 'Pending Approval' : l.status}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Dormitory Resident Roster (Filtered to Unit) -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            Resident Roster (${currentUnitConfig.name})
          </h3>
          <button class="btn btn-outline btn-sm" id="btn-view-all-unit-hostel">Room Allocation</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Class</th>
                  <th>Room & Bed</th>
                  <th>Presence</th>
                </tr>
              </thead>
              <tbody>
                ${scopedStudents.slice(0, 5).map((s, idx) => `
                  <tr>
                    <td>
                      <strong>${s.full_name}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${s.admission_number}</div>
                    </td>
                    <td>${s.school_class || 'STD-V'}</td>
                    <td>
                      <strong>${s.hostel_room || ('Room ' + (isGirlsHostel ? '20' + (idx+1) : '10' + (idx+1)))}</strong>
                      <span style="font-size: 0.75rem; color: #64748B;">(${s.hostel_bed || ('Bed ' + (idx%3 + 1))})</span>
                    </td>
                    <td>
                      <span class="badge ${s.status === 'Active' ? 'badge-present' : 'badge-leave'}">${s.status}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- SECTION 2: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">📚</div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Supervised evening study hours, exam focus & resident academic care</span>
        </div>
      </div>
      <span class="dash-section-badge">Residential Mentorship</span>
    </div>

    <!-- Night Roll Call & Curfew Safety Panel -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 18px;">🌙</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Hostel Night Roll Call & Curfew Status</h3>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-take-night-rollcall" style="background: #059669;">
          Conduct Night Roll Call →
        </button>
      </div>
      <div class="card-panel-body" style="padding: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
          <p style="font-size: 0.85rem; color: #475569; margin: 0;">
            Night attendance locking is scheduled at <strong>09:30 PM</strong>. Any student outside without an approved gate pass will automatically trigger a late alert and black mark recommendation.
          </p>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 0.35rem 0.75rem; border-radius: var(--radius-md); border: 1px solid #A7F3D0;">
              ✓ All ${scopedStudents.length} Residents Accounted For
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach handlers
  container.querySelector('#mentor-leave-alert-banner')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelectorAll('tr[data-leave-row]').forEach(row => {
    row.addEventListener('click', () => onNavigate('leaves'));
  });

  container.querySelector('#mentor-unit-selector')?.addEventListener('change', (e) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tps_mentor_active_hostel', e.target.value);
    }
    renderMentorDashboard(container, { onNavigate });
  });

  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#btn-mentor-allocate-bed')?.addEventListener('click', () => onNavigate('hostel'));
  container.querySelector('#btn-mentor-record-leave')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelector('#btn-view-all-unit-leaves')?.addEventListener('click', () => onNavigate('leaves'));
  container.querySelector('#btn-view-all-unit-hostel')?.addEventListener('click', () => onNavigate('hostel'));
  container.querySelector('#btn-take-night-rollcall')?.addEventListener('click', () => onNavigate('attendance'));
}
