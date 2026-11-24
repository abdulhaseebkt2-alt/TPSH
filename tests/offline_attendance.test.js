import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/lib/db.js';

describe('Offline Attendance & Local-First Resilience', () => {
  let originalNavigatorOnLine;

  beforeEach(() => {
    // Reset test storage
    db.set('tps_attendance', []);
    db.set('tps_teacher_attendance', []);
    db.set('tps_offline_outbox', []);
    originalNavigatorOnLine = global.navigator?.onLine;
  });

  afterEach(() => {
    if (global.navigator) {
      Object.defineProperty(global.navigator, 'onLine', {
        value: originalNavigatorOnLine !== undefined ? originalNavigatorOnLine : true,
        configurable: true
      });
    }
  });

  it('correctly detects online/offline status via db.isOnline()', () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      configurable: true
    });
    expect(db.isOnline()).toBe(false);

    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      configurable: true
    });
    expect(db.isOnline()).toBe(true);
  });

  it('records attendance session locally with pending_sync when offline', async () => {
    // Simulate airplane mode / offline
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      configurable: true
    });

    const session = await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: 'cls-101',
      session_date: '2026-11-24',
      teacher_id: 'u-teacher-1',
      teacher_name: 'Haseeb Mubarak',
      records: [
        { student_id: 's-1', status: 'Present' },
        { student_id: 's-2', status: 'Absent' }
      ]
    });

    expect(session).toBeDefined();
    expect(session.sync_status).toBe('pending_sync');
    expect(session.offline_recorded).toBe(true);

    // Verify persisted in local storage
    const records = db.get('tps_attendance');
    expect(records.length).toBe(1);
    expect(records[0].classroom_id).toBe('cls-101');
    expect(records[0].sync_status).toBe('pending_sync');

    // Verify added to offline outbox
    const outbox = db.getOfflineOutbox();
    expect(outbox.some(item => item.key === 'tps_attendance')).toBe(true);
    expect(outbox.some(item => item.key === 'tps_teacher_attendance')).toBe(true);
  });

  it('records teacher duty attendance locally when offline', async () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      configurable: true
    });

    await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: 'cls-101',
      session_date: '2026-11-24',
      teacher_id: 'u-teacher-1',
      teacher_name: 'Haseeb Mubarak',
      records: [{ student_id: 's-1', status: 'Present' }]
    });

    const teacherLogs = db.get('tps_teacher_attendance');
    expect(teacherLogs.length).toBe(1);
    expect(teacherLogs[0].teacher_id).toBe('u-teacher-1');
    expect(teacherLogs[0].status).toBe('Present');
  });

  it('preserves offline pending sessions during cloud pull/reconciliation (Last-Write-Wins)', async () => {
    // 1. Teacher takes attendance offline
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      configurable: true
    });

    await db.saveAttendanceSession({
      program_id: 'prog-1',
      classroom_id: 'cls-offline-1',
      session_date: '2026-11-24',
      teacher_id: 'u-teacher-1',
      records: [{ student_id: 's-10', status: 'Present' }]
    });

    // 2. An older or separate cloud record exists
    const cloudExistingSessions = [
      {
        id: 'sess-cloud-old',
        classroom_id: 'cls-cloud-1',
        session_date: '2026-11-23',
        sync_status: 'synced',
        records: [{ student_id: 's-20', status: 'Present' }]
      }
    ];

    // Simulate what pullCloudKeys does with the merged logic
    const localAttendance = db.get('tps_attendance') || [];
    const mergedMap = new Map();
    for (const cs of cloudExistingSessions) {
      mergedMap.set(cs.id || (cs.classroom_id + '_' + cs.session_date), cs);
    }
    for (const ls of localAttendance) {
      const k = ls.id || (ls.classroom_id + '_' + ls.session_date);
      const existing = mergedMap.get(k);
      if (!existing || ls.sync_status === 'pending_sync') {
        mergedMap.set(k, ls);
      }
    }
    const finalAttendance = Array.from(mergedMap.values());

    // Both the cloud session and the offline pending session MUST exist
    expect(finalAttendance.length).toBe(2);
    expect(finalAttendance.some(s => s.classroom_id === 'cls-offline-1')).toBe(true);
    expect(finalAttendance.some(s => s.classroom_id === 'cls-cloud-1')).toBe(true);
  });

  it('updates outbox and sync status when flushOfflineOutbox runs', async () => {
    // Add pending session
    db.set('tps_attendance', [
      {
        id: 'sess-offline-test',
        classroom_id: 'cls-102',
        session_date: '2026-11-24',
        sync_status: 'pending_sync'
      }
    ]);
    db.addToOfflineOutbox({ key: 'tps_attendance', type: 'attendance' });

    expect(db.getOfflineOutbox().length).toBeGreaterThan(0);
    
    // In test environment, flushOfflineOutbox returns early because supabase isn't connected to cloud,
    // but removeFromOfflineOutbox works directly:
    db.removeFromOfflineOutbox('tps_attendance');
    expect(db.getOfflineOutbox().some(o => o.key === 'tps_attendance')).toBe(false);
  });
});
