import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Settings, Save, Store, Clock, MapPin, Phone, 
  Globe, Bell, Palette, Shield, CreditCard
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRestaurant } from '../../context/RestaurantContext';

const AdminSettings = () => {
  const { getSettings, updateSettings } = useRestaurant();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [settings, setSettings] = useState({
    // General
    restaurantName: 'GUSTO.BO',
    slogan: 'Sabor que inspira',
    phone: '+591 4 4567890',
    email: 'contacto@gusto.bo',
    address: 'Av. Heroínas #1234, Cochabamba',
    
    // Horarios
    openTime: '11:00',
    closeTime: '23:00',
    daysOpen: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'],
    
    // Notificaciones
    soundEnabled: true,
    emailNotifications: true,
    kitchenAlerts: true,
    
    // Apariencia
    primaryColor: 'amber',
    darkMode: true,
    
    // Pagos
    acceptCash: true,
    acceptCard: true,
    acceptQR: true,
    taxRate: 13,
    tipSuggestions: [10, 15, 20],
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await getSettings();
        if (data && Object.keys(data).length > 0) {
          setSettings(prev => ({
            ...prev,
            ...data,
          }));
        }
        setError(null);
      } catch (err) {
        console.error('Error cargando configuración:', err);
        setError('No se pudieron cargar las configuraciones. Usando valores predeterminados.');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [getSettings]);

  const handleSave = async () => {
    try {
      await updateSettings(settings);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      setError('No se pudieron guardar las configuraciones. Intenta de nuevo.');
      setSaved(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Store },
    { id: 'hours', label: 'Horarios', icon: Clock },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'payments', label: 'Pagos', icon: CreditCard },
  ];

  const days = [
    { id: 'lun', label: 'L' },
    { id: 'mar', label: 'M' },
    { id: 'mie', label: 'X' },
    { id: 'jue', label: 'J' },
    { id: 'vie', label: 'V' },
    { id: 'sab', label: 'S' },
    { id: 'dom', label: 'D' },
  ];

  const toggleDay = (dayId) => {
    setSettings(prev => ({
      ...prev,
      daysOpen: prev.daysOpen.includes(dayId)
        ? prev.daysOpen.filter(d => d !== dayId)
        : [...prev.daysOpen, dayId]
    }));
  };

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Configuración</h1>
            <p className="text-sm text-gray-500">Ajustes del restaurante</p>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          disabled={loading || saved}
          className={clsx(
            "px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all",
            saved 
              ? "bg-emerald-500 text-white" 
              : "bg-gradient-to-r from-amber-500 to-orange-600 text-white",
            (loading || saved) && "opacity-50 cursor-not-allowed"
          )}
        >
          <Save size={18} />
          <span>{saved ? '¡Guardado!' : (loading ? 'Cargando...' : 'Guardar')}</span>
        </motion.button>
       </div>

       {/* Loading & Error */}
       {loading && (
         <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
           <p className="text-blue-400 text-sm">Cargando configuración...</p>
         </div>
       )}
       {error && (
         <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
           <p className="text-red-400 text-sm">{error}</p>
         </div>
       )}

       {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-amber-500 text-white" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        {/* General Tab */}
        {activeTab === 'general' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Store size={18} className="text-amber-400" />
                Información del Restaurante
              </h3>
              
              <div className="grid gap-4">
                <div>
                  <label className="text-sm text-gray-400">Nombre</label>
                  <input
                    type="text"
                    value={settings.restaurantName}
                    onChange={(e) => setSettings(prev => ({ ...prev, restaurantName: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Slogan</label>
                  <input
                    type="text"
                    value={settings.slogan}
                    onChange={(e) => setSettings(prev => ({ ...prev, slogan: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Teléfono</label>
                    <input
                      type="text"
                      value={settings.phone}
                      onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Email</label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Dirección</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Hours Tab */}
        {activeTab === 'hours' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                Horario de Atención
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Hora de Apertura</label>
                  <input
                    type="time"
                    value={settings.openTime}
                    onChange={(e) => setSettings(prev => ({ ...prev, openTime: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Hora de Cierre</label>
                  <input
                    type="time"
                    value={settings.closeTime}
                    onChange={(e) => setSettings(prev => ({ ...prev, closeTime: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 block mb-2">Días de Atención</label>
                <div className="flex gap-2">
                  {days.map(day => (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      className={clsx(
                        "w-10 h-10 rounded-xl font-medium transition-all",
                        settings.daysOpen.includes(day.id)
                          ? "bg-amber-500 text-white"
                          : "bg-white/5 text-gray-500"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Bell size={18} className="text-purple-400" />
                Notificaciones
              </h3>
              
              {[
                { key: 'soundEnabled', label: 'Sonidos de alerta', desc: 'Notificaciones sonoras para nuevos pedidos' },
                { key: 'emailNotifications', label: 'Notificaciones por email', desc: 'Recibir resumen diario por correo' },
                { key: 'kitchenAlerts', label: 'Alertas de cocina', desc: 'Alertas cuando un pedido lleva mucho tiempo' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02]">
                  <div>
                    <p className="text-white font-medium">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={clsx(
                      "w-12 h-6 rounded-full transition-all relative",
                      settings[item.key] ? "bg-amber-500" : "bg-white/10"
                    )}
                  >
                    <span className={clsx(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      settings[item.key] ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400" />
                Métodos de Pago
              </h3>
              
              {[
                { key: 'acceptCash', label: 'Efectivo', emoji: '💵' },
                { key: 'acceptCard', label: 'Tarjeta', emoji: '💳' },
                { key: 'acceptQR', label: 'QR', emoji: '📱' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.emoji}</span>
                    <p className="text-white font-medium">{item.label}</p>
                  </div>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={clsx(
                      "w-12 h-6 rounded-full transition-all relative",
                      settings[item.key] ? "bg-emerald-500" : "bg-white/10"
                    )}
                  >
                    <span className={clsx(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      settings[item.key] ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="font-semibold text-white">Impuestos y Propinas</h3>
              
              <div>
                <label className="text-sm text-gray-400">Tasa de Impuesto (%)</label>
                <input
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => setSettings(prev => ({ ...prev, taxRate: parseFloat(e.target.value) }))}
                  className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-400 block mb-2">Sugerencias de Propina (%)</label>
                <div className="flex gap-2">
                  {settings.tipSuggestions.map((tip, i) => (
                    <input
                      key={i}
                      type="number"
                      value={tip}
                      onChange={(e) => {
                        const newTips = [...settings.tipSuggestions];
                        newTips[i] = parseInt(e.target.value);
                        setSettings(prev => ({ ...prev, tipSuggestions: newTips }));
                      }}
                      className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-center focus:outline-none focus:border-amber-500/50"
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
