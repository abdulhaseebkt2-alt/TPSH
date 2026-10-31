import { supabase, isTestEnv } from './supabase.js';
import { calculateLateDays, calculateLateFine, normalizeClassPattern, compressImage, normalizeDate, normalizeGender, normalizeStatus, normalizeHostelStatus } from './utils.js';
import { savePhotoToIDB, getPhotoFromIDB, getAllPhotosFromIDB } from './idb.js';

export function isDummyStudent(s) {
  if (isTestEnv) return false;
  if (!s) return false;
  const name = String(s.full_name || '').toLowerCase().trim();
  const adm = String(s.admission_number || '').trim();
  if (adm === 'TPS2022078') return true;
  if (
    name.includes('test student') ||
    name.includes('break test') ||
    name.includes('stayed student') ||
    name.includes('group student') ||
    name.includes('delete test') ||
    name.includes('fine test') ||
    name.includes('photo test') ||
    name === 'dummy student' ||
    name.startsWith('test ') ||
    name.endsWith(' test')
  ) {
    return true;
  }
  return false;
}

// Initial institutional mock dataset for offline / pre-migration testing
const INITIAL_PROGRAMS = [
  { id: 'prog-1', name: 'Hostel Moral Class', code: 'MORAL', description: 'Daily morning moral and ethical studies for hostel residents' },
  { id: 'prog-2', name: 'Hostel Coaching Class', code: 'HOSTEL_COACHING', description: 'Evening academic coaching and supervised study for hostel students' },
  { id: 'prog-3', name: 'School Coaching Class', code: 'SCHOOL_COACHING', description: 'Post-school mixed boys and girls coaching taught by school faculty' }
];

const INITIAL_SECTIONS = [
  // Moral
  { id: 'sec-m1', program_id: 'prog-1', name: 'Boys Moral Class 1', gender_eligibility: 'Boys' },
  { id: 'sec-m2', program_id: 'prog-1', name: 'Boys Moral Class 2', gender_eligibility: 'Boys' },
  { id: 'sec-m3', program_id: 'prog-1', name: 'Girls Moral Class', gender_eligibility: 'Girls' },
  // Hostel Coaching (4 sections matching desktop live view)
  { id: 'sec-hc1', program_id: 'prog-2', name: 'Htl BB', gender_eligibility: 'Boys' },
  { id: 'sec-hc2', program_id: 'prog-2', name: 'Hostel Study Lab 2', gender_eligibility: 'Boys' },
  { id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Coaching Hall', gender_eligibility: 'Girls' },
  { id: 'sec-hc4', program_id: 'prog-2', name: '9999', gender_eligibility: 'Mixed' },
  // School Coaching (Mixed)
  { id: 'sec-sc1', program_id: 'prog-3', name: 'Main Academic Lab 1', gender_eligibility: 'Mixed' },
  { id: 'sec-sc2', program_id: 'prog-3', name: 'Main Academic Lab 2', gender_eligibility: 'Mixed' },
  { id: 'sec-sc3', program_id: 'prog-3', name: 'School Coaching Class 3', gender_eligibility: 'Mixed' },
  { id: 'sec-sc4', program_id: 'prog-3', name: 'School Coaching Class 4', gender_eligibility: 'Mixed' },
  { id: 'sec-sc5', program_id: 'prog-3', name: 'School Coaching Class 5', gender_eligibility: 'Mixed' }
];

const INITIAL_CLASSROOMS = [
  { id: 'cls-1', section_id: 'sec-m1', program_id: 'prog-1', name: 'Moral Hall A1', start_time: '06:00', end_time: '07:00', room_number: '101', capacity: 35, gender_eligibility: 'Boys', teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-2', section_id: 'sec-m2', program_id: 'prog-1', name: 'Moral Hall A2', start_time: '06:00', end_time: '07:00', room_number: '102', capacity: 35, gender_eligibility: 'Boys', teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-3', section_id: 'sec-m3', program_id: 'prog-1', name: 'Girls Moral Hall G1', start_time: '06:00', end_time: '07:00', room_number: '201', capacity: 50, gender_eligibility: 'Girls', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-4', section_id: 'sec-hc1', program_id: 'prog-2', name: 'Htl BB', start_time: '09:39', end_time: '22:07', room_number: '105', capacity: 30, gender_eligibility: 'Boys', teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-5', section_id: 'sec-hc2', program_id: 'prog-2', name: 'Hostel Study Lab 2', start_time: '19:30', end_time: '21:00', room_number: '106', capacity: 30, gender_eligibility: 'Boys', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-6', section_id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Coaching Hall', start_time: '19:30', end_time: '21:00', room_number: '205', capacity: 45, gender_eligibility: 'Girls', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-9999', section_id: 'sec-hc4', program_id: 'prog-2', name: '9999', start_time: '19:30', end_time: '21:00', room_number: '101', capacity: 35, gender_eligibility: 'Mixed', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-7', section_id: 'sec-sc1', program_id: 'prog-3', name: 'Main Academic Lab 1', start_time: '16:30', end_time: '18:00', room_number: '301', capacity: 40, gender_eligibility: 'Mixed', teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-8', section_id: 'sec-sc2', program_id: 'prog-3', name: 'Main Academic Lab 2', start_time: '16:30', end_time: '18:00', room_number: '302', capacity: 40, gender_eligibility: 'Mixed', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null }
];

export const INITIAL_TEACHER_ASSIGNMENTS = [
  {
    id: 'asg-1',
    classroom_id: 'cls-1',
    teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55',
    assigned_date: '2026-10-01',
    removed_date: null
  },
  {
    id: 'asg-2',
    classroom_id: 'cls-2',
    teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55',
    assigned_date: '2026-10-01',
    removed_date: null
  },
  {
    id: 'asg-4',
    classroom_id: 'cls-4',
    teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55',
    assigned_date: '2026-10-01',
    removed_date: null
  },
  {
    id: 'asg-7',
    classroom_id: 'cls-7',
    teacher_id: '3ba0d909-6656-43eb-87fb-fe8e30088d55',
    assigned_date: '2026-10-01',
    removed_date: null
  }
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

export const INITIAL_ACADEMIC_CALENDAR = {
  academic_year: '2026-2027',
  weekly_working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  events: [
    { id: 'cal-1', date: '2026-10-02', name: 'Gandhi Jayanti', type: 'holiday' },
    { id: 'cal-2', date: '2026-10-12', name: 'Maha Navami / Puja Vacation', type: 'holiday' },
    { id: 'cal-3', date: '2026-10-19', name: 'Deepavali Break Day 1', type: 'holiday' },
    { id: 'cal-4', date: '2026-10-20', name: 'Eid Milad-un-Nabi', type: 'holiday' },
    { id: 'cal-5', date: '2026-10-21', name: 'Institutional Mid-Term Break', type: 'holiday' },
    { id: 'cal-6', date: '2026-10-26', name: 'Special Working Session', type: 'working_day' },
    { id: 'cal-7', date: '2026-11-01', name: 'Kerala Piravi / State Foundation', type: 'holiday' },
    { id: 'cal-8', date: '2026-11-14', name: 'Children\'s Day Celebration', type: 'event' }
  ]
};

export const INITIAL_FACULTY_LEAVES = [
  {
    id: 'fl-1',
    faculty_id: 'u-2',
    faculty_name: 'Rashid Sir',
    faculty_email: 'teacher@thaibaschool.edu.in',
    is_multiple_days: false,
    start_date: '2026-10-15',
    end_date: '2026-10-15',
    departure_time: '08:30',
    return_time: '16:30',
    leave_type: 'Casual Leave',
    reason: 'Attending University Educational Seminar & Curriculum Workshop',
    status: 'Approved',
    applied_by: { id: 'u-2', name: 'Rashid Sir', role: 'teacher' },
    applied_at: '2026-10-14T10:00:00.000Z',
    approved_by: { id: 'u-1', name: 'Abdul Haseeb', role: 'super_admin' },
    approved_at: '2026-10-14T14:30:00.000Z',
    admin_notes: 'Approved for institutional training representation.'
  }
];

export async function uploadStudentPhotoToSupabase(identifier, base64OrBlob) {
  if (isTestEnv) {
    const cleanId = String(identifier || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `https://txbjraknaaokenyvbaak.supabase.co/storage/v1/object/public/student-photos/${cleanId}_${Date.now()}.png`;
  }
  if (!supabase || !base64OrBlob) return base64OrBlob || '';
  if (typeof base64OrBlob === 'string' && base64OrBlob.startsWith('http')) {
    return base64OrBlob;
  }
  try {
    let fileBody = null;
    let contentType = 'image/jpeg';
    let ext = 'jpg';

    if (typeof base64OrBlob === 'string' && base64OrBlob.startsWith('data:')) {
      const parts = base64OrBlob.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) contentType = match[1] || 'image/jpeg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';

      const base64Data = parts[1] || '';
      if (typeof atob !== 'undefined') {
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        if (typeof Blob !== 'undefined') {
          fileBody = new Blob([bytes], { type: contentType });
        } else {
          fileBody = bytes;
        }
      } else if (typeof Buffer !== 'undefined') {
        fileBody = Buffer.from(base64Data, 'base64');
      }
    } else if (typeof Blob !== 'undefined' && base64OrBlob instanceof Blob) {
      fileBody = base64OrBlob;
      contentType = base64OrBlob.type || 'image/jpeg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';
    } else {
      return base64OrBlob;
    }

    if (!fileBody) return base64OrBlob;

    const cleanId = String(identifier || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `${cleanId}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('student-photos').upload(path, fileBody, {
      contentType,
      upsert: true
    });

    if (error) {
      console.warn('Supabase storage upload error:', error);
      return base64OrBlob;
    }

    const { data: pubData } = supabase.storage.from('student-photos').getPublicUrl(path);
    return pubData?.publicUrl || base64OrBlob;
  } catch (err) {
    console.warn('uploadStudentPhotoToSupabase error:', err);
    return base64OrBlob;
  }
}

class DatabaseService {
  constructor() {
    this.memoryStore = new Map();
    this._pulledKeysTime = new Map();
    this._studentsCache = null;
    this._studentsCacheTime = 0;
    this._studentsInFlightPromise = null;
    this._usersCache = null;
    this._usersCacheTime = 0;
    this._usersInFlightPromise = null;
    this.initStore();
  }

  invalidateCache(type = 'all') {
    if (type === 'all' || type === 'students') {
      this._studentsCache = null;
      this._studentsCacheTime = 0;
      this._studentsInFlightPromise = null;
    }
    if (type === 'all' || type === 'users') {
      this._usersCache = null;
      this._usersCacheTime = 0;
      this._usersInFlightPromise = null;
    }
    if (type === 'all' || type === 'cloud_keys') {
      this._pulledKeysTime.clear();
    }
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
    // Purge any residual test dummy data from previous sessions or tests
    try {
      const stored = this.getStorageItem('tps_students');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(s => !isDummyStudent(s));
          if (cleaned.length !== parsed.length) {
            this.setStorageItem('tps_students', JSON.stringify(cleaned));
          }
        }
      }
    } catch (e) {
      // ignore
    }

    if (!this.getStorageItem('tps_students_cleaned_v6')) {
      try {
        const stored = this.getStorageItem('tps_students');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.setStorageItem('tps_students', JSON.stringify(parsed.filter(s => !isDummyStudent(s))));
          }
        }
      } catch (e) {}
      this.setStorageItem('tps_students_cleaned_v6', 'true');
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
    if (!this.getStorageItem('tps_teacher_assignments')) {
      this.setStorageItem('tps_teacher_assignments', JSON.stringify(INITIAL_TEACHER_ASSIGNMENTS));
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
    if (!this.getStorageItem('tps_teacher_attendance')) {
      this.setStorageItem('tps_teacher_attendance', JSON.stringify([]));
    }
    if (!this.getStorageItem('tps_attendance_unlocks')) {
      this.setStorageItem('tps_attendance_unlocks', JSON.stringify([]));
    }
    if (!this.getStorageItem('tps_fine_payments')) {
      this.setStorageItem('tps_fine_payments', JSON.stringify([]));
    }
    if (!this.getStorageItem('tps_academic_calendar')) {
      this.setStorageItem('tps_academic_calendar', JSON.stringify(INITIAL_ACADEMIC_CALENDAR));
    }
    if (!this.getStorageItem('tps_faculty_leaves')) {
      this.setStorageItem('tps_faculty_leaves', JSON.stringify(INITIAL_FACULTY_LEAVES));
    }
    if (!this.getStorageItem('tps_users')) {
      this.setStorageItem('tps_users', JSON.stringify([
        { id: 'u-1', email: 'abdulhaseebkt2@gmail.com', full_name: 'Abdul Haseeb', role: 'super_admin', approval_status: 'approved', is_super_admin: true },
        { id: 'u-2', email: 'teacher@thaibaschool.edu.in', full_name: 'Rashid Sir', role: 'teacher', approval_status: 'approved', is_super_admin: false },
        { id: 'u-3', email: 'mentor@thaibaschool.edu.in', full_name: 'Usthad Usman', role: 'boys_mentor', mentor_type: 'boys', gender: 'Boys', hostel_unit: 'Thaiba Boys Hostel Block A', approval_status: 'approved', is_super_admin: false },
        { id: 'u-4', email: 'parent@example.com', full_name: 'Ahmad K.T.', role: 'parent', approval_status: 'approved', is_super_admin: false },
        { id: 'u-5', email: 'applicant@gmail.com', full_name: 'New Applicant', role: null, approval_status: 'pending', is_super_admin: false },
        { id: 'u-6', email: 'girls_mentor@thaibaschool.edu.in', full_name: 'Usthada Mariyam', role: 'girls_mentor', mentor_type: 'girls', gender: 'Girls', hostel_unit: 'Thaiba Girls Hostel Campus', approval_status: 'approved', is_super_admin: false }
      ]));
    }
  }

  get(key) {
    try {
      const item = this.getStorageItem(key);
      if (!item) {
        if (key === 'tps_parent_assignments') return {};
        return [];
      }
      return JSON.parse(item);
    } catch {
      if (key === 'tps_parent_assignments') return {};
      return [];
    }
  }

  set(key, val) {
    this.setStorageItem(key, JSON.stringify(val));
    this._pulledKeysTime.set(key, Date.now());
    if (key === 'tps_students') {
      this._studentsCache = null;
      this._studentsCacheTime = 0;
    }
    if (key === 'tps_users') {
      this._usersCache = null;
      this._usersCacheTime = 0;
      this._usersInFlightPromise = null;
    }
    if (supabase && !isTestEnv) {
      supabase.from('app_settings').upsert({
        key,
        value: val,
        updated_at: new Date().toISOString()
      }).then().catch(e => console.warn('Supabase app_settings sync warning:', e));
    }
  }

  async pullCloudKeys(keys = [
    'tps_programs',
    'tps_sections',
    'tps_classrooms',
    'tps_classroom_assignments',
    'tps_teacher_assignments',
    'tps_leaves',
    'tps_faculty_leaves',
    'tps_hostel_rooms',
    'tps_hostel_beds',
    'tps_discipline',
    'tps_fines',
    'tps_black_marks',
    'tps_parent_assignments'
  ], force = false) {
    if (!supabase || isTestEnv) return;
    const now = Date.now();
    const TTL = 25000;
    if (!force) {
      const needed = keys.filter(k => (now - (this._pulledKeysTime.get(k) || 0)) > TTL);
      if (needed.length === 0) return;
      keys = needed;
    }
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (row.key && row.value !== undefined && row.value !== null) {
            this.setStorageItem(row.key, JSON.stringify(row.value));
            this._pulledKeysTime.set(row.key, Date.now());
          }
        }
        for (const k of keys) {
          if (!this._pulledKeysTime.has(k)) {
            this._pulledKeysTime.set(k, Date.now());
          }
        }
      }
    } catch (e) {
      console.warn('pullCloudKeys warning:', e);
    }
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
  async getStudents(force = false) {
    const now = Date.now();
    const TTL = 25000;
    if (!force && this._studentsCache && (now - this._studentsCacheTime < TTL)) {
      return this._studentsCache;
    }
    if (!force && this._studentsInFlightPromise) {
      return this._studentsInFlightPromise;
    }

    this._studentsInFlightPromise = (async () => {
      try {
        let supabaseStudents = null;
        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('students')
              .select('*')
              .order('admission_number');
            if (!error && Array.isArray(data)) {
              supabaseStudents = data.filter(s => !isDummyStudent(s));
            } else if (error) {
              console.warn('Supabase getStudents query error:', error);
            }
          } catch (err) {
            console.warn('Supabase getStudents connection fallback:', err);
          }
        }

        const localRaw = this.getStorageItem('tps_students');
        let localStudents = localRaw ? JSON.parse(localRaw) : [];
        if (Array.isArray(localStudents)) {
          localStudents = localStudents.filter(s => !isDummyStudent(s));
        }

        // Safely reconcile Cloud and Local records
        let mergedStudents = [];
        if (supabaseStudents && supabaseStudents.length > 0) {
          mergedStudents = supabaseStudents;
          // Preserve any genuinely locally added student (created offline, never synced to Supabase)
          if (localStudents.length > 0) {
            const dbAdmSet = new Set(supabaseStudents.map(s => s.admission_number));
            const missingFromDb = localStudents.filter(s => 
              s.admission_number && 
              !dbAdmSet.has(s.admission_number) && 
              !isDummyStudent(s) &&
              (typeof s.id === 'string' && s.id.startsWith('s-'))
            );
            if (missingFromDb.length > 0) {
              mergedStudents = [...supabaseStudents, ...missingFromDb];
              // Asynchronously sync missing records to Supabase in background
              this.importStudents(missingFromDb).catch(err => console.warn('Background sync error:', err));
            }
          }
        } else if (localStudents.length > 0) {
          // Supabase is empty or offline: prioritize local students and trigger cloud sync
          mergedStudents = localStudents;
          if (supabase) {
            this.syncAllToSupabase().catch(err => console.warn('Auto-sync to Supabase error:', err));
          }
        } else {
          mergedStudents = [];
        }

        // Filter once more for complete guarantee
        mergedStudents = mergedStudents.filter(s => !isDummyStudent(s));

        // Cache latest in localStorage for offline availability
        this.setStorageItem('tps_students', JSON.stringify(mergedStudents));

        // Pull any offline IDB photos
        const idbPhotos = await getAllPhotosFromIDB();

        let hasLocalPhotoSync = false;
        const finalStudents = mergedStudents.map(s => {
          let photo = s.photo_url;
          const localIdbPhoto = idbPhotos[s.id] || (s.admission_number && idbPhotos[s.admission_number]);
          if (!photo && localIdbPhoto) {
            photo = localIdbPhoto;
            s.photo_url = photo;
            hasLocalPhotoSync = true;
          }
          return {
            ...s,
            photo_url: photo || '',
            school_class: normalizeClassPattern(s.school_class)
          };
        });

        if (hasLocalPhotoSync) {
          this.setStorageItem('tps_students', JSON.stringify(finalStudents));
        }

        // Trigger photo cloud sync and optimization in background if not already running
        if (!this._optimizingPhotos) {
          this.optimizeStoredPhotos();
        }

        this._studentsCache = finalStudents;
        this._studentsCacheTime = Date.now();
        return finalStudents;
      } finally {
        this._studentsInFlightPromise = null;
      }
    })();

    return this._studentsInFlightPromise;
  }

  async importStudents(studentsToImport) {
    if (!Array.isArray(studentsToImport) || studentsToImport.length === 0) {
      return { success: false, count: 0, dbCount: 0, message: 'No students provided for import' };
    }

    const cleanList = studentsToImport.filter(s => !isDummyStudent(s));
    if (cleanList.length === 0) {
      return { success: true, count: 0, dbCount: 0, message: 'Ignored dummy/test student records' };
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const normalizedList = cleanList.map((s, idx) => {
      const rawAdm = s.admission_number && String(s.admission_number).trim();
      const adm = rawAdm && !/^\d{1,2}$/.test(rawAdm)
        ? rawAdm
        : ('TPS-2026-' + String(Date.now()).slice(-3) + String(idx).padStart(2, '0'));

      const cleanClass = normalizeClassPattern(s.school_class || 'STD-VIII');
      const cleanGender = normalizeGender(s.gender);
      const cleanDob = normalizeDate(s.dob, '2012-05-15');
      const cleanAdmDate = normalizeDate(s.admission_date, todayStr);
      const cleanStatus = normalizeStatus(s.status);
      const cleanHostelStatus = normalizeHostelStatus(s.hostel_status);

      return {
        admission_number: adm,
        full_name: (s.full_name && String(s.full_name).trim()) || ('Student ' + adm),
        gender: cleanGender,
        dob: cleanDob,
        admission_date: cleanAdmDate,
        school_class: cleanClass,
        school_section: s.school_section || 'A',
        hostel_status: cleanHostelStatus,
        status: cleanStatus,
        village: s.village || '',
        post_office: s.post_office || '',
        district: s.district || 'Malappuram',
        state: s.state || 'Kerala',
        pin_code: s.pin_code || '676541',
        father_name: s.father_name || '',
        father_phone: s.father_phone || '',
        mother_name: s.mother_name || '',
        mother_phone: s.mother_phone || '',
        whatsapp_number: s.whatsapp_number || s.father_phone || '',
        medical_info: s.medical_info || '',
        category: s.category || 'General',
        hostel_unit: s.hostel_unit || '',
        hostel_room: s.hostel_room || '',
        hostel_bed: s.hostel_bed || '',
        photo_url: s.photo_url || '',
        black_marks: 0
      };
    });

    let dbSuccessCount = 0;
    if (supabase) {
      try {
        for (let i = 0; i < normalizedList.length; i += 20) {
          const chunk = normalizedList.slice(i, i + 20);
          const { data, error } = await supabase
            .from('students')
            .upsert(chunk, { onConflict: 'admission_number' })
            .select();

          if (!error) {
            dbSuccessCount += (data ? data.length : chunk.length);
          } else {
            console.warn('Supabase bulk upsert chunk error, trying individual items:', error);
            for (const item of chunk) {
              const { error: singleErr } = await supabase
                .from('students')
                .upsert(item, { onConflict: 'admission_number' });
              if (!singleErr) dbSuccessCount++;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase bulk import connection error:', err);
      }
    }

    // Update local storage cache
    let localStudents = this.get('tps_students') || [];
    const localMap = new Map();
    localStudents.forEach(s => localMap.set(s.admission_number, s));

    normalizedList.forEach(s => {
      const existing = localMap.get(s.admission_number);
      if (existing) {
        localMap.set(s.admission_number, { ...existing, ...s, updated_at: new Date().toISOString() });
      } else {
        localMap.set(s.admission_number, {
          id: 's-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          ...s
        });
      }
    });

    const merged = Array.from(localMap.values());
    this.set('tps_students', merged);
    this.logAudit('STUDENTS_BULK_IMPORT', 'students', 'multiple', `Imported ${normalizedList.length} students via CSV`);

    return {
      success: true,
      count: normalizedList.length,
      dbCount: dbSuccessCount,
      students: merged
    };
  }

  async syncAllToSupabase() {
    if (!supabase) return { success: false, message: 'Supabase is not configured' };
    const stats = { students: 0, photos: 0, leaves: 0, discipline: 0 };

    try {
      // 1. Sync Students from local storage and IDB
      const localStudents = (this.get('tps_students') || []).filter(s => !isDummyStudent(s));
      const idbPhotos = await getAllPhotosFromIDB();

      if (localStudents.length > 0) {
        let hasPhotoUpdates = false;
        for (const s of localStudents) {
          let currentPhoto = s.photo_url || idbPhotos[s.id] || '';
          if (currentPhoto && currentPhoto.startsWith('data:')) {
            try {
              const publicUrl = await uploadStudentPhotoToSupabase(s.admission_number || s.id, currentPhoto);
              if (publicUrl && publicUrl.startsWith('http')) {
                s.photo_url = publicUrl;
                hasPhotoUpdates = true;
                stats.photos++;
                savePhotoToIDB(s.id, publicUrl);
              }
            } catch (pErr) {
              console.warn('Sync photo migration error for student:', s.id, pErr);
            }
          }
        }
        if (hasPhotoUpdates) {
          this.set('tps_students', localStudents);
        }

        const studentPayloads = localStudents.map((s, idx) => {
          const isUuid = s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.id);
          const rawAdm = s.admission_number && String(s.admission_number).trim();
          const adm = rawAdm && !/^\d{1,2}$/.test(rawAdm)
            ? rawAdm
            : ('TPS-2026-' + String(Date.now()).slice(-3) + String(idx).padStart(2, '0'));

          return {
            ...(isUuid ? { id: s.id } : {}),
            admission_number: adm,
            full_name: (s.full_name && String(s.full_name).trim()) || ('Student ' + adm),
            gender: normalizeGender(s.gender),
            dob: normalizeDate(s.dob, '2012-05-15'),
            admission_date: normalizeDate(s.admission_date, new Date().toISOString().split('T')[0]),
            school_class: normalizeClassPattern(s.school_class),
            school_section: s.school_section || 'A',
            hostel_status: normalizeHostelStatus(s.hostel_status),
            status: normalizeStatus(s.status),
            village: s.village || '',
            post_office: s.post_office || '',
            district: s.district || 'Malappuram',
            state: s.state || 'Kerala',
            pin_code: s.pin_code || '676541',
            father_name: s.father_name || '',
            father_phone: s.father_phone || '',
            mother_name: s.mother_name || '',
            mother_phone: s.mother_phone || '',
            whatsapp_number: s.whatsapp_number || s.father_phone || '',
            medical_info: s.medical_info || '',
            category: s.category || 'General',
            hostel_unit: s.hostel_unit || '',
            hostel_room: s.hostel_room || '',
            hostel_bed: s.hostel_bed || '',
            photo_url: s.photo_url || '',
            black_marks: s.black_marks || 0
          };
        });

        for (let i = 0; i < studentPayloads.length; i += 20) {
          const chunk = studentPayloads.slice(i, i + 20);
          const { error } = await supabase.from('students').upsert(chunk, { onConflict: 'admission_number' });
          if (!error) {
            stats.students += chunk.length;
          } else {
            console.warn('Sync student chunk error:', error);
          }
        }
      }

      // Re-fetch students from Supabase and cache locally
      const { data: dbStudents } = await supabase.from('students').select('*').order('admission_number');
      if (dbStudents && dbStudents.length > 0) {
        this.set('tps_students', dbStudents);
      }

      return { success: true, stats };
    } catch (err) {
      console.error('syncAllToSupabase error:', err);
      return { success: false, error: err.message };
    }
  }

  async optimizeStoredPhotos() {
    this._optimizingPhotos = true;
    try {
      const raw = this.getStorageItem('tps_students');
      if (!raw) return;
      const students = JSON.parse(raw);
      const idbPhotos = await getAllPhotosFromIDB();
      let needsResave = false;

      for (const s of students) {
        let photo = s.photo_url || idbPhotos[s.id] || (s.admission_number && idbPhotos[s.admission_number]) || '';
        if (photo) {
          savePhotoToIDB(s.id, photo);
          if (s.admission_number) savePhotoToIDB(s.admission_number, photo);

          if (supabase) {
            if (photo.startsWith('data:')) {
              try {
                const publicUrl = await uploadStudentPhotoToSupabase(s.admission_number || s.id, photo);
                if (publicUrl && publicUrl.startsWith('http')) {
                  s.photo_url = publicUrl;
                  photo = publicUrl;
                  needsResave = true;
                  savePhotoToIDB(s.id, publicUrl);
                  if (s.admission_number) savePhotoToIDB(s.admission_number, publicUrl);

                  const isUuid = s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.id);
                  if (isUuid) {
                    await supabase.from('students').update({ photo_url: publicUrl }).eq('id', s.id);
                  } else if (s.admission_number) {
                    await supabase.from('students').update({ photo_url: publicUrl }).eq('admission_number', s.admission_number);
                  }
                }
              } catch (err) {
                console.warn('optimizeStoredPhotos storage upload error:', err);
              }
            } else if (photo.startsWith('http')) {
              if (!s.photo_url || s.photo_url !== photo) {
                s.photo_url = photo;
                needsResave = true;
              }
              const isUuid = s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.id);
              if (isUuid) {
                supabase.from('students').update({ photo_url: photo }).eq('id', s.id).then();
              } else if (s.admission_number) {
                supabase.from('students').update({ photo_url: photo }).eq('admission_number', s.admission_number).then();
              }
            }
          }
        }
      }

      if (needsResave) {
        this.setStorageItem('tps_students', JSON.stringify(students));
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

    if (supabase) {
      try {
        const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
          await supabase.from('students').delete().eq('id', id);
        } else {
          if (student?.admission_number) {
            await supabase.from('students').delete().eq('admission_number', student.admission_number);
          }
        }

        if (student?.photo_url && student.photo_url.includes('/student-photos/')) {
          const parts = student.photo_url.split('/student-photos/');
          if (parts[1]) {
            const fileName = parts[1].split('?')[0];
            await supabase.storage.from('student-photos').remove([fileName]);
          }
        }
      } catch (err) {
        console.warn('Supabase deleteStudent error:', err);
      }
    }

    students = students.filter(s => s.id !== id);
    this.set('tps_students', students);
    if (student) {
      this.logAudit('STUDENT_DELETE', 'students', id, `Deleted student ${student.full_name}`);
    }
    return true;
  }

  async deleteStudents(ids) {
    if (supabase && ids && ids.length > 0) {
      try {
        const uuidList = ids.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
        if (uuidList.length > 0) {
          await supabase.from('students').delete().in('id', uuidList);
        }
      } catch (err) {
        console.warn('Supabase deleteStudents error:', err);
      }
    }

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
    if (isDummyStudent(studentData) && !isTestEnv) {
      console.warn('Blocked dummy student admission in live system:', studentData?.full_name);
      return null;
    }

    let photo = studentData?.photo_url || '';
    if (photo && photo.length > 25000 && photo.startsWith('data:')) {
      photo = await compressImage(photo, 280, 320, 0.75);
    }

    const admissionNumber = studentData.admission_number || ('TPS-2026-' + String(Math.floor(100 + Math.random() * 900)));

    // Upload to Supabase Storage bucket if photo is base64
    if ((supabase || isTestEnv) && photo && photo.startsWith('data:')) {
      const publicUrl = await uploadStudentPhotoToSupabase(admissionNumber, photo);
      if (publicUrl && publicUrl.startsWith('http')) {
        photo = publicUrl;
      }
    }

    const payload = {
      admission_number: admissionNumber,
      full_name: studentData.full_name,
      gender: normalizeGender(studentData.gender),
      dob: normalizeDate(studentData.dob, '2012-05-15'),
      admission_date: normalizeDate(studentData.admission_date, new Date().toISOString().split('T')[0]),
      school_class: normalizeClassPattern(studentData?.school_class),
      school_section: studentData.school_section || 'A',
      hostel_status: normalizeHostelStatus(studentData.hostel_status),
      status: normalizeStatus(studentData.status),
      village: studentData.village || '',
      post_office: studentData.post_office || '',
      district: studentData.district || 'Malappuram',
      state: studentData.state || 'Kerala',
      pin_code: studentData.pin_code || '676541',
      father_name: studentData.father_name || '',
      father_phone: studentData.father_phone || '',
      mother_name: studentData.mother_name || '',
      mother_phone: studentData.mother_phone || '',
      whatsapp_number: studentData.whatsapp_number || studentData.father_phone || '',
      medical_info: studentData.medical_info || '',
      category: studentData.category || 'General',
      hostel_unit: studentData.hostel_unit || '',
      hostel_room: studentData.hostel_room || '',
      hostel_bed: studentData.hostel_bed || '',
      photo_url: photo,
      black_marks: 0
    };

    let createdStudent = null;
    if (supabase) {
      try {
        let { data, error } = await supabase.from('students').insert([payload]).select().single();
        if (error && error.code === '23505' && !studentData.admission_number) {
          payload.admission_number = 'TPS-2026-' + String(Math.floor(100 + Math.random() * 900));
          const retry = await supabase.from('students').insert([payload]).select().single();
          if (!retry.error && retry.data) {
            createdStudent = retry.data;
          }
        } else if (!error && data) {
          createdStudent = data;
        } else if (error) {
          console.warn('Supabase addStudent insert error:', error);
        }
      } catch (err) {
        console.warn('Supabase addStudent error:', err);
      }
    }

    if (!createdStudent) {
      createdStudent = {
        id: 's-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        ...payload
      };
    }

    if (photo) {
      savePhotoToIDB(createdStudent.id, photo);
      savePhotoToIDB(admissionNumber, photo);
    }

    const students = this.get('tps_students');
    students.unshift(createdStudent);
    this.set('tps_students', students);
    this.logAudit('STUDENT_ADMISSION', 'students', createdStudent.id, `Admitted ${createdStudent.full_name}`);
    return createdStudent;
  }

  async updateStudent(id, updates) {
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.school_class !== undefined) {
      sanitizedUpdates.school_class = normalizeClassPattern(sanitizedUpdates.school_class);
    }
    if (sanitizedUpdates.photo_url) {
      if (sanitizedUpdates.photo_url.length > 25000 && sanitizedUpdates.photo_url.startsWith('data:')) {
        sanitizedUpdates.photo_url = await compressImage(sanitizedUpdates.photo_url, 280, 320, 0.75);
      }
      if ((supabase || isTestEnv) && sanitizedUpdates.photo_url.startsWith('data:')) {
        try {
          const uploadedUrl = await uploadStudentPhotoToSupabase(sanitizedUpdates.admission_number || id, sanitizedUpdates.photo_url);
          if (uploadedUrl && uploadedUrl.startsWith('http')) {
            sanitizedUpdates.photo_url = uploadedUrl;
          }
        } catch (uErr) {
          console.warn('uploadStudentPhotoToSupabase in updateStudent error:', uErr);
        }
      }
      savePhotoToIDB(id, sanitizedUpdates.photo_url);
      if (sanitizedUpdates.admission_number) {
        savePhotoToIDB(sanitizedUpdates.admission_number, sanitizedUpdates.photo_url);
      }
    }

    if (supabase) {
      try {
        const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        let updateRes;
        if (isUuid) {
          updateRes = await supabase.from('students').update(sanitizedUpdates).eq('id', id);
        } else if (sanitizedUpdates.admission_number) {
          updateRes = await supabase.from('students').update(sanitizedUpdates).eq('admission_number', sanitizedUpdates.admission_number);
        }
        if (updateRes?.error) {
          console.warn('Supabase updateStudent error:', updateRes.error);
        }
      } catch (err) {
        console.warn('Supabase updateStudent error:', err);
      }
    }

    const students = this.get('tps_students');
    const idx = students.findIndex(s => s.id === id || s.admission_number === id);
    if (idx >= 0) {
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
    await this.pullCloudKeys(['tps_programs']);
    return this.get('tps_programs') || [];
  }

  async addProgram({ name, code, description }) {
    const programs = this.get('tps_programs') || [];
    const cleanCode = (code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)).toUpperCase();
    const newProg = {
      id: 'prog-' + Date.now(),
      name,
      code: cleanCode || 'SECTION',
      description: description || ''
    };
    programs.push(newProg);
    this.set('tps_programs', programs);
    this.logAudit('CREATE_SECTION', 'programs', newProg.id, `Created section ${name}`);
    return newProg;
  }

  async updateProgram(programId, updates) {
    let programs = this.get('tps_programs') || [];
    const idx = programs.findIndex(p => p.id === programId);
    if (idx === -1) return null;

    if (updates.code) {
      updates.code = updates.code.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    }

    programs[idx] = { ...programs[idx], ...updates };
    this.set('tps_programs', programs);
    this.logAudit('UPDATE_SECTION', 'programs', programId, `Updated section ${programs[idx].name}`);
    return programs[idx];
  }

  async deleteProgram(programId) {
    let programs = this.get('tps_programs') || [];
    const prog = programs.find(p => p.id === programId);
    if (!prog) return false;

    if (programs.length <= 1) {
      throw new Error('At least one section must remain configured.');
    }

    programs = programs.filter(p => p.id !== programId);
    this.set('tps_programs', programs);

    // Cascade delete any child categories and classrooms
    let sections = this.get('tps_sections') || [];
    const childSecIds = sections.filter(s => s.program_id === programId).map(s => s.id);
    sections = sections.filter(s => s.program_id !== programId);
    this.set('tps_sections', sections);

    let classrooms = this.get('tps_classrooms') || [];
    classrooms = classrooms.filter(c => !childSecIds.includes(c.section_id));
    this.set('tps_classrooms', classrooms);

    if (supabase) {
      try {
        if (childSecIds.length > 0) {
          await supabase.from('classrooms').delete().in('section_id', childSecIds);
          await supabase.from('program_sections').delete().in('id', childSecIds);
        }
      } catch (err) {
        console.warn('Supabase cascade delete on program error:', err);
      }
    }

    this.logAudit('DELETE_SECTION', 'programs', programId, `Deleted section ${prog.name}`);
    return true;
  }

  async getSections() {
    await this.pullCloudKeys(['tps_sections']);
    return this.get('tps_sections') || [];
  }

  async getClassrooms() {
    await this.pullCloudKeys(['tps_programs', 'tps_sections', 'tps_classrooms', 'tps_classroom_assignments']);
    let classrooms = this.get('tps_classrooms') || [];
    let sections = this.get('tps_sections') || [];
    let modified = false;

    // Harmonize program_id, gender_eligibility, and timings from backing sections if missing
    classrooms.forEach(c => {
      if (!c.program_id && c.section_id) {
        const sec = sections.find(s => s.id === c.section_id);
        if (sec) {
          c.program_id = sec.program_id;
          if (!c.gender_eligibility) c.gender_eligibility = sec.gender_eligibility || 'Mixed';
          modified = true;
        }
      }
      if (!c.gender_eligibility) {
        c.gender_eligibility = 'Mixed';
      }
      // Populate starting and ending times if missing
      if (!c.start_time || !c.end_time) {
        if (c.program_id === 'prog-1') {
          c.start_time = c.start_time || '06:00';
          c.end_time = c.end_time || '07:00';
        } else if (c.program_id === 'prog-2') {
          c.start_time = c.start_time || '19:30';
          c.end_time = c.end_time || '21:00';
        } else {
          c.start_time = c.start_time || '16:30';
          c.end_time = c.end_time || '18:00';
        }
        modified = true;
      }
      if (c.name && /category/i.test(c.name)) {
        c.name = c.name.replace(/–\s*category\s*/gi, 'Hall ').replace(/category\s*/gi, 'Class ').trim();
        modified = true;
      }
      // Ensure faculty assignment tenure tracking is initialized
      if (c.teacher_id && !c.teacher_assigned_date) {
        c.teacher_assigned_date = '2026-10-01';
        modified = true;
      }
      if (c.teacher_removed_date === undefined) {
        c.teacher_removed_date = null;
        modified = true;
      }
    });

    // Auto-bridge any section that was created into a classroom
    sections.forEach(s => {
      const hasCls = classrooms.some(c => c.section_id === s.id || c.name === s.name);
      if (!hasCls && s.program_id) {
        const cleanName = (s.name || 'Classroom').replace(/–\s*category\s*/gi, 'Hall ').replace(/category\s*/gi, 'Class ').trim();
        let defStart = '06:00', defEnd = '07:00';
        if (s.program_id === 'prog-2') { defStart = '19:30'; defEnd = '21:00'; }
        else if (s.program_id === 'prog-3') { defStart = '16:30'; defEnd = '18:00'; }

        classrooms.push({
          id: 'cls-' + s.id,
          section_id: s.id,
          program_id: s.program_id,
          name: cleanName,
          start_time: defStart,
          end_time: defEnd,
          room_number: '',
          capacity: null,
          gender_eligibility: s.gender_eligibility || 'Mixed'
        });
        modified = true;
      }
    });

    if (modified) {
      this.set('tps_classrooms', classrooms);
    }

    const assignments = this.get('tps_classroom_assignments') || {};
    classrooms.forEach(c => {
      if (!Array.isArray(c.student_ids)) {
        c.student_ids = assignments[c.id] || [];
      }
    });

    return classrooms;
  }

  async addSection({ program_id, name, gender_eligibility }) {
    const sections = this.get('tps_sections') || [];
    const newSection = {
      id: 'sec-' + Date.now(),
      program_id,
      name,
      gender_eligibility: gender_eligibility || 'Mixed'
    };
    sections.push(newSection);
    this.set('tps_sections', sections);

    if (supabase) {
      try {
        await supabase.from('program_sections').insert([{
          id: newSection.id,
          program_id,
          name,
          gender_eligibility: newSection.gender_eligibility
        }]);
      } catch (err) {
        console.warn('Supabase addSection error:', err);
      }
    }

    this.logAudit('CREATE_SECTION', 'program_sections', newSection.id, `Created section ${name}`);
    return newSection;
  }

  async updateSection(sectionId, updates) {
    let sections = this.get('tps_sections') || [];
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return null;

    sections[idx] = { ...sections[idx], ...updates };
    this.set('tps_sections', sections);

    if (supabase) {
      try {
        await supabase.from('program_sections').update(updates).eq('id', sectionId);
      } catch (err) {
        console.warn('Supabase updateSection error:', err);
      }
    }

    this.logAudit('UPDATE_SECTION', 'program_sections', sectionId, `Updated section ${sections[idx].name}`);
    return sections[idx];
  }

  async deleteSection(sectionId) {
    let sections = this.get('tps_sections') || [];
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return false;

    // Remove section
    sections = sections.filter(s => s.id !== sectionId);
    this.set('tps_sections', sections);

    // Cascade delete any classrooms belonging to this section
    let classrooms = this.get('tps_classrooms') || [];
    classrooms = classrooms.filter(c => c.section_id !== sectionId);
    this.set('tps_classrooms', classrooms);

    if (supabase) {
      try {
        await supabase.from('classrooms').delete().eq('section_id', sectionId);
        await supabase.from('program_sections').delete().eq('id', sectionId);
      } catch (err) {
        console.warn('Supabase deleteSection error:', err);
      }
    }

    this.logAudit('DELETE_SECTION', 'program_sections', sectionId, `Deleted section ${sec.name} and associated classrooms`);
    return true;
  }

  async addClassroom({ program_id, section_id, name, start_time, end_time, room_number, capacity, gender_eligibility, teacher_id, days, teacher_assigned_date, teacher_removed_date }) {
    const classrooms = this.get('tps_classrooms') || [];
    let sections = this.get('tps_sections') || [];

    let targetSecId = section_id;
    if (!targetSecId && program_id) {
      let sec = sections.find(s => s.program_id === program_id);
      if (!sec) {
        sec = {
          id: 'sec-' + Date.now(),
          program_id,
          name: name,
          gender_eligibility: gender_eligibility || 'Mixed'
        };
        sections.push(sec);
        this.set('tps_sections', sections);
      }
      targetSecId = sec.id;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const newCls = {
      id: 'cls-' + Date.now(),
      program_id: program_id || (sections.find(s => s.id === targetSecId)?.program_id) || '',
      section_id: targetSecId || '',
      name,
      start_time: start_time || '06:30',
      end_time: end_time || '07:30',
      room_number: room_number ? String(room_number).trim() : '',
      capacity: capacity ? Number(capacity) : null,
      gender_eligibility: gender_eligibility || 'Mixed',
      teacher_id: teacher_id || '',
      teacher_assigned_date: teacher_id ? (teacher_assigned_date || todayIso) : null,
      teacher_removed_date: teacher_removed_date || null,
      days: Array.isArray(days) && days.length > 0 ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };
    classrooms.push(newCls);
    this.set('tps_classrooms', classrooms);

    if (newCls.teacher_id) {
      let assignments = this.get('tps_teacher_assignments') || [];
      assignments.push({
        id: 't-asg-' + Date.now(),
        classroom_id: newCls.id,
        teacher_id: newCls.teacher_id,
        assigned_date: newCls.teacher_assigned_date,
        removed_date: newCls.teacher_removed_date || null
      });
      this.set('tps_teacher_assignments', assignments);
    }

    if (supabase) {
      try {
        await supabase.from('classrooms').insert([{
          id: newCls.id,
          section_id: newCls.section_id,
          name: newCls.name,
          room_number: newCls.room_number,
          capacity: newCls.capacity
        }]);
      } catch (err) {
        console.warn('Supabase addClassroom error:', err);
      }
    }

    this.logAudit('CREATE_CLASSROOM', 'classrooms', newCls.id, `Created classroom ${name}`);
    return newCls;
  }

  async updateClassroom(classroomId, updates) {
    let classrooms = this.get('tps_classrooms') || [];
    const idx = classrooms.findIndex(c => c.id === classroomId);
    if (idx === -1) return null;

    const oldCls = classrooms[idx];
    const oldTeacherId = oldCls.teacher_id || '';
    const todayIso = new Date().toISOString().slice(0, 10);

    const sanitized = { ...updates };
    if (sanitized.capacity !== undefined) {
      sanitized.capacity = sanitized.capacity ? Number(sanitized.capacity) : null;
    }

    // Faculty tenure lifecycle tracking:
    // If teacher assignment changed or removal was explicitly recorded
    if (sanitized.teacher_id !== undefined && sanitized.teacher_id !== oldTeacherId) {
      let assignments = this.get('tps_teacher_assignments') || [];
      const newTeacherId = sanitized.teacher_id;

      // 1. If classroom had an old teacher, close their assignment tenure on removal date
      if (oldTeacherId) {
        const removalDate = sanitized.teacher_removed_date || todayIso;
        const openIdx = assignments.findIndex(a => a.classroom_id === classroomId && a.teacher_id === oldTeacherId && !a.removed_date);
        if (openIdx >= 0) {
          assignments[openIdx].removed_date = removalDate;
        } else {
          assignments.push({
            id: 't-asg-' + Date.now() + '-old',
            classroom_id: classroomId,
            teacher_id: oldTeacherId,
            assigned_date: oldCls.teacher_assigned_date || '2026-10-01',
            removed_date: removalDate
          });
        }
      }

      // 2. If new teacher assigned
      if (newTeacherId) {
        sanitized.teacher_assigned_date = sanitized.teacher_assigned_date || todayIso;
        sanitized.teacher_removed_date = null;
        assignments.push({
          id: 't-asg-' + Date.now(),
          classroom_id: classroomId,
          teacher_id: newTeacherId,
          assigned_date: sanitized.teacher_assigned_date,
          removed_date: null
        });
      } else {
        // Teacher unassigned / removed by admin
        sanitized.teacher_assigned_date = null;
        sanitized.teacher_removed_date = sanitized.teacher_removed_date || todayIso;
      }

      this.set('tps_teacher_assignments', assignments);
    } else if (sanitized.teacher_removed_date && sanitized.teacher_removed_date !== oldCls.teacher_removed_date) {
      // Explicit removal date updated
      let assignments = this.get('tps_teacher_assignments') || [];
      const currentTeacher = sanitized.teacher_id || oldTeacherId;
      if (currentTeacher) {
        const openIdx = assignments.findIndex(a => a.classroom_id === classroomId && a.teacher_id === currentTeacher && !a.removed_date);
        if (openIdx >= 0) {
          assignments[openIdx].removed_date = sanitized.teacher_removed_date;
          this.set('tps_teacher_assignments', assignments);
        }
      }
    }

    classrooms[idx] = { ...classrooms[idx], ...sanitized };
    this.set('tps_classrooms', classrooms);

    if (classrooms[idx].section_id) {
      let sections = this.get('tps_sections') || [];
      const secIdx = sections.findIndex(s => s.id === classrooms[idx].section_id);
      if (secIdx !== -1) {
        if (sanitized.name) sections[secIdx].name = sanitized.name;
        if (sanitized.gender_eligibility) sections[secIdx].gender_eligibility = sanitized.gender_eligibility;
        this.set('tps_sections', sections);
      }
    }

    if (supabase) {
      try {
        await supabase.from('classrooms').update(sanitized).eq('id', classroomId);
      } catch (err) {
        console.warn('Supabase updateClassroom error:', err);
      }
    }

    this.logAudit('UPDATE_CLASSROOM', 'classrooms', classroomId, `Updated classroom ${classrooms[idx].name}`);
    return classrooms[idx];
  }

  async deleteClassroom(classroomId) {
    let classrooms = this.get('tps_classrooms') || [];
    const cls = classrooms.find(c => c.id === classroomId);
    if (!cls) return false;

    classrooms = classrooms.filter(c => c.id !== classroomId);
    this.set('tps_classrooms', classrooms);

    if (supabase) {
      try {
        await supabase.from('classrooms').delete().eq('id', classroomId);
      } catch (err) {
        console.warn('Supabase deleteClassroom error:', err);
      }
    }

    this.logAudit('DELETE_CLASSROOM', 'classrooms', classroomId, `Deleted classroom ${cls.name}`);
    return true;
  }

  // --- FACULTY ASSIGNMENT & TENURE MANAGEMENT ---
  async getTeacherAssignments() {
    await this.pullCloudKeys(['tps_teacher_assignments']);
    let assignments = this.get('tps_teacher_assignments');
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      assignments = [...INITIAL_TEACHER_ASSIGNMENTS];
      this.set('tps_teacher_assignments', assignments);
    }
    return assignments;
  }

  isTeacherAssignedOnDate(teacherId, classroom, dateStr, allAssignments = null) {
    if (!teacherId || !classroom || !dateStr) return false;

    const assignments = allAssignments || this.get('tps_teacher_assignments') || INITIAL_TEACHER_ASSIGNMENTS;

    const isMatch = (t1, t2) => {
      if (!t1 || !t2) return false;
      if (t1 === t2) return true;
      // Handle known seeded alias between initial test teacher u-2 and uuid
      const isTester1 = t1 === 'u-2' || t1 === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || t1 === 'teacher@thaibaschool.edu.in';
      const isTester2 = t2 === 'u-2' || t2 === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || t2 === 'teacher@thaibaschool.edu.in';
      return isTester1 && isTester2;
    };

    // Check historical assignment log entries for this classroom and teacher
    const classTeacherAssignments = (assignments || []).filter(a => 
      a.classroom_id === classroom.id && (isMatch(a.teacher_id, teacherId) || (isMatch(classroom.teacher_id, teacherId) && !a.teacher_id))
    );

    if (classTeacherAssignments.length > 0) {
      return classTeacherAssignments.some(a => {
        const start = a.assigned_date || '2026-10-01';
        const end = a.removed_date || null;
        if (dateStr < start) return false;
        if (end && dateStr > end) return false;
        return true;
      });
    }

    // Direct classroom property fallback
    if (isMatch(classroom.teacher_id, teacherId)) {
      const start = classroom.teacher_assigned_date || '2026-10-01';
      const end = classroom.teacher_removed_date || null;
      if (dateStr < start) return false;
      if (end && dateStr > end) return false;
      return true;
    }

    return false;
  }

  async assignTeacherToClassroom(classroomId, teacherId, assignedDate = null) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const dateOfAssignment = assignedDate || todayIso;
    return this.updateClassroom(classroomId, {
      teacher_id: teacherId,
      teacher_assigned_date: dateOfAssignment,
      teacher_removed_date: null
    });
  }

  async removeTeacherFromClassroom(classroomId, removalDate = null) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const dateOfRemoval = removalDate || todayIso;
    return this.updateClassroom(classroomId, {
      teacher_id: '',
      teacher_assigned_date: null,
      teacher_removed_date: dateOfRemoval
    });
  }

  // --- FACULTY LEAVES & DUTY ABSENCE ---
  async getFacultyLeaves() {
    await this.pullCloudKeys(['tps_faculty_leaves']);
    let leaves = this.get('tps_faculty_leaves');
    if (!leaves || !Array.isArray(leaves) || leaves.length === 0) {
      leaves = [...INITIAL_FACULTY_LEAVES];
      this.set('tps_faculty_leaves', leaves);
    }
    return leaves;
  }

  async applyFacultyLeave(leaveData) {
    const leaves = await this.getFacultyLeaves();
    const nowIso = new Date().toISOString();
    const newLeave = {
      id: 'fl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      faculty_id: leaveData.faculty_id || 'u-2',
      faculty_name: leaveData.faculty_name || 'Faculty Member',
      faculty_email: leaveData.faculty_email || '',
      is_multiple_days: Boolean(leaveData.is_multiple_days),
      start_date: leaveData.start_date,
      end_date: leaveData.is_multiple_days ? (leaveData.end_date || leaveData.start_date) : leaveData.start_date,
      departure_time: leaveData.departure_time || '08:00',
      return_time: leaveData.return_time || '16:30',
      leave_type: leaveData.leave_type || 'Casual Leave',
      reason: leaveData.reason || '',
      status: leaveData.status || 'Pending',
      applied_by: leaveData.applied_by || { name: 'Staff' },
      applied_at: nowIso,
      approved_by: leaveData.approved_by || (leaveData.status === 'Approved' ? leaveData.applied_by : null),
      approved_at: leaveData.status === 'Approved' ? nowIso : null,
      admin_notes: leaveData.admin_notes || ''
    };
    leaves.unshift(newLeave);
    this.set('tps_faculty_leaves', leaves);
    this.logAudit('FACULTY_LEAVE_APPLIED', 'faculty_leaves', newLeave.id, `Applied leave for ${newLeave.faculty_name}: ${newLeave.leave_type}`, leaveData.applied_by?.name || 'staff');
    return newLeave;
  }

  async updateFacultyLeaveStatus(leaveId, status, approverUser, adminNotes = '') {
    const leaves = await this.getFacultyLeaves();
    const target = leaves.find(l => l.id === leaveId);
    if (!target) return null;
    target.status = status;
    target.approved_by = approverUser ? {
      id: approverUser.id,
      name: approverUser.full_name || approverUser.name || 'Admin',
      role: approverUser.role || 'admin'
    } : null;
    target.approved_at = new Date().toISOString();
    if (adminNotes) {
      target.admin_notes = adminNotes;
    }
    this.set('tps_faculty_leaves', leaves);
    this.logAudit('FACULTY_LEAVE_STATUS_UPDATED', 'faculty_leaves', leaveId, `Leave status updated to ${status} by ${target.approved_by?.name || 'admin'}`, approverUser?.name || 'admin');
    return target;
  }

  async updateFacultyLeave(leaveId, updates = {}, editorUser = null) {
    const leaves = await this.getFacultyLeaves();
    const target = leaves.find(l => l.id === leaveId);
    if (!target) return null;

    Object.assign(target, updates);
    target.updated_at = new Date().toISOString();
    if (editorUser) {
      target.last_edited_by = {
        id: editorUser.id,
        name: editorUser.full_name || editorUser.name || 'Admin',
        role: editorUser.role || 'admin'
      };
    }
    this.set('tps_faculty_leaves', leaves);
    this.logAudit('FACULTY_LEAVE_EDITED', 'faculty_leaves', leaveId, `Leave modified/adjusted by ${editorUser?.name || editorUser?.full_name || 'Admin'}`);
    return target;
  }

  async deleteFacultyLeave(leaveId) {
    let leaves = await this.getFacultyLeaves();
    const initialLen = leaves.length;
    leaves = leaves.filter(l => l.id !== leaveId);
    if (leaves.length !== initialLen) {
      this.set('tps_faculty_leaves', leaves);
      this.logAudit('FACULTY_LEAVE_DELETED', 'faculty_leaves', leaveId, 'Removed faculty leave record');
      return true;
    }
    return false;
  }

  isFacultyOnApprovedLeave(teacherIdOrEmailOrName, dateStr, allFacultyLeaves = null, timeStr = null) {
    if (!teacherIdOrEmailOrName || !dateStr) return null;
    const leaves = allFacultyLeaves || this.get('tps_faculty_leaves') || INITIAL_FACULTY_LEAVES;
    if (!Array.isArray(leaves)) return null;

    let targetId = '';
    let targetEmail = '';
    let targetName = '';

    if (typeof teacherIdOrEmailOrName === 'object' && teacherIdOrEmailOrName !== null) {
      targetId = String(teacherIdOrEmailOrName.id || '').trim();
      targetEmail = String(teacherIdOrEmailOrName.email || '').trim().toLowerCase();
      targetName = String(teacherIdOrEmailOrName.full_name || teacherIdOrEmailOrName.name || '').trim().toLowerCase();
    } else {
      targetId = String(teacherIdOrEmailOrName || '').trim();
      targetEmail = targetId.toLowerCase();
      targetName = targetId.toLowerCase();
    }

    const isMatch = (t1, t2) => {
      if (!t1 || !t2) return false;
      if (t1 === t2) return true;
      const s1 = String(t1).trim().toLowerCase();
      const s2 = String(t2).trim().toLowerCase();
      if (s1 === s2) return true;
      if (s1.includes(s2) || s2.includes(s1)) return true;
      const isTester1 = s1 === 'u-2' || s1 === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || s1 === 'teacher@thaibaschool.edu.in' || s1.includes('rashid');
      const isTester2 = s2 === 'u-2' || s2 === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || s2 === 'teacher@thaibaschool.edu.in' || s2.includes('rashid');
      return isTester1 && isTester2;
    };

    return leaves.find(l => {
      if (l.status !== 'Approved') return false;
      const matchesFaculty = isMatch(l.faculty_id, targetId) ||
                             isMatch(l.faculty_email, targetEmail) ||
                             isMatch(l.faculty_name, targetName) ||
                             (targetId && isMatch(l.faculty_id, targetId)) ||
                             (targetEmail && isMatch(l.faculty_email, targetEmail)) ||
                             (targetName && isMatch(l.faculty_name, targetName));
      if (!matchesFaculty) return false;

      // Early / Actual Return Check:
      // If faculty reported back early, duty resumes from the return point
      if (l.actual_return_date) {
        if (dateStr > l.actual_return_date) return false;
        if (dateStr === l.actual_return_date && l.actual_return_time && timeStr && timeStr >= l.actual_return_time) {
          return false;
        }
      }

      const start = l.start_date;
      const end = l.end_date || l.start_date;
      const inDateRange = dateStr >= start && dateStr <= end;
      if (!inDateRange) return false;

      // Optional time-window check for single-day leaves if timeStr is supplied
      if (timeStr && start === end && l.departure_time && l.return_time) {
        if (timeStr < l.departure_time || timeStr > l.return_time) {
          return false;
        }
      }

      return true;
    }) || null;
  }

  // --- CLASSROOM STUDENT ASSIGNMENTS ---
  async getClassroomStudents(classroomId) {
    await this.pullCloudKeys(['tps_classroom_assignments']);
    const classrooms = this.get('tps_classrooms') || [];
    const cls = classrooms.find(c => c.id === classroomId);
    const assignments = this.get('tps_classroom_assignments') || {};
    if (cls && Array.isArray(cls.student_ids) && cls.student_ids.length > 0) {
      return cls.student_ids;
    }
    return assignments[classroomId] || [];
  }

  async assignStudentsToClassroom(classroomId, studentIds) {
    const cleanIds = Array.isArray(studentIds) ? Array.from(new Set(studentIds)) : [];
    let classrooms = this.get('tps_classrooms') || [];
    const idx = classrooms.findIndex(c => c.id === classroomId);
    if (idx !== -1) {
      classrooms[idx].student_ids = cleanIds;
      this.set('tps_classrooms', classrooms);
    }
    const assignments = this.get('tps_classroom_assignments') || {};
    assignments[classroomId] = cleanIds;
    this.set('tps_classroom_assignments', assignments);

    if (supabase) {
      try {
        await supabase.from('classrooms').update({
          updated_at: new Date().toISOString()
        }).eq('id', classroomId);
      } catch (err) {
        console.warn('Supabase assignStudentsToClassroom sync warning:', err);
      }
    }

    this.logAudit('ASSIGN_CLASSROOM_STUDENTS', 'classrooms', classroomId, `Assigned ${cleanIds.length} students to classroom`);
    return cleanIds;
  }

  // --- ATTENDANCE ---
  async getAttendanceRecords() {
    await this.pullCloudKeys(['tps_attendance']);
    return this.get('tps_attendance') || [];
  }

  async getTeacherAttendanceRecords() {
    await this.pullCloudKeys(['tps_teacher_attendance']);
    return this.get('tps_teacher_attendance') || [];
  }

  async unlockAttendanceWindow(classroomId, date = new Date().toISOString().split('T')[0]) {
    const unlocks = this.get('tps_attendance_unlocks') || [];
    const key = `${classroomId}_${date}`;
    if (!unlocks.includes(key)) {
      unlocks.push(key);
      this.set('tps_attendance_unlocks', unlocks);
      this.logAudit('UNLOCK_ATTENDANCE_WINDOW', 'classrooms', classroomId, `Admin unlocked late attendance window for ${date}`);
    }
    return true;
  }

  async unlockAttendanceWindows(classroomId, dates = []) {
    if (!Array.isArray(dates) || dates.length === 0) return true;
    let unlocks = this.get('tps_attendance_unlocks') || [];
    let added = 0;
    dates.forEach(d => {
      const key = `${classroomId}_${d}`;
      if (!unlocks.includes(key)) {
        unlocks.push(key);
        added++;
      }
    });
    if (added > 0) {
      this.set('tps_attendance_unlocks', unlocks);
      this.logAudit('UNLOCK_ATTENDANCE_WINDOWS_BULK', 'classrooms', classroomId, `Admin bulk unlocked ${added} missed attendance sessions`);
    }
    return true;
  }

  async lockAttendanceWindow(classroomId, date = new Date().toISOString().split('T')[0]) {
    let unlocks = this.get('tps_attendance_unlocks') || [];
    const key = `${classroomId}_${date}`;
    unlocks = unlocks.filter(k => k !== key);
    this.set('tps_attendance_unlocks', unlocks);
    this.logAudit('LOCK_ATTENDANCE_WINDOW', 'classrooms', classroomId, `Admin closed/locked late attendance window for ${date}`);
    return true;
  }

  async lockAttendanceWindows(classroomId, dates = []) {
    if (!Array.isArray(dates) || dates.length === 0) return true;
    let unlocks = this.get('tps_attendance_unlocks') || [];
    const keysToRemove = new Set(dates.map(d => `${classroomId}_${d}`));
    const initialLen = unlocks.length;
    unlocks = unlocks.filter(k => !keysToRemove.has(k));
    if (unlocks.length !== initialLen) {
      this.set('tps_attendance_unlocks', unlocks);
      this.logAudit('LOCK_ATTENDANCE_WINDOWS_BULK', 'classrooms', classroomId, `Admin bulk locked ${initialLen - unlocks.length} attendance sessions`);
    }
    return true;
  }

  async isAttendanceWindowUnlocked(classroomId, date = new Date().toISOString().split('T')[0]) {
    await this.pullCloudKeys(['tps_attendance_unlocks']);
    const unlocks = this.get('tps_attendance_unlocks') || [];
    return unlocks.includes(`${classroomId}_${date}`);
  }

  async getAttendanceUnlocks() {
    await this.pullCloudKeys(['tps_attendance_unlocks']);
    return this.get('tps_attendance_unlocks') || [];
  }

  async saveAttendanceSession({ program_id, classroom_id, session_date, teacher_id, records, teacher_name, recorded_at }) {
    const attendance = this.get('tps_attendance') || [];
    const nowIso = recorded_at || new Date().toISOString();

    // Check if an attendance session already exists for this classroom and date (Editing scenario)
    const existingIndex = attendance.findIndex(s => s.classroom_id === classroom_id && s.session_date === session_date);

    let targetSession;
    if (existingIndex >= 0) {
      // Update existing session
      const prev = attendance[existingIndex];
      targetSession = {
        ...prev,
        program_id: program_id || prev.program_id,
        teacher_id: teacher_id || prev.teacher_id,
        teacher_name: teacher_name || prev.teacher_name,
        records: records || prev.records,
        recorded_at: nowIso,
        updated_at: nowIso,
        // Track students who were initially marked absent
        initial_absent_ids: prev.initial_absent_ids || prev.records?.filter(r => r.status === 'Absent').map(r => r.student_id) || []
      };
      attendance[existingIndex] = targetSession;
    } else {
      // Create new session
      const sessionId = 'sess-' + Date.now();
      const initialAbsentIds = (records || []).filter(r => r.status === 'Absent').map(r => r.student_id);
      targetSession = {
        id: sessionId,
        program_id,
        classroom_id,
        session_date,
        teacher_id,
        teacher_name: teacher_name || '',
        recorded_at: nowIso,
        created_at: nowIso,
        initial_absent_ids: initialAbsentIds,
        records: records || []
      };
      attendance.push(targetSession);
    }
    this.set('tps_attendance', attendance);

    // Automatically record or update teacher's duty attendance
    if (teacher_id) {
      const teacherAttendance = this.get('tps_teacher_attendance') || [];
      const classrooms = this.get('tps_classrooms') || [];
      const cls = classrooms.find(c => c.id === classroom_id);

      const existingTeacherLogIndex = teacherAttendance.findIndex(t => 
        (t.session_id === targetSession.id) || 
        (t.classroom_id === classroom_id && t.session_date === session_date && t.teacher_id === teacher_id)
      );

      const logData = {
        session_id: targetSession.id,
        teacher_id,
        teacher_name: teacher_name || '',
        classroom_id,
        classroom_name: cls?.name || '',
        program_id,
        session_date,
        recorded_at: nowIso,
        status: 'Present',
        notes: `Recorded attendance for ${records?.length || 0} students`
      };

      if (existingTeacherLogIndex >= 0) {
        teacherAttendance[existingTeacherLogIndex] = {
          ...teacherAttendance[existingTeacherLogIndex],
          ...logData
        };
      } else {
        teacherAttendance.push({
          id: 't-att-' + Date.now(),
          ...logData
        });
      }
      this.set('tps_teacher_attendance', teacherAttendance);
    }

    this.logAudit('SUBMIT_ATTENDANCE', 'attendance_sessions', targetSession.id, `Attendance ${existingIndex >= 0 ? 'updated' : 'submitted'} for ${session_date} at ${nowIso}`);
    return targetSession;
  }

  // --- HOSTEL LEAVES & RETURNS ---
  async getLeaves(force = false) {
    await this.pullCloudKeys(['tps_leaves'], force);
    return this.get('tps_leaves') || [];
  }

  calculateReturnLate(expectedDateStr, expectedTimeStr, actualDateStr, actualTimeStr, fineRate = 50, rateType = 'daily') {
    if (!expectedDateStr || !actualDateStr) return { lateHours: 0, lateDays: 0, fineAmount: 0, blackMarks: 0 };
    const expDate = new Date(expectedDateStr + 'T00:00:00');
    const actDate = new Date(actualDateStr + 'T00:00:00');
    const diffTime = actDate.getTime() - expDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Full timestamp comparison for precise hourly calculation
    const expTime = (expectedTimeStr && expectedTimeStr.length === 5) ? `${expectedTimeStr}:00` : (expectedTimeStr || '18:00:00');
    const actTime = (actualTimeStr && actualTimeStr.length === 5) ? `${actualTimeStr}:00` : (actualTimeStr || '18:00:00');
    const expFull = new Date(`${expectedDateStr}T${expTime}`);
    const actFull = new Date(`${actualDateStr}T${actTime}`);
    const diffMs = actFull.getTime() - expFull.getTime();
    const lateHours = diffMs > 0 ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60))) : 0;

    let lateDays = 0;
    let fineAmount = 0.00;
    let blackMarks = 0;

    if (rateType === 'hour' || rateType === 'hourly') {
      if (diffMs > 0) {
        lateDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        fineAmount = lateHours * Number(fineRate);
        blackMarks = Math.min(3, Math.ceil(lateHours / 24));
      }
    } else {
      if (diffDays > 0) {
        lateDays = diffDays;
        fineAmount = lateDays * Number(fineRate);
        blackMarks = lateDays; // 1 black mark per late calendar day
      } else if (diffDays === 0) {
        if (actualTimeStr && expectedTimeStr && actualTimeStr > expectedTimeStr) {
          blackMarks = 1; // Late Mark for late return on scheduled date
        }
      }
    }

    return { lateHours, lateDays, fineAmount, blackMarks };
  }

  calculateHourlyLate(expectedDateStr, expectedTimeStr, actualDateStr = null, actualTimeStr = null, hourlyRate = 50) {
    if (!expectedDateStr) return { lateHours: 0, late_hours: 0, lateMinutes: 0, chargedHours: 0, lateDays: 0, fineAmount: 0, calculated_fine: 0, isOverdue: false, remainingHours: 0, remainingMinutes: 0 };
    const expTime = (expectedTimeStr && expectedTimeStr.length === 5) ? `${expectedTimeStr}:00` : (expectedTimeStr || '18:00:00');
    const expFull = new Date(`${expectedDateStr}T${expTime}`);
    const actFull = actualDateStr ? new Date(`${actualDateStr}T${(actualTimeStr && actualTimeStr.length === 5) ? `${actualTimeStr}:00` : (actualTimeStr || '18:00:00')}`) : new Date();

    if (actFull.getTime() > expFull.getTime()) {
      const diffMs = actFull.getTime() - expFull.getTime();
      const lateHours = Math.floor(diffMs / (1000 * 60 * 60));
      const lateMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const chargedHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      const fineAmount = chargedHours * Number(hourlyRate);
      return {
        lateHours,
        late_hours: lateHours,
        lateMinutes,
        chargedHours,
        lateDays: Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
        fineAmount,
        calculated_fine: fineAmount,
        isOverdue: true,
        remainingHours: 0,
        remainingMinutes: 0
      };
    } else {
      const diffMs = expFull.getTime() - actFull.getTime();
      const remainingHours = Math.floor(diffMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        lateHours: 0,
        late_hours: 0,
        lateMinutes: 0,
        chargedHours: 0,
        lateDays: 0,
        fineAmount: 0,
        calculated_fine: 0,
        isOverdue: false,
        remainingHours,
        remainingMinutes
      };
    }
  }

  async createLeaveRecord({
    student_ids,
    student_name = '',
    admission_number = '',
    leave_type,
    departure_date,
    departure_time,
    reason,
    expected_return_date,
    expected_return_time,
    fine_per_hour = 50,
    fine_per_day = null,
    fine_unit = null,
    escort_type = 'Parent / Guardian',
    parent_phone = '',
    requested_by = '',
    requester_role = '',
    status = null,
    approved_by = 'Warden Office'
  }) {
    const leaves = this.get('tps_leaves');
    const sIds = Array.isArray(student_ids) ? student_ids : [student_ids];
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100 + Math.random() * 900);
    const leaveCode = `LV-${year}-${randomSeq}`;
    const regNo = 'LR-2026-' + String(leaves.length + 1).padStart(3, '0');

    // Auto-resolve student name and admission number if not provided
    let sName = student_name;
    let sAdm = admission_number;
    if (!sName && sIds.length > 0) {
      const allStudents = this.get('tps_students') || [];
      const st = allStudents.find(s => s.id === sIds[0]);
      if (st) {
        sName = st.full_name;
        sAdm = st.admission_number;
      }
    }

    const effectiveStatus = status || (requester_role === 'parent' ? 'Pending' : 'Away');
    const effectiveUnit = fine_unit || (fine_per_day !== null ? 'daily' : 'hour');
    const effectiveHourlyFine = Number(fine_per_hour) || 50;
    const effectiveDailyFine = Number(fine_per_day) || (effectiveHourlyFine * 24);

    const studentEntries = sIds.map(sid => ({
      student_id: sid,
      is_returned: false,
      actual_return_date: null,
      actual_return_time: null,
      late_hours: 0,
      late_days: 0,
      fine_amount: 0,
      black_marks: 0,
      return_remarks: ''
    }));

    const primaryRec = {
      id: 'leave-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      leave_code: leaveCode,
      leave_register_number: regNo,
      leave_type: leave_type || 'hostel_leave',
      departure_date: departure_date || '',
      departure_time: departure_time || '16:00',
      leaving_date: departure_date || '',
      leaving_time: departure_time || '16:00',
      reason: reason || 'Hostel Leave',
      expected_return_date: expected_return_date || '',
      expected_return_time: expected_return_time || '18:00',
      fine_unit: effectiveUnit,
      fine_per_hour: effectiveHourlyFine,
      fine_per_hour_applied: effectiveHourlyFine,
      fine_per_day: effectiveDailyFine,
      fine_per_day_applied: effectiveDailyFine,
      escort_type: escort_type || 'Parent / Guardian',
      parent_phone: parent_phone || '',
      requested_by: requested_by || '',
      requester_role: requester_role || '',
      is_batch: sIds.length > 1,
      total_students: sIds.length,
      student_ids: sIds,
      student_id: sIds[0], // backward compatibility
      student_name: sName,
      admission_number: sAdm,
      students: studentEntries,
      actual_return_date: null,
      actual_return_time: null,
      status: effectiveStatus,
      late_hours: 0,
      late_days: 0,
      calculated_fine: 0,
      adjusted_fine: 0,
      fine_status: 'no_fine',
      approved_by: effectiveStatus === 'Pending' ? 'Awaiting Approval' : approved_by,
      created_at: new Date().toISOString()
    };

    // If already active/away, update each student status to On Approved Leave
    if (effectiveStatus !== 'Pending') {
      for (const sid of sIds) {
        await this.updateStudent(sid, { status: 'On Approved Leave' });
      }
    }

    leaves.unshift(primaryRec);
    this.set('tps_leaves', leaves);
    this.logAudit('CREATE_LEAVE', 'student_leave_records', primaryRec.id, `Created leave ${leaveCode} for ${sIds.length} student(s) [${effectiveStatus}]`);
    return [primaryRec];
  }

  async approveLeaveRecord(leave_id, { approved_by = 'Hostel Warden', fine_per_hour = 50 } = {}) {
    const leaves = this.get('tps_leaves');
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    leave.status = 'Approved';
    leave.approved_by = approved_by || 'Hostel Warden';
    leave.approved_at = new Date().toISOString();
    leave.fine_unit = 'hour';
    leave.fine_per_hour = Number(fine_per_hour) || 50;
    leave.fine_per_hour_applied = Number(fine_per_hour) || 50;
    leave.fine_per_day = (Number(fine_per_hour) || 50) * 24;
    leave.fine_per_day_applied = (Number(fine_per_hour) || 50) * 24;

    const sIds = Array.isArray(leave.student_ids) ? leave.student_ids : [leave.student_id];
    for (const sid of sIds) {
      await this.updateStudent(sid, { status: 'On Approved Leave' });
    }

    this.set('tps_leaves', leaves);
    this.logAudit('APPROVE_LEAVE', 'student_leave_records', leave_id, `Leave ${leave.leave_code} approved by ${approved_by} at ₹${fine_per_hour}/hr fine rate`);
    return leave;
  }

  async rejectLeaveRecord(leave_id, { rejected_by = 'Hostel Warden', reason = 'Administrative grounds' } = {}) {
    const leaves = this.get('tps_leaves');
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    leave.status = 'Rejected';
    leave.rejected_by = rejected_by || 'Hostel Warden';
    leave.rejected_reason = reason;
    this.set('tps_leaves', leaves);
    this.logAudit('REJECT_LEAVE', 'student_leave_records', leave_id, `Leave ${leave.leave_code} rejected by ${rejected_by}`);
    return leave;
  }

  async recordReturn(leave_record_id, actual_return_date, actual_return_time, remarks = '') {
    const leaves = this.get('tps_leaves');
    const idx = leaves.findIndex(l => l.id === leave_record_id || l.leave_code === leave_record_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    const isHourly = leave.fine_unit === 'hour';
    const rate = isHourly
      ? (leave.fine_per_hour_applied || leave.fine_per_hour || 50)
      : (leave.fine_per_day_applied || leave.fine_per_day || 100);

    const calc = this.calculateReturnLate(
      leave.expected_return_date,
      leave.expected_return_time || '17:00',
      actual_return_date,
      actual_return_time || '17:00',
      rate,
      isHourly ? 'hour' : 'daily'
    );

    leave.actual_return_date = actual_return_date;
    leave.actual_return_time = actual_return_time;
    leave.late_hours = calc.lateHours;
    leave.late_days = calc.lateDays;
    leave.calculated_fine = calc.fineAmount;
    leave.adjusted_fine = calc.fineAmount;
    leave.fine_status = calc.fineAmount > 0 ? 'unpaid' : 'no_fine';
    leave.status = 'Returned';
    leave.remarks = remarks;

    if (Array.isArray(leave.students)) {
      leave.students.forEach(s => {
        s.is_returned = true;
        s.actual_return_date = actual_return_date;
        s.actual_return_time = actual_return_time;
        s.late_hours = calc.lateHours;
        s.late_days = calc.lateDays;
        s.fine_amount = calc.fineAmount;
        s.black_marks = calc.blackMarks;
        s.return_remarks = remarks;
      });
    }

    // Reactivate all students on this leave
    const sIds = Array.isArray(leave.student_ids) && leave.student_ids.length > 0
      ? leave.student_ids
      : [leave.student_id];

    for (const sid of sIds) {
      if (sid) {
        await this.updateStudent(sid, { status: 'Active', hostel_status: 'resident' });

        // Record fine and black mark if late
        if (calc.fineAmount > 0) {
          const fnNo = `FN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          const fines = this.get('tps_fines') || [];
          fines.unshift({
            id: 'fine-' + Date.now() + Math.random().toString(36).substring(2, 5),
            fine_no: fnNo,
            student_id: sid,
            leave_id: leave.id,
            category_name: 'Late Hostel Return',
            amount: calc.fineAmount,
            late_days: calc.lateDays,
            black_marks: calc.blackMarks,
            reason: `${calc.lateDays} days late return from approved hostel leave (${leave.leave_code || leave.leave_register_number})`,
            issue_date: actual_return_date,
            status: 'pending',
            issued_by: 'Warden Office'
          });
          this.set('tps_fines', fines);
        }

        if (calc.blackMarks > 0) {
          const blackMarks = this.get('tps_black_marks') || [];
          blackMarks.unshift({
            id: 'bm-' + Date.now() + Math.random().toString(36).substring(2, 5),
            student_id: sid,
            leave_id: leave.id,
            marks_count: calc.blackMarks,
            reason: calc.lateDays > 0 ? `${calc.lateDays} days late return from hostel leave` : `Late return on scheduled date (${actual_return_time})`,
            issued_date: actual_return_date,
            issued_by: 'Warden Office'
          });
          this.set('tps_black_marks', blackMarks);
        }
      }
    }

    this.set('tps_leaves', leaves);
    this.logAudit('RECORD_RETURN', 'student_leave_records', leave_record_id, `Return recorded. Late days: ${calc.lateDays}, Fine: ₹${calc.fineAmount}`);
    return leave;
  }

  async recordBatchReturn({ leave_id, student_ids, actual_return_date, actual_return_time, remarks = '' }) {
    const leaves = this.get('tps_leaves');
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    const calc = this.calculateReturnLate(
      leave.expected_return_date,
      leave.expected_return_time || '17:00',
      actual_return_date,
      actual_return_time || '17:00',
      leave.fine_per_day_applied || leave.fine_per_day || 100
    );

    const targetIds = new Set(student_ids);

    if (Array.isArray(leave.students)) {
      leave.students.forEach(s => {
        if (targetIds.has(s.student_id)) {
          s.is_returned = true;
          s.actual_return_date = actual_return_date;
          s.actual_return_time = actual_return_time;
          s.late_days = calc.lateDays;
          s.fine_amount = calc.fineAmount;
          s.black_marks = calc.blackMarks;
          s.return_remarks = remarks;
        }
      });
    }

    // Check if all students in this leave pass have returned
    const allReturned = Array.isArray(leave.students) ? leave.students.every(s => s.is_returned) : true;
    if (allReturned) {
      leave.status = 'Returned';
      leave.actual_return_date = actual_return_date;
      leave.actual_return_time = actual_return_time;
    }

    // Reactivate returning students
    for (const sid of student_ids) {
      await this.updateStudent(sid, { status: 'Active', hostel_status: 'resident' });

      if (calc.fineAmount > 0) {
        const fnNo = `FN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const fines = this.get('tps_fines') || [];
        fines.unshift({
          id: 'fine-' + Date.now() + Math.random().toString(36).substring(2, 5),
          fine_no: fnNo,
          student_id: sid,
          leave_id: leave.id,
          category_name: 'Late Hostel Return',
          amount: calc.fineAmount,
          late_days: calc.lateDays,
          black_marks: calc.blackMarks,
          reason: `${calc.lateDays} days late return from batch leave (${leave.leave_code || leave.leave_register_number})`,
          issue_date: actual_return_date,
          status: 'pending',
          issued_by: 'Warden Office'
        });
        this.set('tps_fines', fines);
      }

      if (calc.blackMarks > 0) {
        const blackMarks = this.get('tps_black_marks') || [];
        blackMarks.unshift({
          id: 'bm-' + Date.now() + Math.random().toString(36).substring(2, 5),
          student_id: sid,
          leave_id: leave.id,
          marks_count: calc.blackMarks,
          reason: calc.lateDays > 0 ? `${calc.lateDays} days late return` : `Late return on scheduled date (${actual_return_time})`,
          issued_date: actual_return_date,
          issued_by: 'Warden Office'
        });
        this.set('tps_black_marks', blackMarks);
      }
    }

    this.set('tps_leaves', leaves);
    this.logAudit('RECORD_BATCH_RETURN', 'student_leave_records', leave_id, `Batch return recorded for ${student_ids.length} student(s)`);
    return leave;
  }

  // --- HOSTEL & BED ALLOCATION ENGINE ---
  getHostels() {
    return [
      {
        id: 'h-boys',
        name: 'Thaiba Boys Hostel Campus',
        code: 'BH-01',
        gender: 'boys',
        building: 'Block A (Al-Farooq Block)',
        warden_name: 'Usthad Abdullah K.',
        warden_phone: '+91 98765 43210',
        capacity: 48,
        status: 'active'
      },
      {
        id: 'h-girls',
        name: 'Thaiba Girls Hostel Campus',
        code: 'GH-01',
        gender: 'girls',
        building: 'Block B (Khadija Block)',
        warden_name: 'Usthaza Fatima M.',
        warden_phone: '+91 98765 43211',
        capacity: 32,
        status: 'active'
      }
    ];
  }

  getHostelRooms(hostelId = null) {
    let rooms = this.get('tps_hostel_rooms');
    if (!rooms || rooms.length === 0) {
      rooms = [
        { id: 'room-101', hostel_id: 'h-boys', floor: 'Ground Floor', room_number: '101', capacity: 8, room_type: '8-Bed Dormitory', status: 'active' },
        { id: 'room-102', hostel_id: 'h-boys', floor: 'Ground Floor', room_number: '102', capacity: 8, room_type: '8-Bed Dormitory', status: 'active' },
        { id: 'room-201', hostel_id: 'h-boys', floor: 'First Floor', room_number: '201', capacity: 8, room_type: '8-Bed Dormitory', status: 'active' },
        { id: 'room-202', hostel_id: 'h-boys', floor: 'First Floor', room_number: '202', capacity: 8, room_type: '8-Bed Dormitory', status: 'active' },
        { id: 'room-g101', hostel_id: 'h-girls', floor: 'Ground Floor', room_number: 'G-101', capacity: 8, room_type: 'Girls 8-Bed Dormitory', status: 'active' },
        { id: 'room-g102', hostel_id: 'h-girls', floor: 'Ground Floor', room_number: 'G-102', capacity: 8, room_type: 'Girls 8-Bed Dormitory', status: 'active' }
      ];
      this.set('tps_hostel_rooms', rooms);
    }
    return hostelId ? rooms.filter(r => r.hostel_id === hostelId) : rooms;
  }

  getHostelBeds(roomId = null) {
    let beds = this.get('tps_hostel_beds');
    if (!beds || beds.length === 0) {
      const rooms = this.getHostelRooms();
      const students = this.get('tps_students');
      beds = [];

      for (const r of rooms) {
        for (let i = 1; i <= 8; i++) {
          const bedNum = `Bed ${i}`;
          const side = i <= 5 ? 'Left Side' : 'Window Side';
          const assignedStudent = students.find(s => 
            s.hostel_room === r.room_number && (s.hostel_bed === bedNum || s.hostel_bed === `Bed ${i}`)
          );

          beds.push({
            id: `bed-${r.room_number.toLowerCase()}-${i}`,
            room_id: r.id,
            bed_number: bedNum,
            side,
            status: assignedStudent ? 'occupied' : 'available',
            current_student_id: assignedStudent ? assignedStudent.id : null
          });
        }
      }
      this.set('tps_hostel_beds', beds);
    }
    return roomId ? beds.filter(b => b.room_id === roomId) : beds;
  }

  async getHostelStats() {
    const hostels = this.getHostels();
    const rooms = this.getHostelRooms();
    const beds = this.getHostelBeds();
    const students = await this.getStudents();
    const leaves = await this.getLeaves();

    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    const availableBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const awayStudents = students.filter(s => s.status === 'On Approved Leave').length;
    const presentStudents = Math.max(0, students.length - awayStudents);

    return {
      hostels,
      rooms,
      beds,
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyRate,
      totalStudents: students.length,
      presentStudents,
      awayStudents
    };
  }

  async assignStudentToBed(bedId, studentId) {
    const beds = this.getHostelBeds();
    const targetBed = beds.find(b => b.id === bedId);
    if (!targetBed) throw new Error('Target bed space not found.');

    const rooms = this.getHostelRooms();
    const room = rooms.find(r => r.id === targetBed.room_id);
    if (!room) throw new Error('Room not found for bed.');

    const hostels = this.getHostels();
    const hostel = hostels.find(h => h.id === room.hostel_id) || { name: 'Thaiba Boys Hostel' };
    const student = await this.getStudentById(studentId);
    if (!student) throw new Error('Student not found.');

    // 1. If target bed was previously occupied by someone else, vacate that previous student
    if (targetBed.current_student_id && targetBed.current_student_id !== studentId) {
      await this.updateStudent(targetBed.current_student_id, {
        hostel_bed: '',
        bed_id: null
      });
    }

    // 2. If student had another bed previously, free old bed
    const oldBed = beds.find(b => b.current_student_id === studentId && b.id !== bedId);
    if (oldBed) {
      oldBed.status = 'available';
      oldBed.current_student_id = null;
    }

    // 3. Occupy target bed
    targetBed.status = 'occupied';
    targetBed.current_student_id = studentId;
    this.set('tps_hostel_beds', beds);

    // 4. Update student profile
    await this.updateStudent(studentId, {
      hostel_unit: hostel.name,
      hostel_room: room.room_number,
      hostel_bed: targetBed.bed_number,
      room_id: room.id,
      bed_id: bedId
    });

    this.logAudit('ASSIGN_BED', 'hostel_beds', bedId, `Assigned ${student.full_name} to Room ${room.room_number} ${targetBed.bed_number}`);
    return { success: true, bed: targetBed, room, student };
  }

  async vacateBed(bedId) {
    const beds = this.getHostelBeds();
    const bed = beds.find(b => b.id === bedId);
    if (!bed) throw new Error('Bed space not found.');

    if (bed.current_student_id) {
      await this.updateStudent(bed.current_student_id, {
        hostel_bed: '',
        bed_id: null
      });
    }

    bed.status = 'available';
    bed.current_student_id = null;
    this.set('tps_hostel_beds', beds);

    this.logAudit('VACATE_BED', 'hostel_beds', bedId, `Vacated ${bed.bed_number}`);
    return { success: true };
  }

  async createRoom({ room_number, floor, hostel_id, capacity = 8, room_type }) {
    const rooms = this.getHostelRooms();
    const newRoom = {
      id: 'room-' + Date.now(),
      hostel_id: hostel_id || 'h-boys',
      floor: floor || 'Ground Floor',
      room_number,
      capacity: Number(capacity) || 8,
      room_type: room_type || '8-Bed Dormitory',
      status: 'active'
    };
    rooms.push(newRoom);
    this.set('tps_hostel_rooms', rooms);

    // Generate initial beds for this room
    const beds = this.getHostelBeds();
    for (let i = 1; i <= newRoom.capacity; i++) {
      beds.push({
        id: `bed-${newRoom.room_number.toLowerCase()}-${i}-${Date.now()}`,
        room_id: newRoom.id,
        bed_number: `Bed ${i}`,
        side: i <= 5 ? 'Left Side' : 'Window Side',
        status: 'available',
        current_student_id: null
      });
    }
    this.set('tps_hostel_beds', beds);
    return newRoom;
  }

  async deleteRoom(roomId) {
    const rooms = this.getHostelRooms();
    const filtered = rooms.filter(r => r.id !== roomId);
    this.set('tps_hostel_rooms', filtered);

    // Free all beds
    const beds = this.getHostelBeds();
    const remainingBeds = beds.filter(b => b.room_id !== roomId);
    this.set('tps_hostel_beds', remainingBeds);
    return true;
  }

  // --- FINES & BLACK MARKS ---
  async getFines() {
    return this.get('tps_fines') || [];
  }

  async markFinePaid(fineId, paidDate, receivedBy) {
    const fines = this.get('tps_fines') || [];
    const idx = fines.findIndex(f => f.id === fineId || f.fine_no === fineId);
    if (idx >= 0) {
      fines[idx].status = 'paid';
      fines[idx].paid_date = paidDate || new Date().toISOString().split('T')[0];
      fines[idx].received_by = receivedBy || 'Accounts / Warden';
      this.set('tps_fines', fines);
      return fines[idx];
    }
    return null;
  }

  async getBlackMarks(studentId = null) {
    const marks = this.get('tps_black_marks') || [];
    return studentId ? marks.filter(m => m.student_id === studentId) : marks;
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

    // Auto-create fine record if monetary fine was assessed
    if (newInc.monetary_fine > 0) {
      const fines = this.get('tps_fines') || [];
      const fnNo = `FN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      fines.unshift({
        id: 'fine-' + Date.now() + Math.random().toString(36).substring(2, 5),
        fine_no: fnNo,
        student_id,
        incident_id: newInc.id,
        category_name: category || 'Disciplinary Violation',
        amount: newInc.monetary_fine,
        late_days: 0,
        black_marks: newInc.black_marks_awarded || 0,
        reason: `${category}: ${description}`,
        issue_date: newInc.incident_date,
        status: 'pending',
        issued_by: reported_by || 'Staff'
      });
      this.set('tps_fines', fines);
    }

    // Auto-create black mark entry in ledger
    if (newInc.black_marks_awarded > 0) {
      const blackMarks = this.get('tps_black_marks') || [];
      blackMarks.unshift({
        id: 'bm-' + Date.now() + Math.random().toString(36).substring(2, 5),
        student_id,
        incident_id: newInc.id,
        marks_count: newInc.black_marks_awarded,
        reason: `${category}: ${description}`,
        issued_date: newInc.incident_date,
        issued_by: reported_by || 'Staff'
      });
      this.set('tps_black_marks', blackMarks);
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
  async getUsers(force = false) {
    const now = Date.now();
    const TTL = 25000;
    if (!force && this._usersCache && (now - this._usersCacheTime < TTL)) {
      return this._usersCache;
    }
    if (!force && this._usersInFlightPromise) {
      return this._usersInFlightPromise;
    }

    let p = null;
    p = (async () => {
      try {
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
              this._usersCache = combined;
              this._usersCacheTime = Date.now();
              return combined;
            }
          } catch (err) {
            console.warn('Supabase get_manageable_users fallback:', err);
          }
        }
        const res = this.get('tps_users');
        this._usersCache = res;
        this._usersCacheTime = Date.now();
        return res;
      } finally {
        this._usersInFlightPromise = null;
      }
    })();

    this._usersInFlightPromise = p;
    Promise.resolve(p).then(() => {
      if (this._usersInFlightPromise === p) {
        this._usersInFlightPromise = null;
      }
    });

    return p;
  }

  async updateUserApproval(user_id, updates = {}) {
    const { approval_status, role, ...extra } = updates;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
    if (supabase && isUuid) {
      try {
        const { data, error } = await supabase.rpc('admin_set_user_approval', {
          target_user_id: user_id,
          new_approval_status: approval_status,
          new_role: role || null
        });
        if (extra && Object.keys(extra).length > 0) {
          try {
            // First attempt direct column update
            await supabase.from('profiles').update(extra).eq('id', user_id);
          } catch (e) {
            console.warn('Supabase profile direct fields update fallback:', e);
          }
          try {
            // Also store in metadata JSONB on profiles table to guarantee cross-device persistence
            const { data: prof } = await supabase.from('profiles').select('metadata').eq('id', user_id).maybeSingle();
            const prevMeta = prof?.metadata || {};
            await supabase.from('profiles').update({
              metadata: {
                ...prevMeta,
                ...extra
              }
            }).eq('id', user_id);
          } catch (e) {
            console.warn('Supabase profile metadata update error:', e);
          }
        }
        if (!error && data) {
          // Also sync locally
          const users = this.get('tps_users') || [];
          const idx = users.findIndex(u => u.id === user_id);
          if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            this.set('tps_users', users);
          }
          const assigned = extra.assigned_student_ids || extra.student_ids || extra.child_ids;
          if (assigned && Array.isArray(assigned)) {
            const pMap = this.get('tps_parent_assignments') || {};
            pMap[user_id] = assigned;
            if (updates.email) pMap[updates.email.toLowerCase()] = assigned;
            this.set('tps_parent_assignments', pMap);
          }
          this._usersCache = null;
          this._usersCacheTime = 0;
          this._usersInFlightPromise = null;
          this.logAudit('USER_APPROVAL_UPDATE', 'profiles', user_id, `Approval: ${approval_status}, Role: ${role || 'none'}`);
          return { ...data, ...extra };
        }
      } catch (err) {
        console.warn('Supabase admin_set_user_approval fallback:', err);
      }
    }

    const users = this.get('tps_users') || [];
    const idx = users.findIndex(u => u.id === user_id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updates };
      this.set('tps_users', users);
    }
    const assigned = extra.assigned_student_ids || extra.student_ids || extra.child_ids;
    if (assigned && Array.isArray(assigned)) {
      const pMap = this.get('tps_parent_assignments') || {};
      pMap[user_id] = assigned;
      if (updates.email) pMap[updates.email.toLowerCase()] = assigned;
      this.set('tps_parent_assignments', pMap);
    }
    this._usersCache = null;
    this._usersCacheTime = 0;
    this._usersInFlightPromise = null;
    this.logAudit('USER_APPROVAL_UPDATE', 'profiles', user_id, `Approval: ${approval_status}, Role: ${role}`);
    return idx >= 0 ? users[idx] : { id: user_id, ...updates };
  }

  async setParentAssignedStudents(user_id, student_ids = [], email = '') {
    const pMap = this.get('tps_parent_assignments') || {};
    pMap[user_id] = student_ids;
    if (email) pMap[email.toLowerCase()] = student_ids;
    this.set('tps_parent_assignments', pMap);

    // Keep tps_users up to date locally
    const users = this.get('tps_users') || [];
    const idx = users.findIndex(u => u.id === user_id || (email && (u.email || '').toLowerCase() === email.toLowerCase()));
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        assigned_student_ids: student_ids,
        student_ids,
        child_ids: student_ids
      };
      this.set('tps_users', users);
    }

    // Persist to profiles.metadata if Supabase is active
    if (supabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
      try {
        const { data: prof } = await supabase.from('profiles').select('metadata').eq('id', user_id).maybeSingle();
        const prevMeta = prof?.metadata || {};
        await supabase.from('profiles').update({
          metadata: {
            ...prevMeta,
            assigned_student_ids: student_ids,
            student_ids,
            child_ids: student_ids
          }
        }).eq('id', user_id);
      } catch (e) {
        console.warn('Supabase setParentAssignedStudents error:', e);
      }
    }
    return student_ids;
  }

  async getParentAssignedStudents(user_id, email = '') {
    await this.pullCloudKeys(['tps_parent_assignments']);
    const pMap = this.get('tps_parent_assignments') || {};
    if (user_id && pMap[user_id]) return pMap[user_id];
    if (email && pMap[email.toLowerCase()]) return pMap[email.toLowerCase()];
    return [];
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

  // --- ACADEMIC CALENDAR, WORKING DAYS & HOLIDAYS ---
  async getAcademicCalendar() {
    await this.pullCloudKeys(['tps_academic_calendar']);
    const cal = this.get('tps_academic_calendar');
    if (!cal || !cal.weekly_working_days) {
      return INITIAL_ACADEMIC_CALENDAR;
    }
    return cal;
  }

  async saveAcademicCalendar(calendarData) {
    this.set('tps_academic_calendar', calendarData);
    this.logAudit('UPDATE_ACADEMIC_CALENDAR', 'academic_calendar', 'cal', 'Updated institutional calendar, working days & holidays');
    return calendarData;
  }

  async addCalendarHoliday({ date, name, type = 'holiday', academic_year = '2026-2027' }) {
    const cal = await this.getAcademicCalendar();
    const events = Array.isArray(cal.events) ? [...cal.events] : [];
    const existingIdx = events.findIndex(e => e.date === date);
    const newEvent = {
      id: 'cal-' + Date.now(),
      date,
      name: name || 'Institutional Holiday',
      type: type || 'holiday'
    };
    if (existingIdx >= 0) {
      events[existingIdx] = newEvent;
    } else {
      events.push(newEvent);
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    const updated = {
      ...cal,
      events
    };
    await this.saveAcademicCalendar(updated);
    return updated;
  }

  async addCalendarHolidayRange({ startDate, endDate, name, type = 'holiday' }) {
    const cal = await this.getAcademicCalendar();
    const events = Array.isArray(cal.events) ? [...cal.events] : [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const cur = new Date(start);
    const rangeId = 'rng-' + Date.now();

    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const existingIdx = events.findIndex(e => e.date === dateStr);
      const isStart = dateStr === startDate;
      const isEnd = dateStr === endDate;
      const ev = {
        id: 'cal-' + Date.now() + '-' + dateStr,
        date: dateStr,
        name: name || 'Institutional Holiday',
        type: type || 'holiday',
        range_id: rangeId,
        is_range_start: isStart,
        is_range_end: isEnd
      };
      if (existingIdx >= 0) {
        events[existingIdx] = ev;
      } else {
        events.push(ev);
      }
      cur.setDate(cur.getDate() + 1);
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    const updated = {
      ...cal,
      events
    };
    await this.saveAcademicCalendar(updated);
    return updated;
  }

  async removeCalendarHoliday(eventIdOrDate) {
    const cal = await this.getAcademicCalendar();
    let events = cal.events || [];

    if (Array.isArray(eventIdOrDate)) {
      events = events.filter(e => !eventIdOrDate.includes(e.id) && !eventIdOrDate.includes(e.date) && !eventIdOrDate.includes(e.range_id));
    } else {
      const target = events.find(e => e.id === eventIdOrDate || e.date === eventIdOrDate || e.range_id === eventIdOrDate);
      if (target && target.range_id) {
        // If part of a multi-day range, remove all days in that range
        events = events.filter(e => e.range_id !== target.range_id);
      } else {
        events = events.filter(e => e.id !== eventIdOrDate && e.date !== eventIdOrDate && e.range_id !== eventIdOrDate);
      }
    }

    const updated = {
      ...cal,
      events
    };
    await this.saveAcademicCalendar(updated);
    return updated;
  }

  async updateWeeklyWorkingDays(days) {
    const cal = await this.getAcademicCalendar();
    const updated = {
      ...cal,
      weekly_working_days: Array.isArray(days) ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };
    await this.saveAcademicCalendar(updated);
    return updated;
  }

  isDateWorkingDay(dateStr, calendar = INITIAL_ACADEMIC_CALENDAR) {
    if (!dateStr) return false;
    const events = calendar?.events || [];
    const custom = events.find(e => e.date === dateStr);
    if (custom) {
      if (custom.type === 'holiday') return false;
      if (custom.type === 'working_day') return true;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayOfWeek = dayNames[d.getDay()];
      const workingDays = calendar?.weekly_working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return workingDays.includes(dayOfWeek);
    }
    return true;
  }

  getCalendarDayInfo(dateStr, calendar = INITIAL_ACADEMIC_CALENDAR) {
    if (!dateStr) return { isWorkingDay: false, isHoliday: false, isSpecialWorking: false, title: '', type: 'none' };
    const events = calendar?.events || [];
    const custom = events.find(e => e.date === dateStr);
    const isWork = this.isDateWorkingDay(dateStr, calendar);
    if (custom) {
      return {
        date: dateStr,
        isWorkingDay: isWork,
        isHoliday: custom.type === 'holiday',
        isSpecialWorking: custom.type === 'working_day',
        title: custom.name,
        type: custom.type
      };
    }
    const parts = dateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = dayNames[d.getDay()];
    const isWeekendOff = !(calendar?.weekly_working_days || []).includes(dayOfWeek);
    return {
      date: dateStr,
      isWorkingDay: isWork,
      isHoliday: isWeekendOff,
      isSpecialWorking: false,
      title: isWeekendOff ? `${dayOfWeek} Weekend Off` : 'Regular Working Day',
      type: isWeekendOff ? 'holiday' : 'working_day'
    };
  }

  // --- AUDIT LOGS ---
  async getAuditLogs() {
    return this.get('tps_audit');
  }
}

export const db = new DatabaseService();
