import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';
import { STANDARD_CLASSES, normalizeClassPattern, compressImage } from '../../lib/utils.js';

export async function renderAdmissionsModule(container, { onNavigate }) {
  const existingStudents = await db.getStudents();
  const nextAdmissionNo = 'TPS-2026-' + String(existingStudents.length + 1).padStart(3, '0');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Student Admission & Master Registration</h2>
        <p>Enroll new student with academic, address, parent, and hostel residential details</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" id="btn-back-directory">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Student Directory
        </button>
      </div>
    </div>

    <div class="card-panel">
      <div class="card-panel-header">
        <h3>New Admission Form — <code>${nextAdmissionNo}</code></h3>
        <span class="badge badge-active">Academic Year 2026-2027</span>
      </div>

      <div class="card-panel-body">
        <form id="admission-form">
          <!-- SECTION 1: BASIC INFORMATION -->
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
            1. Student Basic Information
          </h4>

          <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
            <!-- Photo Upload with Preview -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <div id="photo-preview-box" style="width: 120px; height: 140px; border: 2px dashed var(--border-medium); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-surface-subtle); overflow: hidden; position: relative;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem;">Student Photo</span>
                <img id="photo-img-tag" style="display: none; width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <input type="file" id="student-photo-input" accept="image/*" style="display: none;" />
              <button type="button" class="btn btn-outline btn-sm" id="btn-browse-photo">Upload Photo</button>
            </div>

            <!-- Basic Fields -->
            <div style="flex: 1; min-width: 280px;" class="form-grid">
              <div class="form-group">
                <label class="form-label required">Admission Number</label>
                <input type="text" class="form-control" id="adm-number" value="${nextAdmissionNo}" readonly style="background: var(--bg-surface-subtle); font-weight: 700;" />
              </div>

              <div class="form-group">
                <label class="form-label required">Full Name of Student</label>
                <input type="text" class="form-control" id="adm-fullname" placeholder="e.g. Muhammad Rayyan" required />
              </div>

              <div class="form-group">
                <label class="form-label required">Gender</label>
                <select class="form-control" id="adm-gender" required>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label required">Date of Birth</label>
                <input type="date" class="form-control" id="adm-dob" required />
              </div>

              <div class="form-group">
                <label class="form-label required">Admission Date</label>
                <input type="date" class="form-control" id="adm-date" value="${new Date().toISOString().split('T')[0]}" required />
              </div>

              <div class="form-group">
                <label class="form-label required">Actual School Class</label>
                <select class="form-control" id="adm-class" required>
                  ${STANDARD_CLASSES.map(cls => `<option value="${cls}" ${cls === 'STD-VIII' ? 'selected' : ''}>${cls}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label required">School Section</label>
                <select class="form-control" id="adm-section" required>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label required">Hostel Status</label>
                <select class="form-control" id="adm-hostel-status" required>
                  <option value="resident">Hostel Resident</option>
                  <option value="day_scholar">Day Scholar</option>
                </select>
              </div>
            </div>
          </div>

          <!-- SECTION 2: ADDRESS & NATIVE PLACE -->
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem; margin-top: 1.5rem;">
            2. Native Address & Location Details
          </h4>

          <div class="form-grid" style="margin-bottom: 1.5rem;">
            <div class="form-group">
              <label class="form-label required">Village / Town</label>
              <input type="text" class="form-control" id="adm-village" placeholder="e.g. Edavanna" required />
            </div>

            <div class="form-group">
              <label class="form-label required">Post Office</label>
              <input type="text" class="form-control" id="adm-postoffice" placeholder="e.g. Edavanna P.O." required />
            </div>

            <div class="form-group">
              <label class="form-label required">District</label>
              <input type="text" class="form-control" id="adm-district" value="Malappuram" required />
            </div>

            <div class="form-group">
              <label class="form-label required">State</label>
              <input type="text" class="form-control" id="adm-state" value="Kerala" required />
            </div>

            <div class="form-group">
              <label class="form-label required">PIN Code</label>
              <input type="text" class="form-control" id="adm-pincode" placeholder="676541" maxlength="6" required />
            </div>
          </div>

          <!-- SECTION 3: PARENT & GUARDIAN DETAILS -->
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
            3. Parent & Emergency Guardian Contact
          </h4>

          <div class="form-grid" style="margin-bottom: 1.5rem;">
            <div class="form-group">
              <label class="form-label required">Father's Name</label>
              <input type="text" class="form-control" id="adm-father-name" placeholder="Father's full name" required />
            </div>

            <div class="form-group">
              <label class="form-label required">Father's Phone Number</label>
              <input type="tel" class="form-control" id="adm-father-phone" placeholder="+91 98470 12345" required />
            </div>

            <div class="form-group">
              <label class="form-label">Mother's Name</label>
              <input type="text" class="form-control" id="adm-mother-name" placeholder="Mother's name" />
            </div>

            <div class="form-group">
              <label class="form-label">Mother's Phone Number</label>
              <input type="tel" class="form-control" id="adm-mother-phone" placeholder="+91 98470 54321" />
            </div>

            <div class="form-group">
              <label class="form-label required">Official WhatsApp Number</label>
              <input type="tel" class="form-control" id="adm-whatsapp" placeholder="+91 98470 12345" required />
            </div>

            <div class="form-group">
              <label class="form-label">Medical / Dietary Notes</label>
              <input type="text" class="form-control" id="adm-medical" placeholder="Any allergies, asthma, dietary restrictions" />
            </div>
          </div>

          <!-- Submit Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 1rem; border-top: 1px solid var(--border-subtle); padding-top: 1.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-adm">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-adm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Complete Admission & Save
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Image Upload Preview
  let selectedPhotoBase64 = '';
  const photoInput = container.querySelector('#student-photo-input');
  const photoImg = container.querySelector('#photo-img-tag');

  container.querySelector('#btn-browse-photo')?.addEventListener('click', () => photoInput.click());

  photoInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        toast.info('Optimizing student photo...');
        selectedPhotoBase64 = await compressImage(file, 280, 320, 0.75);
        photoImg.src = selectedPhotoBase64;
        photoImg.style.display = 'block';
        toast.success('Photo ready for admission submission.');
      } catch (err) {
        console.error('Admission photo error:', err);
        toast.error('Failed to load image: ' + err.message);
      }
    }
  });

  // Auto-switch default hostel unit recommendation on gender select
  container.querySelector('#adm-gender')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const hostelSelect = container.querySelector('#adm-hostel-unit');
    if (hostelSelect) {
      if (val === 'Female') {
        hostelSelect.value = 'Thaiba Girls Hostel Campus';
      } else {
        hostelSelect.value = 'Thaiba Boys Hostel Block A';
      }
      hostelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Handle Form Submission
  container.querySelector('#admission-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = container.querySelector('#adm-fullname').value.trim();
    const gender = container.querySelector('#adm-gender').value;
    const dob = container.querySelector('#adm-dob').value;
    const admissionDate = container.querySelector('#adm-date').value;
    const schoolClass = normalizeClassPattern(container.querySelector('#adm-class').value);
    const schoolSection = container.querySelector('#adm-section').value;
    const hostelStatus = container.querySelector('#adm-hostel-status').value;

    const village = container.querySelector('#adm-village').value.trim();
    const postOffice = container.querySelector('#adm-postoffice').value.trim();
    const district = container.querySelector('#adm-district').value.trim();
    const state = container.querySelector('#adm-state').value.trim();
    const pinCode = container.querySelector('#adm-pincode').value.trim();

    const fatherName = container.querySelector('#adm-father-name').value.trim();
    const fatherPhone = container.querySelector('#adm-father-phone').value.trim();
    const motherName = container.querySelector('#adm-mother-name').value.trim();
    const motherPhone = container.querySelector('#adm-mother-phone').value.trim();
    const whatsapp = container.querySelector('#adm-whatsapp').value.trim();
    const medical = container.querySelector('#adm-medical').value.trim();

    if (!fullName || !dob || !fatherName || !fatherPhone || !village) {
      toast.error('Please fill in all mandatory admission fields.');
      return;
    }

    const studentRecord = {
      full_name: fullName,
      gender,
      dob,
      admission_date: admissionDate,
      school_class: schoolClass,
      school_section: schoolSection,
      hostel_status: hostelStatus,
      village,
      post_office: postOffice,
      district,
      state,
      pin_code: pinCode,
      father_name: fatherName,
      father_phone: fatherPhone,
      mother_name: motherName,
      mother_phone: motherPhone,
      whatsapp_number: whatsapp,
      medical_info: medical,
      hostel_unit: '',
      hostel_room: '',
      hostel_bed: '',
      photo_url: selectedPhotoBase64
    };

    const created = await db.addStudent(studentRecord);
    toast.success(`Student admitted successfully! Admission No: ${created.admission_number}`);
    onNavigate('students');
  });

  container.querySelector('#btn-back-directory')?.addEventListener('click', () => onNavigate('students'));
  container.querySelector('#btn-cancel-adm')?.addEventListener('click', () => onNavigate('students'));
}
