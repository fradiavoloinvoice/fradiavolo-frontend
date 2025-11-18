// frontend/src/components/AdminInvoiceManager.js
import React, { useState, useEffect } from 'react';
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
  Building2
} from 'lucide-react';
import InvoiceDetailModal from './InvoiceDetailModal';

const AdminInvoiceManager = () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  
  // Modale dettaglio
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Liste per dropdown
  const [stores, setStores] = useState([]);
  
  // Statistiche
  const [stats, setStats] = useState({
    total: 0,
    consegnate: 0,
    pending: 0,
    withErrors: 0,
    modified: 0
  });

  // ==========================================
  // FETCH DATA
  // ==========================================
  useEffect(() => {
    fetchInvoices();
    fetchStores();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/invoices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore caricamento fatture');
      
      const data = await response.json();
      setInvoices(data.data);
      
      // Calcola statistiche
      const stats = {
        total: data.data.length,
        consegnate: data.data.filter(inv => inv.stato === 'consegnato').length,
        pending: data.data.filter(inv => inv.stato === 'pending').length,
        withErrors: data.data.filter(inv => hasErrors(inv)).length,
        modified: data.data.filter(inv => hasHistory(inv)).length
      };
      setStats(stats);
      
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
      const response = await fetch('/api/admin/stores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore caricamento negozi');
      
      const data = await response.json();
      setStores(data.stores);
    } catch (err) {
      console.error('Errore fetch negozi:', err);
    }
  };

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  
  // Verifica presenza errori (supporta sia nuovo formato che legacy)
  const hasErrors = (invoice) => {
    const erroriConsegna = String(invoice.errori_consegna || '').trim();
    const note = String(invoice.note || '').trim();
    const itemNoConv = String(invoice.item_noconv || '').trim();
    
    return erroriConsegna !== '' || note !== '' || itemNoConv !== '';
  };

  // Verifica presenza cronologia
  const hasHistory = (invoice) => {
    const storico = String(invoice.storico_modifiche || '').trim();
    return storico !== '';
  };

  // Conta modifiche in cronologia
  const getHistoryCount = (invoice) => {
    try {
      const storico = JSON.parse(invoice.storico_modifiche || '[]');
      return Array.isArray(storico) ? storico.length : 0;
    } catch {
      return 0;
    }
  };

  // ==========================================
  // FILTERING
  // ==========================================
  useEffect(() => {
    let filtered = [...invoices];

    // Filtro testo ricerca
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.numero?.toLowerCase().includes(term) ||
        inv.fornitore?.toLowerCase().includes(term) ||
        inv.punto_vendita?.toLowerCase().includes(term)
      );
    }

    // Filtro negozio
    if (filterStore !== 'ALL') {
      filtered = filtered.filter(inv => inv.punto_vendita === filterStore);
    }

    // Filtro stato
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(inv => inv.stato === filterStatus);
    }

    // Filtro date
    if (filterDateFrom) {
      filtered = filtered.filter(inv => inv.data_emissione >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(inv => inv.data_emissione <= filterDateTo);
    }

    // Filtro solo con errori
    if (showErrorsOnly) {
      filtered = filtered.filter(inv => hasErrors(inv));
    }

    // Filtro solo modificate
    if (showModifiedOnly) {
      filtered = filtered.filter(inv => hasHistory(inv));
    }

    // Ordina per data emissione (più recenti prima)
    filtered.sort((a, b) => new Date(b.data_emissione) - new Date(a.data_emissione));

    setFilteredInvoices(filtered);
  }, [
    invoices, 
    searchTerm, 
    filterStore, 
    filterStatus, 
    filterDateFrom, 
    filterDateTo,
    showErrorsOnly,
    showModifiedOnly
  ]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleOpenDetail = async (invoice) => {
    try {
      // Fetch dettaglio completo fattura con flag has_errors e has_history
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore caricamento dettaglio');
      
      const data = await response.json();
      setSelectedInvoice(data.invoice);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Errore apertura dettaglio:', err);
      alert('Impossibile aprire il dettaglio della fattura');
    }
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedInvoice(null);
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
      const response = await fetch('/api/admin/export?type=invoices&format=json', {
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
      alert('Impossibile esportare i dati');
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="animate-spin text-blue-500" size={48} />
        <span className="ml-3 text-gray-600 text-lg">Caricamento fatture...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-3" size={48} />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Errore</h3>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchInvoices}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            Gestione Fatture
          </h1>
          <p className="text-gray-600 mt-1">Visualizza e gestisci tutte le fatture del sistema</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={fetchInvoices}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
            Aggiorna
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Download size={18} />
            Esporta
          </button>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Fatture</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Consegnate</p>
              <p className="text-2xl font-bold text-green-700">{stats.consegnate}</p>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Da Confermare</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <Clock className="text-yellow-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Con Errori</p>
              <p className="text-2xl font-bold text-red-700">{stats.withErrors}</p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Modificate</p>
              <p className="text-2xl font-bold text-blue-700">{stats.modified}</p>
            </div>
            <Clock className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">Filtri</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ricerca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ricerca
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca numero, fornitore..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Negozio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Punto Vendita
            </label>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Tutti i negozi</option>
              {stores.map(store => (
                <option key={store.name} value={store.name}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* Stato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stato
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Tutti gli stati</option>
              <option value="consegnato">Consegnato</option>
              <option value="pending">Da Confermare</option>
            </select>
          </div>

          {/* Data Da */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Da
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Data A */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data A
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Checkbox Filtri Rapidi */}
          <div className="col-span-full flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showErrorsOnly}
                onChange={(e) => setShowErrorsOnly(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">Solo con errori</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showModifiedOnly}
                onChange={(e) => setShowModifiedOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Solo modificate</span>
            </label>
          </div>
        </div>

        {/* Reset Filtri */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleResetFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Resetta tutti i filtri
          </button>
        </div>
      </div>

      {/* Risultati */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            Risultati: <span className="font-semibold text-gray-900">{filteredInvoices.length}</span> fatture
          </p>
        </div>

        {/* Tabella */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numero
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fornitore
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Punto Vendita
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Emissione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Indicatori
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <Package className="mx-auto mb-3 text-gray-400" size={48} />
                    <p className="text-lg font-medium">Nessuna fattura trovata</p>
                    <p className="text-sm mt-1">Prova a modificare i filtri di ricerca</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr 
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Numero */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="text-gray-400 mr-2" size={18} />
                        <span className="text-sm font-medium text-gray-900">
                          {invoice.numero}
                        </span>
                      </div>
                    </td>

                    {/* Fornitore */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.fornitore}</div>
                      {invoice.codice_fornitore && (
                        <div className="text-xs text-gray-500">
                          Cod: {invoice.codice_fornitore}
                        </div>
                      )}
                    </td>

                    {/* Punto Vendita */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="text-gray-400 mr-2" size={16} />
                        <span className="text-sm text-gray-900">
                          {invoice.punto_vendita}
                        </span>
                      </div>
                    </td>

                    {/* Data Emissione */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="text-gray-400 mr-2" size={16} />
                        <span className="text-sm text-gray-900">
                          {new Date(invoice.data_emissione).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </td>

                    {/* Stato */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${invoice.stato === 'consegnato' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                        }
                      `}>
                        {invoice.stato === 'consegnato' ? 'Consegnato' : 'Da Confermare'}
                      </span>
                    </td>

                    {/* Indicatori (NUOVO!) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Badge Errori */}
                        {hasErrors(invoice) && (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold"
                            title="Errori di consegna presenti"
                          >
                            <AlertCircle size={14} />
                            Errori
                          </span>
                        )}

                        {/* Badge Modifiche */}
                        {hasHistory(invoice) && (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"
                            title={`${getHistoryCount(invoice)} modifiche registrate`}
                          >
                            <Clock size={14} />
                            {getHistoryCount(invoice)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Azioni */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenDetail(invoice)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        <Eye size={16} />
                        Dettagli
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale Dettaglio */}
      {showDetailModal && selectedInvoice && (
        <InvoiceDetailModal 
          invoice={selectedInvoice}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default AdminInvoiceManager;
