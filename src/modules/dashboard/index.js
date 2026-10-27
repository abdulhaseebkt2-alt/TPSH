import { getCurrentUser } from '../../lib/auth.js';
import { renderAdminDashboard } from './admin-dashboard.js';
import { renderTeacherDashboard } from './teacher-dashboard.js';
import { renderMentorDashboard } from './mentor-dashboard.js';
import { renderParentDashboard } from './parent-dashboard.js';
import { renderStudentDashboard } from './student-dashboard.js';

let activePerspectiveOverride = null;

export async function renderDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const effectiveRole = user?.role || 'admin';

  // Determine which dashboard to render:
  // If user is admin/super_admin, they can switch perspectives; otherwise, role is locked to their own category.
  let targetPerspective = activePerspectiveOverride;
  if (!user?.is_super_admin && user?.role !== 'admin' && user?.role !== 'super_admin') {
    targetPerspective = null; // Enforce role strictly for non-admins
  }

  const roleToRender = targetPerspective || effectiveRole;

  const handleSwitchPerspective = (newPerspective) => {
    activePerspectiveOverride = newPerspective;
    renderDashboard(container, { onNavigate });
  };

  switch (roleToRender) {
    case 'teacher':
      await renderTeacherDashboard(container, { onNavigate, onSwitchPerspective: handleSwitchPerspective });
      break;

    case 'mentor':
    case 'hostel_leader':
      await renderMentorDashboard(container, { onNavigate, onSwitchPerspective: handleSwitchPerspective });
      break;

    case 'parent':
      await renderParentDashboard(container, { onNavigate, onSwitchPerspective: handleSwitchPerspective });
      break;

    case 'student':
      await renderStudentDashboard(container, { onNavigate, onSwitchPerspective: handleSwitchPerspective });
      break;

    case 'admin':
    case 'super_admin':
    default:
      await renderAdminDashboard(container, { onNavigate, onSwitchPerspective: handleSwitchPerspective });
      break;
  }
}
