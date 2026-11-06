-- ============================================================
-- TPS HOSTEL IRP: FLEET MANAGEMENT & USAGE BILLING MODULE
-- Schema Migration: 20261106000001_fleet_management.sql
-- Institution: Thaiba Public School
-- ============================================================

-- ------------------------------------------------------------
-- 1. EXTEND PROFILE ROLES TO SUPPORT VEHICLE USERS
-- ------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN (
        'super_admin', 
        'admin', 
        'mentor', 
        'boys_mentor', 
        'girls_mentor', 
        'teacher', 
        'parent', 
        'student', 
        'hostel_leader', 
        'vehicle_user'
    ));

-- ------------------------------------------------------------
-- 2. VEHICLE MASTER REGISTRY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id TEXT PRIMARY KEY DEFAULT ('veh-' || gen_random_uuid()::text),
    vehicle_name TEXT NOT NULL,
    reg_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL DEFAULT '4 Wheeler' CHECK (vehicle_type IN ('2 Wheeler', '3 Wheeler', '4 Wheeler', 'Heavy')),
    current_odometer NUMERIC NOT NULL DEFAULT 0 CHECK (current_odometer >= 0),
    fallback_rate_per_km NUMERIC(8, 2) NOT NULL DEFAULT 16.00 CHECK (fallback_rate_per_km > 0),
    buffer_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (buffer_percentage >= 0),
    status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'On Trip', 'Maintenance', 'Inactive')),
    photo_url TEXT,
    allow_instant_short_ride BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(vehicle_type);

-- ------------------------------------------------------------
-- 3. VEHICLE COMPLIANCE DOCUMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
    id TEXT PRIMARY KEY DEFAULT ('vdoc-' || gen_random_uuid()::text),
    vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('Registration (RC)', 'Insurance Policy', 'Pollution (PUC)', 'Road Tax', 'Fitness Certificate', 'Permit', 'Other')),
    document_number TEXT,
    issue_date DATE,
    expiry_date DATE NOT NULL,
    file_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vdocs_vehicle_id ON public.vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vdocs_expiry_date ON public.vehicle_documents(expiry_date);

-- ------------------------------------------------------------
-- 4. VEHICLE EXPENSES & BILL-TO-BILL FUEL EFFICIENCY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
    id TEXT PRIMARY KEY DEFAULT ('vexp-' || gen_random_uuid()::text),
    vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('Fuel', 'Maintenance', 'Toll/Tax', 'Insurance', 'Other')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    fuel_liters NUMERIC(8, 2) CHECK (fuel_liters IS NULL OR fuel_liters > 0),
    odometer_at_expense NUMERIC CHECK (odometer_at_expense IS NULL OR odometer_at_expense >= 0),
    calculated_mileage_kmpl NUMERIC(6, 2) CHECK (calculated_mileage_kmpl IS NULL OR calculated_mileage_kmpl >= 0),
    notes TEXT,
    logged_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vexp_vehicle_date ON public.vehicle_expenses(vehicle_id, date DESC);

-- ------------------------------------------------------------
-- 5. TRIP LOGS (REQUEST -> APPROVAL -> COMPUTE -> BILLING)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_logs (
    id TEXT PRIMARY KEY DEFAULT ('trip-' || gen_random_uuid()::text),
    trip_id TEXT NOT NULL UNIQUE,
    vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_email TEXT,
    user_phone TEXT,
    destination TEXT,
    purpose TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    start_km NUMERIC CHECK (start_km IS NULL OR start_km >= 0),
    end_km NUMERIC CHECK (end_km IS NULL OR end_km >= 0),
    total_km NUMERIC CHECK (total_km IS NULL OR total_km >= 0),
    applied_rate_per_km NUMERIC(8, 2),
    total_amount NUMERIC(10, 2) DEFAULT 0,
    amount_paid NUMERIC(10, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'In Progress' CHECK (status IN ('Pending Approval', 'Approved', 'In Progress', 'Completed', 'Rejected', 'Cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid')),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    payment_id TEXT,
    payment_method TEXT,
    payment_received_by TEXT,
    rejection_reason TEXT,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_user ON public.trip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_vehicle ON public.trip_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_status ON public.trip_logs(status);
CREATE INDEX IF NOT EXISTS idx_trip_logs_payment ON public.trip_logs(payment_status);

-- ------------------------------------------------------------
-- 6. IMMUTABLE VEHICLE PAYMENTS AUDIT LEDGER
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_payments (
    id TEXT PRIMARY KEY DEFAULT ('vpay-' || gen_random_uuid()::text),
    trip_id TEXT NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Salary Deduction', 'Other')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    received_by_admin_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpay_trip_id ON public.vehicle_payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_vpay_received_admin ON public.vehicle_payments(received_by_admin_id);

-- ------------------------------------------------------------
-- 7. VEHICLE USERS & DRIVERS DIRECTORY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_users (
    id TEXT PRIMARY KEY DEFAULT ('vu-' || gen_random_uuid()::text),
    tps_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    license_number TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vu_tps_id ON public.vehicle_users(tps_id);

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_users ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an authorized vehicle admin
CREATE OR REPLACE FUNCTION public.is_vehicle_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role IN ('super_admin', 'admin') OR is_super_admin = TRUE)
          AND approval_status = 'approved'
    );
$$;

-- Helper function to check if user has vehicle module access (Admin, Teacher, Vehicle User)
CREATE OR REPLACE FUNCTION public.can_use_vehicles()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('super_admin', 'admin', 'teacher', 'vehicle_user')
          AND approval_status = 'approved'
    );
$$;

-- 8A. Vehicles Policies
DROP POLICY IF EXISTS "Vehicle Admins Full Access on vehicles" ON public.vehicles;
CREATE POLICY "Vehicle Admins Full Access on vehicles" 
    ON public.vehicles FOR ALL 
    USING (public.is_vehicle_admin())
    WITH CHECK (public.is_vehicle_admin());

DROP POLICY IF EXISTS "Authorized Users View Vehicles" ON public.vehicles;
CREATE POLICY "Authorized Users View Vehicles" 
    ON public.vehicles FOR SELECT 
    USING (public.can_use_vehicles());

-- 8B. Vehicle Documents Policies
DROP POLICY IF EXISTS "Vehicle Admins Full Access on vehicle_documents" ON public.vehicle_documents;
CREATE POLICY "Vehicle Admins Full Access on vehicle_documents" 
    ON public.vehicle_documents FOR ALL 
    USING (public.is_vehicle_admin())
    WITH CHECK (public.is_vehicle_admin());

DROP POLICY IF EXISTS "Authorized Users View Vehicle Documents" ON public.vehicle_documents;
CREATE POLICY "Authorized Users View Vehicle Documents" 
    ON public.vehicle_documents FOR SELECT 
    USING (public.can_use_vehicles());

-- 8C. Vehicle Expenses Policies
DROP POLICY IF EXISTS "Vehicle Admins Full Access on vehicle_expenses" ON public.vehicle_expenses;
CREATE POLICY "Vehicle Admins Full Access on vehicle_expenses" 
    ON public.vehicle_expenses FOR ALL 
    USING (public.is_vehicle_admin())
    WITH CHECK (public.is_vehicle_admin());

-- 8D. Trip Logs Policies
DROP POLICY IF EXISTS "Vehicle Admins Full Access on trip_logs" ON public.trip_logs;
CREATE POLICY "Vehicle Admins Full Access on trip_logs" 
    ON public.trip_logs FOR ALL 
    USING (public.is_vehicle_admin())
    WITH CHECK (public.is_vehicle_admin());

DROP POLICY IF EXISTS "Authorized Users Read Own Trip Logs" ON public.trip_logs;
CREATE POLICY "Authorized Users Read Own Trip Logs" 
    ON public.trip_logs FOR SELECT 
    USING (public.can_use_vehicles() AND (user_id = auth.uid() OR auth.uid() IS NULL));

DROP POLICY IF EXISTS "Authorized Users Insert Own Trip Logs" ON public.trip_logs;
CREATE POLICY "Authorized Users Insert Own Trip Logs" 
    ON public.trip_logs FOR INSERT 
    WITH CHECK (public.can_use_vehicles() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Authorized Users Update Own Active Trips" ON public.trip_logs;
CREATE POLICY "Authorized Users Update Own Active Trips" 
    ON public.trip_logs FOR UPDATE 
    USING (public.can_use_vehicles() AND user_id = auth.uid() AND status IN ('In Progress', 'Pending Approval'))
    WITH CHECK (public.can_use_vehicles() AND user_id = auth.uid());

-- 8E. Vehicle Payments Policies
DROP POLICY IF EXISTS "Vehicle Admins Full Access on vehicle_payments" ON public.vehicle_payments;
CREATE POLICY "Vehicle Admins Full Access on vehicle_payments" 
    ON public.vehicle_payments FOR ALL 
    USING (public.is_vehicle_admin())
    WITH CHECK (public.is_vehicle_admin());

DROP POLICY IF EXISTS "Authorized Users Read Own Trip Payments" ON public.vehicle_payments;
CREATE POLICY "Authorized Users Read Own Trip Payments" 
    ON public.vehicle_payments FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.trip_logs t 
            WHERE (t.id = trip_id OR t.trip_id = trip_id) 
              AND t.user_id = auth.uid()
        )
    );

-- 8F. Vehicle Users Directory Policies
DROP POLICY IF EXISTS "Vehicle Admins Full Access on vehicle_users" ON public.vehicle_users;
CREATE POLICY "Vehicle Admins Full Access on vehicle_users" 
    ON public.vehicle_users FOR ALL 
    USING (public.is_vehicle_admin())
    WITH CHECK (public.is_vehicle_admin());

-- ------------------------------------------------------------
-- 9. INITIAL MASTER SEED DATA
-- ------------------------------------------------------------
INSERT INTO public.vehicles (id, vehicle_name, reg_number, vehicle_type, current_odometer, fallback_rate_per_km, buffer_percentage, status, allow_instant_short_ride)
VALUES 
    ('veh-1', 'Honda Unicorn', 'KL-55-AB-1234', '2 Wheeler', 50000, 18.00, 10, 'Available', TRUE),
    ('veh-2', 'Staff Executive Sedan', 'KL-55-CD-5678', '4 Wheeler', 28400, 61.42, 10, 'Available', FALSE),
    ('veh-3', 'Campus Utility Bolero', 'KL-55-EF-9012', '4 Wheeler', 61200, 16.00, 10, 'Available', TRUE),
    ('veh-4', 'Campus Heavy Transport', 'KL10 1324', 'Heavy', 250000, 24.00, 10, 'Available', TRUE)
ON CONFLICT (reg_number) DO NOTHING;

INSERT INTO public.vehicle_users (id, tps_id, full_name, email, phone, license_number, status)
VALUES 
    ('vu-1', 'VUS001', 'Sameer Driver', 'driver@thaibaschool.edu.in', '+91 98470 99887', 'DL-KL-2018-00912', 'Active'),
    ('vu-2', 'VUS002', 'Babu Senior Driver', 'babu.driver@thaibaschool.edu.in', '+91 98470 11998', 'DL-KL-2015-00451', 'Active')
ON CONFLICT (tps_id) DO NOTHING;
