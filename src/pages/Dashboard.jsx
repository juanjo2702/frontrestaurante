import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, 
  Clock, ArrowUpRight, ArrowDownRight, MoreHorizontal,
  Bell, Calendar, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { Skeleton, SkeletonStats, SkeletonCard, SkeletonTable } from '../components/Skeleton';

const Dashboard = () => {
  const { user } = useAuth();

  const getWelcomeMessage = () => {
    switch (user.role) {
      case 'admin': return 'Panel de Administración';
      case 'waiter': return 'Portal de Meseros';
      case 'kitchen': return 'Pantalla de Cocina';
      case 'cashier': return 'Terminal de Caja';
      case 'client': return 'Bienvenido a GUSTO.BO';
      default: return 'Panel Principal';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const [dashboardStats, setDashboardStats] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Obtener reportes del día
      const reportsRes = await api.get('/reports?period=day');
      const reportsData = reportsRes.data;
      
      // Obtener pedidos recientes (últimos 4)
      const ordersRes = await api.get('/orders?estado=pendiente,preparando,listo,servido');
      const allOrders = ordersRes.data;
      
      // Calcular pedidos activos (pendiente + preparando)
      const activeOrders = allOrders.filter(o => o.estado === 'pendiente' || o.estado === 'preparando').length;
      
      // Obtener tiempo de espera estimado
      const waitingRes = await api.get('/waiting-time');
      const waitingData = waitingRes.data;
      const avgTime = `${waitingData.minutes}min`;
      
      // Construir stats
      const revenueChange = reportsData.changes?.revenue ?? 0;
      const clientsChange = reportsData.changes?.clients ?? 0;
      const ordersChange = reportsData.changes?.orders ?? 0;
      const statsData = [
        { 
          label: 'Ventas del día', 
          value: `Bs. ${Number(reportsData.stats.revenue).toLocaleString('es-BO')}`, 
          change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
          positive: revenueChange >= 0,
          icon: DollarSign,
          gradient: 'from-emerald-500 to-green-600',
          glow: 'shadow-emerald-500/20'
        },
        { 
          label: 'Pedidos activos', 
          value: activeOrders.toString(), 
          change: `${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%`,
          positive: ordersChange >= 0,
          icon: ShoppingBag,
          gradient: 'from-amber-500 to-orange-600',
          glow: 'shadow-amber-500/20'
        },
        { 
          label: 'Clientes hoy', 
          value: reportsData.stats.clients.toString(), 
          change: `${clientsChange >= 0 ? '+' : ''}${clientsChange.toFixed(1)}%`,
          positive: clientsChange >= 0,
          icon: Users,
          gradient: 'from-violet-500 to-purple-600',
          glow: 'shadow-violet-500/20'
        },
        { 
          label: 'Tiempo promedio', 
          value: avgTime, 
          change: '', // TODO: implementar cambio real de tiempo promedio
          positive: true,
          icon: Clock,
          gradient: 'from-cyan-500 to-blue-600',
          glow: 'shadow-cyan-500/20'
        },
      ];
      setDashboardStats(statsData);
      
      // Transformar pedidos recientes
      const recentOrdersData = allOrders
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
        .map(order => {
          const timeDiff = Math.floor((new Date() - new Date(order.created_at)) / (1000 * 60));
          const timeText = timeDiff < 1 ? 'Hace un momento' : `Hace ${timeDiff} min`;
          
          const statusMap = {
            'pendiente': 'En preparación',
            'preparando': 'En preparación',
            'listo': 'Servido',
            'servido': 'Servido',
            'pagado': 'Pagado',
            'cancelado': 'Cancelado'
          };
          
          return {
            id: `#${order.id}`,
            table: order.mesa ? `Mesa ${order.mesa.numero}` : 'Para Llevar',
            status: statusMap[order.estado] || 'En preparación',
            time: timeText,
            amount: `Bs. ${Number(order.total).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`
          };
        });
      setRecentOrders(recentOrdersData);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'En preparación': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Servido': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Pagado': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header Section */}
      <motion.div variants={item} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <p className="text-gray-500 text-sm mb-1">{getGreeting()}</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-1">
            {getWelcomeMessage()}
          </h1>
          <p className="text-gray-400">
            Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 font-semibold">{user.name}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all relative"
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all flex items-center gap-2"
          >
            <span>Nueva Orden</span>
            <ArrowUpRight size={18} />
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {loading ? (
           Array.from({ length: 4 }).map((_, idx) => (
             <div key={idx} className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 animate-pulse">
               <div className="h-10 bg-white/10 rounded-xl mb-4"></div>
               <div className="space-y-2">
                 <div className="h-4 bg-white/10 rounded w-1/2"></div>
                 <div className="h-8 bg-white/10 rounded w-3/4"></div>
               </div>
             </div>
           ))
         ) : (
           dashboardStats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`
              p-6 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 
              hover:border-white/20 transition-all duration-300 group cursor-pointer
              hover:shadow-xl ${stat.glow}
            `}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.glow}`}>
                <stat.icon size={20} className="text-white" />
              </div>
              <button className="p-1.5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-white">{stat.value}</span>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${stat.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {stat.change}
                </span>
              </div>
            </div>
          </motion.div>
         )))}
       </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <motion.div 
          variants={item}
          className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Pedidos Recientes</h3>
              <p className="text-sm text-gray-500">Últimos pedidos del día</p>
            </div>
            <button className="text-sm text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1">
              Ver todos <ChevronRight size={14} />
            </button>
          </div>
          
           <div className="space-y-3">
             {loading ? (
               Array.from({ length: 4 }).map((_, idx) => (
                 <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-white/10"></div>
                     <div className="space-y-2">
                       <div className="h-4 bg-white/10 rounded w-24"></div>
                       <div className="h-3 bg-white/10 rounded w-16"></div>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <div className="h-6 bg-white/10 rounded-full w-20"></div>
                     <div className="h-6 bg-white/10 rounded w-16"></div>
                   </div>
                 </div>
               ))
             ) : recentOrders.length > 0 ? (
               recentOrders.map((order, index) => (
                 <motion.div
                   key={order.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: 0.6 + index * 0.1 }}
                   whileHover={{ x: 5 }}
                   className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                 >
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-sm font-bold text-white">
                       {order.table.includes('Mesa') ? order.table.split(' ')[1] : 'PL'}
                     </div>
                     <div>
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-white">{order.id}</span>
                         <span className="text-gray-600">•</span>
                         <span className="text-sm text-gray-400">{order.table}</span>
                       </div>
                       <span className="text-xs text-gray-500">{order.time}</span>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                       {order.status}
                     </span>
                     <span className="text-sm font-semibold text-white">{order.amount}</span>
                     <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                   </div>
                 </motion.div>
               ))
             ) : (
               <div className="text-center py-6 text-gray-500">
                 No hay pedidos recientes
               </div>
             )}
           </div>
        </motion.div>

        {/* Quick Actions / Activity */}
        <motion.div 
          variants={item}
          className="p-6 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Actividad</h3>
              <p className="text-sm text-gray-500">Resumen del día</p>
            </div>
            <Calendar size={18} className="text-gray-500" />
          </div>
          
          <div className="space-y-6">
            {/* Progress Ring Simulation */}
            <div className="flex items-center justify-center py-4">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="fill-none stroke-white/5 stroke-[8]"
                  />
                  <motion.circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="fill-none stroke-[8]"
                    style={{
                      stroke: 'url(#gradient)',
                    }}
                    initial={{ strokeDasharray: '0 377' }}
                    animate={{ strokeDasharray: '283 377' }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">75%</span>
                  <span className="text-xs text-gray-500">Objetivo diario</span>
                </div>
              </div>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Completados', value: '47', color: 'text-emerald-400' },
                { label: 'Pendientes', value: '12', color: 'text-amber-400' },
                { label: 'Cancelados', value: '3', color: 'text-red-400' },
                { label: 'En curso', value: '8', color: 'text-blue-400' },
              ].map((mini) => (
                <div key={mini.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className={`text-xl font-bold ${mini.color}`}>{mini.value}</span>
                  <p className="text-xs text-gray-500">{mini.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer Note */}
      <motion.div 
        variants={item}
        className="text-center py-4"
      >
        <p className="text-xs text-gray-600">
          Rol actual: <span className="text-amber-500 font-medium capitalize">{user.role}</span> • 
          Última actualización: hace un momento
        </p>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
