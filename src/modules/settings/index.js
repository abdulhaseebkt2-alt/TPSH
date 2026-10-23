import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { getCurrentUser } from '../../lib/auth.js';
import { openCropModal } from '../../components/crop-modal.js';
import { updateSidebarLogo } from '../../components/sidebar.js';

export async function renderSettingsModule(container, { onNavigate }) {
  const user = getCurrentUser();
  if (!user?.is_super_admin && user?.role !== 'super_admin') {
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon" style="color: #DC2626; display: flex; justify-content: center; margin-bottom: 1rem;">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h4>Institution Settings Restricted</h4>
        <p>Only the verified Initial Super Admin can modify institutional settings.</p>
      </div>
    `;
    return;
  }

  let currentLogo = localStorage.getItem('tps_institution_logo') || '';
  let currentMobileLogo = localStorage.getItem('tps_mobile_front_logo') || '';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Institution Settings & Governance Policy</h2>
        <p>Thaiba Public School institutional profile, system timezone, and automation configurations</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-save-settings">Save Institution Policy</button>
      </div>
    </div>

    <!-- School Profile Card -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>School Institutional Profile</h3>
      </div>
      <div class="card-panel-body">
        <!-- Logo Upload & 3:3 Ratio Section -->
        <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.15rem; background: var(--bg-surface-subtle); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); margin-bottom: 1.5rem; flex-wrap: wrap;">
          <div style="position: relative;">
            <div id="inst-logo-preview" style="width: 88px; height: 88px; border-radius: var(--radius-md); background: #FFFFFF; border: 2px solid var(--border-medium); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: var(--shadow-sm);">
              ${currentLogo ? `<img src="${currentLogo}" style="width: 100%; height: 100%; object-fit: cover;" alt="Institution Logo" />` : `<img src="/tps-logo.png" style="width: 100%; height: 100%; object-fit: contain;" alt="Default Logo" />`}
            </div>
            <label for="inst-logo-file-input" style="position: absolute; bottom: -6px; right: -6px; width: 30px; height: 30px; border-radius: 50%; background: #059669; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Upload & Crop Logo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </label>
            <input type="file" id="inst-logo-file-input" accept="image/*" style="display: none;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <strong style="font-size: 0.95rem;">Institution Official Logo</strong>
              <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700;">Format: Flexible (1:1 or Banner)</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
              Upload your official institution logo. You can crop to 1:1 square or keep the full original image as-is.
            </p>
            <div style="display: flex; align-items: center; gap: 0.65rem; margin-top: 0.25rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline" id="btn-trigger-upload">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Logo
              </button>
              ${currentLogo ? `
                <button class="btn btn-sm btn-secondary" id="btn-recrop-logo">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>
                  Adjust / Crop Logo
                </button>
                <button class="btn btn-sm btn-outline" id="btn-remove-logo" style="color: #DC2626; border-color: #FECACA;">
                  Remove Logo
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Mobile View Front Logo Upload & 3:3 Ratio Section -->
        <div style="display: flex; align-items: center; gap: 1.5rem; padding: 1.15rem; background: var(--bg-surface-subtle); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); margin-bottom: 1.5rem; flex-wrap: wrap;">
          <div style="position: relative;">
            <div id="mobile-logo-preview" style="width: 140px; height: 76px; border-radius: var(--radius-md); background: #FFFFFF; border: 2px solid var(--border-medium); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: var(--shadow-sm); padding: 4px;">
              <img src="${currentMobileLogo || '/tps-logo.png'}" style="width: 100%; height: 100%; object-fit: contain;" alt="Mobile Front Logo" />
            </div>
            <label for="mobile-logo-file-input" style="position: absolute; bottom: -6px; right: -6px; width: 30px; height: 30px; border-radius: 50%; background: #059669; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Upload Mobile Front Logo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </label>
            <input type="file" id="mobile-logo-file-input" accept="image/*" style="display: none;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <strong style="font-size: 0.95rem;">Mobile View Front Logo (Login & Mobile Portal Header)</strong>
              <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700;">Format: Free / Any Aspect Ratio</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
              Upload your institutional logo for the mobile view and front login portal. Any aspect ratio (horizontal, banner, or square) is accepted directly without restriction.
            </p>
            <div style="display: flex; align-items: center; gap: 0.65rem; margin-top: 0.25rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline" id="btn-trigger-mobile-upload">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Mobile Front Logo
              </button>
              ${currentMobileLogo ? `
                <button class="btn btn-sm btn-outline" id="btn-reset-mobile-logo" style="color: #DC2626; border-color: #FECACA;">
                  Reset to Default
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Institution Full Name</label>
            <input type="text" class="form-control" id="set-name" value="Thaiba Public School" />
          </div>
          <div class="form-group">
            <label class="form-label required">Tagline / Motto</label>
            <input type="text" class="form-control" id="set-tagline" value="Modern Education with Morality" />
          </div>
          <div class="form-group">
            <label class="form-label required">Initial Super Admin Email</label>
            <input type="email" class="form-control" value="abdulhaseebkt2@gmail.com" readonly style="background: var(--bg-surface-subtle); font-weight: 700;" />
          </div>
          <div class="form-group">
            <label class="form-label required">Institution Timezone</label>
            <input type="text" class="form-control" value="Asia/Kolkata (IST)" readonly style="background: var(--bg-surface-subtle);" />
          </div>
        </div>
      </div>
    </div>

    <!-- Attendance Automation Rules -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Attendance Timing & Automation Rules</h3>
      </div>
      <div class="card-panel-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Attendance Window Opens (Minutes Before)</label>
            <input type="number" class="form-control" id="set-att-open" value="5" min="0" max="60" />
          </div>
          <div class="form-group">
            <label class="form-label required">Attendance Window Closes (Minutes After)</label>
            <input type="number" class="form-control" id="set-att-close" value="15" min="5" max="120" />
          </div>
          <div class="form-group">
            <label class="form-label required">Auto-Finalize Overdue Teacher Absence</label>
            <select class="form-control" id="set-att-auto-absent">
              <option value="true" selected>Enabled (System marks teacher Auto-Absent if deadline missed)</option>
              <option value="false">Disabled (Manual administrative review required)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Fine Rules -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>Hostel Late-Return Fine Calculation Rules</h3>
      </div>
      <div class="card-panel-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Default Fine Rate Per Late Day (₹)</label>
            <input type="number" class="form-control" id="set-fine-rate" value="200" min="0" step="50" />
          </div>
          <div class="form-group">
            <label class="form-label required">Calculation Policy</label>
            <input type="text" class="form-control" value="Calendar Date Difference: MAX(0, Return Date - Expected Date)" readonly style="background: var(--bg-surface-subtle);" />
          </div>
        </div>
      </div>
    </div>

    <!-- Cloud Database & Supabase Sync -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          <h3>Cloud Database (Supabase PostgreSQL)</h3>
        </div>
        <span class="badge" style="background: #ECFDF5; color: #065F46; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
          Connected
        </span>
      </div>
      <div class="card-panel-body">
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          All student records, hostel registers, and institutional data are synchronized directly to your live Supabase cloud database (<strong>txbjraknaaokenyvbaak.supabase.co</strong>).
        </p>
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1rem; background: var(--bg-surface-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">Manual Cloud Synchronization</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Push all local browser cache records directly into Supabase PostgreSQL</div>
          </div>
          <button class="btn btn-primary" id="btn-sync-supabase">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            Sync All Data to Supabase
          </button>
        </div>
      </div>
    </div>
  `;

  const fileInput = container.querySelector('#inst-logo-file-input');

  container.querySelector('#btn-trigger-upload')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo image must be smaller than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      const testImg = new Image();

      testImg.onload = () => {
        const w = testImg.naturalWidth;
        const h = testImg.naturalHeight;
        const ratio = w / h;

        // Check if image is already 3:3 (1:1 square) within 2% margin
        const isSquare = Math.abs(ratio - 1) < 0.02;

        if (isSquare) {
          saveAndApplyLogo(dataUrl);
          toast.success(`Institution logo applied successfully! (${w}×${h} px)`);
        } else {
          openCropModal({
            imageUrl: dataUrl,
            title: 'Crop or Keep Original Institution Logo',
            onCropped: (resultDataUrl) => {
              saveAndApplyLogo(resultDataUrl);
              toast.success('Institution logo updated successfully!');
            }
          });
        }
      };

      testImg.src = dataUrl;
    };

    reader.readAsDataURL(file);
    // Reset file input value so selecting the same file again triggers change
    fileInput.value = '';
  });

  // Re-crop button handler
  container.querySelector('#btn-recrop-logo')?.addEventListener('click', () => {
    if (!currentLogo) return;
    openCropModal({
      imageUrl: currentLogo,
      title: 'Adjust or Crop Institution Logo',
      onCropped: (resultDataUrl) => {
        saveAndApplyLogo(resultDataUrl);
        toast.success('Institution logo updated successfully!');
      }
    });
  });

  // Remove logo button handler
  container.querySelector('#btn-remove-logo')?.addEventListener('click', () => {
    localStorage.removeItem('tps_institution_logo');
    currentLogo = '';
    updateSidebarLogo(null);
    toast.success('Institution logo removed. Default badge restored.');
    renderSettingsModule(container, { onNavigate });
  });

  function saveAndApplyLogo(logoUrl) {
    currentLogo = logoUrl;
    localStorage.setItem('tps_institution_logo', logoUrl);
    updateSidebarLogo(logoUrl);
    renderSettingsModule(container, { onNavigate });
  }

  // Mobile Front Logo Upload Logic
  const mobileFileInput = container.querySelector('#mobile-logo-file-input');
  container.querySelector('#btn-trigger-mobile-upload')?.addEventListener('click', () => {
    mobileFileInput?.click();
  });

  mobileFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo image must be smaller than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      saveAndApplyMobileLogo(dataUrl);
      toast.success('Mobile view front logo applied successfully (any aspect ratio supported)!');
    };

    reader.readAsDataURL(file);
    mobileFileInput.value = '';
  });

    container.querySelector('#btn-reset-mobile-logo')?.addEventListener('click', () => {
    localStorage.removeItem('tps_mobile_front_logo');
    currentMobileLogo = '';
    toast.success('Mobile front logo reset to official default Thaiba emblem.');
    renderSettingsModule(container, { onNavigate });
  });

  function saveAndApplyMobileLogo(logoUrl) {
    currentMobileLogo = logoUrl;
    localStorage.setItem('tps_mobile_front_logo', logoUrl);
    renderSettingsModule(container, { onNavigate });
  }

  container.querySelector('#btn-save-settings')?.addEventListener('click', () => {
    toast.success('Institutional settings and attendance policies saved successfully.');
  });

  container.querySelector('#btn-sync-supabase')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-sync-supabase');
    btn.disabled = true;
    btn.textContent = 'Syncing to Supabase...';
    toast.info('Starting cloud database synchronization...');
    try {
      const res = await db.syncAllToSupabase();
      if (res.success) {
        const photoMsg = res.stats?.photos ? ` and ${res.stats.photos} photos to Storage` : '';
        toast.success(`Cloud sync completed! Synced ${res.stats?.students || 0} students${photoMsg} to Supabase.`);
      } else {
        toast.error(`Sync error: ${res.message || res.error || 'Failed'}`);
      }
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Sync All Data to Supabase`;
    }
  });
}
