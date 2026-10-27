import { getCurrentUser } from '../../lib/auth.js';
import { renderAdminDashboard } from './admin-dashboard.js';
import { renderTeacherDashboard } from './teacher-dashboard.js';
import { renderMentorDashboard } from './mentor-dashboard.js';
import { renderParentDashboard } from './parent-dashboard.js';
import { renderStudentDashboard } from './student-dashboard.js';

export async function renderDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const isAdminOrSuper = user?.is_super_admin || user?.role === 'admin' || user?.role === 'super_admin';
  const storedPerspective = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tps_dashboard_perspective') : null;
  const effectiveRole = isAdminOrSuper
    ? (storedPerspective || user?.role || 'admin')
    : (user?.role || 'admin');

  const handleSwitchPerspective = (newPerspective) => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('tps_dashboard_perspective', newPerspective);
    }
    renderDashboard(container, { onNavigate });
  };

  switch (effectiveRole) {
    case 'teacher':
      await renderTeacherDashboard(container, { onNavigate });
      break;

    case 'mentor':
    case 'hostel_leader':
      await renderMentorDashboard(container, { onNavigate });
      break;

    case 'parent':
      await renderParentDashboard(container, { onNavigate });
      break;

    case 'student':
      await renderStudentDashboard(container, { onNavigate });
      break;

    case 'admin':
    case 'super_admin':
    default:
      await renderAdminDashboard(container, { onNavigate, onSwitchPerspective: handleSwitchPerspective });
      break;
  }
}
