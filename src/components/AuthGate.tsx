import React, { useState, useEffect } from 'react';
import type { Vehicle } from '../services/firestore';
import { 
  Truck, ShieldCheck, KeyRound, Lock, ArrowRight, UserCheck, 
  AlertCircle, Compass, Mail, Eye, EyeOff, CheckCircle2, UserPlus,
  ArrowLeft, ShieldAlert
} from 'lucide-react';
import { 
  signInAdmin, 
  signUpAdmin, 
  resetAdminPassword, 
  formatAuthError, 
  SESSION_STORAGE_KEY, 
  MASTER_ADMIN_PIN 
} from '../services/auth';

export interface UserSession {
  role: 'admin' | 'driver';
  vehicleId?: string;
  vehicleName?: string;
  driverName?: string;
  adminEmail?: string;
  adminUid?: string;
  loginTime: number;
}

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

  // Admin login state with Firebase Auth
  const [adminSubMode, setAdminSubMode] = useState<'login' | 'signup' | 'forgot' | 'pin_backup'>('login');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [adminPin, setAdminPin] = useState<string>('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState<boolean>(false);

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

  const handleAdminEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);

    if (adminSubMode === 'login') {
      if (!adminEmail.trim() || !adminPassword) {
        setAdminError('Ingresa tu correo y contraseña.');
        return;
      }
      setIsAdminLoading(true);
      try {
        const session = await signInAdmin(adminEmail, adminPassword);
        onLoginSuccess(session);
      } catch (err: any) {
        console.error('Firebase login error:', err);
        setAdminError(formatAuthError(err.code || ''));
      } finally {
        setIsAdminLoading(false);
      }
    } else if (adminSubMode === 'signup') {
      if (!adminEmail.trim() || !adminPassword) {
        setAdminError('Completa todos los campos para el registro.');
        return;
      }
      if (adminPassword.length < 6) {
        setAdminError('La contraseña debe contener al menos 6 caracteres.');
        return;
      }
      if (adminPassword !== adminConfirmPassword) {
        setAdminError('Las contraseñas no coinciden. Verifícalas.');
        return;
      }
      setIsAdminLoading(true);
      try {
        const session = await signUpAdmin(adminEmail, adminPassword);
        onLoginSuccess(session);
      } catch (err: any) {
        console.error('Firebase signup error:', err);
        setAdminError(formatAuthError(err.code || ''));
      } finally {
        setIsAdminLoading(false);
      }
    } else if (adminSubMode === 'forgot') {
      if (!adminEmail.trim()) {
        setAdminError('Ingresa tu correo electrónico para recibir el enlace.');
        return;
      }
      setIsAdminLoading(true);
      try {
        await resetAdminPassword(adminEmail);
        setAdminSuccess('¡Listo! Revisa tu bandeja de entrada para restablecer tu contraseña.');
      } catch (err: any) {
        console.error('Firebase reset password error:', err);
        setAdminError(formatAuthError(err.code || ''));
      } finally {
        setIsAdminLoading(false);
      }
    }
  };

  const handleAdminPinSubmit = (e: React.FormEvent) => {
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
                setAdminSuccess(null);
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
                    <span>No hay móviles dados de alta. El administrador debe registrar uno primero.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {vehicles.map((v) => {
                      const isSelected = v.id === selectedVehicleId;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVehicleId(v.id);
                            setDriverError(null);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600/20 border-purple-500 shadow-md shadow-purple-500/20'
                              : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm"
                              style={{ backgroundColor: v.color || '#9333ea' }}
                            >
                              🚚
                            </div>
                            <div>
                              <p className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                {v.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Chofer: <span className="text-slate-300 font-medium">{v.driverName}</span>
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400 animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Driver PIN Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>PIN del Móvil</span>
                  {activeSelectedVehicle && (
                    <span className="text-[10px] text-slate-500">
                      Asignado a {activeSelectedVehicle.name}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="PIN de Conductor"
                    value={driverPin}
                    onChange={(e) => {
                      setDriverPin(e.target.value);
                      setDriverError(null);
                    }}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:font-sans placeholder:text-slate-600"
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

          {/* Tab 2: Admin Login with Firebase Auth Workflow */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              {/* Emergency PIN Backup Sub-Mode */}
              {adminSubMode === 'pin_backup' ? (
                <form onSubmit={handleAdminPinSubmit} className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Acceso de Respaldo por PIN</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminSubMode('login');
                        setAdminError(null);
                      }}
                      className="text-[11px] font-bold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Volver a Firebase</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>PIN Maestro de Respaldo</span>
                      <span className="text-[10px] text-slate-500">Por defecto: 1234</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="PIN Maestro"
                        value={adminPin}
                        onChange={(e) => {
                          setAdminPin(e.target.value);
                          setAdminError(null);
                        }}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:font-sans placeholder:text-slate-600"
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
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    <span>Entrar con PIN de Respaldo</span>
                    <KeyRound className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* Firebase Auth Email / Password Form (Login, Signup, Forgot) */
                <form onSubmit={handleAdminEmailAuthSubmit} className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span>
                        {adminSubMode === 'login' && 'Autenticación Segura de Administrador'}
                        {adminSubMode === 'signup' && 'Registrar Nuevo Administrador'}
                        {adminSubMode === 'forgot' && 'Recuperar Contraseña de Administrador'}
                      </span>
                    </span>
                    {adminSubMode !== 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminSubMode('login');
                          setAdminError(null);
                          setAdminSuccess(null);
                        }}
                        className="text-[11px] font-bold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Volver</span>
                      </button>
                    )}
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="admin@optirutas.com"
                        value={adminEmail}
                        onChange={(e) => {
                          setAdminEmail(e.target.value);
                          setAdminError(null);
                        }}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Password Input (Hidden in Forgot Mode) */}
                  {adminSubMode !== 'forgot' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">
                          Contraseña
                        </label>
                        {adminSubMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminSubMode('forgot');
                              setAdminError(null);
                              setAdminSuccess(null);
                            }}
                            className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                          >
                            ¿Olvidaste tu contraseña?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete={adminSubMode === 'signup' ? 'new-password' : 'current-password'}
                          placeholder="Mínimo 6 caracteres"
                          value={adminPassword}
                          onChange={(e) => {
                            setAdminPassword(e.target.value);
                            setAdminError(null);
                          }}
                          className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-11 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirm Password (only in signup) */}
                  {adminSubMode === 'signup' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">
                        Confirmar Contraseña
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          placeholder="Repite la contraseña"
                          value={adminConfirmPassword}
                          onChange={(e) => {
                            setAdminConfirmPassword(e.target.value);
                            setAdminError(null);
                          }}
                          className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Feedback: Error */}
                  {adminError && (
                    <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  {/* Feedback: Success */}
                  {adminSuccess && (
                    <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                      <span>{adminSuccess}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isAdminLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isAdminLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verificando con Firebase...</span>
                      </>
                    ) : adminSubMode === 'login' ? (
                      <>
                        <span>Acceder al Panel Completo</span>
                        <UserCheck className="w-4 h-4" />
                      </>
                    ) : adminSubMode === 'signup' ? (
                      <>
                        <span>Crear Cuenta y Entrar</span>
                        <UserPlus className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Enviar Enlace de Recuperación</span>
                        <Mail className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Mode switch options */}
                  <div className="pt-2 flex flex-col items-center gap-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                    {adminSubMode === 'login' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminSubMode('signup');
                            setAdminError(null);
                            setAdminSuccess(null);
                          }}
                          className="hover:text-indigo-300 transition-colors font-semibold cursor-pointer"
                        >
                          ¿Primer acceso o nuevo administrador? <span className="text-indigo-400 underline font-black">Crear cuenta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminSubMode('pin_backup');
                            setAdminError(null);
                            setAdminSuccess(null);
                          }}
                          className="text-slate-500 hover:text-slate-400 text-[10px] transition-colors cursor-pointer"
                        >
                          🔑 Acceso de respaldo con PIN Maestro
                        </button>
                      </>
                    )}

                    {adminSubMode === 'signup' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminSubMode('login');
                          setAdminError(null);
                          setAdminSuccess(null);
                        }}
                        className="hover:text-indigo-300 transition-colors font-semibold cursor-pointer"
                      >
                        ¿Ya tienes cuenta de Administrador? <span className="text-indigo-400 underline font-black">Iniciar Sesión</span>
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
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