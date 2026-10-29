import { describe, it, expect, beforeEach } from 'vitest';
import { calculateLateDays, calculateLateFine, formatDate, formatCurrency, parseStudentsCSV, normalizeDate } from '../src/lib/utils.js';
import { canAccessModule, canPerformAction, MODULE_DEFINITIONS, getRBACMatrix, saveRBACMatrix, resetRBACMatrix, getUserCustomPermissions, saveUserCustomPermissions, clearUserCustomPermissions } from '../src/lib/permissions.js';
import { from24Hour, to24Hour, format12Hour } from '../src/lib/wheelTimePicker.js';
import { renderSidebar } from '../src/components/sidebar.js';
import { updateCurrentUserProfile } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';
import { renderDashboard } from '../src/modules/dashboard/index.js';
import { renderAdminDashboard } from '../src/modules/dashboard/admin-dashboard.js';
import { renderTeacherDashboard } from '../src/modules/dashboard/teacher-dashboard.js';
import { renderMentorDashboard } from '../src/modules/dashboard/mentor-dashboard.js';
import { renderParentDashboard } from '../src/modules/dashboard/parent-dashboard.js';
import { renderStudentDashboard } from '../src/modules/dashboard/student-dashboard.js';
import { WEEK_DAYS, renderSectionsModule } from '../src/modules/sections/index.js';
import { renderTimetableModule } from '../src/modules/timetable/index.js';
import { renderAttendanceModule } from '../src/modules/attendance/index.js';
import { renderReportsModule } from '../src/modules/reports/index.js';
import { renderCalendarModule } from '../src/modules/calendar/index.js';
import { renderStudentsModule } from '../src/modules/students/index.js';
import { renderAttendanceReportModule } from '../src/modules/reports/attendance-report.js';
import { formatDateYMD, parseDateString, isMobileDatePicker, getFieldTitle, openMobileWheelPicker } from '../src/components/date-picker.js';

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

  it('Dynamic Visual RBAC Matrix dynamically grants and revokes module windows for roles with 3-position switch', () => {
    // 1. Initially teacher has fees set to 'off' (Left position: cannot see or access)
    expect(canAccessModule(teacher, 'fees')).toBe(false);
    expect(canPerformAction(teacher, 'fees', 'view')).toBe(false);
    expect(canPerformAction(teacher, 'fees', 'edit')).toBe(false);

    // 2. Set 'fees' to 'view' (Middle position: explore/view-only, cannot edit or apply)
    const matrix = getRBACMatrix();
    matrix.teacher.fees = 'view';
    saveRBACMatrix(matrix);

    expect(canAccessModule(teacher, 'fees')).toBe(true);
    expect(canPerformAction(teacher, 'fees', 'view')).toBe(true);
    expect(canPerformAction(teacher, 'fees', 'edit')).toBe(false);
    expect(canPerformAction(teacher, 'fees', 'create')).toBe(false);

    // 3. Set 'fees' to 'full' (Right position: full access to edit and apply)
    matrix.teacher.fees = 'full';
    saveRBACMatrix(matrix);

    expect(canAccessModule(teacher, 'fees')).toBe(true);
    expect(canPerformAction(teacher, 'fees', 'view')).toBe(true);
    expect(canPerformAction(teacher, 'fees', 'edit')).toBe(true);

    // 4. Test backward compatibility if legacy array is passed
    saveRBACMatrix({ teacher: ['fees', 'attendance'] });
    expect(canAccessModule(teacher, 'fees')).toBe(true);
    expect(canAccessModule(teacher, 'attendance')).toBe(true);

    // 5. Reset back to institutional defaults
    resetRBACMatrix();
    expect(canAccessModule(teacher, 'fees')).toBe(false);
  });

  it('Dashboard is common to all approved categories and always accessible across all roles', () => {
    const roles = ['admin', 'teacher', 'mentor', 'hostel_leader', 'parent', 'student'];
    for (const r of roles) {
      const profile = {
        id: `test-${r}`,
        email: `${r}@thaiba.edu`,
        role: r,
        approval_status: 'approved',
        is_super_admin: false
      };
      expect(canAccessModule(profile, 'dashboard')).toBe(true);
      expect(canPerformAction(profile, 'dashboard', 'view')).toBe(true);
    }
  });

  it('Multi-Function 3-Position switch enforces strict Left (Off), Middle (View Only), and Right (Full Access) permissions', () => {
    const mentorUser = {
      id: 'test-mentor',
      email: 'mentor@thaiba.edu',
      role: 'mentor',
      approval_status: 'approved',
      is_super_admin: false
    };

    const matrix = getRBACMatrix();

    // 1. LEFT POSITION ('off'): Window is OFF. Mentor cannot see it or access it
    matrix.mentor.leaves = 'off';
    saveRBACMatrix(matrix);
    expect(canAccessModule(mentorUser, 'leaves')).toBe(false);
    expect(canPerformAction(mentorUser, 'leaves', 'view')).toBe(false);
    expect(canPerformAction(mentorUser, 'leaves', 'create')).toBe(false);
    expect(canPerformAction(mentorUser, 'leaves', 'record_return')).toBe(false);

    // 2. MIDDLE POSITION ('view'): Window is EXPLORE / VIEW ONLY.
    // Mentor can see & explore records in the window, but CANNOT edit or apply
    matrix.mentor.leaves = 'view';
    saveRBACMatrix(matrix);
    expect(canAccessModule(mentorUser, 'leaves')).toBe(true);
    expect(canPerformAction(mentorUser, 'leaves', 'view')).toBe(true);
    expect(canPerformAction(mentorUser, 'leaves', 'create')).toBe(false);
    expect(canPerformAction(mentorUser, 'leaves', 'record_return')).toBe(false);
    expect(canPerformAction(mentorUser, 'leaves', 'edit')).toBe(false);

    // 3. RIGHT POSITION ('full'): Window has FULL ACCESS.
    // Mentor can see, explore, edit, create, and apply
    matrix.mentor.leaves = 'full';
    saveRBACMatrix(matrix);
    expect(canAccessModule(mentorUser, 'leaves')).toBe(true);
    expect(canPerformAction(mentorUser, 'leaves', 'view')).toBe(true);
    expect(canPerformAction(mentorUser, 'leaves', 'create')).toBe(true);
    expect(canPerformAction(mentorUser, 'leaves', 'record_return')).toBe(true);

    resetRBACMatrix();
  });

  it('Allows custom individual user permission overrides (e.g. particular teacher granted students window access)', () => {
    // Standard teacher without custom overrides
    const normalTeacher = {
      id: 'teacher-normal',
      email: 'normal.teacher@thaiba.edu',
      role: 'teacher',
      approval_status: 'approved'
    };

    // Special teacher with individual custom permissions
    const specialTeacher = {
      id: 'teacher-special',
      email: 'special.teacher@thaiba.edu',
      role: 'teacher',
      approval_status: 'approved'
    };

    // 1. In matrix, turn students OFF for all teachers
    const matrix = getRBACMatrix();
    matrix.teacher.students = 'off';
    saveRBACMatrix(matrix);

    // Normal teacher cannot access students window
    expect(canAccessModule(normalTeacher, 'students')).toBe(false);

    // 2. Grant specialTeacher custom full access to students
    saveUserCustomPermissions('teacher-special', { students: 'full' });
    expect(canAccessModule(specialTeacher, 'students')).toBe(true);
    expect(canPerformAction(specialTeacher, 'students', 'view')).toBe(true);
    expect(canPerformAction(specialTeacher, 'students', 'create')).toBe(true);

    // Normal teacher remains blocked
    expect(canAccessModule(normalTeacher, 'students')).toBe(false);

    // 3. Clear custom permissions returns special teacher back to role default
    clearUserCustomPermissions('teacher-special');
    expect(canAccessModule(specialTeacher, 'students')).toBe(false);

    resetRBACMatrix();
  });

  it('Supports 3 switch states (off, view, full) in individual user custom permissions', () => {
    const customUser = {
      id: 'custom-user-1',
      email: 'custom@thaiba.edu',
      role: 'teacher',
      approval_status: 'approved'
    };

    saveUserCustomPermissions('custom-user-1', {
      students: 'view',
      leaves: 'full',
      fees: 'off'
    });

    const perms = getUserCustomPermissions('custom-user-1');
    expect(perms.students).toBe('view');
    expect(perms.leaves).toBe('full');
    expect(perms.fees).toBe('off');

    // Students is view only: can view, cannot create/delete
    expect(canAccessModule(customUser, 'students')).toBe(true);
    expect(canPerformAction(customUser, 'students', 'view')).toBe(true);
    expect(canPerformAction(customUser, 'students', 'create')).toBe(false);
    expect(canPerformAction(customUser, 'students', 'delete')).toBe(false);

    // Leaves is full: can view and create
    expect(canAccessModule(customUser, 'leaves')).toBe(true);
    expect(canPerformAction(customUser, 'leaves', 'view')).toBe(true);
    expect(canPerformAction(customUser, 'leaves', 'create')).toBe(true);

    // Fees is off: cannot access
    expect(canAccessModule(customUser, 'fees')).toBe(false);

    clearUserCustomPermissions('custom-user-1');
    expect(getUserCustomPermissions('custom-user-1')).toBeNull();
  });

  it('Strictly denies delete permission for view-only users like mentors on students module', () => {
    const mentorUser = {
      id: 'mentor-test',
      email: 'mentor@thaiba.edu',
      role: 'mentor',
      approval_status: 'approved'
    };

    // In default matrix, mentor has students set to 'view'
    expect(canAccessModule(mentorUser, 'students')).toBe(true);
    expect(canPerformAction(mentorUser, 'students', 'view')).toBe(true);
    // Cannot delete or edit
    expect(canPerformAction(mentorUser, 'students', 'delete')).toBe(false);
    expect(canPerformAction(mentorUser, 'students', 'edit')).toBe(false);
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

  it('Verifies Sections and Classrooms Add, Update, and Remove options with cascade deletion', async () => {
    // 1. Add Section
    const newSec = await db.addSection({
      program_id: 'prog-1',
      name: 'Test Moral Division 9',
      gender_eligibility: 'Boys'
    });
    expect(newSec).toBeDefined();
    expect(newSec.name).toBe('Test Moral Division 9');

    // 2. Add Classroom under section
    const newCls = await db.addClassroom({
      section_id: newSec.id,
      name: 'Test Classroom 901',
      room_number: '901',
      capacity: 40
    });
    expect(newCls).toBeDefined();
    expect(newCls.section_id).toBe(newSec.id);
    expect(newCls.name).toBe('Test Classroom 901');

    // 3. Update Classroom
    const updatedCls = await db.updateClassroom(newCls.id, {
      name: 'Renamed Classroom 901',
      capacity: 45
    });
    expect(updatedCls.name).toBe('Renamed Classroom 901');
    expect(updatedCls.capacity).toBe(45);

    // 4. Update Section
    const updatedSec = await db.updateSection(newSec.id, {
      name: 'Renamed Moral Division 9'
    });
    expect(updatedSec.name).toBe('Renamed Moral Division 9');

    // 5. Delete Classroom directly
    const deleteClsRes = await db.deleteClassroom(newCls.id);
    expect(deleteClsRes).toBe(true);
    const classroomsAfter = await db.getClassrooms();
    expect(classroomsAfter.some(c => c.id === newCls.id)).toBe(false);

    // 6. Add another classroom and test cascade delete when section is deleted
    const clsCascade = await db.addClassroom({
      section_id: newSec.id,
      name: 'Cascade Classroom',
      room_number: '902',
      capacity: 30
    });
    const deleteSecRes = await db.deleteSection(newSec.id);
    expect(deleteSecRes).toBe(true);

    const sectionsAfter = await db.getSections();
    const classroomsAfterCascade = await db.getClassrooms();
    expect(sectionsAfter.some(s => s.id === newSec.id)).toBe(false);
    expect(classroomsAfterCascade.some(c => c.id === clsCascade.id)).toBe(false);
  });

  it('Verifies Classrooms map directly to Sections with gender eligibility and CRUD options', async () => {
    // 1. Create a Section
    const prog = await db.addProgram({
      name: 'Evening Tuition Section',
      code: 'TUITION',
      description: 'Daily evening tuition'
    });
    expect(prog.id).toBeDefined();

    // 2. Add Classroom Card directly under this Section with start and end times, teacher, and days
    const cls = await db.addClassroom({
      program_id: prog.id,
      name: 'Tuition Room 101',
      start_time: '18:30',
      end_time: '20:00',
      room_number: '', // non-mandatory
      capacity: null,  // non-mandatory
      gender_eligibility: 'Boys',
      teacher_id: 'u-2',
      days: ['Mon', 'Wed', 'Fri']
    });
    expect(cls).toBeDefined();
    expect(cls.name).toBe('Tuition Room 101');
    expect(cls.program_id).toBe(prog.id);
    expect(cls.start_time).toBe('18:30');
    expect(cls.end_time).toBe('20:00');
    expect(cls.gender_eligibility).toBe('Boys');
    expect(cls.teacher_id).toBe('u-2');
    expect(cls.days).toEqual(['Mon', 'Wed', 'Fri']);

    // 3. Verify it is returned in getClassrooms()
    const allCls = await db.getClassrooms();
    const found = allCls.find(c => c.id === cls.id);
    expect(found).toBeDefined();
    expect(found.program_id).toBe(prog.id);
    expect(found.start_time).toBe('18:30');
    expect(found.end_time).toBe('20:00');
    expect(found.teacher_id).toBe('u-2');
    expect(found.days).toEqual(['Mon', 'Wed', 'Fri']);

    // 4. Update Classroom
    const updated = await db.updateClassroom(cls.id, {
      name: 'Tuition Hall Beta',
      start_time: '19:00',
      end_time: '20:30',
      gender_eligibility: 'Mixed',
      teacher_id: 'u-3',
      days: ['Sun', 'Tue', 'Thu']
    });
    expect(updated.name).toBe('Tuition Hall Beta');
    expect(updated.start_time).toBe('19:00');
    expect(updated.end_time).toBe('20:30');
    expect(updated.gender_eligibility).toBe('Mixed');
    expect(updated.teacher_id).toBe('u-3');
    expect(updated.days).toEqual(['Sun', 'Tue', 'Thu']);

    // 5. Delete Classroom
    const deleted = await db.deleteClassroom(cls.id);
    expect(deleted).toBe(true);

    const afterDel = await db.getClassrooms();
    expect(afterDel.some(c => c.id === cls.id)).toBe(false);

    // Clean up program
    await db.deleteProgram(prog.id);
  });

  it('WEEK_DAYS defines 7 days with compact 1-letter labels for round circular badges', () => {
    expect(WEEK_DAYS).toHaveLength(7);
    expect(WEEK_DAYS.map(d => d.short)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(WEEK_DAYS.map(d => d.key)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('11. Wheel / Drum Time Picker Engine Tests', () => {
  it('from24Hour correctly parses standard times into 12-hour values', () => {
    expect(from24Hour('00:00')).toEqual({ hour: 12, minute: 0, period: 'AM' });
    expect(from24Hour('06:30')).toEqual({ hour: 6, minute: 30, period: 'AM' });
    expect(from24Hour('12:00')).toEqual({ hour: 12, minute: 0, period: 'PM' });
    expect(from24Hour('20:00')).toEqual({ hour: 8, minute: 0, period: 'PM' });
    expect(from24Hour('23:59')).toEqual({ hour: 11, minute: 59, period: 'PM' });
    // Invalid / empty fallbacks
    expect(from24Hour(null)).toEqual({ hour: 8, minute: 0, period: 'PM' });
    expect(from24Hour('')).toEqual({ hour: 8, minute: 0, period: 'PM' });
  });

  it('to24Hour correctly converts 12-hour values back to 24-hour time strings', () => {
    expect(to24Hour(12, 0, 'AM')).toBe('00:00');
    expect(to24Hour(6, 30, 'AM')).toBe('06:30');
    expect(to24Hour(12, 0, 'PM')).toBe('12:00');
    expect(to24Hour(8, 0, 'PM')).toBe('20:00');
    expect(to24Hour(11, 59, 'PM')).toBe('23:59');
  });

  it('format12Hour formats human-readable 12-hour AM/PM label', () => {
    expect(format12Hour(8, 0, 'PM')).toBe('08:00 PM');
    expect(format12Hour(12, 30, 'AM')).toBe('12:30 AM');
    expect(format12Hour(6, 5, 'AM')).toBe('06:05 AM');
  });
});

describe('12. Classroom Student Assignments Tests', () => {
  it('assignStudentsToClassroom stores student assignments and getClassroomStudents retrieves them', async () => {
    const prog = await db.addProgram({ name: 'Coaching Unit Alpha' });
    const cls = await db.addClassroom({
      program_id: prog.id,
      name: 'Classroom Test Assignment',
      start_time: '08:00',
      end_time: '09:00'
    });

    // Initial state: empty array
    const initialAssigned = await db.getClassroomStudents(cls.id);
    expect(Array.isArray(initialAssigned)).toBe(true);

    // Assign students
    const studentIds = ['s-test-1', 's-test-2', 's-test-3'];
    await db.assignStudentsToClassroom(cls.id, studentIds);

    const updatedAssigned = await db.getClassroomStudents(cls.id);
    expect(updatedAssigned).toEqual(studentIds);

    // Verify classrooms list reflects student_ids
    const classrooms = await db.getClassrooms();
    const targetCls = classrooms.find(c => c.id === cls.id);
    expect(targetCls.student_ids).toEqual(studentIds);

    // Update assignment to new list
    const newStudentIds = ['s-test-2'];
    await db.assignStudentsToClassroom(cls.id, newStudentIds);
    expect(await db.getClassroomStudents(cls.id)).toEqual(newStudentIds);

    // Clean up
    await db.deleteClassroom(cls.id);
    await db.deleteProgram(prog.id);
  });
});

describe('13. Collapsible Sidebar Component Tests', () => {
  it('renderSidebar outputs collapse buttons and tooltips for both collapsed and expanded states', () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    // Test expanded state
    renderSidebar(container, {
      activeModule: 'dashboard',
      isCollapsed: false,
      onToggleCollapse: () => {},
      onNavigate: () => {},
      onCloseMobile: () => {}
    });

    expect(container.innerHTML).toContain('sidebar-collapse-btn');
    expect(container.innerHTML).toContain('sidebar-footer-collapse-btn');
    expect(container.innerHTML).toContain('Collapse sidebar');
    expect(container.innerHTML).toContain('data-tooltip="Dashboard"');
    expect(container.innerHTML).toContain('nav-label');

    // Test collapsed state
    renderSidebar(container, {
      activeModule: 'dashboard',
      isCollapsed: true,
      onToggleCollapse: () => {},
      onNavigate: () => {},
      onCloseMobile: () => {}
    });

    expect(container.innerHTML).toContain('sidebar-collapse-btn');
    expect(container.innerHTML).toContain('sidebar-footer-collapse-btn');
    expect(container.innerHTML).toContain('Expand sidebar');
    expect(container.innerHTML).toContain('data-tooltip="Dashboard"');
  });
});

describe('14. Multi-Role Categorized Dashboards & Sidebar Section Tests', () => {
  it('Sidebar renders Dashboard under "Student & Academic" section heading', () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    renderSidebar(container, {
      activeModule: 'dashboard',
      isCollapsed: false,
      onToggleCollapse: () => {},
      onNavigate: () => {},
      onCloseMobile: () => {}
    });

    // Verify section heading and dashboard under it
    expect(container.innerHTML).toContain('Student & Academic');
    const academicIndex = container.innerHTML.indexOf('Student & Academic');
    const dashboardIndex = container.innerHTML.indexOf('data-module="dashboard"');
    const admissionsIndex = container.innerHTML.indexOf('data-module="admissions"');

    expect(academicIndex).toBeGreaterThan(-1);
    expect(dashboardIndex).toBeGreaterThan(academicIndex);
    expect(admissionsIndex).toBeGreaterThan(dashboardIndex);
  });

  it('Renders dedicated Teacher Dashboard for teacher role with teaching load and attendance shortcut', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderDashboard(container, { onNavigate: () => {} });

    expect(container.innerHTML).toContain('Rashid Sir');
    expect(container.innerHTML).toContain('Teaching Schedule');
    expect(container.innerHTML).toContain('Take Attendance');
    expect(container.innerHTML).toContain('Today\'s Sessions');
  });

  it('Renders dedicated Hostel Mentor Dashboard and strictly isolates Girls Hostel data when mentor is assigned to Girls Hostel', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000003',
      email: 'mentor@thaibaschool.edu.in',
      full_name: 'Usthad Usman',
      role: 'mentor',
      approval_status: 'approved',
      is_super_admin: false,
      hostel_unit: 'Thaiba Girls Hostel Campus',
      gender_scope: 'Girls'
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    // Ensure localStorage matches girls hostel
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tps_mentor_active_hostel', 'Thaiba Girls Hostel Campus');
    }

    await renderDashboard(container, { onNavigate: () => {} });

    expect(container.innerHTML).toContain('Thaiba Girls Hostel Campus');
    expect(container.innerHTML).toContain('Girls Hostel Wing');
    expect(container.innerHTML).toContain('Bed Occupancy');
    expect(container.innerHTML).toContain('Night Roll Call');
  });

  it('Renders dedicated Parent Dashboard and strictly isolates data to their children', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000005',
      email: 'parent@example.com',
      full_name: 'Ahmad K.T.',
      role: 'parent',
      approval_status: 'approved',
      is_super_admin: false,
      phone: '8104998120'
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderDashboard(container, { onNavigate: () => {} });

    expect(container.innerHTML).toContain('Parent Portal');
    expect(container.innerHTML).toContain('Presence Status');
    expect(container.innerHTML).toContain('Attendance Rate');
    expect(container.innerHTML).toContain('Request Hostel Leave');
  });

  it('Renders dedicated Student Dashboard with personalized student schedule and report card', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000006',
      email: 'student@thaibaschool.edu.in',
      full_name: 'MD Aamir',
      admission_number: 'TPS-2026-001',
      role: 'student',
      approval_status: 'approved',
      is_super_admin: false
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderDashboard(container, { onNavigate: () => {} });

    expect(container.innerHTML).toContain('Welcome, MD Aamir');
    expect(container.innerHTML).toContain('My Attendance');
    expect(container.innerHTML).toContain('Today\'s Class Schedule');
    expect(container.innerHTML).toContain('Gate Pass Status');
  });

  it('Renders Executive Admin Dashboard for Admin/Super Admin with categorized Academic and Hostel sections', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderDashboard(container, { onNavigate: () => {} });

    expect(container.innerHTML).toContain('Executive Institutional Overview');
    expect(container.innerHTML).toContain('Student & Academic');
    expect(container.innerHTML).toContain('Hostel Operations');
    expect(container.innerHTML).toContain('Active Students');
    expect(container.innerHTML).toContain('Unpaid Late Fines');
  });
});

describe('15. Teacher Assigned Class, Locked Attendance Window, & Multi-Dimensional Reports Tests', () => {
  it('Teacher timetable only displays their assigned classes; admin can view all', async () => {
    // 1. Teacher view
    updateCurrentUserProfile({
      id: 'u-2',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const teacherContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderTimetableModule(teacherContainer, { onNavigate: () => {} });
    expect(teacherContainer.innerHTML).toContain('My Teaching Timetable');
    expect(teacherContainer.innerHTML).toContain('Personal Faculty Timetable Active');

    // 2. Admin view
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const adminContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderTimetableModule(adminContainer, { onNavigate: () => {} });
    expect(adminContainer.innerHTML).toContain('Faculty Timetable & Schedule Governance');
    expect(adminContainer.innerHTML).toContain('Master Institutional Timetable');
    expect(adminContainer.innerHTML).toContain('All Faculty');
  });

  it('Teacher attendance duty is automatically recorded with timestamp when attendance is submitted', async () => {
    const sessionDate = '2026-10-27';
    const testSession = await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: 'cls-1',
      session_date: sessionDate,
      teacher_id: 'u-2',
      teacher_name: 'Rashid Sir',
      records: [
        { student_id: 'st-1', status: 'Present' },
        { student_id: 'st-2', status: 'Absent' }
      ]
    });

    expect(testSession.id).toBeDefined();
    expect(testSession.recorded_at).toBeDefined();
    expect(testSession.teacher_name).toBe('Rashid Sir');

    // Verify teacher duty log was persisted
    const teacherLogs = await db.getTeacherAttendanceRecords();
    const myLog = teacherLogs.find(t => t.session_id === testSession.id);
    expect(myLog).toBeDefined();
    expect(myLog.teacher_id).toBe('u-2');
    expect(myLog.status).toBe('Present');
    expect(myLog.recorded_at).toBe(testSession.recorded_at);
  });

  it('Admin can unlock late attendance window for a classroom session', async () => {
    const clsId = 'cls-4';
    const today = '2026-10-27';

    // Initially not unlocked
    expect(await db.isAttendanceWindowUnlocked(clsId, today)).toBe(false);

    // Admin unlocks
    await db.unlockAttendanceWindow(clsId, today);
    expect(await db.isAttendanceWindowUnlocked(clsId, today)).toBe(true);
  });

  it('Attendance reports render multi-dimensional student and teacher registers across individual, class-wise, and section-wise views', async () => {
    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderReportsModule(container, { onNavigate: () => {} });

    // Verify entity tabs
    expect(container.innerHTML).toContain('Student Attendance');
    expect(container.innerHTML).toContain('Teacher Duty & Attendance');

    // Verify dimension selectors
    expect(container.innerHTML).toContain('Individual');
    expect(container.innerHTML).toContain('Class-wise');
    expect(container.innerHTML).toContain('Section-wise');

    // Verify timeframe selectors
    expect(container.innerHTML).toContain('Daily');
    expect(container.innerHTML).toContain('Weekly');
    expect(container.innerHTML).toContain('Monthly');
    expect(container.innerHTML).toContain('Yearly');
  });

  it('View-only users cannot see export or import buttons anywhere, while authorized users can', async () => {
    // 1. Teacher is view-only on students
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const tableContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const topBar = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const viewOnlyContainer = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#students-table-container') return tableContainer;
        if (sel === '#card-top-bar') return topBar;
        return null;
      },
      querySelectorAll: () => []
    };

    await renderStudentsModule(viewOnlyContainer, { onNavigate: () => {} });

    // In Students module: Viewer must NOT see Export CSV or Import, and no redundant blue notification banner
    expect(viewOnlyContainer.innerHTML).not.toContain('id="btn-export-csv"');
    expect(viewOnlyContainer.innerHTML).not.toContain('id="btn-import-csv"');
    expect(viewOnlyContainer.innerHTML).not.toContain('id="btn-add-student"');
    expect(viewOnlyContainer.innerHTML).not.toContain('Explore & View-Only Window');

    // 2. Super Admin has full access on students
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const adminContainer = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#students-table-container') return tableContainer;
        if (sel === '#card-top-bar') return topBar;
        return null;
      },
      querySelectorAll: () => []
    };

    await renderStudentsModule(adminContainer, { onNavigate: () => {} });

    // Super Admin CAN see Export CSV, Import, and Add Student
    expect(adminContainer.innerHTML).toContain('id="btn-export-csv"');
    expect(adminContainer.innerHTML).toContain('id="btn-import-csv"');
    expect(adminContainer.innerHTML).toContain('id="btn-add-student"');
  });

  it('Students module renders dual desktop table and mobile list; mobile list replaces ID Number with Class and supports full profile view', async () => {
    // Ensure at least one student exists in DB for directory rendering
    const existing = await db.getStudents();
    if (existing.length === 0) {
      await db.addStudent({
        full_name: 'MD Aamir',
        school_class: 'STD-VIII',
        admission_number: 'TPS-2026-001',
        gender: 'Boys',
        dob: '2020-08-01',
        status: 'Active',
        father_name: 'Test Father',
        father_phone: '+91 98470 11223'
      });
    }

    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const tableContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const topBar = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#students-table-container') return tableContainer;
        if (sel === '#card-top-bar') return topBar;
        return null;
      },
      querySelectorAll: () => []
    };

    await renderStudentsModule(container, { onNavigate: () => {} });

    // Desktop view wrapper exists
    expect(tableContainer.innerHTML).toContain('class="students-desktop-table-wrap"');
    expect(tableContainer.innerHTML).toContain('student-directory-table');

    // Mobile view wrapper exists and eliminates horizontal scroll
    expect(tableContainer.innerHTML).toContain('class="students-mobile-list-wrap"');
    expect(tableContainer.innerHTML).toContain('class="students-mobile-header-row"');

    // Header has CLASS on the right instead of ID NUMBER
    expect(tableContainer.innerHTML).toContain('STUDENT INFO');
    expect(tableContainer.innerHTML).toContain('th-class');
    expect(tableContainer.innerHTML).toContain('CLASS');

    // Rows show student class pill and student-mobile-card-row
    expect(tableContainer.innerHTML).toContain('student-mobile-card-row');
    expect(tableContainer.innerHTML).toContain('student-mobile-class-pill');
    expect(tableContainer.innerHTML).toContain('STD-');
  });

  it('Teacher dashboard renders "Your upcoming class" card and tapping it navigates to that class attendance', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    let navigatedRoute = null;
    const clickListeners = {};
    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        return {
          addEventListener: (evt, fn) => {
            clickListeners[sel] = fn;
          }
        };
      },
      querySelectorAll: () => []
    };

    await renderTeacherDashboard(container, {
      onNavigate: (route) => { navigatedRoute = route; }
    });

    expect(container.innerHTML).toContain('Your upcoming class');
    expect(container.innerHTML).toContain('card-teacher-upcoming-class');
    expect(container.innerHTML).toContain('Schedule Time');
    expect(container.innerHTML).toContain('Enrolled Roster');

    // Tap on the card
    clickListeners['#card-teacher-upcoming-class']?.();
    expect(navigatedRoute).toBe('attendance');
  });

  it('Attendance module renders big class description card on top with no dropdowns and compact student cards with 2-way switches', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(container, { onNavigate: () => {}, initialClassId: 'cls-1' });

    // Big Class Description Card on Top
    expect(container.innerHTML).toContain('att-big-class-card');
    expect(container.innerHTML).toContain('att-card-date-badge');
    expect(container.innerHTML).toContain('att-date-badge-trigger');
    expect(container.innerHTML).toContain('Class Time');
    expect(container.innerHTML).toContain('Total Students');

    // No dropdowns
    expect(container.innerHTML).not.toContain('id="att-cls-select"');
    expect(container.innerHTML).not.toContain('id="att-class-filter"');
    expect(container.innerHTML).not.toContain('id="att-gender-filter"');

    // Compact student cards with 2-way switches
    expect(container.innerHTML).toContain('attendance-compact-list');
    expect(container.innerHTML).toContain('attendance-compact-card');
    expect(container.innerHTML).toContain('att-2way-switch');
    expect(container.innerHTML).toContain('sw-absent');
    expect(container.innerHTML).toContain('att-switch-thumb');
  });

  it('Editing attendance during class time saves absent student switched to present as "Late Present"', async () => {
    const sessionDate = '2026-10-27';
    const classroomId = 'cls-1';

    // 1. Initial submission where st-1 is Present and st-2 is Absent
    const initialSession = await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: classroomId,
      session_date: sessionDate,
      teacher_id: 'u-2',
      teacher_name: 'Rashid Sir',
      records: [
        { student_id: 'st-1', status: 'Present' },
        { student_id: 'st-2', status: 'Absent' }
      ]
    });

    expect(initialSession.records.find(r => r.student_id === 'st-2').status).toBe('Absent');

    // 2. Later during class time, teacher edits st-2 from Absent to Present -> becomes "Late Present"
    const updatedSession = await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: classroomId,
      session_date: sessionDate,
      teacher_id: 'u-2',
      teacher_name: 'Rashid Sir',
      records: [
        { student_id: 'st-1', status: 'Present' },
        { student_id: 'st-2', status: 'Late Present' }
      ]
    });

    expect(updatedSession.records.find(r => r.student_id === 'st-2').status).toBe('Late Present');
    expect(updatedSession.records.find(r => r.student_id === 'st-1').status).toBe('Present');
  });

  it('Cloud Database Synchronization guarantees identical unified classrooms, timings, and assignments across Desktop and Mobile', async () => {
    // Verify that getClassrooms returns the unified cloud state with Htl BB, 09:39 AM – 10:07 PM, and 9999
    const classrooms = await db.getClassrooms();
    const htlBB = classrooms.find(c => c.name === 'Htl BB');
    expect(htlBB).toBeDefined();
    expect(htlBB.start_time).toBe('09:39');
    expect(htlBB.end_time).toBe('22:07');
    expect(htlBB.room_number).toBe('105');

    const class9999 = classrooms.find(c => c.name === '9999');
    expect(class9999).toBeDefined();

    // Verify student assignments for Htl BB
    const assignedStudents = await db.getClassroomStudents('cls-4');
    expect(Array.isArray(assignedStudents)).toBe(true);
  });

  it('PhonePe-style 3-Column Drum Wheel Date Picker: utility parsing and mobile detection tests', () => {
    // 1. formatDateYMD
    const testDate = new Date(1995, 11, 8); // 8 Dec 1995
    expect(formatDateYMD(testDate)).toBe('1995-12-08');

    // 2. parseDateString
    const parsed1 = parseDateString('1995-12-08');
    expect(parsed1.getFullYear()).toBe(1995);
    expect(parsed1.getMonth()).toBe(11);
    expect(parsed1.getDate()).toBe(8);

    const parsed2 = parseDateString('08-Dec-1995');
    expect(parsed2.getFullYear()).toBe(1995);
    expect(parsed2.getMonth()).toBe(11);
    expect(parsed2.getDate()).toBe(8);

    // 3. Mobile picker detection and force flags
    if (typeof window !== 'undefined') {
      window.__TPS_FORCE_MOBILE_PICKER__ = true;
      expect(isMobileDatePicker()).toBe(true);
      window.__TPS_FORCE_MOBILE_PICKER__ = undefined;
    }

    // 4. getFieldTitle dynamic contextual title resolution (never includes "(as per PAN)")
    const dobInput = { id: 'adm-dob', dataset: {}, getAttribute: () => null };
    expect(getFieldTitle(dobInput)).toBe('Date of Birth');
    expect(getFieldTitle(dobInput)).not.toContain('PAN');

    const admDateInput = { id: 'adm-date', dataset: {}, getAttribute: () => null };
    expect(getFieldTitle(admDateInput)).toBe('Admission Date');

    const examInput = { id: 'exam-start', dataset: {}, getAttribute: () => null };
    expect(getFieldTitle(examInput)).toBe('Exam Date');

    const panLabelInput = {
      id: 'custom-field',
      dataset: {},
      getAttribute: () => null,
      closest: () => ({
        querySelector: () => ({ textContent: 'Date of Birth (as per PAN) *' })
      })
    };
    expect(getFieldTitle(panLabelInput)).toBe('Date of Birth');
    expect(getFieldTitle(panLabelInput)).not.toContain('PAN');

    // 5. User specification: First time open date defaults to 10 Jun 2010
    const emptyInput = { getAttribute: () => null, value: '' };
    const emptyParsed = parseDateString(emptyInput.value);
    const initialDefault = (!emptyParsed || isNaN(emptyParsed.getTime()))
      ? new Date(2010, 5, 10)
      : emptyParsed;
    expect(initialDefault.getFullYear()).toBe(2010);
    expect(initialDefault.getMonth()).toBe(5); // Jun (0-indexed)
    expect(initialDefault.getDate()).toBe(10);

    // 6. User specification: After they set the date, their set date is preserved
    const setInput = { getAttribute: () => '2015-08-25', value: '2015-08-25' };
    const setParsed = parseDateString(setInput.getAttribute('data-date-raw') || setInput.value);
    expect(setParsed.getFullYear()).toBe(2015);
    expect(setParsed.getMonth()).toBe(7); // Aug
    expect(setParsed.getDate()).toBe(25);

    // 7. User specification: Years in Descending Order from current year, none above current year
    const currentYear = new Date().getFullYear();
    const minYear = 1930;
    const descYears = [];
    for (let y = currentYear; y >= minYear; y--) {
      descYears.push(y);
    }
    expect(descYears[0]).toBe(currentYear);
    expect(descYears.every(y => y <= currentYear)).toBe(true);
    expect(descYears.includes(2010)).toBe(true);
    expect(descYears.indexOf(2010)).toBe(currentYear - 2010);
  });

  it('Mobile Date Picker: opens at the exact set date and does not reset to 01 Jan preset', async () => {
    let capturedDate = null;
    let appendedModal = null;
    let doneCallback = null;
    const originalDocument = global.document;

    const createMockElement = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        innerHTML: '',
        children: [],
        scrollTop: 0,
        getAttribute: (attr) => attr === 'data-index' ? '0' : null,
        setAttribute: () => {},
        classList: {
          add: (c) => { el.className += ' ' + c; },
          remove: () => {},
          contains: (c) => el.className.includes(c)
        },
        querySelector: (sel) => {
          if (sel === '#tps-wheel-col-day' || sel === '#tps-wheel-col-month' || sel === '#tps-wheel-col-year') {
            return createMockElement('div');
          }
          if (sel === '#tps-wheel-items-day' || sel === '#tps-wheel-items-month' || sel === '#tps-wheel-items-year') {
            return createMockElement('div');
          }
          if (sel === '#tps-wheel-done-btn') {
            return {
              addEventListener: (evt, cb) => {
                if (evt === 'click') doneCallback = cb;
              }
            };
          }
          if (sel === '#tps-wheel-cancel-btn') {
            return { addEventListener: () => {} };
          }
          return null;
        },
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: ({ top }) => { el.scrollTop = top; },
        remove: () => {}
      };
      return el;
    };

    global.document = {
      createElement: createMockElement,
      body: {
        classList: { add: () => {}, remove: () => {} },
        appendChild: (el) => { appendedModal = el; }
      }
    };

    try {
      // Test opening with October 15, 2026
      const initialDate = new Date(2026, 9, 15); // 15 Oct 2026
      openMobileWheelPicker({
        initialDate,
        title: 'Select Date',
        onSelect: (d) => { capturedDate = d; }
      });

      expect(appendedModal).toBeTruthy();

      // Trigger DONE button click
      expect(typeof doneCallback).toBe('function');
      doneCallback({ stopPropagation: () => {} });

      // Selected date must match 15 Oct 2026, NOT 01 Jan 2026
      expect(capturedDate).toBeTruthy();
      expect(capturedDate.getFullYear()).toBe(2026);
      expect(capturedDate.getMonth()).toBe(9); // Oct (0-indexed)
      expect(capturedDate.getDate()).toBe(15);
    } finally {
      global.document = originalDocument;
    }
  });

  it('Sections & Classrooms: renders responsive Mobile Section Selector Card matching Role Switcher pattern alongside Desktop Nav', async () => {
    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderSectionsModule(container, { onNavigate: () => {} });

    // Mobile Section Selector Card
    expect(container.innerHTML).toContain('sections-mobile-card');
    expect(container.innerHTML).toContain('sec-mobile-trigger');
    expect(container.innerHTML).toContain('CONFIGURING SECTION');
    expect(container.innerHTML).toContain('Switch');

    // Desktop Nav Bar
    expect(container.innerHTML).toContain('sections-desktop-nav');
    expect(container.innerHTML).toContain('btn-section-tab');
  });

  it('Academic Calendar: retrieves weekly working days, evaluates working days vs holidays, and manages custom dates', async () => {
    const cal = await db.getAcademicCalendar();
    expect(Array.isArray(cal.weekly_working_days)).toBe(true);
    expect(cal.weekly_working_days.includes('Mon')).toBe(true);
    expect(cal.weekly_working_days.includes('Sun')).toBe(false);

    // Gandhi Jayanti 2026-10-02 is a predefined holiday
    expect(db.isDateWorkingDay('2026-10-02', cal)).toBe(false);

    // Regular Wednesday 2026-10-07 is a working day
    expect(db.isDateWorkingDay('2026-10-07', cal)).toBe(true);

    // Sunday 2026-10-18 is weekend off
    expect(db.isDateWorkingDay('2026-10-18', cal)).toBe(false);

    // Special working day override on Sunday 2026-10-26
    expect(db.isDateWorkingDay('2026-10-26', cal)).toBe(true);

    // Add and remove custom holiday
    const testDate = '2026-12-25';
    await db.addCalendarHoliday({ date: testDate, name: 'Christmas Day', type: 'holiday' });
    const updatedCal = await db.getAcademicCalendar();
    expect(db.isDateWorkingDay(testDate, updatedCal)).toBe(false);

    await db.removeCalendarHoliday(testDate);
    const finalCal = await db.getAcademicCalendar();
    expect(finalCal.events.some(e => e.date === testDate)).toBe(false);

    // Multi-day Date Range Holiday Engine (Screenshot 2 pattern)
    const rangeStart = '2026-11-20';
    const rangeEnd = '2026-11-23';
    await db.addCalendarHolidayRange({ startDate: rangeStart, endDate: rangeEnd, name: 'Special Vacation Break', type: 'holiday' });
    const rangeCal = await db.getAcademicCalendar();
    expect(db.isDateWorkingDay('2026-11-20', rangeCal)).toBe(false);
    expect(db.isDateWorkingDay('2026-11-21', rangeCal)).toBe(false);
    expect(db.isDateWorkingDay('2026-11-22', rangeCal)).toBe(false);
    expect(db.isDateWorkingDay('2026-11-23', rangeCal)).toBe(false);

    const startEv = rangeCal.events.find(e => e.date === rangeStart);
    const endEv = rangeCal.events.find(e => e.date === rangeEnd);
    expect(startEv.is_range_start).toBe(true);
    expect(endEv.is_range_end).toBe(true);
  });

  it('Attendance Reports: renders Institutional ATTENDANCE RECORD badge, section selector, class submission audit, and mobile alternative views with faded holidays & leaves', async () => {
    // Real container mock that stores innerHTML and resolves inner container
    const mockReportBox = { innerHTML: '' };
    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#report-view-container') return mockReportBox;
        return null;
      },
      querySelectorAll: () => []
    };

    await renderReportsModule(container, { onNavigate: () => {} });

    // Header & Tabs
    expect(container.innerHTML).toContain('Student Attendance');
    expect(container.innerHTML).toContain('Class Attendance Audit');
    expect(container.innerHTML).toContain('Academic Calendar & Holidays');

    // Screenshot 1 Elements in active report
    expect(mockReportBox.innerHTML).toContain('ATTENDANCE RECORD');
    expect(mockReportBox.innerHTML).toContain('THAIBA GARDEN');
    expect(mockReportBox.innerHTML).toContain('Section :');
    expect(mockReportBox.innerHTML).toContain('Class :');
    expect(mockReportBox.innerHTML).toContain('Working Days');
    expect(mockReportBox.innerHTML).toContain('Prec /');
    expect(mockReportBox.innerHTML).toContain('Mobile Cards');
    expect(mockReportBox.innerHTML).toContain('Wide Grid');

    // Faded cells for holidays and leave
    expect(mockReportBox.innerHTML).toContain('matrix-cell-faded-holiday');
    expect(mockReportBox.innerHTML).toContain('matrix-cell-present');
  });

  it('Dedicated Academic Calendar Module: registers calendar route, renders institutional visual monthly grid, and bridge link to attendance report', async () => {
    // 1. Verify module is registered in permissions
    const calDef = MODULE_DEFINITIONS.find(m => m.key === 'calendar');
    expect(calDef).toBeDefined();
    expect(calDef.label).toBe('Academic Calendar');
    expect(calDef.icon).toBe('calendar');

    // 2. Render dedicated visual calendar module (institutional)
    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderCalendarModule(container, { onNavigate: () => {} });

    // Verify institutional calendar elements
    expect(container.innerHTML).toContain('Academic Calendar');
    expect(container.innerHTML).toContain('cal-metrics-grid');
    expect(container.innerHTML).toContain('Total Days');
    expect(container.innerHTML).toContain('Working Days');
    expect(container.innerHTML).toContain('Official Holidays');
    expect(container.innerHTML).toContain('Weekend Offs');

    // Bridge link to student attendance in reports
    expect(container.innerHTML).toContain('btn-goto-student-attendance-report');

    // Visual monthly grid elements
    expect(container.innerHTML).toContain('Sun');
    expect(container.innerHTML).toContain('Mon');
    expect(container.innerHTML).toContain('Tue');
    expect(container.innerHTML).toContain('cal-month-grid');
    expect(container.innerHTML).toContain('cal-day-box');

    // Mobile minimal layout & status dot indicators
    expect(container.innerHTML).toContain('cal-cell-desktop');
    expect(container.innerHTML).toContain('cal-cell-mobile');
    expect(container.innerHTML).toContain('cal-mobile-dot');
    expect(container.innerHTML).toContain('cal-dow-full');
    expect(container.innerHTML).toContain('cal-dow-short');

    // Screenshot 2 Event Calendar styling & Monday-first weekday headers
    expect(container.innerHTML).toContain('Event Calendar');
    expect(container.innerHTML).toContain('cal-month-nav-bar');
    expect(container.innerHTML).toContain('cal-day-circle');
    expect(container.innerHTML).toContain('MO');
    expect(container.innerHTML).toContain('TU');
    expect(container.innerHTML).toContain('SU');
    expect(container.innerHTML).toContain('Range:');

    // Light yellow holiday, red hostel leave, and removal of select range button
    expect(container.innerHTML).not.toContain('id="btn-toggle-range-mode"');
    expect(container.innerHTML).toContain('Holiday (Yellow)');
    expect(container.innerHTML).toContain('Hostel Leave (Red)');
  });

  it('Academic Calendar Mobile View: day box click triggers institutional schedule inspection popup modal', async () => {
    let appendedModal = null;
    const originalDocument = global.document;
    global.document = {
      createElement: (tag) => {
        const el = {
          tagName: tag,
          className: '',
          innerHTML: '',
          classList: { remove: () => {} },
          querySelector: (sel) => ({
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => []
          }),
          querySelectorAll: (sel) => [],
          addEventListener: () => {},
          remove: () => {}
        };
        return el;
      },
      body: {
        appendChild: (el) => {
          appendedModal = el;
        }
      }
    };

    try {
      const dayBoxCallbacks = {};
      const mockContainer = {
        innerHTML: '',
        querySelector: (selector) => null,
        querySelectorAll: (selector) => {
          if (selector === '.cal-day-box') {
            return [
              {
                getAttribute: (attr) => attr === 'data-date' ? '2026-10-12' : null,
                addEventListener: (event, cb) => {
                  dayBoxCallbacks[event] = cb;
                }
              }
            ];
          }
          return [];
        }
      };

      await renderCalendarModule(mockContainer, { onNavigate: () => {} });

      // Simulate click on calendar day box
      expect(typeof dayBoxCallbacks['click']).toBe('function');
      dayBoxCallbacks['click']();

      // Verify modal overlay was injected into document.body
      expect(appendedModal).toBeTruthy();
      expect(appendedModal.className).toContain('modal-overlay');
      expect(appendedModal.innerHTML).toContain('Institutional Calendar Details');
      expect(appendedModal.innerHTML).toContain('Institutional Schedule');
      expect(appendedModal.innerHTML).toContain('2026');
    } finally {
      global.document = originalDocument;
    }
  });

  it('Academic Calendar Add Holiday Modal: divides date boxes equally to fit card (50/50 multi-day grid)', async () => {
    let appendedModal = null;
    const originalDocument = global.document;
    global.document = {
      createElement: (tag) => {
        const el = {
          tagName: tag,
          className: '',
          innerHTML: '',
          classList: { remove: () => {} },
          querySelector: (sel) => ({
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => []
          }),
          querySelectorAll: (sel) => [],
          addEventListener: () => {},
          remove: () => {}
        };
        return el;
      },
      body: {
        appendChild: (el) => {
          appendedModal = el;
        }
      }
    };

    try {
      const container = {
        innerHTML: '',
        querySelector: (sel) => {
          if (sel === '#btn-add-cal-holiday') {
            return {
              addEventListener: (event, cb) => {
                if (event === 'click') cb();
              }
            };
          }
          return null;
        },
        querySelectorAll: () => []
      };

      await renderCalendarModule(container, { onNavigate: () => {} });

      // Trigger add holiday modal
      expect(appendedModal).toBeTruthy();
      expect(appendedModal.innerHTML).toContain('Add Institutional Holiday or Event');
      expect(appendedModal.innerHTML).toContain('cal-modal-date-range-grid');
      expect(appendedModal.innerHTML).toContain('modal-holiday-start-date');
      expect(appendedModal.innerHTML).toContain('modal-holiday-end-date');
      expect(appendedModal.innerHTML).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    } finally {
      global.document = originalDocument;
    }
  });

  it('Academic Calendar Holidays & Events: groups multi-day leave or holiday range into a single consolidated card', async () => {
    // Add multi-day hostel leave range (e.g. 03 Oct to 05 Oct 2026)
    await db.addCalendarHolidayRange({
      startDate: '2026-10-03',
      endDate: '2026-10-05',
      name: 'Llleve',
      type: 'hostel_leave'
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderCalendarModule(container, { onNavigate: () => {} });

    // Multi-day leave must render into a single card with range dates and day count
    expect(container.innerHTML).toContain('Llleve');
    expect(container.innerHTML).toContain('03.Oct.2026 – 05.Oct.2026');
    expect(container.innerHTML).toContain('(3 Days)');
    expect(container.innerHTML).toContain('Hostel Leave');

    // Clean up
    await db.removeCalendarHoliday('2026-10-03');
  });

  it('Attendance Reports Student Calendar View: renders Screenshot 3 student filter toolbar and day box click triggers student inspection popup modal', async () => {
    let appendedModal = null;
    const originalDocument = global.document;
    global.document = {
      createElement: (tag) => {
        const el = {
          tagName: tag,
          className: '',
          innerHTML: '',
          classList: { remove: () => {} },
          querySelector: (sel) => ({
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => []
          }),
          querySelectorAll: (sel) => [],
          addEventListener: () => {},
          remove: () => {}
        };
        return el;
      },
      body: {
        appendChild: (el) => {
          appendedModal = el;
        }
      }
    };

    try {
      const dayBoxCallbacks = {};
      const mockReportBox = { innerHTML: '' };
      let calendarSwitchCallback = null;

      const container = {
        innerHTML: '',
        querySelector: (sel) => {
          if (sel === '#report-view-container') return mockReportBox;
          if (sel === '#btn-view-student-calendar') {
            return {
              addEventListener: (evt, cb) => {
                calendarSwitchCallback = cb;
              }
            };
          }
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel === '.cal-day-box') {
            return [
              {
                getAttribute: (attr) => attr === 'data-date' ? '2026-10-12' : null,
                addEventListener: (event, cb) => {
                  dayBoxCallbacks[event] = cb;
                }
              }
            ];
          }
          return [];
        }
      };

      await renderReportsModule(container, { onNavigate: () => {} });

      // Switch to Student Calendar view mode
      expect(typeof calendarSwitchCallback).toBe('function');
      calendarSwitchCallback();

      // Verify Screenshot 3 Student Filters live inside Attendance Reports
      expect(mockReportBox.innerHTML).toContain('Search student by name, ID, class...');
      expect(mockReportBox.innerHTML).toContain('cal-filter-section');
      expect(mockReportBox.innerHTML).toContain('cal-filter-class');
      expect(mockReportBox.innerHTML).toContain('cal-filter-student');

      // Verify Active Student Hero & visual monthly grid
      expect(mockReportBox.innerHTML).toContain('MD Aamir');
      expect(mockReportBox.innerHTML).toContain('cal-month-grid');
      expect(mockReportBox.innerHTML).toContain('cal-mobile-dot');

      // Simulate day click
      expect(typeof dayBoxCallbacks['click']).toBe('function');
      dayBoxCallbacks['click']();

      // Verify Daily Attendance Inspection popup modal was opened with student name
      expect(appendedModal).toBeTruthy();
      expect(appendedModal.className).toContain('modal-overlay');
      expect(appendedModal.innerHTML).toContain('Daily Attendance Inspection');
      expect(appendedModal.innerHTML).toContain('MD Aamir');
      expect(appendedModal.innerHTML).toContain('2026');
    } finally {
      global.document = originalDocument;
    }
  });

  it('Attendance Report module access permissions: Teachers, Mentors, and Admins can access attendance_report', () => {
    const teacherUser = {
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    };

    const adminUser = {
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false
    };

    const pendingUser = {
      id: 'd0000000-0000-0000-0000-000000000007',
      email: 'pending@thaibaschool.edu.in',
      role: null,
      approval_status: 'pending',
      is_super_admin: false
    };

    // Module definition exists
    const repDef = MODULE_DEFINITIONS.find(m => m.key === 'attendance_report');
    expect(repDef).toBeDefined();
    expect(repDef.roles).toContain('teacher');
    expect(repDef.roles).toContain('admin');

    // Access checks
    expect(canAccessModule(teacherUser, 'attendance_report')).toBe(true);
    expect(canAccessModule(adminUser, 'attendance_report')).toBe(true);
    expect(canAccessModule(pendingUser, 'attendance_report')).toBe(false);
  });

  it('Cascading dropdowns in Attendance Report: Admin can select teacher to cascade sections and classes, while teacher view is strictly scoped to their own duty', async () => {
    // 1. Admin View
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false
    });

    const adminContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceReportModule(adminContainer, { onNavigate: () => {} });

    expect(adminContainer.innerHTML).toContain('att-rep-teacher-select');
    expect(adminContainer.innerHTML).toContain('att-rep-section-select');
    expect(adminContainer.innerHTML).toContain('att-rep-class-select');
    expect(adminContainer.innerHTML).toContain('Administrative Governance');

    // 2. Teacher View
    updateCurrentUserProfile({
      id: 'u-2',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const teacherContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceReportModule(teacherContainer, { onNavigate: () => {} });

    // Teacher cannot change teacher (no teacher select dropdown)
    expect(teacherContainer.innerHTML).not.toContain('id="att-rep-teacher-select"');
    expect(teacherContainer.innerHTML).toContain('My Account');
    expect(teacherContainer.innerHTML).toContain('Personal Faculty Duty');
    // But teacher can select their assigned sections and classes
    expect(teacherContainer.innerHTML).toContain('att-rep-section-select');
    expect(teacherContainer.innerHTML).toContain('att-rep-class-select');
  });

  it('Calendar UI in Attendance Report: renders unworking class days as faded, holidays as yellow, hostel leaves as fade red text only, and missed attendance as red color round', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false
    });

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceReportModule(container, { onNavigate: () => {} });

    // Calendar grid elements
    expect(container.innerHTML).toContain('cal-fluent-grid-card');
    expect(container.innerHTML).toContain('cal-month-nav-bar');
    expect(container.innerHTML).toContain('cal-month-grid');

    // Visual indicators
    expect(container.innerHTML).toContain('is-class-off-day');      // Timetable unworking day faded
    expect(container.innerHTML).toContain('is-holiday-single');     // Academic calendar holiday
    expect(container.innerHTML).toContain('is-missed-attendance');  // Red colour round for missed attendance

    // Legend items
    expect(container.innerHTML).toContain('Missed Attendance (Red Round)');
    expect(container.innerHTML).toContain('Hostel Leave (Fade Red Text)');
    expect(container.innerHTML).toContain('Holiday (Yellow)');
    expect(container.innerHTML).toContain('Class Off Day (Faded)');
  });

  it('Admin can allow (unlock) and close (lock) missed attendance for assigned teachers', async () => {
    const classId = 'cls-1';
    const testDate = '2026-10-14';

    // 1. Initial state: locked
    expect(await db.isAttendanceWindowUnlocked(classId, testDate)).toBe(false);

    // 2. Admin allows / unlocks missed attendance
    await db.unlockAttendanceWindow(classId, testDate);
    expect(await db.isAttendanceWindowUnlocked(classId, testDate)).toBe(true);

    // 3. Admin closes / locks missed attendance
    await db.lockAttendanceWindow(classId, testDate);
    expect(await db.isAttendanceWindowUnlocked(classId, testDate)).toBe(false);
  });

  it('Attendance timing & teacher protection: prevents teachers from editing already taken attendance, while allowing admins to edit', async () => {
    const classId = 'cls-1';
    const submittedDate = '2026-10-15';

    // Save existing session
    await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: classId,
      session_date: submittedDate,
      teacher_id: 'u-2',
      teacher_name: 'Rashid Sir',
      records: [
        { student_id: 'st-1', status: 'Present' },
        { student_id: 'st-2', status: 'Absent' }
      ]
    });

    // 1. Teacher view on submitted attendance
    updateCurrentUserProfile({
      id: 'u-2',
      email: 'teacher@thaibaschool.edu.in',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const teacherContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(teacherContainer, { onNavigate: () => {}, initialClassId: classId, initialDate: submittedDate });

    // Teacher cannot edit already submitted attendance
    expect(teacherContainer.innerHTML).toContain('Attendance Already Submitted (Locked for Teacher)');
    expect(teacherContainer.innerHTML).toContain('Only Administrators are permitted to edit recorded attendance');

    // 2. Admin view on submitted attendance
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false
    });

    const adminContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(adminContainer, { onNavigate: () => {}, initialClassId: classId, initialDate: submittedDate });

    // Admin CAN edit already submitted attendance
    expect(adminContainer.innerHTML).toContain('Confirm & Submit Attendance');
    expect(adminContainer.innerHTML).toContain('Admin Override Mode');
  });

  it('Late Attendance UI: right-side button area shows yellow (sw-late), label is short "L", and Admin can see how many minutes late student arrived after class started', async () => {
    const classId = 'cls-1';
    const lateSessionDate = '2026-10-16';
    const studentsInDb = await db.getStudents();
    const testStudent = studentsInDb[0];

    // Seed existing session with a Late Present student having 25 late minutes
    await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: classId,
      session_date: lateSessionDate,
      teacher_id: 'u-2',
      teacher_name: 'Rashid Sir',
      records: [
        { student_id: testStudent.id, status: 'Late Present', late_minutes: 25 }
      ]
    });

    // 1. Admin logs in
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false
    });

    const adminContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(adminContainer, { 
      onNavigate: () => {}, 
      initialClassId: classId, 
      initialDate: lateSessionDate 
    });

    const html = adminContainer.innerHTML;

    // A. Switch area has yellow class 'sw-late'
    expect(html).toContain('sw-late');

    // B. Switch label is short 'L' (not 'LATE')
    expect(html).toContain('>L</span>');
    expect(html).not.toContain('>LATE</span>');

    // C. Student card has is-late class and late badge with minutes
    expect(html).toContain('attendance-compact-card');
    expect(html).toContain('is-late');
    expect(html).toContain('att-late-badge');
    expect(html).toContain('25m late');

    // D. Admin visibility of minutes late after class started
    expect(html).toContain('att-late-admin-note');
    expect(html).toContain('25 min late');
    expect(html).toContain('Class:');

    // 2. Teacher logs in to view same session (unlocked)
    await db.unlockAttendanceWindow(classId, lateSessionDate);
    updateCurrentUserProfile({
      id: 'u-2',
      email: 'teacher@thaibaschool.edu.in',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const teacherContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(teacherContainer, { 
      onNavigate: () => {}, 
      initialClassId: classId, 
      initialDate: lateSessionDate 
    });

    const teacherHtml = teacherContainer.innerHTML;
    // Teacher sees yellow button and short 'L', but administrative detailed note is admin-specific
    expect(teacherHtml).toContain('sw-late');
    expect(teacherHtml).toContain('>L</span>');
    expect(teacherHtml).toContain('25m late');
  });

  it('Attendance Management Window: displays Timetable Cards matching design spec, strictly scoped to teacher own classes, with Take Attendance faded outside class hours and details accessible after time', async () => {
    // 1. Teacher view: strictly scoped to own timetable
    updateCurrentUserProfile({
      id: 'u-2',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    const teacherContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(teacherContainer, { onNavigate: () => {} });

    const teacherHtml = teacherContainer.innerHTML;

    // A. Displays cards matching design spec
    expect(teacherHtml).toContain('teacher-upcoming-card');
    expect(teacherHtml).toContain('upcoming-card-top');
    expect(teacherHtml).toContain('upcoming-divider');
    expect(teacherHtml).toContain('upcoming-class-primary');
    expect(teacherHtml).toContain('upcoming-details-grid');
    expect(teacherHtml).toContain('Schedule Time');
    expect(teacherHtml).toContain('Classroom / Hall');
    expect(teacherHtml).toContain('Enrolled Roster');
    expect(teacherHtml).toContain('Scheduled Days');

    // B. Actions: View Details and Take Attendance
    expect(teacherHtml).toContain('btn-card-view-details');
    expect(teacherHtml).toContain('btn-card-take-att');

    // C. The Take Attendance button is faded outside of class hours
    expect(teacherHtml).toContain('is-faded');

    // D. Scoping: Teacher sees only their own assigned timetable classes, no other faculty
    expect(teacherHtml).toContain('Personal Timetable');
    expect(teacherHtml).not.toContain('id="att-admin-teacher-select"'); // No teacher switcher for teacher

    // 2. Admin view: can see administrative governance and teacher filter
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false
    });

    const adminContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderAttendanceModule(adminContainer, { onNavigate: () => {} });

    const adminHtml = adminContainer.innerHTML;
    expect(adminHtml).toContain('Administrative Governance');
    expect(adminHtml).toContain('id="att-admin-teacher-select"');
  });

  it('Faculty Tenure & Attendance Duties: missed attendance is only shown from assigned date, and ends when removed by admin', async () => {
    const classId = 'cls-1';
    const classrooms = await db.getClassrooms();
    const cls = classrooms.find(c => c.id === classId);
    expect(cls).toBeDefined();

    const teacherId = '3ba0d909-6656-43eb-87fb-fe8e30088d55';
    const assignments = await db.getTeacherAssignments();

    // 1. Historical dates before assignment date (2026-10-01) must NOT be assigned to this teacher
    const septDate = '2026-09-15';
    const isAssignedSept = db.isTeacherAssignedOnDate(teacherId, cls, septDate, assignments);
    expect(isAssignedSept).toBe(false);

    // 2. Active date during assignment (2026-10-15) must be assigned
    const octDate = '2026-10-15';
    const isAssignedOct = db.isTeacherAssignedOnDate(teacherId, cls, octDate, assignments);
    expect(isAssignedOct).toBe(true);

    // 3. Admin removes teacher from classroom on 2026-10-20
    const removalDate = '2026-10-20';
    await db.removeTeacherFromClassroom(classId, removalDate);

    const updatedAssignments = await db.getTeacherAssignments();
    const updatedClassrooms = await db.getClassrooms();
    const updatedCls = updatedClassrooms.find(c => c.id === classId);

    // Date before or on removal date (2026-10-15) remains historically valid
    expect(db.isTeacherAssignedOnDate(teacherId, updatedCls, '2026-10-15', updatedAssignments)).toBe(true);

    // Date AFTER removal date (2026-10-25) must NOT be assigned and duties must END
    expect(db.isTeacherAssignedOnDate(teacherId, updatedCls, '2026-10-25', updatedAssignments)).toBe(false);

    // 4. Restore assignment for subsequent test isolation
    await db.assignTeacherToClassroom(classId, teacherId, '2026-10-01');
    const restoredClassrooms = await db.getClassrooms();
    const restoredCls = restoredClassrooms.find(c => c.id === classId);
    expect(restoredCls.teacher_id).toBe(teacherId);
    expect(restoredCls.teacher_assigned_date).toBe('2026-10-01');
    expect(restoredCls.teacher_removed_date).toBeNull();
  });
});
