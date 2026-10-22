import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderSectionsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const programs = await db.getPrograms();
  const sections = await db.getSections();
  const classrooms = await db.getClassrooms();

  let selectedProgramId = programs[0]?.id || '';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Sections, Programs & Classrooms</h2>
        <p>Configurable dynamic hierarchy: Attendance Program → Section → Classroom</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-secondary" id="btn-add-section">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Section Category
          </button>
          <button class="btn btn-primary" id="btn-add-classroom">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Classroom
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Programs Selector Bar -->
    <div style="display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1.5rem;" id="programs-nav-bar">
      ${programs.map(p => `
        <button class="btn ${p.id === selectedProgramId ? 'btn-primary' : 'btn-outline'}" data-prog-id="${p.id}" style="border-radius: var(--radius-full);">
          ${p.name}
        </button>
      `).join('')}
    </div>

    <!-- Active Program Display Card -->
    <div id="program-sections-view">
      <!-- Populated dynamically -->
    </div>
  `;

  function renderActiveProgramView() {
    const viewContainer = container.querySelector('#program-sections-view');
    if (!viewContainer) return;

    const prog = programs.find(p => p.id === selectedProgramId);
    if (!prog) return;

    const progSections = sections.filter(s => s.program_id === prog.id);

    viewContainer.innerHTML = `
      <div class="card-panel" style="margin-bottom: 1.5rem;">
        <div class="card-panel-header">
          <div>
            <h3>${prog.name}</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${prog.description || 'Configurable institutional program'}</p>
          </div>
          <span class="badge badge-active">${prog.code}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.5rem;">
        ${progSections.map(sec => {
          const secClassrooms = classrooms.filter(c => c.section_id === sec.id);
          const genderBadge = sec.gender_eligibility === 'Boys' ? 'badge-leave' : sec.gender_eligibility === 'Girls' ? 'badge-pending' : 'badge-active';

          return `
            <div class="card-panel" style="margin-bottom: 0;">
              <div class="card-panel-header" style="background: var(--bg-surface-subtle); padding: 1rem 1.25rem;">
                <div>
                  <h4 style="font-size: 0.95rem; font-weight: 700;">${sec.name}</h4>
                  <span class="badge ${genderBadge}" style="margin-top: 0.35rem;">${sec.gender_eligibility}</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${secClassrooms.length} Classrooms</span>
              </div>
              <div class="card-panel-body" style="padding: 1rem 1.25rem;">
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  ${secClassrooms.map(c => `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <strong style="color: var(--text-primary);">${c.name}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${c.room_number || 'Room'} • Capacity: ${c.capacity}</div>
                      </div>
                      <button class="btn btn-outline btn-sm btn-manage-cls" data-cls-id="${c.id}">Manage</button>
                    </div>
                  `).join('') || '<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem;">No classrooms configured under this section yet.</div>'}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    viewContainer.querySelectorAll('.btn-manage-cls').forEach(btn => {
      btn.addEventListener('click', () => {
        onNavigate('assignments');
      });
    });
  }

  // Program tab clicking
  container.querySelectorAll('#programs-nav-bar button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedProgramId = btn.getAttribute('data-prog-id');
      container.querySelectorAll('#programs-nav-bar button').forEach(b => {
        b.className = b.getAttribute('data-prog-id') === selectedProgramId ? 'btn btn-primary' : 'btn btn-outline';
      });
      renderActiveProgramView();
    });
  });

  // Add Section Category Modal
  container.querySelector('#btn-add-section')?.addEventListener('click', () => {
    const prog = programs.find(p => p.id === selectedProgramId);
    openModal({
      title: `Create Section under ${prog?.name || 'Program'}`,
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Section / Category Name</label>
          <input type="text" id="sec-name-input" class="form-control" placeholder="e.g. Girls Moral Category 2, Coaching Group 6" required />
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
          <button class="btn btn-primary" id="btn-save-section">Create Section</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-section').addEventListener('click', async () => {
          const name = modalBody.querySelector('#sec-name-input').value.trim();
          const gender = modalBody.querySelector('#sec-gender-select').value;
          if (!name) {
            toast.error('Please enter a section name.');
            return;
          }
          await db.addSection({ program_id: selectedProgramId, name, gender_eligibility: gender });
          toast.success(`Section "${name}" added successfully.`);
          close();
          renderSectionsModule(container, { onNavigate });
        });
      }
    });
  });

  // Add Classroom Modal
  container.querySelector('#btn-add-classroom')?.addEventListener('click', () => {
    const progSections = sections.filter(s => s.program_id === selectedProgramId);
    if (progSections.length === 0) {
      toast.error('Please create at least one section before adding classrooms.');
      return;
    }

    openModal({
      title: 'Create Classroom',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Parent Section / Category</label>
          <select id="cls-sec-select" class="form-control">
            ${progSections.map(s => `<option value="${s.id}">${s.name} (${s.gender_eligibility})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Classroom Name</label>
          <input type="text" id="cls-name-input" class="form-control" placeholder="e.g. Moral Study Hall 3, Coaching Room B" required />
        </div>
        <div class="form-grid" style="margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Physical Room Number</label>
            <input type="text" id="cls-room-input" class="form-control" placeholder="e.g. Room 204" />
          </div>
          <div class="form-group">
            <label class="form-label">Student Capacity</label>
            <input type="number" id="cls-cap-input" class="form-control" value="35" min="1" max="100" />
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-classroom">Create Classroom</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-classroom').addEventListener('click', async () => {
          const section_id = modalBody.querySelector('#cls-sec-select').value;
          const name = modalBody.querySelector('#cls-name-input').value.trim();
          const room_number = modalBody.querySelector('#cls-room-input').value.trim();
          const capacity = modalBody.querySelector('#cls-cap-input').value;

          if (!name) {
            toast.error('Please enter a classroom name.');
            return;
          }

          await db.addClassroom({ section_id, name, room_number, capacity });
          toast.success(`Classroom "${name}" created successfully.`);
          close();
          renderSectionsModule(container, { onNavigate });
        });
      }
    });
  });

  renderActiveProgramView();
}
