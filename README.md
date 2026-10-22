# TPS HOSTEL ERP
### Complete Hostel ERP, Attendance, Examination & Result Management Web Application
**Institution:** Thaiba Public School (TPS)  
**Tagline:** Modern Education with Morality  
**Initial Super Admin:** `abdulhaseebkt2@gmail.com`  
**Application Format:** Installable Progressive Web App (PWA) with Light-Theme-First Institutional SaaS UI

---

## 1. Application Overview

**TPS Hostel ERP** is an institutional web application built for **Thaiba Public School (TPS)** to manage student admissions, class and hostel section assignments, teacher timetables, student and teacher attendance, group and individual hostel leaves, calendar-day late-return fines, discipline records and black marks, examinations, marks entry, report card generation, parent communications, hostel bed allocations, fees, and operational reports.

### Key Capabilities

1. **Identity & Role-Based Access Control (RBAC):**
   - Single unified login portal with Google OAuth & Supabase Auth.
   - Initial Super Admin (`abdulhaseebkt2@gmail.com`) is bootstrapped securely via server/database logic.
   - New sign-ups enter `approval_status = 'pending'` and are blocked from all school data until reviewed.
   - Six supported roles: **Super Admin**, **Admin**, **Hostel Mentor / Warden**, **Teacher**, **Parent**, and **Student**.
   - Strict prevention of non-super-admin privilege escalation.
2. **Dynamic Section & Classroom Hierarchy:**
   - `Attendance Program → Section → Classroom → Assigned Students → Assigned Teachers & Timetable`.
   - Pre-configured attendance programs: **Hostel Moral Class**, **Hostel Coaching Class**, and **School Coaching Class** (mixed boys & girls).
   - Configurable section categories and classrooms without hardcoded limits or code changes.
   - Independent classroom assignment per attendance program (e.g., school Class 3, 4, 5 students can share a single Moral Classroom).
3. **Automated Server-Time Attendance Windows:**
   - Teachers take attendance only during their authorized scheduled session and permitted window.
   - Mark All Present, Reset, and individual status toggles (Present, Absent, Late, Excused, Approved Leave).
   - Independent teacher attendance tracking with automated absence finalization for missed duty deadlines.
4. **Hostel Leave & Return Register:**
   - **Type A: Group Hostel Leave** for holidays/vacations with multi-student selector and bulk leave card generation.
   - **Type B: Individual Hostel Leave** for personal departures.
   - Gate entry/exit logging with return check-in and presence status updates.
   - Printable A4 Student Leave Card with institution branding and signatures.
5. **Calendar-Day Late-Return Fine Engine:**
   - Strict institutional rule: `Late Days = MAX(0, Actual Return Date − Expected Return Date)`.
   - `Late Fine = Late Days × Applicable Daily Rate (₹200.00 default)`.
   - Returning on the scheduled calendar date produces zero fine.
   - Snapshot rate preserved at departure; fine waiver workflow with mandatory audit reasons; printable fine clearance slips.
6. **Discipline & Black Mark Ledger:**
   - Rule violation tracking (unauthorized departures, property damage, glass breaking, bullying, contraband mobile phones).
   - Cumulative black mark ledger and property damage monetary fines.
   - Parent access restricted strictly to their child's records with notification tracking.
7. **Examination & Report Cards:**
   - Exam scheduling, subjects, max marks, passing marks, and theory/practical components.
   - Spreadsheet-style marks entry with input validation (no negative values, cannot exceed max marks).
   - Publication gate: Unpublished results are strictly private to staff.
   - Class rankings (Standard Sequential & Competition Tied) and printable A4 report cards.
8. **Hostel Dormitory & Operational ERP:**
   - Unit, room, and bed allocation with double-booking prevention.
   - Monthly boarding and mess fee invoices, payment recording, and receipts.
   - Notices with formatted copyable WhatsApp text generator.
   - Hostel infrastructure maintenance work orders.
   - Centralized Report Center with export to **Excel (.xlsx)**, **CSV**, and **Print / PDF**.
   - Immutable administrative audit logs.

---

## 2. Technology Stack

- **Frontend:** Modular Vanilla JavaScript (ES modules), HTML5, CSS3
- **Build Tool:** Vite 6
- **Database & Auth:** Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS)
- **Icons:** Lucide Icons
- **Spreadsheet Generation:** SheetJS (`xlsx`)
- **Design System:** UI/UX Pro Max (Light-Theme-First institutional design system)
- **Automated Testing:** Vitest & SQL pgTAP Test Suites

---

## 3. Project File Structure

```
TPSH/
├── .agent/skills/ui-ux-pro-max/      # UI/UX Pro Max design intelligence engine
├── design-system/
│   └── MASTER.md                     # Institutional design system source of truth
├── public/
│   ├── favicon.svg                   # TPS institutional crest icon
│   ├── manifest.json                 # PWA manifest
│   └── sw.js                         # Offline Service Worker (zero sensitive data caching)
├── src/
│   ├── app.js                        # Master router, auth watcher & shell controller
│   ├── components/
│   │   ├── navbar.js                 # Top bar, role selector simulator, branding
│   │   └── sidebar.js                # Collapsible sidebar, navigation categories
│   ├── lib/
│   │   ├── auth.js                   # Authentication state & Google OAuth integration
│   │   ├── db.js                     # Centralized database service & mock fallback
│   │   ├── dialog.js                 # Modal dialogs & confirmation prompts
│   │   ├── permissions.js            # Role-Based Access Control matrix & checks
│   │   ├── supabase.js               # Supabase JS client configuration
│   │   ├── toast.js                  # Non-blocking notification toasts
│   │   └── utils.js                  # Date formatting (Asia/Kolkata), currency (₹), exports
│   ├── modules/
│   │   ├── admissions/               # Student admission wizard with photo upload
│   │   ├── assignments/              # Student & teacher classroom assignments
│   │   ├── attendance/               # Moral, Hostel Coaching, School Coaching attendance
│   │   ├── audit/                    # Immutable administrative audit logs
│   │   ├── dashboard/                # Role-specific dashboard analytics
│   │   ├── discipline/               # Incident logging & black marks ledger
│   │   ├── exams/                    # Examination scheduling & config
│   │   ├── fees/                     # Hostel fee billing & receipt clearance
│   │   ├── fines/                    # Late return fine engine & printable slips
│   │   ├── hostel/                   # Hostel units, rooms & bed occupancy
│   │   ├── leaves/                   # Group & Individual leave register & leave cards
│   │   ├── maintenance/              # Infrastructure work orders & repairs
│   │   ├── marks/                    # Marks entry spreadsheet & A4 report cards
│   │   ├── notices/                  # Broadcast alerts & copyable WhatsApp texts
│   │   ├── reports/                  # Centralized reports center (CSV/XLSX/Print)
│   │   ├── sections/                 # Dynamic programs, sections & classrooms
│   │   ├── settings/                 # Institutional profile & automation policy
│   │   ├── students/                 # Student directory & temporary break management
│   │   └── users/                    # User approvals, invitations & permission matrix
│   └── styles/
│       └── main.css                  # Institutional stylesheet & print layouts
├── supabase/
│   ├── migrations/
│   │   ├── 20261021000001_initial_schema.sql           # Core tables & foreign keys
│   │   ├── 20261021000002_functions_and_triggers.sql   # Super Admin bootstrap & procedures
│   │   ├── 20261021000003_row_level_security.sql       # RLS policies across all tables
│   │   ├── 20261021000004_seed_data.sql                # Initial institutional programs & seed
│   │   └── 20261021000005_storage_buckets.sql          # Storage buckets & file policies
│   └── tests/
│       └── rls_security_tests.sql                      # SQL-level database security tests
├── tests/
│   └── app.test.js                   # Automated Vitest integration test suite (14 tests)
├── .env.example                      # Template environment variables
├── .env.local                        # Local active configuration
├── index.html                        # Application entry point
├── package.json                      # Dependencies and scripts
└── vite.config.js                    # Vite configuration with chunk splitting
```

---

## 4. Supabase Database Migrations & Schema

The migrations are located under `supabase/migrations/` and should be executed in sequential order in your Supabase SQL Editor:

1. **`20261021000001_initial_schema.sql`**
   - Creates institutional tables: `app_settings`, `profiles`, `user_invitations`, `role_permissions`, `user_permission_overrides`, `user_scopes`, `audit_logs`, `academic_years`, `school_classes`, `school_sections`, `hostel_units`, `hostel_rooms`, `hostel_beds`, `bed_allocations`, `students`, `student_status_history`, `student_guardians`, `attendance_programs`, `program_sections`, `classrooms`, `classroom_student_assignments`, `classroom_teacher_assignments`, `teacher_timetables`, `attendance_sessions`, `student_attendance`, `teacher_session_attendance`, `fine_policies`, `leave_events`, `student_leave_records`, `hostel_entry_exit_logs`, `fine_payments`, `discipline_categories`, `discipline_incidents`, `student_black_mark_ledger`, `subjects`, `class_subject_assignments`, `examinations`, `exam_subjects`, `exam_marks`, `grade_scales`, `result_publications`, `fee_types`, `fee_invoices`, `fee_payments`, `announcements`, `announcement_recipients`, `maintenance_requests`.
2. **`20261021000002_functions_and_triggers.sql`**
   - `handle_new_user()` trigger: Automatically assigns `role = 'super_admin'`, `approval_status = 'approved'`, `is_super_admin = true` if `NEW.email = 'abdulhaseebkt2@gmail.com'`. All other users default to `approval_status = 'pending'`.
   - `enforce_profile_security()` trigger: Blocks non-super-admins from privilege escalation.
   - `calculate_late_days_and_fine()`: Immutable calendar-day late calculation.
   - `record_hostel_return()`: Transactional gate return logging and fine snapshot.
   - `finalize_overdue_attendance_sessions()`: Background automated teacher absence engine.
3. **`20261021000003_row_level_security.sql`**
   - Enables RLS on all business tables.
   - Implements granular `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies for Super Admin, Admin, Mentor, Teacher, Parent, and Student.
4. **`20261021000004_seed_data.sql`**
   - Seeds Thaiba Public School initial configurations, academic year `2026-2027`, Class 1 to 10, Moral Class categories, Coaching Class categories, ₹200 fine policy, and 9 discipline violation types.
5. **`20261021000005_storage_buckets.sql`**
   - Configures private Supabase storage buckets `student-photos` and `incident-evidence` with mime-type and size limits.

---

## 5. Google Cloud & Supabase Authentication Setup

To activate Google OAuth in Supabase:

1. **Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**.
   - Configure User Type as **External**, app name `TPS Hostel ERP`, user support email, and save.
   - Go to **Credentials** → **Create Credentials** → **OAuth Client ID**.
   - Select Application type: **Web application**.
   - Add Authorized JavaScript Origins:
     - `http://localhost:5173`
     - Your production domain URL.
   - Add Authorized redirect URIs:
     - `https://txbjraknaaokenyvbaak.supabase.co/auth/v1/callback`
   - Copy the generated **Client ID** and **Client Secret**.
2. **Supabase Dashboard:**
   - Open your project at [Supabase Dashboard](https://supabase.com/dashboard/project/txbjraknaaokenyvbaak).
   - Go to **Authentication** → **Providers** → **Google**.
   - Enable the Google provider toggle.
   - Paste the Google **Client ID** and **Client Secret**.
   - Under **URL Configuration**, set:
     - Site URL: `http://localhost:5173` (or production URL).
     - Redirect URLs: `http://localhost:5173/**`.
3. **Test Initial Super Admin Login:**
   - Sign in with Google using `abdulhaseebkt2@gmail.com`.
   - The database trigger automatically elevates this account to Super Admin with full institutional control.

---

## 6. Windows Development & Running Instructions

Open PowerShell or Windows Terminal in the project directory:

```powershell
# 1. Install dependencies
npm install

# 2. Automatically execute all Supabase SQL migrations
npm run db:migrate
# or: node scripts/supabase-agent.js
# or run in PowerShell: .\scripts\run-supabase-agent.ps1

# 3. Run automated test suite
npm test

# 4. Build optimized production bundle
npm run build

# 5. Start local development server
npm run dev

# 6. Preview production build
npm run preview
```

Open `http://localhost:5173` in any modern web browser.

---

## 7. Automated Test Results

The test suite verifies application logic, security, and institutional business rules:

```
 RUN  v3.2.7 E:/Web Apk/TPSH

 ✓ tests/app.test.js (14 tests) 14ms
   ✓ 1. Authentication & Role Permissions Tests > Initial Super Admin has full unrestricted access to all 20 modules
   ✓ 1. Authentication & Role Permissions Tests > Pending user cannot access protected school modules
   ✓ 1. Authentication & Role Permissions Tests > Admin cannot promote themselves or anyone else to Super Admin
   ✓ 1. Authentication & Role Permissions Tests > Teacher cannot access unauthorized modules (like fees, users, settings)
   ✓ 1. Authentication & Role Permissions Tests > Parent cannot access other modules or edit records
   ✓ 2. Late-Return Fine Engine Tests (Calendar-Day Rule) > Returns 0 late days and ₹0.00 fine when student returns on the expected date
   ✓ 2. Late-Return Fine Engine Tests (Calendar-Day Rule) > Returns 0 late days and ₹0.00 fine when student returns early
   ✓ 2. Late-Return Fine Engine Tests (Calendar-Day Rule) > Returns 2 late days and ₹400.00 fine when student returns 2 calendar days late (2 June -> 4 June)
   ✓ 2. Late-Return Fine Engine Tests (Calendar-Day Rule) > Correctly handles month boundary transitions (31 October -> 2 November)
   ✓ 3. Student Admissions & Lifecycle Database Tests > Creates student with required admission number and default Active status
   ✓ 3. Student Admissions & Lifecycle Database Tests > Correctly puts student on temporary break and restores upon rejoining
   ✓ 4. Hostel Leave & Return Register Tests > Group Leave marks only selected students on leave, leaving others active
   ✓ 4. Hostel Leave & Return Register Tests > Recording return computes calendar-day fine and marks student active
   ✓ 5. Examination & Results Publication Security Tests > Marks publication changes status to Published and audits action

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  972ms
```

---

## 8. Definition of Done Checklist

- [x] Initial Super Admin bootstrap for `abdulhaseebkt2@gmail.com` implemented via database trigger and secure rules.
- [x] Unapproved Google accounts enter Pending Approval screen with restricted access.
- [x] Role-Based Access Control enforced across all 20 modules and PostgreSQL RLS.
- [x] Student Admissions workflow with auto-generated admission numbers, photo preview, and address validation.
- [x] Configurable Attendance Programs (Moral Class, Hostel Coaching, School Coaching) and dynamic categories.
- [x] Independent student assignments per attendance program.
- [x] Teacher timetables with session window validation and double-booking conflict prevention.
- [x] Independent Student & Teacher attendance tracking with automatic absence finalization.
- [x] Group Leave (Type A) and Individual Leave (Type B) with traceable return check-in.
- [x] Calendar-day late return fine engine (`MAX(0, actual − expected) * fine_rate`).
- [x] A4 printable Student Leave Card and Fine Clearance Slip.
- [x] Discipline register with black mark ledger and property damage fines.
- [x] Examination setup, marks entry spreadsheet, publication gates, and printable Report Cards.
- [x] Parent access strictly limited to linked children.
- [x] UI/UX Pro Max design system guidelines integrated with responsive design (320px to 1920px).
- [x] PWA manifest, service worker, and app icons.
- [x] Production build passes cleanly with chunk splitting and 14/14 automated tests passing.
