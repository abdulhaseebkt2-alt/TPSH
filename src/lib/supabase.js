import { createClient } from '@supabase/supabase-js';

export const isTestEnv = typeof process !== 'undefined' && (Boolean(process.env?.VITEST) || process.env?.NODE_ENV === 'test');

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://txbjraknaaokenyvbaak.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || 'sb_publishable_tQAL8-iV3gI61WeUjt_KrQ_VUzK_uS7';

export const isSupabaseConfigured = !isTestEnv && Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseKey.includes('your-supabase-publishable-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export async function checkDatabaseConnection() {
  if (isTestEnv) return { connected: true, message: 'Isolated test environment' };
  if (!supabase) return { connected: false, message: 'Supabase credentials not configured' };
  try {
    const { error } = await supabase.from('app_settings').select('key').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { connected: false, message: error.message };
    }
    return { connected: true, message: 'Connected to Supabase PostgreSQL' };
  } catch (err) {
    return { connected: false, message: err.message || 'Connection failed' };
  }
}
