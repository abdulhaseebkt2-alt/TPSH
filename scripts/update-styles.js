import fs from 'fs';

let css = fs.readFileSync('src/styles/main.css', 'utf8');

// 1. Add .navbar-portal-badge styles before .institution-brand
const portalBadgeCss = `
.navbar-portal-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.portal-badge-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.portal-badge-tagline {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 600;
}

@media (max-width: 640px) {
  .portal-badge-tagline {
    display: none;
  }
}
`;

if (!css.includes('.navbar-portal-badge')) {
  css = css.replace('.institution-brand {', portalBadgeCss + '\n.institution-brand {');
}

// 2. Update .sidebar to overflow: hidden
css = css.replace(
  /\.sidebar\s*\{[\s\S]*?border-right:\s*1px solid #1E293B;\s*\}/,
  `.sidebar {
  width: var(--sidebar-width);
  background-color: var(--brand-navy);
  color: #94A3B8;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  transition: transform var(--transition-normal), width var(--transition-normal);
  overflow: hidden; /* Header & footer are frozen, nav scrolls */
  border-right: 1px solid #1E293B;
}`
);

// 3. Update .sidebar-header and add sidebar institution-brand rules
const sidebarHeaderReplacement = `.sidebar-header {
  height: var(--navbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-bottom: 1px solid #1E293B;
  background-color: var(--brand-navy);
  flex-shrink: 0; /* Frozen at top of sidebar */
  position: sticky;
  top: 0;
  z-index: 10;
}

.sidebar .institution-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.sidebar .institution-logo {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: #0B132B;
  color: #10B981;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(16, 185, 129, 0.25);
  flex-shrink: 0;
}

.sidebar .institution-titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sidebar .institution-titles h1 {
  font-size: 0.95rem;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar .institution-titles p {
  font-size: 0.65rem;
  color: #10B981;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 2px;
  white-space: nowrap;
}`;

css = css.replace(
  /\.sidebar-header\s*\{[\s\S]*?border-bottom:\s*1px solid #1E293B;\s*\}/,
  sidebarHeaderReplacement
);

// 4. Update .sidebar-nav to overflow-y: auto
css = css.replace(
  /\.sidebar-nav\s*\{[\s\S]*?flex:\s*1;\s*\}/,
  `.sidebar-nav {
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  overflow-y: auto; /* Nav body scrolls */
}`
);

// 5. Update .sidebar-footer to flex-shrink: 0
css = css.replace(
  /\.sidebar-footer\s*\{[\s\S]*?justify-content:\s*space-between;\s*\}/,
  `.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid #1E293B;
  background-color: var(--brand-navy);
  flex-shrink: 0; /* Frozen at bottom */
  display: flex;
  align-items: center;
  justify-content: space-between;
}`
);

fs.writeFileSync('src/styles/main.css', css, 'utf8');
console.log('Successfully updated src/styles/main.css');
