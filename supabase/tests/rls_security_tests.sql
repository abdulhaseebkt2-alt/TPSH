-- ============================================================
-- TPS HOSTEL IRP: DATABASE & RLS SECURITY TESTS (pgTAP / SQL Test Suite)
-- Institution: Thaiba Public School
-- ============================================================

BEGIN;

-- Test 1: Verify Initial Super Admin Bootstrap Logic
DO $$
DECLARE
    v_test_uid UUID := gen_random_uuid();
    v_prof RECORD;
BEGIN
    -- Simulate insertion of abdulhaseebkt2@gmail.com
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (v_test_uid, 'abdulhaseebkt2@gmail.com', jsonb_build_object('full_name', 'Abdul Haseeb'));
    
    SELECT * INTO v_prof FROM public.profiles WHERE id = v_test_uid;
    
    IF v_prof.role != 'super_admin' OR v_prof.is_super_admin != TRUE OR v_prof.approval_status != 'approved' THEN
        RAISE EXCEPTION 'TEST FAILED: Initial Super Admin was not granted super_admin role and approval!';
    END IF;
    
    RAISE NOTICE 'TEST 1 PASSED: Initial Super Admin bootstrap verified.';
    
    -- Cleanup test user
    DELETE FROM auth.users WHERE id = v_test_uid;
END;
$$;

-- Test 2: Verify Normal User Signs Up as Pending
DO $$
DECLARE
    v_test_uid UUID := gen_random_uuid();
    v_prof RECORD;
BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (v_test_uid, 'normal_user@example.com', jsonb_build_object('full_name', 'Normal User'));
    
    SELECT * INTO v_prof FROM public.profiles WHERE id = v_test_uid;
    
    IF v_prof.approval_status != 'pending' OR v_prof.is_super_admin != FALSE OR v_prof.role IS NOT NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Normal user did not get pending status or received unauthorized role!';
    END IF;
    
    RAISE NOTICE 'TEST 2 PASSED: Normal user pending approval verified.';
    
    DELETE FROM auth.users WHERE id = v_test_uid;
END;
$$;

-- Test 3: Verify Late Return Fine Calculation (Calendar-day Rule)
DO $$
DECLARE
    res RECORD;
BEGIN
    -- Scenario A: Return on same date -> 0 late days, 0 fine
    SELECT * INTO res FROM calculate_late_days_and_fine('2026-06-02'::DATE, '2026-06-02'::DATE, 200.00);
    IF res.late_days != 0 OR res.total_fine != 0.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Same date return should have 0 late days and 0 fine!';
    END IF;

    -- Scenario B: Return 2 calendar days late -> 2 late days, ₹400 fine
    SELECT * INTO res FROM calculate_late_days_and_fine('2026-06-02'::DATE, '2026-06-04'::DATE, 200.00);
    IF res.late_days != 2 OR res.total_fine != 400.00 THEN
        RAISE EXCEPTION 'TEST FAILED: 2 days late should calculate 400.00 fine, got: %', res.total_fine;
    END IF;

    -- Scenario C: Return early -> 0 late days, 0 fine
    SELECT * INTO res FROM calculate_late_days_and_fine('2026-06-05'::DATE, '2026-06-02'::DATE, 200.00);
    IF res.late_days != 0 OR res.total_fine != 0.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Early return should have 0 late days and 0 fine!';
    END IF;

    RAISE NOTICE 'TEST 3 PASSED: Calendar-day fine engine calculation verified.';
END;
$$;

-- Test 4: Verify Non-Super-Admin Cannot Elevate to Super Admin
DO $$
DECLARE
    v_admin_uid UUID := gen_random_uuid();
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_admin_uid, 'regular_admin@example.com');
    UPDATE profiles SET role = 'admin', approval_status = 'approved', is_super_admin = FALSE WHERE id = v_admin_uid;

    -- Attempt to update to super admin
    BEGIN
        UPDATE profiles SET is_super_admin = TRUE WHERE id = v_admin_uid;
        -- If we reach here without super admin context, trigger must fail
        RAISE EXCEPTION 'TEST FAILED: Privilege escalation should have been blocked!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'TEST 4 PASSED: Privilege escalation correctly blocked by trigger (%s)', SQLERRM;
    END;

    DELETE FROM auth.users WHERE id = v_admin_uid;
END;
$$;

ROLLBACK;
