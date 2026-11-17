import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Stop, Vehicle, Client } from '../services/firestore';
import { calculateDistanceKm, formatWhatsAppPhone } from '../utils/geo';
import { 
  Package, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Timer, 
  Share2, 
  MessageCircle, 
  Check, 
  Sun, 
  Moon, 
  Radio
} from 'lucide-react';

interface CustomerTrackingViewProps {
  stopId: string;
  stops: Stop[];
  vehicles: Vehicle[];
  clients?: Client[];
  onExit?: () => void;
}

// Component to adjust map view to fit both vehicle and customer destination
const MapBoundsFitter: React.FC<{
  customerCoords: [number, number];
  vehicleCoords?: [number, number] | null;
}> = ({ customerCoords, vehicleCoords }) => {
  const map = useMap();

  useEffect(() => {
    if (!customerCoords) return;
    if (vehicleCoords) {
      const bounds = L.latLngBounds([customerCoords, vehicleCoords]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView(customerCoords, 16);
    }
  }, [customerCoords, vehicleCoords, map]);

  return null;
};

export const CustomerTrackingView: React.FC<CustomerTrackingViewProps> = ({
  stopId,
  stops,
  vehicles,
  clients = [],
  onExit
}) => {
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('optirutas_tracking_dark');
      if (saved !== null) return saved === 'true';
      return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('optirutas_tracking_dark', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Find target stop in real-time
  const stop = useMemo(() => {
    return stops.find(s => s.id === stopId) || null;
  }, [stops, stopId]);

  // Find assigned vehicle
  const vehicle = useMemo(() => {
    if (!stop?.vehicleId) return null;
    return vehicles.find(v => v.id === stop.vehicleId) || null;
  }, [stop, vehicles]);

  // Find matching client
  const matchedClient = useMemo(() => {
    if (!stop) return null;
    return clients.find(c => 
      c.name.toLowerCase() === stop.name.toLowerCase() ||
      (Math.abs(c.latitude - stop.latitude) < 0.0001 && Math.abs(c.longitude - stop.longitude) < 0.0001)
    ) || null;
  }, [stop, clients]);

  // Find stops for the same day and vehicle to compute queue progress
  const dayVehicleStops = useMemo(() => {
    if (!stop) return [];
    return stops
      .filter(s => 
        s.deliveryDay.toLowerCase() === stop.deliveryDay.toLowerCase() &&
        (stop.vehicleId ? s.vehicleId === stop.vehicleId : true)
      )
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [stops, stop]);

  // Queue calculation
  const { pendingBeforeCount, isImmediateNext, totalRouteStops } = useMemo(() => {
    if (!stop) return { pendingBeforeCount: 0, isImmediateNext: false, totalRouteStops: 0 };
    const pendingBefore = dayVehicleStops.filter(s => !s.completed && s.orderIndex < stop.orderIndex);
    const count = pendingBefore.length;
    return {
      pendingBeforeCount: count,
      isImmediateNext: count === 0 && !stop.completed,
      totalRouteStops: dayVehicleStops.length
    };
  }, [stop, dayVehicleStops]);

  // Distance from vehicle telemetry to customer stop
  const vehicleTelemetry = vehicle?.telemetry;
  const isTelemetryLive = vehicleTelemetry?.updatedAt 
    ? Date.now() - vehicleTelemetry.updatedAt < 1000 * 60 * 20 
    : false;

  const vehicleCoords: [number, number] | null = useMemo(() => {
    if (isTelemetryLive && vehicleTelemetry && vehicleTelemetry.lat && vehicleTelemetry.lng) {
      return [vehicleTelemetry.lat, vehicleTelemetry.lng];
    }
    return null;
  }, [isTelemetryLive, vehicleTelemetry]);

  const distanceKm = useMemo(() => {
    if (!stop || !vehicleCoords) return null;
    return calculateDistanceKm(vehicleCoords[0], vehicleCoords[1], stop.latitude, stop.longitude);
  }, [stop, vehicleCoords]);

  // ETA Estimation calculation
  const etaWindowText = useMemo(() => {
    if (!stop) return '';
    if (stop.completed) {
      return stop.completedAt 
        ? `Entregado a las ${new Date(stop.completedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
        : 'Pedido Entregado';
    }
    if (stop.arrivedAt) {
      return '¡El móvil está en tu puerta ahora!';
    }
    if (isImmediateNext) {
      if (distanceKm !== null && distanceKm > 0) {
        // Average urban speed ~25 km/h + 3 min buffer
        const mins = Math.max(3, Math.round((distanceKm / 25) * 60) + 2);
        return `Aprox. ${mins} - ${mins + 5} min (~${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`})`;
      }
      return 'Próxima parada • Muy pronto';
    }

    // Pending with previous stops: estimate ~10-12 min per stop ahead
    const estimatedMinutesAhead = Math.max(15, pendingBeforeCount * 11);
    const now = new Date();
    const minEta = new Date(now.getTime() + (estimatedMinutesAhead - 5) * 60000);
    const maxEta = new Date(now.getTime() + (estimatedMinutesAhead + 15) * 60000);
    const minStr = minEta.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const maxStr = maxEta.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return `Entre las ${minStr} y ${maxStr} hs`;
  }, [stop, isImmediateNext, distanceKm, pendingBeforeCount]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleContactWhatsApp = () => {
    if (!stop) return;
    const phone = vehicle?.driverPhone || matchedClient?.phone || '';
    const cleanPhone = phone ? formatWhatsAppPhone(phone) : '';
    const text = `¡Hola! Estoy siguiendo mi pedido a nombre de *${stop.name}* (${stop.address}). Quería consultar sobre el estado de la entrega.`;
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Custom Leaflet Icons for Customer View
  const destinationIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-destination-icon',
      html: `
        <div class="relative flex items-center justify-center" style="width: 48px; height: 48px;">
          <div class="absolute w-12 h-12 bg-purple-500 rounded-full opacity-40 animate-ping"></div>
          <div class="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xl text-white font-black">
            <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  }, []);

  const truckIcon = useMemo(() => {
    const rot = vehicleTelemetry?.heading || 0;
    const color = vehicle?.color || '#3b82f6';
    return L.divIcon({
      className: 'custom-truck-icon',
      html: `
        <div class="relative flex items-center justify-center" style="width: 48px; height: 48px;">
          <div class="absolute w-11 h-11 rounded-full opacity-40 animate-ping" style="background-color: ${color}"></div>
          <div class="w-10 h-10 rounded-2xl border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xl text-white" style="background-color: ${color}; transform: rotate(${rot}deg);">
            <svg class="w-5 h-5 fill-none stroke-white stroke-2" viewBox="0 0 24 24"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 18a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm11 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  }, [vehicleTelemetry?.heading, vehicle?.color]);

  // Loading State
  if (!stop) {
    return (
      <div className={`min-h-screen ${darkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 text-center transition-colors`}>
        <div className="max-w-md w-full glass p-8 rounded-3xl border shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black">Buscando tu pedido...</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Si el pedido ya fue entregado y archivado o el enlace es incorrecto, comunícate con atención al cliente.
          </p>
          {onExit && (
            <button
              onClick={onExit}
              className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all cursor-pointer"
            >
              Volver al Inicio
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col transition-colors selection:bg-purple-500 selection:text-white`}>
      {/* Top Header */}
      <header className="sticky top-0 z-30 glass backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-sm sm:text-base leading-tight tracking-tight flex items-center gap-1.5">
              <span>Optirutas</span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                En Vivo
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Seguimiento de entrega
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Share / Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition-colors cursor-pointer"
            title="Copiar enlace de seguimiento"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode(prev => !prev)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition-colors cursor-pointer"
            title="Alternar tema claro / oscuro"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* Main Tracking Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Hero Status Card */}
        <div className="glass rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          {/* Accent top banner */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${
            stop.completed 
              ? 'bg-emerald-500' 
              : stop.arrivedAt 
                ? 'bg-purple-500 animate-pulse'
                : isImmediateNext 
                  ? 'bg-blue-500' 
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600'
          }`} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                stop.completed 
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : stop.arrivedAt 
                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 animate-pulse'
                    : isImmediateNext 
                      ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}>
                {stop.completed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>¡Entregado con éxito!</span>
                  </>
                ) : stop.arrivedAt ? (
                  <>
                    <Timer className="w-3.5 h-3.5" />
                    <span>¡Repartidor en tu puerta!</span>
                  </>
                ) : isImmediateNext ? (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>¡Tu pedido es el próximo!</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>En Reparto • Parada #{stop.orderIndex}</span>
                  </>
                )}
              </span>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white pt-1">
                {stop.completed 
                  ? '¡Gracias por recibir tu pedido!' 
                  : stop.arrivedAt
                    ? 'El chofer está atendiendo tu entrega'
                    : isImmediateNext 
                      ? 'El repartidor va camino a tu domicilio' 
                      : `En ruta para hoy ${stop.deliveryDay}`}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
                Destinatario: <strong className="text-slate-900 dark:text-white">{stop.name}</strong> • {stop.address}
              </p>
            </div>

            {/* Estimated Arrival Badge */}
            <div className="bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl flex-shrink-0 text-center sm:text-right space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                {stop.completed ? 'Hora de Entrega' : 'Estimación de Llegada'}
              </span>
              <p className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                {etaWindowText}
              </p>
              {!stop.completed && pendingBeforeCount > 0 && (
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {pendingBeforeCount} entrega(s) antes de la tuya
                </p>
              )}
            </div>
          </div>

          {/* Delivery Timeline Steps */}
          <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {/* Step 1: Programado */}
              <div className="space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/30">
                  ✓
                </div>
                <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">Programado</span>
              </div>

              {/* Step 2: En Ruta */}
              <div className="space-y-1.5 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${
                  stop.completed || stop.arrivedAt || isImmediateNext || totalRouteStops > 0
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  ✓
                </div>
                <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">En Ruta</span>
              </div>

              {/* Step 3: Próxima Parada */}
              <div className="space-y-1.5 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${
                  stop.completed
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                    : isImmediateNext || stop.arrivedAt
                      ? 'bg-blue-600 text-white shadow-blue-500/40 ring-4 ring-blue-500/20 animate-pulse'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  {stop.completed ? '✓' : '3'}
                </div>
                <span className={`font-bold text-[11px] ${isImmediateNext || stop.arrivedAt ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                  Próxima
                </span>
              </div>

              {/* Step 4: Entregado */}
              <div className="space-y-1.5 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${
                  stop.completed
                    ? 'bg-emerald-500 text-white shadow-emerald-500/40 ring-4 ring-emerald-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  {stop.completed ? '✓' : '4'}
                </div>
                <span className={`font-bold text-[11px] ${stop.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  Entregado
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Interactive Map Card */}
        {stop.latitude !== 0 && stop.longitude !== 0 && (
          <div className="glass rounded-3xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xl space-y-0">
            <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                  Ubicación de tu Entrega
                </h3>
              </div>

              {/* Telemetry Indicator */}
              {vehicleCoords ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span>GPS Móvil en Vivo</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-400">
                  {vehicle ? `Móvil: ${vehicle.name}` : 'Móvil en recorrido'}
                </span>
              )}
            </div>

            {/* Leaflet Map Frame */}
            <div className="h-[320px] sm:h-[400px] w-full relative">
              <MapContainer
                center={[stop.latitude, stop.longitude]}
                zoom={15}
                scrollWheelZoom={false}
                className="w-full h-full z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapBoundsFitter 
                  customerCoords={[stop.latitude, stop.longitude]}
                  vehicleCoords={vehicleCoords}
                />

                {/* Customer Destination Pin */}
                <Marker position={[stop.latitude, stop.longitude]} icon={destinationIcon}>
                  <Popup>
                    <div className="p-1 text-slate-900 text-xs">
                      <p className="font-black text-sm">{stop.name}</p>
                      <p className="text-slate-600">{stop.address}</p>
                      <span className="text-[10px] font-bold text-purple-600">📍 Tu Domicilio</span>
                    </div>
                  </Popup>
                </Marker>

                {/* Delivery Vehicle Marker if GPS telemetry is alive */}
                {vehicleCoords && (
                  <Marker position={vehicleCoords} icon={truckIcon}>
                    <Popup>
                      <div className="p-1 text-slate-900 text-xs">
                        <p className="font-black text-sm">🚚 {vehicle?.name || 'Móvil de Reparto'}</p>
                        <p className="text-slate-600">Chofer: {vehicle?.driverName || 'Equipo Optirutas'}</p>
                        {distanceKm !== null && (
                          <p className="font-bold text-emerald-600 text-[11px] mt-0.5">
                            Distancia: ~{distanceKm.toFixed(1)} km
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Direct Line between Vehicle and Customer */}
                {vehicleCoords && (
                  <Polyline
                    positions={[vehicleCoords, [stop.latitude, stop.longitude]]}
                    color="#6366f1"
                    dashArray="6, 8"
                    weight={3}
                    opacity={0.8}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        )}

        {/* Order Details & Vehicle Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Vehicle & Driver Card */}
          <div className="glass p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
              Datos del Reparto
            </span>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-md"
                style={{ backgroundColor: vehicle?.color || '#6366f1' }}
              >
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-sm text-slate-900 dark:text-white">
                  {vehicle?.name || 'Unidad de Reparto'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Chofer: {vehicle?.driverName || 'Personal Autorizado'}
                </p>
                {vehicle?.plate && (
                  <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {vehicle.plate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* WhatsApp Support Assistance */}
          <div className="glass p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-2">
            <div>
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                ¿Dudas o necesitas coordinar?
              </span>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                Puedes comunicarte por WhatsApp directamente para indicar referencias de tu domicilio o consultar el horario.
              </p>
            </div>

            <button
              type="button"
              onClick={handleContactWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs py-2.5 px-4 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer m3-surface-interactive"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Consultar por WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">
          <p>Optirutas • Sistema Inteligente de Navegación y Logística en Tiempo Real</p>
        </footer>
      </main>
    </div>
  );
};
export default CustomerTrackingView;
