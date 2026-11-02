/**
 * Reusable 3-Line Punctuality & Compliance Chart
 * Visualizes:
 * 1. Punctual attendance (recorded within 15 minutes of class start) - Green
 * 2. Late attendance (recorded after 15 minutes) - Amber
 * 3. Missed attendance (class scheduled but attendance not submitted) - Red
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
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.5rem; text-align: center; color: #64748B;">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">📊</div>
        <div style="font-size: 0.88rem; font-weight: 700; color: #1E293B;">No Attendance Data Yet</div>
        <div style="font-size: 0.75rem; color: #94A3B8;">Attendance punctuality will display here as classes are conducted.</div>
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
  const svgHeight = compact ? 180 : 220;
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Find max Y
  const maxVal = Math.max(
    1,
    ...timelineDays.map(d => Math.max(d.punctual || 0, d.late || 0, d.missed || 0))
  );
  const yTicksCount = maxVal <= 3 ? maxVal : 4;
  const yMax = Math.ceil(maxVal * 1.15) || 1;

  // Coordinate mapping functions
  const count = timelineDays.length;
  const getX = (index) => {
    if (count <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (count - 1)) * plotWidth;
  };
  const getY = (val) => {
    return paddingTop + plotHeight - (val / yMax) * plotHeight;
  };

  // Build SVG Paths
  const buildPath = (key) => {
    if (count === 0) return '';
    return timelineDays.map((d, i) => {
      const x = getX(i);
      const y = getY(d[key] || 0);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const punctualPath = buildPath('punctual');
  const latePath = buildPath('late');
  const missedPath = buildPath('missed');

  // Build Dots for SVG
  const buildDots = (key, color, label) => {
    return timelineDays.map((d, i) => {
      const val = d[key] || 0;
      const x = getX(i);
      const y = getY(val);
      return `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#FFFFFF" stroke="${color}" stroke-width="2">
          <title>${d.dateStr || d.dayLabel}: ${val} ${label}</title>
        </circle>
      `;
    }).join('');
  };

  // Horizontal Grid Lines
  const gridLines = [];
  for (let i = 0; i <= yTicksCount; i++) {
    const v = Math.round((yMax / yTicksCount) * i);
    const y = getY(v);
    gridLines.push(`
      <line x1="${paddingLeft}" y1="${y.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${y.toFixed(1)}" stroke="#F1F5F9" stroke-width="1" stroke-dasharray="2,2" />
      <text x="${paddingLeft - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#94A3B8" font-family="sans-serif">${v}</text>
    `);
  }

  // X Axis Labels (sample evenly up to 7 labels)
  const xLabels = [];
  const step = Math.max(1, Math.floor(count / 6));
  timelineDays.forEach((d, i) => {
    if (i % step === 0 || i === count - 1) {
      const x = getX(i);
      xLabels.push(`
        <text x="${x.toFixed(1)}" y="${svgHeight - 10}" text-anchor="middle" font-size="10" fill="#64748B" font-family="sans-serif">
          ${d.dayLabel || d.dateStr.slice(-5)}
        </text>
      `);
    }
  });

  return `
    <div class="punctuality-chart-card" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 1.15rem 1.25rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02); margin-bottom: 1.25rem;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.85rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="font-size: 1.2rem;">📈</span>
            <h3 style="font-size: 1rem; font-weight: 800; color: #0F172A; margin: 0;">${title}</h3>
          </div>
          <p style="font-size: 0.75rem; color: #64748B; margin: 3px 0 0 0;">${subtitle}</p>
        </div>
        <span class="badge" style="background: #F8FAFC; color: #475569; border: 1px solid #E2E8F0; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 9999px;">
          ${totalSessions} Total Sessions
        </span>
      </div>

      <!-- 3 Metrics Legend Pill Bar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.6rem; margin-bottom: 1rem;">
        <!-- Punctual (≤ 15 mins) -->
        <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 10px; padding: 0.55rem 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #059669; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(5,150,105,0.2);"></div>
          <div style="min-width: 0;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #065F46; text-transform: uppercase; letter-spacing: 0.03em;">Punctual (≤15m)</div>
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="font-size: 1.1rem; font-weight: 900; color: #059669;">${totalPunctual}</span>
              <span style="font-size: 0.72rem; font-weight: 700; color: #047857;">(${punctualPct}%)</span>
            </div>
          </div>
        </div>

        <!-- Late (> 15 mins) -->
        <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 0.55rem 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #D97706; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(217,119,6,0.2);"></div>
          <div style="min-width: 0;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.03em;">Late (>15m)</div>
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="font-size: 1.1rem; font-weight: 900; color: #D97706;">${totalLate}</span>
              <span style="font-size: 0.72rem; font-weight: 700; color: #B45309;">(${latePct}%)</span>
            </div>
          </div>
        </div>

        <!-- Missed Sessions -->
        <div style="background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 10px; padding: 0.55rem 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #DC2626; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(220,38,38,0.2);"></div>
          <div style="min-width: 0;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #991B1B; text-transform: uppercase; letter-spacing: 0.03em;">Missed (Losen)</div>
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="font-size: 1.1rem; font-weight: 900; color: #DC2626;">${totalMissed}</span>
              <span style="font-size: 0.72rem; font-weight: 700; color: #B91C1C;">(${missedPct}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Scalable 3-Line SVG Graph -->
      <div style="width: 100%; overflow-x: auto; background: #FAF5FF00; border-radius: 8px;">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block; overflow: visible;">
          <!-- Grid Lines -->
          ${gridLines.join('')}

          <!-- Line 1: Punctual (Green) -->
          <path d="${punctualPath}" fill="none" stroke="#059669" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
          ${buildDots('punctual', '#059669', 'Punctual')}

          <!-- Line 2: Late (Amber) -->
          <path d="${latePath}" fill="none" stroke="#D97706" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4,2" />
          ${buildDots('late', '#D97706', 'Late (>15m)')}

          <!-- Line 3: Missed (Red) -->
          <path d="${missedPath}" fill="none" stroke="#DC2626" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
          ${buildDots('missed', '#DC2626', 'Missed')}

          <!-- X Axis Labels -->
          ${xLabels.join('')}
        </svg>
      </div>

      <!-- Graph Legend Footnote -->
      <div style="display: flex; justify-content: center; align-items: center; gap: 1.25rem; flex-wrap: wrap; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px dashed #E2E8F0; font-size: 0.72rem; color: #64748B;">
        <div style="display: inline-flex; align-items: center; gap: 5px;">
          <span style="width: 16px; height: 3px; background: #059669; border-radius: 2px;"></span>
          <span style="font-weight: 600; color: #065F46;">Punctual (≤15m)</span>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px;">
          <span style="width: 16px; height: 3px; background: #D97706; border-radius: 2px;"></span>
          <span style="font-weight: 600; color: #92400E;">Late (>15m)</span>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px;">
          <span style="width: 16px; height: 3px; background: #DC2626; border-radius: 2px;"></span>
          <span style="font-weight: 600; color: #991B1B;">Missed</span>
        </div>
      </div>
    </div>
  `;
}
