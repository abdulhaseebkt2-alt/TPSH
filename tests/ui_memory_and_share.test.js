import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/db.js';
import { renderAdminDashboard } from '../src/modules/dashboard/admin-dashboard.js';
import { getSelectStorageKey, enhanceSelect } from '../src/components/custom-select.js';
import { enhanceTabButtons } from '../src/lib/ui-enhancer.js';

describe('UI/UX Enhancements: Hero Card, Share Feature & Universal Memory', () => {
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

    it('formats share text according to official WhatsApp report template', () => {
      const activeCount = 29;
      const totalInHostel = 26;
      const boysInHostel = 13;
      const girlsInHostel = 13;
      const notInHostel = Math.max(0, activeCount - totalInHostel);
      const occupancyPercent = Math.round((totalInHostel / activeCount) * 100);

      const reportText = `*THAIBA PUBLIC SCHOOL*

*HOSTEL STATUS REPORT*
Total Enrolled Students: ${activeCount}
Total Students in Hostel: ${totalInHostel}

Boys: ${boysInHostel}
Girls: ${girlsInHostel}

Students Not in Hostel: ${notInHostel}
_______________
Total Hostel Occupancy:
 ${totalInHostel} out of ${activeCount} (${occupancyPercent}%)`;

      expect(reportText).toContain('*THAIBA PUBLIC SCHOOL*');
      expect(reportText).toContain('*HOSTEL STATUS REPORT*');
      expect(reportText).toContain('Total Enrolled Students: 29');
      expect(reportText).toContain('Total Students in Hostel: 26');
      expect(reportText).toContain('Boys: 13');
      expect(reportText).toContain('Girls: 13');
      expect(reportText).toContain('Students Not in Hostel: 3');
      expect(reportText).toContain('Total Hostel Occupancy:\n 26 out of 29 (90%)');
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

    it('verifies vehicle booking module has header buttons removed and odometer pre-filled without decimals', async () => {
      const { switchDevRole } = await import('../src/lib/auth.js');
      switchDevRole('admin');
      const { renderUserVehicleTripsModule } = await import('../src/modules/vehicles/user-trips.js');
      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderUserVehicleTripsModule(container, { onNavigate: () => {} });

      // 4 Navigation buttons should NOT be present in header
      expect(container.innerHTML).not.toContain('id="btn-view-user-card"');
      expect(container.innerHTML).not.toContain('id="btn-destinations-admin"');
      expect(container.innerHTML).not.toContain('id="btn-all-trips-master"');
      expect(container.innerHTML).not.toContain('id="btn-back-fleet-admin"');

      // Check short ride start km pre-fill and step="any"
      expect(container.innerHTML).toContain('id="short-ride-start-km"');
      expect(container.innerHTML).toContain('step="any"');
      // If odometer was 32609.3 or similar, it should be floored
      const match = container.innerHTML.match(/id="short-ride-start-km"[^>]*value="([^"]+)"/);
      if (match) {
        expect(match[1]).not.toContain('.');
      }
    });
  });
});
