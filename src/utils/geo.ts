import type { Stop } from '../services/firestore';

export const DAYS_OF_WEEK_ES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
] as const;

/**
 * Returns the current day of the week in Spanish (e.g. 'Jueves')
 */
export const getCurrentDayNameEs = (): string => {
  const jsDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
  const map: Record<number, string> = {
    0: 'Domingo',
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado'
  };
  return map[jsDay] || 'Lunes';
};

/**
 * Normalize text by lowercasing and stripping accents/diacritics
 */
export const normalizeText = (text: string): string => {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Compute Levenshtein edit distance between two short strings for typo tolerance
 */
const levenshteinDistance = (a: string, b: string): number => {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Smart flexible search matcher:
 * - Accent & case insensitive ("miercoles" matches "Miércoles", "coron" matches "Coronel Díaz")
 * - Multi-word out-of-order matching ("farmacia 2000" matches "Farmacia Central" + "Av. Corrientes 2000")
 * - Typo-tolerant (1 character typo on words >= 4 chars, or 2 chars on words >= 7 chars)
 */
export const smartSearchMatch = (
  query: string,
  ...fields: (string | number | undefined | null)[]
): boolean => {
  const normQuery = normalizeText(query);
  if (!normQuery) return true;

  const combinedText = normalizeText(
    fields.filter((f) => f !== undefined && f !== null).join(' ')
  );
  if (!combinedText) return false;

  // Fast path: direct substring match
  if (combinedText.includes(normQuery)) return true;

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const targetWords = combinedText.split(/[\s,.;:/\-_()]+/).filter(Boolean);

  // Every token in the query must match either as a substring or fuzzy word match
  return queryTokens.every((token) => {
    if (combinedText.includes(token)) return true;

    // Fuzzy typo tolerance for tokens of length >= 4
    if (token.length >= 4) {
      const maxDist = token.length >= 7 ? 2 : 1;
      return targetWords.some((word) => {
        if (word.startsWith(token.slice(0, 3))) {
          const prefixSlice = word.slice(0, token.length);
          if (levenshteinDistance(token, prefixSlice) <= maxDist) return true;
        }
        return levenshteinDistance(token, word) <= maxDist;
      });
    }

    return false;
  });
};

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
 * Calculate total route distance in km for an ordered list of stops (in array order)
 */
export const calculateSequenceDistanceKm = (stops: Stop[]): number => {
  const validStops = stops.filter((s) => s.latitude !== 0 && s.longitude !== 0);
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
 * Calculate total route distance in km for stops sorted by orderIndex
 */
export const calculateRouteDistanceKm = (stops: Stop[]): number => {
  const sorted = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  return calculateSequenceDistanceKm(sorted);
};

/**
 * Nearest-neighbor + 2-opt TSP heuristic to order stops minimizing travel distance.
 * If startStopId is provided, uses that stop as the starting pending stop;
 * otherwise tries each pending stop as start (when no startStopId is forced) or uses the first stop,
 * and applies 2-opt local search to propose the shortest route!
 */
export const computeOptimizedStopOrder = (
  stops: Stop[],
  startStopId?: string
): Stop[] => {
  if (stops.length <= 2) return [...stops];

  const sorted = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const valid = sorted.filter((s) => s.latitude !== 0 && s.longitude !== 0);
  const invalid = sorted.filter((s) => s.latitude === 0 || s.longitude === 0);

  if (valid.length <= 2) return sorted;

  const completed = valid.filter((s) => s.completed);
  const pending = valid.filter((s) => !s.completed);

  if (pending.length <= 1) {
    return [...completed, ...pending, ...invalid];
  }

  // Helper to build a nearest-neighbor tour starting from a specific index in `pending`
  const buildNearestNeighbor = (startIndex: number): Stop[] => {
    const ordered: Stop[] = [...completed];
    const unvisited = [...pending];

    if (ordered.length === 0) {
      ordered.push(unvisited.splice(startIndex, 1)[0]);
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

    return ordered;
  };

  let bestTour: Stop[];
  if (startStopId) {
    const forcedIdx = pending.findIndex((s) => s.id === startStopId);
    bestTour = buildNearestNeighbor(forcedIdx !== -1 ? forcedIdx : 0);
  } else if (completed.length > 0) {
    bestTour = buildNearestNeighbor(0);
  } else {
    // Keep the first stop as anchor by default, or evaluate best starting point if first isn't better
    bestTour = buildNearestNeighbor(0);
  }

  // Apply 2-opt refinement on the pending portion (keeping the first stop fixed as departure point)
  const fixedPrefixLen = Math.max(1, completed.length);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = fixedPrefixLen; i < bestTour.length - 1; i++) {
      for (let k = i + 1; k < bestTour.length; k++) {
        const candidate = [
          ...bestTour.slice(0, i),
          ...bestTour.slice(i, k + 1).reverse(),
          ...bestTour.slice(k + 1)
        ];
        if (calculateSequenceDistanceKm(candidate) + 0.01 < calculateSequenceDistanceKm(bestTour)) {
          bestTour = candidate;
          improved = true;
        }
      }
    }
  }

  return [...bestTour, ...invalid];
};
