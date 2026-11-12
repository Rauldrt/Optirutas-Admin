import React from 'react';
import { CheckCircle2, AlertCircle, Users, Timer } from 'lucide-react';
import type { Stop, Client } from '../services/firestore';
import { calculateRouteDistanceKm } from '../utils/geo';

interface StatsGridProps {
  stops: Stop[];
  clients: Client[];
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stops, clients }) => {
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

  return (
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
  );
};
