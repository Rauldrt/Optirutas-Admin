import type { Stop, Vehicle } from '../services/firestore';
import { calculateRouteDistanceKm } from './geo';

export interface CostSettings {
  fuelPricePerLiter: number;        // ARS por litro (ej: 1250)
  defaultConsumptionL100km: number; // Litros cada 100 km (ej: 11.0)
  laborHourlyRate: number;          // ARS por hora chofer/ayudante (ej: 5000)
  currencySymbol: string;           // Prefijo monetario (ej: '$')
}

export const DEFAULT_COST_SETTINGS: CostSettings = {
  fuelPricePerLiter: 1250,
  defaultConsumptionL100km: 11.0,
  laborHourlyRate: 5000,
  currencySymbol: '$',
};

const STORAGE_KEY = 'optirutas_cost_settings_v1';

export const getStoredCostSettings = (): CostSettings => {
  if (typeof window === 'undefined') return DEFAULT_COST_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COST_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      fuelPricePerLiter: Number(parsed.fuelPricePerLiter) || DEFAULT_COST_SETTINGS.fuelPricePerLiter,
      defaultConsumptionL100km: Number(parsed.defaultConsumptionL100km) || DEFAULT_COST_SETTINGS.defaultConsumptionL100km,
      laborHourlyRate: Number(parsed.laborHourlyRate) || DEFAULT_COST_SETTINGS.laborHourlyRate,
      currencySymbol: parsed.currencySymbol || DEFAULT_COST_SETTINGS.currencySymbol,
    };
  } catch {
    return DEFAULT_COST_SETTINGS;
  }
};

export const saveStoredCostSettings = (settings: CostSettings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving cost settings:', e);
  }
};

export interface TripCostMetrics {
  totalStops: number;
  completedStops: number;
  completionRate: number;
  totalDistanceKm: number;
  startTime: number | null;
  endTime: number | null;
  totalDurationMinutes: number;
  dwellTimeTotalMinutes: number;
  transitTimeTotalMinutes: number;
  avgDwellMinutesPerStop: number;
  stopsPerHour: number;
  consumptionL100km: number;
  estimatedFuelLiters: number;
  estimatedFuelCost: number;
  estimatedLaborCost: number;
  totalCost: number;
  costPerStop: number;
  fuelCostPerStop: number;
  laborCostPerStop: number;
}

/**
 * Calculates complete operational logistics metrics and expenses (Fuel + Labor + Cost per Stop)
 */
export const calculateTripCostMetrics = (
  stops: Stop[],
  settings: CostSettings = getStoredCostSettings(),
  vehicle?: Vehicle | null
): TripCostMetrics => {
  const totalStops = stops.length;
  const completedStopsList = stops.filter(s => s.completed);
  const completedStops = completedStopsList.length;
  const completionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  // Total distance calculation
  const totalDistanceKm = calculateRouteDistanceKm(stops);

  // Time metrics from timestamps
  const timestamps = completedStopsList
    .map(s => s.completedAt || s.arrivedAt)
    .filter((t): t is number => typeof t === 'number' && t > 0)
    .sort((a, b) => a - b);

  let startTime: number | null = null;
  let endTime: number | null = null;
  let totalDurationMinutes = 0;

  if (timestamps.length >= 2) {
    startTime = timestamps[0];
    endTime = timestamps[timestamps.length - 1];
    totalDurationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  } else if (timestamps.length === 1) {
    startTime = timestamps[0];
    endTime = timestamps[0];
    totalDurationMinutes = 15; // default fallback if only 1 stop
  }

  // Dwell times (time spent at customers)
  let dwellTimeTotalMinutes = 0;
  let stopsWithDwellCount = 0;

  completedStopsList.forEach(s => {
    if (s.dwellTimeMinutes !== undefined && s.dwellTimeMinutes > 0) {
      dwellTimeTotalMinutes += s.dwellTimeMinutes;
      stopsWithDwellCount++;
    } else if (s.completedAt && s.arrivedAt && s.completedAt > s.arrivedAt) {
      const diffM = Math.max(1, Math.round((s.completedAt - s.arrivedAt) / 60000));
      dwellTimeTotalMinutes += diffM;
      stopsWithDwellCount++;
    }
  });

  const avgDwellMinutesPerStop = stopsWithDwellCount > 0 
    ? Math.round(dwellTimeTotalMinutes / stopsWithDwellCount) 
    : 0;

  // Transit time (driving on the road)
  const transitTimeTotalMinutes = Math.max(0, totalDurationMinutes - dwellTimeTotalMinutes);

  // Rhythm (stops per hour)
  const stopsPerHour = totalDurationMinutes > 0 
    ? Number(((completedStops / totalDurationMinutes) * 60).toFixed(1))
    : 0;

  // Vehicle consumption rate
  const consumptionL100km = vehicle?.fuelConsumptionL100km || settings.defaultConsumptionL100km;

  // Fuel calculation
  const estimatedFuelLiters = Number(((totalDistanceKm * consumptionL100km) / 100).toFixed(2));
  const estimatedFuelCost = Math.round(estimatedFuelLiters * settings.fuelPricePerLiter);

  // Labor calculation (Horas Hombre)
  const estimatedLaborCost = Math.round((totalDurationMinutes / 60) * settings.laborHourlyRate);

  // Total cost and unit economics
  const totalCost = estimatedFuelCost + estimatedLaborCost;
  const costPerStop = completedStops > 0 ? Math.round(totalCost / completedStops) : 0;
  const fuelCostPerStop = completedStops > 0 ? Math.round(estimatedFuelCost / completedStops) : 0;
  const laborCostPerStop = completedStops > 0 ? Math.round(estimatedLaborCost / completedStops) : 0;

  return {
    totalStops,
    completedStops,
    completionRate,
    totalDistanceKm,
    startTime,
    endTime,
    totalDurationMinutes,
    dwellTimeTotalMinutes,
    transitTimeTotalMinutes,
    avgDwellMinutesPerStop,
    stopsPerHour,
    consumptionL100km,
    estimatedFuelLiters,
    estimatedFuelCost,
    estimatedLaborCost,
    totalCost,
    costPerStop,
    fuelCostPerStop,
    laborCostPerStop,
  };
};

/**
 * Format currency with Argentine/Latin American formatting (e.g. $ 14.500)
 */
export const formatCurrency = (amount: number, symbol = '$'): string => {
  return `${symbol} ${Math.round(amount).toLocaleString('es-AR')}`;
};

/**
 * Format minutes into readable hours and minutes (e.g. "1h 45m" or "35 min")
 */
export const formatDurationHours = (minutes: number): string => {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};
