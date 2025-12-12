// frontend/src/components/AdminInvoiceManager.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Clock,
  FileText,
  Eye,
  Package,
  TrendingUp,
  Calendar,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  LayoutGrid,
  List
} from 'lucide-react';
import InvoiceDetailModal from './InvoiceDetailModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AdminInvoiceManager = () => {
  // State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stores, setStores] = useState([]);

  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Ordinamento
  const [sortConfig, setSortConfig] = useState({ key: 'data_emissione', direction: 'desc' });

  // Vista
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchInvoices();
    fetchStores();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Errore caricamento fatture');
      const data = await response.json();
      setInvoices(data.data || []);
    } catch (err) {
      console.error('Errore fetch fatture:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/stores`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (err) {
      console.error('Errore fetch negozi:', err);
    }
  };

  // Helpers
  const hasErrors = (invoice) => {
    return !!(invoice.errori_consegna?.trim() || invoice.note?.trim() || invoice.item_noconv?.trim());
  };

  const hasHistory = (invoice) => {
    return !!(invoice.storico_modifiche?.trim());
  };

  const getHistoryCount = (invoice) => {
    try {
      const storico = JSON.parse(invoice.storico_modifiche || '[]');
      return Array.isArray(storico) ? storico.length : 0;
    } catch {
      return 0;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  // Statistiche calcolate
  const stats = useMemo(() => ({
    total: invoices.length,
    consegnate: invoices.filter(inv => inv.stato === 'consegnato').length,
    pending: invoices.filter(inv => inv.stato === 'pending').length,
    withErrors: invoices.filter(inv => hasErrors(inv)).length,
    modified: invoices.filter(inv => hasHistory(inv)).length
  }), [invoices]);

  // Conteggio filtri attivi
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (filterStore !== 'ALL') count++;
    if (filterStatus !== 'ALL') count++;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    if (showErrorsOnly) count++;
    if (showModifiedOnly) count++;
    return count;
  }, [searchTerm, filterStore, filterStatus, filterDateFrom, filterDateTo, showErrorsOnly, showModifiedOnly]);

  // Filtro e ordinamento
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.numero?.toLowerCase().includes(term) ||
        inv.fornitore?.toLowerCase().includes(term) ||
        inv.punto_vendita?.toLowerCase().includes(term)
      );
    }

    if (filterStore !== 'ALL') {
      filtered = filtered.filter(inv => inv.punto_vendita === filterStore);
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(inv => inv.stato === filterStatus);
    }

    if (filterDateFrom) {
      filtered = filtered.filter(inv => inv.data_emissione >= filterDateFrom);
    }

    if (filterDateTo) {
      filtered = filtered.filter(inv => inv.data_emissione <= filterDateTo);
    }

    if (showErrorsOnly) {
      filtered = filtered.filter(inv => hasErrors(inv));
    }

    if (showModifiedOnly) {
      filtered = filtered.filter(inv => hasHistory(inv));
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'data_emissione' || sortConfig.key === 'data_consegna') {
        aVal = new Date(aVal || '1900-01-01');
        bVal = new Date(bVal || '1900-01-01');
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoices, searchTerm, filterStore, filterStatus, filterDateFrom, filterDateTo, showErrorsOnly, showModifiedOnly, sortConfig]);

  // Paginazione
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Reset page quando cambiano i filtri
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStore, filterStatus, filterDateFrom, filterDateTo, showErrorsOnly, showModifiedOnly]);

  // Handlers
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleOpenDetail = async (invoice) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/invoices/${invoice.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Errore caricamento dettaglio');
      const data = await response.json();
      setSelectedInvoice(data.invoice);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Errore apertura dettaglio:', err);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStore('ALL');
    setFilterStatus('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
    setShowErrorsOnly(false);
    setShowModifiedOnly(false);
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/export?type=invoices&format=json`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Errore export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatture_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Errore export:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-fradiavolo-cream-dark rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-fradiavolo-red border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-fradiavolo-charcoal font-medium">Caricamento fatture...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md border border-red-200 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h3 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Errore di caricamento</h3>
          <p className="text-fradiavolo-charcoal-light mb-6">{error}</p>
          <button
            onClick={fetchInvoices}
            className="px-6 py-3 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-fradiavolo-red to-fradiavolo-orange rounded-2xl shadow-lg">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-fradiavolo-charcoal">Gestione Fatture</h1>
            <p className="text-sm text-fradiavolo-charcoal-light">
              {filteredInvoices.length} fatture {activeFiltersCount > 0 && `(filtrate da ${invoices.length})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="p-2.5 text-fradiavolo-charcoal hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-xl transition-all"
            title="Aggiorna"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="hidden sm:flex items-center bg-fradiavolo-cream rounded-xl p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-fradiavolo-red' : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal'}`}
              title="Vista tabella"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-fradiavolo-red' : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal'}`}
              title="Vista cards"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-fradiavolo-green hover:bg-fradiavolo-green/90 text-white rounded-xl transition-all font-medium shadow-md hover:shadow-lg"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Esporta</span>
          </button>
        </div>
      </div>

      {/* Statistiche - Design compatto */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Totale', value: stats.total, icon: Package, color: 'fradiavolo-red', bg: 'fradiavolo-red/10' },
          { label: 'Consegnate', value: stats.consegnate, icon: CheckCircle, color: 'fradiavolo-green', bg: 'fradiavolo-green/10' },
          { label: 'Da Confermare', value: stats.pending, icon: Clock, color: 'fradiavolo-orange', bg: 'fradiavolo-orange/10' },
          { label: 'Con Errori', value: stats.withErrors, icon: AlertCircle, color: 'red-600', bg: 'red-100' },
          { label: 'Modificate', value: stats.modified, icon: TrendingUp, color: 'blue-600', bg: 'blue-100' }
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark hover:shadow-md transition-shadow cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${stat.bg} rounded-lg`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold text-${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-fradiavolo-charcoal-light">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra ricerca + Filtri */}
      <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-sm overflow-hidden">
        {/* Ricerca rapida sempre visibile */}
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per numero, fornitore, punto vendita..."
              className="w-full pl-10 pr-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-fradiavolo-cream/20 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium ${
              showFilters || activeFiltersCount > 0
                ? 'bg-fradiavolo-red text-white border-fradiavolo-red'
                : 'bg-white text-fradiavolo-charcoal border-fradiavolo-cream-dark hover:border-fradiavolo-red'
            }`}
          >
            <Filter size={18} />
            <span>Filtri</span>
            {activeFiltersCount > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
                showFilters ? 'bg-white/20 text-white' : 'bg-fradiavolo-red text-white'
              }`}>
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Pannello filtri espandibile */}
        {showFilters && (
          <div className="px-4 pb-4 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Punto Vendita</label>
                <select
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-white text-sm"
                >
                  <option value="ALL">Tutti i negozi</option>
                  {stores.map(store => (
                    <option key={store.name} value={store.name}>{store.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Stato</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-white text-sm"
                >
                  <option value="ALL">Tutti gli stati</option>
                  <option value="consegnato">Consegnato</option>
                  <option value="pending">Da Confermare</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Data Da</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Data A</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-white text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-fradiavolo-cream-dark">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showErrorsOnly}
                    onChange={(e) => setShowErrorsOnly(e.target.checked)}
                    className="w-4 h-4 text-fradiavolo-red border-fradiavolo-cream-dark rounded focus:ring-fradiavolo-red"
                  />
                  <span className="text-sm text-fradiavolo-charcoal">Solo con errori</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showModifiedOnly}
                    onChange={(e) => setShowModifiedOnly(e.target.checked)}
                    className="w-4 h-4 text-fradiavolo-red border-fradiavolo-cream-dark rounded focus:ring-fradiavolo-red"
                  />
                  <span className="text-sm text-fradiavolo-charcoal">Solo modificate</span>
                </label>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-sm text-fradiavolo-red hover:text-fradiavolo-red/80 font-medium flex items-center gap-1"
                >
                  <X size={14} />
                  Resetta filtri
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contenuto principale */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-fradiavolo-cream-dark p-12 text-center">
          <div className="w-16 h-16 bg-fradiavolo-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="text-fradiavolo-charcoal-light" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Nessuna fattura trovata</h3>
          <p className="text-fradiavolo-charcoal-light mb-4">Prova a modificare i criteri di ricerca</p>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-fradiavolo-red hover:text-fradiavolo-red/80 font-medium"
            >
              Resetta tutti i filtri
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Vista Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedInvoices.map((invoice) => (
            <div
              key={invoice.id}
              onClick={() => handleOpenDetail(invoice)}
              className="bg-white rounded-xl border border-fradiavolo-cream-dark p-4 hover:shadow-lg hover:border-fradiavolo-red/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-fradiavolo-charcoal-light" size={18} />
                  <span className="font-semibold text-fradiavolo-charcoal">{invoice.numero}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  invoice.stato === 'consegnato'
                    ? 'bg-fradiavolo-green/15 text-fradiavolo-green'
                    : 'bg-fradiavolo-orange/15 text-fradiavolo-orange'
                }`}>
                  {invoice.stato === 'consegnato' ? 'Consegnato' : 'Da Confermare'}
                </span>
              </div>

              <p className="text-sm text-fradiavolo-charcoal mb-1">{invoice.fornitore}</p>
              <p className="text-xs text-fradiavolo-charcoal-light mb-3 flex items-center gap-1">
                <Building2 size={12} />
                {invoice.punto_vendita}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-fradiavolo-cream-dark">
                <span className="text-xs text-fradiavolo-charcoal-light flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(invoice.data_emissione)}
                </span>

                <div className="flex items-center gap-1">
                  {hasErrors(invoice) && (
                    <span className="p-1 bg-red-100 rounded" title="Errori">
                      <AlertCircle size={14} className="text-red-600" />
                    </span>
                  )}
                  {hasHistory(invoice) && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {getHistoryCount(invoice)}
                    </span>
                  )}
                  <Eye size={16} className="text-fradiavolo-charcoal-light group-hover:text-fradiavolo-red ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vista Tabella */
        <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-fradiavolo-cream/30 border-b border-fradiavolo-cream-dark">
                  {[
                    { key: 'numero', label: 'Numero', sortable: true },
                    { key: 'fornitore', label: 'Fornitore', sortable: true },
                    { key: 'punto_vendita', label: 'Punto Vendita', sortable: true },
                    { key: 'data_emissione', label: 'Data', sortable: true },
                    { key: 'stato', label: 'Stato', sortable: true },
                    { key: 'indicatori', label: 'Info', sortable: false },
                    { key: 'azioni', label: '', sortable: false }
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider ${
                        col.sortable ? 'cursor-pointer hover:bg-fradiavolo-cream/50 select-none' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortConfig.key === col.key && (
                          <ArrowUpDown size={14} className={`text-fradiavolo-red ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {paginatedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => handleOpenDetail(invoice)}
                    className="hover:bg-fradiavolo-cream/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-fradiavolo-charcoal">{invoice.numero}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-fradiavolo-charcoal">{invoice.fornitore}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-fradiavolo-charcoal">{invoice.punto_vendita}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-fradiavolo-charcoal">{formatDate(invoice.data_emissione)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.stato === 'consegnato'
                          ? 'bg-fradiavolo-green/15 text-fradiavolo-green'
                          : 'bg-fradiavolo-orange/15 text-fradiavolo-orange'
                      }`}>
                        {invoice.stato === 'consegnato' ? 'Consegnato' : 'Da Confermare'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {hasErrors(invoice) && (
                          <span className="p-1 bg-red-100 rounded" title="Errori presenti">
                            <AlertCircle size={14} className="text-red-600" />
                          </span>
                        )}
                        {hasHistory(invoice) && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium" title="Modifiche">
                            {getHistoryCount(invoice)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-2 text-fradiavolo-charcoal-light hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-lg transition-all">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginazione */}
      {filteredInvoices.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-fradiavolo-cream-dark p-4">
          <div className="flex items-center gap-2 text-sm text-fradiavolo-charcoal-light">
            <span>Mostra</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-fradiavolo-cream-dark rounded-lg bg-white text-fradiavolo-charcoal"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>di {filteredInvoices.length} risultati</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} className="text-fradiavolo-charcoal" />
              <ChevronLeft size={18} className="-ml-3 text-fradiavolo-charcoal" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} className="text-fradiavolo-charcoal" />
            </button>

            <span className="px-4 py-1 text-sm font-medium text-fradiavolo-charcoal">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} className="text-fradiavolo-charcoal" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} className="text-fradiavolo-charcoal" />
              <ChevronRight size={18} className="-ml-3 text-fradiavolo-charcoal" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Dettaglio */}
      {showDetailModal && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminInvoiceManager;
