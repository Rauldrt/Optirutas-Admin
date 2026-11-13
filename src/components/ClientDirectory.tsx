import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, MapPin, Search, Mail, Phone, ExternalLink, X, 
  Send, CheckSquare, Square, Crosshair, Wand2, Truck,
  Zap, MessageCircle, Sparkles, Clipboard, CheckCircle2
} from 'lucide-react';
import { addClient, updateClient, deleteClient, addStop, type Client, type Stop, type Vehicle } from '../services/firestore';
import { 
  extractCoords, 
  resolveMapLinkCoords, 
  reverseGeocodeCoords,
  extractPhoneFromText,
  computeOptimizedStopOrder, 
  calculateSequenceDistanceKm,
  getCurrentDayNameEs,
  smartSearchMatch
} from '../utils/geo';

interface ClientDirectoryProps {
  clients: Client[];
  stops?: Stop[];
  vehicles?: Vehicle[];
  onSelectClient: (coords: [number, number]) => void;
  selectedClientIds?: string[];
  onSetSelectedClientIds?: (ids: string[]) => void;
  openBatchModalSignal?: number;
  onSwitchToStopsDay?: (day: string) => void;
  onRequestMapPick?: (currentDraft: {
    editingClient: Client | null;
    name: string;
    address: string;
    mapLink: string;
    phone: string;
    email: string;
  }) => void;
  pickedCoordsForClient?: {
    coords: [number, number];
    draft: {
      editingClient: Client | null;
      name: string;
      address: string;
      mapLink: string;
      phone: string;
      email: string;
    };
  } | null;
  onClearPickedCoords?: () => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({ 
  clients,
  stops = [],
  vehicles = [],
  onSelectClient,
  selectedClientIds: controlledSelectedIds,
  onSetSelectedClientIds,
  openBatchModalSignal,
  onSwitchToStopsDay,
  onRequestMapPick,
  pickedCoordsForClient,
  onClearPickedCoords
}) => {
  const todayName = getCurrentDayNameEs();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Batch Selection State (controlled or internal)
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectedClientIds = controlledSelectedIds !== undefined ? controlledSelectedIds : internalSelectedIds;
  const setSelectedClientIds = (updater: string[] | ((prev: string[]) => string[])) => {
    const nextValue = typeof updater === 'function' ? updater(selectedClientIds) : updater;
    if (onSetSelectedClientIds) {
      onSetSelectedClientIds(nextValue);
    } else {
      setInternalSelectedIds(nextValue);
    }
  };

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchDeliveryDay, setBatchDeliveryDay] = useState(todayName);
  const [batchVehicleId, setBatchVehicleId] = useState<string>('');
  const [autoOptimizeOnSend, setAutoOptimizeOnSend] = useState(true);
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  // Open batch modal when triggered from the Map floating bar
  useEffect(() => {
    if (openBatchModalSignal && openBatchModalSignal > 0 && selectedClientIds.length > 0) {
      setBatchDeliveryDay(getCurrentDayNameEs());
      setIsBatchModalOpen(true);
    }
  }, [openBatchModalSignal]);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Coordinate Resolution State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Quick Add by Link / WhatsApp State
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quickPastedText, setQuickPastedText] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickCoords, setQuickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [quickMapLink, setQuickMapLink] = useState('');
  const [isQuickResolving, setIsQuickResolving] = useState(false);
  const [quickResolveError, setQuickResolveError] = useState<string | null>(null);
  const [quickDeliveryDay, setQuickDeliveryDay] = useState(todayName);
  const [quickVehicleId, setQuickVehicleId] = useState<string>('');
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [sendToRouteImmediately, setSendToRouteImmediately] = useState(true);

  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const openQuickAddModal = () => {
    setQuickPastedText('');
    setQuickName('');
    setQuickAddress('');
    setQuickPhone('');
    setQuickCoords(null);
    setQuickMapLink('');
    setQuickResolveError(null);
    setQuickDeliveryDay(todayName);
    setQuickVehicleId(vehicles.length > 0 ? vehicles[0].id : '');
    setSendToRouteImmediately(true);
    setIsQuickAddModalOpen(true);
  };

  const processPastedLocationText = async (rawText: string) => {
    setQuickPastedText(rawText);
    if (!rawText.trim()) {
      setQuickCoords(null);
      setQuickResolveError(null);
      return;
    }

    setIsQuickResolving(true);
    setQuickResolveError(null);

    try {
      // 1. Detect Phone Number from text (skips URLs and coordinates)
      const detectedPhone = extractPhoneFromText(rawText);
      if (detectedPhone) {
        setQuickPhone(detectedPhone);
      }

      // 2. Resolve Coordinates from Link or Raw Numbers
      const coords = await resolveMapLinkCoords(rawText);

      if (coords) {
        setQuickCoords(coords);
        const mapUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
        setQuickMapLink(mapUrl);

        // 3. Reverse Geocode for Street, Neighborhood, Town and Place Name
        const geoInfo = await reverseGeocodeCoords(coords.lat, coords.lng);
        if (geoInfo) {
          if (!quickAddress || quickAddress === 'Ubicación sin calle nombrada') {
            setQuickAddress(geoInfo.formattedAddress);
          }
          if (geoInfo.placeName && !quickName) {
            setQuickName(geoInfo.placeName);
          }
        }
      } else {
        if (/goo\.gl|maps\.app/i.test(rawText)) {
          setQuickResolveError('Enlace corto detectado. Si tu navegador bloquea la redirección automática, ábrelo en Google Maps y pega las coordenadas o el enlace completo.');
        } else {
          setQuickResolveError('No se encontró un enlace de Google Maps o coordenadas válidas en el texto.');
        }
      }
    } catch (err) {
      console.error(err);
      setQuickResolveError('Error al procesar la ubicación.');
    } finally {
      setIsQuickResolving(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          processPastedLocationText(text);
        }
      } else {
        alert('Por favor pega el enlace directamente en el campo de texto.');
      }
    } catch (err) {
      alert('Por favor pega el enlace directamente en el campo de texto.');
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      alert('Por favor ingresa un nombre para el cliente.');
      return;
    }
    if (!quickCoords) {
      alert('No se detectaron coordenadas válidas.');
      return;
    }

    setIsQuickSaving(true);
    try {
      await addClient({
        name: quickName.trim(),
        address: quickAddress.trim() || 'Sin dirección especificada',
        latitude: quickCoords.lat,
        longitude: quickCoords.lng,
        mapLink: quickMapLink || `https://www.google.com/maps?q=${quickCoords.lat},${quickCoords.lng}`,
        phone: quickPhone.trim(),
        email: '',
      });

      // If user selected "Guardar y Cargar a Ruta"
      if (sendToRouteImmediately) {
        const existingForDay = stops.filter(
          s => s.deliveryDay.toLowerCase() === quickDeliveryDay.toLowerCase()
        );
        const nextOrder = existingForDay.length > 0
          ? Math.max(...existingForDay.map(s => s.orderIndex)) + 1
          : 1;

        const assignedVehicle = vehicles.find(v => v.id === quickVehicleId);

        await addStop({
          name: quickName.trim(),
          address: quickAddress.trim() || 'Sin dirección',
          latitude: quickCoords.lat,
          longitude: quickCoords.lng,
          completed: false,
          orderIndex: nextOrder,
          deliveryDay: quickDeliveryDay,
          vehicleId: assignedVehicle?.id || undefined,
          vehicleName: assignedVehicle?.name || undefined,
          mapLink: quickMapLink,
        });

        alert(`✅ ¡Cliente "${quickName}" registrado y agregado como Parada #${nextOrder} para el día ${quickDeliveryDay}!`);
        if (onSwitchToStopsDay) {
          onSwitchToStopsDay(quickDeliveryDay);
        }
      } else {
        alert(`✅ ¡Cliente "${quickName}" guardado en el directorio con éxito!`);
      }

      setIsQuickAddModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el cliente.');
    } finally {
      setIsQuickSaving(false);
    }
  };

  // Restore modal when returning from Map Pick mode
  useEffect(() => {
    if (pickedCoordsForClient) {
      const { coords, draft } = pickedCoordsForClient;
      setEditingClient(draft.editingClient);
      setName(draft.name);
      setAddress(draft.address);
      setMapLink(draft.mapLink || `https://www.google.com/maps?q=${coords[0]},${coords[1]}`);
      setPhone(draft.phone);
      setEmail(draft.email);
      setLatitude(coords[0]);
      setLongitude(coords[1]);
      setResolveError(null);
      setIsModalOpen(true);
      if (onClearPickedCoords) onClearPickedCoords();
    }
  }, [pickedCoordsForClient, onClearPickedCoords]);

  // Asynchronously resolve short links
  const handleResolveLink = async (linkToResolve: string) => {
    if (!linkToResolve) return;
    
    setIsResolving(true);
    setResolveError(null);

    try {
      const parsedCoords = await resolveMapLinkCoords(linkToResolve);
      if (parsedCoords) {
        setLatitude(parsedCoords.lat);
        setLongitude(parsedCoords.lng);
        // Auto-detect and populate street & neighborhood if address field is blank
        if (!address.trim()) {
          const geoInfo = await reverseGeocodeCoords(parsedCoords.lat, parsedCoords.lng);
          if (geoInfo?.formattedAddress) {
            setAddress(geoInfo.formattedAddress);
          }
        }
      } else {
        setResolveError('No se pudieron extraer coordenadas del enlace acortado.');
        setLatitude(null);
        setLongitude(null);
      }
    } catch (err) {
      console.error(err);
      setResolveError('No se pudo conectar al servidor de resolución del enlace.');
      setLatitude(null);
      setLongitude(null);
    } finally {
      setIsResolving(false);
    }
  };

  // Trigger link resolution on mapLink change
  useEffect(() => {
    if (!mapLink) {
      setLatitude(null);
      setLongitude(null);
      setResolveError(null);
      return;
    }

    const instantCoords = extractCoords(mapLink);
    if (instantCoords) {
      setLatitude(instantCoords.lat);
      setLongitude(instantCoords.lng);
      setResolveError(null);
      return;
    }

    const isShort = mapLink.includes('maps.app.goo.gl') || mapLink.includes('goo.gl') || mapLink.includes('bit.ly');
    if (isShort && mapLink.startsWith('http') && !isResolving && latitude === null && !resolveError) {
      handleResolveLink(mapLink);
    }
  }, [mapLink, latitude, isResolving, resolveError]);

  // Filter clients by smart flexible search
  const filteredClients = useMemo(() => {
    return clients.filter(client =>
      smartSearchMatch(searchQuery, client.name, client.address, client.phone, client.email)
    );
  }, [clients, searchQuery]);

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleQuickSendSingleClient = (client: Client) => {
    setSelectedClientIds([client.id]);
    setBatchDeliveryDay(todayName);
    setIsBatchModalOpen(true);
  };

  // Ordered list of selected clients based on click/selection order
  const orderedSelectedClients = useMemo(() => {
    return selectedClientIds
      .map(id => clients.find(c => c.id === id))
      .filter((c): c is Client => !!c);
  }, [selectedClientIds, clients]);

  // Preview of Stops (both manual click order and geographically proposed order)
  const batchPreview = useMemo(() => {
    const manualStops: Stop[] = orderedSelectedClients.map((client, idx) => ({
      id: client.id,
      name: client.name,
      address: client.address,
      latitude: client.latitude,
      longitude: client.longitude,
      completed: false,
      orderIndex: idx + 1,
      deliveryDay: batchDeliveryDay,
      mapLink: client.mapLink || `https://www.google.com/maps?q=${client.latitude},${client.longitude}`,
    }));

    const optimizedStops = manualStops.length > 2
      ? computeOptimizedStopOrder(manualStops)
      : manualStops;

    const manualDistKm = calculateSequenceDistanceKm(manualStops);
    const optimizedDistKm = calculateSequenceDistanceKm(optimizedStops);

    return {
      manualStops,
      optimizedStops,
      manualDistKm,
      optimizedDistKm,
      activeList: autoOptimizeOnSend && manualStops.length > 2 ? optimizedStops : manualStops
    };
  }, [orderedSelectedClients, batchDeliveryDay, autoOptimizeOnSend]);

  const handleConfirmSendToRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchPreview.activeList.length === 0) return;

    setIsSendingBatch(true);
    try {
      const stopsInTargetDay = stops.filter(
        s => s.deliveryDay.toLowerCase() === batchDeliveryDay.toLowerCase()
      );
      let nextOrderIndex = stopsInTargetDay.length > 0
        ? Math.max(...stopsInTargetDay.map(s => s.orderIndex)) + 1
        : 1;

      const v = vehicles.find(item => item.id === batchVehicleId);

      for (const stopItem of batchPreview.activeList) {
        await addStop({
          name: stopItem.name,
          address: stopItem.address,
          latitude: stopItem.latitude,
          longitude: stopItem.longitude,
          completed: false,
          orderIndex: nextOrderIndex++,
          deliveryDay: batchDeliveryDay,
          mapLink: stopItem.mapLink,
          vehicleId: batchVehicleId || '',
          vehicleName: v?.name || '',
        });
      }

      const targetDay = batchDeliveryDay;
      setSelectedClientIds([]);
      setIsBatchModalOpen(false);
      if (onSwitchToStopsDay) {
        onSwitchToStopsDay(targetDay);
      }
    } catch (err) {
      console.error(err);
      alert('Error al enviar los clientes a la ruta.');
    } finally {
      setIsSendingBatch(false);
    }
  };

  const openAddModal = () => {
    setEditingClient(null);
    setName('');
    setAddress('');
    setMapLink('');
    setPhone('');
    setEmail('');
    setLatitude(null);
    setLongitude(null);
    setResolveError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setAddress(client.address);
    setMapLink(client.mapLink || '');
    setPhone(client.phone || '');
    setEmail(client.email || '');
    setLatitude(client.latitude);
    setLongitude(client.longitude);
    setResolveError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!mapLink && latitude === null)) {
      alert('Por favor completa el Nombre y un Enlace de Google Maps o punto en el mapa');
      return;
    }

    const finalLatitude = latitude !== null ? latitude : 0;
    const finalLongitude = longitude !== null ? longitude : 0;

    const clientData = {
      name,
      address: address || 'Sin dirección',
      latitude: finalLatitude,
      longitude: finalLongitude,
      mapLink: mapLink || `https://www.google.com/maps?q=${finalLatitude},${finalLongitude}`,
      phone: phone || '',
      email: email || '',
    };

    try {
      if (editingClient) {
        await updateClient(editingClient.id, clientData);
      } else {
        await addClient(clientData);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Error guardando el cliente');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
      try {
        await deleteClient(id);
        setSelectedClientIds(prev => prev.filter(item => item !== id));
      } catch (err) {
        alert('Error al eliminar el cliente');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search Controls */}
      <div className="flex flex-col gap-4 glass p-5 rounded-3xl border shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Smart Search Bar */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-4 top-3 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Búsqueda inteligente (nombre, calle, teléfono, email)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-11 pr-8 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
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

          {/* Action Buttons: Quick Add by Link / WhatsApp + Manual Registration */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Quick Add by Link / WhatsApp Button */}
            <button
              type="button"
              onClick={openQuickAddModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer m3-surface-interactive"
              title="Pegar mensaje de WhatsApp o enlace de Google Maps para alta automática"
            >
              <Zap className="w-4 h-4 text-emerald-200 fill-emerald-200" />
              <span>Alta por Link</span>
            </button>

            {/* Manual Add Client Button */}
            <button
              type="button"
              onClick={openAddModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-purple-500/25 transition-all cursor-pointer m3-surface-interactive"
            >
              <Plus className="w-4 h-4" />
              <span>Manual</span>
            </button>
          </div>
        </div>

        {/* Tip for Map Selection */}
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-purple-500/10 dark:bg-purple-900/30 border border-purple-500/20 dark:border-purple-700/40 text-purple-900 dark:text-purple-200 text-xs font-semibold">
          <span>💡 Puedes tocar los pines directamente en el mapa para armar tu ruta en orden.</span>
        </div>

        {/* Batch Send Bar */}
        {selectedClientIds.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 animate-fade-in">
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
              {selectedClientIds.length} cliente(s) seleccionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedClientIds([])}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Limpiar
              </button>
              <button
                onClick={() => {
                  setBatchDeliveryDay(todayName);
                  setIsBatchModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar a Ruta ({selectedClientIds.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Directory Grid */}
      <div className="glass rounded-3xl border shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <h2 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">Directorio de Clientes</h2>
          <span className="bg-purple-100 dark:bg-purple-950/70 border border-purple-200/50 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full font-bold">
            {filteredClients.length} Registrado(s)
          </span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-40 text-purple-500" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No se encontraron clientes.</p>
            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">Intenta cambiar los términos de búsqueda o registra un nuevo cliente.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[550px] overflow-y-auto">
            {filteredClients.map((client) => {
              const selIdx = selectedClientIds.indexOf(client.id);
              const isSelected = selIdx !== -1;
              return (
                <div 
                  key={client.id} 
                  className={`p-4 sm:p-5 flex flex-col justify-between gap-3 transition-colors ${
                    isSelected 
                      ? 'bg-emerald-500/15 dark:bg-emerald-950/40' 
                      : 'bg-white/40 dark:bg-slate-900/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => toggleSelectClient(client.id)}
                          className="text-slate-400 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors cursor-pointer flex-shrink-0"
                          title="Seleccionar para enviar en lote a una ruta"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400 dark:text-slate-400" />
                          )}
                        </button>
                        <h3 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white leading-tight flex items-center gap-2 truncate">
                          <span className="truncate">{client.name}</span>
                          {isSelected && (
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0">
                              #{selIdx + 1}
                            </span>
                          )}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleQuickSendSingleClient(client)}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl transition-all cursor-pointer"
                          title="Enviar a ruta de un día"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectClient([client.latitude, client.longitude])}
                          className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                          title="Enfocar en mapa"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(client)}
                          className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 pl-7">
                      {client.address}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 pl-7 text-xs font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-200/60 dark:border-slate-800/80">
                      {client.phone && (
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <Phone className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <Mail className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                          {client.email}
                        </span>
                      )}
                      {client.mapLink && (
                        <a 
                          href={client.mapLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 font-bold hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch Send to Route Modal with M3 Physics */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm m3-scrim-enter">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-md overflow-hidden m3-dialog-enter">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-500" />
                <span>Programar {orderedSelectedClients.length} Parada(s)</span>
              </h3>
              <button 
                onClick={() => setIsBatchModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSendToRoute} className="p-6 space-y-4">
              {orderedSelectedClients.length > 2 && (
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 cursor-pointer text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <input
                    type="checkbox"
                    checked={autoOptimizeOnSend}
                    onChange={(e) => setAutoOptimizeOnSend(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>
                    Proponer orden óptimo según ubicaciones ({batchPreview.optimizedDistKm.toFixed(1)} km vs {batchPreview.manualDistKm.toFixed(1)} km)
                  </span>
                </label>
              )}

              {/* Preview of stops sequence to be created */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-2xl max-h-40 overflow-y-auto space-y-1.5">
                <p className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-1">
                  {autoOptimizeOnSend && orderedSelectedClients.length > 2
                    ? 'Orden propuesto por ubicación:'
                    : 'Secuencia de selección:'}
                </p>
                {batchPreview.activeList.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Día de Entrega
                </label>
                <select
                  value={batchDeliveryDay}
                  onChange={(e) => setBatchDeliveryDay(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                >
                  {daysOfWeek.map(day => (
                    <option key={day} value={day}>
                      {day} {day.toLowerCase() === todayName.toLowerCase() ? '(Hoy)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Asignación a Móvil */}
              {vehicles.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Asignar a Móvil (Opcional)</span>
                  </label>
                  <select
                    value={batchVehicleId}
                    onChange={(e) => setBatchVehicleId(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="">Sin Asignar</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} - {v.driverName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  disabled={isSendingBatch}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingBatch}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:opacity-95 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  {isSendingBatch ? 'Agregando...' : 'Confirmar y Cargar Ruta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Client Modal with M3 Physics */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm m3-scrim-enter">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m3-dialog-enter">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Client Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Nombre Completo / Razón Social
                </label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora del Norte, Juan Pérez..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Dirección Comercial (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Av. del Libertador 4567, Piso 2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Contact Info (Phone & Email) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="+54 11 1234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Email (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="contacto@cliente.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* MapLink */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Enlace de Google Maps
                  </label>
                  {onRequestMapPick && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        onRequestMapPick({
                          editingClient,
                          name,
                          address,
                          mapLink,
                          phone,
                          email
                        });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Elegir en el mapa</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    value={mapLink}
                    onChange={(e) => {
                      setMapLink(e.target.value);
                      setLatitude(null);
                      setLongitude(null);
                      setResolveError(null);
                    }}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100 pr-12"
                  />
                  {isResolving && (
                    <div className="absolute right-4 top-3.5">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                    </div>
                  )}
                </div>

                {isResolving && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-2 animate-pulse">
                    🔄 Resolviendo enlace corto y extrayendo coordenadas...
                  </p>
                )}

                {!isResolving && latitude !== null && longitude !== null && latitude !== 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2 flex items-center gap-1">
                    <span>📍 Ubicación resuelta: {latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
                  </p>
                )}

                {!isResolving && resolveError && (
                  <p className="text-xs text-rose-500 font-semibold mt-2">
                    ⚠️ {resolveError} (Puedes elegir la ubicación directamente en el mapa).
                  </p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Add Client by Link / WhatsApp */}
      {isQuickAddModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 fill-emerald-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    Alta Rápida por Link o WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pega el enlace o mensaje compartido por el cliente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleQuickAddSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* Textarea for pasted text / link */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Pegar Link o Mensaje Completo</span>
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Pegar del Portapapeles</span>
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Pega aquí el enlace de Google Maps (maps.app.goo.gl/...) o el mensaje de WhatsApp..."
                    value={quickPastedText}
                    onChange={(e) => processPastedLocationText(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  {isQuickResolving && (
                    <div className="absolute right-3 bottom-3 flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent"></div>
                      <span>Analizando...</span>
                    </div>
                  )}
                </div>

                {/* Status: Detected or Error */}
                {quickResolveError && (
                  <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                    <span>⚠️ {quickResolveError}</span>
                  </p>
                )}

                {quickCoords && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start justify-between gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>¡Ubicación detectada correctamente!</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Coords: <strong className="font-mono">{quickCoords.lat.toFixed(6)}, {quickCoords.lng.toFixed(6)}</strong>
                      </p>
                    </div>
                    {quickMapLink && (
                      <a
                        href={quickMapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 flex-shrink-0 bg-white/70 dark:bg-slate-800 px-2 py-1 rounded-lg border border-emerald-500/20"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ver Mapa</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Editable client data auto-extracted */}
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Datos del Cliente</span>
                </div>

                {/* Client Name (Required) */}
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Nombre o Comercio <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Hermes / Kiosco San Martín"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Address & Neighborhood */}
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Dirección / Barrio (Auto-detectado por GPS)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Ej: Barrio Puerto, Calle 5"
                      value={quickAddress}
                      onChange={(e) => setQuickAddress(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Teléfono (Opcional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Ej: +54 9 3757 123456"
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Route Assignment Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToRouteImmediately}
                    onChange={(e) => setSendToRouteImmediately(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-indigo-500" />
                    <span>Cargar de inmediato a la ruta de entrega</span>
                  </div>
                </label>

                {sendToRouteImmediately && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-indigo-500/15">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                        Día de Entrega
                      </label>
                      <select
                        value={quickDeliveryDay}
                        onChange={(e) => setQuickDeliveryDay(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        {daysOfWeek.map((day) => (
                          <option key={day} value={day}>
                            {day} {day.toLowerCase() === todayName.toLowerCase() ? '(Hoy)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                        Móvil / Vehículo Asignado
                      </label>
                      <select
                        value={quickVehicleId}
                        onChange={(e) => setQuickVehicleId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        <option value="">Sin asignar / General</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            🚚 {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsQuickAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isQuickSaving || !quickCoords || !quickName.trim()}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white shadow-lg transition-all cursor-pointer ${
                    isQuickSaving || !quickCoords || !quickName.trim()
                      ? 'opacity-50 cursor-not-allowed bg-slate-500'
                      : sendToRouteImmediately
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/25'
                  }`}
                >
                  {isQuickSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Guardando...</span>
                    </>
                  ) : sendToRouteImmediately ? (
                    <>
                      <Zap className="w-4 h-4 fill-white" />
                      <span>Guardar y Cargar a Ruta</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar Cliente</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClientDirectory;
