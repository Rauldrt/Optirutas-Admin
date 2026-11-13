import React, { useMemo } from 'react';
import { CheckCircle2, AlertCircle, Users, Timer, Truck, Route } from 'lucide-react';
import type { Stop, Client, Vehicle } from '../services/firestore';
import { calculateRouteDistanceKm } from '../utils/geo';

interface StatsGridProps {
  stops: Stop[];
  clients: Client[];
  vehicles?: Vehicle[];
  selectedDay?: string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stops, clients, vehicles = [], selectedDay }) => {
  const totalStops = stops.length;
  const completedStops = stops.filter(s => s.completed).length;
  const pendingStops = totalStops - completedStops;
  const completionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  // Calculate total distance of active route
  const totalDistanceKm = calculateRouteDistanceKm(stops);

  // Calculate average transit time between completed stops
  const completedWithTime = [...stops]
    .filter(s => s.completed && s.completedAt)
    .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

  let avgMinutesPerStop = 0;
  if (completedWithTime.length >= 2) {
    const first = completedWithTime[0].completedAt!;
    const last = completedWithTime[completedWithTime.length - 1].completedAt!;
    const totalMinutes = (last - first) / 60000;
    avgMinutesPerStop = Math.max(1, Math.round(totalMinutes / (completedWithTime.length - 1)));
  }

  // Estimate remaining time (use real average if available, otherwise ~15 min per pending stop)
  const paceMinutes = avgMinutesPerStop > 0 ? avgMinutesPerStop : 15;
  const estimatedRemainingMins = pendingStops * paceMinutes;
  const formatEta = (mins: number) => {
    if (mins <= 0) return 'Ruta finalizada';
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `~${h}h ${m}m restantes`;
    }
    return `~${mins} min restantes`;
  };

  const stats = [
    {
      name: 'Progreso de Ruta',
      value: `${completedStops}/${totalStops}`,
      subtext: `${completionRate}% completado (${totalDistanceKm.toFixed(1)} km)`,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      shadowColor: 'shadow-emerald-500/20',
      progress: completionRate
    },
    {
      name: 'Paradas Pendientes',
      value: pendingStops.toString(),
      subtext: totalStops === 0 ? 'Sin entregas activas' : formatEta(estimatedRemainingMins),
      icon: AlertCircle,
      color: 'from-amber-500 to-orange-600',
      shadowColor: 'shadow-amber-500/20',
      progress: totalStops > 0 ? Math.round((pendingStops / totalStops) * 100) : 0
    },
    {
      name: 'Ritmo de Entrega',
      value: avgMinutesPerStop > 0 ? `${avgMinutesPerStop} min` : (completedStops > 0 ? 'En curso' : '—'),
      subtext: avgMinutesPerStop > 0 ? 'Promedio entre paradas' : 'Requiere 2+ entregas con hora',
      icon: Timer,
      color: 'from-purple-500 to-pink-600',
      shadowColor: 'shadow-purple-500/20',
    },
    {
      name: 'Clientes Registrados',
      value: clients.length.toString(),
      subtext: 'Directorio activo y geocodificado',
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      shadowColor: 'shadow-blue-500/20',
    }
  ];

  // Fleet performance per vehicle
  const fleetPerformance = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    return vehicles.map(v => {
      const vStops = stops.filter(s => s.vehicleId === v.id);
      const vTotal = vStops.length;
      const vCompleted = vStops.filter(s => s.completed).length;
      const vPending = vTotal - vCompleted;
      const vPercent = vTotal > 0 ? Math.round((vCompleted / vTotal) * 100) : 0;
      const vKm = calculateRouteDistanceKm(vStops);
      return {
        vehicle: v,
        total: vTotal,
        completed: vCompleted,
        pending: vPending,
        percent: vPercent,
        distanceKm: vKm,
      };
    });
  }, [vehicles, stops]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div 
              key={idx} 
              className="relative overflow-hidden glass rounded-3xl p-6 border shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
            >
              {/* Background Glow */}
              <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-xl group-hover:scale-125 transition-transform duration-500`} />
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {stat.name}
                </span>
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.color} text-white shadow-lg ${stat.shadowColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {stat.value}
                </span>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
                  {stat.subtext}
                </span>
              </div>

              {/* Optional Progress Bar */}
              {stat.progress !== undefined && (
                <div className="mt-4 w-full h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${stat.color} rounded-full transition-all duration-1000 ease-out`} 
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fleet Performance & Progress Breakdown */}
      {fleetPerformance.length > 0 && (
        <div className="glass rounded-3xl p-5 sm:p-6 border shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  Rendimiento y Avance de la Flota
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Desglose operativo por móvil {selectedDay ? `• ${selectedDay}` : ''}
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              {vehicles.length} Móvil(es) activos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {fleetPerformance.map(({ vehicle, total, completed, pending, percent, distanceKm }) => {
              const isMoving = (vehicle.telemetry?.speed || 0) > 3;
              const isOnline = vehicle.telemetry?.updatedAt && (Date.now() - vehicle.telemetry.updatedAt < 1000 * 60 * 15);

              return (
                <div 
                  key={vehicle.id}
                  className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 p-4 space-y-3 relative overflow-hidden"
                >
                  {/* Top accent line */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: vehicle.color }}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: vehicle.color }}
                      >
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate leading-tight">
                          {vehicle.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {vehicle.driverName}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${
                      isOnline
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                      <span>{isOnline ? (isMoving ? `${vehicle.telemetry?.speed} km/h` : 'En vivo') : 'Desconectado'}</span>
                    </span>
                  </div>

                  {/* Progress & KPIs */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {completed}/{total} entregadas
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white" style={{ color: vehicle.color }}>
                        {percent}%
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700"
                        style={{ 
                          width: `${percent}%`,
                          backgroundColor: vehicle.color 
                        }}
                      />
                    </div>
                  </div>

                  {/* Distance & pending footer */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 font-medium">
                    <span className="flex items-center gap-1">
                      <Route className="w-3 h-3 text-slate-400" />
                      <span>{distanceKm > 0 ? `${distanceKm.toFixed(1)} km est.` : '0 km'}</span>
                    </span>
                    <span>
                      {pending > 0 ? `${pending} pendiente(s)` : total > 0 ? '✓ Completado' : 'Sin paradas'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
