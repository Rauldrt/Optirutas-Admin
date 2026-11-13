import { calculateDistanceKm } from '../utils/geo';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  type?: string;
  modifier?: string;
}

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] for Leaflet
  distanceKm: number;
  durationMinutes: number;
  steps: RouteStep[];
  isOfflineFallback?: boolean;
}

// In-memory cache to prevent excessive requests for the same coordinates
const routeCache = new Map<string, RouteResult>();
const STORAGE_PREFIX = 'optirutas_route_v1_';

/**
 * Retrieve cached route from memory or persistent localStorage
 */
function getCachedRoute(cacheKey: string): RouteResult | null {
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + cacheKey);
    if (raw) {
      const parsed: RouteResult = JSON.parse(raw);
      routeCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read route from localStorage:', err);
  }
  return null;
}

/**
 * Save route into both in-memory cache and persistent localStorage
 */
function setCachedRoute(cacheKey: string, result: RouteResult): void {
  routeCache.set(cacheKey, result);
  try {
    localStorage.setItem(STORAGE_PREFIX + cacheKey, JSON.stringify(result));
  } catch (err) {
    // If quota exceeded, clean oldest routes
    console.warn('Could not persist route to localStorage:', err);
  }
}

/**
 * Helper to calculate rough cardinal direction for offline straight-line guidance
 */
function getCardinalDirection(from: [number, number], to: [number, number]): string {
  const dLat = to[0] - from[0];
  const dLon = to[1] - from[1];
  const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  const norm = (angle + 360) % 360;

  if (norm >= 337.5 || norm < 22.5) return 'Norte';
  if (norm >= 22.5 && norm < 67.5) return 'Noreste';
  if (norm >= 67.5 && norm < 112.5) return 'Este';
  if (norm >= 112.5 && norm < 157.5) return 'Sureste';
  if (norm >= 157.5 && norm < 202.5) return 'Sur';
  if (norm >= 202.5 && norm < 247.5) return 'Suroeste';
  if (norm >= 247.5 && norm < 292.5) return 'Oeste';
  return 'Noroeste';
}

/**
 * Helper to build human-readable instruction in Spanish from OSRM maneuver
 */
function buildInstructionEs(maneuver: { type?: string; modifier?: string }, streetName: string): string {
  const street = streetName ? ` por ${streetName}` : '';
  const modifier = maneuver.modifier || '';
  const type = maneuver.type || '';

  if (type === 'depart') return `Inicia la marcha${street}`;
  if (type === 'arrive') return 'Llegaste a tu destino';
  if (type === 'roundabout') return `En la rotonda, toma la salida${street}`;
  
  if (modifier === 'straight') return `Continúa recto${street}`;
  if (modifier === 'slight right') return `Gira levemente a la derecha${street}`;
  if (modifier === 'right') return `Gira a la derecha${street}`;
  if (modifier === 'sharp right') return `Gira pronunciadamente a la derecha${street}`;
  if (modifier === 'slight left') return `Gira levemente a la izquierda${street}`;
  if (modifier === 'left') return `Gira a la izquierda${street}`;
  if (modifier === 'sharp left') return `Gira pronunciadamente a la izquierda${street}`;
  if (modifier === 'uturn') return 'Realiza un cambio de sentido (vuelta en U)';

  return streetName ? `Continúa por ${streetName}` : 'Continúa por la ruta';
}

/**
 * Fetches street-level routing between two coordinates using OSRM with full offline caching.
 * If offline and un-cached, calculates direct compass line with accurate Haversine distance.
 */
export async function getStreetRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteResult | null> {
  const cacheKey = `${from[0].toFixed(5)},${from[1].toFixed(5)}->${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  
  // 1. Check local persistent cache
  const cached = getCachedRoute(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. If offline, build direct compass bearing fallback immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const directDistKm = calculateDistanceKm(from[0], from[1], to[0], to[1]);
    const directMeters = Math.round(directDistKm * 1000);
    const durationEstMinutes = Math.max(1, Math.ceil((directDistKm / 35) * 60)); // ~35 km/h urban average
    const direction = getCardinalDirection(from, to);

    return {
      coordinates: [from, to],
      distanceKm: directDistKm,
      durationMinutes: durationEstMinutes,
      steps: [
        {
          instruction: `Rumbo ${direction} (${directMeters} m) [Modo Offline - Rumbo Directo]`,
          distanceMeters: directMeters,
          durationSeconds: durationEstMinutes * 60,
          name: ''
        }
      ],
      isOfflineFallback: true
    };
  }

  // 3. Online: Fetch from OSRM
  const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6500) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const primaryRoute = data.routes[0];
    const leafletCoords: [number, number][] = primaryRoute.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon]
    );

    const steps: RouteStep[] = [];
    if (primaryRoute.legs) {
      for (const leg of primaryRoute.legs) {
        if (leg.steps) {
          for (const s of leg.steps) {
            steps.push({
              instruction: buildInstructionEs(s.maneuver, s.name),
              distanceMeters: s.distance || 0,
              durationSeconds: s.duration || 0,
              name: s.name || '',
              type: s.maneuver?.type,
              modifier: s.maneuver?.modifier
            });
          }
        }
      }
    }

    const result: RouteResult = {
      coordinates: leafletCoords,
      distanceKm: (primaryRoute.distance || 0) / 1000,
      durationMinutes: Math.ceil((primaryRoute.duration || 0) / 60),
      steps,
      isOfflineFallback: false
    };

    setCachedRoute(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Could not fetch OSRM route, falling back to direct line:', error);
    const directDistKm = calculateDistanceKm(from[0], from[1], to[0], to[1]);
    const directMeters = Math.round(directDistKm * 1000);
    const durationEstMinutes = Math.max(1, Math.ceil((directDistKm / 35) * 60));
    const direction = getCardinalDirection(from, to);

    return {
      coordinates: [from, to],
      distanceKm: directDistKm,
      durationMinutes: durationEstMinutes,
      steps: [
        {
          instruction: `Rumbo directo al ${direction} (${directMeters} m)`,
          distanceMeters: directMeters,
          durationSeconds: durationEstMinutes * 60,
          name: ''
        }
      ],
      isOfflineFallback: true
    };
  }
}

/**
 * Pre-cache all sequential legs of a day's stops so the driver can navigate without signal.
 */
export async function precacheDayRoutes(
  stops: { latitude: number; longitude: number; name: string }[]
): Promise<{ cached: number; total: number }> {
  const validStops = stops.filter(s => s.latitude !== 0 && s.longitude !== 0);
  if (validStops.length < 2) {
    return { cached: 0, total: 0 };
  }

  let cachedCount = 0;
  const totalLegs = validStops.length - 1;

  for (let i = 0; i < totalLegs; i++) {
    const origin: [number, number] = [validStops[i].latitude, validStops[i].longitude];
    const destination: [number, number] = [validStops[i + 1].latitude, validStops[i + 1].longitude];

    try {
      const res = await getStreetRoute(origin, destination);
      if (res && !res.isOfflineFallback) {
        cachedCount++;
      }
    } catch (err) {
      console.warn(`Could not precache leg ${i + 1}:`, err);
    }

    // Small delay to prevent rate-limiting on public OSRM server
    await new Promise(r => setTimeout(r, 200));
  }

  return { cached: cachedCount, total: totalLegs };
}

/**
 * Fetches full multi-point route geometry connecting multiple stops sequentially
 */
export async function getMultiStopRoute(
  stopsCoords: [number, number][]
): Promise<[number, number][] | null> {
  if (stopsCoords.length < 2) return null;
  const limitedCoords = stopsCoords.slice(0, 30);
  const param = limitedCoords.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${param}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;

    return data.routes[0].geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
    );
  } catch {
    return null;
  }
}
