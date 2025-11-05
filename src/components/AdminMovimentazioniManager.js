import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Filter, 
  RefreshCw, 
  Download, 
  Eye, 
  Edit3, 
  Check, 
  Clock, 
  Store, 
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Archive,
  AlertCircle,
  Package,
  MapPin,
  FileText,
  Activity
} from 'lucide-react';
import negoziData from '../data/negozi.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AdminMovimentazioniManager = ({ user }) => {
  const [movimentazioni, setMovimentazioni] = useState([]);
  const [filteredMovimentazioni, setFilteredMovimentazioni] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtri
  const [filters, setFilters] = useState({
    originStore: 'ALL',
    destStore: 'ALL',
    dateFrom: '',
    dateTo: '',
    product: '',
    searchTerm: '',
    status: 'ALL'
  });

  // UI States
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedMovimentazioni, setSelectedMovimentazioni] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [selectedMovimento, setSelectedMovimento] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOriginStore, setSelectedOriginStore] = useState('');
  const [isCreatingMovimentazione, setIsCreatingMovimentazione] = useState(false);
  const [movimentiForm, setMovimentiForm] = useState([
    { prodotto: '', quantita: '', destinazione: '' }
  ]);

  // Carica movimentazioni globali
  const loadMovimentazioni = async () => {
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
      if (filters.originStore !== 'ALL') queryParams.append('store', filters.originStore);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

      const response = await fetch(`${API_BASE_URL}/admin/movimentazioni?${queryParams}`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Movimentazioni globali caricate:', data.data);
      setMovimentazioni(data.data);

    } catch (error) {
      console.error('❌ Errore caricamento movimentazioni globali:', error);
      setError('Errore nel caricamento delle movimentazioni: ' + error.message);
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
    let filtered = [...movimentazioni];

    // Filtro per negozio destinazione
    if (filters.destStore && filters.destStore !== 'ALL') {
      filtered = filtered.filter(mov => 
        mov.destinazione && mov.destinazione.toLowerCase().includes(filters.destStore.toLowerCase())
      );
    }

    // Filtro per prodotto
    if (filters.product) {
      filtered = filtered.filter(mov => 
        mov.prodotto && mov.prodotto.toLowerCase().includes(filters.product.toLowerCase())
      );
    }

    // Filtro ricerca generale
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(mov => 
        (mov.prodotto && mov.prodotto.toLowerCase().includes(searchLower)) ||
        (mov.origine && mov.origine.toLowerCase().includes(searchLower)) ||
        (mov.destinazione && mov.destinazione.toLowerCase().includes(searchLower)) ||
        (mov.codice_origine && mov.codice_origine.toLowerCase().includes(searchLower)) ||
        (mov.codice_destinazione && mov.codice_destinazione.toLowerCase().includes(searchLower)) ||
        (mov.txt_content && mov.txt_content.toLowerCase().includes(searchLower))
      );
    }

    // Filtro per stato
    if (filters.status !== 'ALL') {
      filtered = filtered.filter(mov => mov.stato === filters.status);
    }

    // Ordinamento
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Gestione date e timestamp
        if (sortConfig.key.includes('data') || sortConfig.key === 'timestamp') {
          aVal = new Date(aVal || '1900-01-01');
          bVal = new Date(bVal || '1900-01-01');
        }

        // Gestione numeri (quantità)
        if (sortConfig.key === 'quantita') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredMovimentazioni(filtered);
  }, [movimentazioni, filters, sortConfig]);

  // Aggiorna filtro
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Reset filtri
  const resetFilters = () => {
    setFilters({
      originStore: 'ALL',
      destStore: 'ALL',
      dateFrom: '',
      dateTo: '',
      product: '',
      searchTerm: '',
      status: 'ALL'
    });
  };

  // Ordinamento colonne
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Selezione movimentazioni
  const toggleMovimentazioneSelection = (movimentoId) => {
    setSelectedMovimentazioni(prev => 
      prev.includes(movimentoId) 
        ? prev.filter(id => id !== movimentoId)
        : [...prev, movimentoId]
    );
  };

  const selectAllMovimentazioni = () => {
    if (selectedMovimentazioni.length === filteredMovimentazioni.length) {
      setSelectedMovimentazioni([]);
    } else {
      setSelectedMovimentazioni(filteredMovimentazioni.map(mov => mov.id));
    }
  };

  // Export movimentazioni selezionate
  const exportSelectedMovimentazioni = () => {
    if (selectedMovimentazioni.length === 0) {
      setError('Seleziona almeno una movimentazione per l\'export');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const selectedData = filteredMovimentazioni.filter(mov => selectedMovimentazioni.includes(mov.id));
    
    const dataStr = JSON.stringify({
      exportDate: new Date().toISOString(),
      exportedBy: user.email,
      filters: filters,
      movimentazioni: selectedData
    }, null, 2);

    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `movimentazioni_selezionate_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(`✅ Export di ${selectedMovimentazioni.length} movimentazioni completato!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Export TXT files delle movimentazioni selezionate
  const exportTxtFiles = async () => {
    if (selectedMovimentazioni.length === 0) {
      setError('Seleziona almeno una movimentazione per l\'export TXT');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const selectedData = filteredMovimentazioni.filter(mov => 
      selectedMovimentazioni.includes(mov.id) && mov.txt_content && mov.txt_content.trim() !== ''
    );

    if (selectedData.length === 0) {
      setError('Nessuna movimentazione selezionata contiene contenuto TXT');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      // Crea un ZIP con tutti i file TXT
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      selectedData.forEach((movimento, index) => {
        const fileName = movimento.txt_filename || `MOV_${movimento.data_movimento}-${movimento.codice_origine}-${movimento.codice_destinazione}-${index + 1}.txt`;
        zip.file(fileName, movimento.txt_content);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `movimentazioni_txt_files_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`✅ Export ZIP con ${selectedData.length} file TXT completato!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Errore nella creazione del file ZIP: ' + error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Mostra dettagli movimentazione
  const showMovimentoDetails = (movimento) => {
    setSelectedMovimento(movimento);
    setShowDetailsModal(true);
  };

  // Carica dati all'avvio
  useEffect(() => {
    loadMovimentazioni();
    loadStores();
  }, [filters.originStore, filters.dateFrom, filters.dateTo]);

  // Formattazione
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completato':
        return <Check className="h-4 w-4 text-fradiavolo-green" />;
      case 'in_transito':
        return <Clock className="h-4 w-4 text-fradiavolo-orange" />;
      case 'registrato':
        return <Activity className="h-4 w-4 text-fradiavolo-charcoal" />;
      default:
        return <AlertCircle className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium border";
    switch (status) {
      case 'completato':
        return `${baseClasses} bg-fradiavolo-green/10 text-fradiavolo-green border-fradiavolo-green/30`;
      case 'in_transito':
        return `${baseClasses} bg-fradiavolo-orange/10 text-fradiavolo-orange border-fradiavolo-orange/30`;
      case 'registrato':
        return `${baseClasses} bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal border-fradiavolo-charcoal/30`;
      default:
        return `${baseClasses} bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal border-fradiavolo-charcoal/30`;
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-fradiavolo-orange" />
      : <ChevronDown className="h-4 w-4 text-fradiavolo-orange" />;
  };

  // Funzione per trovare l'email dal negozio selezionato
  const getStoreEmail = (storeName) => {
    if (!storeName) return '';
    const negozio = negoziData.find(n => n.nome === storeName);
    return negozio?.email || '';
  };

  // Funzione per inviare la movimentazione
  const handleCreateMovimentazione = async () => {
    if (!selectedOriginStore) {
      setError('Seleziona il punto vendita mittente');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (movimentiForm.some(m => !m.prodotto || !m.quantita || !m.destinazione)) {
      setError('Compila tutti i campi della movimentazione');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setIsCreatingMovimentazione(true);
    try {
      const token = localStorage.getItem('token');
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const payload = {
        movimenti: movimentiForm,
        origine: selectedOriginStore,
      };
      if (user.role === 'admin') {
        payload.origine_per_conto = selectedOriginStore;
        payload.creato_da_email = getStoreEmail(selectedOriginStore);
      }
      const response = await fetch(`${API_BASE_URL}/movimentazioni`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Errore creazione movimentazione');
      setSuccess('✅ Movimentazione creata con successo!');
      setMovimentiForm([{ prodotto: '', quantita: '', destinazione: '' }]);
      setSelectedOriginStore('');
      loadMovimentazioni();
    } catch (err) {
      setError('Errore nella creazione della movimentazione: ' + err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsCreatingMovimentazione(false);
    }
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
            🚛 Gestione Movimentazioni Globale
          </h1>
          <p className="text-fradiavolo-charcoal-light">
            Vista amministratore - Tutte le movimentazioni tra tutti i negozi
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-gradient-to-r from-fradiavolo-orange to-fradiavolo-gold text-white rounded-full text-xs font-bold uppercase tracking-wide">
            ADMIN
          </div>
          <button
            onClick={loadMovimentazioni}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-orange transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
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
              <span className="px-2 py-1 bg-fradiavolo-orange text-white text-xs rounded-full">
                Attivi
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs text-fradiavolo-charcoal hover:text-fradiavolo-orange transition-colors"
            >
              {showAdvancedFilters ? 'Nascondi filtri avanzati' : 'Mostra filtri avanzati'}
            </button>
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <button
                onClick={resetFilters}
                className="text-xs text-fradiavolo-orange hover:text-fradiavolo-gold transition-colors"
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
              placeholder="Cerca per prodotto, negozio origine/destinazione, codici o contenuto TXT..."
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
            />
          </div>
        </div>

        {/* Filtri rapidi */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Negozio Origine</label>
            <select
              value={filters.originStore}
              onChange={(e) => updateFilter('originStore', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
            >
              <option value="ALL">Tutti i negozi</option>
              {stores.map(store => (
                <option key={store.name} value={store.name}>
                  {store.name} ({store.movimentazioni || 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Stato</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
            >
              <option value="ALL">Tutti gli stati</option>
              <option value="registrato">Registrato</option>
              <option value="in_transito">In Transito</option>
              <option value="completato">Completato</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Data Da</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Data A</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
            />
          </div>
        </div>

        {/* Filtri avanzati */}
        {showAdvancedFilters && (
          <div className="border-t border-fradiavolo-cream-dark pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Prodotto</label>
                <input
                  type="text"
                  placeholder="Filtra per nome prodotto..."
                  value={filters.product}
                  onChange={(e) => updateFilter('product', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Negozio Destinazione</label>
                <input
                  type="text"
                  placeholder="Filtra per negozio destinazione..."
                  value={filters.destStore}
                  onChange={(e) => updateFilter('destStore', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Azioni Bulk */}
      {selectedMovimentazioni.length > 0 && (
        <div className="mb-4 bg-fradiavolo-cream rounded-xl p-4 border border-fradiavolo-cream-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-fradiavolo-charcoal">
                {selectedMovimentazioni.length} movimentazioni selezionate
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={exportSelectedMovimentazioni}
                className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export JSON</span>
              </button>
              <button
                onClick={exportTxtFiles}
                className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors text-sm font-medium"
              >
                <FileText className="h-4 w-4" />
                <span>Export TXT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistiche rapide */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">{filteredMovimentazioni.length}</p>
          <p className="text-sm text-fradiavolo-charcoal-light">Movimentazioni</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-green">
            {filteredMovimentazioni.filter(mov => mov.stato === 'completato').length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Completate</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-orange">
            {filteredMovimentazioni.filter(mov => mov.txt_content && mov.txt_content.trim() !== '').length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Con File TXT</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">
            {[...new Set(filteredMovimentazioni.map(mov => mov.origine))].filter(Boolean).length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Negozi Origine</p>
        </div>
      </div>

      {/* Tabella Movimentazioni */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-orange"></div>
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento movimentazioni...</h3>
          <p className="text-fradiavolo-charcoal-light">Recupero dati da tutti i negozi</p>
        </div>
      ) : filteredMovimentazioni.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
            <Truck className="h-10 w-10 text-fradiavolo-charcoal-light" />
          </div>
          <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Nessuna movimentazione trovata</h3>
          <p className="text-fradiavolo-charcoal-light text-lg">
            Modifica i filtri per visualizzare le movimentazioni desiderate
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
          <div className="p-6 border-b border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-fradiavolo-charcoal">
                Movimentazioni ({filteredMovimentazioni.length})
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedMovimentazioni.length === filteredMovimentazioni.length && filteredMovimentazioni.length > 0}
                  onChange={selectAllMovimentazioni}
                  className="rounded border-fradiavolo-cream-dark text-fradiavolo-orange focus:ring-fradiavolo-orange"
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
                      checked={selectedMovimentazioni.length === filteredMovimentazioni.length && filteredMovimentazioni.length > 0}
                      onChange={selectAllMovimentazioni}
                      className="rounded border-fradiavolo-cream-dark text-fradiavolo-orange focus:ring-fradiavolo-orange"
                    />
                  </th>
                  {[
                    { key: 'data_movimento', label: 'Data' },
                    { key: 'prodotto', label: 'Prodotto' },
                    { key: 'quantita', label: 'Quantità' },
                    { key: 'origine', label: 'Origine' },
                    { key: 'destinazione', label: 'Destinazione' },
                    { key: 'stato', label: 'Stato' },
                    { key: 'timestamp', label: 'Registrato' }
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
                  <th className="px-6 py-3 text-left">
                    <span className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {filteredMovimentazioni.map((movimento) => (
                  <tr key={movimento.id} className="hover:bg-fradiavolo-cream/30 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedMovimentazioni.includes(movimento.id)}
                        onChange={() => toggleMovimentazioneSelection(movimento.id)}
                        className="rounded border-fradiavolo-cream-dark text-fradiavolo-orange focus:ring-fradiavolo-orange"
                      />
                    </td>
                    <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-sm">{formatDate(movimento.data_movimento)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-fradiavolo-charcoal-light" />
                        <div>
                          <p className="font-medium text-fradiavolo-charcoal text-sm">
                            {movimento.prodotto}
                          </p>
                          {movimento.txt_content && movimento.txt_content.trim() !== '' && (
                            <div className="flex items-center space-x-1 mt-1">
                              <FileText className="h-3 w-3 text-fradiavolo-orange" />
                              <span className="text-xs text-fradiavolo-orange">File TXT</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-fradiavolo-charcoal">
                      <span className="font-medium">
                        {movimento.quantita} {movimento.unita_misura}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <Store className="h-3 w-3 text-fradiavolo-charcoal-light" />
                        <div>
                          <span className="text-sm font-bold text-fradiavolo-charcoal">
                            {movimento.origine}
                          </span>
                          <span className="ml-2 px-2 py-1 rounded-full bg-fradiavolo-orange text-white text-xs font-semibold border border-fradiavolo-orange/30">
                            PV Origine
                          </span>
                          {/* Mostra email sotto il nome negozio */}
                          <span className="block text-xs text-fradiavolo-charcoal-light mt-1">
                            {negoziData.find(n => n.nome === movimento.origine)?.email || ''}
                          </span>
                          {movimento.codice_origine && (
                            <p className="text-xs text-fradiavolo-charcoal-light">
                              {movimento.codice_origine}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-fradiavolo-orange" />
                        <div>
                          <span className="text-sm text-fradiavolo-charcoal">
                            {movimento.destinazione}
                          </span>
                          {movimento.codice_destinazione && (
                            <p className="text-xs text-fradiavolo-charcoal-light">
                              {movimento.codice_destinazione}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadge(movimento.stato)}>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(movimento.stato)}
                          <span className="capitalize">{movimento.stato}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">{formatDateTime(movimento.timestamp)}</span>
                      </div>
                      {movimento.creato_da && (
                        <p className="text-xs text-fradiavolo-charcoal-light mt-1">
                          da {movimento.creato_da}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => showMovimentoDetails(movimento)}
                          className="flex items-center space-x-1 px-2 py-1 text-fradiavolo-charcoal hover:text-fradiavolo-orange transition-colors text-sm"
                          title="Visualizza dettagli"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        {movimento.txt_content && movimento.txt_content.trim() !== '' && (
                          <button
                            onClick={() => {
                              const blob = new Blob([movimento.txt_content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = movimento.txt_filename || `movimento_${movimento.id}.txt`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 text-fradiavolo-orange hover:text-fradiavolo-gold transition-colors text-sm"
                            title="Scarica file TXT"
                          >
                            <FileText className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dettagli Movimentazione */}
      {showDetailsModal && selectedMovimento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-4xl max-h-[90vh] overflow-hidden border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fradiavolo-orange/10 rounded-lg">
                  <Truck className="h-5 w-5 text-fradiavolo-orange" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">Dettagli Movimentazione</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">ID: {selectedMovimento.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informazioni Base */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center space-x-2">
                    <Package className="h-4 w-4" />
                    <span>Informazioni Prodotto</span>
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Prodotto:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">{selectedMovimento.prodotto}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Quantità:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">
                        {selectedMovimento.quantita} {selectedMovimento.unita_misura}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Data Movimento:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">
                        {formatDate(selectedMovimento.data_movimento)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Stato:</span>
                      <span className={getStatusBadge(selectedMovimento.stato)}>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(selectedMovimento.stato)}
                          <span className="capitalize">{selectedMovimento.stato}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Informazioni Trasferimento */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>Trasferimento</span>
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-fradiavolo-charcoal-light block mb-1">Da:</span>
                      <div className="flex items-center space-x-2">
                        <Store className="h-4 w-4 text-fradiavolo-charcoal-light" />
                        <span className="text-sm font-medium text-fradiavolo-charcoal">
                          {selectedMovimento.origine}
                        </span>
                        {selectedMovimento.codice_origine && (
                          <span className="text-xs bg-fradiavolo-cream px-2 py-1 rounded text-fradiavolo-charcoal-light">
                            {selectedMovimento.codice_origine}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm text-fradiavolo-charcoal-light block mb-1">A:</span>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-fradiavolo-orange" />
                        <span className="text-sm font-medium text-fradiavolo-charcoal">
                          {selectedMovimento.destinazione}
                        </span>
                        {selectedMovimento.codice_destinazione && (
                          <span className="text-xs bg-fradiavolo-orange/10 px-2 py-1 rounded text-fradiavolo-orange">
                            {selectedMovimento.codice_destinazione}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Registrato:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">
                        {formatDateTime(selectedMovimento.timestamp)}
                      </span>
                    </div>
                    
                    {selectedMovimento.creato_da && (
                      <div className="flex justify-between">
                        <span className="text-sm text-fradiavolo-charcoal-light">Creato da:</span>
                        <span className="text-sm font-medium text-fradiavolo-charcoal">
                          {selectedMovimento.creato_da}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contenuto TXT */}
              {selectedMovimento.txt_content && selectedMovimento.txt_content.trim() !== '' && (
                <div className="mt-6 pt-6 border-t border-fradiavolo-cream-dark">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-fradiavolo-charcoal flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Contenuto File TXT</span>
                    </h4>
                    <button
                      onClick={() => {
                        const blob = new Blob([selectedMovimento.txt_content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = selectedMovimento.txt_filename || `movimento_${selectedMovimento.id}.txt`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center space-x-1 px-3 py-2 bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors text-sm"
                    >
                      <Download className="h-3 w-3" />
                      <span>Scarica TXT</span>
                    </button>
                  </div>
                  
                  <div className="bg-fradiavolo-cream/30 p-4 rounded-lg border border-fradiavolo-cream-dark max-h-60 overflow-auto">
                    <pre className="text-xs text-fradiavolo-charcoal font-mono whitespace-pre-wrap">
                      {selectedMovimento.txt_content}
                    </pre>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-fradiavolo-charcoal-light mt-2">
                    <span>Caratteri: {selectedMovimento.txt_content.length}</span>
                    <span>Righe: {selectedMovimento.txt_content.split('\n').length}</span>
                    {selectedMovimento.txt_filename && (
                      <span>File: {selectedMovimento.txt_filename}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end items-center p-6 border-t border-fradiavolo-cream-dark">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}



      
      
    </div>
  );
};

export default AdminMovimentazioniManager;