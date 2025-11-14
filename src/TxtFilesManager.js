// frontend/src/pages/admin/TxtFilesManager.js
import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Download, X, FileText, RefreshCw, Filter, Search, AlertCircle, Edit3, Save, Trash2, Package, Truck } from 'lucide-react';
import negoziData from '../../data/negozi.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/** 
 * Estrae il codice magazzino dal filename
 * Regola: codice magazzino è il numero PRIMA dell'estensione .txt
 * Esempi:
 * - "file_132.txt" → "132"
 * - "MOV_2025-11-06_117.txt" → "117"
 * - "FAT_12345_2025-11-06_FORNITORE_999.txt" → "999"
 */
function extractWarehouseCode(filename) {
  try {
    // Rimuovi estensione .txt (case insensitive)
    const withoutExt = filename.replace(/\.txt$/i, '');
    
    // Rimuovi suffisso _ERRORI se presente
    const cleaned = withoutExt.endsWith('_ERRORI') 
      ? withoutExt.slice(0, -'_ERRORI'.length) 
      : withoutExt;
    
    // Cerca l'ultimo numero nel nome del file (dopo l'ultimo underscore)
    const match = cleaned.match(/_(\d+)$/);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Fallback: cerca qualsiasi numero alla fine
    const fallbackMatch = cleaned.match(/(\d+)$/);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1];
    }
    
    return '-';
  } catch (error) {
    console.error('Errore estrazione codice magazzino:', error);
    return '-';
  }
}

/**
 * ✅ VERSIONE ROBUSTA: Determina il tipo di documento dal nome del file
 * Gestisce:
 * - Spazi vs underscore
 * - Maiuscole/minuscole
 * - Variazioni di formattazione
 */
function getDocumentType(filename) {
  // Normalizza il filename per il confronto
  const normalizedFilename = filename
    .toLowerCase()                    // minuscolo
    .replace(/_/g, ' ')               // underscore → spazio
    .replace(/\s+/g, ' ')             // spazi multipli → singolo
    .trim();
  
  // Controlla se contiene uno dei nomi dei negozi
  const hasStoreName = negoziData.some(negozio => {
    const storeName = negozio.nome
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    const match = normalizedFilename.includes(storeName);
    
    // Debug (rimuovi in produzione se non serve)
    if (match) {
      console.log(`✅ Movimentazione rilevata: "${filename}" contiene "${negozio.nome}"`);
    }
    
    return match;
  });
  
  return hasStoreName ? 'movimentazione' : 'fattura';
}

const TxtFilesManager = () => {
  const [txtFiles, setTxtFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalFileContent, setOriginalFileContent] = useState('');
  const [hasErrorsFlag, setHasErrorsFlag] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  
  // Editing state
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const authHeader = () => {
    const token = localStorage.getItem('token') || '';
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  };

  const loadTxtFiles = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/txt-files`, {
        headers: { Authorization: authHeader() }
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const data = await res.json();

      const list = (Array.isArray(data.files) ? data.files : []).map(f => {
        const warehouseCode = extractWarehouseCode(f.name);
        const flaggedError = /_ERRORI\.txt$/i.test(f.name);
        const docType = getDocumentType(f.name);
        
        return { 
          ...f, 
          warehouseCode, 
          flaggedError,
          docType
        };
      });
      
      setTxtFiles(list);
    } catch (e) {
      console.error('Errore caricamento TXT:', e);
      setError('Impossibile caricare la lista dei file TXT');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTxtFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPreview = async (filename) => {
    try {
      setIsLoadingPreview(true);
      setError('');
      setSelectedFile(filename);
      setShowPreview(true);
      setIsEditingContent(false);

      const res = await fetch(`${API_BASE_URL}/txt-files/${encodeURIComponent(filename)}/content`, {
        headers: { Authorization: authHeader() }
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);

      const data = await res.json();
      setFileContent(data.content || '');
      setOriginalFileContent(data.content || '');
      setEditedContent(data.content || '');
      
      const convErr = !!(data?.errorDetails?.item_noconv || data?.errorDetails?.errore_conversione);
      setHasErrorsFlag(!!data.hasErrors || convErr);
      setErrorDetails(data.errorDetails || null);

      if (data.renamedTo && data.renamedTo !== filename) {
        setSelectedFile(data.renamedTo);
        setTxtFiles(prev =>
          prev.map(f => (f.name === filename ? { ...f, name: data.renamedTo, flaggedError: true } : f))
        );
      }
    } catch (e) {
      console.error('Errore anteprima:', e);
      setError('Impossibile caricare il contenuto del file');
      setShowPreview(false);
      setSelectedFile(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const saveEditedContent = async () => {
    try {
      setIsLoading(true);
      setError('');

      const res = await fetch(`${API_BASE_URL}/txt-files/${encodeURIComponent(selectedFile)}/content`, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editedContent })
      });

      if (!res.ok) throw new Error(`Errore ${res.status}`);

      setFileContent(editedContent);
      setOriginalFileContent(editedContent);
      setIsEditingContent(false);
      setSuccess('✅ File modificato con successo! Backup creato.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error('Errore salvataggio:', e);
      setError('Impossibile salvare le modifiche: ' + e.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFile = async (filename) => {
    if (!window.confirm(`Sei sicuro di voler eliminare "${filename}"?\n\nUn backup verrà creato automaticamente.`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const res = await fetch(`${API_BASE_URL}/txt-files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() }
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Errore ${res.status}: ${text}`);
      }

      const data = await res.json();

      setTxtFiles(prev => prev.filter(f => f.name !== filename));
      
      setSuccess(`✅ File eliminato. ${data.backup_created ? 'Backup creato.' : ''}`);
      setTimeout(() => setSuccess(''), 3000);

      if (selectedFile === filename) {
        setShowPreview(false);
        setSelectedFile(null);
      }
    } catch (e) {
      console.error('Errore eliminazione:', e);
      setError('Impossibile eliminare il file: ' + e.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTxtFile = async (filename, { closePreviewAfter = false } = {}) => {
    try {
      setError('');

      const respDownload = await fetch(`${API_BASE_URL}/txt-files/${encodeURIComponent(filename)}`, {
        headers: { Authorization: authHeader() }
      });
      if (!respDownload.ok) throw new Error(`Errore download ${respDownload.status}`);

      const blob = await respDownload.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`File "${filename}" scaricato.`);
      setTimeout(() => setSuccess(''), 3000);

      if (closePreviewAfter) {
        setShowPreview(false);
        setSelectedFile(null);
        setFileContent('');
        setOriginalFileContent('');
        setHasErrorsFlag(false);
        setErrorDetails(null);
        setIsEditingContent(false);
      }
    } catch (e) {
      console.error('Errore download:', e);
      setError('Errore: ' + e.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const rowDownload = (filename) => downloadTxtFile(filename, { closePreviewAfter: false });

  const humanSize = (bytes) => {
    if (bytes === 0 || bytes == null) return '0 B';
    const k = 1024;
    const sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const warehouseOptions = useMemo(() => {
    const set = new Set();
    txtFiles.forEach(f => {
      const code = f.warehouseCode;
      if (code && code !== '-') {
        set.add(code);
      }
    });
    const sorted = Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });
    return ['ALL', ...sorted];
  }, [txtFiles]);

  const typeStats = useMemo(() => {
    const stats = {
      movimentazione: 0,
      fattura: 0
    };
    txtFiles.forEach(f => {
      stats[f.docType]++;
    });
    return stats;
  }, [txtFiles]);

  const filteredFiles = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    return txtFiles.filter(f => {
      const nameOk = !q || f.name.toLowerCase().includes(q);
      const warehouseOk = warehouseFilter === 'ALL' || f.warehouseCode === warehouseFilter;
      const typeOk = typeFilter === 'ALL' || f.docType === typeFilter;
      return nameOk && warehouseOk && typeOk;
    });
  }, [txtFiles, searchTerm, warehouseFilter, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-fradiavolo-charcoal">File TXT</h2>
          <p className="text-fradiavolo-charcoal-light">Gestione file generati dalle consegne e movimentazioni</p>
        </div>
        <button
          onClick={loadTxtFiles}
          disabled={isLoading}
          className="inline-flex items-center space-x-2 px-3 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Ricarica</span>
        </button>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fradiavolo-charcoal-light">Totale File</p>
              <p className="text-2xl font-bold text-fradiavolo-charcoal">{txtFiles.length}</p>
            </div>
            <FileText className="h-8 w-8 text-fradiavolo-red" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fradiavolo-charcoal-light">Fatture Fornitori</p>
              <p className="text-2xl font-bold text-fradiavolo-charcoal">{typeStats.fattura}</p>
            </div>
            <Package className="h-8 w-8 text-fradiavolo-orange" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fradiavolo-charcoal-light">Movimentazioni</p>
              <p className="text-2xl font-bold text-fradiavolo-charcoal">{typeStats.movimentazione}</p>
            </div>
            <Truck className="h-8 w-8 text-fradiavolo-green" />
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark p-3 flex flex-col md:flex-row gap-3 md:items-center">
        {/* Search */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-1">Cerca per nome file</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e)=>setSearchTerm(e.target.value)}
              placeholder="Es: FDV Milano Isola, 5011.txt"
              className="w-full border border-fradiavolo-cream-dark p-3 pr-9 rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            />
            <Search className="h-4 w-4 text-fradiavolo-charcoal-light absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Filtro tipo documento */}
        <div className="w-full md:w-48">
          <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-1">Tipo documento</label>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e)=>setTypeFilter(e.target.value)}
              className="w-full border border-fradiavolo-cream-dark p-3 pr-9 rounded-xl bg-white focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            >
              <option value="ALL">Tutti i tipi</option>
              <option value="fattura">Fatture Fornitori</option>
              <option value="movimentazione">Movimentazioni</option>
            </select>
            <Filter className="h-4 w-4 text-fradiavolo-charcoal-light absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Warehouse filter */}
        <div className="w-full md:w-64">
          <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-1">Filtra per codice magazzino</label>
          <div className="relative">
            <select
              value={warehouseFilter}
              onChange={(e)=>setWarehouseFilter(e.target.value)}
              className="w-full border border-fradiavolo-cream-dark p-3 pr-9 rounded-xl bg-white focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            >
              {warehouseOptions.map(opt => (
                <option key={opt} value={opt}>
                  {opt === 'ALL' ? 'Tutti i magazzini' : opt}
                </option>
              ))}
            </select>
            <Filter className="h-4 w-4 text-fradiavolo-charcoal-light absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Alert */}
      {error && (
        <div className="p-3 rounded-xl border bg-red-50 text-red-800 border-red-200">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30">{success}</div>
      )}

      {/* Counter */}
      <div className="text-sm text-fradiavolo-charcoal-light">
        Mostrati {filteredFiles.length} di {txtFiles.length} file
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-fradiavolo-cream">
              <tr className="text-left text-fradiavolo-charcoal">
                <th className="px-4 py-3">Nome file</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Codice Magazzino PV</th>
                <th className="px-4 py-3">Dimensione</th>
                <th className="px-4 py-3">Creato</th>
                <th className="px-4 py-3">Modificato</th>
                <th className="px-4 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-fradiavolo-charcoal-light" colSpan={7}>
                    Caricamento...
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-fradiavolo-charcoal-light" colSpan={7}>
                    Nessun file TXT corrisponde ai filtri
                  </td>
                </tr>
              ) : (
                filteredFiles.map((f) => {
                  const dangerRow = f.flaggedError;
                  return (
                    <tr
                      key={f.name}
                      className={
                        "border-t border-fradiavolo-cream-dark/50 " +
                        (dangerRow ? "bg-red-50/40" : "")
                      }
                      style={dangerRow ? { boxShadow: 'inset 0 0 0 1px rgba(220,38,38,0.25)' } : undefined}
                    >
                      <td className="px-4 py-3 font-medium text-fradiavolo-charcoal flex items-center gap-2">
                        <FileText className={`h-4 w-4 ${dangerRow ? 'text-red-600' : 'text-fradiavolo-red'}`} />
                        <span className="truncate max-w-[46ch]" title={f.name}>{f.name}</span>
                        {dangerRow && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            Errore segnalato
                          </span>
                        )}
                      </td>
                      
                      {/* Colonna tipo documento */}
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border " +
                            (f.docType === 'movimentazione'
                              ? "bg-fradiavolo-green/10 text-fradiavolo-green border-fradiavolo-green/30"
                              : "bg-fradiavolo-orange/10 text-fradiavolo-orange border-fradiavolo-orange/30")
                          }
                        >
                          {f.docType === 'movimentazione' ? (
                            <>
                              <Truck className="h-3 w-3" />
                              Movimentazione
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3" />
                              Fattura
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold border " +
                            (dangerRow
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-fradiavolo-cream text-fradiavolo-charcoal border-fradiavolo-cream-dark")
                          }
                        >
                          {f.warehouseCode !== '-' ? f.warehouseCode : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-fradiavolo-charcoal-light">{humanSize(f.size)}</td>
                      <td className="px-4 py-3 text-fradiavolo-charcoal-light">
                        {f.created ? new Date(f.created).toLocaleString('it-IT') : '-'}
                      </td>
                      <td className="px-4 py-3 text-fradiavolo-charcoal-light">
                        {f.modified ? new Date(f.modified).toLocaleString('it-IT') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openPreview(f.name)}
                            className={
                              "inline-flex items-center gap-1 px-3 py-2 text-xs rounded-lg transition-colors " +
                              (dangerRow
                                ? "bg-red-700 text-white hover:bg-red-800"
                                : "bg-fradiavolo-charcoal text-white hover:bg-fradiavolo-charcoal-light")
                            }
                            title="Visualizza e modifica"
                          >
                            <Eye className="h-3 w-3" />
                            Visualizza
                          </button>
                          <button
                            onClick={() => rowDownload(f.name)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors"
                            title="Scarica file"
                          >
                            <Download className="h-3 w-3" />
                            Scarica
                          </button>
                          <button
                            onClick={() => deleteFile(f.name)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            title="Elimina file (verrà creato un backup)"
                          >
                            <Trash2 className="h-3 w-3" />
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-4xl max-h-[90vh] border border-fradiavolo-cream-dark flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-fradiavolo-cream-dark flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText className={`h-5 w-5 ${hasErrorsFlag ? 'text-red-600' : 'text-fradiavolo-red'}`} />
                <div>
                  <h3 className="text-lg font-semibold text-fradiavolo-charcoal">
                    {selectedFile}
                  </h3>
                  {hasErrorsFlag && (
                    <p className="text-xs text-red-700 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Questo file contiene errori.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setSelectedFile(null);
                  setFileContent('');
                  setOriginalFileContent('');
                  setHasErrorsFlag(false);
                  setErrorDetails(null);
                  setIsEditingContent(false);
                }}
                className="p-2 rounded-lg hover:bg-fradiavolo-cream transition-colors"
              >
                <X className="h-5 w-5 text-fradiavolo-charcoal" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {isLoadingPreview ? (
                <div className="text-fradiavolo-charcoal-light text-sm">Caricamento contenuto...</div>
              ) : (
                <>
                  {/* ERRORE CONSEGNA */}
                  {errorDetails?.note_errori && (
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm">
                      <div className="font-semibold text-red-700 mb-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Errore segnalato in consegna
                      </div>
                      <div className="text-red-900">{errorDetails.note_errori}</div>
                    </div>
                  )}

                  {/* ERRORE DI CONVERSIONE */}
                  {(errorDetails?.item_noconv || errorDetails?.errore_conversione) && (
                    <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-sm">
                      <div className="font-semibold text-orange-700 mb-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Errore di conversione
                      </div>
                      <div className="text-orange-900">
                        {errorDetails.item_noconv || errorDetails.errore_conversione}
                      </div>
                    </div>
                  )}

                  {/* Editor con possibilità di modifica */}
                  <div className="bg-fradiavolo-cream rounded-lg border border-fradiavolo-cream-dark p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-fradiavolo-charcoal">
                        Contenuto file
                      </span>
                      {!isEditingContent && (
                        <button
                          onClick={() => {
                            setIsEditingContent(true);
                            setEditedContent(fileContent);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors"
                        >
                          <Edit3 className="h-3 w-3" />
                          Modifica
                        </button>
                      )}
                    </div>

                    {isEditingContent ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full text-xs text-fradiavolo-charcoal font-mono bg-white p-3 rounded-lg border border-fradiavolo-cream-dark focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors min-h-[400px]"
                          placeholder="Contenuto del file..."
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEditedContent}
                            disabled={isLoading || editedContent === originalFileContent}
                            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-fradiavolo-green text-white rounded-lg hover:bg-fradiavolo-green-dark transition-colors disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            Salva Modifiche
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingContent(false);
                              setEditedContent(fileContent);
                            }}
                            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors"
                          >
                            <X className="h-4 w-4" />
                            Annulla
                          </button>
                        </div>
                        {editedContent !== originalFileContent && (
                          <p className="text-xs text-fradiavolo-orange">
                            ⚠️ Hai modifiche non salvate
                          </p>
                        )}
                      </div>
                    ) : (
                      <pre className="text-xs text-fradiavolo-charcoal font-mono whitespace-pre-wrap bg-white p-3 rounded-lg border border-fradiavolo-cream-dark max-h-96 overflow-y-auto">
                        {fileContent || '(file vuoto)'}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-fradiavolo-cream-dark flex items-center justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 rounded-lg bg-fradiavolo-charcoal text-white hover:bg-fradiavolo-charcoal-light transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={() => downloadTxtFile(selectedFile, { closePreviewAfter: false })}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-fradiavolo-red text-white hover:bg-fradiavolo-red-dark transition-colors"
              >
                <Download className="h-4 w-4" />
                Scarica
              </button>
              <button
                onClick={() => {
                  deleteFile(selectedFile);
                }}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TxtFilesManager;
