import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { formatDate, formatCurrency, printDocument } from '../../lib/utils.js';
import { getMentorGenderScope, isMentorRole } from '../../lib/permissions.js';

export function renderFineStatusBadge(d) {
  const totalFine = Number(d.monetary_fine) || 0;
  if (totalFine <= 0) return '<span style="font-size:0.72rem;color:#64748B;font-weight:600;">No Property Fine</span>';
  
  const paid = Number(d.fine_paid_amount) || 0;
  const remaining = d.fine_remaining_amount != null 
    ? Number(d.fine_remaining_amount) 
    : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, totalFine - paid));
  
  if (d.fine_payment_status === 'paid' || remaining <= 0) {
    return `<span style="font-size:0.72rem;font-weight:700;color:#047857;background:#ECFDF5;padding:2px 8px;border-radius:6px;border:1px solid #A7F3D0;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">
      ✓ Fine Paid (₹${totalFine.toFixed(2)})
    </span>`;
  }
  if (d.fine_payment_status === 'partial' || paid > 0) {
    return `<span style="font-size:0.72rem;font-weight:700;color:#B45309;background:#FFFBEB;padding:2px 8px;border-radius:6px;border:1px solid #FDE68A;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">
      ⚠️ Partial: ₹${paid.toFixed(2)} Paid • ₹${remaining.toFixed(2)} Due
    </span>`;
  }
  return `<span style="font-size:0.75rem;font-weight:700;color:#DC2626;background:#FEF2F2;padding:2px 7px;border-radius:6px;border:1px solid #FCA5A5;white-space:nowrap;">
    Fine: ₹${totalFine.toFixed(2)}
  </span>`;
}

export async function renderStudentDisciplineCardModule(container, options = {}) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 280px;">
      <div class="loading-spinner" style="width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #DC2626; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    </div>
  `;

  try {
    const user = getCurrentUser();
    const isSuperAdmin = user?.is_super_admin === true;
    const role = user?.role || 'admin';
    const isMentor = isMentorRole(role);
    const mentorGender = isMentor ? getMentorGenderScope(user) : null;
    const canManage = Boolean(isSuperAdmin || role === 'admin' || isMentor);
    const isParent = role === 'parent';

    // 1. Fetch Students, Discipline records, and Fine Payments
    const [allStudents, allIncidents, allPayments] = await Promise.all([
      db.getStudents(),
      db.getDisciplineIncidents(),
      db.getDisciplineFinePayments()
    ]);

    // Role-based student accessibility
    let accessibleStudents = [...(allStudents || [])];
    if (mentorGender) {
      accessibleStudents = accessibleStudents.filter(s => (s.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase());
    } else if (isParent) {
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

        if (accessibleStudents.length === 0 && (user?.is_dev_profile || !user?.id || user?.role === 'parent')) {
          accessibleStudents = (allStudents || []).slice(0, 2);
        }
      }
    }

    // Determine initial selected student
    const defaultStudentId = options.studentId || (typeof localStorage !== 'undefined' ? localStorage.getItem('tps_discipline_card_active_student') : null);
    let selectedStudent = accessibleStudents.find(s => s.id === defaultStudentId) || accessibleStudents[0] || null;

    // Filters state
    let searchFilter = '';
    let classFilter = 'all';
    let genderFilter = mentorGender ? (mentorGender.toLowerCase().startsWith('b') ? 'Male' : 'Female') : 'all';
    let standingFilter = 'all';

    // Unique classes for filter dropdown
    const uniqueClasses = Array.from(new Set(accessibleStudents.map(s => s.school_class || s.class_name).filter(Boolean))).sort();

    function getStudentIncidents(studentId) {
      if (!studentId) return [];
      return (allIncidents || []).filter(d => d.student_id === studentId)
        .sort((a, b) => new Date(b.incident_date || b.created_at || 0) - new Date(a.incident_date || a.created_at || 0));
    }

    function renderModule() {
      // Filter accessible students for dropdown picker
      const filteredPickerStudents = accessibleStudents.filter(s => {
        if (genderFilter !== 'all') {
          const g = (s.gender || '').toLowerCase();
          if (genderFilter === 'Male' && !g.startsWith('b') && !g.startsWith('m')) return false;
          if (genderFilter === 'Female' && !g.startsWith('g') && !g.startsWith('f')) return false;
        }
        if (classFilter !== 'all') {
          const c = s.school_class || s.class_name;
          if (c !== classFilter) return false;
        }
        if (searchFilter) {
          const q = searchFilter.toLowerCase().trim();
          const name = (s.full_name || '').toLowerCase();
          const adm = (s.admission_number || '').toLowerCase();
          const phone = (s.father_phone || s.mother_phone || '').toLowerCase();
          if (!name.includes(q) && !adm.includes(q) && !phone.includes(q)) return false;
        }
        return true;
      });

      // If selectedStudent is filtered out or null, pick first available
      if (!selectedStudent || (!isParent && !filteredPickerStudents.some(s => s.id === selectedStudent.id))) {
        selectedStudent = filteredPickerStudents[0] || accessibleStudents[0] || null;
      }

      // Misconduct records for selected student
      const studentIncidents = selectedStudent ? getStudentIncidents(selectedStudent.id) : [];
      const totalMarks = studentIncidents.reduce((sum, d) => sum + (Number(d.black_marks_awarded) || 0), 0);
      const totalFineAssessed = studentIncidents.reduce((sum, d) => sum + (Number(d.monetary_fine) || 0), 0);
      const totalFinePaid = studentIncidents.reduce((sum, d) => sum + (Number(d.fine_paid_amount) || (d.fine_payment_status === 'paid' ? Number(d.monetary_fine) || 0 : 0)), 0);
      const totalBalanceDue = Math.max(0, totalFineAssessed - totalFinePaid);
      const openIncidentsCount = studentIncidents.filter(d => (d.resolution_status || 'Open').toLowerCase() === 'open').length;

      container.innerHTML = `
        <div class="discipline-card-container" style="max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; width: 100%;">
          
          <!-- NAVIGATION SUB-TABS: Switch between Student Card and Incident Register -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 0.5rem 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: inline-flex; background: #F1F5F9; border-radius: 10px; padding: 4px; gap: 4px;">
              <button type="button" id="tab-stay-card" style="padding: 0.4rem 0.95rem; font-size: 0.82rem; font-weight: 800; border-radius: 8px; border: none; cursor: default; background: #FFFFFF; color: #DC2626; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: inline-flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="20" height="14" x="2" y="5" rx="2"></rect><circle cx="8" cy="12" r="2.5"></circle><path d="M14 10h4"></path><path d="M14 14h3"></path></svg>
                Student Discipline Card
              </button>
              <button type="button" id="tab-goto-register" style="padding: 0.4rem 0.95rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; background: transparent; color: #64748B; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Incident Register
              </button>
            </div>

            ${canManage && selectedStudent ? `
              <button type="button" class="btn btn-sm btn-primary" id="btn-quick-log-student" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.75rem; border-radius: 8px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Record Incident for ${selectedStudent.full_name.split(' ')[0]}
              </button>
            ` : ''}
          </div>

          <!-- Module Header & Filter Toolbar (EXACT MATCHING STUDENT LEAVE CARD DESIGN) -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: ${!isParent ? '0.75rem' : '0'};">
              <div>
                <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 8px;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                    <circle cx="8" cy="12" r="2.5"></circle>
                    <path d="M14 10h4"></path>
                    <path d="M14 14h3"></path>
                  </svg>
                  Student Discipline Card
                </h2>
                <p style="font-size: 0.8rem; color: #64748B; margin: 2px 0 0;">
                  Official student misconduct log, black marks ledger, fine settlements, and clearance records
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

            <!-- Admin & Mentor Filters Toolbar -->
            ${!isParent ? `
              <div class="student-filter-capsule" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 0.65rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.65rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); position: relative;">
                <!-- Row 1: Dropdown filters first -->
                <div class="capsule-filters" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; width: 100%;">
                  <!-- Gender Filter Dropdown -->
                  <select id="disc-card-gender-filter" style="border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 0.78rem; font-weight: 600; padding: 0.45rem 0.45rem; border-radius: 8px; cursor: pointer; outline: none; width: 100%; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                    ${mentorGender ? (mentorGender.toLowerCase().startsWith('g') ? `<option value="Female" selected>Female</option>` : `<option value="Male" selected>Male</option>`) : `
                      <option value="all" ${genderFilter === 'all' ? 'selected' : ''}>All</option>
                      <option value="Male" ${genderFilter === 'Male' ? 'selected' : ''}>Male</option>
                      <option value="Female" ${genderFilter === 'Female' ? 'selected' : ''}>Female</option>
                    `}
                  </select>

                  <!-- Standing / Status Filter Dropdown -->
                  <select id="disc-card-status-filter" style="border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 0.78rem; font-weight: 600; padding: 0.45rem 0.45rem; border-radius: 8px; cursor: pointer; outline: none; width: 100%; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                    <option value="all" ${standingFilter === 'all' ? 'selected' : ''}>All Records</option>
                    <option value="marks" ${standingFilter === 'marks' ? 'selected' : ''}>Has Black Marks</option>
                    <option value="fine_due" ${standingFilter === 'fine_due' ? 'selected' : ''}>Fine Balance Due</option>
                    <option value="resolved" ${standingFilter === 'resolved' ? 'selected' : ''}>Fully Resolved</option>
                    <option value="clean" ${standingFilter === 'clean' ? 'selected' : ''}>Clean Record</option>
                  </select>

                  <!-- Class Filter Dropdown -->
                  <select id="disc-card-class-filter" style="border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 0.78rem; font-weight: 600; padding: 0.45rem 0.45rem; border-radius: 8px; cursor: pointer; outline: none; width: 100%; box-sizing: border-box; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
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
                      id="disc-card-search-input" 
                      placeholder="Search student by name, ID, phone..." 
                      value="${searchFilter}" 
                      style="border: none; background: transparent; width: 100%; font-size: 0.85rem; color: #1E293B; outline: none; padding: 0;"
                      autocomplete="off"
                    />
                    ${searchFilter ? `
                      <button type="button" id="btn-clear-disc-search" style="border: none; background: transparent; color: #94A3B8; cursor: pointer; padding: 0 4px; font-size: 0.95rem; line-height: 1;" title="Clear search">✕</button>
                    ` : ''}
                  </div>

                  <!-- Dropdown List of Matching Students (Shows ONLY Name and Class, No Extra Clutter) -->
                  <div id="disc-card-student-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #FFFFFF; border: 1.5px solid #DC2626; border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08); max-height: 240px; overflow-y: auto; z-index: 1000;">
                    ${filteredPickerStudents.length === 0 ? `
                      <div style="padding: 0.75rem 1rem; font-size: 0.8rem; color: #94A3B8; text-align: center;">
                        No student found matching criteria
                      </div>
                    ` : filteredPickerStudents.map(s => `
                      <div class="dropdown-student-item" data-id="${s.id}" style="padding: 0.65rem 0.9rem; border-bottom: 1px solid #F1F5F9; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; transition: background 0.15s ease; ${s.id === selectedStudent?.id ? 'background: #FEF2F2;' : ''}">
                        <div style="min-width: 0;">
                          <span style="font-weight: 700; font-size: 0.86rem; color: #0F172A;">${s.full_name}</span>
                          <span style="font-size: 0.74rem; color: #64748B; margin-left: 6px;">Class ${s.school_class || s.class_name || '-'}</span>
                        </div>
                        ${s.id === selectedStudent?.id ? '<span style="color: #DC2626; font-weight: 800; font-size: 0.85rem;">✓</span>' : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- TOP STUDENT DETAILS CARD (EXACT MATCHING STUDENT LEAVE CARD DESIGN) -->
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
                      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #DC2626; font-size: 1.2rem; background: #FEF2F2;">
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
                      <span class="badge" style="background: #FEF2F2; color: #DC2626; font-weight: 700; font-size: 0.72rem; padding: 2px 7px; border-radius: 6px; font-family: monospace;">
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

              <!-- Center-Aligned Conduct Standing Pill -->
              <div style="display: flex; justify-content: center; align-items: center; padding-top: 0.45rem; border-top: 1px solid #F1F5F9; width: 100%;">
                ${totalMarks > 0 ? `
                  <span class="badge" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; font-weight: 800; font-size: 0.8rem; padding: 4px 14px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(220,38,38,0.1);">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #DC2626; display: inline-block;"></span>
                    +${totalMarks} Active Black Mark(s) ${totalBalanceDue > 0 ? `• Due: ₹${totalBalanceDue.toFixed(2)}` : ''}
                  </span>
                ` : `
                  <span class="badge" style="background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; font-weight: 800; font-size: 0.8rem; padding: 4px 14px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(16,185,129,0.1);">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
                    Clean Conduct Standing ${totalBalanceDue > 0 ? `• Due: ₹${totalBalanceDue.toFixed(2)}` : ''}
                  </span>
                `}
              </div>
            </div>
          ` : `
            <div style="background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 14px; padding: 1.5rem; text-align: center; color: #64748B;">
              No student found matching filter criteria.
            </div>
          `}

          <!-- UNDER STUDENT DATA: DISCIPLINE & INCIDENT TABLE (EXACT MATCHING STUDENT LEAVE CARD TABLE) -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
            <div style="padding: 0.85rem 1.15rem; background: #DC2626; display: flex; align-items: center; justify-content: center; text-align: center;">
              <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #FFFFFF; letter-spacing: 0.01em;">
                Discipline & Incident Register History
              </h4>
            </div>

            ${studentIncidents.length === 0 ? `
              <div style="padding: 2.5rem; text-align: center; color: #94A3B8;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.8" style="margin-bottom: 0.5rem;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <div style="font-weight: 700; color: #475569; font-size: 0.95rem;">No misconduct incidents recorded</div>
                <p style="font-size: 0.8rem; margin: 0.25rem 0 0; color: #94A3B8;">This student maintains an exemplary record with zero active black marks and zero damage fines.</p>
              </div>
            ` : `
              <div class="table-responsive" style="overflow-x: hidden; width: 100%;">
                <table class="data-table student-discipline-card-table" style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 7%; text-align: center;">SL</th>
                      <th style="padding: 0.65rem 0.35rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 45%;">Violation & Date</th>
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 14%; text-align: center;">Marks</th>
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 17%; text-align: center;">Fine</th>
                      <th style="padding: 0.65rem 0.25rem; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; width: 17%; text-align: center;">F.Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${studentIncidents.map((d, idx) => {
                      const fineAmt = Number(d.monetary_fine) || 0;
                      const paidAmt = Number(d.fine_paid_amount) || 0;
                      const remainingAmt = d.fine_remaining_amount != null ? Number(d.fine_remaining_amount) : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, fineAmt - paidAmt));
                      const isPaid = fineAmt > 0 ? (d.fine_payment_status === 'paid' || remainingAmt <= 0) : false;
                      const isPartial = fineAmt > 0 && !isPaid && (paidAmt > 0 || d.fine_payment_status === 'partial');

                      // Fine amount column
                      const fineDisplay = (fineAmt > 0) 
                        ? `<span style="font-weight: 800; font-family: monospace; color: #DC2626; font-size: 0.76rem;">₹${fineAmt}</span>` 
                        : `<span style="color: #94A3B8; font-size: 0.76rem;">-</span>`;

                      // Fine paid status column (Clean tick ✓, partial ½, or cross ✕ icon)
                      let finePaidDisplay = '<span style="color: #94A3B8; font-size: 0.76rem;">-</span>';
                      if (fineAmt > 0) {
                        if (isPaid) {
                          finePaidDisplay = `
                            <span style="color: #059669; font-weight: 900; font-size: 0.95rem; line-height: 1;" title="Fully Paid">✓</span>
                          `;
                        } else if (isPartial) {
                          finePaidDisplay = `
                            <span style="color: #D97706; font-weight: 900; font-size: 0.76rem; line-height: 1; background: #FEF3C7; padding: 2px 4px; border-radius: 4px;" title="Partially Paid: ₹${paidAmt}">½</span>
                          `;
                        } else {
                          finePaidDisplay = `
                            <span style="color: #DC2626; font-weight: 900; font-size: 0.88rem; line-height: 1;" title="Unpaid">✕</span>
                          `;
                        }
                      }

                      // Marks badge
                      const marksDisplay = Number(d.black_marks_awarded) > 0
                        ? `<span class="badge badge-black-mark" style="font-size: 0.72rem; padding: 2px 6px; font-weight: 800; background: #FEE2E2; color: #DC2626; border-radius: 9999px;">+${d.black_marks_awarded}</span>`
                        : `<span style="color: #94A3B8; font-size: 0.76rem;">0</span>`;

                      return `
                        <tr class="student-disc-card-row" data-id="${d.id}" style="border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                          <!-- SL No -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; font-size: 0.76rem; font-weight: 700; color: #64748B;">
                            ${idx + 1}
                          </td>

                          <!-- Violation & Date stacked in single column -->
                          <td style="padding: 0.6rem 0.35rem; min-width: 0; overflow: hidden;">
                            <div style="font-size: 0.76rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25;">
                              ${d.category}
                            </div>
                            <div style="font-size: 0.71rem; color: #64748B; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                              ${formatDate(d.incident_date)} <span style="font-size: 0.65rem; color: #94A3B8;">(${d.severity})</span>
                            </div>
                          </td>

                          <!-- Marks (14% equal width, center) -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; white-space: nowrap;">
                            ${marksDisplay}
                          </td>

                          <!-- Fine (17% equal width, center) -->
                          <td style="padding: 0.6rem 0.25rem; text-align: center; font-size: 0.76rem; white-space: nowrap;">
                            ${fineDisplay}
                          </td>

                          <!-- F.Paid (17% equal width, center) -->
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

      attachModuleEvents();
    }

    function attachModuleEvents() {
      // Switch back to register
      container.querySelector('#tab-goto-register')?.addEventListener('click', () => {
        if (options.onNavigate) {
          options.onNavigate('register');
        } else if (typeof window !== 'undefined' && window.location) {
          window.location.hash = '#discipline';
        }
      });

      // Quick log incident
      container.querySelector('#btn-quick-log-student')?.addEventListener('click', () => {
        if (selectedStudent) openRecordIncidentForStudentModal(selectedStudent);
      });

      // Search input & Dropdown
      const searchInput = container.querySelector('#disc-card-search-input');
      const studentDropdown = container.querySelector('#disc-card-student-dropdown');
      const genderSelect = container.querySelector('#disc-card-gender-filter');
      const statusSelect = container.querySelector('#disc-card-status-filter');
      const classSelect = container.querySelector('#disc-card-class-filter');

      searchInput?.addEventListener('focus', () => {
        if (studentDropdown) studentDropdown.style.display = 'block';
      });

      searchInput?.addEventListener('input', (e) => {
        searchFilter = e.target.value;
        const q = searchFilter.toLowerCase().trim();
        if (studentDropdown) {
          studentDropdown.style.display = 'block';
          const items = studentDropdown.querySelectorAll('.dropdown-student-item');
          items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
          });
        }
      });

      container.querySelector('#btn-clear-disc-search')?.addEventListener('click', (e) => {
        e.stopPropagation();
        searchFilter = '';
        renderModule();
      });

      studentDropdown?.querySelectorAll('.dropdown-student-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = item.dataset.id;
          selectedStudent = accessibleStudents.find(s => s.id === sid) || selectedStudent;
          if (typeof localStorage !== 'undefined') localStorage.setItem('tps_discipline_card_active_student', sid);
          if (studentDropdown) studentDropdown.style.display = 'none';
          searchFilter = '';
          renderModule();
        });
      });

      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        const handleOutsideClick = (e) => {
          if (studentDropdown && !studentDropdown.contains(e.target) && searchInput && !searchInput.contains(e.target)) {
            studentDropdown.style.display = 'none';
          }
        };
        document.removeEventListener('click', container._outsideClickHandler);
        container._outsideClickHandler = handleOutsideClick;
        document.addEventListener('click', handleOutsideClick);
      }

      genderSelect?.addEventListener('change', () => {
        genderFilter = genderSelect.value;
        renderModule();
      });

      statusSelect?.addEventListener('change', () => {
        standingFilter = statusSelect.value;
        renderModule();
      });

      classSelect?.addEventListener('change', () => {
        classFilter = classSelect.value;
        renderModule();
      });

      // Row click popup to view incident details & settle fine
      container.querySelectorAll('.student-disc-card-row').forEach(row => {
        row.addEventListener('click', () => {
          const incId = row.dataset.id;
          openIncidentCardRowPopup(incId);
        });
      });
    }

    // -------------------------------------------------------------
    // ROW CLICK POPUP: Full Incident Details, Partial Fine Settlement & Receipt
    // -------------------------------------------------------------
    function openIncidentCardRowPopup(incidentId) {
      const d = allIncidents.find(i => i.id === incidentId);
      if (!d) return;

      const student = allStudents.find(s => s.id === d.student_id);
      const studentName = student?.full_name || 'Student';
      const admNo = student?.admission_number || 'TPS-ADM';

      const totalFine = Number(d.monetary_fine) || 0;
      const alreadyPaid = Number(d.fine_paid_amount) || (d.fine_payment_status === 'paid' ? totalFine : 0);
      const remainingAmt = d.fine_remaining_amount != null 
        ? Number(d.fine_remaining_amount) 
        : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, totalFine - alreadyPaid));
      const isPaid = totalFine > 0 ? (remainingAmt <= 0 || d.fine_payment_status === 'paid') : false;
      const isPartial = totalFine > 0 && !isPaid && (alreadyPaid > 0 || d.fine_payment_status === 'partial');
      const isRes = (d.resolution_status || '').toLowerCase() === 'resolved';

      const paymentsForIncident = allPayments.filter(p => p.incident_id === d.id);

      const { container: modalBody, close } = openModal({
        title: `Misconduct Incident — ${d.category}`,
        size: 'md',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <!-- Student Mini Banner -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 0.85rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div style="width: 42px; height: 42px; border-radius: 10px; overflow: hidden; background: #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #475569;">
                  ${student?.photo_url ? `<img src="${student.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" />` : (studentName.charAt(0) || 'S')}
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 0.95rem; color: #0F172A;">${studentName}</div>
                  <div style="font-size: 0.74rem; color: #64748B;">${admNo} • Class ${student?.school_class || '-'}</div>
                </div>
              </div>
              <span class="badge" style="background: ${isRes ? '#ECFDF5' : '#FFFBEB'}; color: ${isRes ? '#047857' : '#B45309'}; border: 1px solid ${isRes ? '#A7F3D0' : '#FDE68A'}; font-size: 0.74rem; padding: 3px 8px; border-radius: 6px; font-weight: 700;">
                ${d.resolution_status || 'Open'}
              </span>
            </div>

            <!-- Incident Specs Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem;">
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Violation Category</span>
                <div style="font-weight: 700; color: #0F172A; margin-top: 2px;">${d.category}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Incident Date</span>
                <div style="font-weight: 700; color: #0F172A; margin-top: 2px;">${formatDate(d.incident_date)}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Severity Level</span>
                <div style="font-weight: 700; color: #0F172A; margin-top: 2px;">${d.severity}</div>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Reported By</span>
                <div style="font-weight: 700; color: #0F172A; margin-top: 2px;">${d.reported_by || 'Hostel Staff'}</div>
              </div>
              <div style="grid-column: span 2;">
                <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Black Marks Imposed</span>
                <div style="font-weight: 800; color: #DC2626; margin-top: 2px;">+${d.black_marks_awarded} Mark(s)</div>
              </div>
              ${d.description ? `
                <div style="grid-column: span 2;">
                  <span style="color: #64748B; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Circumstances / Notes</span>
                  <div style="color: #1E293B; margin-top: 2px; line-height: 1.45;">${d.description}</div>
                </div>
              ` : ''}
              ${d.resolution_notes ? `
                <div style="grid-column: span 2; background: #F0FDF4; padding: 6px 10px; border-radius: 6px; border: 1px solid #BBF7D0;">
                  <span style="color: #047857; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Resolution Notes:</span>
                  <div style="color: #065F46; margin-top: 2px;">${d.resolution_notes}</div>
                </div>
              ` : ''}
            </div>

            <!-- Fine Assessment & Payment Status Card -->
            <div style="background: ${totalFine > 0 ? (isPaid ? '#ECFDF5' : (isPartial ? '#FFFBEB' : '#FFF1F2')) : '#F8FAFC'}; border: 1.5px solid ${totalFine > 0 ? (isPaid ? '#A7F3D0' : (isPartial ? '#FCD34D' : '#FECDD3')) : '#E2E8F0'}; border-radius: 12px; padding: 0.85rem; font-size: 0.82rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-weight: 700; color: ${totalFine > 0 ? (isPaid ? '#065F46' : (isPartial ? '#92400E' : '#9F1239')) : '#334155'}; font-size: 0.85rem;">
                  Property Damage / Violation Fine
                </span>
                <span style="font-size: 1.1rem; font-weight: 800; color: ${totalFine > 0 ? (isPaid ? '#059669' : (isPartial ? '#D97706' : '#DC2626')) : '#64748B'};">
                  ${totalFine > 0 ? `₹${totalFine.toFixed(2)}` : '₹0.00 (No Fine)'}
                </span>
              </div>
              
              ${totalFine > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem; font-size: 0.78rem;">
                  <span style="color: #64748B;">Settlement Status:</span>
                  ${isPaid ? `
                    <span style="color: #059669; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                      ✓ Fully Settled (₹${totalFine.toFixed(2)}) ${d.fine_paid_by ? `• By: ${d.fine_paid_by}` : ''}
                    </span>
                  ` : isPartial ? `
                    <span style="color: #D97706; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                      ⚠️ Partially Paid: ₹${alreadyPaid.toFixed(2)} • Due: ₹${remainingAmt.toFixed(2)}
                    </span>
                  ` : `
                    <span style="color: #DC2626; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                      ✕ Unpaid Outstanding (₹${remainingAmt.toFixed(2)})
                    </span>
                  `}
                </div>
              ` : `
                <div style="color: #64748B; font-size: 0.76rem;">No monetary penalty assessed for this infraction.</div>
              `}

              ${paymentsForIncident.length > 0 ? `
                <div style="margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px dashed #CBD5E1; font-size: 0.75rem; color: #475569;">
                  <div style="font-weight: 700; margin-bottom: 0.25rem; color: #334155; display: flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    Payment Clearance Records:
                  </div>
                  ${paymentsForIncident.map(p => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 0;">
                      <span>• ${p.receipt_no || p.receipt_number || 'RCPT'} (${p.payment_method || 'Cash'})${p.received_by ? ` - ${p.received_by}` : ''}:</span>
                      <span style="font-weight: 700; color: #059669;">₹${p.amount} on ${p.payment_date || '-'}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <!-- Actions Footer -->
            <div style="display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem; align-items: center; flex-wrap: wrap;">
              ${canManage ? `
                <button type="button" class="btn btn-xs btn-outline-danger" id="btn-popup-delete-inc" style="color: #DC2626; border-color: #FCA5A5; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; padding: 0.35rem 0.65rem; border-radius: 8px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Delete Incident
                </button>
              ` : '<div></div>'}

              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                ${paymentsForIncident.length > 0 ? `
                  <button type="button" class="btn btn-xs btn-outline" id="btn-popup-view-rcpt" style="color: #047857; border-color: #A7F3D0; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 8px;">
                    Print Receipt
                  </button>
                ` : ''}

                ${canManage && !isRes ? `
                  <button type="button" class="btn btn-xs btn-outline-success" id="btn-popup-resolve-inc" style="color: #059669; border-color: #A7F3D0; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 8px;">
                    Resolve Matter
                  </button>
                ` : ''}

                <button type="button" class="btn btn-outline" id="btn-popup-disc-close">Close</button>
                
                <!-- SETTLE / PAY FINE BUTTON (WITH FULL & PARTIAL CLEARANCE) -->
                ${totalFine > 0 && !isPaid && canManage ? `
                  <button type="button" class="btn btn-primary" id="btn-popup-clear-disc-fine" style="background: #F59E0B; border-color: #F59E0B; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ${isPartial ? `Pay Fine (Due: ₹${remainingAmt.toFixed(2)})` : `Pay Fine (₹${totalFine.toFixed(2)})`}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `
      });

      modalBody.querySelector('#btn-popup-disc-close')?.addEventListener('click', close);

      // Print receipt
      modalBody.querySelector('#btn-popup-view-rcpt')?.addEventListener('click', () => {
        close();
        openReceiptModal(d.id, studentName, student);
      });

      // Resolve incident
      modalBody.querySelector('#btn-popup-resolve-inc')?.addEventListener('click', () => {
        close();
        openResolveIncidentModal(d.id, studentName);
      });

      // Delete incident
      modalBody.querySelector('#btn-popup-delete-inc')?.addEventListener('click', () => {
        close();
        openDeleteIncidentConfirm(d.id, studentName);
      });

      // Settle fine with Partial & Full clearance
      modalBody.querySelector('#btn-popup-clear-disc-fine')?.addEventListener('click', () => {
        close();
        openFineSettlementModal(d.id);
      });
    }

    // -------------------------------------------------------------
    // MODAL: SETTLE FINE WITH PARTIAL / FULL PAYMENT OPTIONS
    // -------------------------------------------------------------
    function openFineSettlementModal(incidentId) {
      const d = allIncidents.find(i => i.id === incidentId);
      if (!d) return;
      const student = allStudents.find(s => s.id === d.student_id);
      const studentName = student?.full_name || 'Student';

      const totalFine = Number(d.monetary_fine) || 0;
      const alreadyPaid = Number(d.fine_paid_amount) || (d.fine_payment_status === 'paid' ? totalFine : 0);
      const remainingAmt = d.fine_remaining_amount != null 
        ? Number(d.fine_remaining_amount) 
        : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, totalFine - alreadyPaid));
      const defaultPartialAmt = Math.max(1, Math.round(remainingAmt / 2));

      const { container: modalBody, close } = openModal({
        title: `Settle Disciplinary Fine — ${studentName}`,
        size: 'sm',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <!-- Fine Summary Card -->
            <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <div style="font-weight: 800; font-size: 0.92rem; color: #0F172A;">${studentName}</div>
                  <div style="font-size: 0.75rem; color: #64748B; margin-top: 1px;">${student?.admission_number || ''} • ${student?.school_class || ''}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 1.25rem; font-weight: 900; color: #DC2626; font-family: monospace;">₹${remainingAmt.toFixed(2)}</div>
                  <div style="font-size: 0.7rem; color: #B45309; font-weight: 700;">CURRENT BALANCE DUE</div>
                </div>
              </div>
              <div style="margin-top: 0.5rem; font-size: 0.76rem; color: #78350F; border-top: 1px dashed #FCD34D; padding-top: 0.4rem; display: flex; justify-content: space-between;">
                <span>Violation: <strong>${d.category}</strong></span>
                <span>Total Fine: <strong>₹${totalFine.toFixed(2)}</strong> (Paid: ₹${alreadyPaid.toFixed(2)})</span>
              </div>
            </div>

            <!-- Payment Option Selection (Full Clearance vs Partial Payment) -->
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Select Payment Option</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <label id="label-settle-full" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #059669; background: #ECFDF5; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #065F46;">
                  <input type="radio" name="settle_payment_mode" value="full" checked style="accent-color: #059669;" />
                  Full Clearance
                </label>
                <label id="label-settle-partial" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #E2E8F0; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #334155;">
                  <input type="radio" name="settle_payment_mode" value="partial" style="accent-color: #D97706;" />
                  Partial Payment
                </label>
              </div>
            </div>

            <!-- Amount Input Field -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Amount Paid Now (₹)</label>
              <input type="number" id="settle-amount" class="form-control" value="${remainingAmt}" min="1" max="${remainingAmt}" step="0.01" style="height: 38px; font-size: 0.95rem; font-weight: 800; color: #0F172A;" />
              <div id="settle-live-bal-status" style="font-size: 0.74rem; font-weight: 700; color: #059669; margin-top: 4px;">
                Remaining balance after payment: <strong>✓ ₹0.00 (Fully Settled)</strong>
              </div>
            </div>

            <!-- Payment Method -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Payment Method</label>
              <select id="settle-method" class="form-control" style="height: 38px; font-size: 0.85rem; font-weight: 600;">
                <option value="Cash">Cash</option>
                <option value="UPI / QR">UPI / QR</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque / DD">Cheque / Demand Draft</option>
              </select>
            </div>

            <!-- Reference / Transaction No -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Reference / Transaction No. (Optional)</label>
              <input type="text" id="settle-ref" class="form-control" placeholder="e.g. UPI Ref: 123456789 or Cheque No." style="height: 38px; font-size: 0.85rem;" />
            </div>

            <!-- Received By -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Received By</label>
              <input type="text" id="settle-receiver" class="form-control" value="${user?.full_name || 'Hostel Office'}" style="height: 38px; font-size: 0.85rem;" />
            </div>

            <!-- Remarks -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Remarks (Optional)</label>
              <input type="text" id="settle-remarks" class="form-control" placeholder="e.g. Paid by father at warden office" style="height: 38px; font-size: 0.85rem;" />
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-settle">Cancel</button>
              <button type="button" class="btn btn-primary" id="btn-confirm-settle" style="background: #F59E0B; border-color: #F59E0B; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Confirm Payment (₹${remainingAmt.toFixed(2)})
              </button>
            </div>
          </div>
        `
      });

      modalBody.querySelector('#btn-cancel-settle')?.addEventListener('click', close);

      const fullRadio = modalBody.querySelector('input[value="full"]');
      const partialRadio = modalBody.querySelector('input[value="partial"]');
      const labelFull = modalBody.querySelector('#label-settle-full');
      const labelPartial = modalBody.querySelector('#label-settle-partial');
      const amtInput = modalBody.querySelector('#settle-amount');
      const balStatus = modalBody.querySelector('#settle-live-bal-status');
      const confirmBtn = modalBody.querySelector('#btn-confirm-settle');

      function updateState() {
        const isPartial = partialRadio?.checked;
        const entered = Math.max(0, Math.min(remainingAmt, Number(amtInput.value) || 0));
        const bal = Math.max(0, remainingAmt - entered);

        if (isPartial) {
          labelFull.style.borderColor = '#E2E8F0';
          labelFull.style.background = '#FFFFFF';
          labelFull.style.color = '#334155';
          labelPartial.style.borderColor = '#D97706';
          labelPartial.style.background = '#FFFBEB';
          labelPartial.style.color = '#92400E';
        } else {
          labelFull.style.borderColor = '#059669';
          labelFull.style.background = '#ECFDF5';
          labelFull.style.color = '#065F46';
          labelPartial.style.borderColor = '#E2E8F0';
          labelPartial.style.background = '#FFFFFF';
          labelPartial.style.color = '#334155';
        }

        if (balStatus) {
          if (bal === 0) {
            balStatus.innerHTML = 'Remaining balance after payment: <span style="color: #059669;">✓ ₹0.00 (Fully Settled)</span>';
          } else {
            balStatus.innerHTML = `Remaining balance after payment: <span style="color: #DC2626;">⚠️ Balance Due: ₹${bal.toFixed(2)}</span>`;
          }
        }

        if (confirmBtn) {
          confirmBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Confirm Payment (₹${entered.toFixed(2)})`;
        }
      }

      fullRadio?.addEventListener('change', () => {
        if (amtInput) amtInput.value = remainingAmt;
        updateState();
      });

      partialRadio?.addEventListener('change', () => {
        if (amtInput) amtInput.value = defaultPartialAmt;
        updateState();
      });

      amtInput?.addEventListener('input', () => {
        const val = Number(amtInput.value) || 0;
        if (val < remainingAmt && !partialRadio.checked) {
          partialRadio.checked = true;
        } else if (val >= remainingAmt && !fullRadio.checked) {
          fullRadio.checked = true;
        }
        updateState();
      });

      confirmBtn?.addEventListener('click', async () => {
        const amount = Number(amtInput?.value) || 0;
        const method = modalBody.querySelector('#settle-method')?.value || 'Cash';
        const ref = modalBody.querySelector('#settle-ref')?.value?.trim() || '';
        const receiver = modalBody.querySelector('#settle-receiver')?.value?.trim() || user?.full_name || 'Hostel Office';
        const remarks = modalBody.querySelector('#settle-remarks')?.value?.trim() || '';

        if (amount <= 0) {
          toast.error('Please enter a valid payment amount.');
          return;
        }
        if (amount > remainingAmt) {
          toast.error(`Payment cannot exceed the remaining balance of ₹${remainingAmt.toFixed(2)}.`);
          return;
        }

        try {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Processing...';

          await db.settleDisciplineFine(incidentId, {
            amount,
            payment_method: method,
            reference_number: ref,
            received_by: receiver,
            remarks
          });

          toast.success(`Fine payment of ${formatCurrency(amount)} recorded! Receipt generated.`);
          close();

          // Refresh data and re-render card in place - card NEVER disappears!
          const [updatedIncs, updatedPayments] = await Promise.all([
            db.getDisciplineIncidents(),
            db.getDisciplineFinePayments()
          ]);
          allIncidents.length = 0;
          allIncidents.push(...(updatedIncs || []));
          allPayments.length = 0;
          allPayments.push(...(updatedPayments || []));

          renderModule();
        } catch (err) {
          toast.error(err.message || 'Error settling fine');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Payment';
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: VIEW & PRINT RECEIPT
    // -------------------------------------------------------------
    async function openReceiptModal(id, studentName, student) {
      const d = allIncidents.find(item => item.id === id);
      if (!d) return;
      const payments = await db.getDisciplineFinePaymentsByIncident(id);
      const latestPayment = payments[0] || {};
      const rcptNo = latestPayment.receipt_no || latestPayment.receipt_number || ('DISC-' + d.id.slice(-6).toUpperCase());

      openModal({
        title: `Payment Receipt — ${rcptNo}`,
        size: 'sm',
        contentHtml: `
          <div id="discipline-receipt-slip" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; font-size: 0.85rem; line-height: 1.5; color: #0F172A;">
            <div style="text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
              <div style="font-size: 1.05rem; font-weight: 900; color: #0F172A;">THAIBA RESIDENTIAL ENGLISH MEDIUM SCHOOL</div>
              <div style="font-size: 0.75rem; color: #64748B; font-weight: 600;">Campus Discipline & Fine Clearance Receipt</div>
              <div style="font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #DC2626; margin-top: 4px;">Receipt #${rcptNo}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
              <span style="color: #64748B;">Date & Time:</span>
              <strong>${latestPayment.payment_date || formatDate(d.fine_paid_at || new Date())}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
              <span style="color: #64748B;">Student Name:</span>
              <strong>${studentName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
              <span style="color: #64748B;">Admission / Class:</span>
              <span>${student?.admission_number || ''} • ${student?.school_class || ''}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
              <span style="color: #64748B;">Violation:</span>
              <span>${d.category}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
              <span style="color: #64748B;">Payment Mode:</span>
              <strong>${latestPayment.payment_method || d.fine_payment_method || 'Cash'}</strong>
            </div>
            ${latestPayment.reference_number ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
                <span style="color: #64748B;">Reference No:</span>
                <code>${latestPayment.reference_number}</code>
              </div>
            ` : ''}

            <div style="border-top: 1px dashed #CBD5E1; border-bottom: 1px dashed #CBD5E1; padding: 0.5rem 0; margin: 0.65rem 0; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Total Assessed Fine:</span>
                <strong>₹${(Number(d.monetary_fine) || 0).toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #047857; font-weight: 800;">
                <span>Amount Paid:</span>
                <span>₹${(Number(d.fine_paid_amount) || 0).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 800; color: ${(Number(d.fine_remaining_amount) || 0) > 0 ? '#DC2626' : '#047857'};">
                <span>Remaining Due:</span>
                <span>₹${(Number(d.fine_remaining_amount) || 0).toFixed(2)}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: #64748B; margin-top: 0.5rem;">
              <div>Received By: <strong>${latestPayment.received_by || d.fine_paid_by || 'Hostel Office'}</strong></div>
              <div>Status: <strong style="color: ${(Number(d.fine_remaining_amount) || 0) === 0 ? '#059669' : '#D97706'};">${(Number(d.fine_remaining_amount) || 0) === 0 ? 'Full Clearance' : 'Partial Payment'}</strong></div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
            <button type="button" class="btn btn-outline" id="btn-close-disc-receipt">Close</button>
            <button type="button" class="btn btn-primary" id="btn-print-disc-receipt" style="background: #047857; border-color: #047857; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Receipt
            </button>
          </div>
        `,
        onMount: ({ container: modalEl, close: closeReceipt }) => {
          modalEl.querySelector('#btn-close-disc-receipt')?.addEventListener('click', closeReceipt);
          modalEl.querySelector('#btn-print-disc-receipt')?.addEventListener('click', () => {
            printDocument('discipline-receipt-slip', `Discipline_Receipt_${rcptNo}`);
          });
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: RESOLVE INCIDENT
    // -------------------------------------------------------------
    function openResolveIncidentModal(id, studentName) {
      const d = allIncidents.find(item => item.id === id);
      if (!d) return;

      const { container: modalBody, close } = openModal({
        title: `Resolve Incident — ${studentName}`,
        size: 'sm',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 10px; padding: 0.85rem; color: #065F46;">
              <div style="font-weight: 800; font-size: 0.92rem;">Mark Misconduct Matter as Resolved</div>
              <p style="font-size: 0.82rem; margin: 0.35rem 0 0; line-height: 1.45;">
                Violation: <strong>${d.category}</strong> (${d.severity})<br>
                This will formally close the disciplinary file with recorded corrective actions.
              </p>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Resolution Notes / Action Taken</label>
              <textarea id="resolve-notes" class="form-control" rows="3" placeholder="e.g. Student apologized, verbal warning given by Chief Warden, father contacted." style="font-size: 0.85rem;"></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-res">Cancel</button>
              <button type="button" class="btn btn-success" id="btn-confirm-res" style="background: #059669; border-color: #059669; font-weight: 700; color: #FFFFFF;">
                Confirm Resolution
              </button>
            </div>
          </div>
        `
      });

      modalBody.querySelector('#btn-cancel-res')?.addEventListener('click', close);
      modalBody.querySelector('#btn-confirm-res')?.addEventListener('click', async () => {
        const notes = modalBody.querySelector('#resolve-notes')?.value?.trim();
        if (!notes) {
          toast.error('Please enter resolution notes or actions taken.');
          return;
        }

        try {
          await db.resolveDisciplineIncident(id, {
            resolution_notes: notes,
            resolved_by: user?.full_name || 'Hostel Staff'
          });
          close();
          toast.success('Disciplinary incident marked as Resolved.');
          const updated = await db.getDisciplineIncidents();
          allIncidents.length = 0;
          allIncidents.push(...(updated || []));
          renderModule();
        } catch (err) {
          toast.error(err.message || 'Error resolving incident');
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: DELETE INCIDENT CONFIRMATION
    // -------------------------------------------------------------
    function openDeleteIncidentConfirm(id, studentName) {
      const { container: modalBody, close } = openModal({
        title: `Delete Incident — ${studentName}`,
        size: 'sm',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.85rem; color: #991B1B;">
              <div style="font-weight: 800; font-size: 0.92rem;">Permanent Deletion</div>
              <p style="font-size: 0.82rem; margin: 0.35rem 0 0; line-height: 1.45;">
                Are you sure you want to permanently delete this misconduct record for <strong>${studentName}</strong>?
              </p>
              <p style="font-size: 0.76rem; margin: 0.35rem 0 0; color: #991B1B;">
                This will remove the black marks and property fine from the student's record ledger.
              </p>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-del">Cancel</button>
              <button type="button" class="btn btn-danger" id="btn-confirm-del" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF;">
                Delete Permanently
              </button>
            </div>
          </div>
        `
      });

      modalBody.querySelector('#btn-cancel-del')?.addEventListener('click', close);
      modalBody.querySelector('#btn-confirm-del')?.addEventListener('click', async () => {
        try {
          await db.deleteDisciplineIncident(id);
          close();
          toast.success('Incident deleted successfully.');
          const updated = await db.getDisciplineIncidents();
          allIncidents.length = 0;
          allIncidents.push(...(updated || []));
          renderModule();
        } catch (err) {
          toast.error(err.message || 'Error deleting incident');
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: RECORD NEW INCIDENT FOR STUDENT
    // -------------------------------------------------------------
    function openRecordIncidentForStudentModal(student) {
      const studentName = student.full_name;

      const { container: modalBody, close } = openModal({
        title: `Record Incident — ${studentName}`,
        size: 'md',
        contentHtml: `
          <form id="form-log-student-incident" style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.65rem 0.85rem; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <strong style="color: #0F172A; font-size: 0.95rem;">${studentName}</strong>
                <div style="font-size: 0.75rem; color: #64748B;">${student.admission_number || ''} • ${student.school_class || 'Hostel Student'}</div>
              </div>
              <span class="badge" style="background: #FEF2F2; color: #DC2626; font-size: 0.74rem; font-weight: 700;">Hostel Discipline</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Incident Date</label>
                <input type="date" id="new-inc-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required style="height: 38px; font-size: 0.85rem;" />
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Severity</label>
                <select id="new-inc-severity" class="form-control" style="height: 38px; font-size: 0.85rem; font-weight: 600;">
                  <option value="Minor">Minor (Warning)</option>
                  <option value="Moderate" selected>Moderate (+1 to +2 Marks)</option>
                  <option value="Major">Major (+3 to +4 Marks)</option>
                  <option value="Critical">Critical (+5 Marks / Expulsion Warning)</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Violation Category</label>
              <select id="new-inc-category" class="form-control" style="height: 38px; font-size: 0.85rem; font-weight: 600;">
                <option value="Returning late without permission">Returning late without permission</option>
                <option value="Leaving hostel without permission">Leaving hostel without permission</option>
                <option value="Property damage / hostel damage">Property damage / hostel damage</option>
                <option value="Fighting / physical altercations">Fighting / physical altercations</option>
                <option value="Possession of prohibited items">Possession of prohibited items</option>
                <option value="Noise disturbance / quiet hours violation">Noise disturbance / quiet hours violation</option>
                <option value="Unauthorized room entry / hostel hopping">Unauthorized room entry / hostel hopping</option>
                <option value="Disrespect to mentors / wardens">Disrespect to mentors / wardens</option>
                <option value="Other hostel misconduct">Other hostel misconduct</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Black Marks to Award</label>
                <input type="number" id="new-inc-marks" class="form-control" value="2" min="0" max="10" required style="height: 38px; font-size: 0.95rem; font-weight: 800; color: #DC2626;" />
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Property Damage Fine (₹)</label>
                <input type="number" id="new-inc-fine" class="form-control" value="0" min="0" step="1" style="height: 38px; font-size: 0.95rem; font-weight: 800; color: #0F172A;" />
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Description & Circumstances</label>
              <textarea id="new-inc-desc" class="form-control" rows="2" placeholder="Provide factual details of the incident..." style="font-size: 0.85rem;"></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-log-inc">Cancel</button>
              <button type="submit" class="btn btn-danger" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF;">
                Save Misconduct Record
              </button>
            </div>
          </form>
        `
      });

      modalBody.querySelector('#btn-cancel-log-inc')?.addEventListener('click', close);
      modalBody.querySelector('#form-log-student-incident')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dateVal = modalBody.querySelector('#new-inc-date')?.value;
        const categoryVal = modalBody.querySelector('#new-inc-category')?.value;
        const severityVal = modalBody.querySelector('#new-inc-severity')?.value;
        const marksVal = Number(modalBody.querySelector('#new-inc-marks')?.value) || 0;
        const fineVal = Number(modalBody.querySelector('#new-inc-fine')?.value) || 0;
        const descVal = modalBody.querySelector('#new-inc-desc')?.value?.trim() || '';

        try {
          await db.logDisciplineIncident({
            student_id: student.id,
            incident_date: dateVal,
            category: categoryVal,
            severity: severityVal,
            description: descVal,
            black_marks_awarded: marksVal,
            monetary_fine: fineVal,
            reported_by: user?.full_name || 'Hostel Staff'
          });

          close();
          toast.success(`Misconduct incident logged for ${studentName}.`);
          const updated = await db.getDisciplineIncidents();
          allIncidents.length = 0;
          allIncidents.push(...(updated || []));
          renderModule();
        } catch (err) {
          toast.error(err.message || 'Error recording incident');
        }
      });
    }

    // Initial render
    renderModule();

  } catch (err) {
    console.error('Failed to render student discipline card:', err);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #DC2626;">
        <h3>Error loading Student Discipline Card</h3>
        <p style="color: #64748B;">${err.message || 'An error occurred'}</p>
        <button class="btn btn-primary" onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
}
