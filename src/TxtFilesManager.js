// frontend/src/pages/admin/TxtFilesManager.jsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Trash2, 
  Search, 
  RefreshCw, 
  Eye,
  X,
  Calendar,
  Package,
  Filter,
  AlertCircle,
  Loader2
} from 'lucide-react';
import ErrorsSection from './components/ErrorsSection';

/**
 * Gestione File TXT
 * Interfaccia semplificata per visualizzare, scaricare ed eliminare file TXT generati
 * ✨ AGGIORNATO: Visualizzazione errori segnalati nella modale dettaglio
 */
const API_BASE_URL = 'https://fradiavolo-backend.onrender.com/api';

const TxtFilesManager = () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Ricerca e filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterErrorsOnly, setFilterErrorsOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  
  // Modale visualizzazione file
  const [showFileContent, setShowFileContent] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  
  // ✨ NUOVO: Dettagli fattura ed errori
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [invoiceErrors, setInvoiceErrors] = useState(null);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);
  
  // Statistiche
  const [stats, setStats] = useState({
    total: 0,
    withErrors: 0,
    totalSize: 0,
    dates: []
  });

  // ==========================================
  // FETCH DATA
  // ==========================================
  useEffect(() => {
    fetchFiles();
  }, []);

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
      setFiles(data.files);
      
      // Calcola statistiche
      const withErrors = data.files.filter(f => f.name.includes('_ERRORI')).length;
      const totalSize = data.files.reduce((sum, f) => sum + f.size, 0);
      const uniqueDates = [...new Set(
        data.files
          .map(f => {
            const match = f.name.match(/(\d{4}-\d{2}-\d{2})/);
            return match ? match[1] : null;
          })
          .filter(Boolean)
      )].sort((a, b) => new Date(b) - new Date(a));
      
      setStats({
        total: data.files.length,
        withErrors,
        totalSize,
        dates: uniqueDates
      });
      
    } catch (err) {
      console.error('Errore fetch file:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✨ NUOVO: Estrai ID fattura dal nome file e carica dettagli
  const extractInvoiceIdFromFilename = (filename) => {
    // Cerca pattern nel nome file per estrarre info fattura
    // Esempio: "MARR_DDT123456_2024-01-15.txt" o "MARR_DDT123456_2024-01-15_ERRORI.txt"
    const match = filename.match(/([A-Z]+)_([A-Z0-9]+)_(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return {
        fornitore: match[1],
        numero: match[2],
        data: match[3]
      };
    }
    return null;
  };

  const fetchInvoiceDetails = async (file) => {
    setLoadingInvoiceDetails(true);
    
    try {
      const invoiceInfo = extractInvoiceIdFromFilename(file.name);
      
      if (!invoiceInfo) {
        console.warn('Impossibile estrarre info fattura dal nome file');
        setInvoiceDetails(null);
        setInvoiceErrors(null);
        return;
      }

      const token = localStorage.getItem('token');
      
      // Cerca fattura per numero e data
      const searchResponse = await fetch(
        `${API_BASE_URL}/admin/invoices?numero=${invoiceInfo.numero}&data=${invoiceInfo.data}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (!searchResponse.ok) {
        throw new Error('Fattura non trovata');
      }
      
      const searchData = await searchResponse.json();
      
      if (!searchData.data || searchData.data.length === 0) {
        console.warn('Nessuna fattura trovata per questo file');
        setInvoiceDetails(null);
        setInvoiceErrors(null);
        return;
      }
      
      const invoice = searchData.data[0];
      setInvoiceDetails(invoice);
      
      // Se la fattura ha errori, caricali
      if (invoice.has_errors) {
        const errorsResponse = await fetch(
          `${API_BASE_URL}/invoices/${invoice.id}/errors`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (errorsResponse.ok) {
          const errorsData = await errorsResponse.json();
          setInvoiceErrors(errorsData.errors);
        }
      } else {
        setInvoiceErrors(null);
      }
      
    } catch (err) {
      console.error('Errore caricamento dettagli fattura:', err);
      setInvoiceDetails(null);
      setInvoiceErrors(null);
    } finally {
      setLoadingInvoiceDetails(false);
    }
  };

  // ==========================================
  // FILTERING
  // ==========================================
  useEffect(() => {
    let filtered = [...files];

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(term)
      );
    }

    if (filterErrorsOnly) {
      filtered = filtered.filter(file => file.name.includes('_ERRORI'));
    }

    if (selectedDate) {
      filtered = filtered.filter(file => file.name.includes(selectedDate));
    }

    filtered.sort((a, b) => new Date(b.created) - new Date(a.created));

    setFilteredFiles(filtered);
  }, [files, searchTerm, filterErrorsOnly, selectedDate]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleViewFile = async (file) => {
    setSelectedFile(file);
    setShowFileContent(true);
    setLoadingContent(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/txt-files/${file.name}/content`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore caricamento contenuto');
      
      const data = await response.json();
      setFileContent(data.content);
      
      // ✨ NUOVO: Carica anche i dettagli della fattura ed errori
      await fetchInvoiceDetails(file);
      
    } catch (err) {
      console.error('Errore visualizzazione file:', err);
      alert('Impossibile visualizzare il file');
      setShowFileContent(false);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleDownloadFile = async (fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/txt-files/${fileName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore download file');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Errore download:', err);
      alert('Impossibile scaricare il file');
    }
  };

  const handleDeleteFile = async (fileName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il file "${fileName}"?\n\nVerrà creato un backup automatico.`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/txt-files/${fileName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore eliminazione file');
      
      alert('File eliminato con successo (backup creato)');
      fetchFiles();
    } catch (err) {
      console.error('Errore eliminazione:', err);
      alert('Impossibile eliminare il file');
    }
  };

  const handleDownloadByDate = async (date) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/txt-files/download-by-date/${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore download ZIP');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TXT_Files_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Errore download ZIP:', err);
      alert('Impossibile scaricare l\'archivio');
    }
  };

  const handleCloseModal = () => {
    setShowFileContent(false);
    setSelectedFile(null);
    setFileContent('');
    setInvoiceDetails(null);
    setInvoiceErrors(null);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterErrorsOnly(false);
    setSelectedDate('');
  };

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const hasErrors = (fileName) => fileName.includes('_ERRORI');

  // ==========================================
  // RENDER
  // ==========================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="animate-spin text-blue-500" size={48} />
        <span className="ml-3 text-gray-600 text-lg">Caricamento file TXT...</span>
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
          onClick={fetchFiles}
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
            <FileText className="text-blue-600" size={32} />
            Gestione File TXT
          </h1>
          <p className="text-gray-600 mt-1">
            Visualizza, scarica ed elimina i file TXT generati dal sistema
          </p>
        </div>
        
        <button
          onClick={fetchFiles}
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
              <p className="text-sm text-gray-600">Totale File</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Con Errori</p>
              <p className="text-2xl font-bold text-red-700">{stats.withErrors}</p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dimensione Totale</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatFileSize(stats.totalSize)}
              </p>
            </div>
            <Package className="text-green-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-gray-600" size={20} />
          <h3 className="font-semibold text-gray-900">Filtri</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cerca file
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome file, fornitore..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtra per data
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutte le date</option>
              {stats.dates.map(date => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString('it-IT')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterErrorsOnly}
                onChange={(e) => setFilterErrorsOnly(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Solo file con errori
              </span>
            </label>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleResetFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Resetta filtri
          </button>
        </div>
      </div>

      {/* Download per Data */}
      {stats.dates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Calendar size={20} />
            Download Archivi per Data
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.dates.slice(0, 10).map(date => (
              <button
                key={date}
                onClick={() => handleDownloadByDate(date)}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 transition-colors"
              >
                <Download size={14} />
                {new Date(date).toLocaleDateString('it-IT')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista File */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            Risultati: <span className="font-semibold text-gray-900">{filteredFiles.length}</span> file
          </p>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="mx-auto mb-3 text-gray-400" size={48} />
            <p className="text-lg font-medium">Nessun file trovato</p>
            <p className="text-sm mt-1">Prova a modificare i filtri di ricerca</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dimensione
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Creazione
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
                {filteredFiles.map((file) => (
                  <tr 
                    key={file.name}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <FileText 
                          className={hasErrors(file.name) ? 'text-red-500' : 'text-gray-400'} 
                          size={18} 
                        />
                        <span className="ml-2 text-sm font-medium text-gray-900 break-all">
                          {file.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {formatFileSize(file.size)}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(file.created).toLocaleDateString('it-IT')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(file.created).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {hasErrors(file.name) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle size={12} />
                          Con Errori
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          OK
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Visualizza contenuto"
                        >
                          <Eye size={18} />
                        </button>
                        
                        <button
                          onClick={() => handleDownloadFile(file.name)}
                          className="text-green-600 hover:text-green-900 transition-colors"
                          title="Scarica file"
                        >
                          <Download size={18} />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteFile(file.name)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Elimina file"
                        >
                          <Trash2 size={18} />
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

      {/* ✨ MODALE MIGLIORATA - Con Contenuto File + Errori */}
      {showFileContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="text-blue-600" size={24} />
                  {selectedFile?.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {formatFileSize(selectedFile?.size || 0)} • 
                  Creato il {selectedFile && new Date(selectedFile.created).toLocaleString('it-IT')}
                </p>
              </div>
              
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {/* Contenuto - Scrollabile */}
            <div className="flex-1 overflow-y-auto">
              {/* Contenuto File TXT */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contenuto File</h3>
                {loadingContent ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <span className="ml-3 text-gray-600">Caricamento contenuto...</span>
                  </div>
                ) : (
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {fileContent}
                  </pre>
                )}
              </div>

              {/* ✨ SEZIONE ERRORI SEGNALATI */}
              {hasErrors(selectedFile?.name) && (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={20} />
                    Errori Segnalati
                  </h3>
                  
                  {loadingInvoiceDetails ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                      <span className="ml-3 text-gray-600">Caricamento errori...</span>
                    </div>
                  ) : invoiceErrors ? (
                    <ErrorsSection errorDetails={invoiceErrors} />
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Impossibile recuperare i dettagli degli errori per questo file.
                        La fattura potrebbe non essere più presente nel sistema.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Azioni */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => handleDownloadFile(selectedFile?.name)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Download size={18} />
                Scarica
              </button>
              
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
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

export default TxtFilesManager;
