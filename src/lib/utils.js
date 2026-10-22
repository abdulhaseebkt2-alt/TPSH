import * as XLSX from 'xlsx';

export const TIMEZONE = 'Asia/Kolkata';

export const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  const str = String(dateInput).trim();
  
  // DD.MMM.YYYY format (e.g. 22.Oct.2026 or 22.OCT.2026)
  const dotParts = str.split('.');
  if (dotParts.length === 3) {
    const day = parseInt(dotParts[0], 10);
    const mStr = dotParts[1].toLowerCase();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let month = months.indexOf(mStr);
    if (month === -1 && !isNaN(parseInt(dotParts[1], 10))) {
      month = parseInt(dotParts[1], 10) - 1;
    }
    const year = parseInt(dotParts[2], 10);
    if (!isNaN(day) && month >= 0 && month <= 11 && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  // YYYY-MM-DD format
  const dashParts = str.split('T')[0].split('-');
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10) - 1;
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = parseDate(dateString);
    if (!d || isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = SHORT_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateString;
  }
}

export function formatTime(timeString) {
  if (!timeString) return '—';
  try {
    // If it's a simple HH:MM string
    if (typeof timeString === 'string' && timeString.length <= 8 && timeString.includes(':')) {
      const [h, m] = timeString.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${String(formattedHour).padStart(2, '0')}:${m} ${ampm}`;
    }
    const d = new Date(timeString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return timeString;
  }
}

export function formatDateTime(dateTimeString) {
  if (!dateTimeString) return '—';
  return `${formatDate(dateTimeString)} at ${formatTime(dateTimeString)}`;
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(num);
}

export function calculateLateDays(expectedDateStr, actualDateStr) {
  if (!expectedDateStr || !actualDateStr) return 0;
  const expDate = parseDate(expectedDateStr);
  const actDate = parseDate(actualDateStr);
  if (!expDate || !actDate) return 0;

  const expectedUtc = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
  const actualUtc = Date.UTC(actDate.getFullYear(), actDate.getMonth(), actDate.getDate());
  
  const diffDays = Math.floor((actualUtc - expectedUtc) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function calculateLateFine(lateDays, dailyRate = 200) {
  return Math.max(0, lateDays) * Number(dailyRate);
}

export function exportToCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString('en-IN') : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(filename, rows, sheetName = 'Report') {
  if (!rows || !rows.length) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function printDocument(elementId, title) {
  const printContent = document.getElementById(elementId);
  if (!printContent) return;
  
  const originalTitle = document.title;
  if (title) document.title = title;
  
  window.print();
  
  if (title) document.title = originalTitle;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const STANDARD_CLASSES = [
  'STD-I',
  'STD-II',
  'STD-III',
  'STD-IV',
  'STD-V',
  'STD-VI',
  'STD-VII',
  'STD-VIII',
  'STD-IX',
  'STD-X',
  'STD-XI',
  'STD-XII'
];

const ROMAN_TO_NUM = {
  'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
  'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
  'XI': 11, 'XII': 12
};

const NUM_TO_ROMAN = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII'
};

export function normalizeClassPattern(cls) {
  if (!cls) return 'STD-I';
  let s = String(cls).trim().toUpperCase();

  if (STANDARD_CLASSES.includes(s)) return s;

  s = s.replace(/^STD\s*[-_.]?\s*/i, 'STD-');
  s = s.replace(/^CLASS\s*[-_.]?\s*/i, 'CLASS-');
  s = s.replace(/^GRADE\s*[-_.]?\s*/i, 'GRADE-');

  const stdRomanMatch = s.match(/^STD-([IVXLCDM]+)$/i);
  if (stdRomanMatch && ROMAN_TO_NUM[stdRomanMatch[1]]) {
    return `STD-${stdRomanMatch[1]}`;
  }

  const numMatch = s.match(/^(?:STD-|CLASS-|GRADE-|\s*)(\d+)(.*)$/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const suffix = numMatch[2] ? numMatch[2].trim() : '';
    if (NUM_TO_ROMAN[num]) {
      const roman = NUM_TO_ROMAN[num];
      return suffix ? `STD-${roman} ${suffix.replace(/^[-_]\s*/, '')}`.trim() : `STD-${roman}`;
    }
  }

  const romanMatch = s.match(/^(?:CLASS-|GRADE-|\s*)([IVXLCDM]+)(.*)$/i);
  if (romanMatch && ROMAN_TO_NUM[romanMatch[1]]) {
    const roman = romanMatch[1];
    const suffix = romanMatch[2] ? romanMatch[2].trim() : '';
    return suffix ? `STD-${roman} ${suffix.replace(/^[-_]\s*/, '')}`.trim() : `STD-${roman}`;
  }

  return s;
}

/**
 * Client-side passport photo compression:
 * Resizes any image (even 10MB phone camera shots) to a compact passport photo
 * (max 280x320px) at JPEG quality 0.75 (~10KB - 20KB).
 */
export function compressImage(fileOrDataUrl, maxWidth = 280, maxHeight = 320, quality = 0.75) {
  return new Promise((resolve) => {
    if (!fileOrDataUrl) return resolve('');

    // If running in non-browser environment (e.g. tests)
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      if (typeof fileOrDataUrl === 'string') return resolve(fileOrDataUrl);
      return resolve('');
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const process = () => {
      try {
        let width = img.naturalWidth || img.width || 280;
        let height = img.naturalHeight || img.height || 320;

        // Maintain aspect ratio
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        const canvasWidth = Math.max(1, Math.round(width * ratio));
        const canvasHeight = Math.max(1, Math.round(height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        }

        // Fill white background for transparent PNG/WebP
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('Canvas compression error:', err);
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
      }
    };

    img.onload = process;
    img.onerror = () => {
      resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
    };

    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl);
    } else if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      resolve('');
    }
  });
}
