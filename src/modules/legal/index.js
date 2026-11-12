/**
 * ThaibaHive / TPS Hostel ERP - Legal & DPDP Compliance Module
 * Implements compliant Privacy Policy, Terms of Service, and
 * Verifiable Parental Consent flows pursuant to the Digital Personal Data Protection (DPDP) Act 2023 (India).
 */

import { openModal } from '../../lib/dialog.js';
import { db } from '../../lib/db.js';
import { toast } from '../../lib/toast.js';

export const PRIVACY_POLICY_VERSION = '2026.11-v1';
export const TERMS_VERSION = '2026.11-v1';
export const GRIEVANCE_OFFICER = {
  name: 'Grievance Redressal Officer (Data Protection)',
  institution: 'Thaiba Public School & Residential Hostel',
  email: 'grievance@tpshostel.app',
  phone: '+91 9198470 55667',
  address: 'Thaiba Public School Campus, Malappuram / Kozhikode District, Kerala, India'
};

export function getPrivacyPolicyHtml() {
  return `
    <div class="legal-doc-content" style="font-family: var(--font-sans, system-ui, sans-serif); color: #1E293B; line-height: 1.65; max-height: 65vh; overflow-y: auto; padding: 0.5rem 0.25rem;">
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem;">
        <div style="font-weight: 700; color: #166534; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
          <span>🛡️</span>
          <span>Compliant with India's Digital Personal Data Protection (DPDP) Act 2023</span>
        </div>
        <p style="margin: 0.25rem 0 0 0; font-size: 0.78rem; color: #15803D;">
          Last Updated: November 2026 • Policy Version: ${PRIVACY_POLICY_VERSION} • Data Fiduciary: Thaiba Public School & Hostel
        </p>
      </div>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">1. Data Fiduciary Identity & Purpose</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.75rem;">
        Thaiba Public School & Hostel ("TPS Hostel ERP", "ThaibaHive", "we", "our") acts as the Data Fiduciary for personal data processed within this portal. We are committed to safeguarding student, parent, faculty, and administrative information in full alignment with the Digital Personal Data Protection Act, 2023.
      </p>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">2. Categories of Data Collected</h3>
      <ul style="font-size: 0.84rem; padding-left: 1.25rem; margin-bottom: 0.75rem;">
        <li><strong>Minor Students:</strong> Full legal name, admission/roll number, gender, date of birth, blood group, class/division, hostel block and room assignment, emergency contact details, photo, attendance logs, examination marks, and disciplinary/conduct notes.</li>
        <li><strong>Parents & Guardians:</strong> Legal name, verified phone number, email address, physical postal address, relationship to the student, and communication preferences.</li>
        <li><strong>Hostel Movements & Leaves:</strong> Out-pass requests, departure times, expected/actual return timestamps, authorized escorts, and security gate status.</li>
        <li><strong>Institutional Transport / Vehicle Logs:</strong> Odometer readings, route destinations, fare calculations, and driver credentials for campus vehicles.</li>
      </ul>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">3. Verifiable Parental Consent for Minor Data (Section 9 DPDP)</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.75rem;">
        In strict adherence to Section 9 of the DPDP Act 2023:
      </p>
      <ul style="font-size: 0.84rem; padding-left: 1.25rem; margin-bottom: 0.75rem;">
        <li>Student profiles are linked to parent accounts only upon positive administrative verification and verifiable parental consent.</li>
        <li>We <strong>do not engage in targeted advertising, behavioral tracking, or profiling</strong> directed at children.</li>
        <li>Student personal data is used solely for core educational, residential care, student safety, and administrative record-keeping purposes.</li>
      </ul>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">4. Data Access, Role-Based Security & Storage</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.75rem;">
        Data is stored in encrypted PostgreSQL databases with granular Row Level Security (RLS). Access is restricted strictly by verified institutional roles (Super Admin, Hostel Mentor, Teacher, Vehicle Department Head, Parent, and Student). Parents can only view data corresponding to their assigned children.
      </p>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">5. Rights of Data Principals (Section 12 DPDP)</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.5rem;">
        Parents and adult users retain statutory rights under Section 12 of the DPDP Act 2023:
      </p>
      <ul style="font-size: 0.84rem; padding-left: 1.25rem; margin-bottom: 0.75rem;">
        <li><strong>Right to Access:</strong> View all recorded personal data, attendance logs, and academic marks at any time.</li>
        <li><strong>Right to Data Portability / Export:</strong> Download a full machine-readable JSON or CSV export of student records via the student profile.</li>
        <li><strong>Right to Correction:</strong> Request updates or corrections to misspelled names, updated contact numbers, or inaccurate records.</li>
        <li><strong>Right to Erasure & Anonymization:</strong> Request permanent removal of student data upon graduation or transfer, subject to statutory 3-year school inspection and tax record retention requirements.</li>
      </ul>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">6. Grievance Redressal Officer</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.5rem;">
        If you have questions, concerns, or wish to exercise your statutory privacy rights, contact our designated Grievance Officer:
      </p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.82rem; margin-bottom: 0.75rem;">
        <strong>${GRIEVANCE_OFFICER.name}</strong><br/>
        ${GRIEVANCE_OFFICER.institution}<br/>
        Email: <a href="mailto:${GRIEVANCE_OFFICER.email}" style="color: #2563EB;">${GRIEVANCE_OFFICER.email}</a><br/>
        Phone: ${GRIEVANCE_OFFICER.phone}<br/>
        Address: ${GRIEVANCE_OFFICER.address}
      </div>
    </div>
  `;
}

export function getTermsOfServiceHtml() {
  return `
    <div class="legal-doc-content" style="font-family: var(--font-sans, system-ui, sans-serif); color: #1E293B; line-height: 1.65; max-height: 65vh; overflow-y: auto; padding: 0.5rem 0.25rem;">
      <div style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem;">
        <div style="font-weight: 700; color: #3730A3; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
          <span>📜</span>
          <span>Institutional Code of Conduct & ERP Terms of Service</span>
        </div>
        <p style="margin: 0.25rem 0 0 0; font-size: 0.78rem; color: #4338CA;">
          Last Updated: November 2026 • Terms Version: ${TERMS_VERSION} • Authorized Campus Portal
        </p>
      </div>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">1. Acceptance & Authorization</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.75rem;">
        By signing into ThaibaHive (TPS Hostel ERP), you acknowledge that you are an authorized student, guardian, faculty member, mentor, or administrative staff member of Thaiba Public School. Unauthorized access, account sharing, or credential tampering is strictly prohibited.
      </p>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">2. Role Responsibilities</h3>
      <ul style="font-size: 0.84rem; padding-left: 1.25rem; margin-bottom: 0.75rem;">
        <li><strong>Mentors & Wardens:</strong> Verify student leave requests with parents before gate authorization. Ensure accurate late fine and return recording.</li>
        <li><strong>Teachers & Faculty:</strong> Submit accurate and truthful academic attendance and mid-term / final marks.</li>
        <li><strong>Vehicle Drivers & Heads:</strong> Record accurate starting and return odometer values. Intentional misrepresentation of odometer readings or travel routes constitutes a disciplinary breach.</li>
        <li><strong>Parents:</strong> Provide true emergency contact details, review child leave out-passes, and promptly notify administration of health or contact changes.</li>
      </ul>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">3. Audit Logging & Security Enforcement</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.75rem;">
        All actions, including permission elevation, role assignments, student deletions, and vehicle payments, are recorded in immutable audit logs with timestamp and user ID. Violations will result in immediate account suspension and institutional review.
      </p>

      <h3 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1rem 0 0.4rem 0;">4. Modifications & Updates</h3>
      <p style="font-size: 0.84rem; margin-bottom: 0.75rem;">
        The school administration reserves the right to amend institutional operational policies and fee structures in accordance with academic board guidelines.
      </p>
    </div>
  `;
}

export function showPrivacyPolicyModal() {
  openModal({
    title: 'Privacy Policy & DPDP Data Governance',
    size: 'lg',
    contentHtml: `
      ${getPrivacyPolicyHtml()}
      <div style="display: flex; justify-content: flex-end; margin-top: 1rem; border-top: 1px solid var(--border-color, #E2E8F0); padding-top: 0.75rem;">
        <button type="button" class="btn btn-primary" id="btn-close-privacy-modal" style="font-weight: 700; padding: 0.5rem 1.25rem;">
          Close Policy
        </button>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      modalBody.querySelector('#btn-close-privacy-modal')?.addEventListener('click', close);
    }
  });
}

export function showTermsOfServiceModal() {
  openModal({
    title: 'Terms of Service & Code of Conduct',
    size: 'lg',
    contentHtml: `
      ${getTermsOfServiceHtml()}
      <div style="display: flex; justify-content: flex-end; margin-top: 1rem; border-top: 1px solid var(--border-color, #E2E8F0); padding-top: 0.75rem;">
        <button type="button" class="btn btn-primary" id="btn-close-terms-modal" style="font-weight: 700; padding: 0.5rem 1.25rem;">
          I Understand & Agree
        </button>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      modalBody.querySelector('#btn-close-terms-modal')?.addEventListener('click', close);
    }
  });
}

export function showParentalConsentNoticeModal(user, onAccepted) {
  openModal({
    title: 'DPDP Act 2023 — Parental Consent & Rights Notice',
    size: 'lg',
    contentHtml: `
      <div style="font-family: var(--font-sans, system-ui, sans-serif); color: #1E293B; line-height: 1.6;">
        <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 10px; padding: 0.9rem 1.15rem; margin-bottom: 1.15rem;">
          <h4 style="margin: 0 0 0.35rem 0; font-size: 0.96rem; color: #1E40AF; font-weight: 800;">
            Welcome to the Thaiba Public School Parent Portal
          </h4>
          <p style="margin: 0; font-size: 0.82rem; color: #2563EB;">
            Logged in as <strong>${user.full_name || user.email}</strong>. Please review your rights regarding your child's data.
          </p>
        </div>

        <p style="font-size: 0.85rem; margin-bottom: 0.85rem;">
          In accordance with <strong>Section 9 of the Digital Personal Data Protection (DPDP) Act 2023 (India)</strong>, Thaiba Public School processes the personal data of enrolled students under verifiable parental consent.
        </p>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.82rem;">
          <div style="font-weight: 700; color: #0F172A; margin-bottom: 0.4rem;">Summary of Your Parental Rights:</div>
          <ul style="margin: 0; padding-left: 1.25rem; line-height: 1.5;">
            <li>View your child's live attendance, hostel leave out-passes, and examination grades.</li>
            <li>Request corrections to any inaccurate guardian phone numbers or student details.</li>
            <li>Export your child's academic and residential records at any time.</li>
            <li>No student data is ever shared with commercial advertisers or third-party trackers.</li>
          </ul>
        </div>

        <label style="display: flex; align-items: flex-start; gap: 0.65rem; background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 8px; padding: 0.75rem 1rem; cursor: pointer; margin-bottom: 1.25rem;">
          <input type="checkbox" id="chk-dpdp-parent-accept" style="width: 18px; height: 18px; accent-color: #059669; margin-top: 2px; cursor: pointer; flex-shrink: 0;" />
          <span style="font-size: 0.82rem; color: #166534; font-weight: 600;">
            I confirm that I am the lawful parent/guardian of the enrolled student(s) and consent to the institutional processing of their attendance, hostel leave records, and educational progress as set out in the <a href="javascript:void(0)" id="link-parent-modal-privacy" style="color: #047857; text-decoration: underline;">Privacy Policy</a>.
          </span>
        </label>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-primary" id="btn-submit-parent-consent" disabled style="font-weight: 700; padding: 0.55rem 1.4rem;">
            Acknowledge & Continue to Portal
          </button>
        </div>
      </div>
    `,
    onMount: ({ container: modalBody, close }) => {
      const chk = modalBody.querySelector('#chk-dpdp-parent-accept');
      const submitBtn = modalBody.querySelector('#btn-submit-parent-consent');
      const privLink = modalBody.querySelector('#link-parent-modal-privacy');

      privLink?.addEventListener('click', (e) => {
        e.preventDefault();
        showPrivacyPolicyModal();
      });

      chk?.addEventListener('change', () => {
        if (submitBtn) {
          submitBtn.disabled = !chk.checked;
        }
      });

      submitBtn?.addEventListener('click', async () => {
        if (!chk.checked) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving Consent...';

        try {
          await db.updateUserProfile(user.id, {
            dpdp_consent: {
              acknowledged: true,
              version: PRIVACY_POLICY_VERSION,
              accepted_at: new Date().toISOString(),
              consent_type: 'explicit_dpdp_s9_parent'
            }
          });
          toast.success('Parental consent recorded successfully.');
          close();
          if (typeof onAccepted === 'function') onAccepted();
        } catch (err) {
          console.error('Consent save error:', err);
          toast.error('Failed to record consent. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Acknowledge & Continue to Portal';
        }
      });
    }
  });
}

export function renderPrivacyPolicyPage(container, { onNavigate } = {}) {
  container.innerHTML = `
    <div class="legal-page-container" style="max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <button type="button" class="btn btn-sm btn-outline" id="btn-legal-back" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 0.5rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #0F172A; margin: 0;">Institutional Privacy Policy</h2>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-sm btn-outline" id="btn-nav-terms" style="font-weight: 600;">
            View Terms of Service
          </button>
        </div>
      </div>
      <div class="card-panel" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem;">
        ${getPrivacyPolicyHtml()}
      </div>
    </div>
  `;

  container.querySelector('#btn-legal-back')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('dashboard');
    else window.history.back();
  });

  container.querySelector('#btn-nav-terms')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('terms');
  });
}

export function renderTermsOfServicePage(container, { onNavigate } = {}) {
  container.innerHTML = `
    <div class="legal-page-container" style="max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <button type="button" class="btn btn-sm btn-outline" id="btn-terms-back" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 0.5rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #0F172A; margin: 0;">Terms of Service</h2>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-sm btn-outline" id="btn-nav-privacy" style="font-weight: 600;">
            View Privacy Policy
          </button>
        </div>
      </div>
      <div class="card-panel" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.5rem;">
        ${getTermsOfServiceHtml()}
      </div>
    </div>
  `;

  container.querySelector('#btn-terms-back')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('dashboard');
    else window.history.back();
  });

  container.querySelector('#btn-nav-privacy')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('privacy-policy');
  });
}
