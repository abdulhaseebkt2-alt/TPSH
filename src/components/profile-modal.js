import { db } from '../lib/db.js';
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/dialog.js';
import { updateCurrentUserProfile, getCurrentUser } from '../lib/auth.js';

export function openProfileModal({ profile, isInitialSetup = false, onSaved }) {
  if (!profile) return;

  const currentUser = getCurrentUser();
  const isSuper = Boolean(profile.is_super_admin || profile.role === 'super_admin' || (profile.email || '').toLowerCase() === 'abdulhaseebkt2@gmail.com');
  // Super Admin can edit the role of other users; Super Admin's own role never changes
  const canEditRole = Boolean(currentUser?.is_super_admin || currentUser?.role === 'super_admin') && !isSuper;

  let currentAvatarUrl = profile.avatar_url || '';
  let currentRole = isSuper ? 'super_admin' : (profile.role || 'teacher');
  let roleName = (currentRole || 'User').replace('_', ' ').toUpperCase();

  // Staff roles use TGI prefix with 3 digits; Student / Parent uses TPS
  let isStaff = isSuper || !currentRole || ['super_admin', 'admin', 'mentor', 'teacher'].includes(currentRole);
  let idPrefix = isStaff ? 'TGI' : 'TPS';

  const AVAILABLE_ROLES = [
    { value: 'teacher', label: 'Teacher (Class Attendance & Examination Marks)' },
    { value: 'mentor', label: 'Hostel Mentor / Warden (Hostel & Leave Register)' },
    { value: 'admin', label: 'School Admin (Academic & Records Administrator)' },
    { value: 'parent', label: 'Parent (Linked Student View Only)' },
    { value: 'student', label: 'Student (Self Records View Only)' }
  ];
  if (isSuper || currentRole === 'super_admin') {
    AVAILABLE_ROLES.unshift({ value: 'super_admin', label: 'Super Admin (Institutional Authority)' });
  }

  // Do NOT auto-fill dummy values into the cell.
  // Only pre-fill if the user already has a genuine 3-digit ID saved in the system.
  const hasGenuineSavedId = Boolean(
    profile.profile_completed &&
    profile.tps_id &&
    /^[A-Z]{3}\d{3}$/i.test(profile.tps_id)
  );
  const initialIdSuffix = hasGenuineSavedId ? profile.tps_id.replace(/\D/g, '').slice(-3) : '';

  // Do NOT auto-fill dummy phone numbers. Only pre-fill if user has a verified 10-digit phone.
  let rawPhoneDigits = (profile.phone || '').replace(/\D/g, '');
  if (rawPhoneDigits.length >= 12 && rawPhoneDigits.startsWith('91')) {
    rawPhoneDigits = rawPhoneDigits.slice(2);
  }
  const hasGenuinePhone = Boolean(profile.profile_completed && rawPhoneDigits.length === 10);
  const initialFormattedPhone = hasGenuinePhone ? formatIndianMobile(rawPhoneDigits) : '';

  const initialFullName = profile.full_name || '';
  const initialBloodGroup = (profile.profile_completed && profile.blood_group) ? profile.blood_group : '';

  openModal({
    title: isInitialSetup ? 'Complete Your Institutional Profile' : 'Institutional User Profile',
    contentHtml: `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${isInitialSetup ? `
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 0.85rem 1.15rem; display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #DBEAFE; color: #1D4ED8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <strong style="color: #1E40AF; font-size: 0.875rem;">Account Approved!</strong>
              <p style="color: #1E3A8A; font-size: 0.78rem; margin-top: 0.1rem;">
                Welcome to Thaiba Group of Institutions. Please fill in your profile details to finalize your access.
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Profile Top Summary & Photo Picker -->
        <div style="display: flex; align-items: center; gap: 1.25rem; padding: 1rem; background: var(--bg-surface-subtle); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
          <div style="position: relative;">
            <div id="profile-avatar-preview" style="width: 72px; height: 72px; border-radius: var(--radius-full); background: var(--brand-navy); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; border: 2px solid var(--brand-primary); overflow: hidden; box-shadow: var(--shadow-sm);">
              ${currentAvatarUrl ? `<img src="${currentAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Avatar" />` : (initialFullName || 'U')[0].toUpperCase()}
            </div>
            <label for="profile-photo-upload" style="position: absolute; bottom: -4px; right: -4px; width: 28px; height: 28px; border-radius: 50%; background: var(--brand-primary); color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);" title="Upload Photo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </label>
            <input type="file" id="profile-photo-upload" accept="image/*" style="display: none;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span id="header-role-badge" class="user-badge-role ${isSuper ? 'badge-super' : 'badge-approved'}">${roleName}</span>
              <span id="badge-tps-id" class="badge" style="background: ${initialIdSuffix ? '#EEF2FF' : '#F1F5F9'}; color: ${initialIdSuffix ? 'var(--brand-primary)' : '#64748B'}; border: 1px ${initialIdSuffix ? 'solid var(--brand-primary-border)' : 'dashed #CBD5E1'}; font-weight: 700;">
                ${idPrefix}${initialIdSuffix || '•••'}
              </span>
              ${canEditRole ? `
                <button type="button" id="btn-quick-edit-role" class="btn btn-outline btn-xs" style="font-size: 0.72rem; padding: 0.15rem 0.55rem; color: var(--brand-primary); border-color: var(--brand-primary-border); border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.25rem;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Edit Role
                </button>
              ` : ''}
            </div>
            <span style="font-size: 0.825rem; color: var(--text-muted);">${profile.email}</span>
            <span style="font-size: 0.72rem; color: var(--brand-primary); font-weight: 600;">Thaiba Group of Institutions (TGI) • Member</span>
          </div>
        </div>

        <!-- Form Fields with Fixed Prefixes, Role Editor & Light-Gray Placeholders -->
        <div class="form-grid">
          <!-- Full Name -->
          <div class="form-group">
            <label class="form-label required">Full Name</label>
            <input 
              type="text" 
              id="prof-full-name" 
              class="form-control" 
              value="${escapeHtml(initialFullName)}" 
              placeholder="Enter your full name" 
              autocomplete="off" 
              required 
            />
          </div>

          <!-- Institutional Role (Only shown for non-super admin profiles; Super Admin role is immutable) -->
          ${!isSuper ? `
            <div class="form-group">
              <label class="form-label required">Institutional Role</label>
              <select id="prof-role-select" class="form-control" ${!canEditRole ? 'disabled style="background: var(--bg-surface-subtle); cursor: not-allowed;"' : ''}>
                ${AVAILABLE_ROLES.map(r => `
                  <option value="${r.value}" ${currentRole === r.value ? 'selected' : ''}>${r.label}</option>
                `).join('')}
              </select>
              <small style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">
                ${canEditRole ? 'Institutional authority and permissions granted to this account' : 'Assigned by Super Admin (Read-only)'}
              </small>
            </div>
          ` : ''}

          <!-- Fixed Prefix TGI / TPS Staff ID with 3 Numbers Requirement -->
          <div class="form-group">
            <label class="form-label required" id="prof-id-label">${idPrefix} ID (Institutional ${isStaff ? 'Staff' : 'Student'} ID)</label>
            <div class="input-group-fixed">
              <span class="input-prefix-addon" id="prof-id-addon" title="${idPrefix} Fixed Prefix">${idPrefix}</span>
              <input 
                type="text" 
                id="prof-id-suffix" 
                class="form-control" 
                value="${escapeHtml(initialIdSuffix)}" 
                placeholder="001" 
                maxlength="3" 
                autocomplete="off" 
                required 
                style="font-weight: 700; letter-spacing: 0.05em;" 
              />
            </div>
            <small id="prof-prefix-note" style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">Prefix "${idPrefix}" is fixed. Enter exactly 3 numbers (e.g. 001)</small>
          </div>

          <!-- Fixed Prefix Phone Number with Official Spacing -->
          <div class="form-group">
            <label class="form-label required">Phone Number</label>
            <div class="input-group-fixed">
              <span class="input-prefix-addon" title="India Country Code (+91)">
                <svg width="18" height="13" viewBox="0 0 640 480" style="margin-right: 6px; border-radius: 2px;">
                  <path fill="#f93" d="M0 0h640v160H0z"/>
                  <path fill="#fff" d="M0 160h640v160H0z"/>
                  <path fill="#128807" d="M0 320h640v160H0z"/>
                  <circle cx="320" cy="240" r="40" fill="#008"/>
                </svg>
                +91
              </span>
              <input 
                type="tel" 
                id="prof-phone-number" 
                class="form-control" 
                value="${escapeHtml(initialFormattedPhone)}" 
                placeholder="98470 55667" 
                maxlength="11" 
                autocomplete="off" 
                required 
              />
            </div>
            <small style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">Country code +91 is fixed. Formatted automatically as 5-5 digits</small>
          </div>

          <!-- Blood Group -->
          <div class="form-group">
            <label class="form-label required">Blood Group</label>
            <select id="prof-blood-group" class="form-control" required>
              <option value="">Select Blood Group</option>
              ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => `
                <option value="${bg}" ${initialBloodGroup === bg ? 'selected' : ''}>${bg}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Read-Only Institutional Metadata -->
        <div style="background: var(--bg-surface-subtle); border-radius: var(--radius-md); padding: 0.85rem; border: 1px solid var(--border-subtle); font-size: 0.75rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div>• Institutional Email: <strong>${profile.email}</strong></div>
          <div>• Role Authority: <strong id="prof-info-role">${roleName}</strong></div>
          <div>• Account Status: <strong style="color: var(--brand-primary, #6358DC);">Approved & Active</strong></div>
          <div>• Database Verification: <strong>Verified</strong></div>
        </div>

        <!-- Real-Time Validation Status Notice & Save Actions -->
        <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 0.5rem;">
          <div id="prof-validation-notice" style="font-size: 0.78rem; border-radius: var(--radius-sm); padding: 0.55rem 0.85rem; background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; display: flex; align-items: center; gap: 0.5rem; transition: all var(--transition-fast);">
            <!-- Populated dynamically by updateValidity -->
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            ${!isInitialSetup ? `<button class="btn btn-outline" id="prof-cancel-btn" type="button">Cancel</button>` : ''}
            <button class="btn btn-primary" id="prof-save-btn" disabled type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Institutional Profile
            </button>
          </div>
        </div>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      const photoInput = modalBody.querySelector('#profile-photo-upload');
      const avatarPreview = modalBody.querySelector('#profile-avatar-preview');
      const nameInput = modalBody.querySelector('#prof-full-name');
      const roleSelect = modalBody.querySelector('#prof-role-select');
      const idSuffixInput = modalBody.querySelector('#prof-id-suffix');
      const phoneInput = modalBody.querySelector('#prof-phone-number');
      const bloodGroupSelect = modalBody.querySelector('#prof-blood-group');
      const saveBtn = modalBody.querySelector('#prof-save-btn');
      const noticeBox = modalBody.querySelector('#prof-validation-notice');
      const badgeTps = modalBody.querySelector('#badge-tps-id');
      const headerRoleBadge = modalBody.querySelector('#header-role-badge');
      const infoRole = modalBody.querySelector('#prof-info-role');
      const idLabel = modalBody.querySelector('#prof-id-label');
      const idAddon = modalBody.querySelector('#prof-id-addon');
      const prefixNote = modalBody.querySelector('#prof-prefix-note');

      // Quick "Edit Role" button focuses the role select
      modalBody.querySelector('#btn-quick-edit-role')?.addEventListener('click', () => {
        if (roleSelect) {
          roleSelect.focus();
          const customTrigger = roleSelect.nextElementSibling;
          if (customTrigger && customTrigger.classList.contains('tps-custom-select-trigger')) {
            customTrigger.click();
          }
        }
      });

      // Photo Upload Preview Handler
      photoInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 3 * 1024 * 1024) {
            toast.error('Image size must be under 3MB');
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
            currentAvatarUrl = evt.target?.result;
            avatarPreview.innerHTML = `<img src="${currentAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Avatar" />`;
          };
          reader.readAsDataURL(file);
        }
      });

      // Role Change Handler: dynamically update badge, prefix, and info box
      roleSelect?.addEventListener('change', () => {
        const newRole = roleSelect.value;
        const newRoleName = (newRole || 'User').replace('_', ' ').toUpperCase();

        if (headerRoleBadge) {
          headerRoleBadge.innerText = newRoleName;
          headerRoleBadge.className = `user-badge-role ${newRole === 'super_admin' ? 'badge-super' : 'badge-approved'}`;
        }

        if (infoRole) {
          infoRole.innerText = newRoleName;
        }

        const newIsStaff = ['super_admin', 'admin', 'mentor', 'teacher'].includes(newRole);
        idPrefix = newIsStaff ? 'TGI' : 'TPS';

        if (idLabel) idLabel.innerText = `${idPrefix} ID (Institutional ${newIsStaff ? 'Staff' : 'Student'} ID)`;
        if (idAddon) idAddon.innerText = idPrefix;
        if (prefixNote) prefixNote.innerText = `Prefix "${idPrefix}" is fixed. Enter exactly 3 numbers (e.g. 001)`;

        updateValidity();
      });

      // Real-Time Form Validation Function
      function updateValidity() {
        const fullName = nameInput ? nameInput.value.trim() : '';
        const idDigits = idSuffixInput ? idSuffixInput.value.replace(/\D/g, '') : '';
        const phoneDigits = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
        const blood = bloodGroupSelect ? bloodGroupSelect.value : '';

        const hasName = fullName.length >= 2;
        const hasId = idDigits.length === 3;
        const hasPhone = phoneDigits.length === 10;
        const hasBlood = Boolean(blood);

        const isValid = hasName && hasId && hasPhone && hasBlood;

        // Update top badge dynamically
        if (badgeTps) {
          if (hasId) {
            badgeTps.innerText = idPrefix + idDigits;
            badgeTps.style.background = '#EEF2FF';
            badgeTps.style.color = '#3742FA';
            badgeTps.style.border = '1px solid #C7D2FE';
          } else {
            badgeTps.innerText = idPrefix + (idDigits ? idDigits.padEnd(3, '•') : '•••');
            badgeTps.style.background = '#F1F5F9';
            badgeTps.style.color = '#64748B';
            badgeTps.style.border = '1px dashed #CBD5E1';
          }
        }

        // Enable or disable Save button
        if (saveBtn) {
          saveBtn.disabled = !isValid;
          if (isValid) {
            saveBtn.classList.remove('btn-disabled');
          } else {
            saveBtn.classList.add('btn-disabled');
          }
        }

        // Update notice banner
        if (noticeBox) {
          if (isValid) {
            noticeBox.style.background = 'var(--brand-primary-light, #F0EEFD)';
            noticeBox.style.color = 'var(--text-primary, #1E1B4B)';
            noticeBox.style.border = '1px solid var(--brand-primary-border, #D8D2FB)';
            noticeBox.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span><strong>Ready to save:</strong> All required institutional details have been entered correctly.</span>
            `;
          } else {
            noticeBox.style.background = '#FEF2F2';
            noticeBox.style.color = '#991B1B';
            noticeBox.style.border = '1px solid #FECACA';

            const pending = [];
            if (!hasName) pending.push('Full Name');
            if (!hasId) pending.push(`3-digit ${idPrefix} ID (${idDigits.length}/3)`);
            if (!hasPhone) pending.push(`10-digit Phone (${phoneDigits.length}/10)`);
            if (!hasBlood) pending.push('Blood Group');

            noticeBox.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Cannot save yet. Please complete: <strong style="color: #B91C1C;">${pending.join(', ')}</strong></span>
            `;
          }
        }

        return isValid;
      }

      // Input event handlers
      idSuffixInput?.addEventListener('input', () => {
        const digitsOnly = idSuffixInput.value.replace(/\D/g, '').slice(0, 3);
        idSuffixInput.value = digitsOnly;
        updateValidity();
      });

      phoneInput?.addEventListener('input', () => {
        const formatted = formatIndianMobile(phoneInput.value);
        phoneInput.value = formatted;
        updateValidity();
      });

      nameInput?.addEventListener('input', updateValidity);
      bloodGroupSelect?.addEventListener('change', updateValidity);

      // Run validation check immediately on open
      updateValidity();

      modalBody.querySelector('#prof-cancel-btn')?.addEventListener('click', close);

      modalBody.querySelector('#prof-save-btn')?.addEventListener('click', async () => {
        if (!updateValidity()) {
          toast.error('Please enter all required details correctly before saving.');
          return;
        }

        const fullName = nameInput.value.trim();
        const idDigits = idSuffixInput.value.replace(/\D/g, '');
        const rawPhoneDigits = phoneInput.value.replace(/\D/g, '');
        const bloodGroup = bloodGroupSelect.value;
        const selectedRole = roleSelect ? roleSelect.value : (isSuper ? 'super_admin' : (profile.role || 'teacher'));

        const currentPrefix = (['super_admin', 'admin', 'mentor', 'teacher'].includes(selectedRole)) ? 'TGI' : 'TPS';
        const fullInstitutionalId = currentPrefix + idDigits;
        const formattedMobile = '+91 ' + formatIndianMobile(rawPhoneDigits);

        saveBtn.disabled = true;
        saveBtn.classList.add('btn-disabled');
        saveBtn.innerText = 'Saving...';

        try {
          const updated = await db.updateProfile(profile.id, {
            full_name: fullName,
            phone: formattedMobile,
            avatar_url: currentAvatarUrl,
            blood_group: bloodGroup,
            tps_id: fullInstitutionalId
          });

          // Update role if authorized
          if (canEditRole && selectedRole) {
            await db.updateUserApproval(profile.id, {
              approval_status: profile.approval_status || 'approved',
              role: selectedRole
            });
          }

          // Update current user session memory if self
          const loggedInUser = getCurrentUser();
          if (loggedInUser?.id === profile.id || loggedInUser?.email === profile.email) {
            updateCurrentUserProfile({
              ...profile,
              full_name: fullName,
              phone: formattedMobile,
              avatar_url: currentAvatarUrl,
              blood_group: bloodGroup,
              tps_id: fullInstitutionalId,
              role: selectedRole,
              profile_completed: true
            });
          }

          toast.success(`Profile & Role saved successfully (${fullInstitutionalId})`);
          close();
          if (onSaved) onSaved({ ...updated, role: selectedRole });
        } catch (err) {
          toast.error('Failed to save profile: ' + (err.message || 'Unknown error'));
          updateValidity();
          saveBtn.innerText = 'Save Institutional Profile';
        }
      });
    }
  });
}

// Formats a 10-digit Indian mobile number with official 5-5 spacing: XXXXX XXXXX
function formatIndianMobile(val) {
  const digits = String(val || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length > 5) {
    return digits.slice(0, 5) + ' ' + digits.slice(5);
  }
  return digits;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
