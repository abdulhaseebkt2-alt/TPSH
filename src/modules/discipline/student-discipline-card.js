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
    let standingFilter = 'all'; // 'all', 'marks', 'fine_due', 'resolved', 'clean'

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
        if (standingFilter !== 'all') {
          const incs = getStudentIncidents(s.id);
          const totalMarks = incs.reduce((sum, item) => sum + (Number(item.black_marks_awarded) || 0), 0);
          const totalRemainingFine = incs.reduce((sum, item) => {
            const tot = Number(item.monetary_fine) || 0;
            const pd = Number(item.fine_paid_amount) || 0;
            const rem = item.fine_remaining_amount != null ? Number(item.fine_remaining_amount) : (item.fine_payment_status === 'paid' ? 0 : Math.max(0, tot - pd));
            return sum + rem;
          }, 0);

          if (standingFilter === 'marks' && totalMarks === 0) return false;
          if (standingFilter === 'fine_due' && totalRemainingFine <= 0) return false;
          if (standingFilter === 'clean' && incs.length > 0) return false;
          if (standingFilter === 'resolved' && (incs.length === 0 || incs.some(i => (i.resolution_status || 'Open').toLowerCase() !== 'resolved'))) return false;
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

      // Misconduct and penalty statistics for selected student
      const studentIncidents = selectedStudent ? getStudentIncidents(selectedStudent.id) : [];
      const totalMarks = studentIncidents.reduce((sum, d) => sum + (Number(d.black_marks_awarded) || 0), 0);
      const totalFineAssessed = studentIncidents.reduce((sum, d) => sum + (Number(d.monetary_fine) || 0), 0);
      const totalFinePaid = studentIncidents.reduce((sum, d) => sum + (Number(d.fine_paid_amount) || (d.fine_payment_status === 'paid' ? Number(d.monetary_fine) || 0 : 0)), 0);
      const totalBalanceDue = Math.max(0, totalFineAssessed - totalFinePaid);
      const openIncidentsCount = studentIncidents.filter(d => (d.resolution_status || 'Open').toLowerCase() === 'open').length;

      container.innerHTML = `
        <div class="discipline-card-container" style="max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; padding-bottom: 2rem;">
          
          <!-- NAVIGATION SUB-TABS: Switch between Register and Student Card -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.5rem 0.75rem;">
            <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 3px; gap: 3px;">
              <button type="button" id="tab-goto-register" style="padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; background: transparent; color: #64748B; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Incident Register
              </button>
              <button type="button" id="tab-stay-card" style="padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 800; border-radius: 6px; border: none; cursor: default; background: #FFFFFF; color: #DC2626; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: inline-flex; align-items: center; gap: 6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="20" height="14" x="2" y="5" rx="2"></rect><circle cx="8" cy="12" r="2.5"></circle><path d="M14 10h4"></path><path d="M14 14h3"></path></svg>
                Student Discipline Card
              </button>
            </div>

            ${canManage && selectedStudent ? `
              <button type="button" class="btn btn-sm btn-primary" id="btn-quick-log-student" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.75rem; border-radius: 8px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Record Incident for ${selectedStudent.full_name.split(' ')[0]}
              </button>
            ` : ''}
          </div>

          <!-- Module Header & Filter Toolbar -->
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

                  <!-- Dropdown List of Matching Students -->
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

          <!-- TOP STUDENT DETAILS CARD (MATCHING STUDENT LEAVE CARD DESIGN) -->
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

                <!-- Conduct Standing Pill -->
                <div style="display: flex; align-items: center;">
                  ${totalMarks > 0 ? `
                    <span class="badge" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; font-weight: 800; font-size: 0.8rem; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px;">
                      <span style="width: 8px; height: 8px; border-radius: 50%; background: #DC2626; display: inline-block;"></span>
                      +${totalMarks} Active Black Mark(s)
                    </span>
                  ` : `
                    <span class="badge" style="background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; font-weight: 800; font-size: 0.8rem; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px;">
                      <span style="width: 8px; height: 8px; border-radius: 50%; background: #059669; display: inline-block;"></span>
                      Clean Conduct Standing
                    </span>
                  `}
                </div>
              </div>

              <!-- Bento Metrics Grid on Student Profile Card -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; padding-top: 0.65rem; border-top: 1px solid #F1F5F9;">
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.6rem 0.75rem;">
                  <div style="font-size: 0.7rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Incidents</div>
                  <div style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-top: 2px;">${studentIncidents.length}</div>
                  <div style="font-size: 0.68rem; color: ${openIncidentsCount > 0 ? '#D97706' : '#64748B'};">${openIncidentsCount > 0 ? `${openIncidentsCount} Open Matter(s)` : 'All Resolved'}</div>
                </div>

                <div style="background: ${totalMarks > 0 ? '#FEF2F2' : '#F8FAFC'}; border: 1px solid ${totalMarks > 0 ? '#FCA5A5' : '#E2E8F0'}; border-radius: 10px; padding: 0.6rem 0.75rem;">
                  <div style="font-size: 0.7rem; font-weight: 700; color: ${totalMarks > 0 ? '#991B1B' : '#64748B'}; text-transform: uppercase;">Black Marks</div>
                  <div style="font-size: 1.15rem; font-weight: 800; color: #DC2626; margin-top: 2px;">+${totalMarks}</div>
                  <div style="font-size: 0.68rem; color: #64748B;">Cumulative points</div>
                </div>

                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.6rem 0.75rem;">
                  <div style="font-size: 0.7rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Damage Fines</div>
                  <div style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-top: 2px;">${formatCurrency(totalFineAssessed)}</div>
                  <div style="font-size: 0.68rem; color: #059669;">${formatCurrency(totalFinePaid)} Paid</div>
                </div>

                <div style="background: ${totalBalanceDue > 0 ? '#FFFBEB' : '#ECFDF5'}; border: 1.5px solid ${totalBalanceDue > 0 ? '#FDE68A' : '#A7F3D0'}; border-radius: 10px; padding: 0.6rem 0.75rem;">
                  <div style="font-size: 0.7rem; font-weight: 700; color: ${totalBalanceDue > 0 ? '#92400E' : '#065F46'}; text-transform: uppercase;">Balance Due</div>
                  <div style="font-size: 1.15rem; font-weight: 900; color: ${totalBalanceDue > 0 ? '#DC2626' : '#059669'}; margin-top: 2px;">
                    ${totalBalanceDue > 0 ? formatCurrency(totalBalanceDue) : '✓ Cleared'}
                  </div>
                  <div style="font-size: 0.68rem; color: ${totalBalanceDue > 0 ? '#B45309' : '#047857'};">
                    ${totalBalanceDue > 0 ? 'Fine Clearance Pending' : 'Zero Fine Balance'}
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 2rem; text-align: center; color: #64748B;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.8" style="margin-bottom: 0.5rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <div style="font-weight: 700; font-size: 1rem; color: #1E293B;">No Student Selected</div>
              <div style="font-size: 0.8rem; margin-top: 0.25rem;">Please select a student from the search box above to view their discipline card.</div>
            </div>
          `}

          <!-- DISCIPLINE & MISCONDUCT RECORD HISTORY SECTION -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="background: #047857; padding: 0.85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <h3 style="font-size: 0.98rem; font-weight: 800; color: #FFFFFF; margin: 0; display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Discipline & Incident Record History
              </h3>
              <span class="badge" style="background: rgba(255,255,255,0.2); color: #FFFFFF; font-weight: 800; font-size: 0.74rem; padding: 3px 9px; border-radius: 9999px;">
                ${studentIncidents.length} Incident(s) on file
              </span>
            </div>

            <div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem;">
              ${studentIncidents.length === 0 ? `
                <div style="text-align: center; padding: 3rem 1rem; color: #64748B;">
                  <div style="width: 56px; height: 56px; border-radius: 50%; background: #ECFDF5; border: 1.5px solid #A7F3D0; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.75rem;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                  <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A;">No Disciplinary Incidents Recorded</div>
                  <div style="font-size: 0.82rem; color: #64748B; margin-top: 0.35rem; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                    This student maintains an exemplary record with zero active black marks and no property damage fines.
                  </div>
                  ${canManage && selectedStudent ? `
                    <button type="button" class="btn btn-outline" id="btn-empty-log-incident" style="margin-top: 1rem; font-size: 0.8rem; font-weight: 700; border-color: #CBD5E1;">
                      + Record Misconduct Incident
                    </button>
                  ` : ''}
                </div>
              ` : studentIncidents.map(d => {
                const isCrit = d.severity === 'Critical';
                const isMaj = d.severity === 'Major';
                const sevStyle = isCrit ? 'background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5;' : isMaj ? 'background: #FFF7ED; color: #C2410C; border: 1px solid #FDBA74;' : 'background: #F1F5F9; color: #475569;';
                const isRes = (d.resolution_status || '').toLowerCase() === 'resolved';
                const resStyle = isRes ? 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;' : 'background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;';
                
                const fineAmt = Number(d.monetary_fine) || 0;
                const paidAmt = Number(d.fine_paid_amount) || (d.fine_payment_status === 'paid' ? fineAmt : 0);
                const remainingAmt = d.fine_remaining_amount != null ? Number(d.fine_remaining_amount) : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, fineAmt - paidAmt));

                return `
                  <div class="discipline-incident-card" style="background: #FFFFFF; border: 1.5px solid ${isCrit ? '#FECACA' : '#E2E8F0'}; border-radius: 12px; padding: 0.95rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 0.65rem;">
                    
                    <!-- Incident Card Top Row -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <span style="font-weight: 800; font-size: 0.95rem; color: #0F172A;">${d.category}</span>
                          <span class="badge" style="font-size: 0.7rem; padding: 2px 7px; border-radius: 6px; font-weight: 700; ${sevStyle}">${d.severity}</span>
                        </div>
                        <div style="font-size: 0.74rem; color: #64748B; margin-top: 2px;">
                          Reported by: <strong>${d.reported_by || 'Staff'}</strong> • Incident Date: <strong>${formatDate(d.incident_date)}</strong>
                        </div>
                      </div>

                      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        <span class="badge" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-weight: 700; ${resStyle}">
                          ${d.resolution_status || 'Open'}
                        </span>
                        ${isRes && d.resolved_at ? `
                          <span style="font-size: 0.68rem; color: #059669; font-weight: 600;">Resolved on ${formatDate(d.resolved_at)}</span>
                        ` : ''}
                      </div>
                    </div>

                    <!-- Incident Description Snippet -->
                    ${d.description ? `
                      <div style="font-size: 0.82rem; color: #334155; background: #F8FAFC; border-radius: 8px; padding: 0.6rem 0.75rem; border: 1px solid #F1F5F9; line-height: 1.5;">
                        ${d.description}
                      </div>
                    ` : ''}

                    <!-- Penalties Strip & Status Row -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.65rem; border-top: 1px solid #F1F5F9; gap: 0.4rem; flex-wrap: wrap;">
                      <!-- Penalties Badges -->
                      <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                        <span class="badge badge-black-mark" style="font-size: 0.72rem; padding: 2.5px 8px; font-weight: 800;">
                          +${d.black_marks_awarded} Mark(s)
                        </span>
                        ${renderFineStatusBadge(d)}
                      </div>

                      <!-- Resolution Status Badge -->
                      <span class="badge" style="font-size: 0.7rem; padding: 2.5px 8px; border-radius: 9999px; font-weight: 700; ${resStyle}">
                        ${d.resolution_status || 'Open'}
                      </span>
                    </div>

                    <!-- Clean Rearranged Actions Bar -->
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.35rem; padding-top: 0.45rem; border-top: 1px dashed #F1F5F9; flex-wrap: wrap;">
                      <button type="button" class="btn btn-outline btn-xs btn-view-incident-details" data-id="${d.id}" style="padding: 0.32rem 0.65rem; font-size: 0.75rem; font-weight: 600; border-radius: 8px;">
                        Details
                      </button>

                      ${canManage && !isRes ? `
                        <button type="button" class="btn btn-xs btn-outline-success btn-resolve-incident-record" data-id="${d.id}" style="padding: 0.32rem 0.65rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px; color: #059669; border-color: #A7F3D0;">
                          Resolve
                        </button>
                      ` : ''}

                      ${paidAmt > 0 ? `
                        <button type="button" class="btn btn-outline btn-xs btn-view-fine-receipt" data-id="${d.id}" style="padding: 0.32rem 0.65rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px; color: #047857; border-color: #A7F3D0; display: inline-flex; align-items: center; gap: 4px;">
                          Receipt
                        </button>
                      ` : ''}

                      ${fineAmt > 0 && remainingAmt > 0 && canManage ? `
                        <button type="button" class="btn btn-xs btn-settle-incident-fine" data-id="${d.id}" style="padding: 0.32rem 0.75rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px; background: #F59E0B; border: 1.5px solid #F59E0B; color: #FFFFFF; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                          ${paidAmt > 0 ? `Pay Rem (₹${remainingAmt.toFixed(0)})` : `Settle Fine (₹${fineAmt.toFixed(0)})`}
                        </button>
                      ` : ''}

                      ${canManage ? `
                        <button type="button" class="btn btn-xs btn-outline-danger btn-delete-incident-record" data-id="${d.id}" style="padding: 0.32rem 0.55rem; font-size: 0.75rem; font-weight: 600; border-radius: 8px; color: #DC2626; border-color: #FCA5A5; display: inline-flex; align-items: center; justify-content: center;" title="Delete Record">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;

      attachModuleEvents();
    }

    function attachModuleEvents() {
      // Sub-tab: Go back to Register
      container.querySelector('#tab-goto-register')?.addEventListener('click', () => {
        if (options.onNavigate) {
          options.onNavigate('discipline');
        } else if (typeof window !== 'undefined' && window.location) {
          window.location.hash = '#discipline';
        }
      });

      // Quick log incident button
      container.querySelector('#btn-quick-log-student')?.addEventListener('click', () => {
        if (selectedStudent) openRecordIncidentForStudentModal(selectedStudent);
      });
      container.querySelector('#btn-empty-log-incident')?.addEventListener('click', () => {
        if (selectedStudent) openRecordIncidentForStudentModal(selectedStudent);
      });

      // Filters
      container.querySelector('#disc-card-gender-filter')?.addEventListener('change', (e) => {
        genderFilter = e.target.value;
        renderModule();
      });

      container.querySelector('#disc-card-status-filter')?.addEventListener('change', (e) => {
        standingFilter = e.target.value;
        renderModule();
      });

      container.querySelector('#disc-card-class-filter')?.addEventListener('change', (e) => {
        classFilter = e.target.value;
        renderModule();
      });

      // Search input & Dropdown
      const searchInput = container.querySelector('#disc-card-search-input');
      const studentDropdown = container.querySelector('#disc-card-student-dropdown');

      if (searchInput && studentDropdown) {
        searchInput.addEventListener('focus', () => {
          studentDropdown.style.display = 'block';
        });

        searchInput.addEventListener('input', (e) => {
          searchFilter = e.target.value;
          studentDropdown.style.display = 'block';
          // Re-render picker list inside dropdown
          renderModule();
          // Keep input focused
          const freshInput = container.querySelector('#disc-card-search-input');
          if (freshInput) {
            freshInput.focus();
            freshInput.setSelectionRange(freshInput.value.length, freshInput.value.length);
          }
        });

        container.querySelector('#btn-clear-disc-search')?.addEventListener('click', () => {
          searchFilter = '';
          renderModule();
        });
      }

      // Dropdown student selection
      container.querySelectorAll('.dropdown-student-item').forEach(item => {
        item.addEventListener('click', () => {
          const sId = item.dataset.id;
          const found = accessibleStudents.find(s => s.id === sId);
          if (found) {
            selectedStudent = found;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('tps_discipline_card_active_student', found.id);
            }
            searchFilter = '';
            renderModule();
          }
        });
      });

      // Parent child tabs
      container.querySelectorAll('.btn-child-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const cId = btn.dataset.childId;
          const found = accessibleStudents.find(s => s.id === cId);
          if (found) {
            selectedStudent = found;
            renderModule();
          }
        });
      });

      // Incident Details Button
      container.querySelectorAll('.btn-view-incident-details').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          openIncidentDetailsModal(id);
        });
      });

      // Settle Fine Button
      container.querySelectorAll('.btn-settle-incident-fine').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          openFineSettlementModal(id);
        });
      });

      // Receipt Button
      container.querySelectorAll('.btn-view-fine-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          openReceiptModal(id);
        });
      });

      // Resolve Button
      container.querySelectorAll('.btn-resolve-incident-record').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          openResolveIncidentModal(id);
        });
      });

      // Delete Button
      container.querySelectorAll('.btn-delete-incident-record').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          confirmDeleteIncident(id);
        });
      });

      // Close dropdown when clicking outside
      const handleOutsideClick = (e) => {
        if (studentDropdown && !studentDropdown.contains(e.target) && searchInput && !searchInput.contains(e.target)) {
          studentDropdown.style.display = 'none';
        }
      };
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('click', container._outsideClickHandler);
        container._outsideClickHandler = handleOutsideClick;
        document.addEventListener('click', handleOutsideClick);
      }
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
      const remainingAmt = d.fine_remaining_amount != null ? Number(d.fine_remaining_amount) : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, totalFine - alreadyPaid));
      const defaultPartialAmt = Math.max(1, Math.round(remainingAmt / 2));

      const { container: payModal, close: closePayModal } = openModal({
        title: `Discipline Fine Settlement — ${studentName}`,
        size: 'sm',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <!-- Fine Summary Box -->
            <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #64748B;">Student:</span>
                <span style="font-weight: 700; color: #0F172A;">${studentName} (${student?.admission_number || ''})</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #64748B;">Violation:</span>
                <span style="font-weight: 700; color: #92400E;">${d.category}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #64748B;">Total Assessed Fine:</span>
                <span style="font-weight: 700; color: #0F172A;">₹${totalFine.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #64748B;">Already Paid:</span>
                <span style="font-weight: 700; color: #059669;">₹${alreadyPaid.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 4px; border-top: 1px dashed #FCD34D;">
                <span style="font-weight: 800; color: #DC2626;">Current Balance Due:</span>
                <span style="font-weight: 800; color: #DC2626; font-size: 1.05rem;">₹${remainingAmt.toFixed(2)}</span>
              </div>
            </div>

            <!-- Payment Mode Selection (Full vs Partial Radio Buttons) -->
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.4rem; display: block;">Select Payment Option</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <label id="label-pay-full" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #059669; background: #ECFDF5; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #065F46;">
                  <input type="radio" name="disc_payment_mode" value="full" checked style="accent-color: #059669;" />
                  Full Clearance
                </label>
                <label id="label-pay-partial" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #E2E8F0; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #334155;">
                  <input type="radio" name="disc_payment_mode" value="partial" style="accent-color: #D97706;" />
                  Partial Payment
                </label>
              </div>
            </div>

            <!-- Amount Input Field -->
            <div>
              <label class="form-label required" style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">
                Amount to Pay (₹)
              </label>
              <input type="number" id="input-disc-fine-amount" class="form-control" min="1" max="${remainingAmt}" value="${remainingAmt}" step="0.01" style="font-weight: 800; font-size: 1rem; color: #0F172A;" />
              <div id="text-disc-remaining-preview" style="font-size: 0.74rem; color: #64748B; margin-top: 4px;">
                Remaining balance after payment: <strong style="color: #059669;">✓ ₹0.00 (Fully Settled)</strong>
              </div>
            </div>

            <!-- Payment Method Selection -->
            <div>
              <label class="form-label required" style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">
                Payment Method
              </label>
              <select id="select-disc-fine-method" class="form-control" style="font-size: 0.85rem;">
                <option value="Cash" selected>Cash (at Hostel Office)</option>
                <option value="UPI">UPI / Google Pay / PhonePe</option>
                <option value="Bank Transfer">School Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="DD">Demand Draft (DD)</option>
              </select>
            </div>

            <!-- Reference Notes -->
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">
                Receipt / Transaction Reference (Optional)
              </label>
              <input type="text" id="input-disc-fine-ref" class="form-control" placeholder="e.g. UPI Ref / Cheque No." style="font-size: 0.82rem;" />
            </div>

            <!-- Received By -->
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">
                Received By
              </label>
              <input type="text" id="input-disc-fine-receiver" class="form-control" value="${user?.full_name || 'Hostel Office'}" style="font-size: 0.82rem;" />
            </div>

            <!-- Remarks -->
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">
                Remarks (Optional)
              </label>
              <input type="text" id="input-disc-fine-remarks" class="form-control" placeholder="e.g. Paid by father at warden office" style="font-size: 0.82rem;" />
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-disc-pay">Cancel</button>
              <button type="button" class="btn btn-primary" id="btn-confirm-disc-pay" style="background: #F59E0B; border-color: #F59E0B; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Record Payment (₹${remainingAmt.toFixed(2)})
              </button>
            </div>
          </div>
        `
      });

      const fullRadio = payModal?.querySelector('input[value="full"]');
      const partialRadio = payModal?.querySelector('input[value="partial"]');
      const labelFull = payModal?.querySelector('#label-pay-full');
      const labelPartial = payModal?.querySelector('#label-pay-partial');
      const amountInput = payModal?.querySelector('#input-disc-fine-amount');
      const previewText = payModal?.querySelector('#text-disc-remaining-preview');
      const submitBtn = payModal?.querySelector('#btn-confirm-disc-pay');
      const methodSelect = payModal?.querySelector('#select-disc-fine-method');
      const refInput = payModal?.querySelector('#input-disc-fine-ref');
      const receiverInput = payModal?.querySelector('#input-disc-fine-receiver');
      const remarksInput = payModal?.querySelector('#input-disc-fine-remarks');

      function updateDiscFormState() {
        const isPartialMode = partialRadio?.checked;
        const enteredAmt = Math.max(0, Math.min(remainingAmt, Number(amountInput.value) || 0));
        const balAfter = Math.max(0, remainingAmt - enteredAmt);

        if (isPartialMode) {
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

        if (previewText) {
          previewText.innerHTML = `Remaining balance after payment: <strong style="color: ${balAfter > 0 ? '#DC2626' : '#059669'};">₹${balAfter.toFixed(2)}${balAfter === 0 ? ' (Fully Settled)' : ' (Balance Due)'}</strong>`;
        }

        if (submitBtn) {
          submitBtn.textContent = `Record Payment (₹${enteredAmt.toFixed(2)})`;
        }
      }

      fullRadio?.addEventListener('change', () => {
        if (amountInput) amountInput.value = remainingAmt;
        updateDiscFormState();
      });

      partialRadio?.addEventListener('change', () => {
        if (amountInput) amountInput.value = defaultPartialAmt;
        updateDiscFormState();
      });

      amountInput?.addEventListener('input', () => {
        const val = Number(amountInput.value) || 0;
        if (val < remainingAmt && !partialRadio.checked) {
          partialRadio.checked = true;
        } else if (val >= remainingAmt && !fullRadio.checked) {
          fullRadio.checked = true;
        }
        updateDiscFormState();
      });

      payModal?.querySelector('#btn-cancel-disc-pay')?.addEventListener('click', closePayModal);

      submitBtn?.addEventListener('click', async () => {
        const payAmt = Number(amountInput?.value) || 0;
        if (payAmt <= 0) {
          toast.error('Please enter a valid payment amount greater than ₹0.');
          return;
        }
        if (payAmt > remainingAmt) {
          toast.error(`Payment cannot exceed the remaining balance of ₹${remainingAmt.toFixed(2)}.`);
          return;
        }

        const method = methodSelect?.value || 'Cash';
        const ref = refInput?.value?.trim() || '';
        const receiver = receiverInput?.value?.trim() || user?.full_name || 'Hostel Office';
        const remarks = remarksInput?.value?.trim() || '';

        try {
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing...'; }

          const res = await db.settleDisciplineFine(incidentId, {
            amount: payAmt,
            payment_method: method,
            reference_number: ref,
            received_by: receiver,
            remarks
          });

          toast.success(`Payment of ${formatCurrency(payAmt)} recorded successfully!`);
          closePayModal();

          // Refresh in-memory lists
          const [updatedIncidents, updatedPayments] = await Promise.all([
            db.getDisciplineIncidents(),
            db.getDisciplineFinePayments()
          ]);
          allIncidents.length = 0;
          allIncidents.push(...(updatedIncidents || []));
          allPayments.length = 0;
          allPayments.push(...(updatedPayments || []));

          // Rerender card view - card remains anchored right on screen!
          renderModule();
        } catch (err) {
          toast.error(err.message || 'Error processing payment');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Record Payment'; }
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: VIEW & PRINT RECEIPT
    // -------------------------------------------------------------
    function openReceiptModal(incidentId) {
      const d = allIncidents.find(i => i.id === incidentId);
      if (!d) return;
      const student = allStudents.find(s => s.id === d.student_id);
      const studentName = student?.full_name || 'Student';
      const payments = (allPayments || []).filter(p => p.incident_id === incidentId);
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
            <button type="button" class="btn btn-outline" id="btn-close-receipt">Close</button>
            <button type="button" class="btn btn-primary" id="btn-print-receipt" style="background: #047857; border-color: #047857; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Receipt
            </button>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-close-receipt')?.addEventListener('click', close);
          modalBody.querySelector('#btn-print-receipt')?.addEventListener('click', () => {
            printDocument('discipline-receipt-slip', `Discipline_Receipt_${rcptNo}`);
          });
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: RECORD INCIDENT FOR SPECIFIC STUDENT
    // -------------------------------------------------------------
    function openRecordIncidentForStudentModal(student) {
      const today = new Date().toISOString().split('T')[0];

      openModal({
        title: `Record Misconduct — ${student.full_name}`,
        size: 'md',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            <!-- Target Student Banner -->
            <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <strong style="color: #991B1B; font-size: 0.95rem;">${student.full_name}</strong>
                <div style="font-size: 0.75rem; color: #7F1D1D;">${student.admission_number || ''} • Class ${student.school_class || ''} • Room ${student.hostel_room || ''}</div>
              </div>
              <span class="badge" style="background: #FFFFFF; color: #DC2626; font-weight: 800; border: 1px solid #FCA5A5;">Target Student</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Incident Date</label>
                <input type="date" id="new-inc-date" class="form-control" value="${today}" style="height: 38px; font-size: 0.85rem;" />
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Severity Level</label>
                <select id="new-inc-severity" class="form-control" style="height: 38px; font-size: 0.85rem;">
                  <option value="Minor">Minor (1 Mark)</option>
                  <option value="Moderate" selected>Moderate (2 Marks)</option>
                  <option value="Major">Major (3 Marks)</option>
                  <option value="Critical">Critical (5 Marks)</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Violation Category</label>
              <select id="new-inc-category" class="form-control" style="height: 38px; font-size: 0.85rem;">
                <option value="Returning late without permission">Returning late without permission</option>
                <option value="Leaving hostel without permission">Leaving hostel without permission</option>
                <option value="Property damage">Property damage / Hostel damage</option>
                <option value="Mobile phone policy violation">Mobile phone policy violation</option>
                <option value="Fighting or verbal abuse">Fighting or verbal abuse</option>
                <option value="Curfew violation">Curfew violation</option>
                <option value="Academic bunking">Academic bunking</option>
                <option value="Other misconduct">Other misconduct</option>
              </select>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Description of Incident</label>
              <textarea id="new-inc-desc" class="form-control" rows="2" placeholder="Details of the violation, circumstances, witnesses..." style="font-size: 0.85rem;"></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Black Marks</label>
                <input type="number" id="new-inc-marks" class="form-control" value="2" min="1" max="10" style="height: 38px; font-size: 0.85rem;" />
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Property Damage Fine (₹)</label>
                <input type="number" id="new-inc-fine" class="form-control" value="0" min="0" step="1" placeholder="Optional fine" style="height: 38px; font-size: 0.85rem;" />
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.35rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-new-inc">Cancel</button>
              <button type="button" class="btn btn-primary" id="btn-save-new-inc" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF;">
                Save Misconduct Record
              </button>
            </div>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-cancel-new-inc')?.addEventListener('click', close);
          modalBody.querySelector('#new-inc-severity')?.addEventListener('change', (e) => {
            const sev = e.target.value;
            const marksInput = modalBody.querySelector('#new-inc-marks');
            if (marksInput) {
              marksInput.value = sev === 'Minor' ? 1 : sev === 'Moderate' ? 2 : sev === 'Major' ? 3 : 5;
            }
          });

          modalBody.querySelector('#btn-save-new-inc')?.addEventListener('click', async () => {
            const date = modalBody.querySelector('#new-inc-date')?.value;
            const severity = modalBody.querySelector('#new-inc-severity')?.value;
            const category = modalBody.querySelector('#new-inc-category')?.value;
            const desc = modalBody.querySelector('#new-inc-desc')?.value.trim();
            const marks = Number(modalBody.querySelector('#new-inc-marks')?.value) || 1;
            const fine = Number(modalBody.querySelector('#new-inc-fine')?.value) || 0;

            if (!desc) {
              toast.error('Please enter a description of the incident.');
              return;
            }

            try {
              await db.logDisciplineIncident({
                student_id: student.id,
                category,
                severity,
                incident_date: date,
                description: desc,
                black_marks: marks,
                fine,
                action_taken: 'Documented in student discipline card',
                reported_by: user?.full_name || 'Staff'
              });

              toast.success(`Disciplinary record logged for ${student.full_name}`);
              close();

              const updatedIncidents = await db.getDisciplineIncidents();
              allIncidents.length = 0;
              allIncidents.push(...(updatedIncidents || []));
              renderModule();
            } catch (err) {
              toast.error(err.message || 'Error recording incident');
            }
          });
        }
      });
    }

    // -------------------------------------------------------------
    // MODAL: VIEW INCIDENT DETAILS
    // -------------------------------------------------------------
    function openIncidentDetailsModal(id) {
      const d = allIncidents.find(item => item.id === id);
      if (!d) return;
      const student = allStudents.find(s => s.id === d.student_id);
      const isRes = (d.resolution_status || '').toLowerCase() === 'resolved';

      openModal({
        title: `Incident Details — ${student?.full_name || 'Student'}`,
        contentHtml: `
          <div style="font-size: 0.88rem; line-height: 1.6; display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <strong style="color: #0F172A; font-size: 1rem;">${student?.full_name || 'Student'}</strong>
                <div style="font-size: 0.75rem; color: #64748B;">${student?.admission_number ? student.admission_number + ' • ' : ''}${student?.school_class || ''}</div>
              </div>
              <div style="text-align: right;">
                <span class="badge" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-weight: 700; ${isRes ? 'background: #ECFDF5; color: #047857;' : 'background: #FFFBEB; color: #B45309;'}">
                  ${d.resolution_status || 'Open'}
                </span>
                <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 2px;">${formatDate(d.incident_date)}</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem;">
              <div>Category: <strong style="color: #0F172A;">${d.category}</strong></div>
              <div>Severity: <strong style="color: #0F172A;">${d.severity}</strong></div>
              <div>Reported By: <strong>${d.reported_by || 'Staff'}</strong></div>
              <div>Black Marks: <strong style="color: #DC2626;">+${d.black_marks_awarded}</strong></div>
            </div>

            <div style="padding: 0.75rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
              <span style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Description:</span>
              <p style="color: #1E293B; margin: 0.25rem 0 0; font-size: 0.85rem; line-height: 1.5;">${d.description || 'No description provided'}</p>
            </div>

            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.75rem; font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                Fine Assessment: ${renderFineStatusBadge(d)}
              </div>
              ${d.fine_paid_at ? `
                <div style="font-size: 0.76rem; color: #059669;">
                  Paid on ${formatDate(d.fine_paid_at)} via ${d.fine_payment_method || 'Cash'} (Received by: ${d.fine_paid_by || 'Hostel Office'})
                </div>
              ` : ''}
            </div>

            ${isRes ? `
              <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.75rem; font-size: 0.82rem;">
                <div style="font-weight: 700; color: #065F46;">Resolved by: ${d.resolved_by || 'Warden'} on ${formatDate(d.resolved_at)}</div>
                <div style="color: #047857; margin-top: 2px;">${d.resolution_notes || 'Student counseled and matter closed.'}</div>
              </div>
            ` : ''}
          </div>
        `
      });
    }

    // -------------------------------------------------------------
    // MODAL: RESOLVE INCIDENT
    // -------------------------------------------------------------
    function openResolveIncidentModal(id) {
      const d = allIncidents.find(i => i.id === id);
      if (!d) return;

      openModal({
        title: `Resolve Incident — ${d.category}`,
        size: 'sm',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            <p style="font-size: 0.85rem; color: #64748B; margin: 0;">
              Marking this incident as resolved documents that student counseling or correctional actions have concluded.
            </p>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Resolution Notes / Action Taken</label>
              <textarea id="modal-resolve-notes" class="form-control" rows="2" placeholder="e.g. Student counseled by mentor; father informed."></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-resolve-disc">Cancel</button>
              <button type="button" class="btn btn-success" id="btn-confirm-resolve-disc" style="background: #059669; border-color: #059669; font-weight: 700; color: #FFFFFF;">
                Confirm Resolve
              </button>
            </div>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelector('#btn-cancel-resolve-disc')?.addEventListener('click', close);
          modalBody.querySelector('#btn-confirm-resolve-disc')?.addEventListener('click', async () => {
            const notes = modalBody.querySelector('#modal-resolve-notes')?.value.trim();
            close();
            try {
              await db.updateDisciplineIncident(id, {
                resolution_status: 'Resolved',
                resolution_notes: notes || 'Resolved by warden/mentor',
                resolved_at: new Date().toISOString(),
                resolved_by: user?.full_name || 'Staff'
              });
              toast.success('Incident marked as resolved.');
              const updatedIncidents = await db.getDisciplineIncidents();
              allIncidents.length = 0;
              allIncidents.push(...(updatedIncidents || []));
              renderModule();
            } catch (err) {
              toast.error(err.message || 'Error resolving incident');
            }
          });
        }
      });
    }

    // -------------------------------------------------------------
    // CONFIRM DELETE INCIDENT
    // -------------------------------------------------------------
    function confirmDeleteIncident(id) {
      const d = allIncidents.find(i => i.id === id);
      if (!d) return;

      const { container: deleteModal, close: closeDeleteModal } = openModal({
        title: 'Delete Disciplinary Record',
        size: 'sm',
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
            <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.85rem; color: #991B1B;">
              <div style="font-weight: 800; font-size: 0.95rem;">Permanent Deletion Warning</div>
              <p style="font-size: 0.82rem; margin: 0.35rem 0 0; line-height: 1.5; color: #7F1D1D;">
                Are you sure you want to permanently delete this record of <strong>${d.category}</strong> (${formatDate(d.incident_date)})?
                The associated black marks (+${d.black_marks_awarded}) will be deducted from the student's tally.
              </p>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-outline" id="btn-cancel-del-disc">Cancel</button>
              <button type="button" class="btn btn-danger" id="btn-confirm-del-disc" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF;">
                Delete Record
              </button>
            </div>
          </div>
        `
      });

      deleteModal?.querySelector('#btn-cancel-del-disc')?.addEventListener('click', closeDeleteModal);
      deleteModal?.querySelector('#btn-confirm-del-disc')?.addEventListener('click', async () => {
        closeDeleteModal();
        try {
          await db.deleteDisciplineIncident(id);
          toast.success('Disciplinary record deleted and student marks reconciled.');
          const updatedIncidents = await db.getDisciplineIncidents();
          allIncidents.length = 0;
          allIncidents.push(...(updatedIncidents || []));
          renderModule();
        } catch (err) {
          toast.error(err.message || 'Error deleting incident');
        }
      });
    }

    renderModule();
  } catch (err) {
    console.error('Failed to render student discipline card:', err);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #DC2626;">
        <h3>Error loading Student Discipline Card</h3>
        <p style="color: #64748B;">${err.message || 'Unknown error'}</p>
        <button class="btn btn-primary" onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
}
