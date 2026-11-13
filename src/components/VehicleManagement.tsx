import React, { useState, useMemo } from 'react';
import { 
  Truck, Plus, Search, Edit2, Trash2, Phone, User, 
  MapPin, CheckCircle2, Wrench, X, 
  Calendar, MessageCircle, ShieldCheck,
  Share2, KeyRound, Radio, Copy, Check
} from 'lucide-react';
import { 
  addVehicle, 
  updateVehicle, 
  deleteVehicle, 
  type Vehicle, 
  type Stop 
} from '../services/firestore';
import { getCurrentDayNameEs } from '../utils/geo';

interface VehicleManagementProps {
  vehicles: Vehicle[];
  stops: Stop[];
  onSelectVehicleForRoute?: (vehicleId: string) => void;
}

const PRESET_COLORS = [
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Azul Eléctrico', hex: '#3b82f6' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Turquesa', hex: '#14b8a6' },
  { name: 'Ámbar', hex: '#f59e0b' },
  { name: 'Naranja', hex: '#f97316' },
  { name: 'Púrpura', hex: '#a855f7' },
  { name: 'Rosa Magenta', hex: '#ec4899' },
];

export const VehicleManagement: React.FC<VehicleManagementProps> = ({ 
  vehicles, 
  stops,
  onSelectVehicleForRoute 
}) => {
  const todayName = getCurrentDayNameEs();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Vehicle['status']>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [status, setStatus] = useState<Vehicle['status']>('available');
  const [capacity, setCapacity] = useState('');
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState('1234');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        v.name.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        (v.plate && v.plate.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, searchQuery, statusFilter]);

  // Compute fleet statistics
  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter(v => v.status === 'available').length;
    const onRoute = vehicles.filter(v => v.status === 'on_route').length;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;
    return { total, available, onRoute, maintenance };
  }, [vehicles]);

  // Count assigned stops for today per vehicle
  const stopsByVehicle = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; pending: number }> = {};
    const todayStops = stops.filter(s => s.deliveryDay.toLowerCase() === todayName.toLowerCase());

    for (const stop of todayStops) {
      if (stop.vehicleId) {
        if (!counts[stop.vehicleId]) {
          counts[stop.vehicleId] = { total: 0, completed: 0, pending: 0 };
        }
        counts[stop.vehicleId].total += 1;
        if (stop.completed) {
          counts[stop.vehicleId].completed += 1;
        } else {
          counts[stop.vehicleId].pending += 1;
        }
      }
    }
    return counts;
  }, [stops, todayName]);

  const openAddModal = () => {
    setEditingVehicle(null);
    setName(`Móvil ${vehicles.length + 1 < 10 ? '0' : ''}${vehicles.length + 1}`);
    setDriverName('');
    setDriverPhone('');
    setPlate('');
    setModel('');
    setColor(PRESET_COLORS[vehicles.length % PRESET_COLORS.length].hex);
    setStatus('available');
    setCapacity('');
    setNotes('');
    setPin('1234');
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setName(vehicle.name);
    setDriverName(vehicle.driverName);
    setDriverPhone(vehicle.driverPhone || '');
    setPlate(vehicle.plate || '');
    setModel(vehicle.model || '');
    setColor(vehicle.color || '#6366f1');
    setStatus(vehicle.status);
    setCapacity(vehicle.capacity || '');
    setNotes(vehicle.notes || '');
    setPin(vehicle.pin || '1234');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !driverName.trim()) {
      alert('Por favor completa el nombre del móvil y el nombre del chofer.');
      return;
    }

    setIsSaving(true);
    try {
      const vehicleData = {
        name: name.trim(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        plate: plate.trim().toUpperCase(),
        model: model.trim(),
        color,
        status,
        capacity: capacity.trim(),
        notes: notes.trim(),
        pin: pin.trim() || '1234',
      };

      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, vehicleData);
      } else {
        await addVehicle(vehicleData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el móvil.');
    } finally {
      setIsSaving(false);
    }
  };

  const getMagicLink = (v: Vehicle) => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}?mode=driver&vehicleId=${v.id}&pin=${v.pin || '1234'}`;
  };

  const handleShareMagicLink = (v: Vehicle) => {
    const link = getMagicLink(v);
    const text = `Hola ${v.driverName}! Aquí tienes tu acceso directo a Optirutas para ${v.name}: ${link}`;
    if (v.driverPhone) {
      const cleanPhone = v.driverPhone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      navigator.clipboard.writeText(link);
      setCopiedId(v.id);
      setTimeout(() => setCopiedId(null), 2500);
      alert('¡Enlace de acceso directo copiado al portapapeles! Puedes pegarlo y enviárselo al chofer.');
    }
  };

  const handleCopyLinkOnly = (v: Vehicle) => {
    const link = getMagicLink(v);
    navigator.clipboard.writeText(link);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    const assigned = stopsByVehicle[vehicle.id]?.total || 0;
    const warning = assigned > 0 
      ? `\n\n⚠️ Atención: Este móvil tiene ${assigned} parada(s) asignadas hoy.` 
      : '';

    if (window.confirm(`¿Estás seguro de eliminar "${vehicle.name}" (${vehicle.driverName})?${warning}`)) {
      try {
        await deleteVehicle(vehicle.id);
      } catch (err) {
        alert('Error al eliminar el móvil.');
      }
    }
  };

  const handleQuickStatusChange = async (vehicle: Vehicle, newStatus: Vehicle['status']) => {
    try {
      await updateVehicle(vehicle.id, { status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getStatusBadge = (vStatus: Vehicle['status']) => {
    switch (vStatus) {
      case 'available':
        return {
          label: 'Disponible',
          className: 'bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          dot: 'bg-emerald-500'
        };
      case 'on_route':
        return {
          label: 'En Ruta',
          className: 'bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          dot: 'bg-blue-500 animate-pulse'
        };
      case 'maintenance':
        return {
          label: 'En Taller',
          className: 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500'
        };
      case 'inactive':
      default:
        return {
          label: 'Inactivo',
          className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
          dot: 'bg-slate-400'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass p-4 rounded-3xl border shadow-md flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Flota</p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">{stats.total}</p>
          </div>
        </div>

        <div className="glass p-4 rounded-3xl border shadow-md flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex-shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">En Ruta</p>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400 leading-tight">{stats.onRoute}</p>
          </div>
        </div>

        <div className="glass p-4 rounded-3xl border shadow-md flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Disponibles</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">{stats.available}</p>
          </div>
        </div>

        <div className="glass p-4 rounded-3xl border shadow-md flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Mantenimiento</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 leading-tight">{stats.maintenance}</p>
          </div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="glass p-5 rounded-3xl border shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-4 top-3 h-4 text-slate-400 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por móvil, chofer, patente o modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800/90 border border-transparent dark:border-slate-700/50 rounded-2xl pl-11 pr-8 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Add Vehicle Button */}
          <button
            onClick={openAddModal}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-purple-500/25 m3-surface-interactive cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Móvil</span>
          </button>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 flex-shrink-0">
            Filtrar:
          </span>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'available', label: 'Disponibles' },
            { id: 'on_route', label: 'En Ruta' },
            { id: 'maintenance', label: 'Mantenimiento' },
            { id: 'inactive', label: 'Inactivos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex-shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="glass rounded-3xl border shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
              Unidades de Reparto Registradas
            </h2>
          </div>
          <span className="bg-purple-100 dark:bg-purple-950/70 border border-purple-200/50 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full font-bold">
            {filteredVehicles.length} Unidad(es)
          </span>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
            <Truck className="w-12 h-12 mx-auto opacity-40 text-purple-500" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No se encontraron móviles en la flota.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Prueba modificando los filtros de búsqueda o estado.'
                : 'Comienza registrando tu primer móvil para asignar paradas y choferes.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={openAddModal}
                className="mt-2 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primer Móvil</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((vehicle) => {
              const statusInfo = getStatusBadge(vehicle.status);
              const assignedStats = stopsByVehicle[vehicle.id];

              return (
                <div
                  key={vehicle.id}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 relative overflow-hidden group"
                >
                  {/* Top Color Accent Line */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1.5 transition-all"
                    style={{ backgroundColor: vehicle.color }}
                  />

                  <div className="space-y-3">
                    {/* Header: Avatar, Name, Status Badge */}
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Custom Color Avatar with Vehicle Icon */}
                        <div 
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md flex-shrink-0"
                          style={{ backgroundColor: vehicle.color }}
                        >
                          <Truck className="w-5 h-5 text-white" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight truncate">
                            {vehicle.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            {vehicle.model || 'Vehículo sin modelo'}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border flex-shrink-0 ${statusInfo.className}`}>
                        <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    {/* Driver & Contact Details */}
                    <div className="bg-slate-50 dark:bg-slate-850/80 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 truncate">
                          <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          <span className="truncate">{vehicle.driverName}</span>
                        </span>

                        {vehicle.plate && (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-black text-[10px] tracking-wider border border-slate-300 dark:border-slate-700 flex-shrink-0">
                            {vehicle.plate}
                          </span>
                        )}
                      </div>

                      {vehicle.driverPhone && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                          <a 
                            href={`tel:${vehicle.driverPhone}`}
                            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                          >
                            <Phone className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{vehicle.driverPhone}</span>
                          </a>

                          <a
                            href={`https://wa.me/${vehicle.driverPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Today's Route Activity for this Mobile */}
                    <div className="flex items-center justify-between text-xs pt-1 px-1">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-500" />
                        <span>Ruta de {todayName}:</span>
                      </span>

                      {assignedStats && assignedStats.total > 0 ? (
                        <button
                          type="button"
                          onClick={() => onSelectVehicleForRoute && onSelectVehicleForRoute(vehicle.id)}
                          className="font-black text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full text-[11px] border border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform cursor-pointer"
                          title="Ver paradas de este móvil en Planificación"
                        >
                          {assignedStats.completed}/{assignedStats.total} paradas →
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                          Sin paradas asignadas
                        </span>
                      )}
                    </div>

                    {vehicle.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-1 px-1">
                        "{vehicle.notes}"
                      </p>
                    )}

                    {/* Live Telemetry Radar Signal */}
                    {vehicle.telemetry?.updatedAt && (
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] border border-slate-200/50 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                          <Radio className={`w-3 h-3 ${Date.now() - vehicle.telemetry.updatedAt < 1000 * 60 * 15 ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                          <span>
                            {Date.now() - vehicle.telemetry.updatedAt < 1000 * 60 * 15 ? 'GPS En Vivo' : 'Última señal'}
                          </span>
                        </span>
                        <span className="text-slate-500 font-mono">
                          {vehicle.telemetry.speed !== undefined && vehicle.telemetry.speed > 0 ? `${vehicle.telemetry.speed} km/h • ` : ''}
                          hace {Math.max(1, Math.round((Date.now() - vehicle.telemetry.updatedAt) / 60000))} min
                        </span>
                      </div>
                    )}

                    {/* Access PIN & Driver WhatsApp Magic Link */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <KeyRound className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">PIN:</span>
                        <span className="font-mono font-black text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 tracking-widest text-[11px]">
                          {vehicle.pin || '1234'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyLinkOnly(vehicle)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                          title="Copiar link de acceso para conductor"
                        >
                          {copiedId === vehicle.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareMagicLink(vehicle)}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg shadow-sm transition-all cursor-pointer"
                          title="Enviar acceso directo por WhatsApp al chofer"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Enviar Acceso</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {/* Quick status selector */}
                    <select
                      value={vehicle.status}
                      onChange={(e) => handleQuickStatusChange(vehicle, e.target.value as any)}
                      className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1.5 border border-transparent dark:border-slate-700 cursor-pointer focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="available">Disponible</option>
                      <option value="on_route">En Ruta</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="inactive">Inactivo</option>
                    </select>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                        title="Editar datos del móvil"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(vehicle)}
                        className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                        title="Eliminar móvil de la flota"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm m3-scrim-enter">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden m3-dialog-enter">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: color }}
                >
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {editingVehicle ? 'Editar Unidad de Reparto' : 'Registrar Nuevo Móvil'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre de Móvil */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nombre o N° de Móvil *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Móvil 01, Camioneta Norte"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Chofer Asignado */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Conductor / Chofer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Juan Pérez"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Teléfono Chofer */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="ej: +54 9 11 2345-6789"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Patente / Matrícula */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Patente / Matrícula
                  </label>
                  <input
                    type="text"
                    placeholder="ej: AE 123 CD"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Modelo del Vehículo */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Modelo del Vehículo
                  </label>
                  <input
                    type="text"
                    placeholder="ej: Renault Kangoo 1.6"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Estado */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Estado Operativo
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="available">Disponible</option>
                    <option value="on_route">En Ruta</option>
                    <option value="maintenance">En Taller / Mantenimiento</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Color Selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Color Identificador en Mapa y Rutas</span>
                  <span className="font-mono text-[11px] text-slate-500">{color}</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={`w-8 h-8 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                        color.toLowerCase() === c.hex.toLowerCase()
                          ? 'scale-110 ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-slate-900'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {color.toLowerCase() === c.hex.toLowerCase() && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capacidad y Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>PIN de Acceso Chofer</span>
                    <span className="text-[10px] text-slate-400 font-mono">4 dígitos</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="1234"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Capacidad (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej: 800 kg / 4 m³"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Notas u Observaciones
                  </label>
                  <input
                    type="text"
                    placeholder="ej: GPS activo"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-purple-500/25 m3-surface-interactive cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando...' : editingVehicle ? 'Guardar Cambios' : 'Registrar Móvil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
