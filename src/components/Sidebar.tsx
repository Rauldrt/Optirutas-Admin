import React from 'react';
import { LayoutDashboard, MapPin, Users, History, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  darkMode, 
  setDarkMode 
}) => {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'stops', name: 'Rutas y Paradas', icon: MapPin },
    { id: 'clients', name: 'Directorio de Clientes', icon: Users },
    { id: 'history', name: 'Historial', icon: History },
  ];

  return (
    <aside className="w-64 h-[calc(100vh-2rem)] sticky top-4 m-4 flex flex-col justify-between glass border rounded-3xl p-6 shadow-xl transition-all duration-300">
      <div>
        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-8 px-2">
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

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 scale-[1.02]' 
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions & Mode Switcher */}
      <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all duration-300"
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
    </aside>
  );
};
