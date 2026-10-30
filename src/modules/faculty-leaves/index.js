import { db } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { openModal } from '../../lib/dialog.js';
import { formatDate, formatTime } from '../../lib/utils.js';

export async function renderFacultyLeavesModule(container, { onNavigate }) {
  const user = getCurrentUser();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || Boolean(user?.is_super_admin);
  const isTeacher = user?.role === 'teacher';

  // Ensure latest data from storage/cloud
  await db.pullCloudKeys(['tps_faculty_leaves', 'tps_users']);

  const [rawLeaves, users] = await Promise.all([
    db.getFacultyLeaves(),
    db.getUsers()
  ]);

  // Filter list of eligible faculty members (teachers, mentors, admins)
  const facultyUsers = users.filter(u => 
    u.role === 'teacher' || u.role === 'mentor' || u.role === 'admin' || u.role === 'super_admin'
  );

  let activeTab = 'all'; // 'all' | 'pending' | 'approved' | 'rejected' | 'today' | 'my'
  let searchQuery = '';
  let selectedFacultyFilter = 'all';

  const todayIso = new Date().toISOString().slice(0, 10);

  function isLeaveMine(l) {
    if (!user) return false;
    const uid = String(user.id || '').trim();
    const uemail = String(user.email || '').trim().toLowerCase();
    const uname = String(user.full_name || user.name || '').trim().toLowerCase();

    const fid = String(l.faculty_id || '').trim();
    const femail = String(l.faculty_email || '').trim().toLowerCase();
    const fname = String(l.faculty_name || '').trim().toLowerCase();

    if (fid && uid && fid === uid) return true;
    if (femail && uemail && femail === uemail) return true;
    if (fname && uname && (fname === uname || fname.includes(uname) || uname.includes(fname))) return true;

    if (l.applied_by?.id && uid && String(l.applied_by.id).trim() === uid) return true;
    if (l.applied_by?.email && uemail && String(l.applied_by.email).trim().toLowerCase() === uemail) return true;

    return false;
  }

  function isLeaveActiveToday(leave) {
    if (leave.status !== 'Approved') return false;
    const start = leave.start_date;
    const end = leave.end_date || leave.start_date;
    return todayIso >= start && todayIso <= end;
  }

  function renderView() {
    // Current leaves list
    const allLeaves = db.get('tps_faculty_leaves') || rawLeaves;

    // STRICT FACULTY SCOPING:
    // Every faculty member can only access their own data.
    // Only Administrators & Super Admins can see all faculty data across the school.
    const leaves = isAdmin ? allLeaves : allLeaves.filter(isLeaveMine);

    // KPI Metrics
    const totalCount = leaves.length;
    const pendingCount = leaves.filter(l => l.status === 'Pending').length;
    const approvedCount = leaves.filter(l => l.status === 'Approved').length;
    const activeTodayCount = leaves.filter(l => isLeaveActiveToday(l)).length;
    const myLeavesCount = allLeaves.filter(isLeaveMine).length;

    // Filter leaves based on active tab, search, and faculty selector
    const filteredLeaves = leaves.filter(l => {
      // Tab filter
      if (activeTab === 'pending' && l.status !== 'Pending') return false;
      if (activeTab === 'approved' && l.status !== 'Approved') return false;
      if (activeTab === 'rejected' && l.status !== 'Rejected') return false;
      if (activeTab === 'today' && !isLeaveActiveToday(l)) return false;
      if (activeTab === 'my') {
        if (!isLeaveMine(l)) return false;
      }

      // Faculty filter (Admin only)
      if (isAdmin && selectedFacultyFilter !== 'all') {
        if (l.faculty_id !== selectedFacultyFilter && l.faculty_email !== selectedFacultyFilter) {
          return false;
        }
      }

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (l.faculty_name || '').toLowerCase().includes(q);
        const reasonMatch = (l.reason || '').toLowerCase().includes(q);
        const typeMatch = (l.leave_type || '').toLowerCase().includes(q);
        const notesMatch = (l.admin_notes || '').toLowerCase().includes(q);
        if (!nameMatch && !reasonMatch && !typeMatch && !notesMatch) return false;
      }

      return true;
    });

    container.innerHTML = `
      <div class="faculty-leaves-container" style="padding-bottom: 2.5rem; max-width: 1300px; margin: 0 auto;">
        
        <!-- Executive Header -->
        <div class="page-header" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
          <div class="page-title-group">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: #ECFDF5; border: 1.5px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
              </div>
              <div>
                <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">Faculty Leave Management</h2>
                <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">Duty Leave, Sick Leave & Official Absence Register • Administrative Attendance Waivers</p>
              </div>
            </div>
          </div>

          <div class="page-actions" style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-open-apply-leave-modal" style="background: #059669; display: flex; align-items: center; gap: 0.45rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Apply Faculty Leave</span>
            </button>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="grid-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          
          <div class="stat-card" style="cursor: pointer;" id="kpi-card-all">
            <div class="stat-header">
              <span class="stat-title">Total Applications</span>
              <div class="stat-icon-wrapper" style="background: #F1F5F9; color: #475569;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
            </div>
            <div class="stat-value" style="font-weight: 800; font-size: 1.6rem; color: #0F172A;">${totalCount}</div>
            <div class="stat-footer">
              <span style="font-size: 0.8rem; color: #64748B;">All recorded leave applications</span>
            </div>
          </div>

          <div class="stat-card" style="cursor: pointer;" id="kpi-card-pending">
            <div class="stat-header">
              <span class="stat-title">Pending Approvals</span>
              <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
            </div>
            <div class="stat-value" style="font-weight: 800; font-size: 1.6rem; color: ${pendingCount > 0 ? '#D97706' : '#0F172A'};">${pendingCount}</div>
            <div class="stat-footer">
              <span style="font-size: 0.8rem; color: ${pendingCount > 0 ? '#D97706' : '#64748B'}; font-weight: ${pendingCount > 0 ? '700' : '400'};">
                ${pendingCount > 0 ? 'Awaiting administrator action' : 'No pending applications'}
              </span>
            </div>
          </div>

          <div class="stat-card" style="cursor: pointer;" id="kpi-card-approved">
            <div class="stat-header">
              <span class="stat-title">Approved Leaves</span>
              <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
            </div>
            <div class="stat-value" style="font-weight: 800; font-size: 1.6rem; color: #059669;">${approvedCount}</div>
            <div class="stat-footer">
              <span style="font-size: 0.8rem; color: #059669; font-weight: 600;">Authorized attendance waivers</span>
            </div>
          </div>

          <div class="stat-card" style="cursor: pointer;" id="kpi-card-today">
            <div class="stat-header">
              <span class="stat-title">Active Today</span>
              <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
            </div>
            <div class="stat-value" style="font-weight: 800; font-size: 1.6rem; color: #2563EB;">${activeTodayCount}</div>
            <div class="stat-footer">
              <span style="font-size: 0.8rem; color: #2563EB; font-weight: 600;">Faculty on authorized duty leave</span>
            </div>
          </div>

        </div>

        <!-- Filter Controls Bar -->
        <div class="card" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
            
            <!-- Segmented Filter Tabs -->
            <div style="display: flex; gap: 0.35rem; background: #F1F5F9; padding: 4px; border-radius: 8px; flex-wrap: wrap;">
              <button class="btn btn-xs ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}" data-tab="all" style="font-weight: 700; border-radius: 6px;">
                All (${totalCount})
              </button>
              <button class="btn btn-xs ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}" data-tab="pending" style="font-weight: 700; border-radius: 6px; ${pendingCount > 0 ? 'color: #D97706;' : ''}">
                Pending (${pendingCount})
              </button>
              <button class="btn btn-xs ${activeTab === 'approved' ? 'btn-primary' : 'btn-ghost'}" data-tab="approved" style="font-weight: 700; border-radius: 6px;">
                Approved (${approvedCount})
              </button>
              <button class="btn btn-xs ${activeTab === 'rejected' ? 'btn-primary' : 'btn-ghost'}" data-tab="rejected" style="font-weight: 700; border-radius: 6px;">
                Rejected
              </button>
              <button class="btn btn-xs ${activeTab === 'today' ? 'btn-primary' : 'btn-ghost'}" data-tab="today" style="font-weight: 700; border-radius: 6px;">
                Active Today (${activeTodayCount})
              </button>
              ${isAdmin ? `
                <button class="btn btn-xs ${activeTab === 'my' ? 'btn-primary' : 'btn-ghost'}" data-tab="my" style="font-weight: 700; border-radius: 6px;">
                  My Leaves (${myLeavesCount})
                </button>
              ` : ''}
            </div>

            <!-- Search and Faculty Filter Group -->
            <div style="display: flex; gap: 0.75rem; align-items: center; flex: 1; max-width: 500px; min-width: 260px;">
              <div style="position: relative; flex: 1;">
                <input type="text" id="faculty-leave-search" class="form-control" placeholder="Search teacher, reason, leave type..." value="${searchQuery}" style="padding-left: 2.2rem; height: 38px; width: 100%; box-sizing: border-box;" />
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>

              ${isAdmin ? `
                <select id="faculty-filter-select" class="form-control" style="height: 38px; width: auto; max-width: 180px; box-sizing: border-box;">
                  <option value="all">All Faculty</option>
                  ${facultyUsers.map(u => `
                    <option value="${u.id}" ${selectedFacultyFilter === u.id ? 'selected' : ''}>${u.full_name || u.email}</option>
                  `).join('')}
                </select>
              ` : ''}
            </div>

          </div>
        </div>

        <!-- Leave Records Stream / Grid -->
        <div id="faculty-leaves-list" style="display: flex; flex-direction: column; gap: 1rem;">
          ${filteredLeaves.length === 0 ? `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: #FAFAFA; border: 1.5px dashed #CBD5E1; border-radius: 16px;">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: #F1F5F9; color: #94A3B8; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: #1E293B; margin-bottom: 0.25rem;">No Faculty Leaves Found</h3>
              <p style="font-size: 0.85rem; color: #64748B; max-width: 420px; margin: 0 auto 1.25rem;">
                ${searchQuery || activeTab !== 'all' ? 'Try adjusting your filters or search terms.' : 'No faculty leave applications have been submitted yet. Faculty members or administrators can apply for duty leaves anytime.'}
              </p>
              <button class="btn btn-outline" id="btn-empty-apply-leave" style="font-weight: 700;">
                + Apply Faculty Leave
              </button>
            </div>
          ` : filteredLeaves.map(leave => {
            const isSingle = !leave.is_multiple_days || leave.start_date === leave.end_date;
            const startDateStr = formatDate(leave.start_date);
            const endDateStr = formatDate(leave.end_date || leave.start_date);
            
            // Calculate total days count
            let daysCount = 1;
            if (!isSingle && leave.start_date && leave.end_date) {
              const diffMs = new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime();
              daysCount = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
            }

            const isPending = leave.status === 'Pending';
            const isApproved = leave.status === 'Approved';
            const isRejected = leave.status === 'Rejected';

            // Distinct status styles: Light orange for pending, Light green for approved
            const cardClass = isPending ? 'is-pending' : isApproved ? 'is-approved' : 'is-rejected';
            const cardBg = isPending ? '#FFF7ED' : isApproved ? '#F0FDF4' : '#FEF2F2';
            const cardBorder = isPending ? '1.5px solid #FED7AA' : isApproved ? '1.5px solid #BBF7D0' : '1.5px solid #FECACA';
            const cardBorderLeft = isPending ? '5px solid #EA580C' : isApproved ? '5px solid #059669' : '5px solid #DC2626';

            const statusBadgeBg = isPending ? '#FFEDD5' : isApproved ? '#DCFCE7' : '#FEE2E2';
            const statusBadgeColor = isPending ? '#C2410C' : isApproved ? '#15803D' : '#DC2626';
            const statusBadgeBorder = isPending ? '#FDBA74' : isApproved ? '#86EFAC' : '#FECACA';

            const avatarBg = '#FFFFFF';
            const avatarBorder = isPending ? '1.5px solid #FDBA74' : isApproved ? '1.5px solid #86EFAC' : '1.5px solid #FCA5A5';
            const avatarColor = isPending ? '#EA580C' : isApproved ? '#059669' : '#DC2626';

            const reasonBoxBg = 'rgba(255, 255, 255, 0.85)';
            const reasonBoxBorder = isPending ? '1px solid #FED7AA' : isApproved ? '1px solid #BBF7D0' : '1px solid #FECACA';
            const dateIconStroke = isPending ? '#EA580C' : isApproved ? '#059669' : '#DC2626';

            return `
              <div class="card faculty-leave-card ${cardClass}" data-leave-id="${leave.id}" style="background: ${cardBg}; border: ${cardBorder}; border-left: ${cardBorderLeft}; border-radius: 16px; margin-bottom: 1rem; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.15s ease, box-shadow 0.15s ease;">
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                  
                  <!-- Left Info Column -->
                  <div style="display: flex; gap: 1rem; flex: 1; min-width: 280px;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: ${avatarBg}; border: ${avatarBorder}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; color: ${avatarColor}; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                      ${leave.faculty_name ? leave.faculty_name.slice(0, 2).toUpperCase() : 'FC'}
                    </div>

                    <div style="flex: 1;">
                      <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                        <h4 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 0;">${leave.faculty_name || 'Faculty Member'}</h4>
                        
                        <span class="badge" style="background: rgba(255, 255, 255, 0.9); color: #475569; border: 1px solid rgba(0,0,0,0.08); font-weight: 700; font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 9999px;">
                          ${leave.leave_type || 'Casual Leave'}
                        </span>

                        <span class="badge" style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; font-weight: 800; font-size: 0.75rem; padding: 0.2rem 0.65rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.3rem;">
                          ${isApproved ? '✓ Approved' : isPending ? '⏱ Pending Approval' : '✕ Rejected'}
                        </span>

                        ${isLeaveActiveToday(leave) ? `
                          <span class="badge" style="background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; font-weight: 800; font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 9999px;">
                            Active Today
                          </span>
                        ` : ''}
                      </div>

                      <!-- Dates & Timings Row -->
                      <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; font-size: 0.85rem; color: #475569; margin-bottom: 0.6rem;">
                        <div style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; color: #0F172A;">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${dateIconStroke}" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          ${isSingle ? startDateStr : `${startDateStr} ➔ ${endDateStr} (${daysCount} Days)`}
                        </div>

                        <div style="display: inline-flex; align-items: center; gap: 0.35rem; color: #64748B;">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>Going: <strong style="color: #0F172A;">${formatTime(leave.departure_time || '08:00')}</strong></span>
                          <span>•</span>
                          <span>Return: <strong style="color: #0F172A;">${formatTime(leave.return_time || '16:30')}</strong></span>
                        </div>
                      </div>

                      <!-- Reason Section -->
                      <div style="background: ${reasonBoxBg}; border-radius: 10px; padding: 0.65rem 0.9rem; margin-bottom: 0.5rem; border: ${reasonBoxBorder};">
                        <p style="margin: 0; font-size: 0.88rem; color: #334155; line-height: 1.45;">
                          ${leave.reason ? `"${leave.reason}"` : '<em style="color: #94A3B8;">No description provided.</em>'}
                        </p>
                      </div>

                      <!-- Audit Notes & Application Footer -->
                      <div style="font-size: 0.76rem; color: #64748B; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
                        <span>Applied by ${leave.applied_by?.name || 'Staff'} on ${formatDate(leave.applied_at?.slice(0, 10))}</span>
                        ${leave.approved_by ? `
                          <span>•</span>
                          <span style="color: ${statusBadgeColor}; font-weight: 700;">
                            ${isApproved ? 'Approved' : 'Rejected'} by ${leave.approved_by?.name || 'Admin'} on ${formatDate(leave.approved_at?.slice(0, 10))}
                          </span>
                        ` : ''}
                        ${leave.admin_notes ? `
                          <span>•</span>
                          <span style="color: #475569;">Admin Remark: <em>${leave.admin_notes}</em></span>
                        ` : ''}
                      </div>

                    </div>
                  </div>

                  <!-- Right Action Buttons Column -->
                  <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; align-self: center;">
                    ${(isAdmin && isPending) ? `
                      <button class="btn btn-sm btn-primary btn-approve-leave" data-id="${leave.id}" style="background: #059669; padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 0.3rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Approve
                      </button>
                      
                      <button class="btn btn-sm btn-outline btn-reject-leave" data-id="${leave.id}" style="color: #DC2626; border-color: #FECACA; padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 0.3rem; background: #FFFFFF;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Reject
                      </button>
                    ` : ''}

                    ${(isAdmin || leave.faculty_id === user?.id || (user?.email && leave.faculty_email === user.email)) ? `
                      <button class="btn btn-sm btn-ghost btn-delete-leave" data-id="${leave.id}" title="Remove leave application" style="color: #94A3B8; padding: 0.35rem 0.6rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    ` : ''}
                  </div>

                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;

    setupEvents();
  }

  function setupEvents() {
    // Open Apply Leave Modal
    container.querySelector('#btn-open-apply-leave-modal')?.addEventListener('click', openApplyLeaveModal);
    container.querySelector('#btn-empty-apply-leave')?.addEventListener('click', openApplyLeaveModal);

    // Filter Tabs
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderView();
      });
    });

    // KPI Cards quick filtering
    container.querySelector('#kpi-card-all')?.addEventListener('click', () => { activeTab = 'all'; renderView(); });
    container.querySelector('#kpi-card-pending')?.addEventListener('click', () => { activeTab = 'pending'; renderView(); });
    container.querySelector('#kpi-card-approved')?.addEventListener('click', () => { activeTab = 'approved'; renderView(); });
    container.querySelector('#kpi-card-today')?.addEventListener('click', () => { activeTab = 'today'; renderView(); });

    // Search input
    const searchInput = container.querySelector('#faculty-leave-search');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderView();
      // Keep focus on search input
      const newSearch = container.querySelector('#faculty-leave-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(searchQuery.length, searchQuery.length);
      }
    });

    // Faculty dropdown filter
    container.querySelector('#faculty-filter-select')?.addEventListener('change', (e) => {
      selectedFacultyFilter = e.target.value;
      renderView();
    });

    // Approve Leave Button
    container.querySelectorAll('.btn-approve-leave').forEach(btn => {
      btn.addEventListener('click', async () => {
        const leaveId = btn.getAttribute('data-id');
        if (!leaveId) return;
        btn.disabled = true;
        btn.textContent = 'Approving...';
        await db.updateFacultyLeaveStatus(leaveId, 'Approved', user, 'Approved by Administrator');
        toast.success('Faculty leave approved successfully. Attendance waiver is now active.');
        renderView();
      });
    });

    // Reject Leave Button
    container.querySelectorAll('.btn-reject-leave').forEach(btn => {
      btn.addEventListener('click', async () => {
        const leaveId = btn.getAttribute('data-id');
        if (!leaveId) return;
        const note = prompt('Optional rejection reason / remark:');
        if (note === null) return; // user cancelled prompt
        btn.disabled = true;
        btn.textContent = 'Rejecting...';
        await db.updateFacultyLeaveStatus(leaveId, 'Rejected', user, note || 'Application rejected by Administrator');
        toast.info('Faculty leave application marked as rejected.');
        renderView();
      });
    });

    // Delete Leave Button
    container.querySelectorAll('.btn-delete-leave').forEach(btn => {
      btn.addEventListener('click', async () => {
        const leaveId = btn.getAttribute('data-id');
        if (!leaveId) return;
        if (confirm('Are you sure you want to delete this faculty leave record?')) {
          await db.deleteFacultyLeave(leaveId);
          toast.success('Faculty leave record removed.');
          renderView();
        }
      });
    });
  }

  // Open Leave Application Modal (matches academic calendar holidays layout)
  function openApplyLeaveModal() {
    let isMultiDayMode = false;
    const defaultDate = todayIso;
    const defaultEndDate = todayIso;

    // Faculty members for selection
    const defaultFacultyId = isAdmin ? (user?.id || 'u-1') : (user?.id || 'u-2');
    const defaultFacultyName = user?.full_name || 'Faculty Member';
    const defaultFacultyEmail = user?.email || '';

    openModal({
      title: 'Apply Faculty Duty / Leave Application',
      contentHtml: `
        <div style="margin-bottom: 0.85rem; max-width: 540px;">
          
          <!-- Single Day vs Multiple Days Switcher Pill (Matching Academic Calendar) -->
          <div style="display: flex; gap: 0.4rem; background: #F1F5F9; padding: 4px; border-radius: 8px; margin-bottom: 1rem;">
            <button type="button" class="btn btn-xs ${!isMultiDayMode ? 'btn-primary' : 'btn-ghost'}" id="modal-tab-single" style="flex: 1; font-weight: 700; border-radius: 6px;">
              Single Day
            </button>
            <button type="button" class="btn btn-xs ${isMultiDayMode ? 'btn-primary' : 'btn-ghost'}" id="modal-tab-multi" style="flex: 1; font-weight: 700; border-radius: 6px;">
              Multiple Days (Date Range)
            </button>
          </div>

          <form id="modal-form-apply-faculty-leave" style="display: flex; flex-direction: column; gap: 0.85rem;">
            
            <!-- Faculty Member Selector -->
            <div>
              <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Faculty Member</label>
              ${isAdmin ? `
                <select id="modal-faculty-selector" class="form-control" style="height: 38px; width: 100%; box-sizing: border-box;" required>
                  ${facultyUsers.map(u => `
                    <option value="${u.id}" data-name="${u.full_name || u.email}" data-email="${u.email || ''}" ${u.id === defaultFacultyId ? 'selected' : ''}>
                      ${u.full_name || u.email} (${u.role || 'Staff'})
                    </option>
                  `).join('')}
                </select>
              ` : `
                <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 0.55rem 0.85rem; font-weight: 700; color: #0F172A; font-size: 0.9rem;">
                  ${defaultFacultyName} (${user?.email || 'Teacher'})
                </div>
                <input type="hidden" id="modal-faculty-selector" value="${defaultFacultyId}" data-name="${defaultFacultyName}" data-email="${defaultFacultyEmail}" />
              `}
            </div>

            <!-- Single Day Input Container -->
            <div id="modal-single-day-box" style="display: ${isMultiDayMode ? 'none' : 'block'}; width: 100%; box-sizing: border-box;">
              <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Leave Date</label>
              <input type="date" id="modal-leave-date" class="form-control" value="${defaultDate}" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" />
            </div>

            <!-- Multiple Days Inputs Container (Equal 50/50 division) -->
            <div id="modal-multi-day-box" style="display: ${isMultiDayMode ? 'block' : 'none'}; width: 100%; box-sizing: border-box;">
              <div class="cal-modal-date-range-grid" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; width: 100%; box-sizing: border-box;">
                <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                  <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Start Date</label>
                  <input type="date" id="modal-leave-start-date" class="form-control" value="${defaultDate}" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" />
                </div>
                <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                  <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">End Date</label>
                  <input type="date" id="modal-leave-end-date" class="form-control" value="${defaultEndDate}" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" />
                </div>
              </div>
            </div>

            <!-- Going Time and Coming Back Time (Equal 50/50 division) -->
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; width: 100%; box-sizing: border-box;">
              <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  Going Time (Departure)
                </label>
                <input type="time" id="modal-departure-time" class="form-control" value="08:00" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" required />
              </div>
              <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  Coming Back Time (Return)
                </label>
                <input type="time" id="modal-return-time" class="form-control" value="16:30" style="height: 38px; width: 100%; min-width: 0; box-sizing: border-box;" required />
              </div>
            </div>

            <!-- Leave Type and Status Row -->
            <div style="display: grid; grid-template-columns: ${isAdmin ? 'repeat(2, minmax(0, 1fr))' : '1fr'}; gap: 0.65rem; width: 100%; box-sizing: border-box;">
              <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Leave Type</label>
                <select id="modal-leave-type" class="form-control" style="height: 38px; width: 100%; box-sizing: border-box;">
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick / Medical Leave">Sick / Medical Leave</option>
                  <option value="Academic Seminar / Duty Leave">Academic Seminar / Duty Leave</option>
                  <option value="Personal Emergency">Personal Emergency</option>
                  <option value="Official Work / Tour">Official Work / Tour</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              ${isAdmin ? `
                <div style="min-width: 0; width: 100%; box-sizing: border-box;">
                  <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Approval Status</label>
                  <select id="modal-leave-status" class="form-control" style="height: 38px; width: 100%; box-sizing: border-box;">
                    <option value="Approved">Approved (Waive Attendance)</option>
                    <option value="Pending">Pending Approval</option>
                  </select>
                </div>
              ` : ''}
            </div>

            <!-- Reason / Description -->
            <div>
              <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Reason for Leave *</label>
              <textarea id="modal-leave-reason" class="form-control" rows="3" placeholder="State the reason for absence (e.g. Attending curriculum training, medical checkup, family wedding)..." style="width: 100%; box-sizing: border-box; resize: vertical;" required></textarea>
            </div>

            ${isAdmin ? `
              <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.3rem;">Administrator Remark (Optional)</label>
                <input type="text" id="modal-admin-notes" class="form-control" placeholder="Optional approval remark or note..." style="height: 38px; width: 100%; box-sizing: border-box;" />
              </div>
            ` : ''}

            <!-- Submit Buttons -->
            <div style="display: flex; gap: 0.65rem; justify-content: flex-end; margin-top: 0.5rem;">
              <button type="button" class="btn btn-outline" id="modal-btn-cancel" style="height: 38px; font-weight: 700;">Cancel</button>
              <button type="submit" class="btn btn-primary" id="modal-btn-submit" style="height: 38px; background: #059669; font-weight: 700;">Submit Leave Application</button>
            </div>

          </form>
        </div>
      `
    });

    // Modal internal elements
    const tabSingle = document.getElementById('modal-tab-single');
    const tabMulti = document.getElementById('modal-tab-multi');
    const singleBox = document.getElementById('modal-single-day-box');
    const multiBox = document.getElementById('modal-multi-day-box');
    const form = document.getElementById('modal-form-apply-faculty-leave');
    const cancelBtn = document.getElementById('modal-btn-cancel');

    tabSingle?.addEventListener('click', () => {
      isMultiDayMode = false;
      tabSingle.className = 'btn btn-xs btn-primary';
      tabMulti.className = 'btn btn-xs btn-ghost';
      if (singleBox) singleBox.style.display = 'block';
      if (multiBox) multiBox.style.display = 'none';
    });

    tabMulti?.addEventListener('click', () => {
      isMultiDayMode = true;
      tabMulti.className = 'btn btn-xs btn-primary';
      tabSingle.className = 'btn btn-xs btn-ghost';
      if (singleBox) singleBox.style.display = 'none';
      if (multiBox) multiBox.style.display = 'block';
    });

    cancelBtn?.addEventListener('click', () => {
      const closeBtn = document.querySelector('.modal-close-btn') || document.querySelector('#modal-close');
      if (closeBtn) closeBtn.click();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      let startDate = '';
      let endDate = '';

      if (isMultiDayMode) {
        startDate = document.getElementById('modal-leave-start-date')?.value;
        endDate = document.getElementById('modal-leave-end-date')?.value;
        if (!startDate || !endDate) {
          toast.error('Please specify both Start Date and End Date.');
          return;
        }
        if (endDate < startDate) {
          toast.error('End Date cannot be earlier than Start Date.');
          return;
        }
      } else {
        startDate = document.getElementById('modal-leave-date')?.value;
        endDate = startDate;
        if (!startDate) {
          toast.error('Please specify the Leave Date.');
          return;
        }
      }

      const depTime = document.getElementById('modal-departure-time')?.value || '08:00';
      const retTime = document.getElementById('modal-return-time')?.value || '16:30';
      const leaveType = document.getElementById('modal-leave-type')?.value || 'Casual Leave';
      const reason = document.getElementById('modal-leave-reason')?.value?.trim();
      const adminNotes = document.getElementById('modal-admin-notes')?.value?.trim() || '';

      if (!reason) {
        toast.error('Please provide a reason for the leave.');
        return;
      }

      // Determine selected faculty
      let targetFacultyId = defaultFacultyId;
      let targetFacultyName = defaultFacultyName;
      let targetFacultyEmail = defaultFacultyEmail;

      const facultySelectEl = document.getElementById('modal-faculty-selector');
      if (facultySelectEl) {
        if (facultySelectEl.tagName === 'SELECT') {
          targetFacultyId = facultySelectEl.value;
          const opt = facultySelectEl.options[facultySelectEl.selectedIndex];
          targetFacultyName = opt?.getAttribute('data-name') || opt?.text || 'Faculty Member';
          targetFacultyEmail = opt?.getAttribute('data-email') || '';
        } else {
          targetFacultyId = facultySelectEl.value;
          targetFacultyName = facultySelectEl.getAttribute('data-name') || defaultFacultyName;
          targetFacultyEmail = facultySelectEl.getAttribute('data-email') || defaultFacultyEmail;
        }
      }

      const statusEl = document.getElementById('modal-leave-status');
      const initialStatus = isAdmin ? (statusEl?.value || 'Approved') : 'Pending';

      const submitBtn = document.getElementById('modal-btn-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      try {
        await db.applyFacultyLeave({
          faculty_id: targetFacultyId,
          faculty_name: targetFacultyName,
          faculty_email: targetFacultyEmail,
          is_multiple_days: isMultiDayMode,
          start_date: startDate,
          end_date: endDate,
          departure_time: depTime,
          return_time: retTime,
          leave_type: leaveType,
          reason,
          status: initialStatus,
          applied_by: {
            id: user?.id,
            name: user?.full_name || user?.name || 'Staff',
            role: user?.role || 'staff'
          },
          admin_notes: adminNotes
        });

        toast.success(initialStatus === 'Approved' 
          ? 'Faculty leave recorded and approved with attendance waiver.' 
          : 'Faculty leave application submitted for administrator approval.'
        );

        // Close modal
        const closeBtn = document.querySelector('.modal-close-btn') || document.querySelector('#modal-close');
        if (closeBtn) closeBtn.click();

        renderView();
      } catch (err) {
        console.error('Error applying faculty leave:', err);
        toast.error('Failed to submit faculty leave application.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Leave Application';
        }
      }
    });
  }

  // Initial render
  renderView();
}
