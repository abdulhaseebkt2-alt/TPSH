import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from './db.js';
import { getCurrentUser } from './auth.js';
import { toast } from './toast.js';

// Days map for timetable day codes
const DAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CHANNEL_ID = 'tps_class_alerts';

/**
 * Check if LocalNotifications is supported in current runtime environment
 */
export function isLocalNotificationsSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.Capacitor &&
    typeof window.Capacitor.isPluginAvailable === 'function' &&
    window.Capacitor.isPluginAvailable('LocalNotifications')
  );
}

/**
 * Initialize high-importance Android Notification Channel
 * Guarantees heads-up popup and notification bar alert
 */
export async function initNotificationChannel() {
  try {
    if (!isLocalNotificationsSupported()) return false;
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Class Timetable Alerts',
      description: 'Heads-up notification bar alerts for scheduled classes and timetable periods',
      importance: 5, // High / Heads-up notification on Android notification bar
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#4F46E5'
    });
    return true;
  } catch (err) {
    console.warn('[ClassNotifications] Failed to create channel:', err);
    return false;
  }
}

/**
 * Request notification permissions from Android (POST_NOTIFICATIONS on Android 13+)
 */
export async function requestNotificationPermission() {
  try {
    if (isLocalNotificationsSupported()) {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      }
      return true;
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        const p = await Notification.requestPermission();
        return p === 'granted';
      }
      return Notification.permission === 'granted';
    }
  } catch (e) {
    console.warn('[ClassNotifications] Permission request error:', e);
  }
  return false;
}

/**
 * Send an immediate test notification to verify the notification bar alerts
 */
export async function triggerTestClassNotification() {
  const granted = await requestNotificationPermission();
  await initNotificationChannel();

  const title = '🔔 Class Alert: Live Period Starting';
  const body = 'Room 101 • Your scheduled class is starting now. Tap to view timetable & attendance.';

  if (isLocalNotificationsSupported()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999999,
            title,
            body,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher_round',
            iconColor: '#4F46E5',
            schedule: { at: new Date(Date.now() + 500) }, // 0.5s from now
            sound: 'default',
            actionTypeId: '',
            extra: { test: true }
          }
        ]
      });
      toast.success('Test class notification sent to Android notification bar!');
      return true;
    } catch (err) {
      console.error('[ClassNotifications] Native notification trigger failed:', err);
      toast.error('Failed to trigger native notification: ' + err.message);
      return false;
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icons/icon-192x192.png' });
    toast.success('Test notification displayed on notification bar!');
    return true;
  } else {
    toast.info('Notifications enabled. Install native APK to receive system bar alerts.');
    return false;
  }
}

/**
 * Generate a deterministic 32-bit positive integer ID from classroom ID and day code
 */
function makeNotificationId(classroomId, dayCode, isPreAlert = false) {
  let hash = 0;
  const str = `${classroomId}_${dayCode}_${isPreAlert ? 'pre' : 'on'}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Schedule class alarms and notification bar popups for all upcoming periods
 */
export async function scheduleClassTimetableNotifications() {
  try {
    if (!isLocalNotificationsSupported()) return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    await initNotificationChannel();

    const user = getCurrentUser();
    if (!user) return;

    const [classrooms] = await Promise.all([
      db.getClassrooms()
    ]);

    const isTeacher = user.role === 'teacher';
    const isStudent = user.role === 'student';

    // Find classrooms relevant to this user
    let userClasses = [];
    if (isTeacher) {
      userClasses = classrooms.filter(c => {
        if (!c.teacher_id) return false;
        if (c.teacher_id === user.id) return true;
        if (user.email && c.teacher_id.toLowerCase() === user.email.toLowerCase()) return true;
        if (user.full_name && c.teacher_id.toLowerCase() === user.full_name.toLowerCase()) return true;
        return false;
      });
    } else if (isStudent) {
      userClasses = classrooms.filter(c => {
        if (Array.isArray(c.student_ids) && c.student_ids.includes(user.id)) return true;
        if (user.classroom_id && c.id === user.classroom_id) return true;
        if (user.program_id && c.program_id === user.program_id) return true;
        return false;
      });
    } else {
      // Admin / Staff / Warden: schedule all operational classes
      userClasses = classrooms;
    }

    if (!userClasses || userClasses.length === 0) return;

    // Clear previous class notifications to prevent duplicates
    try {
      const pending = await LocalNotifications.getPending();
      if (pending && Array.isArray(pending.notifications) && pending.notifications.length > 0) {
        const classNotifIds = pending.notifications
          .filter(n => n.extra?.type === 'class_timetable_alert')
          .map(n => ({ id: n.id }));
        if (classNotifIds.length > 0) {
          await LocalNotifications.cancel({ notifications: classNotifIds });
        }
      }
    } catch (e) {
      console.warn('[ClassNotifications] Cancel pending error:', e);
    }

    const notificationsToSchedule = [];
    const now = new Date();

    // Schedule for the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      const dayIndex = targetDate.getDay();
      const dayCode = DAY_CODES[dayIndex];

      for (const cls of userClasses) {
        if (!cls.days || !cls.days.includes(dayCode)) continue;
        if (!cls.start_time) continue;

        const [startH, startM] = cls.start_time.split(':').map(Number);
        const classExactStart = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          startH || 0,
          startM || 0,
          0
        );

        // 1. Five-minute reminder alert before class starts
        const preAlertTime = new Date(classExactStart.getTime() - 5 * 60 * 1000);
        if (preAlertTime > now) {
          notificationsToSchedule.push({
            id: makeNotificationId(cls.id, `${dayCode}_${dayOffset}`, true),
            title: `⏰ Class in 5 Mins: ${cls.name}`,
            body: `Room ${cls.room_number || 'N/A'} • Starts at ${cls.start_time}. Tap to open.`,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher_round',
            iconColor: '#4F46E5',
            schedule: { at: preAlertTime, allowWhileIdle: true },
            sound: 'default',
            extra: { type: 'class_timetable_alert', classroomId: cls.id, isPre: true }
          });
        }

        // 2. Exact start time alert
        if (classExactStart > now) {
          notificationsToSchedule.push({
            id: makeNotificationId(cls.id, `${dayCode}_${dayOffset}`, false),
            title: `🔔 Class Starting: ${cls.name}`,
            body: `Room ${cls.room_number || 'N/A'} • ${cls.start_time} - ${cls.end_time}. Tap to record attendance.`,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher_round',
            iconColor: '#4F46E5',
            schedule: { at: classExactStart, allowWhileIdle: true },
            sound: 'default',
            extra: { type: 'class_timetable_alert', classroomId: cls.id, isPre: false }
          });
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      // Limit to 64 maximum pending notifications to comply with Android system limits
      const batch = notificationsToSchedule.slice(0, 64);
      await LocalNotifications.schedule({
        notifications: batch
      });
      console.log(`[ClassNotifications] Successfully scheduled ${batch.length} class timetable alerts.`);
    }
  } catch (err) {
    console.warn('[ClassNotifications] Schedule class timetable notifications failed:', err);
  }
}
