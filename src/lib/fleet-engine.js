/**
 * TPS Hostel ERP - Fleet Management & Usage Billing Mathematical Engine
 *
 * Implements:
 * 1. Bill-to-Bill Fuel Efficiency Formula (Per Fuel Fill)
 * 2. Rolling 3-Month (90-Day) Cost-Per-KM Billing Formula
 * 3. Document Expiry Warning Engine (<30d Amber, Expired Red)
 * 4. Trip Billing Formula (100% Billable Usage, Admin Parity)
 */

/**
 * Formula A: Bill-to-Bill Fuel Efficiency Engine (Per Fuel Fill)
 * When a fuel expense is added, looks up the immediately preceding fuel log for that vehicle:
 * Distance = Current Odometer - Previous Odometer
 * Mileage (km/L) = Distance / Fuel Liters
 */
export function calculateBillToBillMileage(vehicleId, currentOdometer, fuelLiters, existingExpenses = []) {
  const curOdo = Number(currentOdometer);
  const liters = Number(fuelLiters);
  if (!vehicleId || isNaN(curOdo) || isNaN(liters) || liters <= 0) {
    return null;
  }

  // Filter fuel expenses for this vehicle that have recorded odometer readings
  const fuelLogs = existingExpenses
    .filter(e => e.vehicle_id === vehicleId && (e.expense_type === 'Fuel' || e.type === 'Fuel') && e.odometer_at_expense !== undefined && e.odometer_at_expense !== null)
    .map(e => ({
      ...e,
      odo: Number(e.odometer_at_expense)
    }))
    .filter(e => !isNaN(e.odo))
    .sort((a, b) => a.odo - b.odo);

  // Find the immediately preceding fuel log whose odometer is less than currentOdometer
  const prevLog = [...fuelLogs].reverse().find(e => e.odo < curOdo);

  if (!prevLog) {
    return {
      mileage: null,
      distance: null,
      previousOdometer: null,
      isInitialBaseline: true,
      note: 'Initial baseline fuel fill'
    };
  }

  const distance = curOdo - prevLog.odo;
  if (distance <= 0) {
    return null;
  }

  const mileage = Math.round((distance / liters) * 100) / 100;
  return {
    mileage,
    distance,
    previousOdometer: prevLog.odo,
    isInitialBaseline: false,
    note: `${distance} km driven on ${liters} L`
  };
}

/**
 * Formula B: Rolling 3-Month (90-Day) Cost-Per-KM Billing Formula
 * Base Rate Per KM = Total Expenses in Last 90 Days / Total KM Driven in Last 90 Days
 * Final Rate Per KM = ROUND(Base Rate * (1 + Buffer Percentage / 100), 2)
 * Fallback: Defaults to predefined fallback_rate_per_km if no 90-day history exists.
 */
export function calculateDynamicRatePerKm(vehicle, allExpenses = [], allTrips = [], referenceDate = new Date()) {
  if (!vehicle) {
    return {
      rate: 15.00,
      baseRate: 15.00,
      isFallback: true,
      totalExpenses: 0,
      totalKm: 0,
      bufferPercentage: 0,
      reason: 'Standard vehicle fallback rate'
    };
  }

  // Pure fallback rate per kilometer — all 90-day rolling formulas removed per institutional policy
  const fallback = Number(vehicle.fallback_rate_per_km) > 0 ? Number(vehicle.fallback_rate_per_km) : 15.00;

  return {
    rate: fallback,
    baseRate: fallback,
    isFallback: true,
    totalExpenses: 0,
    totalKm: 0,
    bufferPercentage: 0,
    reason: `Rate per KM: ₹${fallback.toFixed(2)} (Standard rate)`
  };
}

/**
 * Document Expiry Status Engine:
 * Amber Warning for documents expiring in <= 30 days
 * Red Alert for expired documents
 * Green for valid documents
 */
export function getDocumentExpiryStatus(expiryDateStr, referenceDate = new Date()) {
  if (!expiryDateStr) {
    return {
      status: 'unknown',
      daysRemaining: null,
      label: 'Date Not Set',
      badgeClass: 'badge-secondary',
      color: '#64748B'
    };
  }

  const expDate = new Date(expiryDateStr);
  if (isNaN(expDate.getTime())) {
    return {
      status: 'unknown',
      daysRemaining: null,
      label: 'Invalid Date',
      badgeClass: 'badge-secondary',
      color: '#64748B'
    };
  }

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  // Compare purely by calendar days
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffTime = expDate.setHours(0, 0, 0, 0) - ref.setHours(0, 0, 0, 0);
  const daysRemaining = Math.round(diffTime / msPerDay);

  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return {
      status: 'expired',
      daysRemaining,
      label: daysAgo === 0 ? 'Expired Today' : `Expired ${daysAgo}d ago`,
      badgeClass: 'badge-danger',
      color: '#DC2626',
      isExpired: true,
      isWarning: false
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'warning',
      daysRemaining,
      label: daysRemaining === 0 ? 'Expires Today' : `Expires in ${daysRemaining}d`,
      badgeClass: 'badge-warning',
      color: '#D97706',
      isExpired: false,
      isWarning: true
    };
  }

  return {
    status: 'healthy',
    daysRemaining,
    label: `Valid (${daysRemaining}d remaining)`,
    badgeClass: 'badge-success',
    color: '#059669',
    isExpired: false,
    isWarning: false
  };
}

/**
 * 100% Billable Usage Trip Bill Calculator:
 * Round(Total KM * Applied Rate Per KM, 2)
 * Supports both signatures:
 *   - calculateTripBill(startKm, endKm, ratePerKm)
 *   - calculateTripBill(totalKm, ratePerKm)
 */
export function calculateTripBill(arg1, arg2, arg3) {
  let distance = 0;
  let rate = 0;

  if (arg3 !== undefined) {
    // Called with (startKm, endKm, ratePerKm)
    const start = Number(arg1) || 0;
    const end = Number(arg2) || 0;
    rate = Number(arg3) || 0;
    distance = Math.max(0, Math.round((end - start) * 100) / 100);
  } else {
    // Called with (totalKm, ratePerKm)
    distance = Math.max(0, Math.round(Number(arg1 || 0) * 100) / 100);
    rate = Number(arg2) || 0;
  }

  const amount = Math.round(distance * rate * 100) / 100;
  return {
    totalKm: distance,
    appliedRate: rate,
    totalAmount: amount,
    valueOf: () => amount,
    toString: () => String(amount),
    [Symbol.toPrimitive]: (hint) => (hint === 'string' ? String(amount) : amount)
  };
}
