import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../src/lib/db.js';
import {
  CHANNEL_ID,
  isLocalNotificationsSupported,
  triggerTestClassNotification,
  scheduleClassTimetableNotifications
} from '../src/lib/class-notifications.js';
import { renderTimetableModule } from '../src/modules/timetable/index.js';
import { switchDevRole } from '../src/lib/auth.js';

describe('Android Standalone APK & Class Timetable Notification Bar Alerts', () => {
  const memStore = {};
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
      getItem: (k) => memStore[k] || null,
      setItem: (k, v) => { memStore[k] = String(v); },
      removeItem: (k) => { delete memStore[k]; },
      clear: () => { Object.keys(memStore).forEach(k => delete memStore[k]); }
    };
  }

  beforeEach(() => {
    db.initStore();
  });

  it('defines the high-importance notification channel ID for class alerts', () => {
    expect(CHANNEL_ID).toBe('tps_class_alerts');
  });

  it('safely handles notification checks without crashing in test environment', () => {
    expect(typeof isLocalNotificationsSupported()).toBe('boolean');
  });

  it('triggers test class notification gracefully in web/test environment', async () => {
    const result = await triggerTestClassNotification();
    // In node/vitest environment, should complete safely without throwing
    expect(result).toBeDefined();
  });

  it('schedules class timetable notifications for classrooms without crashing', async () => {
    switchDevRole('teacher');
    await expect(scheduleClassTimetableNotifications()).resolves.not.toThrow();

    switchDevRole('admin');
    await expect(scheduleClassTimetableNotifications()).resolves.not.toThrow();
  });

  it('renders native notification bar alerts card and action buttons in timetable view', async () => {
    switchDevRole('teacher');

    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    await renderTimetableModule(container, { onNavigate: () => {} });

    // Verify Notification Bar Card elements
    expect(container.innerHTML).toContain('Class Notification Bar Alerts');
    expect(container.innerHTML).toContain('btn-test-class-notif');
    expect(container.innerHTML).toContain('btn-sync-class-notif');
    expect(container.innerHTML).toContain('Test Notification');
    expect(container.innerHTML).toContain('Sync Class Alarms');
  });
});
