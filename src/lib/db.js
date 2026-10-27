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
  // Hostel Coaching
  { id: 'sec-hc1', program_id: 'prog-2', name: 'Boys Hostel Coaching 1', gender_eligibility: 'Boys' },
  { id: 'sec-hc2', program_id: 'prog-2', name: 'Boys Hostel Coaching 2', gender_eligibility: 'Boys' },
  { id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Hostel Coaching', gender_eligibility: 'Girls' },
  // School Coaching (Mixed)
  { id: 'sec-sc1', program_id: 'prog-3', name: 'School Coaching Class 1', gender_eligibility: 'Mixed' },
  { id: 'sec-sc2', program_id: 'prog-3', name: 'School Coaching Class 2', gender_eligibility: 'Mixed' },
  { id: 'sec-sc3', program_id: 'prog-3', name: 'School Coaching Class 3', gender_eligibility: 'Mixed' },
  { id: 'sec-sc4', program_id: 'prog-3', name: 'School Coaching Class 4', gender_eligibility: 'Mixed' },
  { id: 'sec-sc5', program_id: 'prog-3', name: 'School Coaching Class 5', gender_eligibility: 'Mixed' }
];

const INITIAL_CLASSROOMS = [
  { id: 'cls-1', section_id: 'sec-m1', program_id: 'prog-1', name: 'Moral Hall A1', start_time: '06:00', end_time: '07:00', room_number: '101', capacity: 35, gender_eligibility: 'Boys', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  { id: 'cls-2', section_id: 'sec-m2', program_id: 'prog-1', name: 'Moral Hall A2', start_time: '06:00', end_time: '07:00', room_number: '102', capacity: 35, gender_eligibility: 'Boys', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  { id: 'cls-3', section_id: 'sec-m3', program_id: 'prog-1', name: 'Girls Moral Hall G1', start_time: '06:00', end_time: '07:00', room_number: '201', capacity: 50, gender_eligibility: 'Girls', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  { id: 'cls-4', section_id: 'sec-hc1', program_id: 'prog-2', name: 'Hostel Study Lab 1', start_time: '19:30', end_time: '21:00', room_number: '105', capacity: 30, gender_eligibility: 'Boys', teacher_id: 'u-2', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { id: 'cls-5', section_id: 'sec-hc2', program_id: 'prog-2', name: 'Hostel Study Lab 2', start_time: '19:30', end_time: '21:00', room_number: '106', capacity: 30, gender_eligibility: 'Boys', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { id: 'cls-6', section_id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Coaching Hall', start_time: '19:30', end_time: '21:00', room_number: '205', capacity: 45, gender_eligibility: 'Girls', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { id: 'cls-7', section_id: 'sec-sc1', program_id: 'prog-3', name: 'Main Academic Lab 1', start_time: '16:30', end_time: '18:00', room_number: '301', capacity: 40, gender_eligibility: 'Mixed', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { id: 'cls-8', section_id: 'sec-sc2', program_id: 'prog-3', name: 'Main Academic Lab 2', start_time: '16:30', end_time: '18:00', room_number: '302', capacity: 40, gender_eligibility: 'Mixed', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }
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

    return finalStudents;
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
    return this.get('tps_sections') || [];
  }

  async getClassrooms() {
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

  async addClassroom({ program_id, section_id, name, start_time, end_time, room_number, capacity, gender_eligibility, teacher_id, days }) {
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
      days: Array.isArray(days) && days.length > 0 ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };
    classrooms.push(newCls);
    this.set('tps_classrooms', classrooms);

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

    const sanitized = { ...updates };
    if (sanitized.capacity !== undefined) {
      sanitized.capacity = sanitized.capacity ? Number(sanitized.capacity) : null;
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

  // --- CLASSROOM STUDENT ASSIGNMENTS ---
  async getClassroomStudents(classroomId) {
    const classrooms = this.get('tps_classrooms') || [];
    const cls = classrooms.find(c => c.id === classroomId);
    const assignments = this.get('tps_classroom_assignments') || {};
    if (cls && Array.isArray(cls.student_ids)) {
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

      // Update student status to On Approved Leave in database & local
      await this.updateStudent(sid, { status: 'On Approved Leave' });
    }

    leaves.push(...createdRecords);
    this.set('tps_leaves', leaves);
    this.logAudit('CREATE_LEAVE', 'student_leave_records', createdRecords[0]?.id, `Leave approved for ${createdRecords.length} student(s)`);
    return createdRecords;
  }

  async recordReturn(leave_record_id, actual_return_date, actual_return_time, remarks = '') {
    const leaves = this.get('tps_leaves');
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

    // Reactivate student hostel status in database & local
    await this.updateStudent(leave.student_id, { status: 'Active', hostel_status: 'resident' });

    this.set('tps_leaves', leaves);
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
