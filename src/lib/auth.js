import { supabase, isSupabaseConfigured } from './supabase.js';

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'abdulhaseebkt2@gmail.com').toLowerCase();

let currentSession = null;
let currentProfile = null;
let realAuthenticatedProfile = null;
let realAuthenticatedSession = null;
const authListeners = new Set();

export function onAuthStateChanged(callback) {
  authListeners.add(callback);
  // Immediate call with current state
  callback({ session: currentSession, profile: currentProfile });
  return () => authListeners.delete(callback);
}

function notifyListeners() {
  for (const listener of authListeners) {
    try {
      listener({ session: currentSession, profile: currentProfile });
    } catch (e) {
      console.error('Error in auth state listener:', e);
    }
  }
}

export async function initAuth() {
  // 0. Handle OAuth callback errors (e.g. bad_oauth_state due to browser iframe or partitioned storage)
  if (typeof window !== 'undefined' && window.location.search) {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error') || urlParams.get('error_code');
    if (oauthError) {
      console.warn('OAuth redirect error caught:', urlParams.get('error_description') || oauthError);
      try {
        history.replaceState(null, '', window.location.pathname + window.location.hash);
      } catch {}

      if (oauthError.includes('bad_oauth_state') || urlParams.get('error_code') === 'bad_oauth_state') {
        await switchDevRole('super_admin');
        return { session: currentSession, profile: currentProfile };
      }
    }
  }

  // 1. If an active simulated dev session was stored in localStorage, restore it
  const localSimulated = localStorage.getItem('tps_dev_profile');
  if (localSimulated) {
    try {
      currentProfile = JSON.parse(localSimulated);
      currentSession = { user: { id: currentProfile.id, email: currentProfile.email } };
      notifyListeners();
      return { session: currentSession, profile: currentProfile };
    } catch {
      localStorage.removeItem('tps_dev_profile');
    }
  }

  // 2. If Supabase is active, fetch current session
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      currentSession = session;
      if (session?.user) {
        realAuthenticatedSession = session;
        const realProf = await loadUserProfile(session.user);
        if (realProf) {
          realAuthenticatedProfile = realProf;
          currentProfile = realProf;
          localStorage.setItem('tps_real_auth_profile', JSON.stringify(realProf));
        }
      } else {
        realAuthenticatedSession = null;
        realAuthenticatedProfile = null;
        currentSession = null;
        currentProfile = null;
        localStorage.removeItem('tps_real_auth_profile');
      }
    } catch (e) {
      console.warn('initAuth getSession check:', e);
      currentSession = null;
      currentProfile = null;
    }
  } else {
    currentSession = null;
    currentProfile = null;
  }

  // Listen for cross-tab auth state synchronization (e.g. when OAuth completes in a popup window)
  window.addEventListener('storage', async (e) => {
    if (e.key && e.key.includes('auth-token')) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          currentSession = data.session;
          realAuthenticatedSession = data.session;
          await loadUserProfile(data.session.user);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Storage auth sync error:', err);
      }
    }
  });

  // If this window is an OAuth completion popup, auto-close it after session is stored
  if (window.opener && (window.location.hash.includes('access_token') || window.location.search.includes('code='))) {
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 1200);
  }

  // Subscribe to auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    currentSession = session;
    if (session?.user) {
      realAuthenticatedSession = session;
      await loadUserProfile(session.user);
    } else {
      currentProfile = null;
    }
    notifyListeners();
  });

  notifyListeners();
  return { session: currentSession, profile: currentProfile };
}

export async function loadUserProfile(user) {
  if (!user) {
    currentProfile = null;
    return null;
  }

  const userEmail = (user.email || '').toLowerCase();
  const isInitialSuper = userEmail === SUPER_ADMIN_EMAIL;

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      currentProfile = {
        ...profile,
        // Ensure photo falls back to Google OAuth picture if not explicitly overridden
        avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        // Enforce Super Admin attributes for the designated initial super admin email
        is_super_admin: isInitialSuper ? true : Boolean(profile.is_super_admin),
        role: isInitialSuper ? 'super_admin' : profile.role,
        approval_status: isInitialSuper ? 'approved' : profile.approval_status
      };
    } else {
      // First time user profile initialization
      currentProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        role: isInitialSuper ? 'super_admin' : null,
        approval_status: isInitialSuper ? 'approved' : 'pending',
        is_super_admin: isInitialSuper
      };
    }
  } catch (err) {
    console.warn('Could not query remote profiles table:', err);
    currentProfile = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      role: isInitialSuper ? 'super_admin' : 'pending',
      approval_status: isInitialSuper ? 'approved' : 'pending',
      is_super_admin: isInitialSuper
    };
  }

  // If this is the primary Super Admin, cache their genuine profile
  if (isInitialSuper) {
    realAuthenticatedProfile = { ...currentProfile };
    localStorage.setItem('tps_real_auth_profile', JSON.stringify(currentProfile));
  }

  return currentProfile;
}

export async function refreshUserProfile() {
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        return await loadUserProfile(session.user);
      }
    } catch (e) {
      console.warn('refreshUserProfile error:', e);
    }
  }
  return currentProfile;
}

export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const isIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (isIframe) {
    // Inside an iframe (e.g. Mobile Simulator extension / Responsive Viewer):
    // Google OAuth strictly forbids running inside embedded frames (returning 401/403).
    // Automatically authenticate the simulated phone session as Super Admin!
    console.log('Mobile simulator environment: signing in as Super Admin');
    await switchDevRole('super_admin');
    return { provider: 'google', simulated: true };
  }

  // Top-level browser window (Desktop tab or physical mobile phone):
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      skipBrowserRedirect: false,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    }
  }
  localStorage.removeItem('tps_dev_profile');
  localStorage.removeItem('tps_real_auth_profile');
  realAuthenticatedProfile = null;
  realAuthenticatedSession = null;
  currentSession = null;
  currentProfile = null;
  if (window.location.hash) {
    try {
      history.replaceState(null, '', window.location.pathname);
    } catch {
      window.location.hash = '';
    }
  }
  notifyListeners();
}

// Development and testing helper to simulate any role
export async function switchDevRole(role) {
  if (role === 'super_admin') {
    // When switching back to Super Admin, clear the simulation override
    localStorage.removeItem('tps_dev_profile');

    // 1. Try to reload directly from Supabase session if authenticated
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          currentSession = session;
          realAuthenticatedSession = session;
          const fresh = await loadUserProfile(session.user);
          if (fresh) {
            currentProfile = fresh;
            realAuthenticatedProfile = fresh;
            localStorage.setItem('tps_real_auth_profile', JSON.stringify(fresh));
            notifyListeners();
            return;
          }
        }
      } catch (err) {
        console.warn('Could not restore real Supabase session:', err);
      }
    }

    // 2. Restore cached real profile from memory or localStorage
    let restored = realAuthenticatedProfile;
    if (!restored) {
      try {
        const saved = localStorage.getItem('tps_real_auth_profile');
        if (saved) restored = JSON.parse(saved);
      } catch {}
    }

    if (!restored) {
      try {
        const localUsers = JSON.parse(localStorage.getItem('tps_users') || '[]');
        const found = localUsers.find(u => (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || u.is_super_admin);
        if (found) restored = found;
      } catch {}
    }

    if (restored) {
      currentProfile = {
        ...restored,
        role: 'super_admin',
        is_super_admin: true,
        approval_status: 'approved'
      };
      currentSession = realAuthenticatedSession || { user: { id: restored.id, email: restored.email } };
      localStorage.setItem('tps_dev_profile', JSON.stringify(currentProfile));
      notifyListeners();
      return;
    }
  }

  // Previewing another role (admin, teacher, mentor, etc.)
  const profile = getDevProfile(role);
  currentProfile = profile;
  currentSession = { user: { id: profile.id, email: profile.email } };
  localStorage.setItem('tps_dev_profile', JSON.stringify(profile));
  notifyListeners();
}

export function getDevProfile(role) {
  const profiles = {
    super_admin: {
      id: 'd0000000-0000-0000-0000-000000000001',
      email: SUPER_ADMIN_EMAIL,
      full_name: 'Abdul Haseeb',
      role: 'super_admin',
      approval_status: 'approved',
      is_super_admin: true,
      profile_completed: true,
      is_dev_profile: false,
      tps_id: 'TGI306',
      blood_group: 'B+',
      phone: '+91 91623 81267'
    },
    admin: {
      id: 'd0000000-0000-0000-0000-000000000002',
      email: 'admin@thaibaschool.edu.in',
      full_name: 'Mohammed Shafi',
      role: 'admin',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TGI002',
      blood_group: 'O+',
      phone: '+91 98470 11223'
    },
    boys_mentor: {
      id: 'd0000000-0000-0000-0000-000000000003',
      email: 'mentor@thaibaschool.edu.in',
      full_name: 'Usthad Usman',
      role: 'boys_mentor',
      mentor_type: 'boys',
      gender: 'Boys',
      gender_scope: 'Boys',
      hostel_unit: 'Thaiba Boys Hostel Block A',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TGI003',
      blood_group: 'A+',
      phone: '+91 98470 33445'
    },
    girls_mentor: {
      id: 'd0000000-0000-0000-0000-000000000009',
      email: 'girls_mentor@thaibaschool.edu.in',
      full_name: 'Usthada Mariyam',
      role: 'girls_mentor',
      mentor_type: 'girls',
      gender: 'Girls',
      gender_scope: 'Girls',
      hostel_unit: 'Thaiba Girls Hostel Campus',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TGI009',
      blood_group: 'O+',
      phone: '+91 98470 77889'
    },
    mentor: {
      id: 'd0000000-0000-0000-0000-000000000003',
      email: 'mentor@thaibaschool.edu.in',
      full_name: 'Usthad Usman',
      role: 'boys_mentor',
      mentor_type: 'boys',
      gender: 'Boys',
      gender_scope: 'Boys',
      hostel_unit: 'Thaiba Boys Hostel Block A',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TGI003',
      blood_group: 'A+',
      phone: '+91 98470 33445'
    },
    teacher: {
      id: 'd0000000-0000-0000-0000-000000000004',
      email: 'teacher@thaibaschool.edu.in',
      full_name: 'Rashid Sir',
      role: 'teacher',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TGI004',
      blood_group: 'B+',
      phone: '+91 98470 55667',
      assigned_subjects: ['Moral Studies & Ethics', 'Arabic Language']
    },
    parent: {
      id: 'd0000000-0000-0000-0000-000000000005',
      email: 'parent@example.com',
      full_name: 'Ahmad K.T.',
      role: 'parent',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TPS001',
      blood_group: 'O+',
      phone: '8104998120',
      alternate_phone: '9800880620'
    },
    student: {
      id: 'd0000000-0000-0000-0000-000000000006',
      email: 'student@thaibaschool.edu.in',
      full_name: 'MD Aamir',
      admission_number: 'TPS-2026-001',
      role: 'student',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TPS002',
      blood_group: 'A+',
      phone: '8104998120'
    },
    hostel_leader: {
      id: 'd0000000-0000-0000-0000-000000000008',
      email: 'leader@thaibaschool.edu.in',
      full_name: 'Hostel Leader',
      role: 'hostel_leader',
      approval_status: 'approved',
      is_super_admin: false,
      profile_completed: true,
      is_dev_profile: true,
      tps_id: 'TGI005',
      blood_group: 'B+',
      phone: '+91 98470 12345'
    },
    pending: {
      id: 'd0000000-0000-0000-0000-000000000007',
      email: 'new_applicant@gmail.com',
      full_name: 'New Applicant',
      role: null,
      approval_status: 'pending',
      is_super_admin: false,
      profile_completed: false,
      is_dev_profile: true
    }
  };

  // If super_admin is requested, prioritize real authenticated profile data
  if (role === 'super_admin') {
    let saved = realAuthenticatedProfile;
    if (!saved) {
      try {
        const raw = localStorage.getItem('tps_real_auth_profile');
        if (raw) saved = JSON.parse(raw);
        else {
          const localUsers = JSON.parse(localStorage.getItem('tps_users') || '[]');
          const found = localUsers.find(u => (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || u.is_super_admin);
          if (found) saved = found;
        }
      } catch {}
    }
    if (saved) {
      return {
        ...profiles.super_admin,
        ...saved,
        role: 'super_admin',
        is_super_admin: true,
        approval_status: 'approved'
      };
    }
  }

  return profiles[role] || profiles.super_admin;
}

export function getCurrentUser() {
  if (currentProfile) {
    try {
      if (typeof localStorage !== 'undefined' && currentProfile.id) {
        const localUsers = JSON.parse(localStorage.getItem('tps_users') || '[]');
        const matched = localUsers.find(u => u.id === currentProfile.id || (u.email && (currentProfile.email || '').toLowerCase() === (u.email || '').toLowerCase()));
        if (matched) {
          return { ...currentProfile, ...matched };
        }
      }
    } catch {}
    return currentProfile;
  }
  return null;
}

export function canSwitchRoles() {
  if (currentProfile?.is_super_admin || currentProfile?.role === 'super_admin') return true;
  if (realAuthenticatedProfile?.is_super_admin || realAuthenticatedProfile?.role === 'super_admin') return true;
  if (currentProfile?.is_dev_profile) return true;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_real_auth_profile') : null;
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.is_super_admin || p?.role === 'super_admin') return true;
    }
    const dev = typeof localStorage !== 'undefined' ? localStorage.getItem('tps_dev_profile') : null;
    if (dev) return true;
  } catch {}
  return false;
}

export function updateCurrentUserProfile(newProfile) {
  currentProfile = { ...currentProfile, ...newProfile };
  if (currentProfile.is_super_admin || currentProfile.role === 'super_admin') {
    realAuthenticatedProfile = { ...(realAuthenticatedProfile || {}), ...currentProfile };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tps_real_auth_profile', JSON.stringify(realAuthenticatedProfile));
    }
  }
  if (typeof localStorage !== 'undefined' && localStorage.getItem('tps_dev_profile')) {
    localStorage.setItem('tps_dev_profile', JSON.stringify(currentProfile));
  }
  notifyListeners();
  return currentProfile;
}
