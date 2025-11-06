import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, MapPin, Package, DollarSign, 
  CheckCircle, Clock, Search, Filter, Download,
  Eye, X, FileCheck
} from 'lucide-react';

const AdminInvoiceManager = ({ user }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'confirmed', 'pending'
  const [selectedDDT, setSelectedDDT] = useState(null); // Per il modal DDT
  const [showDDTModal, setShowDDTModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

      const response = await fetch(`${API_URL}/api/admin/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Errore nel caricamento fatture');
      
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Errore:', error);
      alert('Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  };

  // Funzione per aprire il modal DDT
  const handleViewDDT = (invoice) => {
    setSelectedDDT({
      numeroFattura: invoice.numeroFattura,
      fornitore: invoice.fornitore,
      dataConsegna: invoice.dataConsegna,
      puntoVendita: invoice.puntoVendita,
      testoDDT: invoice.testoDDT || 'Nessun DDT disponibile'
    });
    setShowDDTModal(true);
  };

  // Filtra fatture
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.numeroFattura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.fornitore?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.puntoVendita?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'confirmed' && invoice.consegnato) ||
      (statusFilter === 'pending' && !invoice.consegnato);

    return matchesSearch && matchesStatus;
  });

  // Statistiche
  const stats = {
    total: invoices.length,
    confirmed: invoices.filter(inv => inv.consegnato).length,
    pending: invoices.filter(inv => !inv.consegnato).length,
    totalAmount: invoices.reduce((sum, inv) => sum + (parseFloat(inv.totale) || 0), 0)
  };

  // Export CSV
  const handleExport = () => {
    const csvData = filteredInvoices.map(inv => ({
      'Numero Fattura': inv.numeroFattura,
      'Data Consegna': inv.dataConsegna,
      'Fornitore': inv.fornitore,
      'Punto Vendita': inv.puntoVendita,
      'Totale': inv.totale,
      'Stato': inv.consegnato ? 'Consegnato' : 'In Attesa',
      'DDT': inv.testoDDT || 'N/A'
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatture-globali-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fradiavolo-red mx-auto mb-4"></div>
          <p className="text-fradiavolo-charcoal-light">Caricamento fatture...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-fradiavolo-charcoal flex items-center gap-3">
            <FileText className="h-8 w-8 text-fradiavolo-red" />
            Fatture Globali
          </h1>
          <p className="text-fradiavolo-charcoal-light mt-1">
            Gestione fatture di tutti i punti vendita
          </p>
        </div>
        
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-fradiavolo-green text-white rounded-xl hover:bg-fradiavolo-green/90 transition flex items-center gap-2 shadow-fradiavolo"
        >
          <Download className="h-4 w-4" />
          Esporta CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Totale Fatture"
          value={stats.total}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Confermate"
          value={stats.confirmed}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="In Attesa"
          value={stats.pending}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Importo Totale"
          value={`€${stats.totalAmount.toFixed(2)}`}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-fradiavolo p-4 border border-fradiavolo-cream-dark">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-fradiavolo-charcoal-light" />
            <input
              type="text"
              placeholder="Cerca per numero fattura, fornitore o punto vendita..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-fradiavolo-charcoal-light" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Tutti gli stati</option>
              <option value="confirmed">Solo Confermate</option>
              <option value="pending">Solo In Attesa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-fradiavolo-cream-dark">
            <thead className="bg-fradiavolo-cream">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  Numero Fattura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  Data Consegna
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  Fornitore
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  Punto Vendita
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  Totale
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fradiavolo-charcoal uppercase tracking-wider">
                  DDT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-fradiavolo-cream-dark">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-fradiavolo-charcoal-light">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">Nessuna fattura trovata</p>
                    <p className="text-sm mt-1">Prova a modificare i filtri di ricerca</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice, index) => (
                  <tr key={index} className="hover:bg-fradiavolo-cream/30 transition">
                    {/* Numero Fattura */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-fradiavolo-red mr-2" />
                        <span className="text-sm font-medium text-fradiavolo-charcoal">
                          {invoice.numeroFattura}
                        </span>
                      </div>
                    </td>

                    {/* Data Consegna */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-fradiavolo-charcoal-light">
                        <Calendar className="h-4 w-4 mr-2" />
                        {invoice.dataConsegna}
                      </div>
                    </td>

                    {/* Fornitore */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-fradiavolo-charcoal">
                        {invoice.fornitore}
                      </div>
                    </td>

                    {/* Punto Vendita */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-fradiavolo-charcoal">
                        <MapPin className="h-4 w-4 mr-2 text-fradiavolo-charcoal-light" />
                        {invoice.puntoVendita}
                      </div>
                    </td>

                    {/* Totale */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-fradiavolo-charcoal">
                        €{parseFloat(invoice.totale || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* ✅ STATO - VERSIONE CORRETTA */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.consegnato ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Consegnato
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                          <Clock className="h-3 w-3 mr-1" />
                          In Attesa
                        </span>
                      )}
                    </td>

                    {/* ✅ COLONNA DDT - NUOVA */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDDT(invoice)}
                        className="inline-flex items-center px-3 py-1.5 bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red/90 transition text-sm font-medium shadow-sm"
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        Vedi DDT
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ MODAL DDT - NUOVO */}
      {showDDTModal && selectedDDT && (
        <DDTModal
          ddt={selectedDDT}
          onClose={() => {
            setShowDDTModal(false);
            setSelectedDDT(null);
          }}
        />
      )}
    </div>
  );
};

// ========================================
// STAT CARD COMPONENT
// ========================================

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-50" />
      </div>
    </div>
  );
};

// ========================================
// ✅ MODAL DDT COMPONENT - NUOVO
// ========================================

const DDTModal = ({ ddt, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          
          {/* Header */}
          <div className="bg-fradiavolo-red text-white p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="h-6 w-6" />
              <div>
                <h3 className="text-xl font-bold">Documento di Trasporto</h3>
                <p className="text-sm opacity-90 mt-1">
                  Fattura: {ddt.numeroFattura}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            
            {/* Info Card */}
            <div className="bg-fradiavolo-cream rounded-xl p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-fradiavolo-charcoal-light" />
                <span className="font-medium text-fradiavolo-charcoal">Punto Vendita:</span>
                <span className="text-fradiavolo-charcoal-light">{ddt.puntoVendita}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-fradiavolo-charcoal-light" />
                <span className="font-medium text-fradiavolo-charcoal">Fornitore:</span>
                <span className="text-fradiavolo-charcoal-light">{ddt.fornitore}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-fradiavolo-charcoal-light" />
                <span className="font-medium text-fradiavolo-charcoal">Data Consegna:</span>
                <span className="text-fradiavolo-charcoal-light">{ddt.dataConsegna}</span>
              </div>
            </div>

            {/* DDT Text */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h4 className="text-sm font-bold text-fradiavolo-charcoal uppercase tracking-wide mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Testo DDT
              </h4>
              <div className="text-fradiavolo-charcoal whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {ddt.testoDDT}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="bg-fradiavolo-cream p-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal/90 transition font-medium"
            >
              Chiudi
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default AdminInvoiceManager;
