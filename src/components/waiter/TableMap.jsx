import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, Check, Clock, Receipt, Users, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';

const TableMap = () => {
  const { user } = useAuth();
  const {
    tables,
    orders,
    selectedTable,
    selectTable,
    getReservationTimeInfo,
    expiredReservations,
    clearExpiredNotification,
    acknowledgeCall,
    resolveCall,
    getWaitingTime,
    getActiveCallsCount,
  } = useRestaurant();

  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeCallsCount = getActiveCallsCount();

  const hasReadyOrders = (tableId) => orders.some((order) => order.tableId === tableId && order.status === 'ready');

  const getCallMeta = (callRequest) => {
    if (!callRequest?.type) {
      return null;
    }

    const actionLabel =
      callRequest.type === 'order'
        ? 'Quiere ordenar'
        : callRequest.type === 'bill'
          ? 'Pidio la cuenta'
          : 'Solicita ayuda';

    if (callRequest.status === 'acknowledged') {
      return {
        title: 'Atendiendo',
        description: callRequest.attendedBy?.name
          ? `${callRequest.attendedBy.name} esta atendiendo la mesa`
          : 'La llamada ya fue tomada por el salon',
        badgeClassName: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
        buttonClassName: 'bg-sky-500 hover:bg-sky-600',
        accentClassName: 'text-sky-300',
        actionLabel,
      };
    }

    return {
      title: 'Pendiente',
      description: 'Cliente esperando atencion del salon',
      badgeClassName: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      buttonClassName: 'bg-amber-500 hover:bg-amber-600',
      accentClassName: 'text-amber-300',
      actionLabel,
    };
  };

  const getStatusStyles = (table) => {
    const reservation = table.reservation;
    const timeInfo = reservation ? getReservationTimeInfo(reservation) : null;
    const hasCall = Boolean(table.callRequest?.type);
    const isAcknowledged = table.callRequest?.status === 'acknowledged';
    const hasReady = hasReadyOrders(table.id);

    if (hasReady) {
      return {
        bg: 'bg-emerald-500/30',
        border: 'border-emerald-500 animate-pulse',
        text: 'text-emerald-400',
        glow: 'shadow-emerald-500/30',
      };
    }

    if (hasCall) {
      return {
        bg: isAcknowledged ? 'bg-sky-500/25' : 'bg-amber-500/30',
        border: isAcknowledged ? 'border-sky-500' : 'border-amber-500 animate-pulse',
        text: isAcknowledged ? 'text-sky-300' : 'text-amber-400',
        glow: isAcknowledged ? 'shadow-sky-500/30' : 'shadow-amber-500/30',
      };
    }

    switch (table.status) {
      case 'free':
        return {
          bg: 'bg-emerald-500/20 hover:bg-emerald-500/30',
          border: 'border-emerald-500/50',
          text: 'text-emerald-400',
          glow: 'hover:shadow-emerald-500/20',
        };
      case 'occupied': {
        const isMine = table.assignedWaiter?.id === user?.id;
        return {
          bg: isMine ? 'bg-amber-500/20 hover:bg-amber-500/30' : 'bg-red-500/20 hover:bg-red-500/30',
          border: isMine ? 'border-amber-500/50' : 'border-red-500/50',
          text: isMine ? 'text-amber-400' : 'text-red-400',
          glow: isMine ? 'hover:shadow-amber-500/20' : 'hover:shadow-red-500/20',
        };
      }
      case 'reserved':
        if (timeInfo?.status === 'waiting') {
          return {
            bg: 'bg-orange-500/20 hover:bg-orange-500/30',
            border: 'border-orange-500/50',
            text: 'text-orange-400',
            glow: 'hover:shadow-orange-500/20',
          };
        }
        return {
          bg: 'bg-yellow-500/20 hover:bg-yellow-500/30',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          glow: 'hover:shadow-yellow-500/20',
        };
      default:
        return {
          bg: 'bg-gray-500/20',
          border: 'border-gray-500/50',
          text: 'text-gray-400',
          glow: '',
        };
    }
  };

  const handleTableClick = (table) => {
    selectTable(table, user);
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  };

  const item = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
  };

  const selectedCallMeta = getCallMeta(selectedTable?.callRequest);

  return (
    <div className="space-y-3">
      {activeCallsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs"
        >
          <Bell size={14} className="animate-bounce" />
          <span className="font-medium">
            {activeCallsCount} llamada{activeCallsCount > 1 ? 's' : ''} activa{activeCallsCount > 1 ? 's' : ''}
          </span>
        </motion.div>
      )}

      {selectedTable?.callRequest && selectedCallMeta && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Mesa {selectedTable.number} · {selectedCallMeta.actionLabel}
              </p>
              <p className="text-xs text-gray-400 mt-1">{selectedCallMeta.description}</p>
            </div>
            <span className={clsx('px-2 py-1 rounded-full text-[10px] font-semibold', selectedCallMeta.badgeClassName)}>
              {selectedCallMeta.title}
            </span>
          </div>
          <div className="flex gap-2">
            {selectedTable.callRequest.status !== 'acknowledged' && (
              <button
                onClick={() => acknowledgeCall(selectedTable.id)}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2',
                  selectedCallMeta.buttonClassName,
                )}
              >
                <Check size={14} />
                Tomar llamada
              </button>
            )}
            <button
              onClick={() => resolveCall(selectedTable.id)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
            >
              <X size={14} />
              Resolver
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {expiredReservations.map((expired, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="flex items-center justify-between p-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} />
              <span className="truncate">Mesa {expired.tableNumber} liberada</span>
            </div>
            <button
              onClick={() => clearExpiredNotification(index)}
              className="text-orange-400 hover:text-white ml-2"
            >
              x
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Mesas</h2>
          <p className="text-[10px] sm:text-xs text-gray-500">Toca para seleccionar</p>
        </div>

        <div className="flex items-center gap-2 text-[8px] sm:text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-500 hidden sm:inline">Libre</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-500 hidden sm:inline">Ocup.</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-gray-500 hidden sm:inline">Pend.</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="text-gray-500 hidden sm:inline">Atend.</span>
          </div>
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-1.5 sm:gap-2"
      >
        {tables.map((table) => {
          const styles = getStatusStyles(table);
          const isSelected = selectedTable?.id === table.id;
          const timeInfo = table.reservation ? getReservationTimeInfo(table.reservation) : null;
          const waitingTime = getWaitingTime(table);
          const hasCall = Boolean(table.callRequest?.type);
          const isAcknowledged = table.callRequest?.status === 'acknowledged';
          const isMine = table.assignedWaiter?.id === user?.id;
          const isOtherWaiter = table.status === 'occupied' && table.assignedWaiter && !isMine;
          const canSelect = !isOtherWaiter;

          return (
            <motion.button
              key={table.id}
              variants={item}
              whileHover={canSelect ? { scale: 1.05 } : {}}
              whileTap={canSelect ? { scale: 0.95 } : {}}
              onClick={() => canSelect && handleTableClick(table)}
              disabled={!canSelect}
              className={clsx(
                'relative p-1.5 sm:p-2 rounded-lg sm:rounded-xl border-2 transition-all duration-300',
                'flex flex-col items-center justify-center gap-0 min-h-[70px] sm:min-h-[80px]',
                isOtherWaiter
                  ? 'bg-gray-800/50 border-gray-700/50 opacity-50 cursor-not-allowed'
                  : clsx(styles.bg, styles.border),
                isSelected && 'ring-2 ring-white ring-offset-1 ring-offset-[#080809]',
                hasCall && 'shadow-lg',
                canSelect && `hover:shadow-lg ${styles.glow}`,
              )}
            >
              {hasCall && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={clsx(
                    'absolute -top-1 -left-1 p-1 rounded-full shadow-lg',
                    isAcknowledged ? 'bg-sky-500 shadow-sky-500/50' : 'bg-amber-500 shadow-amber-500/50',
                  )}
                >
                  {table.callRequest?.type === 'bill' ? (
                    <Receipt size={10} className="text-white" />
                  ) : (
                    <Bell size={10} className="text-white" />
                  )}
                </motion.div>
              )}

              {table.assignedWaiter && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 border-2 border-[#080809] flex items-center justify-center text-[8px] font-bold text-white">
                  {table.assignedWaiter.name.charAt(0)}
                </div>
              )}

              <span className={clsx('text-lg sm:text-xl font-bold leading-none', styles.text)}>{table.number}</span>

              <div className="flex items-center gap-0.5 text-[8px] sm:text-[10px] text-gray-500">
                <Users size={8} />
                <span>{table.capacity}</span>
              </div>

              {table.status === 'occupied' && waitingTime && (
                <div
                  className={clsx(
                    'flex items-center gap-0.5 text-[8px] mt-0.5',
                    waitingTime.status === 'ok' && 'text-emerald-400',
                    waitingTime.status === 'warning' && 'text-amber-400',
                    waitingTime.status === 'critical' && 'text-red-400',
                  )}
                >
                  <Clock size={8} />
                  <span>{waitingTime.minutes}m</span>
                </div>
              )}

              {table.status === 'reserved' && table.reservation && (
                <div
                  className={clsx(
                    'text-[7px] sm:text-[8px] truncate w-full text-center font-medium mt-0.5',
                    timeInfo?.status === 'waiting' ? 'text-orange-300' : 'text-yellow-300',
                  )}
                >
                  {table.reservation.customerName.substring(0, 6)}
                </div>
              )}

              {hasCall && (
                <div className={clsx('text-[7px] mt-0.5 font-medium', isAcknowledged ? 'text-sky-300' : 'text-amber-300')}>
                  {isAcknowledged ? 'Atendiendo' : 'Llamando'}
                </div>
              )}

              {isSelected && (
                <motion.div
                  layoutId="selectedTable"
                  className="absolute inset-0 rounded-lg sm:rounded-xl border-2 border-white"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default TableMap;
