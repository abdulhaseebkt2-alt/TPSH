-- ============================================================
-- TPS HOSTEL IRP: USER MANAGEMENT RPC FUNCTIONS
-- Institution: Thaiba Public School
-- ============================================================

-- Function to retrieve all manageable users from public.profiles
CREATE OR REPLACE FUNCTION public.get_manageable_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT,
    approval_status TEXT,
    is_super_admin BOOLEAN,
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
        p.avatar_url, 
        p.role, 
        p.approval_status, 
        p.is_super_admin, 
        p.created_at, 
        p.updated_at
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- Function for Super Admin to update user approval status and role
CREATE OR REPLACE FUNCTION public.admin_set_user_approval(
    target_user_id UUID,
    new_approval_status TEXT,
    new_role TEXT DEFAULT NULL
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
        approval_status = new_approval_status,
        role = COALESCE(new_role, role),
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile with id % not found', target_user_id;
    END IF;

    -- Also insert audit log into audit_logs table
    INSERT INTO public.audit_logs (
        action, entity_type, entity_id, new_values, reason
    ) VALUES (
        'USER_APPROVAL_UPDATE', 
        'profiles', 
        target_user_id::text,
        jsonb_build_object('approval_status', new_approval_status, 'role', new_role, 'email', updated_row.email),
        'User approval and role assignment by administrator'
    );

    RETURN to_jsonb(updated_row);
END;
$$;

-- Grant permissions to authenticated and anon clients
GRANT EXECUTE ON FUNCTION public.get_manageable_users() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_approval(UUID, TEXT, TEXT) TO authenticated, anon;

-- Ensure profiles table has a permissive select policy for authenticated & anon
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT TO authenticated, anon
    USING (true);
