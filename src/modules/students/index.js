import { db } from '../../lib/db.js';
import { formatDate, exportToCSV, STANDARD_CLASSES, normalizeClassPattern, compressImage, parseStudentsCSV } from '../../lib/utils.js';
import * as XLSX from 'xlsx';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { canPerformAction, isViewOnlyModule } from '../../lib/permissions.js';

export async function renderStudentsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const canEditStudents = canPerformAction(user, 'students', 'edit');
  const canCreateStudents = canPerformAction(user, 'students', 'create');
  const canDeleteStudents = canPerformAction(user, 'students', 'delete');
  const isViewOnly = isViewOnlyModule(user, 'students');

  const allStudents = await db.getStudents();

  // Scoped Data Visibility:
  // - Parents see only their children
  // - Mentors assigned to Girls/Boys Hostel see only their hostel residents
  const isParent = user?.role === 'parent';
  const isMentor = user?.role === 'mentor';
  const savedMentorHostel = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_mentor_active_hostel') : null;
  const mentorUnit = user?.hostel_unit || savedMentorHostel;
  const isGirlsMentor = isMentor && (mentorUnit?.includes('Girls') || user?.gender_scope === 'Girls');
  const isBoysMentor = isMentor && (mentorUnit?.includes('Boys') || user?.gender_scope === 'Boys');

  let students = allStudents;
  if (isParent) {
    students = allStudents.filter(s => s.father_phone === '+91 98470 11223' || s.full_name === 'Mohammed Rayan' || s.full_name === 'Muhammad Rayyan');
  } else if (isGirlsMentor) {
    students = allStudents.filter(s => s.gender === 'Girls' || s.gender === 'Female' || (s.hostel_unit && s.hostel_unit.includes('Girls')));
  } else if (isBoysMentor) {
    students = allStudents.filter(s => s.gender === 'Boys' || s.gender === 'Male' || (s.hostel_unit && s.hostel_unit.includes('Boys')));
  }

  let searchQuery = '';
  let selectedGender = 'all';
  let selectedStatus = 'all';
  let selectedClass = 'all';
  let selectedIds = new Set();

  container.innerHTML = `
    <!-- Page Header (Image 2 & 3 Contract) -->
    <div class="page-header" style="margin-bottom: 1.25rem;">
      <div class="page-title-group" style="display: flex; align-items: flex-start; gap: 0.75rem;">
        <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: #ECFDF5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; margin-top: 2px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; margin: 0;">Student Directory & Admission Register</h2>
          <p style="font-size: 0.8rem; color: #64748B; margin-top: 0.15rem;">Manage hostel residents, admissions, bed allocations, and academic coaching assignments</p>
        </div>
      </div>
      <div class="page-actions" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        ${canCreateStudents && !isViewOnly ? `
          <button class="btn btn-outline" id="btn-import-csv" style="border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem; padding: 0.5rem 0.95rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Students (CSV / Excel)
          </button>
          <input type="file" id="input-import-csv" accept=".csv, .xlsx, .xls, text/csv" style="display: none;" />
        ` : ''}

        ${!isViewOnly ? `
          <button class="btn btn-outline" id="btn-export-csv" style="border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem; padding: 0.5rem 0.95rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        ` : ''}

        ${canCreateStudents && !isViewOnly ? `
          <button class="btn btn-primary" id="btn-add-student" style="border-radius: var(--radius-md); font-weight: 600; font-size: 0.8rem; padding: 0.5rem 1rem; background: #059669;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            + New Student Admission
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Capsule Search and Filters Bar (Image 2) -->
    <div class="student-filter-capsule">
      <div class="capsule-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="student-search-input" placeholder="Search student by name, ID, phone..." />
      </div>

      <div class="capsule-filters">
        <select id="filter-gender">
          <option value="all">All</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <select id="filter-status">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="On Approved Leave">On Approved Leave</option>
          <option value="Temporary Break">Temporary Break</option>
          <option value="inactive">Inactive</option>
        </select>

        <select id="filter-class">
          <option value="all">All Classes</option>
          ${STANDARD_CLASSES.map(cls => `<option value="${cls}">${cls}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Enrolled Hostel Students Card Panel (Image 2 & 3) -->
    <div class="student-directory-card">
      <div class="card-top-bar" id="card-top-bar">
        <!-- Dynamically rendered (title & batch delete actions) -->
      </div>
      <div class="table-responsive" id="students-table-container">
        <!-- Dynamically rendered table -->
      </div>
    </div>
  `;

  function renderTable() {
    const tableContainer = container.querySelector('#students-table-container');
    const topBar = container.querySelector('#card-top-bar');
    if (!tableContainer || !topBar) return;

    const filtered = students.filter(s => {
      const matchSearch =
        !searchQuery ||
        (s.full_name || '').toLowerCase().includes(searchQuery) ||
        (s.admission_number || '').toLowerCase().includes(searchQuery) ||
        (s.village || '').toLowerCase().includes(searchQuery) ||
        (s.father_phone || '').includes(searchQuery) ||
        (s.hostel_unit || '').toLowerCase().includes(searchQuery);

      const matchGender =
        selectedGender === 'all' ||
        s.gender === selectedGender ||
        (selectedGender === 'Male' && s.gender === 'Boys') ||
        (selectedGender === 'Female' && s.gender === 'Girls');
      const matchStatus =
        selectedStatus === 'all' ||
        (s.status || '').toLowerCase() === selectedStatus.toLowerCase();

      const studentClass = normalizeClassPattern(s.school_class || '');
      const matchClass =
        selectedClass === 'all' ||
        studentClass === selectedClass ||
        studentClass.startsWith(selectedClass);

      return matchSearch && matchGender && matchStatus && matchClass;
    });

    const isAllSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
    const hasSelection = selectedIds.size > 0;

    // Render Card Top Bar (Image 2 vs Image 3)
    topBar.innerHTML = `
      <div class="card-title-group">
        <h3>Enrolled Hostel Students</h3>
        <span class="count-text">(${filtered.length} found)</span>
      </div>

      ${hasSelection && canDeleteStudents ? `
        <div class="student-selection-actions">
          <span class="selected-badge-pill">${selectedIds.size} Selected</span>
          <button class="btn-delete-batch" id="btn-batch-delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Selected
          </button>
          <button class="btn-clear-selection" id="btn-clear-selection">Clear</button>
        </div>
      ` : ''}
    `;

    // Empty state (Clean institutional SVG icon, no emojis)
    if (filtered.length === 0) {
      const isSearchActive = Boolean(searchQuery || (selectedGender && selectedGender !== 'all') || (selectedClass && selectedClass !== 'all') || (selectedStatus && selectedStatus !== 'all'));
      tableContainer.innerHTML = `
        <div class="empty-state" style="padding: 3.5rem 1.5rem; text-align: center;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #F1F5F9; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; color: #64748B;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.25rem;">
            ${isSearchActive ? 'No Matching Students Found' : 'No Students Enrolled Yet'}
          </h4>
          <p style="color: var(--text-muted); font-size: 0.85rem;">
            ${isSearchActive ? 'Try clearing your search or filter options.' : 'Get started by clicking "+ New Student Admission" to enroll your first student.'}
          </p>
        </div>
      `;
      return;
    }

    // Render Table according to Image 2 & 3 contract
    tableContainer.innerHTML = `
      <!-- Desktop Table Wrap (min-width: 769px) -->
      <div class="students-desktop-table-wrap">
        <table class="data-table student-directory-table" style="width: 100%; min-width: 980px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #E2E8F0; background: #F8FAFC;">
              <th style="padding: 0.85rem 1.25rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 20%; min-width: 210px; white-space: nowrap;">STUDENT INFO</th>
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 12%; min-width: 120px; white-space: nowrap;">ID NUMBER</th>
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 9%; min-width: 95px; white-space: nowrap;">CLASS</th>
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 9%; min-width: 95px; white-space: nowrap;">CATEGORY</th>
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 16%; min-width: 150px; white-space: nowrap;">HOSTEL / BED</th>
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 16%; min-width: 160px; white-space: nowrap;">PARENT / CONTACT</th>
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 8%; min-width: 90px; white-space: nowrap;">STATUS</th>
              ${canDeleteStudents ? `
                <th style="padding: 0.85rem 0.5rem; width: 3%; min-width: 38px; text-align: center; white-space: nowrap;">
                  <input type="checkbox" class="student-checkbox" id="select-all-students" ${isAllSelected ? 'checked' : ''} title="Select All" />
                </th>
              ` : ''}
              <th style="padding: 0.85rem 1rem; font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; width: 8%; min-width: 90px; text-align: right; white-space: nowrap;">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => {
              const isGirl = s.gender === 'Girls' || s.gender === 'Girl';
              const isChecked = selectedIds.has(s.id);

              // Status Badge Formatting
              const statusLower = (s.status || 'active').toLowerCase();
              let statusBadge = '';
              if (statusLower === 'active') {
                statusBadge = `<span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; border-radius: 9999px; padding: 0.2rem 0.7rem; font-size: 0.72rem; font-weight: 600; white-space: nowrap; display: inline-block;">active</span>`;
              } else if (statusLower.includes('leave')) {
                statusBadge = `<span class="badge" style="background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; border-radius: 9999px; padding: 0.2rem 0.7rem; font-size: 0.72rem; font-weight: 600; white-space: nowrap; display: inline-block;">on leave</span>`;
              } else if (statusLower.includes('break')) {
                statusBadge = `<span class="badge" style="background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; border-radius: 9999px; padding: 0.2rem 0.7rem; font-size: 0.72rem; font-weight: 600; white-space: nowrap; display: inline-block;">break</span>`;
              } else {
                statusBadge = `<span class="badge" style="background: #F1F5F9; color: #64748B; border-radius: 9999px; padding: 0.2rem 0.7rem; font-size: 0.72rem; font-weight: 600; white-space: nowrap; display: inline-block;">${s.status}</span>`;
              }

              return `
                <tr style="border-bottom: 1px solid #F1F5F9; background: ${isChecked ? '#F0FDF4' : '#FFFFFF'}; transition: background 120ms ease;">
                  <!-- Student Info Column -->
                  <td style="padding: 0.85rem 1.25rem; white-space: nowrap;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <!-- Circular Avatar: Boy (Blue) / Girl (Pink) -->
                      <div style="width: 38px; height: 38px; border-radius: 50%; background: ${isGirl ? '#FDF2F8' : '#EFF6FF'}; color: ${isGirl ? '#DB2777' : '#2563EB'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden;">
                        ${s.photo_url ? `
                          <img src="${s.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${s.full_name}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                          <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                          </div>
                        ` : `
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                        `}
                      </div>
                      <div>
                        <strong style="color: #065F46; font-size: 0.875rem; font-weight: 700; display: block; line-height: 1.3; white-space: nowrap;">${s.full_name}</strong>
                        <span style="color: #64748B; font-size: 0.72rem; white-space: nowrap;">${isGirl ? 'Girl' : 'Boy'} • DOB: ${s.dob || '2012-05-15'}</span>
                      </div>
                    </div>
                  </td>

                  <!-- ID Number Column -->
                  <td style="padding: 0.85rem 1rem; white-space: nowrap;">
                    <span class="badge" style="background: #F8FAFC; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 700; font-size: 0.74rem; letter-spacing: 0.04em; padding: 0.25rem 0.65rem; border-radius: 6px; white-space: nowrap; display: inline-block;">
                      ${s.admission_number || 'TPS2026056'}
                    </span>
                  </td>

                  <!-- Class Column -->
                  <td style="padding: 0.85rem 1rem; white-space: nowrap;">
                    <strong style="color: #0F172A; font-size: 0.85rem; white-space: nowrap;">${normalizeClassPattern(s.school_class) || 'STD-VIII'}</strong>
                  </td>

                  <!-- Category Column -->
                  <td style="padding: 0.85rem 1rem; white-space: nowrap;">
                    <span class="badge" style="background: #F1F5F9; color: #475569; border-radius: 9999px; padding: 0.25rem 0.75rem; font-size: 0.72rem; font-weight: 500; white-space: nowrap; display: inline-block;">
                      ${s.category || 'General'}
                    </span>
                  </td>

                  <!-- Hostel / Bed Column -->
                  <td style="padding: 0.85rem 1rem; white-space: nowrap;">
                    <div>
                      <div style="font-weight: 700; color: #1E293B; font-size: 0.825rem; white-space: nowrap;">
                        ${s.hostel_unit || (s.hostel_status === 'day_scholar' ? 'Day Scholar' : (isGirl ? 'Girls Hostel' : 'Boys Hostel'))}
                      </div>
                      <div style="color: #64748B; font-size: 0.72rem; white-space: nowrap;">
                        ${s.hostel_room ? `${s.hostel_room} • ${s.hostel_bed || 'Bed'}` : (s.hostel_status === 'day_scholar' ? 'Non-Resident' : '<span style="color: #94A3B8; font-style: italic;">Bed not assigned</span>')}
                      </div>
                    </div>
                  </td>

                  <!-- Parent / Contact Column -->
                  <td style="padding: 0.85rem 1rem; white-space: nowrap;">
                    <div>
                      <div style="font-weight: 600; color: #1E293B; font-size: 0.825rem; white-space: nowrap;">
                        ${s.father_name || 'Abdul Rasheed'}
                      </div>
                      <div style="color: #64748B; font-size: 0.72rem; display: flex; align-items: center; gap: 0.35rem; margin-top: 0.1rem; white-space: nowrap;">
                        <span>${s.father_phone || '+91 98470 12345'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#059669" style="flex-shrink: 0;"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.53 1.34 5L2 22l5.16-1.32c1.43.79 3.06 1.32 4.84 1.32 5.52 0 10-4.48 10-10S17.52 2 12 2zm4.95 14.15c-.21.58-1.2 1.09-1.68 1.15-.45.06-1.02.08-3.28-.85-2.71-1.12-4.45-3.87-4.59-4.05-.14-.19-1.09-1.45-1.09-2.76s.69-1.95.94-2.22c.25-.26.54-.33.72-.33.18 0 .36 0 .52.01.17.01.4.06.6.53.22.52.74 1.82.81 1.95.07.14.12.3.02.48-.09.18-.14.3-.28.46-.14.16-.3.35-.43.47-.14.14-.29.3-.12.59.16.29.73 1.2 1.57 1.94 1.08.96 1.99 1.25 2.28 1.39.29.14.46.12.63-.07.17-.19.74-.86.94-1.15.2-.29.4-.24.67-.14.28.1.75 1.77 1.26.17.09.28.14.32.22.04.09.04.52-.17 1.1z"/></svg>
                      </div>
                    </div>
                  </td>

                  <!-- Status Column -->
                  <td style="padding: 0.85rem 1rem; white-space: nowrap;">
                    ${statusBadge}
                  </td>

                  <!-- Checkbox Column -->
                  ${canDeleteStudents ? `
                    <td style="padding: 0.85rem 0.5rem; text-align: center; white-space: nowrap;">
                      <input type="checkbox" class="student-checkbox row-select-checkbox" data-id="${s.id}" ${isChecked ? 'checked' : ''} />
                    </td>
                  ` : ''}

                  <!-- Actions Column (View, Edit, Delete) -->
                  <td style="padding: 0.85rem 1rem; text-align: right; white-space: nowrap;">
                    <div class="student-action-btns" style="justify-content: flex-end; display: flex; gap: 0.45rem; align-items: center;">
                      <button class="student-action-btn btn-view-profile" data-id="${s.id}" title="View Student Profile">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      ${canEditStudents ? `
                        <button class="student-action-btn btn-edit-student" data-id="${s.id}" title="Edit Student Record">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      ` : ''}
                      ${canDeleteStudents ? `
                        <button class="student-action-btn delete-btn btn-delete-single" data-id="${s.id}" title="Delete Student Record">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile List View (max-width: 768px): Zero horizontal scroll, Class replaces ID Number, Tap row opens full student profile -->
      <div class="students-mobile-list-wrap">
        <div class="students-mobile-header-row">
          <span class="students-mobile-th th-info">STUDENT INFO</span>
          <span class="students-mobile-th th-class">CLASS</span>
        </div>
        <div class="students-mobile-items">
          ${filtered.map(s => {
            const isGirl = s.gender === 'Girls' || s.gender === 'Girl';
            const normalizedCls = normalizeClassPattern(s.school_class) || 'STD-I';
            return `
              <div class="student-mobile-card-row" data-id="${s.id}" role="button" tabindex="0" title="Tap to view full student details">
                <!-- Left: Avatar + Full Name + Gender/DOB -->
                <div class="student-mobile-main-info">
                  <div class="student-mobile-avatar" style="background: ${isGirl ? '#FDF2F8' : '#EFF6FF'}; color: ${isGirl ? '#DB2777' : '#2563EB'};">
                    ${s.photo_url ? `
                      <img src="${s.photo_url}" alt="${s.full_name}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                      <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                      </div>
                    ` : `
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                    `}
                  </div>
                  <div class="student-mobile-details">
                    <span class="student-mobile-name">${s.full_name}</span>
                    <span class="student-mobile-sub">${isGirl ? 'Girl' : 'Boy'} • DOB: ${s.dob || '—'}</span>
                  </div>
                </div>

                <!-- Right: Class badge in place of ID Number + Chevron -->
                <div class="student-mobile-class-col">
                  <span class="student-mobile-class-pill">${normalizedCls}</span>
                  <svg class="student-mobile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Row selection checkboxes handler
    tableContainer.querySelectorAll('.row-select-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = cb.getAttribute('data-id');
        if (e.target.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        renderTable();
      });
    });

    // Master Select-All Checkbox
    tableContainer.querySelector('#select-all-students')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        filtered.forEach(s => selectedIds.add(s.id));
      } else {
        filtered.forEach(s => selectedIds.delete(s.id));
      }
      renderTable();
    });

    // Clear Selection Button
    topBar.querySelector('#btn-clear-selection')?.addEventListener('click', () => {
      selectedIds.clear();
      renderTable();
    });

    // Batch Delete Action
    topBar.querySelector('#btn-batch-delete')?.addEventListener('click', async () => {
      if (!canDeleteStudents || selectedIds.size === 0) return;
      const count = selectedIds.size;
      const confirmed = await confirmDialog({
        title: 'Delete Selected Students',
        message: `Are you sure you want to permanently delete ${count} selected student record${count > 1 ? 's' : ''}? This operation cannot be reversed.`,
        confirmText: `Delete ${count} Record${count > 1 ? 's' : ''}`,
        isDanger: true
      });

      if (confirmed) {
        await db.deleteStudents(Array.from(selectedIds));
        selectedIds.clear();
        toast.success(`Successfully removed ${count} student record${count > 1 ? 's' : ''}.`);
        students = await db.getStudents();
        renderTable();
      }
    });

    // Single Delete Action
    tableContainer.querySelectorAll('.btn-delete-single').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const st = filtered.find(s => s.id === id);
        if (!st) return;

        const confirmed = await confirmDialog({
          title: 'Delete Student Record',
          message: `Are you sure you want to delete ${st.full_name} (${st.admission_number})?`,
          confirmText: 'Delete Student',
          isDanger: true
        });

        if (confirmed) {
          await db.deleteStudent(id);
          selectedIds.delete(id);
          toast.success(`Student record for ${st.full_name} deleted.`);
          students = await db.getStudents();
          renderTable();
        }
      });
    });

    // View Profile Action
    tableContainer.querySelectorAll('.btn-view-profile').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const st = filtered.find(s => s.id === id);
        if (st) showProfileModal(st);
      });
    });

    // Edit Student Action
    tableContainer.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const st = filtered.find(s => s.id === id);
        if (st) showEditStudentModal(st);
      });
    });

    // Mobile Card Row Click / Tap -> Opens Full Student Profile Modal
    tableContainer.querySelectorAll('.student-mobile-card-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const st = filtered.find(s => s.id === id);
        if (st) showProfileModal(st);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = row.getAttribute('data-id');
          const st = filtered.find(s => s.id === id);
          if (st) showProfileModal(st);
        }
      });
    });
  }

  // View Profile Modal
  function showProfileModal(student) {
    const isGirl = student.gender === 'Girls' || student.gender === 'Girl';

    openModal({
      title: `Student Profile — ${student.full_name}`,
      size: 'lg',
      contentHtml: `
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1.5rem;">
          <div style="width: 90px; height: 90px; border-radius: 50%; background: ${isGirl ? '#FDF2F8' : '#EFF6FF'}; color: ${isGirl ? '#DB2777' : '#2563EB'}; border: 2px solid ${isGirl ? '#FBCFE8' : '#BFDBFE'}; display: flex; align-items: center; justify-content: center; overflow: hidden; font-size: 32px; font-weight: 800; flex-shrink: 0;">
            ${student.photo_url ? `
              <img src="${student.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${student.full_name}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              </div>
            ` : `
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V21.6h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
            `}
          </div>
          <div style="flex: 1; min-width: 260px;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <h3 style="font-size: 1.3rem; font-weight: 800; color: #065F46; margin: 0;">${student.full_name}</h3>
              <span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; border-radius: 9999px; padding: 0.2rem 0.65rem; font-size: 0.72rem; font-weight: 600;">${student.status || 'active'}</span>
              <span class="badge" style="background: #F8FAFC; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 700;">${student.admission_number}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
              <div>Gender: <strong>${student.gender}</strong> • DOB: <strong>${formatDate(student.dob)}</strong> • Class: <strong>${normalizeClassPattern(student.school_class)}</strong></div>
              <div>Hostel: <strong>${student.hostel_unit || (student.hostel_status === 'day_scholar' ? 'Day Scholar' : 'Hostel Resident')}</strong> • Room: <strong>${student.hostel_room || 'Not assigned'}</strong> • Bed: <strong>${student.hostel_bed || 'Not assigned'}</strong></div>
            </div>
          </div>
        </div>

        <div class="form-grid" style="margin-bottom: 1.5rem;">
          <div>
            <h4 style="font-size: 0.825rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Parent & Guardian</h4>
            <div style="font-size: 0.85rem; line-height: 1.6;">
              <div>Primary Contact: <strong>${student.father_name}</strong> (${student.father_phone})</div>
              <div>Mother: <strong>${student.mother_name || '—'}</strong> (${student.mother_phone || '—'})</div>
              <div>WhatsApp: <strong>${student.whatsapp_number || student.father_phone}</strong></div>
            </div>
          </div>

          <div>
            <h4 style="font-size: 0.825rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Native Address</h4>
            <div style="font-size: 0.85rem; line-height: 1.6;">
              <div>Village / Town: <strong>${student.village || '—'}</strong>, Dist: <strong>${student.district || 'Malappuram'}</strong></div>
              <div>State: <strong>${student.state || 'Kerala'}</strong> • PIN: <strong>${student.pin_code || '—'}</strong></div>
            </div>
          </div>
        </div>

        ${(canEditStudents || canDeleteStudents) && !isViewOnly ? `
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid var(--border-subtle); flex-wrap: wrap;">
            ${canEditStudents ? `
              <button class="btn btn-outline" id="modal-btn-edit-student" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Student Record
              </button>
            ` : ''}
            ${canDeleteStudents ? `
              <button class="btn btn-outline" id="modal-btn-delete-student" style="color: #DC2626; border-color: #FECACA; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete Student
              </button>
            ` : ''}
          </div>
        ` : ''}
      `,
      onMount: (modalBody, modalOverlay) => {
        modalBody.querySelector('#modal-btn-edit-student')?.addEventListener('click', () => {
          modalOverlay.classList.remove('open');
          setTimeout(() => modalOverlay.remove(), 200);
          showEditStudentModal(student);
        });

        modalBody.querySelector('#modal-btn-delete-student')?.addEventListener('click', async () => {
          const confirmed = await confirmDialog({
            title: 'Delete Student Record',
            message: `Are you sure you want to delete ${student.full_name} (${student.admission_number})?`,
            confirmText: 'Delete Student',
            isDanger: true
          });

          if (confirmed) {
            modalOverlay.classList.remove('open');
            setTimeout(() => modalOverlay.remove(), 200);
            await db.deleteStudent(student.id);
            selectedIds.delete(student.id);
            toast.success(`Student record for ${student.full_name} deleted.`);
            students = await db.getStudents();
            renderTable();
          }
        });
      }
    });
  }

  // Edit Student Modal
  function showEditStudentModal(student) {
    openModal({
      title: `Edit Student Record — ${student.full_name}`,
      size: 'lg',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Photo Upload & Student Identity Card Header -->
          <div style="display: flex; gap: 1.5rem; align-items: center; padding: 1rem 1.25rem; background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); flex-wrap: wrap;">
            <!-- Passport Photo Card -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
              <div id="edit-photo-preview-box" style="width: 110px; height: 130px; border: 2px dashed var(--border-medium); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FFFFFF; overflow: hidden; position: relative; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
                ${student.photo_url ? `
                  <img id="edit-photo-img" src="${student.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${student.full_name}" />
                  <div id="edit-photo-placeholder" style="display: none; flex-direction: column; align-items: center; justify-content: center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem;">Upload Photo</span>
                  </div>
                ` : `
                  <div id="edit-photo-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem;">Upload Photo</span>
                  </div>
                  <img id="edit-photo-img" style="display: none; width: 100%; height: 100%; object-fit: cover;" />
                `}
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.75); color: #FFFFFF; font-size: 0.65rem; font-weight: 700; text-align: center; padding: 2px 0;">Click to Browse</div>
              </div>
              <input type="file" id="edit-student-photo-input" accept="image/*" style="display: none;" />
            </div>

            <!-- Identity Banner -->
            <div style="flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy);">${student.full_name}</span>
                <span class="badge" style="background: rgba(15, 81, 50, 0.1); color: #0F5132; border: 1px solid rgba(15, 81, 50, 0.2); font-weight: 700;">${student.admission_number}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
                Upload or update student passport photograph. The photo will automatically sync to ID cards, attendance sheets, gate registers, and profile modals.
              </div>
              <div style="display: flex; gap: 0.4rem; font-size: 0.72rem; color: var(--text-muted); align-items: center; margin-top: 0.2rem;">
                <span>JPG, PNG or WebP</span>
                <span>•</span>
                <span>Max size: 2MB</span>
                <span>•</span>
                <span>Aspect ratio: 3:4 recommended</span>
              </div>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label required">Full Name</label>
              <input type="text" id="edit-name" class="form-control" value="${student.full_name}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">ID / Admission Number</label>
              <input type="text" id="edit-adm" class="form-control" value="${student.admission_number}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">Date of Birth</label>
              <input type="date" id="edit-dob" class="form-control" value="${student.dob || '2012-05-15'}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">Gender</label>
              <select id="edit-gender" class="form-control" required>
                <option value="Male" ${(student.gender === 'Male' || student.gender === 'Boys') ? 'selected' : ''}>Male</option>
                <option value="Female" ${(student.gender === 'Female' || student.gender === 'Girls') ? 'selected' : ''}>Female</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Class</label>
              <select id="edit-class" class="form-control" required>
                ${STANDARD_CLASSES.map(cls => `<option value="${cls}" ${normalizeClassPattern(student.school_class) === cls ? 'selected' : ''}>${cls}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Category</label>
              <input type="text" id="edit-cat" class="form-control" value="${student.category || 'General'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Hostel Unit</label>
              <input type="text" id="edit-hostel" class="form-control" value="${student.hostel_unit || ''}" placeholder="e.g. Thaiba Boys Hostel Block A" />
            </div>
            <div class="form-group">
              <label class="form-label">Room & Bed</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="edit-room" class="form-control" value="${student.hostel_room || ''}" placeholder="Room (e.g. Room 101)" />
                <input type="text" id="edit-bed" class="form-control" value="${student.hostel_bed || ''}" placeholder="Bed (e.g. Bed 1)" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label required">Parent Name</label>
              <input type="text" id="edit-parent" class="form-control" value="${student.father_name || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">Parent Contact Phone</label>
              <input type="text" id="edit-phone" class="form-control" value="${student.father_phone || '+91 '}" required />
            </div>
            <div class="form-group">
              <label class="form-label required">Status</label>
              <select id="edit-status" class="form-control" required>
                <option value="active" ${student.status === 'active' || student.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="On Approved Leave" ${student.status === 'On Approved Leave' ? 'selected' : ''}>On Approved Leave</option>
                <option value="Temporary Break" ${student.status === 'Temporary Break' ? 'selected' : ''}>Temporary Break</option>
                <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
            <button class="btn btn-outline" id="btn-cancel-edit">Cancel</button>
            <button class="btn btn-primary" id="btn-save-edit">Save Changes</button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        let currentPhotoBase64 = student.photo_url || '';
        const photoInput = modalBody.querySelector('#edit-student-photo-input');
        const photoImg = modalBody.querySelector('#edit-photo-img');
        const photoBox = modalBody.querySelector('#edit-photo-preview-box');
        const placeholder = modalBody.querySelector('#edit-photo-placeholder');

        const triggerUpload = () => photoInput?.click();
        photoBox?.addEventListener('click', triggerUpload);

        photoInput?.addEventListener('change', async () => {
          const file = photoInput.files[0];
          if (file) {
            try {
              toast.info('Optimizing student photo...');
              const compressed = await compressImage(file, 280, 320, 0.75);
              currentPhotoBase64 = compressed;
              if (photoImg) {
                photoImg.src = currentPhotoBase64;
                photoImg.style.display = 'block';
              }
              if (placeholder) {
                placeholder.style.display = 'none';
              }
              toast.success('Photo ready! Click "Save Changes" to save.');
            } catch (err) {
              console.error('Photo optimization error:', err);
              toast.error('Failed to load image: ' + err.message);
            }
          }
        });

        modalBody.querySelector('#btn-cancel-edit')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-edit')?.addEventListener('click', async () => {
          const updatedName = modalBody.querySelector('#edit-name').value.trim();
          const updatedAdm = modalBody.querySelector('#edit-adm').value.trim();
          const updatedDob = modalBody.querySelector('#edit-dob').value;
          const updatedGender = modalBody.querySelector('#edit-gender').value;
          const updatedClass = modalBody.querySelector('#edit-class').value.trim();
          const updatedCat = modalBody.querySelector('#edit-cat').value.trim();
          const updatedHostel = modalBody.querySelector('#edit-hostel').value.trim();
          const updatedRoom = modalBody.querySelector('#edit-room').value.trim();
          const updatedBed = modalBody.querySelector('#edit-bed').value.trim();
          const updatedParent = modalBody.querySelector('#edit-parent').value.trim();
          const updatedPhone = modalBody.querySelector('#edit-phone').value.trim();
          const updatedStatus = modalBody.querySelector('#edit-status').value;

          if (!updatedName || !updatedAdm) {
            toast.error('Student Name and Admission ID are required.');
            return;
          }

          await db.updateStudent(student.id, {
            full_name: updatedName,
            admission_number: updatedAdm,
            dob: updatedDob,
            gender: updatedGender,
            school_class: normalizeClassPattern(updatedClass),
            category: updatedCat,
            hostel_unit: updatedHostel,
            hostel_room: updatedRoom,
            hostel_bed: updatedBed,
            father_name: updatedParent,
            father_phone: updatedPhone,
            status: updatedStatus,
            photo_url: currentPhotoBase64
          });

          toast.success(`Record for ${updatedName} updated successfully.`);
          close();
          students = await db.getStudents();
          renderTable();
        });
      }
    });
  }

  // Search and Filter Listeners
  container.querySelector('#student-search-input')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTable();
  });

  container.querySelector('#filter-gender')?.addEventListener('change', (e) => {
    selectedGender = e.target.value;
    renderTable();
  });

  container.querySelector('#filter-status')?.addEventListener('change', (e) => {
    selectedStatus = e.target.value;
    renderTable();
  });

  container.querySelector('#filter-class')?.addEventListener('change', (e) => {
    selectedClass = e.target.value;
    renderTable();
  });

  // Top action buttons
  container.querySelector('#btn-add-student')?.addEventListener('click', () => {
    onNavigate('admissions');
  });

  // Export CSV Handler
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    const exportData = students.map(s => ({
      'ID Number': s.admission_number,
      'Student Name': s.full_name,
      'Gender': s.gender,
      'DOB': s.dob,
      'Class': s.school_class,
      'Category': s.category || 'General',
      'Hostel': s.hostel_unit,
      'Room': s.hostel_room,
      'Bed': s.hostel_bed,
      'Parent Name': s.father_name,
      'Parent Phone': s.father_phone,
      'Status': s.status
    }));
    exportToCSV('Enrolled_Hostel_Students', exportData);
    toast.success('Enrolled hostel students exported to CSV successfully.');
  });

  // Import CSV / Excel Handler
  const fileInput = container.querySelector('#input-import-csv');
  container.querySelector('#btn-import-csv')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info('Reading student data file...');
      let csvContent = '';

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        csvContent = XLSX.utils.sheet_to_csv(sheet);
      } else {
        csvContent = await file.text();
      }

      if (!csvContent || !csvContent.trim()) {
        toast.error('The uploaded file is empty.');
        fileInput.value = '';
        return;
      }

      const parsedStudents = parseStudentsCSV(csvContent);
      if (!parsedStudents || parsedStudents.length === 0) {
        toast.error('No valid student rows found in file. Please ensure there is at least a name column.');
        fileInput.value = '';
        return;
      }

      toast.info(`Importing ${parsedStudents.length} student records...`);
      const result = await db.importStudents(parsedStudents);

      if (result.success) {
        const cloudNote = result.dbCount > 0 ? ` (${result.dbCount} synced to Cloud DB)` : '';
        toast.success(`Successfully imported ${result.count} students!${cloudNote}`);

        const updatedAll = await db.getStudents();
        students = isParent
          ? updatedAll.filter(s => s.father_phone === '+91 98470 11223' || s.full_name === 'Mohammed Rayan' || s.full_name === 'Muhammad Rayyan')
          : updatedAll;
        renderTable();
      } else {
        toast.error(`Import failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('File import error:', err);
      toast.error('Failed to import file: ' + err.message);
    } finally {
      fileInput.value = '';
    }
  });

  renderTable();
}
