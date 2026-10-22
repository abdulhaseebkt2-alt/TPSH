-- ============================================================
-- TPS HOSTEL IRP: CORE POSTGRESQL SCHEMA MIGRATION
-- Institution: Thaiba Public School
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop legacy unpopulated draft tables if present to ensure clean schema alignment
DROP TABLE IF EXISTS disciplinary_records CASCADE;
DROP TABLE IF EXISTS teacher_timetable CASCADE;
DROP TABLE IF EXISTS classroom_student_map CASCADE;
DROP TABLE IF EXISTS attendance_sections CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS exam_marks CASCADE;
DROP TABLE IF EXISTS exam_subjects CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS student_attendance CASCADE;
DROP TABLE IF EXISTS attendance_sessions CASCADE;
DROP TABLE IF EXISTS classrooms CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ------------------------------------------------------------
-- 1. INSTITUTION & APP SETTINGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- ------------------------------------------------------------
-- 2. USER PROFILES & ACCESS CONTROL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student')),
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_modules JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_approval ON profiles(approval_status);

-- Pre-approved invitations
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'mentor', 'teacher', 'parent', 'student')),
    assigned_modules JSONB DEFAULT '[]'::jsonb,
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Granular permissions for admins & staff
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    module_key TEXT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT FALSE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve BOOLEAN NOT NULL DEFAULT FALSE,
    can_publish BOOLEAN NOT NULL DEFAULT FALSE,
    can_export BOOLEAN NOT NULL DEFAULT FALSE,
    can_override BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role, module_key)
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_approve BOOLEAN,
    can_publish BOOLEAN,
    can_export BOOLEAN,
    can_override BOOLEAN,
    granted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, module_key)
);

-- Scoped assignments for staff (e.g. mentor to hostel units, teacher to programs)
CREATE TABLE IF NOT EXISTS user_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('hostel_unit', 'program', 'classroom', 'school_class')),
    scope_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, scope_type, scope_id)
);

-- ------------------------------------------------------------
-- 3. AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ------------------------------------------------------------
-- 4. ACADEMIC & SCHOOL STRUCTURE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. "2026-2027"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. "Class 1", "Class 5", "Class 10"
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Section A", "Section B"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(class_id, name)
);

-- ------------------------------------------------------------
-- 5. HOSTEL INFRASTRUCTURE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hostel_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. "Boys Hostel Block A", "Girls Hostel Block"
    gender_type TEXT NOT NULL CHECK (gender_type IN ('boys', 'girls', 'mixed')),
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hostel_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES hostel_units(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    floor_number INT NOT NULL DEFAULT 1,
    bed_capacity INT NOT NULL DEFAULT 4,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(unit_id, room_number)
);

CREATE TABLE IF NOT EXISTS hostel_beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE,
    bed_identifier TEXT NOT NULL, -- e.g. "Bed 1", "Bed 2"
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, bed_identifier)
);

-- ------------------------------------------------------------
-- 6. STUDENTS MASTER
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    photo_url TEXT,
    gender TEXT NOT NULL CHECK (gender IN ('Boys', 'Girls')),
    dob DATE NOT NULL,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL,
    school_section_id UUID REFERENCES school_sections(id) ON DELETE SET NULL,
    
    hostel_status TEXT NOT NULL DEFAULT 'resident' CHECK (hostel_status IN ('resident', 'day_scholar', 'temporary_break')),
    hostel_unit_id UUID REFERENCES hostel_units(id) ON DELETE SET NULL,
    hostel_room_id UUID REFERENCES hostel_rooms(id) ON DELETE SET NULL,
    hostel_bed_id UUID REFERENCES hostel_beds(id) ON DELETE SET NULL,
    hostel_joining_date DATE,
    
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Temporary Break', 'On Approved Leave', 'Transferred', 'Withdrawn', 'Inactive')),
    
    -- Temporary Break specific fields
    break_start_date DATE,
    break_expected_return_date DATE,
    break_reason TEXT,
    break_rejoin_date DATE,
    break_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Address
    village TEXT,
    post_office TEXT,
    district TEXT,
    state TEXT DEFAULT 'Kerala',
    pin_code TEXT,
    full_address TEXT,
    
    -- Parents / Guardian
    father_name TEXT,
    father_phone TEXT,
    mother_name TEXT,
    mother_phone TEXT,
    whatsapp_number TEXT,
    emergency_contact TEXT,
    medical_info TEXT,
    remarks TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_admission_no ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(school_class_id);
CREATE INDEX IF NOT EXISTS idx_students_gender ON students(gender);

-- Bed Allocation History
CREATE TABLE IF NOT EXISTS bed_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    bed_id UUID NOT NULL REFERENCES hostel_beds(id) ON DELETE CASCADE,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vacated_at TIMESTAMPTZ,
    allocated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT
);

-- Student Status History
CREATE TABLE IF NOT EXISTS student_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parent/Guardian linkage to students
CREATE TABLE IF NOT EXISTS student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'Parent' CHECK (relationship IN ('Father', 'Mother', 'Guardian', 'Other')),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    linked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_parent ON student_guardians(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON student_guardians(student_id);

-- ------------------------------------------------------------
-- 7. ATTENDANCE PROGRAMS, SECTIONS & CLASSROOMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. "Hostel Moral Class", "Hostel Coaching Class", "School Coaching Class"
    code TEXT NOT NULL UNIQUE, -- e.g. "MORAL", "HOSTEL_COACHING", "SCHOOL_COACHING"
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES attendance_programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Boys Category 1", "Girls Moral Combined"
    gender_eligibility TEXT NOT NULL DEFAULT 'Mixed' CHECK (gender_eligibility IN ('Boys', 'Girls', 'Mixed')),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(program_id, name)
);

CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES program_sections(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Classroom Alpha", "Moral Room 1"
    room_number TEXT,
    capacity INT DEFAULT 40,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(section_id, name)
);

-- Effective-dated student assignment to classrooms
CREATE TABLE IF NOT EXISTS classroom_student_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(classroom_id, student_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_csa_student ON classroom_student_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_csa_classroom ON classroom_student_assignments(classroom_id);

-- Assigned teachers to classrooms
CREATE TABLE IF NOT EXISTS classroom_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(classroom_id, teacher_id)
);

-- ------------------------------------------------------------
-- 8. TIMETABLE & ATTENDANCE SESSIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday ... 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    session_title TEXT,
    attendance_open_minutes_before INT NOT NULL DEFAULT 5,
    attendance_close_minutes_after INT NOT NULL DEFAULT 15,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_teacher ON teacher_timetables(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tt_classroom ON teacher_timetables(classroom_id);

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID REFERENCES teacher_timetables(id) ON DELETE SET NULL,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    attendance_window_opens TIMESTAMPTZ NOT NULL,
    attendance_window_closes TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'auto_finalized')),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(classroom_id, session_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_as_date_status ON attendance_sessions(session_date, status);

CREATE TABLE IF NOT EXISTS student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Excused', 'Approved Leave')),
    marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    corrected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    correction_reason TEXT,
    remarks TEXT,
    UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sa_student ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_sa_session ON student_attendance(session_id);

-- Independent Teacher Attendance per session
CREATE TABLE IF NOT EXISTS teacher_session_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Present', 'Absent', 'Excused', 'Auto_Absent', 'Corrected')),
    duty_completed_at TIMESTAMPTZ,
    auto_finalized_at TIMESTAMPTZ,
    corrected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    correction_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_tsa_teacher ON teacher_session_attendance(teacher_id);

-- ------------------------------------------------------------
-- 9. HOSTEL LEAVE, ENTRY/EXIT & FINE ENGINE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fine_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    fine_per_day NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    grace_days INT NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('group', 'individual')),
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL DEFAULT '08:00',
    expected_return_date DATE NOT NULL,
    expected_return_time TIME NOT NULL DEFAULT '18:00',
    reason TEXT NOT NULL,
    fine_policy_id UUID REFERENCES fine_policies(id),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_leave_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_event_id UUID REFERENCES leave_events(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    leave_register_number TEXT UNIQUE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('group', 'individual')),
    
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    reason TEXT NOT NULL,
    expected_return_date DATE NOT NULL,
    expected_return_time TIME NOT NULL,
    
    actual_return_date DATE,
    actual_return_time TIME,
    
    status TEXT NOT NULL DEFAULT 'Away' CHECK (status IN ('Approved', 'Away', 'Returned', 'Overdue', 'Cancelled')),
    
    -- Fine calculations snapshotted at time of event
    fine_per_day_applied NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    late_days INT NOT NULL DEFAULT 0,
    calculated_fine NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    adjusted_fine NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fine_status TEXT NOT NULL DEFAULT 'no_fine' CHECK (fine_status IN ('no_fine', 'unpaid', 'partially_paid', 'paid', 'waived', 'cancelled')),
    fine_waiver_reason TEXT,
    fine_waived_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    departure_recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    return_recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slr_student ON student_leave_records(student_id);
CREATE INDEX IF NOT EXISTS idx_slr_status ON student_leave_records(status);

-- Physical entry/exit gate log
CREATE TABLE IF NOT EXISTS hostel_entry_exit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    leave_record_id UUID REFERENCES student_leave_records(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('Exit', 'Entry')),
    movement_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    gate_operator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS fine_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_record_id UUID NOT NULL REFERENCES student_leave_records(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount_paid NUMERIC(10, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Bank_Transfer', 'Other')),
    reference_number TEXT,
    receipt_number TEXT UNIQUE NOT NULL,
    received_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 10. DISCIPLINE & BLACK MARKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discipline_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL DEFAULT 'Minor' CHECK (severity IN ('Minor', 'Moderate', 'Major', 'Critical')),
    default_black_marks INT NOT NULL DEFAULT 1,
    default_monetary_fine NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discipline_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES discipline_categories(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    incident_time TIME,
    location TEXT NOT NULL DEFAULT 'Hostel Premises',
    description TEXT NOT NULL,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    witnesses TEXT,
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    
    black_marks_awarded INT NOT NULL DEFAULT 1,
    monetary_fine NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fine_paid BOOLEAN NOT NULL DEFAULT FALSE,
    action_taken TEXT,
    parent_notified BOOLEAN NOT NULL DEFAULT FALSE,
    parent_notified_at TIMESTAMPTZ,
    
    resolution_status TEXT NOT NULL DEFAULT 'Open' CHECK (resolution_status IN ('Open', 'Under_Investigation', 'Resolved', 'Dismissed')),
    approval_status TEXT NOT NULL DEFAULT 'Pending_Approval' CHECK (approval_status IN ('Pending_Approval', 'Approved', 'Rejected')),
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_student ON discipline_incidents(student_id);

CREATE TABLE IF NOT EXISTS student_black_mark_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES discipline_incidents(id) ON DELETE SET NULL,
    marks_change INT NOT NULL, -- positive to award, negative to revoke/pardon
    reason TEXT NOT NULL,
    authorized_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 11. EXAMINATION & RESULTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. "Mathematics", "Moral Studies", "English"
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS grade_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g. "Standard CBSE Scale"
    grade TEXT NOT NULL, -- e.g. "A+", "A", "B"
    min_percentage NUMERIC(5, 2) NOT NULL,
    max_percentage NUMERIC(5, 2) NOT NULL,
    grade_point NUMERIC(4, 2) DEFAULT 0.00,
    remarks TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, grade)
);

CREATE TABLE IF NOT EXISTS examinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g. "Mid-Term Examination 2026"
    exam_type TEXT NOT NULL CHECK (exam_type IN ('Unit_Test', 'Quarterly', 'Half_Yearly', 'Annual', 'Moral_Evaluation')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ranking_policy TEXT NOT NULL DEFAULT 'standard' CHECK (ranking_policy IN ('standard', 'competition_tied', 'percentage_only')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
    school_class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    max_marks NUMERIC(6, 2) NOT NULL DEFAULT 100.00,
    passing_marks NUMERIC(6, 2) NOT NULL DEFAULT 40.00,
    theory_max NUMERIC(6, 2) DEFAULT 80.00,
    practical_max NUMERIC(6, 2) DEFAULT 20.00,
    exam_date DATE,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_id, school_class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_subject_id UUID NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    theory_marks NUMERIC(6, 2) DEFAULT 0.00,
    practical_marks NUMERIC(6, 2) DEFAULT 0.00,
    total_marks NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    is_absent BOOLEAN NOT NULL DEFAULT FALSE,
    grade TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Verified', 'Published')),
    entered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_subject_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_em_student ON exam_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_em_subject ON exam_marks(exam_subject_id);

CREATE TABLE IF NOT EXISTS result_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
    school_class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    published_by UUID NOT NULL REFERENCES profiles(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks TEXT,
    UNIQUE(exam_id, school_class_id)
);

-- ------------------------------------------------------------
-- 12. FEES, NOTICES & MAINTENANCE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. "Hostel Boarding Fee", "Mess Fee", "Maintenance Fee"
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    billing_period TEXT NOT NULL DEFAULT 'Monthly' CHECK (billing_period IN ('Monthly', 'Term', 'Annual', 'One_Time')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_type_id UUID NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially_Paid', 'Paid', 'Cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Bank_Transfer', 'Other')),
    receipt_number TEXT UNIQUE NOT NULL,
    received_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'parent', 'teacher', 'mentor', 'student')),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    unit_id UUID REFERENCES hostel_units(id) ON DELETE SET NULL,
    room_id UUID REFERENCES hostel_rooms(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Emergency')),
    status TEXT NOT NULL DEFAULT 'Reported' CHECK (status IN ('Reported', 'Assigned', 'In_Progress', 'Resolved', 'Cancelled')),
    assigned_to TEXT,
    estimated_cost NUMERIC(10, 2) DEFAULT 0.00,
    actual_cost NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
