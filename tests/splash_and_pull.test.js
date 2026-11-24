import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountSplashScreen, dismissSplashScreen, getSplashScreenHTML } from '../src/components/splash-screen.js';
import { initPullToRefresh } from '../src/components/pull-to-refresh.js';

describe('Luxury Opening Animation & Native Special UI', () => {
  let origDoc, origWin;

  beforeEach(() => {
    origDoc = global.document;
    origWin = global.window;

    const elements = new Map();
    const bodyElements = [];

    const mockDoc = {
      getElementById: (id) => elements.get(id) || null,
      createElement: (tag) => {
        const el = {
          id: '',
          className: '',
          innerHTML: '',
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); el.className += ` ${c}`; },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
          },
          parentNode: null,
          querySelector(sel) {
            if (sel === '#tps-splash-status-text') return { textContent: 'Initializing...' };
            if (sel === '.tps-pull-text') return { textContent: 'Pull to refresh' };
            return null;
          },
          removeChild(child) {
            const idx = bodyElements.indexOf(child);
            if (idx >= 0) bodyElements.splice(idx, 1);
            if (child.id) elements.delete(child.id);
          }
        };
        return el;
      },
      body: {
        appendChild: (child) => {
          bodyElements.push(child);
          child.parentNode = mockDoc.body;
          if (child.id) elements.set(child.id, child);
        }
      }
    };

    global.document = mockDoc;
    global.window = {
      addEventListener: vi.fn(),
      scrollY: 0
    };
  });

  afterEach(() => {
    global.document = origDoc;
    global.window = origWin;
  });

  it('renders luxury opening splash screen with emblem, typography and neon progress', () => {
    mountSplashScreen();
    const splash = global.document.getElementById('tps-opening-splash');
    expect(splash).not.toBeNull();
    expect(splash.innerHTML).toContain('THAIBA PUBLIC SCHOOL');
    expect(splash.innerHTML).toContain('Modern Education with Morality');
    expect(splash.innerHTML).toContain('tps-splash-loader-bar');
  });

  it('generates splash screen HTML with security badge and aura glows', () => {
    const html = getSplashScreenHTML();
    expect(html).toContain('aura-emerald');
    expect(html).toContain('aura-gold');
    expect(html).toContain('tps-splash-ring');
    expect(html).toContain('Offline-First Enterprise');
  });

  it('dismisses splash screen with smooth exit animation', async () => {
    mountSplashScreen();
    const splash = global.document.getElementById('tps-opening-splash');
    expect(splash).not.toBeNull();

    dismissSplashScreen(10);
    await new Promise(r => setTimeout(r, 60));
    expect(splash.classList.contains('is-dismissing')).toBe(true);
  });

  it('initializes pull to refresh indicator in document body', () => {
    initPullToRefresh(vi.fn());
    const indicator = global.document.getElementById('tps-pull-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.innerHTML).toContain('tps-pull-pill');
  });
});
