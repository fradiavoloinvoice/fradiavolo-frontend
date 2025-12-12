// frontend/src/pages/admin/SegnalazioniManager.jsx
import { useState, useEffect } from 'react';
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
  CheckCircle,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ErrorsSection from './components/ErrorsSection';

/**
 * Gestione Segnalazioni Errori
 *
 * Permette agli admin di:
 * - Visualizzare elenco fatture con errori non ancora segnalati
 * - Inviare segnalazioni ai fornitori tramite email
 * - Template email precompilato ed editabile
 * - Tracking stato invio segnalazioni
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

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
  const [showErrorsPreview, setShowErrorsPreview] = useState(true);

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

      const response = await fetch(`${API_BASE_URL}/admin/segnalazioni`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Errore caricamento segnalazioni');

      const data = await response.json();
      setSegnalazioni(data.segnalazioni);

      const daInviare = data.segnalazioni.filter(s => !s.segnalazione_inviata).length;
      const inviate = data.segnalazioni.filter(s => s.segnalazione_inviata).length;

      setStats({
        total: data.segnalazioni.length,
        daInviare,
        inviate
      });

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

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(seg =>
        seg.numero?.toLowerCase().includes(term) ||
        seg.fornitore?.toLowerCase().includes(term) ||
        seg.punto_vendita?.toLowerCase().includes(term)
      );
    }

    if (filterStore !== 'ALL') {
      filtered = filtered.filter(seg => seg.punto_vendita === filterStore);
    }

    if (filterSupplier !== 'ALL') {
      filtered = filtered.filter(seg => seg.fornitore === filterSupplier);
    }

    if (filterDateFrom) {
      filtered = filtered.filter(seg => seg.data_emissione >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(seg => seg.data_emissione <= filterDateTo);
    }

    filtered.sort((a, b) => new Date(b.data_emissione) - new Date(a.data_emissione));

    setFilteredSegnalazioni(filtered);
  }, [segnalazioni, searchTerm, filterStore, filterSupplier, filterDateFrom, filterDateTo]);

  // ==========================================
  // EMAIL TEMPLATE GENERATOR
  // ==========================================
  const generateEmailTemplate = (segnalazione) => {
    const toEmail = segnalazione.email_fornitore || 'fornitore@example.com';

    const subject = `Segnalazione Errori Consegna DDT ${segnalazione.numero} del ${new Date(segnalazione.data_emissione).toLocaleDateString('it-IT')}`;

    let body = `Gentile ${segnalazione.fornitore},\n\n`;
    body += `Vi segnaliamo delle discrepanze riscontrate nella consegna del DDT n. ${segnalazione.numero} del ${new Date(segnalazione.data_emissione).toLocaleDateString('it-IT')} presso il punto vendita ${segnalazione.punto_vendita}.\n\n`;

    const errorDetails = segnalazione.errori_strutturati || {};

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

    if (errorDetails.note_testuali && errorDetails.note_testuali.trim() !== '') {
      body += `NOTE AGGIUNTIVE:\n`;
      body += `${'='.repeat(50)}\n`;
      body += `${errorDetails.note_testuali}\n\n`;
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

      // Invia tramite backend che fa da proxy per n8n
      const response = await fetch(`${API_BASE_URL}/admin/segnalazioni/${selectedSegnalazione.id}/send-webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email_destinatario: emailForm.to,
          oggetto: emailForm.subject,
          contenuto_email: emailForm.body
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore invio segnalazione');
      }

      await response.json();

      alert('Segnalazione inviata con successo!');
      handleCloseEmailModal();
      fetchSegnalazioni();

    } catch (err) {
      console.error('Errore invio email:', err);
      alert('Errore durante l\'invio della segnalazione: ' + err.message);
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

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const getErrorSummary = (segnalazione) => {
    const errorDetails = segnalazione.errori_strutturati || {};
    const modifiche = errorDetails.modifiche?.filter(m => m.modificato).length || 0;
    const notePresenti = (errorDetails.note_testuali && errorDetails.note_testuali.trim() !== '') ||
                         (segnalazione.note_errori && segnalazione.note_errori.trim() !== '');

    let summary = [];
    if (modifiche > 0) summary.push(`${modifiche} prodott${modifiche === 1 ? 'o' : 'i'} modificat${modifiche === 1 ? 'o' : 'i'}`);
    if (notePresenti) summary.push('Note presenti');

    return summary.length > 0 ? summary.join(' • ') : 'Errori generici';
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fradiavolo-red mx-auto mb-4"></div>
          <p className="text-fradiavolo-charcoal font-medium">Caricamento segnalazioni...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Errore</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchSegnalazioni}
          className="px-4 py-2 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl transition-colors font-medium"
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
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange rounded-xl">
            <Send className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-fradiavolo-charcoal">
              Segnalazioni Errori
            </h1>
            <p className="text-fradiavolo-charcoal-light">
              Gestisci e invia le segnalazioni errori ai fornitori
            </p>
          </div>
        </div>

        <button
          onClick={fetchSegnalazioni}
          className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="text-sm">Aggiorna</span>
        </button>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-fradiavolo-red/10 rounded-xl">
              <AlertCircle className="h-6 w-6 text-fradiavolo-red" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-fradiavolo-charcoal">{stats.total}</p>
              <p className="text-sm text-fradiavolo-charcoal-light">Totale Segnalazioni</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-fradiavolo-orange/10 rounded-xl">
              <Send className="h-6 w-6 text-fradiavolo-orange" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-fradiavolo-orange">{stats.daInviare}</p>
              <p className="text-sm text-fradiavolo-charcoal-light">Da Inviare</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-fradiavolo-green/10 rounded-xl">
              <CheckCircle className="h-6 w-6 text-fradiavolo-green" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-fradiavolo-green">{stats.inviate}</p>
              <p className="text-sm text-fradiavolo-charcoal-light">Inviate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-fradiavolo-charcoal" size={20} />
          <h3 className="font-semibold text-fradiavolo-charcoal">Filtri</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ricerca */}
          <div>
            <label className="block text-sm font-medium text-fradiavolo-charcoal mb-1">
              Ricerca
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fradiavolo-charcoal-light" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca numero, fornitore..."
                className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red bg-fradiavolo-cream/30"
              />
            </div>
          </div>

          {/* Fornitore */}
          <div>
            <label className="block text-sm font-medium text-fradiavolo-charcoal mb-1">
              Fornitore
            </label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full px-4 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red bg-fradiavolo-cream/30"
            >
              <option value="ALL">Tutti i fornitori</option>
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>

          {/* Negozio */}
          <div>
            <label className="block text-sm font-medium text-fradiavolo-charcoal mb-1">
              Punto Vendita
            </label>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="w-full px-4 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red bg-fradiavolo-cream/30"
            >
              <option value="ALL">Tutti i negozi</option>
              {stores.map(store => (
                <option key={store.name} value={store.name}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* Data Da */}
          <div>
            <label className="block text-sm font-medium text-fradiavolo-charcoal mb-1">
              Data Da
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red bg-fradiavolo-cream/30"
            />
          </div>
        </div>

        {/* Reset Filtri */}
        <div className="mt-4 pt-4 border-t border-fradiavolo-cream-dark">
          <button
            onClick={handleResetFilters}
            className="text-sm text-fradiavolo-red hover:text-fradiavolo-red/80 font-medium"
          >
            Resetta tutti i filtri
          </button>
        </div>
      </div>

      {/* Lista Segnalazioni */}
      <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-fradiavolo overflow-hidden">
        <div className="p-4 border-b border-fradiavolo-cream-dark bg-fradiavolo-cream/30">
          <p className="text-sm text-fradiavolo-charcoal-light">
            Risultati: <span className="font-semibold text-fradiavolo-charcoal">{filteredSegnalazioni.length}</span> segnalazioni
          </p>
        </div>

        {filteredSegnalazioni.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="mx-auto mb-3 text-fradiavolo-green" size={48} />
            <p className="text-lg font-medium text-fradiavolo-charcoal">Nessuna segnalazione da inviare</p>
            <p className="text-sm mt-1 text-fradiavolo-charcoal-light">Tutte le segnalazioni sono state gestite!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fradiavolo-cream/50 border-b border-fradiavolo-cream-dark">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    DDT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Fornitore
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Punto Vendita
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Errori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-fradiavolo-cream-dark">
                {filteredSegnalazioni.map((seg) => (
                  <tr
                    key={seg.id}
                    className="hover:bg-fradiavolo-cream/30 transition-colors"
                  >
                    {/* DDT */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="text-fradiavolo-charcoal-light mr-2" size={18} />
                        <span className="text-sm font-medium text-fradiavolo-charcoal">
                          {seg.numero}
                        </span>
                      </div>
                    </td>

                    {/* Fornitore */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-fradiavolo-charcoal">{seg.fornitore}</div>
                    </td>

                    {/* Punto Vendita */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="text-fradiavolo-charcoal-light mr-2" size={16} />
                        <span className="text-sm text-fradiavolo-charcoal">
                          {seg.punto_vendita}
                        </span>
                      </div>
                    </td>

                    {/* Data */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="text-fradiavolo-charcoal-light mr-2" size={16} />
                        <span className="text-sm text-fradiavolo-charcoal">
                          {new Date(seg.data_emissione).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </td>

                    {/* Errori Summary */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-fradiavolo-charcoal-light">
                        {getErrorSummary(seg)}
                      </div>
                    </td>

                    {/* Stato */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {seg.segnalazione_inviata ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-fradiavolo-green/20 text-fradiavolo-green">
                          <CheckCircle size={12} />
                          Inviata
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-fradiavolo-orange/20 text-fradiavolo-orange">
                          <AlertCircle size={12} />
                          Da Inviare
                        </span>
                      )}
                    </td>

                    {/* Azioni */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenEmailModal(seg)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          seg.segnalazione_inviata
                            ? 'bg-fradiavolo-cream text-fradiavolo-charcoal hover:bg-fradiavolo-cream-dark'
                            : 'bg-fradiavolo-orange hover:bg-fradiavolo-orange/90 text-white'
                        }`}
                      >
                        <Send size={14} />
                        {seg.segnalazione_inviata ? 'Visualizza' : 'Invia Segnalazione'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALE INVIO EMAIL */}
      {showEmailModal && selectedSegnalazione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg max-w-3xl w-full max-h-[90vh] flex flex-col border border-fradiavolo-cream-dark">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fradiavolo-orange/10 rounded-lg">
                  <Mail className="h-6 w-6 text-fradiavolo-orange" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-fradiavolo-charcoal">
                    Invia Segnalazione
                  </h2>
                  <p className="text-sm text-fradiavolo-charcoal-light">
                    DDT {selectedSegnalazione.numero} - {selectedSegnalazione.fornitore}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseEmailModal}
                disabled={sendingEmail}
                className="p-2 hover:bg-fradiavolo-cream rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={24} className="text-fradiavolo-charcoal" />
              </button>
            </div>

            {/* Form Email */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* SEZIONE ERRORI CONSEGNA */}
              <div className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowErrorsPreview(!showErrorsPreview)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-fradiavolo-cream/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Eye className="text-fradiavolo-red" size={20} />
                    <span className="font-semibold text-fradiavolo-charcoal">Errori Segnalati</span>
                  </div>
                  {showErrorsPreview ? (
                    <ChevronUp size={20} className="text-fradiavolo-charcoal-light" />
                  ) : (
                    <ChevronDown size={20} className="text-fradiavolo-charcoal-light" />
                  )}
                </button>

                {showErrorsPreview && (
                  <div className="p-4 pt-0 border-t border-fradiavolo-cream-dark">
                    <ErrorsSection
                      errorDetails={{
                        errori_strutturati: selectedSegnalazione.errori_strutturati,
                        note_errori_legacy: selectedSegnalazione.note_errori
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Destinatario */}
              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Destinatario *
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  className="w-full px-4 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange bg-fradiavolo-cream/30"
                  placeholder="fornitore@example.com"
                  disabled={sendingEmail}
                />
              </div>

              {/* Oggetto */}
              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Oggetto *
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange bg-fradiavolo-cream/30"
                  placeholder="Oggetto email"
                  disabled={sendingEmail}
                />
              </div>

              {/* Corpo */}
              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Messaggio *
                </label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  rows="12"
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange font-mono text-sm bg-fradiavolo-cream/30"
                  placeholder="Corpo email"
                  disabled={sendingEmail}
                />
              </div>

              {/* Info */}
              <div className="bg-fradiavolo-cream border border-fradiavolo-cream-dark rounded-xl p-4">
                <p className="text-sm text-fradiavolo-charcoal">
                  <strong>Nota:</strong> Puoi modificare tutti i campi prima di inviare.
                  La segnalazione verrà inviata tramite Outlook e tracciata nel sistema.
                </p>
              </div>
            </div>

            {/* Footer Azioni */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/30">
              <button
                onClick={handleCloseEmailModal}
                disabled={sendingEmail}
                className="px-6 py-2 bg-fradiavolo-cream hover:bg-fradiavolo-cream-dark text-fradiavolo-charcoal rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Annulla
              </button>

              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailForm.to || !emailForm.subject || !emailForm.body}
                className="flex items-center gap-2 px-6 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-orange/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
