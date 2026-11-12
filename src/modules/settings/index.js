import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { getCurrentUser } from '../../lib/auth.js';
import { openCropModal } from '../../components/crop-modal.js';
import { updateSidebarLogo } from '../../components/sidebar.js';
import { applyInstitutionalAppIcon } from '../../app.js';
import { getSavedLogo, optimizeLogoImage } from '../../lib/logo-utils.js';
import { showPrivacyPolicyModal, showTermsOfServiceModal, GRIEVANCE_OFFICER } from '../legal/index.js';

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

  await db.pullCloudKeys(['tps_institution_logo', 'tps_mobile_front_logo']);
  let currentLogo = getSavedLogo('tps_institution_logo');
  let currentMobileLogo = getSavedLogo('tps_mobile_front_logo');

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
              ${currentLogo ? `<img src="${currentLogo}" onerror="this.onerror=null; this.src='/tps-logo.png';" style="width: 100%; height: 100%; object-fit: cover;" alt="Institution Logo" />` : `<img src="/tps-logo.png" style="width: 100%; height: 100%; object-fit: contain;" alt="Default Logo" />`}
            </div>
            <label for="inst-logo-file-input" style="position: absolute; bottom: -6px; right: -6px; width: 30px; height: 30px; border-radius: 50%; background: #059669; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Upload & Crop Logo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </label>
            <input type="file" id="inst-logo-file-input" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*" style="position: absolute; opacity: 0; width: 0.1px; height: 0.1px; pointer-events: none;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <strong style="font-size: 0.95rem;">Institution Official Logo</strong>
              <span class="badge" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 700;">Format: Flexible (1:1 or Banner)</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
              Upload your official institution logo. You can crop to 1:1 square or keep the full original image as-is.
            </p>
            <div style="font-size: 0.74rem; color: #059669; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; margin-top: 0.15rem;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Updating logo automatically synchronizes web favicon, app icons, and cloud settings.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.65rem; margin-top: 0.25rem; flex-wrap: wrap;">
              <label for="inst-logo-file-input" class="btn btn-sm btn-outline" id="btn-trigger-upload" style="cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Logo
              </label>
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
              <img src="${currentMobileLogo || 'tps-full-logo.png'}" onerror="this.onerror=null; this.src='tps-full-logo.png'; this.onerror=function(){this.src='tps-logo.png';};" style="width: 100%; height: 100%; object-fit: contain;" alt="Mobile Front Logo" />
            </div>
            <label for="mobile-logo-file-input" style="position: absolute; bottom: -6px; right: -6px; width: 30px; height: 30px; border-radius: 50%; background: #059669; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Upload Mobile Front Logo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </label>
            <input type="file" id="mobile-logo-file-input" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*" style="display: none;" />
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
              <button type="button" class="btn btn-sm btn-outline" id="btn-trigger-mobile-upload" style="cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Mobile Front Logo
              </button>
              ${currentMobileLogo ? `
                <button type="button" class="btn btn-sm btn-outline" id="btn-reset-mobile-logo" style="color: #DC2626; border-color: #FECACA;">
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

    <!-- Account Security & Password -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <h3>Account Security & Login Password</h3>
        </div>
        <span class="badge" style="background: #EEF2FF; color: #4338CA; font-weight: 700;">
          ${user?.email || 'Logged In Account'}
        </span>
      </div>
      <div class="card-panel-body">
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Set or update your institutional login password to sign in directly with email (<strong>${user?.email || ''}</strong>).
        </p>
        <form id="settings-password-form" style="max-width: 520px; display: flex; flex-direction: column; gap: 0.85rem;">
          <div class="form-group">
            <label class="form-label required" for="settings-new-pw">New Password</label>
            <div style="position: relative;">
              <input type="password" id="settings-new-pw" class="form-control" placeholder="Enter at least 6 characters" minlength="6" required style="padding-right: 2.5rem;" />
              <button type="button" id="toggle-settings-new-pw" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748B; padding: 4px;" title="Show/Hide">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label required" for="settings-confirm-pw">Confirm New Password</label>
            <div style="position: relative;">
              <input type="password" id="settings-confirm-pw" class="form-control" placeholder="Re-enter new password" minlength="6" required style="padding-right: 2.5rem;" />
              <button type="button" id="toggle-settings-confirm-pw" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748B; padding: 4px;" title="Show/Hide">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
          <div style="display: flex; gap: 0.65rem; align-items: center; margin-top: 0.25rem;">
            <button type="submit" class="btn btn-primary" id="btn-save-settings-pw" style="background: #4F46E5; border-color: #4F46E5;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
              Update Password
            </button>
            <span id="settings-pw-msg" style="font-size: 0.78rem; font-weight: 600; color: #059669;"></span>
          </div>
        </form>
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

    <!-- DPDP Act 2023 & Legal Compliance Card -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <h3>Data Privacy, DPDP Act 2023 & Legal Governance</h3>
        </div>
        <span class="badge badge-present" style="font-weight: 700;">DPDP Active</span>
      </div>
      <div class="card-panel-body">
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Thaiba Public School & Residential Hostel processes minor student and guardian personal data in strict compliance with India's <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.85rem; margin-bottom: 1.25rem;">
          <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.85rem;">
            <strong style="font-size: 0.85rem; color: var(--text-primary); display: block; margin-bottom: 0.25rem;">Section 9: Verifiable Parental Consent</strong>
            <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted);">
              All linked children require documented guardian relationship & verification in the Users / Approvals console.
            </p>
          </div>
          <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.85rem;">
            <strong style="font-size: 0.85rem; color: var(--text-primary); display: block; margin-bottom: 0.25rem;">Section 12: Data Portability & Erasure</strong>
            <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted);">
              Parents & administrators can export JSON PII bundles or initiate statutory record anonymization from Student profiles.
            </p>
          </div>
          <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.85rem;">
            <strong style="font-size: 0.85rem; color: var(--text-primary); display: block; margin-bottom: 0.25rem;">Grievance Redressal Officer</strong>
            <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted);">
              ${GRIEVANCE_OFFICER.email} • ${GRIEVANCE_OFFICER.phone}
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline" id="btn-view-privacy-policy" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            View Privacy Policy
          </button>
          <button type="button" class="btn btn-outline" id="btn-view-terms" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            View Terms of Service
          </button>
        </div>
      </div>
    </div>
  `;

  const fileInput = container.querySelector('#inst-logo-file-input');

  container.querySelector('#btn-trigger-upload')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Logo image must be smaller than 15MB');
      return;
    }

    try {
      const optimizedDataUrl = await optimizeLogoImage(file, { maxWidth: 600, maxHeight: 600 });
      const testImg = new Image();

      testImg.onload = () => {
        const w = testImg.naturalWidth;
        const h = testImg.naturalHeight;
        const ratio = w / h;

        // Check if image is already 3:3 (1:1 square) within 2% margin
        const isSquare = Math.abs(ratio - 1) < 0.02;

        if (isSquare) {
          saveAndApplyLogo(optimizedDataUrl);
          toast.success(`Institution logo applied successfully! (${w}×${h} px)`);
        } else {
          openCropModal({
            imageUrl: optimizedDataUrl,
            title: 'Crop or Keep Original Institution Logo',
            onCropped: (resultDataUrl) => {
              saveAndApplyLogo(resultDataUrl);
              toast.success('Institution logo updated successfully!');
            }
          });
        }
      };

      testImg.src = optimizedDataUrl;
    } catch (err) {
      console.error('Error loading logo:', err);
      toast.error('Could not process image file: ' + (err.message || 'Unknown error'));
    } finally {
      fileInput.value = '';
    }
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
  container.querySelector('#btn-remove-logo')?.addEventListener('click', async () => {
    try {
      localStorage.removeItem('tps_institution_logo');
    } catch (e) {}
    currentLogo = '';
    updateSidebarLogo(null);
    applyInstitutionalAppIcon(null);
    await db.pushCloudKey('tps_institution_logo', null);
    toast.success('Institution logo removed. Default badge restored.');
    renderSettingsModule(container, { onNavigate });
  });

  async function saveAndApplyLogo(logoUrl) {
    currentLogo = logoUrl;
    try {
      localStorage.setItem('tps_institution_logo', logoUrl);
    } catch (err) {
      console.warn('LocalStorage quota warning for inst logo:', err);
    }
    updateSidebarLogo(logoUrl);
    applyInstitutionalAppIcon(logoUrl);
    await db.pushCloudKey('tps_institution_logo', logoUrl);
    renderSettingsModule(container, { onNavigate });
  }

  // Mobile Front Logo Upload Logic
  const mobileFileInput = container.querySelector('#mobile-logo-file-input');
  container.querySelector('#btn-trigger-mobile-upload')?.addEventListener('click', () => {
    mobileFileInput?.click();
  });

  mobileFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Logo image must be smaller than 15MB');
      return;
    }

    const uploadBtn = container.querySelector('#btn-trigger-mobile-upload');
    const prevHtml = uploadBtn ? uploadBtn.innerHTML : '';
    if (uploadBtn) {
      uploadBtn.innerHTML = `<span>Optimizing & Applying...</span>`;
    }

    try {
      const optimizedDataUrl = await optimizeLogoImage(file, { maxWidth: 800, maxHeight: 320 });
      await saveAndApplyMobileLogo(optimizedDataUrl);
      toast.success('Mobile view front logo applied successfully (any aspect ratio supported)!');
    } catch (err) {
      console.error('Error optimizing mobile logo:', err);
      toast.error('Failed to apply mobile front logo: ' + (err.message || 'Unknown error'));
      if (uploadBtn) uploadBtn.innerHTML = prevHtml;
    } finally {
      mobileFileInput.value = '';
    }
  });

  container.querySelector('#btn-reset-mobile-logo')?.addEventListener('click', async () => {
    try {
      localStorage.removeItem('tps_mobile_front_logo');
    } catch (e) {}
    currentMobileLogo = '';
    applyInstitutionalAppIcon(null);
    await db.pushCloudKey('tps_mobile_front_logo', null);
    toast.success('Mobile front logo reset to official default Thaiba emblem.');
    renderSettingsModule(container, { onNavigate });
  });

  async function saveAndApplyMobileLogo(logoUrl) {
    currentMobileLogo = logoUrl;
    try {
      localStorage.setItem('tps_mobile_front_logo', logoUrl);
    } catch (err) {
      console.warn('LocalStorage quota warning for mobile logo:', err);
    }
    applyInstitutionalAppIcon(logoUrl);
    await db.pushCloudKey('tps_mobile_front_logo', logoUrl);
    renderSettingsModule(container, { onNavigate });
  }

  // Settings Password Update Handler
  const pwForm = container.querySelector('#settings-password-form');
  const inputNewPw = container.querySelector('#settings-new-pw');
  const inputConfirmPw = container.querySelector('#settings-confirm-pw');
  const toggleNewBtn = container.querySelector('#toggle-settings-new-pw');
  const toggleConfirmBtn = container.querySelector('#toggle-settings-confirm-pw');
  const pwMsg = container.querySelector('#settings-pw-msg');

  const toggleVisibility = (inputEl, btnEl) => {
    if (!inputEl) return;
    const isPw = inputEl.getAttribute('type') === 'password';
    inputEl.setAttribute('type', isPw ? 'text' : 'password');
    btnEl.innerHTML = isPw
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  };

  toggleNewBtn?.addEventListener('click', () => toggleVisibility(inputNewPw, toggleNewBtn));
  toggleConfirmBtn?.addEventListener('click', () => toggleVisibility(inputConfirmPw, toggleConfirmBtn));

  pwForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPw = inputNewPw?.value?.trim() || '';
    const confirmPw = inputConfirmPw?.value?.trim() || '';

    if (newPw.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match. Please re-enter.');
      return;
    }

    const saveBtn = container.querySelector('#btn-save-settings-pw');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = 'Updating...';
    }

    try {
      if (user?.id) {
        await db.setUserPassword(user.id, newPw);
        toast.success('Your account password has been updated successfully!');
        if (pwMsg) pwMsg.innerText = '✓ Password updated';
        inputNewPw.value = '';
        inputConfirmPw.value = '';
      } else {
        toast.error('User identity not recognized.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg> Update Password`;
      }
    }
  });

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

  container.querySelector('#btn-view-privacy-policy')?.addEventListener('click', () => {
    showPrivacyPolicyModal();
  });

  container.querySelector('#btn-view-terms')?.addEventListener('click', () => {
    showTermsOfServiceModal();
  });
}
