-- ============================================================
-- TPS HOSTEL IRP: USER PROFILE FIELDS & UPDATE RPC
-- Institution: Thaiba Public School
-- ============================================================

-- Add profile fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS tps_id TEXT,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- Drop function first to allow return type expansion
DROP FUNCTION IF EXISTS public.get_manageable_users();

-- Update get_manageable_users function to include the new profile fields
CREATE OR REPLACE FUNCTION public.get_manageable_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT,
    approval_status TEXT,
    is_super_admin BOOLEAN,
    blood_group TEXT,
    tps_id TEXT,
    profile_completed BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.email, 
        p.full_name, 
        p.phone,
        p.avatar_url, 
        p.role, 
        p.approval_status, 
        p.is_super_admin, 
        p.blood_group,
        p.tps_id,
        COALESCE(p.profile_completed, FALSE),
        p.created_at, 
        p.updated_at
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- Universal Profile Update Function (Accessible to user themselves and Super Admin)
CREATE OR REPLACE FUNCTION public.admin_or_self_update_profile(
    p_user_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_avatar_url TEXT,
    p_blood_group TEXT,
    p_tps_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    updated_row profiles%ROWTYPE;
BEGIN
    UPDATE public.profiles
    SET 
        full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
        phone = p_phone,
        avatar_url = COALESCE(NULLIF(p_avatar_url, ''), avatar_url),
        blood_group = p_blood_group,
        tps_id = p_tps_id,
        profile_completed = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO updated_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile with id % not found', p_user_id;
    END IF;

    -- Also log in audit_logs
    INSERT INTO public.audit_logs (
        action, entity_type, entity_id, new_values, reason
    ) VALUES (
        'USER_PROFILE_UPDATE', 
        'profiles', 
        p_user_id::text,
        jsonb_build_object('full_name', updated_row.full_name, 'phone', p_phone, 'blood_group', p_blood_group, 'tps_id', p_tps_id),
        'User profile details updated'
    );

    RETURN to_jsonb(updated_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manageable_users() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_or_self_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
