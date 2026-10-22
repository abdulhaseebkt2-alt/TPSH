import fs from 'fs';

let css = fs.readFileSync('src/styles/main.css', 'utf8');

// Replace .menu-toggle-btn definition
const oldBtn = `.menu-toggle-btn {
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition-fast);
}`;

const newBtn = `.menu-toggle-btn {
  display: none; /* Hidden on desktop - sidebar is permanently visible */
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition-fast);
}`;

if (css.includes('.menu-toggle-btn {')) {
  css = css.replace(
    /\.menu-toggle-btn\s*\{[\s\S]*?color:\s*var\(--text-secondary\);\s*transition:\s*background var\(--transition-fast\);\s*\}/,
    newBtn
  );
}

// Add display: flex to @media (max-width: 1023px)
if (css.includes('.sidebar.mobile-open {')) {
  css = css.replace(
    '.sidebar.mobile-open {',
    '.menu-toggle-btn {\n    display: flex;\n  }\n  .sidebar.mobile-open {'
  );
}

fs.writeFileSync('src/styles/main.css', css, 'utf8');
console.log('Successfully updated .menu-toggle-btn visibility in src/styles/main.css');
