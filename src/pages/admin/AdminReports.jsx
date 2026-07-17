import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, BarChart3, TrendingUp, DollarSign, ShoppingBag,
  UtensilsCrossed, Calendar, Download, Clock, Users, Award,
  Search, RefreshCw, ChevronUp, ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../services/api';

const downloadCSV = (headers, rows, filename) => {
  const escapeCell = (cell) => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    return '"' + str.replace(/"/g, '""') + '"';
  };
  const csvContent = "\uFEFF" + [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const AdminReportsContent = () => {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'products', 'customers'
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    stats: { revenue: 0, orders: 0, avg_ticket: 0, clients: 0 },
    changes: { revenue: 0, orders: 0, avg_ticket: 0, clients: 0 },
    chart: [],
    top_products: [],
    types: { mesa: 0, llevar: 0 },
    peaks: { lunch: 0, dinner: 0, snack: 0 }
  });
  const [customerData, setCustomerData] = useState({
    topCustomers: [],
    retention: { total_customers: 0, repeat_customers: 0, retention_rate: 0 }
  });

  // Search & Sort states
  const [productSearch, setProductSearch] = useState('');
  const [productSortField, setProductSortField] = useState('sales'); // 'sales', 'revenue', 'name'
  const [productSortOrder, setProductSortOrder] = useState('desc'); // 'asc', 'desc'

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSortField, setCustomerSortField] = useState('totalSpent'); // 'orderCount', 'totalSpent', 'name'
  const [customerSortOrder, setCustomerSortOrder] = useState('desc');

  // Fetch Logic
  const fetchReports = React.useCallback(async () => {
    setLoading(true);
    setError('');
    
    const transformReportData = (data) => {
      const transformed = { ...data };
      if (transformed.stats && typeof transformed.stats.avg_ticket === 'string') {
        transformed.stats.avg_ticket = parseFloat(transformed.stats.avg_ticket.replace(',', '.'));
      }
      if (transformed.stats && transformed.stats.revenue) {
        transformed.stats.revenue = Number(transformed.stats.revenue);
      }
      if (transformed.changes && typeof transformed.changes === 'object') {
        Object.keys(transformed.changes).forEach(key => {
          if (typeof transformed.changes[key] === 'string') {
            transformed.changes[key] = parseFloat(transformed.changes[key].replace(',', '.'));
          }
        });
      }
      if (transformed.chart && Array.isArray(transformed.chart)) {
        transformed.chart = transformed.chart.map(day => ({
          ...day,
          sales: typeof day.sales === 'string' ? parseFloat(day.sales.replace(',', '.')) : Number(day.sales)
        }));
      }
      if (transformed.top_products && Array.isArray(transformed.top_products)) {
        transformed.top_products = transformed.top_products.map(product => ({
          ...product,
          revenue: typeof product.revenue === 'string' ? parseFloat(product.revenue.replace(',', '.')) : Number(product.revenue),
          sales: Number(product.sales)
        }));
      }
      return transformed;
    };

    const transformCustomerData = (topRes, retentionRes) => {
      return {
        topCustomers: topRes.data.map(customer => ({
          name: customer.customer_name || 'Cliente',
          orderCount: Number(customer.order_count),
          totalSpent: parseFloat(String(customer.total_spent).replace(',', '.')),
          lastOrder: customer.last_order_at,
        })),
        retention: {
          total_customers: retentionRes.data.total_customers || 0,
          repeat_customers: retentionRes.data.repeat_customers || 0,
          retention_rate: parseFloat(String(retentionRes.data.retention_rate || 0).replace(',', '.')),
        }
      };
    };

    try {
      const [reportsRes, topCustomersRes, retentionRes] = await Promise.all([
        api.get(`/reports?period=${period}`),
        api.get(`/customers/top?period=${period}`),
        api.get('/customers/retention')
      ]);
      setData(transformReportData(reportsRes.data));
      setCustomerData(transformCustomerData(topCustomersRes, retentionRes));
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      setError('No se pudieron cargar los reportes. Verifica el backend y vuelve a intentar.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Product sort/filter
  const filteredAndSortedProducts = useMemo(() => {
    const products = data.top_products || [];
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let valA = a[productSortField];
      let valB = b[productSortField];

      if (productSortField === 'name') {
        return productSortOrder === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return productSortOrder === 'asc' 
        ? valA - valB
        : valB - valA;
    });
  }, [data.top_products, productSearch, productSortField, productSortOrder]);

  // Customer sort/filter
  const filteredAndSortedCustomers = useMemo(() => {
    const customers = customerData.topCustomers || [];
    const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let valA = a[customerSortField];
      let valB = b[customerSortField];

      if (customerSortField === 'name') {
        return customerSortOrder === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return customerSortOrder === 'asc' 
        ? valA - valB
        : valB - valA;
    });
  }, [customerData.topCustomers, customerSearch, customerSortField, customerSortOrder]);

  // CSV Export logic
  const handleExportCSV = () => {
    if (activeTab === 'sales') {
      const headers = ['Fecha', 'Día', 'Ventas (Bs)', 'Pedidos'];
      const rows = data.chart.map(day => [
        day.full_date,
        day.day,
        day.sales.toFixed(2),
        day.orders
      ]);
      downloadCSV(headers, rows, `reporte_ventas_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    } else if (activeTab === 'products') {
      const headers = ['Ranking', 'Producto', 'Unidades Vendidas', 'Ingresos Totales (Bs)', 'Precio Promedio (Bs)'];
      const rows = filteredAndSortedProducts.map((p, i) => [
        i + 1,
        p.name,
        p.sales,
        p.revenue.toFixed(2),
        p.sales > 0 ? (p.revenue / p.sales).toFixed(2) : '0.00'
      ]);
      downloadCSV(headers, rows, `reporte_productos_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    } else if (activeTab === 'customers') {
      const headers = ['Ranking', 'Cliente', 'Pedidos Realizados', 'Total Gastado (Bs)', 'Ticket Promedio (Bs)'];
      const rows = filteredAndSortedCustomers.map((c, i) => [
        i + 1,
        c.name,
        c.orderCount,
        c.totalSpent.toFixed(2),
        c.orderCount > 0 ? (c.totalSpent / c.orderCount).toFixed(2) : '0.00'
      ]);
      downloadCSV(headers, rows, `reporte_clientes_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  const handleProductSort = (field) => {
    if (productSortField === field) {
      setProductSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setProductSortField(field);
      setProductSortOrder('desc');
    }
  };

  const handleCustomerSort = (field) => {
    if (customerSortField === field) {
      setCustomerSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setCustomerSortField(field);
      setCustomerSortOrder('desc');
    }
  };

  const salesStats = [
    { label: 'Ventas Totales', value: `Bs. ${Number(data.stats.revenue).toLocaleString('es-BO')}`, icon: DollarSign, color: 'emerald', change: `${data.changes?.revenue >= 0 ? '+' : ''}${(data.changes?.revenue ?? 0).toFixed(1)}%` },
    { label: 'Pedidos', value: data.stats.orders, icon: ShoppingBag, color: 'blue', change: `${data.changes?.orders >= 0 ? '+' : ''}${(data.changes?.orders ?? 0).toFixed(1)}%` },
    { label: 'Ticket Promedio', value: `Bs. ${Number(data.stats.avg_ticket).toLocaleString('es-BO', {minimumFractionDigits: 2})}`, icon: TrendingUp, color: 'amber', change: `${data.changes?.avg_ticket >= 0 ? '+' : ''}${(data.changes?.avg_ticket ?? 0).toFixed(1)}%` },
    { label: 'Clientes Únicos', value: data.stats.clients, icon: Users, color: 'purple', change: `${data.changes?.clients >= 0 ? '+' : ''}${(data.changes?.clients ?? 0).toFixed(1)}%` },
  ];

  const maxSales = Math.max(...(data.chart.map(d => d.sales) || [0]), 1);

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Reportes y Analíticas</h1>
            <p className="text-sm text-gray-500">Monitorea el rendimiento financiero, comercial y de fidelización de tu negocio.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Global filters shown for applicable tabs */}
          {activeTab !== 'customers' && (
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5">
              {['day', 'week', 'month'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    period === p ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white"
                  )}
                >
                  {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={fetchReports}
              disabled={loading}
              className="p-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={18} className={clsx(loading && "animate-spin")} />
            </button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportCSV}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Download size={16} />
              <span>Exportar CSV</span>
            </motion.button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Main Layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-3 mb-2">Menú de reportes</p>
            {[
              { id: 'sales', label: 'Ventas y Finanzas', desc: 'Ingresos, pedidos y horas pico', icon: BarChart3 },
              { id: 'products', label: 'Rendimiento de Productos', desc: 'Ventas y rendimiento por plato', icon: Award },
              { id: 'customers', label: 'Fidelización de Clientes', desc: 'Clientes top y tasa de retención', icon: Users }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "w-full text-left px-3 py-3 rounded-xl transition-all cursor-pointer flex gap-3 items-start",
                    isSelected 
                      ? "bg-amber-500/10 border border-amber-500/20 text-white" 
                      : "border border-transparent text-gray-400 hover:text-white hover:bg-white/[0.02]"
                  )}
                >
                  <div className={clsx(
                    "p-1.5 rounded-lg border",
                    isSelected ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-white/5 border-white/5"
                  )}>
                    <TabIcon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tab.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-light leading-snug">{tab.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={24} className="animate-spin text-amber-500" />
              <span>Cargando datos del reporte...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* TAB 1: SALES & FINANCES */}
              {activeTab === 'sales' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {salesStats.map((stat) => {
                      const StatIcon = stat.icon;
                      return (
                        <div
                          key={stat.label}
                          className={clsx(
                            "p-4 rounded-2xl border",
                            stat.color === 'emerald' && "bg-emerald-500/10 border-emerald-500/20",
                            stat.color === 'blue' && "bg-blue-500/10 border-blue-500/20",
                            stat.color === 'amber' && "bg-amber-500/10 border-amber-500/20",
                            stat.color === 'purple' && "bg-purple-500/10 border-purple-500/20"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <StatIcon size={20} className={clsx(
                              stat.color === 'emerald' && "text-emerald-400",
                              stat.color === 'blue' && "text-blue-400",
                              stat.color === 'amber' && "text-amber-400",
                              stat.color === 'purple' && "text-purple-400"
                            )} />
                            <span className={clsx(
                              "text-xs px-2 py-0.5 rounded font-medium",
                              stat.change.startsWith('+') ? "text-emerald-400 bg-emerald-500/20" : "text-rose-400 bg-rose-500/20"
                            )}>
                              {stat.change}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart and distribution row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Daily Sales Chart */}
                    <div className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          <BarChart3 size={18} className="text-amber-400" />
                          Ventas por Día
                        </h3>
                        <span className="text-xs text-gray-500 font-light">Datos del periodo seleccionado</span>
                      </div>
                      
                      {data.chart.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                          Sin datos de ventas registrados en el periodo.
                        </div>
                      ) : (
                        <div className="flex items-end justify-between h-48 gap-3 pt-6">
                          {data.chart.map((day, i) => (
                            <div key={day.day} className="h-full flex-1 flex flex-col items-center gap-2">
                              <div className="flex-1 w-full relative flex items-end group">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${(day.sales / maxSales) * 100}%` }}
                                  transition={{ delay: i * 0.05, duration: 0.5 }}
                                  className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg absolute bottom-0 left-0 right-0 mx-auto group-hover:from-amber-500 group-hover:to-amber-300 transition-colors"
                                >
                                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl">
                                    <span className="block font-bold">Bs. {day.sales.toFixed(2)}</span>
                                    <span className="block text-gray-400 text-[9px]">{day.orders} pedidos</span>
                                  </div>
                                </motion.div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium mt-1">{day.day}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Peak hours */}
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Clock size={18} className="text-purple-400" />
                        Horas Pico
                      </h3>
                      <p className="text-xs text-gray-500">Distribución de pedidos por franjas horarias comerciales.</p>

                      <div className="space-y-3">
                        {[
                          { time: '12:00 - 14:00', label: 'Almuerzo', orders: data.peaks.lunch, color: 'amber' },
                          { time: '19:00 - 21:00', label: 'Cena', orders: data.peaks.dinner, color: 'purple' },
                          { time: '15:00 - 17:00', label: 'Merienda', orders: data.peaks.snack, color: 'blue' },
                        ].map((peak) => (
                          <div 
                            key={peak.time}
                            className={clsx(
                              "p-3 rounded-xl border flex items-center justify-between",
                              peak.color === 'amber' && "bg-amber-500/5 border-amber-500/10",
                              peak.color === 'purple' && "bg-purple-500/5 border-purple-500/10",
                              peak.color === 'blue' && "bg-blue-500/5 border-blue-500/10"
                            )}
                          >
                            <div className="text-left">
                              <p className="text-xs font-semibold text-white">{peak.label}</p>
                              <p className="text-[10px] text-gray-500">{peak.time}</p>
                            </div>
                            <div className="text-right">
                              <span className={clsx(
                                "text-sm font-bold block",
                                peak.color === 'amber' && "text-amber-400",
                                peak.color === 'purple' && "text-purple-400",
                                peak.color === 'blue' && "text-blue-400"
                              )}>
                                {peak.orders} pedidos
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Channel stats */}
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                    <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                      <UtensilsCrossed size={18} className="text-blue-400" />
                      Pedidos por Origen / Tipo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Servicio en mesa</p>
                          <p className="text-3xl font-bold text-blue-400 mt-1">{data.types.mesa} pedidos</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-white/10">
                            {data.stats.orders > 0 ? Math.round((data.types.mesa / data.stats.orders) * 100) : 0}%
                          </span>
                        </div>
                      </div>

                      <div className="p-5 rounded-xl bg-orange-500/5 border border-orange-500/10 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Pedidos para llevar</p>
                          <p className="text-3xl font-bold text-orange-400 mt-1">{data.types.llevar} pedidos</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-white/10">
                            {data.stats.orders > 0 ? Math.round((data.types.llevar / data.stats.orders) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: PRODUCT RENDIMENT */}
              {activeTab === 'products' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Filters */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/[0.01] p-4 rounded-xl border border-white/5">
                    <div className="relative w-full md:w-80">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar plato o bebida..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-sm"
                      />
                    </div>

                    <div className="text-xs text-gray-500 font-light w-full md:w-auto text-right">
                      Mostrando {filteredAndSortedProducts.length} productos
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.01]">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 font-medium">
                          <th className="p-4 w-16 text-center">Rank</th>
                          <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleProductSort('name')}>
                            <div className="flex items-center gap-1">
                              Producto
                              {productSortField === 'name' && (productSortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </div>
                          </th>
                          <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleProductSort('sales')}>
                            <div className="flex items-center gap-1 justify-center">
                              Unidades Vendidas
                              {productSortField === 'sales' && (productSortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </div>
                          </th>
                          <th className="p-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleProductSort('revenue')}>
                            <div className="flex items-center gap-1 justify-end">
                              Ingresos Totales
                              {productSortField === 'revenue' && (productSortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </div>
                          </th>
                          <th className="p-4 text-right">P. Promedio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredAndSortedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500">
                              No se encontraron productos en este periodo.
                            </td>
                          </tr>
                        ) : (
                          filteredAndSortedProducts.map((product, index) => {
                            const avgPrice = product.sales > 0 ? (product.revenue / product.sales) : 0;
                            return (
                              <tr key={product.name} className="hover:bg-white/[0.01] transition-colors">
                                <td className="p-4 text-center">
                                  <span className={clsx(
                                    "w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold",
                                    index === 0 && "bg-amber-500 text-white",
                                    index === 1 && "bg-slate-400 text-white",
                                    index === 2 && "bg-amber-700 text-white",
                                    index > 2 && "bg-white/5 text-gray-400"
                                  )}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="p-4 font-medium text-white">{product.name}</td>
                                <td className="p-4 text-center text-gray-300 font-semibold">{product.sales}</td>
                                <td className="p-4 text-right text-amber-400 font-medium">Bs. {product.revenue.toFixed(2)}</td>
                                <td className="p-4 text-right text-gray-400">Bs. {avgPrice.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: CUSTOMER LOYALTY */}
              {activeTab === 'customers' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Retention Dashboard stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center items-center">
                      <div className="text-4xl font-extrabold text-purple-400">
                        {customerData.retention.retention_rate.toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-400 mt-2 font-medium">Tasa de Retención de Clientes</p>
                      <p className="text-[10px] text-gray-500 mt-1">Clientes que han pedido más de una vez.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Clientes Recurrentes</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{customerData.retention.repeat_customers}</p>
                      </div>
                      <Users size={28} className="text-emerald-400/20" />
                    </div>

                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Total Clientes Únicos</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{customerData.retention.total_customers}</p>
                      </div>
                      <Users size={28} className="text-blue-400/20" />
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/[0.01] p-4 rounded-xl border border-white/5">
                    <div className="relative w-full md:w-80">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Buscar por nombre de cliente..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-sm"
                      />
                    </div>

                    <div className="text-xs text-gray-500 font-light w-full md:w-auto text-right">
                      Mostrando {filteredAndSortedCustomers.length} clientes destacados
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.01]">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 font-medium">
                          <th className="p-4 w-16 text-center">Rank</th>
                          <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleCustomerSort('name')}>
                            <div className="flex items-center gap-1">
                              Cliente
                              {customerSortField === 'name' && (customerSortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </div>
                          </th>
                          <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleCustomerSort('orderCount')}>
                            <div className="flex items-center gap-1 justify-center">
                              Pedidos Realizados
                              {customerSortField === 'orderCount' && (customerSortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </div>
                          </th>
                          <th className="p-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleCustomerSort('totalSpent')}>
                            <div className="flex items-center gap-1 justify-end">
                              Total Gastado
                              {customerSortField === 'totalSpent' && (customerSortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </div>
                          </th>
                          <th className="p-4 text-right">Ticket Promedio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredAndSortedCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500">
                              No se encontraron clientes registrados.
                            </td>
                          </tr>
                        ) : (
                          filteredAndSortedCustomers.map((customer, index) => {
                            const avgTicket = customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount) : 0;
                            return (
                              <tr key={customer.name + index} className="hover:bg-white/[0.01] transition-colors">
                                <td className="p-4 text-center">
                                  <span className={clsx(
                                    "w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold",
                                    index === 0 && "bg-purple-500 text-white",
                                    index === 1 && "bg-slate-400 text-white",
                                    index === 2 && "bg-amber-700 text-white",
                                    index > 2 && "bg-white/5 text-gray-400"
                                  )}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="p-4 font-medium text-white">{customer.name}</td>
                                <td className="p-4 text-center text-gray-300 font-semibold">{customer.orderCount}</td>
                                <td className="p-4 text-right text-emerald-400 font-medium">Bs. {customer.totalSpent.toFixed(2)}</td>
                                <td className="p-4 text-right text-gray-400">Bs. {avgTicket.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReportsContent;
