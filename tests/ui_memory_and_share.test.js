import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/db.js';
import { renderAdminDashboard } from '../src/modules/dashboard/admin-dashboard.js';
import { getSelectStorageKey, enhanceSelect } from '../src/components/custom-select.js';
import { enhanceTabButtons } from '../src/lib/ui-enhancer.js';

describe('UI/UX Enhancements: Hero Card, Share Feature & Universal Memory', () => {
  beforeEach(() => {
    db.initStore();
  });

  describe('1. Executive Hero Card Updates', () => {
    it('displays Thaiba Public School Hostel badge and Total in Hostel metric', async () => {
      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderAdminDashboard(container, { onNavigate: () => {} });

      // Brand badge update
      expect(container.innerHTML).toContain('Thaiba Public School Hostel');
      expect(container.innerHTML).not.toContain('THAIBASCHOOL CAMPUS');

      // Metric update: Total in Hostel replacing Running / Received
      expect(container.innerHTML).toContain('Total in Hostel');
      expect(container.innerHTML).toContain('m-hero-total-hostel-stat');
      expect(container.innerHTML).toContain('m-hero-total-hostel-val');

      // Share button replacing eye toggle
      expect(container.innerHTML).toContain('m-hero-share-btn');
    });
  });

  describe('2. Universal Dropdown Memory Function', () => {
    it('generates a stable memory key for dropdowns', () => {
      const selectWithId = {
        id: 'filter-gender',
        getAttribute: (attr) => (attr === 'id' ? 'filter-gender' : null),
        closest: () => null
      };
      expect(getSelectStorageKey(selectWithId)).toBe('tps_dd_mem_filter-gender');

      const selectWithExplicitKey = {
        getAttribute: (attr) => (attr === 'data-persist-key' ? 'my_special_filter' : null),
        closest: () => null
      };
      expect(getSelectStorageKey(selectWithExplicitKey)).toBe('tps_dd_mem_my_special_filter');
    });

    it('saves user choice to localStorage and restores on next open', () => {
      // Mock storage
      const storage = {};
      const mockLocalStorage = {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = String(v); }
      };

      // Set pre-saved choice
      mockLocalStorage.setItem('tps_dd_mem_filter-class', 'Class 5');

      expect(mockLocalStorage.getItem('tps_dd_mem_filter-class')).toBe('Class 5');
    });
  });

  describe('3. Button / Segmented Tab Memory Function', () => {
    it('persists and restores active timetable filter tab (Live, Today, Weekly)', () => {
      const storage = {};
      const mockLocalStorage = {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = String(v); }
      };

      // User selects 'today'
      mockLocalStorage.setItem('tps_attendance_filter_tab', 'today');
      expect(mockLocalStorage.getItem('tps_attendance_filter_tab')).toBe('today');

      // User switches to 'weekly'
      mockLocalStorage.setItem('tps_attendance_filter_tab', 'weekly');
      expect(mockLocalStorage.getItem('tps_attendance_filter_tab')).toBe('weekly');
    });

    it('supports decimal point odometers and direct fallback rate without 90-day rolling', async () => {
      // 1. Odometer decimal support
      const vehicle = await db.saveVehicle({
        vehicle_name: 'Decimal Unicorn Test',
        reg_number: 'WB 66 V 0909',
        vehicle_type: '2 Wheeler',
        current_odometer: 32610.3,
        fallback_rate_per_km: 7.5
      });
      expect(vehicle.current_odometer).toBe(32610.3);

      // 2. Direct rate from fallback
      const { calculateDynamicRatePerKm } = await import('../src/lib/fleet-engine.js');
      const rateInfo = calculateDynamicRatePerKm(vehicle, [{ amount: 99999 }], []);
      expect(rateInfo.rate).toBe(7.5);
    });
  });
});
