/**
 * TPS ERP — Native Android Bridge
 * Advanced Native Specs:
 * 1. Hardware Haptic Feedback (tick, success, warning, impact)
 * 2. Hardware Back Button lifecycle management (closes modals, back navigation, double-tap to exit)
 * 3. Native Status Bar theming (deep navy #0F172A matching TPS brand)
 * 4. OS-level Network monitoring (instant offline/online sync trigger)
 * 5. Smooth Native Splash Screen fade-out
 * 6. Keyboard resize & auto-scroll optimization
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { toast } from './toast.js';
import { db } from './db.js';

/**
 * Check if running inside native Capacitor Android shell
 */
export function isNativeAndroid() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.Capacitor &&
    typeof window.Capacitor.getPlatform === 'function' &&
    window.Capacitor.getPlatform() === 'android'
  );
}

/**
 * 1. Native Haptic Feedback engine
 * Provides crisp physical vibration clicks for student attendance, buttons, and switches
 */
export async function triggerHaptic(type = 'light') {
  if (typeof window === 'undefined') return;

  try {
    if (window.Capacitor?.isPluginAvailable?.('Haptics')) {
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'warning':
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case 'error':
          await Haptics.notification({ type: NotificationType.Error });
          break;
        case 'selection':
          await Haptics.selectionStart();
          await Haptics.selectionChanged();
          await Haptics.selectionEnd();
          break;
        default:
          await Haptics.impact({ style: ImpactStyle.Light });
      }
      return;
    }
  } catch {}

  // Web fallback if Capacitor Haptics not available
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (type === 'success') navigator.vibrate([30, 60, 30]);
      else if (type === 'error' || type === 'warning') navigator.vibrate([60, 50, 60]);
      else navigator.vibrate(20);
    }
  } catch {}
}

/**
 * 2. Native Status Bar & Immersive System Styling
 */
export async function initNativeStatusBar() {
  if (!isNativeAndroid()) return;
  try {
    if (window.Capacitor?.isPluginAvailable?.('StatusBar')) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0F172A' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (err) {
    console.warn('[NativeBridge] StatusBar config warning:', err);
  }
}

/**
 * 3. Native Splash Screen controller
 */
export async function hideNativeSplashScreen(delayMs = 250) {
  if (!isNativeAndroid()) return;
  try {
    if (window.Capacitor?.isPluginAvailable?.('SplashScreen')) {
      setTimeout(async () => {
        try {
          await SplashScreen.hide({ fadeOutDuration: 300 });
        } catch {}
      }, delayMs);
    }
  } catch {}
}

/**
 * 4. Native Hardware Back Button Handler
 * Intercepts physical back button on Android to close modals, slide panels, and prompt exit
 */
let lastBackPressTime = 0;
export function initNativeBackButton(onNavigate) {
  if (!isNativeAndroid()) return;

  try {
    if (window.Capacitor?.isPluginAvailable?.('App')) {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        // Priority 1: Check if any modal or dialog is open
        const openModal = document.querySelector('.modal-overlay:not([style*="display: none"]), .custom-modal-backdrop, [data-modal-open="true"]');
        if (openModal) {
          const closeBtn = openModal.querySelector('.modal-close, [data-modal-close], .btn-close, .role-picker-close');
          if (closeBtn && typeof closeBtn.click === 'function') {
            closeBtn.click();
            triggerHaptic('light');
            return;
          }
          openModal.remove();
          triggerHaptic('light');
          return;
        }

        // Priority 2: Check if sidebar/drawer is open on mobile
        const sidebar = document.querySelector('.sidebar.is-open, #sidebar.active, .mobile-drawer-open');
        if (sidebar) {
          sidebar.classList.remove('is-open', 'active', 'mobile-drawer-open');
          const overlay = document.querySelector('.sidebar-overlay, .drawer-backdrop');
          if (overlay) overlay.style.display = 'none';
          triggerHaptic('light');
          return;
        }

        // Priority 3: Check if inside Attendance Roster view
        const rosterBackBtn = document.querySelector('#att-btn-back-to-cards');
        if (rosterBackBtn) {
          rosterBackBtn.click();
          triggerHaptic('light');
          return;
        }

        // Priority 4: Browser hash/history navigation
        if (typeof window !== 'undefined' && window.location.hash && window.location.hash !== '#' && window.location.hash !== '#dashboard') {
          if (typeof onNavigate === 'function') {
            onNavigate('dashboard');
          } else {
            window.location.hash = '#dashboard';
          }
          triggerHaptic('light');
          return;
        }

        // Priority 5: Double tap back button to exit app on Root Dashboard
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressTime = now;
          toast.info('Press back again to exit TPS ERP');
          triggerHaptic('light');
        }
      });
    }
  } catch (err) {
    console.warn('[NativeBridge] BackButton listener error:', err);
  }
}

/**
 * 5. Native OS-Level Network Status Monitoring
 * Detects network changes faster and more reliably than HTML5 navigator.onLine
 */
export async function initNativeNetworkMonitor() {
  if (typeof window === 'undefined') return;

  try {
    if (window.Capacitor?.isPluginAvailable?.('Network')) {
      Network.addListener('networkStatusChange', async (status) => {
        console.log('[NativeBridge] Network status changed:', status.connectionType, status.connected);
        if (status.connected) {
          triggerHaptic('light');
          await db.flushOfflineOutbox();
          window.dispatchEvent(new CustomEvent('tps:online', { detail: status }));
        } else {
          triggerHaptic('warning');
          window.dispatchEvent(new CustomEvent('tps:offline', { detail: status }));
        }
      });
    }
  } catch (err) {
    console.warn('[NativeBridge] Network monitor error:', err);
  }
}

/**
 * 6. Native Keyboard Adjustment
 */
export async function initNativeKeyboard() {
  if (!isNativeAndroid()) return;

  try {
    if (window.Capacitor?.isPluginAvailable?.('Keyboard')) {
      await Keyboard.setResizeMode({ mode: 'body' });
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.classList.add('keyboard-is-visible');
        const activeEl = document.activeElement;
        if (activeEl && typeof activeEl.scrollIntoView === 'function') {
          setTimeout(() => {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-is-visible');
      });
    }
  } catch (err) {
    console.warn('[NativeBridge] Keyboard setup error:', err);
  }
}

/**
 * Master Native Services Bootstrapper
 */
export async function initAllNativeServices(onNavigate) {
  if (typeof window === 'undefined') return;

  await initNativeStatusBar();
  await initNativeNetworkMonitor();
  await initNativeKeyboard();
  initNativeBackButton(onNavigate);
  await hideNativeSplashScreen(400);
}
