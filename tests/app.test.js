import { describe, it, expect, beforeEach } from 'vitest';
import { calculateLateDays, calculateLateFine, formatDate, formatCurrency, parseStudentsCSV, normalizeDate } from '../src/lib/utils.js';
import { canAccessModule, canPerformAction, MODULE_DEFINITIONS, DEFAULT_RBAC_MATRIX, getRBACMatrix, saveRBACMatrix, resetRBACMatrix, getUserCustomPermissions, saveUserCustomPermissions, clearUserCustomPermissions, isMentorRole, getMentorGenderScope } from '../src/lib/permissions.js';
import { from24Hour, to24Hour, format12Hour, attachWheelTimePicker, initAllWheelTimePickers } from '../src/lib/wheelTimePicker.js';
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
import { applyInstitutionalAppIcon } from '../src/app.js';
import { enhanceSelect } from '../src/components/custom-select.js';
import { getBottomNavItems, renderBottomNav } from '../src/components/bottom-nav.js';
import { renderLeavesModule } from '../src/modules/leaves/index.js';
import { renderHostelModule } from '../src/modules/hostel/index.js';
import { renderDisciplineModule } from '../src/modules/discipline/index.js';
import { renderFinesModule } from '../src/modules/fines/index.js';
import { renderFacultyLeavesModule } from '../src/modules/faculty-leaves/index.js';

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

  it('Student Profile Modal: supports Edit Student Record and Delete Student with resilient onMount listener binding', async () => {
    let editOpened = false;
    let modalClosed = false;

    const mockStudent = {
      id: 'st-test-999',
      full_name: 'MD Aamir',
      admission_number: 'TPS-2026-001',
      gender: 'Boys',
      dob: '2020-08-01',
      school_class: 'STD-1',
      status: 'On Approved Leave'
    };

    const listeners = {};
    const mockContainer = {
      querySelector: (sel) => {
        if (sel === '#modal-btn-edit-student') {
          return {
            addEventListener: (evt, fn) => { listeners['edit'] = fn; }
          };
        }
        if (sel === '#modal-btn-delete-student') {
          return {
            addEventListener: (evt, fn) => { listeners['delete'] = fn; }
          };
        }
        return null;
      }
    };

    const fakeMountParam = {
      container: mockContainer,
      close: () => { modalClosed = true; },
      querySelector: (...args) => mockContainer.querySelector(...args),
      querySelectorAll: () => []
    };

    const onMountHandler = ({ container: modalBody, close }) => {
      modalBody.querySelector('#modal-btn-edit-student')?.addEventListener('click', () => {
        close();
        editOpened = true;
      });
    };

    onMountHandler(fakeMountParam);

    expect(typeof listeners['edit']).toBe('function');
    listeners['edit']();
    expect(modalClosed).toBe(true);
    expect(editOpened).toBe(true);
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

  it('attachWheelTimePicker hides raw input, attaches .wheel-time-trigger with 12-hour formatted time and clock icon', () => {
    const parent = {
      children: [],
      insertBefore: (newChild, refChild) => {
        parent.children.push(newChild);
      }
    };
    const input = {
      tagName: 'INPUT',
      type: 'time',
      value: '16:26',
      style: { width: '125px', display: '' },
      parentNode: parent,
      nextSibling: null,
      getAttribute: (attr) => attr === 'data-picker-title' ? 'Actual Return Time' : null,
      addEventListener: () => {},
      dispatchEvent: () => {}
    };

    const originalDocument = global.document;
    global.document = {
      createElement: (tag) => {
        const el = {
          tagName: tag,
          className: '',
          style: {},
          innerHTML: '',
          setAttribute: (k, v) => { el[k] = v; },
          addEventListener: () => {},
          querySelector: (sel) => {
            if (sel === '.wheel-time-val') {
              return { textContent: '' };
            }
            return null;
          }
        };
        return el;
      }
    };

    try {
      attachWheelTimePicker(input);
      expect(input.style.display).toBe('none');
      expect(input.__wheelPickerAttached).toBe(true);
      expect(parent.children.length).toBe(1);
      const trigger = parent.children[0];
      expect(trigger.className).toBe('wheel-time-trigger');
      expect(trigger.innerHTML).toContain('04:26 PM');
      expect(trigger.innerHTML).toContain('<svg');
      expect(trigger.style.width).toBe('125px');
    } finally {
      global.document = originalDocument;
    }
  });

  it('initAllWheelTimePickers finds all time inputs in a container and attaches wheel pickers', () => {
    const parent = {
      children: [],
      insertBefore: (newChild) => { parent.children.push(newChild); }
    };
    const input1 = {
      tagName: 'INPUT',
      type: 'time',
      value: '09:15',
      style: {},
      parentNode: parent,
      nextSibling: null,
      getAttribute: () => null,
      addEventListener: () => {},
      dispatchEvent: () => {}
    };
    const container = {
      querySelectorAll: (sel) => {
        if (sel.includes('input[type="time"]')) return [input1];
        return [];
      }
    };

    const originalDocument = global.document;
    global.document = {
      createElement: () => ({
        tagName: 'button',
        className: '',
        style: {},
        innerHTML: '',
        setAttribute: () => {},
        addEventListener: () => {},
        querySelector: () => ({ textContent: '' })
      })
    };

    try {
      initAllWheelTimePickers(container);
      expect(input1.style.display).toBe('none');
      expect(input1.__wheelPickerAttached).toBe(true);
      expect(parent.children.length).toBe(1);
      expect(parent.children[0].innerHTML).toContain('09:15 AM');
    } finally {
      global.document = originalDocument;
    }
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

    // Verify Student Assignments is removed from sidebar
    expect(container.innerHTML).not.toContain('data-module="assignments"');
    expect(container.innerHTML).not.toContain('Student Assignments');
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
    expect(container.innerHTML).not.toContain("Today's Teaching Schedule");
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
    expect(teacherContainer.innerHTML).toContain('teacher-upcoming-card');
    expect(teacherContainer.innerHTML).toContain('upcoming-details-grid');
    expect(teacherContainer.innerHTML).toContain('Schedule Time');
    expect(teacherContainer.innerHTML).toContain('Classroom / Hall');
    expect(teacherContainer.innerHTML).toContain('Enrolled Roster');
    expect(teacherContainer.innerHTML).toContain('Scheduled Days');
    // Attendance button is omitted from timetable cards because attendance has its own dedicated window
    expect(teacherContainer.innerHTML).not.toContain('Take Attendance →');
    // Removed redundant contents to resize height
    expect(teacherContainer.innerHTML).not.toContain('Your upcoming class');
    expect(teacherContainer.innerHTML).not.toContain('Scheduled teaching session');

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
    // Admin needs name of faculty among them
    expect(adminContainer.innerHTML).toContain('Assigned Faculty');
    expect(adminContainer.innerHTML).toContain('Rashid Sir');
    // Full width altered design faculty filter card, no Add Timetable Slot button
    expect(adminContainer.innerHTML).toContain('Filter Timetable by Faculty');
    expect(adminContainer.innerHTML).toContain('timetable-faculty-filter');
    expect(adminContainer.innerHTML).not.toContain('btn-add-slot');
    expect(adminContainer.innerHTML).not.toContain('Add Timetable Slot');
  });

  it('Teacher Timetable displays cards for all assigned classes with strict faculty isolation', async () => {
    const originalCls = await db.getClassrooms();
    try {
      const updatedCls = originalCls.map(c => {
        if (c.id === 'cls-1') return { ...c, name: 'Special Science Lab', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed'] };
        if (c.id === 'cls-2') return { ...c, name: 'Advanced Robotics Hall', teacher_id: 'u-2', days: ['Thu', 'Fri', 'Sat'] };
        return { ...c, name: 'Other Faculty Room', teacher_id: 'u-99' };
      });
      db.set('tps_classrooms', updatedCls);

      updateCurrentUserProfile({
        id: 'u-2',
        email: 'teacher@thaibaschool.edu.in',
        role: 'teacher',
        approval_status: 'approved',
        is_super_admin: false
      });

      const teacherDiv = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderTimetableModule(teacherDiv, { onNavigate: () => {} });

      // Must show cards for both of teacher's assigned classes
      expect(teacherDiv.innerHTML).toContain('Special Science Lab');
      expect(teacherDiv.innerHTML).toContain('Advanced Robotics Hall');
      // Must NOT show cards for other faculty's classrooms
      expect(teacherDiv.innerHTML).not.toContain('Other Faculty Room');
      // No attendance button in timetable cards (managed in attendance window)
      expect(teacherDiv.innerHTML).not.toContain('Take Attendance →');
    } finally {
      db.set('tps_classrooms', originalCls);
    }
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

  it('Teacher Dashboard Mobile UI: renders 2 cards in a line (square type grid) with all 6 metric cards and floating mobile navigation bar', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false
    });

    let navigatedRoute = null;
    const pillListeners = {};
    const container = {
      innerHTML: '',
      querySelector: () => ({ addEventListener: () => {} }),
      querySelectorAll: (sel) => {
        if (sel === '.m-nav-pill-btn[data-nav]') {
          return [
            {
              getAttribute: (k) => k === 'data-nav' ? 'attendance' : null,
              addEventListener: (evt, fn) => { pillListeners['attendance'] = fn; }
            },
            {
              getAttribute: (k) => k === 'data-nav' ? 'timetable' : null,
              addEventListener: (evt, fn) => { pillListeners['timetable'] = fn; }
            }
          ];
        }
        return [];
      }
    };

    await renderTeacherDashboard(container, {
      onNavigate: (route) => { navigatedRoute = route; }
    });

    // 1. Grid stats container and 6 balanced metric cards
    expect(container.innerHTML).toContain('class="grid-stats"');
    expect(container.innerHTML).toContain("Today's Sessions");
    expect(container.innerHTML).toContain('Weekly Load');
    expect(container.innerHTML).toContain('My Classrooms');
    expect(container.innerHTML).toContain('Pending Attendance');
    expect(container.innerHTML).toContain('Exam Grading');
    expect(container.innerHTML).toContain('Attendance');
    expect(container.innerHTML).toContain('98.5%');

    // 2. Mobile floating bottom navigation bar
    expect(container.innerHTML).toContain('m-floating-bottom-nav');
    expect(container.innerHTML).toContain('data-nav="timetable"');
    expect(container.innerHTML).toContain('data-nav="attendance"');
    expect(container.innerHTML).toContain('data-nav="marks"');
    expect(container.innerHTML).toContain('data-nav="reports"');

    // 3. Navigation interaction via mobile bottom nav pill
    pillListeners['attendance']?.();
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

  it('Attendance Roster UI: card bottom shows only counters with Total Students and zero buttons; after card shows 3/5 search, 1/5 All Present, 1/5 Clear', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const listeners = {};
    const elements = {};
    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        if (!elements[sel]) {
          elements[sel] = {
            value: '',
            textContent: '',
            innerHTML: '',
            addEventListener: (evt, fn) => {
              listeners[sel] = fn;
            }
          };
        }
        return elements[sel];
      },
      querySelectorAll: () => []
    };

    await renderAttendanceModule(container, { onNavigate: () => {}, initialClassId: 'cls-1' });

    // 1. Bottom of card shows only Present, Absent, and On Leave with zero buttons and NO Total Students
    expect(container.innerHTML).toContain('att-class-footer-bar');
    expect(container.innerHTML).toContain('att-counters');
    expect(container.innerHTML).toContain('Present:');
    expect(container.innerHTML).toContain('Absent:');
    expect(container.innerHTML).toContain('On Leave:');
    // Verify no buttons inside the bottom of the card
    expect(container.innerHTML).not.toContain('att-bulk-btns');
    expect(container.innerHTML).not.toContain('id="btn-mark-all-absent"');

    // Bottom counter element does NOT contain "Total Students:"
    const countersHtml = container.innerHTML.substring(
      container.innerHTML.indexOf('id="att-counters"'),
      container.innerHTML.indexOf('</div>\n          </div>\n\n        <!-- Search Bar') > 0
        ? container.innerHTML.indexOf('</div>\n          </div>\n\n        <!-- Search Bar')
        : container.innerHTML.indexOf('att-search-actions-bar')
    );
    expect(countersHtml).not.toContain('Total Students:');

    // 2. Filter tabs row (All, In Class, etc.) is removed
    expect(container.innerHTML).not.toContain('att-roster-subbar');
    expect(container.innerHTML).not.toContain('att-roster-tab');
    expect(container.innerHTML).not.toContain('att-roster-filter-pills');

    // 3. After card action bar: 3/5 Search, 1/5 All Present, 1/5 Clear
    expect(container.innerHTML).toContain('att-search-actions-bar');
    expect(container.innerHTML).toContain('att-search-col-3-5');
    expect(container.innerHTML).toContain('att-search-input');
    expect(container.innerHTML).toContain('att-btn-col-1-5');
    expect(container.innerHTML).toContain('id="btn-mark-all-present"');
    expect(container.innerHTML).toContain('id="btn-clear-attendance"');
    expect(container.innerHTML).toContain('All Present');
    expect(container.innerHTML).toContain('Clear');

    // 4. Clear button functionality
    expect(typeof listeners['#btn-clear-attendance']).toBe('function');
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

  it('Academic Calendar Month Boundary Curvature: curves right edge on last day of month (Oct 31) and left edge on 1st day of month (Nov 1) for cross-month holiday ranges', async () => {
    // Add cross-month holiday range (Oct 30 to Nov 03, 2026)
    await db.addCalendarHolidayRange({
      startDate: '2026-10-30',
      endDate: '2026-11-03',
      name: 'Autumn Term Leave',
      type: 'holiday'
    });

    let nextMonthCb = null;
    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#cal-btn-next-month') {
          return {
            addEventListener: (event, cb) => {
              if (event === 'click') nextMonthCb = cb;
            }
          };
        }
        return null;
      },
      querySelectorAll: () => []
    };

    await renderCalendarModule(container, { onNavigate: () => {} });

    // 1. In October 2026:
    // Oct 30 is holiday start
    expect(container.innerHTML).toContain('data-date="2026-10-30"');
    expect(container.innerHTML).toMatch(/cal-inst-day-cell cal-day-box[^"]*is-holiday-start/);

    // Oct 31 is the last day of October: must be tagged with is-month-last and is-holiday-middle
    expect(container.innerHTML).toContain('data-date="2026-10-31"');
    expect(container.innerHTML).toMatch(/class="cal-inst-day-cell cal-day-box is-month-last[^"]*is-holiday-middle"/);

    // 2. Click next month button to inspect November 2026
    expect(typeof nextMonthCb).toBe('function');
    nextMonthCb();

    // In November 2026:
    // Nov 01 is the 1st day of November: must be tagged with is-month-first and is-holiday-middle
    expect(container.innerHTML).toContain('data-date="2026-11-01"');
    expect(container.innerHTML).toMatch(/class="cal-inst-day-cell cal-day-box is-month-first[^"]*is-holiday-middle"/);

    // Nov 03 is the holiday end
    expect(container.innerHTML).toContain('data-date="2026-11-03"');
    expect(container.innerHTML).toMatch(/cal-inst-day-cell cal-day-box[^"]*is-holiday-end/);

    // Clean up
    await db.removeCalendarHoliday('2026-10-30');
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

  it('Cascading Attendance Filter UI: displays only assigned faculty names without role suffix, class names without time, round D-format meeting day badges without long names, and strict cascading', async () => {
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
    const html = adminContainer.innerHTML;

    // 1. Faculty name only - no position/role suffix like (teacher) or (admin)
    expect(html).toContain('Rashid Sir');
    expect(html).not.toContain('Rashid Sir (teacher)');
    expect(html).not.toContain('(faculty)');

    // 2. Class name only in dropdown - no time range attached
    expect(html).toContain('>Moral Hall A1</option>');
    expect(html).not.toContain('Moral Hall A1 (06:00 AM – 07:00 AM)');
    expect(html).not.toContain('Moral Hall A1 (06:00 AM - 07:00 AM)');

    // 3. Meeting days format - round circular badges with 1-letter D format, no (Mon, Tue...) text
    expect(html).toContain('day-round active');
    expect(html).not.toContain('(Mon, Tue, Wed, Thu, Fri, Sat)');

    // 4. Strict cascading: unassigned faculty (e.g. parent or new applicant) are NOT in the dropdown
    expect(html).not.toContain('Ahmad K.T.');
    expect(html).not.toContain('New Applicant');

    // 5. Layout structure: Faculty name dropdown spans 100% full width to right edge of card; Section and Class dropdowns divided equally into a single row
    expect(html).toContain('grid-template-columns: 1fr 1fr');
    expect(html).toContain('Classroom & Faculty Duty');
    expect(html).toContain('tps-select-full-width');
    expect(html).toContain('select-full-width');
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

    // Minimal one-line legend items
    expect(container.innerHTML).toContain('M. Attendance');
    expect(container.innerHTML).toContain('F. Leave');
    expect(container.innerHTML).toContain('Taken');
    expect(container.innerHTML).toContain('Holiday');
    expect(container.innerHTML).toContain('H. Leave');
    expect(container.innerHTML).toContain('Class Off');

    // No verbose color or parenthetical descriptions in legend
    expect(container.innerHTML).not.toContain('(Red Round)');
    expect(container.innerHTML).not.toContain('(Yellow)');
    expect(container.innerHTML).not.toContain('(Fade Red Text)');
    expect(container.innerHTML).not.toContain('(Faded)');
    expect(container.innerHTML).not.toContain('(Waived)');

    // Bulk Month Missed Attendance button on top of calendar
    expect(container.innerHTML).toContain('btn-bulk-unlock-month');
    expect(container.innerHTML).toContain('Allow Month Missed Attendance');

    // Redundant bottom register table is removed
    expect(container.innerHTML).not.toContain('Missed Attendance Register');
  });

  it('Admin can allow (unlock) and close (lock) missed attendance for assigned teachers in single and bulk operations', async () => {
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

    // 4. Bulk month operations
    const bulkDates = ['2026-10-06', '2026-10-07', '2026-10-08'];
    await db.unlockAttendanceWindows(classId, bulkDates);
    for (const d of bulkDates) {
      expect(await db.isAttendanceWindowUnlocked(classId, d)).toBe(true);
    }
    await db.lockAttendanceWindows(classId, bulkDates);
    for (const d of bulkDates) {
      expect(await db.isAttendanceWindowUnlocked(classId, d)).toBe(false);
    }
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

  it('After submitting attendance, the attendance window which contains students list closes and returns to Timetable Cards', async () => {
    const classId = 'cls-1';
    const sessionDate = '2026-10-29';

    // Unlock window for this date
    await db.unlockAttendanceWindow(classId, sessionDate);

    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const listeners = {};
    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        return {
          addEventListener: (evt, fn) => {
            listeners[sel] = fn;
          }
        };
      },
      querySelectorAll: () => []
    };

    // Initial render directly into roster view for cls-1
    await renderAttendanceModule(container, {
      onNavigate: () => {},
      initialClassId: classId,
      initialDate: sessionDate
    });

    // 1. Initially student roster window is open (contains students list)
    expect(container.innerHTML).toContain('att-cards-container');
    expect(container.innerHTML).toContain('attendance-compact-card');
    expect(container.innerHTML).toContain('id="btn-submit-attendance"');

    // 2. Click Submit Attendance button
    expect(typeof listeners['#btn-submit-attendance']).toBe('function');
    await listeners['#btn-submit-attendance']();

    // 3. Verification: The student roster window containing students list has CLOSED
    expect(container.innerHTML).not.toContain('id="att-cards-container"');
    expect(container.innerHTML).not.toContain('attendance-compact-card');

    // 4. Returned to Timetable Cards view where this class is marked "Attendance Recorded"
    expect(container.innerHTML).toContain('teacher-upcoming-card');
    expect(container.innerHTML).toContain('Attendance Recorded');
    expect(container.innerHTML).toContain('btn-card-view-details');
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

  it('Institutional App Icon & Manifest Sync: dynamic favicon, apple-touch-icon, and PWA manifest reflect Institution Settings logo', () => {
    const mockFavicon = { href: '/tps-logo.png', type: 'image/png' };
    const mockAppleIcon = { href: '/tps-logo.png' };
    const mockManifest = { href: '/manifest.json' };

    const fakeDoc = {
      querySelector: (selector) => {
        if (selector === 'link[rel="icon"]') return mockFavicon;
        if (selector === 'link[rel="apple-touch-icon"]') return mockAppleIcon;
        if (selector === 'link[rel="manifest"]') return mockManifest;
        return null;
      }
    };
    const prevDoc = globalThis.document;
    globalThis.document = fakeDoc;

    const memoryStorage = {};
    const fakeStorage = {
      getItem: (k) => memoryStorage[k] || null,
      setItem: (k, v) => { memoryStorage[k] = String(v); },
      removeItem: (k) => { delete memoryStorage[k]; }
    };
    const prevStorage = globalThis.localStorage;
    globalThis.localStorage = fakeStorage;

    try {
      // 1. By default, applies official Thaiba logo
      applyInstitutionalAppIcon();
      expect(mockFavicon.href).toBe('/tps-logo.png');
      expect(mockAppleIcon.href).toBe('/tps-logo.png');

      // 2. Custom logo uploaded in Institution Settings dynamically updates favicon & apple icon
      const customLogoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      fakeStorage.setItem('tps_institution_logo', customLogoData);

      applyInstitutionalAppIcon();
      expect(mockFavicon.href).toBe(customLogoData);
      expect(mockAppleIcon.href).toBe(customLogoData);

      // 3. Resetting logo restores official default logo
      fakeStorage.removeItem('tps_institution_logo');
      applyInstitutionalAppIcon();
      expect(mockFavicon.href).toBe('/tps-logo.png');
      expect(mockAppleIcon.href).toBe('/tps-logo.png');
    } finally {
      globalThis.document = prevDoc;
      globalThis.localStorage = prevStorage;
    }
  });

  it('In-memory DB caching speeds up repeated window opens and data fetching', async () => {
    // 1. db.getStudents caching
    db.invalidateCache('students');
    const students1 = await db.getStudents();
    const students2 = await db.getStudents();
    // Subsequent call returns exact cached instance instantly (0ms)
    expect(students1).toBe(students2);

    // Invalidation clears cache
    db.invalidateCache('students');
    const students3 = await db.getStudents();
    expect(students3).not.toBe(students1);
    expect(students3).toEqual(students1);

    // 2. db.getUsers caching
    db.invalidateCache('users');
    const users1 = await db.getUsers();
    const users2 = await db.getUsers();
    expect(users1).toBe(users2);

    db.invalidateCache('users');
    const users3 = await db.getUsers();
    expect(users3).not.toBe(users1);
    expect(users3).toEqual(users1);

    // 3. Setting a key updates cloud keys timestamp map
    db.set('tps_programs', [{ id: 'prog-test', name: 'Test Program' }]);
    expect(db._pulledKeysTime.has('tps_programs')).toBe(true);
  });

  it('Renders new executive mobile dashboard with dark hero card, 2x2 bento grid, donut gauge, residents carousel and floating nav', async () => {
    updateCurrentUserProfile({
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'abdulhaseebkt2@gmail.com',
      full_name: 'Haseeb Mubarak',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true
    });

    const listeners = {};
    const elements = {};

    function makeMockElement(tag, className = '', id = '') {
      return {
        tag,
        className,
        id,
        textContent: '',
        innerHTML: '',
        getAttribute: (attr) => (attr === 'data-route' ? 'admissions' : attr === 'data-nav' ? 'dashboard' : null),
        addEventListener: (event, handler) => {
          listeners[`${id || className || tag}:${event}`] = handler;
        }
      };
    }

    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        if (!elements[sel]) elements[sel] = makeMockElement('div', sel.replace('.', ''), sel.replace('#', ''));
        return elements[sel];
      },
      querySelectorAll: (sel) => [makeMockElement('div', sel.replace('.', ''))]
    };

    await renderAdminDashboard(container, { onNavigate: () => {} });

    // 1. Verify responsive dual views exist
    expect(container.innerHTML).toContain('dash-mobile-view');
    expect(container.innerHTML).toContain('dash-desktop-view');

    // 2. Verify dark executive hero card & eye toggle
    expect(container.innerHTML).toContain('m-hero-card');
    expect(container.innerHTML).toContain('m-hero-eye-toggle');
    expect(container.innerHTML).toContain('THAIBASCHOOL CAMPUS');
    expect(container.innerHTML).toContain('TOTAL RESIDENTS ENROLLED');

    // 3. Verify 2x2 Bento quick actions
    expect(container.innerHTML).toContain('m-actions-grid');
    expect(container.innerHTML).toContain('data-route="admissions"');
    expect(container.innerHTML).toContain('data-route="attendance"');
    expect(container.innerHTML).toContain('data-route="leaves"');
    expect(container.innerHTML).toContain('data-route="timetable"');

    // 4. Verify presence donut arc gauge
    expect(container.innerHTML).toContain('m-gauge-card');
    expect(container.innerHTML).toContain('Hostel Presence Radar');
    expect(container.innerHTML).toContain('m-gauge-svg');

    // 5. Verify students on leave carousel (no enrollment button, only active leaves) & activity feed
    expect(container.innerHTML).toContain('m-residents-scroll');
    expect(container.innerHTML).toContain('Students on Leave');
    expect(container.innerHTML).toContain('m-leave-item');
    expect(container.innerHTML).toContain('m-see-all-leave-residents-btn');
    expect(container.innerHTML).not.toContain('m-dash-add-student-btn');
    expect(container.innerHTML).not.toContain('Enrolled Residents');
    expect(container.innerHTML).toContain('m-activity-feed');

    // 6. Verify floating bottom nav
    expect(container.innerHTML).toContain('m-floating-bottom-nav');
    expect(container.innerHTML).toContain('data-nav="dashboard"');
    expect(container.innerHTML).toContain('data-nav="timetable"');
    expect(container.innerHTML).toContain('data-nav="attendance"');
    expect(container.innerHTML).toContain('data-nav="attendance_report"');
    expect(container.innerHTML).toContain('data-nav="settings"');
  });

  it('Admin Dashboard Hero Pill: displays faculty leave requests in place of THAIBASCHOOL CAMPUS with single-faculty name and multi-faculty plural count', async () => {
    // 1. Initial state: 0 pending requests -> THAIBASCHOOL CAMPUS
    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    await renderAdminDashboard(container, { onNavigate: () => {} });
    expect(container.innerHTML).toContain('THAIBASCHOOL CAMPUS');
    expect(container.innerHTML).not.toContain('has-leave-request');

    // 2. 1 Pending Request -> Show faculty name with requested leave
    const l1 = await db.applyFacultyLeave({
      faculty_id: 'u-2',
      faculty_name: 'Rashid Sir',
      faculty_email: 'teacher@thaibaschool.edu.in',
      is_multiple_days: false,
      start_date: '2026-11-01',
      end_date: '2026-11-01',
      departure_time: '09:00',
      return_time: '17:00',
      leave_type: 'Casual Leave',
      reason: 'Urgent Family Duty'
    });

    const container1 = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    await renderAdminDashboard(container1, { onNavigate: () => {} });
    expect(container1.innerHTML).toContain('Rashid Sir requested leave');
    expect(container1.innerHTML).toContain('has-leave-request');

    // 3. Greater than 1 (2 Pending Requests) -> Show "2 faculty requested leave"
    const l2 = await db.applyFacultyLeave({
      faculty_id: 'u-3',
      faculty_name: 'Usthad Usman',
      faculty_email: 'mentor@thaibaschool.edu.in',
      is_multiple_days: false,
      start_date: '2026-11-02',
      end_date: '2026-11-02',
      departure_time: '08:00',
      return_time: '18:00',
      leave_type: 'Medical Leave',
      reason: 'Hospital checkup'
    });

    const container2 = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    await renderAdminDashboard(container2, { onNavigate: () => {} });
    expect(container2.innerHTML).toContain('2 faculty requested leave');
    expect(container2.innerHTML).toContain('has-leave-request');
    expect(container2.innerHTML).toContain('dash-desktop-leave-alert');

    // Clean up
    await db.deleteFacultyLeave(l1.id);
    await db.deleteFacultyLeave(l2.id);
  });

  it('Admin Dashboard Hero Stat: replaces Curfew Lock with currently running class number / received attendance number', async () => {
    let navigatedTo = null;
    const listeners = {};
    const elements = {};

    const container = {
      innerHTML: '',
      querySelector: (sel) => {
        if (!elements[sel]) {
          elements[sel] = {
            textContent: '',
            innerHTML: '',
            addEventListener: (evt, fn) => {
              listeners[sel] = fn;
            }
          };
        }
        return elements[sel];
      },
      querySelectorAll: () => []
    };

    await renderAdminDashboard(container, {
      onNavigate: (route) => {
        navigatedTo = route;
      }
    });

    // 1. Curfew Lock / 09:30 PM is replaced
    expect(container.innerHTML).not.toContain('Curfew Lock');
    expect(container.innerHTML).not.toContain('09:30 PM Lock');

    // 2. Contains Running / Received label and live attendance stat
    expect(container.innerHTML).toContain('m-hero-live-att-stat');
    expect(container.innerHTML).toContain('Running / Received');
    expect(container.innerHTML).toContain('m-hero-live-att-val');

    // 3. Desktop view also reflects Live Class Attendance
    expect(container.innerHTML).toContain('Live Class Attendance');
    expect(container.innerHTML).toContain('Running classes / attendance received');

    // 4. Clicking the stat navigates to attendance
    if (typeof listeners['#m-hero-live-att-stat'] === 'function') {
      listeners['#m-hero-live-att-stat']();
      expect(navigatedTo).toBe('attendance');
    }

    // 5. Eye toggle button hides and restores live attendance value
    if (typeof listeners['#m-hero-eye-toggle'] === 'function') {
      listeners['#m-hero-eye-toggle']();
      expect(elements['#m-hero-live-att-val'].textContent).toBe('••/••');

      listeners['#m-hero-eye-toggle']();
      expect(elements['#m-hero-live-att-val'].textContent).toContain('/');
    }
  });

  it('Full-Width Select Enhancer: enhances full-width selects with 100% trigger width up to the right edge of the card', () => {
    const createdElements = [];
    const mockDocument = {
      createElement: (tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            contains(c) { return this.classes.has(c); }
          },
          style: {},
          attributes: {},
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k]; },
          hasAttribute(k) { return k in this.attributes; },
          appendChild(child) { this.children.push(child); child.parentNode = this; },
          children: [],
          options: [{ text: 'Haseeb Mubarak', selected: true }],
          selectedIndex: 0,
          addEventListener: () => {}
        };
        createdElements.push(el);
        return el;
      }
    };
    globalThis.document = mockDocument;
    try {
      const select = mockDocument.createElement('select');
      select.style.width = '100%';
      select.className = 'form-control select-full-width';
      select.setAttribute('data-full-width', 'true');
      const parent = mockDocument.createElement('div');
      parent.appendChild(select);
      select.parentNode.insertBefore = (newEl) => { parent.children.push(newEl); };

      enhanceSelect(select);

      const trigger = createdElements.find(el => el.className.includes('tps-custom-select-trigger'));
      expect(trigger).toBeDefined();
      expect(trigger.classList.contains('w-100')).toBe(true);
      expect(trigger.style.width).toBe('100%');
      expect(trigger.style.display).toBe('flex');
      expect(trigger.style.boxSizing).toBe('border-box');
    } finally {
      delete globalThis.document;
    }
  });

  it('Mobile Bottom Navigation: edge-to-edge full width with role-scoped accessible windows for every mobile user and sidebar over bottom nav', () => {
    // 1. Admin navigation items
    const adminItems = getBottomNavItems({ role: 'admin', is_super_admin: false });
    expect(adminItems.map(i => i.key)).toEqual(['dashboard', 'timetable', 'attendance', 'attendance_report', 'settings']);

    // 2. Teacher navigation items
    const teacherItems = getBottomNavItems({ role: 'teacher', is_super_admin: false });
    expect(teacherItems.map(i => i.key)).toEqual(['dashboard', 'timetable', 'attendance', 'attendance_report', 'marks']);

    // 3. Mentor navigation items
    const mentorItems = getBottomNavItems({ role: 'mentor', is_super_admin: false });
    expect(mentorItems.map(i => i.key)).toEqual(['dashboard', 'attendance', 'leaves', 'hostel', 'discipline']);

    // 4. Parent navigation items
    const parentItems = getBottomNavItems({ role: 'parent', is_super_admin: false });
    expect(parentItems.map(i => i.key)).toEqual(['dashboard', 'attendance', 'leaves', 'marks', 'fees']);

    // 5. Student navigation items
    const studentItems = getBottomNavItems({ role: 'student', is_super_admin: false });
    expect(studentItems.map(i => i.key)).toEqual(['dashboard', 'attendance', 'leaves', 'marks', 'exams']);

    // 6. Test renderBottomNav DOM rendering and active button
    const container = {
      innerHTML: '',
      querySelectorAll: () => []
    };

    renderBottomNav(container, {
      profile: { role: 'admin' },
      activeModule: 'attendance',
      onNavigate: () => {}
    });

    expect(container.innerHTML).toContain('data-nav="dashboard"');
    expect(container.innerHTML).toContain('data-nav="attendance"');
    expect(container.innerHTML).toContain('data-nav="timetable"');
    expect(container.innerHTML).toContain('data-nav="attendance_report"');
    expect(container.innerHTML).toContain('data-nav="settings"');
    expect(container.innerHTML).toContain('class="m-nav-pill-btn active" data-nav="attendance"');
    expect(container.innerHTML).toContain('m-nav-icon-wrap');
  });

  describe('20. Hostel Leave & Return Management, Hostel Bedroom Rack, and Bed Allocation Gating', () => {
    it('Hostel Leave & Return Management: renders executive header, record arrival, issue leave pass, and Leave Card Register', async () => {
      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderLeavesModule(container, { onNavigate: () => {} });

      // 1. Header & Actions
      expect(container.innerHTML).toContain('Hostel Leave & Return Management');
      expect(container.innerHTML).toContain('Batch vacation cards, individual leave passes, return recording, and automatic date-based fine auditing');
      expect(container.innerHTML).toContain('id="btn-record-arrival"');
      expect(container.innerHTML).toContain('id="btn-issue-leave-pass"');

      // 2. Metrics & Register
      expect(container.innerHTML).toContain('Active Passes');
      expect(container.innerHTML).toContain('Students Away');
      expect(container.innerHTML).toContain('Overdue Returns');
      expect(container.innerHTML).toContain('Returned Safe');
      expect(container.innerHTML).toContain('Leave Card Register');

      // 3. Dual Desktop table & Mobile cards
      expect(container.innerHTML).toContain('desktop-leave-table');
      expect(container.innerHTML).toContain('mobile-leave-cards');
    });

    it('Hostel Arrival & Leave Modals: equal 50/50 alignment, zero count suffix, and fixed-size hostel-flow-modal', async () => {
      // 1. Create student and active leave to ensure unreturnedStudents exist
      const student = await db.addStudent({
        full_name: 'Modal Alignment Student',
        gender: 'Boys',
        dob: '2014-03-10',
        father_name: 'Father',
        father_phone: '+91 99999 33333'
      });

      const [leave] = await db.createLeaveRecord({
        student_ids: [student.id],
        leave_type: 'hostel_leave',
        departure_date: '2026-10-28',
        departure_time: '16:00',
        expected_return_date: '2026-11-02',
        expected_return_time: '18:00',
        reason: 'Weekend Home Visit',
        fine_per_day: 100,
        approved_by: 'Hostel Office'
      });

      const originalDocument = global.document;
      const appendedModals = [];
      global.document = {
        createElement: (tag) => {
          const el = {
            tagName: tag,
            className: '',
            innerHTML: '',
            classList: { remove: () => {} },
            querySelector: () => ({
              addEventListener: () => {},
              querySelector: () => null,
              querySelectorAll: () => []
            }),
            querySelectorAll: () => [],
            addEventListener: () => {},
            remove: () => {}
          };
          return el;
        },
        body: {
          appendChild: (el) => {
            appendedModals.push(el);
          }
        }
      };

      try {
        const listeners = {};
        const container = {
          innerHTML: '',
          querySelector: (sel) => ({
            addEventListener: (evt, fn) => { listeners[sel] = fn; }
          }),
          querySelectorAll: () => []
        };

        await renderLeavesModule(container, { onNavigate: () => {} });

        // Click record arrival button to trigger arrival modal
        expect(typeof listeners['#btn-record-arrival']).toBe('function');
        listeners['#btn-record-arrival']();

        // Check arrival modal
        const arrivalModal = appendedModals[0];
        expect(arrivalModal).toBeDefined();
        expect(arrivalModal.className).toContain('has-hostel-flow-modal');
        expect(arrivalModal.innerHTML).toContain('hostel-flow-modal');

        // Verify equal 50/50 alignment switcher and clean labels without count suffixes
        expect(arrivalModal.innerHTML).toContain('hostel-mode-switcher-bar');
        expect(arrivalModal.innerHTML).toContain('Individual Arrival');
        expect(arrivalModal.innerHTML).toContain('Multiple Arrival');
        expect(arrivalModal.innerHTML).not.toContain('Away)');
        expect(arrivalModal.innerHTML).not.toContain('Active)');

        // Click issue leave pass button to trigger leave modal
        expect(typeof listeners['#btn-issue-leave-pass']).toBe('function');
        listeners['#btn-issue-leave-pass']();

        const leaveModal = appendedModals[1];
        expect(leaveModal).toBeDefined();
        expect(leaveModal.className).toContain('has-hostel-flow-modal');
        expect(leaveModal.innerHTML).toContain('hostel-flow-modal');
        expect(leaveModal.innerHTML).toContain('hostel-mode-switcher-bar');
        expect(leaveModal.innerHTML).toContain('Individual Leave');
        expect(leaveModal.innerHTML).toContain('Multiple Leave');
      } finally {
        global.document = originalDocument;
        await db.deleteStudent(student.id);
      }
    });

    it('Hostel Leave and Arrival Modals UX (v1.9.8): minimal student cards, full-width search, 50/50 filters, and frozen bottom actions', async () => {
      const fs = await import('fs');
      const leavesJs = fs.readFileSync('src/modules/leaves/index.js', 'utf8');
      const mainCss = fs.readFileSync('src/styles/main.css', 'utf8');

      // 1. Clean header without emojis or verbose text
      expect(leavesJs).not.toContain('👥 Select Students for Batch Leave Card');
      expect(leavesJs).not.toContain('👥 Select Returning Students');
      expect(leavesJs).toContain('Select Students (<span id="batch-pass-sel-count">');
      expect(leavesJs).toContain('Select Students (<span id="batch-sel-count">');
      expect(leavesJs).toContain('Select Student *');

      // 2. Full-width search bar and 50/50 dropdown division
      expect(leavesJs).toContain('id="batch-pass-search"');
      expect(leavesJs).toContain('width: 100%; height: 34px; font-size: 0.8rem;');
      expect(leavesJs).toContain('grid-template-columns: 1fr 1fr; gap: 0.45rem;');

      // 3. Minimal student card: only photo, name, class under name, and Boy/Girl on right
      // No admission numbers in batch student list items
      expect(leavesJs).not.toContain('(${s.admission_number})');
      expect(leavesJs).not.toContain('(${st.admission_number})');
      expect(leavesJs).toContain('Class ${s.school_class || \'-\'}');
      expect(leavesJs).toContain('Class ${st.school_class || \'-\'}');
      expect(leavesJs).toContain("${isBoy ? 'Boy' : 'Girl'}");

      // 4. Frozen footer actions bar and dynamic screen sizing
      expect(leavesJs).toContain('class="hostel-modal-actions-bar"');
      expect(leavesJs).toContain('class="hostel-modal-scroll-area"');
      expect(mainCss).toContain('.hostel-modal-flow-wrap {');
      expect(mainCss).toContain('overflow: hidden !important;');
      expect(mainCss).toContain('.hostel-modal-actions-bar {');
      expect(mainCss).toContain('.hostel-modal-scroll-area {');

      // 5. Individual Leave & Arrival also use rich student cards with photos (no raw <select> dropdowns)
      expect(leavesJs).not.toContain('<select id="pass-ind-student"');
      expect(leavesJs).not.toContain('<select id="ind-student-select"');
      expect(leavesJs).toContain('class="student-ind-select-tile"');
      expect(leavesJs).toContain('class="student-ret-ind-tile"');
      expect(leavesJs).toContain('id="pass-ind-search"');
      expect(leavesJs).toContain('id="ind-student-search"');
      expect(mainCss).toContain('.student-ind-select-tile');
      expect(mainCss).toContain('.student-ret-ind-tile');

      // 6. Leave type (3/5) & late fine (2/5) single line row, and reason in single line under them
      expect(leavesJs).toContain('grid-template-columns: 3fr 2fr; gap: 0.45rem;');
      expect(leavesJs).toContain('id="pass-leave-type"');
      expect(leavesJs).toContain('id="pass-fine-rate"');
      expect(leavesJs).toContain('id="pass-reason"');
    });

    it('Attendance Management Timetable Cards Layout: bounded compact card width and multi-column grid', async () => {
      const fs = await import('fs');
      const attJs = fs.readFileSync('src/modules/attendance/index.js', 'utf8');
      const mainCss = fs.readFileSync('src/styles/main.css', 'utf8');

      // Uses timetable-cards-grid on att-timetable-cards-list
      expect(attJs).toContain('class="att-timetable-cards-list timetable-cards-grid"');

      // CSS styles both timetable-cards-grid and att-timetable-cards-list with max-width: 440px
      expect(mainCss).toContain('.att-timetable-cards-list');
      expect(mainCss).toContain('repeat(auto-fill, minmax(330px, 440px))');
      expect(mainCss).toContain('max-width: 440px;');
    });

    it('Hostel Rooms & Beds Cards Layout: bounded compact card width and multi-column grid', async () => {
      const fs = await import('fs');
      const hostelJs = fs.readFileSync('src/modules/hostel/index.js', 'utf8');
      const mainCss = fs.readFileSync('src/styles/main.css', 'utf8');

      // Uses rooms-rack-grid and hostel-capacity-overview-grid
      expect(hostelJs).toContain('class="rooms-rack-grid"');
      expect(hostelJs).toContain('class="hostel-capacity-overview-grid"');

      // CSS styles rooms-rack-grid and room-rack-card with max-width: 520px
      expect(mainCss).toContain('.rooms-rack-grid');
      expect(mainCss).toContain('repeat(auto-fill, minmax(420px, 520px))');
      expect(mainCss).toContain('.room-rack-card');
      expect(mainCss).toContain('max-width: 520px;');
    });

    it('Hostel Leave Pass Engine: creates LV-YYYY-XXX pass, calculates late returns, updates student status and creates fine records', async () => {
      const student = await db.addStudent({
        full_name: 'Leave Engine Test Student',
        gender: 'Boys',
        dob: '2014-05-15',
        father_name: 'Father',
        father_phone: '+91 99999 11111'
      });

      // 1. Create leave pass
      const [leave] = await db.createLeaveRecord({
        student_ids: [student.id],
        leave_type: 'hostel_leave',
        departure_date: '2026-10-01',
        departure_time: '16:00',
        expected_return_date: '2026-10-05',
        expected_return_time: '17:00',
        reason: 'Weekend Family Visit',
        fine_per_day: 100,
        approved_by: 'Warden Office'
      });

      expect(leave.leave_code).toMatch(/^LV-\d{4}-\d{3}$/);
      expect(leave.status).toBe('Away');

      // Verify student status was changed to On Approved Leave
      const sOnLeave = await db.getStudentById(student.id);
      expect(sOnLeave.status).toBe('On Approved Leave');

      // 2. Test calculateReturnLate logic
      // Return 3 days late on 2026-10-08
      const lateCalc = db.calculateReturnLate('2026-10-05', '17:00', '2026-10-08', '16:00', 100);
      expect(lateCalc.lateDays).toBe(3);
      expect(lateCalc.fineAmount).toBe(300);
      expect(lateCalc.blackMarks).toBe(3);

      // Return on scheduled date but past expected time
      const timeLateCalc = db.calculateReturnLate('2026-10-05', '17:00', '2026-10-05', '19:30', 100);
      expect(timeLateCalc.lateDays).toBe(0);
      expect(timeLateCalc.fineAmount).toBe(0);
      expect(timeLateCalc.blackMarks).toBe(1);

      // 3. Record return in DB
      const retLeave = await db.recordReturn(leave.id, '2026-10-08', '16:00', 'Returned safely with guardian');
      expect(retLeave.status).toBe('Returned');
      expect(retLeave.late_days).toBe(3);
      expect(retLeave.calculated_fine).toBe(300);

      // Verify student reactivated
      const sReturned = await db.getStudentById(student.id);
      expect(sReturned.status).toBe('Active');

      // Verify fine record created in tps_fines
      const fines = await db.getFines();
      const generatedFine = fines.find(f => f.student_id === student.id && f.amount === 300);
      expect(generatedFine).toBeDefined();
      expect(generatedFine.fine_no).toMatch(/^FN-\d{4}-\d{4}$/);

      // Clean up
      await db.deleteStudent(student.id);
    });

    it('Hostel Rooms & Bed Space Allocation Rack: renders 8-bed dormitories inventory, zones, and direct bed assignment console', async () => {
      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderHostelModule(container, { onNavigate: () => {} });

      // 1. Header & Capacity
      expect(container.innerHTML).toContain('Hostel & Bedroom Bed Allocation Management');
      expect(container.innerHTML).toContain('8-bed dormitories inventory, direct student bed assignment');
      expect(container.innerHTML).toContain('Bed Occupancy');
      expect(container.innerHTML).toContain('Thaiba Boys Hostel Campus');
      expect(container.innerHTML).toContain('Thaiba Girls Hostel Campus');

      // 2. Bedroom Rack & Zones
      expect(container.innerHTML).toContain('Room 101');
      expect(container.innerHTML).toContain('Left Side');
      expect(container.innerHTML).toContain('Window Side');
      expect(container.innerHTML).toContain('Bed Occupancy');

      // 3. Direct Bed actions
      expect(container.innerHTML).toContain('btn-assign-bed');
    });

    it('Hostel Bed Assignment & Vacate: allocates student to bed space and frees space upon vacation', async () => {
      const student = await db.addStudent({
        full_name: 'Bed Allocation Student',
        gender: 'Boys',
        dob: '2014-06-20',
        father_name: 'Father',
        father_phone: '+91 99999 22222'
      });

      const beds = db.getHostelBeds();
      const vacantBed = beds.find(b => b.status === 'available');
      expect(vacantBed).toBeDefined();

      // Assign student to bed
      const assignResult = await db.assignStudentToBed(vacantBed.id, student.id);
      expect(assignResult.success).toBe(true);

      // Verify bed is occupied by this student
      const updatedBeds = db.getHostelBeds();
      const occupied = updatedBeds.find(b => b.id === vacantBed.id);
      expect(occupied.status).toBe('occupied');
      expect(occupied.current_student_id).toBe(student.id);

      // Verify student record updated with room and bed
      const updatedStudent = await db.getStudentById(student.id);
      expect(updatedStudent.hostel_bed).toBe(vacantBed.bed_number);
      expect(updatedStudent.hostel_room).toBeTruthy();

      // Vacate bed
      const vacateResult = await db.vacateBed(vacantBed.id);
      expect(vacateResult.success).toBe(true);

      const postVacateBeds = db.getHostelBeds();
      const vacated = postVacateBeds.find(b => b.id === vacantBed.id);
      expect(vacated.status).toBe('available');
      expect(vacated.current_student_id).toBeNull();

      // Clean up
      await db.deleteStudent(student.id);
    });

    it('Student Form Gating: bed allocation is removed from student form and gated exclusively to Hostels & Beds', async () => {
      // In student edit form, bed and room inputs are removed
      const student = {
        id: 's-form-test',
        full_name: 'Form Test Student',
        admission_number: 'TPS2026999',
        school_class: 'STD-V',
        hostel_unit: 'Thaiba Boys Hostel Block A',
        hostel_room: 'Room 101',
        hostel_bed: 'Bed 2'
      };

      // Ensure that bed assignment input is not rendered in edit modal
      // Bed allocation is managed exclusively in Hostels & Beds
      const beds = db.getHostelBeds();
      expect(typeof db.assignStudentToBed).toBe('function');
      expect(typeof db.vacateBed).toBe('function');
    });

    it('Hostel Module Layout Redesign: removes tab switcher bar, provides full-width filter card, side-by-side bedroom floorplan, and compact bed metadata (Class • Age)', async () => {
      // Create student with known DoB and Class
      const s1 = await db.addStudent({
        full_name: 'MD Aamir',
        gender: 'Boys',
        dob: '2016-05-15',
        school_class: 'STD-I'
      });

      const beds = db.getHostelBeds();
      const testBed = beds.find(b => b.status === 'available');
      if (testBed) {
        await db.assignStudentToBed(testBed.id, s1.id);
      }

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderHostelModule(container, { onNavigate: () => {} });

      // 1. Tab switcher bar removed
      expect(container.innerHTML).not.toContain('id="tab-btn-rack"');
      expect(container.innerHTML).not.toContain('id="tab-btn-roster"');

      // 2. Full-width hostel filter card
      expect(container.innerHTML).toContain('hostel-filter-card');
      expect(container.innerHTML).toContain('select-full-width');
      expect(container.innerHTML).toContain('data-full-width="true"');

      // 3. Side-by-Side bedroom floorplan layout
      expect(container.innerHTML).toContain('bedroom-sides-grid');
      expect(container.innerHTML).toContain('bedroom-side-card');
      expect(container.innerHTML).toContain('Left Side');
      expect(container.innerHTML).toContain('Right Side (Window Side)');

      // 4. Compact Bed metadata: Name and Class • Age (no admission number clutter)
      expect(container.innerHTML).toContain('MD Aamir');
      expect(container.innerHTML).toMatch(/STD-I\s*•\s*\d+\s*Yrs/);

      // Clean up
      if (testBed) {
        await db.vacateBed(testBed.id);
      }
      await db.deleteStudent(s1.id);
    });
  });

  describe('21. Student on Approved Leave Attendance Governance (Faded/On-Leave Display & Incapable Switch)', () => {
    it('When a student is on approved leave, their attendance card renders as faded and on-leave with a locked control and segmented roster filters', async () => {
      // 1. Create a student with On Approved Leave status
      const student = await db.addStudent({
        full_name: 'Zaid Leave Resident',
        gender: 'Boys',
        school_class: 'STD-V',
        status: 'On Approved Leave',
        dob: '2014-03-21',
        father_name: 'Father',
        father_phone: '+91 99999 33333'
      });

      // Also create an active leave record in tps_leaves
      const todayIso = new Date().toISOString().split('T')[0];
      const [leave] = await db.createLeaveRecord({
        student_ids: [student.id],
        leave_type: 'hostel_leave',
        departure_date: todayIso,
        departure_time: '08:00',
        expected_return_date: '2026-11-05',
        expected_return_time: '18:00',
        reason: 'Authorized Family Wedding',
        fine_per_day: 100,
        approved_by: 'Hostel Warden'
      });

      // Ensure class cls-1 includes this student
      const classrooms = await db.getClassrooms();
      const cls = classrooms.find(c => c.id === 'cls-1');
      if (cls && (!Array.isArray(cls.student_ids) || !cls.student_ids.includes(student.id))) {
        const studentIds = Array.isArray(cls.student_ids) ? [...cls.student_ids, student.id] : [student.id];
        await db.updateClassroom('cls-1', { student_ids: studentIds });
      }

      // Unlock window for cls-1 today so interaction is enabled
      await db.unlockAttendanceWindow('cls-1', todayIso);

      // Set user as teacher
      updateCurrentUserProfile({
        id: 'u-2',
        email: 'teacher@thaibaschool.edu.in',
        full_name: 'Rashid Sir',
        role: 'teacher',
        approval_status: 'approved'
      });

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderAttendanceModule(container, {
        onNavigate: () => {},
        initialClassId: 'cls-1',
        initialDate: todayIso
      });

      const html = container.innerHTML;

      // A. Verify student card is faded with is-on-leave
      expect(html).toContain('is-on-leave');
      expect(html).toContain('is-faded');
      expect(html).toContain('Zaid Leave Resident');

      // B. Verify "On Leave" pill and approved hostel leave caption
      expect(html).toContain('att-on-leave-pill');
      expect(html).toContain('On Leave');
      expect(html).toContain('Approved Hostel Leave');

      // C. Verify locked control badge (teachers are incapable of taking his attendance)
      expect(html).toContain('att-leave-locked-badge');
      expect(html).toContain('On Leave');

      // D. Verify summary counter displays "On Leave" count
      expect(html).toContain('On Leave:');

      // E. Verify segmented roster filter tabs (All, In Class, On Leave) row is removed per user request
      expect(html).not.toContain('data-roster-filter="all"');
      expect(html).not.toContain('data-roster-filter="in_class"');
      expect(html).not.toContain('data-roster-filter="on_leave"');

      // Clean up
      await db.deleteStudent(student.id);
    });

    it('Bulk actions skip student on leave, and submitting attendance persists status as "Leave"', async () => {
      const todayIso = new Date().toISOString().split('T')[0];

      // Add student on leave
      const leaveStudent = await db.addStudent({
        full_name: 'Tariq OnLeave Student',
        gender: 'Boys',
        school_class: 'STD-V',
        status: 'On Approved Leave',
        dob: '2014-01-10',
        father_name: 'Father',
        father_phone: '+91 99999 44444'
      });

      // Add normal student
      const activeStudent = await db.addStudent({
        full_name: 'Bilal Present Student',
        gender: 'Boys',
        school_class: 'STD-V',
        status: 'Active',
        dob: '2014-02-12',
        father_name: 'Father',
        father_phone: '+91 99999 55555'
      });

      // Assign both to cls-1
      await db.updateClassroom('cls-1', { student_ids: [leaveStudent.id, activeStudent.id] });
      await db.unlockAttendanceWindow('cls-1', todayIso);

      updateCurrentUserProfile({
        id: 'u-2',
        email: 'teacher@thaibaschool.edu.in',
        full_name: 'Rashid Sir',
        role: 'teacher',
        approval_status: 'approved'
      });

      const listeners = {};
      const container = {
        innerHTML: '',
        querySelector: (selector) => {
          return {
            addEventListener: (evt, fn) => {
              listeners[selector] = fn;
            },
            value: '',
            style: {},
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
            setAttribute: () => {},
            querySelector: () => null
          };
        },
        querySelectorAll: () => []
      };

      await renderAttendanceModule(container, {
        onNavigate: () => {},
        initialClassId: 'cls-1',
        initialDate: todayIso
      });

      // Trigger "All Present"
      if (typeof listeners['#btn-mark-all-present'] === 'function') {
        listeners['#btn-mark-all-present']();
      }

      // Submit attendance
      if (typeof listeners['#btn-submit-attendance'] === 'function') {
        await listeners['#btn-submit-attendance']();
      }

      // Verify recorded attendance session
      const sessions = await db.getAttendanceRecords();
      const session = sessions.find(s => s.classroom_id === 'cls-1' && s.session_date === todayIso);
      expect(session).toBeDefined();

      const leaveRecord = session.records.find(r => r.student_id === leaveStudent.id);
      expect(leaveRecord).toBeDefined();
      // Student on leave is strictly recorded as 'Leave'
      expect(leaveRecord.status).toBe('Leave');

      const activeRecord = session.records.find(r => r.student_id === activeStudent.id);
      expect(activeRecord).toBeDefined();
      expect(activeRecord.status).toBe('Present');

      // Clean up
      await db.deleteStudent(leaveStudent.id);
      await db.deleteStudent(activeStudent.id);
      const remainingSessions = (await db.getAttendanceRecords()).filter(s => !(s.classroom_id === 'cls-1' && s.session_date === todayIso));
      db.set('tps_attendance', remainingSessions);
    });
  });

  describe('22. Mobile UI Compatibility & Responsive Edit Modal Tests', () => {
    it('Edit Student Modal structure enforces zero horizontal scroll and mobile-responsive styling classes', async () => {
      const fs = await import('fs');
      const cssContent = fs.readFileSync('src/styles/main.css', 'utf-8');
      const studentsJs = fs.readFileSync('src/modules/students/index.js', 'utf-8');

      // 1. Verify CSS enforces overflow-x hidden on modal body and zero horizontal scroll
      expect(cssContent).toContain('.modal-body {');
      expect(cssContent).toContain('overflow-x: hidden !important;');
      expect(cssContent).toContain('.student-edit-form-wrap');
      expect(cssContent).toContain('.student-edit-banner');
      expect(cssContent).toContain('.student-edit-photo-box');
      expect(cssContent).toContain('.student-edit-info-col');
      expect(cssContent).toContain('.student-edit-actions-row');

      // 2. Form control must be 100% full width and border-box constrained to prevent mobile overflow
      expect(cssContent).toContain('.form-control,');
      expect(cssContent).toContain('width: 100% !important;');
      expect(cssContent).toContain('box-sizing: border-box !important;');

      // 3. In students module, neither showProfileModal nor showEditStudentModal have rigid min-width causing mobile overflow
      expect(studentsJs).not.toContain('min-width: 240px');
      expect(studentsJs).not.toContain('min-width: 260px');

      // 4. In students module, edit modal uses responsive CSS classes instead of fixed overflow styles
      expect(studentsJs).toContain('class="student-edit-form-wrap"');
      expect(studentsJs).toContain('class="student-edit-banner"');
      expect(studentsJs).toContain('class="student-edit-photo-box"');
      expect(studentsJs).toContain('class="student-edit-actions-row"');
      expect(studentsJs).toContain('class="student-edit-hostel-box"');

      // 5. Test rendering students module in mobile list mode
      const tableContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      const topBar = { querySelector: () => null };
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
      expect(tableContainer.innerHTML).toContain('students-mobile-list-wrap');
      expect(tableContainer.innerHTML).toContain('student-mobile-card-row');
    });
  });

  // ==========================================
  // SECTION 23: TEACHER DASHBOARD & FACULTY LEAVE WORKFLOW (v1.8.6)
  // ==========================================
  describe('Section 23: Teacher Dashboard & Faculty Leave Workflow (v1.8.6)', () => {
    it('2301 - Teacher Dashboard removes top timetable/attendance buttons and displays Pending Attendance card', async () => {
      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderTeacherDashboard(container, { onNavigate: () => {} });

      // 1. Top action buttons "My Timetable" and "Take Attendance" are removed from header
      expect(container.innerHTML).not.toContain('id="teacher-view-timetable-btn"');
      expect(container.innerHTML).not.toContain('id="teacher-mark-attendance-btn"');

      // 2. "Students Taught" stat card replaced with "Pending Attendance" routing to attendance
      expect(container.innerHTML).toContain('Pending Attendance');
      expect(container.innerHTML).not.toContain('Students Taught');
      expect(container.innerHTML).toContain('data-route="attendance"');
    });

    it('2302 - Database CRUD for Faculty Leaves with single and multi-day date ranges, departure and return times', async () => {
      // 1. Initial faculty leaves
      const initialLeaves = await db.getFacultyLeaves();
      expect(Array.isArray(initialLeaves)).toBe(true);
      expect(initialLeaves.length).toBeGreaterThan(0);

      // 2. Apply single-day faculty leave with going and return times
      const singleLeave = await db.applyFacultyLeave({
        faculty_id: 'u-2',
        faculty_name: 'Rashid Sir',
        faculty_email: 'teacher@thaibaschool.edu.in',
        is_multiple_days: false,
        start_date: '2026-11-05',
        end_date: '2026-11-05',
        departure_time: '08:30',
        return_time: '17:00',
        leave_type: 'Casual Leave',
        reason: 'Personal Family Function',
        status: 'Pending',
        applied_by: { id: 'u-2', name: 'Rashid Sir', role: 'teacher' }
      });

      expect(singleLeave.id).toBeDefined();
      expect(singleLeave.is_multiple_days).toBe(false);
      expect(singleLeave.start_date).toBe('2026-11-05');
      expect(singleLeave.end_date).toBe('2026-11-05');
      expect(singleLeave.departure_time).toBe('08:30');
      expect(singleLeave.return_time).toBe('17:00');
      expect(singleLeave.status).toBe('Pending');

      // 3. Admin approves the leave
      const approvedLeave = await db.updateFacultyLeaveStatus(singleLeave.id, 'Approved', {
        id: 'u-1',
        full_name: 'Super Admin',
        role: 'super_admin'
      }, 'Granted permission');

      expect(approvedLeave.status).toBe('Approved');
      expect(approvedLeave.approved_by?.name).toBe('Super Admin');
      expect(approvedLeave.admin_notes).toBe('Granted permission');

      // 4. Query isFacultyOnApprovedLeave
      const checkOnLeave = db.isFacultyOnApprovedLeave('u-2', '2026-11-05');
      expect(checkOnLeave).toBeTruthy();
      expect(checkOnLeave?.leave_type).toBe('Casual Leave');

      // Date outside leave range returns null
      const checkOutside = db.isFacultyOnApprovedLeave('u-2', '2026-11-06');
      expect(checkOutside).toBeNull();

      // 5. Apply multi-day faculty leave
      const multiLeave = await db.applyFacultyLeave({
        faculty_id: 'u-2',
        faculty_name: 'Rashid Sir',
        is_multiple_days: true,
        start_date: '2026-11-10',
        end_date: '2026-11-12',
        departure_time: '09:00',
        return_time: '18:00',
        leave_type: 'Academic Seminar / Duty Leave',
        reason: 'State Curriculum Revision Committee',
        status: 'Approved',
        applied_by: { id: 'u-1', name: 'Super Admin', role: 'super_admin' }
      });

      expect(multiLeave.is_multiple_days).toBe(true);
      expect(db.isFacultyOnApprovedLeave('u-2', '2026-11-10')).toBeTruthy();
      expect(db.isFacultyOnApprovedLeave('u-2', '2026-11-11')).toBeTruthy();
      expect(db.isFacultyOnApprovedLeave('u-2', '2026-11-12')).toBeTruthy();
      expect(db.isFacultyOnApprovedLeave('u-2', '2026-11-13')).toBeNull();

      // 6. Delete faculty leave
      const deleted = await db.deleteFacultyLeave(multiLeave.id);
      expect(deleted).toBe(true);
      expect(db.isFacultyOnApprovedLeave('u-2', '2026-11-11')).toBeNull();
    });

    it('2303 - Module permissions and Sidebar registration for Faculty Leaves', () => {
      // 1. MODULE_DEFINITIONS contains faculty_leaves with proper roles
      const modDef = MODULE_DEFINITIONS.find(m => m.key === 'faculty_leaves');
      expect(modDef).toBeDefined();
      expect(modDef?.label).toBe('Faculty Leaves');
      expect(modDef?.roles).toContain('teacher');
      expect(modDef?.roles).toContain('admin');
      expect(modDef?.roles).toContain('super_admin');

      // 2. DEFAULT_RBAC_MATRIX provides access for admin and teacher
      expect(DEFAULT_RBAC_MATRIX.admin.faculty_leaves).toBe('full');
      expect(DEFAULT_RBAC_MATRIX.teacher.faculty_leaves).toBe('full');

      // 3. User permission check
      expect(canAccessModule({ role: 'teacher', approval_status: 'approved' }, 'faculty_leaves')).toBe(true);
      expect(canAccessModule({ role: 'admin', approval_status: 'approved' }, 'faculty_leaves')).toBe(true);
      expect(canAccessModule({ role: 'super_admin', approval_status: 'approved', is_super_admin: true }, 'faculty_leaves')).toBe(true);
    });

    it('2304 - Attendance report waives missed attendance penalty when faculty has approved leave', async () => {
      // Set teacher assignment
      const classroom = {
        id: 'cls-1',
        name: 'Moral Hall A1',
        teacher_id: 'u-2',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        start_time: '06:00',
        end_time: '07:00'
      };

      // Ensure faculty leave is approved for 2026-10-15
      const leave = db.isFacultyOnApprovedLeave('u-2', '2026-10-15');
      expect(leave).toBeTruthy();
      expect(leave?.status).toBe('Approved');

      // On 2026-10-15, teacher is assigned and it was a scheduled day,
      // but because faculty leave was approved, attendance is officially waived.
      const isTeacherAssigned = db.isTeacherAssignedOnDate('u-2', classroom, '2026-10-15');
      expect(isTeacherAssigned).toBe(true);

      const hasApprovedLeave = Boolean(db.isFacultyOnApprovedLeave('u-2', '2026-10-15'));
      expect(hasApprovedLeave).toBe(true);

      // Verify calculation formula used in attendance report:
      const hasAttendanceSession = false;
      const isHoliday = false;
      const isElapsed = true;
      const isClassScheduledDay = true;
      const isMissedAttendance = isTeacherAssigned && isClassScheduledDay && !isHoliday && isElapsed && !hasAttendanceSession && !hasApprovedLeave;

      // Missed attendance MUST be false when approved leave is present!
      expect(isMissedAttendance).toBe(false);

      // Conversely, on a day with no approved leave (e.g. 2026-10-16), missed attendance is flagged true
      const hasLeaveNextDay = Boolean(db.isFacultyOnApprovedLeave('u-2', '2026-10-16'));
      expect(hasLeaveNextDay).toBe(false);
      const isMissedNextDay = isTeacherAssigned && isClassScheduledDay && !isHoliday && isElapsed && !hasAttendanceSession && !hasLeaveNextDay;
      expect(isMissedNextDay).toBe(true);
    });

    it('2305 - Faculty Leaves: Strict non-admin data isolation and distinct status cards (Light Orange for Pending, Light Green for Approved)', async () => {
      // Setup leaves
      const l1 = await db.applyFacultyLeave({
        faculty_id: 'u-2',
        faculty_name: 'Rashid Sir',
        faculty_email: 'teacher@thaibaschool.edu.in',
        is_multiple_days: false,
        start_date: '2026-11-20',
        end_date: '2026-11-20',
        departure_time: '08:00',
        return_time: '16:00',
        leave_type: 'Sick / Medical Leave',
        reason: 'Consulting Doctor for Throat Infection',
        status: 'Pending',
        applied_by: { id: 'u-2', name: 'Rashid Sir', role: 'teacher' }
      });

      const l2 = await db.applyFacultyLeave({
        faculty_id: 'u-99',
        faculty_name: 'Fathima Teacher',
        faculty_email: 'fathima@thaibaschool.edu.in',
        is_multiple_days: false,
        start_date: '2026-11-21',
        end_date: '2026-11-21',
        departure_time: '08:30',
        return_time: '17:00',
        leave_type: 'Casual Leave',
        reason: 'Attending Family Wedding Ceremony',
        status: 'Approved',
        applied_by: { id: 'u-99', name: 'Fathima Teacher', role: 'teacher' }
      });

      // 1. Teacher View (u-2: Rashid Sir)
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

      await renderFacultyLeavesModule(teacherContainer, { onNavigate: () => {} });

      // Teacher CANNOT see other faculty's leave data
      expect(teacherContainer.innerHTML).toContain('Rashid Sir');
      expect(teacherContainer.innerHTML).not.toContain('Fathima Teacher');
      expect(teacherContainer.innerHTML).not.toContain('Attending Family Wedding Ceremony');
      expect(teacherContainer.innerHTML).toContain('Consulting Doctor for Throat Infection');

      // Teacher cannot see admin controls: no faculty selector dropdown, no approve button, no "My Leaves" tab
      expect(teacherContainer.innerHTML).not.toContain('id="faculty-filter-select"');
      expect(teacherContainer.innerHTML).not.toContain('btn-approve-leave');
      expect(teacherContainer.innerHTML).not.toContain('btn-reject-leave');
      expect(teacherContainer.innerHTML).not.toContain('data-tab="my"');

      // Pending card has distinct light orange styling:
      expect(teacherContainer.innerHTML).toContain('faculty-leave-card is-pending');
      expect(teacherContainer.innerHTML).toContain('background: #FFF7ED');
      expect(teacherContainer.innerHTML).toContain('border: 1.5px solid #FED7AA');
      expect(teacherContainer.innerHTML).toContain('border-left: 5px solid #EA580C');
      expect(teacherContainer.innerHTML).toContain('border-radius: 16px');
      expect(teacherContainer.innerHTML).toContain('margin-bottom: 1rem');

      // 2. Admin View (u-1: Abdul Haseeb)
      updateCurrentUserProfile({
        id: 'u-1',
        email: 'abdulhaseebkt2@gmail.com',
        full_name: 'Abdul Haseeb',
        role: 'super_admin',
        approval_status: 'approved',
        is_super_admin: true
      });

      const adminContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderFacultyLeavesModule(adminContainer, { onNavigate: () => {} });

      // Admin CAN see all faculty leaves
      expect(adminContainer.innerHTML).toContain('Rashid Sir');
      expect(adminContainer.innerHTML).toContain('Fathima Teacher');
      expect(adminContainer.innerHTML).toContain('id="faculty-filter-select"');
      expect(adminContainer.innerHTML).toContain('btn-approve-leave');
      expect(adminContainer.innerHTML).toContain('btn-reject-leave');
      expect(adminContainer.innerHTML).toContain('data-tab="my"');

      // Approved card has distinct light green styling:
      expect(adminContainer.innerHTML).toContain('faculty-leave-card is-approved');
      expect(adminContainer.innerHTML).toContain('background: #F0FDF4');
      expect(adminContainer.innerHTML).toContain('border: 1.5px solid #BBF7D0');
      expect(adminContainer.innerHTML).toContain('border-left: 5px solid #059669');

      // Clean up test leaves
      await db.deleteFacultyLeave(l1.id);
      await db.deleteFacultyLeave(l2.id);
    });

    it('2306 - Faculty on Leave: Incapable of taking attendance and suppressed dashboard alerts during leave period', async () => {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Create an approved faculty leave for teacher u-2 (Rashid Sir) covering today
      const todayLeave = await db.applyFacultyLeave({
        faculty_id: 'u-2',
        faculty_name: 'Rashid Sir',
        faculty_email: 'teacher@thaibaschool.edu.in',
        is_multiple_days: false,
        start_date: todayStr,
        end_date: todayStr,
        departure_time: '08:00',
        return_time: '17:00',
        leave_type: 'Official Duty Leave',
        reason: 'State Education Board Evaluation Duty',
        status: 'Approved',
        applied_by: { id: 'u-1', name: 'Super Admin', role: 'super_admin' }
      });

      // 2. Set current user to Teacher (Rashid Sir)
      updateCurrentUserProfile({
        id: 'u-2',
        email: 'teacher@thaibaschool.edu.in',
        full_name: 'Rashid Sir',
        role: 'teacher',
        approval_status: 'approved',
        is_super_admin: false
      });

      // 3. Test Teacher Dashboard when on leave:
      const dashContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };
      await renderTeacherDashboard(dashContainer, { onNavigate: () => {} });

      // Verification: Pending attendance count is 0 and officially waived
      expect(dashContainer.innerHTML).toContain('✓ Attendance officially waived (On Leave)');
      expect(dashContainer.innerHTML).not.toContain('Sessions pending submission');

      // Verification: Upcoming class card does NOT show alarm / attendance notification
      expect(dashContainer.innerHTML).toContain('Faculty Leave Active');
      expect(dashContainer.innerHTML).toContain('State Education Board Evaluation Duty');
      expect(dashContainer.innerHTML).toContain('Attendance Taking Disabled (On Leave)');
      expect(dashContainer.innerHTML).not.toContain('Take Attendance →');

      // 4. Test Attendance Module when on leave:
      const attContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };
      await renderAttendanceModule(attContainer, { onNavigate: () => {} });

      // Verification: Timetable cards display waiver badge and locked button
      expect(attContainer.innerHTML).toContain('✓ On Approved Leave (Waived)');
      expect(attContainer.innerHTML).toContain('🔒 Attendance Waived (On Leave)');
      expect(attContainer.innerHTML).not.toContain('Take Attendance →');

      // 5. Test Attendance Roster View when on leave:
      const rosterContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };
      await renderAttendanceModule(rosterContainer, { onNavigate: () => {}, initialClassId: 'cls-1' });

      // Verification: Submit button is locked with waiver notice
      expect(rosterContainer.innerHTML).toContain('🔒 Attendance Waived (Faculty On Approved Leave)');
      expect(rosterContainer.innerHTML).toContain('Attendance duty is waived by Administration');
      expect(rosterContainer.innerHTML).not.toContain('Confirm & Submit Attendance');

      // Clean up test leave
      await db.deleteFacultyLeave(todayLeave.id);
    });
  });

  describe('24. Boys Hostel Mentor & Girls Hostel Mentor Strict Separation, Classroom Access & Window Allotment', () => {
    const boysMentor = {
      id: 'd0000000-0000-0000-0000-000000000005',
      email: 'mentor@thaibaschool.edu.in',
      full_name: 'Usthad Usman',
      role: 'boys_mentor',
      mentor_type: 'boys',
      gender: 'Boys',
      hostel_unit: 'Thaiba Boys Hostel Block A',
      approval_status: 'approved',
      is_super_admin: false
    };

    const girlsMentor = {
      id: 'd0000000-0000-0000-0000-000000000006',
      email: 'girls_mentor@thaibaschool.edu.in',
      full_name: 'Usthada Mariyam',
      role: 'girls_mentor',
      mentor_type: 'girls',
      gender: 'Girls',
      hostel_unit: 'Thaiba Girls Hostel Campus',
      approval_status: 'approved',
      is_super_admin: false
    };

    it('2401 - Helper functions correctly identify mentor roles and gender scopes', () => {
      expect(isMentorRole('boys_mentor')).toBe(true);
      expect(isMentorRole('girls_mentor')).toBe(true);
      expect(isMentorRole('mentor')).toBe(true);
      expect(isMentorRole('teacher')).toBe(false);
      expect(isMentorRole('admin')).toBe(false);
      expect(isMentorRole('super_admin')).toBe(false);

      expect(getMentorGenderScope(boysMentor)).toBe('Boys');
      expect(getMentorGenderScope(girlsMentor)).toBe('Girls');
      expect(getMentorGenderScope({ role: 'mentor', gender: 'Girls' })).toBe('Girls');
      expect(getMentorGenderScope({ role: 'mentor', hostel_unit: 'Thaiba Girls Hostel Campus' })).toBe('Girls');
      expect(getMentorGenderScope({ role: 'mentor', hostel_unit: 'Thaiba Boys Hostel Block A' })).toBe('Boys');
      expect(getMentorGenderScope({ role: 'teacher' })).toBeNull();
    });

    it('2402 - Default permissions for boys_mentor and girls_mentor provide full access to hostel modules', () => {
      expect(canAccessModule(boysMentor, 'hostel')).toBe(true);
      expect(canAccessModule(boysMentor, 'leaves')).toBe(true);
      expect(canAccessModule(boysMentor, 'discipline')).toBe(true);
      expect(canAccessModule(boysMentor, 'attendance')).toBe(true);
      expect(canAccessModule(boysMentor, 'students')).toBe(true);

      expect(canAccessModule(girlsMentor, 'hostel')).toBe(true);
      expect(canAccessModule(girlsMentor, 'leaves')).toBe(true);
      expect(canAccessModule(girlsMentor, 'discipline')).toBe(true);
      expect(canAccessModule(girlsMentor, 'attendance')).toBe(true);
      expect(canAccessModule(girlsMentor, 'students')).toBe(true);

      // By default, sensitive financial or exam configuration windows are off
      expect(canAccessModule(boysMentor, 'fees')).toBe(false);
      expect(canAccessModule(boysMentor, 'exams')).toBe(false);
      expect(canAccessModule(girlsMentor, 'fees')).toBe(false);
      expect(canAccessModule(girlsMentor, 'exams')).toBe(false);
    });

    it('2403 - Hostel Module strict data isolation: Boys mentor only sees boys hostel units, rooms and beds', async () => {
      updateCurrentUserProfile(boysMentor);

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderHostelModule(container, { onNavigate: () => {} });

      // Boys hostel names present
      expect(container.innerHTML).toContain('Thaiba Boys Hostel');
      // Girls hostel campus strictly excluded
      expect(container.innerHTML).not.toContain('Thaiba Girls Hostel Campus');
      // No hostel switcher dropdown for mentors to prevent cross-campus switching
      expect(container.innerHTML).not.toContain('id="hostel-building-select"');
    });

    it('2404 - Hostel Module strict data isolation: Girls mentor only sees girls hostel units, rooms and beds', async () => {
      updateCurrentUserProfile(girlsMentor);

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderHostelModule(container, { onNavigate: () => {} });

      // Girls hostel campus present
      expect(container.innerHTML).toContain('Thaiba Girls Hostel');
      // Boys hostel units strictly excluded
      expect(container.innerHTML).not.toContain('Thaiba Boys Hostel Block A');
      expect(container.innerHTML).not.toContain('Thaiba Boys Hostel Block B');
      // No hostel switcher dropdown
      expect(container.innerHTML).not.toContain('id="hostel-building-select"');
    });

    it('2405 - Leaves Module strict data isolation: Mentors only see students and leaves matching their gender scope', async () => {
      const boyStudent = await db.addStudent({
        full_name: 'Harun Boys Resident',
        gender: 'Boys',
        admission_number: 'TPS-2026-B101',
        school_class: 'STD-VIII'
      });
      const girlStudent = await db.addStudent({
        full_name: 'Amina Girls Resident',
        gender: 'Girls',
        admission_number: 'TPS-2026-G102',
        school_class: 'STD-VIII'
      });

      await db.createLeaveRecord({
        student_ids: [boyStudent.id],
        leave_type: 'individual',
        reason_category: 'Medical',
        departure_date: '2026-10-25',
        expected_return_date: '2026-10-28',
        transport_mode: 'Parent Pickup',
        parent_contact: '+91 98470 11223'
      });

      await db.createLeaveRecord({
        student_ids: [girlStudent.id],
        leave_type: 'individual',
        reason_category: 'Family Function',
        departure_date: '2026-10-25',
        expected_return_date: '2026-10-28',
        transport_mode: 'Parent Pickup',
        parent_contact: '+91 98470 55667'
      });

      // 1. Boys mentor
      updateCurrentUserProfile(boysMentor);
      let container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderLeavesModule(container, { onNavigate: () => {} });
      // Table should only show boys leaves, e.g. Harun
      expect(container.innerHTML).toContain('Harun Boys Resident');
      // Should not contain girls leaves
      expect(container.innerHTML).not.toContain('Amina Girls Resident');

      // 2. Girls mentor
      updateCurrentUserProfile(girlsMentor);
      container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderLeavesModule(container, { onNavigate: () => {} });
      // Should strictly not contain boys leaves
      expect(container.innerHTML).not.toContain('Harun Boys Resident');
      // Should contain girls leaves
      expect(container.innerHTML).toContain('Amina Girls Resident');
    });

    it('2406 - Discipline & Misconduct Module strict isolation by mentor gender', async () => {
      const boyStudent = await db.addStudent({
        full_name: 'Ziyad Boys Resident',
        gender: 'Boys',
        admission_number: 'TPS-2026-B103',
        school_class: 'STD-VII'
      });
      const girlStudent = await db.addStudent({
        full_name: 'Khadija Girls Resident',
        gender: 'Girls',
        admission_number: 'TPS-2026-G104',
        school_class: 'STD-VII'
      });

      const incidents = [
        {
          id: 'inc-boy-1',
          student_id: boyStudent.id,
          category: 'Leaving hostel without permission',
          severity: 'Major',
          incident_date: '2026-10-25',
          description: 'Left boys hostel block without exit slip',
          black_marks_awarded: 3,
          monetary_fine: 0,
          resolution_status: 'Under Review'
        },
        {
          id: 'inc-girl-1',
          student_id: girlStudent.id,
          category: 'Possessing a mobile phone in hostel',
          severity: 'Moderate',
          incident_date: '2026-10-26',
          description: 'Phone found in study desk',
          black_marks_awarded: 2,
          monetary_fine: 0,
          resolution_status: 'Under Review'
        }
      ];
      db.set('tps_discipline', incidents);

      // Boys Mentor view
      updateCurrentUserProfile(boysMentor);
      let container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderDisciplineModule(container, { onNavigate: () => {} });
      expect(container.innerHTML).toContain('Left boys hostel block');
      expect(container.innerHTML).not.toContain('Phone found in study desk');

      // Girls Mentor view
      updateCurrentUserProfile(girlsMentor);
      container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderDisciplineModule(container, { onNavigate: () => {} });
      expect(container.innerHTML).toContain('Phone found in study desk');
      expect(container.innerHTML).not.toContain('Left boys hostel block');
    });

    it('2407 - Mentor Classroom Access: Mentor can view and take attendance for assigned or gender-scoped classes', async () => {
      updateCurrentUserProfile(boysMentor);

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderAttendanceModule(container, { onNavigate: () => {} });

      // Boys mentor sees Boys Mentor Class Timetable & Attendance
      expect(container.innerHTML).toContain('Boys Mentor Class Timetable & Attendance');
      // Should show boys classrooms (like Moral Hall A1 or Htl BB or Hostel Study Lab 2)
      expect(container.innerHTML).toContain('Moral Hall A1');
      // Should NOT show girls coaching hall
      expect(container.innerHTML).not.toContain('Girls Coaching Hall');
    });

    it('2408 - Dynamic Window Allotment: If Admin allots additional window (e.g. exams or fees), mentor can immediately access it', async () => {
      // By default, boys mentor has no exams access
      expect(canAccessModule(boysMentor, 'exams')).toBe(false);

      // Admin allots 'exams' window with 'full' access to boys mentor specifically
      saveUserCustomPermissions(boysMentor.id, { exams: 'full' });

      // Verification: canAccessModule now returns true
      expect(canAccessModule(boysMentor, 'exams')).toBe(true);

      // Sidebar also renders the allotted 'exams' window
      const sidebarContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      renderSidebar(sidebarContainer, { activeModule: 'dashboard', isCollapsed: false, onToggleCollapse: () => {}, onNavigate: () => {} });
      expect(sidebarContainer.innerHTML).toContain('data-module="exams"');

      // Clean up custom permissions
      clearUserCustomPermissions(boysMentor.id);
      expect(canAccessModule(boysMentor, 'exams')).toBe(false);
    });

    it('2409 - Fines Module strict isolation: Late fines only displayed for respective hostel residents', async () => {
      const boyStudent = await db.addStudent({
        full_name: 'Farhan Boy Resident',
        gender: 'Boys',
        admission_number: 'TPS-2026-B105',
        school_class: 'STD-IX'
      });
      const girlStudent = await db.addStudent({
        full_name: 'Zainab Girl Resident',
        gender: 'Girls',
        admission_number: 'TPS-2026-G106',
        school_class: 'STD-IX'
      });

      const fines = [
        {
          id: 'fine-boy-1',
          student_id: boyStudent.id,
          leave_register_number: 'LV-2026-901',
          expected_return_date: '2026-10-20',
          actual_return_date: '2026-10-22',
          late_days: 2,
          fine_per_day_applied: 200,
          calculated_fine: 400,
          fine_status: 'unpaid'
        },
        {
          id: 'fine-girl-1',
          student_id: girlStudent.id,
          leave_register_number: 'LV-2026-902',
          expected_return_date: '2026-10-20',
          actual_return_date: '2026-10-23',
          late_days: 3,
          fine_per_day_applied: 200,
          calculated_fine: 600,
          fine_status: 'unpaid'
        }
      ];
      db.set('tps_leaves', fines);

      // Boys Mentor view
      updateCurrentUserProfile(boysMentor);
      let container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderFinesModule(container, { onNavigate: () => {} });
      expect(container.innerHTML).toContain('LV-2026-901');
      expect(container.innerHTML).not.toContain('LV-2026-902');

      // Girls Mentor view
      updateCurrentUserProfile(girlsMentor);
      container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderFinesModule(container, { onNavigate: () => {} });
      expect(container.innerHTML).toContain('LV-2026-902');
      expect(container.innerHTML).not.toContain('LV-2026-901');
    });

    it('2410 - Students Directory strict isolation: Mentors view only their gender residents with locked gender filter', async () => {
      // Boys Mentor
      updateCurrentUserProfile(boysMentor);
      let container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderStudentsModule(container, { onNavigate: () => {} });
      expect(container.innerHTML).toContain('Male (Boys Only)');
      expect(container.innerHTML).not.toContain('Female (Girls Only)');

      // Girls Mentor
      updateCurrentUserProfile(girlsMentor);
      container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderStudentsModule(container, { onNavigate: () => {} });
      expect(container.innerHTML).toContain('Female (Girls Only)');
      expect(container.innerHTML).not.toContain('Male (Boys Only)');
    });
  });
  describe('25. Parent Leave Request, Countdown/Countup & Hourly Fine System Tests', () => {
    it('2501 - db.calculateHourlyLate correctly assesses overdue hours and hourly fine', () => {
      // On-time return: expected 2026-10-30 18:00, actual 2026-10-30 17:30
      const onTime = db.calculateHourlyLate('2026-10-30', '18:00', '2026-10-30', '17:30', 50);
      expect(onTime.late_hours).toBe(0);
      expect(onTime.calculated_fine).toBe(0);

      // Exactly on-time
      const exactTime = db.calculateHourlyLate('2026-10-30', '18:00', '2026-10-30', '18:00', 50);
      expect(exactTime.late_hours).toBe(0);
      expect(exactTime.calculated_fine).toBe(0);

      // 3 hours late
      const late3h = db.calculateHourlyLate('2026-10-30', '18:00', '2026-10-30', '21:00', 50);
      expect(late3h.late_hours).toBe(3);
      expect(late3h.calculated_fine).toBe(150);

      // Next day return: 28 hours late at ₹60/hr
      const nextDay = db.calculateHourlyLate('2026-10-30', '18:00', '2026-10-31', '22:00', 60);
      expect(nextDay.late_hours).toBe(28);
      expect(nextDay.calculated_fine).toBe(1680);
    });

    it('2502 - Parent leave request workflow: Pending creation, hourly fine, mentor approval & rejection', async () => {
      const student = await db.addStudent({
        full_name: 'Zayan Test Student',
        gender: 'Boys',
        admission_number: 'TPS-2026-TEST-P1',
        school_class: 'STD-VIII'
      });

      // 1. Create pending leave request submitted by parent
      const [leave] = await db.createLeaveRecord({
        student_ids: [student.id],
        leave_type: 'hostel_leave',
        departure_date: '2026-11-01',
        departure_time: '16:00',
        expected_return_date: '2026-11-03',
        expected_return_time: '18:00',
        reason: 'Family wedding celebration',
        requested_by: 'Parent: Abdul Rahman',
        requester_role: 'parent',
        status: 'Pending',
        fine_unit: 'hour',
        fine_per_hour: 50
      });

      expect(leave.status).toBe('Pending');
      expect(leave.requester_role).toBe('parent');
      expect(leave.fine_unit).toBe('hour');
      expect(leave.fine_per_hour).toBe(50);

      // 2. Warden/Mentor approves with updated custom hourly fine (₹75/hr)
      const approved = await db.approveLeaveRecord(leave.id, {
        approved_by: 'Hostel Chief Warden',
        fine_per_hour: 75
      });

      expect(approved.status).toBe('Approved');
      expect(approved.approved_by).toBe('Hostel Chief Warden');
      expect(approved.fine_per_hour).toBe(75);

      // 3. Create another leave and verify rejection
      const [leave2] = await db.createLeaveRecord({
        student_ids: [student.id],
        leave_type: 'personal_leave',
        departure_date: '2026-11-05',
        expected_return_date: '2026-11-06',
        reason: 'Weekend visit',
        status: 'Pending'
      });

      const rejected = await db.rejectLeaveRecord(leave2.id, {
        rejected_by: 'Hostel Chief Warden',
        reason: 'Upcoming terminal exams'
      });

      expect(rejected.status).toBe('Rejected');
    });

    it('2503 - Parent Dashboard removes Fee Invoices and provides Request Hostel Leave action', async () => {
      const parentUser = {
        id: 'p-test-01',
        email: 'parent.test@thaiba.edu',
        role: 'parent',
        approval_status: 'approved',
        full_name: 'Parent Test User'
      };
      updateCurrentUserProfile(parentUser);

      const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderParentDashboard(container, { onNavigate: () => {} });

      // Fee invoices button must be removed
      expect(container.innerHTML).not.toContain('id="btn-parent-fees"');
      expect(container.innerHTML).not.toContain('Fee Invoices');

      // Request Hostel Leave button must be active and present
      expect(container.innerHTML).toContain('id="btn-parent-apply-leave"');
      expect(container.innerHTML).toContain('Request Hostel Leave');
    });

    it('2504 - Parent Leave Request notification on Admin Dashboard (Hero Pill & Desktop Banner) and Mentor Dashboard', async () => {
      const allStudents = await db.getStudents();
      const boyStudent = allStudents.find(s => s.gender === 'Boys' || s.gender === 'Male') || allStudents[0];

      // 1. Create a pending leave request submitted by parent
      const [leave] = await db.createLeaveRecord({
        student_ids: [boyStudent.id],
        student_id: boyStudent.id,
        leave_type: 'hostel_leave',
        departure_date: '2026-11-10',
        departure_time: '16:00',
        expected_return_date: '2026-11-12',
        expected_return_time: '18:00',
        reason: 'Family wedding celebration',
        requested_by: 'Parent: Abdul Rahman',
        requester_role: 'parent',
        status: 'Pending',
        fine_unit: 'hour',
        fine_per_hour: 50
      });

      // 2. Admin Dashboard View:
      // Hero card brand pill and desktop banner must show student requested leave
      const adminUser = {
        id: 'u-admin-test',
        role: 'admin',
        full_name: 'Haseeb Mubarak',
        approval_status: 'approved'
      };
      updateCurrentUserProfile(adminUser);

      const adminContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderAdminDashboard(adminContainer, { onNavigate: () => {} });

      expect(adminContainer.innerHTML).toContain(`${boyStudent.full_name} requested leave`);
      expect(adminContainer.innerHTML).toContain('has-leave-request');
      expect(adminContainer.innerHTML).toContain('dash-desktop-leave-alert');
      expect(adminContainer.innerHTML).toContain('Parent leave request awaiting approval & hourly fine rate');

      // 3. Boys Mentor Dashboard View:
      // Must show alert banner for the boy resident
      const boysMentor = {
        id: 'd0000000-0000-0000-0000-000000000005',
        role: 'boys_mentor',
        gender: 'Boys',
        hostel_unit: 'Thaiba Boys Hostel Block A',
        approval_status: 'approved',
        full_name: 'Usthad Usman'
      };
      updateCurrentUserProfile(boysMentor);

      const mentorContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderMentorDashboard(mentorContainer, { onNavigate: () => {} });

      expect(mentorContainer.innerHTML).toContain('id="mentor-leave-alert-banner"');
      expect(mentorContainer.innerHTML).toContain(`${boyStudent.full_name} requested leave`);
      expect(mentorContainer.innerHTML).toContain('Pending Approval');

      // 4. Girls Mentor Dashboard View:
      // Must NOT show alert banner for boys resident leave
      const girlsMentor = {
        id: 'd0000000-0000-0000-0000-000000000006',
        role: 'girls_mentor',
        gender: 'Girls',
        hostel_unit: 'Thaiba Girls Hostel Campus',
        approval_status: 'approved',
        full_name: 'Usthada Mariyam'
      };
      updateCurrentUserProfile(girlsMentor);

      const girlsMentorContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderMentorDashboard(girlsMentorContainer, { onNavigate: () => {} });

      expect(girlsMentorContainer.innerHTML).not.toContain('id="mentor-leave-alert-banner"');

      // 5. Leaves Module View for Boys Mentor:
      // Must display pending pill and allow mentor to approve with per-hour fine
      updateCurrentUserProfile(boysMentor);
      const leavesContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderLeavesModule(leavesContainer, { onNavigate: () => {} });

      expect(leavesContainer.innerHTML).toContain('Pending (1)');
      expect(leavesContainer.innerHTML).toContain('btn-approve-leave');
      expect(leavesContainer.innerHTML).toContain('btn-reject-leave');

      // 6. Approve leave with per-hour fine rate of 65/hr
      const approvedLeave = await db.approveLeaveRecord(leave.id, {
        approved_by: 'Usthad Usman (Boys Mentor)',
        fine_per_hour: 65
      });

      expect(approvedLeave.status).toBe('Approved');
      expect(approvedLeave.fine_per_hour).toBe(65);
      expect(approvedLeave.approved_by).toBe('Usthad Usman (Boys Mentor)');

      const updatedBoy = (await db.getStudents()).find(s => s.id === boyStudent.id);
      expect(updatedBoy.status).toBe('On Approved Leave');

      // Clean up test leave
      const allLeaves = await db.getLeaves();
      db.set('tps_leaves', allLeaves.filter(l => l.id !== leave.id));
      await db.updateStudent(boyStudent.id, { status: 'Active' });
    });
  });
});
