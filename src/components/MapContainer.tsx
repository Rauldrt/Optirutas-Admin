import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { updateStop, type Stop, type Client, type Vehicle } from '../services/firestore';
import { calculateRouteDistanceKm, calculateDistanceKm } from '../utils/geo';
import { 
  Crosshair, Route as RouteIcon, X, MousePointerClick, Send, BoxSelect,
  Navigation, Locate, LocateFixed, Volume2, VolumeX, CheckCircle2, AlertCircle,
  Maximize2, Minimize2, BellRing
} from 'lucide-react';
import { useGeolocation, speakInstruction } from '../hooks/useGeolocation';
import { getStreetRoute, type RouteResult } from '../services/routing';

// Component to handle map center changes dynamically
const ChangeMapView: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
};

// Component to recalculate Leaflet map viewport dimensions on resize or fullscreen change
const MapResizeHandler: React.FC<{ trigger: any }> = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [trigger, map]);
  return null;
};

// Component to capture clicks on the map when picking coordinates
const MapClickHandler: React.FC<{
  enabled: boolean;
  onPick?: (coords: [number, number]) => void;
}> = ({ enabled, onPick }) => {
  useMapEvents({
    click(e) {
      if (enabled && onPick) {
        onPick([
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        ]);
      }
    }
  });
  return null;
};

// Helper button inside MapContainer context to select all clients in current viewport bounds
const SelectVisibleBoundsButton: React.FC<{
  clients: Client[];
  selectedClientIds: string[];
  onSetSelectedClients?: (ids: string[]) => void;
}> = ({ clients, selectedClientIds, onSetSelectedClients }) => {
  const map = useMap();

  const handleSelectVisible = () => {
    if (!onSetSelectedClients) return;
    const bounds = map.getBounds();
    const visibleIds = clients
      .filter(
        c =>
          c.latitude !== 0 &&
          c.longitude !== 0 &&
          bounds.contains([c.latitude, c.longitude])
      )
      .map(c => c.id);

    // Merge with existing selection preserving order
    const merged = [...selectedClientIds];
    for (const id of visibleIds) {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    }
    onSetSelectedClients(merged);
  };

  return (
    <button
      type="button"
      onClick={handleSelectVisible}
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-800/70 hover:bg-purple-50 dark:hover:bg-purple-950/40 px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
      title="Seleccionar todos los clientes visibles en la zona actual del mapa"
    >
      <BoxSelect className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
      <span>Seleccionar zona visible</span>
    </button>
  );
};

interface MapViewProps {
  stops: Stop[];
  clients: Client[];
  vehicles?: Vehicle[];
  activeTab: string;
  selectedCoordinates?: [number, number];
  selectedDayLabel?: string;
  isPickingLocation?: boolean;
  onPickLocation?: (coords: [number, number]) => void;
  onCancelPickLocation?: () => void;
  pickedCoordinates?: [number, number] | null;
  // Client map selection props
  selectedClientIds?: string[];
  onToggleSelectClient?: (clientId: string) => void;
  onSetSelectedClients?: (clientIds: string[]) => void;
  onRequestSendSelectedClients?: () => void;
  // In-App Navigation props
  activeNavStop?: Stop | null;
  onStartNavigation?: (stop: Stop) => void;
  onEndNavigation?: () => void;
  onCompleteAndNextStop?: (stopId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ 
  stops, 
  clients, 
  vehicles = [],
  activeTab,
  selectedCoordinates,
  selectedDayLabel,
  isPickingLocation = false,
  onPickLocation,
  onCancelPickLocation,
  pickedCoordinates,
  selectedClientIds = [],
  onToggleSelectClient,
  onSetSelectedClients,
  onRequestSendSelectedClients,
  activeNavStop = null,
  onStartNavigation,
  onEndNavigation,
  onCompleteAndNextStop
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([-34.6037, -58.3816]); // Buenos Aires default
  const [zoom, setZoom] = useState<number>(13);
  // Quick-select mode on Clients map: clicking a marker immediately toggles selection
  const [quickMapSelectMode, setQuickMapSelectMode] = useState<boolean>(true);

  // In-App Turn-by-Turn Navigation & GPS Tracking
  const { 
    coords: userCoords, 
    heading, 
    speedKmH, 
    accuracy, 
    isTracking, 
    error: gpsError, 
    startTracking, 
    stopTracking 
  } = useGeolocation();

  const [streetRoute, setStreetRoute] = useState<RouteResult | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const lastSpokenInstructionRef = useRef<string>('');

  // Fullscreen Driver Mode
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Geofence Arrival Detection (75 meters radius)
  const GEOFENCE_RADIUS_METERS = 75;
  const [hasArrived, setHasArrived] = useState(false);
  const notifiedArrivalStopIdRef = useRef<string | null>(null);
  const [dismissedArrivalStopId, setDismissedArrivalStopId] = useState<string | null>(null);

  // Compute straight-line distance in meters to active target stop
  const distanceToTargetMeters = useMemo(() => {
    if (!activeNavStop || !userCoords || activeNavStop.latitude === 0 || activeNavStop.longitude === 0) {
      return null;
    }
    const km = calculateDistanceKm(
      userCoords[0],
      userCoords[1],
      activeNavStop.latitude,
      activeNavStop.longitude
    );
    return Math.round(km * 1000);
  }, [activeNavStop, userCoords]);

  // Trigger geofence arrival notification & vibration
  useEffect(() => {
    if (!activeNavStop || distanceToTargetMeters === null) {
      setHasArrived(false);
      return;
    }

    const isInside = distanceToTargetMeters <= GEOFENCE_RADIUS_METERS;

    if (isInside) {
      setHasArrived(true);

      // Trigger alerts only once per stop arrival
      if (notifiedArrivalStopIdRef.current !== activeNavStop.id) {
        notifiedArrivalStopIdRef.current = activeNavStop.id;

        // 1. Spoken audio notification
        if (!isVoiceMuted) {
          speakInstruction(`¡Has llegado a tu destino! ${activeNavStop.name}. Parada número ${activeNavStop.orderIndex}.`);
        }

        // 2. Haptic vibration pattern on mobile devices
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([250, 100, 250, 100, 500]);
          } catch {
            // Browser ignored vibration
          }
        }
      }
    } else if (distanceToTargetMeters > GEOFENCE_RADIUS_METERS + 40) {
      // Driver moved significantly away from geofence
      setHasArrived(false);
    }
  }, [distanceToTargetMeters, activeNavStop, isVoiceMuted]);

  // Reset dismissed arrival alert whenever activeNavStop changes
  useEffect(() => {
    setDismissedArrivalStopId(null);
  }, [activeNavStop?.id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (mapWrapperRef.current) {
          if (mapWrapperRef.current.requestFullscreen) {
            await mapWrapperRef.current.requestFullscreen();
          } else if ((mapWrapperRef.current as any).webkitRequestFullscreen) {
            await (mapWrapperRef.current as any).webkitRequestFullscreen();
          } else if ((mapWrapperRef.current as any).msRequestFullscreen) {
            await (mapWrapperRef.current as any).msRequestFullscreen();
          } else {
            setIsFullscreen(true);
          }
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
        } else {
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed, falling back to CSS fullscreen:', err);
      setIsFullscreen(prev => !prev);
    }
  };

  // Start GPS tracking automatically when entering navigation mode
  useEffect(() => {
    if (activeNavStop) {
      startTracking();
    }
  }, [activeNavStop, startTracking]);

  // Calculate street route with OSRM when navigating to activeNavStop
  useEffect(() => {
    if (!activeNavStop) {
      setStreetRoute(null);
      lastSpokenInstructionRef.current = '';
      return;
    }

    const destCoords: [number, number] = [activeNavStop.latitude, activeNavStop.longitude];
    // Use driver GPS coordinates if available, otherwise first available stop or destination vicinity
    const originCoords: [number, number] = userCoords || [destCoords[0] - 0.005, destCoords[1] - 0.005];

    let isMounted = true;
    getStreetRoute(originCoords, destCoords).then(route => {
      if (!isMounted) return;
      if (route) {
        setStreetRoute(route);
        // Voice guidance on step changes
        const nextInstruction = route.steps?.[0]?.instruction;
        if (nextInstruction && nextInstruction !== lastSpokenInstructionRef.current && !isVoiceMuted) {
          lastSpokenInstructionRef.current = nextInstruction;
          speakInstruction(nextInstruction);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeNavStop, userCoords, isVoiceMuted]);

  // Center on user position or active destination during navigation
  useEffect(() => {
    if (activeNavStop) {
      if (userCoords) {
        setMapCenter(userCoords);
        setZoom(16);
      } else {
        setMapCenter([activeNavStop.latitude, activeNavStop.longitude]);
        setZoom(16);
      }
    }
  }, [activeNavStop, userCoords]);

  // Auto-center map based on items or selection when not navigating
  useEffect(() => {
    if (activeNavStop) return;

    if (selectedCoordinates) {
      setMapCenter(selectedCoordinates);
      setZoom(15);
      return;
    }

    const itemsToCalculate = activeTab === 'clients' ? clients : stops;

    if (itemsToCalculate.length > 0) {
      const validCoords = itemsToCalculate.filter(
        item => item.latitude !== 0 && item.longitude !== 0
      );
      if (validCoords.length > 0) {
        const sumLat = validCoords.reduce((acc, curr) => acc + curr.latitude, 0);
        const sumLng = validCoords.reduce((acc, curr) => acc + curr.longitude, 0);
        setMapCenter([sumLat / validCoords.length, sumLng / validCoords.length]);
      }
    }
  }, [stops, clients, activeTab, selectedCoordinates, activeNavStop]);

  // Manual GPS toggle handler
  const handleToggleGps = () => {
    if (isTracking) {
      if (userCoords) {
        setMapCenter(userCoords);
        setZoom(16);
      } else {
        stopTracking();
      }
    } else {
      startTracking();
    }
  };

  // Create custom markers using L.divIcon
  const createClientIcon = (selectionOrder: number | null) => {
    if (selectionOrder !== null) {
      return L.divIcon({
        className: 'custom-selected-client-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-9 h-9 bg-emerald-500 rounded-full opacity-40 animate-ping"></div>
            <div class="w-8 h-8 bg-emerald-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xl shadow-emerald-500/60 text-white font-black text-xs">
              ${selectionOrder}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    }

    return L.divIcon({
      className: 'custom-client-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-6 h-6 bg-indigo-500 rounded-full opacity-30 animate-ping"></div>
          <div class="w-6 h-6 bg-indigo-600 dark:bg-indigo-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  const createCompletedStopIcon = () => {
    return L.divIcon({
      className: 'custom-completed-stop-marker',
      html: `
        <div class="w-7 h-7 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg shadow-emerald-500/50 text-white font-black text-sm">
          ✓
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  const createPendingStopIcon = (index: number, vehicleColor?: string) => {
    const pinColor = vehicleColor || '#f59e0b';
    return L.divIcon({
      className: 'custom-pending-stop-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-7 h-7 rounded-full opacity-35 animate-ping" style="background-color: ${pinColor}"></div>
          <div class="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg text-white font-extrabold text-xs" style="background-color: ${pinColor}; box-shadow: 0 4px 10px ${pinColor}80;">
            ${index}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  const createActiveNavStopIcon = (index: number, isArrived = false) => {
    if (isArrived) {
      return L.divIcon({
        className: 'custom-active-nav-stop-marker-arrived',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-12 h-12 bg-emerald-500 rounded-full opacity-50 animate-ping"></div>
            <div class="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xl shadow-emerald-500/70 text-white font-black text-sm">
              📍
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    }

    return L.divIcon({
      className: 'custom-active-nav-stop-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-blue-500 rounded-full opacity-40 animate-ping"></div>
          <div class="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xl shadow-blue-500/60 text-white font-black text-sm">
            #${index}
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  const createVehicleIcon = (headingDeg: number | null) => {
    const rot = headingDeg !== null ? headingDeg : 0;
    return L.divIcon({
      className: 'custom-vehicle-marker',
      html: `
        <div class="relative flex items-center justify-center" style="width: 44px; height: 44px;">
          <div class="absolute w-10 h-10 bg-blue-500 rounded-full opacity-35 animate-ping"></div>
          <div class="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xl shadow-blue-600/50 text-white" style="transform: rotate(${rot}deg); transition: transform 0.3s ease-out;">
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  };

  const createFleetRadarIcon = (v: Vehicle) => {
    const rot = v.telemetry?.heading || 0;
    const color = v.color || '#6366f1';
    const isMoving = (v.telemetry?.speed || 0) > 3;

    return L.divIcon({
      className: 'custom-fleet-radar-marker',
      html: `
        <div class="relative flex flex-col items-center justify-center" style="width: 50px; height: 50px;">
          ${isMoving ? `<div class="absolute w-11 h-11 rounded-full opacity-40 animate-ping" style="background-color: ${color}"></div>` : ''}
          <div class="relative w-8 h-8 rounded-2xl border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xl text-white font-black" style="background-color: ${color}; box-shadow: 0 4px 12px ${color}80;">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${rot}deg); transition: transform 0.4s ease-out;">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
          <div class="mt-0.5 bg-slate-900/95 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md border border-slate-700 whitespace-nowrap">
            ${v.name}
          </div>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25]
    });
  };

  const createPickedIcon = () => {
    return L.divIcon({
      className: 'custom-picked-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 bg-rose-500 rounded-full opacity-40 animate-ping"></div>
          <div class="w-8 h-8 bg-rose-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg shadow-rose-500/50 text-white font-black text-xs">
            📍
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  // Build the route line coordinates connecting stops in orderIndex order
  const sortedStops = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const routePolylineCoords = sortedStops
    .filter(stop => stop.latitude !== 0 && stop.longitude !== 0)
    .map(stop => [stop.latitude, stop.longitude] as [number, number]);

  // Group stops by vehicle to render independent colored polylines for each vehicle route
  const vehicleRoutes = useMemo(() => {
    if (activeNavStop || activeTab === 'clients') return [];

    const grouped: Record<string, { key: string; name: string; color: string; coords: [number, number][]; count: number }> = {};

    for (const stop of sortedStops) {
      if (stop.latitude === 0 || stop.longitude === 0) continue;
      const vKey = stop.vehicleId || 'unassigned';
      if (!grouped[vKey]) {
        const vehicle = stop.vehicleId ? vehicles.find(v => v.id === stop.vehicleId) : null;
        grouped[vKey] = {
          key: vKey,
          name: vehicle?.name || (stop.vehicleId ? stop.vehicleName || 'Móvil' : 'Sin Asignar'),
          color: vehicle?.color || (stop.vehicleId ? '#6366f1' : '#a855f7'),
          coords: [],
          count: 0
        };
      }
      grouped[vKey].coords.push([stop.latitude, stop.longitude]);
      grouped[vKey].count += 1;
    }

    return Object.values(grouped).filter(r => r.coords.length > 1);
  }, [sortedStops, activeNavStop, activeTab, vehicles]);

  // Build preview polyline for selected clients in the order they were selected
  const selectedClientsOrdered = selectedClientIds
    .map(id => clients.find(c => c.id === id))
    .filter((c): c is Client => !!c && c.latitude !== 0 && c.longitude !== 0);

  const selectedClientsPolylineCoords = selectedClientsOrdered.map(
    c => [c.latitude, c.longitude] as [number, number]
  );

  const totalDistanceKm = activeTab !== 'clients' ? calculateRouteDistanceKm(sortedStops) : 0;

  const handleToggleStopFromPopup = async (stop: Stop) => {
    const nextCompleted = !stop.completed;
    await updateStop(stop.id, {
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : (null as any)
    });
  };

  return (
    <div 
      ref={mapWrapperRef}
      className={`w-full h-full relative overflow-hidden transition-all duration-300 ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999] rounded-none border-0 shadow-none bg-slate-950 w-screen h-screen' 
          : `rounded-3xl shadow-2xl border isolate z-0 ${
              isPickingLocation 
                ? 'border-purple-500 ring-4 ring-purple-500/30 cursor-crosshair' 
                : 'border-slate-200/50 dark:border-slate-800/50'
            }`
      }`}
    >
      {/* Picking Mode Floating Banner */}
      {isPickingLocation && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-purple-600 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-extrabold animate-bounce">
          <Crosshair className="w-4 h-4 flex-shrink-0" />
          <span>Haz clic en el mapa para fijar la ubicación</span>
          {onCancelPickLocation && (
            <button
              onClick={onCancelPickLocation}
              className="ml-1 p-1 rounded-lg bg-purple-700 hover:bg-purple-800 transition-colors"
              title="Cancelar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* In-App Turn-by-Turn Navigation: Top Maneuver HUD Banner */}
      {activeNavStop && (
        <div className={`absolute top-3 left-3 right-3 z-[1000] pointer-events-auto transition-all ${
          isFullscreen ? 'sm:left-6 sm:right-6 sm:top-5' : 'sm:left-4 sm:right-4'
        }`}>
          <div className={`bg-slate-900/95 dark:bg-slate-900/95 text-white shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 animate-fade-in ${
            hasArrived ? 'border-emerald-500/60 ring-2 ring-emerald-500/30' : 'border-blue-500/40'
          } ${isFullscreen ? 'px-5 py-4 rounded-3xl' : 'px-4 py-3 rounded-2xl'}`}>
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                hasArrived ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-blue-600 shadow-blue-500/30'
              } ${isFullscreen ? 'w-12 h-12' : 'w-10 h-10'}`}>
                {hasArrived ? (
                  <BellRing className={`text-white animate-bounce ${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'}`} />
                ) : (
                  <Navigation className={`text-white animate-pulse ${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'}`} />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    hasArrived
                      ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/60 animate-pulse'
                      : 'text-blue-400 bg-blue-950/80 border-blue-800/50'
                  }`}>
                    {hasArrived 
                      ? '🎯 ¡LLEGASTE A DESTINO!' 
                      : (streetRoute?.steps?.[0]?.distanceMeters 
                        ? `En ${Math.round(streetRoute.steps[0].distanceMeters)} m` 
                        : 'Navegación Activa')}
                  </span>
                  {isFullscreen && (
                    <span className="hidden sm:inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Modo Conductor
                    </span>
                  )}
                  {streetRoute?.isOfflineFallback && (
                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Offline (Rumbo)
                    </span>
                  )}
                </div>
                <p className={`font-black text-white truncate mt-0.5 ${
                  isFullscreen ? 'text-base sm:text-xl' : 'text-sm'
                }`}>
                  {hasArrived 
                    ? `Parada #${activeNavStop.orderIndex}: ${activeNavStop.name}` 
                    : (streetRoute?.steps?.[0]?.instruction || `Dirigiéndose a ${activeNavStop.name}`)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsVoiceMuted(prev => !prev)}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                  isVoiceMuted 
                    ? 'text-slate-400 hover:bg-slate-800' 
                    : 'text-blue-400 bg-blue-950/60 hover:bg-blue-900/60'
                }`}
                title={isVoiceMuted ? 'Activar voz de navegación' : 'Silenciar voz'}
              >
                {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                  isFullscreen 
                    ? 'text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={isFullscreen ? 'Salir de Modo Conductor Pantalla Completa' : 'Modo Conductor Pantalla Completa'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {onEndNavigation && (
                <button
                  type="button"
                  onClick={onEndNavigation}
                  className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Salir de navegación"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Geofence Auto-Arrival Alert Card (triggers inside 75m of destination) */}
      {activeNavStop && hasArrived && dismissedArrivalStopId !== activeNavStop.id && (
        <div className={`absolute bottom-4 left-3 right-3 z-[1010] pointer-events-auto transition-all ${
          isFullscreen ? 'sm:left-6 sm:right-6 sm:bottom-6' : 'sm:left-4 sm:right-4'
        }`}>
          <div className="bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-teal-950/95 text-white backdrop-blur-xl border-2 border-emerald-400/80 shadow-2xl shadow-emerald-500/30 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in ring-4 ring-emerald-500/20">
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-xl shadow-emerald-500/40">
                <BellRing className="w-6 h-6 sm:w-7 sm:h-7 animate-bounce" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                    📍 ¡LLEGASTE A DESTINO!
                  </span>
                  <span className="text-xs font-extrabold text-emerald-300">
                    A {distanceToTargetMeters !== null ? `${distanceToTargetMeters} m` : 'pocos metros'}
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg font-black text-white truncate mt-1">
                  Parada #{activeNavStop.orderIndex}: {activeNavStop.name}
                </h3>
                <p className="text-xs text-slate-300 truncate mt-0.5">
                  {activeNavStop.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setDismissedArrivalStopId(activeNavStop.id)}
                className="px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="Cerrar aviso y continuar navegando"
              >
                Aún no
              </button>
              {onCompleteAndNextStop && (
                <button
                  type="button"
                  onClick={() => onCompleteAndNextStop(activeNavStop.id)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-500/30 transition-all cursor-pointer m3-surface-interactive"
                  title="Confirmar entrega de esta parada y pasar a la siguiente"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar Entrega y Siguiente</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-App Turn-by-Turn Navigation: Bottom Destination & Controls HUD Bar */}
      {activeNavStop && (
        <div className={`absolute bottom-4 left-3 right-3 z-[1000] pointer-events-auto transition-all ${
          isFullscreen ? 'sm:left-6 sm:right-6 sm:bottom-6' : 'sm:left-4 sm:right-4'
        }`}>
          <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in ${
            isFullscreen ? 'px-5 py-4 rounded-3xl' : 'px-4 py-3 rounded-3xl'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-black flex items-center justify-center shadow-inner ${
                isFullscreen ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm'
              }`}>
                #{activeNavStop.orderIndex}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className={`font-black text-slate-900 dark:text-white truncate ${
                    isFullscreen ? 'text-sm sm:text-base max-w-[200px] sm:max-w-md' : 'text-xs max-w-[160px] sm:max-w-xs'
                  }`}>
                    {activeNavStop.name}
                  </h4>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    En Curso
                  </span>
                </div>
                <div className={`flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400 mt-0.5 ${
                  isFullscreen ? 'text-xs sm:text-sm' : 'text-[11px]'
                }`}>
                  {streetRoute && (
                    <>
                      <span className="text-slate-900 dark:text-white font-black">
                        {streetRoute.durationMinutes} min
                      </span>
                      <span>•</span>
                      <span>{streetRoute.distanceKm.toFixed(1)} km</span>
                    </>
                  )}
                  {speedKmH !== null && speedKmH > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">{speedKmH} km/h</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {onCompleteAndNextStop && (
                <button
                  type="button"
                  onClick={() => onCompleteAndNextStop(activeNavStop.id)}
                  className={`flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer m3-surface-interactive ${
                    isFullscreen ? 'px-6 py-3.5 text-sm sm:text-base' : 'px-4 py-2.5 text-xs'
                  }`}
                  title="Marcar parada como completada y calcular ruta a la siguiente parada"
                >
                  <CheckCircle2 className={isFullscreen ? "w-5 h-5" : "w-4 h-4"} />
                  <span>Completar y Siguiente</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Controls: GPS & Fullscreen Driver Mode */}
      <div className={`absolute left-3 z-[990] pointer-events-auto flex items-center gap-2 ${
        activeNavStop ? 'top-20 sm:top-22' : 'top-3'
      }`}>
        <button
          type="button"
          onClick={handleToggleGps}
          className={`p-2.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all cursor-pointer flex items-center gap-2 text-xs font-extrabold m3-surface-interactive ${
            isTracking
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30 ring-2 ring-blue-400/40'
              : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={isTracking ? 'GPS Activo: Toca para centrar en ti' : 'Activar GPS en tiempo real'}
        >
          {isTracking ? <LocateFixed className="w-4 h-4 text-white animate-pulse" /> : <Locate className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isTracking ? (speedKmH !== null && speedKmH > 0 ? `${speedKmH} km/h` : 'GPS Activo') : 'Mi Ubicación'}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className={`p-2.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all cursor-pointer flex items-center gap-2 text-xs font-extrabold m3-surface-interactive ${
            isFullscreen
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30 ring-2 ring-emerald-400/40'
              : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={isFullscreen ? 'Salir de Modo Conductor (Pantalla Completa)' : 'Activar Modo Conductor (Pantalla Completa)'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          <span className="hidden sm:inline">
            {isFullscreen ? 'Salir Pantalla Completa' : 'Modo Conductor'}
          </span>
        </button>
      </div>

      {/* GPS Error Notification if permissions denied */}
      {gpsError && (
        <div className="absolute top-16 left-3 right-3 sm:left-4 sm:right-auto z-[990] bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Route Distance & Filter Badge (Stops & Dashboard tabs when NOT in navigation HUD mode) */}
      {!activeNavStop && activeTab !== 'clients' && sortedStops.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 px-3.5 py-2 rounded-2xl shadow-lg flex flex-wrap items-center gap-3 text-xs max-w-[calc(100%-2rem)]">
          <div className="flex items-center gap-1.5 font-extrabold text-purple-600 dark:text-purple-400">
            <RouteIcon className="w-4 h-4" />
            <span>
              {totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} km est.` : 'Ruta activa'}
            </span>
          </div>

          {/* Active vehicle routes color indicators */}
          {vehicleRoutes.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-2.5">
              {vehicleRoutes.map(vr => (
                <span key={vr.key} className="flex items-center gap-1 text-[10px] font-black" style={{ color: vr.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vr.color }} />
                  <span>{vr.name}</span>
                </span>
              ))}
            </div>
          )}

          {selectedDayLabel && selectedDayLabel !== 'Todos' && (
            <span className="border-l border-slate-200 dark:border-slate-700 pl-2.5 font-bold text-slate-600 dark:text-slate-300">
              Día: {selectedDayLabel}
            </span>
          )}
          <span className="border-l border-slate-200 dark:border-slate-700 pl-2.5 font-bold text-slate-500 dark:text-slate-400">
            {sortedStops.filter(s => s.completed).length}/{sortedStops.length} entregadas
          </span>
        </div>
      )}

      {/* Clients Tab: Floating Action Bar when clients are selected on the map */}
      {activeTab === 'clients' && selectedClientIds.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 px-4 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-md shadow-emerald-500/30">
              {selectedClientIds.length}
            </span>
            <div>
              <p className="text-xs font-extrabold text-slate-800 dark:text-white leading-tight">
                {selectedClientIds.length} cliente(s) en la ruta a programar
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[240px] sm:max-w-md">
                {selectedClientsOrdered.map((c, i) => `${i + 1}. ${c.name}`).join(' → ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onSetSelectedClients && (
              <button
                type="button"
                onClick={() => onSetSelectedClients([])}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            )}
            {onRequestSendSelectedClients && (
              <button
                type="button"
                onClick={onRequestSendSelectedClients}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/30 hover:opacity-95 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar a Ruta ({selectedClientIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeMapView center={mapCenter} zoom={selectedCoordinates ? 15 : undefined} />
        <MapResizeHandler trigger={isFullscreen} />
        <MapClickHandler enabled={isPickingLocation} onPick={onPickLocation} />

        {/* Clients Tab: Top-Right Interactive Selection Controls */}
        {activeTab === 'clients' && !isPickingLocation && (
          <div className="leaflet-top leaflet-right !top-3 !right-3 flex flex-wrap items-center gap-2 pointer-events-auto z-[1000]">
            <SelectVisibleBoundsButton
              clients={clients}
              selectedClientIds={selectedClientIds}
              onSetSelectedClients={onSetSelectedClients}
            />
            <button
              type="button"
              onClick={() => setQuickMapSelectMode(prev => !prev)}
              className={`px-3.5 py-2 rounded-2xl shadow-lg flex items-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer border ${
                quickMapSelectMode
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30'
                  : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-slate-800/70'
              }`}
              title="Cuando está activo, tocar un pin de cliente en el mapa lo agrega o quita directamente de la selección"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{quickMapSelectMode ? 'Selección 1-Clic: ON' : 'Selección 1-Clic: OFF'}</span>
            </button>
          </div>
        )}
        
        {/* OpenStreetMap Tiles with Custom CSS class for dark mode invert */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        {/* Picked Coordinates Marker */}
        {pickedCoordinates && (
          <Marker position={pickedCoordinates} icon={createPickedIcon()}>
            <Popup>
              <div className="p-1 text-xs font-bold text-slate-800">
                Ubicación seleccionada:<br />
                {pickedCoordinates[0]}, {pickedCoordinates[1]}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Draw Live Street-routed Polyline from OSRM when in navigation mode */}
        {activeNavStop && streetRoute && streetRoute.coordinates.length > 0 && (
          <Polyline 
            positions={streetRoute.coordinates} 
            color="#2563eb" // Blue-600
            weight={6}
            opacity={0.9}
          />
        )}

        {/* Geofence Arrival Zone Circle around active target stop */}
        {activeNavStop && activeNavStop.latitude !== 0 && activeNavStop.longitude !== 0 && (
          <Circle
            center={[activeNavStop.latitude, activeNavStop.longitude]}
            radius={GEOFENCE_RADIUS_METERS}
            pathOptions={{
              color: hasArrived ? '#10b981' : '#3b82f6',
              fillColor: hasArrived ? '#10b981' : '#3b82f6',
              fillOpacity: hasArrived ? 0.3 : 0.12,
              weight: hasArrived ? 3 : 2,
              dashArray: hasArrived ? undefined : '6, 6'
            }}
          />
        )}

        {/* Live Driver Vehicle GPS Marker */}
        {userCoords && (
          <Marker 
            position={userCoords} 
            icon={createVehicleIcon(heading)}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="p-1.5 text-xs text-slate-800 dark:text-slate-100 min-w-[150px]">
                <p className="font-extrabold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Tu Ubicación (Conductor)</span>
                </p>
                {speedKmH !== null && speedKmH > 0 && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Velocidad: <b>{speedKmH} km/h</b>
                  </p>
                )}
                {accuracy !== null && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Precisión GPS: ±{accuracy}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Live Fleet Telemetry Radar for all registered reporting vehicles */}
        {vehicles && vehicles.map((v) => {
          if (!v.telemetry || !v.telemetry.lat || !v.telemetry.lng) return null;
          // Only show vehicles reporting within the last 35 minutes
          const isRecent = Date.now() - v.telemetry.updatedAt < 1000 * 60 * 35;
          if (!isRecent) return null;

          return (
            <Marker
              key={`fleet-radar-${v.id}`}
              position={[v.telemetry.lat, v.telemetry.lng]}
              icon={createFleetRadarIcon(v)}
              zIndexOffset={950}
            >
              <Popup>
                <div className="p-2 text-slate-800 dark:text-slate-100 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: v.color }} 
                    />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {v.name}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <b>Chofer:</b> {v.driverName}
                  </p>
                  {v.plate && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <b>Patente:</b> {v.plate}
                    </p>
                  )}
                  {v.telemetry.speed !== undefined && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <b>Velocidad:</b> {v.telemetry.speed} km/h
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    🛰️ Posición recibida hace {Math.max(1, Math.round((Date.now() - v.telemetry.updatedAt) / 60000))} min
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Draw Route Polylines: Independent colored lines per vehicle */}
        {!activeNavStop && activeTab !== 'clients' && (
          vehicleRoutes.length > 0 ? (
            vehicleRoutes.map((vRoute) => (
              <Polyline 
                key={`route-polyline-${vRoute.key}`}
                positions={vRoute.coords} 
                color={vRoute.color} 
                weight={4}
                opacity={0.85}
                dashArray="8, 8"
              />
            ))
          ) : routePolylineCoords.length > 1 ? (
            <Polyline 
              positions={routePolylineCoords} 
              color="#a855f7" // Purple-500
              weight={4}
              opacity={0.8}
              dashArray="8, 8"
            />
          ) : null
        )}

        {/* Draw Preview Polyline connecting selected clients on the Clients map */}
        {activeTab === 'clients' && selectedClientsPolylineCoords.length > 1 && (
          <Polyline
            positions={selectedClientsPolylineCoords}
            color="#10b981" // Emerald-500
            weight={4}
            opacity={0.85}
            dashArray="6, 6"
          />
        )}

        {/* Render Clients on Map */}
        {activeTab === 'clients' && clients.map(client => {
          if (client.latitude === 0 || client.longitude === 0) return null;
          const selIdx = selectedClientIds.indexOf(client.id);
          const isSelected = selIdx !== -1;

          return (
            <Marker 
              key={`client-${client.id}`} 
              position={[client.latitude, client.longitude]}
              icon={createClientIcon(isSelected ? selIdx + 1 : null)}
              eventHandlers={{
                click: () => {
                  if (quickMapSelectMode && onToggleSelectClient && !isPickingLocation) {
                    onToggleSelectClient(client.id);
                  }
                }
              }}
            >
              <Popup>
                <div className="p-2 text-slate-800 dark:text-slate-100 min-w-[190px]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-extrabold text-sm">{client.name}</h3>
                    {isSelected && (
                      <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        #{selIdx + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mb-1"><b>Dirección:</b> {client.address}</p>
                  {client.phone && <p className="text-xs mb-1"><b>Tel:</b> {client.phone}</p>}
                  {client.email && <p className="text-xs mb-1"><b>Email:</b> {client.email}</p>}

                  <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-200/60">
                    {onToggleSelectClient && (
                      <button
                        type="button"
                        onClick={() => onToggleSelectClient(client.id)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg text-white transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500 hover:bg-rose-600'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {isSelected ? 'Quitar de ruta' : '+ Seleccionar'}
                      </button>
                    )}
                    {client.mapLink && (
                      <a 
                        href={client.mapLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        Google Maps →
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render Stops on Map */}
        {activeTab !== 'clients' && sortedStops.map((stop) => {
          const isStopActiveNav = activeNavStop?.id === stop.id;
          const assignedVehicle = stop.vehicleId ? vehicles.find(v => v.id === stop.vehicleId) : null;
          let markerIcon = stop.completed 
            ? createCompletedStopIcon() 
            : isStopActiveNav 
              ? createActiveNavStopIcon(stop.orderIndex, hasArrived) 
              : createPendingStopIcon(stop.orderIndex, assignedVehicle?.color);

          return (
            stop.latitude !== 0 && stop.longitude !== 0 && (
              <Marker 
                key={`stop-${stop.id}`} 
                position={[stop.latitude, stop.longitude]}
                icon={markerIcon}
                zIndexOffset={isStopActiveNav ? 900 : 100}
              >
                <Popup>
                  <div className="p-2 text-slate-800 dark:text-slate-100 min-w-[200px]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                        stop.completed 
                          ? 'bg-emerald-500' 
                          : isStopActiveNav 
                            ? 'bg-blue-600 animate-pulse' 
                            : 'bg-amber-500'
                      }`} style={!stop.completed && !isStopActiveNav && assignedVehicle ? { backgroundColor: assignedVehicle.color } : undefined}>
                        {stop.completed ? 'Completado' : isStopActiveNav ? `Navegando #${stop.orderIndex}` : `Parada ${stop.orderIndex}`}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {stop.deliveryDay}
                      </span>
                    </div>

                    {assignedVehicle && (
                      <div className="mb-1 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: assignedVehicle.color }} />
                        <span>{assignedVehicle.name} ({assignedVehicle.driverName})</span>
                      </div>
                    )}

                    <h3 className="font-extrabold text-sm mb-1">{stop.name}</h3>
                    <p className="text-xs mb-2"><b>Dirección:</b> {stop.address}</p>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => handleToggleStopFromPopup(stop)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg text-white transition-colors cursor-pointer ${
                          stop.completed ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {stop.completed ? 'Marcar Pendiente' : '✓ Completar'}
                      </button>

                      {onStartNavigation && !stop.completed && (
                        <button
                          type="button"
                          onClick={() => onStartNavigation(stop)}
                          className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Navegar In-App</span>
                        </button>
                      )}

                      <a
                        href={stop.mapLink || `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-indigo-600 hover:underline ml-auto"
                      >
                        Google Maps ↗
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          );
        })}
      </MapContainer>
    </div>
  );
};
export default MapView;
