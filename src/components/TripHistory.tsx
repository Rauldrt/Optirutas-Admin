import React, { useState } from 'react';
import { Calendar, User, Clock, Route, Trash2, Plus } from 'lucide-react';
import { addHistory, deleteHistory, type RouteHistory } from '../services/firestore';

interface TripHistoryProps {
  history: RouteHistory[];
}

export const TripHistory: React.FC<TripHistoryProps> = ({ history }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Test Log Form State
  const [day, setDay] = useState('Lunes');
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

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este registro del historial?')) {
      try {
        await deleteHistory(id);
      } catch (err) {
        alert('Error al eliminar el registro');
      }
    }
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
      // Reset form
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
            Registro y logs de las rutas completadas desde la aplicación móvil.
          </p>
        </div>
        
        {/* Button to simulate completed route from admin panel for testing */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Simular Entrega</span>
        </button>
      </div>

      {/* History List */}
      <div className="glass rounded-3xl border shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <h3 className="font-extrabold text-base tracking-tight">Bitácora de Rutas</h3>
          <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full font-bold">
            {history.length} Viaje(s)
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40 text-purple-500" />
            <p className="font-semibold">Historial vacío.</p>
            <p className="text-xs mt-1">Los viajes completados en la app de Android aparecerán aquí en tiempo real.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[550px] overflow-y-auto">
            {history.map((item) => (
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
                <div className="flex items-center self-end md:self-center">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
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
                <Trash2 className="w-5 h-5" />
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
                    <option key={d} value={d}>{d}</option>
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
                  placeholder="Ej. Se completó el recorrido entregando medicamentos a Farmacia Central, Farmacia Pasteur y 3 clientes adicionales sin demoras."
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
