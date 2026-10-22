-- ============================================================
-- TPS HOSTEL IRP: STORAGE BUCKETS & OBJECT POLICIES
-- Institution: Thaiba Public School
-- ============================================================

-- Create private buckets for institutional assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('student-photos', 'student-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('incident-evidence', 'incident-evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('institutional-docs', 'institutional-docs', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies
DROP POLICY IF EXISTS "student_photos_read_staff" ON storage.objects;
CREATE POLICY "student_photos_read_staff" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'student-photos' AND (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND approval_status = 'approved' 
              AND role IN ('super_admin', 'admin', 'mentor', 'teacher')
        )
    ));

DROP POLICY IF EXISTS "student_photos_upload_staff" ON storage.objects;
CREATE POLICY "student_photos_upload_staff" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'student-photos' AND (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND approval_status = 'approved' 
              AND role IN ('super_admin', 'admin')
        )
    ));

DROP POLICY IF EXISTS "incident_evidence_staff" ON storage.objects;
CREATE POLICY "incident_evidence_staff" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'incident-evidence' AND (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND approval_status = 'approved' 
              AND role IN ('super_admin', 'admin', 'mentor')
        )
    ));
