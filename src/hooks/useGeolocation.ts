import { useState, useEffect, useRef, useCallback } from 'react';

export interface GeolocationState {
  coords: [number, number] | null;
  heading: number | null;
  speedKmH: number | null;
  accuracy: number | null;
  isTracking: boolean;
  error: string | null;
}

/**
 * Custom hook to track real-time device GPS position, bearing, and speed.
 * Includes Screen WakeLock support to prevent phone screens from sleeping during navigation.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    heading: null,
    speedKmH: null,
    accuracy: null,
    isTracking: false,
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const prevCoordsRef = useRef<[number, number] | null>(null);

  // Request screen wake lock so the driver's phone stays on during navigation
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Compute heading angle between two consecutive coordinates if device heading is null
  const computeBearing = (from: [number, number], to: [number, number]): number => {
    const lat1 = (from[0] * Math.PI) / 180;
    const lat2 = (to[0] * Math.PI) / 180;
    const dLon = ((to[1] - from[1]) * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  };

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState(prev => ({ ...prev, error: 'La geolocalización no está soportada en este navegador.' }));
      return;
    }

    if (watchIdRef.current !== null) return;

    requestWakeLock();

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const currentCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        
        let calculatedHeading = pos.coords.heading;
        if (calculatedHeading === null && prevCoordsRef.current) {
          // Calculate heading if moved more than 3 meters
          const [pLat, pLon] = prevCoordsRef.current;
          const [cLat, cLon] = currentCoords;
          const dist = Math.hypot(cLat - pLat, cLon - pLon) * 111000;
          if (dist > 3) {
            calculatedHeading = computeBearing(prevCoordsRef.current, currentCoords);
          }
        }

        prevCoordsRef.current = currentCoords;

        setState({
          coords: currentCoords,
          heading: calculatedHeading,
          speedKmH: pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : null,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
          isTracking: true,
          error: null,
        });
      },
      (err) => {
        let msg = 'Error obteniendo posición GPS.';
        if (err.code === 1) msg = 'Permiso de ubicación denegado. Habilita el GPS en tu navegador.';
        else if (err.code === 2) msg = 'Ubicación GPS no disponible.';
        else if (err.code === 3) msg = 'Tiempo de espera de GPS agotado.';

        setState(prev => ({ ...prev, isTracking: false, error: msg }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 10000,
      }
    );

    watchIdRef.current = id;
    setState(prev => ({ ...prev, isTracking: true, error: null }));
  }, [requestWakeLock]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    setState(prev => ({ ...prev, isTracking: false }));
  }, [releaseWakeLock]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
}

/**
 * Text-to-speech helper for spoken turn-by-turn navigation instructions
 */
export function speakInstruction(text: string) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}
