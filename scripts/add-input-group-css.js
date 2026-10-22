import fs from 'fs';

let css = fs.readFileSync('src/styles/main.css', 'utf8');

const inputGroupCss = `
/* Fixed Prefix Input Groups (TPS ID & +91 Phone) */
.input-group-fixed {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--bg-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-group-fixed:focus-within {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

.input-prefix-addon {
  background: #F1F5F9;
  color: #0F172A;
  font-weight: 800;
  font-size: 0.875rem;
  padding: 0.65rem 0.85rem;
  border-right: 1px solid var(--border-subtle);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.input-group-fixed .form-control {
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  flex: 1;
  padding: 0.65rem 0.85rem;
  background: transparent;
}
`;

if (!css.includes('.input-group-fixed')) {
  css = css.replace('.form-error {', inputGroupCss + '\n.form-error {');
  fs.writeFileSync('src/styles/main.css', css, 'utf8');
  console.log('Added input-group-fixed styles to src/styles/main.css');
} else {
  console.log('input-group-fixed already present in src/styles/main.css');
}
