// /components/AdminInvoiceManager.js
import React, { useState, useEffect } from 'react';
import {
  FileText, Calendar, MapPin, Package, CheckCircle,
  Clock, Search, Filter, Eye, X, FileCheck, Store
} from 'lucide-react';

// 🔧 Normalizza la base URL: rimuove un eventuale "/api" e lo slash finale
const RAW_API = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_BASE = RAW_API.replace(/\/api\/?$/, '').replace(/\/$/, '');
const API_URL  = `${API_BASE}/api`; // usare sempre API_URL + '/...'

const AdminInvoiceManager = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | confirmed | pending
  const [storeFilter, setStoreFilter] = useState('all'); // all | nome punto vendita
  const [selectedDDT, setSelectedDDT] = useState(null);
  const [showDDTModal, setShowDDTModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  // Carica e normalizza dati dall'API admin
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Errore nel caricamento fatture');

      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : payload.data || [];

      const normalized = rows.map(r => ({
        id: r.id ?? r.ID ?? r.row_id,
        numeroFattura: r.numero ?? r.numero_fattura ?? '',
        fornitore: r.fornitore ?? '',
        dataEmissione: r.data_emissione ?? '',  // ✅ Data emissione
        dataConsegna: r.data_consegna ?? '',     // ✅ Data consegna (separata)
        puntoVendita: r.punto_vendita ?? r.store ?? '',
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

  const handleViewDDT = (invoice) => {
    setSelectedDDT({
      numeroFattura: invoice.numeroFattura,
      fornitore: invoice.fornitore,
      dataEmissione: invoice.dataEmissione,
      dataConsegna: invoice.dataConsegna,
      puntoVendita: invoice.puntoVendita,
      testoDDT: invoice.testoDDT || 'Nessun DDT disponibile'
    });
    setShowDDTModal(true);
  };

  // Estrai lista unica di punti vendita per il filtro
  const uniqueStores = [...new Set(invoices.map(inv => inv.puntoVendita))].filter(Boolean).sort();

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

    const matchesStore =
      storeFilter === 'all' ||
      inv.puntoVendita === storeFilter;

    return matchesSearch && matchesStatus && matchesStore;
  });

  const stats = {
    total: invoices.length,
    confirmed: invoices.filter(i => i.consegnato).length,
    pending: invoices.filter(i => !i.consegnato).length,
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
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-fradiavolo-charcoal flex items-center gap-3">
            <div className="p-3 bg-fradiavolo-green/10 rounded-xl">
              <FileText className="h-8 w-8 text-fradiavolo-green" />
            </div>
            Fatture Globali
          </h1>
          <p className="text-fradiavolo-charcoal-light mt-2">
            Gestione fatture di tutti i punti vendita
          </p>
        </div>

        {/* Filtri */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-fradiavolo-cream-dark px-4 py-3 shadow-fradiavolo flex-1 min-w-[300px]">
            <Search className="h-5 w-5 text-fradiavolo-charcoal-light" />
            <input
              type="text"
              placeholder="Cerca per numero, fornitore, punto vendita..."
              className="outline-none text-sm text-fradiavolo-charcoal placeholder:text-fradiavolo-charcoal-light w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtro Stato */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-fradiavolo-cream-dark px-4 py-3 shadow-fradiavolo">
            <Filter className="h-5 w-5 text-fradiavolo-charcoal-light" />
            <select
              className="text-sm outline-none text-fradiavolo-charcoal font-medium cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tutti gli stati</option>
              <option value="confirmed">✅ Consegnati</option>
              <option value="pending">⏳ In attesa</option>
            </select>
          </div>

          {/* Filtro Punto Vendita */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-fradiavolo-cream-dark px-4 py-3 shadow-fradiavolo">
            <Store className="h-5 w-5 text-fradiavolo-charcoal-light" />
            <select
              className="text-sm outline-none text-fradiavolo-charcoal font-medium cursor-pointer max-w-[200px]"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="all">Tutti i negozi</option>
              {uniqueStores.map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
          </div>

          {/* Reset Filtri */}
          {(searchTerm || statusFilter !== 'all' || storeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setStoreFilter('all');
              }}
              className="px-4 py-3 text-sm text-fradiavolo-red hover:bg-fradiavolo-cream rounded-xl transition font-medium"
            >
              Cancella filtri
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards - STILE DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Totale Fatture */}
        <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-fradiavolo-charcoal">
                {stats.total}
              </p>
              <p className="text-sm text-fradiavolo-charcoal-light">Fatture Totali</p>
            </div>
          </div>
        </div>

        {/* Consegnate */}
        <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-fradiavolo-green/10 rounded-xl">
              <CheckCircle className="h-6 w-6 text-fradiavolo-green" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-fradiavolo-charcoal">
                {stats.confirmed}
              </p>
              <p className="text-sm text-fradiavolo-charcoal-light">Consegnate</p>
            </div>
          </div>
        </div>

        {/* In Attesa */}
        <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-fradiavolo-orange/10 rounded-xl">
              <Clock className="h-6 w-6 text-fradiavolo-orange" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-fradiavolo-charcoal">
                {stats.pending}
              </p>
              <p className="text-sm text-fradiavolo-charcoal-light">In Attesa</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabella - STILE DASHBOARD */}
      <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-fradiavolo overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-fradiavolo-cream-dark">
            <thead className="bg-fradiavolo-cream/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-fradiavolo-charcoal uppercase tracking-wider">
                  Numero
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-fradiavolo-charcoal uppercase tracking-wider">
                  Data Emissione
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-fradiavolo-charcoal uppercase tracking-wider">
                  Fornitore
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-fradiavolo-charcoal uppercase tracking-wider">
                  Punto vendita
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-fradiavolo-charcoal uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-fradiavolo-charcoal uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-fradiavolo-cream">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-sm text-fradiavolo-charcoal-light" colSpan={6}>
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-12 w-12 text-fradiavolo-charcoal-light opacity-50" />
                      <p className="font-medium">Nessuna fattura trovata</p>
                      <p className="text-xs">Prova a modificare i filtri di ricerca</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr 
                    key={invoice.id || `${invoice.numeroFattura}-${invoice.puntoVendita}`}
                    className="hover:bg-fradiavolo-cream/30 transition-colors"
                  >
                    {/* Numero */}
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm font-medium text-fradiavolo-charcoal">
                        <FileText className="h-4 w-4 mr-2 text-fradiavolo-charcoal-light" />
                        {invoice.numeroFattura}
                      </div>
                    </td>

                    {/* Data Emissione */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-fradiavolo-charcoal">
                        <Calendar className="h-4 w-4 mr-2 text-fradiavolo-charcoal-light" />
                        {invoice.dataEmissione || '—'}
                      </div>
                    </td>

                    {/* Fornitore */}
                    <td className="px-6 py-4 text-sm text-fradiavolo-charcoal">
                      {invoice.fornitore}
                    </td>

                    {/* Punto vendita */}
                    <td className="px-6 py-4 text-sm text-fradiavolo-charcoal">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-fradiavolo-charcoal-light" />
                        {invoice.puntoVendita}
                      </div>
                    </td>

                    {/* STATO */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.consegnato ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-fradiavolo-green/20 text-fradiavolo-green border border-fradiavolo-green/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Consegnato
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-fradiavolo-orange/20 text-fradiavolo-orange border border-fradiavolo-orange/30">
                          <Clock className="h-3 w-3 mr-1" />
                          In Attesa
                        </span>
                      )}
                    </td>

                    {/* COLONNA "Vedi DDT" */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleViewDDT(invoice)}
                        className="inline-flex items-center px-4 py-2 bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red/90 transition text-sm font-medium shadow-fradiavolo"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Vedi DDT
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con conteggio risultati */}
        {filteredInvoices.length > 0 && (
          <div className="bg-fradiavolo-cream/30 px-6 py-4 border-t border-fradiavolo-cream-dark">
            <p className="text-sm text-fradiavolo-charcoal-light">
              Visualizzate <span className="font-bold text-fradiavolo-charcoal">{filteredInvoices.length}</span> di <span className="font-bold text-fradiavolo-charcoal">{invoices.length}</span> fatture totali
            </p>
          </div>
        )}
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

// MODAL DDT - Allineato con lo stile della dashboard
const DDTModal = ({ ddt, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-fradiavolo-cream-dark">
        {/* Header */}
        <div className="bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileCheck className="h-6 w-6" />
            </div>
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

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          {/* Info Card */}
          <div className="bg-fradiavolo-cream rounded-xl p-5 mb-6 space-y-3 border border-fradiavolo-cream-dark">
            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 bg-white rounded-lg">
                <MapPin className="h-4 w-4 text-fradiavolo-red" />
              </div>
              <div>
                <span className="text-fradiavolo-charcoal-light text-xs uppercase tracking-wide">Punto Vendita</span>
                <p className="font-semibold text-fradiavolo-charcoal">{ddt.puntoVendita}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 bg-white rounded-lg">
                <Package className="h-4 w-4 text-fradiavolo-red" />
              </div>
              <div>
                <span className="text-fradiavolo-charcoal-light text-xs uppercase tracking-wide">Fornitore</span>
                <p className="font-semibold text-fradiavolo-charcoal">{ddt.fornitore}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 bg-white rounded-lg">
                <Calendar className="h-4 w-4 text-fradiavolo-red" />
              </div>
              <div>
                <span className="text-fradiavolo-charcoal-light text-xs uppercase tracking-wide">Data Emissione</span>
                <p className="font-semibold text-fradiavolo-charcoal">{ddt.dataEmissione}</p>
              </div>
            </div>

            {/* Mostra Data Consegna solo se presente */}
            {ddt.dataConsegna && (
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-white rounded-lg">
                  <CheckCircle className="h-4 w-4 text-fradiavolo-green" />
                </div>
                <div>
                  <span className="text-fradiavolo-charcoal-light text-xs uppercase tracking-wide">Data Consegna</span>
                  <p className="font-semibold text-fradiavolo-green">{ddt.dataConsegna}</p>
                </div>
              </div>
            )}
          </div>

          {/* DDT Text */}
          <div className="bg-fradiavolo-cream/30 rounded-xl p-6 border border-fradiavolo-cream-dark">
            <h4 className="text-sm font-bold text-fradiavolo-charcoal uppercase tracking-wide mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-fradiavolo-red" />
              Contenuto DDT
            </h4>
            <div className="bg-white rounded-lg p-4 border border-fradiavolo-cream-dark">
              <pre className="text-fradiavolo-charcoal whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {ddt.testoDDT}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-fradiavolo-cream/50 p-4 flex justify-end border-t border-fradiavolo-cream-dark">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal/90 transition font-medium shadow-fradiavolo"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  </>
);

export default AdminInvoiceManager;
