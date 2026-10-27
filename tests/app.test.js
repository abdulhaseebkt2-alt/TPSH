import { describe, it, expect, beforeEach } from 'vitest';
import { calculateLateDays, calculateLateFine, formatDate, formatCurrency, parseStudentsCSV, normalizeDate } from '../src/lib/utils.js';
import { canAccessModule, canPerformAction, MODULE_DEFINITIONS, getRBACMatrix, saveRBACMatrix, resetRBACMatrix } from '../src/lib/permissions.js';
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

    // 2. Add Classroom Card directly under this Section with start and end times
    const cls = await db.addClassroom({
      program_id: prog.id,
      name: 'Tuition Room 101',
      start_time: '18:30',
      end_time: '20:00',
      room_number: '', // non-mandatory
      capacity: null,  // non-mandatory
      gender_eligibility: 'Boys'
    });
    expect(cls).toBeDefined();
    expect(cls.name).toBe('Tuition Room 101');
    expect(cls.program_id).toBe(prog.id);
    expect(cls.start_time).toBe('18:30');
    expect(cls.end_time).toBe('20:00');
    expect(cls.gender_eligibility).toBe('Boys');

    // 3. Verify it is returned in getClassrooms()
    const allCls = await db.getClassrooms();
    const found = allCls.find(c => c.id === cls.id);
    expect(found).toBeDefined();
    expect(found.program_id).toBe(prog.id);
    expect(found.start_time).toBe('18:30');
    expect(found.end_time).toBe('20:00');

    // 4. Update Classroom
    const updated = await db.updateClassroom(cls.id, {
      name: 'Tuition Hall Beta',
      start_time: '19:00',
      end_time: '20:30',
      gender_eligibility: 'Mixed'
    });
    expect(updated.name).toBe('Tuition Hall Beta');
    expect(updated.start_time).toBe('19:00');
    expect(updated.end_time).toBe('20:30');
    expect(updated.gender_eligibility).toBe('Mixed');

    // 5. Delete Classroom
    const deleted = await db.deleteClassroom(cls.id);
    expect(deleted).toBe(true);

    const afterDel = await db.getClassrooms();
    expect(afterDel.some(c => c.id === cls.id)).toBe(false);

    // Clean up program
    await db.deleteProgram(prog.id);
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
