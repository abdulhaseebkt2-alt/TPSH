const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://txbjraknaaokenyvbaak.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_tQAL8-iV3gI61WeUjt_KrQ_VUzK_uS7';

async function syncIcons() {
  console.log('[sync-icons] Checking for cloud institutional logo in Supabase...');
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['tps_institution_logo', 'tps_mobile_front_logo']);

    if (!error && Array.isArray(data) && data.length > 0) {
      const instRow = data.find(r => r.key === 'tps_institution_logo');
      const mobRow = data.find(r => r.key === 'tps_mobile_front_logo');
      const logoVal = (instRow && instRow.value) || (mobRow && mobRow.value);

      if (logoVal && typeof logoVal === 'string' && logoVal.startsWith('data:image/')) {
        const parts = logoVal.split(',');
        if (parts.length === 2) {
          const buf = Buffer.from(parts[1], 'base64');
          console.log(`[sync-icons] Found cloud logo (${buf.length} bytes). Updating project assets...`);

          // 1. Update public/tps-logo.png and public/tps-emblem.png
          fs.writeFileSync(path.join(__dirname, '../public/tps-logo.png'), buf);
          fs.writeFileSync(path.join(__dirname, '../public/tps-emblem.png'), buf);

          // 2. Update public/favicon.svg
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256">\n  <image href="${logoVal}" width="256" height="256" />\n</svg>\n`;
          fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), svgContent, 'utf8');

          console.log('[sync-icons] Successfully updated public/tps-logo.png and public/favicon.svg from cloud logo.');
        }
      }
    }
  } catch (err) {
    console.warn('[sync-icons] Note: Could not fetch cloud logo, using existing public/tps-logo.png:', err.message);
  }

  // Generate all Android APK icons from public/tps-logo.png
  console.log('[sync-icons] Generating Android launcher icons (ic_launcher_foreground, ic_launcher, ic_launcher_round)...');
  try {
    const psScript = path.join(__dirname, 'generate_android_icons.ps1');
    if (fs.existsSync(psScript)) {
      execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, { stdio: 'inherit' });
      console.log('[sync-icons] Android launcher icons synchronized successfully.');
    }
  } catch (psErr) {
    console.warn('[sync-icons] Warning generating Android icons:', psErr.message);
  }
}

syncIcons().catch(err => {
  console.error('[sync-icons] Error:', err);
  process.exit(0); // Never fail the build if offline
});
