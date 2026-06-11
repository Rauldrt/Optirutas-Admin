import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, MapPin, 
  CheckSquare, Square, RefreshCw, X, Archive
} from 'lucide-react';
import { addStop, updateStop, deleteStop, addHistory, type Stop, type Client } from '../services/firestore';

interface StopListProps {
  stops: Stop[];
  clients: Client[];
  onSelectStop: (coords: [number, number]) => void;
}

export const StopList: React.FC<StopListProps> = ({ 
  stops, 
  clients,
  onSelectStop 
}) => {
  const [selectedDay, setSelectedDay] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [orderIndex, setOrderIndex] = useState('');
  const [deliveryDay, setDeliveryDay] = useState('Lunes');

  
  // Searchable Client Selector State
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Archive Route State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveDriverName, setArchiveDriverName] = useState('');
  const [archiveDuration, setArchiveDuration] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  // Filter stops by day
  const filteredStops = selectedDay === 'Todos' 
    ? stops 
    : stops.filter(stop => stop.deliveryDay.toLowerCase() === selectedDay.toLowerCase());

  // Sort stops by orderIndex
  const sortedStops = [...filteredStops].sort((a, b) => a.orderIndex - b.orderIndex);

  const daysOfWeek = ['Todos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Handle client selection to autofill stop fields
  const handleClientSelect = (clientId: string) => {

    const client = clients.find(c => c.id === clientId);
    if (client) {
      setName(client.name);
      setAddress(client.address);
      setLatitude(client.latitude.toString());
      setLongitude(client.longitude.toString());
    }
  };

  const openAddModal = () => {
    setEditingStop(null);
    setName('');
    setAddress('');
    setLatitude('');
    setLongitude('');
    setOrderIndex((stops.length + 1).toString());
    setDeliveryDay(selectedDay === 'Todos' ? 'Lunes' : selectedDay);

    setClientSearch('');
    setIsClientDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (stop: Stop) => {
    setEditingStop(stop);
    setName(stop.name);
    setAddress(stop.address);
    setLatitude(stop.latitude.toString());
    setLongitude(stop.longitude.toString());
    setOrderIndex(stop.orderIndex.toString());
    setDeliveryDay(stop.deliveryDay);

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !latitude || !longitude || !orderIndex) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    const stopData = {
      name,
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      completed: editingStop ? editingStop.completed : false,
      orderIndex: parseInt(orderIndex),
      deliveryDay,
    };

    try {
      if (editingStop) {
        await updateStop(editingStop.id, stopData);
      } else {
        await addStop(stopData);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Error guardando la parada');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar esta parada?')) {
      try {
        await deleteStop(id);
      } catch (err) {
        alert('Error al eliminar la parada');
      }
    }
  };

  const toggleCompleted = async (stop: Stop) => {
    try {
      await updateStop(stop.id, { completed: !stop.completed });
    } catch (err) {
      console.error(err);
    }
  };

  // Reordering helpers
  const moveStop = async (stop: Stop, direction: 'up' | 'down') => {
    const currentIndex = sortedStops.findIndex(s => s.id === stop.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedStops.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetStop = sortedStops[targetIndex];

    try {
      // Swap orderIndex
      await updateStop(stop.id, { orderIndex: targetStop.orderIndex });
      await updateStop(targetStop.id, { orderIndex: stop.orderIndex });
    } catch (err) {
      console.error(err);
    }
  };

  // Recalculate order indices sequentially to clean up any gaps
  const handleOptimizeIndices = async () => {
    try {
      for (let i = 0; i < sortedStops.length; i++) {
        const stop = sortedStops[i];
        if (stop.orderIndex !== i + 1) {
          await updateStop(stop.id, { orderIndex: i + 1 });
        }
      }
      alert('Índices de orden optimizados secuencialmente.');
    } catch (err) {
      alert('Error al optimizar los índices');
    }
  };

  // Archive route actions
  const completedStops = sortedStops.filter(stop => stop.completed);

  const openArchiveModal = () => {
    if (completedStops.length === 0) {
      alert('No hay paradas completadas para archivar.');
      return;
    }
    setArchiveDriverName('');
    setArchiveDuration('');
    setIsArchiveModalOpen(true);
  };

  const handleArchiveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (completedStops.length === 0) return;

    setIsArchiving(true);
    try {
      const summary = completedStops.map(s => s.name).join(', ');
      await addHistory({
        dateMillis: Date.now(),
        day: selectedDay === 'Todos' ? 'Varios' : selectedDay,
        stopsCount: completedStops.length,
        stopsSummary: summary,
        driverName: archiveDriverName.trim() || 'Repartidor',
        duration: archiveDuration.trim() || 'N/A',
      });

      // Delete completed stops
      for (const stop of completedStops) {
        await deleteStop(stop.id);
      }

      setIsArchiveModalOpen(false);
      alert('¡Ruta archivada en el historial con éxito!');
    } catch (err) {
      console.error('Error al archivar la ruta:', err);
      alert('Hubo un error al archivar la ruta.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Day Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass p-6 rounded-3xl border shadow-lg">
        {/* Day Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {daysOfWeek.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-300 ${
                selectedDay === day
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {sortedStops.length > 1 && (
            <button
              onClick={handleOptimizeIndices}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Re-ordenar índices del 1 al N secuencialmente"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Numerar Secuencial</span>
            </button>
          )}
          <button
            onClick={openArchiveModal}
            disabled={completedStops.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              completedStops.length > 0
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95 shadow-lg shadow-emerald-500/25 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200/50 dark:border-slate-800/50'
            }`}
            title={
              completedStops.length > 0 
                ? `Archivar ${completedStops.length} parada(s) completada(s)` 
                : 'No hay paradas completadas para archivar'
            }
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archivar ({completedStops.length})</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Parada</span>
          </button>
        </div>
      </div>

      {/* Stop List Grid */}
      <div className="glass rounded-3xl border shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <h2 className="font-extrabold text-lg tracking-tight">
            Paradas de {selectedDay === 'Todos' ? 'la Semana' : selectedDay}
          </h2>
          <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full font-bold">
            {sortedStops.length} Parada(s)
          </span>
        </div>

        {sortedStops.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-40 text-purple-500" />
            <p className="font-semibold">No hay paradas registradas para esta selección.</p>
            <p className="text-xs mt-1">Presiona "Añadir Parada" para crear una nueva entrega.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[550px] overflow-y-auto">
            {sortedStops.map((stop, idx) => (
              <div 
                key={stop.id} 
                className={`p-4 flex items-center justify-between gap-4 transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-900/10 ${
                  stop.completed ? 'bg-emerald-50/10 dark:bg-emerald-950/5' : ''
                }`}
              >
                {/* Left: Reordering & Completion Status */}
                <div className="flex items-center gap-3">
                  {/* Reordering Buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveStop(stop, 'up')}
                      disabled={idx === 0}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveStop(stop, 'down')}
                      disabled={idx === sortedStops.length - 1}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Complete Checkbox */}
                  <button 
                    onClick={() => toggleCompleted(stop)}
                    className="text-slate-500 hover:text-purple-600 transition-colors"
                  >
                    {stop.completed ? (
                      <CheckSquare className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Square className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                    )}
                  </button>

                  {/* Stop Information */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {stop.name}
                      </span>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Parada {stop.orderIndex}
                      </span>
                      {selectedDay === 'Todos' && (
                        <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {stop.deliveryDay}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {stop.address}
                    </p>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectStop([stop.latitude, stop.longitude])}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    title="Enfocar en mapa"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(stop)}
                    className="p-2 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(stop.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Stop Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {editingStop ? 'Editar Parada' : 'Añadir Nueva Parada'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Autofill from Clients Directory (only for adding stops) */}
              {!editingStop && clients.length > 0 && (
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Autocompletar desde Directorio de Clientes (Opcional)
                  </label>
                  
                  {/* Invisible overlay to close dropdown clicking outside */}
                  {isClientDropdownOpen && (
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsClientDropdownOpen(false)} 
                    />
                  )}

                  <div className="relative z-50">
                    <input
                      type="text"
                      placeholder="Buscar cliente por nombre o dirección..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    />
                    
                    {isClientDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800 z-50">
                        {(() => {
                          const filtered = clients.filter(c => 
                            c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                            c.address.toLowerCase().includes(clientSearch.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return (
                              <div className="p-3 text-xs text-slate-400 text-center">
                                No se encontraron clientes
                              </div>
                            );
                          }
                          return filtered.map(client => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                handleClientSelect(client.id);
                                setClientSearch(client.name);
                                setIsClientDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/20 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              <span className="font-bold block">{client.name}</span>
                              <span className="text-slate-450 dark:text-slate-500 block truncate">{client.address}</span>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stop Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Nombre de la Parada
                </label>
                <input
                  type="text"
                  placeholder="Ej. Farmacia Central, Local de Reparto..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  placeholder="Calle Falsa 123"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="-34.6037"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="-58.3816"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Order and Day */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Día de Entrega
                  </label>
                  <select
                    value={deliveryDay}
                    onChange={(e) => setDeliveryDay(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  >
                    {daysOfWeek.filter(d => d !== 'Todos').map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Índice de Orden
                  </label>
                  <input
                    type="number"
                    placeholder="1"
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    required
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
                  Guardar Parada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Route Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Archive className="w-5 h-5 text-emerald-500" />
                <span>Archivar Ruta en Historial</span>
              </h3>
              <button 
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
                disabled={isArchiving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleArchiveRoute} className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold mb-2">
                  Se archivarán {completedStops.length} paradas completadas del día: <span className="underline">{selectedDay === 'Todos' ? 'Varios (Semana)' : selectedDay}</span>
                </p>
                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 text-[11px] text-emerald-650 dark:text-emerald-400 font-semibold">
                  {completedStops.map(stop => (
                    <div key={stop.id} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="truncate">{stop.name} ({stop.address})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 p-3.5 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                ⚠️ <span className="font-extrabold">Atención:</span> Esta acción registrará el recorrido en el historial y <span className="underline">eliminará permanentemente</span> estas {completedStops.length} paradas de la lista de paradas activas.
              </div>

              {/* Driver Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Nombre del Chofer / Repartidor
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={archiveDriverName}
                  onChange={(e) => setArchiveDriverName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  disabled={isArchiving}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Duración del Recorrido (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. 2h 45m"
                  value={archiveDuration}
                  onChange={(e) => setArchiveDuration(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  disabled={isArchiving}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  disabled={isArchiving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isArchiving}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:opacity-95 shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isArchiving ? 'Archivando...' : 'Confirmar y Archivar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default StopList;
