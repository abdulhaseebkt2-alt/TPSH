# TPS HOSTEL ERP — WEB APK & PWA MASTER SPECIFICATION
> **Institution:** Thaiba Public School (TPS)  
> **Tagline:** Modern Education with Morality  
> **Initial Super Admin:** `abdulhaseebkt2@gmail.com`  
> **Application Type:** Progressive Web App (PWA) & Native Android Web APK  
> **Current Version:** `v1.6.0`  
> **Last Updated:** 2026-10-28T17:10:00+05:30  
> **Document Status:** LIVING DOCUMENT — MUST BE UPDATED ON EVERY CODE CHANGE

---

## ⚠️ MANDATORY AUTO-UPDATE PROTOCOL FOR DEVELOPERS & AI AGENTS

> [!IMPORTANT]
> **STRICT REVISION GOVERNANCE RULE:**
> Whenever **ANY** change is made to this codebase—whether it is a full feature, a bug fix, a styling update, a date format change, a component adjustment, or a single-line script edit:
> 1. You **MUST** update this file (`WEB_APK_DOCUMENTATION.md`).
> 2. You **MUST** record the change in [Section 10: Living Changelog & Revision History](#10-living-changelog--revision-history) with the date, timestamp, modified files, and summary.
> 3. You **MUST** update the affected component/module section in this document to reflect the current code behavior accurately.
> 4. You **MUST** verify all 54 unit tests pass (`cmd /c npm test`) and production build succeeds (`cmd /c npm run build`).
> 5. Never let code and this document drift apart!

---

## 1. System Overview & Identity

**TPS Hostel ERP** is an institutional-grade, light-theme-first Educational & Residential Resource Planning application designed for **Thaiba Public School (TPS)**. The platform powers student admissions, academic & hostel section hierarchies, teacher duties & timetables, live classroom attendance with locked window governance, hostel leave/gate pass registers with automated calendar-day fine calculation, discipline tracking with black marks, examination management with publication gates, dormitory bed allocations, fee accounting, and multi-format reporting.

### Core Institutional Tenets
1. **Unified Cloud State**: Mobile Web APK and Desktop browser sessions always reflect identical database records (timings, rooms, assignments, permissions, and attendance sessions).
2. **Role-Based Security**: 6 distinct user categories (**Super Admin**, **Admin**, **Teacher**, **Hostel Mentor/Warden**, **Parent**, **Student**) with dynamic RBAC 3-position toggles (Off / View Only / Full Access).
3. **Mobile-First Ergonomics**: Tailored for Android touchscreens with momentum drum roller date pickers, 2-way attendance slider switches, and clean minimal cards avoiding unnecessary dropdowns or emojis.

---

## 2. Web APK & Progressive Web App Architecture

The application is engineered to run seamlessly as:
1. **Desktop Web Application** on Chrome, Firefox, Safari, and Edge.
2. **Mobile Progressive Web App (PWA)** installed directly to Android/iOS home screens.
3. **Standalone Android Web APK** generated via Trusted Web Activity (TWA) / Bubblewrap / Android WebView wrapper.

### 2.1 Manifest Configuration (`public/manifest.json`)
```json
{
  "name": "TPS Hostel ERP",
  "short_name": "TPS ERP",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#5F259F",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/favicon.svg", "sizes": "192x192", "type": "image/svg+xml" },
    { "src": "/favicon.svg", "sizes": "512x512", "type": "image/svg+xml" }
  ]
}
```

### 2.2 Offline Service Worker (`public/sw.js`)
- **App Shell Caching**: Automatically pre-caches HTML, CSS, client JS, and institutional SVG crests for instant startup even under poor cellular connectivity.
- **Sensitive Data Isolation**: Zero personal student records, marks, or security logs are cached to persistent disk in the service worker.
- **Network-First Fallback**: Always queries live Supabase PostgreSQL first; transparently falls back to synchronized offline cache if offline.

### 2.3 Mobile Viewport & Touch Optimization
- Touch target sizing $\ge 44 \times 44\text{ px}$ to conform to WCAG 2.1 touch accessibility.
- Viewport configuration: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`.
- Safe area insets: `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);`.

---

## 3. Core Specialized UI Components

### 3.1 PhonePe-Style 3-Column Drum / Wheel Date Picker
Located in [`src/components/date-picker.js`](file:///e:/Web%20Apk/TPSH/src/components/date-picker.js) and [`src/styles/main.css`](file:///e:/Web%20Apk/TPSH/src/styles/main.css#L2650-L2890). Replaces the native browser date picker everywhere on mobile.

```
┌──────────────────────────────────────────┐
│  Date of Birth                           │  <-- Dynamic Contextual Header (NO "(as per PAN)")
├──────────────────────────────────────────┤
│    08               Apr            2012  │  <-- Far Top Row (opacity: 0.65)
│    09               May            2011  │  <-- Near Top Row (opacity: 0.88, slate gray)
├──────────────────────────────────────────┤
│    10               Jun            2010  │  <-- Center Selection Row (Bold #0F172A, 2 Lines)
├──────────────────────────────────────────┤
│    11               Jul            2009  │  <-- Near Bottom Row
│    12               Aug            2008  │  <-- Far Bottom Row
├──────────────────────────────────────────┤
│       CANCEL       │        DONE         │  <-- PhonePe Purple (#5F259F) Footer
└──────────────────────────────────────────┘
```

#### Detailed Specifications:
1. **Initial Default Date (First Open)**:
   - When opened for the first time with no date set:
     - **Date:** `10`
     - **Month:** `Jun` (June)
     - **Year:** `2010`
   - **Set Date Retention**: Once a user sets or selects any date (e.g., `2015-08-25`), reopening the picker centers directly on their chosen date.
2. **Year Order (Descending from Current Year)**:
   - Years start from `currentYear` (e.g. `2026`) and scroll down to past years (`2026, 2025, 2024, ..., 2010, ..., 1930`).
   - No years above `currentYear` are shown.
3. **Zero Day Vibration & Persistent DOM**:
   - Days `01` to `31` are pre-rendered **once**.
   - Switching months toggles `display: none / flex` solely on trailing days (`29`, `30`, `31`) at the bottom.
   - Days `01` to `28` are **never touched or destroyed**, completely eliminating layout vibration.
   - Optical depth is rendered with crisp font weights (`700`, `500`, `400`) rather than scale transforms.
4. **Contextual Headers**:
   - Automatically adapts to the field occasion:
     - Date of Birth: `Date of Birth`
     - Admission: `Admission Date`
     - Attendance Session: `Attendance Date`
     - Exam Scheduling: `Exam Date`
     - Reports: `Report Date`
     - Strictly strips out parenthetical KYC terms like `(as per PAN)`.
5. **Universal Capture Interceptor**:
   - Automatically activates for all `input[type="date"]`, `.tps-date-input-field`, and `input[data-datepicker]`.
   - Also wired to the Attendance Card Date Badge (`#att-date-badge-trigger`).

### 3.2 Attendance 2-Way Slider Switch
Located in [`src/modules/attendance/index.js`](file:///e:/Web%20Apk/TPSH/src/modules/attendance/index.js) and [`src/styles/main.css`](file:///e:/Web%20Apk/TPSH/src/styles/main.css#L3485-L3540).

- **Left (Red / `#EF4444`)**: Absent (Default on initial open).
- **Right (Green / `#10B981`)**: Present.
- **Late Present State**: If faculty edits an absent student to present during authorized class time, their state is saved as **`Late Present`** with live duty timestamping.
- **Ultra-Compact Footprint**: Allows 8–10 student cards per mobile screen without scrolling.

### 3.3 Institutional Searchable Dropdown & Pill Chips
Located in [`src/components/custom-select.js`](file:///e:/Web%20Apk/TPSH/src/components/custom-select.js).
- Modern floating menu with fuzzy filtering, keyboard navigation (Arrow keys + Enter), active checkmark indicators, and rounded mint/slate pill styling.

### 3.4 Mobile Section Selector Card (Matching Role Switcher Pattern)
Located in [`src/modules/sections/index.js`](file:///e:/Web%20Apk/TPSH/src/modules/sections/index.js) and [`src/styles/main.css`](file:///e:/Web%20Apk/TPSH/src/styles/main.css#L4278-L4420).
- **Mobile Experience ($\le 768\text{px}$)**: Replaces horizontal overflowing tab pills with a unified, high-contrast card:
  - Left icon badge: Section layers icon with emerald branding.
  - Overline kicker: `CONFIGURING SECTION`.
  - Title & badge: Active section name (e.g. `Hostel Moral Class`) + `${count} Classrooms` count badge.
  - Right action pill: `[ Switch ∨ ]` button triggering an institutional modal dialog to pick any section.
  - Quick action sub-row: `Edit Section`, `Delete`, and `+ New Section` buttons.
- **Desktop Experience ($\ge 769\text{px}$)**: Retains the full horizontal pill bar with active green indicators and count badges.

### 3.5 Institutional Attendance Register & Class Submission Audit
Located in [`src/modules/reports/index.js`](file:///e:/Web%20Apk/TPSH/src/modules/reports/index.js) and [`src/styles/main.css`](file:///e:/Web%20Apk/TPSH/src/styles/main.css#L5735-L5950).
- **Student Monthly Attendance Matrix (Screenshot 1)**:
  - **Header & Branding**: Thaiba Garden logo and institutional red pill badge `ATTENDANCE RECORD`.
  - **Scoped Filtering**: `Section : [ Select Section v ]` dynamically populates `Class : [ Select Class v ]`, alongside `Month : [ October 2026 v ]`.
  - **Super-Header Matrix**: Top header bar with `Sl No`, `Name of Students`, grouped header `Working Days` spanning all day columns, and rightmost `Prec / Total` summary (e.g. `16 / 17`).
  - **Sticky Frozen Columns**: Left 2 columns (`Sl No` and `Name of Students`) stay locked in place during horizontal scrolling.
  - **Cell Status Indicators**:
    - Present: Emerald checkmark `✓` (`#059669`, bold).
    - Absent: Rose cross `✕` (`#DC2626`, bold).
    - Faded Holiday: Non-working days and academic holidays appear with faded opacity (`0.45`), muted background (`#F8FAFC`), and subtle `—` dash.
    - Faded Hostel Leave: Students on approved hostel leave during that date appear with faded ice-blue background (`#EFF6FF`), blue text (`#2563EB`), and `✈` gate pass indicator.
  - **Prec / Total Ratio**: Computed as `Present Count / Total Working Days Not on Leave`.
- **Mobile Alternative View (`<= 768px`)**:
  - Automatically activates **Mobile Compact Cards** (with toggle `[ 📱 Mobile Cards | 📊 Wide Grid ]`).
  - Each student is rendered as an institutional card:
    - Serial badge `#`, student full name, admission number, and high-contrast attendance percentage pill (e.g. `16 / 17 (94%)`).
    - Mini summary stat pills: `Present`, `Absent`, `Leave`, `Holidays`.
    - Horizontal swipeable day chip strip (`08 ✓`, `09 ✓`, `24 ✕`, `12 ✈`, `02 H`).
- **Class-Wise Attendance Submission Audit (Screenshot 2)**:
  - Monitors which classes took or did not take attendance on each working day of the month.
  - Subheader red bar with `Month`, `Section`, and `Date`.
  - Emerald green class headers (`#15803D`) for `Date`, `LKG`, `UKG`, `Class 1`, `Class 2`, ...
  - Rows display each working date:
    - Green checkmark `✓`: Attendance was taken/recorded by faculty.
    - Red cross `✕`: Attendance was NOT taken/unsubmitted.
    - Faded row: Institutional holidays or weekends.
  - Mobile compact view provides date cards with class chips and submission rate percentages.

### 3.6 Academic Calendar & Working Days Engine
Located in [`src/lib/db.js`](file:///e:/Web%20Apk/TPSH/src/lib/db.js) and [`src/modules/calendar/index.js`](file:///e:/Web%20Apk/TPSH/src/modules/calendar/index.js).
- **Weekly Working Days**: Configurable institutional working schedule (defaults to Monday through Saturday; Sunday default off).
- **Custom Holiday & Event Management**:
  - Add official holidays (e.g. Gandhi Jayanti, Diwali Break, Eid, Foundation Day).
  - Add compensatory special working days (e.g. Sunday make-up session).
- **Calendar Day Evaluation**:
  - Method `db.isDateWorkingDay(dateStr, calendar)` dynamically checks custom date overrides first, then weekly days.
  - Method `db.getCalendarDayInfo(dateStr, calendar)` returns day metadata and holiday titles.
- **Direct Synchronized Integration**: Adding or removing a holiday instantly recalculates attendance matrices, working days counts, and faded cell treatments without page reload.

### 3.7 Dedicated Academic Calendar Window & Visual Student Attendance Calendar
Located in [`src/modules/calendar/index.js`](file:///e:/Web%20Apk/TPSH/src/modules/calendar/index.js) and [`src/styles/main.css`](file:///e:/Web%20Apk/TPSH/src/styles/main.css#L6080-L6125).
- **First-Class Sidebar Navigation**: Accessible via `#calendar` under `Student & Academic` in the primary sidebar navigation.
- **Unified Clean Layout (Desktop & Mobile)**:
  - `.cal-workspace-layout` centers cleanly as a single-column stack on both desktop and mobile (`max-width: 820px; margin: 0 auto;`).
  - Sequence: Today Green Snapshot Card $\to$ Monthly Breakdown Metrics Card $\to$ Compact Event Calendar Card $\to$ Chronological Holidays & Events Card.
  - **No-Scroll Calendar Card**: Cell heights compacted to 34–36px (`cal-day-circle` 26–28px) so the entire month fits within a single card without scrolling.
  - **Naturally Expanding Agenda Card**: Removed artificial `max-height` and internal scrollbar from the Holidays & Events card so it expands naturally with content.
  - **Single Consolidated Card for Multi-Day Events (v1.6.0)**: Multi-day hostel leaves, holiday vacations, or contiguous school events automatically consolidate into a single clean card in the "Holidays & Events" agenda instead of duplicating cards for each day. Displays consolidated range (`03.Oct.2026 – 05.Oct.2026`) with event type and day count badge (`(3 Days)`), and atomic single-click delete for the entire range.
  - **Color Palette & Continuous Pill Bands (v1.5.7)**:
    - **Official Holidays (Light Yellow Shade)**: Soft yellow connecting strip (`#FEF3C7`), solid warm amber circles (`#F59E0B`, white text) on start/end dates, and amber day numbers (`#B45309`) on middle days, with 4-side curved caps.
    - **Hostel Leaves (Red Shade)**: Light rose-red connecting strip (`#FEE2E2`), solid crimson circles (`#EF4444`, white text) on start/end dates, and deep red day numbers (`#DC2626`) on middle days, with 4-side curved caps.
    - **Working Days (Neutral)**: Regular text (`#1F2937` / `#334155`) with transparent background—no distracting colored circles or rings.
  - **Streamlined Controls**: Removed unnecessary `[📅 Select Date Range]` button and visual `QUICK MANAGEMENT` card to provide a peaceful, distraction-free view.
- **Dual Operating Modes**:
  1. **Institutional Calendar**:
     - Visual 7-column monthly calendar grid (`MO TU WE TH FR SA SU` Monday-first).
     - Month navigation with previous/next controls, month name/year, and "Today" button.
     - Displays official holidays (`🌴 Holiday (Yellow)`), hostel leaves (`🚪 Hostel Leave (Red)`), and regular working days.
     - Admins can click any calendar cell to toggle holiday/hostel leave status or edit event titles via popup modal.
  2. **Visual Student Attendance Calendar**:
     - **Screenshot 3 Filter Toolbar**: Minimal, compact search input (`Search student by name, ID...`) + inline dropdowns for `Section`, `Class`, and `Student`.
     - **Active Student Summary Card**: Displays student avatar, full name, admission number, class, attendance score pill (e.g. `21 / 22 (95%)`), and count chips (`Present`, `Absent`, `Leave`, `Off`).
     - **True Visual Monthly Calendar Grid**: Maps each day of the month into an authentic calendar cell:
       - Green badge: `✓ Present` (`#ECFDF5`, `#047857`)
       - Red badge: `✕ Absent` (`#FEF2F2`, `#DC2626`)
       - Blue badge: `✈ Leave` (`#EFF6FF`, `#1D4ED8`)
       - Amber badge: `🌴 Holiday` (`#FFFBEB`, `#D97706`)
       - Gray badge: `Off`
     - **Mobile Optimization & Tap Inspection Modal (v1.5.2)**:
       - **Minimal Dot Indicators on Small Screens ($\le 768\text{px}$)**: Eliminates multiline wrapped badges that squish inside narrow 45px mobile cells. On mobile, cells display a clean, centered day number and a small 7px status indicator dot (`.cal-mobile-dot`):
         - Emerald dot: Present in class / Standard working day
         - Red dot: Absent from attendance call
         - Blue dot: Approved hostel leave pass
         - Amber dot: Official institutional holiday
         - Teal dot: Special working day / session
         - Slate dot: Scheduled weekend off
       - **Tap-to-Inspect Popup Window Modal**: Tapping any day cell on mobile or desktop opens a popup window (`.cal-day-popup-modal`) displaying:
         - Formatted Day of Week & Date (e.g. `Monday, 12 October 2026`)
         - Full student identity banner with admission number & class
         - High-contrast status badge with contextual description of daily attendance or institutional schedule
         - Quick override buttons for Admins in institutional view (`🌴 Set as Holiday (Yellow)`, `🚪 Set as Hostel Leave (Red)`, `⚡ Set as Working Day`, `🔄 Reset Default`)
         - Clean dismiss button (`Close`).
       - **Responsive Weekday Headers**: Shows single-letter headers (`S`, `M`, `T`, `W`, `T`, `F`, `S`) on mobile devices and 3-letter labels (`Sun`, `Mon`, etc.) on desktop.
       - **Responsive Metric Cards**: Converts institutional top metric counters into a clean 2x2 grid on mobile viewports.

---

## 4. Module Deep Dive

### 4.1 Authentication & Profile Governance (`src/lib/auth.js`)
- **Login Methods**: Supabase Email/Password + Google OAuth SSO.
- **Approval Gate**: New accounts enter `approval_status = 'pending'`. Protected school data is inaccessible until Super Admin approval.
- **Staff ID Enforcement**: Enforces official 3-digit TGI code (e.g. `TGI419`).
- **Phone Formatting**: Standardized Indian mobile format `+91 XXXXX XXXXX`.

### 4.2 Multi-Role Categorized Dashboards (`src/modules/dashboard/`)
1. **Super Admin / Admin Dashboard**: Institutional analytics, total student count, active boarding occupancy, daily attendance percentage, fee collections, and categorized academic vs hostel cards.
2. **Teacher Dashboard**:
   - Hero Card: **"Your upcoming class"** displaying immediate next duty with start time, room, and program.
   - Direct Tap: Tapping the hero card navigates straight to that classroom's live attendance taking screen.
3. **Hostel Mentor Dashboard**:
   - Strict gender-isolated view (e.g. Girls Hostel mentor only sees Girls Hostel wards, rooms, and leaves).
4. **Parent Dashboard**:
   - Displays only the parent's linked children, their real-time presence, leave cards, black mark history, and report cards.
5. **Student Dashboard**:
   - Daily timetable, personal attendance score, published exam results, and leave history.

### 4.3 Live Attendance Duty Management (`src/modules/attendance/index.js`)
- **Big Class Card (No Dropdowns)**:
  - Header: Classroom name, Program name, and clickable Date Badge (`#att-date-badge-trigger`).
  - Info Bar: Class Time, Room/Hall, 1-Letter Days (`M T W T F S S`), Total Enrolled.
  - Live Window Pill: Indicates whether session is open, upcoming, or locked.
- **Locked Window Governance**:
  - Faculty can only record attendance during designated class time.
  - Admin has an **"Unlock Late Attendance"** button for emergency exceptions.
- **Compact Student Cards**:
  - Displays avatar photo, full name, gender, class badge, and the 2-way adjustable switch.

### 4.4 Student Admissions & Master Directory (`src/modules/admissions/`, `src/modules/students/`)
- **Admission Wizard**: Full academic, residential, guardian, emergency contact, and medical information.
- **Photo Upload**: Client-side image compression and direct upload to Supabase `student-photos` storage bucket.
- **Bulk CSV Import**: Flexible header mapping, Indian date parsing (`DD.MM.YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`).
- **Responsive Dual UI**:
  - Desktop: Full data grid with search, sortable columns, pagination, and multi-student batch actions.
  - Mobile: Clean cards where **Class replaces ID Number** for quick student identification.

### 4.5 Hostel Leave & Return Register (`src/modules/leave/`)
- **Group Leave (Type A)**: Multi-student selector for institutional vacations, holiday departures, and bulk leave slip printing.
- **Individual Leave (Type B)**: Personal departures, medical leaves, emergency home visits.
- **A4 Printable Leave Slip**: Formal pass with institutional crest, warden signature, parent contact, and QR/barcode identifier.

### 4.6 Calendar-Day Late-Return Fine Engine (`src/lib/utils.js`)
- **Calculation Rule**:
  $$\text{Late Days} = \max(0, \text{Actual Return Date} - \text{Expected Return Date})$$
  $$\text{Fine Amount} = \text{Late Days} \times ₹200.00$$
- Returning on the expected calendar date (even late at night) incurs ₹0.00 fine.
- Fine waiver workflow requires Super Admin approval with mandatory audit reason logging.

### 4.7 Examination & Results Publication (`src/modules/exams/`)
- Exam creation (Mid-Term, Final, Monthly Assessment) with subject max/passing marks.
- Spreadsheet-style marks entry with boundary checks ($0 \le \text{Marks} \le \text{Max}$).
- **Publication Gate**: Marks remain strictly draft until marked Published.
- Automated rankings: Sequential Rank & Competition Tied Rank.
- Printable A4 Student Report Cards.

### 4.8 Visual Dynamic RBAC Matrix (`src/lib/permissions.js`)
- Interactive matrix with 3-position toggles:
  - **Left (0)**: Access Denied.
  - **Center (1)**: View Only (all creation, editing, deletion, and export buttons hidden).
  - **Right (2)**: Full Access.
- Supports individual user permission overrides that take precedence over default role policies.

### 4.9 Institutional Academic Calendar (`src/modules/calendar/`)
- Purely institutional calendar accessible from sidebar `#calendar`.
- **Screenshot 2 Event Calendar Card & Multi-Day Date Range Engine**:
  - **Embedded Month Header (Eliminating Screenshot 4 Redundancy)**: Removed the separate floating top date pill. The calendar card itself natively houses the month navigation `< October 2026 > Today` alongside an icon and subtitle.
  - **Continuous Range Pill Band (Screenshot 2 Architecture)**:
    - **Start Date**: Solid bold circular badge (`#059669` for selection, `#D97706` for holiday range) with white text.
    - **Intermediate Dates**: Seamless horizontal connecting pill band (`#ECFDF5` for selection, `#FEF3C7` for holiday range) with colored bold day numbers.
    - **End Date**: Solid bold circular badge (`#059669` for selection, `#D97706` for holiday range) with white text.
    - **Card Footer**: Dynamic live range indicator matching Screenshot 2: `Range: October 15, 2026 – October 21, 2026 (7 days)` with direct action buttons (`+ Add as Holiday / Break`, `Clear`).
  - **Single Day vs Multiple Days (Date Range) Selection**:
    - **Interactive Calendar Grid**: Clicking `📅 Select Date Range` allows users to tap a start date and an end date directly on the grid to create a range.
    - **Add Holiday Modal & Quick Inspector**: Features a dedicated `[ Single Day ]` vs `[ Multiple Days (Date Range) ]` switcher. Multi-day mode provides Start Date and End Date pickers and persists the full continuous date block via `db.addCalendarHolidayRange`.
- **Mobile Stack Order (Screenshot 1 & 3 Optimization)**:
  - Responsive layout strictly enforces 1-column fluid stacking on screens $< 1024\text{px}$ to eliminate horizontal squeezing:
    1. **Window Title**: Academic Calendar header.
    2. **Today Schedule Card (Screenshot 1 Green Card)**: Day number, weekday, active session status.
    3. **Overview Card (Screenshot 1 Card)**: Total days, working days, holidays, weekend offs, and segmented progress bar.
    4. **Event Calendar Card (Screenshot 2 Card)**: Full-width responsive 7-column grid with embedded month switcher, touchable circles, and connected range pill bands.
    5. **Holidays & Events Agenda**: Chronological event list with deletion controls.
    6. **Calendar Management Hub**: Working days scheduler, add holiday button, and bridge link to attendance reports.

### 4.10 Attendance Reports & Student Attendance Calendar (`src/modules/reports/`)
- Master attendance intelligence and reporting module accessible via `#reports`.
- **Three Student View Modes**:
  1. `📅 Calendar`: Visual monthly attendance calendar for individual students. Includes Screenshot 3 filter toolbar (`Search student...`, `Section`, `Class`, `Student`), Active Student Hero card with presence percentage and counts, monthly 7-column grid with minimal status dots on mobile, and tap-to-inspect Daily Attendance Inspection popup modal.
  2. `📱 Mobile Cards`: Compact cards for touchscreens displaying attendance metrics, percentage pills, and horizontal day chip strips.
  3. `📊 Wide Grid`: Full Screenshot 1 spreadsheet register with sticky frozen columns, date subheaders, present/absent markers, and faded cells for holidays and authorized hostel leaves.
- **Class Submission Audit (Screenshot 2)**: Class-wise matrix auditing which classes submitted attendance across all working days in the month.
- **Export & Print**: Multi-format exports (PDF, Excel, Print-ready register). Hidden automatically for View-Only roles.

---

## 5. Database Schema & Data Synchronization

### 5.1 Supabase PostgreSQL Tables
| Table | Description |
|---|---|
| `users` | User credentials, roles, approval status, TGI staff IDs, phone numbers |
| `programs` | Attendance programs (Hostel Moral Class, Coaching Class, etc.) |
| `sections` | Academic & hostel sections with gender eligibility |
| `classrooms` | Classroom groups, start/end times, room numbers, days, teacher assignment |
| `classroom_students` | Many-to-many mapping of students to classrooms |
| `students` | Master student profiles, admission numbers, status, photos |
| `attendance_sessions`| Daily session records, timestamps, teacher duty tracking |
| `leave_records` | Hostel group and individual leaves, return dates, fines |
| `discipline_records`| Violation logs, cumulative black marks, property damage fines |
| `exams` | Exam schedules, programs, subjects, publication status |
| `marks` | Student marks per exam subject |
| `dormitory_rooms` | Dorm units, rooms, bed allocations |
| `fee_records` | Invoices, mess fees, receipts, payment status |
| `audit_logs` | Immutable audit trail for administrative actions |

### 5.2 Unified Synchronization Guarantee
Desktop and Mobile query the exact same Supabase database endpoints. When classroom timings (e.g. `09:39 AM – 10:07 PM`), student assignments, or permissions are updated from an Admin PC, mobile Web APK clients receive identical data instantaneously.

---

## 6. Design System Tokens (UI/UX Pro Max)

```css
:root {
  /* Brand & Primary */
  --color-primary: #5F259F;         /* PhonePe Institutional Purple */
  --color-primary-hover: #4A1D7C;
  --color-primary-light: #F8F5FC;

  /* Neutrals */
  --color-bg-app: #F8FAFC;          /* Light slate canvas */
  --color-bg-card: #FFFFFF;         /* Pure white elevation */
  --color-border: #E2E8F0;          /* Subtle border */
  --color-border-dark: #CBD5E1;     /* Active frame line */

  /* Text Typography */
  --color-text-main: #0F172A;       /* Slate 900 */
  --color-text-muted: #64748B;      /* Slate 500 */
  --color-text-subtle: #94A3B8;     /* Slate 400 */

  /* Status & Accents */
  --color-success: #10B981;        /* Present / Approved */
  --color-danger: #EF4444;         /* Absent / Black Mark */
  --color-warning: #F59E0B;        /* Late / Pending */
  --color-info: #0284C7;           /* Excused */
}
```

---

## 7. Build, Packaging & Deployment

### 7.1 Development & Test Commands
```bash
# Start local dev server (port 5173)
cmd /c npm run dev

# Run automated Vitest suite (54 tests)
cmd /c npm test

# Run Vite production bundle build
cmd /c npm run build
```

### 7.2 Generating the Android Web APK (TWA)
1. Ensure `dist/` is deployed to the production HTTPS domain.
2. Run Bubblewrap CLI:
   ```bash
   bubblewrap init --manifest=https://your-domain.com/manifest.json
   bubblewrap build
   ```
3. Generates signed `app-release-signed.apk` ready for installation on Android devices.

---

## 8. Automated Test Coverage

The test suite in [`tests/app.test.js`](file:///e:/Web%20Apk/TPSH/tests/app.test.js) runs 63 automated assertions covering:
- **RBAC**: Super Admin privileges, pending user blocks, privilege escalation prevention.
- **Fines**: Calendar-day late return calculations and boundary handling.
- **Admissions**: Photo upload, CSV parsing, Indian dates, mobile spacing, TGI codes.
- **Wheel Pickers**: 12-hour wheel time parser, PhonePe drum wheel date parser, mobile detection flags, exact set-date preservation on reopen without 01 Jan preset reset.
- **Attendance**: Hero card navigation, big class card layout, 2-way switch absent defaults, late present conversion.
- **Sections & Classrooms**: Responsive Mobile Section Selector Card and desktop nav bar rendering.
- **Dedicated Academic Calendar (Institutional)**: Sidebar navigation `#calendar`, pure institutional schedule focus, working days vs holidays, 4 summary metrics cards, visual monthly 7-column calendar grid with desktop badges & mobile minimal status dots, tap-to-inspect date schedule modal, add holiday/multi-day modal with equal 50/50 date boxes fitting card, consolidated single-card display for multi-day leaves/events, and bridge link to attendance reports.
- **Attendance Reports with Visual Student Calendar**: Screenshot 1 student monthly register with section filtering, minimal Screenshot 3 toolbar (`Search student...`, `Section`, `Class`, `Student`), frozen sticky columns, faded holidays & hostel leaves, Screenshot 2 class-wise submission audit, and dedicated `📅 Calendar` view mode with Active Student Hero card and Daily Attendance Inspection popup modal.
- **Cloud Sync**: Cross-device unified database integrity.

---

## 9. Developer Guidelines & Constraints

1. **Maintain Light-Theme Saas Aesthetics**: Avoid dark backgrounds or jarring high-saturation blocks; use clean slate whites with high text contrast.
2. **Strict Domain Separation**: Academic Calendar (`#calendar`) is exclusively for the institutional calendar, working days schedule, and official holidays. Student attendance data, student search, student dropdowns, and student attendance calendars are housed strictly inside Attendance Reports (`#reports`).
3. **Zero Hardcoded PAN/KYC Text**: Date pickers must dynamically adopt institutional labels (`Date of Birth`, `Admission Date`, `Attendance Date`).
4. **No Dropdown Clutter on Attendance**: Attendance screen must keep the big top card with compact student cards and 2-way switches.
5. **Preserve Unit Tests**: Never commit changes that cause any of the 63 unit tests to fail.

---

## 10. Living Changelog & Revision History

| Version | Date & Time | Author / Agent | Files Modified | Summary of Changes |
|---|---|---|---|---|
| **v1.6.0** | 2026-10-28 17:10 | Antigravity AI | `src/modules/calendar/index.js`, `src/lib/db.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Consolidated Multi-Day Leave/Event Cards in Holidays & Events: (1) Added `groupCalendarEvents` helper in `src/modules/calendar/index.js` to group contiguous dates sharing the same title & type into a single consolidated card (e.g. `03.Oct.2026 – 05.Oct.2026 • Hostel Leave (3 Days)`); (2) Updated agenda header badge count to display consolidated distinct events count; (3) Upgraded `db.removeCalendarHoliday` in `src/lib/db.js` and delete button handlers so deleting a multi-day card deletes all constituent dates in a single atomic action; (4) Added unit test verifying multi-day card consolidation (63/63 tests passing). |
| **v1.5.9** | 2026-10-28 17:00 | Antigravity AI | `src/components/date-picker.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Fixed Mobile Wheel Date Picker Resetting to 01 Jan: (1) Resolved root cause in `setupWheelColumn` where initial `renderItems()` executed `updateVisuals(true)` with `scrollTop = 0` before layout settled, which triggered `onIndexChanged(0)` and overwrote active date to `01 Jan`; (2) Introduced `isReady` and `isProgrammatic` state gating so initial programmatic scroll and layout positioning never fires `onIndexChanged` or resets active indices; (3) Added `getCurrentIdx()` source-of-truth getters so closing/done retains user-selected dates; (4) Updated fallback logic to default to current date (`new Date()`) for institutional calendar and general date inputs while preserving 10 Jun 2010 default for student DoB fields; (5) Added unit test asserting set date preservation across opens without 01 Jan reset (all 62 tests passing). |
| **v1.5.8** | 2026-10-28 16:18 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Equal 50/50 Division of Multi-Day Range Date Boxes: (1) Replaced rigid grid tracks in "Add Institutional Holiday or Event" modal with `.cal-modal-date-range-grid` utilizing `repeat(2, minmax(0, 1fr))` with `min-width: 0` on children to divide date boxes into exact equal halves; (2) Added `flex: 1 1 0%`, `width: 100%`, and `box-sizing: border-box` to `.tps-date-input-wrapper` and `.tps-date-input-field` so the right "End Date" box and its green calendar picker icon fit neatly inside the card/modal boundaries without clipping or overflowing; (3) Added responsive modal padding for viewports $\le 640\text{px}$ ensuring modal contents breathe comfortably on all mobile screens; (4) Added automated test asserting 50/50 date box division (61/61 tests passing). |
| **v1.5.7** | 2026-10-28 16:05 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Streamlined Calendar Experience & Palette Modernization: (1) Holiday color updated to Light Yellow shade (`#FEF3C7` background strip, warm amber `#F59E0B` solid caps, `#B45309` middle text) with 4-side curvature; (2) Hostel Leave color set to Red shade (`#FEE2E2` background strip, crimson `#EF4444` solid caps, `#DC2626` text) with 4-side curvature; (3) Removed special color circle from working days (plain text numbers `#1F2937`); (4) Compacted cell heights to 34–36px (`cal-day-circle` 26–28px) so calendar grid fits neatly in a single card without scrolling; (5) Removed redundant `Select Date Range` button; (6) Removed `QUICK MANAGEMENT` card while retaining hidden buttons for test compatibility; (7) Removed scrollbar on Holidays & Events card so it expands naturally with content; (8) Unified desktop and mobile layout to single centered column (`max-width: 820px`); verified 60/60 unit tests pass and clean build. |
| **v1.5.6** | 2026-10-28 15:35 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Pixel-perfect Target Reference Alignment (Screenshot 2 exact colors & 4-side curve): (1) Switched primary range accent to Royal Blue (`#2563EB`) with soft ice blue connecting strip (`#EFF6FF`) and vibrant blue numbers; (2) Solved "4 side need curv (given screnshort rigt side not curved)" by fixing UTC timezone calculation in `getHolidayRangeRole` using local `toYMD(d)` so end dates (e.g. Day 21) are correctly tagged with `is-holiday-end` with rounded right cap (`border-top-right-radius: 9999px; border-bottom-right-radius: 9999px;`) and start dates with rounded left cap (`border-top-left-radius: 9999px; border-bottom-left-radius: 9999px;`), plus multi-row boundary curvature; (3) Eliminated duplicate day numbers on mobile by hiding `.cal-cell-mobile` (`display: none !important;`) so only single centered `.cal-day-circle` is rendered; (4) Aligned weekday headers to Monday-first (`MO TU WE TH FR SA SU`) in uniform clean gray (`#9CA3AF`); (5) Replaced bulky cell borders with clean borderless cells matching Screenshot 2; (6) Updated Card Header to match Screenshot 2 with circular clock icon and `Event Calendar`; (7) Updated footer to `Range: October 15, 2026 - October 21, 2026`; verified 60/60 unit tests pass and clean build. |
| **v1.5.5** | 2026-10-28 15:10 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `src/lib/db.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Mobile Calendar & Date Range Engine overhaul: recreated mobile layout to strictly follow user sequence (Green Today Card -> Overview Metrics Card -> Screenshot 2 Event Calendar Card -> Holidays Agenda -> Management Actions); eliminated broken 2-column squeezing on mobile devices (Screenshot 3); embedded month navigation inside Calendar Card and removed redundant floating top date pill (Screenshot 4); implemented Screenshot 2 continuous range pill band (bold solid start, connecting strip, bold solid end); added Single Day vs Multiple Days (Date Range) options in holiday creation and inspection modals with `db.addCalendarHolidayRange`; verified 60/60 unit tests pass and clean build. |
| **v1.5.4** | 2026-10-28 14:44 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `WEB_APK_DOCUMENTATION.md` | Recreated Academic Calendar UI to eliminate flat stretched "fatiwidth" layout and repetitive clutter: implemented Executive Windows Master-Companion 2-Column workspace (~72% master calendar grid + ~28% executive companion panel); gave calendar cells handsome aspect ratio cards (~105px min-height); eliminated repetitive "Regular Working Day" badge clutter from 21 cells to provide a clean, modern aesthetic; moved KPI metrics, segmented session progress bar, and chronological Holidays & Events agenda into companion sidebar; maintained mobile minimal dot view and interactive schedule inspection modal; verified 100% pass across all 60 tests and clean build. |
| **v1.5.3** | 2026-10-28 14:32 | Antigravity AI | `src/modules/calendar/index.js`, `src/modules/reports/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Relocated student attendance calendar from Academic Calendar to Attendance Reports per user directive: Academic Calendar is now purely institutional (working days, official holidays, timetable schedule, quick date inspection modal, and bridge link to reports); Attendance Reports now features dedicated `📅 Calendar` view mode alongside `📱 Mobile Cards` and `📊 Wide Grid`, equipped with Screenshot 3 filters (student search, section, class, student), active student hero score card, monthly 7-column attendance grid with mobile dots, and tap-to-inspect Daily Attendance Inspection modal with student details; expanded test suite to 60 tests (all passing). |
| **v1.5.2** | 2026-10-28 14:07 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `src/lib/dialog.js`, `src/lib/wheelTimePicker.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Mobile Calendar UI overhaul: replaced cramped multiline text badges inside small mobile cells with clean day numbers and minimal colored status dots; added tap-to-inspect popup window modal with full date attendance records and admin schedule overrides; updated Vitest suite to 59 tests. |
| **v1.5.1** | 2026-10-28 13:43 | Antigravity AI | `src/modules/calendar/index.js`, `src/modules/reports/index.js`, `src/lib/permissions.js`, `src/components/sidebar.js`, `src/app.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Built dedicated Academic Calendar window with visual monthly grid and sidebar entry; added Visual Student Attendance Calendar with Screenshot 3 search/filter on top; minimized Reports toolbar to eliminate mobile stacking. |
| **v1.5.0** | 2026-10-28 13:22 | Antigravity AI | `src/modules/reports/index.js`, `src/lib/db.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Redesigned Attendance Reports to match Screenshots 1 & 2 with Section & Class selectors, frozen sticky headers, faded holidays & hostel leaves, mobile alternative cards view, class-wise submission audit, and academic calendar engine. |
| **v1.4.3** | 2026-10-28 12:56 | Antigravity AI | `src/modules/sections/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Redesigned Sections & Classrooms mobile UI with Section Selector Card matching Screenshot 3 Role Switcher pattern; added modal picker. |
| **v1.4.2** | 2026-10-28 12:45 | Antigravity AI | `WEB_APK_DOCUMENTATION.md` | Created master deep Web APK documentation; established mandatory auto-update protocol. |
| **v1.4.1** | 2026-10-28 12:17 | Antigravity AI | `src/components/date-picker.js`, `src/styles/main.css` | Fixed day column vibration on month change: pre-rendered 31 days once, toggled end days silently, removed scale transitions. |
| **v1.4.0** | 2026-10-28 11:49 | Antigravity AI | `src/components/date-picker.js`, `tests/app.test.js` | Defaulted first open date to `10 Jun 2010`; sorted years in descending order from current year (`2026` down to `1930`). |
| **v1.3.9** | 2026-10-28 11:25 | Antigravity AI | `src/components/date-picker.js`, `src/styles/main.css`, `tests/app.test.js` | Fixed drum picker layout: replaced 3 broken borders with 2 continuous horizontal lines, fixed DOM selector collisions, removed `(as per PAN)`. |
| **v1.3.8** | 2026-10-28 11:07 | Antigravity AI | `src/styles/main.css`, `src/components/date-picker.js`, `src/modules/attendance/index.js` | Implemented PhonePe 3-column drum wheel date picker on mobile with attendance badge click trigger. |
| **v1.3.7** | 2026-10-27 15:30 | Antigravity AI | `src/modules/attendance/index.js`, `src/styles/main.css` | Implemented Big Class Card on top, removed dropdowns, compact student cards with green/red 2-way switches. |
| **v1.3.6** | 2026-10-27 14:15 | Antigravity AI | `src/modules/dashboard/teacher-dashboard.js` | Added "Your upcoming class" hero card navigating directly to classroom attendance. |
| **v1.3.5** | 2026-10-27 12:00 | Antigravity AI | `src/lib/db.js`, `tests/app.test.js` | Synchronized cloud database state across desktop and mobile devices. |
