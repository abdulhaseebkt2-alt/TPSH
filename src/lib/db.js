import { supabase, isTestEnv } from './supabase.js';
import { calculateLateDays, calculateLateFine, normalizeClassPattern, compressImage, normalizeDate, normalizeGender, normalizeStatus, normalizeHostelStatus, isStudentActive, getTodayDateStr } from './utils.js';
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

const TEST_CLASSROOMS = [
  { id: 'cls-1', section_id: 'sec-m1', program_id: 'prog-1', name: 'Moral Hall A1', start_time: '06:00', end_time: '07:00', room_number: '101', capacity: 35, gender_eligibility: 'Boys', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-2', section_id: 'sec-m2', program_id: 'prog-1', name: 'Moral Hall A2', start_time: '06:00', end_time: '07:00', room_number: '102', capacity: 35, gender_eligibility: 'Boys', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-3', section_id: 'sec-m3', program_id: 'prog-1', name: 'Girls Moral Hall G1', start_time: '06:00', end_time: '07:00', room_number: '201', capacity: 50, gender_eligibility: 'Girls', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-4', section_id: 'sec-hc1', program_id: 'prog-2', name: 'Htl BB', start_time: '09:39', end_time: '22:07', room_number: '105', capacity: 30, gender_eligibility: 'Boys', teacher_id: 'u-2', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-5', section_id: 'sec-hc2', program_id: 'prog-2', name: 'Hostel Study Lab 2', start_time: '19:30', end_time: '21:00', room_number: '106', capacity: 30, gender_eligibility: 'Boys', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-6', section_id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Coaching Hall', start_time: '19:30', end_time: '21:00', room_number: '205', capacity: 45, gender_eligibility: 'Girls', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-9999', section_id: 'sec-hc4', program_id: 'prog-2', name: '9999', start_time: '19:30', end_time: '21:00', room_number: '101', capacity: 35, gender_eligibility: 'Mixed', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-7', section_id: 'sec-sc1', program_id: 'prog-3', name: 'Main Academic Lab 1', start_time: '16:30', end_time: '18:00', room_number: '301', capacity: 40, gender_eligibility: 'Mixed', teacher_id: 'u-2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: '2026-10-01', teacher_removed_date: null },
  { id: 'cls-8', section_id: 'sec-sc2', program_id: 'prog-3', name: 'Main Academic Lab 2', start_time: '16:30', end_time: '18:00', room_number: '302', capacity: 40, gender_eligibility: 'Mixed', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null }
];

const PROD_CLASSROOMS = [
  { id: 'cls-1', section_id: 'sec-m1', program_id: 'prog-1', name: 'Moral Hall A1', start_time: '06:00', end_time: '07:00', room_number: '101', capacity: 35, gender_eligibility: 'Boys', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-2', section_id: 'sec-m2', program_id: 'prog-1', name: 'Moral Hall A2', start_time: '06:00', end_time: '07:00', room_number: '102', capacity: 35, gender_eligibility: 'Boys', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-3', section_id: 'sec-m3', program_id: 'prog-1', name: 'Girls Moral Hall G1', start_time: '06:00', end_time: '07:00', room_number: '201', capacity: 50, gender_eligibility: 'Girls', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-4', section_id: 'sec-hc1', program_id: 'prog-2', name: 'Htl BB', start_time: '09:39', end_time: '22:07', room_number: '105', capacity: 30, gender_eligibility: 'Boys', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-5', section_id: 'sec-hc2', program_id: 'prog-2', name: 'Hostel Study Lab 2', start_time: '19:30', end_time: '21:00', room_number: '106', capacity: 30, gender_eligibility: 'Boys', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-6', section_id: 'sec-hc3', program_id: 'prog-2', name: 'Girls Coaching Hall', start_time: '19:30', end_time: '21:00', room_number: '205', capacity: 45, gender_eligibility: 'Girls', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-9999', section_id: 'sec-hc4', program_id: 'prog-2', name: '9999', start_time: '19:30', end_time: '21:00', room_number: '101', capacity: 35, gender_eligibility: 'Mixed', teacher_id: '', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-7', section_id: 'sec-sc1', program_id: 'prog-3', name: 'Main Academic Lab 1', start_time: '16:30', end_time: '18:00', room_number: '301', capacity: 40, gender_eligibility: 'Mixed', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null },
  { id: 'cls-8', section_id: 'sec-sc2', program_id: 'prog-3', name: 'Main Academic Lab 2', start_time: '16:30', end_time: '18:00', room_number: '302', capacity: 40, gender_eligibility: 'Mixed', teacher_id: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], teacher_assigned_date: null, teacher_removed_date: null }
];

const INITIAL_CLASSROOMS = isTestEnv ? TEST_CLASSROOMS : PROD_CLASSROOMS;

export function isDummyOrTestUser(u, strict = false) {
  if (!u) return true;
  if (isTestEnv && !strict) return false;
  const id = String(u.id || '').trim();
  const email = String(u.email || '').toLowerCase().trim();
  const name = String(u.full_name || '').toLowerCase().trim();

  // Explicit test / dummy user IDs
  const dummyUserIds = [
    'u-2', 'u-3', 'u-4', 'u-5', 'u-6', 'u-7', 'u-pending',
    'vu-abdurahiman', 'vu-sameer', '3ba0d909-6656-43eb-87fb-fe8e30088d55',
    'd0000000-0000-0000-0000-000000000007',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000008',
    'd0000000-0000-0000-0000-000000000009',
    'd0000000-0000-0000-0000-000000000010'
  ];
  if (dummyUserIds.includes(id)) return true;
  if (id.startsWith('d0000000-') && id !== 'd0000000-0000-0000-0000-000000000001') return true;

  // Explicit test / dummy emails
  const dummyEmails = [
    'applicant@gmail.com',
    'new_applicant@gmail.com',
    'tpsmoraledu@gmail.com',
    'teacher@thaibaschool.edu.in',
    'mentor@thaibaschool.edu.in',
    'parent@example.com',
    'driver@thaibaschool.edu.in',
    'abdurahiman@thaibaschool.edu.in',
    'girls_mentor@thaibaschool.edu.in',
    'student@thaibaschool.edu.in',
    'leader@thaibaschool.edu.in'
  ];
  if (dummyEmails.includes(email)) return true;
  if (email.startsWith('applicant@') || email.startsWith('new_applicant@')) return true;

  // Explicit test / dummy names
  if (['new applicant', 'tester teacher', 'test user', 'dummy user', 'sample user'].includes(name)) return true;
  if (name.includes('new applicant') || name.includes('tester teacher')) return true;

  return false;
}

export const INITIAL_TEACHER_ASSIGNMENTS = isTestEnv ? [
  { id: 'asg-1', classroom_id: 'cls-1', teacher_id: 'u-2', assigned_date: '2026-10-01', removed_date: null },
  { id: 'asg-2', classroom_id: 'cls-2', teacher_id: 'u-2', assigned_date: '2026-10-01', removed_date: null },
  { id: 'asg-4', classroom_id: 'cls-4', teacher_id: 'u-2', assigned_date: '2026-10-01', removed_date: null },
  { id: 'asg-7', classroom_id: 'cls-7', teacher_id: 'u-2', assigned_date: '2026-10-01', removed_date: null }
] : [];

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
    max_marks: 100,
    passing_marks: 40,
    theory_max: 80,
    practical_max: 20,
    is_published: true,
    published_at: '2026-10-18T10:00:00Z',
    publish_ranks: true,
    ranking_policy: 'standard',
    publish_until: '2026-12-31T23:59'
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
    { id: 'cal-7', date: '2026-11-05', name: 'Kerala Piravi / State Foundation', type: 'holiday' },
    { id: 'cal-8', date: '2026-11-14', name: 'Children\'s Day Celebration', type: 'event' }
  ]
};

export const INITIAL_FACULTY_LEAVES = isTestEnv ? [
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
] : [];

export const INITIAL_VEHICLES = [
  {
    "id": "veh-1",
    "vehicle_name": "Honda Unicorn",
    "reg_number": "WB 66 V 0909",
    "vehicle_type": "2 Wheeler",
    "current_odometer": 32609.3,
    "fallback_rate_per_km": 7.5,
    "buffer_percentage": 10,
    "status": "Available",
    "allow_instant_short_ride": true,
    "created_at": "2026-08-01T08:00:00.000Z"
  }
];

export const INITIAL_VEHICLE_DOCUMENTS = [
  {
    "id": "vdoc-1",
    "vehicle_id": "veh-1",
    "document_type": "Registration (RC)",
    "document_number": "WB66V0909-RC",
    "expiry_date": "2035-07-20",
    "notes": "Vehicle permanent registration certificate",
    "created_at": "2026-08-01T08:00:00.000Z"
  },
  {
    "id": "vdoc-2",
    "vehicle_id": "veh-1",
    "document_type": "Insurance Policy",
    "document_number": "INS-NEW-INDIA-909",
    "expiry_date": "2027-06-15",
    "notes": "Comprehensive two-wheeler insurance policy",
    "created_at": "2026-08-01T08:00:00.000Z"
  },
  {
    "id": "vdoc-3",
    "vehicle_id": "veh-1",
    "document_type": "Pollution (PUC)",
    "document_number": "PUC-WB-2026-909",
    "expiry_date": "2027-02-28",
    "notes": "PUC emission clearance certificate (₹80 recorded on 28.Aug)",
    "created_at": "2026-08-28T10:00:00.000Z"
  },
  {
    "id": "vdoc-4",
    "vehicle_id": "veh-1",
    "document_type": "Road Tax",
    "document_number": "TAX-WB-2026-909",
    "expiry_date": "2030-03-31",
    "notes": "One-time road tax paid",
    "created_at": "2026-08-01T08:00:00.000Z"
  }
];

export const INITIAL_VEHICLE_EXPENSES = [
  {
    "id": "vexp-unicorn-01",
    "vehicle_id": "veh-1",
    "expense_type": "Maintenance",
    "amount": 1480,
    "date": "2026-08-08",
    "fuel_liters": null,
    "odometer_at_expense": 30000,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Maintenance: Service. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-08T09:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-02",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 1000,
    "date": "2026-08-11",
    "fuel_liters": 8.85,
    "odometer_at_expense": 30230.1,
    "calculated_mileage_kmpl": null,
    "notes": "Initial baseline fuel refill ₹1000 (8.85 L @ ₹113/L). Logged by Abdul Haseeb.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-11T13:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-03",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 300,
    "date": "2026-08-14",
    "fuel_liters": 2.65,
    "odometer_at_expense": 30299,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹300 (2.65 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-14T18:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-04",
    "vehicle_id": "veh-1",
    "expense_type": "Maintenance",
    "amount": 2400,
    "date": "2026-08-17",
    "fuel_liters": null,
    "odometer_at_expense": 30299,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Maintenance: Service. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-17T22:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-05",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 300,
    "date": "2026-08-21",
    "fuel_liters": 2.65,
    "odometer_at_expense": 30367.9,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹300 (2.65 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-21T03:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-06",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 370,
    "date": "2026-08-24",
    "fuel_liters": 3.27,
    "odometer_at_expense": 30452.9,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹370 (3.27 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-24T07:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-07",
    "vehicle_id": "veh-1",
    "expense_type": "Toll/Tax",
    "amount": 80,
    "date": "2026-08-27",
    "fuel_liters": null,
    "odometer_at_expense": 30452.9,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Documentation: PUC. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-27T12:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-08",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 590,
    "date": "2026-08-30",
    "fuel_liters": 5.22,
    "odometer_at_expense": 30588.6,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹590 (5.22 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-08-30T16:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-09",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-09-02",
    "fuel_liters": 4.42,
    "odometer_at_expense": 30703.5,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-02T21:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-10",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 330,
    "date": "2026-09-06",
    "fuel_liters": 2.92,
    "odometer_at_expense": 30779.4,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹330 (2.92 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-06T01:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-11",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-09-09",
    "fuel_liters": 4.42,
    "odometer_at_expense": 30894.3,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-09T06:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-12",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 60,
    "date": "2026-09-12",
    "fuel_liters": 0.53,
    "odometer_at_expense": 30908.1,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹60 (0.53 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-12T10:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-13",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-09-15",
    "fuel_liters": 4.42,
    "odometer_at_expense": 31023,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-15T15:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-14",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-09-18",
    "fuel_liters": 4.42,
    "odometer_at_expense": 31137.9,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-18T19:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-15",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-09-22",
    "fuel_liters": 4.42,
    "odometer_at_expense": 31252.8,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-22T00:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-16",
    "vehicle_id": "veh-1",
    "expense_type": "Maintenance",
    "amount": 730,
    "date": "2026-09-25",
    "fuel_liters": null,
    "odometer_at_expense": 31252.8,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Maintenance: Periodic Service & Maintenance. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-25T04:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-17",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 1050,
    "date": "2026-09-28",
    "fuel_liters": 9.29,
    "odometer_at_expense": 31494.3,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹1050 (9.29 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-09-28T09:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-18",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 550,
    "date": "2026-10-01",
    "fuel_liters": 4.87,
    "odometer_at_expense": 31620.9,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹550 (4.87 L @ ₹113/L). Mileage: 26.00 km/L. Logged by Abdul Haseeb.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-01T13:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-19",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-10-04",
    "fuel_liters": 4.42,
    "odometer_at_expense": 31735.8,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by Abdul Haseeb.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-04T18:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-20",
    "vehicle_id": "veh-1",
    "expense_type": "Maintenance",
    "amount": 350,
    "date": "2026-10-07",
    "fuel_liters": null,
    "odometer_at_expense": 31735.8,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Maintenance: Periodic Service & Maintenance. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-07T22:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-21",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-10-11",
    "fuel_liters": 4.42,
    "odometer_at_expense": 31850.7,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-11T03:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-22",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-10-14",
    "fuel_liters": 4.42,
    "odometer_at_expense": 31965.6,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-14T07:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-23",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-10-17",
    "fuel_liters": 4.42,
    "odometer_at_expense": 32080.5,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-17T12:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-24",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 300,
    "date": "2026-10-20",
    "fuel_liters": 2.65,
    "odometer_at_expense": 32149.4,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹300 (2.65 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-20T16:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-25",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 1000,
    "date": "2026-10-23",
    "fuel_liters": 8.85,
    "odometer_at_expense": 32379.5,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹1000 (8.85 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-23T21:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-26",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-10-27",
    "fuel_liters": 4.42,
    "odometer_at_expense": 32494.4,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by Abdul Haseeb.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-27T01:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-27",
    "vehicle_id": "veh-1",
    "expense_type": "Maintenance",
    "amount": 1120,
    "date": "2026-10-30",
    "fuel_liters": null,
    "odometer_at_expense": 32494.4,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Maintenance: Periodic Service & Maintenance. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-10-30T06:00:00.000Z"
  },
  {
    "id": "vexp-unicorn-28",
    "vehicle_id": "veh-1",
    "expense_type": "Fuel",
    "amount": 500,
    "date": "2026-11-02",
    "fuel_liters": 4.42,
    "odometer_at_expense": 32609.3,
    "calculated_mileage_kmpl": 26,
    "notes": "Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-11-02T10:30:00.000Z"
  },
  {
    "id": "vexp-unicorn-29",
    "vehicle_id": "veh-1",
    "expense_type": "Maintenance",
    "amount": 400,
    "date": "2026-11-05",
    "fuel_liters": null,
    "odometer_at_expense": 32609.3,
    "calculated_mileage_kmpl": null,
    "notes": "Vehicle Maintenance: Periodic Service & Maintenance. Logged by Abdul Haseeb.",
    "logged_by": "Abdul Haseeb",
    "created_at": "2026-11-05T15:00:00.000Z"
  }
];

export const INITIAL_TRIP_LOGS = [
  {
    "id": "trip-unicorn-001",
    "trip_id": "TRIP-2026-001",
    "vehicle_id": "veh-1",
    "user_id": "vu-abdurahiman",
    "user_name": "Abdurahiman",
    "user_role": "teacher",
    "destination": "Official School Route & Local Commute",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-08-11T11:30:00.000Z",
    "end_time": "2026-08-11T13:30:00.000Z",
    "status": "Completed",
    "start_km": 30000,
    "end_km": 30230.1,
    "total_km": 230.1,
    "applied_rate_per_km": 7.55,
    "total_amount": 1737.26,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-08-11T11:30:00.000Z",
    "completed_at": "2026-08-11T13:30:00.000Z",
    "created_at": "2026-08-11T11:30:00.000Z"
  },
  {
    "id": "trip-unicorn-002",
    "trip_id": "TRIP-2026-002",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-08-14T16:00:00.000Z",
    "end_time": "2026-08-14T18:00:00.000Z",
    "status": "Completed",
    "start_km": 30230.1,
    "end_km": 30299,
    "total_km": 68.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 520.2,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-08-14T16:00:00.000Z",
    "completed_at": "2026-08-14T18:00:00.000Z",
    "created_at": "2026-08-14T16:00:00.000Z"
  },
  {
    "id": "trip-unicorn-003",
    "trip_id": "TRIP-2026-003",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-08-21T01:00:00.000Z",
    "end_time": "2026-08-21T03:00:00.000Z",
    "status": "Completed",
    "start_km": 30299,
    "end_km": 30367.9,
    "total_km": 68.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 520.2,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-08-21T01:00:00.000Z",
    "completed_at": "2026-08-21T03:00:00.000Z",
    "created_at": "2026-08-21T01:00:00.000Z"
  },
  {
    "id": "trip-unicorn-004",
    "trip_id": "TRIP-2026-004",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-08-24T05:30:00.000Z",
    "end_time": "2026-08-24T07:30:00.000Z",
    "status": "Completed",
    "start_km": 30367.9,
    "end_km": 30452.9,
    "total_km": 85,
    "applied_rate_per_km": 7.55,
    "total_amount": 641.75,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-08-24T05:30:00.000Z",
    "completed_at": "2026-08-24T07:30:00.000Z",
    "created_at": "2026-08-24T05:30:00.000Z"
  },
  {
    "id": "trip-unicorn-005",
    "trip_id": "TRIP-2026-005",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-08-30T14:30:00.000Z",
    "end_time": "2026-08-30T16:30:00.000Z",
    "status": "Completed",
    "start_km": 30452.9,
    "end_km": 30588.6,
    "total_km": 135.7,
    "applied_rate_per_km": 7.55,
    "total_amount": 1024.53,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-08-30T14:30:00.000Z",
    "completed_at": "2026-08-30T16:30:00.000Z",
    "created_at": "2026-08-30T14:30:00.000Z"
  },
  {
    "id": "trip-unicorn-006",
    "trip_id": "TRIP-2026-006",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-02T19:00:00.000Z",
    "end_time": "2026-09-02T21:00:00.000Z",
    "status": "Completed",
    "start_km": 30588.6,
    "end_km": 30703.5,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-02T19:00:00.000Z",
    "completed_at": "2026-09-02T21:00:00.000Z",
    "created_at": "2026-09-02T19:00:00.000Z"
  },
  {
    "id": "trip-unicorn-007",
    "trip_id": "TRIP-2026-007",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-05T23:30:00.000Z",
    "end_time": "2026-09-06T01:30:00.000Z",
    "status": "Completed",
    "start_km": 30703.5,
    "end_km": 30779.4,
    "total_km": 75.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 573.05,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-05T23:30:00.000Z",
    "completed_at": "2026-09-06T01:30:00.000Z",
    "created_at": "2026-09-05T23:30:00.000Z"
  },
  {
    "id": "trip-unicorn-008",
    "trip_id": "TRIP-2026-008",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-09T04:00:00.000Z",
    "end_time": "2026-09-09T06:00:00.000Z",
    "status": "Completed",
    "start_km": 30779.4,
    "end_km": 30894.3,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-09T04:00:00.000Z",
    "completed_at": "2026-09-09T06:00:00.000Z",
    "created_at": "2026-09-09T04:00:00.000Z"
  },
  {
    "id": "trip-unicorn-009",
    "trip_id": "TRIP-2026-009",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-12T08:30:00.000Z",
    "end_time": "2026-09-12T10:30:00.000Z",
    "status": "Completed",
    "start_km": 30894.3,
    "end_km": 30908.1,
    "total_km": 13.8,
    "applied_rate_per_km": 7.55,
    "total_amount": 104.19,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-12T08:30:00.000Z",
    "completed_at": "2026-09-12T10:30:00.000Z",
    "created_at": "2026-09-12T08:30:00.000Z"
  },
  {
    "id": "trip-unicorn-010",
    "trip_id": "TRIP-2026-010",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-15T13:00:00.000Z",
    "end_time": "2026-09-15T15:00:00.000Z",
    "status": "Completed",
    "start_km": 30908.1,
    "end_km": 31023,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-15T13:00:00.000Z",
    "completed_at": "2026-09-15T15:00:00.000Z",
    "created_at": "2026-09-15T13:00:00.000Z"
  },
  {
    "id": "trip-unicorn-011",
    "trip_id": "TRIP-2026-011",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-18T17:30:00.000Z",
    "end_time": "2026-09-18T19:30:00.000Z",
    "status": "Completed",
    "start_km": 31023,
    "end_km": 31137.9,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-18T17:30:00.000Z",
    "completed_at": "2026-09-18T19:30:00.000Z",
    "created_at": "2026-09-18T17:30:00.000Z"
  },
  {
    "id": "trip-unicorn-012",
    "trip_id": "TRIP-2026-012",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-21T22:00:00.000Z",
    "end_time": "2026-09-22T00:00:00.000Z",
    "status": "Completed",
    "start_km": 31137.9,
    "end_km": 31252.8,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-21T22:00:00.000Z",
    "completed_at": "2026-09-22T00:00:00.000Z",
    "created_at": "2026-09-21T22:00:00.000Z"
  },
  {
    "id": "trip-unicorn-013",
    "trip_id": "TRIP-2026-013",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-09-28T07:00:00.000Z",
    "end_time": "2026-09-28T09:00:00.000Z",
    "status": "Completed",
    "start_km": 31252.8,
    "end_km": 31494.3,
    "total_km": 241.5,
    "applied_rate_per_km": 7.55,
    "total_amount": 1823.33,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-09-28T07:00:00.000Z",
    "completed_at": "2026-09-28T09:00:00.000Z",
    "created_at": "2026-09-28T07:00:00.000Z"
  },
  {
    "id": "trip-unicorn-014",
    "trip_id": "TRIP-2026-014",
    "vehicle_id": "veh-1",
    "user_id": "vu-abdurahiman",
    "user_name": "Abdurahiman",
    "user_role": "teacher",
    "destination": "Official School Route & Local Commute",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-01T11:30:00.000Z",
    "end_time": "2026-10-01T13:30:00.000Z",
    "status": "Completed",
    "start_km": 31494.3,
    "end_km": 31620.9,
    "total_km": 126.6,
    "applied_rate_per_km": 7.55,
    "total_amount": 955.83,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-01T11:30:00.000Z",
    "completed_at": "2026-10-01T13:30:00.000Z",
    "created_at": "2026-10-01T11:30:00.000Z"
  },
  {
    "id": "trip-unicorn-015",
    "trip_id": "TRIP-2026-015",
    "vehicle_id": "veh-1",
    "user_id": "vu-abdurahiman",
    "user_name": "Abdurahiman",
    "user_role": "teacher",
    "destination": "Official School Route & Local Commute",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-04T16:00:00.000Z",
    "end_time": "2026-10-04T18:00:00.000Z",
    "status": "Completed",
    "start_km": 31620.9,
    "end_km": 31735.8,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-04T16:00:00.000Z",
    "completed_at": "2026-10-04T18:00:00.000Z",
    "created_at": "2026-10-04T16:00:00.000Z"
  },
  {
    "id": "trip-unicorn-016",
    "trip_id": "TRIP-2026-016",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-11T01:00:00.000Z",
    "end_time": "2026-10-11T03:00:00.000Z",
    "status": "Completed",
    "start_km": 31735.8,
    "end_km": 31850.7,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-11T01:00:00.000Z",
    "completed_at": "2026-10-11T03:00:00.000Z",
    "created_at": "2026-10-11T01:00:00.000Z"
  },
  {
    "id": "trip-unicorn-017",
    "trip_id": "TRIP-2026-017",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-14T05:30:00.000Z",
    "end_time": "2026-10-14T07:30:00.000Z",
    "status": "Completed",
    "start_km": 31850.7,
    "end_km": 31965.6,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-14T05:30:00.000Z",
    "completed_at": "2026-10-14T07:30:00.000Z",
    "created_at": "2026-10-14T05:30:00.000Z"
  },
  {
    "id": "trip-unicorn-018",
    "trip_id": "TRIP-2026-018",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-17T10:00:00.000Z",
    "end_time": "2026-10-17T12:00:00.000Z",
    "status": "Completed",
    "start_km": 31965.6,
    "end_km": 32080.5,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-17T10:00:00.000Z",
    "completed_at": "2026-10-17T12:00:00.000Z",
    "created_at": "2026-10-17T10:00:00.000Z"
  },
  {
    "id": "trip-unicorn-019",
    "trip_id": "TRIP-2026-019",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-20T14:30:00.000Z",
    "end_time": "2026-10-20T16:30:00.000Z",
    "status": "Completed",
    "start_km": 32080.5,
    "end_km": 32149.4,
    "total_km": 68.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 520.2,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-20T14:30:00.000Z",
    "completed_at": "2026-10-20T16:30:00.000Z",
    "created_at": "2026-10-20T14:30:00.000Z"
  },
  {
    "id": "trip-unicorn-020",
    "trip_id": "TRIP-2026-020",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-23T19:00:00.000Z",
    "end_time": "2026-10-23T21:00:00.000Z",
    "status": "Completed",
    "start_km": 32149.4,
    "end_km": 32379.5,
    "total_km": 230.1,
    "applied_rate_per_km": 7.55,
    "total_amount": 1737.26,
    "payment_status": "Paid",
    "payment_received_by": "Abdul Haseeb",
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-23T19:00:00.000Z",
    "completed_at": "2026-10-23T21:00:00.000Z",
    "created_at": "2026-10-23T19:00:00.000Z"
  },
  {
    "id": "trip-unicorn-021",
    "trip_id": "TRIP-2026-021",
    "vehicle_id": "veh-1",
    "user_id": "vu-abdurahiman",
    "user_name": "Abdurahiman",
    "user_role": "teacher",
    "destination": "Official School Route & Local Commute",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-10-26T23:30:00.000Z",
    "end_time": "2026-10-27T01:30:00.000Z",
    "status": "Completed",
    "start_km": 32379.5,
    "end_km": 32494.4,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Unpaid",
    "payment_received_by": null,
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-10-26T23:30:00.000Z",
    "completed_at": "2026-10-27T01:30:00.000Z",
    "created_at": "2026-10-26T23:30:00.000Z"
  },
  {
    "id": "trip-unicorn-022",
    "trip_id": "TRIP-2026-022",
    "vehicle_id": "veh-1",
    "user_id": "u-1",
    "user_name": "Abdul Haseeb",
    "user_role": "super_admin",
    "destination": "Local Campus & Educational Errands",
    "purpose": "Institutional & official operational journey",
    "start_time": "2026-11-02T08:30:00.000Z",
    "end_time": "2026-11-02T10:30:00.000Z",
    "status": "Completed",
    "start_km": 32494.4,
    "end_km": 32609.3,
    "total_km": 114.9,
    "applied_rate_per_km": 7.55,
    "total_amount": 867.5,
    "payment_status": "Unpaid",
    "payment_received_by": null,
    "rejection_reason": null,
    "approved_by": "Abdul Haseeb",
    "approved_at": "2026-11-02T08:30:00.000Z",
    "completed_at": "2026-11-02T10:30:00.000Z",
    "created_at": "2026-11-02T08:30:00.000Z"
  }
];

export const INITIAL_VEHICLE_PAYMENTS = [
  {
    "id": "vpay-unicorn-01",
    "trip_id": "trip-unicorn-001",
    "amount_paid": 500,
    "payment_method": "UPI / GPay",
    "payment_date": "2026-08-12T16:00:00.000Z",
    "received_by_admin_id": "u-1",
    "received_by_admin_name": "Abdul Haseeb",
    "notes": "UPI Ref: 429188201921 - Settled at school office",
    "created_at": "2026-08-12T16:00:00.000Z"
  }
];

export const INITIAL_VEHICLE_USERS = [
  {
    "id": "vu-abdurahiman",
    "full_name": "Abdurahiman",
    "phone": "+91 94471 88223",
    "email": "abdurahiman@thaibaschool.edu.in",
    "tps_id": "VUS001",
    "designation": "Faculty & Transport User",
    "status": "Active",
    "notes": "Authorized two-wheeler rider for Honda Unicorn WB 66 V 0909",
    "created_at": "2026-08-01T08:00:00.000Z"
  },
  {
    "id": "vu-sameer",
    "full_name": "Sameer Driver",
    "phone": "+91 98470 99887",
    "email": "driver@thaibaschool.edu.in",
    "tps_id": "VUS002",
    "designation": "Senior Campus Driver",
    "status": "Active",
    "notes": "Campus utility driver",
    "created_at": "2026-08-01T08:00:00.000Z"
  }
];

export const INITIAL_VEHICLE_DESTINATIONS = [
  {
    "id": "dest-1",
    "name": "DEO Office Manjeri",
    "standard_distance_km": 22,
    "description": "Education Department Official Transit (Round-trip benchmark: 22 KM)",
    "is_active": true
  },
  {
    "id": "dest-2",
    "name": "Calicut University Campus, Thenhipalam",
    "standard_distance_km": 30,
    "description": "University & Examination Transit (Round-trip benchmark: 30 KM)",
    "is_active": true
  },
  {
    "id": "dest-3",
    "name": "Kozhikode Railway Station",
    "standard_distance_km": 45,
    "description": "Official Travel & Guest Pickup (Round-trip benchmark: 45 KM)",
    "is_active": true
  },
  {
    "id": "dest-4",
    "name": "Kozhikode Medical College",
    "standard_distance_km": 42,
    "description": "Official Medical & Student Care (Round-trip benchmark: 42 KM)",
    "is_active": true
  },
  {
    "id": "dest-5",
    "name": "SBI Main Branch / Bank Errand",
    "standard_distance_km": 12,
    "description": "Campus treasury / banking work (Round trip benchmark: 12 KM)",
    "is_active": true
  },
  {
    "id": "dest-6",
    "name": "District Collectorate, Civil Station",
    "standard_distance_km": 28,
    "description": "Revenue & administrative paperwork (Round trip benchmark: 28 KM)",
    "is_active": true
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
    if (!this.getStorageItem('tps_discipline_fine_payments')) {
      this.setStorageItem('tps_discipline_fine_payments', JSON.stringify([]));
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
    // Auto-migrate or ensure real Honda Unicorn WB 66 V 0909 dataset
    const currentVehs = this.get('tps_vehicles') || [];
    if (!currentVehs.length || !currentVehs.some(v => v.reg_number === 'WB 66 V 0909')) {
      this.setStorageItem('tps_vehicles', JSON.stringify(INITIAL_VEHICLES));
      this.setStorageItem('tps_vehicle_documents', JSON.stringify(INITIAL_VEHICLE_DOCUMENTS));
      this.setStorageItem('tps_vehicle_expenses', JSON.stringify(INITIAL_VEHICLE_EXPENSES));
      this.setStorageItem('tps_trip_logs', JSON.stringify(INITIAL_TRIP_LOGS));
      this.setStorageItem('tps_vehicle_payments', JSON.stringify(INITIAL_VEHICLE_PAYMENTS));
      this.setStorageItem('tps_vehicle_users',
    'tps_rbac_matrix',
    'tps_user_custom_modules', JSON.stringify(INITIAL_VEHICLE_USERS));
    } else {
      if (!this.getStorageItem('tps_vehicle_documents')) {
        this.setStorageItem('tps_vehicle_documents', JSON.stringify(INITIAL_VEHICLE_DOCUMENTS));
      }
      if (!this.getStorageItem('tps_vehicle_expenses')) {
        this.setStorageItem('tps_vehicle_expenses', JSON.stringify(INITIAL_VEHICLE_EXPENSES));
      }
      if (!this.getStorageItem('tps_trip_logs')) {
        this.setStorageItem('tps_trip_logs', JSON.stringify(INITIAL_TRIP_LOGS));
      }
      if (!this.getStorageItem('tps_vehicle_payments')) {
        this.setStorageItem('tps_vehicle_payments', JSON.stringify(INITIAL_VEHICLE_PAYMENTS));
      }
      if (!this.getStorageItem('tps_vehicle_users')) {
        this.setStorageItem('tps_vehicle_users', JSON.stringify(INITIAL_VEHICLE_USERS));
      }
      if (!this.getStorageItem('tps_vehicle_destinations')) {
        this.setStorageItem('tps_vehicle_destinations', JSON.stringify(INITIAL_VEHICLE_DESTINATIONS));
      }
    }
    if (!this.getStorageItem('tps_users')) {
      const defaultUsers = isTestEnv ? [
        { id: 'u-1', email: 'abdulhaseebkt2@gmail.com', full_name: 'Abdul Haseeb', role: 'super_admin', approval_status: 'approved', is_super_admin: true },
        { id: 'u-2', email: 'teacher@thaibaschool.edu.in', full_name: 'Rashid Sir', role: 'teacher', approval_status: 'approved', is_super_admin: false },
        { id: 'u-3', email: 'mentor@thaibaschool.edu.in', full_name: 'Usthad Usman', role: 'boys_mentor', mentor_type: 'boys', gender: 'Boys', hostel_unit: 'Thaiba Boys Hostel Block A', approval_status: 'approved', is_super_admin: false },
        { id: 'u-4', email: 'parent@example.com', full_name: 'Ahmad K.T.', role: 'parent', approval_status: 'approved', is_super_admin: false },
        { id: 'u-5', email: 'applicant@gmail.com', full_name: 'New Applicant', role: null, approval_status: 'pending', is_super_admin: false },
        { id: 'u-6', email: 'girls_mentor@thaibaschool.edu.in', full_name: 'Usthada Mariyam', role: 'girls_mentor', mentor_type: 'girls', gender: 'Girls', hostel_unit: 'Thaiba Girls Hostel Campus', approval_status: 'approved', is_super_admin: false },
        { id: 'u-7', email: 'driver@thaibaschool.edu.in', full_name: 'Sameer Driver', role: 'vehicle_user', approval_status: 'approved', is_super_admin: false }
      ] : [
        { id: 'u-1', email: 'abdulhaseebkt2@gmail.com', full_name: 'Abdul Haseeb', role: 'super_admin', approval_status: 'approved', is_super_admin: true }
      ];
      this.setStorageItem('tps_users', JSON.stringify(defaultUsers));
    }

    // Purge dummy demo entries from client storage (teachers, admins, parents, mentors, students, drivers & dummy logs)
    if (!isTestEnv && !this.getStorageItem('tps_dummy_purged_v2026_rev3')) {
      try {
        // 1. Purge tps_users
        const rawUsers = this.get('tps_users') || [];
        if (Array.isArray(rawUsers)) {
          const cleanUsers = rawUsers.filter(u => {
            if (!u || !u.id) return false;
            if (isDummyOrTestUser(u, true)) return false;
            if (u.id === '28bb4935-b4f0-4657-942c-afc784dc68de' && !u.email) return false;
            return true;
          });
          this.setStorageItem('tps_users', JSON.stringify(cleanUsers.length > 0 ? cleanUsers : [
            { id: 'u-1', email: 'abdulhaseebkt2@gmail.com', full_name: 'Abdul Haseeb', role: 'super_admin', approval_status: 'approved', is_super_admin: true }
          ]));
        }
        this.setStorageItem('tps_dummy_purged_v2026_rev3', 'true');

        // 2. Purge tps_teacher_assignments
        const rawAsg = this.get('tps_teacher_assignments') || [];
        if (Array.isArray(rawAsg)) {
          const cleanAsg = rawAsg.filter(a => {
            if (!a) return false;
            if (['asg-1', 'asg-2', 'asg-4', 'asg-7'].includes(a.id)) return false;
            if (a.teacher_id === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || a.teacher_id === 'u-2') return false;
            return true;
          });
          this.setStorageItem('tps_teacher_assignments', JSON.stringify(cleanAsg));
        }

        // 3. Purge tps_attendance
        const rawAtt = this.get('tps_attendance') || [];
        if (Array.isArray(rawAtt)) {
          const cleanAtt = rawAtt.filter(a => {
            if (!a) return false;
            if (a.teacher_id === '3ba0d909-6656-43eb-87fb-fe8e30088d55' || a.teacher_id === 'd0000000-0000-0000-0000-000000000004' || a.teacher_id === 'u-2') return false;
            return true;
          });
          this.setStorageItem('tps_attendance', JSON.stringify(cleanAtt));
        }

        // 4. Purge tps_faculty_leaves
        const rawFl = this.get('tps_faculty_leaves') || [];
        if (Array.isArray(rawFl)) {
          const cleanFl = rawFl.filter(f => {
            if (!f) return false;
            if (f.id === 'fl-1' || f.faculty_id === 'u-2' || f.faculty_name === 'Rashid Sir') return false;
            return true;
          });
          this.setStorageItem('tps_faculty_leaves', JSON.stringify(cleanFl));
        }

        // 5. Restore vehicle trip logs if empty
        const currentTrips = this.get('tps_trip_logs') || [];
        if (!Array.isArray(currentTrips) || currentTrips.length === 0) {
          this.setStorageItem('tps_trip_logs', JSON.stringify(INITIAL_TRIP_LOGS));
          this.pushCloudKey('tps_trip_logs', INITIAL_TRIP_LOGS).catch(() => {});
        }

        // 6. Restore vehicle payments if empty
        const currentVp = this.get('tps_vehicle_payments') || [];
        if (!Array.isArray(currentVp) || currentVp.length === 0) {
          this.setStorageItem('tps_vehicle_payments', JSON.stringify(INITIAL_VEHICLE_PAYMENTS));
          this.pushCloudKey('tps_vehicle_payments', INITIAL_VEHICLE_PAYMENTS).catch(() => {});
        }

        // 7. Restore vehicle users if empty
        const currentVu = this.get('tps_vehicle_users') || [];
        if (!Array.isArray(currentVu) || currentVu.length === 0) {
          this.setStorageItem('tps_vehicle_users', JSON.stringify(INITIAL_VEHICLE_USERS));
          this.pushCloudKey('tps_vehicle_users', INITIAL_VEHICLE_USERS).catch(() => {});
        }

        this.setStorageItem('tps_dummy_purged_v2026', 'true');
        this._usersCache = null;
        this._usersCacheTime = 0;
        this._studentsCache = null;
        this._studentsCacheTime = 0;
      } catch (err) {
        console.warn('Dummy data purge error:', err);
      }
    }

    // Auto-restore and synchronize official preset destinations
    try {
      const rawDest = this.get('tps_vehicle_destinations') || [];
      if (!Array.isArray(rawDest) || rawDest.length === 0) {
        this.setStorageItem('tps_vehicle_destinations', JSON.stringify(INITIAL_VEHICLE_DESTINATIONS));
        this.pushCloudKey('tps_vehicle_destinations', INITIAL_VEHICLE_DESTINATIONS).catch(() => {});
      }
    } catch (e) {
      console.warn('Destination restore error:', e);
    }
  }

  get(key) {
    try {
      const item = this.getStorageItem(key);
      if (!item) {
        if (key === 'tps_parent_assignments' || key === 'tps_vehicle_head_assignments') return {};
        return [];
      }
      return JSON.parse(item);
    } catch {
      if (key === 'tps_parent_assignments' || key === 'tps_vehicle_head_assignments') return {};
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
      }).then(({ error }) => {
        if (error) console.warn('Supabase app_settings sync error for ' + key + ':', error);
      }).catch(e => console.warn('Supabase app_settings sync warning:', e));
    }
  }

  async pushCloudKey(key, val) {
    if (val === null || val === undefined) {
      this.removeStorageItem(key);
    } else if (typeof val === 'string') {
      this.setStorageItem(key, val);
    } else {
      this.set(key, val);
    }
    this._pulledKeysTime.set(key, Date.now());
    if (supabase && !isTestEnv) {
      try {
        const { error } = await supabase.from('app_settings').upsert({
          key,
          value: val,
          updated_at: new Date().toISOString()
        });
        if (error) {
          console.warn('Supabase pushCloudKey error for ' + key + ':', error);
        }
      } catch (err) {
        console.warn('Supabase pushCloudKey exception for ' + key + ':', err);
      }
    }
  }

  async pullCloudKeys(keys = [
    'tps_institution_logo',
    'tps_mobile_front_logo',
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
    'tps_parent_assignments',
    'tps_vehicle_head_assignments',
    'tps_vehicles',
    'tps_vehicle_documents',
    'tps_vehicle_expenses',
    'tps_trip_logs',
    'tps_vehicle_payments',
    'tps_vehicle_users',
    'tps_vehicle_destinations',
    'tps_rbac_matrix',
    'tps_user_custom_modules',
    'tps_exams',
    'tps_exam_subjects',
    'tps_marks',
    'tps_user_passwords'
  ], force = false) {
    if (!supabase || isTestEnv) return;

    // Strict multi-tenant isolation: check if current user is an administrator
    let isAdmin = false;
    try {
      const activeUserStr = this.getStorageItem('tps_current_user');
      if (activeUserStr) {
        const u = JSON.parse(activeUserStr);
        isAdmin = Boolean(u && (u.is_super_admin || u.role === 'super_admin' || u.role === 'admin'));
      }
    } catch {}

    // Non-admin roles (parents, students, teachers, drivers) are restricted strictly to public branding/calendar keys
    if (!isAdmin) {
      const permittedPublicKeys = new Set([
        'tps_institution_logo',
        'tps_mobile_front_logo',
        'tps_institution_settings',
        'tps_institution_info',
        'tps_current_academic_year',
        'tps_academic_calendar',
        'tps_theme_config',
        'tps_privacy_policy',
        'tps_terms_of_service'
      ]);
      keys = keys.filter(k => permittedPublicKeys.has(k));
      if (keys.length === 0) return;
    }

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
        let hasLogoUpdate = false;
        for (const row of data) {
          if (row.key && row.value !== undefined && row.value !== null) {
            let cleanVal = row.value;
            if (typeof cleanVal === 'string') {
              cleanVal = cleanVal.trim();
              while ((cleanVal.startsWith('"') && cleanVal.endsWith('"')) || (cleanVal.startsWith("'") && cleanVal.endsWith("'"))) {
                try {
                  const parsed = JSON.parse(cleanVal);
                  if (typeof parsed === 'string') cleanVal = parsed.trim();
                  else break;
                } catch {
                  cleanVal = cleanVal.slice(1, -1).trim();
                }
              }
              this.setStorageItem(row.key, cleanVal);
            } else {
              this.setStorageItem(row.key, JSON.stringify(cleanVal));
            }
            this._pulledKeysTime.set(row.key, Date.now());
            if (row.key === 'tps_institution_logo' || row.key === 'tps_mobile_front_logo') {
              hasLogoUpdate = true;
            }
          }
        }
        if (hasLogoUpdate && typeof window !== 'undefined' && typeof window.__applyInstitutionalAppIcon === 'function') {
          window.__applyInstitutionalAppIcon();
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

  // --- DPDP ACT 2023 COMPLIANCE & DATA GOVERNANCE ---
  async recordDpdpConsent({ userId, studentId = null, consentType = 'explicit_dpdp_s9', verificationMethod = 'admission_form', verifiedBy = 'admin', metadata = {} }) {
    const entry = {
      id: 'dpdp-' + Date.now(),
      user_id: userId,
      student_id: studentId,
      consent_type: consentType,
      verification_method: verificationMethod,
      policy_version: '2026.11-v1',
      verified_by: verifiedBy,
      metadata,
      created_at: new Date().toISOString()
    };
    const localLogs = this.get('tps_dpdp_consent_logs') || [];
    localLogs.unshift(entry);
    this.set('tps_dpdp_consent_logs', localLogs);

    if (supabase && !isTestEnv) {
      try {
        await supabase.from('dpdp_consent_logs').insert([{
          user_id: userId,
          student_id: studentId,
          consent_type: consentType,
          verification_method: verificationMethod,
          policy_version: '2026.11-v1',
          verified_by: verifiedBy,
          metadata
        }]);
      } catch (err) {
        console.warn('Cloud DPDP consent log sync error:', err);
      }
    }
    this.logAudit('DPDP_CONSENT_RECORDED', 'users', userId, `DPDP verifiable parental consent logged via ${verificationMethod}`);
    return entry;
  }

  async exportStudentDataJson(studentId) {
    const students = await this.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('Student record not found.');

    const allLeaves = (this.get('tps_student_leave_records') || []).filter(l => l.student_id === studentId);
    const allDiscipline = (this.get('tps_discipline') || []).filter(d => d.student_id === studentId);
    const attendanceSessions = (this.get('tps_attendance') || []).filter(sess => {
      return Array.isArray(sess.records) && sess.records.some(r => r.student_id === studentId);
    });

    const exportBundle = {
      export_version: 'DPDP-2023-Sec12-v1',
      data_fiduciary: 'Thaiba Public School & Residential Hostel',
      exported_at: new Date().toISOString(),
      student_personal_data: {
        id: student.id,
        full_name: student.full_name,
        admission_number: student.admission_number,
        gender: student.gender,
        date_of_birth: student.date_of_birth || null,
        blood_group: student.blood_group || null,
        school_class: student.school_class,
        school_section: student.school_section,
        hostel_room: student.hostel_room,
        hostel_bed: student.hostel_bed,
        status: student.status
      },
      guardian_contacts: {
        father_name: student.father_name,
        father_phone: student.father_phone,
        mother_name: student.mother_name,
        mother_phone: student.mother_phone,
        whatsapp_number: student.whatsapp_number,
        native_village: student.village,
        native_district: student.district,
        state: student.state,
        pin_code: student.pin_code
      },
      historical_records: {
        leave_records_count: allLeaves.length,
        leaves: allLeaves,
        attendance_sessions_count: attendanceSessions.length,
        discipline_records_count: allDiscipline.length,
        discipline: allDiscipline
      },
      legal_disclaimer: 'This data export is generated in compliance with Section 12 (Right to Data Portability & Access) of the Digital Personal Data Protection Act, 2023 (India).'
    };

    return exportBundle;
  }

  async eraseStudentData(studentId, { reason = 'Parent/Guardian DPDP Erasure Request', actorEmail = 'admin', anonymizeOnly = false } = {}) {
    const students = await this.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('Student record not found.');

    if (anonymizeOnly) {
      await this.updateStudent(studentId, {
        full_name: `Redacted Student (${student.admission_number})`,
        father_name: 'REDACTED',
        father_phone: '0000000000',
        mother_name: 'REDACTED',
        mother_phone: '0000000000',
        whatsapp_number: '0000000000',
        village: 'REDACTED',
        district: 'REDACTED',
        photo_url: '',
        remarks: `[DPDP ANONYMIZED: ${new Date().toISOString()}] ${reason}`
      });
      this.logAudit('DPDP_ANONYMIZE_STUDENT', 'students', studentId, `Personal PII anonymized under DPDP Sec 12: ${reason}`, actorEmail);
      return { success: true, mode: 'anonymized' };
    } else {
      await this.deleteStudent(studentId);
      this.logAudit('DPDP_ERASE_STUDENT', 'students', studentId, `Permanent record erasure executed under DPDP Sec 12: ${reason}`, actorEmail);
      return { success: true, mode: 'erased' };
    }
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
              supabaseStudents = data.filter(s => !isDummyStudent(s)).map(s => {
                const mappedStatus = s.status === 'Withdrawn' ? 'Dropped Out' : normalizeStatus(s.status);
                let sDate = s.break_start_date || null;
                let cleanRemarks = s.remarks || '';
                if (cleanRemarks && cleanRemarks.includes('[DATE:')) {
                  const m = cleanRemarks.match(/\[DATE:(\d{4}-\d{2}-\d{2})\]/);
                  if (m) {
                    sDate = m[1];
                    cleanRemarks = cleanRemarks.replace(/\[DATE:\d{4}-\d{2}-\d{2}\]\s*/g, '').trim();
                  }
                }
                return {
                  ...s,
                  status: mappedStatus,
                  remarks: cleanRemarks,
                  status_reason: s.break_reason || cleanRemarks || '',
                  status_date: sDate,
                  dropout_date: mappedStatus === 'Dropped Out' ? (sDate || null) : null,
                  inactive_date: mappedStatus === 'Inactive' ? (sDate || null) : null,
                  break_start_date: mappedStatus === 'Temporary Break' ? (sDate || null) : (s.break_start_date || null)
                };
              });
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
          const localMap = new Map((localStudents || []).map(s => [s.admission_number || s.id, s]));
          mergedStudents = supabaseStudents.map(s => {
            const loc = localMap.get(s.admission_number) || localMap.get(s.id);
            const statusDate = s.status_date || loc?.status_date || loc?.dropout_date || loc?.inactive_date || loc?.break_start_date || null;
            const statusReason = s.status_reason || loc?.status_reason || loc?.break_reason || loc?.remarks || '';
            const remarks = s.remarks || loc?.remarks || '';
            return {
              ...s,
              status_date: statusDate,
              dropout_date: s.status === 'Dropped Out' ? (statusDate || loc?.dropout_date || null) : (loc?.dropout_date || null),
              inactive_date: s.status === 'Inactive' ? (statusDate || loc?.inactive_date || null) : (loc?.inactive_date || null),
              break_start_date: s.status === 'Temporary Break' ? (statusDate || loc?.break_start_date || null) : (s.break_start_date || null),
              status_reason: statusReason,
              remarks: remarks
            };
          });
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
              mergedStudents = [...mergedStudents, ...missingFromDb];
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

    const todayStr = getTodayDateStr();

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
        district: s.district || '',
        state: s.state || '',
        pin_code: s.pin_code || '',
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
            admission_date: normalizeDate(s.admission_date, getTodayDateStr()),
            school_class: normalizeClassPattern(s.school_class),
            school_section: s.school_section || 'A',
            hostel_status: normalizeHostelStatus(s.hostel_status),
            status: normalizeStatus(s.status),
            village: s.village || '',
            post_office: s.post_office || '',
            district: s.district || '',
            state: s.state || '',
            pin_code: s.pin_code || '',
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
      admission_date: normalizeDate(studentData.admission_date, getTodayDateStr()),
      school_class: normalizeClassPattern(studentData?.school_class),
      school_section: studentData.school_section || 'A',
      hostel_status: normalizeHostelStatus(studentData.hostel_status),
      status: normalizeStatus(studentData.status),
      village: studentData.village || '',
      post_office: studentData.post_office || '',
      district: studentData.district || '',
      state: studentData.state || '',
      pin_code: studentData.pin_code || '',
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

    // Unify status_date across all status types
    const statusDate = sanitizedUpdates.status_date || sanitizedUpdates.dropout_date || sanitizedUpdates.inactive_date || sanitizedUpdates.break_start_date || null;

    if (sanitizedUpdates.status === 'Temporary Break') {
      sanitizedUpdates.status_date = statusDate;
      sanitizedUpdates.break_start_date = statusDate;
      if (sanitizedUpdates.status_reason && !sanitizedUpdates.break_reason) {
        sanitizedUpdates.break_reason = sanitizedUpdates.status_reason;
      }
    } else if (sanitizedUpdates.status === 'Dropped Out') {
      sanitizedUpdates.status_date = statusDate;
      sanitizedUpdates.dropout_date = statusDate;
    } else if (sanitizedUpdates.status === 'Inactive') {
      sanitizedUpdates.status_date = statusDate;
      sanitizedUpdates.inactive_date = statusDate;
    } else if (sanitizedUpdates.status === 'Active') {
      sanitizedUpdates.status_date = null;
      sanitizedUpdates.dropout_date = null;
      sanitizedUpdates.inactive_date = null;
      sanitizedUpdates.break_start_date = null;
      sanitizedUpdates.break_reason = null;
      sanitizedUpdates.status_reason = null;
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
        const supabaseUpdates = { ...sanitizedUpdates };
        // Map 'Dropped Out' to 'Withdrawn' for Supabase schema CHECK constraint
        if (supabaseUpdates.status === 'Dropped Out') {
          supabaseUpdates.status = 'Withdrawn';
        }

        // Store status date reliably in Supabase break_start_date & remarks tag
        if (statusDate) {
          supabaseUpdates.break_start_date = statusDate;
          const tag = `[DATE:${statusDate}]`;
          const rawNote = (sanitizedUpdates.status_reason || sanitizedUpdates.remarks || supabaseUpdates.remarks || '').replace(/\[DATE:\d{4}-\d{2}-\d{2}\]\s*/g, '').trim();
          supabaseUpdates.remarks = rawNote ? `${tag} ${rawNote}` : tag;
        } else if (sanitizedUpdates.status === 'Active') {
          supabaseUpdates.break_start_date = null;
          supabaseUpdates.break_reason = null;
          if (supabaseUpdates.remarks) {
            supabaseUpdates.remarks = supabaseUpdates.remarks.replace(/\[DATE:\d{4}-\d{2}-\d{2}\]\s*/g, '').trim();
          }
        }

        if (supabaseUpdates.status === 'Temporary Break') {
          if (sanitizedUpdates.status_reason) {
            supabaseUpdates.break_reason = sanitizedUpdates.status_reason;
          }
        }

        // Clean up client-only fields that do not exist on the Supabase 'students' table
        delete supabaseUpdates.status_date;
        delete supabaseUpdates.dropout_date;
        delete supabaseUpdates.inactive_date;
        delete supabaseUpdates.status_reason;

        let updateRes;
        if (isUuid) {
          updateRes = await supabase.from('students').update(supabaseUpdates).eq('id', id);
        } else if (sanitizedUpdates.admission_number) {
          updateRes = await supabase.from('students').update(supabaseUpdates).eq('admission_number', sanitizedUpdates.admission_number);
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

      // If student is placed on Temporary Break, Dropped Out, or Inactive, automatically detach from active leave passes
      if (sanitizedUpdates.status && !isStudentActive(sanitizedUpdates.status)) {
        try {
          let leaves = this.get('tps_leaves') || [];
          let leavesChanged = false;
          leaves.forEach(l => {
            if (l.status === 'Returned' || l.status === 'Cancelled' || l.status === 'Rejected') return;
            if (Array.isArray(l.students)) {
              const hasStudent = l.students.some(s => s.student_id === id);
              if (hasStudent) {
                l.students = l.students.filter(s => s.student_id !== id);
                if (Array.isArray(l.student_ids)) {
                  l.student_ids = l.student_ids.filter(sid => sid !== id);
                }
                l.total_students = l.students.length;
                if (l.student_id === id) {
                  l.student_id = l.students[0]?.student_id || null;
                  l.student_name = l.students[0]?.student_name || '';
                }
                if (l.students.length === 0) {
                  l.status = 'Returned';
                }
                leavesChanged = true;
              }
            } else if (l.student_id === id || (Array.isArray(l.student_ids) && l.student_ids.includes(id))) {
              l.status = 'Returned';
              leavesChanged = true;
            }
          });
          if (leavesChanged) {
            this.set('tps_leaves', leaves);
            this.pushCloudKey('tps_leaves', leaves).catch(e => console.warn('Push tps_leaves err:', e));
          }
        } catch (cErr) {
          console.warn('Auto detach leave on break/drop error:', cErr);
        }
      }

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
      break_rejoin_date: getTodayDateStr()
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
    let assignments = this.get('tps_teacher_assignments') || [];
    const currentTeacher = sanitized.teacher_id !== undefined ? sanitized.teacher_id : oldTeacherId;

    if (sanitized.teacher_id !== undefined && sanitized.teacher_id !== oldTeacherId) {
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
            assigned_date: oldCls.teacher_assigned_date || todayIso,
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
    } else {
      // Same teacher or no teacher change: sync assigned_date / removed_date if updated
      if (currentTeacher) {
        const openIdx = assignments.findIndex(a => a.classroom_id === classroomId && a.teacher_id === currentTeacher && !a.removed_date);
        if (openIdx >= 0) {
          if (sanitized.teacher_assigned_date) {
            assignments[openIdx].assigned_date = sanitized.teacher_assigned_date;
          }
          if (sanitized.teacher_removed_date !== undefined) {
            assignments[openIdx].removed_date = sanitized.teacher_removed_date || null;
          }
          this.set('tps_teacher_assignments', assignments);
        } else if (sanitized.teacher_assigned_date) {
          assignments.push({
            id: 't-asg-' + Date.now(),
            classroom_id: classroomId,
            teacher_id: currentTeacher,
            assigned_date: sanitized.teacher_assigned_date,
            removed_date: sanitized.teacher_removed_date || null
          });
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

    // Auto-reconcile open assignment with active classroom setting
    const classrooms = this.get('tps_classrooms') || [];
    let modified = false;
    classrooms.forEach(c => {
      if (c.teacher_id && c.teacher_assigned_date) {
        const openAsg = assignments.find(a => a.classroom_id === c.id && a.teacher_id === c.teacher_id && !a.removed_date);
        if (openAsg && openAsg.assigned_date !== c.teacher_assigned_date) {
          openAsg.assigned_date = c.teacher_assigned_date;
          modified = true;
        } else if (!openAsg) {
          assignments.push({
            id: 't-asg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            classroom_id: c.id,
            teacher_id: c.teacher_id,
            assigned_date: c.teacher_assigned_date,
            removed_date: c.teacher_removed_date || null
          });
          modified = true;
        }
      }
    });
    if (modified) {
      this.set('tps_teacher_assignments', assignments);
      this.pushCloudKey('tps_teacher_assignments', assignments).catch(() => {});
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

    const isCurrentActive = isMatch(classroom.teacher_id, teacherId);

    // Check historical assignment log entries for this classroom and teacher
    const classTeacherAssignments = (assignments || []).filter(a => 
      a.classroom_id === classroom.id && (isMatch(a.teacher_id, teacherId) || (isCurrentActive && !a.teacher_id))
    );

    if (classTeacherAssignments.length > 0) {
      return classTeacherAssignments.some(a => {
        const isActiveAssignment = !a.removed_date && isCurrentActive;
        const start = (isActiveAssignment && classroom.teacher_assigned_date)
          ? classroom.teacher_assigned_date
          : (a.assigned_date || classroom.teacher_assigned_date || '2026-10-01');
        const end = (isActiveAssignment && classroom.teacher_removed_date)
          ? classroom.teacher_removed_date
          : (a.removed_date || null);
        if (dateStr < start) return false;
        if (end && dateStr > end) return false;
        return true;
      });
    }

    // Direct classroom property fallback
    if (isCurrentActive) {
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

  async unlockAttendanceWindow(classroomId, date = getTodayDateStr()) {
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

  async lockAttendanceWindow(classroomId, date = getTodayDateStr()) {
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

  async isAttendanceWindowUnlocked(classroomId, date = getTodayDateStr()) {
    await this.pullCloudKeys(['tps_attendance_unlocks']);
    const unlocks = this.get('tps_attendance_unlocks') || [];
    return unlocks.includes(`${classroomId}_${date}`);
  }

  async deleteAttendanceSession(classroomId, sessionDate) {
    let attendance = this.get('tps_attendance') || [];
    const beforeCount = attendance.length;
    attendance = attendance.filter(s => !(s.classroom_id === classroomId && s.session_date === sessionDate));
    if (attendance.length !== beforeCount) {
      this.set('tps_attendance', attendance);
    }
    
    let teacherAtt = this.get('tps_teacher_attendance') || [];
    const beforeTCount = teacherAtt.length;
    teacherAtt = teacherAtt.filter(s => !(s.classroom_id === classroomId && s.session_date === sessionDate));
    if (teacherAtt.length !== beforeTCount) {
      this.set('tps_teacher_attendance', teacherAtt);
    }

    this.logAudit('RESET_ATTENDANCE_SESSION', 'attendance', `${classroomId}_${sessionDate}`, `Attendance session for ${sessionDate} reset/cleared.`);
    return true;
  }

  async getAttendanceUnlocks() {
    await this.pullCloudKeys(['tps_attendance_unlocks']);
    return this.get('tps_attendance_unlocks') || [];
  }

  getSessionPunctualityInfo(sessionRecord, classStartTime = '') {
    if (!sessionRecord) return { isLate: false, lateMinutes: 0, punctuality: 'punctual' };

    // 1. Explicit 1st attendance punctuality recorded on session
    if (sessionRecord.first_submission_punctuality) {
      const isLate = sessionRecord.first_submission_punctuality === 'late';
      return {
        isLate,
        lateMinutes: Number(sessionRecord.first_late_submission_minutes) || 0,
        punctuality: isLate ? 'late' : 'punctual'
      };
    }

    // 2. Evaluate from initial/1st submission timestamp against scheduled class start time
    const firstIso = sessionRecord.first_recorded_at || sessionRecord.created_at || sessionRecord.recorded_at;
    const stTime = classStartTime || sessionRecord.class_start_time;
    if (firstIso && stTime) {
      const [sh, sm] = stTime.split(':').map(Number);
      const startMins = (sh || 0) * 60 + (sm || 0);
      const fDate = new Date(firstIso);
      if (!isNaN(fDate.getTime())) {
        const fMins = fDate.getHours() * 60 + fDate.getMinutes();
        const diff = fMins - startMins;
        if (diff <= 10) {
          return { isLate: false, lateMinutes: Math.max(0, diff), punctuality: 'punctual' };
        } else {
          return { isLate: true, lateMinutes: diff, punctuality: 'late' };
        }
      }
    }

    // 3. Fallback to existing session fields
    const isLate = sessionRecord.submission_punctuality === 'late' || (Number(sessionRecord.late_submission_minutes) > 10);
    return {
      isLate,
      lateMinutes: Number(sessionRecord.late_submission_minutes) || 0,
      punctuality: isLate ? 'late' : 'punctual'
    };
  }

  async saveAttendanceSession({ program_id, classroom_id, session_date, teacher_id, records, teacher_name, recorded_at, submission_punctuality = 'punctual', late_submission_minutes = 0, class_start_time = '', submitted_by_name = '' }) {
    const attendance = this.get('tps_attendance') || [];
    const nowIso = recorded_at || new Date().toISOString();

    // Check if an attendance session already exists for this classroom and date (Editing scenario)
    const existingIndex = attendance.findIndex(s => s.classroom_id === classroom_id && s.session_date === session_date);

    let targetSession;
    if (existingIndex >= 0) {
      // Update existing session
      const prev = attendance[existingIndex];

      // Faculty duty punctuality is strictly determined from the FIRST attendance submission of the class
      const firstRecordedAt = prev.first_recorded_at || prev.created_at || prev.recorded_at;
      let firstPunctuality = prev.first_submission_punctuality || prev.submission_punctuality || 'punctual';
      let firstLateMinutes = prev.first_late_submission_minutes !== undefined ? prev.first_late_submission_minutes : (prev.late_submission_minutes || 0);

      // Verify if previous late flag was erroneously caused by a later update (e.g. marking late students)
      if (firstRecordedAt && (class_start_time || prev.class_start_time)) {
        const stTime = class_start_time || prev.class_start_time;
        const [sh, sm] = stTime.split(':').map(Number);
        const startMins = (sh || 0) * 60 + (sm || 0);
        const fDate = new Date(firstRecordedAt);
        if (!isNaN(fDate.getTime())) {
          const fMins = fDate.getHours() * 60 + fDate.getMinutes();
          const diff = fMins - startMins;
          if (diff <= 10) {
            firstPunctuality = 'punctual';
            if (firstLateMinutes > 10) {
              firstLateMinutes = Math.max(0, diff);
            }
          }
        }
      }

      targetSession = {
        ...prev,
        program_id: program_id || prev.program_id,
        teacher_id: teacher_id || prev.teacher_id,
        teacher_name: teacher_name || prev.teacher_name,
        records: records || prev.records,
        recorded_at: prev.recorded_at || nowIso,
        first_recorded_at: firstRecordedAt,
        updated_at: nowIso,
        submission_punctuality: firstPunctuality,
        late_submission_minutes: firstLateMinutes,
        first_submission_punctuality: firstPunctuality,
        first_late_submission_minutes: firstLateMinutes,
        class_start_time: class_start_time || prev.class_start_time || '',
        submitted_by_name: prev.submitted_by_name || submitted_by_name || teacher_name || '',
        last_updated_by_name: submitted_by_name || teacher_name || '',
        // Track students who were initially marked absent
        initial_absent_ids: prev.initial_absent_ids || prev.records?.filter(r => r.status === 'Absent').map(r => r.student_id) || []
      };
      attendance[existingIndex] = targetSession;
    } else {
      // Create new session (1st attendance submission of the class)
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
        first_recorded_at: nowIso,
        submission_punctuality: submission_punctuality || 'punctual',
        late_submission_minutes: Number(late_submission_minutes) || 0,
        first_submission_punctuality: submission_punctuality || 'punctual',
        first_late_submission_minutes: Number(late_submission_minutes) || 0,
        class_start_time: class_start_time || '',
        submitted_by_name: submitted_by_name || teacher_name || '',
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

  calculateReturnLate(expectedDateStr, expectedTimeStr, actualDateStr, actualTimeStr, fineRate = 5, rateType = 'daily') {
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

  calculateHourlyLate(expectedDateStr, expectedTimeStr, actualDateStr = null, actualTimeStr = null, hourlyRate = 5) {
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
    fine_per_hour = 5,
    fine_per_day = null,
    fine_unit = null,
    escort_type = 'Parent / Guardian',
    parent_phone = '',
    requested_by = '',
    requester_role = '',
    status = null,
    approved_by = 'Warden Office'
  }) {
    await this.pullCloudKeys(['tps_leaves'], true);
    const leaves = this.get('tps_leaves') || [];
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
    const effectiveHourlyFine = Number(fine_per_hour) || 5;
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

    // If already active/away, update each student status to On Approved Leave only if departure has arrived
    if (effectiveStatus !== 'Pending') {
      const depDate = departure_date || primaryRec.departure_date;
      const depTime = (departure_time || primaryRec.departure_time || '16:00').substring(0, 5);
      const departDateTime = depDate ? new Date(`${depDate}T${depTime}:00`) : null;
      const now = new Date();
      if (departDateTime && !isNaN(departDateTime.getTime()) && now >= departDateTime) {
        for (const sid of sIds) {
          await this.updateStudent(sid, { status: 'On Approved Leave' });
        }
      }
    }

    leaves.unshift(primaryRec);
    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('CREATE_LEAVE', 'student_leave_records', primaryRec.id, `Created leave ${leaveCode} for ${sIds.length} student(s) [${effectiveStatus}]`);
    return [primaryRec];
  }

  async approveLeaveRecord(leave_id, { approved_by = 'Hostel Warden', fine_per_hour = 5, departure_date, departure_time, expected_return_date, expected_return_time } = {}) {
    await this.pullCloudKeys(['tps_leaves'], true);
    const leaves = this.get('tps_leaves');
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    leave.status = 'Approved';
    leave.approved_by = approved_by || 'Hostel Warden';
    leave.approved_at = new Date().toISOString();
    leave.fine_unit = 'hour';
    leave.fine_per_hour = Number(fine_per_hour) || 5;
    leave.fine_per_hour_applied = Number(fine_per_hour) || 5;
    leave.fine_per_day = (Number(fine_per_hour) || 5) * 24;
    leave.fine_per_day_applied = (Number(fine_per_hour) || 5) * 24;

    if (departure_date) {
      leave.departure_date = departure_date;
      leave.leaving_date = departure_date;
    }
    if (departure_time) {
      leave.departure_time = departure_time;
      leave.leaving_time = departure_time;
    }
    if (expected_return_date) leave.expected_return_date = expected_return_date;
    if (expected_return_time) leave.expected_return_time = expected_return_time;

    const sIds = Array.isArray(leave.student_ids) ? leave.student_ids : [leave.student_id];
    const departs = leave.departure_date || leave.leaving_date;
    const todayIso = getTodayDateStr();
    // Only mark student profile "On Approved Leave" if leave starts today or earlier; future leaves remain Active
    if (departs && departs <= todayIso) {
      for (const sid of sIds) {
        if (sid) await this.updateStudent(sid, { status: 'On Approved Leave' });
      }
    } else {
      for (const sid of sIds) {
        if (sid) await this.updateStudent(sid, { status: 'Active' });
      }
    }

    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('APPROVE_LEAVE', 'student_leave_records', leave_id, `Leave ${leave.leave_code} approved by ${approved_by} at ₹${fine_per_hour}/hr fine rate`);
    return leave;
  }

  async updateLeaveRecord(leave_id, updates = {}) {
    await this.pullCloudKeys(['tps_leaves'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    if (updates.departure_date !== undefined) {
      leave.departure_date = updates.departure_date;
      leave.leaving_date = updates.departure_date;
    }
    if (updates.departure_time !== undefined) {
      leave.departure_time = updates.departure_time;
      leave.leaving_time = updates.departure_time;
    }
    if (updates.expected_return_date !== undefined) leave.expected_return_date = updates.expected_return_date;
    if (updates.expected_return_time !== undefined) leave.expected_return_time = updates.expected_return_time;
    if (updates.fine_per_hour !== undefined) {
      leave.fine_per_hour = Number(updates.fine_per_hour) || 5;
      leave.fine_per_hour_applied = Number(updates.fine_per_hour) || 5;
      leave.fine_per_day = (Number(updates.fine_per_hour) || 5) * 24;
      leave.fine_per_day_applied = (Number(updates.fine_per_hour) || 5) * 24;
    }
    if (updates.reason !== undefined) leave.reason = updates.reason;
    if (updates.leave_type !== undefined) leave.leave_type = updates.leave_type;
    leave.updated_at = new Date().toISOString();

    // If leave is approved, update student presence status based on modified dates
    if (leave.status === 'Approved') {
      const departs = leave.departure_date || leave.leaving_date;
      const todayIso = getTodayDateStr();
      const sIds = Array.isArray(leave.student_ids) ? leave.student_ids : [leave.student_id];
      if (departs && departs <= todayIso) {
        for (const sid of sIds) {
          if (sid) await this.updateStudent(sid, { status: 'On Approved Leave' });
        }
      } else {
        for (const sid of sIds) {
          if (sid) await this.updateStudent(sid, { status: 'Active' });
        }
      }
    }

    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('UPDATE_LEAVE', 'student_leave_records', leave_id, `Updated schedule for leave ${leave.leave_code}`);
    return leave;
  }

  async extendLeaveRecord(leaveId, {
    student_ids = null,
    new_expected_return_date,
    new_expected_return_time = '18:00',
    fine_per_hour = 5,
    reason = 'Parent requested leave extension',
    approved_by = 'Hostel Office'
  }) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leaveId || l.leave_code === leaveId);
    if (idx === -1) throw new Error('Leave pass record not found');

    const leave = leaves[idx];
    const nowIso = new Date().toISOString();
    const targetStudentIds = (Array.isArray(student_ids) && student_ids.length > 0)
      ? new Set(student_ids)
      : null;

    const hasStudents = Array.isArray(leave.students) && leave.students.length > 0;
    const isBatch = Boolean(leave.is_batch || (hasStudents && leave.students.length > 1));
    const appliedFineRate = Number(fine_per_hour) || Number(leave.fine_per_hour) || 5;

    // Check if separating students from bulk leave
    if (isBatch && hasStudents && targetStudentIds && targetStudentIds.size > 0 && targetStudentIds.size < leave.students.length) {
      const selectedStudentEntries = leave.students.filter(s => targetStudentIds.has(s.student_id));
      
      // 1. Separate selected students out of parent bulk leave pass (minus from bulk leave)
      leave.students = leave.students.filter(s => !targetStudentIds.has(s.student_id));
      leave.student_ids = (leave.student_ids || []).filter(id => !targetStudentIds.has(id));
      if (Array.isArray(leave.student_names)) {
        leave.student_names = leave.students.map(s => s.student_name || s.name || s.full_name).filter(Boolean);
      }
      leave.total_students = leave.students.length;
      leave.all_students_count = leave.students.length;
      leave.updated_at = nowIso;

      // 2. Determine unique code for child extended pass
      const parentCode = leave.leave_code || leave.leave_register_number || 'LV-2026';
      const existingExts = leaves.filter(l => l.parent_leave_id === leave.id || (l.leave_code && l.leave_code.startsWith(parentCode + '-EXT')));
      const extCode = `${parentCode}-EXT${existingExts.length > 0 ? (existingExts.length + 1) : ''}`;

      const extStudentList = selectedStudentEntries.map(s => ({
        ...s,
        original_expected_return_date: s.expected_return_date || leave.expected_return_date,
        original_expected_return_time: s.expected_return_time || leave.expected_return_time || '18:00',
        expected_return_date: new_expected_return_date,
        expected_return_time: new_expected_return_time,
        is_extended: true,
        is_returned: false,
        extension_reason: reason,
        extended_by: approved_by,
        extended_at: nowIso
      }));

      // 3. Create distinct Expanded Leave Card record
      const newExtLeave = {
        id: 'lv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        leave_code: extCode,
        leave_register_number: extCode,
        parent_leave_id: leave.id,
        parent_leave_code: parentCode,
        leave_type: leave.leave_type || 'Hostel Leave',
        leave_category: leave.leave_category || 'General',
        reason: `${leave.reason ? leave.reason + ' • ' : ''}Extended: ${reason}`,
        departure_date: leave.departure_date,
        departure_time: leave.departure_time,
        original_expected_return_date: leave.expected_return_date,
        original_expected_return_time: leave.expected_return_time,
        expected_return_date: new_expected_return_date,
        expected_return_time: new_expected_return_time,
        fine_unit: 'hour',
        fine_per_hour: appliedFineRate,
        fine_per_hour_applied: appliedFineRate,
        fine_per_day: appliedFineRate * 24,
        fine_per_day_applied: appliedFineRate * 24,
        status: 'Approved',
        is_extended: true,
        is_batch: extStudentList.length > 1,
        total_students: extStudentList.length,
        all_students_count: extStudentList.length,
        students: extStudentList,
        student_ids: extStudentList.map(s => s.student_id),
        student_names: extStudentList.map(s => s.student_name || s.name || s.full_name).filter(Boolean),
        student_id: extStudentList.length === 1 ? extStudentList[0].student_id : null,
        student_name: extStudentList.length === 1 ? (extStudentList[0].student_name || extStudentList[0].name) : null,
        created_at: nowIso,
        updated_at: nowIso,
        extension_history: [{
          extended_at: nowIso,
          parent_leave_code: parentCode,
          new_expected_return_date,
          new_expected_return_time,
          fine_per_hour: appliedFineRate,
          reason,
          approved_by,
          student_ids: extStudentList.map(s => s.student_id)
        }]
      };

      leaves[idx] = leave;
      leaves.splice(idx + 1, 0, newExtLeave);
      this.set('tps_leaves', leaves);
      await this.pushCloudKey('tps_leaves', leaves);

      this.logAudit('LEAVE_EXTENDED_SEPARATED', 'student_leave_records', newExtLeave.id,
        `Separated ${extStudentList.length} student(s) into extended leave ${extCode} (due ${new_expected_return_date} @ ₹${appliedFineRate}/hr): ${reason}`);

      return newExtLeave;
    }

    // Otherwise: all students on pass or single student pass being extended in place
    if (hasStudents) {
      leave.students.forEach(s => {
        if (!s.is_returned && (!targetStudentIds || targetStudentIds.has(s.student_id))) {
          s.original_expected_return_date = s.original_expected_return_date || s.expected_return_date || leave.expected_return_date;
          s.original_expected_return_time = s.original_expected_return_time || s.expected_return_time || leave.expected_return_time || '18:00';
          s.expected_return_date = new_expected_return_date;
          s.expected_return_time = new_expected_return_time;
          s.is_extended = true;
          s.extension_reason = reason;
          s.extended_by = approved_by;
          s.extended_at = nowIso;
        }
      });
    }

    leave.original_expected_return_date = leave.original_expected_return_date || leave.expected_return_date;
    leave.original_expected_return_time = leave.original_expected_return_time || leave.expected_return_time;
    leave.expected_return_date = new_expected_return_date;
    leave.expected_return_time = new_expected_return_time;
    leave.fine_unit = 'hour';
    leave.fine_per_hour = appliedFineRate;
    leave.fine_per_hour_applied = appliedFineRate;
    leave.fine_per_day = appliedFineRate * 24;
    leave.fine_per_day_applied = appliedFineRate * 24;
    leave.is_extended = true;
    leave.extension_reason = reason;
    leave.extended_by = approved_by;
    leave.extended_at = nowIso;
    leave.updated_at = nowIso;

    leave.extension_history = leave.extension_history || [];
    leave.extension_history.push({
      extended_at: nowIso,
      new_expected_return_date,
      new_expected_return_time,
      fine_per_hour: appliedFineRate,
      reason,
      approved_by,
      student_ids: targetStudentIds ? Array.from(targetStudentIds) : (leave.student_ids || [leave.student_id])
    });

    leaves[idx] = leave;
    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);

    this.logAudit('LEAVE_EXTENDED', 'student_leave_records', leave.id,
      `Leave extended to ${new_expected_return_date} for ${targetStudentIds ? targetStudentIds.size + ' student(s)' : 'all students'} by ${approved_by} @ ₹${appliedFineRate}/hr: ${reason}`);

    return leave;
  }

  async rejectLeaveRecord(leave_id, { rejected_by = 'Hostel Warden', reason = 'Administrative grounds' } = {}) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    leave.status = 'Rejected';
    leave.rejected_by = rejected_by || 'Hostel Warden';
    leave.rejected_reason = reason;
    leave.rejected_at = new Date().toISOString();

    const sIds = Array.isArray(leave.student_ids) ? leave.student_ids : [leave.student_id];
    for (const sid of sIds) {
      if (sid) {
        const student = (this.get('tps_students') || []).find(s => s.id === sid);
        if (student && student.status === 'On Approved Leave') {
          await this.updateStudent(sid, { status: 'Active' });
        }
      }
    }

    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('REJECT_LEAVE', 'student_leave_records', leave_id, `Leave ${leave.leave_code} rejected by ${rejected_by}: ${reason}`);
    return leave;
  }

  async requestLeaveExtension(leave_id, { requested_return_date, requested_return_time, reason, parent_name, parent_phone }) {
    await this.pullCloudKeys(['tps_leaves'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');
    const leave = leaves[idx];

    leave.extension_request = {
      id: 'ext-' + Date.now(),
      status: 'pending',
      requested_return_date,
      requested_return_time: requested_return_time || '18:00',
      reason: reason || 'Parent requested extension for genuine reason',
      parent_name: parent_name || 'Parent',
      parent_phone: parent_phone || '',
      requested_at: new Date().toISOString()
    };
    leave.updated_at = new Date().toISOString();

    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('REQUEST_LEAVE_EXTENSION', 'student_leave_records', leave_id, `Parent requested extension until ${requested_return_date} (${reason})`);
    return leave;
  }

  async acceptLeaveExtension(leave_id, { approved_return_date, approved_return_time, admin_remarks = '', waive_fines = true, approved_by = 'Admin' } = {}) {
    await this.pullCloudKeys(['tps_leaves'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');
    const leave = leaves[idx];

    const prevDate = leave.expected_return_date;
    const prevTime = leave.expected_return_time;
    const newDate = approved_return_date || leave.extension_request?.requested_return_date || prevDate;
    const newTime = approved_return_time || leave.extension_request?.requested_return_time || prevTime || '18:00';

    leave.expected_return_date = newDate;
    leave.expected_return_time = newTime;

    leave.extension_history = leave.extension_history || [];
    leave.extension_history.push({
      id: 'ext-hist-' + Date.now(),
      approved_at: new Date().toISOString(),
      approved_by,
      previous_return_date: prevDate,
      previous_return_time: prevTime,
      extended_return_date: newDate,
      extended_return_time: newTime,
      reason: leave.extension_request?.reason || '',
      admin_remarks
    });

    if (leave.extension_request) {
      leave.extension_request.status = 'approved';
      leave.extension_request.approved_at = new Date().toISOString();
      leave.extension_request.approved_by = approved_by;
      leave.extension_request.admin_remarks = admin_remarks;
    }

    // If leave was marked overdue, check if new expected return date/time is in the future
    const now = new Date();
    const newExp = new Date(newDate + 'T' + (newTime || '18:00:00'));
    if (now < newExp && (leave.status === 'Overdue' || leave.status === 'overdue')) {
      leave.status = 'Away';
      if (waive_fines) {
        leave.calculated_fine = 0;
        leave.adjusted_fine = 0;
        leave.late_hours = 0;
        leave.late_days = 0;
      }
    }
    leave.updated_at = new Date().toISOString();

    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('ACCEPT_LEAVE_EXTENSION', 'student_leave_records', leave_id, `Leave extension approved until ${newDate} ${newTime}`);
    return leave;
  }

  async rejectLeaveExtension(leave_id, { reason = 'Extension not approved', rejected_by = 'Admin' } = {}) {
    await this.pullCloudKeys(['tps_leaves'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');
    const leave = leaves[idx];

    if (leave.extension_request) {
      leave.extension_request.status = 'rejected';
      leave.extension_request.rejected_at = new Date().toISOString();
      leave.extension_request.rejected_by = rejected_by;
      leave.extension_request.rejection_reason = reason;
    }
    leave.updated_at = new Date().toISOString();

    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('REJECT_LEAVE_EXTENSION', 'student_leave_records', leave_id, `Leave extension rejected: ${reason}`);
    return leave;
  }

  async deleteLeaveRecord(leave_id) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students', 'tps_fine_payments'], true);
    let leaves = this.get('tps_leaves') || [];
    const targetIdx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (targetIdx === -1) throw new Error('Leave record not found');

    const targetLeave = leaves[targetIdx];
    const rawSIds = [
      ...(Array.isArray(targetLeave.student_ids) ? targetLeave.student_ids : []),
      ...(Array.isArray(targetLeave.students) ? targetLeave.students.map(s => s.student_id) : []),
      targetLeave.student_id
    ].filter(Boolean);
    const sIds = Array.from(new Set(rawSIds));

    // 1. Remove leave from tps_leaves
    leaves = leaves.filter(l => l.id !== targetLeave.id && l.leave_code !== targetLeave.leave_code);
    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);

    // 2. Remove associated fine payments
    let finePayments = this.get('tps_fine_payments') || [];
    const origFineCount = finePayments.length;
    finePayments = finePayments.filter(fp => fp.leave_id !== targetLeave.id && fp.leave_code !== targetLeave.leave_code);
    if (finePayments.length !== origFineCount) {
      this.set('tps_fine_payments', finePayments);
      await this.pushCloudKey('tps_fine_payments', finePayments);
    }

    // 3. Sync student status: if students were on this leave and have no other active leave, restore to Active
    for (const sid of sIds) {
      if (!sid) continue;
      const otherActiveLeave = leaves.find(l => {
        const isRej = (l.status || '').toLowerCase() === 'rejected';
        const isRet = l.status === 'Returned';
        if (isRej || isRet) return false;
        const matchesStudent = l.student_id === sid || 
          (Array.isArray(l.student_ids) && l.student_ids.includes(sid)) ||
          (Array.isArray(l.students) && l.students.some(s => s.student_id === sid && !s.is_returned));
        return matchesStudent;
      });

      if (!otherActiveLeave) {
        const student = (this.get('tps_students') || []).find(s => s.id === sid);
        if (student && (student.status === 'On Approved Leave' || student.status === 'Away')) {
          await this.updateStudent(sid, { status: 'Active' });
        }
      }
    }

    // 4. Supabase sync if connected
    if (this.supabase) {
      try {
        await this.supabase.from('student_leave_records').delete().match({ id: targetLeave.id });
      } catch (sbErr) {
        console.warn('Supabase deleteLeaveRecord warning:', sbErr);
      }
    }

    this.reconcileStudentLeaveStatuses();
    this.logAudit('DELETE_LEAVE', 'student_leave_records', targetLeave.id, `Permanently deleted leave record ${targetLeave.leave_code || targetLeave.id}`);
    return targetLeave;
  }

  async removeStudentFromLeaveRecord(leave_id, student_id) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students', 'tps_fine_payments'], true);
    let leaves = this.get('tps_leaves') || [];
    const targetIdx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (targetIdx === -1) throw new Error('Leave record not found');

    const targetLeave = leaves[targetIdx];
    const origStudents = Array.isArray(targetLeave.students) ? targetLeave.students : [];
    const origStudentIds = Array.isArray(targetLeave.student_ids) ? targetLeave.student_ids : (targetLeave.student_id ? [targetLeave.student_id] : []);

    const remainingStudents = origStudents.filter(s => s.student_id !== student_id);
    const remainingIds = origStudentIds.filter(id => id !== student_id);

    // If no students remain, completely delete the leave record
    if (remainingStudents.length === 0 && remainingIds.length === 0) {
      return this.deleteLeaveRecord(leave_id);
    }

    targetLeave.students = remainingStudents;
    targetLeave.student_ids = remainingIds;
    targetLeave.total_students = remainingStudents.length || remainingIds.length;

    // If the primary student on the leave card was this student, update to next available student
    if (targetLeave.student_id === student_id) {
      targetLeave.student_id = remainingIds[0] || (remainingStudents[0]?.student_id || null);
      const allStudents = this.get('tps_students') || [];
      const nextSt = allStudents.find(s => s.id === targetLeave.student_id);
      if (nextSt) {
        targetLeave.student_name = nextSt.full_name;
        targetLeave.admission_number = nextSt.admission_number;
      }
    }

    // Recalculate fines if students array is present
    if (targetLeave.students && targetLeave.students.length > 0) {
      const allReturned = targetLeave.students.every(s => s.is_returned);
      if (allReturned) {
        targetLeave.status = 'Returned';
      }
      targetLeave.calculated_fine = targetLeave.students.reduce((sum, s) => sum + (Number(s.fine_amount) || 0), 0);
      targetLeave.fine_paid_amount = targetLeave.students.reduce((sum, s) => sum + (Number(s.fine_paid_amount) || 0), 0);
      targetLeave.fine_remaining_amount = targetLeave.students.reduce((sum, s) => sum + (Number(s.fine_remaining_amount) || 0), 0);
      targetLeave.fine_status = targetLeave.fine_remaining_amount <= 0 && targetLeave.calculated_fine > 0 ? 'paid' : (targetLeave.fine_paid_amount > 0 ? 'partial' : 'unpaid');
    }

    // Also clean up any child arrival cards associated with this parent leave that contain this student
    leaves.forEach(l => {
      if (l.parent_leave_id === targetLeave.id || l.parent_leave_id === targetLeave.leave_code) {
        if (Array.isArray(l.student_ids) && l.student_ids.includes(student_id)) {
          l.student_ids = l.student_ids.filter(id => id !== student_id);
          if (Array.isArray(l.students)) {
            l.students = l.students.filter(s => s.student_id !== student_id);
          }
          l.total_students = l.student_ids.length;
        }
      }
    });

    // Remove any empty child arrival cards
    leaves = leaves.filter(l => {
      if (l.is_arrival_card || (l.leave_code && l.leave_code.includes('-ARR'))) {
        return (l.student_ids && l.student_ids.length > 0) || (l.students && l.students.length > 0);
      }
      return true;
    });

    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);

    // Sync student status: if student has no other active unreturned leaves, restore to Active
    const otherActiveLeave = leaves.find(l => {
      const isRej = (l.status || '').toLowerCase() === 'rejected';
      const isRet = l.status === 'Returned';
      if (isRej || isRet) return false;
      return l.student_id === student_id ||
        (Array.isArray(l.student_ids) && l.student_ids.includes(student_id)) ||
        (Array.isArray(l.students) && l.students.some(s => s.student_id === student_id && !s.is_returned));
    });

    if (!otherActiveLeave) {
      await this.updateStudent(student_id, { status: 'Active', hostel_status: 'resident' });
    }

    this.reconcileStudentLeaveStatuses();
    this.logAudit('REMOVE_STUDENT_FROM_LEAVE', 'student_leave_records', targetLeave.id, `Removed student ${student_id} from bulk leave ${targetLeave.leave_code || targetLeave.id}`);
    return targetLeave;
  }

  async recordReturn(leave_record_id, actual_return_date, actual_return_time, remarks = '', target_student_id = null, fine_payment_status = null, custom_fine_amount = null, fine_paid_amount = null) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_record_id || l.leave_code === leave_record_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    const isHourly = leave.fine_unit === 'hour' || leave.fine_unit === 'hourly' || (leave.fine_unit !== 'daily' && !leave.fine_per_day);
    const rate = isHourly
      ? (leave.fine_per_hour_applied || leave.fine_per_hour || 5)
      : (leave.fine_per_day_applied || leave.fine_per_day || 100);

    const targetStudentEntry = Array.isArray(leave.students) && target_student_id
      ? leave.students.find(s => s.student_id === target_student_id)
      : null;
    const effectiveExpDate = targetStudentEntry?.expected_return_date || leave.expected_return_date;
    const effectiveExpTime = targetStudentEntry?.expected_return_time || leave.expected_return_time || '17:00';

    const calc = this.calculateReturnLate(
      effectiveExpDate,
      effectiveExpTime,
      actual_return_date,
      actual_return_time || '17:00',
      rate,
      isHourly ? 'hour' : 'daily'
    );

    if (custom_fine_amount !== null && !isNaN(custom_fine_amount) && Number(custom_fine_amount) >= 0) {
      calc.fineAmount = Number(custom_fine_amount);
      if (calc.fineAmount > 0 && calc.lateHours === 0) {
        calc.lateHours = Math.ceil(calc.fineAmount / rate) || 1;
      }
    }

    const determinedFineStatus = fine_payment_status === 'paid'
      ? 'paid'
      : (fine_payment_status === 'partial' ? 'partial' : (calc.fineAmount > 0 ? (fine_payment_status === 'unpaid' ? 'unpaid' : 'unpaid') : 'no_fine'));

    const returningStudentIds = target_student_id
      ? [target_student_id]
      : (Array.isArray(leave.student_ids) && leave.student_ids.length > 0 ? leave.student_ids : [leave.student_id]);

    const actualPaidNow = fine_payment_status === 'paid'
      ? calc.fineAmount
      : (fine_payment_status === 'partial' ? (Number(fine_paid_amount) || 0) : 0);

    if (Array.isArray(leave.students)) {
      leave.students.forEach(s => {
        if (!target_student_id || s.student_id === target_student_id) {
          s.is_returned = true;
          s.actual_return_date = actual_return_date;
          s.actual_return_time = actual_return_time;
          s.late_hours = calc.lateHours;
          s.late_days = calc.lateDays;
          s.fine_amount = calc.fineAmount;
          s.fine_status = determinedFineStatus;
          s.fine_paid_amount = actualPaidNow;
          s.fine_remaining_amount = Math.max(0, calc.fineAmount - actualPaidNow);
          s.black_marks = calc.blackMarks;
          s.return_remarks = remarks;
        }
      });
    }

    const allReturned = Array.isArray(leave.students) && leave.students.length > 0
      ? leave.students.every(s => s.is_returned)
      : true;

    if (allReturned) {
      leave.actual_return_date = actual_return_date;
      leave.actual_return_time = actual_return_time;
      leave.late_hours = calc.lateHours;
      leave.late_days = calc.lateDays;
      leave.calculated_fine = Array.isArray(leave.students)
        ? leave.students.reduce((sum, s) => sum + (s.fine_amount || 0), 0)
        : calc.fineAmount;
      leave.adjusted_fine = leave.calculated_fine;
      leave.fine_status = determinedFineStatus;
      if (determinedFineStatus === 'paid') {
        leave.fine_paid_date = actual_return_date;
        leave.fine_paid_time = actual_return_time;
      }
      leave.status = 'Returned';
      leave.remarks = remarks;
    } else {
      leave.status = 'Away';
      leave.calculated_fine = Array.isArray(leave.students)
        ? leave.students.reduce((sum, s) => sum + (s.fine_amount || 0), 0)
        : 0;
      leave.adjusted_fine = leave.calculated_fine;
      leave.fine_status = determinedFineStatus;
      if (determinedFineStatus === 'paid') {
        leave.fine_paid_date = actual_return_date;
        leave.fine_paid_time = actual_return_time;
      }
    }

    // Reactivate returning students on this leave
    for (const sid of returningStudentIds) {
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
            late_hours: calc.lateHours,
            black_marks: calc.blackMarks,
            reason: `${calc.lateHours > 0 ? calc.lateHours + ' hrs' : calc.lateDays + ' days'} late return from approved hostel leave (${leave.leave_code || leave.leave_register_number})`,
            issue_date: actual_return_date,
            status: determinedFineStatus === 'paid' ? 'paid' : 'pending',
            paid_at: determinedFineStatus === 'paid' ? new Date().toISOString() : null,
            paid_amount: determinedFineStatus === 'paid' ? calc.fineAmount : 0,
            issued_by: 'Warden Office'
          });
          await this.pushCloudKey('tps_fines', fines);
        }

        if (calc.blackMarks > 0) {
          const blackMarks = this.get('tps_black_marks') || [];
          blackMarks.unshift({
            id: 'bm-' + Date.now() + Math.random().toString(36).substring(2, 5),
            student_id: sid,
            leave_id: leave.id,
            marks_count: calc.blackMarks,
            reason: calc.lateHours > 0 ? `${calc.lateHours} hours late return from hostel leave` : `Late return on scheduled date (${actual_return_time})`,
            issued_date: actual_return_date,
            issued_by: 'Warden Office'
          });
          await this.pushCloudKey('tps_black_marks', blackMarks);
        }
      }
    }

    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('RECORD_RETURN', 'student_leave_records', leave_record_id, `Return recorded for ${returningStudentIds.length} student(s). Late: ${calc.lateHours}h, Fine: ₹${calc.fineAmount}`);
    return leave;
  }

  async cancelArrivalBatch(leave_id, batch_key, student_ids = []) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students', 'tps_fines'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');
    const leave = leaves[idx];
    const targetSet = new Set(student_ids);

    if (Array.isArray(leave.students) && leave.students.length > 0) {
      leave.students.forEach(s => {
        const matchesKey = batch_key && (s.batch_id === batch_key || `${s.actual_return_date || ''}_${s.actual_return_time || ''}` === batch_key);
        if (targetSet.has(s.student_id) || matchesKey) {
          s.is_returned = false;
          s.actual_return_date = null;
          s.actual_return_time = null;
          s.late_days = 0;
          s.late_hours = 0;
          s.fine_amount = 0;
          s.fine_status = null;
          s.fine_paid_amount = 0;
          s.fine_remaining_amount = 0;
          s.batch_id = null;
          s.return_remarks = '';
          targetSet.add(s.student_id);
        }
      });
      // If some students are still returned, keep their fines/status
      const anyStillReturned = leave.students.some(s => s.is_returned);
      leave.status = anyStillReturned ? 'Away' : 'Away';
      leave.calculated_fine = leave.students.reduce((sum, s) => sum + (Number(s.fine_amount) || 0), 0);
      leave.fine_paid_amount = leave.students.reduce((sum, s) => sum + (Number(s.fine_paid_amount) || 0), 0);
      leave.fine_remaining_amount = leave.students.reduce((sum, s) => sum + (Number(s.fine_remaining_amount) || 0), 0);
      leave.fine_status = leave.fine_remaining_amount <= 0 && leave.calculated_fine > 0 ? 'paid' : (leave.fine_paid_amount > 0 ? 'partial' : 'unpaid');
    } else {
      leave.status = 'Away';
      leave.actual_return_date = null;
      leave.actual_return_time = null;
      leave.late_days = 0;
      leave.late_hours = 0;
      leave.calculated_fine = 0;
      leave.fine_status = 'no_fine';
      leave.fine_paid_amount = 0;
      leave.fine_remaining_amount = 0;
      if (leave.student_id) targetSet.add(leave.student_id);
    }

    this.set('tps_leaves', leaves);

    for (const sid of targetSet) {
      if (sid) {
        await this.updateStudent(sid, { hostel_status: 'on_leave', status: 'On Approved Leave' });
      }
    }

    const fines = this.get('tps_fines') || [];
    const filteredFines = fines.filter(f => !(f.leave_id === leave.id && targetSet.has(f.student_id)));
    this.set('tps_fines', filteredFines);

    await this.pushCloudKey('tps_leaves', leaves);
    await this.pushCloudKey('tps_fines', filteredFines);
    this.logAudit('CANCEL_ARRIVAL_BATCH', 'student_leave_records', leave.id, `Cancelled arrival batch for ${targetSet.size} student(s)`);
    return leave;
  }

  async deleteLeaveAwayStudents(leave_id) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');
    const leave = leaves[idx];

    if (Array.isArray(leave.students)) {
      const awayStudents = leave.students.filter(s => !s.is_returned);
      leave.students = leave.students.filter(s => s.is_returned);
      leave.student_ids = leave.students.map(s => s.student_id);
      leave.total_students = leave.students.length;
      leave.status = 'Returned';

      for (const s of awayStudents) {
        if (s.student_id) {
          await this.updateStudent(s.student_id, { status: 'Active', hostel_status: 'resident' });
        }
      }
    } else {
      return this.deleteLeaveRecord(leave_id);
    }

    this.set('tps_leaves', leaves);
    await this.pushCloudKey('tps_leaves', leaves);
    this.logAudit('DELETE_AWAY_PASS', 'student_leave_records', leave.id, 'Cancelled away pass for remaining students');
    return leave;
  }

  async recordBatchReturn({
    leave_id,
    student_ids,
    actual_return_date,
    actual_return_time,
    remarks = '',
    fine_payment_status = null, // 'paid', 'partial', 'unpaid', 'none'
    custom_fine_amount = null,
    fine_paid_amount = null,
    payment_method = 'Cash',
    reference_number = '',
    recorded_by = 'Hostel Office'
  }) {
    await this.pullCloudKeys(['tps_leaves', 'tps_students', 'tps_fine_payments'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_id || l.leave_code === leave_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    const isHourly = leave.fine_unit === 'hour' || leave.fine_unit === 'hourly' || (leave.fine_unit !== 'daily' && !leave.fine_per_day);
    const rate = isHourly
      ? Number(leave.fine_per_hour_applied || leave.fine_per_hour || 5)
      : Number(leave.fine_per_day_applied || leave.fine_per_day || 100);

    const calc = this.calculateReturnLate(
      leave.expected_return_date,
      leave.expected_return_time || '18:00',
      actual_return_date,
      actual_return_time || '18:00',
      rate,
      isHourly ? 'hour' : 'daily'
    );

    const perStudentFine = (custom_fine_amount !== null && custom_fine_amount !== undefined && !isNaN(custom_fine_amount))
      ? Number(custom_fine_amount)
      : calc.fineAmount;

    const count = student_ids.length;
    const totalAssessedFine = perStudentFine * count;

    let normalizedStatus = fine_payment_status;
    if (normalizedStatus === 'full') normalizedStatus = 'paid';
    if (!normalizedStatus) {
      normalizedStatus = perStudentFine > 0 ? 'unpaid' : 'none';
    }

    let totalPaid = 0;
    if (normalizedStatus === 'paid') {
      totalPaid = totalAssessedFine;
    } else if (normalizedStatus === 'partial') {
      totalPaid = (fine_paid_amount !== null && fine_paid_amount !== undefined && !isNaN(fine_paid_amount) && Number(fine_paid_amount) > 0)
        ? Math.min(totalAssessedFine, Number(fine_paid_amount))
        : Math.floor(totalAssessedFine / 2);
    } else {
      totalPaid = 0;
    }

    const perStudentPaid = count > 0 ? Math.round((totalPaid / count) * 100) / 100 : 0;
    const targetIds = new Set(student_ids);
    const batchId = 'batch-' + Date.now();
    const nowIso = new Date().toISOString();
    const finePayments = this.get('tps_fine_payments') || [];

    if (Array.isArray(leave.students)) {
      leave.students.forEach(s => {
        if (targetIds.has(s.student_id)) {
          s.is_returned = true;
          s.actual_return_date = actual_return_date;
          s.actual_return_time = actual_return_time;
          s.batch_id = batchId;
          s.late_days = calc.lateDays;
          s.late_hours = calc.lateHours;
          s.fine_amount = perStudentFine;
          s.fine_paid_amount = perStudentPaid;
          s.fine_remaining_amount = Math.max(0, perStudentFine - perStudentPaid);
          s.fine_status = (perStudentPaid >= perStudentFine && perStudentFine > 0)
            ? 'paid'
            : (perStudentPaid > 0 ? 'partial' : (perStudentFine > 0 ? 'unpaid' : 'none'));
          if (perStudentPaid > 0) {
            s.fine_paid_at = nowIso;
            s.fine_cleared_by = recorded_by;
            s.fine_payment_method = payment_method;
          }
          s.black_marks = calc.blackMarks;
          s.return_remarks = remarks;

          // Record fine payment receipt in tps_fine_payments if payment was made
          if (perStudentPaid > 0) {
            finePayments.push({
              id: 'fp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              leave_record_id: leave.id,
              leave_code: leave.leave_code || leave.id,
              student_id: s.student_id,
              student_name: s.student_name || '',
              amount: perStudentPaid,
              payment_date: actual_return_date || nowIso.split('T')[0],
              payment_method,
              reference_number,
              receipt_number: 'RCPT-' + Date.now().toString().slice(-6),
              recorded_by,
              payment_type: s.fine_status === 'paid' ? 'Full' : 'Partial',
              notes: reference_number || remarks || 'Batch arrival fine payment'
            });
          }
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

    // Recalculate parent leave totals across all students
    if (Array.isArray(leave.students)) {
      leave.calculated_fine = leave.students.reduce((sum, s) => sum + (Number(s.fine_amount) || 0), 0);
      leave.fine_paid_amount = leave.students.reduce((sum, s) => sum + (Number(s.fine_paid_amount) || 0), 0);
      leave.fine_remaining_amount = leave.students.reduce((sum, s) => sum + (Number(s.fine_remaining_amount) || 0), 0);
      if (leave.fine_paid_amount >= leave.calculated_fine && leave.calculated_fine > 0) {
        leave.fine_status = 'paid';
      } else if (leave.fine_paid_amount > 0) {
        leave.fine_status = 'partial';
      } else if (leave.calculated_fine > 0) {
        leave.fine_status = 'unpaid';
      }
    }

    // Reactivate returning students
    for (const sid of student_ids) {
      await this.updateStudent(sid, { status: 'Active', hostel_status: 'resident' });

      if (perStudentFine > 0) {
        const fnNo = `FN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const fines = this.get('tps_fines') || [];
        fines.unshift({
          id: 'fine-' + Date.now() + Math.random().toString(36).substring(2, 5),
          fine_no: fnNo,
          student_id: sid,
          leave_id: leave.id,
          category_name: 'Late Hostel Return',
          amount: perStudentFine,
          paid_amount: perStudentPaid,
          late_days: calc.lateDays,
          black_marks: calc.blackMarks,
          reason: `${calc.lateDays > 0 ? calc.lateDays + ' days' : (calc.lateHours || 1) + ' hours'} late return from batch leave (${leave.leave_code || leave.leave_register_number})`,
          issue_date: actual_return_date,
          status: (perStudentPaid >= perStudentFine) ? 'paid' : (perStudentPaid > 0 ? 'partial' : 'pending'),
          issued_by: recorded_by || 'Warden Office'
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
          issued_by: recorded_by || 'Warden Office'
        });
        this.set('tps_black_marks', blackMarks);
      }
    }

    this.set('tps_leaves', leaves);
    this.set('tps_fine_payments', finePayments);
    await this.pushCloudKey('tps_leaves', leaves);
    await this.pushCloudKey('tps_fine_payments', finePayments);
    this.logAudit('RECORD_BATCH_RETURN', 'student_leave_records', leave_id, `Batch return recorded for ${student_ids.length} student(s) (Fine: ₹${totalAssessedFine}, Paid: ₹${totalPaid})`);
    return leave;
  }


  reconcileStudentLeaveStatuses(providedStudents = null) {
    const leaves = this.get('tps_leaves') || [];
    let students = providedStudents || this.get('tps_students') || [];
    if (!Array.isArray(students) || students.length === 0) return students;

    const todayIso = getTodayDateStr();

    // Find all student IDs that are genuinely on an active, unreturned leave
    const genuinelyAwayIds = new Set();
    leaves.forEach(l => {
      const status = (l.status || '').toLowerCase();
      if (status === 'pending' || status === 'rejected' || status === 'cancelled' || status === 'returned') return;
      const departs = l.departure_date || l.leaving_date;
      if (departs && departs > todayIso) return; // advance approved leave

      if (Array.isArray(l.students) && l.students.length > 0) {
        l.students.forEach(s => {
          if (!s.is_returned && s.student_id) genuinelyAwayIds.add(s.student_id);
        });
      } else {
        const sIds = Array.isArray(l.student_ids) && l.student_ids.length > 0 ? l.student_ids : [l.student_id];
        sIds.forEach(id => { if (id) genuinelyAwayIds.add(id); });
      }
    });

    let hasChange = false;
    const reconciled = students.map(s => {
      if ((s.status === 'On Approved Leave' || s.status === 'Away') && !genuinelyAwayIds.has(s.id)) {
        hasChange = true;
        return { ...s, status: 'Active', hostel_status: 'resident' };
      }
      return s;
    });

    if (hasChange) {
      this.set('tps_students', reconciled);
      this.setStorageItem('tps_students', JSON.stringify(reconciled));
      this._studentsCache = reconciled;
      this._studentsCacheTime = Date.now();
      if (this.supabase) {
        const fixedIds = reconciled.filter((s, idx) => s.status !== students[idx]?.status).map(s => s.id);
        if (fixedIds.length > 0) {
          this.supabase.from('students').update({ status: 'Active', hostel_status: 'resident' }).in('id', fixedIds).then(() => {}).catch(err => console.warn('Supabase reconcile sync warning:', err));
        }
      }
    }

    return reconciled;
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
      fines[idx].paid_date = paidDate || getTodayDateStr();
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

  async getFinePayments(filter = {}) {
    await this.pullCloudKeys(['tps_fine_payments'], false);
    let payments = this.get('tps_fine_payments') || [];
    if (filter.leave_id) {
      payments = payments.filter(p => p.leave_record_id === filter.leave_id || p.leave_code === filter.leave_id);
    }
    if (filter.student_id) {
      payments = payments.filter(p => p.student_id === filter.student_id);
    }
    return payments;
  }

  async recordFinePayment(leave_record_id, amount, payment_method = 'Cash', reference_number = '', recorded_by = 'Hostel Office', target_student_id = null) {
    await this.pullCloudKeys(['tps_leaves', 'tps_fine_payments'], true);
    const leaves = this.get('tps_leaves') || [];
    const idx = leaves.findIndex(l => l.id === leave_record_id || l.leave_code === leave_record_id);
    if (idx === -1) throw new Error('Leave record not found');

    const leave = leaves[idx];
    const totalDue = Number(leave.calculated_fine) || 0;
    const prevPaid = Number(leave.fine_paid_amount) || 0;

    let targetStudent = null;
    if (Array.isArray(leave.students) && target_student_id) {
      targetStudent = leave.students.find(s => s.student_id === target_student_id);
    }

    const stFineTotal = targetStudent ? (Number(targetStudent.fine_amount !== undefined ? targetStudent.fine_amount : totalDue) || 0) : totalDue;
    const stPrevPaid = targetStudent ? (Number(targetStudent.fine_paid_amount) || 0) : prevPaid;
    const stRemainingBefore = Math.max(0, stFineTotal - stPrevPaid);

    const paidAmt = (amount !== null && amount !== undefined && !isNaN(amount) && Number(amount) > 0)
      ? Number(amount)
      : stRemainingBefore;

    if (targetStudent) {
      const newStPaid = stPrevPaid + paidAmt;
      targetStudent.fine_paid_amount = newStPaid;
      targetStudent.fine_remaining_amount = Math.max(0, stFineTotal - newStPaid);
      targetStudent.fine_status = (newStPaid >= stFineTotal) ? 'paid' : (newStPaid > 0 ? 'partial' : 'unpaid');
      targetStudent.fine_paid_at = new Date().toISOString();
      targetStudent.fine_cleared_by = recorded_by;
      targetStudent.fine_payment_method = payment_method;

      // Update parent leave totals across students
      leave.fine_paid_amount = leave.students.reduce((sum, s) => sum + (Number(s.fine_paid_amount) || 0), 0);
      leave.fine_remaining_amount = leave.students.reduce((sum, s) => sum + (Number(s.fine_remaining_amount) || 0), 0);
      const allStudentsPaid = leave.students.every(s => (Number(s.fine_remaining_amount) || 0) <= 0);
      leave.fine_status = allStudentsPaid ? 'paid' : (leave.fine_paid_amount > 0 ? 'partial' : 'unpaid');
      leave.fine_paid_at = new Date().toISOString();
      leave.fine_cleared_by = recorded_by;
    } else {
      const newPaidTotal = prevPaid + paidAmt;
      const isFull = newPaidTotal >= totalDue;
      leave.fine_status = isFull ? 'paid' : (newPaidTotal > 0 ? 'partial' : 'unpaid');
      leave.fine_paid_at = new Date().toISOString();
      leave.fine_paid_amount = newPaidTotal;
      leave.fine_remaining_amount = Math.max(0, totalDue - newPaidTotal);
      leave.fine_cleared_by = recorded_by;
      leave.fine_payment_method = payment_method;

      if (Array.isArray(leave.students)) {
        leave.students.forEach(s => {
          s.fine_status = isFull ? 'paid' : 'partial';
          s.fine_paid_at = leave.fine_paid_at;
          s.fine_cleared_by = recorded_by;
          s.fine_payment_method = payment_method;
        });
      }
    }

    this.set('tps_leaves', leaves);

    const payments = this.get('tps_fine_payments') || [];
    const newPayment = {
      id: 'fp-' + Date.now(),
      leave_record_id: leave.id,
      leave_code: leave.leave_code || leave.id,
      student_id: target_student_id || leave.student_id || (Array.isArray(leave.student_ids) ? leave.student_ids[0] : null),
      student_name: targetStudent?.student_name || leave.student_name || '',
      amount: paidAmt,
      payment_date: getTodayDateStr(),
      payment_method,
      reference_number,
      receipt_number: 'RCPT-' + Date.now().toString().slice(-6),
      recorded_by,
      payment_type: (targetStudent ? ((targetStudent.fine_paid_amount >= stFineTotal) ? 'Full' : 'Partial') : ((leave.fine_paid_amount >= totalDue) ? 'Full' : 'Partial')),
      notes: reference_number || ''
    };
    payments.push(newPayment);
    this.set('tps_fine_payments', payments);
    await this.pushCloudKey('tps_leaves', leaves);
    await this.pushCloudKey('tps_fine_payments', payments);
    this.logAudit('FINE_PAYMENT', 'fine_payments', newPayment.id, `Fine payment of ₹${newPayment.amount} (${newPayment.payment_type}) received via ${payment_method} by ${recorded_by}`);
    return newPayment;
  }

  async clearFineRecord(leave_record_id, { cleared_by = 'Hostel Administrator', remarks = 'Cleared by Admin' } = {}) {
    return this.recordFinePayment(leave_record_id, null, 'Cash', remarks, cleared_by);
  }

  // --- DISCIPLINE FINE SETTLEMENT ---
  async settleDisciplineFine(incident_id, {
    amount,
    payment_method = 'Cash',
    reference_number = '',
    received_by = 'Hostel Office',
    remarks = ''
  } = {}) {
    const incidents = this.get('tps_discipline') || [];
    const idx = incidents.findIndex(d => d.id === incident_id);
    if (idx < 0) throw new Error('Discipline incident not found');

    const incident = incidents[idx];
    const totalFine = Number(incident.monetary_fine) || 0;
    const prevPaid = Number(incident.fine_paid_amount) || 0;
    const payNow = Number(amount) || totalFine;
    const paidAmount = payNow;
    const cumulativePaid = prevPaid + payNow;
    const isFull = cumulativePaid >= totalFine;
    const remaining = Math.max(0, totalFine - cumulativePaid);

    incidents[idx] = {
      ...incident,
      fine_payment_status: isFull ? 'paid' : 'partial',
      fine_paid_amount: cumulativePaid,
      fine_remaining_amount: remaining,
      fine_paid_at: new Date().toISOString(),
      fine_paid_by: received_by,
      fine_payment_method: payment_method,
      fine_payment_reference: reference_number,
      fine_payment_remarks: remarks,
      updated_at: new Date().toISOString()
    };
    this.set('tps_discipline', incidents);

    // Also update the linked tps_fines record if it exists
    const fines = this.get('tps_fines') || [];
    const fineIdx = fines.findIndex(f => f.incident_id === incident_id);
    if (fineIdx >= 0) {
      fines[fineIdx].status = isFull ? 'paid' : 'partial';
      fines[fineIdx].paid_amount = cumulativePaid;
      fines[fineIdx].remaining_amount = remaining;
      fines[fineIdx].paid_date = getTodayDateStr();
      fines[fineIdx].received_by = received_by;
      this.set('tps_fines', fines);
    }

    // Log in dedicated discipline payments ledger
    const payments = this.get('tps_discipline_fine_payments') || [];
    const receipt_no = 'DISC-RCPT-' + Date.now().toString().slice(-7);
    const newPayment = {
      id: 'dfp-' + Date.now(),
      incident_id,
      student_id: incident.student_id,
      amount: paidAmount,
      payment_date: getTodayDateStr(),
      payment_method,
      reference_number,
      receipt_no,
      receipt_number: receipt_no,
      received_by,
      remarks,
      created_at: new Date().toISOString()
    };
    payments.unshift(newPayment);
    this.set('tps_discipline_fine_payments', payments);

    this.logAudit('DISCIPLINE_FINE_PAID', 'discipline_fine_payments', newPayment.id,
      `Fine of ₹${paidAmount} settled for incident ${incident_id} by ${received_by} via ${payment_method}`);
    return { ...incidents[idx], incident: incidents[idx], payment: newPayment };
  }

  async getDisciplineFinePayments(studentId = null) {
    const payments = this.get('tps_discipline_fine_payments') || [];
    return studentId ? payments.filter(p => p.student_id === studentId) : payments;
  }

  async getDisciplineFinePaymentsByIncident(incidentId) {
    const payments = this.get('tps_discipline_fine_payments') || [];
    return incidentId ? payments.filter(p => p.incident_id === incidentId) : payments;
  }

  // --- DISCIPLINE & BLACK MARKS ---
  async getDisciplineIncidents() {
    await this.pullCloudKeys(['tps_discipline', 'tps_discipline_fine_payments'], false);
    return this.get('tps_discipline') || [];
  }

  async logDisciplineIncident({ student_id, category, severity, incident_date, description, black_marks, fine, action_taken, reported_by }) {
    await this.pullCloudKeys(['tps_discipline', 'tps_fines', 'tps_black_marks'], false);
    const incidents = this.get('tps_discipline') || [];
    const monetaryFine = Number(fine) || 0;
    const newInc = {
      id: 'disc-' + Date.now(),
      student_id,
      category,
      severity: severity || 'Minor',
      incident_date: incident_date || getTodayDateStr(),
      description,
      black_marks_awarded: Number(black_marks) || 1,
      monetary_fine: monetaryFine,
      fine_payment_status: monetaryFine > 0 ? 'unpaid' : 'none',
      fine_paid_amount: 0,
      fine_remaining_amount: monetaryFine,
      action_taken,
      reported_by: reported_by || 'Staff',
      resolution_status: 'Open'
    };
    incidents.unshift(newInc);
    this.set('tps_discipline', incidents);

    // Update student's cumulative black marks
    const students = await this.getStudents();
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


  async updateDisciplineIncident(incident_id, updates = {}) {
    const incidents = this.get('tps_discipline') || [];
    const idx = incidents.findIndex(d => d.id === incident_id);
    if (idx < 0) {
      throw new Error('Discipline incident not found');
    }
    incidents[idx] = {
      ...incidents[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.set('tps_discipline', incidents);
    this.logAudit('UPDATE_INCIDENT', 'discipline_incidents', incident_id, 'Updated incident status/details');
    return incidents[idx];
  }

  async deleteDisciplineIncident(incident_id) {
    const incidents = this.get('tps_discipline') || [];
    const idx = incidents.findIndex(d => d.id === incident_id);
    if (idx < 0) {
      throw new Error('Discipline incident not found');
    }
    const [deleted] = incidents.splice(idx, 1);
    this.set('tps_discipline', incidents);

    // Roll back student black marks
    if (deleted.student_id && deleted.black_marks_awarded > 0) {
      const students = this.get('tps_students') || [];
      const sidx = students.findIndex(s => s.id === deleted.student_id);
      if (sidx >= 0) {
        students[sidx].black_marks = Math.max(0, (students[sidx].black_marks || 0) - deleted.black_marks_awarded);
        this.set('tps_students', students);
      }
    }

    // Remove associated fine if any
    const fines = this.get('tps_fines') || [];
    const filteredFines = fines.filter(f => f.incident_id !== incident_id);
    this.set('tps_fines', filteredFines);

    // Remove associated black mark ledger entry
    const blackMarks = this.get('tps_black_marks') || [];
    const filteredBM = blackMarks.filter(bm => bm.incident_id !== incident_id);
    this.set('tps_black_marks', filteredBM);

    this.logAudit('DELETE_INCIDENT', 'discipline_incidents', incident_id, `Deleted incident ${incident_id} and reversed penalties`);
    return deleted;
  }

  // --- EXAMINATIONS & MARKS ---
  async getExams() {
    const exams = this.get('tps_exams') || [];
    return exams;
  }

  async getExamSubjects(exam_id) {
    const subjects = this.get('tps_exam_subjects') || [];
    return exam_id ? subjects.filter(s => s.exam_id === exam_id) : subjects;
  }

  async getMarks(exam_id) {
    const marks = this.get('tps_marks') || [];
    return exam_id ? marks.filter(m => m.exam_id === exam_id) : marks;
  }

  async saveExam(examData) {
    const exams = this.get('tps_exams') || [];
    const idx = exams.findIndex(e => e.id === examData.id);
    if (idx >= 0) {
      exams[idx] = { ...exams[idx], ...examData, updated_at: new Date().toISOString() };
    } else {
      exams.push({
        max_marks: 100,
        passing_marks: 40,
        theory_max: 80,
        practical_max: 20,
        is_published: false,
        publish_ranks: true,
        ranking_policy: 'standard',
        ...examData,
        created_at: new Date().toISOString()
      });
    }
    this.set('tps_exams', exams);
    this.logAudit('EXAM_SAVED', 'examinations', examData.id, `Saved examination: ${examData.title}`);
    return exams;
  }

  async deleteExam(exam_id) {
    let exams = this.get('tps_exams') || [];
    exams = exams.filter(e => e.id !== exam_id);
    this.set('tps_exams', exams);

    let subjects = this.get('tps_exam_subjects') || [];
    subjects = subjects.filter(s => s.exam_id !== exam_id);
    this.set('tps_exam_subjects', subjects);

    let marks = this.get('tps_marks') || [];
    marks = marks.filter(m => m.exam_id !== exam_id);
    this.set('tps_marks', marks);

    this.logAudit('EXAM_DELETED', 'examinations', exam_id, `Deleted examination ${exam_id}`);
    return exams;
  }

  async saveExamSubjects(exam_id, subjectsArray) {
    let allSubjects = this.get('tps_exam_subjects') || [];
    allSubjects = allSubjects.filter(s => s.exam_id !== exam_id);
    for (const sub of subjectsArray) {
      allSubjects.push({
        id: sub.id || 'es-' + Date.now() + Math.random().toString(36).substr(2, 5),
        exam_id,
        subject: sub.subject,
        max_marks: Number(sub.max_marks) || 100,
        passing_marks: Number(sub.passing_marks) || 40,
        theory_max: Number(sub.theory_max) || 80,
        practical_max: Number(sub.practical_max) || 20
      });
    }
    this.set('tps_exam_subjects', allSubjects);
    return allSubjects;
  }

  async saveMarks(marksArray) {
    const existing = this.get('tps_marks') || [];
    for (const m of marksArray) {
      const idx = existing.findIndex(item => item.exam_id === m.exam_id && item.student_id === m.student_id && item.subject === m.subject);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...m };
      } else {
        existing.push({ id: 'm-' + Date.now() + Math.random().toString(36).substr(2, 6), ...m });
      }
    }
    this.set('tps_marks', existing);
    this.logAudit('MARKS_SAVED', 'exam_marks', marksArray[0]?.exam_id, `Updated ${marksArray.length} marks records`);
    return existing;
  }

  async publishResults(exam_id, options = {}) {
    const exams = this.get('tps_exams') || [];
    const idx = exams.findIndex(e => e.id === exam_id);
    if (idx >= 0) {
      exams[idx].is_published = true;
      exams[idx].published_at = new Date().toISOString();
      if (options.publish_ranks !== undefined) {
        exams[idx].publish_ranks = !!options.publish_ranks;
      }
      if (options.publish_until !== undefined) {
        exams[idx].publish_until = options.publish_until;
      }
      this.set('tps_exams', exams);

      // Mark all student scores as published
      const marks = this.get('tps_marks') || [];
      marks.forEach(m => {
        if (m.exam_id === exam_id) m.status = 'Published';
      });
      this.set('tps_marks', marks);
      this.logAudit('PUBLISH_RESULTS', 'examinations', exam_id, `Published examination results`);
      return exams[idx];
    }
    return null;
  }

  async unpublishResults(exam_id) {
    const exams = this.get('tps_exams') || [];
    const idx = exams.findIndex(e => e.id === exam_id);
    if (idx >= 0) {
      exams[idx].is_published = false;
      this.set('tps_exams', exams);

      const marks = this.get('tps_marks') || [];
      marks.forEach(m => {
        if (m.exam_id === exam_id) m.status = 'Draft';
      });
      this.set('tps_marks', marks);
      this.logAudit('UNPUBLISH_RESULTS', 'examinations', exam_id, `Unpublished examination results to draft`);
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
        await this.pullCloudKeys(['tps_user_passwords', 'tps_parent_assignments', 'tps_vehicle_head_assignments']);
        const passwordsMap = this.get('tps_user_passwords') || {};
        const parentAssignmentsMap = this.get('tps_parent_assignments') || {};
        const vehicleHeadAssignmentsMap = this.get('tps_vehicle_head_assignments') || {};

        if (supabase) {
          try {
            // 1. Fetch full remote profiles including metadata
            let remoteProfiles = [];
            try {
              const { data: profs, error: pErr } = await supabase.from('profiles').select('*');
              if (!pErr && Array.isArray(profs) && profs.length > 0) {
                remoteProfiles = profs;
              }
            } catch (pEx) {
              console.warn('Supabase profiles fetch in getUsers:', pEx);
            }

            const profilesById = new Map();
            remoteProfiles.forEach(p => {
              if (p.id) profilesById.set(p.id, p);
              if (p.email) profilesById.set(p.email.toLowerCase(), p);
            });

            // 2. Fetch manageable users via RPC or fallback to remoteProfiles
            const { data, error } = await supabase.rpc('get_manageable_users');
            const sourceUsers = (!error && Array.isArray(data) && data.length > 0)
              ? data
              : (remoteProfiles.length > 0 ? remoteProfiles : []);

            if (sourceUsers.length > 0) {
              const cleanRemote = !isTestEnv 
                ? sourceUsers.filter(u => !isDummyOrTestUser(u, true))
                : sourceUsers;
              const localUsers = !isTestEnv
                ? (this.get('tps_users') || []).filter(u => u && !isDummyOrTestUser(u, true))
                : (this.get('tps_users') || []);
              const remoteEmails = new Set(cleanRemote.map(u => (u.email || '').toLowerCase()));
              let combined = [
                ...cleanRemote,
                ...localUsers.filter(lu => !remoteEmails.has((lu.email || '').toLowerCase()) && lu.id !== 'u-pending')
              ];

              // Enrich all users with profiles metadata, passwords, and assigned student IDs
              combined.forEach(u => {
                const localMatch = localUsers.find(lu => lu.id === u.id || (lu.email && u.email && lu.email.toLowerCase() === u.email.toLowerCase()));
                const prof = profilesById.get(u.id) || (u.email && profilesById.get(u.email.toLowerCase()));
                const meta = {
                  ...(prof?.metadata || {}),
                  ...(localMatch?.metadata || {}),
                  ...(u.metadata || {})
                };
                u.metadata = meta;

                // Sync basic fields if missing
                if (!u.phone && (prof?.phone || localMatch?.phone)) u.phone = prof?.phone || localMatch?.phone;
                if (!u.phone_number && (prof?.phone || localMatch?.phone_number || localMatch?.phone)) u.phone_number = prof?.phone || localMatch?.phone_number || localMatch?.phone;
                if (!u.blood_group && (prof?.blood_group || localMatch?.blood_group)) u.blood_group = prof?.blood_group || localMatch?.blood_group;
                if (!u.tps_id && (prof?.tps_id || localMatch?.tps_id)) u.tps_id = prof?.tps_id || localMatch?.tps_id;
                if (!u.avatar_url && (prof?.avatar_url || localMatch?.avatar_url)) u.avatar_url = prof?.avatar_url || localMatch?.avatar_url;

                // Enrich parent assigned students
                const cloudAssigned = parentAssignmentsMap[u.id] || (u.email && parentAssignmentsMap[u.email.toLowerCase()]);
                const childIds = u.assigned_student_ids || 
                                 meta.assigned_student_ids || 
                                 meta.student_ids || 
                                 meta.child_ids || 
                                 cloudAssigned || 
                                 localMatch?.assigned_student_ids || 
                                 localMatch?.student_ids || 
                                 localMatch?.child_ids || 
                                 [];
                if (Array.isArray(childIds) && childIds.length > 0) {
                  u.assigned_student_ids = childIds;
                  u.student_ids = childIds;
                  u.child_ids = childIds;
                  meta.assigned_student_ids = childIds;
                  meta.student_ids = childIds;
                  meta.child_ids = childIds;
                  parentAssignmentsMap[u.id] = childIds;
                  if (u.email) parentAssignmentsMap[u.email.toLowerCase()] = childIds;
                }

                // Enrich vehicle department head assigned vehicles
                const cloudVehicles = vehicleHeadAssignmentsMap[u.id] || (u.email && vehicleHeadAssignmentsMap[u.email.toLowerCase()]);
                const assignedVehs = u.assigned_vehicle_ids ||
                                     meta.assigned_vehicle_ids ||
                                     meta.vehicle_ids ||
                                     cloudVehicles ||
                                     localMatch?.assigned_vehicle_ids ||
                                     localMatch?.vehicle_ids ||
                                     [];
                if (Array.isArray(assignedVehs) && assignedVehs.length > 0) {
                  u.assigned_vehicle_ids = assignedVehs;
                  u.vehicle_ids = assignedVehs;
                  meta.assigned_vehicle_ids = assignedVehs;
                  meta.vehicle_ids = assignedVehs;
                  vehicleHeadAssignmentsMap[u.id] = assignedVehs;
                  if (u.email) vehicleHeadAssignmentsMap[u.email.toLowerCase()] = assignedVehs;
                }

                // Enrich mentor properties
                if (meta.mentor_type && !u.mentor_type) u.mentor_type = meta.mentor_type;
                if (meta.hostel_unit && !u.hostel_unit) u.hostel_unit = meta.hostel_unit;
                if (meta.gender && !u.gender) u.gender = meta.gender;

                // Enrich securely stored passwords
                const storedPw = passwordsMap[u.id] || 
                                 (u.email && passwordsMap[u.email.toLowerCase()]) || 
                                 meta.password || 
                                 localMatch?.password || 
                                 u.password;
                if (storedPw) {
                  u.password = storedPw;
                  u.has_password = true;
                  u.password_updated_at = passwordsMap[u.id + '_at'] || meta.password_updated_at || localMatch?.password_updated_at || u.password_updated_at;
                }
              });

              if (!isTestEnv) {
                combined = combined.filter(u => !isDummyOrTestUser(u, true));
              }

              this.set('tps_parent_assignments', parentAssignmentsMap);
              this.set('tps_vehicle_head_assignments', vehicleHeadAssignmentsMap);
              this._usersCache = combined;
              this._usersCacheTime = Date.now();
              return combined;
            }
          } catch (err) {
            console.warn('Supabase get_manageable_users fallback:', err);
          }
        }

        let res = !isTestEnv
          ? (this.get('tps_users') || []).filter(u => u && !isDummyOrTestUser(u, true))
          : (this.get('tps_users') || []);

        res.forEach(u => {
          const meta = u.metadata || {};
          const cloudAssigned = parentAssignmentsMap[u.id] || (u.email && parentAssignmentsMap[u.email.toLowerCase()]);
          const childIds = u.assigned_student_ids || 
                           meta.assigned_student_ids || 
                           meta.student_ids || 
                           meta.child_ids || 
                           cloudAssigned || 
                           [];
          if (Array.isArray(childIds) && childIds.length > 0) {
            u.assigned_student_ids = childIds;
            u.student_ids = childIds;
            u.child_ids = childIds;
            meta.assigned_student_ids = childIds;
          }

          const cloudVehicles = vehicleHeadAssignmentsMap[u.id] || (u.email && vehicleHeadAssignmentsMap[u.email.toLowerCase()]);
          const assignedVehs = u.assigned_vehicle_ids ||
                               meta.assigned_vehicle_ids ||
                               meta.vehicle_ids ||
                               cloudVehicles ||
                               [];
          if (Array.isArray(assignedVehs) && assignedVehs.length > 0) {
            u.assigned_vehicle_ids = assignedVehs;
            u.vehicle_ids = assignedVehs;
            meta.assigned_vehicle_ids = assignedVehs;
            meta.vehicle_ids = assignedVehs;
          }

          const storedPw = passwordsMap[u.id] || 
                           (u.email && passwordsMap[u.email.toLowerCase()]) || 
                           meta.password || 
                           u.password;
          if (storedPw) {
            u.password = storedPw;
            u.has_password = true;
            u.password_updated_at = passwordsMap[u.id + '_at'] || meta.password_updated_at || u.password_updated_at;
          }
        });

        if (!isTestEnv) {
          res = res.filter(u => !isDummyOrTestUser(u, true));
        }

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

  getUserPassword(user_id, user_email = '') {
    const passwordsMap = this.get('tps_user_passwords') || {};
    if (user_id && passwordsMap[user_id]) return passwordsMap[user_id];
    if (user_email && passwordsMap[user_email.toLowerCase()]) return passwordsMap[user_email.toLowerCase()];
    const users = this.get('tps_users') || [];
    const u = users.find(x => (user_id && x.id === user_id) || (user_email && x.email && x.email.toLowerCase() === user_email.toLowerCase()));
    if (u?.password) return u.password;
    if (u?.metadata?.password) return u.metadata.password;
    return '';
  }

  async setUserPassword(user_id, new_password, user_email = '') {
    if (!user_id || !new_password) {
      throw new Error('User ID and password are required');
    }
    const cleanPw = String(new_password).trim();
    if (cleanPw.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
    const nowIso = new Date().toISOString();

    // 1. Persist in cloud & local passwords dictionary
    const passwordsMap = this.get('tps_user_passwords') || {};
    passwordsMap[user_id] = cleanPw;
    passwordsMap[user_id + '_at'] = nowIso;
    if (user_email) {
      passwordsMap[user_email.toLowerCase()] = cleanPw;
      passwordsMap[user_email.toLowerCase() + '_at'] = nowIso;
    }
    this.set('tps_user_passwords', passwordsMap);
    await this.pushCloudKey('tps_user_passwords', passwordsMap);

    // 2. Update in Supabase profiles table if available
    if (supabase && isUuid) {
      try {
        const { data: prof } = await supabase.from('profiles').select('metadata').eq('id', user_id).maybeSingle();
        const prevMeta = prof?.metadata || {};
        await supabase.from('profiles').update({
          metadata: {
            ...prevMeta,
            password: cleanPw,
            has_password: true,
            password_updated_at: nowIso
          }
        }).eq('id', user_id);
      } catch (e) {
        console.warn('Supabase profiles password update error:', e);
      }

      // If Supabase auth user is logged in as this user, update auth user password directly
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === user_id) {
          await supabase.auth.updateUser({ password: cleanPw });
        }
      } catch (authErr) {
        console.warn('Supabase auth.updateUser note:', authErr);
      }
    }

    // 3. Persist in local storage `tps_users`
    const users = this.get('tps_users') || [];
    const idx = users.findIndex(u => u.id === user_id || (user_email && u.email && u.email.toLowerCase() === user_email.toLowerCase()));
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        email: users[idx].email || user_email,
        password: cleanPw,
        has_password: true,
        password_updated_at: nowIso
      };
      this.set('tps_users', users);
    } else {
      users.push({
        id: user_id,
        email: user_email,
        password: cleanPw,
        has_password: true,
        password_updated_at: nowIso
      });
      this.set('tps_users', users);
    }

    // 4. Update current active dev profile in local storage if matching
    try {
      const devProfile = JSON.parse(localStorage.getItem('tps_dev_profile') || 'null');
      if (devProfile && (devProfile.id === user_id || (user_email && devProfile.email?.toLowerCase() === user_email.toLowerCase()))) {
        devProfile.password = cleanPw;
        devProfile.has_password = true;
        devProfile.password_updated_at = nowIso;
        localStorage.setItem('tps_dev_profile', JSON.stringify(devProfile));
      }
    } catch {}

    this._usersCache = null;
    this._usersCacheTime = 0;
    this.logAudit('USER_PASSWORD_UPDATE', 'profiles', user_id, `User password set/updated for ${user_email || user_id}`);
    return { success: true, user_id, updated_at: nowIso };
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
          const assignedVehs = extra.assigned_vehicle_ids || extra.vehicle_ids;
          if (assignedVehs && Array.isArray(assignedVehs)) {
            const vMap = this.get('tps_vehicle_head_assignments') || {};
            vMap[user_id] = assignedVehs;
            if (updates.email) vMap[updates.email.toLowerCase()] = assignedVehs;
            this.set('tps_vehicle_head_assignments', vMap);
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
    const assignedVehs = extra.assigned_vehicle_ids || extra.vehicle_ids;
    if (assignedVehs && Array.isArray(assignedVehs)) {
      const vMap = this.get('tps_vehicle_head_assignments') || {};
      vMap[user_id] = assignedVehs;
      if (updates.email) vMap[updates.email.toLowerCase()] = assignedVehs;
      this.set('tps_vehicle_head_assignments', vMap);
    }
    if (role === 'vehicle_user' || role === 'driver') {
      const vUsers = this.get('tps_vehicle_users') || [];
      const userObj = users.find(u => u.id === user_id) || {};
      const exists = vUsers.some(vu => vu.id === user_id || (vu.email && userObj.email && vu.email.toLowerCase() === userObj.email.toLowerCase()));
      if (!exists) {
        const count = vUsers.length + 1;
        vUsers.push({
          id: user_id,
          tps_id: userObj.tps_id || `VUS${String(count).padStart(3, '0')}`,
          full_name: userObj.full_name || updates.full_name || 'Vehicle Driver',
          email: userObj.email || updates.email || '',
          phone: userObj.phone_number || userObj.phone || updates.phone || '',
          designation: 'Driver / Transport Staff',
          status: approval_status === 'suspended' ? 'Suspended' : 'Active',
          created_at: new Date().toISOString()
        });
        this.set('tps_vehicle_users', vUsers);
        this.pushCloudKey('tps_vehicle_users', vUsers).catch(() => {});
      }
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
    await this.pushCloudKey('tps_parent_assignments', pMap);

    // Keep tps_users up to date locally
    const users = this.get('tps_users') || [];
    const idx = users.findIndex(u => u.id === user_id || (email && (u.email || '').toLowerCase() === email.toLowerCase()));
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        assigned_student_ids: student_ids,
        student_ids,
        child_ids: student_ids,
        metadata: {
          ...(users[idx].metadata || {}),
          assigned_student_ids: student_ids,
          student_ids,
          child_ids: student_ids
        }
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
    this._usersCache = null;
    this._usersCacheTime = 0;
    this._usersInFlightPromise = null;
    return student_ids;
  }

  async getParentAssignedStudents(user_id, email = '') {
    await this.pullCloudKeys(['tps_parent_assignments']);
    const pMap = this.get('tps_parent_assignments') || {};
    if (user_id && pMap[user_id]) return pMap[user_id];
    if (email && pMap[email.toLowerCase()]) return pMap[email.toLowerCase()];
    return [];
  }

  async setVehicleHeadAssignedVehicles(user_id, vehicle_ids = [], email = '') {
    const vMap = this.get('tps_vehicle_head_assignments') || {};
    vMap[user_id] = vehicle_ids;
    if (email) vMap[email.toLowerCase()] = vehicle_ids;
    this.set('tps_vehicle_head_assignments', vMap);
    await this.pushCloudKey('tps_vehicle_head_assignments', vMap);

    // Keep tps_users up to date locally
    const users = this.get('tps_users') || [];
    const idx = users.findIndex(u => u.id === user_id || (email && (u.email || '').toLowerCase() === email.toLowerCase()));
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        assigned_vehicle_ids: vehicle_ids,
        vehicle_ids,
        metadata: {
          ...(users[idx].metadata || {}),
          assigned_vehicle_ids: vehicle_ids,
          vehicle_ids
        }
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
            assigned_vehicle_ids: vehicle_ids,
            vehicle_ids
          }
        }).eq('id', user_id);
      } catch (e) {
        console.warn('Supabase setVehicleHeadAssignedVehicles error:', e);
      }
    }
    this._usersCache = null;
    this._usersCacheTime = 0;
    this._usersInFlightPromise = null;
    return vehicle_ids;
  }

  async getVehicleHeadAssignedVehicles(user_id, email = '') {
    await this.pullCloudKeys(['tps_vehicle_head_assignments']);
    const vMap = this.get('tps_vehicle_head_assignments') || {};
    if (user_id && vMap[user_id]) return vMap[user_id];
    if (email && vMap[email.toLowerCase()]) return vMap[email.toLowerCase()];
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

  async addCalendarHoliday({ date, name, type = 'holiday', start_time = null, end_time = null, is_all_day = true, academic_year = '2026-2027' }) {
    const cal = await this.getAcademicCalendar();
    const events = Array.isArray(cal.events) ? [...cal.events] : [];
    const existingIdx = events.findIndex(e => e.date === date);
    const newEvent = {
      id: 'cal-' + Date.now(),
      date,
      name: name || (type === 'hostel_leave' ? 'Hostel Leave' : 'Institutional Holiday'),
      type: type || 'holiday',
      start_time: is_all_day ? null : start_time,
      end_time: is_all_day ? null : end_time,
      is_all_day: Boolean(is_all_day)
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

  async addCalendarHolidayRange({ startDate, endDate, name, type = 'holiday', start_time = null, end_time = null, is_all_day = true }) {
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
        name: name || (type === 'hostel_leave' ? 'Hostel Leave' : 'Institutional Holiday'),
        type: type || 'holiday',
        range_id: rangeId,
        is_range_start: isStart,
        is_range_end: isEnd,
        start_time: is_all_day ? null : start_time,
        end_time: is_all_day ? null : end_time,
        is_all_day: Boolean(is_all_day)
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
      if (custom.type === 'holiday' || custom.type === 'hostel_leave') {
        if (custom.is_all_day !== false) return false;
      }
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
    if (!dateStr) return { isWorkingDay: false, isHoliday: false, isHostelLeave: false, isSpecialWorking: false, title: '', type: 'none', start_time: null, end_time: null, is_all_day: true };
    const events = calendar?.events || [];
    const custom = events.find(e => e.date === dateStr);
    const isWork = this.isDateWorkingDay(dateStr, calendar);
    if (custom) {
      const isHol = custom.type === 'holiday' || custom.type === 'hostel_leave';
      return {
        date: dateStr,
        isWorkingDay: isWork,
        isHoliday: isHol,
        isHostelLeave: custom.type === 'hostel_leave',
        isSpecialWorking: custom.type === 'working_day',
        title: custom.name,
        type: custom.type,
        start_time: custom.start_time || null,
        end_time: custom.end_time || null,
        is_all_day: custom.is_all_day !== false
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
      isHostelLeave: false,
      isSpecialWorking: false,
      title: isWeekendOff ? `${dayOfWeek} Weekend Off` : 'Regular Working Day',
      type: isWeekendOff ? 'holiday' : 'working_day',
      start_time: null,
      end_time: null,
      is_all_day: true
    };
  }

  isClassSessionOffDueToHoliday(classObj, dateStr, calendar = INITIAL_ACADEMIC_CALENDAR) {
    if (!dateStr) return { isOff: false };
    const events = Array.isArray(calendar?.events) ? calendar.events : [];
    
    // Check matching institutional events on this date (Official Holiday or Hostel Leave)
    const matchingEvents = events.filter(e => e.date === dateStr && (e.type === 'holiday' || e.type === 'hostel_leave'));
    
    for (const ev of matchingEvents) {
      const isAllDay = ev.is_all_day !== false || (!ev.start_time && !ev.end_time);
      if (isAllDay) {
        return {
          isOff: true,
          type: ev.type,
          reason: ev.name || (ev.type === 'hostel_leave' ? 'Hostel Leave' : 'Official Holiday'),
          isAllDay: true,
          startTime: null,
          endTime: null,
          timeSpan: 'Full Day Off',
          event: ev
        };
      }

      // If event has a specific time span
      if (ev.start_time && ev.end_time) {
        const clsStart = classObj?.start_time || '00:00';
        const clsEnd = classObj?.end_time || '23:59';
        
        const toMin = (t) => {
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        
        const cStart = toMin(clsStart);
        const cEnd = toMin(clsEnd);
        const evStart = toMin(ev.start_time);
        const evEnd = toMin(ev.end_time);

        // Check if class time window overlaps with holiday/leave off time window
        if (cStart < evEnd && cEnd > evStart) {
          const formatT = (t) => {
            const [h, m] = (t || '00:00').split(':').map(Number);
            const period = (h || 0) >= 12 ? 'PM' : 'AM';
            const h12 = (h || 0) % 12 || 12;
            return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
          };
          return {
            isOff: true,
            type: ev.type,
            reason: ev.name || (ev.type === 'hostel_leave' ? 'Hostel Leave' : 'Official Holiday'),
            isAllDay: false,
            startTime: ev.start_time,
            endTime: ev.end_time,
            timeSpan: `${formatT(ev.start_time)} – ${formatT(ev.end_time)}`,
            event: ev
          };
        }
      }
    }



    return { isOff: false };
  }

  isStudentActive(studentOrStatus) {
    return isStudentActive(studentOrStatus);
  }

  // --- VEHICLE & FLEET MANAGEMENT ---
  async getVehicles() {
    await this.pullCloudKeys(['tps_vehicles'], false);
    return this.get('tps_vehicles') || [];
  }

  async saveVehicle(vehicleData) {
    const list = this.get('tps_vehicles') || [];
    let saved;
    if (vehicleData.id) {
      const idx = list.findIndex(v => v.id === vehicleData.id);
      if (idx >= 0) {
        saved = { ...list[idx], ...vehicleData, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...vehicleData, created_at: vehicleData.created_at || new Date().toISOString() };
        list.push(saved);
      }
    } else {
      saved = {
        id: 'veh-' + Date.now(),
        ...vehicleData,
        created_at: new Date().toISOString()
      };
      list.push(saved);
    }
    this.set('tps_vehicles', list);
    await this.pushCloudKey('tps_vehicles', list);
    return saved;
  }

  async deleteVehicle(id) {
    const list = this.get('tps_vehicles') || [];
    const filtered = list.filter(v => v.id !== id);
    this.set('tps_vehicles', filtered);
    await this.pushCloudKey('tps_vehicles', filtered);
    return true;
  }

  // --- VEHICLE DOCUMENTS ---
  async getVehicleDocuments(vehicleId = null) {
    await this.pullCloudKeys(['tps_vehicle_documents'], false);
    const docs = this.get('tps_vehicle_documents') || [];
    if (vehicleId) {
      return docs.filter(d => d.vehicle_id === vehicleId);
    }
    return docs;
  }

  async saveVehicleDocument(docData) {
    const list = this.get('tps_vehicle_documents') || [];
    let saved;
    if (docData.id) {
      const idx = list.findIndex(d => d.id === docData.id);
      if (idx >= 0) {
        saved = { ...list[idx], ...docData, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...docData, created_at: docData.created_at || new Date().toISOString() };
        list.push(saved);
      }
    } else {
      saved = {
        id: 'vdoc-' + Date.now(),
        ...docData,
        created_at: new Date().toISOString()
      };
      list.push(saved);
    }
    this.set('tps_vehicle_documents', list);
    await this.pushCloudKey('tps_vehicle_documents', list);
    return saved;
  }

  async deleteVehicleDocument(id) {
    const list = this.get('tps_vehicle_documents') || [];
    const filtered = list.filter(d => d.id !== id);
    this.set('tps_vehicle_documents', filtered);
    await this.pushCloudKey('tps_vehicle_documents', filtered);
    return true;
  }

  // --- VEHICLE EXPENSES ---
  async getVehicleExpenses(vehicleId = null) {
    await this.pullCloudKeys(['tps_vehicle_expenses'], false);
    const list = this.get('tps_vehicle_expenses') || [];
    if (vehicleId) {
      return list.filter(e => e.vehicle_id === vehicleId);
    }
    return list;
  }

  async saveVehicleExpense(expData) {
    const list = this.get('tps_vehicle_expenses') || [];
    let saved;
    if (expData.id) {
      const idx = list.findIndex(e => e.id === expData.id);
      if (idx >= 0) {
        saved = { ...list[idx], ...expData, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...expData, created_at: expData.created_at || new Date().toISOString() };
        list.push(saved);
      }
    } else {
      saved = {
        id: 'vexp-' + Date.now(),
        ...expData,
        created_at: new Date().toISOString()
      };
      list.unshift(saved);
    }
    this.set('tps_vehicle_expenses', list);
    await this.pushCloudKey('tps_vehicle_expenses', list);

    // If an odometer reading is logged and greater than current vehicle odometer, update vehicle's odometer
    if (saved.odometer_at_expense && saved.vehicle_id) {
      const vehicles = this.get('tps_vehicles') || [];
      const veh = vehicles.find(v => v.id === saved.vehicle_id);
      if (veh && Number(saved.odometer_at_expense) > Number(veh.current_odometer || 0)) {
        veh.current_odometer = Number(saved.odometer_at_expense);
        this.set('tps_vehicles', vehicles);
        await this.pushCloudKey('tps_vehicles', vehicles);
      }
    }
    return saved;
  }

  async deleteVehicleExpense(id) {
    const list = this.get('tps_vehicle_expenses') || [];
    const filtered = list.filter(e => e.id !== id);
    this.set('tps_vehicle_expenses', filtered);
    await this.pushCloudKey('tps_vehicle_expenses', filtered);
    return true;
  }

  // --- TRIP LOGS ---
  async getTripLogs(filter = {}) {
    await this.pullCloudKeys(['tps_trip_logs'], false);
    let list = this.get('tps_trip_logs') || [];
    const vehicles = this.get('tps_vehicles') || [];

    // Self-healing: ensure any completed trip with missing, invalid or object total_amount is reconciled
    let hasRepairs = false;
    list = list.map(t => {
      let changed = false;
      let totalAmount = t.total_amount;
      if (typeof totalAmount === 'object' && totalAmount !== null) {
        totalAmount = Number(totalAmount.totalAmount) || 0;
        changed = true;
      }
      if (totalAmount === undefined && t.total_bill !== undefined) {
        totalAmount = Number(t.total_bill);
        changed = true;
      }
      if ((!totalAmount || isNaN(totalAmount)) && t.status === 'Completed' && Number(t.total_km) > 0) {
        const veh = vehicles.find(v => v.id === t.vehicle_id);
        const rate = Number(t.applied_rate_per_km || t.rate_per_km) > 0 
          ? Number(t.applied_rate_per_km || t.rate_per_km) 
          : (Number(veh?.fallback_rate_per_km) > 0 ? Number(veh.fallback_rate_per_km) : 15);
        totalAmount = Math.round(Number(t.total_km) * rate * 100) / 100;
        changed = true;
      }
      if (!t.user_email && (t.user_id === 'u-1' || /haseeb/i.test(t.user_name || ''))) {
        t.user_email = 'abdulhaseebkt2@gmail.com';
        changed = true;
      }
      if (changed) {
        hasRepairs = true;
        return { ...t, total_amount: totalAmount, total_bill: totalAmount, user_email: t.user_email || 'abdulhaseebkt2@gmail.com' };
      }
      return t;
    });

    if (hasRepairs) {
      this.set('tps_trip_logs', list);
      this.pushCloudKey('tps_trip_logs', list).catch(() => {});
    }

    if (filter.user_id) {
      list = list.filter(t => {
        if (t.user_id === filter.user_id) return true;
        if ((filter.user_id === 'u-1' || filter.user_id === '28bb4935-b4f0-4657-942c-afc784dc68de' || filter.user_id === 'abdulhaseebkt2@gmail.com') &&
            (t.user_id === 'u-1' || /haseeb/i.test(t.user_name || '') || t.user_email === 'abdulhaseebkt2@gmail.com')) {
          return true;
        }
        return false;
      });
    }
    if (filter.vehicle_id) {
      list = list.filter(t => t.vehicle_id === filter.vehicle_id);
    }
    if (filter.status) {
      list = list.filter(t => t.status === filter.status);
    }
    if (filter.payment_status) {
      list = list.filter(t => t.payment_status === filter.payment_status);
    }
    return list;
  }

  async saveTripLog(tripData) {
    const list = this.get('tps_trip_logs') || [];
    let cleanTrip = { ...tripData };
    if (typeof cleanTrip.total_amount === 'object' && cleanTrip.total_amount !== null) {
      cleanTrip.total_amount = Number(cleanTrip.total_amount.totalAmount) || 0;
    }
    if (cleanTrip.total_amount === undefined && cleanTrip.total_bill !== undefined) {
      cleanTrip.total_amount = Number(cleanTrip.total_bill);
    }
    if (cleanTrip.total_bill === undefined && cleanTrip.total_amount !== undefined) {
      cleanTrip.total_bill = Number(cleanTrip.total_amount);
    }
    if ((!cleanTrip.total_amount || isNaN(cleanTrip.total_amount)) && cleanTrip.status === 'Completed' && Number(cleanTrip.total_km) > 0) {
      const vehicles = this.get('tps_vehicles') || [];
      const veh = vehicles.find(v => v.id === cleanTrip.vehicle_id);
      const rate = Number(cleanTrip.applied_rate_per_km || cleanTrip.rate_per_km) > 0 
        ? Number(cleanTrip.applied_rate_per_km || cleanTrip.rate_per_km) 
        : (Number(veh?.fallback_rate_per_km) > 0 ? Number(veh.fallback_rate_per_km) : 15);
      cleanTrip.total_amount = Math.round(Number(cleanTrip.total_km) * rate * 100) / 100;
      cleanTrip.total_bill = cleanTrip.total_amount;
    }

    let saved;
    if (cleanTrip.id) {
      const idx = list.findIndex(t => t.id === cleanTrip.id);
      if (idx >= 0) {
        saved = { ...list[idx], ...cleanTrip, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...cleanTrip, created_at: cleanTrip.created_at || new Date().toISOString() };
        list.push(saved);
      }
    } else {
      const count = list.length + 1;
      const tripCode = `TRIP-${new Date().getFullYear()}-${String(count).padStart(3, '0')}`;
      saved = {
        id: 'trip-' + Date.now(),
        trip_id: tripCode,
        status: 'Pending Approval',
        payment_status: 'Unpaid',
        ...cleanTrip,
        created_at: new Date().toISOString()
      };
      list.unshift(saved);
    }
    this.set('tps_trip_logs', list);
    await this.pushCloudKey('tps_trip_logs', list);
    return saved;
  }

  async deleteTripLog(id) {
    const list = this.get('tps_trip_logs') || [];
    const targetTrip = list.find(t => t.id === id || t.trip_id === id);
    const filtered = list.filter(t => t.id !== id && t.trip_id !== id);
    this.set('tps_trip_logs', filtered);
    await this.pushCloudKey('tps_trip_logs', filtered);

    // Also clean up any payments associated with this trip
    if (targetTrip) {
      const payments = this.get('tps_vehicle_payments') || [];
      const remainingPayments = payments.filter(p => p.trip_id !== targetTrip.id && p.trip_id !== targetTrip.trip_id);
      if (remainingPayments.length !== payments.length) {
        this.set('tps_vehicle_payments', remainingPayments);
        await this.pushCloudKey('tps_vehicle_payments', remainingPayments);
      }
    }
    return true;
  }

  // --- VEHICLE PAYMENTS (IMMUTABLE SETTLEMENT LEDGER) ---
  async getVehiclePayments(tripId = null) {
    await this.pullCloudKeys(['tps_vehicle_payments'], false);
    const list = this.get('tps_vehicle_payments') || [];
    if (tripId) {
      return list.filter(p => p.trip_id === tripId);
    }
    return list;
  }

  async recordVehiclePayment(paymentData) {
    const list = this.get('tps_vehicle_payments') || [];
    const amountVal = Number(paymentData.amount !== undefined ? paymentData.amount : paymentData.amount_paid) || 0;
    const record = {
      id: 'vpay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ...paymentData,
      amount: amountVal,
      amount_paid: amountVal
    };
    list.unshift(record);
    this.set('tps_vehicle_payments', list);
    await this.pushCloudKey('tps_vehicle_payments', list);

    // Automatically update the referenced trip with partial or full payment status
    if (record.trip_id) {
      const trips = this.get('tps_trip_logs') || [];
      const targetTrip = trips.find(t => t.id === record.trip_id || t.trip_id === record.trip_id);
      if (targetTrip) {
        const totalAmount = Number(targetTrip.total_amount !== undefined ? targetTrip.total_amount : targetTrip.total_bill) || 0;
        const previousPaid = Number(targetTrip.amount_paid) || 0;
        const currentPay = amountVal;
        const newPaidTotal = previousPaid + currentPay;
        targetTrip.amount_paid = newPaidTotal;

        if (newPaidTotal >= totalAmount) {
          targetTrip.payment_status = 'Paid';
          targetTrip.is_paid = true;
        } else {
          targetTrip.payment_status = 'Partial';
          targetTrip.is_paid = false;
        }

        targetTrip.paid_at = record.payment_date;
        targetTrip.payment_id = record.id;
        targetTrip.payment_received_by = record.received_by_admin_name;
        targetTrip.payment_method = record.payment_method;
        this.set('tps_trip_logs', trips);
        await this.pushCloudKey('tps_trip_logs', trips);
      }
    }

    return record;
  }

  async deleteVehiclePayment(id) {
    const list = this.get('tps_vehicle_payments') || [];
    const payment = list.find(p => p.id === id);
    const filtered = list.filter(p => p.id !== id);
    this.set('tps_vehicle_payments', filtered);
    await this.pushCloudKey('tps_vehicle_payments', filtered);

    // If the payment was associated with a trip, recompute trip payment status
    if (payment && payment.trip_id) {
      const trips = this.get('tps_trip_logs') || [];
      const targetTrip = trips.find(t => t.id === payment.trip_id || t.trip_id === payment.trip_id);
      if (targetTrip) {
        const remainingPayments = filtered.filter(p => p.trip_id === payment.trip_id || p.trip_id === targetTrip.id || p.trip_id === targetTrip.trip_id);
        const totalPaid = remainingPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
        const totalAmount = Number(targetTrip.total_amount) || 0;
        targetTrip.amount_paid = totalPaid;
        if (totalPaid <= 0) {
          targetTrip.payment_status = 'Unpaid';
          targetTrip.is_paid = false;
          targetTrip.paid_at = null;
          targetTrip.payment_id = null;
        } else if (totalPaid >= totalAmount) {
          targetTrip.payment_status = 'Paid';
          targetTrip.is_paid = true;
        } else {
          targetTrip.payment_status = 'Partial';
          targetTrip.is_paid = false;
        }
        this.set('tps_trip_logs', trips);
        await this.pushCloudKey('tps_trip_logs', trips);
      }
    }
    return true;
  }

  // --- VEHICLE USERS DIRECTORY ---
  async getVehicleUsers() {
    await this.pullCloudKeys(['tps_vehicle_users', 'tps_users'], false);
    const vehicleUsersList = this.get('tps_vehicle_users') || [];
    const allUsers = this.get('tps_users') || [];

    // Automatically incorporate any approved user with role 'vehicle_user' or 'driver'
    const driversFromUsers = allUsers.filter(u => 
      u && !isDummyOrTestUser(u, true) && 
      (u.approval_status === 'approved' || !u.approval_status || u.approval_status === 'active') &&
      (u.role === 'vehicle_user' || u.role === 'driver')
    );

    let listModified = false;
    driversFromUsers.forEach(u => {
      const exists = vehicleUsersList.some(vu => vu.id === u.id || (vu.email && u.email && vu.email.toLowerCase() === u.email.toLowerCase()));
      if (!exists) {
        const count = vehicleUsersList.length + 1;
        vehicleUsersList.push({
          id: u.id,
          tps_id: u.tps_id || `VUS${String(count).padStart(3, '0')}`,
          full_name: u.full_name || (u.email ? u.email.split('@')[0] : 'Vehicle Driver'),
          email: u.email || '',
          phone: u.phone_number || u.phone || '',
          designation: 'Driver / Transport Staff',
          status: 'Active',
          created_at: u.created_at || new Date().toISOString()
        });
        listModified = true;
      }
    });

    if (listModified) {
      this.set('tps_vehicle_users', vehicleUsersList);
      this.pushCloudKey('tps_vehicle_users', vehicleUsersList).catch(() => {});
    }

    return vehicleUsersList.filter(vu => !isDummyOrTestUser(vu, true));
  }

  async saveVehicleUser(userData) {
    const list = this.get('tps_vehicle_users') || [];
    let saved;
    if (userData.id) {
      const idx = list.findIndex(u => u.id === userData.id);
      if (idx >= 0) {
        saved = { ...list[idx], ...userData, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...userData, created_at: userData.created_at || new Date().toISOString() };
        list.push(saved);
      }
    } else {
      const count = list.length + 1;
      saved = {
        id: 'vu-' + Date.now(),
        tps_id: userData.tps_id || `VUS${String(count).padStart(3, '0')}`,
        status: 'Active',
        ...userData,
        created_at: new Date().toISOString()
      };
      list.push(saved);
    }
    this.set('tps_vehicle_users', list);
    await this.pushCloudKey('tps_vehicle_users', list);

    // Also ensure they are represented in tps_users with role: 'vehicle_user'
    const users = this.get('tps_users') || [];
    const existingUser = users.find(u => (u.email && u.email === saved.email) || u.id === saved.id);
    if (!existingUser) {
      users.push({
        id: saved.id,
        email: saved.email || `driver_${Date.now()}@thaibaschool.edu.in`,
        full_name: saved.full_name,
        role: 'vehicle_user',
        approval_status: 'approved',
        phone: saved.phone,
        tps_id: saved.tps_id,
        is_super_admin: false
      });
      this.set('tps_users', users);
      await this.pushCloudKey('tps_users', users);
    }

    return saved;
  }

  async deleteVehicleUser(id) {
    const list = this.get('tps_vehicle_users') || [];
    const filtered = list.filter(u => u.id !== id);
    this.set('tps_vehicle_users', filtered);
    await this.pushCloudKey('tps_vehicle_users', filtered);
    return true;
  }

  // --- VEHICLE PRESET DESTINATIONS & DISCREPANCIES ---
  async getVehicleDestinations() {
    await this.pullCloudKeys(['tps_vehicle_destinations'], false);
    let list = this.get('tps_vehicle_destinations');
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = INITIAL_VEHICLE_DESTINATIONS;
      this.set('tps_vehicle_destinations', list);
      await this.pushCloudKey('tps_vehicle_destinations', list);
    }
    return list;
  }

  async saveVehicleDestination(destData) {
    const list = await this.getVehicleDestinations();
    let saved;
    if (destData.id) {
      const idx = list.findIndex(d => d.id === destData.id);
      if (idx >= 0) {
        saved = { ...list[idx], ...destData, updated_at: new Date().toISOString() };
        list[idx] = saved;
      } else {
        saved = { ...destData, updated_at: new Date().toISOString() };
        list.push(saved);
      }
    } else {
      saved = {
        id: 'dest-' + Date.now(),
        is_active: true,
        ...destData,
        created_at: new Date().toISOString()
      };
      list.push(saved);
    }
    this.set('tps_vehicle_destinations', list);
    await this.pushCloudKey('tps_vehicle_destinations', list);
    return saved;
  }

  async deleteVehicleDestination(id) {
    const list = await this.getVehicleDestinations();
    const filtered = list.filter(d => d.id !== id);
    this.set('tps_vehicle_destinations', filtered);
    await this.pushCloudKey('tps_vehicle_destinations', filtered);
    return true;
  }

  async resolveTripDiscrepancy(tripId, { decision, adminNotes, adminName }) {
    const trips = this.get('tps_trip_logs') || [];
    const targetTrip = trips.find(t => t.id === tripId || t.trip_id === tripId);
    if (!targetTrip) throw new Error('Trip not found');

    targetTrip.discrepancy_reviewed_at = new Date().toISOString();
    targetTrip.discrepancy_reviewed_by = adminName || 'Admin';
    targetTrip.discrepancy_admin_notes = adminNotes || '';

    if (decision === 'exempt') {
      targetTrip.discrepancy_status = 'Approved Exemption';
      targetTrip.total_amount = 0;
      targetTrip.payment_status = 'Official Exemption';
      targetTrip.is_paid = true;
    } else {
      targetTrip.discrepancy_status = 'Rejected Exemption';
      targetTrip.payment_status = 'Unpaid';
      targetTrip.is_paid = false;
    }

    this.set('tps_trip_logs', trips);
    await this.pushCloudKey('tps_trip_logs', trips);
    return targetTrip;
  }

  // --- AUDIT LOGS ---
  async getAuditLogs() {
    return this.get('tps_audit');
  }
}

export { isStudentActive } from './utils.js';
export const db = new DatabaseService();
