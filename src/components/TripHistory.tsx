import React, { useState, useMemo } from 'react';
import { 
  Calendar, User, Clock, Route, Trash2, RotateCcw, 
  Download, Search, X, Truck, Printer, Archive, CheckCircle2 
} from 'lucide-react';
import { 
  addHistory, 
  deleteHistory, 
  addStop, 
  updateStop,
  type RouteHistory, 
  type Client, 
  type Stop, 
  type Vehicle 
} from '../services/firestore';
import { getCurrentDayNameEs, smartSearchMatch, computeOptimizedStopOrder } from '../utils/geo';

interface TripHistoryProps {
  history: RouteHistory[];
  clients?: Client[];
  stops?: Stop[];
  vehicles?: Vehicle[];
  onSwitchToStopsTab?: (day: string) => void;
}

export const TripHistory: React.FC<TripHistoryProps> = ({ 
  history, 
  clients = [], 
  stops = [],
  vehicles = [],
  onSwitchToStopsTab 
}) => {
  const todayName = getCurrentDayNameEs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [reloadingId, setReloadingId] = useState<string | null>(null);

  // Modals state
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printVehicleId, setPrintVehicleId] = useState<string>('all');
  const [printDay, setPrintDay] = useState<string>(todayName);

  // Archive Active Day Form State
  const [archiveDay, setArchiveDay] = useState(todayName);
  const [archiveVehicleId, setArchiveVehicleId] = useState('all');
  const [resetStopsAfterArchive, setResetStopsAfterArchive] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);

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

  // Smart search and vehicle filter
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = smartSearchMatch(
        searchTerm,
        item.stopsSummary,
        item.driverName,
        item.day,
        item.vehicleName,
        formatDate(item.dateMillis)
      );

      const matchesVehicle = selectedVehicleFilter === 'all' 
        || item.vehicleId === selectedVehicleFilter
        || (selectedVehicleFilter === 'unassigned' && !item.vehicleId);

      return matchesSearch && matchesVehicle;
    });
  }, [history, searchTerm, selectedVehicleFilter]);

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
          orderIndex: nextOrder + idx,
          deliveryDay: targetDay,
          vehicleId: item.vehicleId || undefined,
          vehicleName: item.vehicleName || undefined,
        };
      });

      // Optimize order automatically
      const optimizedDraft = computeOptimizedStopOrder(draftStops);

      for (let i = 0; i < optimizedDraft.length; i++) {
        const s = optimizedDraft[i];
        await addStop({
          name: s.name,
          address: s.address,
          latitude: s.latitude,
          longitude: s.longitude,
          completed: false,
          orderIndex: nextOrder + i,
          deliveryDay: targetDay,
          vehicleId: item.vehicleId || undefined,
          vehicleName: item.vehicleName || undefined,
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
    const headers = ['Fecha', 'Dia', 'Móvil', 'Chofer', 'Duracion', 'Cantidad Entregas', 'Resumen de Paradas'];
    const rows = filteredHistory.map(item => [
      `"${formatDate(item.dateMillis)}"`,
      item.day,
      `"${(item.vehicleName || 'Sin asignar').replace(/"/g, '""')}"`,
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

  // Archive real active stops from current day
  const handleArchiveDayStops = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsArchiving(true);

    try {
      // Filter stops for target day and optional vehicle
      const dayStops = stops.filter(s => {
        const matchesDay = s.deliveryDay.toLowerCase() === archiveDay.toLowerCase();
        const matchesVehicle = archiveVehicleId === 'all' || s.vehicleId === archiveVehicleId;
        return matchesDay && matchesVehicle;
      });

      if (dayStops.length === 0) {
        alert(`No hay paradas cargadas para ${archiveDay}${archiveVehicleId !== 'all' ? ' en este móvil' : ''}.`);
        setIsArchiving(false);
        return;
      }

      const completedStops = dayStops.filter(s => s.completed);
      const targetVehicle = vehicles.find(v => v.id === archiveVehicleId);

      // Build summary text
      const summaryText = completedStops.length > 0
        ? completedStops.map(s => s.name).join(', ')
        : dayStops.map(s => s.name).join(', ');

      // Save to Firestore History
      await addHistory({
        dateMillis: Date.now(),
        day: archiveDay,
        stopsCount: completedStops.length > 0 ? completedStops.length : dayStops.length,
        stopsSummary: summaryText,
        driverName: targetVehicle ? targetVehicle.driverName : 'Equipo de Reparto',
        vehicleId: targetVehicle ? targetVehicle.id : '',
        vehicleName: targetVehicle ? targetVehicle.name : 'Flota Completa',
        duration: 'Jornada Finalizada',
      });

      // Optionally reset completed stops to pending for next week
      if (resetStopsAfterArchive) {
        for (const s of completedStops) {
          await updateStop(s.id, {
            completed: false,
            completedAt: undefined
          });
        }
      }

      alert(`✅ ¡Jornada de ${archiveDay} archivada con éxito en el historial!`);
      setIsArchiveModalOpen(false);
    } catch (err) {
      console.error('Error al archivar jornada:', err);
      alert('Error al archivar jornada.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Stops filtered for printable delivery sheet
  const printableStops = useMemo(() => {
    return stops
      .filter(s => {
        const matchesDay = s.deliveryDay.toLowerCase() === printDay.toLowerCase();
        const matchesVehicle = printVehicleId === 'all' || s.vehicleId === printVehicleId;
        return matchesDay && matchesVehicle;
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [stops, printDay, printVehicleId]);

  const printableVehicle = vehicles.find(v => v.id === printVehicleId);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass p-6 rounded-3xl border shadow-lg">
        <div>
          <h2 className="font-extrabold text-lg tracking-tight">Historial y Archivo de Rutas</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {history.length} recorridos archivados • {totalDeliveriesLogged} entregas totales registradas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Smart Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar (chofer, móvil, día)..."
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

          {/* Vehicle Filter Dropdown */}
          {vehicles.length > 0 && (
            <select
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">Todos los móviles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.driverName})
                </option>
              ))}
              <option value="unassigned">Sin móvil asignado</option>
            </select>
          )}

          {/* Print Delivery Sheet Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Generar e imprimir hoja de ruta en papel o PDF"
          >
            <Printer className="w-4 h-4 text-purple-500" />
            <span className="hidden sm:inline">Hoja de Ruta</span>
          </button>

          {/* Export CSV */}
          {filteredHistory.length > 0 && (
            <button
              onClick={handleExportHistoryCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Exportar bitácora a CSV"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span>CSV</span>
            </button>
          )}

          {/* Archive Current Day Button */}
          <button
            onClick={() => {
              setArchiveDay(todayName);
              setIsArchiveModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/25 transition-all cursor-pointer"
            title="Archivar entregas del día actual en el historial"
          >
            <Archive className="w-4 h-4" />
            <span>Archivar Jornada</span>
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
            <p className="text-xs mt-1">Los viajes archivados o completados por los móviles aparecerán aquí en tiempo real.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[550px] overflow-y-auto">
            {filteredHistory.map((item) => {
              const matchedVehicle = item.vehicleId ? vehicles.find(v => v.id === item.vehicleId) : null;

              return (
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

                      {/* Vehicle Badge */}
                      {item.vehicleName && (
                        <span 
                          className="text-xs font-black px-2.5 py-0.5 rounded-full text-white shadow-sm flex items-center gap-1.5"
                          style={{ backgroundColor: matchedVehicle?.color || '#6366f1' }}
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{item.vehicleName}</span>
                        </span>
                      )}

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
              );
            })}
          </div>
        )}
      </div>

      {/* Archive Active Day Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Archivar Jornada en Historial
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Guarda la bitácora de entregas y resetea las paradas para la próxima semana.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleArchiveDayStops} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Día a Archivar
                </label>
                <select
                  value={archiveDay}
                  onChange={(e) => setArchiveDay(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                    <option key={d} value={d}>
                      {d} {d.toLowerCase() === todayName.toLowerCase() ? '(Hoy)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {vehicles.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Móvil / Vehículo
                  </label>
                  <select
                    value={archiveVehicleId}
                    onChange={(e) => setArchiveVehicleId(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">Todos los móviles (Jornada General)</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.driverName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset Checkbox */}
              <div className="flex items-center gap-3 p-3.5 bg-slate-100/60 dark:bg-slate-800/60 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="resetCheckbox"
                  checked={resetStopsAfterArchive}
                  onChange={(e) => setResetStopsAfterArchive(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="resetCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Reiniciar paradas completadas a "Pendiente" para el próximo ciclo
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isArchiving}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-purple-600/25 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isArchiving ? 'Archivando...' : 'Confirmar y Archivar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Delivery Sheet Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-600 text-white">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Hoja de Ruta de Entregas (Imprimible)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Planilla física para el chofer y comprobante de firmas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter toolbar inside print modal */}
            <div className="p-3 bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 dark:text-slate-300">Día:</span>
                <select
                  value={printDay}
                  onChange={(e) => setPrintDay(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 font-bold text-slate-800 dark:text-slate-200"
                >
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 dark:text-slate-300">Móvil:</span>
                <select
                  value={printVehicleId}
                  onChange={(e) => setPrintVehicleId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="all">Todos los móviles</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.driverName})</option>
                  ))}
                </select>
              </div>

              <span className="font-bold text-purple-600 dark:text-purple-400 ml-auto">
                {printableStops.length} parada(s) listadas
              </span>
            </div>

            {/* Printable Sheet Content (Target of Print CSS) */}
            <div id="printable-delivery-sheet" className="p-6 overflow-y-auto flex-1 bg-white text-slate-900 space-y-6">
              {/* Sheet Header */}
              <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    OPTIRUTAS • HOJA DE REPARTO
                  </h1>
                  <p className="text-xs text-slate-600 font-semibold mt-0.5">
                    Día: <b>{printDay}</b> • Fecha de Emisión: {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="text-right text-xs">
                  {printableVehicle ? (
                    <div>
                      <p className="font-black text-sm text-slate-900">{printableVehicle.name}</p>
                      <p className="text-slate-600">Chofer: <b>{printableVehicle.driverName}</b></p>
                      {printableVehicle.plate && <p className="text-slate-500 font-mono">Patente: {printableVehicle.plate}</p>}
                    </div>
                  ) : (
                    <p className="font-black text-sm text-slate-900">Flota Completa</p>
                  )}
                </div>
              </div>

              {/* Table of Deliveries */}
              {printableStops.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-bold text-sm">No hay paradas programadas para este filtro.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-700 bg-slate-100">
                      <th className="py-2 px-2 w-10 text-center">#</th>
                      <th className="py-2 px-3">Cliente / Destino</th>
                      <th className="py-2 px-3">Dirección</th>
                      <th className="py-2 px-3 w-28">Móvil</th>
                      <th className="py-2 px-3 w-24 text-center">Estado</th>
                      <th className="py-2 px-3 w-32 text-center">Firma / Recibió</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printableStops.map((stop) => {
                      const veh = vehicles.find(v => v.id === stop.vehicleId);
                      return (
                        <tr key={stop.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-2 text-center font-black text-sm text-slate-800">
                            {stop.orderIndex}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {stop.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {stop.address}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {veh ? `${veh.name}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                              stop.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {stop.completed ? 'Entregado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center border-b border-dashed border-slate-300">
                            {/* Empty space for physical signature */}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Sheet Footer with signatures */}
              <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto h-8" />
                  <p className="font-bold">Firma del Conductor / Despachante</p>
                </div>
                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto h-8" />
                  <p className="font-bold">Control de Salida / Administración</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
