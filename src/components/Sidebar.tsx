import React from 'react';
import { LayoutDashboard, MapPin, Truck, Users, History, Sun, Moon, X, Download, Share2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  darkMode, 
  setDarkMode,
  sidebarOpen,
  setSidebarOpen
}) => {
  const { isInstallable, installApp, showIOSPrompt, setShowIOSPrompt } = usePWAInstall();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'stops', name: 'Rutas y Paradas', icon: MapPin },
    { id: 'vehicles', name: 'Flota y Móviles', icon: Truck },
    { id: 'clients', name: 'Directorio de Clientes', icon: Users },
    { id: 'history', name: 'Historial', icon: History },
  ];

  return (
    <aside className={`fixed lg:sticky top-0 lg:top-4 left-0 bottom-0 z-50 w-64 h-screen lg:h-[calc(100vh-2rem)] m-0 lg:m-4 flex flex-col justify-between glass border-r lg:border border-slate-200/50 dark:border-slate-800/50 rounded-none lg:rounded-3xl p-6 shadow-2xl lg:shadow-xl transition-transform duration-300 lg:translate-x-0 ${
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div>
        {/* Logo Section */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/35">
              <span className="text-white font-black text-xl tracking-wider">O</span>
            </div>
            <div>
              <h1 className="font-extrabold text-lg bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent leading-none">
                Optirutas
              </h1>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Admin Panel</span>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-semibold m3-surface-interactive cursor-pointer ${
                  isActive 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 scale-[1.02]' 
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-5 h-5 m3-icon-physics ${isActive ? 'scale-110' : ''}`} />
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions & Mode Switcher */}
      <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 space-y-2">
        {/* PWA Install Button */}
        {isInstallable && (
          <button
            type="button"
            onClick={installApp}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white shadow-lg shadow-purple-500/25 m3-surface-interactive cursor-pointer group"
            title="Instalar Optirutas como App en tu celular o PC"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 animate-bounce" />
              <span>Instalar App</span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold uppercase">
              PWA
            </span>
          </button>
        )}

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 m3-surface-interactive cursor-pointer"
        >
          <span className="flex items-center gap-4">
            {darkMode ? (
              <>
                <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
                <span>Modo Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-indigo-500" />
                <span>Modo Oscuro</span>
              </>
            )}
          </span>
          <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${darkMode ? 'bg-purple-600' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </button>
      </div>

      {/* iOS Safari Installation Helper Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm m3-scrim-enter">
          <div className="glass rounded-3xl border shadow-2xl p-6 max-w-sm w-full space-y-4 m3-dialog-enter text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Instalar en iPhone / iPad
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Para tener Optirutas como App en tu pantalla de inicio:
              </p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-3.5 text-xs text-left space-y-2 text-slate-700 dark:text-slate-200 font-semibold">
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                <span>Toca el botón <b>Compartir</b> (icono con flecha hacia arriba) en Safari.</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
                <span>Desliza hacia abajo y elige <b>"Agregar a pantalla de inicio"</b>.</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSPrompt(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-black text-xs shadow-md cursor-pointer m3-surface-interactive"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
