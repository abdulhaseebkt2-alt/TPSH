-- ============================================================
-- Fleet Management: Real 3-Month Honda Unicorn WB 66 V 0909 Data
-- ============================================================

-- 1. Insert or update Honda Unicorn WB 66 V 0909
INSERT INTO public.vehicles (id, vehicle_name, reg_number, vehicle_type, current_odometer, fallback_rate_per_km, buffer_percentage, status, allow_instant_short_ride)
VALUES ('veh-1', 'Honda Unicorn', 'WB 66 V 0909', '2 Wheeler', 32609.3, 7.5, 10, 'Available', TRUE)
ON CONFLICT (reg_number) DO UPDATE SET
    vehicle_name = EXCLUDED.vehicle_name,
    vehicle_type = EXCLUDED.vehicle_type,
    current_odometer = EXCLUDED.current_odometer,
    fallback_rate_per_km = EXCLUDED.fallback_rate_per_km,
    buffer_percentage = EXCLUDED.buffer_percentage,
    status = EXCLUDED.status,
    allow_instant_short_ride = EXCLUDED.allow_instant_short_ride;

-- Clean existing seed expenses for this vehicle to prevent duplicates
DELETE FROM public.vehicle_expenses WHERE vehicle_id = 'veh-1';

-- 2. Insert all 29 real expenses
INSERT INTO public.vehicle_expenses (id, vehicle_id, expense_type, amount, date, fuel_liters, odometer_at_expense, calculated_mileage_kmpl, notes, logged_by, created_at)
VALUES
  ('vexp-unicorn-01', 'veh-1', 'Maintenance', 1480, '2026-08-08', NULL, 30000, NULL, 'Vehicle Maintenance: Service. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-08T09:00:00.000Z'),
  ('vexp-unicorn-02', 'veh-1', 'Fuel', 1000, '2026-08-11', 8.85, 30230.1, NULL, 'Initial baseline fuel refill ₹1000 (8.85 L @ ₹113/L). Logged by ABDURAHIMAN.', 'ABDURAHIMAN', '2026-08-11T13:30:00.000Z'),
  ('vexp-unicorn-03', 'veh-1', 'Fuel', 300, '2026-08-14', 2.65, 30299, 26, 'Fuel refill ₹300 (2.65 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-14T18:00:00.000Z'),
  ('vexp-unicorn-04', 'veh-1', 'Maintenance', 2400, '2026-08-17', NULL, 30299, NULL, 'Vehicle Maintenance: Service. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-17T22:30:00.000Z'),
  ('vexp-unicorn-05', 'veh-1', 'Fuel', 300, '2026-08-21', 2.65, 30367.9, 26, 'Fuel refill ₹300 (2.65 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-21T03:00:00.000Z'),
  ('vexp-unicorn-06', 'veh-1', 'Fuel', 370, '2026-08-24', 3.27, 30452.9, 26, 'Fuel refill ₹370 (3.27 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-24T07:30:00.000Z'),
  ('vexp-unicorn-07', 'veh-1', 'Toll/Tax', 80, '2026-08-27', NULL, 30452.9, NULL, 'Vehicle Documentation: PUC. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-27T12:00:00.000Z'),
  ('vexp-unicorn-08', 'veh-1', 'Fuel', 590, '2026-08-30', 5.22, 30588.6, 26, 'Fuel refill ₹590 (5.22 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-08-30T16:30:00.000Z'),
  ('vexp-unicorn-09', 'veh-1', 'Fuel', 500, '2026-09-02', 4.42, 30703.5, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-02T21:00:00.000Z'),
  ('vexp-unicorn-10', 'veh-1', 'Fuel', 330, '2026-09-06', 2.92, 30779.4, 26, 'Fuel refill ₹330 (2.92 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-06T01:30:00.000Z'),
  ('vexp-unicorn-11', 'veh-1', 'Fuel', 500, '2026-09-09', 4.42, 30894.3, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-09T06:00:00.000Z'),
  ('vexp-unicorn-12', 'veh-1', 'Fuel', 60, '2026-09-12', 0.53, 30908.1, 26, 'Fuel refill ₹60 (0.53 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-12T10:30:00.000Z'),
  ('vexp-unicorn-13', 'veh-1', 'Fuel', 500, '2026-09-15', 4.42, 31023, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-15T15:00:00.000Z'),
  ('vexp-unicorn-14', 'veh-1', 'Fuel', 500, '2026-09-18', 4.42, 31137.9, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-18T19:30:00.000Z'),
  ('vexp-unicorn-15', 'veh-1', 'Fuel', 500, '2026-09-22', 4.42, 31252.8, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-22T00:00:00.000Z'),
  ('vexp-unicorn-16', 'veh-1', 'Maintenance', 730, '2026-09-25', NULL, 31252.8, NULL, 'Vehicle Maintenance: Periodic Service & Maintenance. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-25T04:30:00.000Z'),
  ('vexp-unicorn-17', 'veh-1', 'Fuel', 1050, '2026-09-28', 9.29, 31494.3, 26, 'Fuel refill ₹1050 (9.29 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-09-28T09:00:00.000Z'),
  ('vexp-unicorn-18', 'veh-1', 'Fuel', 550, '2026-10-01', 4.87, 31620.9, 26, 'Fuel refill ₹550 (4.87 L @ ₹113/L). Mileage: 26.00 km/L. Logged by ABDURAHIMAN.', 'ABDURAHIMAN', '2026-10-01T13:30:00.000Z'),
  ('vexp-unicorn-19', 'veh-1', 'Fuel', 500, '2026-10-04', 4.42, 31735.8, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by ABDURAHIMAN.', 'ABDURAHIMAN', '2026-10-04T18:00:00.000Z'),
  ('vexp-unicorn-20', 'veh-1', 'Maintenance', 350, '2026-10-07', NULL, 31735.8, NULL, 'Vehicle Maintenance: Periodic Service & Maintenance. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-07T22:30:00.000Z'),
  ('vexp-unicorn-21', 'veh-1', 'Fuel', 500, '2026-10-11', 4.42, 31850.7, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-11T03:00:00.000Z'),
  ('vexp-unicorn-22', 'veh-1', 'Fuel', 500, '2026-10-14', 4.42, 31965.6, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-14T07:30:00.000Z'),
  ('vexp-unicorn-23', 'veh-1', 'Fuel', 500, '2026-10-17', 4.42, 32080.5, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-17T12:00:00.000Z'),
  ('vexp-unicorn-24', 'veh-1', 'Fuel', 300, '2026-10-20', 2.65, 32149.4, 26, 'Fuel refill ₹300 (2.65 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-20T16:30:00.000Z'),
  ('vexp-unicorn-25', 'veh-1', 'Fuel', 1000, '2026-10-23', 8.85, 32379.5, 26, 'Fuel refill ₹1000 (8.85 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-23T21:00:00.000Z'),
  ('vexp-unicorn-26', 'veh-1', 'Fuel', 500, '2026-10-27', 4.42, 32494.4, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by ABDURAHIMAN.', 'ABDURAHIMAN', '2026-10-27T01:30:00.000Z'),
  ('vexp-unicorn-27', 'veh-1', 'Maintenance', 1120, '2026-10-30', NULL, 32494.4, NULL, 'Vehicle Maintenance: Periodic Service & Maintenance. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-10-30T06:00:00.000Z'),
  ('vexp-unicorn-28', 'veh-1', 'Fuel', 500, '2026-11-02', 4.42, 32609.3, 26, 'Fuel refill ₹500 (4.42 L @ ₹113/L). Mileage: 26.00 km/L. Logged by HASEEB MUEENI.', 'Abdul Haseeb', '2026-11-02T10:30:00.000Z'),
  ('vexp-unicorn-29', 'veh-1', 'Maintenance', 400, '2026-11-05', NULL, 32609.3, NULL, 'Vehicle Maintenance: Periodic Service & Maintenance. Logged by ABDURAHIMAN.', 'ABDURAHIMAN', '2026-11-05T15:00:00.000Z');

-- 3. Insert Compliance Documents
DELETE FROM public.vehicle_documents WHERE vehicle_id = 'veh-1';
INSERT INTO public.vehicle_documents (id, vehicle_id, document_type, document_number, expiry_date, notes, created_at)
VALUES
  ('vdoc-1', 'veh-1', 'Registration (RC)', 'WB66V0909-RC', '2035-07-20', 'Vehicle permanent registration certificate', '2026-08-01T08:00:00.000Z'),
  ('vdoc-2', 'veh-1', 'Insurance Policy', 'INS-NEW-INDIA-909', '2027-06-15', 'Comprehensive two-wheeler insurance policy', '2026-08-01T08:00:00.000Z'),
  ('vdoc-3', 'veh-1', 'Pollution (PUC)', 'PUC-WB-2026-909', '2027-02-28', 'PUC emission clearance certificate (₹80 recorded on 28.Aug)', '2026-08-28T10:00:00.000Z'),
  ('vdoc-4', 'veh-1', 'Road Tax', 'TAX-WB-2026-909', '2030-03-31', 'One-time road tax paid', '2026-08-01T08:00:00.000Z');
