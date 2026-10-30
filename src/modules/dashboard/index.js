import { getCurrentUser } from '../../lib/auth.js';
import { renderAdminDashboard } from './admin-dashboard.js';
import { renderTeacherDashboard } from './teacher-dashboard.js';
import { renderMentorDashboard } from './mentor-dashboard.js';
import { renderParentDashboard } from './parent-dashboard.js';
import { renderStudentDashboard } from './student-dashboard.js';

export async function renderDashboard(container, { onNavigate }) {
  const user = getCurrentUser();
  const role = user?.role || 'admin';

  switch (role) {
    case 'teacher':
      await renderTeacherDashboard(container, { onNavigate });
      break;

    case 'mentor':
    case 'boys_mentor':
    case 'girls_mentor':
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
      await renderAdminDashboard(container, { onNavigate });
      break;
  }
}
