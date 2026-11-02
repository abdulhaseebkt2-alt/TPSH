import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { formatDate, formatTime } from '../../lib/utils.js';

function parseDateTimeSafe(dateStr, timeStr) {
  if (!dateStr) return null;
  let t = (timeStr || '18:00').trim();
  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const isPM = ampmMatch[4].toUpperCase() === 'PM';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    t = `${String(h).padStart(2, '0')}:${m}:00`;
  } else if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':');
    t = `${String(h).padStart(2, '0')}:${m}:00`;
  } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    const parts = t.split(':');
    t = `${String(parts[0]).padStart(2, '0')}:${parts[1]}:${parts[2]}`;
  }
  const cleanDate = dateStr.trim().split('T')[0];
  const dt = new Date(`${cleanDate}T${t}`);
  return isNaN(dt.getTime()) ? null : dt;
}

export async function renderStudentLeaveCardModule(container, options = {}) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 280px;">
      <div class="loading-spinner" style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #059669; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    </div>
  `;

  try {
    const user = getCurrentUser();
    const isSuperAdmin = user?.is_super_admin === true;
    const role = user?.role || 'admin';
    const isAdmin = isSuperAdmin || role === 'admin';
    const isBoysMentor = role === 'boys_mentor';
    const isGirlsMentor = role === 'girls_mentor';
    const isMentor = isAdmin || isBoysMentor || isGirlsMentor || role === 'mentor';
    const isParent = role === 'parent';

    // 1. Fetch Students and Leaves
    const [allStudents, allLeaves] = await Promise.all([
      db.getStudents(),
      db.getLeaves(true)
    ]);

    // Role-based student accessibility
    let accessibleStudents = [...(allStudents || [])];
    if (isBoysMentor) {
      accessibleStudents = accessibleStudents.filter(s => (s.gender || '').toLowerCase() === 'boy' || (s.gender || '').toLowerCase() === 'boys' || (s.gender || '').toLowerCase() === 'male');
    } else if (isGirlsMentor) {
      accessibleStudents = accessibleStudents.filter(s => (s.gender || '').toLowerCase() === 'girl' || (s.gender || '').toLowerCase() === 'girls' || (s.gender || '').toLowerCase() === 'female');
    } else if (isParent) {
      // Child isolation for Parent
      const parentMap = db.get('tps_parent_assignments') || {};
      const cloudAssigned = (user?.id && parentMap[user.id]) || (user?.email && parentMap[user.email.toLowerCase()]) || null;
      const explicitAssignedIds = (cloudAssigned && Array.isArray(cloudAssigned) && cloudAssigned.length > 0)
        ? cloudAssigned
        : (Array.isArray(user?.assigned_student_ids) && user.assigned_student_ids.length > 0
            ? user.assigned_student_ids
            : (Array.isArray(user?.student_ids) && user.student_ids.length > 0
                ? user.student_ids
                : (Array.isArray(user?.child_ids) && user.child_ids.length > 0 ? user.child_ids : null)));

      if (explicitAssignedIds && explicitAssignedIds.length > 0) {
        accessibleStudents = accessibleStudents.filter(s => explicitAssignedIds.includes(s.id) || explicitAssignedIds.includes(s.admission_number));
      } else {
        const phone = (user?.phone || user?.phone_number || '').replace(/[^0-9]/g, '');
        accessibleStudents = accessibleStudents.filter(s => {
          if (!user) return false;
          const sFatherPhone = (s.father_phone || '').replace(/[^0-9]/g, '');
          const sMotherPhone = (s.mother_phone || '').replace(/[^0-9]/g, '');
          const sWhatsApp = (s.whatsapp_number || '').replace(/[^0-9]/g, '');
          if (phone && (phone === sFatherPhone || phone === sMotherPhone || phone === sWhatsApp)) return true;
          if (user.full_name && s.father_name && s.father_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) return true;
          if (user.student_admission_number && s.admission_number === user.student_admission_number) return true;
          return false;
        });

        // Fallback for dev / preview
        if (accessibleStudents.length === 0 && (user?.is_dev_profile || !user?.id || user?.role === 'parent')) {
          accessibleStudents = (allStudents || []).slice(0, 2);
        }
      }
    }

    // Determine initial selected student
    const defaultStudentId = options.studentId || (typeof localStorage !== 'undefined' ? localStorage.getItem('tps_leave_card_active_student') : null);
    let selectedStudent = accessibleStudents.find(s => s.id === defaultStudentId) || accessibleStudents[0] || null;

    // Filters state for Admin / Mentor
    let searchFilter = '';
    let classFilter = 'all';
    let genderFilter = isBoysMentor ? 'boy' : isGirlsMentor ? 'girl' : 'all';
    let statusFilter = 'all';

    // Unique classes for filter
    const uniqueClasses = Array.from(new Set(accessibleStudents.map(s => s.school_class || s.class_name).filter(Boolean))).sort();

    function getStudentLeaves(studentId) {
      if (!studentId) return [];
      return (allLeaves || []).filter(l => {
        if (l.student_id === studentId) return true;
        if (Array.isArray(l.student_ids) && l.student_ids.includes(studentId)) return true;
        if (Array.isArray(l.students) && l.students.some(e => e.student_id === studentId)) return true;
        return false;
      }).sort((a, b) => new Date(b.created_at || b.departure_date || 0) - new Date(a.created_at || a.departure_date || 0));
    }

    function renderModule() {
      // Filter accessible students for dropdown picker
      const filteredPickerStudents = accessibleStudents.filter(s => {
        if (genderFilter !== 'all') {
          const sGen = (s.gender || '').toLowerCase();
          if ((genderFilter === 'Male' || genderFilter === 'boy') && !sGen.startsWith('b') && !sGen.startsWith('m')) return false;
          if ((genderFilter === 'Female' || genderFilter === 'girl') && !sGen.startsWith('g') && !sGen.startsWith('f')) return false;
        }
        if (statusFilter !== 'all') {
          const sStatus = s.status || 'Active';
          if (statusFilter === 'active' || statusFilter === 'Active') {
            if (sStatus !== 'Active' && sStatus !== 'Present') return false;
          } else if (statusFilter === 'On Approved Leave') {
            if (sStatus !== 'On Approved Leave') return false;
          } else if (statusFilter === 'Temporary Break') {
            if (sStatus !== 'Temporary Break') return false;
          } else if (statusFilter === 'inactive') {
            if (sStatus !== 'Inactive') return false;
          }
        }
        if (classFilter !== 'all') {
          const sClass = s.school_class || s.class_name || '';
          if (sClass !== classFilter) return false;
        }
        if (searchFilter) {
          const q = searchFilter.toLowerCase().trim();
          const matchName = (s.full_name || '').toLowerCase().includes(q);
          const matchAdm = (s.admission_number || '').toLowerCase().includes(q);
          const matchPhone = (s.father_phone || s.mother_phone || s.emergency_contact || '').includes(q);
          if (!matchName && !matchAdm && !matchPhone) return false;
        }
        return true;
      });

      // If selectedStudent is filtered out or null, pick first available
      if (!selectedStudent || (!isParent && !filteredPickerStudents.some(s => s.id === selectedStudent.id))) {
        selectedStudent = filteredPickerStudents[0] || accessibleStudents[0] || null;
      }

      const studentLeaves = selectedStudent ? getStudentLeaves(selectedStudent.id) : [];

      // Check if student is actively away on approved unreturned leave
      const activeUnreturnedLeave = studentLeaves.find(l => {
        const isRej = (l.status || '').toLowerCase() === 'rejected';
        const isPend = (l.status || '').toLowerCase() === 'pending';
        let isRet = false;
        if (Array.isArray(l.students)) {
          const sEntry = l.students.find(entry => entry.student_id === selectedStudent?.id);
          if (sEntry) isRet = sEntry.is_returned === true;
        } else {
          isRet = l.status === 'Returned' || !!l.actual_return_date;
        }
        if (l.status === 'Returned') isRet = true;
        if (isRej || isPend || isRet) return false;

        const departs = l.departure_date || l.leaving_date;
        const depTime = l.departure_time || l.leaving_time || '00:00';
        const departDateTime = departs ? parseDateTimeSafe(departs, depTime) : null;
        const now = new Date();
        if (departDateTime && now < departDateTime) return false; // Future upcoming
        return true;
      });

      const isStudentAway = !!activeUnreturnedLeave || (selectedStudent && (selectedStudent.status === 'On Approved Leave' || selectedStudent.status === 'Away'));

      // Automatically keep student record status synced in DB
      if (selectedStudent && isStudentAway && selectedStudent.status !== 'On Approved Leave') {
        selectedStudent.status = 'On Approved Leave';
        db.updateStudent(selectedStudent.id, { status: 'On Approved Leave' }).catch(() => {});
      } else if (selectedStudent && !isStudentAway && selectedStudent.status === 'On Approved Leave') {
        selectedStudent.status = 'Active';
        db.updateStudent(selectedStudent.id, { status: 'Active' }).catch(() => {});
      }

      container.innerHTML = `
        <div class="student-leave-card-module" style="display: flex; flex-direction: column; gap: 1rem; max-width: 1200px; margin: 0 auto; width: 100%;">
          
          <!-- Module Title & Filter Toolbar -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: ${!isParent ? '0.75rem' : '0'};">
              <div>
                <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 8px;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                    <circle cx="8" cy="12" r="2.5"></circle>
                    <path d="M14 10h4"></path>
                    <path d="M14 14h3"></path>
                    <path d="M5.5 17a2.5 2.5 0 0 1 5 0"></path>
                  </svg>
                  Student Leave Card
                </h2>
                <p style="font-size: 0.8rem; color: #64748B; margin: 2px 0 0;">
                  Official student exit pass log, arrival status, and fine clearance records
                </p>
              </div>

              <!-- Parent Multiple Children Quick Switcher Tabs -->
              ${isParent && accessibleStudents.length > 1 ? `
                <div style="display: flex; gap: 0.4rem; background: #F1F5F9; padding: 4px; border-radius: 9999px;">
                  ${accessibleStudents.map(ch => `
                    <button class="btn btn-xs btn-child-tab ${ch.id === selectedStudent?.id ? 'btn-primary' : 'btn-ghost'}" data-child-id="${ch.id}" style="border-radius: 9999px; font-weight: 700; font-size: 0.75rem;">
                      ${ch.full_name} (${ch.school_class || 'STD'})
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <!-- Admin & Mentor Filters Toolbar (Old version restored: Dropdowns first, search brought after dropdowns, and student list with ONLY name & class) -->
            ${!isParent ? `
              <div class="student-filter-capsule" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 0.65rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.65rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); position: relative;">
                <!-- Row 1: Dropdown filters first -->
                <div class="capsule-filters" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; width: 100%;">
                  <!-- Gender Filter Dropdown -->
                  <select id="leave-card-gender-filter" style="border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 0.78rem; font-weight: 600; padding: 0.45rem 0.45rem; border-radius: 8px; cursor: pointer; outline: none; width: 100%; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                    ${isGirlsMentor ? `<option value="Female" selected>Female</option>` : isBoysMentor ? `<option value="Male" selected>Male</option>` : `
                      <option value="all" ${genderFilter === 'all' ? 'selected' : ''}>All</option>
                      <option value="Male" ${genderFilter === 'Male' || genderFilter === 'boy' ? 'selected' : ''}>Male</option>
                      <option value="Female" ${genderFilter === 'Female' || genderFilter === 'girl' ? 'selected' : ''}>Female</option>
                    `}
                  </select>

                  <!-- Status Filter Dropdown -->
                  <select id="leave-card-status-filter" style="border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 0.78rem; font-weight: 600; padding: 0.45rem 0.45rem; border-radius: 8px; cursor: pointer; outline: none; width: 100%; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                    <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
                    <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Active</option>
                    <option value="On Approved Leave" ${statusFilter === 'On Approved Leave' ? 'selected' : ''}>On Approved Leave</option>
                    <option value="Temporary Break" ${statusFilter === 'Temporary Break' ? 'selected' : ''}>Temporary Break</option>
                    <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>Inactive</option>
                  </select>

                  <!-- Class Filter Dropdown -->
                  <select id="leave-card-class-filter" style="border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 0.78rem; font-weight: 600; padding: 0.45rem 0.45rem; border-radius: 8px; cursor: pointer; outline: none; width: 100%; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                    <option value="all" ${classFilter === 'all' ? 'selected' : ''}>All Classes</option>
                    ${uniqueClasses.map(c => `<option value="${c}" ${classFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
                  </select>
                </div>

                <!-- Row 2: Search Input brought AFTER dropdowns -->
                <div style="position: relative; width: 100%;">
                  <div class="capsule-search" style="display: flex; align-items: center; gap: 0.65rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.55rem 0.75rem; width: 100%; box-sizing: border-box; cursor: text;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.2" style="flex-shrink: 0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input 
                      type="text" 
                      id="leave-card-search-input" 
                      placeholder="Search student by name, ID, phone..." 
                      value="${searchFilter}" 
                      style="border: none; background: transparent; width: 100%; font-size: 0.85rem; color: #1E293B; outline: none; padding: 0;"
                      autocomplete="off"
                    />
                    ${searchFilter ? `
                      <button type="button" id="btn-clear-search" style="border: none; background: transparent; color: #94A3B8; cursor: pointer; padding: 0 4px; font-size: 0.95rem; line-height: 1;" title="Clear search">✕</button>
                    ` : ''}
                  </div>

                  <!-- Dropdown List of Matching Students (Shows ONLY Name and Class, No Extra Detail) -->
                  <div id="leave-card-student-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #FFFFFF; border: 1.5px solid #059669; border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08); max-height: 240px; overflow-y: auto; z-index: 1000;">
                    ${filteredPickerStudents.length === 0 ? `
                      <div style="padding: 0.75rem 1rem; font-size: 0.8rem; color: #94A3B8; text-align: center;">
                        No student found matching criteria
                      </div>
                    ` : filteredPickerStudents.map(s => `
                      <div class="dropdown-student-item" data-id="${s.id}" style="padding: 0.65rem 0.9rem; border-bottom: 1px solid #F1F5F9; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; transition: background 0.15s ease; ${s.id === selectedStudent?.id ? 'background: #ECFDF5;' : ''}">
                        <div style="min-width: 0;">
                          <span style="font-weight: 700; font-size: 0.86rem; color: #0F172A;">${s.full_name}</span>
                          <span style="font-size: 0.74rem; color: #64748B; margin-left: 6px;">Class ${s.school_class || s.class_name || '-'}</span>
                        </div>
                        ${s.id === selectedStudent?.id ? '<span style="color: #059669; font-weight: 800; font-size: 0.85rem;">✓</span>' : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- TOP STUDENT DETAILS CARD (MINIMAL HEIGHT & COMPACT) -->
          ${selectedStudent ? `
            <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.65rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <!-- Photo + Core Identity -->
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                  <!-- Student Photo -->
                  <div style="width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: #F1F5F9; border: 1.5px solid #CBD5E1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    ${selectedStudent.photo_url ? `
                      <img src="${selectedStudent.photo_url}" alt="${selectedStudent.full_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                      <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 800; color: #475569; font-size: 1.15rem; background: #E2E8F0;">
                        ${(selectedStudent.full_name || 'S').charAt(0).toUpperCase()}
                      </div>
                    ` : `
                      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #059669; font-size: 1.2rem; background: #ECFDF5;">
                        ${(selectedStudent.full_name || 'S').charAt(0).toUpperCase()}
                      </div>
                    `}
                  </div>

                  <!-- Text Details -->
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0F172A;">
                        ${selectedStudent.full_name}
                      </h3>
                      <span class="badge" style="background: #ECFDF5; color: #059669; font-weight: 700; font-size: 0.72rem; padding: 2px 7px; border-radius: 6px; font-family: monospace;">
                        ${selectedStudent.admission_number || 'TPS-ADM'}
                      </span>
                      <span class="badge" style="background: #EEF2FF; color: #4F46E5; font-weight: 700; font-size: 0.72rem; padding: 2px 7px; border-radius: 6px;">
                        ${selectedStudent.school_class || selectedStudent.class_name || 'STD-I'} ${selectedStudent.school_section ? `(${selectedStudent.school_section})` : ''}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 3px; font-size: 0.78rem; color: #64748B;">
                      <span>📍 <strong>${selectedStudent.hostel_room || 'Room 101'}</strong> ${selectedStudent.hostel_bed ? `(${selectedStudent.hostel_bed})` : ''}</span>
                      <span>•</span>
                      <span>${selectedStudent.hostel_unit || 'Hostel Campus'}</span>
                      <span>•</span>
                      <span>Mentor: <strong>${selectedStudent.assigned_mentor_name || 'Ustad Assigned'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Center-Aligned Presence Status Pill -->
              <div style="display: flex; justify-content: center; align-items: center; padding-top: 0.45rem; border-top: 1px solid #F1F5F9; width: 100%;">
                ${isStudentAway ? `
                  <span class="badge" style="background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 0.8rem; padding: 4px 14px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(217,119,6,0.1);">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #D97706; display: inline-block;"></span>
                    On Approved Leave
                  </span>
                ` : `
                  <span class="badge" style="background: #ECFDF5; color: #059669; font-weight: 700; font-size: 0.8rem; padding: 4px 14px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(16,185,129,0.1);">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
                    Present in Hostel
                  </span>
                `}
              </div>
            </div>
          ` : `
            <div style="background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 14px; padding: 1.5rem; text-align: center; color: #64748B;">
              No student found matching filter criteria.
            </div>
          `}

          <!-- UNDER STUDENT DATA: LEAVE & ARRIVAL TABLE -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
            <div style="padding: 0.85rem 1.15rem; background: #059669; display: flex; align-items: center; justify-content: center; text-align: center;">
              <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #FFFFFF; letter-spacing: 0.01em;">
                Leave & Arrival Register History
              </h4>
            </div>

            ${studentLeaves.length === 0 ? `
              <div style="padding: 2.5rem; text-align: center; color: #94A3B8;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.8" style="margin-bottom: 0.5rem;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <div style="font-weight: 700; color: #475569; font-size: 0.95rem;">No leave passes recorded</div>
                <p style="font-size: 0.8rem; margin: 0.25rem 0 0; color: #94A3B8;">This student does not have any residential gate passes or leaves yet.</p>
              </div>
            ` : `
              <div class="table-responsive" style="overflow-x: hidden; width: 100%;">
                <table class="data-table student-leave-card-table" style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 7%; text-align: center;">SL</th>
                      <th style="padding: 0.65rem 0.35rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 45%;">Schedule</th>
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 16%; text-align: center;">Status</th>
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 16%; text-align: center;">Fine</th>
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 16%; text-align: center;">F.Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${studentLeaves.map((l, idx) => {
                      // Student specific return status
                      let isRet = false;
                      let actualRetDate = null;
                      let actualRetTime = null;
                      if (Array.isArray(l.students)) {
                        const sEntry = l.students.find(entry => entry.student_id === selectedStudent.id);
                        if (sEntry) {
                          isRet = sEntry.is_returned === true;
                          actualRetDate = sEntry.actual_return_date;
                          actualRetTime = sEntry.actual_return_time;
                        }
                      } else {
                        isRet = l.status === 'Returned' || !!l.actual_return_date;
                        actualRetDate = l.actual_return_date;
                        actualRetTime = l.actual_return_time;
                      }

                      if (l.status === 'Returned' && !isRet) {
                        isRet = true;
                        actualRetDate = l.actual_return_date || l.expected_return_date;
                        actualRetTime = l.actual_return_time || l.expected_return_time;
                      }

                      const isRej = (l.status || '').toLowerCase() === 'rejected';
                      const isPend = (l.status || '').toLowerCase() === 'pending';
                      const departs = l.departure_date || l.leaving_date;
                      const todayIso = new Date().toISOString().split('T')[0];
                      const isUpcoming = !isPend && !isRej && !isRet && departs && departs > todayIso;

                      // Determine arrival status pill (Single Word concise labels)
                      let statusBadgeHtml = '';
                      let isLate = false;
                      let isEarly = false;

                      const studentEntry = Array.isArray(l.students) ? l.students.find(e => e.student_id === selectedStudent.id) : null;
                      const fineAmt = Number(l.calculated_fine) || Number(studentEntry?.fine_amount) || 0;
                      const isRecordedLate = (l.late_hours > 0) || (l.late_days > 0) || (studentEntry && (studentEntry.late_hours > 0 || studentEntry.late_days > 0)) || (fineAmt > 0) || l.return_status === 'late';

                      if (isRej) {
                        statusBadgeHtml = `
                          <span class="badge badge-danger" style="background: #FEE2E2; color: #DC2626; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;" title="${l.rejected_reason || 'Rejected'}">
                            Rejected
                          </span>
                        `;
                      } else if (isPend) {
                        statusBadgeHtml = `
                          <span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                            Pending
                          </span>
                        `;
                      } else if (isUpcoming) {
                        statusBadgeHtml = `
                          <span class="badge" style="background: #EFF6FF; color: #1D4ED8; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                            Upcoming
                          </span>
                        `;
                      } else if (isRet) {
                        const expDt = parseDateTimeSafe(l.expected_return_date, l.expected_return_time || '18:00');
                        const actDt = parseDateTimeSafe(actualRetDate, actualRetTime || '18:00');

                        if (isRecordedLate || (actDt && expDt && actDt.getTime() > expDt.getTime())) {
                          isLate = true;
                          statusBadgeHtml = `
                            <span class="badge badge-danger" style="background: #FEE2E2; color: #DC2626; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                              Late
                            </span>
                          `;
                        } else if (actualRetDate && l.expected_return_date && actualRetDate < l.expected_return_date) {
                          isEarly = true;
                          statusBadgeHtml = `
                            <span class="badge badge-info" style="background: #E0F2FE; color: #0284C7; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                              Early
                            </span>
                          `;
                        } else if (actDt && expDt && (expDt.getTime() - actDt.getTime() > 60 * 60 * 1000)) {
                          isEarly = true;
                          statusBadgeHtml = `
                            <span class="badge badge-info" style="background: #E0F2FE; color: #0284C7; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                              Early
                            </span>
                          `;
                        } else {
                          statusBadgeHtml = `
                            <span class="badge badge-success" style="background: #ECFDF5; color: #059669; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                              Ontime
                            </span>
                          `;
                        }
                      } else {
                        // Not returned yet
                        const expDt = parseDateTimeSafe(l.expected_return_date, l.expected_return_time || '18:00');
                        const nowMs = Date.now();
                        if (expDt && nowMs > expDt.getTime()) {
                          isLate = true;
                          statusBadgeHtml = `
                            <span class="badge badge-danger" style="background: #FEE2E2; color: #DC2626; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                              Overdue
                            </span>
                          `;
                        } else {
                          statusBadgeHtml = `
                            <span class="badge badge-warning" style="background: #FEF3C7; color: #D97706; font-size: 0.68rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">
                              Away
                            </span>
                          `;
                        }
                      }

                      // Fine amount column
                      const fineDisplay = (fineAmt > 0) 
                        ? `<span style="font-weight: 800; font-family: monospace; color: #DC2626; font-size: 0.76rem;">₹${fineAmt}</span>` 
                        : `<span style="color: #94A3B8; font-size: 0.76rem;">-</span>`;

                      // Fine paid status column (Clean tick ✓ or cross ✕ icon)
                      let finePaidDisplay = '<span style="color: #94A3B8; font-size: 0.76rem;">-</span>';
                      if (fineAmt > 0) {
                        const isPaid = l.fine_status === 'paid' || studentEntry?.fine_status === 'paid';
                        const isPartial = l.fine_status === 'partial' || studentEntry?.fine_status === 'partial';
                        if (isPaid) {
                          finePaidDisplay = `
                            <span style="color: #059669; font-weight: 900; font-size: 0.95rem; line-height: 1;" title="Paid">✓</span>
                          `;
                        } else if (isPartial) {
                          finePaidDisplay = `
                            <span style="color: #D97706; font-weight: 900; font-size: 0.76rem; line-height: 1; background: #FEF3C7; padding: 2px 4px; border-radius: 4px;" title="Partially Paid">½</span>
                          `;
                        } else {
                          finePaidDisplay = `
                            <span style="color: #DC2626; font-weight: 900; font-size: 0.88rem; line-height: 1;" title="Unpaid">✕</span>
                          `;
                        }
                      }

                      // Dates formatting - Leaving & Arrival in single column with 12-hour AM/PM format
                      const leavingDate = l.departure_date || l.leaving_date || '-';
                      const leavingTime = l.departure_time || l.leaving_time || '16:00';
                      const formattedLeavingTime = formatTime(leavingTime);

                      let arrivalLineHtml = '';
                      // Rejected leaves need NO second date line: single date space is enough
                      if (isRej) {
                        arrivalLineHtml = '';
                      } else if (isRet && actualRetDate) {
                        const formattedActualRetTime = actualRetTime ? formatTime(actualRetTime) : '';
                        arrivalLineHtml = `
                          <div style="font-size: 0.74rem; font-weight: 700; color: #059669; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25;">
                            ${actualRetDate} <span style="font-size: 0.66rem; font-weight: 600; color: #059669;">${formattedActualRetTime}</span>
                          </div>
                        `;
                      } else {
                        const formattedExpRetTime = l.expected_return_time ? formatTime(l.expected_return_time) : '06:00 PM';
                        arrivalLineHtml = `
                          <div style="font-size: 0.73rem; font-weight: 600; color: ${isLate ? '#DC2626' : '#64748B'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25;">
                            ${l.expected_return_date || '-'} <span style="font-size: 0.65rem; color: #94A3B8;">${formattedExpRetTime}${l.expected_return_date ? ' (Exp)' : ''}</span>
                          </div>
                        `;
                      }

                      return `
                        <tr class="student-leave-card-row" data-id="${l.id}" style="border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                          <!-- SL No -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; font-size: 0.76rem; font-weight: 700; color: #64748B;">
                            ${idx + 1}
                          </td>

                          <!-- Schedule: Leaving & Arrival stacked in single column -->
                          <td style="padding: 0.6rem 0.35rem; min-width: 0; overflow: hidden;">
                            <div style="font-size: 0.76rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25;">
                              ${leavingDate} <span style="font-size: 0.66rem; font-weight: 600; color: #64748B;">${formattedLeavingTime}</span>
                            </div>
                            ${arrivalLineHtml ? `<div style="margin-top: 2px;">${arrivalLineHtml}</div>` : ''}
                          </td>

                          <!-- Status (16% equal width, center) -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; white-space: nowrap;">
                            ${statusBadgeHtml}
                          </td>

                          <!-- Fine (16% equal width, center) -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; font-size: 0.76rem; white-space: nowrap;">
                            ${fineDisplay}
                          </td>

                          <!-- F.Paid (16% equal width, center) -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; font-size: 0.85rem; white-space: nowrap;">
                            ${finePaidDisplay}
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

      // Attach event listeners
      attachModuleEvents();
    }

    function attachModuleEvents() {
      const searchInput = container.querySelector('#leave-card-search-input');
      const studentDropdown = container.querySelector('#leave-card-student-dropdown');
      const genderSelect = container.querySelector('#leave-card-gender-filter');
      const statusSelect = container.querySelector('#leave-card-status-filter');
      const classSelect = container.querySelector('#leave-card-class-filter');

      // Focus on search input reveals dropdown list of students
      searchInput?.addEventListener('focus', () => {
        if (studentDropdown) studentDropdown.style.display = 'block';
      });

      // Typing in search input dynamically filters dropdown items in place
      searchInput?.addEventListener('input', (e) => {
        searchFilter = e.target.value;
        const q = searchFilter.toLowerCase().trim();
        if (studentDropdown) {
          studentDropdown.style.display = 'block';
          const items = studentDropdown.querySelectorAll('.dropdown-student-item');
          items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (!q || text.includes(q)) {
              item.style.display = 'flex';
            } else {
              item.style.display = 'none';
            }
          });
        }
      });

      // Allow pressing Enter in search box to select top visible student
      searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const firstVisible = studentDropdown?.querySelector('.dropdown-student-item:not([style*="display: none"])');
          if (firstVisible) {
            firstVisible.click();
          }
        }
      });

      // Clear search button
      const clearBtn = container.querySelector('#btn-clear-search');
      clearBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        searchFilter = '';
        renderModule();
      });

      // Click on dropdown student item selects student & renders
      studentDropdown?.querySelectorAll('.dropdown-student-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = item.dataset.id;
          selectedStudent = accessibleStudents.find(s => s.id === sid) || selectedStudent;
          if (typeof localStorage !== 'undefined') localStorage.setItem('tps_leave_card_active_student', sid);
          if (studentDropdown) studentDropdown.style.display = 'none';
          searchFilter = '';
          renderModule();
        });
      });

      // Close dropdown when tapping anywhere outside
      const outsideClickHandler = (e) => {
        if (!searchInput?.contains(e.target) && !studentDropdown?.contains(e.target)) {
          if (studentDropdown) studentDropdown.style.display = 'none';
        }
      };
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', outsideClickHandler);
      }

      // Gender Filter dropdown
      genderSelect?.addEventListener('change', () => {
        genderFilter = genderSelect.value;
        renderModule();
      });

      // Status Filter dropdown
      statusSelect?.addEventListener('change', () => {
        statusFilter = statusSelect.value;
        renderModule();
      });

      // Class Filter dropdown
      classSelect?.addEventListener('change', () => {
        classFilter = classSelect.value;
        renderModule();
      });

      // Admin / Mentor Student Select dropdown (backward compatibility)
      const studentSelect = container.querySelector('#leave-card-student-select');
      studentSelect?.addEventListener('change', () => {
        const sid = studentSelect.value;
        selectedStudent = accessibleStudents.find(s => s.id === sid) || selectedStudent;
        if (typeof localStorage !== 'undefined') localStorage.setItem('tps_leave_card_active_student', sid);
        renderModule();
      });

      // Parent child tabs
      container.querySelectorAll('.btn-child-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.childId;
          selectedStudent = accessibleStudents.find(s => s.id === cid) || selectedStudent;
          if (typeof localStorage !== 'undefined') localStorage.setItem('tps_parent_active_child', cid);
          renderModule();
        });
      });

      // Row click popup to view all details and clear fine
      container.querySelectorAll('.student-leave-card-row').forEach(row => {
        row.addEventListener('click', () => {
          const leaveId = row.dataset.id;
          openLeaveCardRowPopup(leaveId);
        });
      });
    }

    // ROW CLICK POPUP: Full details & Admin/Mentor Fine Clearing
    function openLeaveCardRowPopup(leaveId) {
      const leave = allLeaves.find(l => l.id === leaveId);
      if (!leave) return;

      const studentEntry = Array.isArray(leave.students) ? leave.students.find(e => e.student_id === selectedStudent?.id) : null;
      const fineAmt = Number(studentEntry?.fine_amount !== undefined ? studentEntry.fine_amount : leave.calculated_fine) || 0;
      const isPaid = (studentEntry?.fine_status ? studentEntry.fine_status === 'paid' : leave.fine_status === 'paid');
      const isPartial = (studentEntry?.fine_status ? studentEntry.fine_status === 'partial' : leave.fine_status === 'partial');
      const isRej = (leave.status || '').toLowerCase() === 'rejected';
      const isPend = (leave.status || '').toLowerCase() === 'pending';

      const actualRetDate = studentEntry?.actual_return_date || leave.actual_return_date || (leave.status === 'Returned' ? (leave.actual_return_date || leave.expected_return_date) : null);
      const actualRetTime = studentEntry?.actual_return_time || leave.actual_return_time || (leave.status === 'Returned' ? (leave.actual_return_time || leave.expected_return_time) : null);

      const studentName = selectedStudent?.full_name || leave.student_name || 'Student';
      const admNo = selectedStudent?.admission_number || 'TPS-ADM';

      const { container: modalBody, close } = openModal({
        title: `Leave Pass #${leave.leave_code || leave.leave_register_number || 'Pass'}`,
        size: 'md',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <!-- Student Mini Banner -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 0.85rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div style="width: 42px; height: 42px; border-radius: 10px; overflow: hidden; background: #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #475569;">
                  ${selectedStudent?.photo_url ? `<img src="${selectedStudent.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" />` : (studentName.charAt(0) || 'S')}
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 0.95rem; color: #0F172A;">${studentName}</div>
                  <div style="font-size: 0.74rem; color: #64748B;">${admNo} • Class ${selectedStudent?.school_class || '-'}</div>
                </div>
              </div>
              <span class="badge" style="background: #E2E8F0; color: #334155; font-size: 0.74rem; padding: 3px 8px; border-radius: 6px; font-weight: 700; text-transform: capitalize;">
                ${(leave.leave_type || 'Hostel Leave').replace(/_/g, ' ')}
              </span>
            </div>

            <!-- Rejection Notice if rejected -->
            ${isRej ? `
              <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.75rem; color: #991B1B; font-size: 0.82rem;">
                <div style="font-weight: 800; display: flex; align-items: center; gap: 4px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  Leave Request Rejected
                </div>
                <div style="margin-top: 3px;"><strong>Reason:</strong> ${leave.rejected_reason || 'Administrative grounds'}</div>
                ${leave.rejected_by ? `<div style="font-size: 0.74rem; color: #B91C1C; margin-top: 2px;">Reviewed by: ${leave.rejected_by}</div>` : ''}
              </div>
            ` : ''}

            <!-- Transit Specs Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem;">
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Departure Date & Time</span>
                <div style="font-weight: 700; color: #0F172A; margin-top: 2px;">${leave.departure_date || leave.leaving_date || '-'} at ${leave.departure_time || leave.leaving_time || '16:00'}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Scheduled Return</span>
                <div style="font-weight: 700; color: #0F172A; margin-top: 2px;">${leave.expected_return_date || '-'} at ${leave.expected_return_time || '18:00'}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Actual Return Date</span>
                <div style="font-weight: 700; color: #059669; margin-top: 2px;">${actualRetDate || 'Not Returned Yet'}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Actual Return Time</span>
                <div style="font-weight: 700; color: #059669; margin-top: 2px;">${actualRetTime || '-'}</div>
              </div>
              <div style="grid-column: span 2;">
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Reason for Leave</span>
                <div style="color: #1E293B; margin-top: 2px;">${leave.reason || 'General leave'}</div>
              </div>
              ${leave.escort_name ? `
                <div style="grid-column: span 2;">
                  <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Authorized Escort</span>
                  <div style="color: #1E293B; margin-top: 2px;">${leave.escort_name} (${leave.escort_relation || 'Parent'}) • Tel: ${leave.escort_phone || leave.parent_phone || 'N/A'}</div>
                </div>
              ` : ''}
              ${leave.return_remarks ? `
                <div style="grid-column: span 2;">
                  <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Return Remarks / Health</span>
                  <div style="color: #1E293B; margin-top: 2px;">${leave.return_remarks}</div>
                </div>
              ` : ''}
            </div>

            <!-- Fine Assessment & Payment Status Card -->
            <div style="background: ${fineAmt > 0 ? (isPaid ? '#ECFDF5' : '#FFF1F2') : '#F8FAFC'}; border: 1.5px solid ${fineAmt > 0 ? (isPaid ? '#A7F3D0' : '#FECDD3') : '#E2E8F0'}; border-radius: 12px; padding: 0.85rem; font-size: 0.82rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-weight: 700; color: ${fineAmt > 0 ? (isPaid ? '#065F46' : '#9F1239') : '#334155'}; font-size: 0.85rem;">
                  Late Fine Breakdown
                </span>
                <span style="font-size: 1.1rem; font-weight: 800; color: ${fineAmt > 0 ? (isPaid ? '#059669' : '#DC2626') : '#64748B'};">
                  ${fineAmt > 0 ? `₹${fineAmt.toFixed(2)}` : '₹0.00 (No Fine)'}
                </span>
              </div>
              
              ${fineAmt > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem; font-size: 0.78rem;">
                  <span style="color: #64748B;">Settlement Status:</span>
                  ${isPaid ? `
                    <span style="color: #059669; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                      ✓ Paid ${studentEntry?.fine_paid_at || leave.fine_paid_at ? `on ${(studentEntry?.fine_paid_at || leave.fine_paid_at).split('T')[0]}` : ''} ${leave.fine_cleared_by ? `(Cleared by: ${leave.fine_cleared_by})` : ''}
                    </span>
                  ` : isPartial ? `
                    <span style="color: #D97706; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                      ⚠️ Partially Paid: ₹${studentEntry?.fine_paid_amount || leave.fine_paid_amount || 0} • Due: ₹${studentEntry?.fine_remaining_amount || leave.fine_remaining_amount || (fineAmt - (studentEntry?.fine_paid_amount || leave.fine_paid_amount || 0))}
                    </span>
                  ` : `
                    <span style="color: #DC2626; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                      ✗ Unpaid Outstanding
                    </span>
                  `}
                </div>
              ` : `
                <div style="color: #64748B; font-size: 0.76rem;">Student reported safely on time without delay.</div>
              `}
            </div>

            <!-- Actions Footer -->
            <div style="display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem; align-items: center; flex-wrap: wrap;">
              ${isMentor ? `
                <button type="button" class="btn btn-xs btn-outline-danger" id="btn-popup-delete-leave" style="color: #DC2626; border-color: #FCA5A5; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; padding: 0.35rem 0.65rem; border-radius: 8px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Delete Leave Record
                </button>
              ` : '<div></div>'}

              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button type="button" class="btn btn-outline" id="btn-popup-close">Close</button>
                
                <!-- CLEAR FINE BUTTON (ONLY FOR ADMIN & MENTOR IF UNPAID FINE EXISTS) -->
                ${fineAmt > 0 && !isPaid && isMentor ? `
                  <button type="button" class="btn btn-primary" id="btn-popup-clear-fine" style="background: #059669; border-color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ${isPartial ? `Clear Remaining Due (₹${studentEntry?.fine_remaining_amount || leave.fine_remaining_amount || (fineAmt - (studentEntry?.fine_paid_amount || leave.fine_paid_amount || 0))})` : `Clear / Mark Fine Paid (₹${fineAmt})`}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `
      });

      modalBody.querySelector('#btn-popup-close')?.addEventListener('click', close);

      modalBody.querySelector('#btn-popup-delete-leave')?.addEventListener('click', () => {
        close();
        const code = leave.leave_code || leave.leave_register_number || 'Pass';
        const { container: deleteModal, close: closeDeleteModal } = openModal({
          title: `Delete Leave Record - ${code}`,
          size: 'sm',
          contentHtml: `
            <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
              <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.85rem; color: #991B1B;">
                <div style="font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  Permanent Data Deletion
                </div>
                <p style="font-size: 0.82rem; margin: 0.4rem 0 0; line-height: 1.45; color: #7F1D1D;">
                  Are you sure you want to permanently delete this leave file (<strong>${code}</strong>)?
                </p>
                <p style="font-size: 0.76rem; margin: 0.35rem 0 0; color: #991B1B;">
                  This will completely wipe all leave dates, arrival records, and associated fines from the entire database.
                </p>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                <button type="button" class="btn btn-outline" id="btn-cancel-del-card">Cancel</button>
                <button type="button" class="btn btn-danger" id="btn-confirm-del-card" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF;">
                  Delete Permanently
                </button>
              </div>
            </div>
          `
        });

        deleteModal?.querySelector('#btn-cancel-del-card')?.addEventListener('click', closeDeleteModal);
        deleteModal?.querySelector('#btn-confirm-del-card')?.addEventListener('click', async () => {
          closeDeleteModal();
          try {
            await db.deleteLeaveRecord(leave.id);
            toast.success(`Leave #${code} wiped permanently.`);
            const updatedLeaves = await db.getLeaves(true);
            allLeaves.length = 0;
            allLeaves.push(...updatedLeaves);
            renderModule();
          } catch (err) {
            if (err.message && err.message.toLowerCase().includes('not found')) {
              const updatedLeaves = await db.getLeaves(true);
              allLeaves.length = 0;
              allLeaves.push(...updatedLeaves);
              renderModule();
              return;
            }
            toast.error(err.message || 'Error deleting leave record');
          }
        });
      });

      // Wire Clear Fine button
      modalBody.querySelector('#btn-popup-clear-fine')?.addEventListener('click', async () => {
        try {
          const clearAmt = isPartial ? Number(studentEntry?.fine_remaining_amount || leave.fine_remaining_amount || (fineAmt - (studentEntry?.fine_paid_amount || leave.fine_paid_amount || 0))) : fineAmt;
          await db.recordFinePayment(leave.id, clearAmt, 'Cash', 'Cleared via Student Leave Card', user?.full_name || 'Hostel Administrator', selectedStudent?.id);
          toast.success(`Fine of ₹${fineAmt} successfully marked as paid!`);
          close();

          // Refresh leaves from DB and re-render
          const updatedLeaves = await db.getLeaves(true);
          allLeaves.length = 0;
          allLeaves.push(...updatedLeaves);
          renderModule();
        } catch (err) {
          toast.error(err.message || 'Failed to clear fine');
        }
      });
    }

    // Initial render
    renderModule();

  } catch (err) {
    console.error('Error loading Student Leave Card:', err);
    container.innerHTML = `
      <div class="alert alert-danger" style="margin: 1.5rem 0; padding: 1rem 1.25rem; border-radius: 12px;">
        <strong>Error loading Student Leave Card:</strong> ${err.message || 'Unknown error'}
      </div>
    `;
  }
}
