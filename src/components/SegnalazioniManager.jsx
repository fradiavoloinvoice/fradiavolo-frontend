// frontend/src/pages/admin/SegnalazioniManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Liste per dropdown
  const [stores, setStores] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Vista e ordinamento
  const [viewMode, setViewMode] = useState('table');
  const [sortConfig, setSortConfig] = useState({ key: 'data_emissione', direction: 'desc' });

  // Modale Email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedSegnalazione, setSelectedSegnalazione] = useState(null);
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);

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
  // COMPUTED VALUES (useMemo)
  // ==========================================

  // Statistiche
  const stats = useMemo(() => {
    const daInviare = segnalazioni.filter(s => !s.segnalazione_inviata).length;
    const inviate = segnalazioni.filter(s => s.segnalazione_inviata).length;
    return {
      total: segnalazioni.length,
      daInviare,
      inviate
    };
  }, [segnalazioni]);

  // Conta filtri attivi
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStore !== 'ALL') count++;
    if (filterSupplier !== 'ALL') count++;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    return count;
  }, [filterStore, filterSupplier, filterDateFrom, filterDateTo]);

  // Dati filtrati e ordinati
  const filteredSegnalazioni = useMemo(() => {
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

    // Ordinamento
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'data_emissione') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [segnalazioni, searchTerm, filterStore, filterSupplier, filterDateFrom, filterDateTo, sortConfig]);

  // Paginazione
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSegnalazioni.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSegnalazioni, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSegnalazioni.length / itemsPerPage);

  // Reset pagina quando cambiano i filtri
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStore, filterSupplier, filterDateFrom, filterDateTo]);

  // ==========================================
  // EMAIL TEMPLATE GENERATOR
  // ==========================================
  const generateEmailTemplate = (segnalazione) => {
    const toEmail = segnalazione.email_fornitore || 'fornitore@example.com';
    const subject = `Segnalazione Errori Consegna DDT ${segnalazione.numero} del ${new Date(segnalazione.data_emissione).toLocaleDateString('it-IT')}`;

    let body = `Gentile ${segnalazione.fornitore},\n\n`;
    body += `Vi segnaliamo delle discrepanze riscontrate nella consegna del DDT n. ${segnalazione.numero} del ${new Date(segnalazione.data_emissione).toLocaleDateString('it-IT')} presso il punto vendita ${segnalazione.punto_vendita}.\n\n`;

    try {
      const errorDetails = JSON.parse(segnalazione.errori_dettagli || '{}');

      if (errorDetails.modifiche && errorDetails.modifiche.length > 0) {
        body += `PRODOTTI CON DISCREPANZE:\n`;
        body += `${'='.repeat(50)}\n\n`;

        errorDetails.modifiche.forEach(modifica => {
          if (modifica.modificato) {
            body += `Codice: ${modifica.codice}\n`;
            body += `Prodotto: ${modifica.nome}\n`;
            body += `Quantità Ordinata: ${modifica.quantita_originale} ${modifica.unita_misura}\n`;
            body += `Quantità Ricevuta: ${modifica.quantita_ricevuta} ${modifica.unita_misura}\n`;
            body += `Differenza: ${(modifica.quantita_ricevuta - modifica.quantita_originale).toFixed(2)} ${modifica.unita_misura}\n\n`;
          }
        });
      }

      if (errorDetails.note_testuali && errorDetails.note_testuali.trim() !== '') {
        body += `NOTE AGGIUNTIVE:\n`;
        body += `${'='.repeat(50)}\n`;
        body += `${errorDetails.note_testuali}\n\n`;
      }

    } catch (err) {
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
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

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

  const handleViewDetails = async (segnalazione) => {
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
      if (modifiche > 0) summary.push(`${modifiche} prodott${modifiche === 1 ? 'o' : 'i'}`);
      if (notePresenti) summary.push('Note');

      return summary.length > 0 ? summary.join(' + ') : 'Errori generici';
    } catch {
      return 'N/D';
    }
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-fradiavolo-charcoal-light" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="text-fradiavolo-red" />
      : <ArrowDown size={14} className="text-fradiavolo-red" />;
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-fradiavolo-cream/30 rounded-xl">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-fradiavolo-cream-dark rounded-full animate-pulse"></div>
          <Loader2 className="absolute inset-0 m-auto animate-spin text-fradiavolo-red" size={32} />
        </div>
        <p className="mt-4 text-fradiavolo-charcoal font-medium">Caricamento segnalazioni...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-fradiavolo-red/10 border border-fradiavolo-red/30 rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto text-fradiavolo-red mb-4" size={48} />
        <h3 className="text-lg font-bold text-fradiavolo-charcoal mb-2">Errore di caricamento</h3>
        <p className="text-fradiavolo-charcoal-light mb-4">{error}</p>
        <button
          onClick={fetchSegnalazioni}
          className="px-6 py-2 bg-fradiavolo-red hover:bg-fradiavolo-red-dark text-white rounded-xl font-medium transition-colors"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-fradiavolo-orange to-fradiavolo-red rounded-xl p-6 text-white shadow-fradiavolo">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Send size={28} />
              Segnalazioni Errori
            </h1>
            <p className="text-white/80 mt-1">
              Gestisci e invia le segnalazioni errori ai fornitori
            </p>
          </div>
          <button
            onClick={fetchSegnalazioni}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <RefreshCw size={18} />
            Aggiorna
          </button>
        </div>

        {/* Stats compatte */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-white/70">Totale</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-3xl font-bold">{stats.daInviare}</p>
            <p className="text-sm text-white/70">Da Inviare</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-3xl font-bold">{stats.inviate}</p>
            <p className="text-sm text-white/70">Inviate</p>
          </div>
        </div>
      </div>

      {/* Barra ricerca sempre visibile */}
      <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4 shadow-fradiavolo">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per numero, fornitore, negozio..."
              className="w-full pl-10 pr-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange"
            />
          </div>

          {/* Toggle Filtri */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
              showFilters || activeFiltersCount > 0
                ? 'bg-fradiavolo-orange text-white'
                : 'bg-fradiavolo-cream text-fradiavolo-charcoal hover:bg-fradiavolo-cream-dark'
            }`}
          >
            <Filter size={18} />
            Filtri
            {activeFiltersCount > 0 && (
              <span className="bg-white text-fradiavolo-orange text-xs font-bold px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {/* Toggle Vista */}
          <div className="flex items-center bg-fradiavolo-cream rounded-xl p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white shadow text-fradiavolo-red' : 'text-fradiavolo-charcoal-light'
              }`}
              title="Vista Tabella"
            >
              <LayoutList size={20} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-white shadow text-fradiavolo-red' : 'text-fradiavolo-charcoal-light'
              }`}
              title="Vista Card"
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {/* Filtri Collassabili */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-fradiavolo-cream-dark">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fornitore */}
              <div>
                <label className="block text-sm font-medium text-fradiavolo-charcoal mb-1">
                  Fornitore
                </label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange"
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
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange"
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
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange"
                />
              </div>

              {/* Data A */}
              <div>
                <label className="block text-sm font-medium text-fradiavolo-charcoal mb-1">
                  Data A
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange"
                />
              </div>
            </div>

            {/* Reset Filtri */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="text-sm text-fradiavolo-red hover:text-fradiavolo-red-dark font-medium flex items-center gap-1"
              >
                <X size={14} />
                Resetta filtri
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Risultati e Paginazione Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-fradiavolo-charcoal-light">
          <span className="font-semibold text-fradiavolo-charcoal">{filteredSegnalazioni.length}</span> segnalazioni trovate
        </p>

        <div className="flex items-center gap-2">
          <span className="text-sm text-fradiavolo-charcoal-light">Mostra</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-fradiavolo-cream-dark rounded-lg text-sm focus:ring-2 focus:ring-fradiavolo-orange"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-fradiavolo-charcoal-light">per pagina</span>
        </div>
      </div>

      {/* Lista Segnalazioni */}
      {filteredSegnalazioni.length === 0 ? (
        <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-12 text-center shadow-fradiavolo">
          <CheckCircle className="mx-auto text-fradiavolo-green mb-4" size={64} />
          <h3 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Nessuna segnalazione da inviare</h3>
          <p className="text-fradiavolo-charcoal-light">Tutte le segnalazioni sono state gestite!</p>
        </div>
      ) : viewMode === 'table' ? (
        /* VISTA TABELLA */
        <div className="bg-white border border-fradiavolo-cream-dark rounded-xl shadow-fradiavolo overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fradiavolo-cream">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider cursor-pointer hover:bg-fradiavolo-cream-dark transition-colors"
                    onClick={() => handleSort('numero')}
                  >
                    <div className="flex items-center gap-2">
                      DDT {getSortIcon('numero')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider cursor-pointer hover:bg-fradiavolo-cream-dark transition-colors"
                    onClick={() => handleSort('fornitore')}
                  >
                    <div className="flex items-center gap-2">
                      Fornitore {getSortIcon('fornitore')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider cursor-pointer hover:bg-fradiavolo-cream-dark transition-colors"
                    onClick={() => handleSort('punto_vendita')}
                  >
                    <div className="flex items-center gap-2">
                      Negozio {getSortIcon('punto_vendita')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider cursor-pointer hover:bg-fradiavolo-cream-dark transition-colors"
                    onClick={() => handleSort('data_emissione')}
                  >
                    <div className="flex items-center gap-2">
                      Data {getSortIcon('data_emissione')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Errori
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {paginatedData.map((seg) => (
                  <tr key={seg.id} className="hover:bg-fradiavolo-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="text-fradiavolo-charcoal-light" size={16} />
                        <span className="font-medium text-fradiavolo-charcoal">{seg.numero}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-fradiavolo-charcoal">{seg.fornitore}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="text-fradiavolo-charcoal-light" size={14} />
                        <span className="text-fradiavolo-charcoal text-sm">{seg.punto_vendita}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-fradiavolo-charcoal-light" size={14} />
                        <span className="text-fradiavolo-charcoal text-sm">
                          {new Date(seg.data_emissione).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-fradiavolo-charcoal-light bg-fradiavolo-cream px-2 py-1 rounded-lg">
                        {getErrorSummary(seg)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {seg.segnalazione_inviata ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-fradiavolo-green/20 text-fradiavolo-green">
                          <CheckCircle size={12} />
                          Inviata
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-fradiavolo-orange/20 text-fradiavolo-orange">
                          <AlertCircle size={12} />
                          Da Inviare
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!seg.segnalazione_inviata && (
                          <button
                            onClick={() => handleOpenEmailModal(seg)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-fradiavolo-orange hover:bg-fradiavolo-orange/80 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Send size={12} />
                            Invia
                          </button>
                        )}
                        <button
                          onClick={() => handleViewDetails(seg)}
                          className="p-1.5 text-fradiavolo-charcoal-light hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-lg transition-colors"
                          title="Visualizza dettagli"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedData.map((seg) => (
            <div
              key={seg.id}
              className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4 shadow-fradiavolo hover:shadow-lg transition-shadow"
            >
              {/* Header Card */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-fradiavolo-red" size={20} />
                  <span className="font-bold text-fradiavolo-charcoal">{seg.numero}</span>
                </div>
                {seg.segnalazione_inviata ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-fradiavolo-green/20 text-fradiavolo-green">
                    <CheckCircle size={10} />
                    Inviata
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-fradiavolo-orange/20 text-fradiavolo-orange">
                    <AlertCircle size={10} />
                    Da Inviare
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-fradiavolo-charcoal">
                  <Building2 size={14} className="text-fradiavolo-charcoal-light" />
                  {seg.fornitore}
                </div>
                <div className="flex items-center gap-2 text-fradiavolo-charcoal-light">
                  <Building2 size={14} />
                  {seg.punto_vendita}
                </div>
                <div className="flex items-center gap-2 text-fradiavolo-charcoal-light">
                  <Calendar size={14} />
                  {new Date(seg.data_emissione).toLocaleDateString('it-IT')}
                </div>
              </div>

              {/* Errori Summary */}
              <div className="mt-3 pt-3 border-t border-fradiavolo-cream-dark">
                <span className="text-xs text-fradiavolo-charcoal-light bg-fradiavolo-cream px-2 py-1 rounded-lg">
                  {getErrorSummary(seg)}
                </span>
              </div>

              {/* Azioni */}
              <div className="mt-4 flex items-center gap-2">
                {!seg.segnalazione_inviata && (
                  <button
                    onClick={() => handleOpenEmailModal(seg)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-orange/80 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Send size={14} />
                    Invia Segnalazione
                  </button>
                )}
                <button
                  onClick={() => handleViewDetails(seg)}
                  className="p-2 text-fradiavolo-charcoal-light hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-xl transition-colors"
                  title="Visualizza dettagli"
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-fradiavolo-cream-dark rounded-xl p-4 shadow-fradiavolo">
          <p className="text-sm text-fradiavolo-charcoal-light">
            Pagina <span className="font-semibold text-fradiavolo-charcoal">{currentPage}</span> di{' '}
            <span className="font-semibold text-fradiavolo-charcoal">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-fradiavolo-cream-dark hover:bg-fradiavolo-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Prima pagina"
            >
              <ChevronLeft size={16} />
              <ChevronLeft size={16} className="-ml-3" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-fradiavolo-cream-dark hover:bg-fradiavolo-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Pagina precedente"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Numeri pagina */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-fradiavolo-red text-white'
                        : 'hover:bg-fradiavolo-cream text-fradiavolo-charcoal'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-fradiavolo-cream-dark hover:bg-fradiavolo-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Pagina successiva"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-fradiavolo-cream-dark hover:bg-fradiavolo-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Ultima pagina"
            >
              <ChevronRight size={16} />
              <ChevronRight size={16} className="-ml-3" />
            </button>
          </div>
        </div>
      )}

      {/* MODALE INVIO EMAIL */}
      {showEmailModal && selectedSegnalazione && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-fradiavolo-orange to-fradiavolo-red p-6 rounded-t-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Mail size={24} />
                    Invia Segnalazione
                  </h2>
                  <p className="text-white/80 mt-1">
                    DDT {selectedSegnalazione.numero} - {selectedSegnalazione.fornitore}
                  </p>
                </div>
                <button
                  onClick={handleCloseEmailModal}
                  disabled={sendingEmail}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Form Email */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Destinatario */}
              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Destinatario *
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange"
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
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange"
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
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange font-mono text-sm"
                  placeholder="Corpo email"
                  disabled={sendingEmail}
                />
              </div>

              {/* Info */}
              <div className="bg-fradiavolo-cream/50 border border-fradiavolo-cream-dark rounded-xl p-4">
                <p className="text-sm text-fradiavolo-charcoal">
                  <strong>Nota:</strong> Puoi modificare tutti i campi prima di inviare.
                  La segnalazione verrà inviata tramite Outlook e tracciata nel sistema.
                </p>
              </div>
            </div>

            {/* Footer Azioni */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/30 rounded-b-xl">
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
                className="flex items-center gap-2 px-6 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-red text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
