-- ============================================================
-- TPS HOSTEL IRP: SEED DATA & INITIAL CONFIGURATION
-- Institution: Thaiba Public School
-- ============================================================

-- 1. App Settings
INSERT INTO app_settings (key, value, description)
VALUES 
    ('institution_info', jsonb_build_object(
        'name', 'Thaiba Public School',
        'short_name', 'TPS',
        'tagline', 'Modern Education with Morality',
        'address', 'Thaiba Public School Campus, Kerala, India',
        'phone', '+91 98765 43210',
        'email', 'info@thaibaschool.edu.in',
        'timezone', 'Asia/Kolkata',
        'super_admin_email', 'abdulhaseebkt2@gmail.com'
    ), 'Core institution information'),
    ('attendance_rules', jsonb_build_object(
        'default_open_minutes_before', 5,
        'default_close_minutes_after', 15,
        'auto_finalize_absent_enabled', true,
        'allow_teacher_override_reason', true
    ), 'Attendance window & automation configurations'),
    ('late_fine_rules', jsonb_build_object(
        'calculation_method', 'calendar_date',
        'default_daily_rate', 200.00,
        'allow_waiver_roles', jsonb_build_array('super_admin', 'admin')
    ), 'Late return fine parameters')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Academic Year
INSERT INTO academic_years (id, name, start_date, end_date, is_current)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '2026-2027', '2026-06-01', '2027-03-31', TRUE)
ON CONFLICT (name) DO UPDATE SET is_current = EXCLUDED.is_current;

-- 3. School Classes
INSERT INTO school_classes (id, name, display_order)
VALUES 
    ('00000000-0000-0000-0001-000000000001', 'Class 1', 1),
    ('00000000-0000-0000-0001-000000000002', 'Class 2', 2),
    ('00000000-0000-0000-0001-000000000003', 'Class 3', 3),
    ('00000000-0000-0000-0001-000000000004', 'Class 4', 4),
    ('00000000-0000-0000-0001-000000000005', 'Class 5', 5),
    ('00000000-0000-0000-0001-000000000006', 'Class 6', 6),
    ('00000000-0000-0000-0001-000000000007', 'Class 7', 7),
    ('00000000-0000-0000-0001-000000000008', 'Class 8', 8),
    ('00000000-0000-0000-0001-000000000009', 'Class 9', 9),
    ('00000000-0000-0000-0001-000000000010', 'Class 10', 10)
ON CONFLICT (name) DO NOTHING;

-- 4. Attendance Programs
INSERT INTO attendance_programs (id, name, code, description, display_order)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Hostel Moral Class', 'MORAL', 'Daily morning moral and ethical studies for hostel residents', 1),
    ('22222222-2222-2222-2222-222222222222', 'Hostel Coaching Class', 'HOSTEL_COACHING', 'Evening academic coaching and supervised study for hostel students', 2),
    ('33333333-3333-3333-3333-333333333333', 'School Coaching Class', 'SCHOOL_COACHING', 'Post-school mixed boys and girls coaching taught by school faculty', 3)
ON CONFLICT (code) DO NOTHING;

-- 5. Program Sections
-- Hostel Moral Class Sections
INSERT INTO program_sections (id, program_id, name, gender_eligibility, display_order)
VALUES 
    ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Boys Moral Class – Category 1', 'Boys', 1),
    ('aaaa0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Boys Moral Class – Category 2', 'Boys', 2),
    ('aaaa0001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Girls Moral Class – One combined class', 'Girls', 3),

-- Hostel Coaching Sections
    ('bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Boys Hostel Coaching – Category 1', 'Boys', 1),
    ('bbbb0001-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Boys Hostel Coaching – Category 2', 'Boys', 2),
    ('bbbb0001-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Girls Hostel Coaching – One combined class', 'Girls', 3),

-- School Coaching Sections (Mixed Boys & Girls)
    ('cccc0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'School Coaching Category 1', 'Mixed', 1),
    ('cccc0001-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'School Coaching Category 2', 'Mixed', 2),
    ('cccc0001-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'School Coaching Category 3', 'Mixed', 3),
    ('cccc0001-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'School Coaching Category 4', 'Mixed', 4),
    ('cccc0001-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'School Coaching Category 5', 'Mixed', 5)
ON CONFLICT (program_id, name) DO NOTHING;

-- 6. Classrooms under Sections
INSERT INTO classrooms (id, section_id, name, room_number, capacity)
VALUES
    ('c0000001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'Moral Hall A1', 'Room 101', 35),
    ('c0000001-0000-0000-0000-000000000002', 'aaaa0001-0000-0000-0000-000000000002', 'Moral Hall A2', 'Room 102', 35),
    ('c0000001-0000-0000-0000-000000000003', 'aaaa0001-0000-0000-0000-000000000003', 'Girls Moral Hall G1', 'Room 201', 50),
    ('c0000001-0000-0000-0000-000000000004', 'bbbb0001-0000-0000-0000-000000000001', 'Hostel Study Lab 1', 'Room 105', 30),
    ('c0000001-0000-0000-0000-000000000005', 'bbbb0001-0000-0000-0000-000000000002', 'Hostel Study Lab 2', 'Room 106', 30),
    ('c0000001-0000-0000-0000-000000000006', 'bbbb0001-0000-0000-0000-000000000003', 'Girls Coaching Hall', 'Room 205', 45),
    ('c0000001-0000-0000-0000-000000000007', 'cccc0001-0000-0000-0000-000000000001', 'Main Academic Lab 1', 'Room 301', 40),
    ('c0000001-0000-0000-0000-000000000008', 'cccc0001-0000-0000-0000-000000000002', 'Main Academic Lab 2', 'Room 302', 40)
ON CONFLICT (section_id, name) DO NOTHING;

-- 7. Fine Policies
INSERT INTO fine_policies (id, name, fine_per_day, grace_days, is_active)
VALUES 
    ('ffffffff-0000-0000-0000-000000000001', 'Standard Hostel Late Return Policy', 200.00, 0, TRUE)
ON CONFLICT DO NOTHING;

-- 8. Discipline Categories
INSERT INTO discipline_categories (name, severity, default_black_marks, default_monetary_fine)
VALUES
    ('Leaving hostel without permission', 'Major', 3, 500.00),
    ('Returning late without permission', 'Moderate', 2, 200.00),
    ('Breaking window glass', 'Major', 2, 800.00),
    ('Damaging clocks, furniture, or hostel property', 'Major', 2, 600.00),
    ('Fighting with another student', 'Critical', 5, 0.00),
    ('Bullying or mistreating other students', 'Critical', 5, 0.00),
    ('Possessing a mobile phone in hostel', 'Moderate', 2, 500.00),
    ('Violating hostel silence hours', 'Minor', 1, 0.00),
    ('Other hostel rules violation', 'Minor', 1, 0.00)
ON CONFLICT (name) DO NOTHING;

-- 9. Subjects
INSERT INTO subjects (name, code)
VALUES
    ('Moral Studies & Ethics', 'MORAL_01'),
    ('Arabic Language & Quranic Studies', 'ARB_01'),
    ('English Literature & Grammar', 'ENG_01'),
    ('Mathematics', 'MATH_01'),
    ('General Science', 'SCI_01'),
    ('Social Studies', 'SOC_01'),
    ('Malayalam / Second Language', 'MAL_01'),
    ('Computer Science', 'CS_01')
ON CONFLICT (code) DO NOTHING;

-- 10. Grade Scales
INSERT INTO grade_scales (name, grade, min_percentage, max_percentage, grade_point, remarks)
VALUES
    ('Standard School Scale', 'A1', 91.00, 100.00, 10.00, 'Outstanding'),
    ('Standard School Scale', 'A2', 81.00, 90.99, 9.00, 'Excellent'),
    ('Standard School Scale', 'B1', 71.00, 80.99, 8.00, 'Very Good'),
    ('Standard School Scale', 'B2', 61.00, 70.99, 7.00, 'Good'),
    ('Standard School Scale', 'C1', 51.00, 60.99, 6.00, 'Above Average'),
    ('Standard School Scale', 'C2', 41.00, 50.99, 5.00, 'Average'),
    ('Standard School Scale', 'D', 33.00, 40.99, 4.00, 'Pass'),
    ('Standard School Scale', 'E', 0.00, 32.99, 0.00, 'Needs Improvement / Fail')
ON CONFLICT (name, grade) DO NOTHING;

-- 11. Hostel Units
INSERT INTO hostel_units (id, name, gender_type)
VALUES
    ('ba000001-0000-0000-0000-000000000001', 'Thaiba Boys Hostel Block A', 'boys'),
    ('ba000001-0000-0000-0000-000000000002', 'Thaiba Boys Hostel Block B', 'boys'),
    ('ba000001-0000-0000-0000-000000000003', 'Thaiba Girls Hostel Campus', 'girls')
ON CONFLICT (name) DO NOTHING;
