import React, { useState } from 'react';
import { Calendar, User, Clock, Route, Trash2, Plus, RotateCcw, Download, Search, X } from 'lucide-react';
import { addHistory, deleteHistory, addStop, type RouteHistory, type Client, type Stop } from '../services/firestore';
import { getCurrentDayNameEs, smartSearchMatch, computeOptimizedStopOrder } from '../utils/geo';

interface TripHistoryProps {
  history: RouteHistory[];
  clients?: Client[];
  stops?: Stop[];
  onSwitchToStopsTab?: (day: string) => void;
}

export const TripHistory: React.FC<TripHistoryProps> = ({ 
  history, 
  clients = [], 
  stops = [],
  onSwitchToStopsTab 
}) => {
  const todayName = getCurrentDayNameEs();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  
  // Test Log Form State
  const [day, setDay] = useState(todayName);
  const [stopsCount, setStopsCount] = useState('');
  const [stopsSummary, setStopsSummary] = useState('');
  const [driverName, setDriverName] = useState('');
  const [duration, setDuration] = useState('');

  const formatDate = (millis: number) => {
    const date = new Date(millis);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Smart flexible search across summary, driver, day, and formatted date
  const filteredHistory = history.filter(item =>
    smartSearchMatch(
      searchTerm,
      item.stopsSummary,
      item.driverName,
      item.day,
      formatDate(item.dateMillis)
    )
  );

  const totalDeliveriesLogged = history.reduce((sum, item) => sum + (item.stopsCount || 0), 0);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este registro del historial?')) {
      try {
        await deleteHistory(id);
      } catch (err) {
        alert('Error al eliminar el registro');
      }
    }
  };

  // Re-load stops from a historical trip using ClientDirectory matches and propose optimal order
  const handleRepeatRoute = async (item: RouteHistory) => {
    const stopNames = item.stopsSummary
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (stopNames.length === 0) {
      alert('Este registro no contiene nombres de paradas para repetir.');
      return;
    }

    const targetDay = item.day && item.day !== 'Varios' ? item.day : todayName;
    if (!window.confirm(`¿Quieres volver a cargar ${stopNames.length} parada(s) como pendientes para el día ${targetDay}?`)) {
      return;
    }

    setReloadingId(item.id);
    try {
      const existingForDay = stops.filter(
        s => s.deliveryDay.toLowerCase() === targetDay.toLowerCase()
      );
      let nextOrder = existingForDay.length > 0
        ? Math.max(...existingForDay.map(s => s.orderIndex)) + 1
        : 1;

      const draftStops: Stop[] = stopNames.map((rawName, idx) => {
        const matchedClient = clients.find(c =>
          smartSearchMatch(rawName, c.name)
        );
        return {
          id: `temp-${idx}`,
          name: matchedClient ? matchedClient.name : rawName,
          address: matchedClient ? matchedClient.address : 'Dirección pendiente de verificar',
          latitude: matchedClient ? matchedClient.latitude : -34.6037,
          longitude: matchedClient ? matchedClient.longitude : -58.3816,
          completed: false,
          orderIndex: idx + 1,
          deliveryDay: targetDay,
          mapLink: matchedClient?.mapLink || '',
        };
      });

      const orderedDrafts = draftStops.length > 2 ? computeOptimizedStopOrder(draftStops) : draftStops;

      for (const s of orderedDrafts) {
        await addStop({
          name: s.name,
          address: s.address,
          latitude: s.latitude,
          longitude: s.longitude,
          completed: false,
          orderIndex: nextOrder++,
          deliveryDay: targetDay,
          mapLink: s.mapLink || '',
        });
      }

      if (onSwitchToStopsTab) {
        onSwitchToStopsTab(targetDay);
      }
    } catch (err) {
      console.error(err);
      alert('Error al repetir la ruta.');
    } finally {
      setReloadingId(null);
    }
  };

  const handleExportHistoryCSV = () => {
    if (filteredHistory.length === 0) return;
    const headers = ['Fecha', 'Dia', 'Chofer', 'Duracion', 'Cantidad Entregas', 'Resumen de Paradas'];
    const rows = filteredHistory.map(item => [
      `"${formatDate(item.dateMillis)}"`,
      item.day,
      `"${(item.driverName || 'N/A').replace(/"/g, '""')}"`,
      `"${(item.duration || 'N/A').replace(/"/g, '""')}"`,
      item.stopsCount,
      `"${item.stopsSummary.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_rutas_optirutas.csv`;
    link.click();
  };

  const handleAddTestLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopsCount || !stopsSummary) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    try {
      await addHistory({
        dateMillis: Date.now(),
        day,
        stopsCount: parseInt(stopsCount),
        stopsSummary,
        driverName: driverName || 'Repartidor Web',
        duration: duration || '3h 15m',
      });
      setIsModalOpen(false);
      setStopsCount('');
      setStopsSummary('');
      setDriverName('');
      setDuration('');
    } catch (err) {
      alert('Error al agregar registro de prueba');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass p-6 rounded-3xl border shadow-lg">
        <div>
          <h2 className="font-extrabold text-lg tracking-tight">Historial de Viajes</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {history.length} recorridos archivados • {totalDeliveriesLogged} entregas totales registradas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Smart Search Input */}
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Búsqueda inteligente (chofer, día, fecha, cliente)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-10 pr-8 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredHistory.length > 0 && (
            <button
              onClick={handleExportHistoryCSV}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Exportar bitácora a CSV"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          )}

          {/* Button to simulate completed route from admin panel for testing */}
          <button
            onClick={() => {
              setDay(todayName);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Simular Entrega</span>
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="glass rounded-3xl border shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <h3 className="font-extrabold text-base tracking-tight">Bitácora de Rutas</h3>
          <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full font-bold">
            {filteredHistory.length} Viaje(s)
          </span>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40 text-purple-500" />
            <p className="font-semibold">No se encontraron viajes en el historial.</p>
            <p className="text-xs mt-1">Los viajes archivados o completados en la app de Android aparecerán aquí en tiempo real.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[550px] overflow-y-auto">
            {filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors"
              >
                {/* Left: Info */}
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                      <Route className="w-3.5 h-3.5" />
                      Ruta Completada
                    </span>
                    <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
                      {item.day}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">
                      {formatDate(item.dateMillis)}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {item.stopsSummary}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-500" />
                      Chofer: {item.driverName || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-500" />
                      Duración: {item.duration || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5 text-purple-500" />
                      Entregas: {item.stopsCount}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleRepeatRoute(item)}
                    disabled={reloadingId === item.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors cursor-pointer disabled:opacity-50"
                    title="Volver a cargar estas paradas como ruta activa (ordenadas por ubicación)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{reloadingId === item.id ? 'Cargando...' : 'Repetir Ruta'}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title="Eliminar del historial"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Test Log Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Simular Entrega Finalizada
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTestLog} className="p-6 space-y-4">
              {/* Day */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Día de la Ruta
                </label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                >
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                    <option key={d} value={d}>
                      {d} {d.toLowerCase() === todayName.toLowerCase() ? '(Hoy)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stops Count */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Cantidad de Paradas Entregadas
                </label>
                <input
                  type="number"
                  placeholder="Ej. 5"
                  value={stopsCount}
                  onChange={(e) => setStopsCount(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Resumen de la Ruta
                </label>
                <textarea
                  placeholder="Ej. Farmacia Central, Distribuidora Pasteur, Clínica del Sol"
                  value={stopsSummary}
                  onChange={(e) => setStopsSummary(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100 min-h-[100px]"
                  required
                />
              </div>

              {/* Driver & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Chofer (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Carlos Gómez"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Duración (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="2h 45m"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all"
                >
                  Guardar Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TripHistory;
