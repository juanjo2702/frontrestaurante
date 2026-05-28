import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Calendar,
  ChefHat,
  ChevronLeft,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
  Sparkles,
  Tag,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!user) {
    return null;
  }

  const getLinks = (role) => {
    const baseLinks = {
      admin: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Calendar, label: 'Reservas', path: '/reservations' },
        { icon: QrCode, label: 'Mesas & QR', path: '/tables' },
        { icon: Users, label: 'Usuarios', path: '/users' },
        { icon: Tag, label: 'Categorias', path: '/categories' },
        { icon: UtensilsCrossed, label: 'Menu', path: '/menu' },
        { icon: ClipboardList, label: 'Inventario', path: '/inventory' },
        { icon: FileText, label: 'Reportes', path: '/reports' },
        { icon: Settings, label: 'Configuracion', path: '/settings' },
      ],
      waiter: [
        { icon: ClipboardList, label: 'Mis Mesas', path: '/' },
        { icon: UtensilsCrossed, label: 'Tomar Pedido', path: '/order' },
        { icon: Bell, label: 'Pedidos Listos', path: '/ready' },
        { icon: Calendar, label: 'Reservas', path: '/reservations' },
      ],
      kitchen: [
        { icon: ChefHat, label: 'Comandas', path: '/' },
        { icon: ClipboardList, label: 'Historial', path: '/history' },
      ],
      cashier: [
        { icon: Wallet, label: 'Caja', path: '/' },
        { icon: Calendar, label: 'Reservas', path: '/reservations' },
        { icon: FileText, label: 'Cierre', path: '/closing' },
      ],
      client: [
        { icon: Calendar, label: 'Reservar', path: '/' },
        { icon: FileText, label: 'Mis Reservas', path: '/reservations' },
      ],
    };

    return baseLinks[role] || [];
  };

  const links = getLinks(user.role);

  const getRoleGradient = () => {
    switch (user.role) {
      case 'admin':
        return 'from-violet-500 to-purple-600';
      case 'waiter':
        return 'from-amber-500 to-orange-600';
      case 'kitchen':
        return 'from-rose-500 to-red-600';
      case 'cashier':
        return 'from-emerald-500 to-green-600';
      case 'client':
        return 'from-cyan-500 to-blue-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const shouldShow = !isMobile || isOpen;

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {shouldShow ? (
          <motion.aside
            initial={isMobile ? { x: '-100%' } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: '-100%' } : undefined}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={clsx(
              'h-screen bg-[#0d0d12]/95 backdrop-blur-xl',
              'border-r border-white/5 shadow-2xl shadow-black/50',
              'flex flex-col',
              isMobile
                ? 'fixed top-0 left-0 z-50 w-64'
                : isCollapsed
                  ? 'sticky top-0 w-20 shrink-0'
                  : 'sticky top-0 w-64 shrink-0',
            )}
          >
            <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${getRoleGradient()}`} />

            <div className="h-16 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
              <motion.div className="flex items-center gap-2" animate={{ opacity: isCollapsed ? 0 : 1 }}>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getRoleGradient()} flex items-center justify-center shadow-lg`}>
                  <Sparkles size={16} className="text-white" />
                </div>
                {!isCollapsed ? <span className="text-lg font-bold text-white tracking-tight">GUSTO</span> : null}
              </motion.div>
              <div className="flex items-center gap-1">
                {!isMobile ? (
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={16} className={clsx('transition-transform duration-300', isCollapsed && 'rotate-180')} />
                  </button>
                ) : null}
                {isMobile ? (
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className={clsx('p-3 border-b border-white/5 shrink-0', isCollapsed && 'flex justify-center')}>
              <div className={clsx('flex items-center gap-2', isCollapsed && 'flex-col')}>
                <div className={`relative shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br ${getRoleGradient()} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                  {user.name.charAt(0)}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0d0d12] rounded-full" />
                </div>
                {!isCollapsed ? (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {links.map((link) => {
                const isActive = location.pathname === link.path;

                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    onClick={() => isMobile && onClose()}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative',
                      isActive ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {isActive ? (
                      <motion.div
                        layoutId="activeTab"
                        className={`absolute inset-0 bg-gradient-to-r ${getRoleGradient()} opacity-20 rounded-lg`}
                      />
                    ) : null}
                    {isActive ? (
                      <motion.div
                        layoutId="activeIndicator"
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b ${getRoleGradient()} rounded-r-full`}
                      />
                    ) : null}
                    <link.icon size={18} className={clsx('shrink-0 relative z-10', isActive && 'text-white')} />
                    {!isCollapsed ? <span className="relative z-10 truncate">{link.label}</span> : null}
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-2 border-t border-white/5 space-y-0.5 shrink-0">
              {!isCollapsed ? (
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                  <HelpCircle size={18} />
                  <span>Ayuda</span>
                </button>
              ) : null}
              <button
                onClick={logout}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium',
                  'text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all',
                  isCollapsed && 'justify-center',
                )}
              >
                <LogOut size={18} />
                {!isCollapsed ? <span>Cerrar Sesion</span> : null}
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
