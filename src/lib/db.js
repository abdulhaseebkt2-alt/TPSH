import { supabase } from './supabase.js';
import { calculateLateDays, calculateLateFine, normalizeClassPattern, compressImage } from './utils.js';
import { savePhotoToIDB, getPhotoFromIDB, getAllPhotosFromIDB } from './idb.js';

// Initial institutional mock dataset for offline / pre-migration testing
const INITIAL_PROGRAMS = [
  { id: 'prog-1', name: 'Hostel Moral Class', code: 'MORAL', description: 'Daily morning moral and ethical studies for hostel residents' },
  { id: 'prog-2', name: 'Hostel Coaching Class', code: 'HOSTEL_COACHING', description: 'Evening academic coaching and supervised study for hostel students' },
  { id: 'prog-3', name: 'School Coaching Class', code: 'SCHOOL_COACHING', description: 'Post-school mixed boys and girls coaching taught by school faculty' }
];

const INITIAL_SECTIONS = [
  // Moral
  { id: 'sec-m1', program_id: 'prog-1', name: 'Boys Moral Class – Category 1', gender_eligibility: 'Boys' },
  { id: 'sec-m2', program_id: 'prog-1', name: 'Boys Moral Class – Category 2', gender_eligibility: 'Boys' },
  { id: 'sec-m3', program_id: 'prog-1', name: 'Girls Moral Class – One combined class', gender_eligibility: 'Girls' },
  // Hostel Coaching
  { id: 'sec-hc1', program_id: 'prog-2', name: 'Boys Hostel Coaching – Category 1', gender_eligibility: 'Boys' },
  { id: 'sec-hc2', program_id: 'prog-2', name: 'Boys Hostel Coaching – Category 2', gender_eligibility: 'Boys' },
  { id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Hostel Coaching – One combined class', gender_eligibility: 'Girls' },
  // School Coaching (Mixed)
  { id: 'sec-sc1', program_id: 'prog-3', name: 'School Coaching Category 1', gender_eligibility: 'Mixed' },
  { id: 'sec-sc2', program_id: 'prog-3', name: 'School Coaching Category 2', gender_eligibility: 'Mixed' },
  { id: 'sec-sc3', program_id: 'prog-3', name: 'School Coaching Category 3', gender_eligibility: 'Mixed' },
  { id: 'sec-sc4', program_id: 'prog-3', name: 'School Coaching Category 4', gender_eligibility: 'Mixed' },
  { id: 'sec-sc5', program_id: 'prog-3', name: 'School Coaching Category 5', gender_eligibility: 'Mixed' }
];

const INITIAL_CLASSROOMS = [
  { id: 'cls-1', section_id: 'sec-m1', name: 'Moral Hall A1', room_number: '101', capacity: 35 },
  { id: 'cls-2', section_id: 'sec-m2', name: 'Moral Hall A2', room_number: '102', capacity: 35 },
  { id: 'cls-3', section_id: 'sec-m3', name: 'Girls Moral Hall G1', room_number: '201', capacity: 50 },
  { id: 'cls-4', section_id: 'sec-hc1', name: 'Hostel Study Lab 1', room_number: '105', capacity: 30 },
  { id: 'cls-5', section_id: 'sec-hc2', name: 'Hostel Study Lab 2', room_number: '106', capacity: 30 },
  { id: 'cls-6', section_id: 'sec-hc3', name: 'Girls Coaching Hall', room_number: '205', capacity: 45 },
  { id: 'cls-7', section_id: 'sec-sc1', name: 'Main Academic Lab 1', room_number: '301', capacity: 40 },
  { id: 'cls-8', section_id: 'sec-sc2', name: 'Main Academic Lab 2', room_number: '302', capacity: 40 }
];

const INITIAL_CLASSES = [
  { id: 'c-1', name: 'STD-I' },
  { id: 'c-2', name: 'STD-II' },
  { id: 'c-3', name: 'STD-III' },
  { id: 'c-4', name: 'STD-IV' },
  { id: 'c-5', name: 'STD-V' },
  { id: 'c-6', name: 'STD-VI' },
  { id: 'c-7', name: 'STD-VII' },
  { id: 'c-8', name: 'STD-VIII' },
  { id: 'c-9', name: 'STD-IX' },
  { id: 'c-10', name: 'STD-X' },
  { id: 'c-11', name: 'STD-XI' },
  { id: 'c-12', name: 'STD-XII' }
];

const INITIAL_STUDENTS = [];

const INITIAL_LEAVES = [];

const INITIAL_DISCIPLINE = [];

const INITIAL_EXAMS = [
  {
    id: 'exam-1',
    title: 'Mid-Term Examination 2026',
    exam_type: 'Half_Yearly',
    start_date: '2026-10-10',
    end_date: '2026-10-16',
    is_published: true,
    published_at: '2026-10-18T10:00:00Z',
    ranking_policy: 'standard'
  }
];

const INITIAL_EXAM_SUBJECTS = [
  { id: 'es-1', exam_id: 'exam-1', subject: 'Moral Studies & Ethics', max_marks: 100, passing_marks: 40 },
  { id: 'es-2', exam_id: 'exam-1', subject: 'Arabic Language', max_marks: 100, passing_marks: 40 },
  { id: 'es-3', exam_id: 'exam-1', subject: 'Mathematics', max_marks: 100, passing_marks: 40 },
  { id: 'es-4', exam_id: 'exam-1', subject: 'General Science', max_marks: 100, passing_marks: 40 },
  { id: 'es-5', exam_id: 'exam-1', subject: 'English', max_marks: 100, passing_marks: 40 }
];

const INITIAL_MARKS = [];

const INITIAL_AUDIT = [
  {
    id: 'aud-1',
    actor_email: 'abdulhaseebkt2@gmail.com',
    action: 'INITIAL_SUPER_ADMIN_BOOTSTRAP',
    entity_type: 'profiles',
    entity_id: 'd0000000-0000-0000-0000-000000000001',
    created_at: new Date().toISOString(),
    reason: 'Verified Initial Super Admin bootstrap'
  }
];

class DatabaseService {
  constructor() {
    this.memoryStore = new Map();
    this.initStore();
  }

  getStorageItem(key) {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return this.memoryStore.get(key) || null;
  }

  setStorageItem(key, val) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, val);
      } catch (err) {
        console.warn(`localStorage Quota Exceeded on "${key}". Triggering storage rescue...`, err);
        this.memoryStore.set(key, val);
        if (key === 'tps_students') {
          try {
            const list = JSON.parse(val);
            list.forEach(s => {
              if (s.photo_url) savePhotoToIDB(s.id, s.photo_url);
            });
            const rescueList = list.map(s => {
              if (s.photo_url && s.photo_url.length > 25000) {
                return { ...s, photo_url: '' };
              }
              return s;
            });
            localStorage.setItem(key, JSON.stringify(rescueList));
          } catch (e2) {
            console.error('Failed emergency storage rescue:', e2);
          }
        }
      }
    } else {
      this.memoryStore.set(key, val);
    }
  }

  initStore() {
    // Wiped all legacy dummy student data on user request
    if (!this.getStorageItem('tps_students_cleaned_v5')) {
      this.setStorageItem('tps_students', JSON.stringify([]));
      this.setStorageItem('tps_leaves', JSON.stringify([]));
      this.setStorageItem('tps_discipline', JSON.stringify([]));
      this.setStorageItem('tps_marks', JSON.stringify([]));
      this.setStorageItem('tps_students_cleaned_v5', 'true');
    }
    if (!this.getStorageItem('tps_students')) {
      this.setStorageItem('tps_students', JSON.stringify([]));
    }
    if (!this.getStorageItem('tps_programs')) {
      this.setStorageItem('tps_programs', JSON.stringify(INITIAL_PROGRAMS));
    }
    if (!this.getStorageItem('tps_sections')) {
      this.setStorageItem('tps_sections', JSON.stringify(INITIAL_SECTIONS));
    }
    if (!this.getStorageItem('tps_classrooms')) {
      this.setStorageItem('tps_classrooms', JSON.stringify(INITIAL_CLASSROOMS));
    }
    if (!this.getStorageItem('tps_leaves')) {
      this.setStorageItem('tps_leaves', JSON.stringify(INITIAL_LEAVES));
    }
    if (!this.getStorageItem('tps_discipline')) {
      this.setStorageItem('tps_discipline', JSON.stringify(INITIAL_DISCIPLINE));
    }
    if (!this.getStorageItem('tps_exams')) {
      this.setStorageItem('tps_exams', JSON.stringify(INITIAL_EXAMS));
    }
    if (!this.getStorageItem('tps_exam_subjects')) {
      this.setStorageItem('tps_exam_subjects', JSON.stringify(INITIAL_EXAM_SUBJECTS));
    }
    if (!this.getStorageItem('tps_marks')) {
      this.setStorageItem('tps_marks', JSON.stringify(INITIAL_MARKS));
    }
    if (!this.getStorageItem('tps_audit')) {
      this.setStorageItem('tps_audit', JSON.stringify(INITIAL_AUDIT));
    }
    if (!this.getStorageItem('tps_attendance')) {
      this.setStorageItem('tps_attendance', JSON.stringify([]));
    }
    if (!this.getStorageItem('tps_fine_payments')) {
      this.setStorageItem('tps_fine_payments', JSON.stringify([]));
    }
    if (!this.getStorageItem('tps_users')) {
      this.setStorageItem('tps_users', JSON.stringify([
        { id: 'u-1', email: 'abdulhaseebkt2@gmail.com', full_name: 'Abdul Haseeb', role: 'super_admin', approval_status: 'approved', is_super_admin: true },
        { id: 'u-2', email: 'teacher@thaibaschool.edu.in', full_name: 'Rashid Sir', role: 'teacher', approval_status: 'approved', is_super_admin: false },
        { id: 'u-3', email: 'mentor@thaibaschool.edu.in', full_name: 'Usthad Usman', role: 'mentor', approval_status: 'approved', is_super_admin: false },
        { id: 'u-4', email: 'parent@example.com', full_name: 'Ahmad K.T.', role: 'parent', approval_status: 'approved', is_super_admin: false },
        { id: 'u-5', email: 'applicant@gmail.com', full_name: 'New Applicant', role: null, approval_status: 'pending', is_super_admin: false }
      ]));
    }
  }

  get(key) {
    try {
      const item = this.getStorageItem(key);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  set(key, val) {
    this.setStorageItem(key, JSON.stringify(val));
  }

  logAudit(action, entity_type, entity_id, reason = '', actor_email = 'system') {
    const list = this.get('tps_audit');
    const entry = {
      id: 'aud-' + Date.now(),
      actor_email,
      action,
      entity_type,
      entity_id,
      reason,
      created_at: new Date().toISOString()
    };
    list.unshift(entry);
    this.set('tps_audit', list);
  }

  // --- STUDENTS ---
  async getStudents() {
    const students = this.get('tps_students');
    const arr = Array.isArray(students) ? students : [];

    // Trigger photo compression optimization in background if not already running
    if (!this._optimizingPhotos) {
      this.optimizeStoredPhotos();
    }

    // Pull any offline IDB photos
    const idbPhotos = await getAllPhotosFromIDB();

    return arr.map(s => {
      let photo = s.photo_url;
      if (!photo && idbPhotos && idbPhotos[s.id]) {
        photo = idbPhotos[s.id];
      }
      return {
        ...s,
        photo_url: photo || '',
        school_class: normalizeClassPattern(s.school_class)
      };
    });
  }

  async optimizeStoredPhotos() {
    this._optimizingPhotos = true;
    try {
      const raw = this.getStorageItem('tps_students');
      if (!raw) return;
      const students = JSON.parse(raw);
      let needsResave = false;

      for (const s of students) {
        if (s.photo_url) {
          // Always ensure backup in IndexedDB
          savePhotoToIDB(s.id, s.photo_url);

          // If photo is huge (> 25KB), compress it down to ~12KB
          if (s.photo_url.length > 25000) {
            try {
              const compressed = await compressImage(s.photo_url, 280, 320, 0.75);
              if (compressed && compressed.length < s.photo_url.length) {
                s.photo_url = compressed;
                needsResave = true;
              }
            } catch (e) {
              console.warn('Could not compress photo for student:', s.id, e);
            }
          }
        }
      }

      if (needsResave) {
        this.set('tps_students', students);
      }
    } catch (err) {
      console.warn('optimizeStoredPhotos error:', err);
    } finally {
      this._optimizingPhotos = false;
    }
  }

  async deleteStudent(id) {
    let students = this.get('tps_students') || [];
    const student = students.find(s => s.id === id);
    students = students.filter(s => s.id !== id);
    this.set('tps_students', students);
    if (student) {
      this.logAudit('STUDENT_DELETE', 'students', id, `Deleted student ${student.full_name}`);
    }
    return true;
  }

  async deleteStudents(ids) {
    let students = this.get('tps_students') || [];
    const idsSet = new Set(ids);
    students = students.filter(s => !idsSet.has(s.id));
    this.set('tps_students', students);
    this.logAudit('STUDENT_BULK_DELETE', 'students', ids.join(','), `Bulk deleted ${ids.length} students`);
    return true;
  }

  async getStudentById(id) {
    const students = await this.getStudents();
    return students.find(s => s.id === id);
  }

  async addStudent(studentData) {
    const students = this.get('tps_students');
    let photo = studentData?.photo_url || '';
    if (photo && photo.length > 25000) {
      photo = await compressImage(photo, 280, 320, 0.75);
    }

    const newStudent = {
      id: 's-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      admission_number: 'TPS-2026-' + String(students.length + 1).padStart(3, '0'),
      status: 'Active',
      black_marks: 0,
      admission_date: new Date().toISOString().split('T')[0],
      ...studentData,
      photo_url: photo,
      school_class: normalizeClassPattern(studentData?.school_class)
    };

    if (photo) {
      savePhotoToIDB(newStudent.id, photo);
    }

    students.unshift(newStudent);
    this.set('tps_students', students);
    this.logAudit('STUDENT_ADMISSION', 'students', newStudent.id, `Admitted ${newStudent.full_name}`);
    return newStudent;
  }

  async updateStudent(id, updates) {
    const students = this.get('tps_students');
    const idx = students.findIndex(s => s.id === id);
    if (idx >= 0) {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.school_class !== undefined) {
        sanitizedUpdates.school_class = normalizeClassPattern(sanitizedUpdates.school_class);
      }
      if (sanitizedUpdates.photo_url) {
        if (sanitizedUpdates.photo_url.length > 25000) {
          sanitizedUpdates.photo_url = await compressImage(sanitizedUpdates.photo_url, 280, 320, 0.75);
        }
        savePhotoToIDB(id, sanitizedUpdates.photo_url);
      }
      students[idx] = { ...students[idx], ...sanitizedUpdates, updated_at: new Date().toISOString() };
      this.set('tps_students', students);
      this.logAudit('STUDENT_UPDATE', 'students', id, `Updated student record`);
      return students[idx];
    }
    return null;
  }

  // --- TEMPORARY BREAK ---
  async setTemporaryBreak(studentId, { startDate, expectedReturnDate, reason, approvedBy }) {
    const student = await this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');
    return this.updateStudent(studentId, {
      status: 'Temporary Break',
      hostel_status: 'temporary_break',
      break_start_date: startDate,
      break_expected_return_date: expectedReturnDate,
      break_reason: reason,
      break_approved_by: approvedBy
    });
  }

  async endTemporaryBreak(studentId) {
    return this.updateStudent(studentId, {
      status: 'Active',
      hostel_status: 'resident',
      break_rejoin_date: new Date().toISOString().split('T')[0]
    });
  }

  // --- SECTIONS & CLASSROOMS ---
  async getPrograms() {
    return this.get('tps_programs');
  }

  async getSections() {
    return this.get('tps_sections');
  }

  async getClassrooms() {
    return this.get('tps_classrooms');
  }

  async addSection({ program_id, name, gender_eligibility }) {
    const sections = this.get('tps_sections');
    const newSection = {
      id: 'sec-' + Date.now(),
      program_id,
      name,
      gender_eligibility: gender_eligibility || 'Mixed'
    };
    sections.push(newSection);
    this.set('tps_sections', sections);
    this.logAudit('CREATE_SECTION', 'program_sections', newSection.id, `Created section ${name}`);
    return newSection;
  }

  async addClassroom({ section_id, name, room_number, capacity }) {
    const classrooms = this.get('tps_classrooms');
    const newCls = {
      id: 'cls-' + Date.now(),
      section_id,
      name,
      room_number: room_number || 'Room',
      capacity: Number(capacity) || 35
    };
    classrooms.push(newCls);
    this.set('tps_classrooms', classrooms);
    this.logAudit('CREATE_CLASSROOM', 'classrooms', newCls.id, `Created classroom ${name}`);
    return newCls;
  }

  // --- ATTENDANCE ---
  async getAttendanceRecords() {
    return this.get('tps_attendance');
  }

  async saveAttendanceSession({ program_id, classroom_id, session_date, teacher_id, records }) {
    const attendance = this.get('tps_attendance');
    const sessionId = 'sess-' + Date.now();
    const newSession = {
      id: sessionId,
      program_id,
      classroom_id,
      session_date,
      teacher_id,
      created_at: new Date().toISOString(),
      records // array of { student_id, status: 'Present'|'Absent'|'Late'|'Excused'|'Approved Leave' }
    };
    attendance.push(newSession);
    this.set('tps_attendance', attendance);
    this.logAudit('SUBMIT_ATTENDANCE', 'attendance_sessions', sessionId, `Attendance submitted for ${session_date}`);
    return newSession;
  }

  // --- HOSTEL LEAVES & RETURNS ---
  async getLeaves() {
    return this.get('tps_leaves');
  }

  async createLeaveRecord({ student_ids, leave_type, departure_date, departure_time, reason, expected_return_date, expected_return_time, fine_per_day = 200, approved_by }) {
    const leaves = this.get('tps_leaves');
    const students = this.get('tps_students');
    const createdRecords = [];

    for (const sid of student_ids) {
      const regNo = 'LR-2026-' + String(leaves.length + createdRecords.length + 1).padStart(3, '0');
      const rec = {
        id: 'leave-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        student_id: sid,
        leave_register_number: regNo,
        leave_type: leave_type || 'individual',
        departure_date,
        departure_time,
        reason,
        expected_return_date,
        expected_return_time,
        actual_return_date: null,
        actual_return_time: null,
        status: 'Away',
        fine_per_day_applied: Number(fine_per_day),
        late_days: 0,
        calculated_fine: 0,
        adjusted_fine: 0,
        fine_status: 'no_fine',
        approved_by: approved_by || 'Hostel Warden'
      };
      createdRecords.push(rec);

      // Update student hostel presence to On Approved Leave
      const sidx = students.findIndex(s => s.id === sid);
      if (sidx >= 0) {
        students[sidx].status = 'On Approved Leave';
      }
    }

    leaves.push(...createdRecords);
    this.set('tps_leaves', leaves);
    this.set('tps_students', students);
    this.logAudit('CREATE_LEAVE', 'student_leave_records', createdRecords[0]?.id, `Leave approved for ${createdRecords.length} student(s)`);
    return createdRecords;
  }

  async recordReturn(leave_record_id, actual_return_date, actual_return_time, remarks = '') {
    const leaves = this.get('tps_leaves');
    const students = this.get('tps_students');
    const idx = leaves.findIndex(l => l.id === leave_record_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    const lateDays = calculateLateDays(leave.expected_return_date, actual_return_date);
    const fine = calculateLateFine(lateDays, leave.fine_per_day_applied);

    leave.actual_return_date = actual_return_date;
    leave.actual_return_time = actual_return_time;
    leave.late_days = lateDays;
    leave.calculated_fine = fine;
    leave.adjusted_fine = fine;
    leave.fine_status = fine > 0 ? 'unpaid' : 'no_fine';
    leave.status = 'Returned';
    leave.remarks = remarks;

    // Reactivate student hostel status
    const sidx = students.findIndex(s => s.id === leave.student_id);
    if (sidx >= 0) {
      students[sidx].status = 'Active';
      students[sidx].hostel_status = 'resident';
    }

    this.set('tps_leaves', leaves);
    this.set('tps_students', students);
    this.logAudit('RECORD_RETURN', 'student_leave_records', leave_record_id, `Return recorded. Late days: ${lateDays}, Fine: ₹${fine}`);
    return leave;
  }

  async recordFinePayment(leave_record_id, amount, payment_method = 'Cash', reference_number = '') {
    const leaves = this.get('tps_leaves');
    const idx = leaves.findIndex(l => l.id === leave_record_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    leave.fine_status = 'paid';
    this.set('tps_leaves', leaves);

    const payments = this.get('tps_fine_payments');
    const newPayment = {
      id: 'fp-' + Date.now(),
      leave_record_id,
      student_id: leave.student_id,
      amount: Number(amount),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method,
      reference_number,
      receipt_number: 'RCPT-' + Date.now().toString().slice(-6)
    };
    payments.push(newPayment);
    this.set('tps_fine_payments', payments);
    this.logAudit('FINE_PAYMENT', 'fine_payments', newPayment.id, `Fine payment of ₹${amount} received`);
    return newPayment;
  }

  // --- DISCIPLINE & BLACK MARKS ---
  async getDisciplineIncidents() {
    return this.get('tps_discipline');
  }

  async logDisciplineIncident({ student_id, category, severity, incident_date, description, black_marks, fine, action_taken, reported_by }) {
    const incidents = this.get('tps_discipline');
    const students = this.get('tps_students');
    const newInc = {
      id: 'disc-' + Date.now(),
      student_id,
      category,
      severity: severity || 'Minor',
      incident_date: incident_date || new Date().toISOString().split('T')[0],
      description,
      black_marks_awarded: Number(black_marks) || 1,
      monetary_fine: Number(fine) || 0,
      action_taken,
      reported_by: reported_by || 'Staff',
      resolution_status: 'Open'
    };
    incidents.unshift(newInc);
    this.set('tps_discipline', incidents);

    // Update student's cumulative black marks
    const sidx = students.findIndex(s => s.id === student_id);
    if (sidx >= 0) {
      students[sidx].black_marks = (students[sidx].black_marks || 0) + newInc.black_marks_awarded;
      this.set('tps_students', students);
    }

    this.logAudit('LOG_INCIDENT', 'discipline_incidents', newInc.id, `Discipline incident recorded for student`);
    return newInc;
  }

  // --- EXAMINATIONS & MARKS ---
  async getExams() {
    return this.get('tps_exams');
  }

  async getExamSubjects(exam_id) {
    const subjects = this.get('tps_exam_subjects');
    return exam_id ? subjects.filter(s => s.exam_id === exam_id) : subjects;
  }

  async getMarks(exam_id) {
    const marks = this.get('tps_marks');
    return exam_id ? marks.filter(m => m.exam_id === exam_id) : marks;
  }

  async saveMarks(marksArray) {
    const existing = this.get('tps_marks');
    for (const m of marksArray) {
      const idx = existing.findIndex(item => item.exam_id === m.exam_id && item.student_id === m.student_id && item.subject === m.subject);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...m };
      } else {
        existing.push({ id: 'm-' + Date.now() + Math.random(), ...m });
      }
    }
    this.set('tps_marks', existing);
    this.logAudit('MARKS_SAVED', 'exam_marks', marksArray[0]?.exam_id, `Updated ${marksArray.length} marks records`);
  }

  async publishResults(exam_id) {
    const exams = this.get('tps_exams');
    const idx = exams.findIndex(e => e.id === exam_id);
    if (idx >= 0) {
      exams[idx].is_published = true;
      exams[idx].published_at = new Date().toISOString();
      this.set('tps_exams', exams);

      // Mark all student scores as published
      const marks = this.get('tps_marks');
      marks.forEach(m => {
        if (m.exam_id === exam_id) m.status = 'Published';
      });
      this.set('tps_marks', marks);
      this.logAudit('PUBLISH_RESULTS', 'examinations', exam_id, `Published examination results`);
      return exams[idx];
    }
    return null;
  }

  // --- USER APPROVALS & PERMISSIONS ---
  async getUsers() {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('get_manageable_users');
        if (!error && Array.isArray(data) && data.length > 0) {
          // Merge with any local demo users that don't collide
          const localUsers = this.get('tps_users') || [];
          const remoteEmails = new Set(data.map(u => (u.email || '').toLowerCase()));
          const combined = [
            ...data,
            ...localUsers.filter(lu => !remoteEmails.has((lu.email || '').toLowerCase()) && lu.id !== 'u-pending')
          ];
          return combined;
        }
      } catch (err) {
        console.warn('Supabase get_manageable_users fallback:', err);
      }
    }
    return this.get('tps_users');
  }

  async updateUserApproval(user_id, { approval_status, role }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
    if (supabase && isUuid) {
      try {
        const { data, error } = await supabase.rpc('admin_set_user_approval', {
          target_user_id: user_id,
          new_approval_status: approval_status,
          new_role: role || null
        });
        if (!error && data) {
          // Also sync locally
          const users = this.get('tps_users');
          const idx = users.findIndex(u => u.id === user_id);
          if (idx >= 0) {
            users[idx].approval_status = approval_status;
            if (role) users[idx].role = role;
            this.set('tps_users', users);
          }
          this.logAudit('USER_APPROVAL_UPDATE', 'profiles', user_id, `Approval: ${approval_status}, Role: ${role || 'none'}`);
          return data;
        }
      } catch (err) {
        console.warn('Supabase admin_set_user_approval fallback:', err);
      }
    }

    const users = this.get('tps_users');
    const idx = users.findIndex(u => u.id === user_id);
    if (idx >= 0) {
      users[idx].approval_status = approval_status;
      if (role) users[idx].role = role;
      this.set('tps_users', users);
      this.logAudit('USER_APPROVAL_UPDATE', 'profiles', user_id, `Approval: ${approval_status}, Role: ${role}`);
      return users[idx];
    }
    return null;
  }

  async updateProfile(user_id, { full_name, phone, avatar_url, blood_group, tps_id }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
    if (supabase && isUuid) {
      try {
        const { data, error } = await supabase.rpc('admin_or_self_update_profile', {
          p_user_id: user_id,
          p_full_name: full_name || '',
          p_phone: phone || '',
          p_avatar_url: avatar_url || '',
          p_blood_group: blood_group || '',
          p_tps_id: tps_id || ''
        });
        if (!error && data) {
          const users = this.get('tps_users');
          const idx = users.findIndex(u => u.id === user_id);
          if (idx >= 0) {
            users[idx] = { ...users[idx], ...data };
            this.set('tps_users', users);
          }
          return data;
        }
      } catch (err) {
        console.warn('Supabase updateProfile fallback:', err);
      }
    }

    const users = this.get('tps_users');
    const idx = users.findIndex(u => u.id === user_id);
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        full_name: full_name || users[idx].full_name,
        phone: phone || users[idx].phone,
        avatar_url: avatar_url || users[idx].avatar_url,
        blood_group: blood_group || users[idx].blood_group,
        tps_id: tps_id || users[idx].tps_id,
        profile_completed: true
      };
      this.set('tps_users', users);
      this.logAudit('USER_PROFILE_UPDATE', 'profiles', user_id, `Updated profile for ${users[idx].email}`);
      return users[idx];
    }
    return null;
  }

  // --- AUDIT LOGS ---
  async getAuditLogs() {
    return this.get('tps_audit');
  }
}

export const db = new DatabaseService();
