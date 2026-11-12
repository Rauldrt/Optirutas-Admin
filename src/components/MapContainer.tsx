import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { updateStop, type Stop, type Client } from '../services/firestore';
import { calculateRouteDistanceKm } from '../utils/geo';
import { Crosshair, Route as RouteIcon, X } from 'lucide-react';

// Component to handle map center changes dynamically
const ChangeMapView: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
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

interface MapViewProps {
  stops: Stop[];
  clients: Client[];
  activeTab: string;
  selectedCoordinates?: [number, number];
  selectedDayLabel?: string;
  isPickingLocation?: boolean;
  onPickLocation?: (coords: [number, number]) => void;
  onCancelPickLocation?: () => void;
  pickedCoordinates?: [number, number] | null;
}

export const MapView: React.FC<MapViewProps> = ({ 
  stops, 
  clients, 
  activeTab,
  selectedCoordinates,
  selectedDayLabel,
  isPickingLocation = false,
  onPickLocation,
  onCancelPickLocation,
  pickedCoordinates
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([-34.6037, -58.3816]); // Buenos Aires default
  const [zoom, setZoom] = useState<number>(13);

  // Auto-center map based on items or selection
  useEffect(() => {
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
  }, [stops, clients, activeTab, selectedCoordinates]);

  // Create custom markers using L.divIcon
  const createClientIcon = () => {
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

  const createPendingStopIcon = (index: number) => {
    return L.divIcon({
      className: 'custom-pending-stop-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-7 h-7 bg-amber-500 rounded-full opacity-35 animate-ping"></div>
          <div class="w-7 h-7 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg shadow-amber-500/50 text-white font-extrabold text-xs">
            ${index}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
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

  const totalDistanceKm = activeTab !== 'clients' ? calculateRouteDistanceKm(sortedStops) : 0;

  const handleToggleStopFromPopup = async (stop: Stop) => {
    const nextCompleted = !stop.completed;
    await updateStop(stop.id, {
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : (null as any)
    });
  };

  return (
    <div className={`w-full h-full relative rounded-3xl overflow-hidden shadow-2xl border ${
      isPickingLocation 
        ? 'border-purple-500 ring-4 ring-purple-500/30 cursor-crosshair' 
        : 'border-slate-200/50 dark:border-slate-800/50'
    }`}>
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

      {/* Route Distance & Filter Badge */}
      {activeTab !== 'clients' && sortedStops.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 px-3.5 py-2 rounded-2xl shadow-lg flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-purple-600 dark:text-purple-400">
            <RouteIcon className="w-4 h-4" />
            <span>
              {totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} km est.` : 'Ruta activa'}
            </span>
          </div>
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

      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeMapView center={mapCenter} zoom={selectedCoordinates ? 15 : undefined} />
        <MapClickHandler enabled={isPickingLocation} onPick={onPickLocation} />
        
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

        {/* Draw Route Polyline if looking at stops */}
        {activeTab !== 'clients' && routePolylineCoords.length > 1 && (
          <Polyline 
            positions={routePolylineCoords} 
            color="#a855f7" // Purple-500
            weight={4}
            opacity={0.8}
            dashArray="8, 8"
          />
        )}

        {/* Render Clients on Map */}
        {activeTab === 'clients' && clients.map(client => (
          client.latitude !== 0 && client.longitude !== 0 && (
            <Marker 
              key={`client-${client.id}`} 
              position={[client.latitude, client.longitude]}
              icon={createClientIcon()}
            >
              <Popup>
                <div className="p-2 text-slate-800 dark:text-slate-100">
                  <h3 className="font-extrabold text-sm mb-1">{client.name}</h3>
                  <p className="text-xs mb-1"><b>Dirección:</b> {client.address}</p>
                  {client.phone && <p className="text-xs mb-1"><b>Tel:</b> {client.phone}</p>}
                  {client.email && <p className="text-xs mb-1"><b>Email:</b> {client.email}</p>}
                  {client.mapLink && (
                    <a 
                      href={client.mapLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-block mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Ver en Google Maps →
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {/* Render Stops on Map */}
        {activeTab !== 'clients' && sortedStops.map((stop) => (
          stop.latitude !== 0 && stop.longitude !== 0 && (
            <Marker 
              key={`stop-${stop.id}`} 
              position={[stop.latitude, stop.longitude]}
              icon={stop.completed ? createCompletedStopIcon() : createPendingStopIcon(stop.orderIndex)}
            >
              <Popup>
                <div className="p-2 text-slate-800 dark:text-slate-100 min-w-[180px]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${stop.completed ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {stop.completed ? 'Completado' : `Parada ${stop.orderIndex}`}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {stop.deliveryDay}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm mb-1">{stop.name}</h3>
                  <p className="text-xs mb-2"><b>Dirección:</b> {stop.address}</p>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => handleToggleStopFromPopup(stop)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg text-white transition-colors cursor-pointer ${
                        stop.completed ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {stop.completed ? 'Marcar Pendiente' : '✓ Completar'}
                    </button>
                    <a
                      href={stop.mapLink || `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Navegar →
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
};
export default MapView;
