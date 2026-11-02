/**
 * Reusable Modern Punctuality & Compliance Spline Chart
 * Visualizes:
 * 1. Punctual attendance (recorded within 15 minutes of class start) - Emerald Wave
 * 2. Late attendance (recorded after 15 minutes) - Amber Wave
 * 3. Missed attendance (class scheduled but attendance not submitted) - Rose Wave
 */

import { formatTime, formatDate } from '../lib/utils.js';

export function generatePunctualityChartHtml({
  timelineDays = [], // Array of { dateStr, dayLabel, punctual, late, missed }
  title = 'Attendance Punctuality & Duty Compliance',
  subtitle = '3-line trend: Punctual (≤15 min), Late (>15 min), and Missed sessions',
  compact = false
}) {
  if (!timelineDays || timelineDays.length === 0) {
    return `
      <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 1.5rem; text-align: center; color: #64748B; box-shadow: 0 2px 6px rgba(0,0,0,0.02); margin-bottom: 1.25rem;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem; color: #94A3B8;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        </div>
        <div style="font-size: 0.92rem; font-weight: 800; color: #1E293B;">No Attendance Data Recorded</div>
        <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">Attendance punctuality will display here as classes are conducted.</div>
      </div>
    `;
  }

  // Calculate totals
  const totalPunctual = timelineDays.reduce((sum, d) => sum + (d.punctual || 0), 0);
  const totalLate = timelineDays.reduce((sum, d) => sum + (d.late || 0), 0);
  const totalMissed = timelineDays.reduce((sum, d) => sum + (d.missed || 0), 0);
  const totalSessions = totalPunctual + totalLate + totalMissed;

  const punctualPct = totalSessions > 0 ? Math.round((totalPunctual / totalSessions) * 100) : 0;
  const latePct = totalSessions > 0 ? Math.round((totalLate / totalSessions) * 100) : 0;
  const missedPct = totalSessions > 0 ? Math.round((totalMissed / totalSessions) * 100) : 0;

  // Chart dimensions
  const svgWidth = 600;
  const svgHeight = compact ? 190 : 220;
  const paddingLeft = 32;
  const paddingRight = 20;
  const paddingTop = 28;
  const paddingBottom = 32;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const bottomY = paddingTop + plotHeight;

  // Determine Y Scale
  const maxVal = Math.max(
    1,
    ...timelineDays.map(d => Math.max(d.punctual || 0, d.late || 0, d.missed || 0))
  );
  const yTicksCount = maxVal <= 3 ? maxVal : 4;
  const yMax = Math.ceil(maxVal * 1.15) || 1;

  // Coordinate mapping
  const count = timelineDays.length;
  const getX = (index) => {
    if (count <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (count - 1)) * plotWidth;
  };
  const getY = (val) => {
    return paddingTop + plotHeight - (val / yMax) * plotHeight;
  };

  // Build Points Arrays
  const punctualPoints = timelineDays.map((d, i) => ({ x: getX(i), y: getY(d.punctual || 0), val: d.punctual || 0, date: d.dateStr || d.dayLabel }));
  const latePoints = timelineDays.map((d, i) => ({ x: getX(i), y: getY(d.late || 0), val: d.late || 0, date: d.dateStr || d.dayLabel }));
  const missedPoints = timelineDays.map((d, i) => ({ x: getX(i), y: getY(d.missed || 0), val: d.missed || 0, date: d.dateStr || d.dayLabel }));

  // Clamped Smooth Spline Generator (avoids jagged lines and prevents dips below baseline)
  const generateSpline = (pts) => {
    if (!pts || pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      // Flat on zero line -> straight line
      if (Math.abs(p1.y - bottomY) < 0.1 && Math.abs(p2.y - bottomY) < 0.1) {
        d += ` L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        continue;
      }

      const tension = 0.22;
      const c1x = p1.x + (p2.x - p0.x) * tension;
      let c1y = p1.y + (p2.y - p0.y) * tension;
      const c2x = p2.x - (p3.x - p1.x) * tension;
      let c2y = p2.y - (p3.y - p1.y) * tension;

      // Clamp so control points never overshoot below the bottom baseline
      if (c1y > bottomY) c1y = bottomY;
      if (c2y > bottomY) c2y = bottomY;
      if (c1y < paddingTop) c1y = paddingTop;
      if (c2y < paddingTop) c2y = paddingTop;

      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Generate Area Fill (Closed under curve to bottomY)
  const generateArea = (pts) => {
    const linePath = generateSpline(pts);
    if (!linePath) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY.toFixed(1)} L ${first.x.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  };

  const punctualPath = generateSpline(punctualPoints);
  const punctualArea = generateArea(punctualPoints);

  const latePath = generateSpline(latePoints);
  const lateArea = generateArea(latePoints);

  const missedPath = generateSpline(missedPoints);
  const missedArea = generateArea(missedPoints);

  // Smart Active Node Badges (ONLY rendered on days where an event occurred > 0)
  const buildActiveNodes = (pts, strokeColor, fillColor, labelText) => {
    return pts.filter(p => p.val > 0).map(p => `
      <g class="graph-active-node" style="cursor: pointer;">
        <!-- Soft Outer Glow Aura -->
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8" fill="${fillColor}" opacity="0.28" />
        <!-- Sharp Inner Beacon -->
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="2.5" />
        <!-- Floating Value Tag -->
        <g transform="translate(${p.x.toFixed(1)}, ${(p.y - 12).toFixed(1)})">
          <rect x="-11" y="-12" width="22" height="13" rx="4" fill="${strokeColor}" />
          <text x="0" y="-3.5" text-anchor="middle" font-size="8.5" font-weight="800" fill="#FFFFFF" font-family="sans-serif">${p.val}</text>
        </g>
        <title>Day ${p.date}: ${p.val} ${labelText} session(s)</title>
      </g>
    `).join('');
  };

  // Horizontal Grid Lines with delicate styling
  const gridLines = [];
  for (let i = 0; i <= yTicksCount; i++) {
    const v = Math.round((yMax / yTicksCount) * i);
    const y = getY(v);
    gridLines.push(`
      <line x1="${paddingLeft}" y1="${y.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${y.toFixed(1)}" stroke="#F1F5F9" stroke-width="1.2" stroke-dasharray="3,3" />
      <text x="${paddingLeft - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="600" fill="#94A3B8" font-family="sans-serif">${v}</text>
    `);
  }

  // Baseline track
  const baseline = `
    <line x1="${paddingLeft}" y1="${bottomY.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${bottomY.toFixed(1)}" stroke="#E2E8F0" stroke-width="1.5" />
  `;

  // X Axis Date Ticks (1, 5, 10, 15, 20, 25, end)
  const xLabels = [];
  const step = Math.max(1, Math.floor(count / 6));
  timelineDays.forEach((d, i) => {
    if (i % step === 0 || i === count - 1) {
      const x = getX(i);
      xLabels.push(`
        <text x="${x.toFixed(1)}" y="${svgHeight - 10}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#64748B" font-family="sans-serif">
          ${d.dayLabel || d.dateStr.slice(-2)}
        </text>
        <line x1="${x.toFixed(1)}" y1="${bottomY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(bottomY + 4).toFixed(1)}" stroke="#CBD5E1" stroke-width="1.2" />
      `);
    }
  });

  const chartId = 'punc-chart-' + Math.random().toString(36).substring(2, 7);

  return `
    <div class="punctuality-chart-card" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 18px; padding: 1.15rem 1.25rem; box-shadow: 0 4px 18px -4px rgba(15, 23, 42, 0.05); margin-bottom: 1.5rem;">
      
      <!-- Top Card Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.95rem;">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <div style="width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #ECFDF5 0%, #EFF6FF 100%); border: 1.5px solid #A7F3D0; display: inline-flex; align-items: center; justify-content: center; color: #059669; flex-shrink: 0; box-shadow: 0 1px 3px rgba(5,150,105,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </div>
          <div>
            <h3 style="font-size: 0.98rem; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.25;">${title}</h3>
            <p style="font-size: 0.73rem; color: #64748B; margin: 2px 0 0 0;">${subtitle}</p>
          </div>
        </div>
        <span class="badge" style="background: #F8FAFC; color: #334155; border: 1.5px solid #E2E8F0; font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 5px;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #059669;"></span>
          ${totalSessions} Total Sessions
        </span>
      </div>

      <!-- 3 Metrics Legend Bar (STRICTLY SINGLE LINE ON ALL SCREENS) -->
      <div class="punc-stats-single-line" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 1.15rem; width: 100%; box-sizing: border-box;">
        
        <!-- 1. Punctual Pill Card (≤15m) -->
        <div style="background: linear-gradient(145deg, #F0FDF4 0%, #ECFDF5 100%); border: 1.5px solid #A7F3D0; border-radius: 12px; padding: 0.55rem 0.55rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.25rem; min-width: 0; box-shadow: 0 1px 3px rgba(16, 185, 129, 0.08);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 3px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10B981; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);"></span>
              <span style="font-size: 0.67rem; font-weight: 800; color: #065F46; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Punctual</span>
            </div>
            <span style="font-size: 0.62rem; font-weight: 700; color: #047857; background: #DCFCE7; padding: 1px 5px; border-radius: 9999px; white-space: nowrap; flex-shrink: 0;">≤15m</span>
          </div>
          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px; margin-top: 3px;">
            <span style="font-size: 1.25rem; font-weight: 900; color: #065F46; line-height: 1; font-family: var(--font-mono, monospace);">${totalPunctual}</span>
            <span style="font-size: 0.72rem; font-weight: 800; color: #059669;">${punctualPct}%</span>
          </div>
        </div>

        <!-- 2. Late Pill Card (>15m) -->
        <div style="background: linear-gradient(145deg, #FFFBEB 0%, #FEF3C7 100%); border: 1.5px solid #FDE68A; border-radius: 12px; padding: 0.55rem 0.55rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.25rem; min-width: 0; box-shadow: 0 1px 3px rgba(245, 158, 11, 0.08);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 3px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);"></span>
              <span style="font-size: 0.67rem; font-weight: 800; color: #92400E; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Late</span>
            </div>
            <span style="font-size: 0.62rem; font-weight: 700; color: #B45309; background: #FEF3C7; padding: 1px 5px; border-radius: 9999px; white-space: nowrap; flex-shrink: 0;">>15m</span>
          </div>
          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px; margin-top: 3px;">
            <span style="font-size: 1.25rem; font-weight: 900; color: #92400E; line-height: 1; font-family: var(--font-mono, monospace);">${totalLate}</span>
            <span style="font-size: 0.72rem; font-weight: 800; color: #D97706;">${latePct}%</span>
          </div>
        </div>

        <!-- 3. Missed Pill Card (Losen) -->
        <div style="background: linear-gradient(145deg, #FEF2F2 0%, #FFF1F2 100%); border: 1.5px solid #FECDD3; border-radius: 12px; padding: 0.55rem 0.55rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.25rem; min-width: 0; box-shadow: 0 1px 3px rgba(239, 68, 68, 0.08);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 3px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #EF4444; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);"></span>
              <span style="font-size: 0.67rem; font-weight: 800; color: #991B1B; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Missed</span>
            </div>
            <span style="font-size: 0.62rem; font-weight: 700; color: #DC2626; background: #FEE2E2; padding: 1px 5px; border-radius: 9999px; white-space: nowrap; flex-shrink: 0;">Losen</span>
          </div>
          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px; margin-top: 3px;">
            <span style="font-size: 1.25rem; font-weight: 900; color: #991B1B; line-height: 1; font-family: var(--font-mono, monospace);">${totalMissed}</span>
            <span style="font-size: 0.72rem; font-weight: 800; color: #DC2626;">${missedPct}%</span>
          </div>
        </div>

      </div>

      <!-- Modern Spline Area Chart Canvas -->
      <div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; background: #FFFFFF; border-radius: 12px; padding: 0.25rem 0;">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block; overflow: visible;">
          <defs>
            <!-- Emerald Gradient (Punctual) -->
            <linearGradient id="${chartId}-punc-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10B981" stop-opacity="0.32" />
              <stop offset="85%" stop-color="#10B981" stop-opacity="0.04" />
              <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
            </linearGradient>

            <!-- Amber Gradient (Late) -->
            <linearGradient id="${chartId}-late-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.3" />
              <stop offset="85%" stop-color="#F59E0B" stop-opacity="0.04" />
              <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0" />
            </linearGradient>

            <!-- Rose Gradient (Missed) -->
            <linearGradient id="${chartId}-miss-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#EF4444" stop-opacity="0.3" />
              <stop offset="85%" stop-color="#EF4444" stop-opacity="0.04" />
              <stop offset="100%" stop-color="#EF4444" stop-opacity="0.0" />
            </linearGradient>

            <!-- Glow Filters -->
            <filter id="${chartId}-glow-punc" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#10B981" flood-opacity="0.35"/>
            </filter>
            <filter id="${chartId}-glow-late" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#F59E0B" flood-opacity="0.35"/>
            </filter>
            <filter id="${chartId}-glow-miss" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#EF4444" flood-opacity="0.35"/>
            </filter>
          </defs>

          <!-- Horizontal Grid Lines -->
          ${gridLines.join('')}

          <!-- Baseline Track -->
          ${baseline}

          <!-- Area Fills under curves -->
          ${punctualArea ? `<path d="${punctualArea}" fill="url(#${chartId}-punc-grad)" />` : ''}
          ${lateArea ? `<path d="${lateArea}" fill="url(#${chartId}-late-grad)" />` : ''}
          ${missedArea ? `<path d="${missedArea}" fill="url(#${chartId}-miss-grad)" />` : ''}

          <!-- 1. Punctual Spline Line (Emerald) -->
          ${punctualPath ? `
            <path d="${punctualPath}" fill="none" stroke="#10B981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#${chartId}-glow-punc)" />
          ` : ''}

          <!-- 2. Late Spline Line (Amber) -->
          ${latePath ? `
            <path d="${latePath}" fill="none" stroke="#F59E0B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,3" filter="url(#${chartId}-glow-late)" />
          ` : ''}

          <!-- 3. Missed Spline Line (Rose) -->
          ${missedPath ? `
            <path d="${missedPath}" fill="none" stroke="#EF4444" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#${chartId}-glow-miss)" />
          ` : ''}

          <!-- Smart Event Node Markers (Only drawn on days with events > 0) -->
          ${buildActiveNodes(punctualPoints, '#10B981', '#10B981', 'Punctual')}
          ${buildActiveNodes(latePoints, '#F59E0B', '#F59E0B', 'Late')}
          ${buildActiveNodes(missedPoints, '#EF4444', '#EF4444', 'Missed')}

          <!-- X Axis Date Labels -->
          ${xLabels.join('')}
        </svg>
      </div>

      <!-- Clean Capsule Legend Footnote -->
      <div style="display: flex; justify-content: center; align-items: center; gap: 0.85rem; flex-wrap: wrap; margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px dashed #E2E8F0;">
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #F0FDF4; border: 1px solid #BBF7D0; padding: 3px 10px; border-radius: 9999px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
          <span style="font-size: 0.72rem; font-weight: 700; color: #065F46;">Punctual (≤15m)</span>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #FFFBEB; border: 1px solid #FDE68A; padding: 3px 10px; border-radius: 9999px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span>
          <span style="font-size: 0.72rem; font-weight: 700; color: #92400E;">Late (>15m)</span>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #FEF2F2; border: 1px solid #FECDD3; padding: 3px 10px; border-radius: 9999px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
          <span style="font-size: 0.72rem; font-weight: 700; color: #991B1B;">Missed (Losen)</span>
        </div>
      </div>

    </div>
  `;
}
