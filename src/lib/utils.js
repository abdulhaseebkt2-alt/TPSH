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

export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === '\t' || ch === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function normalizeDate(dateStr, fallbackDate = '2012-05-15') {
  if (!dateStr || typeof dateStr !== 'string') return fallbackDate;
  const clean = dateStr.trim();
  if (!clean) return fallbackDate;

  // 1. If YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    const parts = clean.split('-');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // 2. If YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(clean)) {
    const parts = clean.split('/');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // 3. If DD/MM/YYYY or DD-MM-YYYY (Common in Indian school registers)
  const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 4. Try parsing with parseDate
  const parsed = parseDate(clean);
  if (parsed && !isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return fallbackDate;
}

export function normalizeGender(genderStr) {
  if (!genderStr || typeof genderStr !== 'string') return 'Boys';
  const g = genderStr.trim().toLowerCase();
  if (g.startsWith('f') || g.includes('girl') || g.includes('female') || g.includes('woman')) {
    return 'Girls';
  }
  return 'Boys';
}

export function normalizeStatus(statusStr) {
  if (!statusStr || typeof statusStr !== 'string') return 'Active';
  const s = statusStr.trim().toLowerCase();
  if (s.includes('leave')) return 'On Approved Leave';
  if (s.includes('break')) return 'Temporary Break';
  if (s.includes('drop') || s.includes('inact')) return 'Inactive';
  return 'Active';
}

export function normalizeHostelStatus(statusStr) {
  if (!statusStr || typeof statusStr !== 'string') return 'hostel';
  const s = statusStr.trim().toLowerCase();
  if (s.includes('day') || s.includes('scholar')) return 'day_scholar';
  if (s.includes('break')) return 'temporary_break';
  return 'hostel';
}

export function parseStudentsCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const headerMap = {};

  rawHeaders.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.includes('admission') || clean.includes('admno') || clean.includes('regno') || clean === 'id' || clean === 'admid' || clean === 'admnumber') {
      headerMap['admission_number'] = idx;
    } else if (clean.includes('fullname') || clean.includes('studentname') || clean === 'name' || clean === 'student') {
      headerMap['full_name'] = idx;
    } else if (clean.includes('gender') || clean === 'sex') {
      headerMap['gender'] = idx;
    } else if (clean.includes('dob') || clean.includes('birth')) {
      headerMap['dob'] = idx;
    } else if (clean.includes('class') || clean.includes('std') || clean.includes('grade') || clean === 'standard') {
      headerMap['school_class'] = idx;
    } else if (clean.includes('sec') || clean.includes('division')) {
      headerMap['school_section'] = idx;
    } else if (clean.includes('hostel') || clean.includes('campus') || clean.includes('block') || clean.includes('unit')) {
      headerMap['hostel_unit'] = idx;
    } else if (clean.includes('room')) {
      headerMap['hostel_room'] = idx;
    } else if (clean.includes('bed')) {
      headerMap['hostel_bed'] = idx;
    } else if (clean.includes('father') || clean.includes('parent') || clean.includes('guardian')) {
      if (clean.includes('phone') || clean.includes('mob') || clean.includes('num') || clean.includes('contact')) {
        headerMap['father_phone'] = idx;
      } else {
        headerMap['father_name'] = idx;
      }
    } else if (clean.includes('phone') || clean.includes('mobile') || clean.includes('contact') || clean.includes('whatsapp')) {
      if (!('father_phone' in headerMap)) {
        headerMap['father_phone'] = idx;
      }
    } else if (clean.includes('mother')) {
      if (clean.includes('phone') || clean.includes('mob') || clean.includes('num')) {
        headerMap['mother_phone'] = idx;
      } else {
        headerMap['mother_name'] = idx;
      }
    } else if (clean.includes('village') || clean.includes('place') || clean.includes('town') || clean.includes('city') || clean.includes('address')) {
      headerMap['village'] = idx;
    } else if (clean.includes('category') || clean === 'cat') {
      headerMap['category'] = idx;
    } else if (clean.includes('status')) {
      headerMap['status'] = idx;
    }
  });

  const hasMappedHeaders = Object.keys(headerMap).length >= 2;
  const startIndex = hasMappedHeaders ? 1 : 0;
  const parsedStudents = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

    let studentObj = {};

    if (hasMappedHeaders) {
      studentObj = {
        admission_number: headerMap.admission_number !== undefined ? cols[headerMap.admission_number] : '',
        full_name: headerMap.full_name !== undefined ? cols[headerMap.full_name] : '',
        gender: headerMap.gender !== undefined ? cols[headerMap.gender] : '',
        dob: headerMap.dob !== undefined ? cols[headerMap.dob] : '',
        school_class: headerMap.school_class !== undefined ? cols[headerMap.school_class] : '',
        school_section: headerMap.school_section !== undefined ? cols[headerMap.school_section] : 'A',
        category: headerMap.category !== undefined ? cols[headerMap.category] : 'General',
        hostel_unit: headerMap.hostel_unit !== undefined ? cols[headerMap.hostel_unit] : '',
        hostel_room: headerMap.hostel_room !== undefined ? cols[headerMap.hostel_room] : '',
        hostel_bed: headerMap.hostel_bed !== undefined ? cols[headerMap.hostel_bed] : '',
        father_name: headerMap.father_name !== undefined ? cols[headerMap.father_name] : '',
        father_phone: headerMap.father_phone !== undefined ? cols[headerMap.father_phone] : '',
        mother_name: headerMap.mother_name !== undefined ? cols[headerMap.mother_name] : '',
        mother_phone: headerMap.mother_phone !== undefined ? cols[headerMap.mother_phone] : '',
        village: headerMap.village !== undefined ? cols[headerMap.village] : '',
        status: headerMap.status !== undefined ? cols[headerMap.status] : 'Active'
      };
    } else {
      studentObj = {
        admission_number: cols[0] || '',
        full_name: cols[1] || '',
        gender: cols[2] || '',
        dob: cols[3] || '',
        school_class: cols[4] || '',
        category: cols[5] || 'General',
        hostel_unit: cols[6] || '',
        hostel_room: cols[7] || '',
        hostel_bed: cols[8] || '',
        father_name: cols[9] || '',
        father_phone: cols[10] || '',
        status: cols[11] || 'Active'
      };
    }

    if (studentObj.full_name || studentObj.admission_number) {
      if (!studentObj.admission_number || /^\d{1,2}$/.test(String(studentObj.admission_number).trim())) {
        studentObj.admission_number = `TPS-2026-${String(parsedStudents.length + 1).padStart(3, '0')}`;
      }
      parsedStudents.push(studentObj);
    }
  }

  return parsedStudents;
}
