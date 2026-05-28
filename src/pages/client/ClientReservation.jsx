import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  FileText,
  MessageCircle,
  Phone,
  RefreshCw,
  Table,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useLocation } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';

const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
];

const guaranteeLabelMap = {
  not_required: 'Sin garantia',
  pending_review: 'En revision',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const guaranteeBadgeMap = {
  not_required: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
  pending_review: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  rejected: 'bg-red-500/15 text-red-300 border-red-400/20',
};

const operationalLabelMap = {
  scheduled: 'Programada',
  arrived: 'Llegaste',
  seated: 'Ya asignada',
  no_show: 'No show',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const formatDisplayDate = (date) => {
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('es-BO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatHistoryDate = (value) => {
  if (!value) {
    return 'Sin fecha';
  }

  return new Date(value).toLocaleString('es-BO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ClientReservation = () => {
  const location = useLocation();
  const {
    checkReservationAvailability,
    createPublicReservation,
    getPublicReservationHistory,
    replacePublicReservationProof,
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState(() => (location.pathname === '/reservations' ? 'history' : 'new'));
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [guests, setGuests] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guaranteeReference, setGuaranteeReference] = useState('');
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [reuploadingToken, setReuploadingToken] = useState('');

  const monthNames = useMemo(
    () => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    [],
  );
  const dayNames = useMemo(() => ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'], []);

  useEffect(() => {
    setActiveTab(location.pathname === '/reservations' ? 'history' : 'new');
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (paymentProofPreview) {
        URL.revokeObjectURL(paymentProofPreview);
      }
    };
  }, [paymentProofPreview]);

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let index = 0; index < startingDay; index += 1) {
      days.push({ day: null, disabled: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const isPast = date < today;
      days.push({
        day,
        date,
        disabled: isPast,
        isToday: date.getTime() === today.getTime(),
      });
    }

    return days;
  };

  const resetReservationForm = useCallback(() => {
    setStep(1);
    setSelectedDate(null);
    setSelectedTime(null);
    setGuests(2);
    setCustomerName('');
    setCustomerPhone('');
    setGuaranteeReference('');
    setSelectedTableId(null);
    setAvailableTables([]);
    setPaymentProof(null);
    if (paymentProofPreview) {
      URL.revokeObjectURL(paymentProofPreview);
    }
    setPaymentProofPreview('');
  }, [paymentProofPreview]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await getPublicReservationHistory();
      setHistoryItems(response.items || []);
    } catch (error) {
      console.error('Error loading reservation history:', error);
      setHistoryError('No pudimos cargar tu historial ahora mismo.');
    } finally {
      setHistoryLoading(false);
    }
  }, [getPublicReservationHistory]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  useEffect(() => {
    let cancelled = false;

    const fetchAvailability = async () => {
      if (step !== 2 || !selectedDate || !selectedTime || guests < 1) {
        setIsCheckingAvailability(false);
        return;
      }

      setIsCheckingAvailability(true);
      try {
        const fecha = selectedDate.toISOString().split('T')[0];
        const result = await checkReservationAvailability(fecha, selectedTime, guests);

        if (cancelled) {
          return;
        }

        setAvailableTables(result.disponibles || []);
        setSelectedTableId((current) =>
          (result.disponibles || []).some((table) => table.id === current) ? current : null,
        );
      } catch (error) {
        console.error('Error checking availability:', error);
        if (!cancelled) {
          setAvailableTables([]);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingAvailability(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchAvailability, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [step, selectedDate, selectedTime, guests, checkReservationAvailability]);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (paymentProofPreview) {
      URL.revokeObjectURL(paymentProofPreview);
    }

    setPaymentProof(file);
    setPaymentProofPreview(URL.createObjectURL(file));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return Boolean(selectedDate && selectedTime);
      case 2:
        return Boolean(selectedTableId);
      case 3:
        return Boolean(customerName.trim() && customerPhone.trim());
      case 4:
        return Boolean(paymentProof);
      default:
        return false;
    }
  };

  const openWhatsAppFollowUp = (reservation) => {
    const message = encodeURIComponent(
      [
        '*Reserva creada en GUSTO*',
        '',
        `Codigo: ${reservation.code}`,
        `Fecha: ${formatHistoryDate(reservation.reservationTime)}`,
        `Mesa: Mesa ${reservation.tableNumber}`,
        `Cliente: ${reservation.customerName}`,
        `Telefono: ${reservation.customerPhone}`,
        '',
        'La garantia ya fue cargada en el sistema.',
      ].join('\n'),
    );

    window.open(`https://wa.me/59170000000?text=${message}`, '_blank');
  };

  const submitReservation = async () => {
    if (!selectedTableId || !selectedDate || !selectedTime || !customerName || !customerPhone || !paymentProof) {
      return;
    }

    const reservationDate = new Date(selectedDate);
    const localDate = [
      reservationDate.getFullYear(),
      String(reservationDate.getMonth() + 1).padStart(2, '0'),
      String(reservationDate.getDate()).padStart(2, '0'),
    ].join('-');

    setIsSubmitting(true);

    try {
      const reservation = await createPublicReservation({
        mesa_id: selectedTableId,
        nombre_cliente: customerName.trim(),
        cantidad_personas: guests,
        hora_reserva: `${localDate} ${selectedTime}:00`,
        telefono: customerPhone.trim(),
        garantia_referencia: guaranteeReference.trim(),
        comprobante_garantia: paymentProof,
      });

      setSubmitSuccess(reservation);
      resetReservationForm();
      await loadHistory();
      setActiveTab('history');
    } catch (error) {
      console.error('Error creating reservation:', error);
      alert('Hubo un error al crear la reserva. Revisa el comprobante e intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplaceProof = async (reservation, file) => {
    if (!reservation?.trackingToken || !file) {
      return;
    }

    setReuploadingToken(reservation.trackingToken);
    try {
      await replacePublicReservationProof(reservation.trackingToken, {
        garantiaReferencia: reservation.guaranteeReference,
        proofFile: file,
      });
      await loadHistory();
    } catch (error) {
      console.error('Error replacing reservation proof:', error);
      alert('No pudimos reenviar tu comprobante. Intenta nuevamente.');
    } finally {
      setReuploadingToken('');
    }
  };

  const selectedTable = availableTables.find((table) => table.id === selectedTableId);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Reservas GUSTO</h1>
          <p className="text-gray-500">Reserva con garantia real y revisa el estado de tus solicitudes.</p>
        </div>
        <div className="inline-flex p-1 rounded-2xl bg-white/[0.03] border border-white/10 self-start">
          <button
            onClick={() => setActiveTab('new')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              activeTab === 'new' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white',
            )}
          >
            Nueva reserva
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              activeTab === 'history' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white',
            )}
          >
            Mis reservas
          </button>
        </div>
      </div>

      {submitSuccess ? (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-400/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-emerald-300 font-semibold">Reserva registrada con exito</p>
              <p className="text-white text-lg">{submitSuccess.code} · Mesa {submitSuccess.tableNumber}</p>
              <p className="text-sm text-gray-300">
                Quedo en estado <span className="text-amber-300">{guaranteeLabelMap[submitSuccess.guaranteeStatus]}</span> para el comprobante.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => openWhatsAppFollowUp(submitSuccess)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:text-white flex items-center gap-2"
              >
                <MessageCircle size={16} />
                WhatsApp
              </button>
              <button
                onClick={() => setSubmitSuccess(null)}
                className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 text-emerald-300"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {activeTab === 'new' ? (
          <motion.div
            key="new-reservation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((currentStep) => (
                <React.Fragment key={currentStep}>
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                      step === currentStep && 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
                      step > currentStep && 'bg-emerald-500 text-white',
                      step < currentStep && 'bg-white/10 text-gray-500',
                    )}
                  >
                    {step > currentStep ? <Check size={18} /> : currentStep}
                  </div>
                  {currentStep < 5 ? (
                    <div
                      className={clsx(
                        'w-8 h-1 rounded-full transition-all',
                        step > currentStep ? 'bg-emerald-500' : 'bg-white/10',
                      )}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Fecha y hora</h2>
                      <p className="text-sm text-gray-500">Elige cuando te visitamos.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-white font-semibold">
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </span>
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {dayNames.map((day) => (
                        <div key={day} className="text-center text-xs text-gray-500 py-2">{day}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {generateCalendarDays().map((item, index) => (
                        <button
                          key={`${item.day}-${index}`}
                          disabled={item.disabled || !item.day}
                          onClick={() => item.day && !item.disabled && setSelectedDate(item.date)}
                          className={clsx(
                            'aspect-square rounded-lg text-sm font-medium transition-all',
                            !item.day && 'invisible',
                            item.disabled && 'text-gray-700 cursor-not-allowed',
                            !item.disabled && item.day && 'hover:bg-white/10 text-gray-300',
                            item.isToday && 'ring-1 ring-amber-500/50',
                            selectedDate?.getTime() === item.date?.getTime() && 'bg-amber-500 text-white hover:bg-amber-600',
                          )}
                        >
                          {item.day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedDate ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                        <Clock size={14} />
                        Horarios disponibles
                      </p>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                        {TIME_SLOTS.map((time) => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={clsx(
                              'py-3 rounded-xl text-sm font-medium transition-all',
                              selectedTime === time
                                ? 'bg-amber-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10',
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
                      <Users size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Personas y mesa</h2>
                      <p className="text-sm text-gray-500">Buscamos una mesa acorde a tu grupo.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <button
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      className="w-12 h-12 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xl font-bold"
                    >
                      -
                    </button>
                    <span className="text-4xl font-bold text-white w-16 text-center">{guests}</span>
                    <button
                      onClick={() => setGuests(Math.min(12, guests + 1))}
                      className="w-12 h-12 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xl font-bold"
                    >
                      +
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <Table size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Mesas disponibles</h2>
                        <p className="text-sm text-gray-500">Fecha {formatDisplayDate(selectedDate)} · {selectedTime}</p>
                      </div>
                    </div>

                    {isCheckingAvailability ? (
                      <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center text-gray-500">
                        Buscando mesas disponibles...
                      </div>
                    ) : null}

                    {!isCheckingAvailability && availableTables.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                        <p className="text-gray-300">No encontramos mesas libres en ese horario.</p>
                        <p className="text-sm text-gray-500 mt-2">Prueba con otra hora o una cantidad distinta de personas.</p>
                      </div>
                    ) : null}

                    {!isCheckingAvailability && availableTables.length > 0 ? (
                      <div className="space-y-3">
                        {availableTables.map((table) => (
                          <button
                            key={table.id}
                            onClick={() => setSelectedTableId(table.id)}
                            className={clsx(
                              'w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4',
                              selectedTableId === table.id
                                ? 'bg-amber-500/20 border-amber-500/50'
                                : 'bg-white/[0.03] border-white/10 hover:border-white/20',
                            )}
                          >
                            <span className="text-3xl">🍽️</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">Mesa {table.numero}</span>
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                                  {table.capacidad} personas
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">
                                Ubicacion: {table.ubicacion_x}, {table.ubicacion_y}
                              </p>
                            </div>
                            <div
                              className={clsx(
                                'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                                selectedTableId === table.id ? 'border-amber-500 bg-amber-500' : 'border-gray-600',
                              )}
                            >
                              {selectedTableId === table.id ? <Check size={14} className="text-white" /> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
                      <Phone size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Datos de contacto</h2>
                      <p className="text-sm text-gray-500">Los usamos para seguimiento y confirmacion.</p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Nombre completo</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Juan Perez"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Telefono o WhatsApp</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        placeholder="+591 70000000"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {step === 4 ? (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-green-500/20 text-green-400">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Garantia y comprobante</h2>
                      <p className="text-sm text-gray-500">La reserva entra a revision con tu comprobante.</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                    <p className="text-sm text-gray-400 mb-4">Monto sugerido de garantia</p>
                    <p className="text-4xl font-bold text-amber-400 mb-2">Bs. {guests * 50}</p>
                    <p className="text-sm text-gray-500">Se revisa por caja o administracion antes de confirmar.</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Referencia o numero de transferencia</label>
                    <input
                      type="text"
                      value={guaranteeReference}
                      onChange={(event) => setGuaranteeReference(event.target.value)}
                      placeholder="Opcional"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-3">Sube tu comprobante</p>
                    {paymentProofPreview ? (
                      <div className="relative rounded-2xl overflow-hidden border border-white/10">
                        <img src={paymentProofPreview} alt="Comprobante" className="w-full h-64 object-cover" />
                        <button
                          onClick={() => {
                            setPaymentProof(null);
                            if (paymentProofPreview) {
                              URL.revokeObjectURL(paymentProofPreview);
                            }
                            setPaymentProofPreview('');
                          }}
                          className="absolute top-3 right-3 p-2 rounded-full bg-red-500 text-white"
                        >
                          <X size={16} />
                        </button>
                        <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-emerald-500 text-white text-sm flex items-center gap-1">
                          <Check size={14} />
                          Comprobante listo
                        </div>
                      </div>
                    ) : (
                      <label className="block cursor-pointer">
                        <div className="p-8 rounded-2xl border-2 border-dashed border-white/20 hover:border-amber-500/50 transition-colors text-center">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Camera size={28} className="text-amber-400" />
                          </div>
                          <p className="text-gray-300 mb-1">Toca para subir imagen</p>
                          <p className="text-xs text-gray-500">Captura o foto del comprobante.</p>
                        </div>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </motion.div>
              ) : null}

              {step === 5 ? (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Check size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Resumen de reserva</h2>
                      <p className="text-sm text-gray-500">La garantia se guarda en el sistema, no solo en WhatsApp.</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-amber-400" />
                      <div>
                        <p className="text-xs text-gray-500">Fecha y hora</p>
                        <p className="text-white font-medium">{formatDisplayDate(selectedDate)} · {selectedTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-amber-400" />
                      <div>
                        <p className="text-xs text-gray-500">Personas</p>
                        <p className="text-white font-medium">{guests} personas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Table size={18} className="text-amber-400" />
                      <div>
                        <p className="text-xs text-gray-500">Mesa</p>
                        <p className="text-white font-medium">Mesa {selectedTable?.numero || 'No seleccionada'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-amber-400" />
                      <div>
                        <p className="text-xs text-gray-500">Contacto</p>
                        <p className="text-white font-medium">{customerName} · {customerPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-amber-400" />
                      <div>
                        <p className="text-xs text-gray-500">Referencia</p>
                        <p className="text-white font-medium">{guaranteeReference || 'Sin referencia adicional'}</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-gray-400">Garantia cargada</span>
                      <span className="text-emerald-400 font-bold">Bs. {guests * 50}</span>
                    </div>
                  </div>

                  <button
                    onClick={submitReservation}
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 disabled:opacity-70"
                  >
                    {isSubmitting ? <RefreshCw size={22} className="animate-spin" /> : <Upload size={22} />}
                    <span>{isSubmitting ? 'Guardando reserva...' : 'Confirmar reserva real'}</span>
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex gap-3">
              {step > 1 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-4 rounded-xl bg-white/5 text-gray-400 font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={20} />
                  Atras
                </button>
              ) : null}

              {step < 5 ? (
                <button
                  onClick={() => canProceed() && setStep(step + 1)}
                  disabled={!canProceed()}
                  className={clsx(
                    'flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                    canProceed()
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
                      : 'bg-white/5 text-gray-600 cursor-not-allowed',
                  )}
                >
                  Siguiente
                  <ChevronRight size={20} />
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reservation-history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Mis reservas</h2>
                <p className="text-sm text-gray-500">Aqui puedes revisar garantias, estados y volver a subir un comprobante.</p>
              </div>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white flex items-center gap-2 self-start"
              >
                <RefreshCw size={16} className={clsx(historyLoading && 'animate-spin')} />
                Actualizar
              </button>
            </div>

            {historyError ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-400/20 text-red-200">
                {historyError}
              </div>
            ) : null}

            {historyLoading ? (
              <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center text-gray-500">
                Cargando tus reservas...
              </div>
            ) : null}

            {!historyLoading && historyItems.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                <p className="text-gray-300">Todavia no tienes reservas registradas en este dispositivo.</p>
                <p className="text-sm text-gray-500 mt-2">Cuando completes una reserva aqui aparecera su seguimiento.</p>
              </div>
            ) : null}

            {!historyLoading && historyItems.length > 0 ? (
              <div className="grid gap-4">
                {historyItems.map((reservation) => (
                  <div key={reservation.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-semibold">{reservation.code}</span>
                          <span className={clsx('px-2 py-1 rounded-full text-xs border', guaranteeBadgeMap[reservation.guaranteeStatus] || guaranteeBadgeMap.not_required)}>
                            {guaranteeLabelMap[reservation.guaranteeStatus] || reservation.guaranteeStatus}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs border bg-blue-500/15 text-blue-300 border-blue-400/20">
                            {operationalLabelMap[reservation.operationalStatus] || reservation.operationalStatus}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Mesa {reservation.tableNumber} · {formatHistoryDate(reservation.reservationTime)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {reservation.customerName} · {reservation.customerPhone} · {reservation.peopleCount} personas
                        </p>
                        <p className="text-sm text-gray-500">
                          Garantia Bs. {reservation.guaranteeAmount.toFixed(2)}
                          {reservation.guaranteeReference ? ` · Ref: ${reservation.guaranteeReference}` : ''}
                        </p>
                        {reservation.guaranteeReviewNotes ? (
                          <p className="text-sm text-amber-200">
                            Nota: {reservation.guaranteeReviewNotes}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3 lg:items-end">
                        {reservation.guaranteeProofUrl ? (
                          <a
                            href={reservation.guaranteeProofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 hover:text-white"
                          >
                            <Eye size={14} />
                            Ver comprobante
                          </a>
                        ) : null}

                        {['rejected', 'pending_review'].includes(reservation.guaranteeStatus) ? (
                          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-sm text-amber-200 cursor-pointer">
                            <Upload size={14} />
                            {reuploadingToken === reservation.trackingToken ? 'Reenviando...' : 'Reenviar comprobante'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={reuploadingToken === reservation.trackingToken}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  handleReplaceProof(reservation, file);
                                }
                                event.target.value = '';
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientReservation;
