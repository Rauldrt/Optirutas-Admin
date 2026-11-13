import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  updateStop, 
  updateVehicleTelemetry, 
  updateVehicle, 
  addHistory,
  type Vehicle, 
  type Stop 
} from '../services/firestore';
import { useGeolocation } from '../hooks/useGeolocation';
import { getCurrentDayNameEs, calculateDistanceKm } from '../utils/geo';
import { MapView } from './MapContainer';
import { 
  Truck, 
  MapPin, 
  ExternalLink, 
  CheckCircle2, 
  Navigation, 
  LogOut, 
  Radio, 
  ListOrdered, 
  Gauge,
  MessageCircle
} from 'lucide-react';

interface DriverViewProps {
  vehicle: Vehicle;
  stops: Stop[];
  onLogout: () => void;
}

export const DriverView: React.FC<DriverViewProps> = ({ vehicle, stops, onLogout }) => {
  const todayName = getCurrentDayNameEs();
  const [isOnDuty, setIsOnDuty] = useState<boolean>(true);
  const [activeNavStop, setActiveNavStop] = useState<Stop | null>(null);
  const [showFullQueue, setShowFullQueue] = useState<boolean>(false);
  const lastTelemetrySendRef = useRef<number>(0);

  // GPS tracking hook
  const {
    coords: userCoords,
    heading,
    speedKmH,
    accuracy,
    startTracking,
    stopTracking
  } = useGeolocation();

  // Start GPS tracking on mount if on duty
  useEffect(() => {
    if (isOnDuty) {
      startTracking();
      // Update vehicle status in Firestore to 'on_route'
      updateVehicle(vehicle.id, { status: 'on_route' }).catch(() => {});
    } else {
      stopTracking();
      updateVehicle(vehicle.id, { status: 'available' }).catch(() => {});
    }
  }, [isOnDuty, startTracking, stopTracking, vehicle.id]);

  // Periodic Telemetry Transmission to Firestore (every 8 seconds when moving or position updates)
  useEffect(() => {
    if (!isOnDuty || !userCoords) return;

    const now = Date.now();
    // Throttle: send at most once every 8 seconds
    if (now - lastTelemetrySendRef.current >= 8000) {
      lastTelemetrySendRef.current = now;
      updateVehicleTelemetry(vehicle.id, {
        lat: userCoords[0],
        lng: userCoords[1],
        heading: heading !== null ? heading : undefined,
        speed: speedKmH !== null ? speedKmH : undefined,
        updatedAt: now
      });
    }
  }, [userCoords, heading, speedKmH, isOnDuty, vehicle.id]);

  // Filter today's stops assigned to this vehicle
  const driverStops = useMemo(() => {
    return stops
      .filter(s => 
        s.deliveryDay.toLowerCase() === todayName.toLowerCase() && 
        s.vehicleId === vehicle.id
      )
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [stops, todayName, vehicle.id]);

  const completedCount = driverStops.filter(s => s.completed).length;
  const totalCount = driverStops.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // The primary current stop is either the activeNavStop or the first pending stop in sequence
  const currentStop = useMemo(() => {
    if (activeNavStop && !activeNavStop.completed) return activeNavStop;
    return driverStops.find(s => !s.completed) || null;
  }, [activeNavStop, driverStops]);

  // Calculate distance to current stop
  const distanceToCurrentStopKm = useMemo(() => {
    if (!currentStop || !userCoords || currentStop.latitude === 0 || currentStop.longitude === 0) {
      return null;
    }
    return calculateDistanceKm(
      userCoords[0],
      userCoords[1],
      currentStop.latitude,
      currentStop.longitude
    );
  }, [currentStop, userCoords]);

  const handleCompleteStop = async (stopId: string) => {
    try {
      await updateStop(stopId, {
        completed: true,
        completedAt: Date.now()
      });

      // Vibration notification on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 150]);
      }

      // Automatically advance to next pending stop
      const remainingPending = driverStops.filter(s => s.id !== stopId && !s.completed);
      if (remainingPending.length > 0) {
        setActiveNavStop(remainingPending[0]);
      } else {
        setActiveNavStop(null);
        alert('🎉 ¡Excelente trabajo! Has completado todas las entregas asignadas para hoy.');
      }
    } catch (err) {
      console.error('Error completando parada:', err);
      alert('Error al marcar entrega.');
    }
  };

  const handleStartNavigation = (stop: Stop) => {
    setActiveNavStop(stop);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEndNavigation = () => {
    setActiveNavStop(null);
  };

  const [isClosingShift, setIsClosingShift] = useState(false);

  const handleShiftClosure = async () => {
    const completed = driverStops.filter(s => s.completed);
    const pending = driverStops.filter(s => !s.completed);
    const summaryText = completed.map(s => s.name).join(', ') || 'Sin entregas completadas';

    if (!window.confirm(`¿Deseas cerrar la jornada de hoy (${todayName}) y generar el reporte de ${completed.length} entrega(s)?`)) {
      return;
    }

    setIsClosingShift(true);
    try {
      // 1. Save to Firestore RouteHistory
      await addHistory({
        dateMillis: Date.now(),
        day: todayName,
        stopsCount: completed.length,
        stopsSummary: summaryText,
        driverName: vehicle.driverName,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        duration: 'Jornada Chofer Finalizada',
      });

      // 2. Format WhatsApp report
      const msg = [
        `📋 *Reporte de Cierre de Jornada - Optirutas*`,
        `🚚 *Móvil:* ${vehicle.name} ${vehicle.plate ? `(${vehicle.plate})` : ''}`,
        `👤 *Chofer:* ${vehicle.driverName}`,
        `📅 *Fecha:* ${todayName}, ${new Date().toLocaleDateString('es-ES')}`,
        `✅ *Entregas Realizadas:* ${completed.length} de ${driverStops.length} (${progressPercent}%)`,
        pending.length > 0 
          ? `⚠️ *Pendientes:* ${pending.map(s => s.name).join(', ')}` 
          : `🎉 *Estado:* ¡Todas las entregas completadas con éxito!`,
        `⏱️ *Hora:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      ].join('\n');

      // 3. Stop GPS and update status
      setIsOnDuty(false);
      await updateVehicle(vehicle.id, { status: 'available' });

      // 4. Open WhatsApp
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      alert('✅ Jornada cerrada con éxito y archivada en el historial. Se abrió WhatsApp para enviar el reporte.');
    } catch (err) {
      console.error('Error cerrando jornada:', err);
      alert('Error al cerrar jornada.');
    } finally {
      setIsClosingShift(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Top Driver Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md flex items-center justify-between gap-3">
        {/* Vehicle Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg"
            style={{ backgroundColor: vehicle.color }}
          >
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white truncate flex items-center gap-1.5">
              <span>{vehicle.name}</span>
              {vehicle.plate && (
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                  {vehicle.plate}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {vehicle.driverName} • <span className="text-purple-400 font-semibold">{todayName}</span>
            </p>
          </div>
        </div>

        {/* Telemetry & Duty Switch */}
        <div className="flex items-center gap-2">
          {/* Duty Switch Button */}
          <button
            type="button"
            onClick={() => setIsOnDuty(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              isOnDuty 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
            title="Activa o pausa la transmisión GPS en vivo para administración"
          >
            <Radio className={`w-3.5 h-3.5 ${isOnDuty ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{isOnDuty ? 'GPS En Vivo' : 'En Pausa'}</span>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="Cerrar Sesión del Móvil"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-3 sm:p-5 max-w-4xl w-full mx-auto space-y-4">
        {/* GPS Live Telemetry Pill */}
        {isOnDuty && userCoords && (
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800/80 rounded-2xl px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Transmitiendo posición satelital</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
              {speedKmH !== null && (
                <span className="flex items-center gap-1 text-slate-200 font-bold">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  <span>{speedKmH} km/h</span>
                </span>
              )}
              {accuracy !== null && (
                <span>Precisión: ±{accuracy}m</span>
              )}
            </div>
          </div>
        )}

        {/* Route Progress Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <ListOrdered className="w-4 h-4 text-purple-400" />
              <span>Progreso del Día ({todayName})</span>
            </span>
            <span className="text-purple-400 font-extrabold text-sm">
              {completedCount} / {totalCount} ({progressPercent}%)
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Current Stop Hero Card (Distraction-Free) */}
        {currentStop ? (
          <div className="bg-gradient-to-b from-slate-900 to-slate-925 border-2 border-purple-500/30 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
            {/* Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500" />

            <div className="flex items-start justify-between gap-3 pt-1">
              <div>
                <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full text-xs font-black">
                  <span>Próxima Entrega • #{currentStop.orderIndex}</span>
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1 leading-tight">
                  {currentStop.name}
                </h2>
              </div>

              {distanceToCurrentStopKm !== null && (
                <div className="text-right flex-shrink-0 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Distancia</p>
                  <p className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                    {distanceToCurrentStopKm < 1 
                      ? `${Math.round(distanceToCurrentStopKm * 1000)} m` 
                      : `${distanceToCurrentStopKm.toFixed(1)} km`}
                  </p>
                </div>
              )}
            </div>

            {/* Address */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-slate-200 leading-snug">
                {currentStop.address}
              </p>
            </div>

            {/* External Navigation & Contact Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold">
              {/* Google Maps / Waze External App */}
              <a
                href={currentStop.mapLink || `https://www.google.com/maps/dir/?api=1&destination=${currentStop.latitude},${currentStop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-1 bg-slate-800 hover:bg-slate-700 text-slate-100 py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <ExternalLink className="w-4 h-4 text-blue-400" />
                <span>Google Maps</span>
              </a>

              {/* In-App Turn-by-Turn Navigation */}
              <button
                type="button"
                onClick={() => handleStartNavigation(currentStop)}
                className="col-span-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 px-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                <span>Navegar In-App</span>
              </button>

              {/* Toggle Queue View on Mobile */}
              <button
                type="button"
                onClick={() => setShowFullQueue(prev => !prev)}
                className="col-span-2 sm:col-span-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-800"
              >
                <ListOrdered className="w-4 h-4 text-purple-400" />
                <span>{showFullQueue ? 'Ocultar Lista' : `Ver Lista (${driverStops.length})`}</span>
              </button>
            </div>

            {/* Huge Touch Action Button: Confirm Delivery */}
            <button
              type="button"
              onClick={() => handleCompleteStop(currentStop.id)}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base sm:text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-6 h-6 text-white" />
              <span>✓ Confirmar Entrega y Siguiente</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">
              {totalCount > 0 ? '¡Ruta de hoy completada!' : 'Sin paradas asignadas para hoy'}
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {totalCount > 0
                ? `Has completado exitosamente las ${totalCount} paradas programadas para este móvil.`
                : `No tienes clientes o entregas cargadas para ${todayName}. Consulta con administración o disfruta tu jornada.`}
            </p>

            {totalCount > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleShiftClosure}
                  disabled={isClosingShift}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3.5 rounded-2xl text-sm font-black shadow-xl shadow-emerald-600/30 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>{isClosingShift ? 'Archivando...' : 'Archivar y Enviar Reporte por WhatsApp'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Map View Embedded in Driver Screen */}
        <div className="h-[360px] sm:h-[450px] rounded-3xl overflow-hidden border border-slate-800 shadow-xl relative">
          <MapView 
            stops={driverStops} 
            clients={[]} 
            vehicles={[vehicle]}
            activeTab="stops"
            selectedDayLabel={todayName}
            activeNavStop={activeNavStop}
            onStartNavigation={handleStartNavigation}
            onEndNavigation={handleEndNavigation}
            onCompleteAndNextStop={handleCompleteStop}
          />
        </div>

        {/* Full Delivery Queue List (Collapsible or visible) */}
        {showFullQueue && driverStops.length > 0 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-purple-400" />
                <span>Todas las Paradas de Hoy ({driverStops.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFullQueue(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto pr-1">
              {driverStops.map((stop) => (
                <div
                  key={stop.id}
                  className={`py-3 flex items-center justify-between gap-3 ${
                    stop.completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        stop.completed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : currentStop?.id === stop.id
                            ? 'bg-purple-600 text-white font-black animate-pulse'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {stop.completed ? '✓' : stop.orderIndex}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${stop.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                        {stop.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {stop.address}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!stop.completed && (
                      <button
                        type="button"
                        onClick={() => handleStartNavigation(stop)}
                        className="px-2.5 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-[11px] font-bold cursor-pointer"
                      >
                        Navegar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
