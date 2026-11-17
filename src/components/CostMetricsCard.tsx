import React, { useState, useMemo } from 'react';
import { 
  Fuel, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Settings2, 
  Share2, 
  Download, 
  Truck, 
  Timer,
  X,
  Check,
  RotateCcw
} from 'lucide-react';
import type { Stop, Vehicle } from '../services/firestore';
import { 
  calculateTripCostMetrics, 
  getStoredCostSettings, 
  saveStoredCostSettings, 
  formatCurrency, 
  formatDurationHours,
  DEFAULT_COST_SETTINGS,
  type CostSettings,
  type TripCostMetrics
} from '../utils/costCalculator';

interface CostMetricsCardProps {
  stops: Stop[];
  vehicles?: Vehicle[];
  selectedDay?: string;
}

export const CostMetricsCard: React.FC<CostMetricsCardProps> = ({ 
  stops, 
  vehicles = [], 
  selectedDay = 'Hoy' 
}) => {
  const [settings, setSettings] = useState<CostSettings>(getStoredCostSettings);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');

  // Form state for config modal
  const [formFuelPrice, setFormFuelPrice] = useState(settings.fuelPricePerLiter.toString());
  const [formConsumption, setFormConsumption] = useState(settings.defaultConsumptionL100km.toString());
  const [formLaborRate, setFormLaborRate] = useState(settings.laborHourlyRate.toString());

  // Filter stops by selected vehicle if applicable
  const targetStops = useMemo(() => {
    if (selectedVehicleId === 'all') return stops;
    return stops.filter(s => s.vehicleId === selectedVehicleId);
  }, [stops, selectedVehicleId]);

  const targetVehicle = useMemo(() => {
    if (selectedVehicleId === 'all') return null;
    return vehicles.find(v => v.id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  // Compute metrics dynamically
  const metrics: TripCostMetrics = useMemo(() => {
    return calculateTripCostMetrics(targetStops, settings, targetVehicle);
  }, [targetStops, settings, targetVehicle]);

  const handleOpenConfig = () => {
    setFormFuelPrice(settings.fuelPricePerLiter.toString());
    setFormConsumption(settings.defaultConsumptionL100km.toString());
    setFormLaborRate(settings.laborHourlyRate.toString());
    setIsConfigOpen(true);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const newSettings: CostSettings = {
      fuelPricePerLiter: Math.max(1, parseFloat(formFuelPrice) || DEFAULT_COST_SETTINGS.fuelPricePerLiter),
      defaultConsumptionL100km: Math.max(0.1, parseFloat(formConsumption) || DEFAULT_COST_SETTINGS.defaultConsumptionL100km),
      laborHourlyRate: Math.max(0, parseFloat(formLaborRate) || DEFAULT_COST_SETTINGS.laborHourlyRate),
      currencySymbol: settings.currencySymbol || '$',
    };
    setSettings(newSettings);
    saveStoredCostSettings(newSettings);
    setIsConfigOpen(false);
  };

  const handleResetDefaults = () => {
    setFormFuelPrice(DEFAULT_COST_SETTINGS.fuelPricePerLiter.toString());
    setFormConsumption(DEFAULT_COST_SETTINGS.defaultConsumptionL100km.toString());
    setFormLaborRate(DEFAULT_COST_SETTINGS.laborHourlyRate.toString());
  };

  // Export cost audit to CSV
  const handleExportCostCSV = () => {
    const headers = [
      'Dia',
      'Movil',
      'Entregas Totales',
      'Entregas Completadas',
      'Distancia Recorrida (km)',
      'Duracion Total',
      'Tiempo en Clientes',
      'Tiempo en Transito',
      'Litros Estimados',
      'Precio Combustible ($/L)',
      'Costo Combustible ($)',
      'Valor Hora Hombre ($/h)',
      'Costo Horas Hombre ($)',
      'Costo Total ($)',
      'Costo por Entrega ($)'
    ];

    const row = [
      selectedDay,
      targetVehicle ? targetVehicle.name : 'Flota Completa',
      metrics.totalStops,
      metrics.completedStops,
      metrics.totalDistanceKm.toFixed(1),
      formatDurationHours(metrics.totalDurationMinutes),
      formatDurationHours(metrics.dwellTimeTotalMinutes),
      formatDurationHours(metrics.transitTimeTotalMinutes),
      metrics.estimatedFuelLiters.toFixed(2),
      settings.fuelPricePerLiter,
      metrics.estimatedFuelCost,
      settings.laborHourlyRate,
      metrics.estimatedLaborCost,
      metrics.totalCost,
      metrics.costPerStop
    ];

    const csvContent = '\uFEFF' + [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_costos_recorrido_${selectedDay.toLowerCase()}.csv`;
    link.click();
  };

  // Share executive summary via WhatsApp
  const handleShareCostWhatsApp = () => {
    const vehicleText = targetVehicle ? `🚚 *Móvil:* ${targetVehicle.name} (${targetVehicle.driverName})\n` : '';
    const lines = [
      `📊 *BALANCE Y ANÁLISIS DE COSTOS LOGÍSTICOS - OPTIRUTAS*`,
      `📅 *Jornada:* ${selectedDay}`,
      vehicleText,
      `✅ *Entregas Realizadas:* ${metrics.completedStops} de ${metrics.totalStops} (${metrics.completionRate}%)`,
      `📍 *Distancia Total:* ${metrics.totalDistanceKm.toFixed(1)} km`,
      `⏱️ *Tiempo Total de Jornada:* ${formatDurationHours(metrics.totalDurationMinutes)}`,
      `   • 🏬 En Clientes: ${formatDurationHours(metrics.dwellTimeTotalMinutes)} (prom. ${metrics.avgDwellMinutesPerStop}m/parada)`,
      `   • 🚗 En Tránsito: ${formatDurationHours(metrics.transitTimeTotalMinutes)}`,
      `────────────────────────────`,
      `⛽ *Combustible Estimado:* ${metrics.estimatedFuelLiters.toFixed(1)} L (${formatCurrency(metrics.estimatedFuelCost)})`,
      `👤 *Costo Horas Hombre:* ${formatCurrency(metrics.estimatedLaborCost)}`,
      `💰 *COSTO TOTAL OPERATIVO:* ${formatCurrency(metrics.totalCost)}`,
      `🎯 *Costo Real por Entrega:* ${formatCurrency(metrics.costPerStop)} / cliente`,
      `────────────────────────────`,
      `⚡ *Ritmo Operativo:* ${metrics.stopsPerHour} entregas/hora`
    ].filter(Boolean);

    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Time distribution percentages
  const transitPercent = metrics.totalDurationMinutes > 0 
    ? Math.round((metrics.transitTimeTotalMinutes / metrics.totalDurationMinutes) * 100) 
    : 50;
  const dwellPercent = Math.max(0, 100 - transitPercent);

  return (
    <div className="glass rounded-3xl p-6 border shadow-xl space-y-6 relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-emerald-500/10 blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                Análisis de Costos y Rendimiento Logístico
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cálculo en tiempo real de combustible, horas hombre y costo unitario por entrega.
              </p>
            </div>
          </div>
        </div>

        {/* Vehicle filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          {vehicles.length > 1 && (
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Flota Completa ({vehicles.length} móviles)</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.driverName})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleOpenConfig}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Ajustar precio de combustible, consumo y valor hora"
          >
            <Settings2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">Tarifas</span>
          </button>

          <button
            type="button"
            onClick={handleExportCostCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Descargar reporte en formato Excel (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={handleShareCostWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            title="Compartir reporte ejecutivo por WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Combustible Estimado */}
        <div className="glass rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Gasto en Combustible
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(metrics.estimatedFuelCost)}
          </p>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
            <span>~{metrics.estimatedFuelLiters} L estimados</span>
            <span>{metrics.totalDistanceKm.toFixed(1)} km</span>
          </div>
        </div>

        {/* 2. Costo Horas Hombre */}
        <div className="glass rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Costo Horas Hombre
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(metrics.estimatedLaborCost)}
          </p>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
            <span>{formatDurationHours(metrics.totalDurationMinutes)} de jornada</span>
            <span>{metrics.stopsPerHour} paradas/h</span>
          </div>
        </div>

        {/* 3. Costo Unitario por Parada */}
        <div className="glass rounded-2xl p-4 border border-emerald-500/40 bg-emerald-500/5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Costo Real por Entrega
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
            {formatCurrency(metrics.costPerStop)}
          </p>
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-300/80 mt-2">
            <span>Comb.: {formatCurrency(metrics.fuelCostPerStop)}</span>
            <span>Mano obra: {formatCurrency(metrics.laborCostPerStop)}</span>
          </div>
        </div>

        {/* 4. Costo Total del Recorrido */}
        <div className="glass rounded-2xl p-4 border border-indigo-500/40 bg-indigo-500/5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
              Costo Operativo Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 tracking-tight">
            {formatCurrency(metrics.totalCost)}
          </p>
          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800/80 dark:text-indigo-300/80 mt-2">
            <span>{metrics.completedStops} entregas listas</span>
            <span>{metrics.completionRate}% efectividad</span>
          </div>
        </div>
      </div>

      {/* Operational Breakdown Bar (Transit vs Dwell Time) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-bold">
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Timer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Desglose de Horas Hombre: Tránsito vs. Atención a Clientes</span>
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-extrabold">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>En Tránsito / Rodaje: {formatDurationHours(metrics.transitTimeTotalMinutes)} ({transitPercent}%)</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>En Clientes (Descarga / Cobro): {formatDurationHours(metrics.dwellTimeTotalMinutes)} ({dwellPercent}%)</span>
            </span>
          </div>
        </div>

        {/* Dual Stacked Progress Bar */}
        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
            style={{ width: `${transitPercent}%` }}
            title={`Tránsito en calle: ${transitPercent}%`}
          />
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${dwellPercent}%` }}
            title={`En clientes: ${dwellPercent}%`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <span>
            <b>Promedio en cliente:</b> ~{metrics.avgDwellMinutesPerStop} min por parada
          </span>
          <span>
            <b>Tarifa configurada:</b> Combustible ${settings.fuelPricePerLiter}/L • Rendimiento {metrics.consumptionL100km} L/100km • Hora ${settings.laborHourlyRate}/h
          </span>
        </div>
      </div>

      {/* Modal: Cost Settings Configuration */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Parámetros de Costos Operativos
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ajusta los valores de combustible y mano de obra para tu empresa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Precio de Combustible por Litro ($ / L)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formFuelPrice}
                    onChange={(e) => setFormFuelPrice(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-8 pr-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    placeholder="1250"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Costo de diésel o nafta vigente en tu zona.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Consumo Estimado del Vehículo (Litros / 100 km)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formConsumption}
                    onChange={(e) => setFormConsumption(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    placeholder="11.0"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">L/100km</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Ranger/Camioneta: ~11-12 L/100km • Furgón/Utilitario: ~8-9 L/100km.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor Hora Hombre / Chofer ($ / hora)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={formLaborRate}
                    onChange={(e) => setFormLaborRate(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-8 pr-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    placeholder="5000"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Costo horario de la cuadrilla o chofer afectado al recorrido.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Valores sugeridos</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar y Recalcular</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
