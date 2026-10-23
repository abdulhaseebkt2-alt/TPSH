// TPS Hostel ERP - Granular Role & Permission Access Matrix

export const MODULE_DEFINITIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'users', label: 'User & Permissions', icon: 'shield-check', roles: ['super_admin'] },
  { key: 'admissions', label: 'Student Admissions', icon: 'user-plus', roles: ['super_admin', 'admin'] },
  { key: 'students', label: 'Student Directory', icon: 'users', roles: ['super_admin', 'admin', 'mentor', 'parent', 'hostel_leader'] },
  { key: 'sections', label: 'Sections & Classrooms', icon: 'folder-tree', roles: ['super_admin', 'admin'] },
  { key: 'assignments', label: 'Student Assignments', icon: 'user-check', roles: ['super_admin', 'admin'] },
  { key: 'timetable', label: 'Teacher Timetable', icon: 'calendar-clock', roles: ['super_admin', 'admin', 'teacher'] },
  { key: 'attendance', label: 'Attendance Management', icon: 'check-square', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'leaves', label: 'Hostel Leave Register', icon: 'plane-takeoff', roles: ['super_admin', 'admin', 'mentor', 'parent', 'student', 'hostel_leader'] },
  { key: 'fines', label: 'Late Fine Management', icon: 'receipt', roles: ['super_admin', 'admin', 'mentor', 'parent', 'hostel_leader'] },
  { key: 'discipline', label: 'Discipline & Black Marks', icon: 'alert-triangle', roles: ['super_admin', 'admin', 'mentor', 'parent', 'hostel_leader'] },
  { key: 'exams', label: 'Exam Management', icon: 'file-text', roles: ['super_admin', 'admin', 'teacher', 'student'] },
  { key: 'marks', label: 'Marks & Results', icon: 'award', roles: ['super_admin', 'admin', 'teacher', 'parent', 'student'] },
  { key: 'hostel', label: 'Hostel Rooms & Beds', icon: 'bed', roles: ['super_admin', 'admin', 'mentor', 'hostel_leader'] },
  { key: 'fees', label: 'Fees & Payments', icon: 'credit-card', roles: ['super_admin', 'admin', 'parent'] },
  { key: 'notices', label: 'Notices & WhatsApp', icon: 'bell', roles: ['super_admin', 'admin', 'mentor', 'teacher', 'parent', 'student', 'hostel_leader'] },
  { key: 'maintenance', label: 'Hostel Maintenance', icon: 'wrench', roles: ['super_admin', 'admin', 'mentor', 'hostel_leader'] },
  { key: 'reports', label: 'Reports Center', icon: 'bar-chart-3', roles: ['super_admin', 'admin', 'mentor'] },
  { key: 'audit', label: 'Audit Logs', icon: 'history', roles: ['super_admin'] },
  { key: 'settings', label: 'Institution Settings', icon: 'settings', roles: ['super_admin'] }
];

// Institutional Default RBAC Matrix: maps each role tier to authorized module keys
export const DEFAULT_RBAC_MATRIX = {
  admin: [
    'dashboard', 'admissions', 'students', 'sections', 'assignments',
    'timetable', 'attendance', 'leaves', 'fines', 'discipline',
    'exams', 'marks', 'hostel', 'fees', 'notices', 'maintenance', 'reports'
  ],
  mentor: [
    'dashboard', 'students', 'attendance', 'leaves', 'fines',
    'discipline', 'hostel', 'notices', 'maintenance', 'reports'
  ],
  teacher: [
    'dashboard', 'timetable', 'attendance', 'exams', 'marks', 'notices'
  ],
  hostel_leader: [
    'dashboard', 'students', 'attendance', 'leaves', 'fines',
    'discipline', 'hostel', 'notices', 'maintenance'
  ],
  parent: [
    'dashboard', 'students', 'attendance', 'leaves', 'fines',
    'discipline', 'marks', 'fees', 'notices'
  ],
  student: [
    'dashboard', 'attendance', 'leaves', 'exams', 'marks', 'notices'
  ]
};

const RBAC_STORAGE_KEY = 'tps_rbac_matrix';
let memoryMatrix = null;

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_RBAC_MATRIX));
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
          return { ...defaults, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Error reading RBAC matrix from localStorage:', e);
    }
  }
  return defaults;
}

export function saveRBACMatrix(matrix) {
  memoryMatrix = JSON.parse(JSON.stringify(matrix));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RBAC_STORAGE_KEY, JSON.stringify(matrix));
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

export function canAccessModule(profile, moduleKey) {
  if (!profile) return false;
  if (profile.approval_status !== 'approved') return false;
  // Super Admin always has full unrestricted access to every institutional window
  if (profile.is_super_admin || profile.role === 'super_admin') return true;

  // Root modules always protected for Super Admin only
  if (['users', 'audit'].includes(moduleKey)) return false;

  // Custom user-level assigned modules override (if present)
  if (Array.isArray(profile.custom_modules) && profile.custom_modules.length > 0) {
    return profile.custom_modules.includes(moduleKey);
  }

  // Dynamic RBAC Matrix lookup
  const matrix = getRBACMatrix();
  const allowed = matrix[profile.role];
  if (Array.isArray(allowed)) {
    return allowed.includes(moduleKey);
  }

  // Fallback to MODULE_DEFINITIONS
  const moduleDef = MODULE_DEFINITIONS.find(m => m.key === moduleKey);
  if (!moduleDef) return false;

  return moduleDef.roles.includes(profile.role);
}

export function getVisibleModules(profile) {
  if (!profile || profile.approval_status !== 'approved') return [];
  return MODULE_DEFINITIONS.filter(m => canAccessModule(profile, m.key));
}

export function canPerformAction(profile, moduleKey, action) {
  if (!profile || profile.approval_status !== 'approved') return false;
  if (profile.is_super_admin || profile.role === 'super_admin') return true;

  // View action is governed by dynamic module access
  if (action === 'view') {
    return canAccessModule(profile, moduleKey);
  }

  // Admin action rules
  if (profile.role === 'admin') {
    if (['override', 'delete_user', 'change_super_admin'].includes(action)) return false;
    return true;
  }

  // Mentor action rules
  if (profile.role === 'mentor') {
    if (['leaves', 'discipline', 'hostel', 'maintenance'].includes(moduleKey)) {
      return ['view', 'create', 'edit', 'record_return'].includes(action);
    }
    return action === 'view';
  }

  // Teacher action rules
  if (profile.role === 'teacher') {
    if (moduleKey === 'attendance') {
      return ['view', 'submit_attendance'].includes(action);
    }
    if (moduleKey === 'marks') {
      return ['view', 'enter_marks', 'edit_draft'].includes(action);
    }
    return action === 'view';
  }

  // Parents and students have view-only access to their authorized records
  return action === 'view';
}
