// frontend/src/pages/admin/TxtFilesManager.js
import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Download, X, FileText, RefreshCw, Filter, Search } from 'lucide-react';
import negoziData from '../../data/negozi.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/** Trova l'ULTIMO gruppo di cifre nel filename (prima di .txt, ignorando _ERRORI)
 *  Esempi:
 *   - "FAT_123_2025-11-06_FORN_XYZ_117.txt"   -> "117"
 *   - "ABC_2025-11-06_136_ERRORI.txt"         -> "136"
 *   - "MOV_2025-11-06-MIISO-RMTRA-ALL.txt"    -> null (nessun codice numerico)
 */
function extractLastNumericCode(filename) {
  if (!filename) return null;
  let base = filename.replace(/\.txt$/i, '');
  base = base.replace(/_ERRORI$/i, '');
  // prendi TUTTE le occorrenze numeriche e scegli l'ultima
  const matches = [...base.matchAll(/\d+/g)].map(m => m[0]);
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

/** Prova a mappare il codice numerico al nome negozio usando negozi.json */
function mapCodeToStoreName(codeStr) {
  if (!codeStr) return null;
  // tenta su più campi possibili per robustezza
  const found = negoziData.find(n =>
    String(n.id ?? '') === codeStr ||
    String(n.codice_magazzino ?? '') === codeStr ||
    String(n.codice ?? '') === codeStr // nel caso in cui il json usi "codice" numerico
  );
  return found?.nome || null;
}

/** Estrae le info PV dal nome file secondo la nuova regola */
function extractStoreInfoFromFilename(filename) {
  const code = extractLastNumericCode(filename);
  const name = mapCodeToStoreName(code);
  const label = code ? (name ? `${code} – ${name}` : code) : '-';
  return { code: code || null, name: name || null, label };
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

  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('ALL'); // usa il "code" come value

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
        const storeInfo = extractStoreInfoFromFilename(f.name);
        return { ...f, storeInfo };
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

      const res = await fetch(`${API_BASE_URL}/txt-files/${encodeURIComponent(filename)}/content`, {
        headers: { Authorization: authHeader() }
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);

      const data = await res.json();
      setFileContent(data.content || '');
      setOriginalFileContent(data.content || '');
      setHasErrorsFlag(!!data.hasErrors);
      setErrorDetails(data.errorDetails || null);
    } catch (e) {
      console.error('Errore anteprima:', e);
      setError('Impossibile caricare il contenuto del file');
      setShowPreview(false);
      setSelectedFile(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Scarica -> elimina -> aggiorna UI
  const downloadTxtFile = async (filename, { closePreviewAfter = false } = {}) => {
    try {
      setError('');

      // 1) Scarico
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

      // 2) Elimino lato server
      const respDelete = await fetch(`${API_BASE_URL}/txt-files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() }
      });
      if (!respDelete.ok) {
        const t = await respDelete.text().catch(() => '');
        throw new Error(`Impossibile eliminare il file dopo il download: ${respDelete.status} ${t}`);
      }

      // 3) Aggiorno UI
      setTxtFiles(prev => prev.filter(f => f.name !== filename));
      setSuccess(`File "${filename}" scaricato ed eliminato.`);
      setTimeout(() => setSuccess(''), 3000);

      // 4) Chiudo modal se necessario
      if (closePreviewAfter) {
        setShowPreview(false);
        setSelectedFile(null);
        setFileContent('');
        setOriginalFileContent('');
        setHasErrorsFlag(false);
        setErrorDetails(null);
      }
    } catch (e) {
      console.error('Errore download/eliminazione:', e);
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

  // Opzioni filtro punto vendita (dai codici trovati)
  const storeOptions = useMemo(() => {
    const map = new Map(); // code -> label
    txtFiles.forEach(f => {
      const code = f.storeInfo?.code;
      const label = f.storeInfo?.label;
      if (code) map.set(code, label || code);
    });
    const arr = Array.from(map.entries())
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0]), 'it', { numeric: true, sensitivity: 'base' }))
      .map(([code, label]) => ({ code, label }));
    return [{ code: 'ALL', label: 'Tutti i punti vendita' }, ...arr];
  }, [txtFiles]);

  // Applica filtri (search + PV code)
  const filteredFiles = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    return txtFiles.filter(f => {
      const nameOk = !q || f.name.toLowerCase().includes(q);
      const code = f.storeInfo?.code || null;
      const storeOk = storeFilter === 'ALL' || (code && String(code) === String(storeFilter));
      return nameOk && storeOk;
    });
  }, [txtFiles, searchTerm, storeFilter]);

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
              placeholder="Es: MOV_2025-11-06, ..._117.txt"
              className="w-full border border-fradiavolo-cream-dark p-3 pr-9 rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            />
            <Search className="h-4 w-4 text-fradiavolo-charcoal-light absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Store filter (per codice numerico) */}
        <div className="w-full md:w-72">
          <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-1">Filtra per punto vendita</label>
          <div className="relative">
            <select
              value={storeFilter}
              onChange={(e)=>setStoreFilter(e.target.value)}
              className="w-full border border-fradiavolo-cream-dark p-3 pr-9 rounded-xl bg-white focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
            >
              {storeOptions.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
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
                <th className="px-4 py-3">Punto vendita</th>
                <th className="px-4 py-3">Dimensione</th>
                <th className="px-4 py-3">Creato</th>
                <th className="px-4 py-3">Modificato</th>
                <th className="px-4 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-fradiavolo-charcoal-light" colSpan={6}>
                    Caricamento...
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-fradiavolo-charcoal-light" colSpan={6}>
                    Nessun file TXT corrisponde ai filtri
                  </td>
                </tr>
              ) : (
                filteredFiles.map((f) => (
                  <tr key={f.name} className="border-t border-fradiavolo-cream-dark/50">
                    <td className="px-4 py-3 font-medium text-fradiavolo-charcoal flex items-center gap-2">
                      <FileText className="h-4 w-4 text-fradiavolo-red" />
                      <span className="truncate max-w-[46ch]" title={f.name}>{f.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-lg bg-fradiavolo-cream px-2 py-1 text-xs border border-fradiavolo-cream-dark">
                        {f.storeInfo?.label || '-'}
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
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          Visualizza
                        </button>
                        <button
                          onClick={() => rowDownload(f.name)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          Scarica
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-3xl border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-4 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-fradiavolo-red" />
                <div>
                  <h3 className="text-lg font-semibold text-fradiavolo-charcoal">
                    {selectedFile}
                  </h3>
                  {hasErrorsFlag && (
                    <p className="text-xs text-fradiavolo-orange">
                      ⚠️ Questo file contiene note di errore (suffix “_ERRORI”).
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
                }}
                className="p-2 rounded-lg hover:bg-fradiavolo-cream transition-colors"
              >
                <X className="h-5 w-5 text-fradiavolo-charcoal" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {isLoadingPreview ? (
                <div className="text-fradiavolo-charcoal-light text-sm">Caricamento contenuto...</div>
              ) : (
                <>
                  {errorDetails && (
                    <div className="p-3 rounded-lg border border-fradiavolo-orange/30 bg-fradiavolo-orange/10 text-sm">
                      <div className="font-semibold text-fradiavolo-red mb-1">Dettagli errore collegati:</div>
                      <div className="text-fradiavolo-charcoal">
                        <div><strong>Fornitore:</strong> {errorDetails.fornitore}</div>
                        <div><strong>Numero:</strong> {errorDetails.numero}</div>
                        <div><strong>Data consegna:</strong> {errorDetails.data_consegna}</div>
                        <div><strong>Confermato da:</strong> {errorDetails.confermato_da}</div>
                        <div className="mt-1"><strong>Note:</strong> {errorDetails.note_errori}</div>
                      </div>
                    </div>
                  )}
                  <div className="bg-fradiavolo-cream rounded-lg border border-fradiavolo-cream-dark p-3">
                    <pre className="text-xs text-fradiavolo-charcoal font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {fileContent || '(file vuoto)'}
                    </pre>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-fradiavolo-cream-dark flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 rounded-lg bg-fradiavolo-charcoal text-white hover:bg-fradiavolo-charcoal-light transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={() => downloadTxtFile(selectedFile, { closePreviewAfter: true })}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-fradiavolo-red text-white hover:bg-fradiavolo-red-dark transition-colors"
              >
                <Download className="h-4 w-4" />
                Scarica & Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TxtFilesManager;
