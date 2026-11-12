import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, MapPin, 
  CheckSquare, Square, RefreshCw, X, Archive, Clock,
  Wand2, Share2, Download, Crosshair, Search, Sparkles, Check, Layers, PlusCircle
} from 'lucide-react';
import { addStop, updateStop, deleteStop, addHistory, type Stop, type Client } from '../services/firestore';
import { 
  calculateDistanceKm, 
  calculateRouteDistanceKm, 
  calculateSequenceDistanceKm,
  computeOptimizedStopOrder, 
  extractCoords, 
  resolveMapLinkCoords,
  getCurrentDayNameEs,
  smartSearchMatch
} from '../utils/geo';

interface StopListProps {
  stops: Stop[];
  clients: Client[];
  onSelectStop: (coords: [number, number]) => void;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  onRequestMapPick?: (currentDraft: {
    editingStop: Stop | null;
    name: string;
    address: string;
    mapLink: string;
    orderIndex: string;
    deliveryDay: string;
  }) => void;
  pickedCoordsForStop?: {
    coords: [number, number];
    draft: {
      editingStop: Stop | null;
      name: string;
      address: string;
      mapLink: string;
      orderIndex: string;
      deliveryDay: string;
    };
  } | null;
  onClearPickedCoords?: () => void;
}

export const StopList: React.FC<StopListProps> = ({ 
  stops, 
  clients,
  onSelectStop,
  selectedDay: controlledDay,
  onSelectDay,
  onRequestMapPick,
  pickedCoordsForStop,
  onClearPickedCoords
}) => {
  const todayName = getCurrentDayNameEs();
  const [internalDay, setInternalDay] = useState<string>(todayName);
  const selectedDay = controlledDay !== undefined ? controlledDay : internalDay;
  const setSelectedDay = (day: string) => {
    if (onSelectDay) onSelectDay(day);
    else setInternalDay(day);
  };

  // Smart search query for filtering stops
  const [stopSearchQuery, setStopSearchQuery] = useState('');

  // Smart Route Proposal State
  const [preferredStartStopId, setPreferredStartStopId] = useState<string>('');
  const [dismissedProposalSignature, setDismissedProposalSignature] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);

  // Modal Mode: 'bulk' (Carga Masiva desde Clientes) vs 'single' (Formulario Individual)
  const [modalMode, setModalMode] = useState<'bulk' | 'single'>('bulk');

  // Bulk Mode State inside Add Stop Modal
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSelectedClientIds, setBulkSelectedClientIds] = useState<string[]>([]);
  const [bulkOptimizeOrder, setBulkOptimizeOrder] = useState(true);
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Single Stop Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [orderIndex, setOrderIndex] = useState('');
  const [deliveryDay, setDeliveryDay] = useState(todayName);
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [savedToastCount, setSavedToastCount] = useState(0);

  // Searchable Client Selector State (Single mode)
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Archive Route State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveDriverName, setArchiveDriverName] = useState('');
  const [archiveDuration, setArchiveDuration] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  // Restore modal when returning from Map Pick mode
  useEffect(() => {
    if (pickedCoordsForStop) {
      const { coords, draft } = pickedCoordsForStop;
      setEditingStop(draft.editingStop);
      setModalMode('single');
      setName(draft.name);
      setAddress(draft.address);
      setMapLink(draft.mapLink || `https://www.google.com/maps?q=${coords[0]},${coords[1]}`);
      setOrderIndex(draft.orderIndex);
      setDeliveryDay(draft.deliveryDay);
      setLatitude(coords[0].toString());
      setLongitude(coords[1].toString());
      setResolveError(null);
      setIsModalOpen(true);
      if (onClearPickedCoords) onClearPickedCoords();
    }
  }, [pickedCoordsForStop, onClearPickedCoords]);

  // Auto-extract coordinates when mapLink changes in Stop modal
  useEffect(() => {
    if (!mapLink) {
      setResolveError(null);
      return;
    }

    const instant = extractCoords(mapLink);
    if (instant) {
      setLatitude(instant.lat.toString());
      setLongitude(instant.lng.toString());
      setResolveError(null);
      return;
    }

    const isShort = mapLink.includes('maps.app.goo.gl') || mapLink.includes('goo.gl') || mapLink.includes('bit.ly');
    if (isShort && mapLink.startsWith('http') && !isResolvingLink) {
      setIsResolvingLink(true);
      setResolveError(null);
      resolveMapLinkCoords(mapLink)
        .then((coords) => {
          if (coords) {
            setLatitude(coords.lat.toString());
            setLongitude(coords.lng.toString());
          } else {
            setResolveError('No se pudieron extraer coordenadas del enlace acortado.');
          }
        })
        .catch(() => {
          setResolveError('No se pudo resolver el enlace corto.');
        })
        .finally(() => {
          setIsResolvingLink(false);
        });
    }
  }, [mapLink]);

  // Filter stops by day first
  const dayStops = useMemo(() => {
    const base = selectedDay === 'Todos' 
      ? stops 
      : stops.filter(stop => stop.deliveryDay.toLowerCase() === selectedDay.toLowerCase());
    return [...base].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [stops, selectedDay]);

  // Apply smart search filter over dayStops
  const sortedStops = useMemo(() => {
    if (!stopSearchQuery.trim()) return dayStops;
    return dayStops.filter(stop =>
      smartSearchMatch(
        stopSearchQuery,
        stop.name,
        stop.address,
        stop.deliveryDay,
        `parada ${stop.orderIndex}`,
        stop.completed ? 'completado entregado' : 'pendiente'
      )
    );
  }, [dayStops, stopSearchQuery]);

  const totalDistanceKm = calculateRouteDistanceKm(dayStops);

  // Compute Smart Route Proposal based on locations
  const routeProposal = useMemo(() => {
    const pendingValid = dayStops.filter(s => !s.completed && s.latitude !== 0 && s.longitude !== 0);
    if (pendingValid.length < 3) return null;

    const effectiveStartId = preferredStartStopId && pendingValid.some(s => s.id === preferredStartStopId)
      ? preferredStartStopId
      : pendingValid[0].id;

    const proposedOrder = computeOptimizedStopOrder(dayStops, effectiveStartId);
    const currentIds = dayStops.map(s => s.id).join(',');
    const proposedIds = proposedOrder.map(s => s.id).join(',');

    const isDifferentOrder = currentIds !== proposedIds;
    const currentDist = calculateSequenceDistanceKm(dayStops);
    const proposedDist = calculateSequenceDistanceKm(proposedOrder);
    const savedKm = Math.max(0, currentDist - proposedDist);

    if (!isDifferentOrder) return null;

    return {
      proposedOrder,
      currentDist,
      proposedDist,
      savedKm,
      signature: `${selectedDay}:${currentIds}->${proposedIds}`,
      effectiveStartId,
      pendingValid
    };
  }, [dayStops, preferredStartStopId, selectedDay]);

  // Bulk filtered clients inside Modal
  const bulkFilteredClients = useMemo(() => {
    return clients.filter(c =>
      smartSearchMatch(bulkSearch, c.name, c.address, c.phone, c.email)
    );
  }, [clients, bulkSearch]);

  // Preview of bulk selected stops in modal
  const bulkPreviewStops = useMemo(() => {
    const selectedClients = bulkSelectedClientIds
      .map(id => clients.find(c => c.id === id))
      .filter((c): c is Client => !!c);

    const rawStops: Stop[] = selectedClients.map((client, idx) => ({
      id: client.id,
      name: client.name,
      address: client.address,
      latitude: client.latitude,
      longitude: client.longitude,
      completed: false,
      orderIndex: idx + 1,
      deliveryDay,
      mapLink: client.mapLink || `https://www.google.com/maps?q=${client.latitude},${client.longitude}`
    }));

    if (bulkOptimizeOrder && rawStops.length > 2) {
      return computeOptimizedStopOrder(rawStops);
    }
    return rawStops;
  }, [bulkSelectedClientIds, clients, deliveryDay, bulkOptimizeOrder]);

  const daysOfWeek = ['Todos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Handle client selection to autofill single stop fields
  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setName(client.name);
      setAddress(client.address);
      setLatitude(client.latitude.toString());
      setLongitude(client.longitude.toString());
      setMapLink(client.mapLink || '');
    }
  };

  const resetSingleFormFields = (nextOrderIdx: number) => {
    setName('');
    setAddress('');
    setMapLink('');
    setLatitude('');
    setLongitude('');
    setOrderIndex(nextOrderIdx.toString());
    setResolveError(null);
    setClientSearch('');
    setIsClientDropdownOpen(false);
  };

  const openAddModal = () => {
    setEditingStop(null);
    const activeDay = selectedDay === 'Todos' ? todayName : selectedDay;
    setDeliveryDay(activeDay);
    resetSingleFormFields(dayStops.length + 1);
    setBulkSearch('');
    setBulkSelectedClientIds([]);
    setSavedToastCount(0);
    // Default to bulk mode if there are clients in the directory, otherwise single mode
    setModalMode(clients.length > 0 ? 'bulk' : 'single');
    setIsModalOpen(true);
  };

  const openEditModal = (stop: Stop) => {
    setEditingStop(stop);
    setModalMode('single');
    setName(stop.name);
    setAddress(stop.address);
    setMapLink(stop.mapLink || '');
    setLatitude(stop.latitude.toString());
    setLongitude(stop.longitude.toString());
    setOrderIndex(stop.orderIndex.toString());
    setDeliveryDay(stop.deliveryDay);
    setResolveError(null);
    setSavedToastCount(0);
    setIsModalOpen(true);
  };

  const saveSingleStop = async (keepOpenForNext: boolean) => {
    if (!name || !address || !latitude || !longitude || !orderIndex) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const currentOrderNum = parseInt(orderIndex) || 1;
    const generatedMapLink = mapLink || `https://www.google.com/maps?q=${latNum},${lngNum}`;

    const stopData = {
      name,
      address,
      latitude: latNum,
      longitude: lngNum,
      completed: editingStop ? editingStop.completed : false,
      orderIndex: currentOrderNum,
      deliveryDay,
      mapLink: generatedMapLink,
    };

    try {
      if (editingStop) {
        await updateStop(editingStop.id, stopData);
        setIsModalOpen(false);
      } else {
        await addStop(stopData);
        if (keepOpenForNext) {
          setSavedToastCount(prev => prev + 1);
          resetSingleFormFields(currentOrderNum + 1);
        } else {
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      alert('Error guardando la parada');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSingleStop(false);
  };

  const handleSaveBulkStops = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkPreviewStops.length === 0) return;

    setIsSavingBulk(true);
    try {
      const existingInTargetDay = stops.filter(
        s => s.deliveryDay.toLowerCase() === deliveryDay.toLowerCase()
      );
      let nextOrder = existingInTargetDay.length > 0
        ? Math.max(...existingInTargetDay.map(s => s.orderIndex)) + 1
        : 1;

      for (const item of bulkPreviewStops) {
        await addStop({
          name: item.name,
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
          completed: false,
          orderIndex: nextOrder++,
          deliveryDay,
          mapLink: item.mapLink,
        });
      }

      setSelectedDay(deliveryDay);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar las paradas en lote.');
    } finally {
      setIsSavingBulk(false);
    }
  };

  const toggleBulkClient = (clientId: string) => {
    setBulkSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const handleSelectAllFilteredBulk = () => {
    const filteredIds = bulkFilteredClients.map(c => c.id);
    const allAlreadySelected = filteredIds.every(id => bulkSelectedClientIds.includes(id));
    if (allAlreadySelected) {
      setBulkSelectedClientIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const merged = [...bulkSelectedClientIds];
      for (const id of filteredIds) {
        if (!merged.includes(id)) merged.push(id);
      }
      setBulkSelectedClientIds(merged);
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
      const nextCompleted = !stop.completed;
      await updateStop(stop.id, { 
        completed: nextCompleted,
        completedAt: nextCompleted ? Date.now() : null as any
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Reordering helpers
  const moveStop = async (stop: Stop, direction: 'up' | 'down') => {
    const currentIndex = dayStops.findIndex(s => s.id === stop.id);
    if (direction === 'up' && currentIndex <= 0) return;
    if (direction === 'down' && currentIndex >= dayStops.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetStop = dayStops[targetIndex];

    try {
      await updateStop(stop.id, { orderIndex: targetStop.orderIndex });
      await updateStop(targetStop.id, { orderIndex: stop.orderIndex });
    } catch (err) {
      console.error(err);
    }
  };

  // Recalculate order indices sequentially to clean up any gaps
  const handleOptimizeIndices = async () => {
    try {
      for (let i = 0; i < dayStops.length; i++) {
        const stop = dayStops[i];
        if (stop.orderIndex !== i + 1) {
          await updateStop(stop.id, { orderIndex: i + 1 });
        }
      }
    } catch (err) {
      alert('Error al optimizar los índices');
    }
  };

  // Apply Geographical Nearest-Neighbor + 2-opt Route Optimization (TSP)
  const handleApplyOptimizedOrder = async (customOrder?: Stop[]) => {
    const targetList = customOrder || computeOptimizedStopOrder(dayStops, preferredStartStopId || undefined);
    if (targetList.length < 2) return;

    setIsOptimizing(true);
    try {
      for (let i = 0; i < targetList.length; i++) {
        const stop = targetList[i];
        const newOrder = i + 1;
        if (stop.orderIndex !== newOrder) {
          await updateStop(stop.id, { orderIndex: newOrder });
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error al aplicar el orden propuesto');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Share Route via WhatsApp
  const handleShareWhatsApp = () => {
    if (dayStops.length === 0) return;
    const dayTitle = selectedDay === 'Todos' ? 'Semana Completa' : selectedDay;
    const lines = [
      `🚚 *HOJA DE RUTA OPTIRUTAS - ${dayTitle.toUpperCase()}*`,
      `📍 Paradas: ${dayStops.length} | Distancia est.: ${totalDistanceKm.toFixed(1)} km`,
      `────────────────────`
    ];

    dayStops.forEach((s, idx) => {
      const statusIcon = s.completed ? '✅' : '⏳';
      const navUrl = s.mapLink || `https://maps.google.com/?q=${s.latitude},${s.longitude}`;
      lines.push(`${idx + 1}. ${statusIcon} *${s.name}*\n   📌 ${s.address}\n   🗺️ ${navUrl}`);
    });

    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Export Stops to CSV
  const handleExportCSV = () => {
    if (dayStops.length === 0) return;
    const headers = ['Orden', 'Nombre', 'Direccion', 'Dia', 'Estado', 'Hora Entrega', 'Latitud', 'Longitud', 'Google Maps'];
    const rows = dayStops.map(s => [
      s.orderIndex,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.address.replace(/"/g, '""')}"`,
      s.deliveryDay,
      s.completed ? 'Completado' : 'Pendiente',
      s.completedAt ? formatTime(s.completedAt) : '',
      s.latitude,
      s.longitude,
      s.mapLink || `https://maps.google.com/?q=${s.latitude},${s.longitude}`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hoja_de_ruta_${selectedDay.toLowerCase()}.csv`;
    link.click();
  };

  // Format milliseconds into HH:MM format
  const formatTime = (millis?: number) => {
    if (!millis) return '';
    const date = new Date(millis);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Format difference in minutes into "+X min" or similar
  const formatDiff = (millisDiff: number) => {
    const minutes = Math.round(millisDiff / 60000);
    if (minutes < 1) return '< 1 min';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `+${hours}h ${remainingMinutes}m`;
    }
    return `+${minutes} min`;
  };

  // Calculate transit time between consecutive completed stops
  const getTransitTimes = () => {
    const completedStopsSorted = [...dayStops]
      .filter(s => s.completed && s.completedAt)
      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

    const diffs: Record<string, string> = {};
    for (let i = 1; i < completedStopsSorted.length; i++) {
      const prev = completedStopsSorted[i - 1];
      const curr = completedStopsSorted[i];
      if (curr.completedAt && prev.completedAt) {
        const diff = curr.completedAt - prev.completedAt;
        diffs[curr.id] = formatDiff(diff);
      }
    }
    return diffs;
  };

  const transitTimes = getTransitTimes();

  // Archive route actions
  const completedStops = dayStops.filter(stop => stop.completed);

  const openArchiveModal = () => {
    if (completedStops.length === 0) {
      alert('No hay paradas completadas para archivar.');
      return;
    }
    setArchiveDriverName('');
    
    const completedWithTime = completedStops
      .filter(s => s.completedAt)
      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

    if (completedWithTime.length >= 2) {
      const first = completedWithTime[0];
      const last = completedWithTime[completedWithTime.length - 1];
      if (first.completedAt && last.completedAt) {
        const diff = last.completedAt - first.completedAt;
        const minutes = Math.round(diff / 60000);
        let durationStr = '';
        if (minutes >= 60) {
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          durationStr = `${hours}h ${remainingMinutes}m`;
        } else {
          durationStr = `${minutes}m`;
        }
        setArchiveDuration(durationStr);
      } else {
        setArchiveDuration('');
      }
    } else {
      setArchiveDuration('');
    }

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

      for (const stop of completedStops) {
        await deleteStop(stop.id);
      }

      setIsArchiveModalOpen(false);
    } catch (err) {
      console.error('Error al archivar la ruta:', err);
      alert('Hubo un error al archivar la ruta.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Existing stop names in the target deliveryDay inside modal (to show badge if already added)
  const existingNamesInModalDay = useMemo(() => {
    return new Set(
      stops
        .filter(s => s.deliveryDay.toLowerCase() === deliveryDay.toLowerCase())
        .map(s => s.name.toLowerCase())
    );
  }, [stops, deliveryDay]);

  return (
    <div className="space-y-4">
      {/* Controls & Day Selector */}
      <div className="flex flex-col gap-4 glass p-5 rounded-3xl border shadow-lg">
        {/* Day Tabs with Dynamic "Hoy" Indicator */}
        <div className="flex flex-wrap gap-1.5">
          {daysOfWeek.map(day => {
            const countForDay = day === 'Todos' 
              ? stops.length 
              : stops.filter(s => s.deliveryDay.toLowerCase() === day.toLowerCase()).length;
            const isToday = day.toLowerCase() === todayName.toLowerCase();

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                  selectedDay === day
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{day}</span>
                {isToday && (
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-black ${
                    selectedDay === day
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                  }`}>
                    Hoy
                  </span>
                )}
                {countForDay > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    selectedDay === day 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {countForDay}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Smart Flexible Search Bar for Stops */}
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Búsqueda inteligente de paradas (nombre, calle, altura, estado)..."
            value={stopSearchQuery}
            onChange={(e) => setStopSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-10 pr-8 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
          />
          {stopSearchQuery && (
            <button
              onClick={() => setStopSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {dayStops.length > 2 && (
            <button
              onClick={() => handleApplyOptimizedOrder()}
              disabled={isOptimizing}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              title="Ordenar paradas automáticamente según sus coordenadas geográficas"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{isOptimizing ? 'Optimizando...' : 'Auto-Optimizar Ruta'}</span>
            </button>
          )}
          {dayStops.length > 1 && (
            <button
              onClick={handleOptimizeIndices}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Re-enumerar índices del 1 al N secuencialmente"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>1..N</span>
            </button>
          )}
          <button
            onClick={openArchiveModal}
            disabled={completedStops.length === 0}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold transition-all ${
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
            className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-2 rounded-2xl text-[11px] font-bold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Paradas</span>
          </button>
        </div>

        {/* Export / Share Toolbar */}
        {dayStops.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
              Distancia estimada: <strong className="text-slate-700 dark:text-slate-300">{totalDistanceKm.toFixed(1)} km</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                title="Compartir hoja de ruta por WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Descargar hoja de ruta en CSV (Excel)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Automatic Smart Order Proposal Banner */}
      {routeProposal && dismissedProposalSignature !== routeProposal.signature && (
        <div className="rounded-3xl p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-emerald-50 dark:from-indigo-950/50 dark:via-purple-950/40 dark:to-emerald-950/30 border border-indigo-200/70 dark:border-indigo-800/60 shadow-md space-y-3 animate-fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Orden Sugerido según Ubicaciones</span>
                  {routeProposal.savedKm > 0.05 && (
                    <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      Ahorra {routeProposal.savedKm.toFixed(1)} km
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  Recorrido actual: {routeProposal.currentDist.toFixed(1)} km → Propuesto: <strong>{routeProposal.proposedDist.toFixed(1)} km</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissedProposalSignature(routeProposal.signature)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              title="Ignorar sugerencia por ahora"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Starting Stop Selector */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Iniciar recorrido en:
            </span>
            <select
              value={routeProposal.effectiveStartId}
              onChange={(e) => setPreferredStartStopId(e.target.value)}
              className="flex-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              {routeProposal.pendingValid.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.address})
                </option>
              ))}
            </select>
          </div>

          {/* Proposed Sequence Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-indigo-900 dark:text-indigo-200 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            {routeProposal.proposedOrder.map((s, idx) => (
              <React.Fragment key={s.id}>
                <span className="inline-flex items-center gap-1 bg-indigo-100/80 dark:bg-indigo-950 px-2 py-0.5 rounded-lg">
                  <span className="text-indigo-600 dark:text-indigo-400 font-black">{idx + 1}.</span>
                  <span className="truncate max-w-[120px]">{s.name}</span>
                </span>
                {idx < routeProposal.proposedOrder.length - 1 && (
                  <span className="text-slate-400">→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleApplyOptimizedOrder(routeProposal.proposedOrder)}
              disabled={isOptimizing}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isOptimizing ? 'Aplicando...' : 'Aplicar Orden Propuesto'}</span>
            </button>
          </div>
        </div>
      )}

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
            <p className="font-semibold">
              {stopSearchQuery ? 'No hay paradas que coincidan con tu búsqueda.' : 'No hay paradas registradas para este día.'}
            </p>
            <p className="text-xs mt-1">
              {stopSearchQuery ? 'Prueba con otros términos más generales.' : 'Presiona "Añadir Paradas" para cargar varias a la vez.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[550px] overflow-y-auto">
            {sortedStops.map((stop, idx) => {
              const prevStop = idx > 0 ? sortedStops[idx - 1] : null;
              const legKm = prevStop
                ? calculateDistanceKm(prevStop.latitude, prevStop.longitude, stop.latitude, stop.longitude)
                : 0;

              return (
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
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveStop(stop, 'down')}
                        disabled={idx === sortedStops.length - 1}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Complete Checkbox */}
                    <button 
                      onClick={() => toggleCompleted(stop)}
                      className="text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                    >
                      {stop.completed ? (
                        <CheckSquare className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <Square className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                      )}
                    </button>

                    {/* Stop Information */}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {stop.name}
                        </span>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          #{stop.orderIndex}
                        </span>
                        {legKm > 0 && (
                          <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            +{legKm.toFixed(1)} km
                          </span>
                        )}
                        {selectedDay === 'Todos' && (
                          <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {stop.deliveryDay}
                          </span>
                        )}
                        
                        {/* Delivery Time and Transit Metrics */}
                        {stop.completed && stop.completedAt && (
                          <span className="bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{formatTime(stop.completedAt)}</span>
                            {transitTimes[stop.id] && (
                              <span className="opacity-80 font-bold border-l border-emerald-300 dark:border-emerald-700 pl-1 ml-1 text-[9px]">
                                {transitTimes[stop.id]}
                              </span>
                            )}
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
                      className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      title="Enfocar en mapa"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(stop)}
                      className="p-2 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(stop.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      title="Eliminar"
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

      {/* Add / Edit Stop Modal (Supports both Bulk Multi-Select and Single Stop with Save & Add Another) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
            {/* Fixed Modal Header */}
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {editingStop ? 'Editar Parada' : 'Añadir Paradas a la Ruta'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Switcher Tabs (Only when creating new stops) */}
              {!editingStop && (
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setModalMode('bulk')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      modalMode === 'bulk'
                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Carga Masiva ({bulkSelectedClientIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalMode('single')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      modalMode === 'single'
                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Parada Manual</span>
                  </button>
                </div>
              )}
            </div>

            {/* BULK SELECTION MODE */}
            {!editingStop && modalMode === 'bulk' ? (
              <form onSubmit={handleSaveBulkStops} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  {/* Target Day & Optimization Toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Día de Entrega
                      </label>
                      <select
                        value={deliveryDay}
                        onChange={(e) => setDeliveryDay(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                      >
                        {daysOfWeek.filter(d => d !== 'Todos').map(day => (
                          <option key={day} value={day}>
                            {day} {day.toLowerCase() === todayName.toLowerCase() ? '(Hoy)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="w-full flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 rounded-2xl px-3.5 py-2.5 cursor-pointer text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        <input
                          type="checkbox"
                          checked={bulkOptimizeOrder}
                          onChange={(e) => setBulkOptimizeOrder(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                        <span className="truncate">Ordenar por ubicación</span>
                      </label>
                    </div>
                  </div>

                  {/* Smart Search Bar for Clients */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Selecciona los clientes a incluir ({bulkFilteredClients.length})
                      </label>
                      {bulkFilteredClients.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredBulk}
                          className="text-[11px] font-extrabold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          {bulkFilteredClients.every(c => bulkSelectedClientIds.includes(c.id))
                            ? 'Desmarcar filtrados'
                            : 'Marcar todos los filtrados'}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, calle, teléfono o palabras sueltas..."
                        value={bulkSearch}
                        onChange={(e) => setBulkSearch(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-10 pr-8 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                      />
                      {bulkSearch && (
                        <button
                          type="button"
                          onClick={() => setBulkSearch('')}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-select Client List */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 bg-white/50 dark:bg-slate-900/50">
                    {bulkFilteredClients.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No se encontraron clientes en el directorio.
                      </div>
                    ) : (
                      bulkFilteredClients.map(client => {
                        const selIndex = bulkPreviewStops.findIndex(s => s.id === client.id);
                        const isSelected = bulkSelectedClientIds.includes(client.id);
                        const alreadyInDay = existingNamesInModalDay.has(client.name.toLowerCase());

                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => toggleBulkClient(client.id)}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                              )}
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                    {client.name}
                                  </span>
                                  {alreadyInDay && (
                                    <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full">
                                      Ya en {deliveryDay}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
                                  {client.address}
                                </span>
                              </div>
                            </div>

                            {isSelected && selIndex !== -1 && (
                              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0">
                                #{selIndex + 1}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Live Preview of Selected Sequence */}
                  {bulkPreviewStops.length > 0 && (
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 p-3 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300">
                        <span>
                          {bulkOptimizeOrder && bulkPreviewStops.length > 2
                            ? '✨ Orden propuesto por ubicación:'
                            : 'Secuencia a guardar:'}
                        </span>
                        <span>{calculateSequenceDistanceKm(bulkPreviewStops).toFixed(1)} km est.</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 max-h-20 overflow-y-auto">
                        {bulkPreviewStops.map((s, idx) => (
                          <React.Fragment key={s.id}>
                            <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                              {idx + 1}. {s.name}
                            </span>
                            {idx < bulkPreviewStops.length - 1 && <span>→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Modal Footer */}
                <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between gap-2 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={bulkPreviewStops.length === 0 || isSavingBulk}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold hover:opacity-95 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isSavingBulk
                      ? 'Guardando...'
                      : `Guardar ${bulkPreviewStops.length} Parada(s)`}
                  </button>
                </div>
              </form>
            ) : (
              /* SINGLE / MANUAL STOP MODE */
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  {savedToastCount > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-3.5 py-2 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                      <span>✅ ¡{savedToastCount} parada(s) guardada(s)! Puedes cargar la siguiente:</span>
                    </div>
                  )}

                  {/* Autofill from Clients Directory (Smart Search) */}
                  {!editingStop && clients.length > 0 && (
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Autocompletar desde Directorio de Clientes (Búsqueda Inteligente)
                      </label>
                      
                      {isClientDropdownOpen && (
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsClientDropdownOpen(false)} 
                        />
                      )}

                      <div className="relative z-50">
                        <input
                          type="text"
                          placeholder="Buscar por nombre, calle, teléfono o palabras sueltas..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setIsClientDropdownOpen(true);
                          }}
                          onFocus={() => setIsClientDropdownOpen(true)}
                          className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                        />
                        
                        {isClientDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 max-h-44 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800 z-50">
                            {(() => {
                              const filtered = clients.filter(c => 
                                smartSearchMatch(clientSearch, c.name, c.address, c.phone, c.email)
                              );
                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-xs text-slate-400 text-center">
                                    No se encontraron clientes coincidentes
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
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Nombre de la Parada
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Farmacia Central, Local de Reparto..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Dirección
                    </label>
                    <input
                      type="text"
                      placeholder="Calle Falsa 123"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  {/* Optional Google Maps Link */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Enlace de Google Maps (Extrae coordenadas)
                      </label>
                      {onRequestMapPick && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false);
                            onRequestMapPick({
                              editingStop,
                              name,
                              address,
                              mapLink,
                              orderIndex,
                              deliveryDay
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          <span>Elegir en el mapa</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      placeholder="https://maps.google.com/... o maps.app.goo.gl/..."
                      value={mapLink}
                      onChange={(e) => setMapLink(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    />
                    {isResolvingLink && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1 animate-pulse">
                        🔄 Extrayendo coordenadas del enlace...
                      </p>
                    )}
                    {resolveError && (
                      <p className="text-xs text-amber-500 font-semibold mt-1">
                        ⚠️ {resolveError}
                      </p>
                    )}
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Latitud
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="-34.6037"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Longitud
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="-58.3816"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                        required
                      />
                    </div>
                  </div>

                  {/* Order and Day */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Día de Entrega
                      </label>
                      <select
                        value={deliveryDay}
                        onChange={(e) => setDeliveryDay(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                      >
                        {daysOfWeek.filter(d => d !== 'Todos').map(day => (
                          <option key={day} value={day}>
                            {day} {day.toLowerCase() === todayName.toLowerCase() ? '(Hoy)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Índice de Orden
                      </label>
                      <input
                        type="number"
                        placeholder="1"
                        value={orderIndex}
                        onChange={(e) => setOrderIndex(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Fixed Modal Footer */}
                <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap items-center justify-end gap-2 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer mr-auto"
                  >
                    Cancelar
                  </button>
                  {!editingStop && (
                    <button
                      type="button"
                      onClick={() => saveSingleStop(true)}
                      className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 transition-colors cursor-pointer"
                      title="Guarda esta parada y limpia el formulario para cargar otra inmediatamente"
                    >
                      + Guardar y Cargar Otra
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
                  >
                    {editingStop ? 'Guardar Cambios' : 'Guardar y Cerrar'}
                  </button>
                </div>
              </form>
            )}
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
