import React, { useState, useEffect } from 'react';
import type { Vehicle } from '../services/firestore';
import { Truck, ShieldCheck, KeyRound, Lock, ArrowRight, UserCheck, AlertCircle, Compass } from 'lucide-react';

export interface UserSession {
  role: 'admin' | 'driver';
  vehicleId?: string;
  vehicleName?: string;
  driverName?: string;
  loginTime: number;
}

const SESSION_STORAGE_KEY = 'optirutas_session';
const MASTER_ADMIN_PIN = '1234'; // Default admin PIN

interface AuthGateProps {
  vehicles: Vehicle[];
  onLoginSuccess: (session: UserSession) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ vehicles, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'driver' | 'admin'>('driver');

  // Driver login state
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [driverPin, setDriverPin] = useState<string>('');
  const [driverError, setDriverError] = useState<string | null>(null);

  // Admin login state
  const [adminPin, setAdminPin] = useState<string>('');
  const [adminError, setAdminError] = useState<string | null>(null);

  // Set default selected vehicle when vehicles load
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Handle URL Query Params (Magic Links, e.g. from WhatsApp)
  // Example: https://optirutas-admin.vercel.app/?mode=driver&vehicleId=123&pin=1234
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');

    if (mode === 'driver') {
      const vId = params.get('vehicleId');
      const pin = params.get('pin');
      if (vId && pin && vehicles.length > 0) {
        const targetVehicle = vehicles.find(v => v.id === vId);
        if (targetVehicle) {
          const expectedPin = targetVehicle.pin || '1234';
          if (pin.trim() === expectedPin.trim()) {
            const session: UserSession = {
              role: 'driver',
              vehicleId: targetVehicle.id,
              vehicleName: targetVehicle.name,
              driverName: targetVehicle.driverName,
              loginTime: Date.now()
            };
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            // Clean URL query params without reload
            window.history.replaceState({}, document.title, window.location.pathname);
            onLoginSuccess(session);
            return;
          }
        }
      }
    } else if (mode === 'admin') {
      const pin = params.get('pin') || params.get('key');
      if (pin && pin.trim() === MASTER_ADMIN_PIN) {
        const session: UserSession = {
          role: 'admin',
          loginTime: Date.now()
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        window.history.replaceState({}, document.title, window.location.pathname);
        onLoginSuccess(session);
        return;
      }
    }
  }, [vehicles, onLoginSuccess]);

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDriverError(null);

    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) {
      setDriverError('Por favor selecciona un móvil.');
      return;
    }

    const expectedPin = vehicle.pin || '1234';
    if (driverPin.trim() !== expectedPin.trim()) {
      setDriverError('PIN incorrecto para este móvil. Consulta al administrador.');
      return;
    }

    const session: UserSession = {
      role: 'driver',
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      driverName: vehicle.driverName,
      loginTime: Date.now()
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    onLoginSuccess(session);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    if (adminPin.trim() !== MASTER_ADMIN_PIN) {
      setAdminError('PIN de Administrador incorrecto (Por defecto: 1234).');
      return;
    }

    const session: UserSession = {
      role: 'admin',
      loginTime: Date.now()
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    onLoginSuccess(session);
  };

  const activeSelectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 select-none">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-xl shadow-purple-500/30 text-white mb-2">
            <Compass className="w-8 h-8 animate-spin-slow" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Opti<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">rutas</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Sistema Inteligente de Gestión y Navegación Logística
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('driver');
                setDriverError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'driver'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Conductor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Administrador</span>
            </button>
          </div>

          {/* Tab 1: Driver Login */}
          {activeTab === 'driver' && (
            <form onSubmit={handleDriverSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Selecciona tu Móvil</span>
                  <span className="text-[10px] text-purple-400 font-medium">
                    {vehicles.length} registrados
                  </span>
                </label>

                {vehicles.length === 0 ? (
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>No hay móviles registrados aún. Ingresa como Administrador para crearlos.</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => {
                        setSelectedVehicleId(e.target.value);
                        setDriverError(null);
                      }}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                          {v.name} — {v.driverName} {v.plate ? `(${v.plate})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      ▼
                    </div>
                  </div>
                )}
              </div>

              {/* Selected vehicle preview pill */}
              {activeSelectedVehicle && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: activeSelectedVehicle.color }}
                  >
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white truncate">
                      {activeSelectedVehicle.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Chofer: <span className="font-semibold text-slate-200">{activeSelectedVehicle.driverName}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* PIN Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>PIN de Seguridad del Móvil</span>
                  <span className="text-[10px] text-slate-400">(4 dígitos)</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={driverPin}
                    onChange={(e) => {
                      setDriverPin(e.target.value.replace(/[^0-9]/g, ''));
                      setDriverError(null);
                    }}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-center tracking-[0.5em] text-lg font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans placeholder:text-slate-600"
                  />
                </div>
              </div>

              {driverError && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{driverError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={vehicles.length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <span>Iniciar Mi Jornada</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-500">
                  ¿Acceso directo? Tu administrador puede enviarte un enlace por WhatsApp para entrar sin escribir el PIN.
                </p>
              </div>
            </form>
          )}

          {/* Tab 2: Admin Login */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>PIN Maestro de Administrador</span>
                  <span className="text-[10px] text-slate-500">Por defecto: 1234</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="PIN Administrador"
                    value={adminPin}
                    onChange={(e) => {
                      setAdminPin(e.target.value);
                      setAdminError(null);
                    }}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:font-sans placeholder:text-slate-600"
                  />
                </div>
              </div>

              {adminError && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{adminError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <span>Acceder al Panel Completo</span>
                <UserCheck className="w-4 h-4" />
              </button>

              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">Acceso Total de Gestión:</p>
                <p>Configuración de flota, directorio de clientes, historial de recorridos y radar GPS en vivo.</p>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 font-medium">
          Optirutas Web PWA • Modo Offline y Sincronización en la Nube
        </p>
      </div>
    </div>
  );
};
