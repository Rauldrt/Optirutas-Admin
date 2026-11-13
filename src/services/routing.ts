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
}

// In-memory cache to prevent excessive requests for the same coordinates
const routeCache = new Map<string, RouteResult>();

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
 * Fetches street-level routing between two coordinates using OSRM.
 * Returns decoded Leaflet coordinates, distance, duration, and turn-by-turn steps.
 */
export async function getStreetRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteResult | null> {
  const cacheKey = `${from[0].toFixed(5)},${from[1].toFixed(5)}->${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  // OSRM expects: longitude,latitude
  const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const primaryRoute = data.routes[0];
    // Convert GeoJSON [lon, lat] into Leaflet [lat, lon]
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
      steps
    };

    routeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Could not fetch OSRM route, falling back to direct line:', error);
    // Graceful fallback to direct connection
    return {
      coordinates: [from, to],
      distanceKm: 0,
      durationMinutes: 0,
      steps: []
    };
  }
}

/**
 * Fetches full multi-point route geometry connecting multiple stops sequentially
 */
export async function getMultiStopRoute(
  stopsCoords: [number, number][]
): Promise<[number, number][] | null> {
  if (stopsCoords.length < 2) return null;
  // OSRM public server handles up to 25-30 coordinates reliably
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
