import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Filter, 
  RefreshCw, 
  Download, 
  Check, 
  Clock, 
  Store, 
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AdminInvoiceManager = ({ user }) => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtri
  const [filters, setFilters] = useState({
    store: 'ALL',
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
    supplier: '',
    searchTerm: ''
  });

  // UI States
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'data_emissione', direction: 'desc' });

  // Carica fatture globali
  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      // Costruisci query params per i filtri
      const queryParams = new URLSearchParams();
      if (filters.store !== 'ALL') queryParams.append('store', filters.store);
      if (filters.status !== 'ALL') queryParams.append('status', filters.status);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

      const response = await fetch(`${API_BASE_URL}/admin/invoices?${queryParams}`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      console.log('📄 Fatture globali caricate:', data.data);
      setInvoices(data.data);

    } catch (error) {
      console.error('❌ Errore caricamento fatture globali:', error);
      setError('Errore nel caricamento delle fatture: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Carica lista negozi
  const loadStores = async () => {
    try {
      const token = localStorage.getItem('token');
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/admin/stores`, {
        headers: { 'Authorization': authHeader }
      });

      if (response.ok) {
        const data = await response.json();
        setStores(data.stores);
      }
    } catch (error) {
      console.error('❌ Errore caricamento negozi:', error);
    }
  };

  // Applica filtri locali
  useEffect(() => {
    let filtered = [...invoices];

    // Filtro per fornitore
    if (filters.supplier) {
      filtered = filtered.filter(inv => 
        inv.fornitore.toLowerCase().includes(filters.supplier.toLowerCase())
      );
    }

    // Filtro ricerca generale
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.numero.toLowerCase().includes(searchLower) ||
        inv.fornitore.toLowerCase().includes(searchLower) ||
        inv.punto_vendita.toLowerCase().includes(searchLower) ||
        (inv.note && inv.note.toLowerCase().includes(searchLower))
      );
    }

    // Ordinamento
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Gestione date
        if (sortConfig.key.includes('data')) {
          aVal = new Date(aVal || '1900-01-01');
          bVal = new Date(bVal || '1900-01-01');
        }

        // Gestione numeri
        if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
          aVal = parseFloat(aVal);
          bVal = parseFloat(bVal);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredInvoices(filtered);
  }, [invoices, filters, sortConfig]);

  // Aggiorna filtro
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Reset filtri
  const resetFilters = () => {
    setFilters({
      store: 'ALL',
      status: 'ALL',
      dateFrom: '',
      dateTo: '',
      supplier: '',
      searchTerm: ''
    });
  };

  // Ordinamento colonne
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Selezione fatture
  const toggleInvoiceSelection = (invoiceId) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const selectAllInvoices = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id));
    }
  };

  // Azioni bulk
  const bulkConfirmDelivery = async () => {
    if (selectedInvoices.length === 0) return;
if (user.role === 'admin' && !selectedStore) {
  setError("Seleziona un punto vendita per confermare le fatture");
  setTimeout(() => setError(''), 4000);
  return;
}
    const today = new Date().toISOString().split('T')[0];
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      for (const invoiceId of selectedInvoices) {
        await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
  stato: 'consegnato',
  data_consegna: today,
  confermato_da: user.email,
  punto_vendita: user.role === 'admin' ? selectedStore : user.puntoVendita
})
        });
      }

      setSuccess(`✅ ${selectedInvoices.length} fatture confermate come consegnate!`);
      setSelectedInvoices([]);
      setSelectedStore('');
      setTimeout(() => setSuccess(''), 5000);
      
      // Ricarica dati
      await loadInvoices();

    } catch (error) {
      console.error('❌ Errore conferma bulk:', error);
      setError('Errore nella conferma multipla: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Export fatture selezionate
  const exportSelectedInvoices = () => {
    if (selectedInvoices.length === 0) {
      setError('Seleziona almeno una fattura per l\'export');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const selectedData = filteredInvoices.filter(inv => selectedInvoices.includes(inv.id));
    
    const dataStr = JSON.stringify({
      exportDate: new Date().toISOString(),
      exportedBy: user.email,
      filters: filters,
      invoices: selectedData
    }, null, 2);

    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fatture_selezionate_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(`✅ Export di ${selectedInvoices.length} fatture completato!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Carica dati all'avvio
  useEffect(() => {
    loadInvoices();
    loadStores();
  }, [filters.store, filters.status, filters.dateFrom, filters.dateTo]);

  // Formattazione
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'consegnato':
        return <Check className="h-4 w-4 text-fradiavolo-green" />;
      case 'in_consegna':
        return <Clock className="h-4 w-4 text-fradiavolo-orange" />;
      default:
        return <AlertCircle className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium border";
    switch (status) {
      case 'consegnato':
        return `${baseClasses} bg-fradiavolo-green/10 text-fradiavolo-green border-fradiavolo-green/30`;
      case 'in_consegna':
        return `${baseClasses} bg-fradiavolo-orange/10 text-fradiavolo-orange border-fradiavolo-orange/30`;
      default:
        return `${baseClasses} bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal border-fradiavolo-charcoal/30`;
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-fradiavolo-red" />
      : <ChevronDown className="h-4 w-4 text-fradiavolo-red" />;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-800 mb-2">Accesso Negato</h2>
          <p className="text-red-600">
            Questa sezione è riservata agli amministratori del sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fradiavolo-charcoal mb-2">
            📄 Gestione Fatture Globale
          </h1>
          <p className="text-fradiavolo-charcoal-light">
            Vista amministratore - Tutte le fatture di tutti i negozi
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange text-white rounded-full text-xs font-bold uppercase tracking-wide">
            ADMIN
          </div>
          <button
            onClick={loadInvoices}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30 flex items-center space-x-3">
          <Check className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Filtri */}
      <div className="mb-6 bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo">
        {/* Filtri Base */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-fradiavolo-charcoal" />
            <span className="text-sm font-semibold text-fradiavolo-charcoal">Filtri</span>
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <span className="px-2 py-1 bg-fradiavolo-red text-white text-xs rounded-full">
                Attivi
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors"
            >
              {showAdvancedFilters ? 'Nascondi filtri avanzati' : 'Mostra filtri avanzati'}
            </button>
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <button
                onClick={resetFilters}
                className="text-xs text-fradiavolo-red hover:text-fradiavolo-red-dark transition-colors"
              >
                Reset filtri
              </button>
            )}
          </div>
        </div>

        {/* Ricerca rapida */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-fradiavolo-charcoal-light" />
            <input
              type="text"
              placeholder="Cerca per numero fattura, fornitore, negozio o note..."
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            />
          </div>
        </div>

        {/* Filtri rapidi */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Negozio</label>
            <select
              value={filters.store}
              onChange={(e) => updateFilter('store', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            >
              <option value="ALL">Tutti i negozi</option>
              {stores.map(store => (
                <option key={store.name} value={store.name}>
                  {store.name} ({store.invoices} fatture)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Stato</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            >
              <option value="ALL">Tutti gli stati</option>
              <option value="in_consegna">In Consegna</option>
              <option value="consegnato">Consegnato</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Data Da</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Data A</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            />
          </div>
        </div>

        {/* Filtri avanzati */}
        {showAdvancedFilters && (
          <div className="border-t border-fradiavolo-cream-dark pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Fornitore</label>
                <input
                  type="text"
                  placeholder="Filtra per nome fornitore..."
                  value={filters.supplier}
                  onChange={(e) => updateFilter('supplier', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Azioni Bulk */}
      {selectedInvoices.length > 0 && (
        <div className="mb-4 bg-fradiavolo-cream rounded-xl p-4 border border-fradiavolo-cream-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-fradiavolo-charcoal">
                {selectedInvoices.length} fatture selezionate
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {user.role === 'admin' && (
  <div>
    <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-1">Conferma per conto di</label>
    <select
      value={selectedStore}
      onChange={(e) => setSelectedStore(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg mb-2 focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
    >
      <option value="">Seleziona un punto vendita...</option>
      {stores.map((store) => (
        <option key={store.name} value={store.name}>
          {store.name}
        </option>
      ))}
    </select>
  </div>
)}
              <button
                onClick={bulkConfirmDelivery}
                className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-green text-white rounded-lg hover:bg-fradiavolo-green-dark transition-colors text-sm font-medium"
              >
                <Check className="h-4 w-4" />
                <span>Conferma Consegna</span>
              </button>
              <button
                onClick={exportSelectedInvoices}
                className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistiche rapide */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">{filteredInvoices.length}</p>
          <p className="text-sm text-fradiavolo-charcoal-light">Fatture Visualizzate</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-green">
            {filteredInvoices.filter(inv => inv.stato === 'consegnato').length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Consegnate</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-orange">
            {filteredInvoices.filter(inv => inv.stato === 'in_consegna').length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">In Consegna</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">
            {[...new Set(filteredInvoices.map(inv => inv.punto_vendita))].length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Negozi Coinvolti</p>
        </div>
      </div>

      {/* Tabella Fatture */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-red"></div>
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento fatture...</h3>
          <p className="text-fradiavolo-charcoal-light">Recupero dati da tutti i negozi</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
            <FileText className="h-10 w-10 text-fradiavolo-charcoal-light" />
          </div>
          <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Nessuna fattura trovata</h3>
          <p className="text-fradiavolo-charcoal-light text-lg">
            Modifica i filtri per visualizzare le fatture desiderate
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
          <div className="p-6 border-b border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-fradiavolo-charcoal">
                Fatture ({filteredInvoices.length})
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                  onChange={selectAllInvoices}
                  className="rounded border-fradiavolo-cream-dark text-fradiavolo-red focus:ring-fradiavolo-red"
                />
                <span className="text-sm text-fradiavolo-charcoal-light">Seleziona tutto</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fradiavolo-cream/50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={selectAllInvoices}
                      className="rounded border-fradiavolo-cream-dark text-fradiavolo-red focus:ring-fradiavolo-red"
                    />
                  </th>
                  {[
                    { key: 'numero', label: 'Numero' },
                    { key: 'fornitore', label: 'Fornitore' },
                    { key: 'punto_vendita', label: 'Negozio' },
                    { key: 'data_emissione', label: 'Data Emissione' },
                    { key: 'data_consegna', label: 'Data Consegna' },
                    { key: 'stato', label: 'Stato' }
                  ].map(column => (
                    <th
                      key={column.key}
                      className="px-6 py-3 text-left cursor-pointer hover:bg-fradiavolo-cream/70 transition-colors"
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide">
                          {column.label}
                        </span>
                        {getSortIcon(column.key)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-fradiavolo-cream/30 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => toggleInvoiceSelection(invoice.id)}
                        className="rounded border-fradiavolo-cream-dark text-fradiavolo-red focus:ring-fradiavolo-red"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-fradiavolo-charcoal">
                      {invoice.numero}
                    </td>
                    <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                      {invoice.fornitore}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <Store className="h-3 w-3 text-fradiavolo-charcoal-light" />
                        <span className="text-sm text-fradiavolo-charcoal truncate max-w-32">
                          {invoice.punto_vendita}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-sm">{formatDate(invoice.data_emissione)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-sm">{formatDate(invoice.data_consegna)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadge(invoice.stato)}>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(invoice.stato)}
                          <span>{invoice.stato === 'consegnato' ? 'Consegnato' : 'In Consegna'}</span>
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInvoiceManager;
