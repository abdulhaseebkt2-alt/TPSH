// Institutional & Mobile Logo Utilities

export function getSavedLogo(key = 'tps_institution_logo') {
  if (typeof localStorage === 'undefined') return '';
  let raw = localStorage.getItem(key);
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  if (typeof raw === 'string') {
    raw = raw.trim();
    while ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') {
          raw = parsed.trim();
        } else {
          break;
        }
      } catch (e) {
        raw = raw.slice(1, -1).trim();
      }
    }
  }
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  return raw;
}

export function sanitizeLogoValue(val) {
  if (!val || val === 'null' || val === 'undefined') return null;
  if (typeof val === 'string') {
    let raw = val.trim();
    while ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') {
          raw = parsed.trim();
        } else {
          break;
        }
      } catch (e) {
        raw = raw.slice(1, -1).trim();
      }
    }
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    return raw;
  }
  return val;
}
