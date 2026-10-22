# TPS HOSTEL IRP — DESIGN SYSTEM MASTER (UI/UX PRO MAX)
Institution: Thaiba Public School
Tagline: Modern Education with Morality

## 1. Design Philosophy & Style
- **Pattern**: Institutional SaaS Management System (Education / Hostel ERP)
- **Style Archetype**: Minimal Modern Institutional Dashboard (Light-Theme-First)
- **Visual Weight**: Crisp, high-contrast, data-dense yet breathable with clear hierarchy
- **Tone**: Authoritative, ethical, calm, highly trustworthy

## 2. Color Palette (Sophisticated Light Theme)
- **Background Base**: `#F8FAFC` (Slate 50 - Soft neutral background)
- **Surface / Card Base**: `#FFFFFF` (Pure white cards and panels)
- **Surface Elevated**: `#FFFFFF` with subtle border `#E2E8F0` and shadow `0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)`
- **Sidebar & Header Dark / Primary Accents**: `#0F172A` (Slate 900) and `#1E293B` (Slate 800)
- **Brand Primary Accent (Restrained Emerald / Teal)**:
  - Primary: `#059669` (Emerald 600)
  - Primary Hover: `#047857` (Emerald 700)
  - Primary Light: `#ECFDF5` (Emerald 50)
  - Primary Border: `#A7F3D0` (Emerald 200)
- **Secondary / Supporting Accents**:
  - Deep Navy (Institutional): `#1E3A8A` / `#1E40AF`
  - Slate Accent: `#475569`
- **Text Color Hierarchy**:
  - Primary Text: `#0F172A` (Slate 900, AA/AAA contrast)
  - Secondary Text: `#475569` (Slate 600)
  - Muted / Caption Text: `#64748B` (Slate 500)
  - Disabled / Placeholder: `#94A3B8` (Slate 400)
- **Status & Semantic Palette**:
  - **Present / Approved / Published**: Green/Emerald (`#059669` text, `#ECFDF5` bg, `#A7F3D0` border)
  - **Absent / Overdue / Rejected / Black Mark**: Red/Rose (`#DC2626` text, `#FEF2F2` bg, `#FECACA` border)
  - **Late / Warning**: Amber (`#D97706` text, `#FFFBEB` bg, `#FDE68A` border)
  - **On Leave / Excused**: Indigo/Blue (`#2563EB` text, `#EFF6FF` bg, `#BFDBFE` border)
  - **Pending / In Progress**: Purple/Violet (`#7C3AED` text, `#F5F3FF` bg, `#DDD6FE` border)
  - **Temporary Break**: Sky/Cyan (`#0284C7` text, `#F0F9FF` bg, `#BAE6FD` border)

## 3. Typography
- **Primary Body & Headings**: `Plus Jakarta Sans`, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Data / Numbers / Codes (Admission No, Reg No, Currency)**: `Plus Jakarta Sans` / `JetBrains Mono` for tabular figures (`font-variant-numeric: tabular-nums`)
- **Scale**:
  - Display / Hero: 28px / 32px (font-bold)
  - Page Title: 22px / 26px (font-bold)
  - Section Title: 18px / 22px (font-semibold)
  - Card Header / Subsection: 15px / 20px (font-semibold)
  - Body Base: 14px / 20px (font-normal)
  - Small / Badge: 12px / 16px (font-medium)
  - Micro / Caption: 11px / 14px (font-medium)

## 4. Layout & Responsive Breakpoints
- **Small Mobile**: 320px – 375px (Compact stacked cards, bottom navigation or drawer, 100% width modals)
- **Standard Mobile**: 390px – 430px (Optimized touch targets >= 44px, sticky header, quick action floating pill)
- **Tablet**: 768px (Collapsible navigation bar, dual column stat grids, scrollable wide tables with pinned columns)
- **Laptop**: 1366px (Sidebar collapsed by default or fixed 260px, multi-column dashboard grid)
- **Desktop**: 1920px (Max content container 1600px with centered fluid flow, high-density data grid)

## 5. UI Components & Micro-Interactions
- **Buttons**:
  - Height: 40px (Desktop), 44px (Mobile touch target)
  - Rounded: 8px (`rounded-lg`)
  - States: Default, Hover, Active, Focus-Visible (2px emerald ring with 2px offset), Disabled
- **Forms & Inputs**:
  - Border: 1px solid `#CBD5E1`, Focus: 2px solid `#059669` with emerald glow
  - Clear labels, helper texts, and inline validation error messages
- **Tables**:
  - Sticky table headers with subtle slate background
  - Alternating hover row highlights (`hover:bg-slate-50`)
  - Responsive switch to Card View on mobile screens (< 768px)
- **Feedback & Notifications**:
  - Non-blocking Toast notification system (top-right on desktop, top-center on mobile)
  - Clear confirmation dialogs for destructive actions (Delete, Reject, Fine Waiver)
  - Full skeleton loaders for asynchronous fetching states
- **Print Optimization**:
  - Dedicated `@media print` CSS for Student Leave Cards, Late Fine Slips, Report Cards, and Monthly Registers
  - Complete elimination of navigation, sidebar, action buttons, and background colors when printing A4 documents.
