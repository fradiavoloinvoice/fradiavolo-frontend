import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Filter, 
  RefreshCw, 
  Download, 
  Eye, 
  Clock,
  Check,
  Store, 
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Package,
  MapPin,
  FileText,
  ChevronRight
} from 'lucide-react';
import negoziData from '../data/negozi.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Nuova UI: una riga = una movimentazione (DDT).
 * Raggruppiamo le righe del foglio "Movimentazioni" per ddt_number
 * e mostriamo un riepilogo prodotti con espansione.
 */
const AdminMovimentazioniManager = ({ user }) => {
  // Dati grezzi riga-per-prodotto
  const [rawMovimentazioni, setRawMovimentazioni] = useState([]);
  // Dati raggruppati per DDT
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);

  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtri (senza "status")
  const [filters, setFilters] = useState({
    originStore: 'ALL',
    destStore: 'ALL',
    dateFrom: '',
    dateTo: '',
    product: '',
    searchTerm: ''
  });

  // UI States
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expanded, setExpanded] = useState({}); // { groupId: boolean }
  const [selectedGroups, setSelectedGroups] = useState([]); // selezione per DDT
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Helpers ------------------------------------------------------------
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };
  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-fradiavolo-orange" />
      : <ChevronDown className="h-4 w-4 text-fradiavolo-orange" />;
  };

  // Caricamenti --------------------------------------------------------
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

      const queryParams = new URLSearchParams();
      if (filters.originStore !== 'ALL') queryParams.append('store', filters.originStore);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

      const res = await fetch(`${API_BASE_URL}/admin/movimentazioni?${queryParams}`, {
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const data = await res.json();
      setRawMovimentazioni(data.data || []);
    } catch (e) {
      console.error('❌ Errore caricamento movimentazioni globali:', e);
      setError('Errore nel caricamento delle movimentazioni: ' + e.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const token = localStorage.getItem('token');
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/admin/stores`, { headers: { 'Authorization': authHeader } });
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (e) {
      console.error('❌ Errore caricamento negozi:', e);
    }
  };

  useEffect(() => { loadMovimentazioni(); loadStores(); }, [filters.originStore, filters.dateFrom, filters.dateTo]);

  // Raggruppamento -----------------------------------------------------
  const buildGroups = (rows) => {
    const byId = new Map();
    rows.forEach((r) => {
      const gid = r.ddt_number || r.id?.split('_')?.[0] || `${r.origine}_${r.destinazione}_${r.timestamp}`;
      if (!byId.has(gid)) {
        byId.set(gid, {
          id: gid,
          ddt_number: r.ddt_number || gid,
          data_movimento: r.data_movimento,
          timestamp: r.timestamp,
          origine: r.origine,
          codice_origine: r.codice_origine || '',
          destinazione: r.destinazione,
          codice_destinazione: r.codice_destinazione || '',
          creato_da: r.creato_da || '',
          prodotti: []
        });
      }
      const g = byId.get(gid);
      // timestamp/data più recente nel gruppo
      if (new Date(r.timestamp) > new Date(g.timestamp || 0)) g.timestamp = r.timestamp;
      if (new Date(r.data_movimento) > new Date(g.data_movimento || 0)) g.data_movimento = r.data_movimento;

      g.prodotti.push({
        id: r.id,
        prodotto: r.prodotto,
        quantita: r.quantita,
        unita_misura: r.unita_misura,
        txt_content: r.txt_content || '',
        txt_filename: r.txt_filename || ''
      });
    });
    return Array.from(byId.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  useEffect(() => { setGroups(buildGroups(rawMovimentazioni)); }, [rawMovimentazioni]);

  // Filtri e ordinamento sui gruppi -----------------------------------
  useEffect(() => {
    let arr = [...groups];

    if (filters.destStore && filters.destStore !== 'ALL') {
      const q = filters.destStore.toLowerCase();
      arr = arr.filter(g => (g.destinazione || '').toLowerCase().includes(q));
    }
    if (filters.product) {
      const q = filters.product.toLowerCase();
      arr = arr.filter(g => g.prodotti.some(p => (p.prodotto || '').toLowerCase().includes(q)));
    }
    if (filters.searchTerm) {
      const q = filters.searchTerm.toLowerCase();
      arr = arr.filter(g => 
        (g.origine && g.origine.toLowerCase().includes(q)) ||
        (g.destinazione && g.destinazione.toLowerCase().includes(q)) ||
        (g.ddt_number && g.ddt_number.toLowerCase().includes(q)) ||
        g.prodotti.some(p => (p.prodotto || '').toLowerCase().includes(q) || (p.txt_content || '').toLowerCase().includes(q))
      );
    }

    if (sortConfig.key) {
      arr.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        if (['data_movimento', 'timestamp'].includes(sortConfig.key)) {
          aVal = new Date(aVal || '1900-01-01');
          bVal = new Date(bVal || '1900-01-01');
        }
        if (sortConfig.key === 'prodotti_count') {
          aVal = a.prodotti.length; bVal = b.prodotti.length;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredGroups(arr);
  }, [groups, filters, sortConfig]);

  // Azioni -------------------------------------------------------------
  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters({ originStore: 'ALL', destStore: 'ALL', dateFrom: '', dateTo: '', product: '', searchTerm: '' });
  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  const toggleGroupSelection = (gid) => {
    setSelectedGroups(prev => prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]);
  };
  const selectAllGroups = () => {
    if (selectedGroups.length === filteredGroups.length) setSelectedGroups([]);
    else setSelectedGroups(filteredGroups.map(g => g.id));
  };

  const exportSelectedGroupsJSON = () => {
    if (selectedGroups.length === 0) {
      setError("Seleziona almeno una movimentazione per l'export");
      setTimeout(() => setError(''), 3000);
      return;
    }
    const selected = filteredGroups.filter(g => selectedGroups.includes(g.id));
    const dataStr = JSON.stringify({ exportDate: new Date().toISOString(), exportedBy: user.email, filters, movimentazioni: selected }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `movimentazioni_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSuccess(`✅ Export di ${selected.length} movimentazioni completato!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const exportSelectedGroupsTXT = async () => {
    if (selectedGroups.length === 0) {
      setError("Seleziona almeno una movimentazione per l'export TXT");
      setTimeout(() => setError(''), 3000);
      return;
    }
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const chosen = filteredGroups.filter(g => selectedGroups.includes(g.id));
      chosen.forEach((g, idx) => {
        const withTxt = g.prodotti.filter(p => (p.txt_content || '').trim() !== '');
        if (withTxt.length === 0) return;
        const bundle = withTxt.map(p => p.txt_content).join('\n');
        const fname = `DDT_${g.ddt_number || g.id}_${idx + 1}.txt`;
        zip.file(fname, bundle);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url; a.download = `movimentazioni_txt_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setSuccess('✅ Export ZIP TXT completato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Errore nella creazione del file ZIP: ' + e.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const showGroupDetails = (g) => { setSelectedGroup(g); setShowDetailsModal(true); };

  // Render -------------------------------------------------------------
  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-800 mb-2">Accesso Negato</h2>
          <p className="text-red-600">Questa sezione è riservata agli amministratori del sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fradiavolo-charcoal mb-2">🚛 Gestione Movimentazioni Globale</h1>
          <p className="text-fradiavolo-charcoal-light">Vista amministratore - Una riga per DDT</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-gradient-to-r from-fradiavolo-orange to-fradiavolo-gold text-white rounded-full text-xs font-bold uppercase tracking-wide">ADMIN</div>
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

      {/* Alert */}
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-fradiavolo-charcoal" />
            <span className="text-sm font-semibold text-fradiavolo-charcoal">Filtri</span>
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <span className="px-2 py-1 bg-fradiavolo-orange text-white text-xs rounded-full">Attivi</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="text-xs text-fradiavolo-charcoal hover:text-fradiavolo-orange transition-colors">
              {showAdvancedFilters ? 'Nascondi filtri avanzati' : 'Mostra filtri avanzati'}
            </button>
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <button onClick={resetFilters} className="text-xs text-fradiavolo-orange hover:text-fradiavolo-gold transition-colors">Reset filtri</button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-fradiavolo-charcoal-light" />
            <input
              type="text"
              placeholder="Cerca per prodotto, DDT, negozio..."
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
            />
          </div>
        </div>

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
                <option key={store.name} value={store.name}>{store.name} ({store.movimentazioni || 0})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Data Da</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Data A</label>
            <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Prodotto</label>
            <input type="text" placeholder="Filtra per nome prodotto..." value={filters.product} onChange={(e) => updateFilter('product', e.target.value)} className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors" />
          </div>
        </div>
      </div>

      {/* Azioni Bulk */}
      {selectedGroups.length > 0 && (
        <div className="mb-4 bg-fradiavolo-cream rounded-xl p-4 border border-fradiavolo-cream-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-fradiavolo-charcoal">{selectedGroups.length} movimentazioni selezionate</span>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={exportSelectedGroupsJSON} className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors text-sm font-medium">
                <Download className="h-4 w-4" /><span>Export JSON</span>
              </button>
              <button onClick={exportSelectedGroupsTXT} className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors text-sm font-medium">
                <FileText className="h-4 w-4" /><span>Export TXT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistiche rapide */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">{filteredGroups.length}</p>
          <p className="text-sm text-fradiavolo-charcoal-light">Movimentazioni (DDT)</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-orange">{filteredGroups.filter(g => g.prodotti.some(p => (p.txt_content || '').trim() !== '')).length}</p>
          <p className="text-sm text-fradiavolo-charcoal-light">Con almeno un TXT</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">{[...new Set(filteredGroups.map(g => g.origine))].filter(Boolean).length}</p>
          <p className="text-sm text-fradiavolo-charcoal-light">Negozi Origine</p>
        </div>
      </div>

      {/* Tabella gruppi */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-orange"></div>
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento movimentazioni...</h3>
          <p className="text-fradiavolo-charcoal-light">Recupero dati da tutti i negozi</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
            <Truck className="h-10 w-10 text-fradiavolo-charcoal-light" />
          </div>
          <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Nessuna movimentazione trovata</h3>
          <p className="text-fradiavolo-charcoal-light text-lg">Modifica i filtri per visualizzare le movimentazioni desiderate</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
          <div className="p-6 border-b border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-fradiavolo-charcoal">Movimentazioni ({filteredGroups.length})</h2>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedGroups.length === filteredGroups.length && filteredGroups.length > 0}
                  onChange={selectAllGroups}
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
                      checked={selectedGroups.length === filteredGroups.length && filteredGroups.length > 0}
                      onChange={selectAllGroups}
                      className="rounded border-fradiavolo-cream-dark text-fradiavolo-orange focus:ring-fradiavolo-orange"
                    />
                  </th>
                  {[ 
                    { key: 'data_movimento', label: 'Data' },
                    { key: 'ddt_number', label: 'DDT' },
                    { key: 'prodotti_count', label: 'Articoli' },
                    { key: 'origine', label: 'Origine' },
                    { key: 'destinazione', label: 'Destinazione' },
                    { key: 'timestamp', label: 'Registrato' }
                  ].map(col => (
                    <th
                      key={col.key}
                      className="px-6 py-3 text-left cursor-pointer hover:bg-fradiavolo-cream/70 transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide">{col.label}</span>
                        {getSortIcon(col.key)}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left"><span className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide">Azioni</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {filteredGroups.map((g) => (
                  <React.Fragment key={g.id}>
                    <tr className="hover:bg-fradiavolo-cream/30 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(g.id)}
                          onChange={() => toggleGroupSelection(g.id)}
                          className="rounded border-fradiavolo-cream-dark text-fradiavolo-orange focus:ring-fradiavolo-orange"
                        />
                      </td>
                      <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span className="text-sm">{formatDate(g.data_movimento)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                          className="flex items-center space-x-2 text-fradiavolo-charcoal hover:text-fradiavolo-orange"
                        >
                          {expanded[g.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="font-semibold">{g.ddt_number}</span>
                        </button>
                        <div className="text-xs text-fradiavolo-charcoal-light mt-1">Anteprima: {g.prodotti.slice(0, 2).map(p => p.prodotto).join(' • ')}{g.prodotti.length > 2 ? '…' : ''}</div>
                      </td>
                      <td className="px-6 py-4 text-fradiavolo-charcoal">
                        <span className="font-medium">{g.prodotti.length}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1">
                          <Store className="h-3 w-3 text-fradiavolo-charcoal-light" />
                          <div>
                            <span className="text-sm font-bold text-fradiavolo-charcoal">{g.origine}</span>
                            <span className="ml-2 px-2 py-1 rounded-full bg-fradiavolo-orange text-white text-xs font-semibold border border-fradiavolo-orange/30">PV Origine</span>
                            <span className="block text-xs text-fradiavolo-charcoal-light mt-1">{negoziData.find(n => n.nome === g.origine)?.email || ''}</span>
                            {g.codice_origine && (<p className="text-xs text-fradiavolo-charcoal-light">{g.codice_origine}</p>)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3 text-fradiavolo-orange" />
                          <div>
                            <span className="text-sm text-fradiavolo-charcoal">{g.destinazione}</span>
                            {g.codice_destinazione && (<p className="text-xs text-fradiavolo-charcoal-light">{g.codice_destinazione}</p>)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-fradiavolo-charcoal-light">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">{formatDateTime(g.timestamp)}</span>
                        </div>
                        {g.creato_da && (<p className="text-xs text-fradiavolo-charcoal-light mt-1">da {g.creato_da}</p>)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => showGroupDetails(g)} className="flex items-center space-x-1 px-2 py-1 text-fradiavolo-charcoal hover:text-fradiavolo-orange transition-colors text-sm" title="Visualizza dettagli">
                            <Eye className="h-3 w-3" />
                          </button>
                          {g.prodotti.some(p => (p.txt_content || '').trim() !== '') && (
                            <button
                              onClick={() => {
                                const allTxt = g.prodotti.filter(p => (p.txt_content || '').trim() !== '').map(p => p.txt_content).join('\n');
                                if (!allTxt) return;
                                const blob = new Blob([allTxt], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url; link.download = `DDT_${g.ddt_number || g.id}.txt`;
                                document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                              }}
                              className="flex items-center space-x-1 px-2 py-1 text-fradiavolo-orange hover:text-fradiavolo-gold transition-colors text-sm"
                              title="Scarica TXT"
                            >
                              <FileText className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded[g.id] && (
                      <tr className="bg-fradiavolo-cream/30">
                        <td></td>
                        <td colSpan={7} className="px-6 pb-6">
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {g.prodotti.map((p, idx) => (
                              <div key={p.id || idx} className="p-3 rounded-lg border border-fradiavolo-cream-dark bg-white">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Package className="h-4 w-4 text-fradiavolo-charcoal-light" />
                                    <div>
                                      <p className="text-sm font-medium text-fradiavolo-charcoal">{p.prodotto}</p>
                                      <p className="text-xs text-fradiavolo-charcoal-light mt-0.5">{p.quantita} {p.unita_misura}</p>
                                    </div>
                                  </div>
                                  {(p.txt_content || '').trim() !== '' && (
                                    <span className="inline-flex items-center text-xs text-fradiavolo-orange"><FileText className="h-3 w-3 mr-1"/>TXT</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dettagli gruppo */}
      {showDetailsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-4xl max-h-[90vh] overflow-hidden border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fradiavolo-orange/10 rounded-lg"><Truck className="h-5 w-5 text-fradiavolo-orange" /></div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">Dettagli Movimentazione</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">DDT: {selectedGroup.ddt_number}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-2 flex items-center space-x-2"><Package className="h-4 w-4" /><span>Info</span></h4>
                  <div className="text-sm">
                    <div className="flex justify-between"><span className="text-fradiavolo-charcoal-light">Data:</span><span className="font-medium text-fradiavolo-charcoal">{formatDate(selectedGroup.data_movimento)}</span></div>
                    <div className="flex justify-between"><span className="text-fradiavolo-charcoal-light">Origine:</span><span className="font-medium text-fradiavolo-charcoal">{selectedGroup.origine}</span></div>
                    <div className="flex justify-between"><span className="text-fradiavolo-charcoal-light">Destinazione:</span><span className="font-medium text-fradiavolo-charcoal">{selectedGroup.destinazione}</span></div>
                    <div className="flex justify-between"><span className="text-fradiavolo-charcoal-light">Registrato:</span><span className="font-medium text-fradiavolo-charcoal">{formatDateTime(selectedGroup.timestamp)}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-2 flex items-center space-x-2"><Package className="h-4 w-4" /><span>Prodotti ({selectedGroup.prodotti.length})</span></h4>
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {selectedGroup.prodotti.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-start justify-between p-2 border border-fradiavolo-cream-dark rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-fradiavolo-charcoal">{p.prodotto}</p>
                          <p className="text-xs text-fradiavolo-charcoal-light">{p.quantita} {p.unita_misura}</p>
                        </div>
                        {(p.txt_content || '').trim() !== '' && <span className="inline-flex items-center text-xs text-fradiavolo-orange"><FileText className="h-3 w-3 mr-1"/>TXT</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Download TXT combinato per DDT */}
              {selectedGroup.prodotti.some(p => (p.txt_content || '').trim() !== '') && (
                <div className="mt-6 pt-4 border-t border-fradiavolo-cream-dark flex items-center justify-between">
                  <div className="text-sm text-fradiavolo-charcoal-light">TXT disponibili: {selectedGroup.prodotti.filter(p => (p.txt_content || '').trim() !== '').length}</div>
                  <button
                    onClick={() => {
                      const allTxt = selectedGroup.prodotti.filter(p => (p.txt_content || '').trim() !== '').map(p => p.txt_content).join('\n');
                      const blob = new Blob([allTxt], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url; link.download = `DDT_${selectedGroup.ddt_number || selectedGroup.id}.txt`;
                      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                    }}
                    className="flex items-center space-x-1 px-3 py-2 bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors text-sm"
                  >
                    <Download className="h-3 w-3" /><span>Scarica TXT</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end items-center p-6 border-t border-fradiavolo-cream-dark">
              <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg">Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMovimentazioniManager;
