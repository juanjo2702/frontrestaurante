import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
/* eslint-disable react-refresh/only-export-components */

const RestaurantContext = createContext(null);

export const useRestaurant = () => useContext(RestaurantContext);

const RESERVATION_TIMEOUT_MINUTES = 30;
const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const EVENT_STREAM_URL = `${API_ROOT}/api/v1/events`;
const PUBLIC_TABLE_SESSION_TOKEN_KEY = 'public_table_session_token';
const PUBLIC_TABLE_UUID_KEY = 'public_table_uuid';
const PUBLIC_TABLE_SIGNATURE_KEY = 'public_table_signature';
const PUBLIC_TABLE_EXPIRES_AT_KEY = 'public_table_expires_at';
const PUBLIC_TABLE_FINGERPRINT_KEY = 'public_table_fingerprint';
const RESERVATION_TRACKING_TOKENS_KEY = 'reservation_tracking_tokens';

const statusMap = {
  pendiente: 'pending',
  preparando: 'preparing',
  listo: 'ready',
  servido: 'served',
  pagado: 'paid',
  cancelado: 'cancelled',
};

const reverseStatusMap = Object.fromEntries(
  Object.entries(statusMap).map(([backend, frontend]) => [frontend, backend]),
);

const mapOrderStatus = (backendStatus) => statusMap[backendStatus] || 'pending';
const mapToBackendStatus = (frontendStatus) => reverseStatusMap[frontendStatus] || 'pendiente';

const parseAmount = (value) => {
  const parsed = Number.parseFloat(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeReservation = (reservation) => ({
  id: reservation.id,
  code: reservation.codigo_reserva ?? null,
  tableId: reservation.mesa_id,
  tableNumber: reservation.mesa?.numero || null,
  customerName: reservation.nombre_cliente,
  customerPhone: reservation.telefono,
  peopleCount: reservation.cantidad_personas,
  partySize: reservation.cantidad_personas,
  reservationTime: reservation.hora_reserva,
  time: reservation.hora_reserva,
  status: reservation.estado,
  source: reservation.origen ?? 'staff',
  operationalStatus: reservation.operational_status ?? 'scheduled',
  guaranteeAmount: parseAmount(reservation.garantia_monto),
  guaranteeStatus: reservation.garantia_estado ?? 'not_required',
  guaranteeReference: reservation.garantia_referencia ?? null,
  guaranteeProofUrl: reservation.garantia_comprobante_url ?? null,
  guaranteeUploadedAt: reservation.garantia_subida_at ?? null,
  guaranteeReviewedAt: reservation.garantia_revisada_at ?? null,
  guaranteeReviewNotes: reservation.garantia_revision_notas ?? null,
  guaranteeReviewedBy: reservation.garantia_revisada_por ?? null,
  trackingToken: reservation.tracking_token ?? null,
  arrivedAt: reservation.arrived_at ?? null,
  seatedAt: reservation.seated_at ?? null,
  noShowAt: reservation.no_show_at ?? null,
  cancelledAt: reservation.cancelled_at ?? null,
  completedAt: reservation.completed_at ?? null,
});

const normalizeProduct = (product) => ({
  id: product.id,
  name: product.nombre,
  category: product.categoria?.nombre || 'general',
  price: parseAmount(product.precio),
  image: product.imagen_url,
});

const normalizeIngredient = (ingredient) => ({
  id: ingredient.id,
  name: ingredient.nombre,
  category: ingredient.categoria?.nombre || 'general',
  unit: ingredient.unidad_medida,
  stock: parseAmount(ingredient.stock_actual),
  minStock: parseAmount(ingredient.stock_minimo),
  costPerUnit: parseAmount(ingredient.costo_unitario),
  expiryDate: ingredient.fecha_vencimiento,
});

const normalizePendingPayment = (table) => {
  const payment = table.payment_transactions?.[0];
  const amount = payment ? parseAmount(payment.amount) : parseAmount(table.pago_pendiente_monto);

  if (!amount) {
    return null;
  }

  const paidAt = payment?.client_paid_at || table.pago_pendiente_fecha;

  return {
    id: payment?.id ?? table.pending_payment_id ?? null,
    amount,
    clientPaid: payment ? payment.status === 'client_paid' : Boolean(table.pago_pendiente_cliente_pago),
    paidAt: paidAt ? new Date(paidAt) : null,
    method: payment?.method || table.pago_pendiente_metodo || 'cash',
    status: payment?.status || (table.pago_pendiente_cliente_pago ? 'client_paid' : 'pending'),
    reference: payment?.reference || null,
  };
};

const normalizeTable = (table) => {
  const activeReservation = table.reservas?.[0] || table.reservas_pendientes?.[0] || null;

  return {
    id: table.id,
    uuid: table.uuid ?? null,
    number: table.numero,
    status:
      table.estado === 'libre'
        ? 'free'
        : table.estado === 'ocupada'
          ? 'occupied'
          : 'reserved',
    capacity: table.capacidad,
    occupiedSince: table.ocupada_desde ? new Date(table.ocupada_desde) : null,
    assignedWaiter: table.mesero_asignado
      ? { id: table.mesero_asignado.id, name: table.mesero_asignado.nombre }
      : null,
    callRequest: table.llamada_tipo
      ? {
          type: table.llamada_tipo,
          status: table.llamada_estado || 'pending',
          timestamp: table.llamada_timestamp ? new Date(table.llamada_timestamp) : null,
          attendedAt: table.llamada_atendida_timestamp ? new Date(table.llamada_atendida_timestamp) : null,
          attendedBy: table.call_attended_by
            ? {
                id: table.call_attended_by.id,
                name: table.call_attended_by.nombre,
              }
            : null,
        }
      : null,
    publicUrl: table.public_url ?? null,
    qrSignature: table.qr_signature ?? null,
    isQrEnabled: Boolean(table.is_qr_enabled),
    pendingPayment: normalizePendingPayment(table),
    pendingPaymentId: table.pending_payment_id ?? table.payment_transactions?.[0]?.id ?? null,
    reservation: activeReservation ? normalizeReservation(activeReservation) : null,
    session: table.session
      ? {
          id: table.session.id,
          status: table.session.status,
          startedAt: table.session.started_at,
          expiresAt: table.session.expires_at,
          lastSeenAt: table.session.last_seen_at,
        }
      : null,
    sessionOrders: (table.session_orders || []).map(normalizeOrder),
  };
};

const normalizeOrder = (order) => {
  const items =
    order.detalles?.map((detail) => ({
      product: normalizeProduct(detail.producto),
      quantity: detail.cantidad,
      notes: detail.notas,
      forTakeaway: order.tipo_pedido === 'llevar',
    })) || [];

  const computedTotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return {
    id: order.id,
    tableId: order.mesa_id,
    tableSessionId: order.table_session_id ?? null,
    tableNumber: order.mesa?.numero || null,
    orderSource: order.order_source ?? (order.tipo_pedido === 'llevar' ? 'takeaway' : 'staff'),
    orderType: order.tipo_pedido === 'mesa' ? 'dine-in' : 'takeaway',
    customerName: order.nombre_cliente,
    customerPhone: order.telefono_cliente,
    items,
    status: mapOrderStatus(order.estado),
    total: parseAmount(order.total) || computedTotal,
    createdAt: order.created_at,
    readyAt: order.estado === 'listo' ? order.updated_at : null,
    paidAt: order.fecha_pago,
    paymentMethod: order.metodo_pago,
  };
};

const normalizeSplitBill = (payload) => {
  if (!payload?.bill) {
    return null;
  }

  return {
    bill: {
      id: payload.bill.id,
      tableId: payload.bill.mesa_id,
      status: payload.bill.status,
      totalAmount: parseAmount(payload.bill.total_amount),
      paidAmount: parseAmount(payload.bill.paid_amount),
      outstandingAmount: parseAmount(payload.bill.outstanding_amount),
      openedAt: payload.bill.opened_at,
      closedAt: payload.bill.closed_at,
      canReset: Boolean(payload.bill.can_reset),
    },
    accounts: (payload.accounts || []).map((account) => ({
      id: account.id,
      tableSessionId: account.table_session_id ?? null,
      displayName: account.display_name,
      ownerType: account.owner_type,
      status: account.status,
      subtotalAmount: parseAmount(account.subtotal_amount),
      paidAmount: parseAmount(account.paid_amount),
      outstandingAmount: parseAmount(account.outstanding_amount),
      sortOrder: account.sort_order ?? 0,
      items: (account.items || []).map((item) => ({
        allocationId: item.allocation_id,
        detailId: item.detail_id,
        productName: item.product_name,
        quantity: item.quantity,
        allocatedAmount: parseAmount(item.allocated_amount),
        allocationType: item.allocation_type,
      })),
    })),
    lineItems: (payload.line_items || []).map((item) => ({
      allocationId: item.allocation_id,
      detailId: item.detail_id,
      orderId: item.order_id,
      billAccountId: item.bill_account_id,
      accountDisplayName: item.account_display_name,
      accountStatus: item.account_status,
      sourceLabel: item.source_label,
      productName: item.product_name,
      quantity: item.quantity,
      detailSubtotal: parseAmount(item.detail_subtotal),
      allocatedAmount: parseAmount(item.allocated_amount),
      allocationType: item.allocation_type,
      canEdit: Boolean(item.can_edit),
    })),
    groups: (payload.groups || []).map((group) => ({
      label: group.label,
      items: (group.items || []).map((item) => ({
        allocationId: item.allocation_id,
        detailId: item.detail_id,
        orderId: item.order_id,
        billAccountId: item.bill_account_id,
        accountDisplayName: item.account_display_name,
        accountStatus: item.account_status,
        sourceLabel: item.source_label,
        productName: item.product_name,
        quantity: item.quantity,
        detailSubtotal: parseAmount(item.detail_subtotal),
        allocatedAmount: parseAmount(item.allocated_amount),
        allocationType: item.allocation_type,
        canEdit: Boolean(item.can_edit),
      })),
    })),
  };
};

const getWaitingTimeForTable = (table) => {
  if (!table?.occupiedSince) {
    return null;
  }

  const occupiedAt = new Date(table.occupiedSince);
  const minutes = Math.max(0, Math.floor((Date.now() - occupiedAt.getTime()) / 60000));

  return {
    minutes,
    status: minutes >= 30 ? 'critical' : minutes >= 15 ? 'warning' : 'ok',
  };
};

const settingMappings = {
  restaurantName: { group: 'general', type: 'string' },
  slogan: { group: 'general', type: 'string' },
  phone: { group: 'general', type: 'string' },
  email: { group: 'general', type: 'string' },
  address: { group: 'general', type: 'string' },
  openTime: { group: 'hours', type: 'string' },
  closeTime: { group: 'hours', type: 'string' },
  daysOpen: { group: 'hours', type: 'json' },
  soundEnabled: { group: 'notifications', type: 'boolean' },
  emailNotifications: { group: 'notifications', type: 'boolean' },
  kitchenAlerts: { group: 'notifications', type: 'boolean' },
  primaryColor: { group: 'appearance', type: 'string' },
  darkMode: { group: 'appearance', type: 'boolean' },
  acceptCash: { group: 'payments', type: 'boolean' },
  acceptCard: { group: 'payments', type: 'boolean' },
  acceptQR: { group: 'payments', type: 'boolean' },
  taxRate: { group: 'payments', type: 'integer' },
  tipSuggestions: { group: 'payments', type: 'json' },
};

export const RestaurantProvider = ({ children }) => {
  const { user } = useAuth();
  const isClientRole = user?.role === 'client';
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expiredReservations, setExpiredReservations] = useState([]);
  const [waitingTime, setWaitingTime] = useState({ minutes: 0, status: 'ok' });
  const [lowStockIngredients, setLowStockIngredients] = useState([]);
  const [expiringIngredients, setExpiringIngredients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [orderMode, setOrderMode] = useState('dine-in');
  const [takeawayCustomer, setTakeawayCustomer] = useState({ name: '', phone: '' });
  const lastEventIdRef = useRef(null);
  const refreshInFlightRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const applyTableUpdate = useCallback((updatedTable) => {
    if (!updatedTable) {
      return;
    }

    setTables((previous) =>
      previous.map((table) => (table.id === updatedTable.id ? updatedTable : table)),
    );
    setSelectedTable((current) => (current?.id === updatedTable.id ? updatedTable : current));
  }, []);

  const refreshProtectedData = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (!user || isClientRole) {
      setIsLoading(false);
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    if (!silent) {
      setIsLoading(true);
    }

    const refreshPromise = (async () => {
      const [
        tablesResult,
        productsResult,
        ingredientsResult,
        ordersResult,
        lowStockResult,
        expiringResult,
        reservationsResult,
      ] = await Promise.allSettled([
        api.get('/tables'),
        api.get('/products'),
        api.get('/ingredients'),
        api.get('/orders'),
        api.get('/ingredients/low-stock'),
        api.get('/ingredients/expiring'),
        api.get('/reservations/active'),
      ]);

      if (tablesResult.status === 'fulfilled') {
        const normalizedTables = tablesResult.value.data.map(normalizeTable);
        setTables(normalizedTables);
        setSelectedTable((current) => normalizedTables.find((table) => table.id === current?.id) || null);
      } else {
        console.error('Error fetching tables:', tablesResult.reason);
      }

      if (productsResult.status === 'fulfilled') {
        setProducts(productsResult.value.data.map(normalizeProduct));
      } else {
        console.error('Error fetching products:', productsResult.reason);
      }

      if (ingredientsResult.status === 'fulfilled') {
        setIngredients(ingredientsResult.value.data.map(normalizeIngredient));
      } else {
        console.error('Error fetching ingredients:', ingredientsResult.reason);
      }

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value.data.map(normalizeOrder));
      } else {
        console.error('Error fetching orders:', ordersResult.reason);
      }

      if (lowStockResult.status === 'fulfilled') {
        setLowStockIngredients(lowStockResult.value.data.map(normalizeIngredient));
      } else {
        console.error('Error fetching low stock ingredients:', lowStockResult.reason);
      }

      if (expiringResult.status === 'fulfilled') {
        setExpiringIngredients(expiringResult.value.data.map(normalizeIngredient));
      } else {
        console.error('Error fetching expiring ingredients:', expiringResult.reason);
      }

      if (reservationsResult.status === 'fulfilled') {
        setReservations(reservationsResult.value.data.map(normalizeReservation));
      } else {
        console.error('Error fetching active reservations:', reservationsResult.reason);
      }
    })().catch((error) => {
      console.error('Error fetching protected restaurant data:', error);
    }).finally(() => {
      refreshInFlightRef.current = null;
      if (!silent) {
        setIsLoading(false);
      }
    });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [user, isClientRole]);

  const scheduleProtectedRefresh = useCallback((delay = 250) => {
    if (!user || isClientRole) {
      return;
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      refreshProtectedData({ silent: true });
    }, delay);
  }, [user, isClientRole, refreshProtectedData]);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
  }, []);

  const refreshWaitingTime = useCallback(async () => {
    if (!user || isClientRole) {
      return;
    }

    try {
      const response = await api.get('/waiting-time');
      setWaitingTime({
        minutes: response.data.minutes ?? 0,
        status: response.data.status ?? 'ok',
      });
    } catch (error) {
      console.error('Error fetching waiting time:', error);
    }
  }, [user, isClientRole]);

  useEffect(() => {
    if (!user || isClientRole) {
      setTables([]);
      setProducts([]);
      setIngredients([]);
      setOrders([]);
      setLowStockIngredients([]);
      setExpiringIngredients([]);
      setReservations([]);
      setSelectedTable(null);
      setIsLoading(false);
      return;
    }

    refreshProtectedData({ silent: false });
    refreshWaitingTime();
  }, [user, isClientRole, refreshProtectedData, refreshWaitingTime]);

  useEffect(() => {
    if (!user || isClientRole) {
      return undefined;
    }

    const interval = setInterval(() => refreshProtectedData({ silent: true }), 30000);
    return () => clearInterval(interval);
  }, [user, isClientRole, refreshProtectedData]);

  useEffect(() => {
    if (!user || isClientRole) {
      return undefined;
    }

    const interval = setInterval(refreshWaitingTime, 30000);
    return () => clearInterval(interval);
  }, [user, isClientRole, refreshWaitingTime]);

  const checkExpiredReservations = useCallback(() => {
    const now = new Date();
    const expired = [];

    setTables((previousTables) =>
      previousTables.map((table) => {
        if (table.status !== 'reserved' || !table.reservation?.reservationTime) {
          return table;
        }

        const reservationTime = new Date(table.reservation.reservationTime);
        const minutesPassed = (now.getTime() - reservationTime.getTime()) / 60000;

        if (minutesPassed >= RESERVATION_TIMEOUT_MINUTES) {
          expired.push({
            tableNumber: table.number,
            customerName: table.reservation.customerName,
            reservationTime: table.reservation.reservationTime,
          });

          return { ...table, status: 'free', reservation: null };
        }

        return table;
      }),
    );

    if (expired.length > 0) {
      setExpiredReservations((previous) => [...previous, ...expired]);
    }
  }, []);

  useEffect(() => {
    if (!user || isClientRole) {
      return undefined;
    }

    checkExpiredReservations();
    const interval = setInterval(checkExpiredReservations, 60000);
    return () => clearInterval(interval);
  }, [user, isClientRole, checkExpiredReservations]);

  useEffect(() => {
    if (!user || isClientRole) {
      return undefined;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      return undefined;
    }

    let abortController = new AbortController();
    let reconnectTimeout;

    const showBrowserNotification = (event) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
      }

      const roleFilters = {
        'order.created': ['admin', 'kitchen', 'cashier'],
        'order.status.updated': ['admin', 'kitchen', 'cashier', 'waiter'],
        'table.call': ['admin', 'waiter'],
        'payment.client_paid': ['admin', 'cashier'],
        'payment.confirmed': ['admin', 'cashier', 'waiter'],
      };

      const allowedRoles = roleFilters[event.type];
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return;
      }

      const payload = event.payload || {};
      const notifications = {
        'order.created': {
          title: 'Nuevo pedido',
          body: `Mesa ${payload.table_number || 'llevar'}: ${payload.customer_name || 'cliente'}`,
        },
        'order.status.updated': {
          title: 'Pedido actualizado',
          body: `Pedido #${payload.order_id} -> ${payload.status}`,
        },
        'table.call': {
          title: 'Llamada de mesa',
          body: `Mesa ${payload.table_number}: ${payload.call_type}`,
        },
        'payment.client_paid': {
          title: 'Pago enviado',
          body: `Mesa ${payload.table_number}: Bs. ${parseAmount(payload.amount).toFixed(2)}`,
        },
        'payment.confirmed': {
          title: 'Pago confirmado',
          body: `Mesa ${payload.table_number}: Bs. ${parseAmount(payload.amount).toFixed(2)}`,
        },
      };

      const config = notifications[event.type];
      if (config) {
        new Notification(config.title, {
          body: config.body,
          icon: '/favicon.ico',
        });
      }
    };

    const connect = async () => {
      try {
        const headers = {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        };

        if (lastEventIdRef.current) {
          headers['Last-Event-ID'] = String(lastEventIdRef.current);
        }

        const response = await fetch(EVENT_STREAM_URL, {
          method: 'GET',
          headers,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed with status ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (line.startsWith('id:')) {
              lastEventIdRef.current = line.slice(3).trim();
              continue;
            }

            if (!line.startsWith('data:')) {
              continue;
            }

            try {
              const event = JSON.parse(line.slice(5).trim());

              if (event.id) {
                lastEventIdRef.current = event.id;
              }

              if (event.type !== 'heartbeat') {
                scheduleProtectedRefresh();
                refreshWaitingTime();
                showBrowserNotification(event);
              }
            } catch (error) {
              console.warn('Error parsing SSE event:', error);
            }
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }

        console.error('SSE connection error:', error);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      abortController.abort();
      clearTimeout(reconnectTimeout);
    };
  }, [user, isClientRole, refreshProtectedData, refreshWaitingTime, scheduleProtectedRefresh]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') {
      return;
    }

    Notification.requestPermission().catch(() => {});
  }, []);

  const clearExpiredNotification = (index) => {
    setExpiredReservations((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateTableStatus = async (tableId, status, reservation = null) => {
    const backendStatus =
      status === 'free' ? 'libre' : status === 'occupied' ? 'ocupada' : 'reservada';

    setTables((previous) =>
      previous.map((table) => (table.id === tableId ? { ...table, status, reservation } : table)),
    );

    try {
      const response = await api.put(`/tables/${tableId}`, { estado: backendStatus });
      applyTableUpdate(normalizeTable(response.data));
    } catch (error) {
      console.error('Error updating table status:', error);
      refreshProtectedData({ silent: true });
    }
  };

  const activateReservation = async (table) => {
    if (table.status !== 'reserved') {
      return;
    }

    await updateTableStatus(table.id, 'occupied', null);
    setSelectedTable((current) =>
      current?.id === table.id ? { ...current, status: 'occupied', reservation: null } : current,
    );
    setCart([]);
  };

  const selectTable = async (table, waiter = null) => {
    setOrderMode('dine-in');
    setSelectedTable(table);
    setCart([]);

    try {
      if (waiter && (!table.assignedWaiter || table.assignedWaiter.id === waiter.id)) {
        const response = await api.post(`/tables/${table.id}/assign-waiter`, {
          mesero_asignado_id: waiter.id,
        });
        applyTableUpdate(normalizeTable(response.data));
      }
    } catch (error) {
      console.error('Error selecting table:', error);
      setSelectedTable(table);
      refreshProtectedData({ silent: true });
    }
  };

  const getMyTables = (waiterId) => tables.filter((table) => table.assignedWaiter?.id === waiterId);

  const cancelReservation = async (tableId) => {
    await updateTableStatus(tableId, 'free', null);

    if (selectedTable?.id === tableId) {
      setSelectedTable(null);
      setCart([]);
    }
  };

  const getReservationTimeInfo = (reservation) => {
    if (!reservation?.reservationTime) {
      return null;
    }

    const now = new Date();
    const reservationTime = new Date(reservation.reservationTime);
    const diffMinutes = Math.round((reservationTime.getTime() - now.getTime()) / 60000);

    if (diffMinutes > 0) {
      return { status: 'upcoming', minutes: diffMinutes, text: `En ${diffMinutes} min` };
    }

    if (diffMinutes > -RESERVATION_TIMEOUT_MINUTES) {
      return {
        status: 'waiting',
        minutes: Math.abs(diffMinutes),
        text: `Hace ${Math.abs(diffMinutes)} min`,
      };
    }

    return { status: 'expired', minutes: Math.abs(diffMinutes), text: 'Expirada' };
  };

  const getTableOrders = (tableId) =>
    orders.filter(
      (order) =>
        order.tableId === tableId && order.status !== 'paid' && order.status !== 'cancelled',
    );

  const getTableTotal = (tableId) =>
    getTableOrders(tableId).reduce((total, order) => total + parseAmount(order.total), 0);

  const getTakeawayOrders = () =>
    orders.filter(
      (order) =>
        order.orderType === 'takeaway' &&
        order.status !== 'paid' &&
        order.status !== 'cancelled',
    );

  const getOrderStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((order) => {
      const orderDate = new Date(order.createdAt || new Date());
      return orderDate >= today;
    });

    const activeOrders = todayOrders.filter((order) => order.status !== 'cancelled');
    const completedOrders = todayOrders.filter((order) => ['served', 'paid'].includes(order.status));
    const cancelledOrders = todayOrders.filter((order) => order.status === 'cancelled');

    const calculateRevenue = (collection) =>
      collection.reduce((sum, order) => sum + parseAmount(order.total), 0);

    return {
      totalOrders: todayOrders.length,
      dineInCount: activeOrders.filter((order) => order.orderType === 'dine-in').length,
      takeawayCount: activeOrders.filter((order) => order.orderType === 'takeaway').length,
      deliveredCount: completedOrders.length,
      cancelledCount: cancelledOrders.length,
      totalRevenue: calculateRevenue(todayOrders.filter((order) => order.status === 'paid')),
      dineInRevenue: calculateRevenue(
        todayOrders.filter((order) => order.status === 'paid' && order.orderType === 'dine-in'),
      ),
      takeawayRevenue: calculateRevenue(
        todayOrders.filter((order) => order.status === 'paid' && order.orderType === 'takeaway'),
      ),
    };
  };

  const addToCart = (product) => {
    setCart((previous) => {
      const existing = previous.find((item) => item.product.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...previous, { product, quantity: 1, notes: '', takeawayQty: 0 }];
    });
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setCart((previous) => previous.filter((item) => item.product.id !== productId));
      return;
    }

    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId
          ? { ...item, quantity, takeawayQty: Math.min(item.takeawayQty, quantity) }
          : item,
      ),
    );
  };

  const updateCartNotes = (productId, notes) => {
    setCart((previous) =>
      previous.map((item) => (item.product.id === productId ? { ...item, notes } : item)),
    );
  };

  const incrementTakeaway = (productId) => {
    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId && item.takeawayQty < item.quantity
          ? { ...item, takeawayQty: item.takeawayQty + 1 }
          : item,
      ),
    );
  };

  const decrementTakeaway = (productId) => {
    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId && item.takeawayQty > 0
          ? { ...item, takeawayQty: item.takeawayQty - 1 }
          : item,
      ),
    );
  };

  const getCartTotal = () =>
    cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

  const sendOrderToKitchen = async () => {
    if (orderMode === 'dine-in' && !selectedTable) {
      return false;
    }

    if (cart.length === 0) {
      return false;
    }

    const payload = {
      mesa_id: orderMode === 'dine-in' ? selectedTable?.id : null,
      order_type: orderMode === 'dine-in' ? 'mesa' : 'llevar',
      customer_name: takeawayCustomer.name,
      customer_phone: takeawayCustomer.phone,
      items: cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        notes: item.notes,
      })),
    };

    try {
      await api.post('/orders', payload);
      setCart([]);
      if (orderMode === 'takeaway') {
        setTakeawayCustomer({ name: '', phone: '' });
      }
      refreshProtectedData({ silent: true });
      return true;
    } catch (error) {
      console.error('Failed to create order:', error);
      return false;
    }
  };

  const updateOrderStatus = async (orderId, status, reason = null) => {
    setOrders((previous) =>
      previous.map((order) => (order.id === orderId ? { ...order, status } : order)),
    );

    try {
      await api.put(`/orders/${orderId}`, {
        estado: mapToBackendStatus(status),
        reason,
      });
      refreshProtectedData({ silent: true });
    } catch (error) {
      console.error('Error updating order status:', error);
      refreshProtectedData({ silent: true });
    }
  };

  const payTakeawayOrder = async (orderId, paymentMethod = 'cash') => {
    try {
      await api.put(`/orders/${orderId}`, {
        estado: 'pagado',
        metodo_pago: paymentMethod,
      });
      refreshProtectedData({ silent: true });
      return true;
    } catch (error) {
      console.error('Error paying takeaway order:', error);
      refreshProtectedData({ silent: true });
      return false;
    }
  };

  const getSplitBill = useCallback(async (tableId) => {
    try {
      const response = await api.get(`/tables/${tableId}/split-bill`);
      return normalizeSplitBill(response.data?.data);
    } catch (error) {
      console.error('Error fetching split bill:', error);
      return null;
    }
  }, []);

  const initializeSplitBill = useCallback(async (tableId, options = {}) => {
    const response = await api.post(`/tables/${tableId}/split-bill/initialize`, {
      strategy: options.strategy || 'by_session',
      reset: options.reset ?? false,
    });

    refreshProtectedData({ silent: true });

    return normalizeSplitBill(response.data?.data);
  }, [refreshProtectedData]);

  const createSplitBillAccount = useCallback(async (tableId, displayName) => {
    const response = await api.post(`/tables/${tableId}/split-bill/accounts`, {
      display_name: displayName,
    });

    refreshProtectedData({ silent: true });

    return normalizeSplitBill(response.data?.data);
  }, [refreshProtectedData]);

  const updateSplitBillAccount = useCallback(async (tableId, accountId, payload) => {
    const response = await api.patch(`/tables/${tableId}/split-bill/accounts/${accountId}`, payload);

    refreshProtectedData({ silent: true });

    return normalizeSplitBill(response.data?.data);
  }, [refreshProtectedData]);

  const mutateSplitBillAllocations = useCallback(async (tableId, payload) => {
    const response = await api.post(`/tables/${tableId}/split-bill/allocations`, payload);

    refreshProtectedData({ silent: true });

    return normalizeSplitBill(response.data?.data);
  }, [refreshProtectedData]);

  const createPaymentIntent = async ({ tableId = null, billAccountId = null, method = 'cash' }) => {
    const response = await api.post('/payments/intents', {
      mesa_id: tableId,
      bill_account_id: billAccountId,
      method,
    });

    refreshProtectedData({ silent: true });

    return response.data;
  };

  const confirmPaymentTransaction = async (paymentId) => {
    const response = await api.post(`/payments/${paymentId}/confirm`);

    refreshProtectedData({ silent: true });

    return response.data;
  };

  const initiateQRPayment = async (tableId) => {
    try {
      return createPaymentIntent({
        tableId,
        method: 'qr',
      });
    } catch (error) {
      console.error('Error initiating QR payment:', error);
      refreshProtectedData({ silent: true });
      return null;
    }
  };

  const payTable = async (tableId, paymentMethod = 'cash') => {
    if (paymentMethod === 'qr') {
      return initiateQRPayment(tableId);
    }

    if (paymentMethod === 'card') {
      return startTableCardCheckout(tableId);
    }

    try {
      const intentResponse = await createPaymentIntent({
        tableId,
        method: paymentMethod,
      });

      await confirmPaymentTransaction(intentResponse.id);
      return true;
    } catch (error) {
      console.error('Error paying table:', error);
      refreshProtectedData({ silent: true });
      return false;
    }
  };

  const createMockCheckoutSession = async (paymentId, scope = 'protected') => {
    const prefix = scope === 'public' ? '/public' : '';
    const response = await api.post(`${prefix}/payments/${paymentId}/mock-checkout/session`);
    return response.data;
  };

  const submitMockCheckout = async (payload, scope = 'protected') => {
    const prefix = scope === 'public' ? '/public' : '';
    const response = await api.post(`${prefix}/payments/mock-checkout/submit`, payload);

    if (scope === 'protected') {
      refreshProtectedData({ silent: true });
    }

    return response.data;
  };

  const startTableCardCheckout = async (tableId) => {
    const intentResponse = await createPaymentIntent({
      tableId,
      method: 'card',
    });

    return createMockCheckoutSession(intentResponse.id);
  };

  const startBillAccountCardCheckout = async (billAccountId) => {
    const intentResponse = await createPaymentIntent({
      billAccountId,
      method: 'card',
    });

    return createMockCheckoutSession(intentResponse.id);
  };

  const startPublicCardCheckout = async (paymentId) => createMockCheckoutSession(paymentId, 'public');

  const freeTable = async (tableId) => {
    try {
      const response = await api.post(`/tables/${tableId}/free`);
      applyTableUpdate(normalizeTable(response.data));
      if (selectedTable?.id === tableId) {
        setSelectedTable(null);
        setCart([]);
      }
    } catch (error) {
      console.error('Error freeing table:', error);
      refreshProtectedData({ silent: true });
    }
  };

  const cancelOrder = (orderId) => updateOrderStatus(orderId, 'cancelled', 'Cancelado desde sala');

  const deselectTable = () => {
    setSelectedTable(null);
    setCart([]);
  };

  const switchOrderMode = (mode) => {
    setOrderMode(mode);
    if (mode === 'takeaway') {
      setSelectedTable(null);
    }
    setCart([]);
  };

  const getTableByNumber = (number) => tables.find((table) => table.number === number);

  const occupyTableByClient = async (tableId, reservationId = null) => {
    const targetReservation =
      reservationId != null
        ? reservations.find((reservation) => reservation.id === reservationId)
        : reservations.find(
            (reservation) => reservation.tableId === tableId && reservation.status === 'pendiente',
          );

    if (targetReservation) {
      try {
        await api.put(`/reservations/${targetReservation.id}`, { estado: 'confirmada' });
      } catch (error) {
        console.error('Error confirming reservation:', error);
      }
    }

    try {
      await api.post(`/tables/${tableId}/occupy`);
      refreshProtectedData({ silent: true });
    } catch (error) {
      console.error('Error occupying table:', error);
      refreshProtectedData({ silent: true });
    }
  };

  const requestWaiter = async (tableId, type = 'attention') => {
    setTables((previous) =>
      previous.map((table) =>
        table.id === tableId
          ? {
              ...table,
              callRequest: {
                type,
                status: 'pending',
                timestamp: new Date(),
                attendedAt: null,
                attendedBy: null,
              },
            }
          : table,
      ),
    );

    try {
      const response = await api.put(`/tables/${tableId}`, { llamada_tipo: type });
      applyTableUpdate(normalizeTable(response.data));
    } catch (error) {
      console.error('Error requesting waiter:', error);
      refreshProtectedData({ silent: true });
    }
  };

  const acknowledgeCall = async (tableId) => {
    const response = await api.post(`/tables/${tableId}/calls/acknowledge`);
    const updatedTable = normalizeTable(response.data);

    applyTableUpdate(updatedTable);
    return updatedTable;
  };

  const resolveCall = async (tableId) => {
    const response = await api.post(`/tables/${tableId}/calls/resolve`);
    const updatedTable = normalizeTable(response.data);

    applyTableUpdate(updatedTable);
    return updatedTable;
  };

  const dismissCall = async (tableId) => {
    try {
      await resolveCall(tableId);
    } catch (error) {
      console.error('Error dismissing table call:', error);
      refreshProtectedData({ silent: true });
    }
  };

  const getWaitingTime = (table = null) => {
    if (!table) {
      return waitingTime;
    }

    return getWaitingTimeForTable(table);
  };

  const getActiveCallsCount = () => tables.filter((table) => table.callRequest).length;

  const findPendingPayment = (tableId) => {
    const table = tables.find((current) => current.id === tableId);
    return table?.pendingPayment || null;
  };

  const markPaymentAsClientPaid = async (tableId) => {
    const payment = findPendingPayment(tableId);

    if (!payment?.id) {
      return false;
    }

    try {
      await api.post(`/payments/${payment.id}/mark-client-paid`);
      refreshProtectedData({ silent: true });
      return true;
    } catch (error) {
      console.error('Error marking payment as client paid:', error);
      refreshProtectedData({ silent: true });
      return false;
    }
  };

  const confirmPayment = async (tableId) => {
    const payment = findPendingPayment(tableId);

    if (!payment?.id) {
      return false;
    }

    try {
      await api.post(`/payments/${payment.id}/confirm`);
      refreshProtectedData({ silent: true });
      return true;
    } catch (error) {
      console.error('Error confirming payment:', error);
      refreshProtectedData({ silent: true });
      return false;
    }
  };

  const getPublicFingerprint = useCallback(() => {
    const current = sessionStorage.getItem(PUBLIC_TABLE_FINGERPRINT_KEY);
    if (current) {
      return current;
    }

    const generated = window.crypto?.randomUUID?.() || `fp-${Date.now()}`;
    sessionStorage.setItem(PUBLIC_TABLE_FINGERPRINT_KEY, generated);
    return generated;
  }, []);

  const setStoredPublicSession = useCallback((tableUuid, signature, token, expiresAt) => {
    sessionStorage.setItem(PUBLIC_TABLE_UUID_KEY, tableUuid);
    sessionStorage.setItem(PUBLIC_TABLE_SIGNATURE_KEY, signature);
    sessionStorage.setItem(PUBLIC_TABLE_SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(PUBLIC_TABLE_EXPIRES_AT_KEY, String(expiresAt));
  }, []);

  const clearPublicTableSession = useCallback(() => {
    sessionStorage.removeItem(PUBLIC_TABLE_UUID_KEY);
    sessionStorage.removeItem(PUBLIC_TABLE_SIGNATURE_KEY);
    sessionStorage.removeItem(PUBLIC_TABLE_SESSION_TOKEN_KEY);
    sessionStorage.removeItem(PUBLIC_TABLE_EXPIRES_AT_KEY);
  }, []);

  const getStoredPublicSession = useCallback(() => {
    const tableUuid = sessionStorage.getItem(PUBLIC_TABLE_UUID_KEY);
    const signature = sessionStorage.getItem(PUBLIC_TABLE_SIGNATURE_KEY);
    const token = sessionStorage.getItem(PUBLIC_TABLE_SESSION_TOKEN_KEY);
    const expiresAt = sessionStorage.getItem(PUBLIC_TABLE_EXPIRES_AT_KEY);

    if (!tableUuid || !signature || !token || !expiresAt) {
      return null;
    }

    if (new Date(expiresAt).getTime() <= Date.now()) {
      clearPublicTableSession();
      return null;
    }

    return { tableUuid, signature, token, expiresAt };
  }, [clearPublicTableSession]);

  const getStoredReservationTrackingTokens = useCallback(() => {
    try {
      const rawTokens = localStorage.getItem(RESERVATION_TRACKING_TOKENS_KEY);
      const parsed = rawTokens ? JSON.parse(rawTokens) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      console.error('Error reading reservation tracking tokens:', error);
      return [];
    }
  }, []);

  const storeReservationTrackingToken = useCallback((trackingToken) => {
    if (!trackingToken) {
      return;
    }

    const tokens = getStoredReservationTrackingTokens();
    const uniqueTokens = [trackingToken, ...tokens.filter((token) => token !== trackingToken)].slice(0, 50);
    localStorage.setItem(RESERVATION_TRACKING_TOKENS_KEY, JSON.stringify(uniqueTokens));
  }, [getStoredReservationTrackingTokens]);

  const getPublicTableByUuid = useCallback(async (tableUuid, signature = null) => {
    try {
      const currentSignature =
        signature ||
        (sessionStorage.getItem(PUBLIC_TABLE_UUID_KEY) === tableUuid
          ? sessionStorage.getItem(PUBLIC_TABLE_SIGNATURE_KEY)
          : null);

      const response = await api.get(`/public/tables/${tableUuid}`, {
        params: currentSignature ? { sig: currentSignature } : undefined,
      });
      return normalizeTable(response.data);
    } catch (error) {
      if (error?.response?.status === 401) {
        clearPublicTableSession();
      }
      console.error('Error fetching public table:', error);
      return null;
    }
  }, [clearPublicTableSession]);

  const beginPublicTableSession = useCallback(async (tableUuid, signature) => {
    try {
      const fingerprint = getPublicFingerprint();
      const response = await api.post('/public/table-sessions', {
        mesa_uuid: tableUuid,
        signature,
        fingerprint,
      });

      setStoredPublicSession(
        tableUuid,
        signature,
        response.data.table_session_token,
        response.data.expires_at,
      );

      return normalizeTable(response.data.table);
    } catch (error) {
      console.error('Error creating public table session:', error);
      clearPublicTableSession();
      throw error;
    }
  }, [clearPublicTableSession, getPublicFingerprint, setStoredPublicSession]);

  const checkTableAvailability = useCallback(async (fecha, hora, personas) => {
    try {
      const response = await api.get('/public/tables/availability', {
        params: { fecha, hora, personas },
      });
      return response.data;
    } catch (error) {
      console.error('Error checking table availability:', error);
      return { disponibles: [], total: 0 };
    }
  }, []);

  const getPublicMenu = useCallback(async () => {
    try {
      const response = await api.get('/public/menu');
      return response.data.map(normalizeProduct);
    } catch (error) {
      console.error('Error fetching public menu:', error);
      return [];
    }
  }, []);

  const createPublicReservation = useCallback(async (reservationData) => {
    const formData = new FormData();

    Object.entries(reservationData).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      formData.append(key, value);
    });

    const response = await api.post('/public/reservations', formData);
    const normalizedReservation = normalizeReservation(response.data);

    storeReservationTrackingToken(normalizedReservation.trackingToken);

    return normalizedReservation;
  }, [storeReservationTrackingToken]);

  const checkReservationAvailability = useCallback(async (fecha, hora, personas) => {
    try {
      const response = await api.get('/public/reservations/availability', {
        params: { fecha, hora, personas },
      });
      return response.data;
    } catch (error) {
      console.error('Error checking reservation availability:', error);
      return { disponible: false, mesas: [] };
    }
  }, []);

  const getPublicReservationHistory = useCallback(async (tokens = null) => {
    const trackingTokens = tokens ?? getStoredReservationTrackingTokens();

    if (!trackingTokens.length) {
      return { items: [], total: 0 };
    }

    const response = await api.post('/public/reservations/history', {
      tokens: trackingTokens,
    });

    return {
      items: (response.data.items || []).map(normalizeReservation),
      total: response.data.total || 0,
    };
  }, [getStoredReservationTrackingTokens]);

  const replacePublicReservationProof = useCallback(async (trackingToken, payload) => {
    const formData = new FormData();

    if (payload?.garantiaReferencia) {
      formData.append('garantia_referencia', payload.garantiaReferencia);
    }

    if (payload?.proofFile) {
      formData.append('comprobante_garantia', payload.proofFile);
    }

    const response = await api.post(`/public/reservations/${trackingToken}/proof`, formData);
    const normalizedReservation = normalizeReservation(response.data);

    storeReservationTrackingToken(normalizedReservation.trackingToken || trackingToken);

    return normalizedReservation;
  }, [storeReservationTrackingToken]);

  const getReservationAgenda = useCallback(async (date) => {
    const response = await api.get('/reservations/agenda', {
      params: date ? { date } : undefined,
    });

    return {
      date: response.data.date,
      items: (response.data.items || []).map(normalizeReservation),
      summary: response.data.summary || {},
    };
  }, []);

  const getReservationReviewQueue = useCallback(async (date) => {
    const response = await api.get('/reservations/review-queue', {
      params: date ? { date } : undefined,
    });

    return {
      items: (response.data.items || []).map(normalizeReservation),
      total: response.data.total || 0,
    };
  }, []);

  const reviewReservation = useCallback(async (reservationId, action, notes = '') => {
    const response = await api.post(`/reservations/${reservationId}/review`, {
      action,
      notes,
    });

    refreshProtectedData({ silent: true });

    return normalizeReservation(response.data);
  }, [refreshProtectedData]);

  const updateReservationOperationalStatus = useCallback(async (reservationId, status) => {
    const response = await api.post(`/reservations/${reservationId}/operational-status`, {
      status,
    });

    refreshProtectedData({ silent: true });

    return normalizeReservation(response.data);
  }, [refreshProtectedData]);

  const createPublicOrder = useCallback(async (tableUuid, orderData) => {
    const response = await api.post(`/public/tables/${tableUuid}/orders`, orderData);
    return response.data;
  }, []);

  const callPublic = useCallback(async (tableUuid, type) => {
    const response = await api.post(`/public/tables/${tableUuid}/call`, { tipo: type });
    return response.data;
  }, []);

  const paymentPublic = useCallback(async (tableUuid, amount, method = 'qr') => {
    const response = await api.post(`/public/tables/${tableUuid}/payment`, {
      monto: amount,
      metodo: method,
    });
    return response.data;
  }, []);

  const getSettings = useCallback(async () => {
    try {
      const response = await api.get('/settings');
      const grouped = response.data;
      const flat = {};

      Object.keys(settingMappings).forEach((key) => {
        const mapping = settingMappings[key];
        const group = grouped[mapping.group];

        if (!group) {
          return;
        }

        const setting = group.find((item) => item.key === key);
        if (!setting) {
          return;
        }

        let value = setting.value;
        if (mapping.type === 'json') {
          try {
            value = JSON.parse(value);
          } catch {
            value = [];
          }
        } else if (mapping.type === 'integer') {
          value = Number.parseInt(value, 10);
        } else if (mapping.type === 'boolean') {
          value = value === '1' || value === 'true' || value === true;
        }

        flat[key] = value;
      });

      return flat;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return {};
    }
  }, []);

  const updateSettings = useCallback(async (flatSettings) => {
    const settingsArray = Object.keys(flatSettings)
      .map((key) => {
        const mapping = settingMappings[key];
        if (!mapping) {
          return null;
        }

        let value = flatSettings[key];
        if (mapping.type === 'json') {
          value = JSON.stringify(value);
        } else if (mapping.type === 'boolean') {
          value = value ? 'true' : 'false';
        } else {
          value = String(value);
        }

        return {
          key,
          value,
          type: mapping.type,
          group: mapping.group,
        };
      })
      .filter(Boolean);

    const response = await api.put('/settings', { settings: settingsArray });
    return response.data;
  }, []);

  const value = {
    tables,
    products,
    ingredients,
    orders,
    cart,
    selectedTable,
    isLoading,
    expiredReservations,
    orderMode,
    takeawayCustomer,
    reservations,
    lowStockIngredients,
    expiringIngredients,
    RESERVATION_TIMEOUT_MINUTES,
    updateTableStatus,
    selectTable,
    deselectTable,
    activateReservation,
    cancelReservation,
    getReservationTimeInfo,
    getTableOrders,
    getTableTotal,
    getTakeawayOrders,
    getOrderStats,
    addToCart,
    updateCartQuantity,
    updateCartNotes,
    incrementTakeaway,
    decrementTakeaway,
    getCartTotal,
    sendOrderToKitchen,
    updateOrderStatus,
    payTable,
    payTakeawayOrder,
    freeTable,
    cancelOrder,
    setSelectedTable,
    clearExpiredNotification,
    switchOrderMode,
    setTakeawayCustomer,
    getTableByNumber,
    occupyTableByClient,
    requestWaiter,
    acknowledgeCall,
    resolveCall,
    dismissCall,
    getWaitingTime,
    getActiveCallsCount,
    initiateQRPayment,
    markPaymentAsClientPaid,
    confirmPayment,
    startTableCardCheckout,
    startBillAccountCardCheckout,
    startPublicCardCheckout,
    submitMockCheckout,
    getMyTables,
    setIngredients,
    productRecipes: {},
    getLowStockIngredients: () => lowStockIngredients,
    getExpiringIngredients: () => expiringIngredients,
    getPublicTableByUuid,
    beginPublicTableSession,
    getStoredPublicSession,
    clearPublicTableSession,
    checkTableAvailability,
    getPublicMenu,
    createPublicReservation,
    checkReservationAvailability,
    getPublicReservationHistory,
    replacePublicReservationProof,
    createPublicOrder,
    callPublic,
    paymentPublic,
    getReservationAgenda,
    getReservationReviewQueue,
    reviewReservation,
    updateReservationOperationalStatus,
    getSplitBill,
    initializeSplitBill,
    createSplitBillAccount,
    updateSplitBillAccount,
    mutateSplitBillAllocations,
    createPaymentIntent,
    confirmPaymentTransaction,
    getSettings,
    updateSettings,
    refreshProtectedData,
  };

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
};
