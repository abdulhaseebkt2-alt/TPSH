// TPS Hostel ERP - Granular Role & Permission Access Matrix
// Tri-State Module Access System:
// - LEFT ('off'): Window is OFF. Role cannot see or access it (hidden from sidebar).
// - MIDDLE ('view'): Explore & View Only. Role can see and explore records, but CANNOT edit or apply.
// - RIGHT ('full'): Full Access. Role can view, create, edit, delete, and apply.

export const MODULE_DEFINITIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'users', label: 'User & Permissions', icon: 'shield-check', roles: ['super_admin'] },
  { key: 'admissions', label: 'Student Admissions', icon: 'user-plus', roles: ['super_admin', 'admin'] },
  { key: 'students', label: 'Student Directory', icon: 'users', roles: ['super_admin', 'admin', 'mentor', 'parent', 'hostel_leader'] },
  { key: 'sections', label: 'Sections & Classrooms', icon: 'folder-tree', roles: ['super_admin', 'admin'] },
  { key: 'assignments', label: 'Student Assignments', icon: 'user-check', roles: ['super_admin', 'admin'] },
  { key: 'timetable', label: 'Teacher Timetable', icon: 'calendar-clock', roles: ['super_admin', 'admin', 'teacher'] },
  { key: 'calendar', label: 'Academic Calendar', icon: 'calendar', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'attendance', label: 'Attendance Management', icon: 'check-square', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'attendance_report', label: 'Attendance Report', icon: 'clipboard-check', roles: ['super_admin', 'admin', 'mentor', 'teacher'] },
  { key: 'faculty_leaves', label: 'Faculty Leaves', icon: 'calendar-check', roles: ['super_admin', 'admin', 'mentor', 'teacher'] },
  { key: 'leaves', label: 'Hostel Leave Register', icon: 'plane-takeoff', roles: ['super_admin', 'admin', 'mentor', 'parent', 'student', 'hostel_leader'] },
  { key: 'fines', label: 'Late Fine Management', icon: 'receipt', roles: ['super_admin', 'admin', 'mentor', 'parent', 'hostel_leader'] },
  { key: 'discipline', label: 'Discipline & Black Marks', icon: 'alert-triangle', roles: ['super_admin', 'admin', 'mentor', 'parent', 'hostel_leader'] },
  { key: 'exams', label: 'Exam Management', icon: 'file-text', roles: ['super_admin', 'admin', 'teacher', 'student'] },
  { key: 'marks', label: 'Marks & Results', icon: 'award', roles: ['super_admin', 'admin', 'teacher', 'parent', 'student'] },
  { key: 'hostel', label: 'Hostel Rooms & Beds', icon: 'bed', roles: ['super_admin', 'admin', 'mentor', 'hostel_leader'] },
  { key: 'fees', label: 'Fees & Payments', icon: 'credit-card', roles: ['super_admin', 'admin', 'parent'] },
  { key: 'notices', label: 'Notices & WhatsApp', icon: 'bell', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'maintenance', label: 'Hostel Maintenance', icon: 'wrench', roles: ['super_admin', 'admin', 'mentor', 'hostel_leader'] },
  { key: 'reports', label: 'Reports Center', icon: 'bar-chart-3', roles: ['super_admin', 'admin', 'mentor', 'teacher'] },
  { key: 'audit', label: 'Audit Logs', icon: 'history', roles: ['super_admin'] },
  { key: 'settings', label: 'Institution Settings', icon: 'settings', roles: ['super_admin'] }
];

// Institutional Default RBAC Matrix:
// Maps each role to tri-state permissions: 'off' | 'view' | 'full'
export const DEFAULT_RBAC_MATRIX = {
  admin: {
    dashboard: 'full',
    admissions: 'full',
    students: 'full',
    sections: 'full',
    assignments: 'full',
    timetable: 'full',
    calendar: 'full',
    attendance: 'full',
    attendance_report: 'full',
    faculty_leaves: 'full',
    leaves: 'full',
    fines: 'full',
    discipline: 'full',
    exams: 'full',
    marks: 'full',
    hostel: 'full',
    fees: 'full',
    notices: 'full',
    maintenance: 'full',
    reports: 'full',
    settings: 'full'
  },
  mentor: {
    dashboard: 'full',
    students: 'view',
    calendar: 'view',
    attendance: 'full',
    attendance_report: 'view',
    faculty_leaves: 'view',
    leaves: 'full',
    fines: 'view',
    discipline: 'full',
    hostel: 'full',
    notices: 'full',
    maintenance: 'full',
    reports: 'view'
  },
  teacher: {
    dashboard: 'full',
    students: 'view',
    timetable: 'view',
    calendar: 'view',
    attendance: 'full',
    attendance_report: 'full',
    faculty_leaves: 'full',
    reports: 'view',
    exams: 'view',
    marks: 'full',
    notices: 'view'
  },
  hostel_leader: {
    dashboard: 'full',
    students: 'view',
    calendar: 'view',
    attendance: 'full',
    leaves: 'view',
    fines: 'view',
    discipline: 'view',
    hostel: 'view',
    notices: 'view',
    maintenance: 'full'
  },
  parent: {
    dashboard: 'full',
    students: 'view',
    calendar: 'view',
    attendance: 'view',
    leaves: 'view',
    fines: 'view',
    discipline: 'view',
    marks: 'view',
    fees: 'view',
    notices: 'view'
  },
  student: {
    dashboard: 'full',
    calendar: 'view',
    attendance: 'view',
    leaves: 'view',
    exams: 'view',
    marks: 'view',
    notices: 'view'
  }
};

const RBAC_STORAGE_KEY = 'tps_rbac_matrix';
const USER_CUSTOM_PERM_KEY = 'tps_user_custom_modules';
let memoryMatrix = null;
let memoryUserCustom = null;

export function getAllUserCustomPermissions() {
  if (memoryUserCustom) {
    return JSON.parse(JSON.stringify(memoryUserCustom));
  }
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USER_CUSTOM_PERM_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    memoryUserCustom = parsed;
    return parsed;
  } catch {
    return {};
  }
}

export function getUserCustomPermissions(userId) {
  if (!userId) return null;
  const all = getAllUserCustomPermissions();
  return all[userId] || null;
}

export function saveUserCustomPermissions(userId, customModules) {
  if (!userId) return false;
  const all = getAllUserCustomPermissions();
  if (customModules && typeof customModules === 'object' && Object.keys(customModules).length > 0) {
    all[userId] = customModules;
  } else {
    delete all[userId];
  }
  memoryUserCustom = JSON.parse(JSON.stringify(all));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(USER_CUSTOM_PERM_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Error saving user custom permissions:', e);
      return false;
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tps:permissions-updated'));
  }
  return true;
}

export function clearUserCustomPermissions(userId) {
  return saveUserCustomPermissions(userId, null);
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_RBAC_MATRIX));
}

// Normalize legacy array-based matrix or partial objects into tri-state object
export function normalizeRBACMatrix(raw) {
  if (!raw || typeof raw !== 'object') return cloneDefaults();
  const normalized = cloneDefaults();

  for (const role of Object.keys(raw)) {
    const roleVal = raw[role];
    if (Array.isArray(roleVal)) {
      normalized[role] = {};
      for (const k of roleVal) {
        normalized[role][k] = 'full';
      }
      // Ensure dashboard is always common
      normalized[role].dashboard = 'full';
    } else if (roleVal && typeof roleVal === 'object') {
      normalized[role] = { ...(normalized[role] || {}), ...roleVal };
      normalized[role].dashboard = 'full';
    }
  }

  return normalized;
}

export function getRBACMatrix() {
  if (memoryMatrix) {
    return JSON.parse(JSON.stringify(memoryMatrix));
  }
  const defaults = cloneDefaults();
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(RBAC_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return normalizeRBACMatrix(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading RBAC matrix from localStorage:', e);
    }
  }
  return defaults;
}

export function saveRBACMatrix(matrix) {
  const normalized = normalizeRBACMatrix(matrix);
  memoryMatrix = JSON.parse(JSON.stringify(normalized));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RBAC_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.error('Error saving RBAC matrix to localStorage:', e);
      return false;
    }
  }
  return true;
}

export function resetRBACMatrix() {
  memoryMatrix = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(RBAC_STORAGE_KEY);
    } catch (e) {}
  }
  return cloneDefaults();
}

/**
 * Returns the exact access level for a role/profile on a given module:
 * 'off': Cannot see or access (left switch position)
 * 'view': Explore & View-only (middle switch position)
 * 'full': Full access to view, edit, create, apply (right switch position)
 */
export function getModuleAccessLevel(profile, moduleKey) {
  if (!profile) return 'off';
  if (profile.approval_status !== 'approved') return 'off';

  // Super Admin always has full unrestricted access to everything
  if (profile.is_super_admin || profile.role === 'super_admin') return 'full';

  // Dashboard is common to all approved roles
  if (moduleKey === 'dashboard') return 'full';

  // Core administrative security modules reserved for Super Admin
  if (['users', 'audit'].includes(moduleKey)) return 'off';

  // Custom user-level assigned modules override (if present on profile or in user custom storage)
  let userCustom = profile.custom_modules;
  if (!userCustom && profile.id) {
    userCustom = getUserCustomPermissions(profile.id);
  }

  if (userCustom) {
    if (Array.isArray(userCustom)) {
      return userCustom.includes(moduleKey) ? 'full' : 'off';
    }
    if (typeof userCustom === 'object') {
      const val = userCustom[moduleKey];
      if (val === 'view' || val === 'full') return val;
      if (val === 'off' || val === 'none') return 'off';
    }
  }

  // Dynamic RBAC Matrix lookup
  const matrix = getRBACMatrix();
  const roleRules = matrix[profile.role];

  if (roleRules) {
    if (Array.isArray(roleRules)) {
      return roleRules.includes(moduleKey) ? 'full' : 'off';
    }
    if (typeof roleRules === 'object') {
      const level = roleRules[moduleKey];
      if (level === 'view' || level === 'full') return level;
      if (level === 'off' || level === 'none') return 'off';
    }
  }

  // Fallback to MODULE_DEFINITIONS
  const moduleDef = MODULE_DEFINITIONS.find(m => m.key === moduleKey);
  if (!moduleDef) return 'off';

  return moduleDef.roles.includes(profile.role) ? 'view' : 'off';
}

export function isViewOnlyModule(profile, moduleKey) {
  return getModuleAccessLevel(profile, moduleKey) === 'view';
}

export function canAccessModule(profile, moduleKey) {
  if (!profile) return false;
  if (profile.approval_status !== 'approved') return false;
  if (profile.is_super_admin || profile.role === 'super_admin') return true;
  if (moduleKey === 'dashboard') return true; // Common to all categories
  if (['users', 'audit'].includes(moduleKey)) return false;

  const level = getModuleAccessLevel(profile, moduleKey);
  return level === 'view' || level === 'full';
}

export function getVisibleModules(profile) {
  if (!profile || profile.approval_status !== 'approved') return [];
  return MODULE_DEFINITIONS.filter(m => canAccessModule(profile, m.key));
}

export function canPerformAction(profile, moduleKey, action) {
  if (!profile || profile.approval_status !== 'approved') return false;
  if (profile.is_super_admin || profile.role === 'super_admin') return true;

  // Root modules strictly reserved for Super Admin
  if (['users', 'audit'].includes(moduleKey)) {
    return false;
  }

  // Dangerous security actions strictly forbidden for non-super-admins
  if (['override', 'delete_user', 'change_super_admin'].includes(action)) {
    return false;
  }

  const level = getModuleAccessLevel(profile, moduleKey);

  // Left switch position (OFF): cannot see, explore, edit, or apply
  if (level === 'off') {
    return false;
  }

  // View action: both View (middle) and Full (right) can view & explore
  if (action === 'view') {
    return true;
  }

  // Middle switch position (VIEW ONLY):
  // User can only see or explore, but CANNOT edit, create, delete, or apply!
  if (level === 'view') {
    return false;
  }

  // Right switch position (FULL ACCESS):
  // Full access: authorized to create, edit, apply, record returns, delete
  if (level === 'full') {
    return true;
  }

  return false;
}
