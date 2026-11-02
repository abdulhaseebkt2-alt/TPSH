import { db } from '../../lib/db.js';
import { formatDate, formatCurrency, printDocument } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { getCurrentUser } from '../../lib/auth.js';
import { getMentorGenderScope, isMentorRole } from '../../lib/permissions.js';
import { renderStudentDisciplineCardModule, renderFineStatusBadge } from './student-discipline-card.js';

export { renderFineStatusBadge };

export async function renderDisciplineModule(container, options = {}) {
  const { onNavigate, initialTab, studentId } = options;
  let currentSubView = initialTab === 'student_card' ? 'student_card' : 'register';
  let activeStudentId = studentId || null;
  const user = getCurrentUser();
  const [students, rawIncidents] = await Promise.all([
    db.getStudents(),
    db.getDisciplineIncidents()
  ]);

  const isMentor = isMentorRole(user?.role);
  const mentorGender = isMentor ? getMentorGenderScope(user) : null;
  const canManage = Boolean(user?.is_super_admin || user?.role === 'admin' || isMentor);

  // Scope students if mentor
  const scopedStudents = mentorGender
    ? students.filter(s => (s.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase())
    : students;

  const isParent = user?.role === 'parent';
  const displayIncidents = (isParent
    ? (rawIncidents || []).filter(d => {
        const st = students.find(s => s.id === d.student_id);
        return st?.father_phone === '+91 98470 11223' || st?.full_name === 'Muhammad Rayyan';
      })
    : mentorGender
      ? (rawIncidents || []).filter(d => {
          const st = students.find(s => s.id === d.student_id);
          return st && (st.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase();
        })
      : (rawIncidents || [])) || [];

  // Sub-view routing
  if (currentSubView === 'student_card') {
    return renderStudentDisciplineCardModule(container, {
      studentId: activeStudentId,
      onNavigate: (to) => {
        if (to === 'discipline') {
          currentSubView = 'register';
          renderView();
        } else if (onNavigate) {
          onNavigate(to);
        }
      }
    });
  }

  // Local filter states
  let searchQuery = '';
  let statusFilter = 'all'; // 'all', 'open', 'resolved'

  async function reloadData() {
    const updated = await db.getDisciplineIncidents();
    rawIncidents.length = 0;
    rawIncidents.push(...(updated || []));
    displayIncidents.length = 0;
    const reFiltered = isParent
      ? rawIncidents.filter(d => {
          const st = students.find(s => s.id === d.student_id);
          return st?.father_phone === '+91 98470 11223' || st?.full_name === 'Muhammad Rayyan';
        })
      : mentorGender
        ? rawIncidents.filter(d => {
            const st = students.find(s => s.id === d.student_id);
            return st && (st.gender || 'Boys').toLowerCase() === mentorGender.toLowerCase();
          })
        : rawIncidents;
    displayIncidents.push(...reFiltered);
  }

  function renderView() {
    // Calculate metrics
    const totalCount = displayIncidents.length;
    const openCount = displayIncidents.filter(d => (d.resolution_status || 'Open').toLowerCase() === 'open').length;
    const resolvedCount = displayIncidents.filter(d => (d.resolution_status || '').toLowerCase() === 'resolved').length;
    const totalMarks = displayIncidents.reduce((sum, d) => sum + (Number(d.black_marks_awarded) || 0), 0);
    const totalFines = displayIncidents.reduce((sum, d) => sum + (Number(d.monetary_fine) || 0), 0);

    // Filter items
    const filtered = displayIncidents.filter(d => {
      const st = students.find(s => s.id === d.student_id);
      const sName = (st?.full_name || '').toLowerCase();
      const sAdm = (st?.admission_number || '').toLowerCase();
      const sClass = (st?.school_class || '').toLowerCase();
      const cat = (d.category || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      const stStatus = (d.resolution_status || 'Open').toLowerCase();

      // Status filter
      if (statusFilter === 'open' && stStatus !== 'open') return false;
      if (statusFilter === 'resolved' && stStatus !== 'resolved') return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matches = sName.includes(q) || sAdm.includes(q) || sClass.includes(q) || cat.includes(q) || desc.includes(q);
        if (!matches) return false;
      }
      return true;
    });

    container.innerHTML = `
      <!-- SUB-TABS: Incident Register vs Student Discipline Card -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.5rem 0.75rem; margin-bottom: 1rem;">
        <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 3px; gap: 3px;">
          <button type="button" id="subtab-disc-register" style="padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 800; border-radius: 6px; border: none; cursor: default; background: #FFFFFF; color: #DC2626; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Incident Register
          </button>
          <button type="button" id="subtab-disc-card" style="padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; background: transparent; color: #64748B; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="20" height="14" x="2" y="5" rx="2"></rect><circle cx="8" cy="12" r="2.5"></circle><path d="M14 10h4"></path><path d="M14 14h3"></path></svg>
            Student Discipline Card
          </button>
        </div>
        ${canManage ? `
          <button class="btn btn-primary" id="btn-log-incident" style="background: #059669; border-color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.75rem; border-radius: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Record Disciplinary Incident
          </button>
        ` : ''}
      </div>

      <!-- Page Header with compact responsive typography -->
      <div class="page-header" style="margin-bottom: 1rem;">
        <div class="page-title-group">
          <h2 style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.25;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Discipline & Incident Register
          </h2>
          <p style="font-size: 0.8rem; color: #64748B; margin-top: 0.25rem; line-height: 1.4;">
            Institutional record of hostel rule violations, black marks ledger, property damage fines, and resolution
          </p>
        </div>
        <div class="page-actions" style="margin-top: 0.35rem;">
          ${canManage ? `
            <button class="btn btn-primary" id="btn-log-incident" style="background: #059669; border-color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Record Disciplinary Incident
            </button>
          ` : ''}
        </div>
      </div>

      <!-- KPI Bento Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 0.65rem; margin-bottom: 1rem;">
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 0.9rem; cursor: pointer;" id="kpi-all-incidents" title="Filter All">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Total Recorded</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-top: 2px;">${totalCount}</div>
          <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 1px;">Documented file(s)</div>
        </div>

        <div style="background: ${openCount > 0 ? '#FFFBEB' : '#FFFFFF'}; border: 1px solid ${openCount > 0 ? '#FDE68A' : '#E2E8F0'}; border-radius: 12px; padding: 0.75rem 0.9rem; cursor: pointer;" id="kpi-open-incidents" title="Filter Open">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: ${openCount > 0 ? '#B45309' : '#64748B'};">Open Matters</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: ${openCount > 0 ? '#B45309' : '#0F172A'}; margin-top: 2px;">${openCount}</div>
          <div style="font-size: 0.7rem; color: ${openCount > 0 ? '#D97706' : '#94A3B8'}; margin-top: 1px;">Awaiting resolution</div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 0.9rem; cursor: pointer;" id="kpi-resolved-incidents" title="Filter Resolved">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #059669;">Resolved</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: #059669; margin-top: 2px;">${resolvedCount}</div>
          <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 1px;">Settled & closed</div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0.75rem 0.9rem;">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Black Marks / Fines</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #DC2626; margin-top: 2px;">+${totalMarks} <span style="font-size: 0.8rem; font-weight: 600; color: #64748B;">marks</span></div>
          <div style="font-size: 0.7rem; color: #64748B; margin-top: 1px;">${totalFines > 0 ? formatCurrency(totalFines) + ' damage fines' : 'No property fines'}</div>
        </div>
      </div>

      <!-- Main Register Panel -->
      <div class="card-panel" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <!-- Panel Header with Search & Filter Tabs -->
        <div style="padding: 0.85rem 1rem; border-bottom: 1px solid #F1F5F9; display: flex; flex-direction: column; gap: 0.65rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h3 style="font-size: 0.95rem; font-weight: 700; color: #0F172A; margin: 0;">Hostel Misconduct Records</h3>
              <span class="badge" style="background: #E0E7FF; color: #4338CA; font-size: 0.7rem; font-weight: 800; padding: 2px 7px;">${filtered.length}</span>
            </div>
            <!-- Segmented Filter Pills -->
            <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 2px; gap: 2px;">
              <button type="button" class="btn-filter-status" data-filter="all" style="padding: 0.25rem 0.65rem; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; background: ${statusFilter === 'all' ? '#FFFFFF' : 'transparent'}; color: ${statusFilter === 'all' ? '#0F172A' : '#64748B'}; box-shadow: ${statusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">
                All (${totalCount})
              </button>
              <button type="button" class="btn-filter-status" data-filter="open" style="padding: 0.25rem 0.65rem; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; background: ${statusFilter === 'open' ? '#FFFFFF' : 'transparent'}; color: ${statusFilter === 'open' ? '#B45309' : '#64748B'}; box-shadow: ${statusFilter === 'open' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">
                Open (${openCount})
              </button>
              <button type="button" class="btn-filter-status" data-filter="resolved" style="padding: 0.25rem 0.65rem; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; background: ${statusFilter === 'resolved' ? '#FFFFFF' : 'transparent'}; color: ${statusFilter === 'resolved' ? '#059669' : '#64748B'}; box-shadow: ${statusFilter === 'resolved' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">
                Resolved (${resolvedCount})
              </button>
            </div>
          </div>

          <!-- Search Input -->
          <div style="position: relative; width: 100%;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none;">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="inc-search-input" value="${searchQuery}" placeholder="Search student name, admission no, class, category, reason..." style="width: 100%; padding: 0.45rem 0.75rem 0.45rem 2.1rem; font-size: 0.8rem; border: 1px solid #E2E8F0; border-radius: 8px; background: #FFFFFF; outline: none; box-sizing: border-box;" />
          </div>
        </div>

        <div class="card-panel-body" style="padding: 0;">
          ${filtered.length === 0 ? `
            <div style="padding: 2.5rem 1rem; text-align: center; color: #64748B;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 0.5rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <div style="font-size: 0.92rem; font-weight: 700; color: #1E293B;">No Disciplinary Incidents Found</div>
              <div style="font-size: 0.78rem; margin-top: 0.25rem;">No records match your active search or filter selection.</div>
            </div>
          ` : `
            <!-- 1. DESKTOP TABLE VIEW (Visible on screens > 768px) -->
            <div class="table-responsive desktop-table-view" style="overflow-x: auto;">
              <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Student</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Incident Date</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Category</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Severity</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Description</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Black Marks</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Property Fine</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B;">Resolution Status</th>
                    <th style="padding: 0.65rem 0.85rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748B; text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(d => {
                    const st = students.find(s => s.id === d.student_id);
                    const isCrit = d.severity === 'Critical';
                    const isMaj = d.severity === 'Major';
                    const sevStyle = isCrit ? 'background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5;' : isMaj ? 'background: #FFF7ED; color: #C2410C; border: 1px solid #FDBA74;' : 'background: #F1F5F9; color: #475569;';
                    const isRes = (d.resolution_status || '').toLowerCase() === 'resolved';
                    const resStyle = isRes ? 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;' : 'background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;';

                    return `
                      <tr style="border-bottom: 1px solid #F1F5F9;">
                        <td style="padding: 0.75rem 0.85rem;">
                          <strong style="color: #0F172A;">${st?.full_name || 'Student'}</strong>
                          <div style="font-size: 0.74rem; color: #64748B;">${st?.admission_number ? st.admission_number + ' • ' : ''}${st?.school_class || ''}</div>
                        </td>
                        <td style="padding: 0.75rem 0.85rem; font-size: 0.8rem; color: #334155;">${formatDate(d.incident_date)}</td>
                        <td style="padding: 0.75rem 0.85rem;"><strong style="font-size: 0.82rem; color: #1E293B;">${d.category}</strong></td>
                        <td style="padding: 0.75rem 0.85rem;"><span class="badge" style="font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; ${sevStyle}">${d.severity}</span></td>
                        <td style="padding: 0.75rem 0.85rem; max-width: 220px; font-size: 0.78rem; color: #475569;">${d.description}</td>
                        <td style="padding: 0.75rem 0.85rem;"><span class="badge badge-black-mark" style="font-size: 0.72rem; font-weight: 700; padding: 2px 7px;">+${d.black_marks_awarded} Mark(s)</span></td>
                        <td style="padding: 0.75rem 0.85rem; font-size: 0.8rem; font-weight: 600;">
                          ${d.monetary_fine > 0 ? `
                            <div>${renderFineStatusBadge(d)}</div>
                            <div style="display: flex; gap: 4px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
                              ${(Number(d.fine_remaining_amount) == null ? (d.fine_payment_status === 'paid' ? 0 : Number(d.monetary_fine) || 0) : Number(d.fine_remaining_amount)) > 0 && canManage ? `
                                <button class="btn btn-xs btn-settle-fine" data-id="${d.id}" style="padding:2px 7px;font-size:0.7rem;font-weight:700;border-radius:6px;background:#F59E0B;border:1.5px solid #F59E0B;color:#FFF;white-space:nowrap;">
                                  💳 ${(Number(d.fine_paid_amount) || 0) > 0 ? `Pay Remaining (₹${(Number(d.fine_remaining_amount) || 0).toFixed(2)})` : 'Settle Fine'}
                                </button>
                              ` : ''}
                              ${(Number(d.fine_paid_amount) || 0) > 0 ? `
                                <button class="btn btn-xs btn-outline btn-view-receipt" data-id="${d.id}" style="padding:2px 7px;font-size:0.7rem;font-weight:700;border-radius:6px;color:#047857;border-color:#A7F3D0;white-space:nowrap;">
                                  Receipt
                                </button>
                              ` : ''}
                            </div>
                          ` : '<span style="color:#64748B;">None</span>'}
                        </td>
                        <td style="padding: 0.75rem 0.85rem;"><span class="badge" style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; ${resStyle}">${d.resolution_status || 'Open'}</span></td>
                        <td style="padding: 0.75rem 0.85rem; text-align: right;">
                          <div style="display: inline-flex; gap: 0.35rem; align-items: center; justify-content: flex-end;">
                            <button class="btn btn-outline btn-xs btn-view-incident" data-id="${d.id}" style="padding: 0.25rem 0.6rem; font-size: 0.74rem; font-weight: 600; border-radius: 6px;">Details</button>
                            <button class="btn btn-outline btn-xs btn-goto-student-card" data-student-id="${d.student_id}" style="padding: 0.25rem 0.55rem; font-size: 0.74rem; font-weight: 700; border-radius: 6px; color: #DC2626; border-color: #FECACA;">🪪 Card</button>
                            ${canManage && !isRes ? `
                              <button class="btn btn-xs btn-outline-success btn-resolve-incident" data-id="${d.id}" style="padding: 0.25rem 0.55rem; font-size: 0.74rem; font-weight: 600; border-radius: 6px; color: #059669; border-color: #A7F3D0;">Resolve</button>
                            ` : ''}
                            ${canManage ? `
                              <button class="btn btn-xs btn-outline-danger btn-delete-incident" data-id="${d.id}" style="padding: 0.25rem 0.5rem; font-size: 0.74rem; font-weight: 600; border-radius: 6px; color: #DC2626; border-color: #FCA5A5;" title="Delete Record">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- 2. MOBILE TOUCH CARD FEED (Visible on mobile screens <= 768px, No Horizontal Scrolling) -->
            <div class="mobile-card-feed" style="display: none; padding: 0.65rem; flex-direction: column; gap: 0.65rem;">
              ${filtered.map(d => {
                const st = students.find(s => s.id === d.student_id);
                const isCrit = d.severity === 'Critical';
                const isMaj = d.severity === 'Major';
                const sevStyle = isCrit ? 'background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5;' : isMaj ? 'background: #FFF7ED; color: #C2410C; border: 1px solid #FDBA74;' : 'background: #F1F5F9; color: #475569;';
                const isRes = (d.resolution_status || '').toLowerCase() === 'resolved';
                const resStyle = isRes ? 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;' : 'background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;';

                return `
                  <div style="background: #FFFFFF; border: 1.5px solid ${isCrit ? '#FECACA' : '#E2E8F0'}; border-radius: 12px; padding: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 0.55rem;">
                    <!-- Top Row: Student & Resolution Badge -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #0F172A;">${st?.full_name || 'Student'}</div>
                        <div style="font-size: 0.74rem; color: #64748B; margin-top: 1px;">
                          ${st?.admission_number ? `<span style="font-family: monospace; font-weight: 600;">${st.admission_number}</span> • ` : ''}${st?.school_class || ''}
                        </div>
                      </div>
                      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
                        <span class="badge" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-weight: 700; ${resStyle}">
                          ${d.resolution_status || 'Open'}
                        </span>
                        <span style="font-size: 0.72rem; color: #94A3B8; font-weight: 500;">${formatDate(d.incident_date)}</span>
                      </div>
                    </div>

                    <!-- Category & Severity Badge -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
                      <div style="font-weight: 700; font-size: 0.88rem; color: #1E293B;">${d.category}</div>
                      <span class="badge" style="font-size: 0.7rem; padding: 2px 7px; border-radius: 6px; font-weight: 700; ${sevStyle}">${d.severity}</span>
                    </div>

                    <!-- Description Snippet -->
                    ${d.description ? `
                      <div style="font-size: 0.8rem; color: #475569; background: #F8FAFC; border-radius: 8px; padding: 0.5rem 0.65rem; border: 1px solid #F1F5F9; line-height: 1.45;">
                        ${d.description}
                      </div>
                    ` : ''}

                    <!-- Penalties Strip & Mobile Action Buttons -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid #F1F5F9; gap: 0.4rem; flex-wrap: wrap;">
                      <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                        <span class="badge badge-black-mark" style="font-size: 0.72rem; padding: 2px 7px; font-weight: 700;">
                          +${d.black_marks_awarded} Mark(s)
                        </span>
                        ${d.monetary_fine > 0 ? renderFineStatusBadge(d) : ''}
                      </div>

                      <div style="display: flex; gap: 0.35rem; align-items: center; margin-left: auto; flex-wrap: wrap;">
                        <button class="btn btn-outline btn-xs btn-view-incident" data-id="${d.id}" style="padding: 0.3rem 0.65rem; font-size: 0.76rem; font-weight: 600; border-radius: 7px;">
                          Details
                        </button>
                        <button class="btn btn-outline btn-xs btn-goto-student-card" data-student-id="${d.student_id}" style="padding: 0.3rem 0.65rem; font-size: 0.76rem; font-weight: 700; border-radius: 7px; color: #DC2626; border-color: #FECACA;">
                          🪪 Card
                        </button>
                        ${(Number(d.fine_remaining_amount) == null ? (d.fine_payment_status === 'paid' ? 0 : Number(d.monetary_fine) || 0) : Number(d.fine_remaining_amount)) > 0 && canManage ? `
                          <button class="btn btn-xs btn-settle-fine" data-id="${d.id}" style="padding: 0.3rem 0.65rem; font-size: 0.76rem; font-weight: 700; border-radius: 7px; background: #F59E0B; border: 1.5px solid #F59E0B; color: #FFFFFF; white-space: nowrap;">
                            💳 ${(Number(d.fine_paid_amount) || 0) > 0 ? `Pay Remaining (₹${(Number(d.fine_remaining_amount) || 0).toFixed(2)})` : 'Settle Fine'}
                          </button>
                        ` : ''}
                        ${(Number(d.fine_paid_amount) || 0) > 0 ? `
                          <button class="btn btn-outline btn-xs btn-view-receipt" data-id="${d.id}" style="padding: 0.3rem 0.65rem; font-size: 0.76rem; font-weight: 700; border-radius: 7px; color: #047857; border-color: #A7F3D0;">
                            Receipt
                          </button>
                        ` : ''}
                        ${canManage && !isRes ? `
                          <button class="btn btn-xs btn-outline-success btn-resolve-incident" data-id="${d.id}" style="padding: 0.3rem 0.65rem; font-size: 0.76rem; font-weight: 600; border-radius: 7px; color: #059669; border-color: #A7F3D0;">
                            Resolve
                          </button>
                        ` : ''}
                        ${canManage ? `
                          <button class="btn btn-xs btn-outline-danger btn-delete-incident" data-id="${d.id}" style="padding: 0.3rem 0.55rem; font-size: 0.76rem; font-weight: 600; border-radius: 7px; color: #DC2626; border-color: #FCA5A5;" title="Delete Record">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Search input
    const searchInput = container.querySelector('#inc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderView();
        const nextInput = container.querySelector('#inc-search-input');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      });
    }

    // Filter pills
    container.querySelectorAll('.btn-filter-status').forEach(btn => {
      btn.addEventListener('click', () => {
        statusFilter = btn.dataset.filter;
        renderView();
      });
    });

    // KPI card clicks
    container.querySelector('#kpi-all-incidents')?.addEventListener('click', () => {
      statusFilter = 'all';
      renderView();
    });
    container.querySelector('#kpi-open-incidents')?.addEventListener('click', () => {
      statusFilter = 'open';
      renderView();
    });
    container.querySelector('#kpi-resolved-incidents')?.addEventListener('click', () => {
      statusFilter = 'resolved';
      renderView();
    });

    // Record Disciplinary Incident
    container.querySelector('#btn-log-incident')?.addEventListener('click', () => {
      openRecordIncidentModal();
    });

    // View Details
    container.querySelectorAll('.btn-view-incident').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openIncidentDetailsModal(id);
      });
    });

    // Quick Resolve
    container.querySelectorAll('.btn-resolve-incident').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openResolveIncidentModal(id);
      });
    });

    // Delete Incident
    container.querySelectorAll('.btn-delete-incident').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        confirmDeleteIncident(id);
      });
    });

    // Settle Fine
    container.querySelectorAll('.btn-settle-fine').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openSettleFineModal(id);
      });
    });

    // View Receipt
    container.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openReceiptModal(id);
      });
    });

    // Sub-tab: Go to Student Discipline Card
    container.querySelector('#subtab-disc-card')?.addEventListener('click', () => {
      currentSubView = 'student_card';
      renderStudentDisciplineCardModule(container, {
        studentId: activeStudentId,
        onNavigate: (to) => {
          if (to === 'discipline') {
            currentSubView = 'register';
            renderView();
          } else if (onNavigate) {
            onNavigate(to);
          }
        }
      });
    });

    // Button: Go to Student Discipline Card from specific incident
    container.querySelectorAll('.btn-goto-student-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-student-id');
        currentSubView = 'student_card';
        activeStudentId = sId;
        renderStudentDisciplineCardModule(container, {
          studentId: activeStudentId,
          onNavigate: (to) => {
            if (to === 'discipline') {
              currentSubView = 'register';
              renderView();
            } else if (onNavigate) {
              onNavigate(to);
            }
          }
        });
      });
    });
  }

  // -------------------------------------------------------------
  // MODAL: RECORD DISCIPLINARY INCIDENT
  // -------------------------------------------------------------
  function openRecordIncidentModal() {
    openModal({
      title: 'Record Disciplinary Incident',
      size: 'lg',
      contentHtml: `
        <div class="form-grid" style="margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label required">Student Involved</label>
            <select id="inc-student" class="form-control" style="font-size: 0.85rem;">
              ${scopedStudents.map(s => `<option value="${s.id}">${s.full_name} (${s.admission_number || 'No ID'}) — ${s.school_class || 'Hostel'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Violation Category</label>
            <select id="inc-category" class="form-control" style="font-size: 0.85rem;">
              <option value="Leaving hostel without permission">Leaving hostel without permission (Major, 3 Marks)</option>
              <option value="Returning late without permission">Returning late without permission (Moderate, 2 Marks)</option>
              <option value="Breaking window glass">Breaking window glass (Property Damage, 2 Marks)</option>
              <option value="Damaging clocks, furniture, or hostel property">Damaging clocks, furniture, or hostel property (2 Marks)</option>
              <option value="Fighting with another student">Fighting with another student (Critical, 5 Marks)</option>
              <option value="Bullying or mistreating other students">Bullying or mistreating other students (Critical, 5 Marks)</option>
              <option value="Possessing a mobile phone in hostel">Possessing a mobile phone in hostel (Moderate, 2 Marks)</option>
              <option value="Violating hostel silence hours">Violating hostel silence hours (Minor, 1 Mark)</option>
              <option value="Other hostel rules violation">Other hostel rules violation</option>
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label required">Incident Date</label>
            <input type="date" id="inc-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
          </div>
          <div class="form-group">
            <label class="form-label required">Severity</label>
            <select id="inc-severity" class="form-control">
              <option value="Minor">Minor</option>
              <option value="Moderate" selected>Moderate</option>
              <option value="Major">Major</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label required">Black Marks to Award</label>
            <input type="number" id="inc-marks" class="form-control" value="2" min="1" max="10" required />
          </div>
          <div class="form-group">
            <label class="form-label">Property Damage Fine (₹) if applicable</label>
            <input type="number" id="inc-fine" class="form-control" value="0" min="0" placeholder="0" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label required">Incident Description & Location</label>
          <textarea id="inc-desc" class="form-control" rows="2" placeholder="Describe the incident, exact location, and circumstances" required></textarea>
        </div>
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label">Action Taken / Disciplinary Decision</label>
          <input type="text" id="inc-action" class="form-control" placeholder="e.g. Property repair cost levied, phone confiscated for 7 days" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-save-incident" style="background: #059669; border-color: #059669; font-weight: 700;">
            Log Incident & Apply Black Marks
          </button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-save-incident')?.addEventListener('click', async () => {
          const sid = modalBody.querySelector('#inc-student')?.value;
          const category = modalBody.querySelector('#inc-category')?.value;
          const incident_date = modalBody.querySelector('#inc-date')?.value;
          const severity = modalBody.querySelector('#inc-severity')?.value;
          const marks = modalBody.querySelector('#inc-marks')?.value;
          const fine = modalBody.querySelector('#inc-fine')?.value;
          const desc = modalBody.querySelector('#inc-desc')?.value.trim();
          const action = modalBody.querySelector('#inc-action')?.value.trim();

          if (!desc) {
            toast.error('Please enter an incident description.');
            return;
          }

          try {
            await db.logDisciplineIncident({
              student_id: sid,
              category,
              severity,
              incident_date,
              description: desc,
              black_marks: marks,
              fine,
              action_taken: action || 'Documented on record',
              reported_by: user?.full_name || 'Staff'
            });

            toast.success('Disciplinary incident recorded and black mark ledger updated.');
            close();
            await reloadData();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error recording incident');
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: SETTLE DISCIPLINE FINE
  // -------------------------------------------------------------
  function openSettleFineModal(id) {
    const d = displayIncidents.find(item => item.id === id);
    if (!d) return;
    const student = students.find(s => s.id === d.student_id);
    const studentName = student?.full_name || 'Student';
    const totalFine = Number(d.monetary_fine) || 0;
    const alreadyPaid = Number(d.fine_paid_amount) || (d.fine_payment_status === 'paid' ? totalFine : 0);
    const remainingAmt = d.fine_remaining_amount != null ? Number(d.fine_remaining_amount) : (d.fine_payment_status === 'paid' ? 0 : Math.max(0, totalFine - alreadyPaid));
    const defaultPartialAmt = Math.max(1, Math.round(remainingAmt / 2));

    openModal({
      title: `Settle Disciplinary Fine — ${studentName}`,
      size: 'sm',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
          <!-- Fine Summary Card -->
          <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <div style="font-weight: 800; font-size: 0.92rem; color: #0F172A;">${studentName}</div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 1px;">${student?.admission_number || ''} • ${student?.school_class || ''}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.25rem; font-weight: 900; color: #DC2626; font-family: monospace;">₹${remainingAmt.toFixed(2)}</div>
                <div style="font-size: 0.7rem; color: #B45309; font-weight: 700;">CURRENT BALANCE DUE</div>
              </div>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.76rem; color: #78350F; border-top: 1px dashed #FCD34D; padding-top: 0.4rem; display: flex; justify-content: space-between;">
              <span>Violation: <strong>${d.category}</strong></span>
              <span>Total Fine: <strong>₹${totalFine.toFixed(2)}</strong> (Paid: ₹${alreadyPaid.toFixed(2)})</span>
            </div>
          </div>

          <!-- Payment Option Selection (Full vs Partial Radio Buttons) -->
          <div>
            <label style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Select Payment Option</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <label id="label-settle-full" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #059669; background: #ECFDF5; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #065F46;">
                <input type="radio" name="settle_payment_mode" value="full" checked style="accent-color: #059669;" />
                Full Clearance
              </label>
              <label id="label-settle-partial" style="display: flex; align-items: center; gap: 6px; padding: 0.5rem 0.65rem; border: 1.5px solid #E2E8F0; background: #FFFFFF; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #334155;">
                <input type="radio" name="settle_payment_mode" value="partial" style="accent-color: #D97706;" />
                Partial Payment
              </label>
            </div>
          </div>

          <!-- Amount to Pay -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label required" style="font-size: 0.78rem; font-weight: 700; margin-bottom: 2px;">Amount Paid Now (₹)</label>
            <input type="number" id="settle-amount" class="form-control" value="${remainingAmt}" min="1" max="${remainingAmt}" step="0.01" style="height: 38px; font-size: 0.95rem; font-weight: 800; color: #0F172A;" />
            <div id="settle-live-bal-status" style="font-size: 0.74rem; font-weight: 700; color: #059669; margin-top: 3px;">
              Remaining balance after payment: <span style="color: #059669;">✓ ₹0.00 (Fully Settled)</span>
            </div>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label required" style="font-size: 0.78rem; font-weight: 700;">Payment Method</label>
            <select id="settle-method" class="form-control" style="height: 38px; font-size: 0.85rem;">
              <option value="Cash" selected>Cash at Hostel Office</option>
              <option value="UPI">UPI / Google Pay / PhonePe</option>
              <option value="Bank Transfer">School Bank Transfer / NEFT</option>
              <option value="Cheque">Cheque</option>
              <option value="DD">Demand Draft (DD)</option>
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Reference / Transaction No. (Optional)</label>
            <input type="text" id="settle-ref" class="form-control" placeholder="e.g. UPI Ref: 123456789 or Cheque No." style="height: 38px; font-size: 0.85rem;" />
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Received By</label>
            <input type="text" id="settle-receiver" class="form-control" value="${user?.full_name || 'Hostel Office'}" style="height: 38px; font-size: 0.85rem;" />
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Remarks (Optional)</label>
            <input type="text" id="settle-remarks" class="form-control" placeholder="e.g. Paid by father at warden office" style="height: 38px; font-size: 0.85rem;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-settle">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-confirm-settle" style="background: #F59E0B; border-color: #F59E0B; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Confirm Payment (₹${remainingAmt.toFixed(2)})
            </button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-settle')?.addEventListener('click', close);

        const fullRadio = modalBody.querySelector('input[value="full"]');
        const partialRadio = modalBody.querySelector('input[value="partial"]');
        const labelFull = modalBody.querySelector('#label-settle-full');
        const labelPartial = modalBody.querySelector('#label-settle-partial');
        const amtInput = modalBody.querySelector('#settle-amount');
        const balStatus = modalBody.querySelector('#settle-live-bal-status');
        const confirmBtn = modalBody.querySelector('#btn-confirm-settle');

        function updateState() {
          const isPartial = partialRadio?.checked;
          const entered = Math.max(0, Math.min(remainingAmt, Number(amtInput.value) || 0));
          const bal = Math.max(0, remainingAmt - entered);

          if (isPartial) {
            labelFull.style.borderColor = '#E2E8F0';
            labelFull.style.background = '#FFFFFF';
            labelFull.style.color = '#334155';
            labelPartial.style.borderColor = '#D97706';
            labelPartial.style.background = '#FFFBEB';
            labelPartial.style.color = '#92400E';
          } else {
            labelFull.style.borderColor = '#059669';
            labelFull.style.background = '#ECFDF5';
            labelFull.style.color = '#065F46';
            labelPartial.style.borderColor = '#E2E8F0';
            labelPartial.style.background = '#FFFFFF';
            labelPartial.style.color = '#334155';
          }

          if (balStatus) {
            if (bal === 0) {
              balStatus.innerHTML = 'Remaining balance after payment: <span style="color: #059669;">✓ ₹0.00 (Fully Settled)</span>';
            } else {
              balStatus.innerHTML = `Remaining balance after payment: <span style="color: #DC2626;">⚠️ Balance Due: ₹${bal.toFixed(2)}</span>`;
            }
          }

          if (confirmBtn) {
            confirmBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Confirm Payment (₹${entered.toFixed(2)})`;
          }
        }

        fullRadio?.addEventListener('change', () => {
          if (amtInput) amtInput.value = remainingAmt;
          updateState();
        });

        partialRadio?.addEventListener('change', () => {
          if (amtInput) amtInput.value = defaultPartialAmt;
          updateState();
        });

        amtInput?.addEventListener('input', () => {
          const val = Number(amtInput.value) || 0;
          if (val < remainingAmt && !partialRadio.checked) {
            partialRadio.checked = true;
          } else if (val >= remainingAmt && !fullRadio.checked) {
            fullRadio.checked = true;
          }
          updateState();
        });

        confirmBtn?.addEventListener('click', async () => {
          const amount = Number(amtInput?.value) || 0;
          const method = modalBody.querySelector('#settle-method')?.value || 'Cash';
          const ref = modalBody.querySelector('#settle-ref')?.value?.trim() || '';
          const receiver = modalBody.querySelector('#settle-receiver')?.value?.trim() || user?.full_name || 'Hostel Office';
          const remarks = modalBody.querySelector('#settle-remarks')?.value?.trim() || '';

          if (amount <= 0) {
            toast.error('Please enter a valid payment amount.');
            return;
          }
          if (amount > remainingAmt) {
            toast.error(`Payment cannot exceed the remaining balance of ₹${remainingAmt.toFixed(2)}.`);
            return;
          }

          try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';

            await db.settleDisciplineFine(id, {
              amount,
              payment_method: method,
              reference_number: ref,
              received_by: receiver,
              remarks
            });

            toast.success(`Fine payment of ${formatCurrency(amount)} recorded! Receipt generated.`);
            close();
            await reloadData();
            // Card remains in view!
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error settling fine');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Payment';
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: VIEW & PRINT RECEIPT
  // -------------------------------------------------------------
  async function openReceiptModal(id) {
    const d = displayIncidents.find(item => item.id === id);
    if (!d) return;
    const student = students.find(s => s.id === d.student_id);
    const studentName = student?.full_name || 'Student';
    const payments = await db.getDisciplineFinePaymentsByIncident(id);
    const latestPayment = payments[0] || {};
    const rcptNo = latestPayment.receipt_no || latestPayment.receipt_number || ('DISC-' + d.id.slice(-6).toUpperCase());

    openModal({
      title: `Payment Receipt — ${rcptNo}`,
      size: 'sm',
      contentHtml: `
        <div id="discipline-receipt-slip" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; font-size: 0.85rem; line-height: 1.5; color: #0F172A;">
          <div style="text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.05rem; font-weight: 900; color: #0F172A;">THAIBA RESIDENTIAL ENGLISH MEDIUM SCHOOL</div>
            <div style="font-size: 0.75rem; color: #64748B; font-weight: 600;">Campus Discipline & Fine Clearance Receipt</div>
            <div style="font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #DC2626; margin-top: 4px;">Receipt #${rcptNo}</div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
            <span style="color: #64748B;">Date & Time:</span>
            <strong>${latestPayment.payment_date || formatDate(d.fine_paid_at || new Date())}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
            <span style="color: #64748B;">Student Name:</span>
            <strong>${studentName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
            <span style="color: #64748B;">Admission / Class:</span>
            <span>${student?.admission_number || ''} • ${student?.school_class || ''}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
            <span style="color: #64748B;">Violation:</span>
            <span>${d.category}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
            <span style="color: #64748B;">Payment Mode:</span>
            <strong>${latestPayment.payment_method || d.fine_payment_method || 'Cash'}</strong>
          </div>
          ${latestPayment.reference_number ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem;">
              <span style="color: #64748B;">Reference No:</span>
              <code>${latestPayment.reference_number}</code>
            </div>
          ` : ''}

          <div style="border-top: 1px dashed #CBD5E1; border-bottom: 1px dashed #CBD5E1; padding: 0.5rem 0; margin: 0.65rem 0; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Total Assessed Fine:</span>
              <strong>₹${(Number(d.monetary_fine) || 0).toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: #047857; font-weight: 800;">
              <span>Amount Paid:</span>
              <span>₹${(Number(d.fine_paid_amount) || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 800; color: ${(Number(d.fine_remaining_amount) || 0) > 0 ? '#DC2626' : '#047857'};">
              <span>Remaining Due:</span>
              <span>₹${(Number(d.fine_remaining_amount) || 0).toFixed(2)}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: #64748B; margin-top: 0.5rem;">
            <div>Received By: <strong>${latestPayment.received_by || d.fine_paid_by || 'Hostel Office'}</strong></div>
            <div>Status: <strong style="color: ${(Number(d.fine_remaining_amount) || 0) === 0 ? '#059669' : '#D97706'};">${(Number(d.fine_remaining_amount) || 0) === 0 ? 'Full Clearance' : 'Partial Payment'}</strong></div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
          <button type="button" class="btn btn-outline" id="btn-close-disc-receipt">Close</button>
          <button type="button" class="btn btn-primary" id="btn-print-disc-receipt" style="background: #047857; border-color: #047857; font-weight: 700; color: #FFFFFF; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print Receipt
          </button>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-close-disc-receipt')?.addEventListener('click', close);
        modalBody.querySelector('#btn-print-disc-receipt')?.addEventListener('click', () => {
          printDocument('discipline-receipt-slip', `Discipline_Receipt_${rcptNo}`);
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: INCIDENT DETAILS & ACTIONS
  // -------------------------------------------------------------
  function openIncidentDetailsModal(id) {    const d = displayIncidents.find(item => item.id === id);
    if (!d) return;
    const student = students.find(s => s.id === d.student_id);
    const isRes = (d.resolution_status || '').toLowerCase() === 'resolved';

    openModal({
      title: `Disciplinary Incident — ${student?.full_name || 'Student'}`,
      contentHtml: `
        <div style="font-size: 0.88rem; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.75rem;">
          <!-- Student & Date Card -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong style="color: #0F172A; font-size: 1rem;">${student?.full_name || 'Student'}</strong>
              <div style="font-size: 0.75rem; color: #64748B;">${student?.admission_number ? student.admission_number + ' • ' : ''}${student?.school_class || 'Hostel Student'}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-weight: 700; ${isRes ? 'background: #ECFDF5; color: #047857;' : 'background: #FFFBEB; color: #B45309;'}">
                ${d.resolution_status || 'Open'}
              </span>
              <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 2px;">${formatDate(d.incident_date)}</div>
            </div>
          </div>

          <!-- Category & Severity Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem;">
            <div>Category: <strong style="color: #0F172A;">${d.category}</strong></div>
            <div>Severity: <strong style="color: #0F172A;">${d.severity}</strong></div>
            <div>Reported By: <strong>${d.reported_by || 'Staff'}</strong></div>
            <div>Resolution: <strong>${d.resolution_status || 'Open'}</strong></div>
          </div>

          <!-- Description -->
          <div style="padding: 0.75rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
            <span style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Description & Circumstances:</span>
            <p style="color: #1E293B; margin: 0.25rem 0 0; font-size: 0.85rem; line-height: 1.5;">${d.description || 'No description provided'}</p>
          </div>

          <!-- Penalties & Action Taken -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.75rem; font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.35rem;">
            <div>Black Marks Awarded: <span class="badge badge-black-mark" style="font-size: 0.72rem; font-weight: 700; padding: 2px 7px;">+${d.black_marks_awarded}</span></div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              Property Damage Fine:
              ${d.monetary_fine > 0 ? renderFineStatusBadge(d) : '<strong style="color:#64748B;">None</strong>'}
            </div>
            ${d.monetary_fine > 0 && d.fine_payment_status === 'paid' ? `
              <div style="font-size:0.76rem;color:#475569;">
                Paid via <strong>${d.fine_payment_method || 'Cash'}</strong>
                ${d.fine_payment_reference ? `• Ref: <code>${d.fine_payment_reference}</code>` : ''}
                ${d.fine_paid_by ? `• Received by: <strong>${d.fine_paid_by}</strong>` : ''}
                ${d.fine_payment_remarks ? `<br><em>${d.fine_payment_remarks}</em>` : ''}
              </div>
            ` : ''}
            <div>Action Taken: <strong style="color: #1E293B;">${d.action_taken || 'Documented on record'}</strong></div>
            ${d.resolution_notes ? `<div>Resolution Notes: <em>"${d.resolution_notes}"</em></div>` : ''}
          </div>

          <!-- Actions Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E2E8F0; padding-top: 0.75rem; margin-top: 0.25rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${canManage ? `
                <button type="button" class="btn btn-outline-danger btn-xs" id="btn-modal-delete-inc" style="color: #DC2626; border-color: #FCA5A5; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border-radius: 7px; padding: 0.35rem 0.65rem;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Delete
                </button>
              ` : ''}
              ${d.monetary_fine > 0 && d.fine_payment_status !== 'paid' && canManage ? `
                <button type="button" class="btn btn-xs" id="btn-modal-settle-fine" style="background:#F59E0B;border:1.5px solid #F59E0B;color:#FFF;font-weight:700;border-radius:7px;padding:0.35rem 0.65rem;display:inline-flex;align-items:center;gap:4px;">
                  💳 Settle Fine
                </button>
              ` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button type="button" class="btn btn-outline" id="btn-modal-close-inc">Close</button>
              ${canManage && !isRes ? `
                <button type="button" class="btn btn-success" id="btn-modal-resolve-inc" style="background: #059669; border-color: #059669; font-weight: 700; color: #FFFFFF;">
                  Mark as Resolved
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-modal-close-inc')?.addEventListener('click', close);

        modalBody.querySelector('#btn-modal-resolve-inc')?.addEventListener('click', () => {
          close();
          openResolveIncidentModal(id);
        });

        modalBody.querySelector('#btn-modal-delete-inc')?.addEventListener('click', () => {
          close();
          confirmDeleteIncident(id);
        });

        modalBody.querySelector('#btn-modal-settle-fine')?.addEventListener('click', () => {
          close();
          openSettleFineModal(id);
        });
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL: RESOLVE INCIDENT
  // -------------------------------------------------------------
  function openResolveIncidentModal(id) {
    const d = displayIncidents.find(item => item.id === id);
    if (!d) return;
    const student = students.find(s => s.id === d.student_id);

    openModal({
      title: `Resolve Incident — ${student?.full_name || 'Student'}`,
      size: 'sm',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <p style="font-size: 0.85rem; color: #475569; margin: 0;">
            Mark violation <strong>"${d.category}"</strong> for <strong>${student?.full_name || 'Student'}</strong> as resolved.
          </p>
          <div class="form-group">
            <label class="form-label">Resolution Notes / Corrective Outcome</label>
            <textarea id="resolve-notes" class="form-control" rows="2" placeholder="e.g. Apology letter submitted, parental counseling completed, fine cleared."></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-resolve">Cancel</button>
            <button type="button" class="btn btn-success" id="btn-confirm-resolve" style="background: #059669; border-color: #059669; font-weight: 700; color: #FFFFFF;">
              Mark Resolved
            </button>
          </div>
        </div>
      `,
      onMount: ({ container: modalBody, close }) => {
        modalBody.querySelector('#btn-cancel-resolve')?.addEventListener('click', close);
        modalBody.querySelector('#btn-confirm-resolve')?.addEventListener('click', async () => {
          const notes = modalBody.querySelector('#resolve-notes')?.value.trim();
          close();
          try {
            await db.updateDisciplineIncident(id, {
              resolution_status: 'Resolved',
              resolution_notes: notes || 'Resolved by warden/admin',
              resolved_at: new Date().toISOString(),
              resolved_by: user?.full_name || 'Staff'
            });
            toast.success('Disciplinary incident marked as resolved.');
            await reloadData();
            renderView();
          } catch (err) {
            toast.error(err.message || 'Error resolving incident');
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // CONFIRM DELETE INCIDENT
  // -------------------------------------------------------------
  function confirmDeleteIncident(id) {
    const d = displayIncidents.find(item => item.id === id);
    if (!d) return;
    const student = students.find(s => s.id === d.student_id);

    const { container: deleteModal, close: closeDeleteModal } = openModal({
      title: 'Delete Disciplinary Record',
      size: 'sm',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem 0;">
          <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.85rem; color: #991B1B;">
            <div style="font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Permanent Data Deletion
            </div>
            <p style="font-size: 0.82rem; margin: 0.4rem 0 0; line-height: 1.45; color: #7F1D1D;">
              Are you sure you want to permanently delete this disciplinary record for <strong>${student?.full_name || 'Student'}</strong>?
            </p>
            <p style="font-size: 0.76rem; margin: 0.35rem 0 0; color: #991B1B;">
              This will completely wipe the incident, reverse the awarded black marks (${d.black_marks_awarded} marks) from the student ledger, and cancel any associated property damage fine.
            </p>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-del-inc">Cancel</button>
            <button type="button" class="btn btn-danger" id="btn-confirm-del-inc" style="background: #DC2626; border-color: #DC2626; font-weight: 700; color: #FFFFFF;">
              Delete Permanently
            </button>
          </div>
        </div>
      `
    });

    deleteModal?.querySelector('#btn-cancel-del-inc')?.addEventListener('click', closeDeleteModal);
    deleteModal?.querySelector('#btn-confirm-del-inc')?.addEventListener('click', async () => {
      closeDeleteModal();
      try {
        await db.deleteDisciplineIncident(id);
        toast.success('Incident deleted and penalties reversed successfully.');
        await reloadData();
        renderView();
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('not found')) {
          await reloadData();
          renderView();
          return;
        }
        toast.error(err.message || 'Error deleting incident record');
      }
    });
  }

  // Initial render
  renderView();
}
