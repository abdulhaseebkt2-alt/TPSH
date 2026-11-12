-- ==============================================================================
-- Migration: 20261111000001_isolate_app_settings_and_dpdp.sql
-- Description: Enforce strict multi-tenant RLS isolation on app_settings and
-- create DPDP Act 2023 consent logging and audit tables.
-- ==============================================================================

-- 1. Revoke overly broad SELECT policy on app_settings
DROP POLICY IF EXISTS "config_select_settings" ON public.app_settings;
DROP POLICY IF EXISTS "config_admin_settings" ON public.app_settings;
DROP POLICY IF EXISTS "config_select_settings_isolated" ON public.app_settings;
DROP POLICY IF EXISTS "config_admin_settings_isolated" ON public.app_settings;

-- 2. Create strictly isolated SELECT policy on app_settings
-- Only administrators (admin / super_admin) can read sensitive configuration keys 
-- (passwords, parent maps, vehicle head maps, custom user permissions).
-- General authenticated users can only retrieve whitelisted public branding/calendar keys.
CREATE POLICY "config_select_settings_isolated" ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    is_admin_or_super()
    OR key IN (
      'tps_institution_logo',
      'tps_mobile_front_logo',
      'tps_institution_settings',
      'tps_institution_info',
      'tps_current_academic_year',
      'tps_academic_calendar',
      'tps_theme_config',
      'tps_privacy_policy',
      'tps_terms_of_service'
    )
  );

-- 3. Strict mutation policy: Only administrators can modify or insert settings
CREATE POLICY "config_admin_settings_isolated" ON public.app_settings
  FOR ALL TO authenticated
  USING (is_admin_or_super())
  WITH CHECK (is_admin_or_super());

-- 4. Create DPDP Consent Logs Table for compliance audits (DPDP Act 2023 Sec 9 & 12)
CREATE TABLE IF NOT EXISTS public.dpdp_consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '2026.11-v1',
  verified_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.dpdp_consent_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS on dpdp_consent_logs: Admins can view all consent logs; individual users can view their own
DROP POLICY IF EXISTS "dpdp_consent_select_admin" ON public.dpdp_consent_logs;
CREATE POLICY "dpdp_consent_select_admin" ON public.dpdp_consent_logs
  FOR SELECT TO authenticated
  USING (is_admin_or_super() OR user_id = auth.uid());

DROP POLICY IF EXISTS "dpdp_consent_insert_authenticated" ON public.dpdp_consent_logs;
CREATE POLICY "dpdp_consent_insert_authenticated" ON public.dpdp_consent_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super() OR user_id = auth.uid());

-- Index for performant compliance queries
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_user_id ON public.dpdp_consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_consent_student_id ON public.dpdp_consent_logs(student_id);
