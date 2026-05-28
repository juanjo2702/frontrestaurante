import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Minus, Plus, Trash2, Send, MessageSquare, X, 
  DollarSign, XCircle, Clock, Receipt, Phone, Users, User, ShoppingBag,
  Banknote, QrCode, CreditCard, Check
} from 'lucide-react';
import { clsx } from 'clsx';
import MockCardCheckoutModal from '../payments/MockCardCheckoutModal';
import SplitBillModal from '../billing/SplitBillModal';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: Banknote, color: 'emerald' },
  { id: 'qr', label: 'QR', icon: QrCode, color: 'blue' },
  { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'purple' },
];

const OrderCart = () => {
  const { 
    cart, 
    selectedTable, 
    updateCartQuantity, 
    updateCartNotes, 
    incrementTakeaway,
    decrementTakeaway,
    getCartTotal, 
    sendOrderToKitchen,
    getTableOrders,
    getTableTotal,
    payTable,
    freeTable,
    cancelReservation,
    getReservationTimeInfo,
    orderMode,
    takeawayCustomer,
    setTakeawayCustomer,
    initiateQRPayment,
    startTableCardCheckout,
  } = useRestaurant();
  
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirmFree, setShowConfirmFree] = useState(false);
  const [showConfirmPay, setShowConfirmPay] = useState(false);
  const [showConfirmCancelReservation, setShowConfirmCancelReservation] = useState(false);
  const [activeTab, setActiveTab] = useState('cart');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [, setQrPaymentSent] = useState(false);
  const [mockSession, setMockSession] = useState(null);
  const [showSplitBill, setShowSplitBill] = useState(false);

  const handleSendOrder = async () => {
    if (orderMode === 'takeaway' && (!takeawayCustomer.name || !takeawayCustomer.phone)) {
      return;
    }
    
    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = await sendOrderToKitchen();
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setIsSending(false);
  };

  const tableTotal = selectedTable ? getTableTotal(selectedTable.id) : 0;

  const handlePayTable = async () => {
    if (selectedPaymentMethod === 'qr') {
      await initiateQRPayment(selectedTable.id, tableTotal);
      setQrPaymentSent(true);
      setShowConfirmPay(false);
    } else if (selectedPaymentMethod === 'card') {
      const session = await startTableCardCheckout(selectedTable.id);
      if (session?.checkout_token) {
        setMockSession(session);
        setShowConfirmPay(false);
      }
    } else {
      await payTable(selectedTable.id, selectedPaymentMethod);
      setShowConfirmPay(false);
    }
  };

  const handleFreeTable = () => {
    freeTable(selectedTable.id);
    setShowConfirmFree(false);
  };

  const handleCancelReservation = () => {
    cancelReservation(selectedTable.id);
    setShowConfirmCancelReservation(false);
  };

  const total = getCartTotal();
  const tableOrders = selectedTable ? getTableOrders(selectedTable.id) : [];
  // tableTotal ya está declarado arriba
  const reservationInfo = selectedTable?.reservation ? getReservationTimeInfo(selectedTable.reservation) : null;
  const isReserved = selectedTable?.status === 'reserved';
  const isTakeaway = orderMode === 'takeaway';
  
  const canSendTakeaway = isTakeaway && takeawayCustomer.name && takeawayCustomer.phone && cart.length > 0;
  const canSendDineIn = !isTakeaway && selectedTable && cart.length > 0;
  const canSend = canSendTakeaway || canSendDineIn;

  return (
    <>
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-emerald-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm"
          >
            <Send size={16} />
            <span className="font-medium">
              {isTakeaway ? '¡Pedido enviado!' : '¡Enviado a cocina!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showConfirmCancelReservation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmCancelReservation(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-5 max-w-xs w-full"
            >
              <div className="text-center">
                <XCircle size={40} className="text-red-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-2">¿Cancelar Reserva?</h3>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowConfirmCancelReservation(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleCancelReservation}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmFree && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmFree(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-5 max-w-xs w-full"
            >
              <div className="text-center">
                <XCircle size={40} className="text-red-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-2">¿Liberar Mesa {selectedTable?.number}?</h3>
                <p className="text-xs text-gray-400 mb-4">Se cancelarán pedidos no pagados</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirmFree(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleFreeTable}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium"
                  >
                    Liberar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmPay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmPay(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-5 max-w-xs w-full"
            >
              <div className="text-center">
                <DollarSign size={40} className="text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Mesa {selectedTable?.number}</h3>
                <p className="text-2xl font-bold text-emerald-400 my-3">Bs. {tableTotal.toFixed(2)}</p>
                
                {/* Payment Methods */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = method.icon;
                    const isSelected = selectedPaymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={clsx(
                          "p-2 rounded-lg flex flex-col items-center gap-1 transition-all border text-xs",
                          isSelected
                            ? method.color === 'emerald'
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                              : method.color === 'blue'
                                ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                : "bg-purple-500/20 border-purple-500/50 text-purple-400"
                            : "bg-white/5 border-white/10 text-gray-400"
                        )}
                      >
                        <Icon size={16} />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirmPay(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePayTable}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium"
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Cart Content */}
      <div className="flex flex-col h-full">
        {/* Takeaway Customer Form */}
        {isTakeaway && (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={takeawayCustomer.name}
                onChange={(e) => setTakeawayCustomer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del cliente *"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="tel"
                value={takeawayCustomer.phone}
                onChange={(e) => setTakeawayCustomer(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Teléfono *"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
        )}

        {/* Reservation Info */}
        {isReserved && selectedTable?.reservation && (
          <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs">
            <div className="flex items-center gap-2 text-yellow-400">
              <Clock size={12} />
              <span>Reserva • {reservationInfo?.text}</span>
            </div>
            <div className="flex gap-3 mt-1 text-gray-400">
              <span>{selectedTable.reservation.customerName}</span>
              <span>{selectedTable.reservation.partySize} pers.</span>
            </div>
          </div>
        )}

        {/* Tabs (if has orders) */}
        {!isTakeaway && selectedTable && tableOrders.length > 0 && (
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg mb-3">
            <button
              onClick={() => setActiveTab('cart')}
              className={clsx(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === 'cart' ? "bg-amber-500 text-white" : "text-gray-400"
              )}
            >
              Agregar {cart.length > 0 && `(${cart.length})`}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={clsx(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === 'orders' ? "bg-amber-500 text-white" : "text-gray-400"
              )}
            >
              Cuenta ({tableOrders.length})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {activeTab === 'cart' || isTakeaway ? (
            cart.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-gray-500">
                  {isTakeaway ? 'Agrega productos' : 'Carrito vacío'}
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const hasTakeaway = item.takeawayQty > 0;
                const dineInQty = item.quantity - item.takeawayQty;
                
                return (
                  <div
                    key={item.product.id}
                    className={clsx(
                      "p-2 rounded-lg border flex gap-2",
                      hasTakeaway 
                        ? "bg-gradient-to-r from-white/[0.02] to-orange-500/10 border-orange-500/30" 
                        : "bg-white/[0.02] border-white/5"
                    )}
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-medium text-white truncate">{item.product.name}</h4>
                      <p className="text-xs text-gray-500">Bs. {item.product.price.toFixed(2)}</p>
                      
                      {/* Desglose: Mesa / Llevar */}
                      {!isTakeaway && (
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className="text-gray-400">🍽️ {dineInQty}</span>
                          {hasTakeaway && (
                            <span className="text-orange-400">🥡 {item.takeawayQty}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Notas */}
                      <div className="flex items-center gap-2 mt-0.5">
                        {expandedNotes === item.product.id ? (
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateCartNotes(item.product.id, e.target.value)}
                            placeholder="Nota..."
                            className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white focus:outline-none"
                            autoFocus
                            onBlur={() => setExpandedNotes(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setExpandedNotes(item.product.id)}
                            className="text-[10px] text-amber-400 flex items-center gap-1"
                          >
                            <MessageSquare size={8} />
                            {item.notes || 'Nota'}
                          </button>
                        )}
                        
                        {/* Controles Para Llevar (solo en modo mesa) */}
                        {!isTakeaway && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            <button
                              onClick={() => decrementTakeaway(item.product.id)}
                              disabled={item.takeawayQty === 0}
                              className={clsx(
                                "p-0.5 rounded text-[10px]",
                                item.takeawayQty > 0 
                                  ? "bg-orange-500/20 text-orange-400" 
                                  : "bg-white/5 text-gray-600"
                              )}
                            >
                              <Minus size={10} />
                            </button>
                            <span className={clsx(
                              "w-4 text-center text-[10px] font-medium",
                              hasTakeaway ? "text-orange-400" : "text-gray-500"
                            )}>
                              {item.takeawayQty}
                            </span>
                            <button
                              onClick={() => incrementTakeaway(item.product.id)}
                              disabled={item.takeawayQty >= item.quantity}
                              className={clsx(
                                "p-0.5 rounded text-[10px]",
                                item.takeawayQty < item.quantity 
                                  ? "bg-orange-500/20 text-orange-400" 
                                  : "bg-white/5 text-gray-600"
                              )}
                            >
                              <Plus size={10} />
                            </button>
                            <ShoppingBag size={10} className="text-orange-400 ml-0.5" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 rounded bg-white/5 text-gray-400"
                      >
                        {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="w-5 text-center text-xs font-medium text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 rounded bg-white/5 text-gray-400"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            tableOrders.map((order, idx) => (
              <div key={order.id} className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">
                    #{idx + 1} • {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={clsx(
                    "px-1.5 py-0.5 rounded text-[8px] font-medium",
                    order.status === 'pending' && "bg-amber-500/20 text-amber-400",
                    order.status === 'preparing' && "bg-blue-500/20 text-blue-400",
                    order.status === 'ready' && "bg-emerald-500/20 text-emerald-400"
                  )}>
                    {order.status === 'pending' ? 'Pend.' : order.status === 'preparing' ? 'Prep.' : 'Listo'}
                  </span>
                </div>
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-400">{item.quantity}x {item.product.name}</span>
                    <span className="text-white">Bs. {(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2 shrink-0">
          {cart.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Subtotal</span>
                <span className="text-base font-bold text-white">Bs. {total.toFixed(2)}</span>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={!canSend || isSending}
                className={clsx(
                  "w-full py-2.5 rounded-xl font-medium text-white flex items-center justify-center gap-2 text-sm transition-all",
                  canSend && !isSending
                    ? isTakeaway
                      ? "bg-gradient-to-r from-orange-500 to-red-600"
                      : "bg-gradient-to-r from-amber-500 to-orange-600"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                )}
              >
                {isSending ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Send size={16} />
                    <span>{isTakeaway ? 'Enviar Pedido' : 'Enviar a Cocina'}</span>
                  </>
                )}
              </button>
            </>
          )}

          {!isTakeaway && selectedTable && tableOrders.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Total Mesa</span>
                <span className="text-lg font-bold text-white">Bs. {tableTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setShowSplitBill(true)}
                className="w-full py-2.5 rounded-xl font-medium text-white flex items-center justify-center gap-2 text-sm bg-emerald-500"
              >
                <DollarSign size={16} />
                <span>Cobrar / Dividir</span>
              </button>
            </>
          )}

          {!isTakeaway && selectedTable && (
            <button
              onClick={() => isReserved ? setShowConfirmCancelReservation(true) : setShowConfirmFree(true)}
              className="w-full py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center gap-1"
            >
              <XCircle size={14} />
              <span>{isReserved ? 'Cancelar Reserva' : 'Liberar Mesa'}</span>
            </button>
          )}
        </div>
      </div>

      <MockCardCheckoutModal
        open={Boolean(mockSession)}
        session={mockSession}
        amount={tableTotal}
        title={selectedTable ? `Tarjeta - Mesa ${selectedTable.number}` : 'Pago con tarjeta'}
        onClose={() => setMockSession(null)}
        onSuccess={() => {
          setMockSession(null);
        }}
      />

      <SplitBillModal
        open={showSplitBill && Boolean(selectedTable)}
        onClose={() => setShowSplitBill(false)}
        tableId={selectedTable?.id}
        tableNumber={selectedTable?.number}
        scope="waiter"
      />
    </>
  );
};

export default OrderCart;
