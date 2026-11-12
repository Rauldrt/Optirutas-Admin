import type { Stop } from '../services/firestore';

/**
 * Extract coordinates from a Google Maps URL (standard or query format)
 */
export const extractCoords = (url: string): { lat: number; lng: number } | null => {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  const queryMatch = url.match(/[?&](q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[2]), lng: parseFloat(queryMatch[3]) };
  }
  const placeMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (placeMatch) {
    return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
  }
  return null;
};

/**
 * Resolve a short Google Maps URL or extract coordinates directly
 */
export const resolveMapLinkCoords = async (
  linkToResolve: string
): Promise<{ lat: number; lng: number } | null> => {
  if (!linkToResolve) return null;

  const instantCoords = extractCoords(linkToResolve);
  if (instantCoords) return instantCoords;

  const res = await fetch('https://www.redirectcheck.org/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: linkToResolve })
  });
  const data = await res.json();
  const finalUrl = data?.final_result?.final_url || linkToResolve;
  return extractCoords(finalUrl);
};

/**
 * Calculate Haversine distance in kilometers between two coordinates
 */
export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate total route distance in km for an ordered list of stops
 */
export const calculateRouteDistanceKm = (stops: Stop[]): number => {
  const validStops = [...stops]
    .filter((s) => s.latitude !== 0 && s.longitude !== 0)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (validStops.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < validStops.length; i++) {
    total += calculateDistanceKm(
      validStops[i - 1].latitude,
      validStops[i - 1].longitude,
      validStops[i].latitude,
      validStops[i].longitude
    );
  }
  return total;
};

/**
 * Nearest-neighbor TSP heuristic to order stops minimizing travel distance.
 * Keeps the first stop in the current order as the starting point (or completed stops first),
 * and orders all remaining stops by shortest geographical distance.
 */
export const computeOptimizedStopOrder = (stops: Stop[]): Stop[] => {
  if (stops.length <= 2) return [...stops];

  const sorted = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const valid = sorted.filter((s) => s.latitude !== 0 && s.longitude !== 0);
  const invalid = sorted.filter((s) => s.latitude === 0 || s.longitude === 0);

  if (valid.length <= 2) return sorted;

  // Keep already completed stops in their current order at the beginning if any,
  // or start from the current first stop
  const completed = valid.filter((s) => s.completed);
  const pending = valid.filter((s) => !s.completed);

  if (pending.length <= 1) {
    return [...completed, ...pending, ...invalid];
  }

  const ordered: Stop[] = [...completed];
  const unvisited = [...pending];

  // If no completed stops, start with the first pending stop (current #1)
  if (ordered.length === 0) {
    ordered.push(unvisited.shift()!);
  }

  while (unvisited.length > 0) {
    const current = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const candidate = unvisited[i];
      const dist = calculateDistanceKm(
        current.latitude,
        current.longitude,
        candidate.latitude,
        candidate.longitude
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    ordered.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  return [...ordered, ...invalid];
};
