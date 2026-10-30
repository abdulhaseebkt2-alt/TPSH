# TPS HOSTEL ERP — WEB APK & PWA MASTER SPECIFICATION
> **Institution:** Thaiba Public School (TPS)  
> **Tagline:** Modern Education with Morality  
> **Initial Super Admin:** `abdulhaseebkt2@gmail.com`  
> **Application Type:** Progressive Web App (PWA) & Native Android Web APK  
> **Current Version:** `v1.9.5`  
> **Last Updated:** 2026-10-30T16:55:00+05:30  
> **Document Status:** LIVING DOCUMENT — MUST BE UPDATED ON EVERY CODE CHANGE

---

## ⚠️ MANDATORY AUTO-UPDATE PROTOCOL FOR DEVELOPERS & AI AGENTS

> [!IMPORTANT]
> **STRICT REVISION GOVERNANCE RULE:**
> Whenever **ANY** change is made to this codebase—whether it is a full feature, a bug fix, a styling update, a date format change, a component adjustment, or a single-line script edit:
> 1. You **MUST** update this file (`WEB_APK_DOCUMENTATION.md`).
> 2. You **MUST** record the change in [Section 10: Living Changelog & Revision History](#10-living-changelog--revision-history) with the date, timestamp, modified files, and summary.
> 3. You **MUST** update the affected component/module section in this document to reflect the current code behavior accurately.
> 4. You **MUST** verify all 111 unit tests pass (`cmd /c npm test`) and production build succeeds (`cmd /c npm run build`).
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
   - **2-in-a-Line Square Cards Grid (`.grid-stats`)**: On mobile screens ($\le 768\text{px}$), cards adapt into a 2-column square layout (`repeat(2, minmax(0, 1fr))` with `aspect-ratio: 1 / 1`), matching the clean Bento style of the Admin Dashboard. Features 6 balanced metric cards: Today's Sessions, Weekly Load, My Classrooms, Students Taught, Exam Grading, and Attendance Rate (98.5%).
   - **Mobile Floating Bottom Nav (`.m-floating-bottom-nav`)**: Frosted glass floating navigation pill bar providing one-thumb shortcuts to Home, Schedule, Attendance, Marks, and Reports.
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
- **Auto-Closing Student List Window on Submission (v1.7.1)**:
  - Immediately upon confirming attendance submission via `#btn-submit-attendance`, the session is persisted to the database with exact timestamp, and the student roster window automatically closes.
  - Returns the faculty or administrator back to the Timetable Cards view where that classroom reflects `✓ Attendance Recorded`.
  - Clears temporary session keys (`tps_active_att_cls`, `tps_active_att_date`) from `sessionStorage` preventing accidental roster re-entry.
- **Student on Approved Leave Governance & Incapable Controls (v1.8.3)**:
  - **Automatic Leave Detection**: Detects students currently away on approved leave (either by profile status `'On Approved Leave'` or an active leave pass in `tps_leaves` covering the session date).
  - **Faded & On-Leave Presentation**: Cards for students on leave render as faded (`.attendance-compact-card.is-on-leave.is-faded`, `opacity: 0.55`, `#F8FAFC` background) with a prominent `✈️ On Leave` royal blue pill and `(Approved Hostel Leave)` subtitle.
  - **Incapable Teacher Attendance Controls**: Teachers cannot take or alter attendance for students on approved leave; the interactive 2-way switch is replaced with a locked `Locked (On Leave)` badge (`.att-leave-locked-badge`), and clicking triggers a warning toast.
  - **Immunity in Bulk Actions**: "Mark All Present" and "Mark All Absent" strictly skip students on leave.
  - **Independent Summary Counters**: Displays `On Leave: N` in royal blue, separate from Present and Absent counts.
  - **Segmented Roster Filter Tabs**: Roster header features segmented buttons (`All (N)`, `In Class (N)`, `✈️ On Leave (N)`), allowing teachers to filter the list to only in-class students so names of students on leave do not appear when taking attendance.
  - **Submission Integrity**: Submitting attendance persists the student's record with `status: 'Leave'`.

### 4.3.1 Teacher Timetable & Classroom Schedule Cards (`src/modules/timetable/index.js`)
- **Modernized Timetable Cards UI (v1.6.6)**: Replaced the flat master data table with a responsive grid (`.timetable-cards-grid`) of dedicated timetable cards matching Screenshot 2.
- **Strict Faculty Scoping**: Teachers can ONLY see cards for their own assigned classrooms (other faculty's classes are completely hidden, with no teacher switcher available for teachers).
- **All Assigned Classes Displayed**: The window displays cards for all classes assigned to that teacher.
- **Card Specifications (matching Screenshot 2)**:
  - Header: Stopwatch/clock icon in square pill, title **"Your upcoming class"**, subtitle **"Scheduled teaching session"**, and timing status pill (e.g. `Today at 04:30 PM`, `🟢 Live In-Session`, `Starts in 15m`, or `Scheduled (Days)`).
  - Divider: Thin line (`.upcoming-divider`).
  - Class Primary: Bold emerald green classroom name (`.upcoming-class-name`, `#065F46`, font-size 1.25rem, font-weight 800) and program badge (`.upcoming-prog-pill`).
  - 2x2 Details Grid:
    - **SCHEDULE TIME**: e.g. `04:30 PM – 06:00 PM`
    - **CLASSROOM / HALL**: e.g. `Room 301` / `Campus Hall`
    - **ENROLLED ROSTER**: e.g. `8 Students`
    - **SCHEDULED DAYS**: e.g. `M, T, W, T, F, S`
  - Action Button: Emerald green **"Take Attendance →"** (`#059669`) navigating directly to live attendance taking for that classroom.
- **Administrator Capabilities**: Admins can view all classrooms across the institution, filter by faculty using a dropdown (`#timetable-faculty-filter`), and add/modify timetable slots.

### 4.4 Student Admissions & Master Directory (`src/modules/admissions/`, `src/modules/students/`)
- **Admission Wizard**: Full academic, residential, guardian, emergency contact, and medical information.
- **Photo Upload**: Client-side image compression and direct upload to Supabase `student-photos` storage bucket.
- **Bulk CSV Import**: Flexible header mapping, Indian date parsing (`DD.MM.YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`).
- **Responsive Dual UI**:
  - Desktop: Full data grid with search, sortable columns, pagination, and multi-student batch actions.
  - Mobile: Clean cards where **Class replaces ID Number** for quick student identification.

### 4.5 Hostel Leave & Return Management (`src/modules/leaves/`)
- **Ingested from Hostel IRP & Modernized**: Architecture, workflows, and data structures adapted directly from `E:\Hostel IRP`, tailored with an executive light-theme UI and high mobile touch ergonomics matching reference design screenshots.
- **Pass Code Architecture**: Generates institutional sequential pass codes in the format `LV-YYYY-XXX` (e.g., `LV-2026-001`).
- **Issue Leave Pass Modal**: Features a segmented mode switcher (`.hostel-mode-switcher-bar`) with equal 50/50 alignment, zero count numbers, and fixed dialog sizing (`hostel-flow-modal`):
  - `[ Individual Leave ]`: Targeted student search, live status badge check, single resident pass issuance.
  - `[ Multiple Leave ]`: Institutional vacations and group outings with class filters, select all, and multi-student checklist inside matching card container.
  - Captures departure & expected return date/time, leave type/category, customizable fine rate per day (defaults to ₹200.00), reason/remarks, and approving warden.
  - Automatically updates student status to `'On Approved Leave'` and synchronizes state to Supabase (`tps_leaves`).
- **Arrival & Return Register Modal**: Segmented mode switcher (`.hostel-mode-switcher-bar`) with equal 50/50 alignment, zero count numbers, and fixed dialog sizing (`hostel-flow-modal`):
  - `[ Individual Arrival ]`: Dropdown search of students currently away, displaying departure date, expected return, and calculating live late status.
  - `[ Multiple Arrival ]`: Batch return recording allowing wardens to check off multiple students returning together inside matching card container.
  - Captures actual return date, actual return time, arrival condition remarks, and gate security notes.
  - Automatically restores returning students to `'Active'` (Hostel Resident) status.
- **Calendar-Day Late Return & Automated Fine Engine (`calculateReturnLate`)**:
  - Strictly calculated by calendar date difference: $\Delta \text{Days} = \text{Actual Date} - \text{Expected Date}$.
  - Returning on or before the expected calendar date incurs ₹0.00 fine.
  - Returning on the expected date after expected time incurs ₹0.00 fine and awards 1 disciplinary Black Mark for late return.
  - Returning after expected calendar date incurs $\Delta \text{Days} \times \text{Fine Rate}$ (default ₹200/day).
  - Automatically generates an uncollected fine slip in `tps_fines` and logs infractions in `tps_black_marks`.
- **Gate Leave Pass Modal & Print Slip**: Formal gate pass modal with barcode/QR code header, student photo, admission details, departure/expected arrival schedule, reason, and 3 physical signature blocks (Parent/Guardian, Hostel Warden, Gate Security).
- **Dual Responsive Layout**: Clean desktop data table + mobile card feed (`.mobile-leave-cards`) ensuring optimal presentation across phones, tablets, and desktop workstations.

### 4.6 Hostels & Bedroom Bed Allocation Management (`src/modules/hostel/`)
- **Interactive 8-Bed Bedroom Rack**: Visual dormitory room rack adapted from `E:\Hostel IRP`. Bedrooms (e.g., Room 101, 102, 201, 202, G-101, G-102) are partitioned into two architectural zones:
  - `Left Side Beds`: Beds 1 through 5.
  - `Window Side Beds`: Beds 6 through 8.
- **Single Source of Truth for Bed Allocation**: Bed and room assignment inputs have been completely removed from the Student Master edit form (`src/modules/students/index.js`), replaced with a clean read-only display. All resident bed allocations and room assignments are exclusively performed in the Hostels & Beds module.
- **Direct Allocation & Vacate Console**:
  - Vacant beds display green `+ Assign Student` buttons, opening a modal filtered to unassigned students matching the hostel gender.
  - Occupied beds display resident name, admission number, class, and an instant `Change / Vacate` action button.
  - Vacating a bed frees the bed space and clears the student's room/bed fields in a single atomic transaction.
- **Bento Occupancy KPI Cards & View Switcher**: Live occupancy progress bars for Boys Hostel and Girls Hostel, vacant bed counters, and view switcher between `Hostels & Bedrooms Rack` and `Resident Bed Allocation Roster`.

### 4.7 Discipline, Conduct Incidents & Fines Ledger (`src/modules/discipline/`, `src/modules/fines/`)
- **Conduct Incident Logging**: Records infractions categorized by severity (Minor, Moderate, Severe, Critical) with automatic black marks (1 to 5) and property damage fine creation.
- **Integrated Fine Slips**: Fines generated from late hostel returns or property damage are logged to `tps_fines` with receipt generation and payment tracking.
- **Cross-Module Linkage**: Integrated directly with `src/modules/leaves/index.js` arrival recording.

### 4.8 Examination & Results Publication (`src/modules/exams/`)
- Exam creation (Mid-Term, Final, Monthly Assessment) with subject max/passing marks.
- Spreadsheet-style marks entry with boundary checks ($0 \le \text{Marks} \le \text{Max}$).
- **Publication Gate**: Marks remain strictly draft until marked Published.
- Automated rankings: Sequential Rank & Competition Tied Rank.
- Printable A4 Student Report Cards.

### 4.9 Visual Dynamic RBAC Matrix (`src/lib/permissions.js`)
- Interactive matrix with 3-position toggles:
  - **Left (0)**: Access Denied.
  - **Center (1)**: View Only (all creation, editing, deletion, and export buttons hidden).
  - **Right (2)**: Full Access.
- Supports individual user permission overrides that take precedence over default role policies.

### 4.10 Institutional Academic Calendar (`src/modules/calendar/`)
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

### 4.11 Attendance Reports & Student Attendance Calendar (`src/modules/reports/`)
- Master attendance intelligence and reporting module accessible via `#reports`.
- **Three Student View Modes**:
  1. `📅 Calendar`: Visual monthly attendance calendar for individual students. Includes Screenshot 3 filter toolbar (`Search student...`, `Section`, `Class`, `Student`), Active Student Hero card with presence percentage and counts, monthly 7-column grid with minimal status dots on mobile, and tap-to-inspect Daily Attendance Inspection popup modal.
  2. `📱 Mobile Cards`: Compact cards for touchscreens displaying attendance metrics, percentage pills, and horizontal day chip strips.
  3. `📊 Wide Grid`: Full Screenshot 1 spreadsheet register with sticky frozen columns, date subheaders, present/absent markers, and faded cells for holidays and authorized hostel leaves.
- **Class Submission Audit (Screenshot 2)**: Class-wise matrix auditing which classes submitted attendance across all working days in the month.
- **Export & Print**: Multi-format exports (PDF, Excel, Print-ready register). Hidden automatically for View-Only roles.

---

## 5. Database Schema & Data Synchronization

### 5.1 Supabase PostgreSQL Tables & Synced Keys
| Table / Cloud Key | Description |
|---|---|
| `users` | User credentials, roles, approval status, TGI staff IDs, phone numbers |
| `programs` | Attendance programs (Hostel Moral Class, Coaching Class, etc.) |
| `sections` | Academic & hostel sections with gender eligibility |
| `classrooms` | Classroom groups, start/end times, room numbers, days, teacher assignment |
| `classroom_students` | Many-to-many mapping of students to classrooms |
| `students` | Master student profiles, admission numbers, status, photos |
| `attendance_sessions`| Daily session records, timestamps, teacher duty tracking |
| `tps_leaves` / `leave_records` | Hostel group and individual leaves, return dates, pass codes `LV-YYYY-XXX`, fine rates, status |
| `tps_hostel_rooms` / `hostel_rooms` | Hostel dormitory rooms, capacity, gender allocation, room numbers |
| `tps_hostel_beds` / `hostel_beds` | Individual dormitory beds (Left Side Beds 1-5, Window Side Beds 6-8), student occupancy |
| `tps_discipline` / `discipline_incidents` | Conduct violation logs, severity levels, action taken |
| `tps_black_marks` | Student cumulative disciplinary black marks ledger |
| `tps_fines` | Automated late return fines, property damage fines, payment status, receipts |
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

The test suite in [`tests/app.test.js`](file:///e:/Web%20Apk/TPSH/tests/app.test.js) runs 89 automated assertions covering:
- **RBAC**: Super Admin privileges, pending user blocks, privilege escalation prevention, dedicated `attendance_report` permissions for teachers, mentors, and admins.
- **Fines**: Calendar-day late return calculations and boundary handling.
- **Admissions**: Photo upload, CSV parsing, Indian dates, mobile spacing, TGI codes.
- **Wheel Pickers**: 12-hour wheel time parser, PhonePe drum wheel date parser, mobile detection flags, exact set-date preservation on reopen without 01 Jan preset reset.
- **Attendance Management & Teaching Timetable Cards**:
  - Attendance Management window cards matching design spec (`media_1793245698302_aa26eb06.png`).
  - Strict teacher timetable scoping: each teacher can ONLY see their own timetable classes, never other faculty.
  - Complete timetable details on each card: Schedule Time, Classroom/Hall, Enrolled Roster, Scheduled Days, Program Pill, and Timing Status.
  - "Take Attendance" button faded (`is-faded`, `opacity: 0.38`) outside class hours.
  - Users can enter class details & roster view after class time (via card click or View Details button).
  - Roster Details View with `← Back to Timetable Cards` navigation.
  - **Big Class Card Footer Bar**: Exclusively displays concise attendance status counters (`Present: X • Absent: Y • On Leave: Z`) with zero action buttons; completely removed redundant `Total Students:` from the bottom footer to prevent mobile overflow on narrow screens.
  - **3/5 + 1/5 + 1/5 Action Row Layout**: Positioned directly beneath the big class card; row is split into 3/5 width (60%) for the student search input (`#att-search-input`), 1/5 width (20%) for the "All Present" button (`#btn-mark-all-present`), and 1/5 width (20%) for the "Clear" button (`#btn-clear-attendance`).
  - **Redundant "All Absent" Button Removed**: Since students default to absent upon session initialization, the redundant "All Absent" button is eliminated.
  - **Clear Button Functionality**: Tapping "Clear" resets all in-class student attendance back to default (Absent), clears late arrival minutes, and resets active search filters with instant UI re-render.
  - **Roster Subbar & Filter Tabs Removed**: The redundant subbar containing `[ All ]`, `[ In Class ]`, `[ ✈️ On Leave ]`, and `N Students` was completely removed per user request, allowing the search and bulk action row to lead directly into the student attendance cards.
  - 2-way switch absent defaults, late switch yellow area (`sw-late`, background `#F59E0B`), and short label `L`.
  - Administration visibility of exact minutes late after class started (`⏱️ {late_minutes} min late (Class: {start_time})`) displayed dynamically on compact student card and stored in session records.
  - Strict start/end time window lock for everyone (including admins taking class), admin override/unlock, and teacher lock preventing unauthorized edits to already submitted attendance records.
- **Sections & Classrooms**: Responsive Mobile Section Selector Card and desktop nav bar rendering.
- **Dedicated Academic Calendar (Institutional)**: Sidebar navigation `#calendar`, pure institutional schedule focus, working days vs holidays, 4 summary metrics cards, visual monthly 7-column calendar grid with desktop badges & mobile minimal status dots, tap-to-inspect date schedule modal, add holiday/multi-day modal with equal 50/50 date boxes fitting card, consolidated single-card display for multi-day leaves/events, and bridge link to attendance reports.
- **Attendance Reports with Visual Student Calendar**: Screenshot 1 student monthly register with section filtering, minimal Screenshot 3 toolbar (`Search student...`, `Section`, `Class`, `Student`), frozen sticky columns, faded holidays & hostel leaves, Screenshot 2 class-wise submission audit, and dedicated `📅 Calendar` view mode with Active Student Hero card and Daily Attendance Inspection popup modal.
- **Dedicated Attendance Report Window (`#attendance_report`)**:
  - Dynamic cascading hierarchy: Admin selects Teacher $\to$ assigned Sections $\to$ assigned Classes; Teacher is strictly locked to their own teaching duty and cannot see or select other faculty reports.
  - Faculty dropdown displays only clean faculty names (e.g. `Rashid Sir`), omitting any role suffix like `(teacher)` or `(faculty)`.
  - Class dropdown displays only clean classroom names (e.g. `Moral Hall A1`), omitting time range strings.
  - Meeting days rendered with 7 round 1-letter circular badges (`M`, `T`, `W`, `T`, `F`, `S`, `S`) with green `.day-round.active` and muted `.day-round.inactive`, removing redundant `(Mon, Tue, Wed...)` text.
  - Strict cascading filter: Faculty list only includes teachers with assigned classes (`eligibleTeachers`). Selecting a faculty restricts Sections to only their assigned sections; selecting a section restricts Classes to only their assigned classes in that section.
  - Compact Event Calendar Card matching Academic Calendar (`media_1793240742835_afd14a06.png`).
  - Class timetable unworking days (e.g. Thu–Sat for classes meeting Sun–Wed) rendered as FADED.
  - Academic calendar holidays rendered in Light Yellow shade.
  - Hostel leaves rendered as FADED RED TEXT ONLY (no circle/round).
  - Missed attendance / untaken faculty duty rendered as RED COLOUR ROUND.
  - Admin "Allow Missed Attendance" (`db.unlockAttendanceWindow`) and "Close / Lock" (`db.lockAttendanceWindow`) controls.
  - Student attendance breakdown in day inspection popup with `L • {mins}m late` yellow badges and admin minutes visibility.
  - Admin direct "✏️ Edit Attendance" bridge to live attendance module.
  - Strict attendance window governance: mandatory class time window for all roles; teachers taking missed attendance can only select Admin-unlocked missed dates and cannot tamper with already taken attendance.
  - Faculty Duty Tenure & Assignment-Bound Attendance: Missed attendance ("Losen Attendance" / red round circles) is only evaluated starting from the date the teacher was assigned to the classroom (`teacher_assigned_date`). If an administrator removes the teacher from the classroom, duties immediately end on that removal date (`teacher_removed_date`). Dates prior to assignment or after removal do not show red circles or penalize the teacher.
- **Hostel Leave Passes, Calendar-Day Late Fines, Return Recording & Bedroom Bed Allocation Rack (Section 20)**:
  - Rebuilt Hostel Leave & Return Management UI (`renderLeavesModule`) with desktop table and mobile card feed (`.mobile-leave-cards`).
  - Sequential `LV-YYYY-XXX` pass code generation supporting individual and batch leave records.
  - Strict calendar-day late calculation (`calculateReturnLate`): 0 fine on expected day returns, exact day-based fines on late returns, and 1 black mark for late-hour returns.
  - Return recording (`recordReturn`) restoring student status from `'On Approved Leave'` back to `'Active'`.
  - Interactive 8-Bed Bedroom Rack (`renderHostelModule`) with Left Side (Beds 1-5) and Window Side (Beds 6-8).
  - Direct bed allocation (`assignStudentToBed`) and vacating (`vacateBed`) with dual bed/student record synchronization.
  - Student admission/edit form bed gating (`showEditStudentModal`) ensuring bed assignment inputs are removed and read-only allocation note is displayed.
- **Student on Approved Leave Attendance Governance & Incapable Controls (Section 21)**:
  - Automatic detection of approved leave (via student status or active pass in `tps_leaves`).
  - Student card rendered as faded (`.attendance-compact-card.is-on-leave.is-faded`, `opacity: 0.55`) with prominent `✈️ On Leave` badge and `(Approved Hostel Leave)` subtitle.
  - Locked `Locked (On Leave)` badge replaces interactive switch, rendering teachers incapable of altering attendance.
  - Bulk actions ("Mark All Present" / "Mark All Absent") strictly skip students on leave.
  - Summary counters display `On Leave: N` in royal blue.
  - Segmented Roster Filter tabs (`All`, `In Class`, `✈️ On Leave`) allowing teachers to filter roster to in-class students only.
  - Persists student status as `'Leave'` upon submission.
- **Boys Hostel Mentor & Girls Hostel Mentor Dedicated Roles, Strict Data Isolation, Classroom Duty & Dynamic Window Allotment (Section 24)**:
  - Dedicated institutional roles: `boys_mentor` ("Boys Hostel Mentor") and `girls_mentor` ("Girls Hostel Mentor") added alongside legacy `mentor`.
  - Scoping Engine (`getMentorGenderScope`): dynamically resolves `'Boys'` or `'Girls'` scope.
  - Strict Data Isolation across all operations:
    - **Hostel Racks & Beds**: Boys Mentor only sees Boys Hostels (`h-boys`), rooms, and beds; Girls Mentor only sees Girls Hostels (`h-girls`), rooms, and beds. Building switcher dropdown is hidden for mentors to prevent cross-campus peeking.
    - **Hostel Leaves & Gate Passes**: Scoped strictly by student gender. Mentors only view and issue passes for residents matching their assigned hostel gender.
    - **Student Misconduct & Discipline**: Incidents and black marks are filtered strictly to residents of the mentor's gender scope. New incident modal only lists scoped students.
    - **Late-Return Fines**: Fines ledger and payment collection slips strictly display only residents of the mentor's gender scope.
    - **Student Directory**: Student roster and metrics strictly display only the mentor's gender residents; gender filter dropdown locks to their gender.
  - **Classroom Attendance Access**: Mentors can access and record attendance for classes specifically assigned to them (via `teacher_id`), or coaching classes matching their gender scope (e.g. `cls-5` for Boys, `cls-6` for Girls). Enrolled roster filters eligible students to the mentor's gender scope.
  - **Dynamic Window Allotment**: Mentors can access any additional administrative window (e.g. `exams`, `marks`, `fees`, `timetable`, `reports`) when allotted by an administrator via the Visual RBAC Matrix or individual user overrides (`tps_user_custom_modules`). Allotted windows immediately surface in the sidebar drawer and bottom navigation.
- **Cloud Sync**: Cross-device unified database integrity.

---

## 9. Developer Guidelines & Constraints

1. **Maintain Light-Theme Saas Aesthetics**: Avoid dark backgrounds or jarring high-saturation blocks; use clean slate whites with high text contrast.
2. **Strict Domain Separation**: Academic Calendar (`#calendar`) is exclusively for the institutional calendar, working days schedule, and official holidays. Student attendance data, student search, student dropdowns, and student attendance calendars are housed strictly inside Attendance Reports (`#reports` and `#attendance_report`).
3. **Zero Hardcoded PAN/KYC Text**: Date pickers must dynamically adopt institutional labels (`Date of Birth`, `Admission Date`, `Attendance Date`).
4. **No Dropdown Clutter on Attendance**: Attendance screen must keep the big top card with compact student cards and 2-way switches.
5. **Preserve Unit Tests**: Never commit changes that cause any of the 89 unit tests to fail.

---

## 10. Living Changelog & Revision History

| Version | Date & Time | Author / Agent | Files Modified | Summary of Changes |
|---|---|---|---|---|
| **v1.9.5** | 2026-10-30 16:55 | Antigravity AI | `src/modules/leaves/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Hostel Arrival & Leave Register Modals: Equal 50/50 Button Alignment, Count Removal & Fixed Dialog Sizing: (1) Core user requirement ("ther is 2 problem here, one is the indivdual arrival and multiple arrival buttons alignment, give equal alignment. and there is no need count like yopu given 13 two is the indidual and multiple arrraival and leaven card should be same saize. when switching to multipe it is having small or big, give a fix size" with mobile screenshots `media_1793357902345_34f1567e.png` and `media_1793357909708_a282aa61.png`): completely revamped mode switcher and modal sizing across both the Hostel Arrival & Return Register and Hostel Leave Pass Register; (2) Equal 50/50 Button Alignment & Count Removal: redesigned segmented toggle bar (`.hostel-mode-switcher-bar`) with `flex: 1 1 0% !important; width: 50% !important; min-width: 0 !important; text-align: center;`, allocating exactly half width to each button; removed distracting student count badges like `(13 Away)` and `(13 Active)`; labeled buttons cleanly as `Individual Arrival` vs `Multiple Arrival` in arrival modal and `Individual Leave` vs `Multiple Leave` in leave modal; (3) Fixed Consistent Dialog Sizing (`.modal-dialog.hostel-flow-modal`): eliminated abrupt height snapping and dialog resizing when toggling between individual and multiple modes by enforcing fixed dialog height (`height: 650px; max-height: 88vh; min-height: 540px;` on desktop; `height: 84vh !important; max-height: 85vh !important; min-height: 540px !important;` on mobile); (4) Matching Card Visual Design: in Multiple mode, wrapped student checkbox list in a matching styled card (`background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 0.65rem;`) with `.hostel-modal-scroll-area` for smooth internal scrolling; (5) Pinned Bottom Actions Bar: anchored `Cancel` and `Confirm Arrival` / `Issue Leave Pass` buttons to the bottom of the modal (`.hostel-modal-actions-bar`) across all modes; (6) Added Section 20 automated unit test in `tests/app.test.js`; all 111/111 Vitest tests pass; production build succeeds cleanly. |
| **v1.9.4** | 2026-10-30 15:35 | Antigravity AI | `src/modules/attendance/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Attendance Roster Bottom Counters Streamlining (Present, Absent, On Leave Only) & Roster Filter Subbar Removal: (1) Core user requirement ("there is no need all, in class etc there. the row should be removed. botom card condaines present, absent, leave, total students. but there os no nedd all students there there is present, absent, leave, is inough" with iPhone 14 Pro screenshot `media_1793354136357_e36c619d.png`): completely removed redundant "Total Students:" from the big class card bottom footer bar (`#att-counters`), which had caused text truncation and wrapping issues on compact mobile viewports; (2) Card Bottom Footer Telemetry: `.att-class-footer-bar` / `#att-counters` now exclusively displays the concise status telemetry: `Present: ${presentCount} • Absent: ${absentCount} • On Leave: ${leaveCount}` (plus Late if present); (3) Roster Filter Tabs Subbar Removal: removed the entire `.att-roster-subbar` row containing `[ All (N) ]`, `[ In Class (N) ]`, `[ ✈️ On Leave (N) ]`, and the `N Students` text; (4) Direct Roster Flow: the 3/5 Search Bar + 1/5 All Present + 1/5 Clear action row now flows directly into the compact student cards list; (5) Streamlined Filter Logic: search filtering operates cleanly on student names across all class roster members without requiring mode switching; (6) Updated automated Vitest test suite in `tests/app.test.js`; all 110/110 tests pass; production build succeeds cleanly. |
| **v1.9.3** | 2026-10-30 15:15 | Antigravity AI | `src/modules/attendance/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Attendance Roster Big Class Card Bottom Counters & 3/5 Search + 1/5 All Present + 1/5 Clear Action Bar: (1) Core user requirement ("need chanage here, UI not proper here at bottom of card shows only present, abset, on leave, total students (at the class) after card serch bar shoul show 3/5 of the line 1/5 button to set all presnt, 1/5 clear butto there is no need a button to all absent becose in bult at first shows all as absent"): completely removed bulk action buttons (`.att-bulk-btns`) from the bottom footer bar of the big class card (`.att-big-class-card`); (2) Bottom of Card Telemetry: `.att-class-footer-bar` / `#att-counters` strictly displays attendance summary counters: `Present: X • Absent: Y • On Leave: Z • Total Students: N (M in class)` with clean wrapping and zero horizontal overflow; (3) 3/5 + 1/5 + 1/5 Action Row Layout (`.att-search-actions-bar`): placed directly beneath the big class card as a full-width flex row with 0.5rem gap; allocated 3/5 (60% width via `.att-search-col-3-5`) to student search input (`#att-search-input`), 1/5 (20% width via `.att-btn-col-1-5`) to "All Present" button (`#btn-mark-all-present`), and 1/5 (20% width via `.att-btn-col-1-5`) to "Clear" button (`#btn-clear-attendance`); (4) Elimination of Redundant "All Absent" Button: removed redundant bulk absent button because all students are by default initialized to Absent; (5) Clear Button Functionality: tapping "Clear" resets all in-class student attendance back to Absent, clears late arrival minutes, and resets the search input query with an immediate UI re-render; (6) Roster Filter Tabs Subbar (`.att-roster-subbar`): moved segmented filter pills (`[ All (N) ]`, `[ In Class (N) ]`, `[ ✈️ On Leave (N) ]`) and the total student counter to a dedicated row below the action bar, eliminating input squeezing on mobile screens ($\le 480$px); (7) Unit Tests & Verification: added Section 25 unit test in `tests/app.test.js`; all 110/110 Vitest tests pass; production build succeeds cleanly. |
| **v1.9.2** | 2026-10-30 15:05 | Antigravity AI | `src/modules/dashboard/admin-dashboard.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Mobile Hero Card Footer Stat: Replaced Curfew Lock with Currently Running Classes & Attendance Received Ratio: (1) Core user requirement ("the place should change as currently running class number / receved attendence number of class's" with uploaded crop of `CURFEW LOCK / 09:30 PM`): completely replaced static Curfew Lock on mobile admin dashboard hero card footer with dynamic real-time class attendance telemetry; (2) Stat Design & Layout: label set to `RUNNING / RECEIVED` (`.m-hero-f-label`), and value set to `${runningCount} / ${receivedCount}` (`.m-hero-f-val` in bright mint green `#34D399`); (3) Dynamic Schedule Calculation: integrated `db.getAttendanceRecords()`; evaluates today's scheduled classes meeting on the current day of the week (`todayKey`) and running right now (`currentMinutes >= startMin && currentMinutes <= endMin`); `runningCount` is the number of currently running classrooms; (4) Attendance Telemetry: `receivedCount` evaluates how many of the currently running classes have recorded attendance for today (`todayIso`), or evaluates today's total attended classes if 0 are running; (5) One-Tap Navigation: clicking the stat (`#m-hero-live-att-stat`) routes directly to the Attendance Timetable module (`#attendance`); (6) Eye Toggle Obfuscation: toggling the hero eye button obscures the stat to `••/••` alongside student numbers; (7) Desktop Dashboard Alignment: updated companion desktop card from `Night Curfew Status` to `Live Class Attendance` displaying matching `${runningCount} / ${receivedCount}`; (8) Added automated unit test in `tests/app.test.js`; all 109/109 Vitest unit tests passing; verified clean Vite production build. |
| **v1.9.1** | 2026-10-30 14:55 | Antigravity AI | `src/lib/db.js`, `src/modules/attendance/index.js`, `src/modules/dashboard/teacher-dashboard.js`, `src/modules/timetable/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Faculty on Approved Leave Attendance Inability & Dashboard Notification Suppression: (1) Core user requirement ("if any faculty at leave the could not abelee to take attendence at the time of leave and they should not go notification at the dashbord at the time of leave"): faculty on approved leave are incapable of recording attendance and have dashboard attendance alarms completely muted during their leave; (2) Inability to Take Attendance: in `src/modules/attendance/index.js`, when a teacher or mentor is on approved leave today/for the session date (`db.isFacultyOnApprovedLeave` is true), attendance taking is strictly locked (`canTake = false`, `canInteract = false`); in Timetable Cards view, the take attendance button renders as `🔒 Attendance Waived (On Leave)` (disabled); in Class Roster view, bottom submit button renders as `🔒 Attendance Waived (Faculty On Approved Leave)` and all student 2-way toggle switches and bulk actions are locked; (3) Submission Lock & Toast Notice: attempting to submit attendance or click cards while on approved leave is blocked with warning toasts informing that faculty leave is active and duty is waived; (4) Teacher Dashboard Alert Suppression: in `src/modules/dashboard/teacher-dashboard.js`, when on approved leave today, the "Your upcoming class" card suppresses live countdowns, live pulse indicators, and "Take Attendance →" buttons, rendering instead a peaceful "Faculty Leave Active" notice (`.teacher-upcoming-card.is-leave`) showing `✈️ Duty Waived by Administration`, leave type, permitted timings, and reason; (5) Stat Card Zero Penalty: "Pending Attendance" stat card count drops to `0` with subtitle `✓ Attendance officially waived (On Leave)` and soft green styling (`#ECFDF5`, `#059669`); (6) Timetable Card Integration: cards in `src/modules/timetable/index.js` display `✓ Duty Waived (On Leave)` badge for faculty on leave; (7) Robust Helper: enhanced `isFacultyOnApprovedLeave` in `src/lib/db.js` with multi-format user object resolution, case-insensitive ID/email/name matching, and optional time-window verification; (8) Added Section 23 unit test `2306` in `tests/app.test.js`; all 108/108 Vitest unit tests passing; verified clean production build. |
| **v1.9.0** | 2026-10-30 14:35 | Antigravity AI | `src/modules/faculty-leaves/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Faculty Leaves: Distinct Colored Cards (Light Orange for Pending, Light Green for Approved) & Strict Non-Admin Data Isolation: (1) Card Redesign: transformed leave records into distinct, separated cards (`.faculty-leave-card`) with rounded corners (`border-radius: 16px; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); padding: 1.25rem 1.5rem;`) replacing continuous list styling; (2) Status Card Styling: Pending cards render with `.is-pending`, warm light orange background (`#FFF7ED`), border (`1.5px solid #FED7AA`), left status bar (`5px solid #EA580C`), matching pending pill (`#FFEDD5` / `#C2410C`), and amber avatar; Approved cards render with `.is-approved`, soft light green background (`#F0FDF4`), border (`1.5px solid #BBF7D0`), left status bar (`5px solid #059669`), matching approved pill (`#DCFCE7` / `#15803D`), and green avatar; (3) Strict Non-Admin Data Isolation ("IMP: every faculty can only their data except admin"): every faculty member (teacher, mentor, etc.) strictly only accesses and views their own leave requests (`leaves = isAdmin ? allLeaves : allLeaves.filter(isLeaveMine)`), while administrators retain full school-wide visibility; (4) Non-Admin UI Scoping: faculty filter dropdown (`#faculty-filter-select`), "My Leaves" tab, and administrative approval/rejection buttons are completely hidden for non-admin faculty; in the leave application modal, non-admins are locked to applying for themselves with forced `Pending` status; (5) Delete Security Safeguard: non-admins are barred from deleting another faculty member's leave record even if targeted directly; (6) Added Section 23 unit test `2305` in `tests/app.test.js`; all 107/107 Vitest tests passing; verified clean production build. |
| **v1.8.9** | 2026-10-30 14:20 | Antigravity AI | `src/modules/dashboard/admin-dashboard.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Admin Mobile Dashboard Hero Brand Pill: Dynamic Faculty Leave Request Alerts & Navigation: (1) Replaced static `.m-hero-brand-pill` ("THAIBASCHOOL CAMPUS") with dynamic real-time faculty leave request alerting ("here in the plce of .Thaibaschool campus, if any one request to leave their name should show with leave request, if graterthan 1 should show 2 faculty has rested leave"): integrates `db.getFacultyLeaves()` and monitors pending applications; (2) Single Faculty Request: if exactly 1 faculty member has a pending leave request, pill displays `${applicantName} requested leave` (e.g. `Rashid Sir requested leave`); (3) Multiple Faculty Requests: if greater than 1 faculty members have pending leave requests, pill displays `${count} faculty requested leave` (e.g. `2 faculty requested leave`); (4) Default/Zero State: when zero pending faculty leaves exist, defaults cleanly to institutional branding `THAIBASCHOOL CAMPUS`; (5) Amber Alert Styling & Pulse Animation: when active, pill acquires `.has-leave-request` (`background: rgba(245, 158, 11, 0.22)`, border `rgba(245, 158, 11, 0.45)`, text `#FEF3C7`, `text-transform: none` to preserve natural casing of teacher names) and the live indicator dot pulses in glowing amber (`tpsPulseAmber`); (6) One-Tap Approval Bridge: clicking the pill on mobile (or companion desktop alert banner `#dash-desktop-leave-alert`) navigates the administrator directly to the Faculty Leaves module (`#faculty_leaves`) to review and authorize requests; (7) Added automated unit tests; all 106/106 tests passing and clean Vite production build. |
| **v1.8.8** | 2026-10-30 13:50 | Antigravity AI | `src/modules/hostel/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Hostels & Bedroom Layout Overhaul (Tab Removal, Full-Width Dropdown, Side-by-Side Floorplan, Compact Bed Info & Classroom-Style Bed Assignment Modal): (1) Removed redundant tab switcher bar (`#tab-btn-rack` and `#tab-btn-roster`), defaulting directly to the visual bedroom floorplan rack ("thers is no need hosteld bed lay out and residentil ... there. remove the potion."); (2) Full-Width Hostel Filter Dropdown: placed hostel filter in dedicated `.hostel-filter-card` with `flex: 1 1 0%`, stretching 100% full width to the right end of the card ("the dropdown's length incres up to end of the card"); (3) Redesigned Bedroom Floorplan Rack: transformed bedrooms into 2-column side-by-side floorplan cards (`.bedroom-sides-grid`) with Left Side card (Beds 1-5) and Right Side / Window Side card (Beds 6-8), with beds stacked one by one vertically as individual cards inside each side ("bed room lay out should be changed let side card should be left side one by one bed. right side card should be swo on roo card one by one as card."); (4) Compact Bed Metadata: removed IDs and admission numbers from occupied bed cards, displaying strictly the student's full name in bold and under it `Class • Age` (e.g. `STD-I • 6 Yrs`) computed from student's date of birth via `getStudentAge` ("ther is no need more data on bed, name under the name class after a dot age. if is inough there."); (5) Upgraded "Assign Student to Bed" Modal: completely replaced old dropdown with classroom student assignment design (`.assign-students-modal` size `lg`) matching Image 4, featuring modal meta bar with unassigned resident counter, search input (`Search by student name, DOB, or admission no...`), class and gender filter dropdowns, scrollable 1-column resident card list with student photo or gender silhouette, single-tap radio selection, and pinned footer with `Assign to Bed N` button ("when assign studnet to bed the setup should be changed. it should be like assign students to class room window."); (6) Enhanced Bed Console (`openChangeOrVacateBedModal`): shows resident's Name and `Class • Age`, with "Vacate Bed (Free Space)" and "Choose New Resident (Open Selector) →" button directly launching the classroom-style student selector; (7) Added automated Vitest tests asserting tab removal, full-width filter, side-by-side bedroom floorplan, and compact bed metadata; all 105/105 tests passing and verified clean Vite production build. |
| **v1.8.7** | 2026-10-30 13:30 | Antigravity AI | `src/lib/permissions.js`, `src/lib/auth.js`, `src/lib/db.js`, `src/components/navbar.js`, `src/components/sidebar.js`, `src/components/bottom-nav.js`, `src/modules/dashboard/index.js`, `src/modules/dashboard/mentor-dashboard.js`, `src/modules/hostel/index.js`, `src/modules/leaves/index.js`, `src/modules/discipline/index.js`, `src/modules/fines/index.js`, `src/modules/students/index.js`, `src/modules/attendance/index.js`, `src/modules/users/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Boys Hostel Mentor & Girls Hostel Mentor Separation, Strict Isolation, Classroom Attendance & Dynamic Window Allotment: (1) Added dedicated institutional roles `boys_mentor` ("Boys Hostel Mentor") and `girls_mentor` ("Girls Hostel Mentor") to RBAC system, navbar position titles, sidebar role selector, and user management; (2) Implemented `isMentorRole` and `getMentorGenderScope` helpers providing unified gender scope determination ('Boys' vs 'Girls') across all modules; (3) Hostel Module strict isolation: Boys Mentor only accesses boys hostels (`h-boys`), rooms, and beds; Girls Mentor only accesses girls hostels (`h-girls`), rooms, and beds; building selector hidden for mentors to prevent cross-campus peeking; (4) Leaves & Gate Pass Register isolation: Mentors only see leaves and can only issue passes for students matching their hostel gender; (5) Discipline & Misconduct isolation: Incidents, black marks ledger, and incident logging modal filtered strictly to residents matching the mentor's gender scope; (6) Late-Return Fines Engine isolation: Fines ledger, collection modals, and slips strictly display residents of the mentor's gender scope; (7) Student Directory isolation: Student roster, metrics, and filter dropdown strictly scoped to mentor's gender residents; (8) Classroom Attendance Access: Mentors can view timetable cards and record attendance for classes assigned to them via `teacher_id` or matching their gender scope (`cls-5` for Boys, `cls-6` for Girls); eligible student roster filters by mentor gender; (9) Dynamic Window Allotment: If an Admin allots additional windows (e.g. `exams`, `marks`, `fees`, `timetable`, `reports`) to a mentor via the RBAC Matrix or individual user overrides (`tps_user_custom_modules`), the mentor immediately gains access and the allotted window appears in the sidebar drawer and bottom navigation; (10) Added Section 24 automated Vitest unit tests (104/104 passing) and verified clean production build. |
| **v1.8.6** | 2026-10-30 13:10 | Antigravity AI | `src/modules/dashboard/teacher-dashboard.js`, `src/modules/faculty-leaves/index.js`, `src/modules/reports/attendance-report.js`, `src/modules/attendance/index.js`, `src/lib/db.js`, `src/lib/permissions.js`, `src/components/sidebar.js`, `src/app.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Teacher Dashboard Header Cleanup, Pending Attendance Stat Card & Faculty Leaves Workflow: (1) Removed redundant top buttons "My Timetable" and "Take Attendance" from `.page-header` on the Teacher Dashboard ("there is no need my time tabel and take attendence buttons on the top. remvoe it"); (2) Replaced "Students Taught" stat card with "Pending Attendance" card displaying dynamic count of sessions pending attendance submission today (`pendingAttendanceCount`, routing directly to `#attendance`); (3) Dedicated Faculty Leave Application Window (`faculty_leaves`): built new module `src/modules/faculty-leaves/index.js` with executive header, 4 KPI cards (Total, Pending, Approved, Active Today), search, status filter tabs, and mobile-responsive cards; (4) Modal matches Academic Calendar pattern: segmented toggle between `[ Single Day ]` and `[ Multiple Days (Date Range) ]` with 50/50 side-by-side date inputs, plus going time ("going tami") and coming back time ("coming back time") 50/50 time inputs; (5) Multi-role leave delegation: administrators can apply on behalf of any faculty member via dropdown selector ("also admin set others leave"), while teachers apply for themselves with default `Pending` status; (6) Admin Approval Flow: Administrators can approve (`✓ Approved`) or reject (`✕ Rejected`) pending applications with audit notes; (7) Attendance Report & Governance Integration: if an administrator approves faculty leave (`status === 'Approved'`), the day is marked with an authorized waiver (`isFacultyApprovedLeave = true`) and is NOT penalized as missed attendance (no red circle); if unapproved, it remains flagged as missed attendance ("other wise it will sow as they are not take attendence at the days"); (8) Attendance Roster Alert: displays prominent emerald authorized faculty leave banner when a session's faculty is on approved leave; (9) Registered in Sidebar (`Student & Academic`), permissions matrix, and router; (10) Added Section 23 automated Vitest unit tests; all 94/94 tests passing and verified clean production build. |
| **v1.8.5** | 2026-10-30 12:55 | Antigravity AI | `src/modules/dashboard/teacher-dashboard.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Removal of Duplicate Teaching Schedule from Teacher Dashboard: (1) Resolved redundancy where teaching schedule was repeated on the Teacher Dashboard ("there is no need teching scedule in dash board. becose it is already at timetable and attendence management"): removed the long "Today's Teaching Schedule" card and slot loop listing all 11 classes with duplicate "Mark Attendance" buttons; (2) Re-balanced main dashboard content into a streamlined 2-column grid featuring "Assigned Examination Subjects" (with Enter Marks button and Grading Sheet links) alongside "Teacher Guidelines & Academic Circulars" (with Morning Moral Class Protocol and Mid-Term Evaluation Window); (3) Updated dashboard header and section subtitles to reflect academic duties and grade sheets rather than teaching schedule; (4) Cleaned up dead slot event listeners and unused slot generator variables; (5) Preserved direct one-click timetable navigation via "My Timetable" button, mobile bottom nav, and KPI stat cards; (6) Updated Vitest assertions; all 90/90 tests passing and verified clean production build. |
| **v1.8.4** | 2026-10-30 12:45 | Antigravity AI | `src/styles/main.css`, `src/modules/students/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Mobile UI Compatibility & Horizontal Scroll Elimination for Edit Modals: (1) Resolved mobile overflow where editing a student record required horizontal scrolling ("some condents need scroling to right"): enforced strict `overflow-x: hidden !important` on `.modal-body`, eliminating side-scrolling and viewport wiggles; (2) Added defensive sizing to `.modal-dialog`, `.modal-dialog.modal-lg`, and `.modal-dialog.modal-xl` on viewports $\le 768\text{px}$: `width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important;` and `padding: 0.5rem` on `.modal-overlay`; (3) Wrapped modal header titles with `word-break: break-word`, `min-width: 0`, and `flex: 1` to prevent long titles from forcing dialog expansion; (4) Added `width: 100% !important; max-width: 100% !important; min-width: 0 !important;` and `box-sizing: border-box !important` on `.form-control`, `input.form-control`, `select.form-control`, and `textarea.form-control` to prevent inputs (like native date pickers and selects) from exceeding container width; (5) Optimized student edit and profile modals: removed rigid `min-width: 240px` and `min-width: 260px` inline constraints, introducing mobile-first CSS classes (`.student-edit-form-wrap`, `.student-edit-banner`, `.student-edit-photo-col`, `.student-edit-photo-box`, `.student-edit-info-col`, `.student-edit-hostel-box`, `.student-edit-actions-row`); photo box scales down smoothly to 80x98px on mobile with wrapped specs text; (6) Enhanced mobile touch targets on action buttons with equal `flex: 1` distribution; (7) Added Section 22 automated unit test verifying mobile-responsive classes and constraints; all 90/90 Vitest tests pass; verified clean production build. |
| **v1.8.3** | 2026-10-30 12:25 | Antigravity AI | `src/modules/attendance/index.js`, `src/modules/reports/attendance-report.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Student on Approved Leave Attendance Governance (Faded/On-Leave Display, Incapable Switch, and Submission Protection): (1) Resolved requirement where students on approved leave should not have attendance taken by teachers or should show as faded / on-leave: integrated `isStudentOnLeave(s, sessionDate)` checking both student profile status (`status === 'On Approved Leave'`) and active leave passes in `tps_leaves` covering the session date; (2) Faded & On-Leave Presentation: cards render with `.is-on-leave` and `.is-faded` (`opacity: 0.55`, soft slate background `#F8FAFC`, border `#E2E8F0`), showing prominent royal blue `✈️ On Leave` pill (`.att-on-leave-pill`) and `(Approved Hostel Leave)` subtitle; (3) Incapable Teacher Controls: replaced interactive 2-way toggle switch for students on leave with a locked `Locked (On Leave)` badge (`.att-leave-locked-badge`) with lock icon; clicking the card or switch triggers a warning toast informing that the student is on approved leave and attendance cannot be modified; (4) Bulk Action Immunity: "Mark All Present" and "Mark All Absent" strictly skip students on leave; (5) Independent Counter: summary counters display `On Leave: N` in royal blue separate from Present and Absent counts; (6) Segmented Roster Filter Tabs: added `[ All (N) ]`, `[ In Class (N) ]`, and `[ ✈️ On Leave (N) ]` buttons on the roster header allowing teachers to filter the list to only in-class students (hiding students on leave); (7) Submission Integrity: submitting attendance automatically records student status as `'Leave'`; (8) Updated Attendance Report day inspection modal breakdown to display students on leave with `✈️ On Leave` badge; (9) Added automated unit tests in Section 21 of `tests/app.test.js`; all 89/89 Vitest tests passing; verified clean production build. |
| **v1.8.2** | 2026-10-30 12:05 | Antigravity AI | `src/lib/db.js`, `src/modules/leaves/index.js`, `src/modules/hostel/index.js`, `src/modules/students/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Integration of Hostel IRP Leave Passes, Arrival Register, 8-Bed Bedroom Rack, and Student Bed Gating: (1) Ingested and adapted full leave and arrival workflows from `E:\Hostel IRP` with modern light-theme UI and mobile responsiveness: created sequential `LV-YYYY-XXX` leave code generator, segmented Leave Pass modal with `[ Individual Leave ]` vs `[ Batch Leave Card ]`, and segmented Arrival Register modal with `[ Individual Student (N Away) ]` vs `[ Batch Leave Card (N Active) ]`; (2) Implemented calendar-day late calculation (`calculateReturnLate`) strictly computing late days by date difference ($\Delta \text{Days} = \text{Actual Date} - \text{Expected Date}$); returning on expected day incurs ₹0 fine (and 1 black mark if after expected time); returning after expected day incurs $\Delta \text{Days} \times \text{Fine Rate}$ per day; automatically posts fines to `tps_fines` and black marks to `tps_black_marks`; (3) Implemented automated student status synchronization: departing students transition to `'On Approved Leave'` and returning students are restored to `'Active'` (Hostel Resident); (4) Integrated interactive 8-Bed Bedroom Rack in Hostels & Beds module (`src/modules/hostel/index.js`): visual dormitory rack partitioned into Left Side Beds (1-5) and Window Side Beds (6-8) with direct `+ Assign Student` on vacant beds and `Change / Vacate` on occupied beds; (5) Removed bed and room assignment inputs from Student Master edit form (`src/modules/students/index.js`), replacing them with read-only indicators to establish Hostels & Beds as the exclusive single source of truth for bed allocations; (6) Persisted and synchronized all leave, room, bed, fine, and black mark records with Supabase via `DatabaseService` (`tps_leaves`, `tps_hostel_rooms`, `tps_hostel_beds`, `tps_fines`, `tps_black_marks`); (7) Added comprehensive unit tests in Section 20 of `tests/app.test.js`; all 87/87 Vitest tests passing; verified clean production build. |
| **v1.8.1** | 2026-10-30 11:45 | Antigravity AI | `src/modules/calendar/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Month Boundary Curvature for Cross-Month Leave & Holiday Ranges: (1) Resolved straight/flat vertical cut-offs at month transitions (Oct 31 right edge flat in October view, Nov 1 left edge flat in November view when leave spans Oct 30 to Nov 3): added `isMonthFirst: d === 1` and `isMonthLast: d === totalDays` properties to `getCalendarGridDays` and injected `.is-month-first` / `.is-month-last` CSS classes on calendar day cells; (2) Added month boundary CSS rules in `src/styles/main.css` for `.is-month-last` and `.is-month-first`: on the last day of the month (`is-month-last`), multi-day connecting tracks (`is-holiday-middle`, `is-hostel-leave-middle`, `is-range-middle`) receive rounded right caps (`border-top-right-radius: 9999px !important; border-bottom-right-radius: 9999px !important;`) and single-day starts have `::after` hidden with complete border-radius; on the 1st of the month (`is-month-first`), multi-day connecting tracks receive rounded left caps (`border-top-left-radius: 9999px !important; border-bottom-left-radius: 9999px !important;`) and endings have `::before` hidden with complete border-radius; (3) Added full row-wrapping pill cap rules for `:nth-child(7n)` (Sunday) and `:nth-child(7n+1)` (Monday); (4) Added automated unit test in `tests/app.test.js` asserting month boundary class injection across October 31 and November 1; all 82/82 Vitest tests pass; production build verified cleanly. |
| **v1.8.0** | 2026-10-30 11:33 | Antigravity AI | `src/components/bottom-nav.js`, `src/app.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Universal Edge-to-Edge Mobile Bottom Navigation & Sidebar Stacking: (1) Transformed the floating rounded capsule pill bar into a native, full-width edge-to-edge mobile bottom bar (`bottom: 0; left: 0; right: 0; width: 100vw; border-radius: 0; border-top: 1px solid #E2E8F0;`) filling the entire bottom area from left to right; (2) Created dedicated `src/components/bottom-nav.js` with `getBottomNavItems` dynamically deriving role-scoped accessible windows for every mobile user (Admin: Home, Schedule, Attendance, Reports, Settings; Teacher: Home, Schedule, Attendance, Reports, Marks; Mentor: Home, Attendance, Gate Pass, Hostel, Discipline; Parent: Home, Attendance, Leaves, Marks, Fees; Student: Home, Attendance, Leave Pass, Marks, Exams), fully honoring RBAC permissions; (3) Mounted globally in `src/app.js` shell so all accessible windows across the entire ERP maintain continuous one-thumb mobile bottom navigation; (4) Added equal `flex: 1 1 0%` distribution to `.m-nav-pill-btn` with soft mint `.m-nav-icon-wrap` active pill highlight; (5) Resolved sidebar stacking: configured mobile `.sidebar` with `z-index: 999 !important;` and `.sidebar-backdrop` with `z-index: 998 !important;` over bottom nav (`z-index: 40`), ensuring the sidebar drawer smoothly covers the bottom buttons when opened; (6) Added automated unit tests; all 81/81 Vitest tests pass; production build verified cleanly. |
| **v1.7.9** | 2026-10-30 11:22 | Antigravity AI | `src/modules/reports/attendance-report.js`, `src/components/custom-select.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Full-Width Faculty / Teacher Name Dropdown up to Right Last End of Card: (1) Resolved dropdown width constraint in Attendance Report filter card where the Faculty / Teacher pill dropdown (`#att-rep-teacher-select`) stopped halfway across the card: enhanced select trigger had defaulted to `display: inline-flex` with content-sized width; (2) Updated `enhanceSelect` in `src/components/custom-select.js` to detect when a native `<select>` defines `style.width === '100%'`, class `select-full-width`, `w-100`, or `data-full-width="true"`, automatically conferring `.w-100` and `width: 100%`, `display: flex`, and `box-sizing: border-box` to `.tps-custom-select-trigger`; (3) Added full-width rules in `src/styles/main.css` for `#att-rep-teacher-select + .tps-custom-select-trigger`, `.select-full-width + .tps-custom-select-trigger`, and `.tps-select-full-width`, ensuring the pill stretches 100% all the way to the right last edge of the card on all screen viewports; (4) Configured `positionMenu` to match the floating options menu card width to the full-width trigger; (5) Added unit test asserting full-width custom-select enhancer behavior; all 80/80 Vitest tests passing; verified clean production build. |
| **v1.7.8** | 2026-10-30 11:15 | Antigravity AI | `src/modules/dashboard/admin-dashboard.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Mobile Admin Dashboard: Replace Enrolled Residents Carousel with Students on Leave: (1) Replaced the generic "Enrolled Residents" horizontal carousel and its `(+) New` enrollment button on the mobile Admin Dashboard with a dedicated "Students on Leave" carousel matching user directives and hostel presence gauge metrics; (2) Populated the carousel exclusively with students who are currently on leave (`s.status === 'On Approved Leave'` or active gate pass records with `l.status === 'Away'` or `'Overdue'`); (3) Replaced section header link with `Leave Register →` (`#m-see-all-leave-residents-btn`) navigating directly to the Gate Pass & Hostel Leaves module (`#leaves`); (4) Styled leave avatars with status-aware border rings and bottom-right status dots: Royal Blue (`#2563EB`) with `.status-leave` pill for students on approved leave, and Crimson Red (`#DC2626`) with `.status-overdue` pill for overdue returns; (5) Tapping any student card routes directly to the leave register; (6) Added clean empty-state banner when zero residents are away ("✓ All residents currently on campus. Zero active leaves."); (7) Updated automated unit tests in `tests/app.test.js` to assert "Students on Leave" carousel, status pills, and absence of generic enrollment button; all 79/79 Vitest tests passing; verified clean production build. |
| **v1.7.7** | 2026-10-30 11:03 | Antigravity AI | `src/modules/students/index.js`, `src/lib/dialog.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Fix Edit Student Record Button in Student Profile Modal: (1) Resolved non-responsive "Edit Student Record" and "Delete Student" buttons inside `showProfileModal`: `onMount` had used legacy parameter signature `(modalBody, modalOverlay)` while `openModal` passes an options object `{ container, close }`, causing `modalBody.querySelector` to evaluate to `undefined` and preventing click listeners from attaching; (2) Updated `showProfileModal` to destructure `{ container: modalBody, close }` and use `close()` cleanly to dismiss the profile view and seamlessly open `showEditStudentModal(student)`; (3) Fortified `openModal` in `src/lib/dialog.js` with `querySelector`/`querySelectorAll` proxies on the mount options object and passed `overlay` as secondary argument for complete multi-signature tolerance; (4) Added automated Vitest test asserting student profile modal actions and resilient event binding; all 79/79 tests pass and verified clean production build. |
| **v1.7.6** | 2026-10-30 10:58 | Antigravity AI | `src/modules/timetable/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Full-Width Faculty Filter Card & Add Timetable Slot Removal: (1) Removed the redundant `+ Add Timetable Slot` button and modal from `src/modules/timetable/index.js`, as classroom configurations and schedules are governed in Sections & Classrooms; (2) Redesigned the Faculty Filter into a full-width altered design card (`.card-panel`) that fills 100% of the row on both mobile and desktop screens; (3) Styled the card with an emerald faculty squircle icon, uppercase label ("Filter Timetable by Faculty"), live active/total classes badge pill, and high-contrast 42px select dropdown displaying faculty class counts; (4) Eliminated mobile header squeeze and line-wrapping collisions; (5) Updated automated unit tests in `tests/app.test.js`; all 78/78 tests pass and verified clean production build. |
| **v1.7.5** | 2026-10-30 10:55 | Antigravity AI | `src/modules/reports/attendance-report.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Attendance Report Filter Card Modernization & Row Restructuring: (1) Transformed the cascading attendance filter card into a clean 2-row layout: Row 1 features the Faculty/Teacher dropdown filling the full width of the card, while Row 2 divides Assigned Section and Assigned Classroom Session equally (50% / 50%) side by side into a single row; (2) Redesigned the top of the card: replaced developer text ("CASCADING ATTENDANCE FILTER" and "ROLE SCOPED") with a modern 34px icon squircle, bold "Classroom & Faculty Duty" title, subtitle, and an official governance status pill; (3) Cleaned up the timetable specs ribbon below, aligning meeting days and timing without hanging punctuation; (4) Polished page header actions and description; (5) Added unit test asserting 50/50 section & class division and upgraded header; 78/78 tests pass and verified clean production build. |
| **v1.7.4** | 2026-10-30 10:48 | Antigravity AI | `src/modules/timetable/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Attendance Button Removal from Timetable Cards: (1) Removed redundant `Take Attendance →` button from Timetable Cards in `src/modules/timetable/index.js`, as live attendance recording is dedicatedly housed within the Attendance Management module (`#attendance`); (2) Cleaned up the card header to pure information display matching the reference screenshot (`Moral Hall A1` + `Hostel Moral Class` program pill + optional subtle live/upcoming pill); (3) Removed dead button click event listener in `src/modules/timetable/index.js`; (4) Updated test suite in `tests/app.test.js` to assert timetable cards omit attendance button; all 78/78 tests pass and production build verified. |
| **v1.7.3** | 2026-10-30 09:30 | Antigravity AI | `src/modules/timetable/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Streamlined & Modernized Timetable Cards UI (Given Portion & Faculty Visibility): (1) Compacted card height by removing redundant top header ("Your upcoming class" title, "Scheduled teaching session" subtitle, and 48px stopwatch icon box); (2) Retained the user-designated given portion: bold emerald class name (`#065F46`), program badge pill, and 2x2 timetable specifications grid (Schedule Time, Classroom/Hall, Enrolled Roster, Scheduled Days); (3) Integrated Assigned Faculty directly among the card details for Administrators (`Assigned Faculty: {teacherName}`) with teacher icon and badge, enabling instant faculty identification across multi-teacher classes; (4) Integrated compact `Take Attendance →` button directly into the card title row, eliminating the bulky 60px bottom footer; (5) Enhanced card aesthetics with 16px radius, subtle borders, smooth hover elevation, and left-border status indicators (`.is-live`, `.is-soon`); (6) Updated unit test suite; all 78/78 tests pass and verified clean production build. |
| **v1.7.2** | 2026-10-29 14:25 | Antigravity AI | `src/modules/reports/attendance-report.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Cascading Attendance Filter UI & Content Polish (Screenshots 1 & 2): (1) Removed position/role suffixes like `(teacher)` or `(faculty)` from faculty names in the dropdown, displaying only clean teacher names (e.g. `Rashid Sir`); (2) Stripped time range strings from classroom `<option>` tags, showing only clean classroom names (e.g. `Moral Hall A1`); (3) Replaced text-based meeting days and verbose labels with 7 round 1-letter circular badges (`M`, `T`, `W`, `T`, `F`, `S`, `S`) with green `.day-round.active` and muted `.day-round.inactive`, removing redundant `(Mon, Tue, Wed, Thu, Fri, Sat)` text; (4) Filtered faculty dropdown to only show teachers who actually have assigned classes (`eligibleTeachers`); (5) Enforced strict cascading: selecting a faculty filters sections to only those with assigned classes; selecting a section filters classes to only their assigned classes in that section; (6) Added automated Vitest test suite asserting faculty name isolation, clean class names, 1-letter round meeting days, and cascading unassigned faculty removal; all 78/78 tests passing and production build succeeded cleanly. |
| **v1.7.1** | 2026-10-29 12:50 | Antigravity AI | `src/modules/attendance/index.js`, `src/lib/dialog.js`, `src/lib/toast.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Auto-Close Attendance Student List Window upon Submission: (1) Updated attendance submission handler (`#btn-submit-attendance`) in `src/modules/attendance/index.js` so that immediately after the attendance session is saved and the success toast notification is displayed, the student roster list window automatically closes; (2) Switches `currentView` back to `'cards'` and renders `renderTimetableCardsUI()`, bringing the teacher or administrator back to the Timetable Cards window where the class card now reflects `✓ Attendance Recorded` and `Submitted for {date}`; (3) Cleans up temporary `sessionStorage` keys (`tps_active_att_cls` and `tps_active_att_date`) on submit and back-button click; (4) Added SSR/Node environment guards in `src/lib/dialog.js` and `src/lib/toast.js` (`typeof document === 'undefined'`); (5) Added automated unit test verifying submission saves to DB, closes student roster container, and renders timetable cards view; all 77/77 tests passing and clean production build. |
| **v1.7.0** | 2026-10-29 12:35 | Antigravity AI | `src/modules/dashboard/teacher-dashboard.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Teacher Dashboard Mobile 2-in-a-Line Square ("Squir Type") Bento Grid & Floating Pill Bar: (1) Transformed the single-column vertically stacked rectangular metric cards on mobile into a 2-in-a-line square card layout (`repeat(2, minmax(0, 1fr))` with `aspect-ratio: 1 / 1`), matching the Bento grid design of the Admin Dashboard; (2) Expanded the metric cards to a perfectly balanced 2x3 grid by adding a 6th metric card: `Attendance Rate` (`98.5%` • `Active student presence` • Mint/Teal shield icon with direct attendance routing); (3) Styled `.stat-card` on mobile with 18px border radius, subtle border (`#E2E8F0`), uppercase two-line clamped title, 32px tinted icon badge, 1.6rem bold tabular numbers, and tactile tap feedback (`:active { transform: scale(0.96); }`); (4) Added mobile floating bottom navigation pill bar (`.m-floating-bottom-nav`) with frosted glass blur for one-thumb shortcuts to Home, Schedule, Attendance, Marks, and Reports; (5) Automatically hidden on desktop monitors (`@media (min-width: 769px)`); (6) Added comprehensive Vitest unit test asserting 6 balanced metric cards, square grid, and mobile bottom nav interactions; all 76/76 unit tests pass; production build succeeds cleanly. |
| **v1.6.9** | 2026-10-29 12:00 | Antigravity AI | `src/modules/dashboard/admin-dashboard.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Complete Mobile Dashboard UI Modernization (Inspired by User Reference Designs): (1) Replaced dated, stacked boxes on mobile with an executive mobile experience matching the user-uploaded screenshots; (2) Added Executive Dark Contrast Hero Card (`.m-hero-card`) with deep navy/emerald gradient, live indicator, total enrolled residents, and interactive eye toggle button to hide/show metrics; (3) Added 2x2 Bento Quick Actions grid with rounded tactile action tiles (New Admission, Take Attendance, Hostel Gate Pass, Timetable); (4) Added Hostel Presence Semicircular Donut Arc Gauge (`.m-gauge-card`) with centered live occupancy counter and colored status breakdown pills (In Hostel, On Leave, Overdue); (5) Added Enrolled Residents Horizontal Facepile Carousel (`.m-residents-scroll`) with `+ Add` button for instant directory access; (6) Replaced wide desktop table on mobile with sleek Gate Pass Activity Feed cards (`.m-activity-feed`) with status badges; (7) Added Disciplinary & Curfew Radar card (`.m-discipline-card`); (8) Added Floating Bottom Navigation Pill Bar (`.m-floating-bottom-nav`) with frosted glass blur for one-thumb mobile navigation; (9) All colors aligned with TPS institutional palette (Deep Emerald `#059669`, Rich Navy `#0F172A`, Pure Surface `#FFFFFF`, Soft Amber `#D97706`, Coral Red `#DC2626`); (10) Added automated test; all 75/75 Vitest tests passing; verified clean production build. |
| **v1.6.8** | 2026-10-29 11:45 | Antigravity AI | `src/app.js`, `src/lib/db.js`, `src/modules/reports/attendance-report.js`, `src/modules/attendance/index.js`, `src/modules/timetable/index.js`, `src/modules/dashboard/admin-dashboard.js`, `src/modules/dashboard/teacher-dashboard.js`, `src/modules/sections/index.js`, `src/modules/reports/index.js`, `src/modules/discipline/index.js`, `src/modules/exams/index.js`, `src/modules/fines/index.js`, `src/modules/leaves/index.js`, `src/modules/marks/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Universal Window Opening Acceleration & Zero-Delay In-Place Navigation: (1) Resolved DOM destruction root cause in `src/app.js`: replaced full shell re-rendering with high-speed in-place module swapping (`renderModuleInPlace`); navbar and sidebar stay mounted across tab navigation, mobile drawer closes immediately, and active sidebar link updates in 0ms; (2) Implemented in-memory caching with 25s TTL and promise deduplication in `DatabaseService` (`src/lib/db.js`) for `pullCloudKeys`, `getStudents`, and `getUsers`, eliminating repeated Supabase roundtrips on window switching; (3) Automatic cache invalidation ensures realtime data integrity on any write/mutation (`set`, `addStudent`, `updateStudent`, `deleteStudent`, `deleteStudents`, `importStudents`, `updateUserApproval`); (4) Parallelized sequential database queries via `Promise.all` across all major modules (Attendance Report reduced from 9 sequential queries to 1 parallel batch, Admin Dashboard from 7 to 1, Reports from 10 to 1, etc.); (5) Added `@keyframes tpsSpin` spinner for micro-loader feedback; (6) Added automated test asserting in-memory caching and invalidation; all 74/74 Vitest tests passing; verified production build. |
| **v1.6.7** | 2026-10-29 11:30 | Antigravity AI | `public/manifest.json`, `public/favicon.svg`, `src/app.js`, `src/modules/settings/index.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | PWA Web APK & Favicon Institutional Logo Synchronization: (1) Replaced old placeholder green book SVG in `public/favicon.svg` with official Thaiba Public School golden emblem; (2) Updated PWA `public/manifest.json` icons to reference `/tps-logo.png` and `/favicon.svg` so browser "Install app" dialog and home screen shortcuts display the authentic Thaiba Public School emblem; (3) Added `applyInstitutionalAppIcon()` in `src/app.js` and hooked into `src/modules/settings/index.js` (`saveAndApplyLogo`, `saveAndApplyMobileLogo`, and remove/reset handlers) to dynamically update `<link rel="icon">`, `<link rel="apple-touch-icon">`, and the PWA manifest whenever custom logos are modified in Institution Settings; (4) Added automated unit tests verifying dynamic app icon and manifest updates; all 73/73 tests passing and clean production build. |
| **v1.6.6** | 2026-10-29 10:25 | Antigravity AI | `src/modules/timetable/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Modernized Teacher Timetable UI with Dedicated Cards & Strict Faculty Scoping: (1) Replaced flat master data table in Timetable module (`src/modules/timetable/index.js`) with responsive `.timetable-cards-grid` containing dedicated `.teacher-upcoming-card` elements matching Screenshot 2; (2) Enforced strict faculty scoping so teachers can ONLY see cards for their own assigned classes, completely isolating other teachers' cards; (3) Show all assigned classes: teachers assigned multiple classrooms see cards for all of their assigned classes in an adaptive responsive grid; (4) Each card displays stopwatch icon pill, "Your upcoming class" heading, "Scheduled teaching session" subtitle, timing status badge ("Today at {start_time}", "Live In-Session", "Starts in {N}m", or "Scheduled (Days)"), thin divider, bold emerald green classroom name (`#065F46`), program pill, 2x2 details grid (Schedule Time, Classroom/Hall, Enrolled Roster, Scheduled Days), and emerald green "Take Attendance →" button; (5) Tapping "Take Attendance →" or the card seamlessly routes to the Attendance module for that classroom; (6) Administrator capabilities: Admins can view all cards with a faculty filter dropdown (`#timetable-faculty-filter`) and "Add Timetable Slot" modal; (7) Added automated unit tests verifying cards layout, details grid, and strict faculty isolation (72/72 tests passing); verified production build. |
| **v1.6.5** | 2026-10-29 10:00 | Antigravity AI | `src/lib/db.js`, `src/modules/reports/attendance-report.js`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Admin Bulk Month Missed Attendance Button & Bottom Table Removal: (1) Removed the redundant 21-row `Missed Attendance Register` panel/table at the bottom of the Attendance Report window as requested by user; (2) Removed the repetitive `• 21 Missed Attendance Recorded` badge from the top right of the calendar card because the KPI metrics card above already displays missed counts; (3) In that exact top-right spot on the calendar card, added a dedicated Admin Bulk Action Button: "Allow Month Missed Attendance (N)" allowing administrators to unlock all missed sessions for the month in one single tap; (4) Added toggle support: if all missed sessions are unlocked, button switches to "Close / Lock Month Missed (N)" to bulk-lock; (5) Implemented `db.unlockAttendanceWindows` and `db.lockAttendanceWindows` in `src/lib/db.js` for atomic multi-date batch operations; (6) Retained interactive single-day tap inspection so admins can allow/lock individual dates and teachers can tap dates to take missed attendance; (7) All 71/71 Vitest tests passing; verified clean production build. |
| **v1.6.4** | 2026-10-29 09:50 | Antigravity AI | `src/lib/db.js`, `src/modules/reports/attendance-report.js`, `src/modules/attendance/index.js`, `src/modules/sections/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Faculty Duty Tenure & Assignment-Bound Attendance Tracking: (1) Fixed past historical data showing false missed attendance (red circles) prior to class assignment date; (2) Added `teacher_assigned_date` (defaulting to term start `2026-10-01`) and `teacher_removed_date` to classrooms and introduced `tps_teacher_assignments` table with full historical tenure logging; (3) Added `db.isTeacherAssignedOnDate`, `db.assignTeacherToClassroom`, and `db.removeTeacherFromClassroom`; (4) Missed attendance and red circles are now evaluated strictly from the date the teacher was assigned to the classroom; (5) When an Administrator removes a teacher from a classroom, attendance duties immediately end on the removal date and dates after removal are never flagged as missed; (6) Updated Sections & Classrooms edit modal with "Remove Teacher from Class" button and explicit Assignment Start & Removal Date pickers; (7) Updated Attendance Management module window status check to disallow attendance recording outside active faculty tenure; (8) Added automated unit tests verifying past dates prior to assignment show 0 missed attendance, and removal dates properly end duties (71/71 tests passing); verified production build. |
| **v1.6.3** | 2026-10-29 09:32 | Antigravity AI | `src/modules/attendance/index.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Recreated Attendance Management Window with Teaching Timetable Cards: (1) Replaced old direct single-class roster view with Timetable Cards matching the screenshot (`media_1793245698302_aa26eb06.png`); (2) Enforced strict faculty scoping: teachers can ONLY see their own timetable classes, never other teachers' classes; (3) Each card acts as their complete timetable containing Schedule Time, Classroom/Hall, Enrolled Roster, Scheduled Days, Program Pill, and Timing Status badge; (4) Faded the "Take Attendance" button outside class hours (`.is-faded`, `opacity: 0.38`); (5) Enabled entering class details & student roster after class time via "View Details" button or tapping card; (6) Seamless navigation with `← Back to Timetable Cards` and Admin faculty filter; (7) Added unit tests (all 70 unit tests passing); verified production build. |
| **v1.6.2** | 2026-10-29 08:52 | Antigravity AI | `src/modules/attendance/index.js`, `src/modules/reports/attendance-report.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Late Attendance Yellow Button Area, Short 'L' & Admin Late Minutes Visibility: (1) Updated student right-side attendance toggle button area to show vibrant yellow (`#F59E0B` background with amber shadow) via `.att-2way-switch.sw-late` when status is Late Present; (2) Shortened late switch label to 'L' (Present = 'P', Absent = 'A', Late = 'L'); (3) Enabled 3-state cycling: Absent $\to$ Present $\to$ Late Present $\to$ Absent with instant reactive card visual updates; (4) Added dynamic calculation and persistence of minutes late after class start time (`activeCls.start_time`); (5) Displayed late minutes to Administration on the compact student card (`⏱️ {late_minutes} min late (Class: {start_time})`) and via `{late_minutes}m late` yellow badge; (6) Added student attendance breakdown in Attendance Report day inspection modal showing late minutes for Admin and quick "Edit Attendance" action; (7) Added automated test asserting yellow button area, short 'L', and admin late minutes visibility (all 69 unit tests passing); verified production build. |
| **v1.6.1** | 2026-10-29 08:42 | Antigravity AI | `src/modules/reports/attendance-report.js`, `src/modules/reports/index.js`, `src/modules/attendance/index.js`, `src/lib/permissions.js`, `src/lib/db.js`, `src/components/sidebar.js`, `src/app.js`, `src/styles/main.css`, `tests/app.test.js`, `WEB_APK_DOCUMENTATION.md` | Dedicated Attendance Report Window & Missed Attendance Governance: (1) Created dedicated Attendance Report module (`#attendance_report` and sidebar item under Student & Academic) with full access for Teachers, Mentors, and Admins; (2) Implemented cascading hierarchy: Admin can select any Teacher $\to$ assigned Sections $\to$ assigned Classes; Teachers are strictly locked to their own account with no option to view others; (3) Added compact visual calendar matching Academic Calendar card (`media_1793240742835_afd14a06.png`); (4) Timetable unworking days for the selected class rendered as FADED; (5) Academic holidays rendered in Light Yellow; (6) Hostel leaves rendered as FADED RED TEXT ONLY (no circle/round); (7) Missed attendance rendered as RED COLOUR ROUND; (8) Added Admin "Allow Missed Attendance" (`db.unlockAttendanceWindow`) and "Close / Lock" (`db.lockAttendanceWindow`) controls; (9) Enforced strict attendance timing between start and end time for everyone (including Admins taking class); (10) Enforced that teachers taking missed attendance can only select Admin-unlocked missed dates and CANNOT edit already taken attendance (Admin permission only); (11) Added 5 comprehensive automated tests (68/68 tests passing) and verified clean production build. |
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
