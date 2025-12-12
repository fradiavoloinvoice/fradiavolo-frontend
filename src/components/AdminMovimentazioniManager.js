import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight,
  ChevronLeft,
  X,
  LayoutGrid,
  List,
  ArrowUpDown
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AdminMovimentazioniManager = ({ user }) => {
  // State
  const [rawMovimentazioni, setRawMovimentazioni] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtri
  const [filters, setFilters] = useState({
    originStore: 'ALL',
    dateFrom: '',
    dateTo: '',
    product: '',
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Vista e UI
  const [viewMode, setViewMode] = useState('table');
  const [expanded, setExpanded] = useState({});
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Helpers
  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return '-';
    try {
      if (typeof dateString === 'string' && dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts.map(p => parseInt(p, 10));
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date.toLocaleDateString('it-IT');
        }
      }
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('it-IT');
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Caricamento dati
  const loadMovimentazioni = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) { setError('Token non disponibile'); return; }
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
      setError('Errore caricamento: ' + e.message);
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
      if (res.ok) setStores((await res.json()).stores || []);
    } catch (e) {
      console.error('Errore negozi:', e);
    }
  };

  useEffect(() => { loadMovimentazioni(); loadStores(); }, [filters.originStore, filters.dateFrom, filters.dateTo]);

  // Raggruppamento per DDT
  const buildGroups = (rows) => {
    const byId = new Map();
    rows.forEach((r) => {
      const gid = r.ddt_number || r.id?.split('_')?.[0] || `${r.origine}_${r.destinazione}_${r.timestamp}`;
      if (!byId.has(gid)) {
        byId.set(gid, {
          id: gid, ddt_number: r.ddt_number || gid,
          data_movimento: r.data_movimento, timestamp: r.timestamp,
          origine: r.origine, codice_origine: r.codice_origine || '',
          destinazione: r.destinazione, codice_destinazione: r.codice_destinazione || '',
          creato_da: r.creato_da || '', prodotti: []
        });
      }
      const g = byId.get(gid);
      if (new Date(r.timestamp) > new Date(g.timestamp || 0)) g.timestamp = r.timestamp;
      if (new Date(r.data_movimento) > new Date(g.data_movimento || 0)) g.data_movimento = r.data_movimento;
      g.prodotti.push({
        id: r.id, prodotto: r.prodotto, quantita: r.quantita,
        unita_misura: r.unita_misura, txt_content: r.txt_content || '', txt_filename: r.txt_filename || ''
      });
    });
    return Array.from(byId.values());
  };

  useEffect(() => { setGroups(buildGroups(rawMovimentazioni)); }, [rawMovimentazioni]);

  // Filtro e ordinamento
  const filteredGroups = useMemo(() => {
    let arr = [...groups];

    if (filters.product) {
      const q = filters.product.toLowerCase();
      arr = arr.filter(g => g.prodotti.some(p => (p.prodotto || '').toLowerCase().includes(q)));
    }

    if (filters.searchTerm) {
      const q = filters.searchTerm.toLowerCase();
      arr = arr.filter(g =>
        g.origine?.toLowerCase().includes(q) ||
        g.destinazione?.toLowerCase().includes(q) ||
        g.ddt_number?.toLowerCase().includes(q) ||
        g.prodotti.some(p => (p.prodotto || '').toLowerCase().includes(q))
      );
    }

    arr.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (['data_movimento', 'timestamp'].includes(sortConfig.key)) {
        aVal = new Date(aVal || '1900-01-01');
        bVal = new Date(bVal || '1900-01-01');
      }
      if (sortConfig.key === 'prodotti_count') {
        aVal = a.prodotti.length;
        bVal = b.prodotti.length;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  }, [groups, filters.product, filters.searchTerm, sortConfig]);

  // Paginazione
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredGroups.slice(start, start + itemsPerPage);
  }, [filteredGroups, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [filters.searchTerm, filters.product]);

  // Statistiche
  const stats = useMemo(() => ({
    total: filteredGroups.length,
    withTxt: filteredGroups.filter(g => g.prodotti.some(p => p.txt_content?.trim())).length,
    stores: [...new Set(filteredGroups.map(g => g.origine))].filter(Boolean).length,
    totalProducts: filteredGroups.reduce((sum, g) => sum + g.prodotti.length, 0)
  }), [filteredGroups]);

  // Conteggio filtri attivi
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.originStore !== 'ALL') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.product) count++;
    return count;
  }, [filters]);

  // Handlers
  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const resetFilters = () => {
    setFilters({ originStore: 'ALL', dateFrom: '', dateTo: '', product: '', searchTerm: '' });
  };
  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  const toggleGroupSelection = (gid) => {
    setSelectedGroups(prev => prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]);
  };
  const selectAllGroups = () => {
    setSelectedGroups(prev => prev.length === paginatedGroups.length ? [] : paginatedGroups.map(g => g.id));
  };

  const exportSelectedGroupsJSON = () => {
    if (selectedGroups.length === 0) { setError("Seleziona almeno una movimentazione"); setTimeout(() => setError(''), 3000); return; }
    const selected = filteredGroups.filter(g => selectedGroups.includes(g.id));
    const dataStr = JSON.stringify({ exportDate: new Date().toISOString(), exportedBy: user?.email, movimentazioni: selected }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `movimentazioni_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSuccess(`Export di ${selected.length} movimentazioni completato!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const exportSelectedGroupsTXT = async () => {
    if (selectedGroups.length === 0) { setError("Seleziona almeno una movimentazione"); setTimeout(() => setError(''), 3000); return; }
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const chosen = filteredGroups.filter(g => selectedGroups.includes(g.id));
      chosen.forEach((g, idx) => {
        const withTxt = g.prodotti.filter(p => p.txt_content?.trim());
        if (withTxt.length === 0) return;
        const bundle = withTxt.map(p => p.txt_content).join('\n');
        zip.file(`DDT_${g.ddt_number || g.id}_${idx + 1}.txt`, bundle);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a'); a.href = url; a.download = `movimentazioni_txt_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setSuccess('Export ZIP completato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Errore export: ' + e.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const downloadGroupTxt = (g) => {
    const allTxt = g.prodotti.filter(p => p.txt_content?.trim()).map(p => p.txt_content).join('\n');
    if (!allTxt) return;
    const blob = new Blob([allTxt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `DDT_${g.ddt_number || g.id}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // Access check
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md border border-red-200 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h3 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Accesso Negato</h3>
          <p className="text-fradiavolo-charcoal-light">Questa sezione è riservata agli amministratori.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-fradiavolo-red to-fradiavolo-orange rounded-2xl shadow-lg">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-fradiavolo-charcoal">Movimentazioni</h1>
            <p className="text-sm text-fradiavolo-charcoal-light">
              {filteredGroups.length} DDT {activeFiltersCount > 0 && `(filtrati)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMovimentazioni}
            disabled={isLoading}
            className="p-2.5 text-fradiavolo-charcoal hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-xl transition-all"
            title="Aggiorna"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="hidden sm:flex items-center bg-fradiavolo-cream rounded-xl p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-fradiavolo-red' : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-fradiavolo-red' : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium flex-1">{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded"><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green border-fradiavolo-green/30 flex items-center gap-3">
          <Check className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Statistiche compatte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'DDT Totali', value: stats.total, icon: Truck, color: 'fradiavolo-red', bg: 'fradiavolo-red/10' },
          { label: 'Con TXT', value: stats.withTxt, icon: FileText, color: 'fradiavolo-orange', bg: 'fradiavolo-orange/10' },
          { label: 'Negozi', value: stats.stores, icon: Store, color: 'fradiavolo-green', bg: 'fradiavolo-green/10' },
          { label: 'Articoli', value: stats.totalProducts, icon: Package, color: 'blue-600', bg: 'blue-100' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${stat.bg} rounded-lg`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold text-${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-fradiavolo-charcoal-light">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra ricerca + Filtri */}
      <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light" size={18} />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="Cerca DDT, negozio, prodotto..."
              className="w-full pl-10 pr-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-fradiavolo-cream/20 transition-all"
            />
            {filters.searchTerm && (
              <button onClick={() => updateFilter('searchTerm', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal">
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium ${
              showFilters || activeFiltersCount > 0
                ? 'bg-fradiavolo-red text-white border-fradiavolo-red'
                : 'bg-white text-fradiavolo-charcoal border-fradiavolo-cream-dark hover:border-fradiavolo-red'
            }`}
          >
            <Filter size={18} />
            <span>Filtri</span>
            {activeFiltersCount > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${showFilters ? 'bg-white/20' : 'bg-fradiavolo-red text-white'}`}>
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showFilters && (
          <div className="px-4 pb-4 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Negozio Origine</label>
                <select
                  value={filters.originStore}
                  onChange={(e) => updateFilter('originStore', e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 bg-white text-sm"
                >
                  <option value="ALL">Tutti</option>
                  {stores.map(store => <option key={store.name} value={store.name}>{store.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Data Da</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Data A</label>
                <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Prodotto</label>
                <input type="text" placeholder="Filtra prodotto..." value={filters.product} onChange={(e) => updateFilter('product', e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 bg-white text-sm" />
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="mt-4 pt-4 border-t border-fradiavolo-cream-dark">
                <button onClick={resetFilters} className="text-sm text-fradiavolo-red hover:text-fradiavolo-red/80 font-medium flex items-center gap-1">
                  <X size={14} /> Resetta filtri
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedGroups.length > 0 && (
        <div className="bg-fradiavolo-cream/50 rounded-xl p-4 border border-fradiavolo-cream-dark flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-medium text-fradiavolo-charcoal">
            {selectedGroups.length} selezionati
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedGroups([])} className="px-3 py-2 text-sm text-fradiavolo-charcoal hover:bg-white rounded-lg transition-all">
              Deseleziona
            </button>
            <button onClick={exportSelectedGroupsJSON} className="flex items-center gap-2 px-4 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-orange/90 text-white rounded-xl text-sm font-medium">
              <Download size={16} /> JSON
            </button>
            <button onClick={exportSelectedGroupsTXT} className="flex items-center gap-2 px-4 py-2 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal/90 text-white rounded-xl text-sm font-medium">
              <FileText size={16} /> TXT
            </button>
          </div>
        </div>
      )}

      {/* Contenuto principale */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-fradiavolo-cream-dark rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-fradiavolo-red border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-fradiavolo-charcoal font-medium">Caricamento...</p>
          </div>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-fradiavolo-cream-dark p-12 text-center">
          <div className="w-16 h-16 bg-fradiavolo-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="text-fradiavolo-charcoal-light" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Nessuna movimentazione</h3>
          <p className="text-fradiavolo-charcoal-light">Modifica i filtri per visualizzare i dati</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Vista Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedGroups.map((g) => (
            <div
              key={g.id}
              className={`bg-white rounded-xl border p-4 hover:shadow-lg transition-all cursor-pointer ${
                selectedGroups.includes(g.id) ? 'border-fradiavolo-red ring-2 ring-fradiavolo-red/20' : 'border-fradiavolo-cream-dark hover:border-fradiavolo-red/30'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(g.id)}
                    onChange={() => toggleGroupSelection(g.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-fradiavolo-red border-fradiavolo-cream-dark rounded focus:ring-fradiavolo-red"
                  />
                  <span className="font-semibold text-fradiavolo-charcoal">{g.ddt_number}</span>
                </div>
                <span className="px-2 py-1 bg-fradiavolo-cream text-fradiavolo-charcoal rounded-full text-xs font-medium flex items-center gap-1">
                  <Package size={12} /> {g.prodotti.length}
                </span>
              </div>

              <div className="space-y-2 text-sm mb-3">
                <div className="flex items-center gap-2 text-fradiavolo-charcoal">
                  <Store size={14} className="text-fradiavolo-charcoal-light" />
                  <span>{g.origine}</span>
                  <ChevronRight size={14} className="text-fradiavolo-charcoal-light" />
                  <span>{g.destinazione}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-fradiavolo-cream-dark">
                <span className="text-xs text-fradiavolo-charcoal-light flex items-center gap-1">
                  <Calendar size={12} /> {formatDate(g.data_movimento)}
                </span>
                <div className="flex items-center gap-1">
                  {g.prodotti.some(p => p.txt_content?.trim()) && (
                    <button onClick={(e) => { e.stopPropagation(); downloadGroupTxt(g); }} className="p-1.5 bg-fradiavolo-orange/10 hover:bg-fradiavolo-orange/20 text-fradiavolo-orange rounded-lg">
                      <FileText size={14} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedGroup(g); setShowDetailsModal(true); }} className="p-1.5 hover:bg-fradiavolo-cream text-fradiavolo-charcoal-light hover:text-fradiavolo-red rounded-lg">
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vista Tabella */
        <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-fradiavolo-cream/30 border-b border-fradiavolo-cream-dark">
                  <th className="px-4 py-3 w-12">
                    <input type="checkbox" checked={selectedGroups.length === paginatedGroups.length && paginatedGroups.length > 0}
                      onChange={selectAllGroups} className="w-4 h-4 text-fradiavolo-red rounded" />
                  </th>
                  {[
                    { key: 'data_movimento', label: 'Data' },
                    { key: 'ddt_number', label: 'DDT' },
                    { key: 'prodotti_count', label: 'Articoli' },
                    { key: 'origine', label: 'Origine' },
                    { key: 'destinazione', label: 'Destinazione' }
                  ].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wider cursor-pointer hover:bg-fradiavolo-cream/50 select-none">
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortConfig.key === col.key && <ArrowUpDown size={14} className={`text-fradiavolo-red ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} />}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fradiavolo-charcoal uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {paginatedGroups.map((g) => (
                  <React.Fragment key={g.id}>
                    <tr className={`hover:bg-fradiavolo-cream/20 transition-colors ${selectedGroups.includes(g.id) ? 'bg-fradiavolo-red/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroupSelection(g.id)}
                          className="w-4 h-4 text-fradiavolo-red rounded" />
                      </td>
                      <td className="px-4 py-3 text-sm text-fradiavolo-charcoal">{formatDate(g.data_movimento)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setExpanded(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                          className="flex items-center gap-1 font-medium text-fradiavolo-charcoal hover:text-fradiavolo-red">
                          {expanded[g.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {g.ddt_number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-fradiavolo-cream text-fradiavolo-charcoal">
                          <Package size={12} /> {g.prodotti.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-fradiavolo-charcoal">{g.origine}</td>
                      <td className="px-4 py-3 text-sm text-fradiavolo-charcoal">{g.destinazione}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setSelectedGroup(g); setShowDetailsModal(true); }}
                            className="p-2 text-fradiavolo-charcoal-light hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-lg">
                            <Eye size={18} />
                          </button>
                          {g.prodotti.some(p => p.txt_content?.trim()) && (
                            <button onClick={() => downloadGroupTxt(g)}
                              className="p-2 text-fradiavolo-charcoal-light hover:text-fradiavolo-orange hover:bg-fradiavolo-cream rounded-lg">
                              <Download size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded[g.id] && (
                      <tr className="bg-fradiavolo-cream/20">
                        <td></td>
                        <td colSpan={6} className="px-4 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                            {g.prodotti.map((p, idx) => (
                              <div key={p.id || idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-fradiavolo-cream-dark">
                                <div>
                                  <p className="text-sm font-medium text-fradiavolo-charcoal">{p.prodotto}</p>
                                  <p className="text-xs text-fradiavolo-charcoal-light">{p.quantita} {p.unita_misura}</p>
                                </div>
                                {p.txt_content?.trim() && <span className="px-2 py-0.5 text-xs font-medium bg-fradiavolo-orange/15 text-fradiavolo-orange rounded">TXT</span>}
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

      {/* Paginazione */}
      {filteredGroups.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-fradiavolo-cream-dark p-4">
          <div className="flex items-center gap-2 text-sm text-fradiavolo-charcoal-light">
            <span>Mostra</span>
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 border border-fradiavolo-cream-dark rounded-lg bg-white text-fradiavolo-charcoal">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>di {filteredGroups.length}</span>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={18} /><ChevronLeft size={18} className="-ml-3" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 py-1 text-sm font-medium text-fradiavolo-charcoal">{currentPage} / {totalPages || 1}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages}
              className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight size={18} /><ChevronRight size={18} className="-ml-3" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Dettagli */}
      {showDetailsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fradiavolo-red/10 rounded-xl">
                  <Truck className="h-6 w-6 text-fradiavolo-red" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">{selectedGroup.ddt_number}</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">{formatDate(selectedGroup.data_movimento)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-fradiavolo-cream rounded-lg">
                <X size={20} className="text-fradiavolo-charcoal" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-fradiavolo-cream/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-fradiavolo-charcoal-light mb-1">
                    <Store size={14} /> Origine
                  </div>
                  <p className="font-semibold text-fradiavolo-charcoal">{selectedGroup.origine}</p>
                </div>
                <div className="bg-fradiavolo-cream/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-fradiavolo-charcoal-light mb-1">
                    <MapPin size={14} /> Destinazione
                  </div>
                  <p className="font-semibold text-fradiavolo-charcoal">{selectedGroup.destinazione}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center gap-2">
                  <Package size={18} /> Prodotti ({selectedGroup.prodotti.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedGroup.prodotti.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between p-3 bg-fradiavolo-cream/20 rounded-xl border border-fradiavolo-cream-dark">
                      <div>
                        <p className="font-medium text-fradiavolo-charcoal">{p.prodotto}</p>
                        <p className="text-sm text-fradiavolo-charcoal-light">{p.quantita} {p.unita_misura}</p>
                      </div>
                      {p.txt_content?.trim() && (
                        <span className="px-2 py-1 text-xs font-medium bg-fradiavolo-orange/15 text-fradiavolo-orange rounded-lg">TXT</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/20">
              {selectedGroup.prodotti.some(p => p.txt_content?.trim()) ? (
                <button onClick={() => downloadGroupTxt(selectedGroup)}
                  className="flex items-center gap-2 px-4 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-orange/90 text-white rounded-xl font-medium">
                  <Download size={16} /> Scarica TXT
                </button>
              ) : <div />}
              <button onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2 bg-fradiavolo-cream hover:bg-fradiavolo-cream-dark text-fradiavolo-charcoal rounded-xl font-medium">
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
