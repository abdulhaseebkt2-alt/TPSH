/**
 * TPS ERP — Native Mobile Pull-to-Refresh Component
 * Adds spring-physics pull down refresh with tactile haptic feedback
 */

import { triggerHaptic } from '../lib/native-bridge.js';
import { db } from '../lib/db.js';
import { toast } from '../lib/toast.js';

let isPulling = false;
let startY = 0;
let currentY = 0;
let isRefreshing = false;
let pullIndicator = null;
const THRESHOLD = 70;

export function initPullToRefresh(refreshCallback) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Create pull indicator if not exists
  if (!document.getElementById('tps-pull-indicator')) {
    pullIndicator = document.createElement('div');
    pullIndicator.id = 'tps-pull-indicator';
    pullIndicator.className = 'tps-pull-indicator';
    pullIndicator.innerHTML = `
      <div class="tps-pull-pill">
        <svg class="tps-pull-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        <span class="tps-pull-text">Pull to refresh</span>
      </div>
    `;
    document.body.appendChild(pullIndicator);
  } else {
    pullIndicator = document.getElementById('tps-pull-indicator');
  }

  let hasTriggeredThresholdHaptic = false;

  window.addEventListener('touchstart', (e) => {
    if (isRefreshing) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY <= 2) {
      isPulling = true;
      startY = e.touches[0].pageY;
      hasTriggeredThresholdHaptic = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isPulling || isRefreshing) return;
    currentY = e.touches[0].pageY;
    const diff = currentY - startY;

    if (diff > 0) {
      // Resistance curve for smooth native spring feel
      const pullDistance = Math.min(100, Math.pow(diff, 0.85) * 1.5);
      if (pullIndicator) {
        pullIndicator.style.transform = `translate(-50%, ${pullDistance - 50}px)`;
        pullIndicator.style.opacity = String(Math.min(1, pullDistance / 50));

        const pullText = pullIndicator.querySelector('.tps-pull-text');
        if (pullDistance >= THRESHOLD) {
          pullIndicator.classList.add('is-ready');
          if (pullText) pullText.textContent = 'Release to sync';
          if (!hasTriggeredThresholdHaptic) {
            triggerHaptic('light').catch(() => {});
            hasTriggeredThresholdHaptic = true;
          }
        } else {
          pullIndicator.classList.remove('is-ready');
          if (pullText) pullText.textContent = 'Pull to refresh';
          hasTriggeredThresholdHaptic = false;
        }
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', async () => {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    const diff = currentY - startY;
    const pullDistance = Math.min(100, Math.pow(Math.max(0, diff), 0.85) * 1.5);

    if (pullDistance >= THRESHOLD && pullIndicator) {
      isRefreshing = true;
      pullIndicator.classList.add('is-refreshing');
      pullIndicator.style.transform = 'translate(-50%, 25px)';
      const pullText = pullIndicator.querySelector('.tps-pull-text');
      if (pullText) pullText.textContent = 'Syncing cloud...';

      triggerHaptic('medium').catch(() => {});

      try {
        // Sync offline outbox and pull keys
        await db.flushOfflineOutbox();
        if (typeof refreshCallback === 'function') {
          await refreshCallback();
        }
        toast.success('Sync complete! Up to date.');
        triggerHaptic('success').catch(() => {});
      } catch (err) {
        console.warn('Pull-to-refresh sync error:', err);
      } finally {
        setTimeout(() => {
          if (pullIndicator) {
            pullIndicator.style.transform = 'translate(-50%, -60px)';
            pullIndicator.style.opacity = '0';
            pullIndicator.classList.remove('is-refreshing', 'is-ready');
          }
          isRefreshing = false;
        }, 400);
      }
    } else if (pullIndicator) {
      pullIndicator.style.transform = 'translate(-50%, -60px)';
      pullIndicator.style.opacity = '0';
      pullIndicator.classList.remove('is-ready');
    }
    startY = 0;
    currentY = 0;
  });
}
