// frontend/src/pages/admin/SegnalazioniManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Send,
  AlertCircle,
  RefreshCw,
  Filter,
  Search,
  X,
  Mail,
  FileText,
  Calendar,
  Building2,
  Package,
  CheckCircle,
  Loader2,
  Eye
} from 'lucide-react';

/**
 * 📧 Gestione Segnalazioni Errori
 * 
 * Permette agli admin di:
 * - Visualizzare elenco fatture con errori non ancora segnalati
 * - Inviare segnalazioni ai fornitori tramite email
 * - Template email precompilato ed editabile
 * - Tracking stato invio segnalazioni
 */

const API_BASE_URL = 'https://fradiavolo-backend.onrender.com/api';

const SegnalazioniManager = () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [segnalazioni, setSegnalazioni] = useState([]);
  const [filteredSegnalazioni, setFilteredSegnalazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Liste per dropdown
  const [stores, setStores] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Modale Email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedSegnalazione, setSelectedSegnalazione] = useState(null);
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  // Statistiche
  const [stats, setStats] = useState({
    total: 0,
    daInviare: 0,
    inviate: 0
  });

  // ==========================================
  // FETCH DATA
  // ==========================================
  useEffect(() => {
    fetchSegnalazioni();
    fetchStores();
  }, []);

  const fetchSegnalazioni = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      // Endpoint che restituisce fatture con errori
      // Filtra per: stato='consegnato', has_errors=true, segnalazione_inviata=false
      const response = await fetch(`${API_BASE_URL}/admin/segnalazioni`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Errore caricamento segnalazioni');

      const data = await response.json();
      setSegnalazioni(data.segnalazioni);

      // Calcola statistiche
      const daInviare = data.segnalazioni.filter(s => !s.segnalazione_inviata).length;
      const inviate = data.segnalazioni.filter(s => s.segnalazione_inviata).length;

      setStats({
        total: data.segnalazioni.length,
        daInviare,
        inviate
      });

      // Estrai fornitori unici
      const uniqueSuppliers = [...new Set(data.segnalazioni.map(s => s.fornitore))].sort();
      setSuppliers(uniqueSuppliers);

    } catch (err) {
      console.error('Errore fetch segnalazioni:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/stores`, {
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
  // FILTERING
  // ==========================================
  useEffect(() => {
    let filtered = [...segnalazioni];

    // Filtro ricerca testo
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(seg =>
        seg.numero?.toLowerCase().includes(term) ||
        seg.fornitore?.toLowerCase().includes(term) ||
        seg.punto_vendita?.toLowerCase().includes(term)
      );
    }

    // Filtro negozio
    if (filterStore !== 'ALL') {
      filtered = filtered.filter(seg => seg.punto_vendita === filterStore);
    }

    // Filtro fornitore
    if (filterSupplier !== 'ALL') {
      filtered = filtered.filter(seg => seg.fornitore === filterSupplier);
    }

    // Filtro date
    if (filterDateFrom) {
      filtered = filtered.filter(seg => seg.data_emissione >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(seg => seg.data_emissione <= filterDateTo);
    }

    // Ordina per data emissione (più recenti prima)
    filtered.sort((a, b) => new Date(b.data_emissione) - new Date(a.data_emissione));

    setFilteredSegnalazioni(filtered);
  }, [segnalazioni, searchTerm, filterStore, filterSupplier, filterDateFrom, filterDateTo]);

  // ==========================================
  // EMAIL TEMPLATE GENERATOR
  // ==========================================
  const generateEmailTemplate = (segnalazione) => {
    // Email fornitore (se disponibile, altrimenti placeholder)
    const toEmail = segnalazione.email_fornitore || 'fornitore@example.com';

    // Oggetto
    const subject = `Segnalazione Errori Consegna DDT ${segnalazione.numero} del ${new Date(segnalazione.data_emissione).toLocaleDateString('it-IT')}`;

    // Corpo email
    let body = `Gentile ${segnalazione.fornitore},\n\n`;
    body += `Vi segnaliamo delle discrepanze riscontrate nella consegna del DDT n. ${segnalazione.numero} del ${new Date(segnalazione.data_emissione).toLocaleDateString('it-IT')} presso il punto vendita ${segnalazione.punto_vendita}.\n\n`;

    // Parsing errori
    try {
      const errorDetails = JSON.parse(segnalazione.errori_dettagli || '{}');

      // Modifiche prodotti
      if (errorDetails.modifiche && errorDetails.modifiche.length > 0) {
        body += `PRODOTTI CON DISCREPANZE:\n`;
        body += `${'='.repeat(50)}\n\n`;

        errorDetails.modifiche.forEach(modifica => {
          if (modifica.modificato) {
            body += `Codice: ${modifica.codice}\n`;
            body += `Prodotto: ${modifica.nome}\n`;
            body += `Quantità Ordinata: ${modifica.quantita_originale} ${modifica.unita_misura}\n`;
            body += `Quantità Ricevuta: ${modifica.quantita_ricevuta} ${modifica.unita_misura}\n`;
            body += `Differenza: ${(modifica.quantita_ricevuta - modifica.quantita_originale).toFixed(2)} ${modifica.unita_misura}\n`;
            body += `\n`;
          }
        });
      }

      // Note testuali
      if (errorDetails.note_testuali && errorDetails.note_testuali.trim() !== '') {
        body += `NOTE AGGIUNTIVE:\n`;
        body += `${'='.repeat(50)}\n`;
        body += `${errorDetails.note_testuali}\n\n`;
      }

    } catch (err) {
      console.error('Errore parsing dettagli errori:', err);
      body += `[Dettagli errori non disponibili - verificare manualmente]\n\n`;
    }

    body += `Restiamo a disposizione per eventuali chiarimenti.\n\n`;
    body += `Cordiali saluti,\n`;
    body += `Fradiavolo - ${segnalazione.punto_vendita}\n`;

    return { to: toEmail, subject, body };
  };

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleOpenEmailModal = (segnalazione) => {
    setSelectedSegnalazione(segnalazione);
    const template = generateEmailTemplate(segnalazione);
    setEmailForm(template);
    setShowEmailModal(true);
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setSelectedSegnalazione(null);
    setEmailForm({ to: '', subject: '', body: '' });
  };

  const handleSendEmail = async () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.body) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    if (!window.confirm('Sei sicuro di voler inviare questa segnalazione?')) {
      return;
    }

    setSendingEmail(true);

    try {
      const token = localStorage.getItem('token');

      // 📧 Endpoint n8n (PLACEHOLDER - da implementare nel backend)
      const response = await fetch(`${API_BASE_URL}/admin/segnalazioni/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoice_id: selectedSegnalazione.id,
          to: emailForm.to,
          subject: emailForm.subject,
          body: emailForm.body
        })
      });

      if (!response.ok) throw new Error('Errore invio segnalazione');

      const data = await response.json();

      alert('✅ Segnalazione inviata con successo!');
      handleCloseEmailModal();
      fetchSegnalazioni(); // Ricarica lista

    } catch (err) {
      console.error('Errore invio email:', err);
      alert('❌ Errore durante l\'invio della segnalazione: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStore('ALL');
    setFilterSupplier('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleViewDetails = async (segnalazione) => {
    // Apre modale con dettagli completi errori (riutilizza InvoiceDetailModal se serve)
    alert('Funzionalità in sviluppo: visualizzazione dettagli completi');
  };

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const getErrorSummary = (segnalazione) => {
    try {
      const errorDetails = JSON.parse(segnalazione.errori_dettagli || '{}');
      const modifiche = errorDetails.modifiche?.filter(m => m.modificato).length || 0;
      const notePresenti = errorDetails.note_testuali && errorDetails.note_testuali.trim() !== '';

      let summary = [];
      if (modifiche > 0) summary.push(`${modifiche} prodott${modifiche === 1 ? 'o' : 'i'} modificat${modifiche === 1 ? 'o' : 'i'}`);
      if (notePresenti) summary.push('Note presenti');

      return summary.length > 0 ? summary.join(' • ') : 'Errori generici';
    } catch {
      return 'Dettagli non disponibili';
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="animate-spin text-blue-500" size={48} />
        <span className="ml-3 text-gray-600 text-lg">Caricamento segnalazioni...</span>
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
          onClick={fetchSegnalazioni}
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
            <Send className="text-orange-600" size={32} />
            Segnalazioni Errori
          </h1>
          <p className="text-gray-600 mt-1">
            Gestisci e invia le segnalazioni errori ai fornitori
          </p>
        </div>

        <button
          onClick={fetchSegnalazioni}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Aggiorna
        </button>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Segnalazioni</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <AlertCircle className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Da Inviare</p>
              <p className="text-2xl font-bold text-orange-700">{stats.daInviare}</p>
            </div>
            <Send className="text-orange-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inviate</p>
              <p className="text-2xl font-bold text-green-700">{stats.inviate}</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
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

          {/* Fornitore */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fornitore
            </label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">Tutti i fornitori</option>
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
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

      {/* Lista Segnalazioni */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            Risultati: <span className="font-semibold text-gray-900">{filteredSegnalazioni.length}</span> segnalazioni
          </p>
        </div>

        {filteredSegnalazioni.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CheckCircle className="mx-auto mb-3 text-green-400" size={48} />
            <p className="text-lg font-medium">Nessuna segnalazione da inviare</p>
            <p className="text-sm mt-1">Tutte le segnalazioni sono state gestite!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DDT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fornitore
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Punto Vendita
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSegnalazioni.map((seg) => (
                  <tr
                    key={seg.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* DDT */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="text-gray-400 mr-2" size={18} />
                        <span className="text-sm font-medium text-gray-900">
                          {seg.numero}
                        </span>
                      </div>
                    </td>

                    {/* Fornitore */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{seg.fornitore}</div>
                    </td>

                    {/* Punto Vendita */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="text-gray-400 mr-2" size={16} />
                        <span className="text-sm text-gray-900">
                          {seg.punto_vendita}
                        </span>
                      </div>
                    </td>

                    {/* Data */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="text-gray-400 mr-2" size={16} />
                        <span className="text-sm text-gray-900">
                          {new Date(seg.data_emissione).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </td>

                    {/* Errori Summary */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {getErrorSummary(seg)}
                      </div>
                    </td>

                    {/* Stato */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {seg.segnalazione_inviata ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={12} />
                          Inviata
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <AlertCircle size={12} />
                          Da Inviare
                        </span>
                      )}
                    </td>

                    {/* Azioni */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        {!seg.segnalazione_inviata && (
                          <button
                            onClick={() => handleOpenEmailModal(seg)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <Send size={14} />
                            Invia Segnalazione
                          </button>
                        )}

                        <button
                          onClick={() => handleViewDetails(seg)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Visualizza dettagli"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📧 MODALE INVIO EMAIL */}
      {showEmailModal && selectedSegnalazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Mail className="text-orange-600" size={24} />
                  Invia Segnalazione
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  DDT {selectedSegnalazione.numero} - {selectedSegnalazione.fornitore}
                </p>
              </div>

              <button
                onClick={handleCloseEmailModal}
                disabled={sendingEmail}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {/* Form Email */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Destinatario */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Destinatario *
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="fornitore@example.com"
                  disabled={sendingEmail}
                />
              </div>

              {/* Oggetto */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Oggetto *
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Oggetto email"
                  disabled={sendingEmail}
                />
              </div>

              {/* Corpo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Messaggio *
                </label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  rows="12"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                  placeholder="Corpo email"
                  disabled={sendingEmail}
                />
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Nota:</strong> Puoi modificare tutti i campi prima di inviare.
                  La segnalazione verrà inviata tramite Outlook e tracciata nel sistema.
                </p>
              </div>
            </div>

            {/* Footer Azioni */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCloseEmailModal}
                disabled={sendingEmail}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Annulla
              </button>

              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailForm.to || !emailForm.subject || !emailForm.body}
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Invia Segnalazione
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegnalazioniManager;
