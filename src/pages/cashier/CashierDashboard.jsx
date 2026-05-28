import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, CreditCard, QrCode, Clock, Check,
  ShoppingBag, AlertTriangle, Receipt, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRestaurant } from '../../context/RestaurantContext';
import MockCardCheckoutModal from '../../components/payments/MockCardCheckoutModal';
import SplitBillModal from '../../components/billing/SplitBillModal';

const PAYMENT_BUTTON_STYLES = {
  cash: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  card: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  qr: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
};

const CashierDashboardContent = () => {
  const {
    orders,
    tables,
    payTable,
    payTakeawayOrder,
    confirmPayment,
    startTableCardCheckout,
  } = useRestaurant();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPayModal, setShowPayModal] = useState(false);
  const [mockSession, setMockSession] = useState(null);
  const [splitTable, setSplitTable] = useState(null);

  const pendingPayments = orders.filter((order) => (order.status === 'ready' || order.status === 'served') && order.status !== 'paid');
  const tablesWithPendingQR = tables.filter((table) => table.pendingPayment);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const paidToday = orders.filter((order) => order.status === 'paid' && new Date(order.paidAt) >= today);

  const totalPendingAmount = pendingPayments.reduce((sum, order) => sum + order.items.reduce((subtotal, item) => subtotal + (item.product.price * item.quantity), 0), 0);
  const totalPaidAmount = paidToday.reduce((sum, order) => sum + order.items.reduce((subtotal, item) => subtotal + (item.product.price * item.quantity), 0), 0);

  const handleOpenPayModal = (order) => {
    if (order.orderType !== 'takeaway') {
      setSplitTable({
        id: order.tableId,
        number: order.tableNumber,
      });
      return;
    }

    setSelectedOrder(order);
    setPaymentMethod('cash');
    setShowPayModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;

    if (selectedOrder.orderType === 'takeaway') {
      await payTakeawayOrder(selectedOrder.id, paymentMethod);
    } else if (paymentMethod === 'card') {
      const session = await startTableCardCheckout(selectedOrder.tableId);
      setMockSession(session);
      setShowPayModal(false);
      return;
    } else if (tablesWithPendingQR.find((table) => table.id === selectedOrder.tableId)?.pendingPayment?.clientPaid) {
      await confirmPayment(selectedOrder.tableId);
    } else {
      await payTable(selectedOrder.tableId, paymentMethod);
    }

    setShowPayModal(false);
    setSelectedOrder(null);
  };

  const getOrderTotal = (order) => order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const getTimeSinceReady = (order) => {
    if (!order.readyAt) return '';
    const diff = Math.floor((new Date() - new Date(order.readyAt)) / 60000);
    return `${diff} min`;
  };

  return (
    <div className="min-h-screen p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja</h1>
          <p className="text-sm text-gray-500">Gestión de pagos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            <span className="mr-2">💰</span>
            Hoy: Bs. {totalPaidAmount.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <Clock size={20} className="text-amber-400 mb-2" />
          <p className="text-2xl font-bold text-white">{pendingPayments.length}</p>
          <p className="text-xs text-gray-500">Pendientes</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <DollarSign size={20} className="text-emerald-400 mb-2" />
          <p className="text-2xl font-bold text-white">{paidToday.length}</p>
          <p className="text-xs text-gray-500">Pagados Hoy</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle size={20} className="text-orange-400 mb-2" />
          <p className="text-2xl font-bold text-white">Bs. {totalPendingAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Por Cobrar</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <QrCode size={20} className="text-purple-400 mb-2" />
          <p className="text-2xl font-bold text-white">{tablesWithPendingQR.length}</p>
          <p className="text-xs text-gray-500">Pagos QR Pendientes</p>
        </motion.div>
      </div>

      {tablesWithPendingQR.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {tablesWithPendingQR.filter((table) => table.pendingPayment?.clientPaid).length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 animate-pulse">
              <div className="flex items-center gap-2 text-emerald-400 mb-3">
                <Check size={18} />
                <span className="font-semibold">💰 Cliente pagó - Confirmar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tablesWithPendingQR.filter((table) => table.pendingPayment?.clientPaid).map((table) => (
                  <button key={table.id} onClick={() => confirmPayment(table.id)} className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-2 font-medium">
                    <span>Mesa {table.number}</span>
                    <span className="text-sm opacity-80">Bs. {table.pendingPayment?.amount?.toFixed(2)}</span>
                    <Check size={16} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {tablesWithPendingQR.filter((table) => !table.pendingPayment?.clientPaid).length > 0 && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 text-purple-400 mb-3">
                <QrCode size={18} />
                <span className="font-semibold">Esperando pago QR</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tablesWithPendingQR.filter((table) => !table.pendingPayment?.clientPaid).map((table) => (
                  <div key={table.id} className="px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span>Mesa {table.number}</span>
                    <span className="text-xs opacity-70">Bs. {table.pendingPayment?.amount?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock size={18} className="text-amber-400" />
          Pendientes de Pago ({pendingPayments.length})
        </h2>

        {pendingPayments.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5">
            <Check size={40} className="mx-auto text-emerald-500 mb-3" />
            <p className="text-gray-400">No hay pagos pendientes</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence>
              {pendingPayments.map((order, idx) => {
                const isTakeaway = order.orderType === 'takeaway';
                const total = getOrderTotal(order);
                const timeSinceReady = getTimeSinceReady(order);

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ delay: idx * 0.05 }}
                    className={clsx('p-4 rounded-xl border flex items-center justify-between', isTakeaway ? 'bg-orange-500/5 border-orange-500/20' : 'bg-white/[0.02] border-white/5')}
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', isTakeaway ? 'bg-orange-500/20' : 'bg-amber-500/20')}>
                        {isTakeaway ? <ShoppingBag size={20} className="text-orange-400" /> : <span className="text-amber-400 font-bold text-lg">{order.tableNumber}</span>}
                      </div>
                      <div>
                        <p className="font-medium text-white">{isTakeaway ? order.customerName : `Mesa ${order.tableNumber}`}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{order.items.length} items</span>
                          {timeSinceReady ? (
                            <>
                              <span>•</span>
                              <span className="text-amber-400">{timeSinceReady} esperando</span>
                            </>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.items.slice(0, 3).map((item, index) => (
                            <span key={index} className="text-xs px-1.5 py-0.5 bg-white/5 rounded text-gray-400">
                              {item.quantity}x {item.product.name}
                            </span>
                          ))}
                          {order.items.length > 3 ? <span className="text-xs text-gray-500">+{order.items.length - 3} más</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-400">Bs. {total.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{order.status === 'ready' ? '✓ Listo' : '🍽️ Servido'}</p>
                      </div>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleOpenPayModal(order)} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium flex items-center gap-2">
                        <DollarSign size={16} />
                        {isTakeaway ? 'Cobrar' : 'Cobrar / Dividir'}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Receipt size={18} className="text-emerald-400" />
          Pagos Recientes ({paidToday.length})
        </h2>

        {paidToday.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-gray-500 text-sm">No hay pagos registrados hoy</p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {paidToday.slice().reverse().slice(0, 10).map((order) => {
              const total = getOrderTotal(order);
              const paidAt = new Date(order.paidAt);
              const timeStr = paidAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={order.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', order.paymentMethod === 'cash' && 'bg-emerald-500/20', order.paymentMethod === 'card' && 'bg-blue-500/20', order.paymentMethod === 'qr' && 'bg-purple-500/20', !order.paymentMethod && 'bg-gray-500/20')}>
                      {order.paymentMethod === 'card' ? <CreditCard size={14} className="text-blue-400" /> : null}
                      {order.paymentMethod === 'qr' ? <QrCode size={14} className="text-purple-400" /> : null}
                      {order.paymentMethod === 'cash' || !order.paymentMethod ? <DollarSign size={14} className="text-emerald-400" /> : null}
                    </div>
                    <div>
                      <p className="text-sm text-white">{order.orderType === 'takeaway' ? order.customerName : `Mesa ${order.tableNumber}`}</p>
                      <p className="text-xs text-gray-500">{timeStr}</p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-medium">Bs. {total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MockCardCheckoutModal
        open={Boolean(mockSession)}
        session={mockSession}
        amount={selectedOrder ? getOrderTotal(selectedOrder) : 0}
        title={selectedOrder ? `Tarjeta - ${selectedOrder.orderType === 'takeaway' ? selectedOrder.customerName : `Mesa ${selectedOrder.tableNumber}`}` : 'Pago con tarjeta'}
        onClose={() => {
          setMockSession(null);
          setSelectedOrder(null);
        }}
        onSuccess={() => {
          setMockSession(null);
          setSelectedOrder(null);
        }}
      />

      <SplitBillModal
        open={Boolean(splitTable)}
        onClose={() => setSplitTable(null)}
        tableId={splitTable?.id}
        tableNumber={splitTable?.number}
        scope="cashier"
      />

      <AnimatePresence>
        {showPayModal && selectedOrder ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(event) => event.stopPropagation()} className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Cobrar</h2>
                <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400">{selectedOrder.orderType === 'takeaway' ? selectedOrder.customerName : `Mesa ${selectedOrder.tableNumber}`}</span>
                  <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400">{selectedOrder.items.length} items</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.quantity}x {item.product.name}</span>
                      <span className="text-white">Bs. {(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 mt-3 pt-3 flex justify-between">
                  <span className="font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-emerald-400">Bs. {getOrderTotal(selectedOrder).toFixed(2)}</span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">Método de Pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Efectivo', icon: DollarSign, color: 'emerald' },
                    { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'blue' },
                    { id: 'qr', label: 'QR', icon: QrCode, color: 'purple' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={clsx(
                        'p-3 rounded-xl border flex flex-col items-center gap-1 transition-all',
                        paymentMethod === method.id
                          ? PAYMENT_BUTTON_STYLES[method.id]
                          : 'bg-white/5 border-white/10 text-gray-400',
                      )}
                    >
                      <method.icon size={20} />
                      <span className="text-xs">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmPayment} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                <Check size={18} />
                Confirmar Pago
              </motion.button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default CashierDashboardContent;
