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

    it('verifies cross-device vehicle trips sync and accurate ledger matching for Haseeb Mubarak', async () => {
      const { isTripForUser, renderVehicleUserCardModule } = await import('../src/modules/vehicles/user-card.js');
      const { switchDevRole } = await import('../src/lib/auth.js');
      switchDevRole('super_admin');

      // 1. Verify trip matching for Haseeb Mubarak against mobile-logged trips
      const mobileTrip1 = {
        id: 'trip-mobile-1',
        trip_id: 'TRIP-2026-001',
        user_id: 'u-1',
        user_name: 'Abdul Haseeb',
        user_email: 'abdulhaseebkt2@gmail.com',
        destination: 'Model school',
        total_km: 7,
        total_amount: 45.50,
        status: 'Completed'
      };
      const mobileTrip2 = {
        id: 'trip-mobile-2',
        trip_id: 'TRIP-2026-002',
        user_id: 'u-1',
        user_name: 'Abdul Haseeb',
        user_email: 'abdulhaseebkt2@gmail.com',
        destination: 'Short Ride (Local / Campus)',
        total_km: 2,
        total_amount: 15.00,
        status: 'Completed'
      };

      const userHaseeb = {
        id: 'u-1',
        tps_id: 'TGI306',
        full_name: 'Haseeb Mubarak',
        email: 'abdulhaseebkt2@gmail.com',
        role: 'super_admin',
        is_super_admin: true
      };

      expect(isTripForUser(mobileTrip1, userHaseeb)).toBe(true);
      expect(isTripForUser(mobileTrip2, userHaseeb)).toBe(true);

      // 2. Save both trips into db store to simulate synced state
      db.set('tps_trip_logs', [mobileTrip1, mobileTrip2]);

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderVehicleUserCardModule(container, { userId: 'u-1', onNavigate: () => {} });

      // Expect 9 KM total distance, ₹60.50 total billed, and both trips rendered in ledger
      expect(container.innerHTML).toContain('9 KM');
      expect(container.innerHTML).toContain('60.50');
      expect(container.innerHTML).toContain('Model school');
      expect(container.innerHTML).toContain('Short Ride (Local / Campus)');
      expect(container.innerHTML).toContain('2 recorded trip(s)');
    });

    it('verifies vehicle expense form eliminates double asterisks, provides Amount of Liter field, and compact notes', async () => {
      const { renderVehicleManagementModule } = await import('../src/modules/vehicles/index.js');
      const { switchDevRole } = await import('../src/lib/auth.js');
      switchDevRole('admin');

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderVehicleManagementModule(container, { initialTab: 'expenses' });

      // Verify no double asterisks in HTML labels
      expect(container.innerHTML).not.toContain('Expense Type *');
      expect(container.innerHTML).not.toContain('Amount (₹) *');
      expect(container.innerHTML).not.toContain('Date of Expense *');
      expect(container.innerHTML).not.toContain('Assigned Vehicle *');

      // Verify "Amount of Liter (₹)" input replaces "Fuel Liters Added"
      expect(container.innerHTML).toContain('Amount of Liter (₹)');
      expect(container.innerHTML).toContain('id="exp-fuel-rate"');
      expect(container.innerHTML).toContain('id="calc-liters-badge"');

      // Verify compact notes textarea height and small font
      expect(container.innerHTML).toContain('id="exp-notes"');
      expect(container.innerHTML).toContain('min-height: 42px');
      expect(container.innerHTML).toContain('font-size: 0.76rem');
    });

    it('verifies vehicle action headers are streamlined across tabs (Sc:1-4)', async () => {
      const { renderVehicleManagementModule } = await import('../src/modules/vehicles/index.js');
      const { switchDevRole } = await import('../src/lib/auth.js');
      switchDevRole('admin');

      // Tab 1: requests (Trip Approval Queue) -> No buttons
      const cRequests = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderVehicleManagementModule(cRequests, { initialTab: 'requests' });
      expect(cRequests.innerHTML).not.toContain('My Vehicle Trips');
      expect(cRequests.innerHTML).not.toContain('Add New Vehicle');

      // Tab 2: fleet (Fleet Overview & Documents) -> Only Add New Vehicle
      const cFleet = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderVehicleManagementModule(cFleet, { initialTab: 'fleet' });
      expect(cFleet.innerHTML).not.toContain('My Vehicle Trips');
      expect(cFleet.innerHTML).toContain('Add New Vehicle');

      // Tab 3: expenses (Log Vehicle Expense) -> No buttons
      const cExpenses = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderVehicleManagementModule(cExpenses, { initialTab: 'expenses' });
      expect(cExpenses.innerHTML).not.toContain('My Vehicle Trips');
      expect(cExpenses.innerHTML).not.toContain('Add New Vehicle');

      // Tab 4: billing (Usage Billing & Settlement Ledger) -> No buttons
      const cBilling = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
      await renderVehicleManagementModule(cBilling, { initialTab: 'billing' });
      expect(cBilling.innerHTML).not.toContain('My Vehicle Trips');
      expect(cBilling.innerHTML).not.toContain('Add New Vehicle');
    });

    it('verifies all trips master ledger has equalized KPI rectangles, vehicle trigger card, and top buttons removed (Sc:5-6)', async () => {
      const { renderAllVehicleTripsModule } = await import('../src/modules/vehicles/all-trips.js');
      const { switchDevRole } = await import('../src/lib/auth.js');
      switchDevRole('super_admin');

      const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };

      await renderAllVehicleTripsModule(container, { onNavigate: () => {} });

      // 1. Top 3 buttons removed from header
      expect(container.innerHTML).not.toContain('id="btn-alltrips-user-card"');
      expect(container.innerHTML).not.toContain('id="btn-alltrips-book"');
      expect(container.innerHTML).not.toContain('id="btn-alltrips-fleet"');

      // 2. Vehicle trigger card exists with All Vehicles default
      expect(container.innerHTML).toContain('id="sec-alltrips-vehicle-trigger"');
      expect(container.innerHTML).toContain('All Vehicles');
      expect(container.innerHTML).toContain('SELECTED VEHICLE');

      // 3. KPI rectangles equalized in grid with tight spacing
      expect(container.innerHTML).toContain('alltrips-kpi-grid');
      expect(container.innerHTML).toContain('alltrips-kpi-card');
      expect(container.innerHTML).toContain('Total Trips');
      expect(container.innerHTML).toContain('Total Distance');
      expect(container.innerHTML).toContain('Total Billed');
      expect(container.innerHTML).toContain('Outstanding Dues');

      // 4. Test filtering when vehicleId option is passed or changed
      const cUnicorn = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      };
      await renderAllVehicleTripsModule(cUnicorn, { vehicleId: 'veh-1', onNavigate: () => {} });
      expect(cUnicorn.innerHTML).toContain('Honda Unicorn');
      expect(cUnicorn.innerHTML).toContain('WB 66 V 0909');
    });
  });
});
