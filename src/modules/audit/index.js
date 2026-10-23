import { db } from '../../lib/db.js';
import { formatDate } from '../../lib/utils.js';
import { getCurrentUser } from '../../lib/auth.js';

export async function renderAuditModule(container, { onNavigate }) {
  const user = getCurrentUser();
  if (!user?.is_super_admin && user?.role !== 'super_admin') {
    container.innerHTML = `
      <div class="empty-state" style="margin-top: 4rem;">
        <div class="empty-icon" style="color: #DC2626; display: flex; justify-content: center; margin-bottom: 1rem;">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h4>Super Admin Audit Clearance Required</h4>
        <p>Institutional audit trails are restricted to verified Super Admin accounts.</p>
      </div>
    `;
    return;
  }

  const logs = await db.getAuditLogs();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Institutional Administrative Audit Logs</h2>
        <p>Immutable forensic record of admissions, role grants, attendance submissions, fine waivers, and marks publication</p>
      </div>
    </div>

    <!-- Audit Table Panel -->
    <div class="card-panel">
      <div class="card-panel-header">
        <h3>System Audit Trail</h3>
        <span class="badge badge-active">${logs.length} Logged Events</span>
      </div>
      <div class="card-panel-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Action Type</th>
                <th>Entity Affected</th>
                <th>Entity ID</th>
                <th>Reason / Specific Changes</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td><code style="font-size: 0.75rem;">${formatDate(log.created_at)}</code></td>
                  <td><strong>${log.actor_email || 'system'}</strong></td>
                  <td><span class="badge badge-active">${log.action}</span></td>
                  <td><strong>${log.entity_type}</strong></td>
                  <td><code>${log.entity_id || '—'}</code></td>
                  <td style="color: var(--text-secondary); max-width: 320px;">${log.reason || 'Operation audited successfully'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
