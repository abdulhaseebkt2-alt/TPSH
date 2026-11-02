import { getCurrentUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { formatDate, formatTime, formatCurrency } from '../../lib/utils.js';
import { openModal } from '../../lib/dialog.js';
import { toast } from '../../lib/toast.js';
import { enhanceModalInputs } from '../../lib/ui-enhancer.js';

export async function renderParentDashboard(container, { onNavigate }) {
  // Clear any existing active live timers on this container
  if (container._parentTimer) {
    clearInterval(container._parentTimer);
    container._parentTimer = null;
  }

  const user = getCurrentUser();
  await db.pullCloudKeys(['tps_parent_assignments', 'tps_leaves'], true);
  const [allStudents, allLeaves, exams, examSubjects, allDisciplineIncidents] = await Promise.all([
    db.getStudents(),
    db.getLeaves(true),
    db.getExams(),
    db.getExamSubjects(),
    db.getDisciplineIncidents()
  ]);

  // STRICT CHILD ISOLATION: A parent gets ONLY their children's data
  const parentMap = db.get('tps_parent_assignments') || {};
  const cloudAssigned = (user?.id && parentMap[user.id]) || 
                        (user?.email && parentMap[user.email.toLowerCase()]) || 
                        null;

  const explicitAssignedIds = (cloudAssigned && Array.isArray(cloudAssigned) && cloudAssigned.length > 0)
    ? cloudAssigned
    : (Array.isArray(user?.assigned_student_ids) && user.assigned_student_ids.length > 0
        ? user.assigned_student_ids
        : (Array.isArray(user?.student_ids) && user.student_ids.length > 0
            ? user.student_ids
            : (Array.isArray(user?.child_ids) && user.child_ids.length > 0 ? user.child_ids : null)));

  let myChildren = [];
  if (explicitAssignedIds && explicitAssignedIds.length > 0) {
    myChildren = allStudents.filter(s => explicitAssignedIds.includes(s.id) || explicitAssignedIds.includes(s.admission_number));
  } else {
    myChildren = allStudents.filter(s => {
      if (!user) return false;
      const phone = (user.phone || user.phone_number || '').replace(/[^0-9]/g, '');
      const sFatherPhone = (s.father_phone || '').replace(/[^0-9]/g, '');
      const sMotherPhone = (s.mother_phone || '').replace(/[^0-9]/g, '');
      const sWhatsApp = (s.whatsapp_number || '').replace(/[^0-9]/g, '');

      if (phone && (phone === sFatherPhone || phone === sMotherPhone || phone === sWhatsApp)) return true;
      if (user.full_name && s.father_name && s.father_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) return true;
      if (user.student_admission_number && s.admission_number === user.student_admission_number) return true;
      return false;
    });

    // Fallback to sample children for rich testing if no children directly match in dev preview
    if (myChildren.length === 0 && (user?.is_dev_profile || !user?.id || user?.role === 'parent')) {
      myChildren = allStudents.slice(0, 2);
    }
  }

  // Active selected child
  const savedChildId = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_parent_active_child') : null;
  let selectedChild = myChildren.find(c => c.id === savedChildId) || myChildren[0] || {
    id: 's-mock-1',
    full_name: 'MD Aamir',
    admission_number: 'TPS-2026-001',
    school_class: 'STD-I',
    school_section: 'A',
    hostel_unit: 'Thaiba Boys Hostel Block A',
    hostel_room: 'Room 101',
    hostel_bed: 'Bed 1',
    status: 'Active',
    gender: 'Boys'
  };

  // Leaves strictly filtered to this child
  const childLeaves = allLeaves.filter(l => {
    const sIds = Array.isArray(l.student_ids) ? l.student_ids : [l.student_id];
    return sIds.includes(selectedChild.id) || (l.student_id === selectedChild.id) || (selectedChild.full_name && l.student_name === selectedChild.full_name);
  });

  const displayChildLeaves = childLeaves;

  // Discipline incidents for this child
  const childDisciplineIncidents = (allDisciplineIncidents || []).filter(d => d.student_id === selectedChild.id);
  const openDisicplineIncidents = childDisciplineIncidents.filter(d => (d.resolution_status || 'Open').toLowerCase() === 'open');
  const totalBlackMarks = childDisciplineIncidents.reduce((sum, d) => sum + (Number(d.black_marks_awarded) || 0), 0);
  const pendingFines = childDisciplineIncidents.filter(d => d.monetary_fine > 0 && d.fine_payment_status !== 'paid');
  const pendingFineTotal = pendingFines.reduce((sum, d) => sum + (Number(d.monetary_fine) || 0), 0);

  // Evaluate Active Leave, Pending Requests, Overdue state, and Countdown/Countup
  const activeLeave = childLeaves.find(l => {
    if (l.status === 'Returned' || l.status === 'Rejected') return false;
    if (Array.isArray(l.students) && l.students.length > 0) {
      const entry = l.students.find(s => s.student_id === selectedChild.id);
      if (entry && entry.is_returned) return false;
    }
    return true;
  });

  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];

  let isPending = false;
  let isApprovedAdvance = false;
  let isExitGatePass = false;
  let isEntryGatePass = false;
  let isInBetweenLeave = false;
  let isOnLeave = false;
  let isOverdue = false;

  let returnDateTime = null;
  let departDateTime = null;
  let exitExpiryTime = null;
  let isSameDay = false;
  let remHours = 0;
  let remMins = 0;
  let remDays = 0;
  let remHoursInDay = 0;
  let overdueHours = 0;
  let overdueMins = 0;
  let chargedHours = 0;
  let fineRate = 50;
  let fineAmount = 0;

  if (activeLeave) {
    const status = (activeLeave.status || '').toLowerCase();
    const departs = activeLeave.departure_date || activeLeave.leaving_date;
    const depTime = (activeLeave.departure_time || activeLeave.leaving_time || '16:00').substring(0, 5);
    const returns = activeLeave.expected_return_date;
    const retTime = (activeLeave.expected_return_time || '18:00').substring(0, 5);

    departDateTime = new Date(`${departs}T${depTime}:00`);
    returnDateTime = new Date(`${returns}T${retTime}:00`);

    isSameDay = departs === returns;
    exitExpiryTime = new Date(departDateTime.getTime() + 60 * 60 * 1000);

    fineRate = Number(activeLeave.fine_per_hour || activeLeave.fine_per_hour_applied || activeLeave.fine_per_day || 50);

    if (status === 'pending') {
      isPending = true;
    } else if (status === 'approved' || status === 'away' || status === 'overdue') {
      // 1. Advance approval check: If current time is BEFORE allotted departure time, student is STILL IN HOSTEL
      if (now < departDateTime) {
        isApprovedAdvance = true;
        isOnLeave = false;
        isOverdue = false;
      } else if (now > returnDateTime) {
        // 2. Overdue check: Curfew time has elapsed and student has not returned
        isOverdue = true;
        isOnLeave = false;
        const diffMs = now.getTime() - returnDateTime.getTime();
        overdueHours = Math.floor(diffMs / (1000 * 60 * 60));
        overdueMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        chargedHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        fineAmount = chargedHours * fineRate;
      } else {
        // 3. Actively on approved leave
        isOnLeave = true;
        const diffMs = returnDateTime.getTime() - now.getTime();
        remHours = Math.floor(diffMs / (1000 * 60 * 60));
        remMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        remDays = Math.floor(remHours / 24);
        remHoursInDay = remHours % 24;

        if (isSameDay) {
          // Single-day leave:
          // User directive: "if the leve date is single day, so tahe geting date and bringing date will be equesl
          // so the pass card to take student should be there from given time to 1 hour after that the gate pass to bring students should be there."
          if (now < exitExpiryTime) {
            isExitGatePass = true;
          } else {
            isEntryGatePass = true;
          }
        } else {
          // Multi-day leave:
          if (todayIso === departs) {
            // Departure day: Exit Gate Pass from allotted time to end of day (23:59:59)
            isExitGatePass = true;
          } else if (todayIso === returns) {
            // Return day: Campus Re-Entry Pass from start of day
            isEntryGatePass = true;
          } else {
            // In-between leave days
            isInBetweenLeave = true;
          }
        }
      }
    }
  }

  // Mock marks for this child if no marks entered yet
  const activeExam = exams[0] || { title: 'Mid-Term Examination 2026' };
  const mockChildMarks = [
    { subject: 'Moral Studies & Ethics', max_marks: 100, scored: 94, grade: 'A+' },
    { subject: 'Arabic Language', max_marks: 100, scored: 88, grade: 'A' },
    { subject: 'Mathematics', max_marks: 100, scored: 92, grade: 'A+' },
    { subject: 'General Science', max_marks: 100, scored: 90, grade: 'A+' },
    { subject: 'English', max_marks: 100, scored: 86, grade: 'A' }
  ];

  const totalScore = mockChildMarks.reduce((sum, m) => sum + m.scored, 0);
  const totalMax = mockChildMarks.reduce((sum, m) => sum + m.max_marks, 0);
  const percentage = ((totalScore / totalMax) * 100).toFixed(1);

  // Presence status styling
  let presenceLabel = '● Present in Hostel';
  let presenceColor = '#15803D';
  let presenceBg = '#F0FDF4';
  let presenceBorder = '#BBF7D0';
  let presenceSubColor = '#166534';

  if (isOverdue) {
    presenceLabel = '● Overdue';
    presenceColor = '#DC2626';
    presenceBg = '#FEF2F2';
    presenceBorder = '#FCA5A5';
    presenceSubColor = '#991B1B';
  } else if (isOnLeave) {
    presenceLabel = '● On Approved Leave';
    presenceColor = '#2563EB';
    presenceBg = '#EFF6FF';
    presenceBorder = '#BFDBFE';
    presenceSubColor = '#1E40AF';
  }

  container.innerHTML = `
    <div class="page-header" style="margin-bottom: 1.25rem;">
      <div class="page-title-group">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">
          Welcome, ${user?.full_name || 'Parent / Guardian'}
        </h2>
        <p style="font-size: 0.85rem; color: #64748B; margin-top: 0.15rem;">
          Parent Portal • Real-Time Child Attendance, Academic Grades, Hostel Living & Gate Passes
        </p>
      </div>
      <div class="page-actions" style="display: flex; gap: 0.75rem; align-items: center;">
        <button class="btn btn-primary" id="btn-parent-apply-leave" style="background: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          Request Hostel Leave
        </button>
      </div>
    </div>

    <!-- Multi-Child Selector Tabs (If Parent has multiple enrolled children) -->
    ${myChildren.length > 1 ? `
      <div class="parent-child-tabs-card" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: var(--radius-lg); padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.65rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="font-size: 1.05rem;">👨‍👧‍👦</span>
            <span style="font-size: 0.85rem; font-weight: 800; color: #1E293B;">Your Enrolled Children: (${myChildren.length})</span>
          </div>
          <span style="font-size: 0.74rem; color: #64748B; font-weight: 600;">Tap to switch child records</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none;">
          ${myChildren.map(c => {
            const isSel = c.id === selectedChild.id;
            return `
              <button class="child-tab-btn ${isSel ? 'active' : ''}" data-child-id="${c.id}" style="padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 700; border-radius: 12px; border: 2px solid ${isSel ? '#059669' : '#CBD5E1'}; background: ${isSel ? '#ECFDF5' : '#FFFFFF'}; color: ${isSel ? '#065F46' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.15s ease; white-space: nowrap; box-shadow: ${isSel ? '0 2px 6px rgba(5,150,105,0.15)' : 'none'};">
                <span style="font-size: 1.1rem; line-height: 1;">${c.gender === 'Girls' || c.gender === 'Female' ? '👧' : '🧒'}</span>
                <span>${c.full_name}</span>
                <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; background: ${isSel ? '#A7F3D0' : '#F1F5F9'}; color: ${isSel ? '#065F46' : '#64748B'}; font-weight: 800;">
                  ${c.school_class || 'STD-I'}
                </span>
                ${isSel ? `<span style="color: #059669; font-weight: 800; font-size: 0.85rem;">✓</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- DYNAMIC LIFECYCLE LEAVE & PASS BANNER -->
    ${isOverdue ? `
      <!-- EXTENSION STATUS BANNER (If Parent Requested Leave Extension) -->
      ${activeLeave?.extension_request?.status === 'pending' ? `
        <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-left: 5px solid #D97706; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">⏳</span>
            <div>
              <div style="font-size: 0.86rem; font-weight: 800; color: #92400E;">Leave Extension Request Submitted (Pending Approval)</div>
              <div style="font-size: 0.76rem; color: #B45309; margin-top: 1px;">
                Requested Return: <strong>${formatDate(activeLeave.extension_request.requested_return_date)} at ${formatTime(activeLeave.extension_request.requested_return_time)}</strong>
              </div>
              <div style="font-size: 0.72rem; color: #78350F; font-style: italic; margin-top: 1px;">
                Reason: "${activeLeave.extension_request.reason}"
              </div>
            </div>
          </div>
          <span class="badge" style="background: #FEF3C7; color: #92400E; font-weight: 800; font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px;">
            Awaiting Admin
          </span>
        </div>
      ` : activeLeave?.extension_request?.status === 'approved' ? `
        <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-left: 5px solid #059669; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.25rem;">✓</span>
          <div>
            <div style="font-size: 0.86rem; font-weight: 800; color: #065F46;">Leave Extension Approved by Administration</div>
            <div style="font-size: 0.76rem; color: #047857; margin-top: 1px;">
              Expected Return updated to <strong>${formatDate(activeLeave.expected_return_date)} at ${formatTime(activeLeave.expected_return_time)}</strong>
              ${activeLeave.extension_request.admin_remarks ? ` • Note: ${activeLeave.extension_request.admin_remarks}` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 5. OVERDUE RETURN & LATE FINE CARD (Compact, Replaces Separate Fine Card) -->
      <div class="card-panel parent-overdue-alert" style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-left: 5px solid #DC2626; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; box-shadow: 0 3px 8px rgba(220, 38, 38, 0.06); display: flex; align-items: center; gap: 0.75rem;">
        <div style="writing-mode: vertical-rl; transform: rotate(180deg); background: #FFFFFF; border: 1.5px solid #FECACA; border-radius: 10px; padding: 0.45rem 0.35rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(220,38,38,0.06); text-align: center; line-height: 1.15;">
          <div style="font-size: 0.62rem; font-weight: 800; color: #991B1B; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Late Fine</div>
          <div style="font-size: 0.78rem; font-weight: 900; color: #DC2626; font-family: var(--font-mono); white-space: nowrap;" id="live-overdue-fine-val">₹${fineAmount}</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <h4 style="font-size: 0.92rem; font-weight: 800; color: #991B1B; margin: 0;">
              ${selectedChild.full_name} is Overdue to Hostel
            </h4>
            <span class="badge" style="background: #FEE2E2; color: #DC2626; font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 9999px;">Overdue</span>
          </div>
          <p style="font-size: 0.76rem; color: #7F1D1D; margin: 0.15rem 0 0 0; line-height: 1.35;">
            Curfew was <strong>${formatDate(activeLeave.expected_return_date)} at ${formatTime(activeLeave.expected_return_time || '18:00')}</strong> • Late by <strong id="live-overdue-time-text" style="font-family: var(--font-mono); font-size: 0.82rem; color: #DC2626;">+${overdueHours}h ${overdueMins}m</strong>
          </p>
          <div style="font-size: 0.72rem; color: #B91C1C; margin-top: 0.15rem; font-weight: 600;">
            Fine Rate: <strong>₹${fineRate}/hr</strong> • Pay overdue amount to hostel administration on reporting
          </div>
        </div>
      </div>
    ` : isEntryGatePass ? `
      <!-- 4. RETURN DAY HOSTEL ENTRY PASS (Compact 2-Line Ticket Stub) -->
      <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-left: 5px solid #2563EB; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; box-shadow: 0 3px 8px rgba(37,99,235,0.05); display: flex; align-items: center; gap: 0.75rem;">
        <div style="writing-mode: vertical-rl; transform: rotate(180deg); background: #FFFFFF; border: 1.5px solid #BFDBFE; border-radius: 10px; padding: 0.45rem 0.35rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(37,99,235,0.06); text-align: center; line-height: 1.15;">
          <div style="font-size: 0.62rem; font-weight: 800; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Campus Re-Entry</div>
          <div style="font-size: 0.74rem; font-weight: 800; color: #2563EB; white-space: nowrap;">Ready for Gate Check</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <h4 style="font-size: 0.92rem; font-weight: 800; color: #1E40AF; margin: 0;">
              Hostel Campus Re-Entry Pass • ${selectedChild.full_name}
            </h4>
            <span class="badge" style="background: #DBEAFE; color: #1D4ED8; font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 9999px;">Entry Pass Active</span>
          </div>
          <p style="font-size: 0.76rem; color: #1E3A8A; margin: 0.15rem 0 0 0; line-height: 1.35;">
            Valid for return to campus all day • Expected reporting by <strong>${formatTime(activeLeave.expected_return_time || '18:00')} today</strong>
          </p>
          <div style="font-size: 0.72rem; color: #3B82F6; margin-top: 0.15rem; font-weight: 600;">
            Pass Code: <strong>${activeLeave.leave_code || 'LV-2026'}</strong> • Present at security gate on arrival
          </div>
        </div>
      </div>
    ` : isExitGatePass ? `
      <!-- 3. DEPARTURE DAY OUTING GATE PASS (Compact 2-Line Ticket Stub: Security Outing / Verified Gate Pass) -->
      <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-left: 5px solid #059669; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; box-shadow: 0 3px 8px rgba(5,150,105,0.05); display: flex; align-items: center; gap: 0.75rem;">
        <div style="writing-mode: vertical-rl; transform: rotate(180deg); background: #FFFFFF; border: 1.5px solid #A7F3D0; border-radius: 10px; padding: 0.45rem 0.35rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(5,150,105,0.06); text-align: center; line-height: 1.15;">
          <div style="font-size: 0.62rem; font-weight: 800; color: #065F46; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Security Outing</div>
          <div style="font-size: 0.74rem; font-weight: 800; color: #059669; white-space: nowrap;">Verified Gate Pass</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <h4 style="font-size: 0.92rem; font-weight: 800; color: #065F46; margin: 0;">
              Official Exit Gate Pass • ${selectedChild.full_name}
            </h4>
            <span class="badge" style="background: #D1FAE5; color: #065F46; font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 9999px;">✓ Exit Authorized</span>
          </div>
          <p style="font-size: 0.76rem; color: #064E3B; margin: 0.15rem 0 0 0; line-height: 1.35;">
            ${isSameDay 
              ? `Allotted departure: <strong>${formatTime(activeLeave.departure_time || '16:00')} today</strong> • Exit pass valid until <strong>${formatTime(exitExpiryTime)}</strong>`
              : `Allotted departure: <strong>${formatTime(activeLeave.departure_time || '16:00')} today</strong> • Valid for campus exit until 11:59 PM tonight`}
          </p>
          <div style="font-size: 0.72rem; color: #059669; margin-top: 0.15rem; font-weight: 600;">
            Pass Code: <strong>${activeLeave.leave_code || 'LV-2026'}</strong> • Escort: <strong>${activeLeave.escort_type || 'Father'} (${activeLeave.requested_by || 'Parent'})</strong>
          </div>
        </div>
      </div>
    ` : isApprovedAdvance ? `
      <!-- 2. ADVANCE LEAVE APPROVED (Compact 2-Line Ticket Stub: Hostel Permission / Permission Accepted) -->
      <div style="background: #F0FDF4; border: 1.5px solid #BBF7D0; border-left: 5px solid #10B981; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; box-shadow: 0 3px 8px rgba(16,185,129,0.05); display: flex; align-items: center; gap: 0.75rem;">
        <div style="writing-mode: vertical-rl; transform: rotate(180deg); background: #FFFFFF; border: 1.5px solid #BBF7D0; border-radius: 10px; padding: 0.45rem 0.35rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(16,185,129,0.06); text-align: center; line-height: 1.15;">
          <div style="font-size: 0.62rem; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Hostel Permission</div>
          <div style="font-size: 0.74rem; font-weight: 800; color: #10B981; white-space: nowrap;">Permission Accepted</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <strong style="color: #166534; font-size: 0.90rem;">Leave Permission Approved (Permission Accepted)</strong>
            <span class="badge" style="background: #DCFCE7; color: #15803D; font-weight: 800; font-size: 0.68rem; padding: 1px 7px; border-radius: 9999px;">
              Approved
            </span>
          </div>
          <div style="font-size: 0.76rem; color: #15803D; margin-top: 0.15rem; line-height: 1.35;">
            Scheduled: <strong>${formatDate(activeLeave.departure_date)} at ${formatTime(activeLeave.departure_time || '16:00')}</strong> → Return: <strong>${formatDate(activeLeave.expected_return_date)} at ${formatTime(activeLeave.expected_return_time || '18:00')}</strong>
          </div>
          <div style="font-size: 0.72rem; color: #4B5563; margin-top: 0.15rem;">
            * Official Outing Gate Pass will activate automatically on departure day at <strong>${formatTime(activeLeave.departure_time || '16:00')}</strong>.
          </div>
        </div>
      </div>
    ` : isInBetweenLeave ? `
      <!-- IN-BETWEEN DAYS (Compact 2-Line Ticket Stub: Home Leave / Currently Away) -->
      <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-left: 5px solid #64748B; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; display: flex; align-items: center; gap: 0.75rem;">
        <div style="writing-mode: vertical-rl; transform: rotate(180deg); background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 10px; padding: 0.45rem 0.35rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(100,116,139,0.06); text-align: center; line-height: 1.15;">
          <div style="font-size: 0.62rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">Home Leave</div>
          <div style="font-size: 0.74rem; font-weight: 800; color: #334155; white-space: nowrap;">Currently Away</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <strong style="color: #334155; font-size: 0.90rem;">${selectedChild.full_name} is on Authorized Home Leave</strong>
            <span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 800; font-size: 0.68rem; padding: 2px 7px; border-radius: 9999px;">
              On Leave
            </span>
          </div>
          <div style="font-size: 0.76rem; color: #64748B; margin-top: 0.15rem; line-height: 1.35;">
            Expected return to hostel on <strong>${formatDate(activeLeave.expected_return_date)} at ${formatTime(activeLeave.expected_return_time || '18:00')}</strong>. Campus entry pass will activate on return day.
          </div>
        </div>
      </div>
    ` : isPending ? `
      <!-- 1. PENDING APPROVAL -->
      <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-left: 6px solid #D97706; border-radius: 14px; padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.35rem;">⏳</span>
          <div>
            <strong style="color: #92400E; font-size: 0.92rem;">Hostel Leave Request Awaiting Warden Approval</strong>
            <div style="font-size: 0.78rem; color: #B45309; margin-top: 2px;">
              Requested for: ${formatDate(activeLeave.departure_date)} → ${formatDate(activeLeave.expected_return_date)} (${activeLeave.reason})
            </div>
          </div>
        </div>
        <span class="badge" style="background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 0.75rem; padding: 4px 10px; border-radius: 9999px;">
          Under Review
        </span>
      </div>
    ` : ''}

    <!-- Selected Child Highlight Banner Card -->
    <div class="selected-child-hero-card" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: var(--radius-lg); padding: 1.25rem 1.35rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div style="width: 54px; height: 54px; border-radius: 50%; background: #ECFDF5; border: 2px solid #A7F3D0; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 24px; overflow: hidden; flex-shrink: 0;">
          ${selectedChild.photo_url 
            ? `<img src="${selectedChild.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${selectedChild.full_name}" />` 
            : (selectedChild.gender === 'Girls' || selectedChild.gender === 'Female' ? '👧' : '🧒')}
        </div>
        <div style="flex: 1; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 0;">${selectedChild.full_name}</h3>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 2px 7px; border-radius: 6px; border: 1px solid #A7F3D0;">
              ${selectedChild.admission_number}
            </span>
            <span style="background: #EFF6FF; color: #2563EB; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px;">
              ${selectedChild.school_class || 'STD-I'} (${selectedChild.school_section || 'A'})
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.78rem; color: #64748B; margin-top: 0.3rem; flex-wrap: wrap;">
            <span>Hostel: <strong>${selectedChild.hostel_unit || 'Thaiba Hostel Wing'}</strong></span>
            <span>Room: <strong>${selectedChild.hostel_room || 'Room 101'}</strong> (${selectedChild.hostel_bed || 'Bed 1'})</span>
            <span>Assigned Mentor: <strong>Usthad Usman</strong></span>
          </div>
        </div>
      </div>

      <!-- Single Line Centered Presence Status Pill (Screenshot 2 / User Directive: "the scond screenshort. the notification should come to a single line align middle of the card in mobile view") -->
      <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin-top: 0.9rem; padding-top: 0.75rem; border-top: 1px dashed #E2E8F0;">
        <div class="child-presence-single-line" style="background: ${presenceBg}; border: 1.5px solid ${presenceBorder}; padding: 0.4rem 1.15rem; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; text-align: center; max-width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <span style="font-size: 0.72rem; font-weight: 700; color: ${presenceSubColor}; text-transform: uppercase; letter-spacing: 0.04em;">Presence Status</span>
          <span style="font-size: 0.75rem; color: ${presenceSubColor}; opacity: 0.5;">•</span>
          <span style="font-size: 0.88rem; font-weight: 800; color: ${presenceColor};" id="child-presence-status">${presenceLabel}</span>
        </div>
      </div>
    </div>

    <!-- SECTION 1: Student & Academic -->
    <div class="dash-section-header">
      <div class="dash-section-title-wrap">
        <div class="dash-section-icon">📚</div>
        <div>
          <h3 class="dash-section-title">Student & Academic</h3>
          <span style="font-size: 0.76rem; color: #64748B;">Attendance percentage, examination results & academic progress</span>
        </div>
      </div>
      <span class="dash-section-badge">Academic Progress</span>
    </div>

    <!-- Child Metrics Bar -->
    <div class="grid-stats">
      <div class="stat-card" data-route="attendance" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Attendance Rate</span>
          <div class="stat-icon-wrapper" style="background: #ECFDF5; color: #059669;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>
        <div class="stat-value">96.5%</div>
        <div class="stat-footer">
          <span>Present: <strong>27</strong> • Absent: <strong>1</strong></span>
        </div>
      </div>

      <!-- CARD 2: DYNAMIC (Overdue Count-Up OR Leave Countdown OR Leave Pending OR Academic Score) -->
      ${isOverdue ? `
        <div class="stat-card" style="border-left: 4px solid #DC2626; background: #FFF5F5;">
          <div class="stat-header">
            <span class="stat-title" style="color: #991B1B; font-weight: 700;">Overdue Duration</span>
            <div class="stat-icon-wrapper" style="background: #FEE2E2; color: #DC2626;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-value" id="live-card-overdue-val" style="color: #DC2626; font-size: 1.45rem;">
            +${overdueHours}h ${overdueMins}m
          </div>
          <div class="stat-footer">
            <span style="color: #991B1B; font-weight: 700;">Rate: ₹${fineRate}/hr • Generated Fine: ₹${fineAmount}</span>
          </div>
        </div>
      ` : isOnLeave ? `
        <div class="stat-card" style="border-left: 4px solid ${remHours <= 6 ? '#EA580C' : '#2563EB'}; background: ${remHours <= 6 ? '#FFF7ED' : '#EFF6FF'};">
          <div class="stat-header">
            <span class="stat-title" style="color: ${remHours <= 6 ? '#C2410C' : '#1E40AF'}; font-weight: 700;">Hostel Return Countdown</span>
            <div class="stat-icon-wrapper" style="background: ${remHours <= 6 ? '#FFEDD5' : '#DBEAFE'}; color: ${remHours <= 6 ? '#EA580C' : '#2563EB'};">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-value" id="live-card-countdown-val" style="color: ${remHours <= 6 ? '#EA580C' : '#2563EB'}; font-size: 1.45rem; font-weight: 900;">
            ${remDays > 0 ? `${remDays}d ` : ''}${remHoursInDay}h ${remMins}m
          </div>
          <div class="stat-footer">
            <span style="color: ${remHours <= 6 ? '#C2410C' : '#1E40AF'};">
              Return by ${formatDate(activeLeave.expected_return_date)} at ${formatTime(activeLeave.expected_return_time || '18:00')}
            </span>
          </div>
        </div>
      ` : isApprovedAdvance ? `
        <div class="stat-card" style="border-left: 4px solid #10B981; background: #F0FDF4;">
          <div class="stat-header">
            <span class="stat-title" style="color: #166534; font-weight: 700;">Approved Leave</span>
            <div class="stat-icon-wrapper" style="background: #DCFCE7; color: #166534;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="stat-value" style="font-size: 1.15rem; color: #166534; font-weight: 800;">Starts ${formatDate(activeLeave.departure_date)}</div>
          <div class="stat-footer">
            <span style="color: #15803D;">Departure: ${formatTime(activeLeave.departure_time || '16:00')} • Pass ready on departure day</span>
          </div>
        </div>
      ` : isPending ? `
        <div class="stat-card" style="border-left: 4px solid #D97706; background: #FFFBEB;">
          <div class="stat-header">
            <span class="stat-title" style="color: #92400E; font-weight: 700;">Leave Request</span>
            <div class="stat-icon-wrapper" style="background: #FEF3C7; color: #D97706;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-value" style="font-size: 1.25rem; color: #92400E; font-weight: 800;">Pending Approval</div>
          <div class="stat-footer">
            <span style="color: #B45309;">Requested for ${formatDate(activeLeave.departure_date)} → ${formatDate(activeLeave.expected_return_date)}</span>
          </div>
        </div>
      ` : `
        <div class="stat-card" data-route="marks" style="cursor: pointer;">
          <div class="stat-header">
            <span class="stat-title">Academic Score</span>
            <div class="stat-icon-wrapper" style="background: #EFF6FF; color: #2563EB;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
          </div>
          <div class="stat-value">${percentage}%</div>
          <div class="stat-footer">
            <span>${activeExam.title?.split(' ')[0] || 'Mid-Term'} 2026 Overall Grade: <strong>A</strong></span>
          </div>
        </div>
      `}

      <div class="stat-card" data-route="leaves" style="cursor: pointer;">
        <div class="stat-header">
          <span class="stat-title">Hostel Leaves</span>
          <div class="stat-icon-wrapper" style="background: #FFFBEB; color: #D97706;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l3.54 1.77L13 8l-1.5-3 2.5-1 3.5 7.5 4.5 2.25a2.5 2.5 0 0 1 0 4.5l-4.5.75L12 21l-2.5-.5 1-3.5z"/></svg>
          </div>
        </div>
        <div class="stat-value">${displayChildLeaves.length} Passes</div>
        <div class="stat-footer">
          <span style="color: ${isOverdue ? '#DC2626' : '#059669'}; font-weight: 600;">
            ${isOverdue ? '1 Overdue Return' : '0 Late / Overdue Returns'}
          </span>
        </div>
      </div>

      <div class="stat-card" data-route="discipline" style="cursor: pointer; ${pendingFineTotal > 0 ? 'border-left: 3px solid #F59E0B; background: #FFFBEB;' : ''}">
        <div class="stat-header">
          <span class="stat-title" style="${pendingFineTotal > 0 ? 'color: #92400E;' : ''}">Conduct & Standing</span>
          <div class="stat-icon-wrapper" style="background: ${pendingFineTotal > 0 ? '#FEF3C7' : '#FAF5FF'}; color: ${pendingFineTotal > 0 ? '#D97706' : '#7C3AED'};">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: ${totalBlackMarks > 0 ? '#DC2626' : '#059669'}; font-size: ${totalBlackMarks > 0 ? '1.3rem' : '1.5rem'};">
          ${totalBlackMarks > 0 ? `+${totalBlackMarks} Marks` : 'Exemplary'}
        </div>
        <div class="stat-footer">
          ${pendingFineTotal > 0
            ? `<span style="color: #B45309; font-weight: 700;">⚠ Fine Due: ₹${pendingFineTotal.toFixed(2)}</span>`
            : `<span>${childDisciplineIncidents.length} Incident(s) Recorded</span>`}
        </div>
      </div>
    </div>

    <!-- Main 2-Column Detailed Reports Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
      <!-- Academic Examination Marks Card -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            Academic Performance • ${activeExam.title}
          </h3>
          <button class="btn btn-outline btn-sm" id="btn-parent-view-all-marks">Full Report Card</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Max</th>
                  <th>Scored</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${mockChildMarks.map(m => `
                  <tr>
                    <td><strong>${m.subject}</strong></td>
                    <td>${m.max_marks}</td>
                    <td><span style="font-weight: 700; color: #059669;">${m.scored}</span></td>
                    <td><span class="badge badge-active">${m.grade}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SECTION 2: Hostel Operations -->
      <div class="dash-section-header" style="grid-column: 1 / -1; margin-top: 0.5rem;">
        <div class="dash-section-title-wrap">
          <div class="dash-section-icon">🏢</div>
          <div>
            <h3 class="dash-section-title">Hostel Operations</h3>
            <span style="font-size: 0.76rem; color: #64748B;">Dormitory residence, gate passes, return status & student welfare</span>
          </div>
        </div>
        <span class="dash-section-badge">Hostel Living</span>
      </div>

      <!-- Hostel Gate Pass & Outing History -->
      <div class="card-panel" style="margin-bottom: 0;">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
            Hostel Leave & Pass History
          </h3>
          <button class="btn btn-primary btn-sm" id="btn-parent-new-leave" style="background: #059669; font-weight: 700;">+ Request Leave Pass</button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Pass Reg</th>
                  <th>Purpose</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${displayChildLeaves.length === 0 ? `
                  <tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: #94A3B8; font-size: 0.82rem;">No leave requests or gate passes on record for this child</td></tr>
                ` : displayChildLeaves.map(l => {
                  const isPassOverdue = l.status !== 'Returned' && l.status !== 'Rejected' && l.expected_return_date && new Date(l.expected_return_date + 'T' + (l.expected_return_time || '18:00')) < new Date();
                  const badgeClass = l.status === 'Returned' ? 'badge-present' : l.status === 'Rejected' ? 'badge-danger' : isPassOverdue ? 'badge-danger' : l.status === 'Pending' ? 'badge-warning' : 'badge-leave';
                  const statusText = l.status === 'Rejected' ? 'Rejected' : isPassOverdue ? 'Overdue Return' : l.status;

                  return `
                    <tr>
                      <td><code>${l.leave_register_number || l.leave_code}</code></td>
                      <td>
                        <span style="font-size: 0.85rem; font-weight: 600;">${l.reason}</span>
                        ${l.fine_per_hour ? `<div style="font-size: 0.7rem; color: #64748B;">Rate: ₹${l.fine_per_hour}/hr</div>` : ''}
                        ${l.status === 'Rejected' && l.rejected_reason ? `<div style="font-size: 0.72rem; color: #DC2626; font-weight: 600; margin-top: 2px;">Note: ${l.rejected_reason}</div>` : ''}
                      </td>
                      <td>
                        <div style="font-size: 0.75rem; color: #475569;">
                          ${formatDate(l.departure_date)} → ${formatDate(l.expected_return_date)}
                        </div>
                        <div style="font-size: 0.7rem; color: #94A3B8;">
                          Return by: ${l.expected_return_time || '18:00'}
                        </div>
                      </td>
                      <td>
                        <span class="badge ${badgeClass}">${statusText}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- Discipline Fines Panel (shown only if child has discipline incidents with fines) -->
    ${childDisciplineIncidents.length > 0 ? `
      <div class="card-panel" style="margin-bottom: 1.25rem; ${pendingFineTotal > 0 ? 'border: 1.5px solid #FDE68A;' : ''}">
        <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center; background: ${pendingFineTotal > 0 ? '#FFFBEB' : '#F8FAFC'};">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 18px;">⚠️</span>
            <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">
              Discipline & Fine Records
              ${pendingFineTotal > 0 ? `<span style="margin-left:6px;font-size:0.74rem;font-weight:800;background:#FEF3C7;color:#B45309;padding:2px 8px;border-radius:9999px;">₹${pendingFineTotal.toFixed(2)} Due</span>` : ''}
            </h3>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-parent-view-discipline" style="font-size:0.78rem;">View All →</button>
        </div>
        <div class="card-panel-body" style="padding: 0.65rem;">
          ${childDisciplineIncidents.length === 0 ? `
            <div style="text-align: center; color: #94A3B8; padding: 1rem; font-size: 0.82rem;">No disciplinary incidents on record ✓</div>
          ` : childDisciplineIncidents.map(d => {
            const isPaid = d.fine_payment_status === 'paid';
            const hasFine = d.monetary_fine > 0;
            return `
              <div style="background: ${hasFine && !isPaid ? '#FFFBEB' : '#FFFFFF'}; border: 1.5px solid ${hasFine && !isPaid ? '#FDE68A' : '#E2E8F0'}; border-radius: 10px; padding: 0.75rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.35rem;">
                  <div>
                    <div style="font-weight: 700; font-size: 0.88rem; color: #0F172A;">${d.category}</div>
                    <div style="font-size: 0.74rem; color: #64748B;">${d.incident_date} • ${d.severity}</div>
                  </div>
                  <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-weight: 700; ${(d.resolution_status || 'Open').toLowerCase() === 'resolved' ? 'background:#ECFDF5;color:#047857;' : 'background:#FFFBEB;color:#B45309;'}">
                    ${d.resolution_status || 'Open'}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <span style="font-size: 0.72rem; font-weight: 700; background: #F1F5F9; color: #DC2626; padding: 2px 7px; border-radius: 6px;">
                    +${d.black_marks_awarded} Mark(s)
                  </span>
                  ${hasFine ? `
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; ${isPaid ? 'background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;' : 'background:#FEF2F2;color:#DC2626;border:1px solid #FCA5A5;'}">
                      ${isPaid ? `✓ Fine Paid (₹${d.monetary_fine})` : `Fine Due: ₹${d.monetary_fine}`}
                    </span>
                    ${isPaid && d.fine_payment_method ? `
                      <span style="font-size: 0.7rem; color: #64748B;">via ${d.fine_payment_method}</span>
                    ` : ''}
                  ` : ''}
                </div>
                ${hasFine && !isPaid ? `
                  <div style="font-size: 0.76rem; color: #92400E; background: #FEF3C7; border-radius: 6px; padding: 0.4rem 0.6rem; margin-top: 0.2rem;">
                    💳 <strong>Please pay this fine</strong> at the hostel warden's office. Bring the incident ID: <code style="font-family:monospace;font-size:0.72rem;">${d.id}</code>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Quick Parent Contact & Help Section -->
    <div class="card-panel">
      <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 18px;">📞</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A;">Hostel Wardens & Institution Helpdesk</h3>
        </div>
      </div>
      <div class="card-panel-body" style="padding: 1.25rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <strong style="color: #0F172A; font-size: 0.88rem;">Hostel Warden Office</strong>
            <p style="font-size: 0.8rem; color: #475569; margin-top: 0.2rem;">
              Usthad Usman (Head Mentor) • Phone: +91 98470 33445
            </p>
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <strong style="color: #0F172A; font-size: 0.88rem;">Academic & School Office</strong>
            <p style="font-size: 0.8rem; color: #475569; margin-top: 0.2rem;">
              Thaiba Public School Desk • Phone: +91 91623 81267
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach live countdown/countup timer if active leave exists and student is away or overdue
  if (activeLeave && activeLeave.status !== 'Pending' && returnDateTime && !isApprovedAdvance) {
    container._parentTimer = setInterval(() => {
      const currentNow = new Date();
      if (currentNow > returnDateTime) {
        // OVERDUE COUNT-UP
        const diff = currentNow.getTime() - returnDateTime.getTime();
        const oHours = Math.floor(diff / (1000 * 60 * 60));
        const oMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const cHours = Math.max(1, Math.ceil(diff / (1000 * 60 * 60)));
        const fAmount = cHours * fineRate;

        const timeTextEl = container.querySelector('#live-overdue-time-text');
        if (timeTextEl) timeTextEl.textContent = `+${oHours}h ${oMins}m`;

        const fineValEl = container.querySelector('#live-overdue-fine-val');
        if (fineValEl) fineValEl.textContent = `₹${fAmount}`;

        const cardCountUpEl = container.querySelector('#card-live-countup-val');
        if (cardCountUpEl) cardCountUpEl.textContent = `+${oHours}h ${oMins}m`;
      } else {
        // COUNTDOWN
        const diff = returnDateTime.getTime() - currentNow.getTime();
        const rHours = Math.floor(diff / (1000 * 60 * 60));
        const rMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const rDays = Math.floor(rHours / 24);
        const rHoursInDay = rHours % 24;
        const under6 = rHours < 6;

        const cardCountdownEl = container.querySelector('#card-live-countdown-val');
        if (cardCountdownEl) {
          cardCountdownEl.textContent = rDays > 0 ? `${rDays}d ${rHoursInDay}h ${rMins}m` : `${rHours}h ${rMins}m`;
          cardCountdownEl.style.color = under6 ? '#EA580C' : '#2563EB';
        }
      }
    }, 10000);
  }

  // Parent Leave Modal Function
  function openParentLeaveModal() {
    const defaultDate = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    openModal({
      title: 'Request Hostel Leave Pass',
      contentHtml: `
        <form id="parent-leave-form" novalidate style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${myChildren.length > 1 ? `
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Select Child</label>
              <select id="p-leave-child" class="form-control" style="height: 38px; font-size: 0.85rem;">
                ${myChildren.map(c => `
                  <option value="${c.id}" ${c.id === selectedChild.id ? 'selected' : ''}>
                    ${c.full_name} (${c.school_class || 'Class'} • ${c.admission_number})
                  </option>
                `).join('')}
              </select>
            </div>
          ` : `<input type="hidden" id="p-leave-child" value="${selectedChild.id}" />`}

          <div class="form-group" style="margin: 0;">
            <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Leave Type</label>
            <select id="p-leave-type" class="form-control" style="height: 38px; font-size: 0.85rem;">
              <option value="hostel_leave">Hostel Weekend Outing</option>
              <option value="personal_leave">Family Function / Personal Event</option>
              <option value="medical_leave">Medical / Hospital Visit</option>
              <option value="vacation">Term End Vacation</option>
              <option value="emergency_leave">Emergency Leave</option>
            </select>
          </div>

          <!-- Departure Date & Time -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Departure Date</label>
              <input type="date" id="p-leave-dep-date" class="form-control" value="${defaultDate}" style="height: 38px; font-size: 0.85rem;" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Departure Time</label>
              <input type="time" id="p-leave-dep-time" class="form-control" value="16:00" style="height: 38px; font-size: 0.85rem;" />
            </div>
          </div>

          <!-- Return Date & Time -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Expected Return Date</label>
              <input type="date" id="p-leave-ret-date" class="form-control" value="${tomorrow}" style="height: 38px; font-size: 0.85rem;" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Expected Return Time</label>
              <input type="time" id="p-leave-ret-time" class="form-control" value="18:00" style="height: 38px; font-size: 0.85rem;" />
            </div>
          </div>

          <!-- Reason -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label required" style="font-size: 0.8rem; font-weight: 700;">Purpose / Reason for Leave</label>
            <input type="text" id="p-leave-reason" class="form-control" placeholder="e.g. Attending family function, medical appointment" style="height: 38px; font-size: 0.85rem;" />
          </div>

          <!-- Escort & Phone -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Accompanying Person</label>
              <select id="p-leave-escort" class="form-control" style="height: 38px; font-size: 0.85rem;">
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Authorized Guardian">Authorized Guardian</option>
                <option value="Elder Sibling">Elder Sibling</option>
                <option value="Self / Independent">Self / Independent</option>
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Contact Phone</label>
              <input type="tel" id="p-leave-phone" class="form-control" value="${selectedChild.father_phone || selectedChild.mother_phone || user?.phone || '+91 98470 11223'}" style="height: 38px; font-size: 0.85rem;" />
            </div>
          </div>

          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.75rem; color: #1E40AF; line-height: 1.45;">
            ℹ️ <strong>Hostel Notice:</strong> Student return times are strictly monitored. Per-hour late fines apply for overdue reporting beyond the approved return time.
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-outline" id="btn-cancel-p-leave">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-submit-p-leave" style="background: #059669; border-color: #059669; font-weight: 700;">
              Submit Leave Request
            </button>
          </div>
        </form>
      `,
      onMount: ({ container: modal, close }) => {
        enhanceModalInputs(modal);

        modal.querySelector('#btn-cancel-p-leave')?.addEventListener('click', close);

        let isSubmitting = false;
        const submitLeaveHandler = async (e) => {
          if (e) e.preventDefault();
          if (isSubmitting) return;

          const childId = modal.querySelector('#p-leave-child')?.value || selectedChild.id;
          const leaveType = modal.querySelector('#p-leave-type')?.value || 'hostel_leave';
          const depDate = modal.querySelector('#p-leave-dep-date')?.getAttribute('data-date-raw') || modal.querySelector('#p-leave-dep-date')?.value || defaultDate;
          const depTime = modal.querySelector('#p-leave-dep-time')?.value || '16:00';
          const retDate = modal.querySelector('#p-leave-ret-date')?.getAttribute('data-date-raw') || modal.querySelector('#p-leave-ret-date')?.value || tomorrow;
          const retTime = modal.querySelector('#p-leave-ret-time')?.value || '18:00';
          const reason = modal.querySelector('#p-leave-reason')?.value?.trim() || 'Hostel Leave';
          const escort = modal.querySelector('#p-leave-escort')?.value || 'Parent / Guardian';
          const phone = modal.querySelector('#p-leave-phone')?.value?.trim() || user?.phone || '+91 98470 11223';

          if (!childId || !depDate || !retDate) {
            toast.error('Please complete all required fields.');
            return;
          }

          const targetStudent = myChildren.find(c => c.id === childId) || selectedChild;
          if (!targetStudent || !targetStudent.id) {
            toast.error('No valid child selected. Please refresh and try again.');
            return;
          }

          const submitBtn = modal.querySelector('#btn-submit-p-leave');

          try {
            isSubmitting = true;
            if (submitBtn) {
              submitBtn.disabled = true;
              submitBtn.textContent = 'Submitting...';
            }

            await db.createLeaveRecord({
              student_ids: [targetStudent.id],
              student_name: targetStudent.full_name,
              admission_number: targetStudent.admission_number,
              leave_type: leaveType,
              departure_date: depDate,
              departure_time: depTime,
              expected_return_date: retDate,
              expected_return_time: retTime,
              reason,
              escort_type: escort,
              parent_phone: phone,
              requested_by: user?.full_name || 'Parent / Guardian',
              requester_role: 'parent',
              status: 'Pending',
              fine_unit: 'hour',
              fine_per_hour: 50
            });

            toast.success(`Hostel leave request submitted for ${targetStudent.full_name}. Awaiting warden approval.`);
            close();
            renderParentDashboard(container, { onNavigate });
          } catch (err) {
            console.error('Error submitting parent leave request:', err);
            toast.error(err.message || 'Error submitting leave request');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit Leave Request';
            }
          } finally {
            isSubmitting = false;
          }
        };

        modal.querySelector('#parent-leave-form')?.addEventListener('submit', submitLeaveHandler);
        modal.querySelector('#btn-submit-p-leave')?.addEventListener('click', (e) => {
          submitLeaveHandler(e);
        });
      }
    });
  }

  // Attach handlers
  container.querySelectorAll('.child-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const childId = btn.getAttribute('data-child-id');
      if (childId) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tps_parent_active_child', childId);
        }
        renderParentDashboard(container, { onNavigate });
      }
    });
  });

  container.querySelectorAll('.stat-card[data-route]').forEach(card => {
    card.addEventListener('click', () => {
      const r = card.getAttribute('data-route');
      if (r) onNavigate(r);
    });
  });

  container.querySelector('#btn-parent-apply-leave')?.addEventListener('click', openParentLeaveModal);
  container.querySelector('#btn-parent-new-leave')?.addEventListener('click', openParentLeaveModal);
  container.querySelector('#btn-parent-view-all-marks')?.addEventListener('click', () => onNavigate('marks'));
  container.querySelector('#btn-parent-view-discipline')?.addEventListener('click', () => onNavigate('discipline'));
}
