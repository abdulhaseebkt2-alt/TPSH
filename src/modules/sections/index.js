import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal, confirmDialog } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderSectionsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const canManage = !user || user.is_super_admin || user.role === 'admin' || user.role === 'super_admin';

  let programs = await db.getPrograms();
  let sections = await db.getSections();
  let classrooms = await db.getClassrooms();

  let selectedProgramId = programs[0]?.id || '';

  async function refreshData() {
    programs = await db.getPrograms();
    sections = await db.getSections();
    classrooms = await db.getClassrooms();

    // Ensure selectedProgramId is valid
    if (!programs.some(p => p.id === selectedProgramId)) {
      selectedProgramId = programs[0]?.id || '';
    }
  }

  function renderFullUI() {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h2>Sections, Programs & Classrooms</h2>
          <p>Institutional structure: Sections (Programs) → Categories → Classrooms & Halls</p>
        </div>
        <div class="page-actions">
          ${canManage ? `
            <button class="btn btn-primary" id="btn-header-add-section" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Add Section
            </button>
            <button class="btn btn-outline" id="btn-header-add-category" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Add Category
            </button>
            <button class="btn btn-outline" id="btn-header-add-classroom" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Add Classroom
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Sections Selector Pill Bar with Add & Delete -->
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
          Select Section:
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center; overflow-x: auto; padding-bottom: 0.5rem;" id="programs-nav-bar">
          ${programs.map(p => {
            const isSelected = p.id === selectedProgramId;
            return `
              <div style="display: inline-flex; align-items: center; position: relative;">
                <button type="button" class="btn ${isSelected ? 'btn-primary' : 'btn-outline'} btn-prog-tab" data-prog-id="${p.id}" style="border-radius: var(--radius-full); font-weight: 700; white-space: nowrap; ${isSelected && canManage && programs.length > 1 ? 'padding-right: 2.2rem;' : ''}">
                  ${p.name}
                </button>
                ${isSelected && canManage && programs.length > 1 ? `
                  <button type="button" class="btn-delete-prog-pill" data-prog-id="${p.id}" title="Delete Section '${p.name}'" style="position: absolute; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); border: none; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: background 120ms ease;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}

          ${canManage ? `
            <button type="button" class="btn btn-outline" id="btn-add-section-pill" style="border-radius: var(--radius-full); border-style: dashed; color: #059669; border-color: #10B981; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.5rem 1rem; white-space: nowrap; flex-shrink: 0;" title="Create New Section">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              + Add Section
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Active Section Display Card & Categories/Classrooms Grid -->
      <div id="program-sections-view">
        <!-- Populated dynamically -->
      </div>
    `;

    // Program tab clicking
    container.querySelectorAll('.btn-prog-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedProgramId = btn.getAttribute('data-prog-id');
        renderFullUI();
      });
    });

    // Pill delete cross button click
    container.querySelectorAll('.btn-delete-prog-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const progId = btn.getAttribute('data-prog-id');
        handleDeleteProgram(progId);
      });
    });

    // Add Section button click (from pill bar or header)
    container.querySelector('#btn-add-section-pill')?.addEventListener('click', () => {
      openAddProgramModal();
    });
    container.querySelector('#btn-header-add-section')?.addEventListener('click', () => {
      openAddProgramModal();
    });

    // Add Category button click
    container.querySelector('#btn-header-add-category')?.addEventListener('click', () => {
      openAddSectionModal();
    });

    // Add Classroom button click
    container.querySelector('#btn-header-add-classroom')?.addEventListener('click', () => {
      openAddClassroomModal();
    });

    renderActiveProgramView();
  }

  function renderActiveProgramView() {
    const viewContainer = container.querySelector('#program-sections-view');
    if (!viewContainer) return;

    const prog = programs.find(p => p.id === selectedProgramId) || programs[0];
    if (!prog) {
      viewContainer.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1rem; text-align: center;">
          <h4>No Sections Configured</h4>
          <p>Create your first section using the button above.</p>
        </div>
      `;
      return;
    }

    const progSections = sections.filter(s => s.program_id === prog.id);
    const progClassroomsCount = classrooms.filter(c => progSections.some(s => s.id === c.section_id)).length;

    viewContainer.innerHTML = `
      <!-- Active Section Banner with Edit & Delete Options -->
      <div class="card-panel" style="margin-bottom: 1.5rem; border: 1.5px solid var(--border-subtle); background: #F8FAFC;">
        <div class="card-panel-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: transparent;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0F172A;">${prog.name}</h3>
              <span class="badge badge-active" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">${prog.code}</span>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem; margin-bottom: 0;">${prog.description || 'Configurable institutional section'}</p>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge" style="background: #E2E8F0; color: #334155; font-size: 0.76rem; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 8px;">
              ${progSections.length} Categories • ${progClassroomsCount} Classrooms
            </span>
            ${canManage ? `
              <button type="button" class="btn btn-outline btn-sm btn-edit-prog" data-prog-id="${prog.id}" title="Edit Section Name & Code" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; padding: 0.4rem 0.85rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Edit Section
              </button>
              ${programs.length > 1 ? `
                <button type="button" class="btn btn-outline btn-sm btn-delete-prog" data-prog-id="${prog.id}" title="Delete Section" style="color: #DC2626; border-color: #FECACA; display: flex; align-items: center; gap: 0.35rem; font-weight: 700; padding: 0.4rem 0.85rem;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete Section
                </button>
              ` : ''}
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Categories & Classrooms Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.5rem;">
        ${progSections.map(sec => {
          const secClassrooms = classrooms.filter(c => c.section_id === sec.id);
          const genderBadge = sec.gender_eligibility === 'Boys' ? 'badge-leave' : sec.gender_eligibility === 'Girls' ? 'badge-pending' : 'badge-active';

          return `
            <div class="card-panel" style="margin-bottom: 0; border: 1.5px solid var(--border-subtle); display: flex; flex-direction: column;">
              <!-- Category Header -->
              <div class="card-panel-header" style="background: var(--bg-surface-subtle); padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid var(--border-subtle);">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <h4 style="font-size: 0.95rem; font-weight: 800; color: #0F172A; margin: 0;">${sec.name}</h4>
                    <span class="badge ${genderBadge}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${sec.gender_eligibility}</span>
                  </div>
                  <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: 600; display: inline-block; margin-top: 0.25rem;">
                    ${secClassrooms.length} Classroom${secClassrooms.length !== 1 ? 's' : ''} Configured
                  </span>
                </div>

                ${canManage ? `
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <button type="button" class="btn btn-outline btn-sm btn-edit-sec" data-sec-id="${sec.id}" title="Edit Category" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; display: flex; align-items: center; gap: 0.3rem;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Edit
                    </button>
                    <button type="button" class="btn btn-outline btn-sm btn-delete-sec" data-sec-id="${sec.id}" title="Delete Category" style="color: #DC2626; border-color: #FECACA; padding: 0.35rem 0.6rem; font-size: 0.75rem; display: flex; align-items: center; gap: 0.3rem;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Delete
                    </button>
                  </div>
                ` : ''}
              </div>

              <!-- Category Classrooms List -->
              <div class="card-panel-body" style="padding: 1.15rem; flex: 1; display: flex; flex-direction: column;">
                <div style="display: flex; flex-direction: column; gap: 0.75rem; flex: 1;">
                  ${secClassrooms.map(c => `
                    <div style="background: var(--bg-surface); border: 1.5px solid var(--border-subtle); border-radius: 12px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; transition: border-color var(--transition-fast);">
                      <div style="min-width: 0;">
                        <strong style="color: #0F172A; font-size: 0.9rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</strong>
                        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                          Room: <strong>${c.room_number || 'Room'}</strong> • Capacity: <strong>${c.capacity}</strong>
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                        <button type="button" class="btn btn-outline btn-sm btn-manage-cls" data-cls-id="${c.id}" title="Manage Roster & Roll-Call" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
                          Manage
                        </button>
                        ${canManage ? `
                          <button type="button" class="btn btn-outline btn-sm btn-edit-cls" data-cls-id="${c.id}" title="Edit Classroom" style="padding: 0.35rem 0.55rem; color: #475569;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          </button>
                          <button type="button" class="btn btn-outline btn-sm btn-delete-cls" data-cls-id="${c.id}" title="Delete Classroom" style="padding: 0.35rem 0.55rem; color: #DC2626; border-color: #FECACA;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  `).join('') || `
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1.25rem; background: #F8FAFC; border: 1.5px dashed var(--border-medium); border-radius: 10px;">
                      No classrooms configured under this category yet.
                    </div>
                  `}

                  ${canManage ? `
                    <button type="button" class="btn btn-outline btn-sm btn-quick-add-cls" data-sec-id="${sec.id}" style="width: 100%; border-style: dashed; display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem; color: #059669; border-color: #A7F3D0; font-weight: 700; margin-top: 0.35rem; border-radius: 10px;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add Classroom to ${sec.name}
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <!-- Quick Add Category Card -->
        ${canManage ? `
          <div class="card-panel" id="card-quick-add-sec" style="border: 2px dashed #CBD5E1; background: #F8FAFC; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 220px; cursor: pointer; text-align: center; padding: 1.5rem; border-radius: 16px; transition: all var(--transition-fast);">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #E2E8F0; display: flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; color: #059669;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <strong style="color: #0F172A; font-size: 0.95rem;">+ Add Category under ${prog.name}</strong>
            <p style="font-size: 0.78rem; color: #64748B; margin-top: 0.25rem; max-width: 240px; margin-bottom: 0;">Create another division or category</p>
          </div>
        ` : ''}
      </div>
    `;

    // Manage Classroom Click
    viewContainer.querySelectorAll('.btn-manage-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        onNavigate('assignments');
      });
    });

    // Quick Add Classroom from Section card button
    viewContainer.querySelectorAll('.btn-quick-add-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-sec-id');
        openAddClassroomModal(secId);
      });
    });

    // Edit Section (Program)
    viewContainer.querySelector('.btn-edit-prog')?.addEventListener('click', () => {
      openEditProgramModal(prog.id);
    });

    // Delete Section (Program)
    viewContainer.querySelector('.btn-delete-prog')?.addEventListener('click', () => {
      handleDeleteProgram(prog.id);
    });

    // Edit Category (Child Section)
    viewContainer.querySelectorAll('.btn-edit-sec').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-sec-id');
        openEditSectionModal(secId);
      });
    });

    // Delete Category (Child Section)
    viewContainer.querySelectorAll('.btn-delete-sec').forEach(btn => {
      btn.addEventListener('click', async () => {
        const secId = btn.getAttribute('data-sec-id');
        const sec = sections.find(s => s.id === secId);
        if (!sec) return;

        const secClassrooms = classrooms.filter(c => c.section_id === sec.id);
        const confirmed = await confirmDialog({
          title: 'Delete Category',
          message: `Are you sure you want to remove category "${sec.name}"? All ${secClassrooms.length} classroom(s) configured inside it will also be permanently deleted.`,
          confirmText: 'Delete Category',
          isDanger: true
        });

        if (confirmed) {
          await db.deleteSection(secId);
          toast.success(`Category "${sec.name}" removed successfully.`);
          await refreshData();
          renderFullUI();
        }
      });
    });

    // Edit Classroom Click
    viewContainer.querySelectorAll('.btn-edit-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-cls-id');
        openEditClassroomModal(clsId);
      });
    });

    // Delete Classroom Click
    viewContainer.querySelectorAll('.btn-delete-cls').forEach(btn => {
      btn.addEventListener('click', async () => {
        const clsId = btn.getAttribute('data-cls-id');
        const cls = classrooms.find(c => c.id === clsId);
        if (!cls) return;

        const confirmed = await confirmDialog({
          title: 'Delete Classroom',
          message: `Are you sure you want to remove classroom "${cls.name}" (${cls.room_number || 'Room'})?`,
          confirmText: 'Delete Classroom',
          isDanger: true
        });

        if (confirmed) {
          await db.deleteClassroom(clsId);
          toast.success(`Classroom "${cls.name}" removed successfully.`);
          await refreshData();
          renderActiveProgramView();
        }
      });
    });

    // Quick Add Category card click
    viewContainer.querySelector('#card-quick-add-sec')?.addEventListener('click', () => {
      openAddSectionModal();
    });
  }

  // --- PROGRAM / SECTION LEVEL ACTIONS ---

  // Handle Delete Program/Section
  async function handleDeleteProgram(progId) {
    const prog = programs.find(p => p.id === progId);
    if (!prog) return;

    if (programs.length <= 1) {
      toast.error('At least one section must remain configured in the institution.');
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Delete Section',
      message: `Are you sure you want to permanently delete section "${prog.name}"? All categories and classrooms configured under it will also be removed.`,
      confirmText: 'Delete Section',
      isDanger: true
    });

    if (confirmed) {
      try {
        await db.deleteProgram(progId);
        toast.success(`Section "${prog.name}" deleted successfully.`);
        await refreshData();
        renderFullUI();
      } catch (err) {
        toast.error(err.message || 'Could not delete section.');
      }
    }
  }

  // Modal: Add New Section (Program)
  function openAddProgramModal() {
    openModal({
      title: 'Create New Section',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Section Name</label>
          <input type="text" id="prog-name-input" class="form-control" placeholder="e.g. Hifz Section, Tuition Coaching, Quran Studies" required />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Short Code / Badge</label>
          <input type="text" id="prog-code-input" class="form-control" placeholder="e.g. HIFZ, TUITION" />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Description / Objective</label>
          <textarea id="prog-desc-input" class="form-control" rows="3" placeholder="Brief explanation of this section's academic or residential purpose"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
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
          // Automatically add a default category inside this new section so classrooms can be added immediately
          await db.addSection({
            program_id: created.id,
            name: `${name} – General Batch`,
            gender_eligibility: 'Mixed'
          });

          toast.success(`Section "${name}" created successfully.`);
          close();
          selectedProgramId = created.id;
          await refreshData();
          renderFullUI();
        });
      }
    });
  }

  // Modal: Edit Section (Program)
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
          <label class="form-label">Short Code / Badge</label>
          <input type="text" id="edit-prog-code-input" class="form-control" value="${prog.code || ''}" />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Description / Objective</label>
          <textarea id="edit-prog-desc-input" class="form-control" rows="3">${prog.description || ''}</textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
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

  // --- CHILD CATEGORY & CLASSROOM MODALS ---

  // Add Category Modal
  function openAddSectionModal() {
    const prog = programs.find(p => p.id === selectedProgramId) || programs[0];
    openModal({
      title: `Create Category under ${prog?.name || 'Section'}`,
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Category / Division Name</label>
          <input type="text" id="sec-name-input" class="form-control" placeholder="e.g. Boys Moral Class – Category 3, Coaching Group 4" required />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Gender Eligibility</label>
          <select id="sec-gender-select" class="form-control">
            <option value="Mixed">Mixed (Boys & Girls)</option>
            <option value="Boys">Boys Only</option>
            <option value="Girls">Girls Only</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-section">Create Category</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-section')?.addEventListener('click', async () => {
          const name = modalBody.querySelector('#sec-name-input').value.trim();
          const gender = modalBody.querySelector('#sec-gender-select').value;
          if (!name) {
            toast.error('Please enter a category name.');
            return;
          }
          await db.addSection({ program_id: selectedProgramId, name, gender_eligibility: gender });
          toast.success(`Category "${name}" added.`);
          close();
          await refreshData();
          renderActiveProgramView();
        });
      }
    });
  }

  // Edit Category Modal
  function openEditSectionModal(sectionId) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;

    openModal({
      title: `Edit Category — ${sec.name}`,
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Category / Division Name</label>
          <input type="text" id="edit-sec-name-input" class="form-control" value="${sec.name}" required />
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Gender Eligibility</label>
          <select id="edit-sec-gender-select" class="form-control">
            <option value="Mixed" ${sec.gender_eligibility === 'Mixed' ? 'selected' : ''}>Mixed (Boys & Girls)</option>
            <option value="Boys" ${sec.gender_eligibility === 'Boys' ? 'selected' : ''}>Boys Only</option>
            <option value="Girls" ${sec.gender_eligibility === 'Girls' ? 'selected' : ''}>Girls Only</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-edit-section">Save Changes</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-edit-section')?.addEventListener('click', async () => {
          const name = modalBody.querySelector('#edit-sec-name-input').value.trim();
          const gender = modalBody.querySelector('#edit-sec-gender-select').value;
          if (!name) {
            toast.error('Please enter a category name.');
            return;
          }
          await db.updateSection(sectionId, { name, gender_eligibility: gender });
          toast.success(`Category "${name}" updated.`);
          close();
          await refreshData();
          renderActiveProgramView();
        });
      }
    });
  }

  // Add Classroom Modal
  function openAddClassroomModal(preferredSectionId = null) {
    const progSections = sections.filter(s => s.program_id === selectedProgramId);
    if (progSections.length === 0) {
      toast.error('Please create at least one category under this section before adding classrooms.');
      return;
    }

    const defaultSecId = preferredSectionId || progSections[0]?.id || '';

    openModal({
      title: 'Create Classroom',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Parent Category</label>
          <select id="cls-sec-select" class="form-control">
            ${progSections.map(s => `<option value="${s.id}" ${s.id === defaultSecId ? 'selected' : ''}>${s.name} (${s.gender_eligibility})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Classroom Name</label>
          <input type="text" id="cls-name-input" class="form-control" placeholder="e.g. Moral Hall A3, Coaching Lab 2" required />
        </div>
        <div class="form-grid" style="margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Physical Room Identifier</label>
            <input type="text" id="cls-room-input" class="form-control" placeholder="e.g. Room 103, Block B" />
          </div>
          <div class="form-group">
            <label class="form-label">Student Capacity</label>
            <input type="number" id="cls-cap-input" class="form-control" value="35" min="1" max="150" />
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-classroom">Create Classroom</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-classroom')?.addEventListener('click', async () => {
          const section_id = modalBody.querySelector('#cls-sec-select').value;
          const name = modalBody.querySelector('#cls-name-input').value.trim();
          const room_number = modalBody.querySelector('#cls-room-input').value.trim();
          const capacity = modalBody.querySelector('#cls-cap-input').value;

          if (!name) {
            toast.error('Please enter a classroom name.');
            return;
          }

          await db.addClassroom({ section_id, name, room_number, capacity });
          toast.success(`Classroom "${name}" created.`);
          close();
          await refreshData();
          renderActiveProgramView();
        });
      }
    });
  }

  // Edit Classroom Modal
  function openEditClassroomModal(classroomId) {
    const cls = classrooms.find(c => c.id === classroomId);
    if (!cls) return;

    const progSections = sections.filter(s => s.program_id === selectedProgramId);

    openModal({
      title: `Edit Classroom — ${cls.name}`,
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Category</label>
          <select id="edit-cls-sec-select" class="form-control">
            ${progSections.map(s => `<option value="${s.id}" ${s.id === cls.section_id ? 'selected' : ''}>${s.name} (${s.gender_eligibility})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Classroom Name</label>
          <input type="text" id="edit-cls-name-input" class="form-control" value="${cls.name}" required />
        </div>
        <div class="form-grid" style="margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Physical Room Identifier</label>
            <input type="text" id="edit-cls-room-input" class="form-control" value="${cls.room_number || ''}" placeholder="e.g. Room 101" />
          </div>
          <div class="form-group">
            <label class="form-label">Student Capacity</label>
            <input type="number" id="edit-cls-cap-input" class="form-control" value="${cls.capacity || 35}" min="1" max="150" />
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-save-edit-classroom">Save Changes</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-modal')?.addEventListener('click', close);
        modalBody.querySelector('#btn-save-edit-classroom')?.addEventListener('click', async () => {
          const section_id = modalBody.querySelector('#edit-cls-sec-select').value;
          const name = modalBody.querySelector('#edit-cls-name-input').value.trim();
          const room_number = modalBody.querySelector('#edit-cls-room-input').value.trim();
          const capacity = modalBody.querySelector('#edit-cls-cap-input').value;

          if (!name) {
            toast.error('Please enter a classroom name.');
            return;
          }

          await db.updateClassroom(classroomId, { section_id, name, room_number, capacity });
          toast.success(`Classroom "${name}" updated.`);
          close();
          await refreshData();
          renderActiveProgramView();
        });
      }
    });
  }

  renderFullUI();
}
