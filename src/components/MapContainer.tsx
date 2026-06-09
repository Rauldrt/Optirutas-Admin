import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Stop, Client } from '../services/firestore';

// Component to handle map center changes dynamically
const ChangeMapView: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

interface MapViewProps {
  stops: Stop[];
  clients: Client[];
  activeTab: string;
  selectedCoordinates?: [number, number];
}

export const MapView: React.FC<MapViewProps> = ({ 
  stops, 
  clients, 
  activeTab,
  selectedCoordinates 
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

  // Build the route line coordinates connecting stops in orderIndex order
  const sortedStops = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const routePolylineCoords = sortedStops
    .filter(stop => stop.latitude !== 0 && stop.longitude !== 0)
    .map(stop => [stop.latitude, stop.longitude] as [number, number]);

  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800/50">
      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeMapView center={mapCenter} />
        
        {/* OpenStreetMap Tiles with Custom CSS class for dark mode invert */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

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
        {activeTab !== 'clients' && stops.map((stop) => (
          stop.latitude !== 0 && stop.longitude !== 0 && (
            <Marker 
              key={`stop-${stop.id}`} 
              position={[stop.latitude, stop.longitude]}
              icon={stop.completed ? createCompletedStopIcon() : createPendingStopIcon(stop.orderIndex)}
            >
              <Popup>
                <div className="p-2 text-slate-800 dark:text-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${stop.completed ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {stop.completed ? 'Completado' : `Parada ${stop.orderIndex}`}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {stop.deliveryDay}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm mb-1">{stop.name}</h3>
                  <p className="text-xs mb-1"><b>Dirección:</b> {stop.address}</p>
                  <p className="text-[10px] text-slate-400">Lat: {stop.latitude}, Lng: {stop.longitude}</p>
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
