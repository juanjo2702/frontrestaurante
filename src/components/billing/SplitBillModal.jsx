import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightLeft,
  Check,
  CreditCard,
  DollarSign,
  Equal,
  Grip,
  Plus,
  QrCode,
  RefreshCw,
  SplitSquareVertical,
  UserRound,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRestaurant } from '../../context/RestaurantContext';
import MockCardCheckoutModal from '../payments/MockCardCheckoutModal';

const paymentMethodMeta = {
  cash: { label: 'Efectivo', icon: DollarSign, className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
  qr: { label: 'QR', icon: QrCode, className: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
  card: { label: 'Tarjeta', icon: CreditCard, className: 'bg-purple-500/15 border-purple-500/30 text-purple-400' },
};

const statusMeta = {
  open: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagada',
  settling: 'Liquidando',
  settled: 'Liquidada',
};

const createEmptySplitBill = () => ({
  bill: null,
  accounts: [],
  lineItems: [],
  groups: [],
});

const SplitBillModal = ({ open, onClose, tableId, tableNumber, scope = 'waiter' }) => {
  const {
    getSplitBill,
    initializeSplitBill,
    createSplitBillAccount,
    updateSplitBillAccount,
    mutateSplitBillAllocations,
    createPaymentIntent,
    confirmPaymentTransaction,
    startBillAccountCardCheckout,
    startTableCardCheckout,
  } = useRestaurant();

  const [splitBill, setSplitBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [emptyStateMessage, setEmptyStateMessage] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [activeLineItem, setActiveLineItem] = useState(null);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState('');
  const [splitAmount, setSplitAmount] = useState('');
  const [mockSession, setMockSession] = useState(null);
  const [mockPaymentLabel, setMockPaymentLabel] = useState('Pago con tarjeta');
  const [mockPaymentAmount, setMockPaymentAmount] = useState(0);

  const loadSplitBill = useCallback(async (options = {}) => {
    if (!tableId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setEmptyStateMessage('');

      const current = await getSplitBill(tableId);
      if (current && !options.forceInitialize) {
        setSplitBill(current);
        return;
      }

      const initialized = await initializeSplitBill(tableId, {
        strategy: options.strategy || 'by_session',
        reset: options.reset ?? false,
      });
      setSplitBill(initialized);
    } catch (loadError) {
      const status = loadError?.response?.status;
      const message = loadError?.response?.data?.message || 'No se pudo cargar la cuenta dividida';

      if (status === 409) {
        setSplitBill(createEmptySplitBill());
        setEmptyStateMessage(message);
        return;
      }

      console.error('Error loading split bill:', loadError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getSplitBill, initializeSplitBill, tableId]);

  useEffect(() => {
    if (!open) {
      setSplitBill(null);
      setError(null);
      setEmptyStateMessage('');
      setActiveLineItem(null);
      setSelectedTargetAccountId('');
      setSplitAmount('');
      setNewAccountName('');
      setEditingAccountId(null);
      setEditingAccountName('');
      setMockPaymentAmount(0);
      return;
    }

    loadSplitBill();
  }, [loadSplitBill, open, tableId]);

  const accountOptions = useMemo(
    () => (splitBill?.accounts || []).filter((account) => account.status !== 'paid'),
    [splitBill],
  );

  const moveTargets = useMemo(() => {
    if (!activeLineItem) {
      return [];
    }

    return accountOptions.filter((account) => account.id !== activeLineItem.billAccountId);
  }, [accountOptions, activeLineItem]);

  const handleQuickAction = async (strategy) => {
    try {
      setSubmitting(true);
      setError(null);
      setEmptyStateMessage('');
      const updated = await initializeSplitBill(tableId, {
        strategy,
        reset: true,
      });
      setSplitBill(updated);
      setActiveLineItem(null);
    } catch (actionError) {
      console.error('Error running split bill quick action:', actionError);
      setError(actionError?.response?.data?.message || 'No se pudo reorganizar la cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const updated = await createSplitBillAccount(tableId, newAccountName.trim());
      setSplitBill(updated);
      setNewAccountName('');
    } catch (actionError) {
      console.error('Error creating split bill account:', actionError);
      setError(actionError?.response?.data?.message || 'No se pudo crear la subcuenta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameAccount = async (accountId) => {
    if (!editingAccountName.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const updated = await updateSplitBillAccount(tableId, accountId, {
        action: 'rename',
        display_name: editingAccountName.trim(),
      });
      setSplitBill(updated);
      setEditingAccountId(null);
      setEditingAccountName('');
    } catch (actionError) {
      console.error('Error renaming split bill account:', actionError);
      setError(actionError?.response?.data?.message || 'No se pudo renombrar la subcuenta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async () => {
    if (!activeLineItem || !selectedTargetAccountId) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const updated = await mutateSplitBillAllocations(tableId, {
        action: 'move',
        allocation_id: activeLineItem.allocationId,
        target_account_id: Number(selectedTargetAccountId),
      });
      setSplitBill(updated);
      setActiveLineItem(null);
      setSelectedTargetAccountId('');
      setSplitAmount('');
    } catch (actionError) {
      console.error('Error moving allocation:', actionError);
      setError(actionError?.response?.data?.message || 'No se pudo mover el item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSplit = async () => {
    if (!activeLineItem || !selectedTargetAccountId || !splitAmount) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const updated = await mutateSplitBillAllocations(tableId, {
        action: 'split',
        allocation_id: activeLineItem.allocationId,
        target_account_id: Number(selectedTargetAccountId),
        amount: Number(splitAmount),
      });
      setSplitBill(updated);
      setActiveLineItem(null);
      setSelectedTargetAccountId('');
      setSplitAmount('');
    } catch (actionError) {
      console.error('Error splitting allocation:', actionError);
      setError(actionError?.response?.data?.message || 'No se pudo dividir el item');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (method, account = null) => {
    try {
      setSubmitting(true);
      setError(null);

      if (method === 'card') {
        const session = account
          ? await startBillAccountCardCheckout(account.id)
          : await startTableCardCheckout(tableId);

        setMockSession(session);
        setMockPaymentLabel(
          account
            ? `Tarjeta - ${account.displayName}`
            : `Tarjeta - Mesa ${tableNumber}`
        );
        setMockPaymentAmount(account ? account.outstandingAmount : splitBill?.bill?.outstandingAmount || 0);
        return;
      }

      const payment = await createPaymentIntent({
        tableId: account ? null : tableId,
        billAccountId: account?.id ?? null,
        method,
      });

      await confirmPaymentTransaction(payment.id);
      await loadSplitBill();
    } catch (paymentError) {
      console.error('Error paying split bill target:', paymentError);
      setError(paymentError?.response?.data?.message || 'No se pudo registrar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const closeMockCheckout = () => {
    setMockSession(null);
    setMockPaymentLabel('Pago con tarjeta');
    setMockPaymentAmount(0);
  };

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="w-full h-full max-w-7xl mx-auto bg-[#101114] border border-white/10 rounded-[28px] overflow-hidden flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-gray-500">{scope === 'cashier' ? 'Caja' : 'Salon'}</p>
                    <h2 className="text-2xl font-bold text-white mt-1">Cobrar / Dividir Mesa {tableNumber}</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Organiza las subcuentas sin perder el total consolidado de la mesa.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                {splitBill?.bill ? (
                  <div className="grid md:grid-cols-4 gap-3 mt-5">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <p className="text-xs text-gray-500">Total mesa</p>
                      <p className="text-2xl font-bold text-white mt-1">Bs. {splitBill.bill.totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs text-emerald-300/70">Pagado</p>
                      <p className="text-2xl font-bold text-emerald-400 mt-1">Bs. {splitBill.bill.paidAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-300/70">Pendiente</p>
                      <p className="text-2xl font-bold text-amber-400 mt-1">Bs. {splitBill.bill.outstandingAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Estado</p>
                        <p className="text-lg font-semibold text-white mt-1">{statusMeta[splitBill.bill.status] || splitBill.bill.status}</p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {Object.entries(paymentMethodMeta).map(([method, meta]) => {
                          const Icon = meta.icon;
                          return (
                            <button
                              key={method}
                              onClick={() => handlePay(method, null)}
                              disabled={submitting || splitBill.bill.outstandingAmount <= 0}
                              className={clsx(
                                'flex-1 px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-2',
                                meta.className,
                                (submitting || splitBill.bill.outstandingAmount <= 0) && 'opacity-50 cursor-not-allowed',
                              )}
                            >
                              <Icon size={14} />
                              <span>{meta.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => handleQuickAction('by_session')}
                    disabled={submitting || !splitBill?.bill?.canReset}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm flex items-center gap-2 disabled:opacity-40"
                  >
                    <UserRound size={14} />
                    Auto-separar por dispositivo
                  </button>
                  <button
                    onClick={() => handleQuickAction('equal_split')}
                    disabled={submitting || !splitBill?.bill?.canReset}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm flex items-center gap-2 disabled:opacity-40"
                  >
                    <Equal size={14} />
                    Partes iguales
                  </button>
                  <button
                    onClick={() => handleQuickAction('by_session')}
                    disabled={submitting || !splitBill?.bill?.canReset}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm flex items-center gap-2 disabled:opacity-40"
                  >
                    <RefreshCw size={14} />
                    Reiniciar split
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 grid xl:grid-cols-[1.2fr_1fr_1fr] gap-0">
                <div className="border-r border-white/10 p-5 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold">Origen de consumo</h3>
                    <span className="text-xs text-gray-500">{splitBill?.groups?.length || 0} grupos</span>
                  </div>

                  {loading ? (
                    <div className="text-sm text-gray-500">Construyendo cuenta dividida...</div>
                  ) : splitBill?.groups?.length ? (
                    <div className="space-y-4">
                      {splitBill.groups.map((group) => (
                        <div key={group.label} className="p-4 rounded-2xl bg-white/[0.025] border border-white/10">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="font-semibold text-white">{group.label}</p>
                              <p className="text-xs text-gray-500">
                                Bs. {group.items.reduce((sum, item) => sum + item.allocatedAmount, 0).toFixed(2)}
                              </p>
                            </div>
                            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-400">
                              {group.items.length} lineas
                            </span>
                          </div>

                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <button
                                key={item.allocationId}
                                onClick={() => {
                                  setActiveLineItem(item);
                                  setSelectedTargetAccountId('');
                                  setSplitAmount('');
                                }}
                                className={clsx(
                                  'w-full text-left p-3 rounded-2xl border transition-all',
                                  activeLineItem?.allocationId === item.allocationId
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-white/[0.03] border-white/8',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {item.quantity}x {item.productName}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Asignado a {item.accountDisplayName}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-white">Bs. {item.allocatedAmount.toFixed(2)}</p>
                                    <span className="text-[11px] text-gray-500">{item.allocationType}</span>
                                  </div>
                                </div>

                                {activeLineItem?.allocationId === item.allocationId && item.canEdit ? (
                                  <div className="grid md:grid-cols-[1fr_auto_auto] gap-2 mt-3">
                                    <select
                                      value={selectedTargetAccountId}
                                      onChange={(event) => setSelectedTargetAccountId(event.target.value)}
                                      className="px-3 py-2 rounded-xl bg-[#13151a] border border-white/10 text-sm text-white focus:outline-none"
                                    >
                                      <option value="">Mover o dividir hacia...</option>
                                      {moveTargets.map((account) => (
                                        <option key={account.id} value={account.id}>
                                          {account.displayName}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleMove();
                                      }}
                                      disabled={!selectedTargetAccountId || submitting}
                                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white flex items-center gap-2 disabled:opacity-40"
                                    >
                                      <ArrowRightLeft size={14} />
                                      Mover
                                    </button>
                                    <div className="flex gap-2">
                                      <input
                                        value={splitAmount}
                                        onChange={(event) => setSplitAmount(event.target.value)}
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        placeholder="Bs."
                                        className="w-24 px-3 py-2 rounded-xl bg-[#13151a] border border-white/10 text-sm text-white focus:outline-none"
                                      />
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleSplit();
                                        }}
                                        disabled={!selectedTargetAccountId || !splitAmount || submitting}
                                        className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm flex items-center gap-2 disabled:opacity-40"
                                      >
                                        <SplitSquareVertical size={14} />
                                        Dividir
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {emptyStateMessage || 'Todavia no hay items liquidables para dividir.'}
                    </div>
                  )}
                </div>

                <div className="border-r border-white/10 p-5 overflow-y-auto">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-white font-semibold">Subcuentas</h3>
                      <p className="text-xs text-gray-500">Una vista de cobro por persona o grupo.</p>
                    </div>
                    <Grip size={16} className="text-gray-500" />
                  </div>

                  <div className="flex gap-2 mb-4">
                    <input
                      value={newAccountName}
                      onChange={(event) => setNewAccountName(event.target.value)}
                      placeholder="Nueva subcuenta"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#13151a] border border-white/10 text-sm text-white focus:outline-none"
                    />
                    <button
                      onClick={handleCreateAccount}
                      disabled={!newAccountName.trim() || submitting}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white flex items-center gap-2 disabled:opacity-40"
                    >
                      <Plus size={14} />
                      Agregar
                    </button>
                  </div>

                  <div className="space-y-3">
                    {splitBill?.accounts?.map((account) => (
                      <div
                        key={account.id}
                        className={clsx(
                          'p-4 rounded-3xl border',
                          account.status === 'paid'
                            ? 'bg-emerald-500/10 border-emerald-500/25'
                            : 'bg-white/[0.03] border-white/10',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            {editingAccountId === account.id ? (
                              <div className="flex gap-2">
                                <input
                                  value={editingAccountName}
                                  onChange={(event) => setEditingAccountName(event.target.value)}
                                  className="flex-1 px-3 py-2 rounded-xl bg-[#13151a] border border-white/10 text-sm text-white focus:outline-none"
                                />
                                <button
                                  onClick={() => handleRenameAccount(account.id)}
                                  className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm"
                                >
                                  Guardar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-lg font-semibold text-white">{account.displayName}</p>
                                {account.status !== 'paid' ? (
                                  <button
                                    onClick={() => {
                                      setEditingAccountId(account.id);
                                      setEditingAccountName(account.displayName);
                                    }}
                                    className="text-xs text-gray-500 hover:text-white"
                                  >
                                    Editar
                                  </button>
                                ) : null}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {statusMeta[account.status] || account.status} · {account.items.length} lineas
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Pendiente</p>
                            <p className="text-xl font-bold text-white">Bs. {account.outstandingAmount.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4">
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[11px] text-gray-500">Subtotal</p>
                            <p className="text-sm font-semibold text-white mt-1">Bs. {account.subtotalAmount.toFixed(2)}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[11px] text-gray-500">Pagado</p>
                            <p className="text-sm font-semibold text-emerald-400 mt-1">Bs. {account.paidAmount.toFixed(2)}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[11px] text-gray-500">Origen</p>
                            <p className="text-sm font-semibold text-white mt-1">{account.ownerType}</p>
                          </div>
                        </div>

                        <div className="space-y-2 mt-4">
                          {account.items.slice(0, 4).map((item) => (
                            <div key={item.allocationId} className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">{item.quantity}x {item.productName}</span>
                              <span className="text-white">Bs. {item.allocatedAmount.toFixed(2)}</span>
                            </div>
                          ))}
                          {account.items.length > 4 ? (
                            <p className="text-xs text-gray-500">+{account.items.length - 4} lineas mas</p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4">
                          {Object.entries(paymentMethodMeta).map(([method, meta]) => {
                            const Icon = meta.icon;
                            return (
                              <button
                                key={`${account.id}-${method}`}
                                onClick={() => handlePay(method, account)}
                                disabled={submitting || account.outstandingAmount <= 0}
                                className={clsx(
                                  'px-3 py-2 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-40',
                                  meta.className,
                                )}
                              >
                                <Icon size={14} />
                                <span>{meta.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 overflow-y-auto">
                  <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10">
                    <h3 className="text-white font-semibold">Resumen operativo</h3>
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Subcuentas</span>
                        <span className="text-white font-semibold">{splitBill?.accounts?.length || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Lineas asignadas</span>
                        <span className="text-white font-semibold">{splitBill?.lineItems?.length || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Pendiente total</span>
                        <span className="text-amber-400 font-semibold">Bs. {splitBill?.bill?.outstandingAmount?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>

                    <div className="mt-5 p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Check size={16} className="text-emerald-400" />
                        <span>La mesa se libera solo cuando el saldo pendiente llegue a cero.</span>
                      </div>
                    </div>

                    {emptyStateMessage && !error ? (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                        {emptyStateMessage}
                      </div>
                    ) : null}

                    {error ? (
                      <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                        {error}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MockCardCheckoutModal
        open={Boolean(mockSession)}
        session={mockSession}
        amount={mockPaymentAmount}
        title={mockPaymentLabel}
        onClose={closeMockCheckout}
        onSuccess={async () => {
          closeMockCheckout();
          await loadSplitBill();
        }}
      />
    </>
  );
};

export default SplitBillModal;
