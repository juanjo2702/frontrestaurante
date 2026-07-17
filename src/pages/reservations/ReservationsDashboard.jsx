import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Eye, RefreshCw, ShieldCheck, UserCheck, Users, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';

const guaranteeBadgeMap = {
  not_required: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
  pending_review: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  rejected: 'bg-red-500/15 text-red-300 border-red-400/20',
};

const guaranteeLabelMap = {
  not_required: 'Sin garantía',
  pending_review: 'Pendiente revisión',
  approved: 'Garantía aprobada',
  rejected: 'Garantía rechazada',
};

const operationalBadgeMap = {
  scheduled: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
  arrived: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20',
  seated: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  no_show: 'bg-red-500/15 text-red-300 border-red-400/20',
  cancelled: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
  completed: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
};

const operationalLabelMap = {
  scheduled: 'Programada',
  arrived: 'Llegó',
  seated: 'Sentado',
  no_show: 'No show',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const formatDateTime = (value) => {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  return date.toLocaleString('es-BO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getOperationalActions = (reservation) => {
  switch (reservation.operationalStatus) {
    case 'scheduled':
      return ['arrived', 'no_show', 'cancelled'];
    case 'arrived':
      return ['seated', 'cancelled'];
    case 'seated':
      return ['completed'];
    default:
      return [];
  }
};

const SummaryCard = ({ icon, label, value, accent = 'text-white' }) => {
  const IconComponent = icon;

  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <IconComponent size={18} className={accent} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

const ReservationsDashboard = () => {
  const { user } = useAuth();
  const {
    getReservationAgenda,
    getReservationReviewQueue,
    reviewReservation,
    updateReservationOperationalStatus,
  } = useRestaurant();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [agenda, setAgenda] = useState({ items: [], summary: {}, date: today });
  const [reviewQueue, setReviewQueue] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState('');

  const canReviewGuarantees = ['admin', 'cashier'].includes(user?.role);
  const canOperateReservations = ['admin', 'cashier', 'waiter'].includes(user?.role);

  const loadReservationsData = useCallback(async () => {
    setLoading(true);
    try {
      const [agendaResult, reviewQueueResult] = await Promise.all([
        getReservationAgenda(selectedDate),
        canReviewGuarantees ? getReservationReviewQueue() : Promise.resolve({ items: [], total: 0 }),
      ]);

      setAgenda(agendaResult);
      setReviewQueue(reviewQueueResult);
    } catch (error) {
      console.error('Error loading reservations dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [canReviewGuarantees, getReservationAgenda, getReservationReviewQueue, selectedDate]);

  useEffect(() => {
    loadReservationsData();
  }, [loadReservationsData]);

  const handleReview = async (reservationId, action) => {
    const key = `${action}-${reservationId}`;
    setActionKey(key);
    try {
      await reviewReservation(reservationId, action);
      await loadReservationsData();
    } catch (error) {
      console.error('Error reviewing reservation guarantee:', error);
    } finally {
      setActionKey('');
    }
  };

  const handleOperationalStatus = async (reservationId, status) => {
    const key = `${status}-${reservationId}`;
    setActionKey(key);
    try {
      await updateReservationOperationalStatus(reservationId, status);
      await loadReservationsData();
    } catch (error) {
      console.error('Error updating reservation status:', error);
    } finally {
      setActionKey('');
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservas</h1>
          <p className="text-sm text-gray-500">Agenda diaria, comprobantes y estados operativos.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white"
          />
          <button
            onClick={loadReservationsData}
            disabled={loading}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw size={16} className={clsx(loading && 'animate-spin')} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard icon={CalendarDays} label="Total" value={agenda.summary.total || 0} />
        <SummaryCard icon={ShieldCheck} label="Pendientes de revisión" value={agenda.summary.pending_review || 0} accent="text-amber-300" />
        <SummaryCard icon={Clock3} label="Programadas" value={agenda.summary.scheduled || 0} accent="text-blue-300" />
        <SummaryCard icon={UserCheck} label="Llegaron" value={agenda.summary.arrived || 0} accent="text-cyan-300" />
        <SummaryCard icon={Users} label="Sentadas" value={agenda.summary.seated || 0} accent="text-emerald-300" />
        <SummaryCard icon={XCircle} label="No show" value={agenda.summary.no_show || 0} accent="text-red-300" />
      </div>

      {canReviewGuarantees && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-amber-300" />
            <h2 className="text-lg font-semibold text-white">Garantías pendientes</h2>
          </div>

          {reviewQueue.items.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-gray-500">
              No hay comprobantes pendientes de revisión para esta fecha.
            </div>
          ) : (
            <div className="grid gap-4">
              {reviewQueue.items.map((reservation) => (
                <div key={reservation.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-white font-semibold">{reservation.code}</span>
                        <span className={clsx('px-2 py-1 rounded-full text-xs border', guaranteeBadgeMap[reservation.guaranteeStatus] || guaranteeBadgeMap.not_required)}>
                          {guaranteeLabelMap[reservation.guaranteeStatus] || reservation.guaranteeStatus}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">
                        Mesa {reservation.tableNumber} · {reservation.customerName} · {reservation.peopleCount} personas
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(reservation.reservationTime)} · Garantía Bs. {reservation.guaranteeAmount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Tel: {reservation.customerPhone} {reservation.guaranteeReference ? `· Ref: ${reservation.guaranteeReference}` : ''}
                      </p>
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(reservation.id, 'reject')}
                          disabled={actionKey === `reject-${reservation.id}`}
                          className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-400/20 text-red-300 hover:bg-red-500/25 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleReview(reservation.id, 'approve')}
                          disabled={actionKey === `approve-${reservation.id}`}
                          className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60"
                        >
                          Aprobar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-blue-300" />
          <h2 className="text-lg font-semibold text-white">Agenda del dia</h2>
        </div>

        {agenda.items.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-gray-500">
            No hay reservas registradas para la fecha seleccionada.
          </div>
        ) : (
          <div className="grid gap-4">
            {agenda.items.map((reservation) => (
              <div key={reservation.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-semibold">{reservation.code}</span>
                      <span className={clsx('px-2 py-1 rounded-full text-xs border', operationalBadgeMap[reservation.operationalStatus] || operationalBadgeMap.scheduled)}>
                        {operationalLabelMap[reservation.operationalStatus] || reservation.operationalStatus}
                      </span>
                      <span className={clsx('px-2 py-1 rounded-full text-xs border', guaranteeBadgeMap[reservation.guaranteeStatus] || guaranteeBadgeMap.not_required)}>
                        {guaranteeLabelMap[reservation.guaranteeStatus] || reservation.guaranteeStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">
                      Mesa {reservation.tableNumber} · {reservation.customerName} · {reservation.peopleCount} personas
                    </p>
                    <p className="text-sm text-gray-500">{formatDateTime(reservation.reservationTime)}</p>
                    <p className="text-sm text-gray-500">
                      Estado comercial: {reservation.status} {reservation.customerPhone ? `· ${reservation.customerPhone}` : ''}
                    </p>
                    {reservation.guaranteeReviewNotes ? (
                      <p className="text-sm text-amber-200">
                        Nota de revisión: {reservation.guaranteeReviewNotes}
                      </p>
                    ) : null}
                  </div>

                  {canOperateReservations ? (
                    <div className="flex flex-wrap gap-2">
                      {getOperationalActions(reservation).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleOperationalStatus(reservation.id, status)}
                          disabled={actionKey === `${status}-${reservation.id}`}
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 hover:text-white disabled:opacity-60"
                        >
                          {operationalLabelMap[status]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ReservationsDashboard;
