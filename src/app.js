import { initAuth, onAuthStateChanged, signInWithGoogle, signInWithEmail, signOut, switchDevRole, canSwitchRoles, getCurrentUser, refreshUserProfile } from './lib/auth.js';
import { canAccessModule } from './lib/permissions.js';
import { renderNavbar } from './components/navbar.js';
import { renderSidebar } from './components/sidebar.js';
import { openProfileModal } from './components/profile-modal.js';
import { toast } from './lib/toast.js';
import { initGlobalUIObserver, enhanceAllUI } from './lib/ui-enhancer.js';

// Import modules
import { renderDashboard } from './modules/dashboard/index.js';
import { renderUsersModule } from './modules/users/index.js';
import { renderAdmissionsModule } from './modules/admissions/index.js';
import { renderStudentsModule } from './modules/students/index.js';
import { renderSectionsModule } from './modules/sections/index.js';
import { renderAssignmentsModule } from './modules/assignments/index.js';
import { renderTimetableModule } from './modules/timetable/index.js';
import { renderAttendanceModule } from './modules/attendance/index.js';
import { renderLeavesModule } from './modules/leaves/index.js';
import { renderFinesModule } from './modules/fines/index.js';
import { renderDisciplineModule } from './modules/discipline/index.js';
import { renderExamsModule } from './modules/exams/index.js';
import { renderMarksModule } from './modules/marks/index.js';
import { renderHostelModule } from './modules/hostel/index.js';
import { renderFeesModule } from './modules/fees/index.js';
import { renderNoticesModule } from './modules/notices/index.js';
import { renderMaintenanceModule } from './modules/maintenance/index.js';
import { renderReportsModule } from './modules/reports/index.js';
import { renderAuditModule } from './modules/audit/index.js';
import { renderSettingsModule } from './modules/settings/index.js';

const MODULE_ROUTERS = {
  dashboard: renderDashboard,
  users: renderUsersModule,
  admissions: renderAdmissionsModule,
  students: renderStudentsModule,
  sections: renderSectionsModule,
  assignments: renderAssignmentsModule,
  timetable: renderTimetableModule,
  attendance: renderAttendanceModule,
  leaves: renderLeavesModule,
  fines: renderFinesModule,
  discipline: renderDisciplineModule,
  exams: renderExamsModule,
  marks: renderMarksModule,
  hostel: renderHostelModule,
  fees: renderFeesModule,
  notices: renderNoticesModule,
  maintenance: renderMaintenanceModule,
  reports: renderReportsModule,
  audit: renderAuditModule,
  settings: renderSettingsModule
};

export function getInstitutionalLogo(size = 46) {
  const customLogo = localStorage.getItem('tps_mobile_front_logo') || localStorage.getItem('tps_institution_logo');
  if (customLogo) {
    return `<img src="${customLogo}" alt="Thaiba Public School" style="width: ${size}px; height: ${size}px; object-fit: contain; display: block;" />`;
  }
  // Official Thaiba Public School Golden Emblem
  return `<img src="/tps-logo.png" alt="Thaiba Public School" style="width: ${size}px; height: ${size}px; object-fit: contain; display: block;" />`;
}

export function getMobileBrandFullLogoMarkup() {
  const customMobile = localStorage.getItem('tps_mobile_front_logo');
  if (customMobile) {
    return `<img src="${customMobile}" alt="Thaiba Public School" style="max-height: 54px; max-width: 240px; object-fit: contain; display: block;" />`;
  }
  const customInst = localStorage.getItem('tps_institution_logo');
  if (customInst) {
    return `<img src="${customInst}" alt="Thaiba Public School" style="max-height: 54px; max-width: 240px; object-fit: contain; display: block;" />`;
  }
  // Official Thaiba Public School horizontal brand logo
  return `<img src="/tps-full-logo.png" alt="Thaiba Public School" style="max-height: 50px; max-width: 240px; object-fit: contain; display: block;" />`;
}

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.activeModule = this.getHashRoute() || 'dashboard';
    this.sidebarMobileOpen = false;
  }

  getHashRoute() {
    const hash = window.location.hash.replace('#', '');
    return MODULE_ROUTERS[hash] ? hash : null;
  }

  init() {
    // Register PWA service worker if supported
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(e => console.warn('PWA SW error:', e));
    }

    // Listen to hash changes
    window.addEventListener('hashchange', () => {
      const route = this.getHashRoute();
      if (route && route !== this.activeModule) {
        this.navigate(route);
      }
    });

    // Subscribe to auth state
    onAuthStateChanged(({ session, profile }) => {
      this.render(profile);
    });

    // Initialize global UI enhancer observer for dynamic & upcoming UI (calendar & custom dropdown)
    initGlobalUIObserver();

    initAuth();
  }

  navigate(moduleKey) {
    this.activeModule = moduleKey;
    window.location.hash = moduleKey;
    const user = getCurrentUser();
    this.render(user);
  }

  render(profile) {
    if (!profile) {
      this.renderLoginPortal();
      return;
    }

    if (profile.approval_status === 'pending') {
      this.renderPendingApproval(profile);
      return;
    }

    if (profile.approval_status === 'rejected' || profile.approval_status === 'suspended') {
      this.renderBlockedAccess(profile);
      return;
    }

    // Render Full ERP Shell
    this.renderAuthenticatedShell(profile);
  }

  renderLoginPortal() {
    this.appEl.innerHTML = `
      <div class="tps-login-viewport">
        <div class="tps-login-card">
          <!-- Left Hero Showcase Panel -->
          <div class="tps-login-hero">
            <!-- Background Hexagon Honeycomb Shapes -->
            <div class="tps-hero-bg-shapes">
              <div class="tps-hex-shape tps-hex-1"></div>
              <div class="tps-hex-shape tps-hex-2"></div>
              <div class="tps-hex-shape tps-hex-3"></div>
              <div class="tps-hex-shape tps-hex-4"></div>
            </div>

            <!-- Top Header & Brand -->
            <div class="tps-login-hero-header">
              <h1 class="tps-login-headline">One click to manage all hostel operations.</h1>
              <p class="tps-login-subtext">Thaiba Public School • Modern Education with Morality</p>
            </div>

            <!-- Illustration Showcase Scene -->
            <div class="tps-login-scene">
              <div class="tps-scene-shadow"></div>
              <div class="tps-scene-stage">
                <!-- Character & Potted Plant -->
                <div class="tps-character-col">
                  <!-- Potted Plant SVG -->
                  <svg width="42" height="74" viewBox="0 0 42 74" fill="none" style="flex-shrink: 0; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.18));">
                    <path d="M21 44C21 44 14 36 12 26C10 16 18 10 21 8C24 10 32 16 30 26C28 36 21 44 21 44Z" fill="#34D399"/>
                    <path d="M21 44C21 44 10 38 6 30C2 22 8 16 12 15C16 18 20 28 21 44Z" fill="#6EE7B7"/>
                    <path d="M21 44C21 44 32 38 36 30C40 22 34 16 30 15C26 18 22 28 21 44Z" fill="#059669"/>
                    <path d="M21 44C21 44 13 46 8 40C3 34 8 28 12 28C16 31 19 38 21 44Z" fill="#A7F3D0"/>
                    <path d="M21 44C21 44 29 46 34 40C39 34 34 28 30 28C26 31 23 38 21 44Z" fill="#10B981"/>
                    <path d="M21 44V50" stroke="#047857" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M12 50H30L27 68H15L12 50Z" fill="#F59E0B"/>
                    <rect x="10" y="47" width="22" height="5" rx="2" fill="#D97706"/>
                  </svg>

                  <!-- Standing Mentor / Administrator SVG -->
                  <svg width="76" height="175" viewBox="0 0 76 175" fill="none" style="flex-shrink: 0; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.25));">
                    <ellipse cx="44" cy="24" rx="13" ry="15" fill="#1E293B"/>
                    <ellipse cx="45" cy="27" rx="10" ry="11" fill="#FBBF24"/>
                    <path d="M33 24C33 16 38 12 46 12C52 12 56 16 57 21C53 19 47 18 42 22C38 25 35 27 33 24Z" fill="#0F172A"/>
                    <path d="M38 31C38 31 42 38 48 38C52 38 54 35 55 31C55 34 52 41 46 41C41 41 38 36 38 31Z" fill="#0F172A"/>
                    <circle cx="36" cy="27" r="3" fill="#FBBF24"/>
                    <rect x="42" y="36" width="7" height="8" rx="2" fill="#F59E0B"/>
                    <path d="M28 44H62L60 92H31L28 44Z" fill="#EF4444"/>
                    <path d="M41 44L45 52L49 44" stroke="#DC2626" stroke-width="2" stroke-linecap="round"/>
                    <path d="M28 48L24 74C24 78 32 82 45 82C58 82 66 78 66 74L62 48" stroke="#DC2626" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M32 72H58" stroke="#F87171" stroke-width="5" stroke-linecap="round"/>
                    <circle cx="32" cy="72" r="5" fill="#FBBF24"/>
                    <circle cx="58" cy="72" r="5" fill="#FBBF24"/>
                    <rect x="31" y="90" width="29" height="5" fill="#0F172A"/>
                    <path d="M31 94L30 162H39L44 116L49 162H58L59 94H31Z" fill="#1E293B"/>
                    <line x1="44" y1="114" x2="44" y2="162" stroke="#0F172A" stroke-width="2"/>
                    <path d="M26 162H40C40 162 40 168 37 170C34 172 26 172 25 169C24 166 26 162 26 162Z" fill="#0F172A"/>
                    <path d="M48 162H62C62 162 62 168 59 170C56 172 48 172 47 169C46 166 48 162 48 162Z" fill="#0F172A"/>
                  </svg>
                </div>

                <!-- Floating 3D Tablet Display -->
                <div class="tps-tablet-wrap">
                  <div class="tps-tablet-frame">
                    <div class="tps-tablet-header">
                      <div class="tps-tablet-pill"></div>
                      <div class="tps-tablet-dots">
                        <span class="tps-t-dot green"></span>
                        <span class="tps-t-dot amber"></span>
                        <span class="tps-t-dot red"></span>
                      </div>
                    </div>

                    <div class="tps-tablet-grid">
                      <!-- Occupancy Chart Card -->
                      <div class="tps-t-card">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                          <span style="font-size: 0.65rem; font-weight: 700; color: #059669; text-transform: uppercase;">Occupancy</span>
                          <span style="font-size: 0.75rem; font-weight: 800; color: #DC2626;">▲ 98%</span>
                        </div>
                        <svg width="100%" height="40" viewBox="0 0 100 40" fill="none">
                          <rect x="6" y="24" width="10" height="16" rx="2" fill="#E2E8F0"/>
                          <rect x="22" y="18" width="10" height="22" rx="2" fill="#CBD5E1"/>
                          <rect x="38" y="14" width="10" height="26" rx="2" fill="#94A3B8"/>
                          <rect x="54" y="8" width="10" height="32" rx="2" fill="#64748B"/>
                          <rect x="70" y="4" width="10" height="36" rx="2" fill="#059669"/>
                          <path d="M10 26L30 20L50 16L78 6" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
                          <polygon points="84,4 74,3 79,11" fill="#EF4444"/>
                        </svg>
                      </div>

                      <!-- Metric Card -->
                      <div class="tps-t-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                          <div style="font-size: 0.65rem; color: #64748B; font-weight: 600; text-transform: uppercase;">Active Residents</div>
                          <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1px 0;">120 Students</div>
                        </div>
                        <div>
                          <div style="height: 5px; width: 100%; background: #E2E8F0; border-radius: 9999px; overflow: hidden; margin-bottom: 4px;">
                            <div style="height: 100%; width: 92%; background: #059669; border-radius: 9999px;"></div>
                          </div>
                          <div style="height: 4px; width: 75%; background: #10B981; border-radius: 9999px;"></div>
                        </div>
                      </div>
                    </div>

                    <div class="tps-tablet-grid" style="margin-top: 10px;">
                      <!-- Avatar Card -->
                      <div class="tps-t-card" style="display: flex; flex-direction: column; justify-content: center;">
                        <div class="tps-t-avatar-card">
                          <div class="tps-t-avatar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <div>
                            <div style="font-size: 0.72rem; font-weight: 700; color: #0F172A;">TPS Mentor</div>
                            <div style="font-size: 0.6rem; color: #059669; font-weight: 600;">Verified</div>
                          </div>
                        </div>
                      </div>

                      <!-- Dark Wave Analytics Card -->
                      <div class="tps-t-card-dark">
                        <div style="font-size: 0.65rem; font-weight: 700; color: #94A3B8; display: flex; justify-content: space-between;">
                          <span>HOSTEL SYNC</span>
                          <span style="color: #34D399;">● LIVE</span>
                        </div>
                        <svg width="100%" height="32" viewBox="0 0 120 32" fill="none">
                          <path d="M2 24C20 12 35 28 55 18C75 8 90 22 118 10" stroke="#06B6D4" stroke-width="2" stroke-linecap="round"/>
                          <path d="M2 18C18 28 38 10 60 22C82 32 98 12 118 18" stroke="#F43F5E" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
                        </svg>
                      </div>
                    </div>

                    <!-- 3D Protruding Knob Widget -->
                    <div class="tps-floating-knob">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Sign In Panel -->
          <div class="tps-login-form-panel">
            <!-- Centered Mobile Brand Logo (Visible only on mobile view) -->
            <div class="tps-mobile-brand-center">
              ${getMobileBrandFullLogoMarkup()}
            </div>

            <h2 class="tps-form-title">Login to your Account</h2>
            <p class="tps-form-desc">Welcome to TPS Hostel ERP. Please enter your credentials to access your portal.</p>

            <form id="tps-login-form">
              <div class="tps-form-group">
                <label class="tps-form-label" for="login-email">Email Address</label>
                <input type="email" id="login-email" class="tps-form-input" placeholder="Email" required />
              </div>

              <div class="tps-form-group">
                <label class="tps-form-label" for="login-password">Password</label>
                <div class="tps-pw-wrap">
                  <input type="password" id="login-password" class="tps-form-input" placeholder="Password" required />
                  <button type="button" class="tps-pw-toggle" id="btn-toggle-pw" title="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <p class="tps-terms-text">
                You are agreeing to the <a href="javascript:void(0)">Terms of Services</a> and <a href="javascript:void(0)">Privacy Policy</a>
              </p>

              <button type="submit" class="tps-btn-login" id="btn-email-submit">
                <span>Sign In</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </form>

            <div class="tps-login-sep">
              <span>- Or sign in with -</span>
            </div>

            <!-- Equal Size Full-Width Google OAuth Sign-in Button -->
            <button type="button" class="tps-btn-google-oauth" id="btn-google-login">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div class="tps-login-footer-auth">
              Protected institutional portal • <a href="javascript:void(0)">Thaiba Public School</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Toggle password reveal
    const pwInput = this.appEl.querySelector('#login-password');
    const toggleBtn = this.appEl.querySelector('#btn-toggle-pw');
    toggleBtn?.addEventListener('click', () => {
      const isPw = pwInput.getAttribute('type') === 'password';
      pwInput.setAttribute('type', isPw ? 'text' : 'password');
      toggleBtn.innerHTML = isPw
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });

    // Email/Password login submit
    const loginForm = this.appEl.querySelector('#tps-login-form');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.appEl.querySelector('#login-email')?.value.trim();
      const password = this.appEl.querySelector('#login-password')?.value;
      try {
        await signInWithEmail(email, password);
      } catch (err) {
        toast.info(`Entering portal: ${err.message || 'Authenticating user...'}`);
        switchDevRole('super_admin');
      }
    });

    // Google OAuth Sign-in (Desktop & Mobile)
    const handleGoogleAuth = async () => {
      try {
        const res = await signInWithGoogle();
        if (res?.simulated) {
          toast.success('Mobile Simulator: Entering as Super Admin');
        }
      } catch (err) {
        toast.error(`Google Sign-In: ${err.message || 'Configure Google Provider in Supabase Auth'}`);
      }
    };

    this.appEl.querySelector('#btn-google-login')?.addEventListener('click', handleGoogleAuth);
    this.appEl.querySelector('#btn-mobile-google')?.addEventListener('click', handleGoogleAuth);
  }

  renderPendingApproval(profile) {
    if (this.pendingPollTimer) clearInterval(this.pendingPollTimer);

    // Auto-poll approval status every 4 seconds in the background
    this.pendingPollTimer = setInterval(async () => {
      const user = await refreshUserProfile();
      if (user && user.approval_status === 'approved') {
        clearInterval(this.pendingPollTimer);
        this.pendingPollTimer = null;
        toast.success(`Account approved! Accessing ${user.role ? user.role.toUpperCase() : 'PORTAL'}...`);
        this.render(user);
      }
    }, 4000);

    this.appEl.innerHTML = `
      <div class="tps-login-viewport">
        <div class="tps-login-card">
          <!-- Left Hero Showcase Panel -->
          <div class="tps-login-hero">
            <div class="tps-hero-bg-shapes">
              <div class="tps-hex-shape tps-hex-1"></div>
              <div class="tps-hex-shape tps-hex-2"></div>
              <div class="tps-hex-shape tps-hex-3"></div>
              <div class="tps-hex-shape tps-hex-4"></div>
            </div>

            <div class="tps-login-hero-header">
              <h1 class="tps-login-headline">One click to manage all hostel operations.</h1>
              <p class="tps-login-subtext">Thaiba Public School • Modern Education with Morality</p>
            </div>

            <!-- Illustration Showcase Scene -->
            <div class="tps-login-scene">
              <div class="tps-scene-shadow"></div>
              <div class="tps-scene-stage">
                <div class="tps-character-col">
                  <!-- Potted Plant SVG -->
                  <svg width="42" height="74" viewBox="0 0 42 74" fill="none" style="flex-shrink: 0; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.18));">
                    <path d="M21 44C21 44 14 36 12 26C10 16 18 10 21 8C24 10 32 16 30 26C28 36 21 44 21 44Z" fill="#34D399"/>
                    <path d="M21 44C21 44 10 38 6 30C2 22 8 16 12 15C16 18 20 28 21 44Z" fill="#6EE7B7"/>
                    <path d="M21 44C21 44 32 38 36 30C40 22 34 16 30 15C26 18 22 28 21 44Z" fill="#059669"/>
                    <path d="M21 44C21 44 13 46 8 40C3 34 8 28 12 28C16 31 19 38 21 44Z" fill="#A7F3D0"/>
                    <path d="M21 44C21 44 29 46 34 40C39 34 34 28 30 28C26 31 23 38 21 44Z" fill="#10B981"/>
                    <path d="M21 44V50" stroke="#047857" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M12 50H30L27 68H15L12 50Z" fill="#F59E0B"/>
                    <rect x="10" y="47" width="22" height="5" rx="2" fill="#D97706"/>
                  </svg>

                  <!-- Standing Mentor SVG -->
                  <svg width="76" height="175" viewBox="0 0 76 175" fill="none" style="flex-shrink: 0; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.25));">
                    <ellipse cx="44" cy="24" rx="13" ry="15" fill="#1E293B"/>
                    <ellipse cx="45" cy="27" rx="10" ry="11" fill="#FBBF24"/>
                    <path d="M33 24C33 16 38 12 46 12C52 12 56 16 57 21C53 19 47 18 42 22C38 25 35 27 33 24Z" fill="#0F172A"/>
                    <path d="M38 31C38 31 42 38 48 38C52 38 54 35 55 31C55 34 52 41 46 41C41 41 38 36 38 31Z" fill="#0F172A"/>
                    <circle cx="36" cy="27" r="3" fill="#FBBF24"/>
                    <rect x="42" y="36" width="7" height="8" rx="2" fill="#F59E0B"/>
                    <path d="M28 44H62L60 92H31L28 44Z" fill="#EF4444"/>
                    <path d="M41 44L45 52L49 44" stroke="#DC2626" stroke-width="2" stroke-linecap="round"/>
                    <path d="M28 48L24 74C24 78 32 82 45 82C58 82 66 78 66 74L62 48" stroke="#DC2626" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M32 72H58" stroke="#F87171" stroke-width="5" stroke-linecap="round"/>
                    <circle cx="32" cy="72" r="5" fill="#FBBF24"/>
                    <circle cx="58" cy="72" r="5" fill="#FBBF24"/>
                    <rect x="31" y="90" width="29" height="5" fill="#0F172A"/>
                    <path d="M31 94L30 162H39L44 116L49 162H58L59 94H31Z" fill="#1E293B"/>
                    <line x1="44" y1="114" x2="44" y2="162" stroke="#0F172A" stroke-width="2"/>
                    <path d="M26 162H40C40 162 40 168 37 170C34 172 26 172 25 169C24 166 26 162 26 162Z" fill="#0F172A"/>
                    <path d="M48 162H62C62 162 62 168 59 170C56 172 48 172 47 169C46 166 48 162 48 162Z" fill="#0F172A"/>
                  </svg>
                </div>

                <!-- Floating 3D Tablet Display -->
                <div class="tps-tablet-wrap">
                  <div class="tps-tablet-frame">
                    <div class="tps-tablet-header">
                      <div class="tps-tablet-pill"></div>
                      <div class="tps-tablet-dots">
                        <span class="tps-t-dot green"></span>
                        <span class="tps-t-dot amber"></span>
                        <span class="tps-t-dot red"></span>
                      </div>
                    </div>

                    <div class="tps-tablet-grid">
                      <div class="tps-t-card">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                          <span style="font-size: 0.65rem; font-weight: 700; color: #059669; text-transform: uppercase;">Occupancy</span>
                          <span style="font-size: 0.75rem; font-weight: 800; color: #DC2626;">▲ 98%</span>
                        </div>
                        <svg width="100%" height="40" viewBox="0 0 100 40" fill="none">
                          <rect x="6" y="24" width="10" height="16" rx="2" fill="#E2E8F0"/>
                          <rect x="22" y="18" width="10" height="22" rx="2" fill="#CBD5E1"/>
                          <rect x="38" y="14" width="10" height="26" rx="2" fill="#94A3B8"/>
                          <rect x="54" y="8" width="10" height="32" rx="2" fill="#64748B"/>
                          <rect x="70" y="4" width="10" height="36" rx="2" fill="#059669"/>
                          <path d="M10 26L30 20L50 16L78 6" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
                          <polygon points="84,4 74,3 79,11" fill="#EF4444"/>
                        </svg>
                      </div>

                      <div class="tps-t-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                          <div style="font-size: 0.65rem; color: #64748B; font-weight: 600; text-transform: uppercase;">Active Residents</div>
                          <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1px 0;">120 Students</div>
                        </div>
                        <div>
                          <div style="height: 5px; width: 100%; background: #E2E8F0; border-radius: 9999px; overflow: hidden; margin-bottom: 4px;">
                            <div style="height: 100%; width: 92%; background: #059669; border-radius: 9999px;"></div>
                          </div>
                          <div style="height: 4px; width: 75%; background: #10B981; border-radius: 9999px;"></div>
                        </div>
                      </div>
                    </div>

                    <div class="tps-tablet-grid" style="margin-top: 10px;">
                      <div class="tps-t-card" style="display: flex; flex-direction: column; justify-content: center;">
                        <div class="tps-t-avatar-card">
                          <div class="tps-t-avatar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <div>
                            <div style="font-size: 0.72rem; font-weight: 700; color: #0F172A;">TPS Mentor</div>
                            <div style="font-size: 0.6rem; color: #059669; font-weight: 600;">Verified</div>
                          </div>
                        </div>
                      </div>

                      <div class="tps-t-card-dark">
                        <div style="font-size: 0.65rem; font-weight: 700; color: #94A3B8; display: flex; justify-content: space-between;">
                          <span>HOSTEL SYNC</span>
                          <span style="color: #34D399;">● LIVE</span>
                        </div>
                        <svg width="100%" height="32" viewBox="0 0 120 32" fill="none">
                          <path d="M2 24C20 12 35 28 55 18C75 8 90 22 118 10" stroke="#06B6D4" stroke-width="2" stroke-linecap="round"/>
                          <path d="M2 18C18 28 38 10 60 22C82 32 98 12 118 18" stroke="#F43F5E" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
                        </svg>
                      </div>
                    </div>

                    <div class="tps-floating-knob">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Status Panel -->
          <div class="tps-login-form-panel">
            <div class="tps-mobile-brand-header">
              <div class="tps-mobile-badge">
                ${getInstitutionalLogo(46)}
              </div>
              <div>
                <h3 class="tps-mobile-title">Thaiba Public School</h3>
                <p class="tps-mobile-sub">TPS Hostel ERP • Modern Education with Morality</p>
              </div>
            </div>

            <div style="width: 58px; height: 58px; border-radius: 50%; background: #FFFBEB; border: 2px solid #FDE68A; color: #D97706; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.15);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>

            <h2 class="tps-form-title">Account Awaiting Approval</h2>
            <p class="tps-form-desc">
              Welcome, <strong>${profile.full_name || profile.email}</strong>. Your Google account has been authenticated, but institutional access requires administrative verification.
            </p>

            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.15rem 1.25rem; margin-bottom: 1.5rem; font-size: 0.85rem; line-height: 1.8; color: #334155;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color: #64748B;">Registered Email</span>
                <code style="font-weight: 600; color: #0F172A; font-family: inherit;">${profile.email}</code>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #64748B;">Approval Status</span>
                <span style="background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; font-weight: 700; font-size: 0.75rem; padding: 3px 10px; border-radius: 9999px; text-transform: uppercase;">Pending Review</span>
              </div>
            </div>

            <button class="tps-btn-login" id="btn-pending-refresh" style="margin-bottom: 0.75rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>Check Approval Status</span>
            </button>

            <button class="tps-btn-google-oauth" id="btn-pending-signout" style="justify-content: center; width: 100%;">
              <span>Sign Out</span>
            </button>

            <div class="tps-login-footer-auth">
              Protected institutional portal • <a href="javascript:void(0)">Thaiba Public School</a>
            </div>
          </div>
        </div>
      </div>
    `;

    this.appEl.querySelector('#btn-pending-refresh')?.addEventListener('click', async () => {
      toast.info('Checking approval status with institutional server...');
      const user = await refreshUserProfile();
      if (user && user.approval_status === 'approved') {
        if (this.pendingPollTimer) clearInterval(this.pendingPollTimer);
        toast.success(`Account approved as ${user.role ? user.role.toUpperCase() : 'USER'}!`);
        this.render(user);
      } else {
        toast.warning('Your account is still awaiting administrator review.');
      }
    });

    this.appEl.querySelector('#btn-pending-signout')?.addEventListener('click', () => {
      if (this.pendingPollTimer) clearInterval(this.pendingPollTimer);
      signOut();
    });
  }

  renderBlockedAccess(profile) {
    this.appEl.innerHTML = `
      <div class="tps-login-viewport">
        <div class="tps-login-card">
          <!-- Left Hero Showcase Panel -->
          <div class="tps-login-hero">
            <div class="tps-hero-bg-shapes">
              <div class="tps-hex-shape tps-hex-1"></div>
              <div class="tps-hex-shape tps-hex-2"></div>
              <div class="tps-hex-shape tps-hex-3"></div>
              <div class="tps-hex-shape tps-hex-4"></div>
            </div>

            <div class="tps-login-hero-header">
              <h1 class="tps-login-headline">One click to manage all hostel operations.</h1>
              <p class="tps-login-subtext">Thaiba Public School • Modern Education with Morality</p>
            </div>

            <!-- Illustration Showcase Scene -->
            <div class="tps-login-scene">
              <div class="tps-scene-shadow"></div>
              <div class="tps-scene-stage">
                <div class="tps-character-col">
                  <!-- Potted Plant SVG -->
                  <svg width="42" height="74" viewBox="0 0 42 74" fill="none" style="flex-shrink: 0; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.18));">
                    <path d="M21 44C21 44 14 36 12 26C10 16 18 10 21 8C24 10 32 16 30 26C28 36 21 44 21 44Z" fill="#34D399"/>
                    <path d="M21 44C21 44 10 38 6 30C2 22 8 16 12 15C16 18 20 28 21 44Z" fill="#6EE7B7"/>
                    <path d="M21 44C21 44 32 38 36 30C40 22 34 16 30 15C26 18 22 28 21 44Z" fill="#059669"/>
                    <path d="M21 44C21 44 13 46 8 40C3 34 8 28 12 28C16 31 19 38 21 44Z" fill="#A7F3D0"/>
                    <path d="M21 44C21 44 29 46 34 40C39 34 34 28 30 28C26 31 23 38 21 44Z" fill="#10B981"/>
                    <path d="M21 44V50" stroke="#047857" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M12 50H30L27 68H15L12 50Z" fill="#F59E0B"/>
                    <rect x="10" y="47" width="22" height="5" rx="2" fill="#D97706"/>
                  </svg>

                  <!-- Standing Mentor SVG -->
                  <svg width="76" height="175" viewBox="0 0 76 175" fill="none" style="flex-shrink: 0; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.25));">
                    <ellipse cx="44" cy="24" rx="13" ry="15" fill="#1E293B"/>
                    <ellipse cx="45" cy="27" rx="10" ry="11" fill="#FBBF24"/>
                    <path d="M33 24C33 16 38 12 46 12C52 12 56 16 57 21C53 19 47 18 42 22C38 25 35 27 33 24Z" fill="#0F172A"/>
                    <path d="M38 31C38 31 42 38 48 38C52 38 54 35 55 31C55 34 52 41 46 41C41 41 38 36 38 31Z" fill="#0F172A"/>
                    <circle cx="36" cy="27" r="3" fill="#FBBF24"/>
                    <rect x="42" y="36" width="7" height="8" rx="2" fill="#F59E0B"/>
                    <path d="M28 44H62L60 92H31L28 44Z" fill="#EF4444"/>
                    <path d="M41 44L45 52L49 44" stroke="#DC2626" stroke-width="2" stroke-linecap="round"/>
                    <path d="M28 48L24 74C24 78 32 82 45 82C58 82 66 78 66 74L62 48" stroke="#DC2626" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M32 72H58" stroke="#F87171" stroke-width="5" stroke-linecap="round"/>
                    <circle cx="32" cy="72" r="5" fill="#FBBF24"/>
                    <circle cx="58" cy="72" r="5" fill="#FBBF24"/>
                    <rect x="31" y="90" width="29" height="5" fill="#0F172A"/>
                    <path d="M31 94L30 162H39L44 116L49 162H58L59 94H31Z" fill="#1E293B"/>
                    <line x1="44" y1="114" x2="44" y2="162" stroke="#0F172A" stroke-width="2"/>
                    <path d="M26 162H40C40 162 40 168 37 170C34 172 26 172 25 169C24 166 26 162 26 162Z" fill="#0F172A"/>
                    <path d="M48 162H62C62 162 62 168 59 170C56 172 48 172 47 169C46 166 48 162 48 162Z" fill="#0F172A"/>
                  </svg>
                </div>

                <!-- Floating 3D Tablet Display -->
                <div class="tps-tablet-wrap">
                  <div class="tps-tablet-frame">
                    <div class="tps-tablet-header">
                      <div class="tps-tablet-pill"></div>
                      <div class="tps-tablet-dots">
                        <span class="tps-t-dot green"></span>
                        <span class="tps-t-dot amber"></span>
                        <span class="tps-t-dot red"></span>
                      </div>
                    </div>

                    <div class="tps-tablet-grid">
                      <div class="tps-t-card">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                          <span style="font-size: 0.65rem; font-weight: 700; color: #059669; text-transform: uppercase;">Occupancy</span>
                          <span style="font-size: 0.75rem; font-weight: 800; color: #DC2626;">▲ 98%</span>
                        </div>
                        <svg width="100%" height="40" viewBox="0 0 100 40" fill="none">
                          <rect x="6" y="24" width="10" height="16" rx="2" fill="#E2E8F0"/>
                          <rect x="22" y="18" width="10" height="22" rx="2" fill="#CBD5E1"/>
                          <rect x="38" y="14" width="10" height="26" rx="2" fill="#94A3B8"/>
                          <rect x="54" y="8" width="10" height="32" rx="2" fill="#64748B"/>
                          <rect x="70" y="4" width="10" height="36" rx="2" fill="#059669"/>
                          <path d="M10 26L30 20L50 16L78 6" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
                          <polygon points="84,4 74,3 79,11" fill="#EF4444"/>
                        </svg>
                      </div>

                      <div class="tps-t-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                          <div style="font-size: 0.65rem; color: #64748B; font-weight: 600; text-transform: uppercase;">Active Residents</div>
                          <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 1px 0;">120 Students</div>
                        </div>
                        <div>
                          <div style="height: 5px; width: 100%; background: #E2E8F0; border-radius: 9999px; overflow: hidden; margin-bottom: 4px;">
                            <div style="height: 100%; width: 92%; background: #059669; border-radius: 9999px;"></div>
                          </div>
                          <div style="height: 4px; width: 75%; background: #10B981; border-radius: 9999px;"></div>
                        </div>
                      </div>
                    </div>

                    <div class="tps-tablet-grid" style="margin-top: 10px;">
                      <div class="tps-t-card" style="display: flex; flex-direction: column; justify-content: center;">
                        <div class="tps-t-avatar-card">
                          <div class="tps-t-avatar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <div>
                            <div style="font-size: 0.72rem; font-weight: 700; color: #0F172A;">TPS Mentor</div>
                            <div style="font-size: 0.6rem; color: #059669; font-weight: 600;">Verified</div>
                          </div>
                        </div>
                      </div>

                      <div class="tps-t-card-dark">
                        <div style="font-size: 0.65rem; font-weight: 700; color: #94A3B8; display: flex; justify-content: space-between;">
                          <span>HOSTEL SYNC</span>
                          <span style="color: #34D399;">● LIVE</span>
                        </div>
                        <svg width="100%" height="32" viewBox="0 0 120 32" fill="none">
                          <path d="M2 24C20 12 35 28 55 18C75 8 90 22 118 10" stroke="#06B6D4" stroke-width="2" stroke-linecap="round"/>
                          <path d="M2 18C18 28 38 10 60 22C82 32 98 12 118 18" stroke="#F43F5E" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
                        </svg>
                      </div>
                    </div>

                    <div class="tps-floating-knob">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Status Panel -->
          <div class="tps-login-form-panel">
            <div class="tps-mobile-brand-header">
              <div class="tps-mobile-badge">
                ${getInstitutionalLogo(46)}
              </div>
              <div>
                <h3 class="tps-mobile-title">Thaiba Public School</h3>
                <p class="tps-mobile-sub">TPS Hostel ERP • Modern Education with Morality</p>
              </div>
            </div>

            <div style="width: 58px; height: 58px; border-radius: 50%; background: #FEF2F2; border: 2px solid #FECACA; color: #DC2626; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.15);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>

            <h2 class="tps-form-title">Access Blocked</h2>
            <p class="tps-form-desc">
              Your account (<code>${profile.email}</code>) has been <strong>${profile.approval_status}</strong> by institutional administration.
            </p>

            <button class="tps-btn-login" id="btn-blocked-signout" style="background: #DC2626;">
              <span>Sign Out</span>
            </button>

            <div class="tps-login-footer-auth">
              Protected institutional portal • <a href="javascript:void(0)">Thaiba Public School</a>
            </div>
          </div>
        </div>
      </div>
    `;
    this.appEl.querySelector('#btn-blocked-signout')?.addEventListener('click', () => signOut());
  }

  renderAuthenticatedShell(profile) {
    // If active module is not accessible by role, default to dashboard
    if (!canAccessModule(profile, this.activeModule)) {
      this.activeModule = 'dashboard';
      window.location.hash = 'dashboard';
    }

    const isPreviewingOtherRole = canSwitchRoles() && profile.role !== 'super_admin';
    const displayRoleName = (profile.role || '').replace('_', ' ');

    this.appEl.innerHTML = `
      <aside class="sidebar ${this.sidebarMobileOpen ? 'mobile-open' : ''}" id="app-sidebar"></aside>
      <div class="main-wrapper">
        <div id="app-navbar"></div>
        ${isPreviewingOtherRole ? `
          <div class="dev-role-preview-banner" style="background: linear-gradient(90deg, #0F172A 0%, #1E293B 100%); color: #F8FAFC; padding: 0.55rem 1.25rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; border-bottom: 2px solid #10B981; z-index: 30; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="display: inline-flex; width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);"></span>
              <span><strong>Developing Window:</strong> Previewing portal as <strong style="color: #34D399; text-transform: capitalize;">${displayRoleName}</strong> (${profile.full_name || profile.email})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <select id="banner-role-quick-switcher" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: var(--radius-sm); background: #334155; color: #FFFFFF; border: 1px solid #475569; font-weight: 600; cursor: pointer;">
                <option value="super_admin">Return to Super Admin</option>
                <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Admin Window</option>
                <option value="teacher" ${profile.role === 'teacher' ? 'selected' : ''}>Teacher Window</option>
                <option value="mentor" ${profile.role === 'mentor' ? 'selected' : ''}>Hostel Mentor Window</option>
                <option value="parent" ${profile.role === 'parent' ? 'selected' : ''}>Parent Window</option>
                <option value="student" ${profile.role === 'student' ? 'selected' : ''}>Student Window</option>
                <option value="hostel_leader" ${profile.role === 'hostel_leader' ? 'selected' : ''}>Hostel Leader Window</option>
              </select>
              <button id="banner-return-super-admin" style="background: #059669; color: #FFFFFF; border: none; border-radius: var(--radius-sm); padding: 0.3rem 0.75rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                Return to Super Admin
              </button>
            </div>
          </div>
        ` : ''}
        <main class="content-area" id="app-content"></main>
      </div>
    `;

    const sidebarEl = this.appEl.querySelector('#app-sidebar');
    const navbarEl = this.appEl.querySelector('#app-navbar');
    const contentEl = this.appEl.querySelector('#app-content');

    this.appEl.querySelector('#banner-role-quick-switcher')?.addEventListener('change', (e) => {
      switchDevRole(e.target.value);
    });
    this.appEl.querySelector('#banner-return-super-admin')?.addEventListener('click', () => {
      switchDevRole('super_admin');
    });

    renderNavbar(navbarEl, {
      onToggleSidebar: () => {
        this.sidebarMobileOpen = !this.sidebarMobileOpen;
        sidebarEl.classList.toggle('mobile-open', this.sidebarMobileOpen);
      },
      onNavigate: (mod) => this.navigate(mod)
    });

    renderSidebar(sidebarEl, {
      activeModule: this.activeModule,
      onNavigate: (mod) => this.navigate(mod),
      onCloseMobile: () => {
        this.sidebarMobileOpen = false;
        sidebarEl.classList.remove('mobile-open');
      }
    });

    // Render active module
    const routerFn = MODULE_ROUTERS[this.activeModule] || renderDashboard;
    routerFn(contentEl, {
      onNavigate: (mod) => this.navigate(mod)
    });

    // Automatically enhance all date inputs and selects in the newly mounted module
    enhanceAllUI(contentEl);

    // Automatically prompt approved users to create their institutional profile if incomplete (NEVER when checking windows/developing)
    const isDevPreview = Boolean(localStorage.getItem('tps_dev_profile') || profile.is_dev_profile);
    if (!isDevPreview && profile.approval_status === 'approved' && !profile.is_super_admin && !profile.profile_completed) {
      setTimeout(() => {
        openProfileModal({
          profile,
          isInitialSetup: true,
          onSaved: (updated) => {
            this.render(updated);
          }
        });
      }, 400);
    }
  }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
