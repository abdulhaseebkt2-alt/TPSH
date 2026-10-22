import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { formatDate } from '../../lib/utils.js';

const DEFAULT_NOTICES = [
  {
    id: 'n-1',
    title: 'Mid-Term Vacation Return Schedule & Gate Hours',
    target: 'All Hostel Parents & Mentors',
    date: '2026-10-18',
    content: 'All hostel students must report back to their respective dormitories before 06:00 PM on Sunday. Late arrivals will be subject to the standard institutional calendar-day late return policy of ₹200/day.'
  },
  {
    id: 'n-2',
    title: 'Mid-Term Examination Result Publication Notice',
    target: 'Parents & Teachers',
    date: '2026-10-15',
    content: 'Mid-term academic and moral evaluation results have been finalized. Parents can review student report cards and teacher evaluations through the TPS ERP portal.'
  }
];

export async function renderNoticesModule(container, { onNavigate }) {
  const user = getCurrentUser();
  let notices = [...DEFAULT_NOTICES];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>Institutional Notices & Parent Communication</h2>
        <p>Broadcast hostel notifications, term break alerts, and formatted WhatsApp parent messages</p>
      </div>
      <div class="page-actions">
        ${user?.is_super_admin || user?.role === 'admin' ? `
          <button class="btn btn-primary" id="btn-create-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Publish New Notice
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Notices Feed -->
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      ${notices.map(n => `
        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header" style="background: var(--bg-surface-subtle);">
            <div>
              <h3 style="font-size: 1.05rem;">${n.title}</h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Target: <strong>${n.target}</strong> • Date: ${formatDate(n.date)}</span>
            </div>
            <button class="btn btn-secondary btn-sm btn-copy-whatsapp" data-id="${n.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              Copy WhatsApp Format
            </button>
          </div>
          <div class="card-panel-body">
            <p style="color: var(--text-secondary); line-height: 1.7; font-size: 0.95rem;">${n.content}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Copy WhatsApp message handler
  container.querySelectorAll('.btn-copy-whatsapp').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const n = notices.find(item => item.id === id);
      if (n) {
        const text = `*THAIBA PUBLIC SCHOOL (TPS HOSTEL)*\n_Modern Education with Morality_\n\n📢 *${n.title}*\n📅 Date: ${formatDate(n.date)}\n🎯 For: ${n.target}\n\n${n.content}\n\n_Login to TPS Hostel ERP to view student details and leave cards._`;
        navigator.clipboard.writeText(text);
        toast.success('Formatted notice copied! Ready to paste into WhatsApp groups.');
      }
    });
  });

  // Create notice modal
  container.querySelector('#btn-create-notice')?.addEventListener('click', () => {
    openModal({
      title: 'Draft Institutional Notice',
      contentHtml: `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Notice Title</label>
          <input type="text" id="not-title" class="form-control" placeholder="e.g. Hostel Return Notification" required />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Target Audience</label>
          <select id="not-target" class="form-control">
            <option value="All Hostel Parents & Mentors">All Hostel Parents & Mentors</option>
            <option value="Parents Only">Parents Only</option>
            <option value="Faculty & Teachers">Faculty & Teachers</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label required">Notice Content</label>
          <textarea id="not-content" class="form-control" rows="4" placeholder="Enter the official announcement details" required></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-notice">Publish Notice</button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-notice').addEventListener('click', () => {
          const title = modalBody.querySelector('#not-title').value.trim();
          const target = modalBody.querySelector('#not-target').value;
          const content = modalBody.querySelector('#not-content').value.trim();

          if (!title || !content) {
            toast.error('Please enter both title and content.');
            return;
          }

          notices.unshift({
            id: 'n-' + Date.now(),
            title,
            target,
            date: new Date().toISOString().split('T')[0],
            content
          });

          toast.success('Notice published to community dashboard.');
          close();
          renderNoticesModule(container, { onNavigate });
        });
      }
    });
  });
}
