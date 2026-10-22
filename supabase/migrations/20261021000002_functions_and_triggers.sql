-- ============================================================
-- TPS HOSTEL IRP: CORE FUNCTIONS, PROCEDURES & TRIGGERS
-- Institution: Thaiba Public School
-- ============================================================

-- Function to safely log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_log_id UUID;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    INSERT INTO audit_logs (
        actor_id, actor_email, action, entity_type, entity_id,
        old_values, new_values, reason
    ) VALUES (
        v_user_id, v_user_email, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_reason
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- ------------------------------------------------------------
-- INITIAL SUPER ADMIN BOOTSTRAP & NEW USER HANDLER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_super_admin_email CONSTANT TEXT := 'abdulhaseebkt2@gmail.com';
    v_is_super BOOLEAN := FALSE;
    v_role TEXT := NULL;
    v_status TEXT := 'pending';
    v_invitation RECORD;
BEGIN
    -- 1. Check if user is the designated Initial Super Admin
    IF LOWER(TRIM(NEW.email)) = LOWER(v_super_admin_email) THEN
        v_is_super := TRUE;
        v_role := 'super_admin';
        v_status := 'approved';
    ELSE
        -- 2. Check if a pre-authorized invitation exists
        SELECT * INTO v_invitation 
        FROM user_invitations 
        WHERE LOWER(email) = LOWER(NEW.email) AND is_claimed = FALSE AND expires_at > NOW()
        LIMIT 1;

        IF FOUND THEN
            v_role := v_invitation.role;
            v_status := 'approved';
            
            UPDATE user_invitations 
            SET is_claimed = TRUE, claimed_at = NOW() 
            WHERE id = v_invitation.id;
        ELSE
            v_role := NULL;
            v_status := 'pending';
        END IF;
    END IF;

    -- 3. Upsert into profiles
    INSERT INTO public.profiles (
        id, email, full_name, avatar_url, role, approval_status, is_super_admin, updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        v_role,
        v_status,
        v_is_super,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
        avatar_url = CASE WHEN profiles.avatar_url IS NULL OR profiles.avatar_url = '' THEN EXCLUDED.avatar_url ELSE profiles.avatar_url END,
        updated_at = NOW();

    -- Audit bootstrap if Super Admin
    IF v_is_super THEN
        INSERT INTO audit_logs (
            actor_id, actor_email, action, entity_type, entity_id, new_values, reason
        ) VALUES (
            NEW.id, NEW.email, 'INITIAL_SUPER_ADMIN_BOOTSTRAP', 'profiles', NEW.id::text,
            jsonb_build_object('role', 'super_admin', 'is_super_admin', true, 'status', 'approved'),
            'Automatic one-time verified Super Admin bootstrap'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if any and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- PREVENT PRIVILEGE ESCALATION TRIGGER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_acting_user_id UUID;
    v_is_acting_super BOOLEAN;
BEGIN
    v_acting_user_id := auth.uid();
    
    -- Check if acting user is Super Admin
    SELECT is_super_admin INTO v_is_acting_super
    FROM profiles
    WHERE id = v_acting_user_id;

    -- If target was or will be super admin, only existing super admin can modify
    IF (OLD.is_super_admin OR NEW.is_super_admin OR OLD.role = 'super_admin' OR NEW.role = 'super_admin') THEN
        IF v_is_acting_super IS NOT TRUE THEN
            RAISE EXCEPTION 'Unauthorized: Only a verified Super Admin can grant or revoke Super Admin privileges.';
        END IF;
    END IF;

    -- Regular users cannot approve their own account
    IF (OLD.approval_status != NEW.approval_status OR OLD.role IS DISTINCT FROM NEW.role) THEN
        IF v_acting_user_id = NEW.id AND v_is_acting_super IS NOT TRUE THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their own approval status or role.';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_security ON profiles;
CREATE TRIGGER trg_enforce_profile_security
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION enforce_profile_security();

-- ------------------------------------------------------------
-- LATE-RETURN FINE CALCULATION (Calendar-Day Default)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_late_days_and_fine(
    p_expected_return_date DATE,
    p_actual_return_date DATE,
    p_daily_rate NUMERIC DEFAULT 200.00
)
RETURNS TABLE (
    late_days INT,
    total_fine NUMERIC(10, 2)
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_days INT;
BEGIN
    IF p_actual_return_date IS NULL OR p_expected_return_date IS NULL THEN
        RETURN QUERY SELECT 0, 0.00::NUMERIC(10, 2);
        RETURN;
    END IF;

    -- Calendar date difference
    v_days := GREATEST(0, (p_actual_return_date - p_expected_return_date));
    
    RETURN QUERY SELECT v_days, (v_days * p_daily_rate)::NUMERIC(10, 2);
END;
$$;

-- ------------------------------------------------------------
-- HOSTEL RETURN REGISTRATION PROCEDURE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_hostel_return(
    p_leave_record_id UUID,
    p_actual_return_date DATE,
    p_actual_return_time TIME,
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_leave RECORD;
    v_late_days INT;
    v_fine NUMERIC(10, 2);
    v_fine_status TEXT;
    v_operator_id UUID;
BEGIN
    v_operator_id := auth.uid();
    
    SELECT * INTO v_leave FROM student_leave_records WHERE id = p_leave_record_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave record not found: %', p_leave_record_id;
    END IF;

    IF v_leave.status = 'Returned' THEN
        RAISE EXCEPTION 'Student has already been marked as returned for this leave record.';
    END IF;

    -- Calculate late days and fine using the snapshot rate from the leave record
    v_late_days := GREATEST(0, (p_actual_return_date - v_leave.expected_return_date));
    v_fine := (v_late_days * v_leave.fine_per_day_applied)::NUMERIC(10, 2);
    
    IF v_fine > 0 THEN
        v_fine_status := 'unpaid';
    ELSE
        v_fine_status := 'no_fine';
    END IF;

    -- Update leave record
    UPDATE student_leave_records
    SET actual_return_date = p_actual_return_date,
        actual_return_time = p_actual_return_time,
        late_days = v_late_days,
        calculated_fine = v_fine,
        adjusted_fine = v_fine,
        fine_status = v_fine_status,
        status = 'Returned',
        return_recorded_by = v_operator_id,
        remarks = COALESCE(p_remarks, remarks),
        updated_at = NOW()
    WHERE id = p_leave_record_id;

    -- Update student status to Active
    UPDATE students
    SET status = 'Active',
        hostel_status = 'resident',
        updated_at = NOW()
    WHERE id = v_leave.student_id;

    -- Append gate log
    INSERT INTO hostel_entry_exit_logs (
        student_id, leave_record_id, movement_type, movement_timestamp, gate_operator_id, remarks
    ) VALUES (
        v_leave.student_id, p_leave_record_id, 'Entry',
        (p_actual_return_date || ' ' || p_actual_return_time)::TIMESTAMPTZ,
        v_operator_id, p_remarks
    );

    -- Log audit
    PERFORM log_audit_event(
        'HOSTEL_RETURN_RECORDED', 'student_leave_records', p_leave_record_id::text,
        jsonb_build_object('status', v_leave.status),
        jsonb_build_object('status', 'Returned', 'late_days', v_late_days, 'fine', v_fine)
    );

    RETURN jsonb_build_object(
        'success', true,
        'leave_record_id', p_leave_record_id,
        'late_days', v_late_days,
        'calculated_fine', v_fine,
        'fine_status', v_fine_status
    );
END;
$$;

-- ------------------------------------------------------------
-- AUTOMATIC TEACHER DUTY FINALIZATION FUNCTION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION finalize_overdue_attendance_sessions()
RETURNS TABLE (
    finalized_sessions_count INT,
    finalized_teachers_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_sess_count INT := 0;
    v_teach_count INT := 0;
    v_session RECORD;
    v_teacher RECORD;
BEGIN
    -- Scan sessions that have passed attendance_window_closes and are not completed/cancelled
    FOR v_session IN 
        SELECT id, classroom_id, session_date 
        FROM attendance_sessions
        WHERE status IN ('scheduled', 'in_progress')
          AND attendance_window_closes < NOW()
    LOOP
        v_sess_count := v_sess_count + 1;
        
        -- Find assigned teachers who haven't completed duty
        FOR v_teacher IN
            SELECT cta.teacher_id
            FROM classroom_teacher_assignments cta
            LEFT JOIN teacher_session_attendance tsa 
                   ON tsa.session_id = v_session.id AND tsa.teacher_id = cta.teacher_id
            WHERE cta.classroom_id = v_session.classroom_id
              AND (tsa.id IS NULL OR tsa.status = 'Pending')
        LOOP
            INSERT INTO teacher_session_attendance (
                session_id, teacher_id, status, auto_finalized_at, remarks
            ) VALUES (
                v_session.id, v_teacher.teacher_id, 'Auto_Absent', NOW(), 'Automatically marked absent due to missed attendance window deadline'
            )
            ON CONFLICT (session_id, teacher_id) DO UPDATE SET
                status = 'Auto_Absent',
                auto_finalized_at = NOW(),
                remarks = 'Automatically marked absent due to missed attendance window deadline';
                
            v_teach_count := v_teach_count + 1;
        END LOOP;

        UPDATE attendance_sessions
        SET status = 'auto_finalized'
        WHERE id = v_session.id;

    END LOOP;

    RETURN QUERY SELECT v_sess_count, v_teach_count;
END;
$$;
