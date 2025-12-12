// frontend/src/pages/admin/TxtFilesManager.jsx
import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Eye,
  X,
  Filter,
  AlertCircle,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save
} from 'lucide-react';
import ErrorsSection from './components/ErrorsSection';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const TxtFilesManager = () => {
  // State
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterErrorsOnly, setFilterErrorsOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal
  const [showFileContent, setShowFileContent] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [errorsData, setErrorsData] = useState(null);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);

  // Editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  // Fetch files
  useEffect(() => { fetchFiles(); }, []);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/txt-files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Errore caricamento file');
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Statistiche e date uniche
  const stats = useMemo(() => {
    const withErrors = files.filter(f => f.name.includes('_ERRORI')).length;
    const uniqueDates = [...new Set(
      files.map(f => { const m = f.name.match(/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; }).filter(Boolean)
    )].sort((a, b) => new Date(b) - new Date(a));
    return { total: files.length, withErrors, dates: uniqueDates };
  }, [files]);

  // Conteggio filtri attivi
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (filterErrorsOnly) count++;
    if (selectedDate) count++;
    return count;
  }, [searchTerm, filterErrorsOnly, selectedDate]);

  // Filtro e paginazione
  const filteredFiles = useMemo(() => {
    let filtered = [...files];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(term));
    }
    if (filterErrorsOnly) filtered = filtered.filter(f => f.name.includes('_ERRORI'));
    if (selectedDate) filtered = filtered.filter(f => f.name.includes(selectedDate));
    filtered.sort((a, b) => new Date(b.created) - new Date(a.created));
    return filtered;
  }, [files, searchTerm, filterErrorsOnly, selectedDate]);

  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFiles.slice(start, start + itemsPerPage);
  }, [filteredFiles, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterErrorsOnly, selectedDate]);

  // Helpers
  const hasErrors = (name) => name.includes('_ERRORI');
  const formatDate = (dateStr) => {
    try { return new Date(dateStr).toLocaleDateString('it-IT'); } catch { return dateStr; }
  };
  const formatTime = (dateStr) => {
    try { return new Date(dateStr).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  // Invoice details
  const extractInvoiceIdFromFilename = (filename) => {
    const parts = filename.replace('.txt', '').replace('_ERRORI', '').split('_');
    return parts.length >= 3 ? { numero: parts[0], data: parts[1], fornitore: parts[2] } : null;
  };

  const fetchInvoiceDetails = async (file) => {
    setLoadingInvoiceDetails(true);
    setErrorsData(null);
    try {
      const invoiceInfo = extractInvoiceIdFromFilename(file.name);
      if (!invoiceInfo) return;
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/admin/invoices`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const invoice = (data.data || []).find(inv => String(inv.numero || '').trim() === String(invoiceInfo.numero).trim());
      if (!invoice) return;
      const errRes = await fetch(`${API_BASE_URL}/invoices/${invoice.id}/errors`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (errRes.ok) setErrorsData((await errRes.json()).errors);
    } catch (e) {
      console.error('Errore dettagli:', e);
    } finally {
      setLoadingInvoiceDetails(false);
    }
  };

  // Handlers
  const handleViewFile = async (file) => {
    setSelectedFile(file);
    setShowFileContent(true);
    setLoadingContent(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/txt-files/${file.name}/content`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Errore');
      setFileContent((await res.json()).content);
      await fetchInvoiceDetails(file);
    } catch {
      setShowFileContent(false);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleDownloadFile = async (fileName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/txt-files/${fileName}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  const handleDeleteFile = async (fileName) => {
    if (!window.confirm(`Eliminare "${fileName}"?\nVerrà creato un backup.`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/txt-files/${fileName}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) fetchFiles();
    } catch { /* silent */ }
  };

  const handleStartEditing = () => {
    setEditedContent(fileContent);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  const handleSaveContent = async () => {
    if (!selectedFile || !editedContent.trim()) return;

    setSavingContent(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/txt-files/${selectedFile.name}/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editedContent })
      });

      if (!res.ok) throw new Error('Errore salvataggio');

      setFileContent(editedContent);
      setIsEditing(false);
      alert('File salvato con successo!');
    } catch (err) {
      alert('Errore durante il salvataggio: ' + err.message);
    } finally {
      setSavingContent(false);
    }
  };

  const handleResetFilters = () => { setSearchTerm(''); setFilterErrorsOnly(false); setSelectedDate(''); };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-fradiavolo-cream-dark rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-fradiavolo-red border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-fradiavolo-charcoal font-medium">Caricamento file...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md border border-red-200 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h3 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Errore</h3>
          <p className="text-fradiavolo-charcoal-light mb-6">{error}</p>
          <button onClick={fetchFiles} className="px-6 py-3 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl font-medium">
            Riprova
          </button>
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
            <FileText className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-fradiavolo-charcoal">File TXT</h1>
            <p className="text-sm text-fradiavolo-charcoal-light">
              {filteredFiles.length} file {activeFiltersCount > 0 && `(filtrati da ${files.length})`}
            </p>
          </div>
        </div>
        <button onClick={fetchFiles} disabled={loading}
          className="p-2.5 text-fradiavolo-charcoal hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-xl transition-all">
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats compatte */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fradiavolo-red/10 rounded-lg">
              <FileText className="h-5 w-5 text-fradiavolo-red" />
            </div>
            <div>
              <p className="text-xl font-bold text-fradiavolo-red">{stats.total}</p>
              <p className="text-xs text-fradiavolo-charcoal-light">Totale File</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fradiavolo-orange/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-fradiavolo-orange" />
            </div>
            <div>
              <p className="text-xl font-bold text-fradiavolo-orange">{stats.withErrors}</p>
              <p className="text-xs text-fradiavolo-charcoal-light">Con Errori</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra ricerca + Filtri */}
      <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light" size={18} />
            <input
              type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca file..."
              className="w-full pl-10 pr-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red bg-fradiavolo-cream/20 transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal">
                <X size={16} />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium ${
              showFilters || activeFiltersCount > 0 ? 'bg-fradiavolo-red text-white border-fradiavolo-red' : 'bg-white text-fradiavolo-charcoal border-fradiavolo-cream-dark hover:border-fradiavolo-red'
            }`}>
            <Filter size={18} />
            <span>Filtri</span>
            {activeFiltersCount > 0 && <span className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${showFilters ? 'bg-white/20' : 'bg-fradiavolo-red text-white'}`}>{activeFiltersCount}</span>}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showFilters && (
          <div className="px-4 pb-4 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-fradiavolo-charcoal mb-1.5">Data</label>
                <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red/20 bg-white text-sm">
                  <option value="">Tutte le date</option>
                  {stats.dates.map(d => <option key={d} value={d}>{formatDate(d)}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={filterErrorsOnly} onChange={(e) => setFilterErrorsOnly(e.target.checked)}
                    className="w-4 h-4 text-fradiavolo-red rounded" />
                  <span className="text-sm text-fradiavolo-charcoal">Solo con errori</span>
                </label>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="mt-4 pt-4 border-t border-fradiavolo-cream-dark">
                <button onClick={handleResetFilters} className="text-sm text-fradiavolo-red font-medium flex items-center gap-1">
                  <X size={14} /> Resetta filtri
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabella */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-fradiavolo-cream-dark p-12 text-center">
          <div className="w-16 h-16 bg-fradiavolo-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="text-fradiavolo-charcoal-light" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Nessun file trovato</h3>
          <p className="text-fradiavolo-charcoal-light">Modifica i filtri per visualizzare i file</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-fradiavolo-cream-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-fradiavolo-cream/30 border-b border-fradiavolo-cream-dark">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase">Nome File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase">Creato</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal uppercase">Stato</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fradiavolo-charcoal uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {paginatedFiles.map((file) => (
                  <tr key={file.name} className="hover:bg-fradiavolo-cream/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className={hasErrors(file.name) ? 'text-fradiavolo-orange' : 'text-fradiavolo-charcoal-light'} />
                        <span className="text-sm font-medium text-fradiavolo-charcoal truncate max-w-xs">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-fradiavolo-charcoal">{formatDate(file.created)}</div>
                      <div className="text-xs text-fradiavolo-charcoal-light">{formatTime(file.created)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {hasErrors(file.name) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-fradiavolo-orange/15 text-fradiavolo-orange">
                          <AlertCircle size={12} /> Errori
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-fradiavolo-green/15 text-fradiavolo-green">
                          <CheckCircle size={12} /> OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewFile(file)} className="p-2 text-fradiavolo-charcoal-light hover:text-fradiavolo-red hover:bg-fradiavolo-cream rounded-lg" title="Visualizza">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDownloadFile(file.name)} className="p-2 text-fradiavolo-charcoal-light hover:text-fradiavolo-green hover:bg-fradiavolo-cream rounded-lg" title="Scarica">
                          <Download size={18} />
                        </button>
                        <button onClick={() => handleDeleteFile(file.name)} className="p-2 text-fradiavolo-charcoal-light hover:text-red-600 hover:bg-fradiavolo-cream rounded-lg" title="Elimina">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginazione */}
      {filteredFiles.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-fradiavolo-cream-dark p-4">
          <div className="flex items-center gap-2 text-sm text-fradiavolo-charcoal-light">
            <span>Mostra</span>
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 border border-fradiavolo-cream-dark rounded-lg bg-white text-fradiavolo-charcoal">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>di {filteredFiles.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40">
              <ChevronLeft size={18} /><ChevronLeft size={18} className="-ml-3" />
            </button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40">
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 py-1 text-sm font-medium text-fradiavolo-charcoal">{currentPage} / {totalPages || 1}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="p-2 rounded-lg hover:bg-fradiavolo-cream disabled:opacity-40">
              <ChevronRight size={18} /><ChevronRight size={18} className="-ml-3" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showFileContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowFileContent(false); setSelectedFile(null); setErrorsData(null); setIsEditing(false); setEditedContent(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fradiavolo-red/10 rounded-xl">
                  <FileText className="h-6 w-6 text-fradiavolo-red" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal truncate max-w-md">{selectedFile?.name}</h3>
                  <p className="text-xs text-fradiavolo-charcoal-light">{formatDate(selectedFile?.created)} • {formatTime(selectedFile?.created)}</p>
                </div>
              </div>
              <button onClick={() => { setShowFileContent(false); setSelectedFile(null); setErrorsData(null); setIsEditing(false); setEditedContent(''); }} className="p-2 hover:bg-fradiavolo-cream rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-fradiavolo-charcoal">Contenuto File</h4>
                {!loadingContent && !isEditing && (
                  <button
                    onClick={handleStartEditing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-fradiavolo-cream hover:bg-fradiavolo-cream-dark text-fradiavolo-charcoal rounded-lg transition-colors"
                  >
                    <Pencil size={14} /> Modifica
                  </button>
                )}
              </div>
              {loadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-fradiavolo-red" size={32} />
                </div>
              ) : isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-64 bg-white border border-fradiavolo-cream-dark rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red resize-y"
                    placeholder="Contenuto del file..."
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelEditing}
                      disabled={savingContent}
                      className="px-4 py-2 text-sm bg-fradiavolo-cream hover:bg-fradiavolo-cream-dark text-fradiavolo-charcoal rounded-lg transition-colors disabled:opacity-50"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleSaveContent}
                      disabled={savingContent || !editedContent.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-fradiavolo-green hover:bg-fradiavolo-green/90 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {savingContent ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                      {savingContent ? 'Salvataggio...' : 'Salva'}
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl p-4 text-sm font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                  {fileContent}
                </pre>
              )}

              {hasErrors(selectedFile?.name) && (
                <div className="mt-6">
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center gap-2">
                    <AlertCircle className="text-fradiavolo-orange" size={18} /> Errori Segnalati
                  </h4>
                  {loadingInvoiceDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-fradiavolo-red" size={24} />
                    </div>
                  ) : errorsData ? (
                    <ErrorsSection errorDetails={errorsData} />
                  ) : (
                    <div className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl p-4 text-sm text-fradiavolo-charcoal-light">
                      Impossibile recuperare i dettagli degli errori.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-fradiavolo-cream-dark bg-fradiavolo-cream/20">
              <button onClick={() => handleDownloadFile(selectedFile?.name)}
                className="flex items-center gap-2 px-4 py-2 bg-fradiavolo-green hover:bg-fradiavolo-green/90 text-white rounded-xl font-medium">
                <Download size={16} /> Scarica
              </button>
              <button onClick={() => { setShowFileContent(false); setSelectedFile(null); setErrorsData(null); setIsEditing(false); setEditedContent(''); }}
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

export default TxtFilesManager;
