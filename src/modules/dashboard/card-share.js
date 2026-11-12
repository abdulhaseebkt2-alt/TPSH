/**
 * ThaibaHive / TPS Hostel ERP - Card Share Utility
 * Renders the Executive Hostel Status card onto an HTML5 Canvas with a clean white background
 * and triggers native Web Share API (WhatsApp/System share) or image download.
 */

import { openModal } from '../../lib/dialog.js';
import { toast } from '../../lib/toast.js';

export async function shareHeroStatusCard(data) {
  const {
    brandText = 'Thaiba Public School Hostel',
    activeCount = 29,
    boysCount = 15,
    girlsCount = 14,
    divisionsCount = 5,
    boysInHostel = 13,
    girlsInHostel = 13,
    totalInHostel = 26
  } = data || {};

  const canvas = document.createElement('canvas');
  const dpr = 2; // High-resolution Retina export
  const width = 640;
  const height = 480;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 1. Crisp White Outer Canvas Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle border around white card
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);

  // Top Institutional Header on White Background
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Thaiba Public School & Residential Hostel', 32, 34);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${dateStr} • ${timeStr}`, width - 32, 34);

  // 2. Dark Green Hero Card inside White Background
  const cardX = 24;
  const cardY = 50;
  const cardW = width - 48;
  const cardH = 380;
  const radius = 20;

  // Draw rounded card rectangle
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.lineTo(cardX + cardW - radius, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
  ctx.lineTo(cardX + cardW, cardY + cardH - radius);
  ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
  ctx.lineTo(cardX + radius, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
  ctx.lineTo(cardX, cardY + radius);
  ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
  ctx.closePath();

  // Emerald Dark Gradient Fill
  const gradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  gradient.addColorStop(0, '#042F2E');
  gradient.addColorStop(0.5, '#064E3B');
  gradient.addColorStop(1, '#022C22');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Top Pill: Thaiba Public School Hostel
  const pillX = cardX + 20;
  const pillY = cardY + 20;
  const pillW = 230;
  const pillH = 30;
  const pillR = 15;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
  ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
  ctx.lineTo(pillX, pillY + pillR);
  ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Green Live Dot
  ctx.beginPath();
  ctx.arc(pillX + 16, pillY + 15, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#10B981';
  ctx.fill();

  // Pill Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(brandText.toUpperCase(), pillX + 28, pillY + 19);
  ctx.restore();

  // Label: TOTAL RESIDENTS ENROLLED
  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL RESIDENTS ENROLLED', cardX + 22, cardY + 95);

  // Big Number: Active Students
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(activeCount), cardX + 20, cardY + 155);

  ctx.fillStyle = '#6EE7B7';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Active Students', cardX + 95, cardY + 148);

  // Sub-badge: Boys: 15 • Girls: 14 • 5 Divisions
  const badgeX = cardX + 20;
  const badgeY = cardY + 175;
  const badgeW = 240;
  const badgeH = 26;
  const badgeR = 13;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(badgeX + badgeR, badgeY);
  ctx.lineTo(badgeX + badgeW - badgeR, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeR);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - badgeR);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - badgeR, badgeY + badgeH);
  ctx.lineTo(badgeX + badgeR, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeR);
  ctx.lineTo(badgeX, badgeY + badgeR);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeR, badgeY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(5, 150, 105, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#D1FAE5';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Boys: ${boysCount}  •  Girls: ${girlsCount}  •  ${divisionsCount} Divisions`, badgeX + 14, badgeY + 17);
  ctx.restore();

  // Bottom Stats Panel (Inside card)
  const statsBoxX = cardX + 16;
  const statsBoxY = cardY + 235;
  const statsBoxW = cardW - 32;
  const statsBoxH = 115;
  const statsBoxR = 14;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(statsBoxX + statsBoxR, statsBoxY);
  ctx.lineTo(statsBoxX + statsBoxW - statsBoxR, statsBoxY);
  ctx.quadraticCurveTo(statsBoxX + statsBoxW, statsBoxY, statsBoxX + statsBoxW, statsBoxY + statsBoxR);
  ctx.lineTo(statsBoxX + statsBoxW, statsBoxY + statsBoxH - statsBoxR);
  ctx.quadraticCurveTo(statsBoxX + statsBoxW, statsBoxY + statsBoxH, statsBoxX + statsBoxW - statsBoxR, statsBoxY + statsBoxH);
  ctx.lineTo(statsBoxX + statsBoxR, statsBoxY + statsBoxH);
  ctx.quadraticCurveTo(statsBoxX, statsBoxY + statsBoxH, statsBoxX, statsBoxY + statsBoxH - statsBoxR);
  ctx.lineTo(statsBoxX, statsBoxY + statsBoxR);
  ctx.quadraticCurveTo(statsBoxX, statsBoxY, statsBoxX + statsBoxR, statsBoxY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const colWidth = statsBoxW / 3;

  // Stat 1: Boys in Hostel
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('BOYS IN HOSTEL', statsBoxX + colWidth * 0.5, statsBoxY + 40);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(boysInHostel), statsBoxX + colWidth * 0.5, statsBoxY + 86);

  // Divider 1
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(statsBoxX + colWidth, statsBoxY + 20);
  ctx.lineTo(statsBoxX + colWidth, statsBoxY + statsBoxH - 20);
  ctx.stroke();

  // Stat 2: Girls in Hostel
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('GIRLS IN HOSTEL', statsBoxX + colWidth * 1.5, statsBoxY + 40);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(girlsInHostel), statsBoxX + colWidth * 1.5, statsBoxY + 86);

  // Divider 2
  ctx.beginPath();
  ctx.moveTo(statsBoxX + colWidth * 2, statsBoxY + 20);
  ctx.lineTo(statsBoxX + colWidth * 2, statsBoxY + statsBoxH - 20);
  ctx.stroke();

  // Stat 3: Total in Hostel
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TOTAL IN HOSTEL', statsBoxX + colWidth * 2.5, statsBoxY + 40);

  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(totalInHostel), statsBoxX + colWidth * 2.5, statsBoxY + 86);

  // Bottom watermark on white background
  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ThaibaHive Institutional ERP • Verified Live Census', width / 2, height - 16);

  // Format share message text exactly as requested
  const notInHostel = Math.max(0, activeCount - totalInHostel);
  const occupancyPercent = activeCount > 0 ? Math.round((totalInHostel / activeCount) * 100) : 0;

  const shareTextContent = `*THAIBA PUBLIC SCHOOL*

*HOSTEL STATUS REPORT*
Total Enrolled Students: ${activeCount}
Total Students in Hostel: ${totalInHostel}

Boys: ${boysInHostel}
Girls: ${girlsInHostel}

Students Not in Hostel: ${notInHostel}
_______________
Total Hostel Occupancy:
 ${totalInHostel} out of ${activeCount} (${occupancyPercent}%)`;

  // Convert canvas to image and open share sheet
  canvas.toBlob(async (blob) => {
    if (!blob) {
      toast.error('Failed to generate card screenshot.');
      return;
    }

    const imageUrl = URL.createObjectURL(blob);
    const fileName = `Thaiba_Hostel_Status_${dateStr.replace(/\s+/g, '_')}.png`;
    const imageFile = new File([blob], fileName, { type: 'image/png' });

    // Open modern preview modal with screenshot on white background
    openModal({
      title: 'Share Hostel Status Card',
      size: 'lg',
      contentHtml: `
        <div style="font-family: var(--font-sans, system-ui, sans-serif); text-align: center;">
          <p style="font-size: 0.85rem; color: #64748B; margin: 0 0 1rem 0;">
            Hostel status screenshot generated on clean white background. Ready to share or download.
          </p>

          <div style="background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 14px; padding: 12px; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06); display: inline-block; max-width: 100%;">
            <img src="${imageUrl}" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" alt="Hostel Status Card" />
          </div>

          <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="btn-modal-native-share" style="background: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share Card & Report
            </button>

            <button type="button" class="btn btn-outline" id="btn-modal-copy-text" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              Copy Report Text
            </button>

            <a href="${imageUrl}" download="${fileName}" class="btn btn-outline" id="btn-modal-download-card" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Image
            </a>
          </div>
        </div>
      `,
      onMount: ({ container: mBody }) => {
        // Copy formatted report text to clipboard
        mBody.querySelector('#btn-modal-copy-text')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(shareTextContent);
            toast.success('Hostel status report copied to clipboard!');
          } catch {
            toast.info('Report text:\n' + shareTextContent);
          }
        });

        mBody.querySelector('#btn-modal-native-share')?.addEventListener('click', async () => {
          if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
            try {
              await navigator.share({
                title: 'THAIBA PUBLIC SCHOOL - HOSTEL STATUS REPORT',
                text: shareTextContent,
                files: [imageFile]
              });
              toast.success('Card shared successfully!');
            } catch (err) {
              if (err.name !== 'AbortError') {
                toast.info('Sharing cancelled or not supported.');
              }
            }
          } else if (navigator.share) {
            try {
              await navigator.share({
                title: 'THAIBA PUBLIC SCHOOL - HOSTEL STATUS REPORT',
                text: shareTextContent,
                url: window.location.href
              });
            } catch (err) {
              if (err.name !== 'AbortError') toast.info('Share cancelled.');
            }
          } else {
            // Copy report text and trigger image download
            try {
              await navigator.clipboard.writeText(shareTextContent);
              toast.success('Report copied to clipboard! Downloading image...');
            } catch {}
            const link = mBody.querySelector('#btn-modal-download-card');
            link?.click();
          }
        });
      }
    });
  }, 'image/png');
}
