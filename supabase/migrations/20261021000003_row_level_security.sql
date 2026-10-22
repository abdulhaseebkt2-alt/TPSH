-- ============================================================
-- TPS HOSTEL IRP: ROW LEVEL SECURITY & POLICY SUITE
-- Institution: Thaiba Public School
-- ============================================================

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT role FROM profiles WHERE id = auth.uid() AND approval_status = 'approved';
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE((SELECT is_super_admin FROM profiles WHERE id = auth.uid() AND approval_status = 'approved'), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE((SELECT role IN ('super_admin', 'admin') FROM profiles WHERE id = auth.uid() AND approval_status = 'approved'), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_mentor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE((SELECT role IN ('super_admin', 'admin', 'mentor') FROM profiles WHERE id = auth.uid() AND approval_status = 'approved'), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE((SELECT role IN ('super_admin', 'admin', 'teacher') FROM profiles WHERE id = auth.uid() AND approval_status = 'approved'), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_parent_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM student_guardians sg
        JOIN profiles p ON p.id = sg.parent_user_id
        WHERE sg.student_id = p_student_id
          AND sg.parent_user_id = auth.uid()
          AND p.approval_status = 'approved'
          AND p.role = 'parent'
    );
$$;

-- ------------------------------------------------------------
-- ENABLE RLS ON ALL TABLES
-- ------------------------------------------------------------
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_leave_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_entry_exit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_black_mark_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
CREATE POLICY "profiles_select_admin" ON profiles
    FOR SELECT TO authenticated
    USING (is_admin_or_super());

DROP POLICY IF EXISTS "profiles_all_super" ON profiles;
CREATE POLICY "profiles_all_super" ON profiles
    FOR ALL TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
    FOR UPDATE TO authenticated
    USING (is_admin_or_super() AND is_super_admin = FALSE)
    WITH CHECK (is_admin_or_super() AND is_super_admin = FALSE);

-- ------------------------------------------------------------
-- STUDENTS POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "students_select_staff" ON students;
CREATE POLICY "students_select_staff" ON students
    FOR SELECT TO authenticated
    USING (is_admin_or_super() OR is_mentor() OR is_teacher());

DROP POLICY IF EXISTS "students_select_parent" ON students;
CREATE POLICY "students_select_parent" ON students
    FOR SELECT TO authenticated
    USING (is_parent_of_student(id));

DROP POLICY IF EXISTS "students_modify_admin" ON students;
CREATE POLICY "students_modify_admin" ON students
    FOR ALL TO authenticated
    USING (is_admin_or_super())
    WITH CHECK (is_admin_or_super());

-- ------------------------------------------------------------
-- STUDENT LEAVE RECORDS POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "slr_select_staff" ON student_leave_records;
CREATE POLICY "slr_select_staff" ON student_leave_records
    FOR SELECT TO authenticated
    USING (is_admin_or_super() OR is_mentor());

DROP POLICY IF EXISTS "slr_select_parent" ON student_leave_records;
CREATE POLICY "slr_select_parent" ON student_leave_records
    FOR SELECT TO authenticated
    USING (is_parent_of_student(student_id));

DROP POLICY IF EXISTS "slr_modify_staff" ON student_leave_records;
CREATE POLICY "slr_modify_staff" ON student_leave_records
    FOR ALL TO authenticated
    USING (is_admin_or_super() OR is_mentor())
    WITH CHECK (is_admin_or_super() OR is_mentor());

-- ------------------------------------------------------------
-- ATTENDANCE SESSIONS & STUDENT ATTENDANCE POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "as_select_authenticated" ON attendance_sessions;
CREATE POLICY "as_select_authenticated" ON attendance_sessions
    FOR SELECT TO authenticated
    USING (is_admin_or_super() OR is_mentor() OR is_teacher());

DROP POLICY IF EXISTS "as_modify_staff" ON attendance_sessions;
CREATE POLICY "as_modify_staff" ON attendance_sessions
    FOR ALL TO authenticated
    USING (is_admin_or_super() OR is_teacher())
    WITH CHECK (is_admin_or_super() OR is_teacher());

DROP POLICY IF EXISTS "sa_select_staff" ON student_attendance;
CREATE POLICY "sa_select_staff" ON student_attendance
    FOR SELECT TO authenticated
    USING (is_admin_or_super() OR is_mentor() OR is_teacher());

DROP POLICY IF EXISTS "sa_select_parent" ON student_attendance;
CREATE POLICY "sa_select_parent" ON student_attendance
    FOR SELECT TO authenticated
    USING (is_parent_of_student(student_id));

DROP POLICY IF EXISTS "sa_modify_staff" ON student_attendance;
CREATE POLICY "sa_modify_staff" ON student_attendance
    FOR ALL TO authenticated
    USING (is_admin_or_super() OR is_teacher())
    WITH CHECK (is_admin_or_super() OR is_teacher());

-- ------------------------------------------------------------
-- DISCIPLINE & BLACK MARKS POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "di_select_staff" ON discipline_incidents;
CREATE POLICY "di_select_staff" ON discipline_incidents
    FOR SELECT TO authenticated
    USING (is_admin_or_super() OR is_mentor());

DROP POLICY IF EXISTS "di_select_parent" ON discipline_incidents;
CREATE POLICY "di_select_parent" ON discipline_incidents
    FOR SELECT TO authenticated
    USING (is_parent_of_student(student_id) AND parent_notified = TRUE);

DROP POLICY IF EXISTS "di_modify_staff" ON discipline_incidents;
CREATE POLICY "di_modify_staff" ON discipline_incidents
    FOR ALL TO authenticated
    USING (is_admin_or_super() OR is_mentor())
    WITH CHECK (is_admin_or_super() OR is_mentor());

-- ------------------------------------------------------------
-- EXAMINATION & MARKS POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "em_select_staff" ON exam_marks;
CREATE POLICY "em_select_staff" ON exam_marks
    FOR SELECT TO authenticated
    USING (is_admin_or_super() OR is_teacher());

DROP POLICY IF EXISTS "em_select_parent" ON exam_marks;
CREATE POLICY "em_select_parent" ON exam_marks
    FOR SELECT TO authenticated
    USING (is_parent_of_student(student_id) AND status = 'Published');

DROP POLICY IF EXISTS "em_modify_staff" ON exam_marks;
CREATE POLICY "em_modify_staff" ON exam_marks
    FOR ALL TO authenticated
    USING (is_admin_or_super() OR is_teacher())
    WITH CHECK (is_admin_or_super() OR is_teacher());

-- ------------------------------------------------------------
-- READ-ACCESS TO CONFIGURATION TABLES FOR APPROVED USERS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "config_select_approved" ON attendance_programs;
CREATE POLICY "config_select_approved" ON attendance_programs FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_sections" ON program_sections;
CREATE POLICY "config_select_sections" ON program_sections FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_classrooms" ON classrooms;
CREATE POLICY "config_select_classrooms" ON classrooms FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_classes" ON school_classes;
CREATE POLICY "config_select_classes" ON school_classes FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_school_sections" ON school_sections;
CREATE POLICY "config_select_school_sections" ON school_sections FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_years" ON academic_years;
CREATE POLICY "config_select_years" ON academic_years FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_subjects" ON subjects;
CREATE POLICY "config_select_subjects" ON subjects FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_grades" ON grade_scales;
CREATE POLICY "config_select_grades" ON grade_scales FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_settings" ON app_settings;
CREATE POLICY "config_select_settings" ON app_settings FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_select_fines" ON fine_policies;
CREATE POLICY "config_select_fines" ON fine_policies FOR SELECT TO authenticated USING (current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "config_admin_programs" ON attendance_programs;
CREATE POLICY "config_admin_programs" ON attendance_programs FOR ALL TO authenticated USING (is_admin_or_super()) WITH CHECK (is_admin_or_super());

DROP POLICY IF EXISTS "config_admin_sections" ON program_sections;
CREATE POLICY "config_admin_sections" ON program_sections FOR ALL TO authenticated USING (is_admin_or_super()) WITH CHECK (is_admin_or_super());

DROP POLICY IF EXISTS "config_admin_classrooms" ON classrooms;
CREATE POLICY "config_admin_classrooms" ON classrooms FOR ALL TO authenticated USING (is_admin_or_super()) WITH CHECK (is_admin_or_super());

DROP POLICY IF EXISTS "config_admin_settings" ON app_settings;
CREATE POLICY "config_admin_settings" ON app_settings FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ------------------------------------------------------------
-- AUDIT LOGS SECURITY
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "audit_select_super" ON audit_logs;
CREATE POLICY "audit_select_super" ON audit_logs
    FOR SELECT TO authenticated
    USING (is_super_admin());

DROP POLICY IF EXISTS "audit_insert_any" ON audit_logs;
CREATE POLICY "audit_insert_any" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);
