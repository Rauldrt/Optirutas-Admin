import React, { useState } from 'react';
import { 
  Truck, 
  Route, 
  Fuel, 
  MessageCircle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight, 
  DollarSign, 
  MapPin, 
  Zap, 
  Package, 
  Sparkles
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  // ROI Calculator Interactive State
  const [vehiclesCount, setVehiclesCount] = useState<number>(3);
  const [kmPerDay, setKmPerDay] = useState<number>(120);
  const [fuelPrice, setFuelPrice] = useState<number>(1150);
  const [fuelConsumption, setFuelConsumption] = useState<number>(11);

  // Business Days per month
  const workingDays = 22;

  // Savings Calculations
  const totalMonthlyKm = vehiclesCount * kmPerDay * workingDays;
  const currentMonthlyLiters = (totalMonthlyKm * fuelConsumption) / 100;
  const currentMonthlyExpense = currentMonthlyLiters * fuelPrice;

  // Conservative 15% route reduction with 2-opt TSP optimization
  const savedMonthlyKm = Math.round(totalMonthlyKm * 0.15);
  const savedMonthlyLiters = (savedMonthlyKm * fuelConsumption) / 100;
  const savedMonthlyExpense = Math.round(savedMonthlyLiters * fuelPrice);

  // Approximate Optirutas subscription cost
  const optirutasCost = vehiclesCount * 14000;
  const netProfitMonthly = savedMonthlyExpense - optirutasCost;

  const handleRequestPilot = () => {
    const text = `¡Hola! Me comunico desde mi empresa para solicitar la *Prueba Piloto Gratuita de 7 Días* de Optirutas con nuestra propia flota (${vehiclesCount} móvil/es).`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white font-sans antialiased">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 glass backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Optirutas
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Logística Inteligente
              </span>
            </span>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Gestión de Flota, Ruteo y Trazabilidad en Vivo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRequestPilot}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-98"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Prueba Gratis 7 Días</span>
          </button>

          {onEnterApp && (
            <button
              type="button"
              onClick={onEnterApp}
              className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer border border-slate-800"
            >
              Acceso a la App
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-8 max-w-6xl mx-auto text-center space-y-6 sm:space-y-8">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 via-indigo-500/15 to-emerald-500/10 border border-purple-500/30 text-purple-300 text-xs font-black shadow-sm">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Diseñado para Distribuidoras, Supermercados y Comercios con Delivery</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight max-w-4xl mx-auto tracking-tight">
          Ahorra combustible, optimiza tus rutas y mantén a tus clientes{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            informados por WhatsApp.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
          El sistema inteligente que ordena las entregas de tu flota por cercanía, calcula tus costos operativos en tiempo real y le envía a tus clientes un mapa con el camión en vivo sin pedirles contraseñas.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <button
            type="button"
            onClick={handleRequestPilot}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl shadow-purple-600/35 transition-all cursor-pointer hover:scale-105 active:scale-98"
          >
            <Zap className="w-5 h-5 fill-white" />
            <span>Solicitar Prueba Piloto Gratuita (7 Días)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#calculadora"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Calcular Ahorro de mi Flota</span>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-bold text-slate-400">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Sin contratos forzados ni permanencia
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Prueba piloto con tus clientes reales
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Los choferes no necesitan memorizar claves
          </span>
        </div>
      </section>

      {/* 4 Pillars Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 border-t border-slate-900 bg-slate-925/40">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">
              ¿Por qué Optirutas?
            </h2>
            <p className="text-2xl sm:text-4xl font-black text-white">
              Todo lo que necesitas para que tu logística funcione sola
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1: Smart Route Optimization */}
            <div className="glass p-6 rounded-3xl border border-slate-800/80 space-y-4 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Route className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Auto-Optimización de Rutas
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                Reordena automáticamente 15, 30 o 50 paradas por proximidad geográfica real con algoritmo 2-opt. Reduce hasta un 20% los kilómetros recorridos por día.
              </p>
            </div>

            {/* Pillar 2: Cost Calculation */}
            <div className="glass p-6 rounded-3xl border border-slate-800/80 space-y-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Fuel className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Costos y Nafta en Vivo
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                Calcula al instante los litros consumidos, el gasto en pesos, el costo de mano de obra y el costo real exacto por cada remito o entrega completada.
              </p>
            </div>

            {/* Pillar 3: Driver Zero Friction */}
            <div className="glass p-6 rounded-3xl border border-slate-800/80 space-y-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Cero Fricción para Choferes
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                El repartidor recibe un enlace por WhatsApp que abre la app al instante en su celular. Sin registrar correos, sin contraseñas y con navegación GPS guiada.
              </p>
            </div>

            {/* Pillar 4: Live Customer Tracking */}
            <div className="glass p-6 rounded-3xl border border-slate-800/80 space-y-4 relative overflow-hidden group hover:border-teal-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                Seguimiento para Clientes
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                Tus clientes reciben un link que abre un mapa en vivo con el camión en movimiento y hora estimada de llegada. Chau llamadas preguntando *"¿dónde está mi pedido?"*.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive ROI Calculator Section */}
      <section id="calculadora" className="py-16 sm:py-24 px-4 sm:px-8 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>Calculadora de Retorno de Inversión (ROI)</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            ¿Cuánto dinero ahorrará tu flota cada mes?
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Ajusta los parámetros de tu operación real para calcular el ahorro neto garantizado en combustible.
          </p>
        </div>

        {/* Calculator Widget */}
        <div className="glass rounded-3xl border border-slate-800 p-6 sm:p-10 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Control 1: Vehicles Count */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-300">Cantidad de vehículos de reparto:</span>
                <span className="text-purple-400 font-mono text-base font-black">{vehiclesCount} móviles</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                value={vehiclesCount}
                onChange={(e) => setVehiclesCount(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Control 2: Km per day per vehicle */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-300">Kilómetros recorridos por día (por móvil):</span>
                <span className="text-purple-400 font-mono text-base font-black">{kmPerDay} km / día</span>
              </div>
              <input
                type="range"
                min={40}
                max={250}
                step={5}
                value={kmPerDay}
                onChange={(e) => setKmPerDay(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Control 3: Fuel Consumption L/100km */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-300">Consumo promedio del vehículo:</span>
                <span className="text-purple-400 font-mono text-base font-black">{fuelConsumption} L / 100km</span>
              </div>
              <input
                type="range"
                min={7}
                max={22}
                step={0.5}
                value={fuelConsumption}
                onChange={(e) => setFuelConsumption(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Control 4: Fuel price */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-300">Precio del litro de combustible:</span>
                <span className="text-purple-400 font-mono text-base font-black">${fuelPrice} ARS</span>
              </div>
              <input
                type="range"
                min={900}
                max={1600}
                step={25}
                value={fuelPrice}
                onChange={(e) => setFuelPrice(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Results Badge Column */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl border border-purple-500/30 text-center space-y-4 shadow-xl">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              Ahorro Estimado Mensual
            </span>

            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-black text-white font-mono">
                +${savedMonthlyExpense.toLocaleString('es-AR')} ARS
              </p>
              <p className="text-xs text-slate-400">
                Ahorrando ~{savedMonthlyKm.toLocaleString('es-AR')} km y {Math.round(savedMonthlyLiters)} L al mes
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Gasto actual de combustible:</span>
                <span className="font-bold text-slate-200">${Math.round(currentMonthlyExpense).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Costo suscripción Optirutas:</span>
                <span className="font-bold text-purple-400">~${optirutasCost.toLocaleString('es-AR')} / mes</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-emerald-400 pt-2 border-t border-slate-800/80">
                <span>Ganancia Neta en tu Bolsillo:</span>
                <span>+${netProfitMonthly.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestPilot}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/30 transition-all cursor-pointer active:scale-98"
            >
              Comenzar Prueba Piloto de 7 Días
            </button>
          </div>
        </div>
      </section>

      {/* Target Audiences / Real-life use cases */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 border-t border-slate-900 bg-slate-925/40">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">
              Sectores Especializados
            </h2>
            <p className="text-2xl sm:text-4xl font-black text-white">
              Adaptado a la dinámica de tu negocio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Case 1: Distribuidoras Mayoristas */}
            <div className="glass p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">
                Distribuidoras Mayoristas & Preventa
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Rutas fijas y dinámicas por día de semana (Lunes, Martes...). Carga masiva de clientes, balanceo equitativo entre camionetas y control de permanencia en mostrador.
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5 font-bold">✓ Carga por link de WhatsApp</li>
                <li className="flex items-center gap-1.5 font-bold">✓ Detección de permanencia silenciosa</li>
                <li className="flex items-center gap-1.5 font-bold">✓ Bitácora histórica con costo por remito</li>
              </ul>
            </div>

            {/* Case 2: Supermercados con Delivery */}
            <div className="glass p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">
                Supermercados & Autoservicios
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Elimina las llamadas de clientes ansiosos. Cada vecino recibe automáticamente su enlace de seguimiento en vivo con el móvil llegando a su puerta.
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5 font-bold">✓ Link de seguimiento sin registro</li>
                <li className="flex items-center gap-1.5 font-bold">✓ Alerta automática de llegada</li>
                <li className="flex items-center gap-1.5 font-bold">✓ Despacho rápido desde caja</li>
              </ul>
            </div>

            {/* Case 3: Paquetería y Encomiendas */}
            <div className="glass p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">
                Comercios y Delivery Propio
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Ferreterías, corralones, panificadoras y empresas de encomiendas. Monitoreo satelital del recorrido en vivo y hoja de ruta compartida por WhatsApp.
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5 font-bold">✓ Funciona offline en zonas sin 4G</li>
                <li className="flex items-center gap-1.5 font-bold">✓ Exportación a Excel/CSV</li>
                <li className="flex items-center gap-1.5 font-bold">✓ Radar de flota en vivo</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">
            Planes Transparentes
          </h2>
          <p className="text-2xl sm:text-4xl font-black text-white">
            Precios simples adaptados a tu escala
          </p>
          <p className="text-xs sm:text-sm text-slate-400">
            Comienza con 7 días gratis. Sin costos de instalación ni comisiones ocultas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plan Inicial */}
          <div className="glass p-8 rounded-3xl border border-slate-800 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-white">Plan Inicial</h3>
                <p className="text-xs text-slate-400 font-medium">Para comercios con 1 o 2 vehículos</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black text-white font-mono">$18.000 <span className="text-sm font-normal text-slate-400">ARS / mes</span></p>
                <p className="text-[11px] text-slate-500">Monto total mensual fijo</p>
              </div>
              <ul className="text-xs text-slate-300 space-y-2.5 pt-2">
                <li className="flex items-center gap-2">✓ Hasta 2 móviles de reparto</li>
                <li className="flex items-center gap-2">✓ Auto-optimizador de rutas (TSP)</li>
                <li className="flex items-center gap-2">✓ PWA para choferes sin contraseñas</li>
                <li className="flex items-center gap-2">✓ Hojas de ruta por WhatsApp</li>
                <li className="flex items-center gap-2">✓ Directorio de clientes con geocodificación</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleRequestPilot}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Probar Gratis 7 Días
            </button>
          </div>

          {/* Plan Flota Pro (Highlighted) */}
          <div className="glass p-8 rounded-3xl border-2 border-purple-500/60 bg-gradient-to-b from-purple-950/20 to-slate-900 space-y-6 flex flex-col justify-between relative shadow-2xl shadow-purple-500/10">
            <span className="absolute -top-3 right-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
              Más Elegido
            </span>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-white">Plan Flota Pro</h3>
                <p className="text-xs text-purple-300 font-medium">De 3 a 8 vehículos en calle</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black text-white font-mono">$14.000 <span className="text-sm font-normal text-slate-400">ARS / móvil / mes</span></p>
                <p className="text-[11px] text-emerald-400 font-bold">Se paga solo con el ahorro de nafta</p>
              </div>
              <ul className="text-xs text-slate-200 space-y-2.5 pt-2">
                <li className="flex items-center gap-2">✓ Todo lo del Plan Inicial</li>
                <li className="flex items-center gap-2 font-bold text-emerald-400">✓ Link de seguimiento en vivo al cliente</li>
                <li className="flex items-center gap-2 font-bold text-emerald-400">✓ Radar GPS y telemetría en tiempo real</li>
                <li className="flex items-center gap-2 font-bold text-emerald-400">✓ Módulo de costos y auditoría de combustible</li>
                <li className="flex items-center gap-2 font-bold text-emerald-400">✓ Detección de permanencia en cliente</li>
                <li className="flex items-center gap-2">✓ Soporte prioritario por WhatsApp</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleRequestPilot}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-500/30 transition-all cursor-pointer"
            >
              Pedir Prueba Piloto de 7 Días
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-16 sm:py-20 px-4 sm:px-8 border-t border-slate-900 bg-gradient-to-b from-slate-950 to-purple-950/30">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            ¿Listo para ver a tu flota repartir en menos tiempo y gastar menos?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
            Hagamos una prueba piloto de 7 días con las paradas reales de tu próximo día de entrega. Sin compromiso ni costos iniciales.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleRequestPilot}
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all cursor-pointer hover:scale-105"
            >
              <MessageCircle className="w-5 h-5 fill-white" />
              <span>Coordinar Prueba Piloto por WhatsApp</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-8 border-t border-slate-900 text-center text-xs text-slate-500 space-y-2">
        <p className="font-bold text-slate-400">Optirutas • Plataforma Logística de Última Milla</p>
        <p>Argentina • Gestión inteligente, ahorro garantizado y trazabilidad en tiempo real.</p>
      </footer>
    </div>
  );
};
export default LandingPage;
