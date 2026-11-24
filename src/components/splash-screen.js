/**
 * TPS ERP — Luxury Opening Splash Screen & Animated Loader
 * Provides an entrance animation with ambient lighting, emblem pulse,
 * shimmering typography, neon progress line, and haptic feedback.
 */

import { triggerHaptic } from '../lib/native-bridge.js';

let splashElement = null;
let dismissTimer = null;

export function mountSplashScreen() {
  if (typeof document === 'undefined') return;

  // Check if splash screen already exists in DOM (e.g. from index.html)
  splashElement = document.getElementById('tps-opening-splash');
  if (splashElement) return;

  const div = document.createElement('div');
  div.id = 'tps-opening-splash';
  div.className = 'tps-opening-splash';
  div.innerHTML = getSplashScreenHTML();
  document.body.appendChild(div);
  splashElement = div;
}

export function getSplashScreenHTML() {
  return `
    <div class="tps-splash-backdrop">
      <!-- Ambient Radiant Aura Glows -->
      <div class="tps-splash-aura aura-emerald"></div>
      <div class="tps-splash-aura aura-gold"></div>

      <!-- Main Animated Centerpiece -->
      <div class="tps-splash-content">
        <!-- Emblem with Pulsing Halo Rings -->
        <div class="tps-splash-emblem-wrap">
          <div class="tps-splash-ring ring-outer"></div>
          <div class="tps-splash-ring ring-mid"></div>
          <div class="tps-splash-emblem">
            <img src="/tps-emblem.png" alt="Thaiba Public School" onerror="this.src='/tps-logo.png'" />
            <div class="tps-emblem-shimmer"></div>
          </div>
        </div>

        <!-- Typography -->
        <div class="tps-splash-text">
          <div class="tps-splash-institution">THAIBA PUBLIC SCHOOL</div>
          <div class="tps-splash-tagline">Modern Education with Morality</div>
        </div>

        <!-- Sleek Neon Loading Capsule -->
        <div class="tps-splash-loader-track">
          <div class="tps-splash-loader-bar"></div>
        </div>

        <!-- Dynamic Micro-Status Caption -->
        <div class="tps-splash-status" id="tps-splash-status-text">
          Initializing Institutional Engine...
        </div>

        <!-- Version & Security Badge -->
        <div class="tps-splash-security-badge">
          <span class="badge-dot"></span>
          <span>Offline-First Enterprise • v1.9.79</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Dismiss the splash screen with a cinematic fade & scale effect
 */
export function dismissSplashScreen(delayMs = 350) {
  if (typeof document === 'undefined') return;

  splashElement = document.getElementById('tps-opening-splash');
  if (!splashElement) return;

  if (dismissTimer) clearTimeout(dismissTimer);

  dismissTimer = setTimeout(() => {
    if (!splashElement) return;
    
    // Update status to Ready right before fading
    const statusText = splashElement.querySelector('#tps-splash-status-text');
    if (statusText) statusText.textContent = 'Welcome • Ready';

    splashElement.classList.add('is-dismissing');
    triggerHaptic('light').catch(() => {});

    setTimeout(() => {
      if (splashElement && splashElement.parentNode) {
        splashElement.parentNode.removeChild(splashElement);
        splashElement = null;
      }
    }, 500);
  }, delayMs);
}
