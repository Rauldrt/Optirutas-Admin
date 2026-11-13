import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, KeyRound, Lock, Eye, EyeOff, CheckCircle2, 
  AlertCircle, X, Sparkles, RefreshCw 
} from 'lucide-react';
import { getMasterAdminPin, updateMasterAdminPin } from '../services/auth';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [currentPin, setCurrentPin] = useState<string>('');
  const [showCurrentPin, setShowCurrentPin] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current PIN from Firestore on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setNewPin('');
      setConfirmPin('');
      setIsLoading(true);
      getMasterAdminPin()
        .then((pin) => {
          setCurrentPin(pin);
        })
        .catch((err) => {
          console.error(err);
          setError('No se pudo obtener el PIN actual.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanNewPin = newPin.trim();
    if (!cleanNewPin) {
      setError('Por favor ingresa un nuevo PIN.');
      return;
    }

    if (cleanNewPin.length < 4) {
      setError('El PIN debe tener al menos 4 caracteres.');
      return;
    }

    if (cleanNewPin !== confirmPin.trim()) {
      setError('Los campos de nuevo PIN no coinciden.');
      return;
    }

    setIsSaving(true);
    try {
      await updateMasterAdminPin(cleanNewPin);
      setCurrentPin(cleanNewPin);
      setNewPin('');
      setConfirmPin('');
      setSuccess('¡PIN Maestro actualizado con éxito en Firestore!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al actualizar el PIN Maestro.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col m3-dialog-enter">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                Seguridad y PIN Maestro
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestión centralizada en Firestore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Current PIN Card */}
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>PIN Maestro Actual Vigente</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showCurrentPin ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>Ocultar</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>Ver</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Consultando Firestore...</span>
                </div>
              ) : (
                <p className="font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-widest">
                  {showCurrentPin ? currentPin : '••••'}
                </p>
              )}
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                Activo
              </span>
            </div>
          </div>

          {/* Change PIN Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>Cambiar PIN Maestro</span>
            </div>

            {/* New PIN */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                Nuevo PIN (Mínimo 4 dígitos)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={10}
                  required
                  placeholder="Ej: 5824"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-10 py-2.5 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New PIN */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                Confirmar Nuevo PIN
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={10}
                  required
                  placeholder="Repite el nuevo PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                <span>{success}</span>
              </div>
            )}

            {/* Informative Note */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
              ℹ️ Este PIN es la <strong>llave de respaldo</strong> para ingresar al panel de administración cuando utilices la opción de PIN o en caso de emergencia.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="submit"
                disabled={isSaving || !newPin.trim() || !confirmPin.trim()}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white shadow-lg transition-all cursor-pointer ${
                  isSaving || !newPin.trim() || !confirmPin.trim()
                    ? 'opacity-50 cursor-not-allowed bg-slate-500'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Actualizar PIN Maestro</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
