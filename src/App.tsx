import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatsGrid } from './components/StatsGrid';
import { MapView } from './components/MapContainer';
import { StopList } from './components/StopList';
import { ClientDirectory } from './components/ClientDirectory';
import { TripHistory } from './components/TripHistory';
import { 
  subscribeToStops, 
  subscribeToClients, 
  subscribeToHistory, 
  type Stop, 
  type Client, 
  type RouteHistory,
  addClient,
  addStop
} from './services/firestore';
import { Database, PlusCircle, CheckCircle2, MapPin, Menu } from 'lucide-react';

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Mobile UI States
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  
  // Real-time Firestore State
  const [stops, setStops] = useState<Stop[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<RouteHistory[]>([]);
  
  // Selected Coordinates to focus map
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | undefined>(undefined);

  // Synchronize darkMode class on documentElement
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Subscribe to Firestore collections on mount
  useEffect(() => {
    const unsubStops = subscribeToStops((data) => setStops(data));
    const unsubClients = subscribeToClients((data) => setClients(data));
    const unsubHistory = subscribeToHistory((data) => setHistory(data));

    return () => {
      unsubStops();
      unsubClients();
      unsubHistory();
    };
  }, []);

  // Reset mobile view back to 'list' when tab changes
  useEffect(() => {
    setMobileView('list');
  }, [currentTab]);

  const handleSelectLocation = (coords: [number, number]) => {
    setSelectedCoords(coords);
    // Switch to map view on mobile so they can see where the focused marker is!
    setMobileView('map');
    // Reset selected coords after a brief moment so clicking the same item triggers effect again
    setTimeout(() => setSelectedCoords(undefined), 1000);
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
          { name: 'Farmacia Central', address: 'Av. Corrientes 2000, Buenos Aires', latitude: -34.6041, longitude: -58.3956, completed: false, orderIndex: 1, deliveryDay: 'Lunes' },
          { name: 'Distribuidora Pasteur', address: 'Pasteur 400, Buenos Aires', latitude: -34.6062, longitude: -58.4012, completed: false, orderIndex: 2, deliveryDay: 'Lunes' },
          { name: 'Clínica del Sol', address: 'Av. Coronel Díaz 2200, Buenos Aires', latitude: -34.5878, longitude: -58.4111, completed: true, orderIndex: 3, deliveryDay: 'Lunes' }
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
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center">
            {/* Hamburger Trigger for Mobile */}
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-55 dark:hover:bg-slate-800/80 mr-3"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-850 dark:text-white tracking-tight leading-none">
                {currentTab === 'dashboard' && 'Panel de Control'}
                {currentTab === 'stops' && 'Planificación de Rutas'}
                {currentTab === 'clients' && 'Clientes y Ubicaciones'}
                {currentTab === 'history' && 'Historial de Entregas'}
              </h1>
              <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1 truncate">
                Monitoreo y administración logística de Optirutas
              </p>
            </div>
          </div>
          
          {/* Firestore Connection Badge */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/30 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] md:text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Conectado
            </span>
          </div>
        </header>

        {/* Content Layouts depending on tab */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Stats Dashboard */}
            <StatsGrid stops={stops} clients={clients} />

            {/* Mobile View Toggle */}
            <div className="flex lg:hidden bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-2xl w-full border border-slate-200/40 dark:border-slate-800/30">
              <button 
                onClick={() => setMobileView('list')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  mobileView === 'list' 
                    ? 'bg-white dark:bg-slate-900 text-purple-650 dark:text-purple-400 shadow-md scale-[1.01]' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Estado de Entrega
              </button>
              <button 
                onClick={() => setMobileView('map')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  mobileView === 'map' 
                    ? 'bg-white dark:bg-slate-900 text-purple-650 dark:text-purple-400 shadow-md scale-[1.01]' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Mapa Interactivo
              </button>
            </div>

            {/* Quick Actions and Map Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[450px]">
              {/* Left Column: Quick Stops Status */}
              <div className={`${mobileView === 'list' ? 'block' : 'hidden lg:flex'} glass rounded-3xl p-6 border shadow-lg flex flex-col justify-between`}>
                <div>
                  <h2 className="font-extrabold text-base mb-4">Estado de Entrega</h2>
                  {stops.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                      <Database className="w-8 h-8 mx-auto opacity-45 text-purple-500" />
                      <p className="text-xs font-bold">Sin paradas activas</p>
                      <button
                        onClick={handleGenerateMockData}
                        className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline pt-2"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Generar datos de prueba
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                      {stops.map(stop => (
                        <div key={stop.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-100/40 dark:bg-slate-900/20 border border-slate-200/30 dark:border-slate-800/20">
                          <div className="flex items-center gap-3">
                            {stop.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center text-[10px] text-amber-500 font-black flex-shrink-0">
                                {stop.orderIndex}
                              </div>
                            )}
                            <div className="truncate max-w-[140px] md:max-w-[200px]">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{stop.name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{stop.address}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectLocation([stop.latitude, stop.longitude])}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Centrar mapa"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 mt-4 text-center">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    Comparte base de datos con la app de Android para sincronización automática.
                  </p>
                </div>
              </div>

              {/* Right Columns: Map View */}
              <div className={`${mobileView === 'map' ? 'block h-[450px] lg:h-auto' : 'hidden lg:block'} lg:col-span-2`}>
                <MapView 
                  stops={stops} 
                  clients={clients} 
                  activeTab="dashboard" 
                  selectedCoordinates={selectedCoords} 
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'stops' && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Mobile View Toggle */}
            <div className="flex lg:hidden bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-2xl w-full border border-slate-200/40 dark:border-slate-800/30">
              <button 
                onClick={() => setMobileView('list')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  mobileView === 'list' 
                    ? 'bg-white dark:bg-slate-900 text-purple-650 dark:text-purple-400 shadow-md scale-[1.01]' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Lista de Paradas
              </button>
              <button 
                onClick={() => setMobileView('map')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  mobileView === 'map' 
                    ? 'bg-white dark:bg-slate-900 text-purple-650 dark:text-purple-400 shadow-md scale-[1.01]' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Mapa de la Ruta
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
              {/* Left: Stops List & Reordering */}
              <div className={`${mobileView === 'list' ? 'block' : 'hidden lg:block'} lg:col-span-1`}>
                <StopList 
                  stops={stops} 
                  clients={clients}
                  onSelectStop={handleSelectLocation} 
                />
              </div>
              {/* Right: Map view of Stops */}
              <div className={`${mobileView === 'map' ? 'block h-[450px] lg:h-auto' : 'hidden lg:block'} lg:col-span-2`}>
                <MapView 
                  stops={stops} 
                  clients={clients} 
                  activeTab="stops" 
                  selectedCoordinates={selectedCoords} 
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'clients' && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Mobile View Toggle */}
            <div className="flex lg:hidden bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-2xl w-full border border-slate-200/40 dark:border-slate-800/30">
              <button 
                onClick={() => setMobileView('list')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  mobileView === 'list' 
                    ? 'bg-white dark:bg-slate-900 text-purple-650 dark:text-purple-400 shadow-md scale-[1.01]' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Directorio
              </button>
              <button 
                onClick={() => setMobileView('map')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  mobileView === 'map' 
                    ? 'bg-white dark:bg-slate-900 text-purple-650 dark:text-purple-400 shadow-md scale-[1.01]' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Mapa de Clientes
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
              {/* Left: Clients List */}
              <div className={`${mobileView === 'list' ? 'block' : 'hidden lg:block'} lg:col-span-1`}>
                <ClientDirectory 
                  clients={clients} 
                  onSelectClient={handleSelectLocation} 
                />
              </div>
              {/* Right: Map view of Clients */}
              <div className={`${mobileView === 'map' ? 'block h-[450px] lg:h-auto' : 'hidden lg:block'} lg:col-span-2`}>
                <MapView 
                  stops={stops} 
                  clients={clients} 
                  activeTab="clients" 
                  selectedCoordinates={selectedCoords} 
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'history' && (
          <div className="flex-1">
            <TripHistory history={history} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
