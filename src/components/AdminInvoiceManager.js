// /components/AdminInvoiceManager.js
import React, { useState, useEffect } from 'react';
import {
  FileText, Calendar, MapPin, Package,
  CheckCircle, Clock, Search, Filter, Download,
  Eye, X, FileCheck
} from 'lucide-react';

/**
 * Costruisce la base dell'API evitando il doppio /api
 * - se REACT_APP_API_URL termina già con /api → usa quello
 * - altrimenti aggiunge /api
 * - fallback locale: http://localhost:3001/api
 */
const buildApiBase = () => {
  const raw = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
  if (/\/api$/i.test(raw)) return raw;     // es. https://backend.tld/api
  return `${raw}/api`;                      // es. http://localhost:3001/api
};
const API_BASE = buildApiBase();

const AdminInvoiceManager = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | confirmed | pending
  const [selectedDDT, setSelectedDDT] = useState(null);
  const [showDDTModal, setShowDDTModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  // Carica e NORMALIZZA i dati provenienti dall'API admin
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || '';
      const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const url = `${API_BASE}/admin/invoices`;
      // (utile in debug) console.log('▶︎ GET', url);
      const res = await fetch(url, { headers: { Authorization: auth } });

      if (!res.ok) throw new Error('Errore nel caricamento fatture');

      // L’API risponde { success, data: [...] }
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : payload.data || [];

      // Normalizzazione campi (snake_case -> camelCase) e mapping DDT (colonna N)
      const normalized = rows.map(r => ({
        id: r.id ?? r.ID ?? r.row_id,
        numeroFattura: r.numero ?? r.numero_fattura ?? '',
        fornitore: r.fornitore ?? '',
        dataConsegna: r.data_consegna || r.data_emissione || '',
        puntoVendita: r.punto_vendita ?? r.store ?? '',
        totale: r.importo_totale ?? r.totale ?? 0,
        consegnato: r.stato === 'consegnato' || r.consegnato === true,
        testoDDT: r.testo_ddt ?? r.ddt_text ?? ''
      }));

      setInvoices(normalized);
    } catch (err) {
      console.error(err);
      alert('Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  };

  // Apertura modale DDT
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

  // Filtri
  const filteredInvoices = invoices.filter(inv => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (inv.numeroFattura || '').toLowerCase().includes(q) ||
      (inv.fornitore || '').toLowerCase().includes(q) ||
      (inv.puntoVendita || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'confirmed' && inv.consegnato) ||
      (statusFilter === 'pending' && !inv.consegnato);

    return matchesSearch && matchesStatus;
  });

  // Statistiche
  const stats = {
    total: invoices.length,
    confirmed: invoices.filter(i => i.consegnato).length,
    pending: invoices.filter(i => !i.consegnato).length,
    totalAmount: invoices.reduce((s, i) => s + (parseFloat(i.totale) || 0), 0)
  };

  // Export CSV
  const handleExport = () => {
    if (filteredInvoices.length === 0) return;

    const csvRows = filteredInvoices.map(inv => ({
      'Numero Fattura': inv.numeroFattura,
      'Data Consegna': inv.dataConsegna,
      'Fornitore': inv.fornitore,
      'Punto Vendita': inv.puntoVendita,
      'Totale': inv.totale,
      'Stato': inv.consegnato ? 'Consegnato' : 'In Attesa',
      'DDT': inv.testoDDT || 'N/A'
    }));

    const csv = [
      Object.keys(csvRows[0]).join(','),
      ...csvRows.map(r => Object.values(r).map(v => String(v).replaceAll(',', ' ')).join(','))
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2">
            <Search className="h-4 w-4 text-fradiavolo-charcoal-light" />
            <input
              type="text"
              placeholder="Cerca per numero, fornitore, punto vendita..."
              className="outline-none text-sm text-fradiavolo-charcoal placeholder:text-fradiavolo-charcoal-light"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2">
            <Filter className="h-4 w-4 text-fradiavolo-charcoal-light" />
            <select
              className="text-sm outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tutti</option>
              <option value="confirmed">Consegnati</option>
              <option value="pending">In attesa</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal/90 transition text-sm"
          >
            <Download className="h-4 w-4" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Totale Fatture" value={stats.total} icon={FileText} color="blue" />
        <StatCard title="Consegnate" value={stats.confirmed} icon={CheckCircle} color="green" />
        <StatCard title="In Attesa" value={stats.pending} icon={Clock} color="yellow" />
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numero</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data consegna</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fornitore</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punto vendita</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Totale</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">DDT</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-sm text-gray-500" colSpan={7}>
                    Nessun risultato
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id || `${invoice.numeroFattura}-${invoice.puntoVendita}`}>
                    {/* Numero */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-fradiavolo-charcoal">
                        <FileText className="h-4 w-4 mr-2 text-fradiavolo-charcoal-light" />
                        {invoice.numeroFattura}
                      </div>
                    </td>

                    {/* Data */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-fradiavolo-charcoal">
                        <Calendar className="h-4 w-4 mr-2 text-fradiavolo-charcoal-light" />
                        {invoice.dataConsegna || '—'}
                      </div>
                    </td>

                    {/* Fornitore */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-fradiavolo-charcoal">
                        {invoice.fornitore}
                      </div>
                    </td>

                    {/* Punto vendita */}
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

                    {/* STATO → “pill” */}
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

                    {/* COLONNA “Vedi DDT” */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
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

      {/* MODAL DDT */}
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

// Stat card
const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
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

// MODAL DDT
const DDTModal = ({ ddt, onClose }) => (
  <>
    {/* Backdrop */}
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />
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
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
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

export default AdminInvoiceManager;
