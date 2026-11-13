import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatsGrid } from './components/StatsGrid';
import { MapView } from './components/MapContainer';
import { StopList } from './components/StopList';
import { ClientDirectory } from './components/ClientDirectory';
import { TripHistory } from './components/TripHistory';
import { VehicleManagement } from './components/VehicleManagement';
import { 
  subscribeToStops, 
  subscribeToClients, 
  subscribeToHistory, 
  subscribeToVehicles,
  type Stop, 
  type Client, 
  type RouteHistory,
  type Vehicle,
  addClient,
  addStop,
  updateStop
} from './services/firestore';
import { getCurrentDayNameEs } from './utils/geo';
import { Database, PlusCircle, CheckCircle2, MapPin, Menu, Clock, Navigation, Download, LogOut } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall';
import { AuthGate, type UserSession } from './components/AuthGate';
import { DriverView } from './components/DriverView';
import { signOutAdmin, subscribeToAuth } from './services/auth';

function App() {
  const todayName = getCurrentDayNameEs();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('optirutas_dark_mode');
      if (savedTheme !== null) {
        return savedTheme === 'true';
      }
      return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
    }
    return false;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Dynamic default day: starts on today's day of the week (e.g. 'Jueves')
  const [selectedDay, setSelectedDay] = useState<string>(todayName);

  // User Authentication & Role Session State ('admin' vs 'driver')
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('optirutas_session');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const handleLogout = async () => {
    try {
      await signOutAdmin();
    } catch (e) {
      console.warn(e);
    }
    localStorage.removeItem('optirutas_session');
    setSession(null);
  };

  // Sync Firebase Auth session on startup
  useEffect(() => {
    const unsubscribe = subscribeToAuth((authSession) => {
      if (authSession) {
        setSession((prev) => {
          if (prev?.role === 'driver') return prev;
          return authSession;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // PWA Installation Hook
  const { isInstallable, installApp } = usePWAInstall();

  // Online / Offline connectivity listener
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Real-time Firestore State
  const [stops, setStops] = useState<Stop[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [history, setHistory] = useState<RouteHistory[]>([]);
  
  // Active in-app navigation stop
  const [activeNavStop, setActiveNavStop] = useState<Stop | null>(null);

  const handleStartNavigation = (stop: Stop) => {
    setActiveNavStop(stop);
    if (currentTab !== 'stops') {
      setCurrentTab('stops');
    }
    setTimeout(() => {
      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleEndNavigation = () => {
    setActiveNavStop(null);
  };

  const handleCompleteAndNextStop = async (completedStopId: string) => {
    // Mark stop completed in Firestore
    await updateStop(completedStopId, {
      completed: true,
      completedAt: Date.now()
    });

    // Find next uncompleted stop in sequence for today's route
    const currentDayStops = stops
      .filter(s => selectedDay === 'Todos' || s.deliveryDay.toLowerCase() === selectedDay.toLowerCase())
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const nextPendingStop = currentDayStops.find(
      s => s.id !== completedStopId && !s.completed
    );

    if (nextPendingStop) {
      setActiveNavStop(nextPendingStop);
    } else {
      setActiveNavStop(null);
      alert('🎉 ¡Felicitaciones! Has completado todas las paradas de la ruta.');
    }
  };
  
  // Selected Coordinates to focus map
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | undefined>(undefined);

  // Shared Client Selection State (synchronized between ClientDirectory list and Map)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [openBatchModalSignal, setOpenBatchModalSignal] = useState<number>(0);

  const handleToggleSelectClient = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  // Interactive Map Picking State (for StopList & ClientDirectory modals)
  const [stopDraftForPick, setStopDraftForPick] = useState<{
    editingStop: Stop | null;
    name: string;
    address: string;
    mapLink: string;
    orderIndex: string;
    deliveryDay: string;
  } | null>(null);
  const [pickedCoordsForStop, setPickedCoordsForStop] = useState<{
    coords: [number, number];
    draft: NonNullable<typeof stopDraftForPick>;
  } | null>(null);

  const [clientDraftForPick, setClientDraftForPick] = useState<{
    editingClient: Client | null;
    name: string;
    address: string;
    mapLink: string;
    phone: string;
    email: string;
  } | null>(null);
  const [pickedCoordsForClient, setPickedCoordsForClient] = useState<{
    coords: [number, number];
    draft: NonNullable<typeof clientDraftForPick>;
  } | null>(null);

  const [lastPickedPin, setLastPickedPin] = useState<[number, number] | null>(null);

  const isPickingLocation = stopDraftForPick !== null || clientDraftForPick !== null;

  // Synchronize darkMode class on documentElement and persist to localStorage
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('optirutas_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('optirutas_dark_mode', 'false');
    }
  }, [darkMode]);

  // Listen to OS system dark mode changes if user hasn't manually overridden
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('optirutas_dark_mode');
      if (savedTheme === null) {
        setDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // Subscribe to Firestore collections on mount
  useEffect(() => {
    const unsubStops = subscribeToStops((data) => setStops(data));
    const unsubClients = subscribeToClients((data) => setClients(data));
    const unsubVehicles = subscribeToVehicles((data) => setVehicles(data));
    const unsubHistory = subscribeToHistory((data) => setHistory(data));

    return () => {
      unsubStops();
      unsubClients();
      unsubVehicles();
      unsubHistory();
    };
  }, []);

  const handleSelectLocation = (coords: [number, number]) => {
    setSelectedCoords(coords);
    
    // Smoothly scroll to map on mobile
    setTimeout(() => {
      const mapElement = document.getElementById('map-section');
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    // Reset selected coords after a brief moment so clicking the same item triggers effect again
    setTimeout(() => setSelectedCoords(undefined), 1000);
  };

  const handleMapPick = (coords: [number, number]) => {
    setLastPickedPin(coords);
    if (stopDraftForPick) {
      setPickedCoordsForStop({ coords, draft: stopDraftForPick });
      setStopDraftForPick(null);
    } else if (clientDraftForPick) {
      setPickedCoordsForClient({ coords, draft: clientDraftForPick });
      setClientDraftForPick(null);
    }
  };

  const handleCancelMapPick = () => {
    if (stopDraftForPick) {
      setPickedCoordsForStop({
        coords: [
          stopDraftForPick.editingStop?.latitude || -34.6037,
          stopDraftForPick.editingStop?.longitude || -58.3816
        ],
        draft: stopDraftForPick
      });
      setStopDraftForPick(null);
    }
    if (clientDraftForPick) {
      setPickedCoordsForClient({
        coords: [
          clientDraftForPick.editingClient?.latitude || -34.6037,
          clientDraftForPick.editingClient?.longitude || -58.3816
        ],
        draft: clientDraftForPick
      });
      setClientDraftForPick(null);
    }
  };

  // Filtered stops for the currently selected day
  const dayFilteredStops = selectedDay === 'Todos'
    ? stops
    : stops.filter(s => s.deliveryDay.toLowerCase() === selectedDay.toLowerCase());

  const handleToggleDashboardStop = async (stop: Stop) => {
    const nextCompleted = !stop.completed;
    await updateStop(stop.id, {
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : (null as any)
    });
  };

  // Helper to generate mock data if collections are empty
  const handleGenerateMockData = async () => {
    if (window.confirm('¿Quieres cargar datos iniciales de prueba en la base de datos Firestore?')) {
      try {
        const mockClients = [
          { name: 'Farmacia Central', address: 'Av. Corrientes 2000, Buenos Aires', latitude: -34.6041, longitude: -58.3956, phone: '+54 11 4371-1234', email: 'central@farmacia.com', mapLink: 'https://maps.google.com/?q=-34.6041,-58.3956' },
          { name: 'Distribuidora Pasteur', address: 'Pasteur 400, Buenos Aires', latitude: -34.6062, longitude: -58.4012, phone: '+54 11 4952-5678', email: 'pasteur@distri.com', mapLink: 'https://maps.google.com/?q=-34.6062,-58.4012' },
          { name: 'Clínica del Sol', address: 'Av. Coronel Díaz 2200, Buenos Aires', latitude: -34.5878, longitude: -58.4111, phone: '+54 11 4821-9000', email: 'info@clinicasol.com', mapLink: 'https://maps.google.com/?q=-34.5878,-58.4111' }
        ];

        for (const client of mockClients) {
          await addClient(client);
        }

        const mockStops = [
          { name: 'Farmacia Central', address: 'Av. Corrientes 2000, Buenos Aires', latitude: -34.6041, longitude: -58.3956, completed: false, orderIndex: 1, deliveryDay: todayName },
          { name: 'Clínica del Sol', address: 'Av. Coronel Díaz 2200, Buenos Aires', latitude: -34.5878, longitude: -58.4111, completed: false, orderIndex: 2, deliveryDay: todayName },
          { name: 'Distribuidora Pasteur', address: 'Pasteur 400, Buenos Aires', latitude: -34.6062, longitude: -58.4012, completed: false, orderIndex: 3, deliveryDay: todayName }
        ];

        for (const stop of mockStops) {
          await addStop(stop);
        }

        alert('Datos de simulación cargados exitosamente.');
      } catch (err) {
        alert('Error al generar los datos de prueba.');
      }
    }
  };

  const daysOfWeek = ['Todos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // If no session active, show Authentication Gate
  if (!session) {
    return <AuthGate vehicles={vehicles} onLoginSuccess={setSession} />;
  }

  // If logged in as driver, show dedicated Driver View
  if (session.role === 'driver') {
    const driverVehicle = vehicles.find(v => v.id === session.vehicleId);

    if (!driverVehicle && vehicles.length > 0) {
      // Vehicle might have been deleted
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-white">Móvil no encontrado</h2>
            <p className="text-xs text-slate-400">
              El móvil asignado a esta sesión ya no existe o fue eliminado.
            </p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Cerrar Sesión y Volver
            </button>
          </div>
        </div>
      );
    }

    if (!driverVehicle) {
      // Still loading vehicles from Firestore
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-bold">Cargando datos del móvil...</p>
        </div>
      );
    }

    return (
      <DriverView 
        vehicle={driverVehicle} 
        stops={stops} 
        onLogout={handleLogout} 
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-x-hidden">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 md:p-6 lg:pl-2 space-y-6 w-full max-w-full lg:max-w-[calc(100vw-18rem)]">
        {/* Top Header */}
        <header className="flex items-center justify-between gap-2 sm:gap-4 w-full">
          <div className="flex items-center min-w-0 flex-1 mr-1 sm:mr-3">
            {/* Hamburger Trigger for Mobile */}
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 mr-2 sm:mr-3 flex-shrink-0 cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                {currentTab === 'dashboard' && 'Panel de Control'}
                {currentTab === 'stops' && 'Planificación de Rutas'}
                {currentTab === 'vehicles' && 'Flota y Móviles'}
                {currentTab === 'clients' && 'Clientes y Ubicaciones'}
                {currentTab === 'history' && 'Historial de Entregas'}
              </h1>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 truncate">
                Monitoreo y administración • Hoy es {todayName}
              </p>
            </div>
          </div>
          
          {/* Header Actions: PWA Install + Firestore Connection Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {isInstallable && (
              <button
                type="button"
                onClick={installApp}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl text-[10px] sm:text-[11px] font-black shadow-md shadow-purple-500/25 m3-surface-interactive cursor-pointer flex-shrink-0"
                title="Instalar Optirutas como App en tu dispositivo"
              >
                <Download className="w-3.5 h-3.5 animate-bounce" />
                <span className="hidden sm:inline">Instalar App</span>
                <span className="sm:hidden">Instalar</span>
              </button>
            )}

            {/* Online / Offline Connectivity Badge */}
            <div 
              className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl flex-shrink-0 border transition-all ${
                isOnline 
                  ? 'bg-emerald-100/60 dark:bg-emerald-950/40 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-amber-100/80 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 shadow-sm'
              }`}
              title={isOnline ? 'Conectado a internet en tiempo real' : 'Sin conexión a internet. Los cambios se guardan localmente y se sincronizarán al recuperar señal.'}
            >
              <span className="relative flex h-2 w-2">
                {isOnline ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </>
                )}
              </span>
              <span className="text-[10px] md:text-[11px] font-bold">
                {isOnline ? (
                  <>
                    <span className="sm:hidden">Online</span>
                    <span className="hidden sm:inline">Conectado</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Offline</span>
                    <span className="hidden sm:inline">Modo Offline</span>
                  </>
                )}
              </span>
            </div>

            {/* Admin User Badge if authenticated */}
            {session?.adminEmail && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold truncate max-w-[200px]" title={session.adminEmail}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="truncate">{session.adminEmail}</span>
              </span>
            )}

            {/* Admin Logout / Lock Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/60 dark:border-slate-800 text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex-shrink-0 shadow-sm"
              title="Cerrar sesión de administrador / Cambiar a conductor"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </header>

        {/* Content Layouts depending on tab */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Stats Dashboard */}
            <StatsGrid 
              stops={dayFilteredStops} 
              clients={clients} 
              vehicles={vehicles}
              selectedDay={selectedDay}
            />

            {/* Quick Actions and Map Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[450px]">
              {/* Left Column: Quick Stops Status */}
              <div className="glass rounded-3xl p-6 border shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="font-extrabold text-base">Estado de Entrega</h2>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500"
                    >
                      {daysOfWeek.map(day => (
                        <option key={day} value={day}>
                          {day === 'Todos'
                            ? 'Todos los días'
                            : `${day}${day.toLowerCase() === todayName.toLowerCase() ? ' (Hoy)' : ''}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {dayFilteredStops.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                      <Database className="w-8 h-8 mx-auto opacity-45 text-purple-500" />
                      <p className="text-xs font-bold">
                        {stops.length === 0 ? 'Sin paradas activas' : `Sin paradas para ${selectedDay}`}
                      </p>
                      {stops.length > 0 && selectedDay !== 'Todos' && (
                        <button
                          onClick={() => setSelectedDay('Todos')}
                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline pt-1 cursor-pointer"
                        >
                          Ver todas las paradas de la semana ({stops.length})
                        </button>
                      )}
                      {stops.length === 0 && (
                        <button
                          onClick={handleGenerateMockData}
                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline pt-2 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Generar datos de prueba
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[310px] overflow-y-auto pr-1">
                      {dayFilteredStops.map(stop => (
                        <div key={stop.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-100/40 dark:bg-slate-900/20 border border-slate-200/30 dark:border-slate-800/20">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => handleToggleDashboardStop(stop)}
                              title={stop.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                              className="flex-shrink-0 cursor-pointer transition-transform hover:scale-110"
                            >
                              {stop.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center text-[10px] text-amber-500 font-black">
                                  {stop.orderIndex}
                                </div>
                              )}
                            </button>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-xs font-bold truncate ${stop.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {stop.name}
                                </p>
                                {stop.completed && stop.completedAt && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(stop.completedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                {stop.address} {selectedDay === 'Todos' ? `• ${stop.deliveryDay}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!stop.completed && (
                              <button
                                onClick={() => handleStartNavigation(stop)}
                                className="p-1.5 text-blue-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                title="Navegar hacia esta parada"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleSelectLocation([stop.latitude, stop.longitude])}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex-shrink-0"
                              title="Centrar mapa"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 mt-4 text-center">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    Sincronizado en tiempo real con la app Android de Optirutas.
                  </p>
                </div>
              </div>

              {/* Right Columns: Map View */}
              <div id="map-section" className="block h-[450px] lg:h-auto lg:col-span-2">
                <MapView 
                  stops={dayFilteredStops} 
                  clients={clients} 
                  vehicles={vehicles}
                  activeTab="dashboard" 
                  selectedCoordinates={selectedCoords}
                  selectedDayLabel={selectedDay}
                  activeNavStop={activeNavStop}
                  onStartNavigation={handleStartNavigation}
                  onEndNavigation={handleEndNavigation}
                  onCompleteAndNextStop={handleCompleteAndNextStop}
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'stops' && (
          <div className="space-y-6 flex-1 flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
              {/* Left: Stops List & Reordering */}
              <div className="block lg:col-span-1">
                <StopList 
                  stops={stops} 
                  clients={clients}
                  vehicles={vehicles}
                  onSelectStop={handleSelectLocation}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  activeNavStop={activeNavStop}
                  onStartNavigation={handleStartNavigation}
                  onRequestMapPick={(draft) => {
                    setStopDraftForPick(draft);
                    setTimeout(() => {
                      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  pickedCoordsForStop={pickedCoordsForStop}
                  onClearPickedCoords={() => setPickedCoordsForStop(null)}
                  onRequestClientMapPick={(draft) => {
                    setClientDraftForPick(draft);
                    setTimeout(() => {
                      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  pickedCoordsForClient={pickedCoordsForClient}
                  onClearPickedClientCoords={() => setPickedCoordsForClient(null)}
                />
              </div>
              {/* Right: Map view of Stops (Filtered by Selected Day!) */}
              <div id="map-section" className="block h-[450px] lg:h-auto lg:col-span-2">
                <MapView 
                  stops={dayFilteredStops} 
                  clients={clients} 
                  vehicles={vehicles}
                  activeTab="stops" 
                  selectedCoordinates={selectedCoords}
                  selectedDayLabel={selectedDay}
                  isPickingLocation={isPickingLocation}
                  onPickLocation={handleMapPick}
                  onCancelPickLocation={handleCancelMapPick}
                  pickedCoordinates={lastPickedPin}
                  activeNavStop={activeNavStop}
                  onStartNavigation={handleStartNavigation}
                  onEndNavigation={handleEndNavigation}
                  onCompleteAndNextStop={handleCompleteAndNextStop}
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'vehicles' && (
          <div className="space-y-6 flex-1 flex flex-col">
            <VehicleManagement 
              vehicles={vehicles} 
              stops={stops} 
              onSelectVehicleForRoute={() => {
                setCurrentTab('stops');
              }}
            />
          </div>
        )}

        {currentTab === 'clients' && (
          <div className="space-y-6 flex-1 flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
              {/* Left: Clients List */}
              <div className="block lg:col-span-1">
                <ClientDirectory 
                  clients={clients}
                  stops={stops}
                  vehicles={vehicles}
                  onSelectClient={handleSelectLocation}
                  selectedClientIds={selectedClientIds}
                  onSetSelectedClientIds={setSelectedClientIds}
                  openBatchModalSignal={openBatchModalSignal}
                  onSwitchToStopsDay={(day) => {
                    setSelectedDay(day);
                    setCurrentTab('stops');
                  }}
                  onRequestMapPick={(draft) => {
                    setClientDraftForPick(draft);
                    setTimeout(() => {
                      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  pickedCoordsForClient={pickedCoordsForClient}
                  onClearPickedCoords={() => setPickedCoordsForClient(null)}
                />
              </div>
              {/* Right: Map view of Clients */}
              <div id="map-section" className="block h-[450px] lg:h-auto lg:col-span-2">
                <MapView 
                  stops={stops} 
                  clients={clients} 
                  activeTab="clients" 
                  selectedCoordinates={selectedCoords}
                  isPickingLocation={isPickingLocation}
                  onPickLocation={handleMapPick}
                  onCancelPickLocation={handleCancelMapPick}
                  pickedCoordinates={lastPickedPin}
                  selectedClientIds={selectedClientIds}
                  onToggleSelectClient={handleToggleSelectClient}
                  onSetSelectedClients={setSelectedClientIds}
                  onRequestSendSelectedClients={() => setOpenBatchModalSignal(prev => prev + 1)}
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'history' && (
          <div className="flex-1">
            <TripHistory 
              history={history}
              clients={clients}
              stops={stops}
              vehicles={vehicles}
              onSwitchToStopsTab={(targetDay) => {
                setSelectedDay(targetDay);
                setCurrentTab('stops');
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
