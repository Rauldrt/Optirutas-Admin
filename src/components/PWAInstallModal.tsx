import React from 'react';
import { Share2, MoreVertical, PlusSquare, X, CheckCircle2, Smartphone } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS?: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="glass rounded-3xl border border-slate-700/80 bg-slate-900/95 shadow-2xl p-6 max-w-sm w-full space-y-4 m3-dialog-enter text-center text-slate-100 relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/30 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-purple-500/30">
          <Smartphone className="w-7 h-7" />
        </div>

        {/* Title */}
        <div>
          <h3 className="font-extrabold text-lg text-white">
            Instalar Optirutas
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isIOS 
              ? 'Tener Optirutas como App en tu iPhone o iPad'
              : 'Instala la aplicación en tu pantalla de inicio'}
          </p>
        </div>

        {/* Steps */}
        {isIOS ? (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-3 text-slate-200 font-medium">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </span>
              <p>
                Toca el botón <strong className="text-white">Compartir</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-purple-400" /> en la barra inferior de Safari.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </span>
              <p>
                Desliza hacia abajo y elige <strong className="text-white">"Agregar a pantalla de inicio"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-purple-400" />.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </span>
              <p>
                Toca <strong className="text-white">"Agregar"</strong> arriba a la derecha. ¡Listo!
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-3 text-slate-200 font-medium">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </span>
              <p>
                Toca el menú de opciones <strong className="text-white">(tres puntos ⋮)</strong> <MoreVertical className="w-3.5 h-3.5 inline text-indigo-400" /> arriba a la derecha de tu navegador.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </span>
              <p>
                Selecciona <strong className="text-white">"Instalar aplicación"</strong> o <strong className="text-white">"Agregar a la pantalla principal"</strong>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </span>
              <p>
                Confirma la instalación para tener el icono directo en tu celular o PC.
              </p>
            </div>
          </div>
        )}

        {/* Benefits badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/50 py-2 px-3 rounded-xl">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Navegación a pantalla completa y sin barras</span>
        </div>

        {/* Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-600/30 cursor-pointer m3-surface-interactive transition-all"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
