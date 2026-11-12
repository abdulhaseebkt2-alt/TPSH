import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/db.js';
import { canAccessModule } from '../src/lib/permissions.js';
import {
  getPrivacyPolicyHtml,
  getTermsOfServiceHtml,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
  GRIEVANCE_OFFICER
} from '../src/modules/legal/index.js';

describe('Pre-Release Compliance & DPDP Act 2023 Verification', () => {
  beforeEach(() => {
    db.initStore();
  });

  describe('Item 1 & 2: Privacy Policy & Terms of Service', () => {
    it('generates compliant Privacy Policy containing DPDP Act 2023 and Grievance Officer details', () => {
      const html = getPrivacyPolicyHtml();
      expect(html).toContain('Digital Personal Data Protection (DPDP) Act 2023');
      expect(html).toContain(PRIVACY_POLICY_VERSION);
      expect(html).toContain(GRIEVANCE_OFFICER.email);
      expect(html).toContain('Section 9');
      expect(html).toContain('Section 12');
    });

    it('generates compliant Terms of Service with institutional conduct clauses', () => {
      const html = getTermsOfServiceHtml();
      expect(html).toContain('Institutional Code of Conduct');
      expect(html).toContain(TERMS_VERSION);
      expect(html).toContain('Vehicle Drivers & Heads');
      expect(html).toContain('Audit Logging');
    });

    it('allows all approved roles (parent, teacher, vehicle_head) to access legal routes', () => {
      const parentUser = { id: 'u-parent', role: 'parent', approval_status: 'approved' };
      const driverUser = { id: 'u-driver', role: 'vehicle_user', approval_status: 'approved' };

      expect(canAccessModule(parentUser, 'privacy-policy')).toBe(true);
      expect(canAccessModule(parentUser, 'terms')).toBe(true);
      expect(canAccessModule(driverUser, 'privacy-policy')).toBe(true);
      expect(canAccessModule(driverUser, 'terms')).toBe(true);
    });
  });

  describe('Item 3: Verifiable Parental Consent (DPDP Section 9)', () => {
    it('records verifiable parental consent with verification method and audit log', async () => {
      const consent = await db.recordDpdpConsent({
        userId: 'parent-123',
        studentId: 'stud-456',
        consentType: 'explicit_dpdp_s9',
        verificationMethod: 'admission_form',
        verifiedBy: 'principal@thaibaschool.edu.in',
        metadata: { student_ids: ['stud-456'], relation: 'father' }
      });

      expect(consent).toBeDefined();
      expect(consent.consent_type).toBe('explicit_dpdp_s9');
      expect(consent.verification_method).toBe('admission_form');
      expect(consent.policy_version).toBe('2026.11-v1');

      const logs = db.get('tps_dpdp_consent_logs') || [];
      expect(logs.some(l => l.user_id === 'parent-123')).toBe(true);

      const audit = db.get('tps_audit') || [];
      expect(audit.some(a => a.action === 'DPDP_CONSENT_RECORDED')).toBe(true);
    });
  });

  describe('Item 4: Purpose Limitation & Erasure (DPDP Section 12)', () => {
    it('exports complete structured student data bundle under Section 12 portability', async () => {
      const testStudent = {
        id: 'st-dpdp-1',
        admission_number: 'TPS-2026-999',
        full_name: 'Zayan Test Student',
        gender: 'Boys',
        school_class: 'Class 5',
        school_section: 'A',
        father_name: 'Test Father',
        father_phone: '9876543210',
        status: 'Active'
      };
      const added = await db.addStudent(testStudent);
      const studentId = added?.id || 'st-dpdp-1';

      const exportBundle = await db.exportStudentDataJson(studentId);
      expect(exportBundle.export_version).toBe('DPDP-2023-Sec12-v1');
      expect(exportBundle.student_personal_data.full_name).toBe('Zayan Test Student');
      expect(exportBundle.guardian_contacts.father_phone).toBe('9876543210');
      expect(exportBundle.historical_records).toBeDefined();
    });

    it('supports student PII anonymization under Section 12', async () => {
      const testStudent = {
        id: 'st-dpdp-anon',
        admission_number: 'TPS-2026-888',
        full_name: 'Aisha Sensitive',
        gender: 'Girls',
        school_class: 'Class 7',
        father_name: 'Guardian Name',
        father_phone: '9123456789',
        status: 'Dropped Out'
      };
      const added = await db.addStudent(testStudent);
      const studentId = added?.id || 'st-dpdp-anon';

      const res = await db.eraseStudentData(studentId, {
        reason: 'Parent request on transfer',
        anonymizeOnly: true
      });

      expect(res.mode).toBe('anonymized');

      const students = await db.getStudents(true);
      const updated = students.find(s => s.id === studentId);
      expect(updated.full_name).toContain('Redacted Student');
      expect(updated.father_phone).toBe('0000000000');

      const audit = db.get('tps_audit') || [];
      expect(audit.some(a => a.action === 'DPDP_ANONYMIZE_STUDENT')).toBe(true);
    });
  });

  describe('Item 5: app_settings Multi-Tenant RLS & Key Isolation', () => {
    it('filters out sensitive system keys when non-admin requests cloud sync', async () => {
      // Simulate non-admin parent login
      db.setStorageItem('tps_current_user', JSON.stringify({
        id: 'user-parent',
        role: 'parent',
        is_super_admin: false
      }));

      // Non-admin calls pullCloudKeys with sensitive keys
      await db.pullCloudKeys([
        'tps_user_passwords',
        'tps_parent_assignments',
        'tps_institution_logo'
      ], true);

      // Verify that pullCloudKeys did not request or cache timestamps for sensitive admin keys
      expect(db._pulledKeysTime.has('tps_user_passwords')).toBe(false);
      expect(db._pulledKeysTime.has('tps_parent_assignments')).toBe(false);
    });
  });

  describe('Item 6: Android APK Manifest & Backup Security', () => {
    it('enforces backup protection and minimizes permissions in AndroidManifest.xml', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
      const manifestXml = fs.readFileSync(manifestPath, 'utf8');

      // Verify backup is strictly disabled to prevent ADB extraction
      expect(manifestXml).toContain('android:allowBackup="false"');
      expect(manifestXml).toContain('android:fullBackupContent="@xml/backup_rules"');
      expect(manifestXml).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');

      // Verify backup XML configuration files exist
      const backupRulesPath = path.resolve('android/app/src/main/res/xml/backup_rules.xml');
      const dataExtractRulesPath = path.resolve('android/app/src/main/res/xml/data_extraction_rules.xml');
      expect(fs.existsSync(backupRulesPath)).toBe(true);
      expect(fs.existsSync(dataExtractRulesPath)).toBe(true);

      // Verify permission minimization (only INTERNET)
      expect(manifestXml).toContain('android.permission.INTERNET');
      expect(manifestXml).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
      expect(manifestXml).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
    });
  });
});
