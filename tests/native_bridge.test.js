import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isNativeAndroid,
  triggerHaptic,
  initNativeStatusBar,
  hideNativeSplashScreen,
  initNativeBackButton,
  initNativeNetworkMonitor,
  initNativeKeyboard,
  initAllNativeServices
} from '../src/lib/native-bridge.js';

describe('Native Android Bridge & Advanced Specs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects native Android environment accurately', () => {
    // In node/jsdom test env without Capacitor Android platform
    expect(isNativeAndroid()).toBe(false);

    // Mock Capacitor Android
    const origWindow = global.window;
    global.window = {
      Capacitor: {
        getPlatform: () => 'android',
        isPluginAvailable: () => true
      }
    };
    expect(isNativeAndroid()).toBe(true);
    global.window = origWindow;
  });

  it('triggers haptics gracefully across various styles', async () => {
    await expect(triggerHaptic('light')).resolves.not.toThrow();
    await expect(triggerHaptic('medium')).resolves.not.toThrow();
    await expect(triggerHaptic('heavy')).resolves.not.toThrow();
    await expect(triggerHaptic('success')).resolves.not.toThrow();
    await expect(triggerHaptic('warning')).resolves.not.toThrow();
    await expect(triggerHaptic('error')).resolves.not.toThrow();
    await expect(triggerHaptic('selection')).resolves.not.toThrow();
  });

  it('initializes status bar without errors', async () => {
    await expect(initNativeStatusBar()).resolves.not.toThrow();
  });

  it('hides native splash screen safely', async () => {
    await expect(hideNativeSplashScreen(10)).resolves.not.toThrow();
  });

  it('registers native hardware back button handler', () => {
    expect(() => initNativeBackButton(vi.fn())).not.toThrow();
  });

  it('initializes native network monitor and keyboard', async () => {
    await expect(initNativeNetworkMonitor()).resolves.not.toThrow();
    await expect(initNativeKeyboard()).resolves.not.toThrow();
  });

  it('bootstraps all native services via initAllNativeServices', async () => {
    await expect(initAllNativeServices(vi.fn())).resolves.not.toThrow();
  });
});
