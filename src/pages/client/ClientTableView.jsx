import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  ChefHat,
  CreditCard,
  Minus,
  Phone,
  Plus,
  QrCode,
  Receipt,
  ShoppingBag,
  Sparkles,
  User,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRestaurant } from '../../context/RestaurantContext';
import MockCardCheckoutModal from '../../components/payments/MockCardCheckoutModal';

const PAYMENT_OPTIONS = [
  {
    id: 'qr',
    label: 'Pago con QR',
    description: 'Escanea con tu banco',
    color: 'from-blue-500 to-blue-600',
    icon: QrCode,
  },
  {
    id: 'cash',
    label: 'Pago en efectivo',
    description: 'Entrega al personal',
    color: 'from-amber-500 to-orange-600',
    icon: Receipt,
  },
  {
    id: 'card',
    label: 'Pago con tarjeta',
    description: 'Checkout simulado en mesa',
    color: 'from-purple-500 to-pink-600',
    icon: CreditCard,
  },
];

const ORDER_STATUS_META = {
  pending: {
    label: 'Pendiente',
    badgeClassName: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    description: 'Recibimos tu pedido y lo enviaremos a cocina.',
  },
  preparing: {
    label: 'Preparando',
    badgeClassName: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    description: 'Cocina ya esta preparando tu pedido.',
  },
  ready: {
    label: 'Listo',
    badgeClassName: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    description: 'Tu pedido esta listo para servir.',
  },
  served: {
    label: 'Servido',
    badgeClassName: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
    description: 'Tu pedido ya fue entregado en mesa.',
  },
  paid: {
    label: 'Pagado',
    badgeClassName: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    description: 'Este pedido ya fue pagado.',
  },
  cancelled: {
    label: 'Cancelado',
    badgeClassName: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    description: 'Este pedido fue cancelado.',
  },
};

const ClientTableView = () => {
  const { tableUuid } = useParams();
  const [searchParams] = useSearchParams();
  const {
    getPublicTableByUuid,
    beginPublicTableSession,
    getStoredPublicSession,
    clearPublicTableSession,
    getPublicMenu,
    createPublicOrder,
    callPublic,
    paymentPublic,
    startPublicCardCheckout,
  } = useRestaurant();

  const signature = searchParams.get('sig') || '';
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('Solicitud enviada');
  const [error, setError] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [paymentStep, setPaymentStep] = useState('select');
  const [selectedMethod, setSelectedMethod] = useState('qr');
  const [mockSession, setMockSession] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!tableUuid) {
        setError('Mesa no encontrada');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const storedSession = getStoredPublicSession();
        const hasStoredSession = storedSession?.tableUuid === tableUuid;
        let mesa = await getPublicTableByUuid(tableUuid, hasStoredSession ? null : signature);

        // If the stored session token is stale, fall back to the QR signature
        // so the guest can re-activate the same table from this device.
        if (!mesa && hasStoredSession && signature) {
          mesa = await getPublicTableByUuid(tableUuid, signature);
        }

        const publicMenu = await getPublicMenu();

        if (!mesa) {
          setError('No se pudo validar esta mesa');
          return;
        }

        setTable(mesa);
        setMenu(publicMenu);
        setSessionReady(Boolean(hasStoredSession));
        setError(null);
      } catch (loadError) {
        console.error('Error loading public table module:', loadError);
        setError('No se pudo cargar la experiencia de la mesa');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tableUuid, signature, getPublicMenu, getPublicTableByUuid, getStoredPublicSession]);

  const hasPendingPayment = Boolean(table?.pendingPayment?.amount);
  const sessionOrders = useMemo(() => table?.sessionOrders || [], [table]);
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart],
  );

  const pushConfirmation = (message) => {
    setConfirmationMessage(message);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 3000);
  };

  const updateCart = (product, delta) => {
    setCart((previous) => {
      const existing = previous.find((item) => item.product.id === product.id);
      if (!existing && delta > 0) {
        return [...previous, { product, quantity: 1 }];
      }

      if (!existing) {
        return previous;
      }

      const nextQuantity = existing.quantity + delta;
      if (nextQuantity <= 0) {
        return previous.filter((item) => item.product.id !== product.id);
      }

      return previous.map((item) =>
        item.product.id === product.id ? { ...item, quantity: nextQuantity } : item,
      );
    });
  };

  const refreshPublicTable = useCallback(async () => {
    if (!tableUuid) {
      return;
    }

    const freshTable = await getPublicTableByUuid(tableUuid);
    if (freshTable) {
      setTable(freshTable);
    }
  }, [getPublicTableByUuid, tableUuid]);

  useEffect(() => {
    if (!sessionReady || !tableUuid) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      refreshPublicTable();
    }, 8000);

    return () => clearInterval(intervalId);
  }, [refreshPublicTable, sessionReady, tableUuid]);

  const handleStartSession = async () => {
    if (!tableUuid || !signature) {
      setError('El QR no es valido o esta incompleto');
      return;
    }

    try {
      setIsActivating(true);
      const mesa = await beginPublicTableSession(tableUuid, signature);
      setTable(mesa);
      setSessionReady(true);
      setError(null);
    } catch (activationError) {
      console.error('Error starting public session:', activationError);
      setError(activationError?.response?.data?.message || 'No se pudo activar la mesa');
      clearPublicTableSession();
      setSessionReady(false);
    } finally {
      setIsActivating(false);
    }
  };

  const handleCallWaiter = async (type) => {
    if (!tableUuid) return;

    try {
      await callPublic(tableUuid, type);
      setTable((previous) =>
        previous
          ? {
              ...previous,
              callRequest: { type, status: 'pending', timestamp: new Date(), attendedAt: null, attendedBy: null },
            }
          : previous,
      );
      pushConfirmation(type === 'bill' ? 'Cuenta solicitada' : 'Mesero notificado');
    } catch (callError) {
      console.error('Error calling waiter:', callError);
      setError(callError?.response?.data?.message || 'No se pudo enviar la solicitud');
    }
  };

  const handleSubmitOrder = async () => {
    if (!tableUuid || cart.length === 0) return;

    try {
      setIsSubmittingOrder(true);
      await createPublicOrder(tableUuid, {
        customer_name: customerName || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          notes: null,
        })),
      });

      setCart([]);
      pushConfirmation('Pedido enviado a cocina');
      refreshPublicTable();
    } catch (orderError) {
      console.error('Error sending public order:', orderError);
      setError(orderError?.response?.data?.message || 'No se pudo enviar el pedido');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handlePayment = async (method) => {
    if (!tableUuid || !table?.pendingPayment) return;

    if (method === 'card') {
      try {
        if (!table.pendingPayment.id) {
          setError('No existe una transaccion pendiente para esta mesa');
          return;
        }

        const session = await startPublicCardCheckout(table.pendingPayment.id);
        if (session?.checkout_token) {
          setMockSession(session);
        }
      } catch (paymentError) {
        console.error('Error creating public card checkout:', paymentError);
        setError(paymentError?.response?.data?.message || 'No se pudo iniciar el pago con tarjeta');
      }

      return;
    }

    try {
      await paymentPublic(tableUuid, table.pendingPayment.amount, method);
      setTable((previous) =>
        previous
          ? {
              ...previous,
              pendingPayment: {
                ...previous.pendingPayment,
                clientPaid: true,
                method,
                paidAt: new Date(),
              },
            }
          : previous,
      );
      pushConfirmation('Pago enviado para validacion');
      setPaymentStep('select');
    } catch (paymentError) {
      console.error('Error sending public payment:', paymentError);
      setError(paymentError?.response?.data?.message || 'No se pudo registrar el pago');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080809] via-[#0c0c0f] to-[#0a0a0d] flex items-center justify-center">
        <div className="text-amber-500">Cargando mesa...</div>
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080809] via-[#0c0c0f] to-[#0a0a0d] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-3">No pudimos abrir tu mesa</h2>
          <p className="text-gray-400">{error || 'La mesa no existe o el QR ya no es valido.'}</p>
        </div>
      </div>
    );
  }

  if (paymentCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080809] via-[#0c0c0f] to-[#0a0a0d] text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-5">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <Check size={48} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Pago confirmado</h1>
            <p className="text-gray-400">
              La cuenta de la mesa {table.number} fue cerrada correctamente. Gracias por tu visita.
            </p>
          </div>
          <p className="text-sm text-gray-500">Puedes cerrar esta pantalla cuando quieras.</p>
        </div>
      </div>
    );
  }

  if (hasPendingPayment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080809] via-[#0c0c0f] to-[#0a0a0d] text-white flex flex-col">
        <div className="p-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full mb-4">
            <CreditCard size={16} className="text-blue-400" />
            <span className="text-blue-400 font-medium text-sm">Pago pendiente</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Mesa {table.number}</h1>
          <p className="text-gray-500">Completa el pago para cerrar la cuenta</p>
        </div>

        <div className="flex-1 px-6 py-4 flex flex-col items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Total a pagar</p>
            <p className="text-5xl font-bold text-white">Bs. {table.pendingPayment.amount.toFixed(2)}</p>
          </div>

          {table.pendingPayment.clientPaid ? (
            <>
              <div className="p-8 bg-white/[0.03] border border-emerald-500/30 rounded-3xl">
                <Check size={64} className="text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-400/80 text-center">
                Tu pago fue enviado. Caja lo confirmara en breve.
              </p>
            </>
          ) : paymentStep === 'select' ? (
            <div className="w-full max-w-md space-y-3">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSelectedMethod(option.id);
                    setPaymentStep('pay');
                  }}
                  className={`w-full p-5 rounded-3xl bg-gradient-to-r ${option.color} flex items-center gap-4 text-left`}
                >
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <option.icon size={28} />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{option.label}</p>
                    <p className="text-sm text-white/80">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="p-8 bg-white/[0.03] border border-white/10 rounded-3xl text-center w-full max-w-md">
                <div className="w-44 h-44 mx-auto bg-white rounded-3xl p-5 mb-5 flex items-center justify-center">
                  {selectedMethod === 'card' ? (
                    <CreditCard size={92} className="text-slate-900" />
                  ) : (
                    <QrCode size={92} className="text-slate-900" />
                  )}
                </div>
                <p className="text-white font-semibold mb-2">
                  {selectedMethod === 'qr'
                    ? 'Escanea y paga'
                    : selectedMethod === 'cash'
                      ? 'Paga al mesero'
                      : 'Checkout con tarjeta'}
                </p>
                <p className="text-sm text-gray-400">
                  {selectedMethod === 'qr'
                    ? 'Usa la app de tu banco para confirmar.'
                    : selectedMethod === 'cash'
                      ? 'El personal pasara a recoger el pago.'
                      : 'Abriremos una pasarela simulada con token temporal.'}
                </p>
              </div>

              <button
                onClick={() => handlePayment(selectedMethod)}
                className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600"
              >
                <Receipt size={18} />
                {selectedMethod === 'card' ? 'Abrir checkout' : 'Confirmar que ya pague'}
              </button>
              <button
                onClick={() => setPaymentStep('select')}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                Cambiar metodo de pago
              </button>
            </>
          )}
        </div>

        <MockCardCheckoutModal
          open={Boolean(mockSession)}
          session={mockSession}
          scope="public"
          amount={table.pendingPayment.amount}
          title={`Tarjeta - Mesa ${table.number}`}
          onClose={() => setMockSession(null)}
          onSuccess={() => {
            setMockSession(null);
            clearPublicTableSession();
            setPaymentCompleted(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080809] via-[#0c0c0f] to-[#0a0a0d] text-white">
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-6 left-4 right-4 z-50"
          >
            <div className="bg-emerald-500 text-white rounded-2xl p-4 shadow-xl shadow-emerald-500/25">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Check size={18} />
                </div>
                <p className="font-semibold">{confirmationMessage}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full mb-4">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-amber-400 font-medium text-sm">GUSTO.BO</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Mesa {table.number}</h1>
          <p className="text-gray-500">
            {sessionReady
              ? 'Tu mesa esta lista para pedir, llamar al personal y pagar.'
              : 'Confirma que estas en esta mesa para iniciar tu experiencia.'}
          </p>
        </div>

        {!sessionReady ? (
          <div className="max-w-xl mx-auto p-6 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-4">
            <ChefHat size={48} className="mx-auto text-amber-400" />
            <h2 className="text-2xl font-bold">Estas en Mesa {table.number}?</h2>
            <p className="text-gray-400">
              Al confirmar activaremos tu sesion de mesa para que puedas pedir desde el menu y comunicarte con el personal.
            </p>
            <button
              onClick={handleStartSession}
              disabled={isActivating}
              className={clsx(
                'px-6 py-3 rounded-2xl font-semibold',
                isActivating
                  ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
              )}
            >
              {isActivating ? 'Activando mesa...' : 'Si, comenzar en esta mesa'}
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.3fr_0.9fr] gap-6">
            <div className="space-y-6">
              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <User size={18} className="text-amber-400" />
                  <p className="font-semibold">Nombre opcional para tu pedido</p>
                </div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Ej. Familia Quispe"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {table.callRequest?.type && (
                  <div className={clsx(
                    'sm:col-span-2 p-4 rounded-3xl border',
                    table.callRequest.status === 'acknowledged'
                      ? 'bg-sky-500/10 border-sky-500/20'
                      : 'bg-amber-500/10 border-amber-500/20',
                  )}>
                    <p className={clsx(
                      'text-sm font-semibold',
                      table.callRequest.status === 'acknowledged' ? 'text-sky-300' : 'text-amber-300',
                    )}>
                      {table.callRequest.status === 'acknowledged'
                        ? 'Tu llamada ya esta siendo atendida'
                        : 'Tu llamada fue enviada al salon'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {table.callRequest.type === 'bill'
                        ? 'Solicitud de cuenta activa.'
                        : table.callRequest.type === 'order'
                          ? 'Solicitud para ordenar activa.'
                          : 'Solicitud de ayuda activa.'}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleCallWaiter('order')}
                  className="p-5 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center gap-4"
                >
                  <Bell size={28} />
                  <div className="text-left">
                    <p className="text-lg font-bold">Llamar al mesero</p>
                    <p className="text-sm text-white/80">Quiero ordenar o ayuda</p>
                  </div>
                </button>
                <button
                  onClick={() => handleCallWaiter('bill')}
                  className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4"
                >
                  <Phone size={28} className="text-emerald-400" />
                  <div className="text-left">
                    <p className="text-lg font-bold">Pedir la cuenta</p>
                    <p className="text-sm text-gray-400">Avisar a caja o salon</p>
                  </div>
                </button>
              </div>

              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <ShoppingBag size={18} className="text-amber-400" />
                  <p className="font-semibold">Menu para pedir desde tu mesa</p>
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {menu.map((product) => {
                    const cartItem = cart.find((item) => item.product.id === product.id);
                    return (
                      <div key={product.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-32 object-cover rounded-xl mb-3"
                        />
                        <div className="space-y-2">
                          <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.category}</p>
                          </div>
                          <p className="text-emerald-400 font-bold">Bs. {product.price.toFixed(2)}</p>
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => updateCart(product, -1)}
                              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="font-semibold">{cartItem?.quantity || 0}</span>
                            <button
                              onClick={() => updateCart(product, 1)}
                              className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 sticky top-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShoppingBag size={18} className="text-amber-400" />
                  <p className="font-semibold">Tu pedido</p>
                </div>

                {cart.length === 0 && sessionOrders.length === 0 ? (
                  <p className="text-gray-500 text-sm">Agrega productos del menu para enviar tu pedido.</p>
                ) : (
                  <div className="space-y-3">
                    {cart.length > 0 && (
                      <>
                        {cart.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5"
                          >
                            <div>
                              <p className="font-medium">{item.product.name}</p>
                              <p className="text-xs text-gray-500">Bs. {item.product.price.toFixed(2)} c/u</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{item.quantity}x</p>
                              <p className="text-xs text-emerald-400">
                                Bs. {(item.quantity * item.product.price).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}

                        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                          <span className="text-gray-400">Total</span>
                          <span className="text-2xl font-bold text-white">Bs. {cartTotal.toFixed(2)}</span>
                        </div>

                        <button
                          onClick={handleSubmitOrder}
                          disabled={isSubmittingOrder}
                          className={clsx(
                            'w-full py-3 rounded-2xl font-semibold',
                            isSubmittingOrder
                              ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
                          )}
                        >
                          {isSubmittingOrder ? 'Enviando pedido...' : 'Enviar pedido a cocina'}
                        </button>
                      </>
                    )}

                    {sessionOrders.length > 0 && (
                      <div className={clsx('space-y-3', cart.length > 0 && 'pt-4 border-t border-white/10')}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">Pedidos enviados</p>
                          <p className="text-xs text-gray-500">Actualiza automaticamente</p>
                        </div>

                        {sessionOrders.map((order) => {
                          const statusMeta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.pending;

                          return (
                            <div key={order.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">Pedido #{order.id}</p>
                                  <p className="text-xs text-gray-500">
                                    {order.customerName || 'Tu mesa'} · Bs. {order.total.toFixed(2)}
                                  </p>
                                </div>
                                <span
                                  className={clsx(
                                    'px-3 py-1 rounded-full text-xs font-semibold',
                                    statusMeta.badgeClassName,
                                  )}
                                >
                                  {statusMeta.label}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {order.items.map((item, index) => (
                                  <div
                                    key={`${order.id}-${item.product.id}-${index}`}
                                    className="flex items-center justify-between gap-3 text-sm"
                                  >
                                    <span className="text-gray-200">
                                      {item.quantity}x {item.product.name}
                                    </span>
                                    <span className="text-gray-500">
                                      Bs. {(item.quantity * item.product.price).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <p className="text-xs text-gray-400">{statusMeta.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <Phone size={14} />
                    <span className="text-sm font-medium">Estado de sesion</span>
                  </div>
                  <p className="text-xs text-blue-200/80">
                    Tu sesion de mesa seguira activa mientras la cuenta este abierta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientTableView;
