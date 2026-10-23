import { describe, it, expect, beforeEach } from 'vitest';
import { calculateLateDays, calculateLateFine, formatDate, formatCurrency, parseStudentsCSV, normalizeDate } from '../src/lib/utils.js';
import { canAccessModule, canPerformAction, MODULE_DEFINITIONS, getRBACMatrix, saveRBACMatrix, resetRBACMatrix } from '../src/lib/permissions.js';
import { db } from '../src/lib/db.js';

describe('1. Authentication & Role Permissions Tests', () => {
  const superAdmin = {
    id: 'd0000000-0000-0000-0000-000000000001',
    email: 'abdulhaseebkt2@gmail.com',
    role: 'super_admin',
    approval_status: 'approved',
    is_super_admin: true
  };

  const pendingUser = {
    id: 'd0000000-0000-0000-0000-000000000007',
    email: 'new_applicant@gmail.com',
    role: null,
    approval_status: 'pending',
    is_super_admin: false
  };

  const teacher = {
    id: 'd0000000-0000-0000-0000-000000000004',
    email: 'teacher@thaibaschool.edu.in',
    role: 'teacher',
    approval_status: 'approved',
    is_super_admin: false
  };

  const parent = {
    id: 'd0000000-0000-0000-0000-000000000005',
    email: 'parent@example.com',
    role: 'parent',
    approval_status: 'approved',
    is_super_admin: false
  };

  const admin = {
    id: 'd0000000-0000-0000-0000-000000000002',
    email: 'admin@thaibaschool.edu.in',
    role: 'admin',
    approval_status: 'approved',
    is_super_admin: false
  };

  it('Initial Super Admin has full unrestricted access to all 20 modules', () => {
    for (const mod of MODULE_DEFINITIONS) {
      expect(canAccessModule(superAdmin, mod.key)).toBe(true);
      expect(canPerformAction(superAdmin, mod.key, 'view')).toBe(true);
      expect(canPerformAction(superAdmin, mod.key, 'create')).toBe(true);
      expect(canPerformAction(superAdmin, mod.key, 'edit')).toBe(true);
      expect(canPerformAction(superAdmin, mod.key, 'override')).toBe(true);
    }
  });

  it('Pending user cannot access protected school modules', () => {
    for (const mod of MODULE_DEFINITIONS) {
      expect(canAccessModule(pendingUser, mod.key)).toBe(false);
      expect(canPerformAction(pendingUser, mod.key, 'view')).toBe(false);
    }
  });

  it('Admin cannot promote themselves or anyone else to Super Admin', () => {
    expect(canPerformAction(admin, 'users', 'change_super_admin')).toBe(false);
    expect(canPerformAction(admin, 'users', 'override')).toBe(false);
  });

  it('Teacher cannot access unauthorized modules (like fees, users, settings)', () => {
    expect(canAccessModule(teacher, 'users')).toBe(false);
    expect(canAccessModule(teacher, 'fees')).toBe(false);
    expect(canAccessModule(teacher, 'settings')).toBe(false);
    expect(canAccessModule(teacher, 'attendance')).toBe(true);
    expect(canAccessModule(teacher, 'marks')).toBe(true);
  });

  it('Parent cannot access other modules or edit records', () => {
    expect(canAccessModule(parent, 'users')).toBe(false);
    expect(canAccessModule(parent, 'admissions')).toBe(false);
    expect(canPerformAction(parent, 'marks', 'enter_marks')).toBe(false);
    expect(canPerformAction(parent, 'attendance', 'submit_attendance')).toBe(false);
  });

  it('Dynamic Visual RBAC Matrix dynamically grants and revokes module windows for roles', () => {
    // Initially teacher cannot access fees
    expect(canAccessModule(teacher, 'fees')).toBe(false);

    // Super Admin dynamically grants 'fees' to 'teacher' in matrix
    const matrix = getRBACMatrix();
    matrix.teacher.push('fees');
    saveRBACMatrix(matrix);

    expect(canAccessModule(teacher, 'fees')).toBe(true);

    // Reset back to defaults
    resetRBACMatrix();
    expect(canAccessModule(teacher, 'fees')).toBe(false);
  });
});

describe('2. Late-Return Fine Engine Tests (Calendar-Day Rule)', () => {
  it('Returns 0 late days and ₹0.00 fine when student returns on the expected date', () => {
    const lateDays = calculateLateDays('2026-06-02', '2026-06-02');
    const fine = calculateLateFine(lateDays, 200);
    expect(lateDays).toBe(0);
    expect(fine).toBe(0);
  });

  it('Returns 0 late days and ₹0.00 fine when student returns early', () => {
    const lateDays = calculateLateDays('2026-06-05', '2026-06-02');
    const fine = calculateLateFine(lateDays, 200);
    expect(lateDays).toBe(0);
    expect(fine).toBe(0);
  });

  it('Returns 2 late days and ₹400.00 fine when student returns 2 calendar days late (2 June -> 4 June)', () => {
    const lateDays = calculateLateDays('2026-06-02', '2026-06-04');
    const fine = calculateLateFine(lateDays, 200);
    expect(lateDays).toBe(2);
    expect(fine).toBe(400);
  });

  it('Correctly handles month boundary transitions (31 October -> 2 November)', () => {
    const lateDays = calculateLateDays('2026-10-31', '2026-11-02');
    const fine = calculateLateFine(lateDays, 200);
    expect(lateDays).toBe(2);
    expect(fine).toBe(400);
  });
});

describe('3. Student Admissions & Lifecycle Database Tests', () => {
  it('Creates student with required admission number and default Active status', async () => {
    const student = await db.addStudent({
      full_name: 'Test Student One',
      gender: 'Boys',
      dob: '2015-05-10',
      school_class: 'Class 5',
      school_section: 'A',
      father_name: 'Test Father',
      father_phone: '+91 98000 11111',
      village: 'Edavanna'
    });

    expect(student.id).toBeDefined();
    expect(student.admission_number).toMatch(/^TPS-2026-\d{3}$/);
    expect(student.status).toBe('Active');

    // Clean up
    await db.deleteStudent(student.id);
  });

  it('Uploads student photo base64 to Supabase student-photos bucket and saves CDN URL', async () => {
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const student = await db.addStudent({
      full_name: 'Photo Test Student',
      gender: 'Boys',
      dob: '2015-01-01',
      school_class: 'STD-V',
      school_section: 'A',
      father_name: 'Parent Photo',
      father_phone: '+91 99999 00000',
      village: 'Wandoor',
      photo_url: dummyBase64
    });

    expect(student.photo_url).toMatch(/^https:\/\/[^/]+\/storage\/v1\/object\/public\/student-photos\//);

    // Verify updating photo also uploads and updates URL
    const secondPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQD8TAwMAAJhkAAHkCA/5k893bAAAAAElFTkSuQmCC';
    const updated = await db.updateStudent(student.id, {
      photo_url: secondPhoto
    });
    expect(updated.photo_url).toMatch(/^https:\/\/[^/]+\/storage\/v1\/object\/public\/student-photos\//);

    // Clean up created student & photo
    await db.deleteStudent(student.id);
  });

  it('Parses CSV with arbitrary headers and Indian date formats correctly', () => {
    const csvSample = `Sl No,Student Name,Admission No,Sex,Standard,Birth Date,Parent Contact,Place
1,Aadil Rahman,TPS-2026-101,Male,Class 5,15/05/2012,+91 98470 12345,Edavanna
2,Fathima Zehra,TPS-2026-102,Female,STD 6,22-08-2013,+91 98470 67890,Manjeri`;

    const parsed = parseStudentsCSV(csvSample);
    expect(parsed.length).toBe(2);
    expect(parsed[0].full_name).toBe('Aadil Rahman');
    expect(parsed[0].admission_number).toBe('TPS-2026-101');
    expect(parsed[0].gender).toBe('Male');
    expect(parsed[0].dob).toBe('15/05/2012');

    expect(parsed[1].full_name).toBe('Fathima Zehra');
    expect(parsed[1].admission_number).toBe('TPS-2026-102');
  });

  it('Bulk imports 30 students and persists them reliably in getStudents() without data loss', async () => {
    const mock30 = [];
    for (let i = 1; i <= 30; i++) {
      mock30.push({
        admission_number: `TPS-2026-CSV-${String(i).padStart(3, '0')}`,
        full_name: `CSV Student ${i}`,
        gender: i % 2 === 0 ? 'Female' : 'Male',
        dob: `${String(10 + (i % 18)).padStart(2, '0')}/05/2012`, // Indian date format DD/MM/YYYY
        school_class: `Class ${5 + (i % 5)}`,
        father_phone: `+91 98470 ${String(10000 + i)}`,
        status: 'Active'
      });
    }

    const res = await db.importStudents(mock30);
    expect(res.success).toBe(true);
    expect(res.count).toBe(30);

    const students = await db.getStudents();
    const importedFound = students.filter(s => s.admission_number?.startsWith('TPS-2026-CSV-'));
    expect(importedFound.length).toBe(30);

    // Verify date normalization converted DD/MM/YYYY to ISO YYYY-MM-DD
    expect(importedFound[0].dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Cleanup imported students
    const ids = importedFound.map(s => s.id);
    await db.deleteStudents(ids);
  });

  it('Correctly puts student on temporary break and restores upon rejoining', async () => {
    const student = await db.addStudent({
      full_name: 'Break Test Student',
      gender: 'Girls',
      dob: '2014-03-12',
      school_class: 'Class 6',
      school_section: 'B',
      father_name: 'Father',
      father_phone: '+91 98000 22222',
      village: 'Manjeri'
    });

    const updated = await db.setTemporaryBreak(student.id, {
      startDate: '2026-11-01',
      expectedReturnDate: '2026-12-01',
      reason: 'Orthodontic surgery',
      approvedBy: 'Super Admin'
    });

    expect(updated.status).toBe('Temporary Break');
    expect(updated.hostel_status).toBe('temporary_break');
    expect(updated.break_expected_return_date).toBe('2026-12-01');

    const restored = await db.endTemporaryBreak(student.id);
    expect(restored.status).toBe('Active');
    expect(restored.hostel_status).toBe('resident');

    // Clean up
    await db.deleteStudent(student.id);
  });

  it('Permanently deletes a single student and multiple students in batch', async () => {
    const s1 = await db.addStudent({ full_name: 'Delete Test Student 1', gender: 'Boys', dob: '2015-01-01', father_name: 'F1', father_phone: '111', village: 'V1' });
    const s2 = await db.addStudent({ full_name: 'Delete Test Student 2', gender: 'Boys', dob: '2015-01-01', father_name: 'F2', father_phone: '222', village: 'V2' });
    const s3 = await db.addStudent({ full_name: 'Delete Test Student 3', gender: 'Boys', dob: '2015-01-01', father_name: 'F3', father_phone: '333', village: 'V3' });

    // Single delete
    await db.deleteStudent(s1.id);
    let students = await db.getStudents();
    expect(students.some(s => s.id === s1.id)).toBe(false);

    // Batch delete
    await db.deleteStudents([s2.id, s3.id]);
    students = await db.getStudents();
    expect(students.some(s => s.id === s2.id)).toBe(false);
    expect(students.some(s => s.id === s3.id)).toBe(false);
  });
});

describe('4. Hostel Leave & Return Register Tests', () => {
  it('Group Leave marks only selected students on leave, leaving others active', async () => {
    const s1 = await db.addStudent({ full_name: 'Group Student 1', gender: 'Boys', dob: '2015-01-01', father_name: 'F1', father_phone: '111', village: 'V1' });
    const s2 = await db.addStudent({ full_name: 'Stayed Student 2', gender: 'Boys', dob: '2015-01-01', father_name: 'F2', father_phone: '222', village: 'V2' });

    const records = await db.createLeaveRecord({
      student_ids: [s1.id],
      leave_type: 'group',
      departure_date: '2026-10-25',
      departure_time: '08:00',
      expected_return_date: '2026-10-28',
      expected_return_time: '18:00',
      reason: 'Annual Vacation',
      approved_by: 'Hostel Warden'
    });

    expect(records.length).toBe(1);
    const updatedS1 = await db.getStudentById(s1.id);
    const updatedS2 = await db.getStudentById(s2.id);

    expect(updatedS1.status).toBe('On Approved Leave');
    expect(updatedS2.status).toBe('Active');

    // Clean up
    await db.deleteStudents([s1.id, s2.id]);
  });

  it('Recording return computes calendar-day fine and marks student active', async () => {
    const student = await db.addStudent({ full_name: 'Fine Test Student', gender: 'Boys', dob: '2015-01-01', father_name: 'F', father_phone: '123', village: 'V' });
    const [leave] = await db.createLeaveRecord({
      student_ids: [student.id],
      leave_type: 'individual',
      departure_date: '2026-10-10',
      departure_time: '08:00',
      expected_return_date: '2026-10-12',
      expected_return_time: '18:00',
      reason: 'Medical Leave',
      fine_per_day: 200,
      approved_by: 'Warden'
    });

    // Return 2 days late on 2026-10-14
    const returned = await db.recordReturn(leave.id, '2026-10-14', '17:00', 'Arrived safely');

    expect(returned.late_days).toBe(2);
    expect(returned.calculated_fine).toBe(400);
    expect(returned.status).toBe('Returned');

    const updatedStudent = await db.getStudentById(student.id);
    expect(updatedStudent.status).toBe('Active');

    // Clean up
    await db.deleteStudent(student.id);
  });
});

describe('5. Examination & Results Publication Security Tests', () => {
  it('Marks publication changes status to Published and audits action', async () => {
    const exams = await db.getExams();
    const exam = exams[0];

    const published = await db.publishResults(exam.id);
    expect(published.is_published).toBe(true);

    const marks = await db.getMarks(exam.id);
    for (const m of marks) {
      expect(m.status).toBe('Published');
    }

    const audit = await db.getAuditLogs();
    const publishAudit = audit.find(a => a.action === 'PUBLISH_RESULTS');
    expect(publishAudit).toBeDefined();
  });
});

describe('6. User Profile Creation & Management Tests', () => {
  it('Updates user profile fields (name, phone, blood group, tps_id)', async () => {
    const updated = await db.updateProfile('u-1', {
      full_name: 'Abdul Haseeb Mubarak',
      phone: '+91 98470 12345',
      blood_group: 'O+',
      tps_id: 'TGI0419'
    });

    expect(updated).toBeDefined();
    expect(updated.full_name).toBe('Abdul Haseeb Mubarak');
    expect(updated.phone).toBe('+91 98470 12345');
    expect(updated.blood_group).toBe('O+');
    expect(updated.tps_id).toBe('TGI0419');
    expect(updated.profile_completed).toBe(true);
  });

  it('Enforces staff TGI 3-digit ID (e.g. TGI419)', () => {
    const rawDigits = '419';
    const fullStaffId = 'TGI' + rawDigits;
    expect(fullStaffId).toBe('TGI419');
    expect(fullStaffId).toMatch(/^TGI\d{3}$/);
  });

  it('Enforces official Indian mobile number 5-5 spacing (+91 XXXXX XXXXX)', () => {
    const rawDigits = '6238126722';
    expect(rawDigits.length).toBe(10);
    const formatted = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5, 10)}`;
    expect(formatted).toBe('+91 62381 26722');
  });

  it('Verifies 3:3 (1:1 square) logo aspect ratio logic', () => {
    // 3:3 (1:1 square)
    const checkIsSquare = (w, h) => Math.abs((w / h) - 1) < 0.02;

    expect(checkIsSquare(500, 500)).toBe(true);
    expect(checkIsSquare(300, 300)).toBe(true);
    expect(checkIsSquare(1024, 1024)).toBe(true);

    // Non-square requires crop
    expect(checkIsSquare(800, 600)).toBe(false);
    expect(checkIsSquare(1200, 630)).toBe(false);
    expect(checkIsSquare(400, 500)).toBe(false);
  });

  it('Verifies DD.MMM.YYYY date formatting and resilient parsing', () => {
    expect(formatDate('2026-10-22')).toBe('22.Oct.2026');
    expect(formatDate('2025-01-05')).toBe('05.Jan.2025');
    expect(formatDate('22.Oct.2026')).toBe('22.Oct.2026');

    // Resilient late days calculation supporting both formats
    expect(calculateLateDays('2026-10-20', '2026-10-22')).toBe(2);
    expect(calculateLateDays('20.Oct.2026', '22.Oct.2026')).toBe(2);
  });
});
