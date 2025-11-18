// frontend/src/pages/admin/TxtFilesManager.jsx - Con tracking modifiche
import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Download, X, FileText, RefreshCw, Filter, Search, AlertCircle, Edit3, Save, Trash2, Package, Truck, Clock, Users, MessageCircle } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const negoziData = (() => {
  try {
    return require('../../data/negozi.json');
  } catch (e) {
    console.warn('⚠️ negozi.json non caricato, usando fallback');
    return [
      { nome: "FDV Office", codice: "0" },
      { nome: "FDV Genova Castello", codice: "101" },
      { nome: "FDV Bologna S.Stefano", codice: "106" },
      { nome: "FDV Roma Parioli", codice: "107" },
      { nome: "FDV Novara", codice: "112" },
      { nome: "FDV Milano Sempione", codice: "113" },
      { nome: "FDV Torino Carlina", codice: "114" },
      { nome: "FDV Torino GM", codice: "117" },
      { nome: "FDV Varese", codice: "119" },
      { nome: "FDV Milano Isola", codice: "120" },
      { nome: "FDV Milano Citylife", codice: "121" },
      { nome: "FDV Arese", codice: "122" },
      { nome: "FDV Torino IV Marzo", codice: "123" },
      { nome: "FDV Parma", codice: "124" },
      { nome: "FDV Milano Bicocca", codice: "125" },
      { nome: "FDV Monza", codice: "126" },
      { nome: "FDV Milano Premuda", codice: "127" },
      { nome: "FDV Genova Mare", codice: "128" },
      { nome: "FDV Alessandria", codice: "129" },
      { nome: "FDV Torino Vanchiglia", codice: "130" },
      { nome: "FDV Milano Porta Venezia", codice: "131" },
      { nome: "FDV Modena", codice: "132" },
      { nome: "FDV Roma Ostiense", codice: "133" },
      { nome: "FDV Asti", codice: "134" },
      { nome: "FDV Brescia Centro", codice: "135" },
      { nome: "FDV Torino San Salvario", codice: "136" },
      { nome: "FDV Rimini", codice: "137" },
      { nome: "FDV Roma Trastevere", codice: "138" }
    ];
  }
})();

function extractWarehouseCode(filename) {
  try {
    const withoutExt = filename.replace(/\.txt$/i, '');
    const cleaned = withoutExt.endsWith('_ERRORI') 
      ? withoutExt.slice(0, -'_ERRORI'.length) 
      : withoutExt;
    
    const match = cleaned.match(/_(\d+)$/);
    
    if (match && match[1]) {
      return match[1];
    }
    
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

function getDocumentType(filename) {
  if (!Array.isArray(negoziData) || negoziData.length === 0) {
    console.warn('⚠️ negoziData vuoto, tutti i file saranno classificati come fatture');
    return 'fattura';
  }

  const normalizedFilename = filename
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const hasStoreName = negoziData.some(negozio => {
    if (!negozio || !negozio.nome) {
      return false;
    }
    
    const storeName = negozio.nome
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    const match = normalizedFilename.includes(storeName);
    
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

  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalFileContent, setOriginalFileContent] = useState('');
  const [hasErrorsFlag, setHasErrorsFlag] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // ✅ NUOVO: Stato per storico modifiche
  const [storicoModifiche, setStoricoModifiche] = useState(null);
  const [isModified, setIsModified] = useState(false);

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

      // ✅ NUOVO: Carica storico modifiche
      setStoricoModifiche(data.storicoModifiche || null);
      setIsModified(!!data.isModified);

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
        setStoricoModifiche(null);
        setIsModified(false);
      }
    } catch (e) {
      console.error('Errore download:', e);
      setError('Errore: ' + e.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const rowDownload = (filename) => downloadTxtFile(filename, { closePreviewAfter: false });

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

      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark p-3 flex flex-col md:flex-row gap-3 md:items-center">
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

      {error && (
        <div className="p-3 rounded-xl border bg-red-50 text-red-800 border-red-200">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30">{success}</div>
      )}

      <div className="text-sm text-fradiavolo-charcoal-light">
        Mostrati {filteredFiles.length} di {txtFiles.length} file
      </div>

      {/* ✅ TABELLA COMPATTATA: Rimosse colonne Dimensione e Modificato */}
      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-fradiavolo-cream">
              <tr className="text-left text-fradiavolo-charcoal">
                <th className="px-4 py-3">Nome file</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Codice Magazzino PV</th>
                <th className="px-4 py-3">Creato</th>
                <th className="px-4 py-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-fradiavolo-charcoal-light" colSpan={5}>
                    Caricamento...
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-fradiavolo-charcoal-light" colSpan={5}>
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
                      <td className="px-4 py-3 font-medium text-fradiavolo-charcoal flex items-center gap-2 flex-wrap">
                        <FileText className={`h-4 w-4 ${dangerRow ? 'text-red-600' : 'text-fradiavolo-red'}`} />
                        <span className="truncate max-w-[46ch]" title={f.name}>{f.name}</span>
                        {dangerRow && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            Errore segnalato
                          </span>
                        )}
                      </td>
                      
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
                      <td className="px-4 py-3 text-fradiavolo-charcoal-light">
                        {f.created ? new Date(f.created).toLocaleString('it-IT') : '-'}
                      </td>
                      
                      {/* ✅ AZIONI COMPATTATE: Icone inline invece di bottoni larghi */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => openPreview(f.name)}
                            className="p-2 rounded-lg hover:bg-fradiavolo-cream transition-colors"
                            title="Visualizza"
                          >
                            <Eye className="h-4 w-4 text-fradiavolo-charcoal" />
                          </button>
                          <button
                            onClick={() => rowDownload(f.name)}
                            className="p-2 rounded-lg hover:bg-fradiavolo-cream transition-colors"
                            title="Scarica"
                          >
                            <Download className="h-4 w-4 text-fradiavolo-red" />
                          </button>
                          <button
                            onClick={() => deleteFile(f.name)}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* ✅ MODALE PREVIEW AGGIORNATO con storico modifiche */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-4xl max-h-[90vh] border border-fradiavolo-cream-dark flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-fradiavolo-cream-dark flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText className={`h-5 w-5 ${hasErrorsFlag ? 'text-red-600' : 'text-fradiavolo-red'}`} />
                <div>
                  <h3 className="text-lg font-semibold text-fradiavolo-charcoal flex items-center gap-2">
                    {selectedFile}
                    {/* ✅ BADGE MODIFICATO */}
                    {isModified && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        <Clock className="h-3 w-3" />
                        Modificato
                      </span>
                    )}
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
                  setStoricoModifiche(null);
                  setIsModified(false);
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

                  {errorDetails?.errori_consegna && (
  <div className="p-4 rounded-lg border border-red-200 bg-red-50">
    <div className="flex items-center justify-between mb-3">
      <div className="font-semibold text-red-700 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Errori Segnalati alla Consegna
      </div>
      <span className="text-xs text-red-600">
        {new Date(errorDetails.errori_consegna.timestamp).toLocaleString('it-IT')}
      </span>
    </div>

    {/* Informazioni generali */}
    <div className="mb-3 p-3 bg-white rounded-lg border border-red-100">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-fradiavolo-charcoal-light">Data consegna:</span>
          <span className="ml-2 font-semibold text-fradiavolo-charcoal">
            {new Date(errorDetails.errori_consegna.data_consegna).toLocaleDateString('it-IT')}
          </span>
        </div>
        <div>
          <span className="text-fradiavolo-charcoal-light">Segnalato da:</span>
          <span className="ml-2 font-semibold text-fradiavolo-charcoal">
            {errorDetails.errori_consegna.utente}
          </span>
        </div>
        <div>
          <span className="text-fradiavolo-charcoal-light">Righe modificate:</span>
          <span className="ml-2 font-semibold text-red-700">
            {errorDetails.errori_consegna.righe_modificate || 0} / {errorDetails.errori_consegna.totale_righe || 0}
          </span>
        </div>
      </div>
    </div>

    {/* Modifiche ai prodotti */}
    {errorDetails.errori_consegna.modifiche && errorDetails.errori_consegna.modifiche.length > 0 && (
      <div className="mb-3">
        <div className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
          <Package className="h-4 w-4" />
          Modifiche ai Prodotti ({errorDetails.errori_consegna.modifiche.length})
        </div>
        <div className="space-y-2">
          {errorDetails.errori_consegna.modifiche.map((modifica, index) => (
            <div key={index} className="p-3 rounded-lg bg-white border border-red-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-fradiavolo-charcoal text-sm">
                    Riga {modifica.riga_numero}: {modifica.nome || modifica.prodotto_originale}
                  </div>
                  {modifica.codice && (
                    <div className="text-xs text-fradiavolo-charcoal-light mt-1">
                      Codice: {modifica.codice}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-2 rounded bg-red-50 border border-red-100">
                  <div className="text-xs text-fradiavolo-charcoal-light mb-1">Ordinato</div>
                  <div className="font-semibold text-sm text-fradiavolo-charcoal">
                    {modifica.quantita_originale} {modifica.unita_misura || ''}
                  </div>
                </div>
                <div className="p-2 rounded bg-green-50 border border-green-200">
                  <div className="text-xs text-fradiavolo-charcoal-light mb-1">Ricevuto</div>
                  <div className="font-semibold text-sm text-fradiavolo-green">
                    {modifica.quantita_ricevuta} {modifica.unita_misura || ''}
                  </div>
                </div>
              </div>

              {modifica.motivo && modifica.motivo.trim() !== '' && (
                <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                  <div className="text-xs font-semibold text-yellow-800 mb-1">Motivo:</div>
                  <div className="text-xs text-yellow-900 italic">{modifica.motivo}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Note testuali */}
    {errorDetails.errori_consegna.note_testuali && errorDetails.errori_consegna.note_testuali.trim() !== '' && (
      <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
        <div className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          Note Aggiuntive
        </div>
        <div className="text-sm text-yellow-900 whitespace-pre-wrap">
          {errorDetails.errori_consegna.note_testuali}
        </div>
      </div>
    )}
  </div>
)}

{/* ========================================= */}
{/* ERRORI LEGACY (backward compatibility) */}
{/* ========================================= */}
{errorDetails?.note_errori && !errorDetails?.errori_consegna && (
  <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-sm">
    <div className="font-semibold text-orange-700 mb-2 flex items-center gap-1">
      <AlertCircle className="h-4 w-4" />
      Errore segnalato in consegna (formato legacy)
    </div>
    <div className="text-orange-900">{errorDetails.note_errori}</div>
  </div>
)}

{errorDetails?.item_noconv && (
  <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-sm">
    <div className="font-semibold text-orange-700 mb-2 flex items-center gap-1">
      <AlertCircle className="h-4 w-4" />
      Errore di conversione (formato legacy)
    </div>
    <div className="text-orange-900">{errorDetails.item_noconv}</div>
  </div>
)}

                  {/* ✅ NUOVO: Box Storico Modifiche */}
{isModified && storicoModifiche && storicoModifiche.length > 0 && (
  <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
    <div className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
      <Clock className="h-5 w-5" />
      Storico Modifiche ({storicoModifiche.length})
    </div>
    <div className="space-y-3">
      {/* ✅ Ordina per timestamp decrescente (più recente prima) */}
      {[...storicoModifiche].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((modifica, index) => {
        // ✅ Gestione speciale per errori_consegna
        const isErroriConsegna = modifica.campo === 'errori_consegna';
        
        let displayValuePrev = modifica.valore_precedente || '---';
        let displayValueNew = modifica.valore_nuovo;
        
        if (isErroriConsegna) {
  try {
    // Parse del valore NUOVO
    const erroriNew = JSON.parse(modifica.valore_nuovo);
    const righeModificateNew = erroriNew.righe_modificate || 0;
    const totaleRigheNew = erroriNew.totale_righe || 0;
    const hasNoteNew = erroriNew.note_testuali && erroriNew.note_testuali.trim() !== '';
    
    displayValueNew = `✏️ ${righeModificateNew}/${totaleRigheNew} prodotti modificati${hasNoteNew ? ' + note testuali' : ''}`;
    
    // ✅ Parse del valore PRECEDENTE
    if (!modifica.valore_precedente || modifica.valore_precedente === '') {
      displayValuePrev = 'Nessun errore segnalato';
    } else {
      try {
        const erroriPrev = JSON.parse(modifica.valore_precedente);
        const righeModificatePrev = erroriPrev.righe_modificate || 0;
        const totaleRighePrev = erroriPrev.totale_righe || 0;
        const hasNotePrev = erroriPrev.note_testuali && erroriPrev.note_testuali.trim() !== '';
        
        displayValuePrev = `✏️ ${righeModificatePrev}/${totaleRighePrev} prodotti modificati${hasNotePrev ? ' + note testuali' : ''}`;
      } catch (prevParseError) {
        // Se il valore precedente non è un JSON valido, mostralo come testo
        displayValuePrev = 'Errori segnalati (formato legacy)';
      }
    }
  } catch (e) {
    console.error('Errore parsing errori_consegna nello storico:', e);
    displayValueNew = 'Errori segnalati (formato non leggibile)';
  }
}
        
        return (
          <div key={index} className="p-3 rounded-lg bg-white border border-blue-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">
                  Modifica #{storicoModifiche.length - index}
                </span>
              </div>
              <span className="text-xs text-blue-600">
                {modifica.data_modifica}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-fradiavolo-charcoal-light">Campo:</span>
                <span className={`font-semibold ${isErroriConsegna ? 'text-orange-600' : 'text-fradiavolo-charcoal'}`}>
                  {isErroriConsegna ? '⚠️ Errori Consegna' : modifica.campo}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-fradiavolo-charcoal-light">Da:</span>
                <span className="text-red-700 line-through">"{displayValuePrev}"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-fradiavolo-charcoal-light">A:</span>
                <span className={`font-semibold ${isErroriConsegna ? 'text-orange-600' : 'text-green-700'}`}>
                  "{displayValueNew}"
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-fradiavolo-charcoal-light">Modificato da:</span>
                <span className="text-fradiavolo-charcoal">{modifica.modificato_da}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

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
