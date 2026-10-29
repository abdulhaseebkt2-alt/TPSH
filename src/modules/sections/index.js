import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { formatTime } from '../../lib/utils.js';

export const WEEK_DAYS = [
  { key: 'Sun', short: 'S', full: 'Sunday' },
  { key: 'Mon', short: 'M', full: 'Monday' },
  { key: 'Tue', short: 'T', full: 'Tuesday' },
  { key: 'Wed', short: 'W', full: 'Wednesday' },
  { key: 'Thu', short: 'T', full: 'Thursday' },
  { key: 'Fri', short: 'F', full: 'Friday' },
  { key: 'Sat', short: 'S', full: 'Saturday' }
];

export async function renderSectionsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const canManage = !user || user.is_super_admin || user.role === 'admin' || user.role === 'super_admin';

  let programs = await db.getPrograms();
  let sections = await db.getSections();
  let classrooms = await db.getClassrooms();
  let users = await db.getUsers();

  let selectedProgramId = programs[0]?.id || '';

  async function refreshData() {
    programs = await db.getPrograms();
    sections = await db.getSections();
    classrooms = await db.getClassrooms();
    users = await db.getUsers();

    if (!programs.some(p => p.id === selectedProgramId)) {
      selectedProgramId = programs[0]?.id || '';
    }
  }

  function getEligibleTeachers() {
    const list = (users || []).filter(u => u.approval_status === 'approved' && (u.role === 'teacher' || u.role === 'admin' || u.role === 'mentor' || u.role === 'super_admin' || !u.role));
    return list.sort((a, b) => {
      if (a.role === 'teacher' && b.role !== 'teacher') return -1;
      if (a.role !== 'teacher' && b.role === 'teacher') return 1;
      return (a.full_name || a.email).localeCompare(b.full_name || b.email);
    });
  }

  function renderFullUI() {
    const prog = programs.find(p => p.id === selectedProgramId) || programs[0];
    if (prog && selectedProgramId !== prog.id) {
      selectedProgramId = prog.id;
    }

    // Build mapping of section IDs to program for legacy reference
    const progSecMap = {};
    programs.forEach(p => {
      progSecMap[p.id] = sections.filter(s => s.program_id === p.id).map(s => s.id);
    });

    // Classrooms belonging to currently active section
    const progClassrooms = prog 
      ? classrooms.filter(c => c.program_id === prog.id || (c.section_id && progSecMap[prog.id]?.includes(c.section_id)))
      : [];

    container.innerHTML = `
      <!-- Minimal Page Header -->
      <div class="page-header" style="margin-bottom: 1.5rem;">
        <div class="page-title-group">
          <h2 style="font-size: 1.4rem; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">Sections & Classrooms</h2>
          <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.2rem;">Manage institutional sections and their classrooms</p>
        </div>
        <div class="page-actions" style="display: flex; gap: 0.5rem; align-items: center;">
          ${canManage ? `
            <button type="button" class="btn btn-outline" id="btn-header-add-section" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; font-size: 0.82rem; padding: 0.45rem 0.85rem; border-radius: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Section
            </button>
            <button type="button" class="btn btn-primary" id="btn-header-add-classroom" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; font-size: 0.82rem; padding: 0.45rem 0.95rem; border-radius: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Classroom
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 1. MOBILE SECTION SELECTOR CARD (Matches Screenshot 3 Role Switcher Design) -->
      <div class="sections-mobile-card rbac-mobile-role-card" style="margin-bottom: 1.25rem;">
        <button type="button" class="rbac-mobile-role-trigger" id="sec-mobile-trigger" aria-label="Select section to configure classrooms">
          <div class="rbac-trigger-left">
            <div class="rbac-trigger-icon" style="background: #ECFDF5; color: #059669; border: 1.5px solid #A7F3D0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div class="rbac-trigger-text">
              <span class="rbac-trigger-kicker">CONFIGURING SECTION</span>
              <div class="rbac-trigger-name-row">
                <span class="rbac-trigger-name">${prog ? prog.name : 'Select Section'}</span>
                <span class="rbac-trigger-badge" style="background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;">
                  ${progClassrooms.length} Classrooms
                </span>
              </div>
            </div>
          </div>
          <div class="rbac-trigger-right">
            <span class="rbac-trigger-action-pill">
              <span>Switch</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </button>

        ${canManage && prog ? `
          <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid #F1F5F9; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-xs btn-edit-prog" data-prog-id="${prog.id}" style="font-weight: 600; font-size: 0.78rem; border-radius: 6px; padding: 0.35rem 0.65rem; color: #475569; display: inline-flex; align-items: center; gap: 0.3rem;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Edit Section
            </button>
            ${programs.length > 1 ? `
              <button type="button" class="btn btn-outline btn-xs btn-delete-prog" data-prog-id="${prog.id}" style="font-weight: 600; font-size: 0.78rem; border-radius: 6px; padding: 0.35rem 0.65rem; color: #DC2626; border-color: #FECACA; display: inline-flex; align-items: center; gap: 0.3rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            ` : ''}
            <button type="button" class="btn btn-outline btn-xs btn-mobile-new-section" style="margin-left: auto; font-weight: 600; font-size: 0.78rem; border-radius: 6px; padding: 0.35rem 0.65rem; color: #059669; border-color: #A7F3D0; display: inline-flex; align-items: center; gap: 0.3rem;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Section
            </button>
          </div>
        ` : ''}
      </div>

      <!-- 2. DESKTOP SECTION NAVIGATION BAR (Visible on Desktop >= 769px) -->
      <div class="sections-desktop-nav" style="align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid #E2E8F0; padding-bottom: 0.85rem; margin-bottom: 1.5rem;">
        <!-- Section Tabs -->
        <div style="display: flex; gap: 0.5rem; align-items: center; overflow-x: auto; padding: 2px;" id="programs-nav-bar">
          ${programs.map(p => {
            const isSelected = p.id === selectedProgramId;
            const count = classrooms.filter(c => c.program_id === p.id || (c.section_id && progSecMap[p.id]?.includes(c.section_id))).length;
            return `
              <button type="button" 
                      class="btn-section-tab ${isSelected ? 'active' : ''}" 
                      data-prog-id="${p.id}" 
                      style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 9999px; font-size: 0.85rem; font-weight: ${isSelected ? '700' : '600'}; white-space: nowrap; cursor: pointer; transition: all 0.15s ease; border: 1px solid ${isSelected ? '#059669' : '#CBD5E1'}; background-color: ${isSelected ? '#059669' : '#FFFFFF'}; color: ${isSelected ? '#FFFFFF' : '#1E293B'}; box-shadow: ${isSelected ? '0 2px 6px rgba(5, 150, 105, 0.25)' : 'none'};">
                <span style="color: ${isSelected ? '#FFFFFF' : '#1E293B'}; font-weight: ${isSelected ? '700' : '600'};">${p.name}</span>
                <span class="tab-count-badge" style="font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 9999px; background-color: ${isSelected ? 'rgba(255, 255, 255, 0.28)' : '#F1F5F9'}; color: ${isSelected ? '#FFFFFF' : '#475569'}; font-weight: 700;">
                  ${count}
                </span>
              </button>
            `;
          }).join('')}

          ${canManage ? `
            <button type="button" id="btn-add-section-pill" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border-radius: 9999px; font-size: 0.82rem; font-weight: 600; white-space: nowrap; cursor: pointer; border: 1px dashed #CBD5E1; background: transparent; color: #64748B; transition: all 0.15s ease;" title="Create new section">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Section
            </button>
          ` : ''}
        </div>

        <!-- Active Section Quick Actions (Clean, minimal, right-aligned) -->
        ${canManage && prog ? `
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" class="btn btn-outline btn-sm btn-edit-prog" data-prog-id="${prog.id}" title="Edit Section Name & Code" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; font-weight: 600; color: #475569; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Edit Section
            </button>
            ${programs.length > 1 ? `
              <button type="button" class="btn btn-outline btn-sm btn-delete-prog" data-prog-id="${prog.id}" title="Delete Section" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; font-weight: 600; color: #DC2626; border-color: #FCA5A5; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Classrooms Grid (Minimal, human, user-friendly) -->
      ${!prog ? `
        <div style="text-align: center; padding: 4rem 1rem; color: #64748B;">
          <h4 style="font-size: 1.1rem; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">No sections configured</h4>
          <p style="font-size: 0.85rem; margin-bottom: 1rem;">Create your first institutional section to organize classrooms.</p>
          <button type="button" class="btn btn-primary" id="btn-empty-add-sec">New Section</button>
        </div>
      ` : progClassrooms.length === 0 ? `
        <div style="border: 1.5px dashed #CBD5E1; border-radius: 14px; padding: 3rem 1.5rem; text-align: center; background: #FAFAFA;">
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #1E293B; margin: 0 0 0.4rem 0;">No classrooms in ${prog.name}</h4>
          <p style="font-size: 0.85rem; color: #64748B; margin: 0 0 1.25rem 0;">Add classrooms or halls to start managing attendance and student rosters.</p>
          <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-cls" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; padding: 0.45rem 1rem; border-radius: 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add First Classroom
          </button>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${progClassrooms.map(cls => {
            const isBoys = cls.gender_eligibility === 'Boys';
            const isGirls = cls.gender_eligibility === 'Girls';
            const badgeBg = isBoys ? '#EFF6FF' : isGirls ? '#FDF2F8' : '#F0FDF4';
            const badgeColor = isBoys ? '#1D4ED8' : isGirls ? '#BE185D' : '#15803D';
            const badgeBorder = isBoys ? '#BFDBFE' : isGirls ? '#FBCFE8' : '#BBF7D0';
            const teacher = cls.teacher_id ? (users || []).find(u => u.id === cls.teacher_id) : null;
            const classDays = cls.days && Array.isArray(cls.days) && cls.days.length > 0 ? cls.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            return `
              <div class="minimal-classroom-card" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03); transition: border-color 0.15s ease, box-shadow 0.15s ease;">
                <!-- Card Header -->
                <div>
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                    <div style="min-width: 0; flex: 1;">
                      <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${cls.name}">
                        ${cls.name}
                      </h4>
                      <div style="margin-top: 0.35rem;">
                        <span style="display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 6px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                          ${cls.gender_eligibility || 'Mixed'}
                        </span>
                      </div>
                    </div>

                    ${canManage ? `
                      <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button type="button" class="btn-icon-minimal btn-edit-cls" data-cls-id="${cls.id}" title="Edit Classroom" style="width: 28px; height: 28px; border-radius: 6px; border: 1px solid #E2E8F0; background: #FFFFFF; color: #64748B; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button type="button" class="btn-icon-minimal btn-delete-cls" data-cls-id="${cls.id}" title="Delete Classroom" style="width: 28px; height: 28px; border-radius: 6px; border: 1px solid #FEE2E2; background: #FFFFFF; color: #EF4444; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Assigned Teacher & 7 Days Rounds Row -->
                  <div class="cls-card-schedule-row">
                    <div class="cls-teacher-pill" title="${teacher ? `Assigned Teacher: ${teacher.full_name || teacher.email}` : 'No Teacher Assigned'}">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span class="cls-teacher-name ${teacher ? 'assigned' : 'unassigned'}">
                        ${teacher ? (teacher.full_name || teacher.email) : 'No teacher assigned'}
                      </span>
                    </div>

                    <!-- 7 Rounds for Days of Week -->
                    <div class="cls-card-days-row" title="Class Days of Week">
                      ${WEEK_DAYS.map(d => {
                        const active = classDays.includes(d.key);
                        return `
                          <span class="day-round ${active ? 'active' : 'inactive'}" title="${d.full}: ${active ? 'Active' : 'Off'}">
                            ${d.short}
                          </span>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- Class Timing (Mandatory) & Optional Room/Capacity -->
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; font-size: 0.82rem; color: #475569;">
                    <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 600; color: #0F172A;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #059669; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span>${formatTime(cls.start_time || '06:30')} – ${formatTime(cls.end_time || '07:30')}</span>
                    </div>
                    ${cls.room_number ? `
                      <span style="color: #CBD5E1;">•</span>
                      <span style="color: #64748B;">Room <strong>${cls.room_number}</strong></span>
                    ` : ''}
                    ${cls.capacity ? `
                      <span style="color: #CBD5E1;">•</span>
                      <span style="color: #64748B;"><strong>${cls.capacity}</strong> seats</span>
                    ` : ''}
                    <span style="color: #CBD5E1;">•</span>
                    <span style="color: #0284C7; font-weight: 600;"><strong>${(cls.student_ids || []).length}</strong> students</span>
                  </div>
                </div>

                <!-- Minimal Action Buttons -->
                <div style="display: flex; gap: 0.5rem; border-top: 1px solid #F1F5F9; padding-top: 0.75rem;">
                  <button type="button" class="btn btn-outline btn-sm btn-att-cls" data-cls-id="${cls.id}" style="flex: 1; font-size: 0.78rem; font-weight: 600; padding: 0.4rem; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    Attendance
                  </button>
                  <button type="button" class="btn btn-outline btn-sm btn-manage-cls" data-cls-id="${cls.id}" style="flex: 1; font-size: 0.78rem; font-weight: 600; padding: 0.4rem; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    Students
                  </button>
                </div>
              </div>
            `;
          }).join('')}

          <!-- Minimal Dashed Add Classroom Card -->
          ${canManage ? `
            <button type="button" id="card-quick-add-cls" style="border: 1.5px dashed #CBD5E1; background: transparent; border-radius: 12px; min-height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; cursor: pointer; color: #64748B; padding: 1.25rem; transition: all 0.15s ease;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; color: #059669;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <span style="font-size: 0.85rem; font-weight: 600; color: #334155;">Add Classroom</span>
            </button>
          ` : ''}
        </div>
      `}
    `;

    // Mobile Section Selector Modal (Exact Match to Role Switcher Dialog)
    container.querySelector('#sec-mobile-trigger')?.addEventListener('click', () => {
      openModal({
        title: 'Select Section to Manage',
        modalClass: 'role-picker-modal-dialog',
        contentHtml: `
          <div style="margin-bottom: 0.5rem;">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Select an institutional section to view and manage its classrooms:
            </p>
            <div class="role-picker-list">
              ${programs.map(p => {
                const isSelected = p.id === selectedProgramId;
                const count = classrooms.filter(c => c.program_id === p.id || (c.section_id && progSecMap[p.id]?.includes(c.section_id))).length;
                return `
                  <div class="role-picker-item ${isSelected ? 'active' : ''}" data-prog-id="${p.id}" role="button" tabindex="0">
                    <div class="role-picker-item-left">
                      <div class="role-picker-item-icon" style="background: #ECFDF5; color: #059669; border: 1.5px solid #A7F3D0;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      </div>
                      <div class="role-picker-item-info">
                        <div class="role-picker-item-title-row">
                          <span class="role-picker-item-name" style="font-weight: 700;">${p.name}</span>
                          ${isSelected ? `<span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.65rem; font-weight: 700;">CURRENT</span>` : ''}
                        </div>
                        <span class="role-picker-item-desc" style="font-size: 0.78rem; color: #64748B;">${count} Classrooms configured</span>
                      </div>
                    </div>
                    <div class="role-picker-item-radio">
                      <div class="role-radio-circle ${isSelected ? 'active' : ''}">
                        ${isSelected ? `<div class="role-radio-dot"></div>` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `,
        onMount: ({ container: modalBody, close }) => {
          modalBody.querySelectorAll('.role-picker-item').forEach(item => {
            item.addEventListener('click', () => {
              const pid = item.getAttribute('data-prog-id');
              if (pid && pid !== selectedProgramId) {
                selectedProgramId = pid;
                close();
                renderFullUI();
              } else {
                close();
              }
            });
          });
        }
      });
    });

    // Mobile Card New Section button
    container.querySelector('.btn-mobile-new-section')?.addEventListener('click', openAddProgramModal);

    // Tab Clicking (Desktop)
    container.querySelectorAll('.btn-section-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedProgramId = btn.getAttribute('data-prog-id');
        renderFullUI();
      });
    });

    // Add Section button clicks (Header and Pill bar)
    container.querySelector('#btn-header-add-section')?.addEventListener('click', openAddProgramModal);
    container.querySelector('#btn-add-section-pill')?.addEventListener('click', openAddProgramModal);
    container.querySelector('#btn-empty-add-sec')?.addEventListener('click', openAddProgramModal);

    // Add Classroom button clicks
    container.querySelector('#btn-header-add-classroom')?.addEventListener('click', openAddClassroomModal);
    container.querySelector('#btn-empty-add-cls')?.addEventListener('click', openAddClassroomModal);
    container.querySelector('#card-quick-add-cls')?.addEventListener('click', openAddClassroomModal);

    // Edit Section (Both mobile and desktop)
    container.querySelectorAll('.btn-edit-prog').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-prog-id') || selectedProgramId;
        openEditProgramModal(pid);
      });
    });

    // Delete Section (Both mobile and desktop)
    container.querySelectorAll('.btn-delete-prog').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-prog-id') || selectedProgramId;
        handleDeleteProgram(pid);
      });
    });

    // Take Attendance
    container.querySelectorAll('.btn-att-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        if (clsId) {
          sessionStorage.setItem('tps_active_att_cls', clsId);
        }
        onNavigate('attendance');
      });
    });

    // Assign Students (Opens dedicated 2-column student picker modal)
    container.querySelectorAll('.btn-manage-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        openAssignStudentsModal(clsId);
      });
    });

    // Edit Classroom
    container.querySelectorAll('.btn-edit-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        openEditClassroomModal(clsId);
      });
    });

    // Delete Classroom
    container.querySelectorAll('.btn-delete-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        handleDeleteClassroom(clsId);
      });
    });
  }

  // --- ACTIONS & MODALS ---

  async function handleDeleteClassroom(classroomId) {
    const cls = classrooms.find(c => c.id === classroomId);
    if (!cls) return;

    const confirmed = await confirmDialog({
      title: 'Delete Classroom',
      message: `Delete classroom "${cls.name}" (${cls.room_number || 'Room'})?`,
      confirmText: 'Delete',
      isDanger: true
    });

    if (confirmed) {
      await db.deleteClassroom(classroomId);
      toast.success(`Classroom "${cls.name}" removed.`);
      await refreshData();
      renderFullUI();
    }
  }

  async function handleDeleteProgram(progId) {
    const prog = programs.find(p => p.id === progId);
    if (!prog) return;

    if (programs.length <= 1) {
      toast.error('At least one section must remain configured.');
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Delete Section',
      message: `Delete section "${prog.name}" and all its classrooms?`,
      confirmText: 'Delete Section',
      isDanger: true
    });

    if (confirmed) {
      try {
        await db.deleteProgram(progId);
        toast.success(`Section "${prog.name}" deleted.`);
        await refreshData();
        renderFullUI();
      } catch (err) {
        toast.error(err.message || 'Could not delete section.');
      }
    }
  }

  function openAddProgramModal() {
    openModal({
      title: 'New Section',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Section Name</label>
          <input type="text" id="prog-name-input" class="form-control" placeholder="e.g. Hostel Moral Class, Tuition Coaching" required />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Short Code</label>
          <input type="text" id="prog-code-input" class="form-control" placeholder="e.g. MORAL, TUITION" />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Description (Optional)</label>
          <textarea id="prog-desc-input" class="form-control" rows="2" placeholder="Brief note about this section"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-program">Create Section</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-program')?.addEventListener('click', async () => {
          const name = modalBody.querySelector('#prog-name-input').value.trim();
          const code = modalBody.querySelector('#prog-code-input').value.trim();
          const description = modalBody.querySelector('#prog-desc-input').value.trim();

          if (!name) {
            toast.error('Please enter a section name.');
            return;
          }

          const created = await db.addProgram({ name, code, description });
          toast.success(`Section "${name}" created.`);
          close();
          selectedProgramId = created.id;
          await refreshData();
          renderFullUI();
        });
      }
    });
  }

  function openEditProgramModal(progId) {
    const prog = programs.find(p => p.id === progId);
    if (!prog) return;

    openModal({
      title: `Edit Section — ${prog.name}`,
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Section Name</label>
          <input type="text" id="edit-prog-name-input" class="form-control" value="${prog.name}" required />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Short Code</label>
          <input type="text" id="edit-prog-code-input" class="form-control" value="${prog.code || ''}" />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Description</label>
          <textarea id="edit-prog-desc-input" class="form-control" rows="2">${prog.description || ''}</textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-edit-program">Save Changes</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-edit-program')?.addEventListener('click', async () => {
          const name = modalBody.querySelector('#edit-prog-name-input').value.trim();
          const code = modalBody.querySelector('#edit-prog-code-input').value.trim();
          const description = modalBody.querySelector('#edit-prog-desc-input').value.trim();

          if (!name) {
            toast.error('Please enter a section name.');
            return;
          }

          await db.updateProgram(progId, { name, code, description });
          toast.success(`Section "${name}" updated.`);
          close();
          await refreshData();
          renderFullUI();
        });
      }
    });
  }

  function openAddClassroomModal() {
    const currentProg = programs.find(p => p.id === selectedProgramId) || programs[0];
    const teachers = getEligibleTeachers();

    openModal({
      title: 'Add Classroom',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label required">Section</label>
          <select id="cls-prog-select" class="form-control">
            ${programs.map(p => `<option value="${p.id}" ${p.id === selectedProgramId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label required">Classroom Name</label>
          <input type="text" id="cls-name-input" class="form-control" placeholder="e.g. Hostel Study Lab 1, Room 10A" required />
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label">Assign Teacher (Optional)</label>
          <select id="cls-teacher-select" class="form-control">
            <option value="">-- No Teacher Assigned --</option>
            ${teachers.map(t => `<option value="${t.id}">${t.full_name || t.email} (${t.role === 'teacher' ? 'Teacher' : (t.role || 'Staff')})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label" style="font-size: 0.75rem;">Teacher Assignment Start Date</label>
          <input type="date" id="cls-assigned-date" class="form-control" style="font-size: 0.8rem;" value="${new Date().toISOString().slice(0, 10)}" />
          <div style="font-size: 0.7rem; color: #64748B; margin-top: 0.25rem;">
            Attendance obligations and missed attendance start from this date.
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem;">
            <label class="form-label" style="margin-bottom: 0;">Class Days of Week</label>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn btn-xs btn-outline btn-quick-all" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">All</button>
              <button type="button" class="btn btn-xs btn-outline btn-quick-mon-sat" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">Mon–Sat</button>
              <button type="button" class="btn btn-xs btn-outline btn-quick-clear" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">Clear</button>
            </div>
          </div>
          <div class="cls-days-picker-row">
            ${WEEK_DAYS.map(d => {
              const isDefault = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].includes(d.key);
              return `
                <button type="button" class="cls-day-round-btn ${isDefault ? 'active' : ''}" data-day="${d.key}" title="${d.full}">
                  <span class="day-char">${d.short}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
          <div class="form-group">
            <label class="form-label required">Class Starting Time</label>
            <input type="time" id="cls-start-input" class="form-control" value="06:30" required />
          </div>
          <div class="form-group">
            <label class="form-label required">Class Ending Time</label>
            <input type="time" id="cls-end-input" class="form-control" value="07:30" required />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label required">Gender</label>
          <select id="cls-gender-select" class="form-control">
            <option value="Mixed">Mixed</option>
            <option value="Boys">Boys</option>
            <option value="Girls">Girls</option>
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Room / Hall (Optional)</label>
            <input type="text" id="cls-room-input" class="form-control" placeholder="e.g. 106, Hall B" />
          </div>
          <div class="form-group">
            <label class="form-label">Capacity (Optional)</label>
            <input type="number" id="cls-cap-input" class="form-control" placeholder="e.g. 35" min="1" max="200" />
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-classroom">Create Classroom</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        // Toggle Day rounds
        modalBody.querySelectorAll('.cls-day-round-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('active');
          });
        });

        // Quick day selectors
        modalBody.querySelector('.btn-quick-all')?.addEventListener('click', (e) => {
          e.preventDefault();
          modalBody.querySelectorAll('.cls-day-round-btn').forEach(b => b.classList.add('active'));
        });
        modalBody.querySelector('.btn-quick-mon-sat')?.addEventListener('click', (e) => {
          e.preventDefault();
          modalBody.querySelectorAll('.cls-day-round-btn').forEach(b => {
            if (b.getAttribute('data-day') !== 'Sun') b.classList.add('active');
            else b.classList.remove('active');
          });
        });
        modalBody.querySelector('.btn-quick-clear')?.addEventListener('click', (e) => {
          e.preventDefault();
          modalBody.querySelectorAll('.cls-day-round-btn').forEach(b => b.classList.remove('active'));
        });

        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-classroom')?.addEventListener('click', async () => {
          const progId = modalBody.querySelector('#cls-prog-select').value;
          const name = modalBody.querySelector('#cls-name-input').value.trim();
          const teacher_id = modalBody.querySelector('#cls-teacher-select')?.value || '';
          const teacher_assigned_date = modalBody.querySelector('#cls-assigned-date')?.value || new Date().toISOString().slice(0, 10);
          const days = Array.from(modalBody.querySelectorAll('.cls-day-round-btn.active')).map(b => b.getAttribute('data-day'));
          const start_time = modalBody.querySelector('#cls-start-input').value || '06:30';
          const end_time = modalBody.querySelector('#cls-end-input').value || '07:30';
          const room_number = modalBody.querySelector('#cls-room-input').value.trim();
          const capacity = modalBody.querySelector('#cls-cap-input').value.trim();
          const gender_eligibility = modalBody.querySelector('#cls-gender-select').value;

          if (!name) {
            toast.error('Please enter a classroom name.');
            return;
          }

          await db.addClassroom({
            program_id: progId,
            name,
            start_time,
            end_time,
            room_number,
            capacity: capacity ? Number(capacity) : null,
            gender_eligibility,
            teacher_id,
            teacher_assigned_date,
            days
          });

          toast.success(`Classroom "${name}" added.`);
          close();
          selectedProgramId = progId;
          await refreshData();
          renderFullUI();
        });
      }
    });
  }

  function openEditClassroomModal(classroomId) {
    const cls = classrooms.find(c => c.id === classroomId);
    if (!cls) return;

    const currentProgId = cls.program_id || selectedProgramId;
    const teachers = getEligibleTeachers();
    const classDays = cls.days && Array.isArray(cls.days) && cls.days.length > 0 ? cls.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    openModal({
      title: `Edit Classroom — ${cls.name}`,
      contentHtml: `
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label required">Section</label>
          <select id="edit-cls-prog-select" class="form-control">
            ${programs.map(p => `<option value="${p.id}" ${p.id === currentProgId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label required">Classroom Name</label>
          <input type="text" id="edit-cls-name-input" class="form-control" value="${cls.name}" required />
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
            <label class="form-label" style="margin-bottom: 0;">Assign Teacher (Optional)</label>
            ${cls.teacher_id ? `
              <button type="button" class="btn btn-xs btn-outline" id="btn-quick-remove-teacher" style="color: #EF4444; border-color: #FECACA; font-size: 0.72rem; padding: 0.15rem 0.5rem;">
                ✕ Remove Teacher from Class
              </button>
            ` : ''}
          </div>
          <select id="edit-cls-teacher-select" class="form-control">
            <option value="">-- No Teacher Assigned --</option>
            ${teachers.map(t => `<option value="${t.id}" ${cls.teacher_id === t.id ? 'selected' : ''}>${t.full_name || t.email} (${t.role === 'teacher' ? 'Teacher' : (t.role || 'Staff')})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.65rem 0.8rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">
            Faculty Duty Tenure & Attendance Window
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div>
              <label class="form-label" style="font-size: 0.72rem; margin-bottom: 0.2rem;">Assignment Start Date</label>
              <input type="date" id="edit-cls-assigned-date" class="form-control" style="font-size: 0.78rem;" value="${cls.teacher_assigned_date || '2026-10-01'}" />
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; margin-bottom: 0.2rem;">Removal / End Date</label>
              <input type="date" id="edit-cls-removed-date" class="form-control" style="font-size: 0.78rem;" value="${cls.teacher_removed_date || ''}" placeholder="Active" />
            </div>
          </div>
          <div style="font-size: 0.7rem; color: #64748B; margin-top: 0.35rem;">
            Attendance duties are tracked only between assignment start and removal dates. If removed, duties end immediately on the removal date.
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem;">
            <label class="form-label" style="margin-bottom: 0;">Class Days of Week</label>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn btn-xs btn-outline btn-quick-all" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">All</button>
              <button type="button" class="btn btn-xs btn-outline btn-quick-mon-sat" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">Mon–Sat</button>
              <button type="button" class="btn btn-xs btn-outline btn-quick-clear" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">Clear</button>
            </div>
          </div>
          <div class="cls-days-picker-row">
            ${WEEK_DAYS.map(d => {
              const isSelected = classDays.includes(d.key);
              return `
                <button type="button" class="cls-day-round-btn ${isSelected ? 'active' : ''}" data-day="${d.key}" title="${d.full}">
                  <span class="day-char">${d.short}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.9rem;">
          <div class="form-group">
            <label class="form-label required">Class Starting Time</label>
            <input type="time" id="edit-cls-start-input" class="form-control" value="${cls.start_time || '06:30'}" required />
          </div>
          <div class="form-group">
            <label class="form-label required">Class Ending Time</label>
            <input type="time" id="edit-cls-end-input" class="form-control" value="${cls.end_time || '07:30'}" required />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0.9rem;">
          <label class="form-label required">Gender</label>
          <select id="edit-cls-gender-select" class="form-control">
            <option value="Mixed" ${(cls.gender_eligibility || 'Mixed') === 'Mixed' ? 'selected' : ''}>Mixed</option>
            <option value="Boys" ${cls.gender_eligibility === 'Boys' ? 'selected' : ''}>Boys</option>
            <option value="Girls" ${cls.gender_eligibility === 'Girls' ? 'selected' : ''}>Girls</option>
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Room / Hall (Optional)</label>
            <input type="text" id="edit-cls-room-input" class="form-control" value="${cls.room_number || ''}" placeholder="e.g. 101" />
          </div>
          <div class="form-group">
            <label class="form-label">Capacity (Optional)</label>
            <input type="number" id="edit-cls-cap-input" class="form-control" value="${cls.capacity || ''}" placeholder="e.g. 35" min="1" max="200" />
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-edit-classroom">Save Changes</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        // Toggle Day rounds
        modalBody.querySelectorAll('.cls-day-round-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('active');
          });
        });

        // Quick day selectors
        modalBody.querySelector('.btn-quick-all')?.addEventListener('click', (e) => {
          e.preventDefault();
          modalBody.querySelectorAll('.cls-day-round-btn').forEach(b => b.classList.add('active'));
        });
        modalBody.querySelector('.btn-quick-mon-sat')?.addEventListener('click', (e) => {
          e.preventDefault();
          modalBody.querySelectorAll('.cls-day-round-btn').forEach(b => {
            if (b.getAttribute('data-day') !== 'Sun') b.classList.add('active');
            else b.classList.remove('active');
          });
        });
        modalBody.querySelector('.btn-quick-clear')?.addEventListener('click', (e) => {
          e.preventDefault();
          modalBody.querySelectorAll('.cls-day-round-btn').forEach(b => b.classList.remove('active'));
        });

        // Quick remove teacher button
        modalBody.querySelector('#btn-quick-remove-teacher')?.addEventListener('click', (e) => {
          e.preventDefault();
          const select = modalBody.querySelector('#edit-cls-teacher-select');
          if (select) select.value = '';
          const remInput = modalBody.querySelector('#edit-cls-removed-date');
          if (remInput) remInput.value = new Date().toISOString().slice(0, 10);
          toast.info('Teacher marked for removal on today\'s date. Save changes to confirm.');
        });

        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-edit-classroom')?.addEventListener('click', async () => {
          const progId = modalBody.querySelector('#edit-cls-prog-select').value;
          const name = modalBody.querySelector('#edit-cls-name-input').value.trim();
          const teacher_id = modalBody.querySelector('#edit-cls-teacher-select')?.value || '';
          const teacher_assigned_date = modalBody.querySelector('#edit-cls-assigned-date')?.value || (teacher_id ? '2026-10-01' : null);
          const teacher_removed_date = modalBody.querySelector('#edit-cls-removed-date')?.value || (teacher_id ? null : new Date().toISOString().slice(0, 10));
          const days = Array.from(modalBody.querySelectorAll('.cls-day-round-btn.active')).map(b => b.getAttribute('data-day'));
          const start_time = modalBody.querySelector('#edit-cls-start-input').value || '06:30';
          const end_time = modalBody.querySelector('#edit-cls-end-input').value || '07:30';
          const room_number = modalBody.querySelector('#edit-cls-room-input').value.trim();
          const capacity = modalBody.querySelector('#edit-cls-cap-input').value.trim();
          const gender_eligibility = modalBody.querySelector('#edit-cls-gender-select').value;

          if (!name) {
            toast.error('Please enter a classroom name.');
            return;
          }

          await db.updateClassroom(classroomId, {
            program_id: progId,
            name,
            start_time,
            end_time,
            room_number,
            capacity: capacity ? Number(capacity) : null,
            gender_eligibility,
            teacher_id,
            teacher_assigned_date,
            teacher_removed_date,
            days
          });

          toast.success(`Classroom "${name}" updated.`);
          close();
          await refreshData();
          renderFullUI();
        });
      }
    });
  }

  async function openAssignStudentsModal(classroomId) {
    const cls = classrooms.find(c => c.id === classroomId);
    if (!cls) return;

    const prog = programs.find(p => p.id === (cls.program_id || selectedProgramId));
    const allStudents = await db.getStudents();
    // Sort students by admission number for natural sequence
    allStudents.sort((a, b) => {
      const admA = a.admission_number || '';
      const admB = b.admission_number || '';
      return admA.localeCompare(admB, undefined, { numeric: true });
    });

    const uniqueClasses = Array.from(new Set(allStudents.map(s => s.school_class).filter(Boolean))).sort();

    const currentAssigned = await db.getClassroomStudents(classroomId);
    const selectedIds = new Set(currentAssigned);

    let searchQuery = '';

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

    openModal({
      title: `Assign Students — ${cls.name}`,
      size: 'lg',
      modalClass: 'assign-students-modal',
      contentHtml: `
        <div class="assign-modal-wrapper">
          <!-- Top Section (Fixed) -->
          <div class="assign-modal-top">
            <div class="assign-meta-bar">
              <div class="assign-meta-left">
                <span class="assign-section-tag">${prog ? prog.name : 'Section'}</span>
                <span class="assign-gender-tag">${cls.gender_eligibility || 'Mixed'}</span>
              </div>
              <div class="assign-meta-right">
                <span id="assign-counter-banner" class="assign-count-pill">
                  <strong>${selectedIds.size}</strong>/${allStudents.length} assigned
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
                  <option value="Boys" ${cls.gender_eligibility === 'Boys' ? 'selected' : ''}>Boys</option>
                  <option value="Girls" ${cls.gender_eligibility === 'Girls' ? 'selected' : ''}>Girls</option>
                </select>
              </div>
            </div>

            <!-- Quick Action Row -->
            <div class="assign-quick-row">
              <span class="assign-visible-count" id="assign-visible-count">Showing ${allStudents.length} students</span>
              <div class="assign-quick-buttons">
                <button type="button" class="btn-text-action" id="btn-select-visible">Select All</button>
                <span style="color: #CBD5E1;">•</span>
                <button type="button" class="btn-text-action" id="btn-deselect-visible">Clear All</button>
              </div>
            </div>
          </div>

          <!-- Scrollable Spacious 1-Column Students List (Flex 1) -->
          <div class="assign-students-list-container">
            <div class="assign-students-list" id="assign-students-list"></div>
            <div id="assign-empty-state" style="display: none; padding: 3rem 1rem; text-align: center; color: #94A3B8; font-size: 0.9rem;">
              No students match your search or filter criteria.
            </div>
          </div>

          <!-- Pinned Fixed Footer -->
          <div class="assign-footer-bar">
            <div class="assign-footer-info">
              <strong id="assign-footer-count">${selectedIds.size}</strong> selected
            </div>
            <div class="assign-footer-btns">
              <button type="button" class="btn btn-outline btn-sm" id="btn-modal-cancel">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-save-assignments" style="background: #00A3E0; border-color: #00A3E0; font-weight: 600;">
                Save Assignments
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
        const counterBanner = modalBody.querySelector('#assign-counter-banner');
        const footerCount = modalBody.querySelector('#assign-footer-count');
        const visibleCountEl = modalBody.querySelector('#assign-visible-count');

        function updateCounts() {
          const count = selectedIds.size;
          if (counterBanner) counterBanner.innerHTML = `<strong>${count}</strong>/${allStudents.length} assigned`;
          if (footerCount) footerCount.textContent = count;
        }

        function getFilteredStudents() {
          const selectedClass = classSelect.value;
          const selectedGender = genderSelect.value;
          const q = searchQuery.toLowerCase().trim();

          return allStudents.filter(s => {
            const isGirl = ['female', 'girl', 'girls'].includes((s.gender || '').toLowerCase());
            const genderKey = isGirl ? 'Girls' : 'Boys';

            if (selectedClass !== 'all' && (s.school_class || '') !== selectedClass) {
              return false;
            }

            if (selectedGender !== 'all' && genderKey !== selectedGender) {
              return false;
            }

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
            visibleCountEl.textContent = `Showing ${filtered.length} students`;
          }

          if (filtered.length === 0) {
            listContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
          }

          listContainer.style.display = 'flex';
          emptyState.style.display = 'none';

          listContainer.innerHTML = filtered.map(s => {
            const isAssigned = selectedIds.has(s.id);
            const isGirl = ['female', 'girl', 'girls'].includes((s.gender || '').toLowerCase());
            const genderLabel = isGirl ? 'Girl' : 'Boy';
            const metaClass = s.school_class ? `${s.school_class}` : '';

            return `
              <div class="assign-student-row ${isAssigned ? 'is-assigned' : ''}" data-sid="${s.id}">
                <!-- Tick Button in front of students data -->
                <div class="student-assign-tick ${isAssigned ? 'checked' : ''}" data-sid="${s.id}" role="checkbox" aria-checked="${isAssigned}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>

                <!-- Avatar: Student Photo or Gender Silhouette -->
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

                <!-- Student Data (Clean Spacious Full Width) -->
                <div class="assign-student-details">
                  <div class="assign-student-name" title="${s.full_name}">${s.full_name}</div>
                  <div class="assign-student-meta">
                    <span>${genderLabel}</span>
                    ${metaClass ? `<span class="meta-dot">•</span><span>${metaClass}</span>` : ''}
                    <span class="meta-dot">•</span>
                    <span>DOB: ${s.dob || '—'}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('');

          // Bind row clicking to toggle selection
          listContainer.querySelectorAll('.assign-student-row').forEach(row => {
            row.addEventListener('click', () => {
              const sid = row.getAttribute('data-sid');
              if (selectedIds.has(sid)) {
                selectedIds.delete(sid);
                row.classList.remove('is-assigned');
                const tick = row.querySelector('.student-assign-tick');
                tick?.classList.remove('checked');
                tick?.setAttribute('aria-checked', 'false');
              } else {
                selectedIds.add(sid);
                row.classList.add('is-assigned');
                const tick = row.querySelector('.student-assign-tick');
                tick?.classList.add('checked');
                tick?.setAttribute('aria-checked', 'true');
              }
              updateCounts();
            });
          });
        }

        renderRows();

        // Search Input
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value;
          renderRows();
        });

        // Dropdown filters
        classSelect.addEventListener('change', renderRows);
        genderSelect.addEventListener('change', renderRows);

        // Select visible
        modalBody.querySelector('#btn-select-visible')?.addEventListener('click', () => {
          const visible = getFilteredStudents();
          visible.forEach(s => selectedIds.add(s.id));
          updateCounts();
          renderRows();
        });

        // Deselect visible
        modalBody.querySelector('#btn-deselect-visible')?.addEventListener('click', () => {
          const visible = getFilteredStudents();
          visible.forEach(s => selectedIds.delete(s.id));
          updateCounts();
          renderRows();
        });

        // Cancel
        modalBody.querySelector('#btn-modal-cancel')?.addEventListener('click', close);

        // Save Assignments
        modalBody.querySelector('#btn-save-assignments')?.addEventListener('click', async () => {
          const saveBtn = modalBody.querySelector('#btn-save-assignments');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';

          try {
            await db.assignStudentsToClassroom(classroomId, Array.from(selectedIds));
            toast.success(`Assigned ${selectedIds.size} students to ${cls.name}`);
            close();
            await refreshData();
            renderFullUI();
          } catch (err) {
            toast.error(err.message || 'Failed to save student assignments.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Assignments';
          }
        });
      }
    });
  }

  renderFullUI();
}
