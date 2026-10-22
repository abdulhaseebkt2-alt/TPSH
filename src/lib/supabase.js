import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://txbjraknaaokenyvbaak.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_tQAL8-iV3gI61WeUjt_KrQ_VUzK_uS7';

export const isSupabaseConfigured = Boolean(
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
