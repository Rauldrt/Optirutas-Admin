import React, { useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, Search, Mail, Phone, ExternalLink, X } from 'lucide-react';
import { addClient, updateClient, deleteClient, type Client } from '../services/firestore';

// Helper to extract coordinates from Google Maps URL
const extractCoords = (url: string): { lat: number; lng: number } | null => {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  const queryMatch = url.match(/[?&](q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[2]), lng: parseFloat(queryMatch[3]) };
  }
  return null;
};

interface ClientDirectoryProps {
  clients: Client[];
  onSelectClient: (coords: [number, number]) => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({ 
  clients,
  onSelectClient 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Filter clients by search query
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingClient(null);
    setName('');
    setAddress('');
    setMapLink('');
    setPhone('');
    setEmail('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setAddress(client.address);
    setMapLink(client.mapLink || '');
    setPhone(client.phone || '');
    setEmail(client.email || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mapLink) {
      alert('Por favor completa los campos requeridos (Nombre y Enlace de Google Maps)');
      return;
    }

    const coords = extractCoords(mapLink);
    const finalLatitude = coords ? coords.lat : (editingClient ? editingClient.latitude : 0);
    const finalLongitude = coords ? coords.lng : (editingClient ? editingClient.longitude : 0);

    const clientData = {
      name,
      address: address || 'Sin dirección',
      latitude: finalLatitude,
      longitude: finalLongitude,
      mapLink,
      phone: phone || '',
      email: email || '',
    };

    try {
      if (editingClient) {
        await updateClient(editingClient.id, clientData);
      } else {
        await addClient(clientData);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Error guardando el cliente');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
      try {
        await deleteClient(id);
      } catch (err) {
        alert('Error al eliminar el cliente');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass p-6 rounded-3xl border shadow-lg">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-3 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Add Client Button */}
        <button
          onClick={openAddModal}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Cliente</span>
        </button>
      </div>

      {/* Directory Grid */}
      <div className="glass rounded-3xl border shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <h2 className="font-extrabold text-lg tracking-tight">Directorio de Clientes</h2>
          <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full font-bold">
            {filteredClients.length} Registrado(s)
          </span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-40 text-purple-500" />
            <p className="font-semibold">No se encontraron clientes.</p>
            <p className="text-xs mt-1">Intenta cambiar el término de búsqueda o registra un nuevo cliente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:gap-px bg-slate-100 dark:bg-slate-800/50 max-h-[550px] overflow-y-auto">
            {filteredClients.map((client) => (
              <div 
                key={client.id} 
                className="bg-white dark:bg-slate-900/60 p-6 flex flex-col justify-between gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-900/90 transition-colors"
              >
                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                      {client.name}
                    </h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onSelectClient([client.latitude, client.longitude])}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        title="Enfocar en mapa"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1.5 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {client.address}
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
                    {client.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-500" />
                        {client.phone}
                      </span>
                    )}
                    {client.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-indigo-500" />
                        {client.email}
                      </span>
                    )}
                    {client.mapLink && (
                      <a 
                        href={client.mapLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Google Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Client Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Nombre Completo / Razón Social
                </label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora del Norte, Juan Pérez..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Dirección Comercial (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Av. del Libertador 4567, Piso 2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Contact Info (Phone & Email) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="+54 11 1234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Email (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="contacto@cliente.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* MapLink */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Enlace de Google Maps (Obligatorio)
                </label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={mapLink}
                  onChange={(e) => setMapLink(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                  required
                />
                {(() => {
                  const coords = extractCoords(mapLink);
                  if (coords) {
                    return (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2 flex items-center gap-1">
                        <span>📍 Coordenadas detectadas: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
                      </p>
                    );
                  } else if (mapLink) {
                    return (
                      <p className="text-xs text-amber-500 font-semibold mt-2">
                        ⚠️ Enlace sin coordenadas explícitas. Se guardará la ubicación como enlace (el marcador en el mapa no aparecerá).
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClientDirectory;
