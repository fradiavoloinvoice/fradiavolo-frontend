import React, { useState, useEffect } from 'react';
import { AlertCircle, FileText, Download, RefreshCw, Calendar, HardDrive, Package, Truck, Eye, 
  Filter, Edit3, Save, X, RotateCcw, ChevronDown, ChevronUp, Archive } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const TxtFilesManager = ({ user }) => {
  const [txtFiles, setTxtFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileErrorFilter, setFileErrorFilter] = useState('all'); // 'all', 'normal', 'errors'

  
  // Filtri
  const [fileTypeFilter, setFileTypeFilter] = useState('all'); // 'all', 'fatture', 'movimentazioni'
  const [dateFilter, setDateFilter] = useState(''); // Data specifica YYYY-MM-DD
  const [storeCodeFilter, setStoreCodeFilter] = useState(''); // Codice negozio
  const [supplierFilter, setSupplierFilter] = useState(''); // Fornitore
  const [documentNumberFilter, setDocumentNumberFilter] = useState(''); // Numero documento
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Stati per i dropdown dei filtri
  const [availableDates, setAvailableDates] = useState([]);
  const [availableStoreCodes, setAvailableStoreCodes] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [availableDocumentNumbers, setAvailableDocumentNumbers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalFileContent, setOriginalFileContent] = useState(''); // Per il reset
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isMergingFiles, setIsMergingFiles] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);

  // Conta filtri attivi
  const activeFiltersCount = [
    dateFilter, 
    storeCodeFilter, 
    supplierFilter, 
    documentNumberFilter,
    fileErrorFilter !== 'all' ? fileErrorFilter : ''
  ].filter(f => f !== '').length + (fileTypeFilter !== 'all' ? 1 : 0);

  // Carica la lista dei file TXT
  const loadTxtFiles = async () => {
    try {
      setIsLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/txt-files`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      console.log('File TXT caricati:', data.files);
      
      // PARSING con rilevamento errori
      const filesWithType = data.files.map(file => {
        // Rileva se il file ha errori dal nome
        const hasErrors = file.name.includes('_ERRORI');
        
        let parsedData = {
          type: file.name.startsWith('MOV_') || file.name.startsWith('MOVIMENTO_') ? 'movimentazione' : 'fattura',
          icon: file.name.startsWith('MOV_') || file.name.startsWith('MOVIMENTO_') ? 'truck' : 'file',
          date: null,
          storeCode: null,
          supplier: null,
          documentNumber: null,
          hasErrors: hasErrors
        };

        if (file.name.startsWith('MOV_')) {
          // Formato movimentazioni: MOV_YYYY-MM-DD-CODICE_ORIGINE-CODICE_DESTINAZIONE-N.txt
          const nameParts = file.name.replace('.txt', '').split('-');
          if (nameParts.length >= 5) {
            parsedData.date = `${nameParts[1]}-${nameParts[2]}-${nameParts[3]}`;
            parsedData.storeCode = nameParts[4];
            parsedData.supplier = nameParts[5] || 'N/A';
          }
        } else if (file.name.startsWith('MOVIMENTO_')) {
          // Formato movimentazioni: MOVIMENTO_CODICE_TO_CODICE_YYYY-MM-DD_001.txt
          const parts = file.name.replace('.txt', '').split('_');
          if (parts.length >= 5) {
            parsedData.storeCode = parts[1];
            parsedData.supplier = parts[3];
            parsedData.date = parts[4];
          }
        } else {
          // Formato fatture: Nr.Doc.Fornitore_datadiEmissione_Nomefornitore_codicePV[_ERRORI].txt
          let fileName = file.name.replace('.txt', '');
          if (hasErrors) {
            fileName = fileName.replace('_ERRORI', ''); // Rimuovi _ERRORI per il parsing
          }
          
          const nameParts = fileName.split('_');
          if (nameParts.length >= 4) {
            parsedData.documentNumber = nameParts[0];
            parsedData.date = nameParts[1];
            parsedData.supplier = nameParts[2];
            parsedData.storeCode = nameParts[3];
          } else {
            // Fallback per formato vecchio
            if (nameParts.length >= 3) {
              parsedData.date = `${nameParts[0]}-${nameParts[1]}-${nameParts[2]}`;
              parsedData.storeCode = nameParts[3] || 'N/A';
              parsedData.supplier = nameParts[4] || 'N/A';
            }
          }
        }

        return {
          ...file,
          ...parsedData
        };
      });
      
      setTxtFiles(filesWithType);

      // Estrai valori unici per i filtri
      const dates = [...new Set(filesWithType.map(f => f.date).filter(d => d))].sort().reverse();
      const storeCodes = [...new Set(filesWithType.map(f => f.storeCode).filter(s => s && s !== 'N/A'))].sort();
      const suppliers = [...new Set(filesWithType.map(f => f.supplier).filter(s => s && s !== 'N/A'))].sort();
      const documentNumbers = [...new Set(filesWithType.filter(f => f.type === 'fattura').map(f => f.documentNumber).filter(d => d))].sort();
      
      setAvailableDates(dates);
      setAvailableStoreCodes(storeCodes);
      setAvailableSuppliers(suppliers);
      setAvailableDocumentNumbers(documentNumbers);
      
      // Log statistiche errori
      const errorFiles = filesWithType.filter(f => f.hasErrors);
      console.log('File con errori trovati:', errorFiles.length);
      
    } catch (error) {
      console.error('Errore caricamento file TXT:', error);
      setError('Errore nel caricamento dei file TXT: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtra i file in base ai filtri selezionati
  useEffect(() => {
    let filtered = [...txtFiles];
    
   // Filtro per tipo
    if (fileTypeFilter !== 'all') {
      if (fileTypeFilter === 'fatture') {
        filtered = filtered.filter(file => file.type === 'fattura');
      } else if (fileTypeFilter === 'movimentazioni') {
        filtered = filtered.filter(file => file.type === 'movimentazione');
      }
    }

    // Filtro per errori
    if (fileErrorFilter !== 'all') {
      if (fileErrorFilter === 'errors') {
        filtered = filtered.filter(file => file.hasErrors);
      } else if (fileErrorFilter === 'normal') {
        filtered = filtered.filter(file => !file.hasErrors);
      }
    }
    
    // Filtro per data
    if (dateFilter) {
      filtered = filtered.filter(file => file.date === dateFilter);
    }
    
    // Filtro per codice negozio
    if (storeCodeFilter) {
      filtered = filtered.filter(file => file.storeCode === storeCodeFilter);
    }
    
    // Filtro per fornitore
    if (supplierFilter) {
      filtered = filtered.filter(file => file.supplier === supplierFilter);
    }
    
    // Filtro per numero documento
    if (documentNumberFilter) {
      filtered = filtered.filter(file => file.documentNumber === documentNumberFilter);
    }
    
    setFilteredFiles(filtered);
    console.log('Filtri applicati:', { 
      totale: txtFiles.length, 
      filtrati: filtered.length,
      filtri: { fileTypeFilter, fileErrorFilter, dateFilter, storeCodeFilter, supplierFilter, documentNumberFilter }
    });
  }, [txtFiles, fileTypeFilter, fileErrorFilter, dateFilter, storeCodeFilter, supplierFilter, documentNumberFilter]);

  // Reset tutti i filtri
  const resetAllFilters = () => {
    setFileTypeFilter('all');
    setFileErrorFilter('all'); 
    setDateFilter('');
    setStoreCodeFilter('');
    setSupplierFilter('');
    setDocumentNumberFilter('');
  };

  // Accorpa e scarica tutti i file filtrati
  const mergeAndDownloadFiles = async () => {
    if (filteredFiles.length === 0) {
      setError('Nessun file da accorpare');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setIsMergingFiles(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      
      // Array per contenere tutte le righe del file finale
      let allLines = [];
      let successCount = 0;
      let failCount = 0;

      // Carica il contenuto di ogni file
      for (let i = 0; i < filteredFiles.length; i++) {
        const file = filteredFiles[i];
        
        try {
          console.log(`Caricando file ${i + 1}/${filteredFiles.length}: ${file.name}`);
          
          const response = await fetch(`${API_BASE_URL}/txt-files/${file.name}/content`, {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Errore ${response.status} per file ${file.name}`);
          }

          const data = await response.json();
          
          // Estrai le righe dal contenuto del file (assumendo formato CODICE ; QUANTITA)
          const lines = data.content.split('\n').filter(line => line.trim() !== '');
          
          // Filtra solo le righe che contengono il formato corretto (CODICE ; NUMERO)
          const validLines = lines.filter(line => {
            const trimmedLine = line.trim();
            // Controlla se la riga contiene il pattern: testo ; numero
            return trimmedLine.includes(';') && 
                   trimmedLine.split(';').length === 2 &&
                   !isNaN(parseFloat(trimmedLine.split(';')[1].trim()));
          });
          
          // Aggiungi le righe valide all'array
          allLines.push(...validLines);
          successCount++;
          
        } catch (fileError) {
          console.error(`Errore caricamento ${file.name}:`, fileError);
          failCount++;
          
          // Aggiungi una riga di commento per il file con errore
          allLines.push(`// ERRORE: Impossibile caricare ${file.name} - ${fileError.message}`);
        }
      }

      // Crea il contenuto finale nel formato richiesto
      const now = new Date();
      
      // Genera il nome del file unificato
      let mergedFileName = '';
      if (activeFiltersCount > 0) {
        const filterParts = [];
        if (fileTypeFilter !== 'all') filterParts.push(fileTypeFilter.toUpperCase());
        if (fileErrorFilter !== 'all') filterParts.push(fileErrorFilter.toUpperCase());
        if (dateFilter) filterParts.push(dateFilter);
        if (storeCodeFilter) filterParts.push(storeCodeFilter);
        if (supplierFilter) filterParts.push(supplierFilter);
        if (documentNumberFilter) filterParts.push(documentNumberFilter);
        mergedFileName = `ACCORPATO_${filterParts.join('_')}_${now.toISOString().split('T')[0]}.txt`;
      } else {
        mergedFileName = `ACCORPATO_TUTTI_FILES_${now.toISOString().split('T')[0]}.txt`;
      }

      // Contenuto finale: solo le righe + riga vuota finale
      const finalContent = allLines.join('\n') + '\n';

      // Crea e scarica il file
      const blob = new Blob([finalContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mergedFileName;
      document.body.appendChild(a);
      a.click();
      
      // Pulisci
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Messaggio di successo
      const totalValidLines = allLines.filter(line => !line.startsWith('//')).length;
      if (failCount === 0) {
        setSuccess(`${successCount} file accorpati: ${totalValidLines} righe estratte e salvate in "${mergedFileName}"!`);
      } else {
        setSuccess(`File accorpato "${mergedFileName}": ${successCount} file OK, ${failCount} errori, ${totalValidLines} righe totali`);
      }
      
      setTimeout(() => setSuccess(''), 8000);

    } catch (error) {
      console.error('Errore accorpamento file:', error);
      setError('Errore nell\'accorpamento dei file: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsMergingFiles(false);
    }
  };

  // Scarica un file TXT specifico
  const downloadTxtFile = async (filename) => {
    try {
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/txt-files/${filename}`, {
        headers: {
          'Authorization': authHeader
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      // Crea un blob con il contenuto del file
      const blob = await response.blob();
      
      // Crea un URL temporaneo per il download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Pulisci
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess(`File "${filename}" scaricato con successo!`);
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Errore download file TXT:', error);
      setError('Errore nel download del file: ' + error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Visualizza anteprima file
  const previewTxtFile = async (filename) => {
    try {
      setError('');
      setIsLoading(true);
      setErrorDetails(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/txt-files/${filename}/content`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      setSelectedFile(filename);
      setFileContent(data.content);
      setOriginalFileContent(data.content); // Salva l'originale per il reset
      setShowPreview(true);
      setIsEditingFile(false); // Inizia sempre in modalità visualizzazione

      // Se il file contiene errori, salva i dettagli
      if (filename.includes('_ERRORI') && data.errorDetails) {
        setErrorDetails(data.errorDetails);
      } else {
        setErrorDetails(null);
      }
    } catch (error) {
      console.error('Errore caricamento anteprima:', error);
      setError('Errore nel caricamento dell\'anteprima: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Salva le modifiche al file
  const saveFileChanges = async () => {
    try {
      setIsSavingFile(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/txt-files/${selectedFile}/content`, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: fileContent })
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      setSuccess(`File "${selectedFile}" aggiornato con successo!`);
      setIsEditingFile(false);
      setOriginalFileContent(fileContent); // Aggiorna l'originale
      
      // Ricarica la lista dei file per aggiornare le dimensioni/date
      setTimeout(() => {
        loadTxtFiles();
        setSuccess('');
      }, 3000);

    } catch (error) {
      console.error('Errore salvataggio file:', error);
      setError('Errore nel salvataggio del file: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsSavingFile(false);
    }
  };

  // Annulla le modifiche
  const cancelFileEdit = () => {
    setFileContent(originalFileContent);
    setIsEditingFile(false);
  };

  // Chiudi il modal
  const closePreview = () => {
    setShowPreview(false);
    setSelectedFile(null);
    setFileContent('');
    setOriginalFileContent('');
    setIsEditingFile(false);
  };

  // Carica i file all'avvio del componente
  useEffect(() => {
    loadTxtFiles();
  }, []);

  // Formatta la dimensione del file
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatta la data
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Ottieni l'icona per il tipo di file
  const getFileIcon = (file) => {
    if (file.hasErrors) {
      return <AlertCircle className="h-6 w-6 text-fradiavolo-red" />;
    }
    return file.type === 'movimentazione' ? (
      <Truck className="h-6 w-6 text-fradiavolo-orange" />
    ) : (
      <FileText className="h-6 w-6 text-fradiavolo-charcoal" />
    );
  };

  // Ottieni il colore del badge per il tipo
  const getTypeBadgeColor = (type, hasErrors) => {
    if (hasErrors) {
      return 'bg-red-50 text-red-800 border-red-200';
    }
    return type === 'movimentazione' 
      ? 'bg-fradiavolo-orange/10 text-fradiavolo-orange border-fradiavolo-orange/30'
      : 'bg-fradiavolo-green/10 text-fradiavolo-green border-fradiavolo-green/30';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fradiavolo-charcoal mb-2">
            File TXT Generati
          </h1>
          <p className="text-fradiavolo-charcoal-light">
            File generati automaticamente dalle consegne e movimentazioni
          </p>
        </div>
        <button
          onClick={loadTxtFiles}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
          title="Ricarica lista file"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-sm">Aggiorna</span>
        </button>
      </div>

      {/* Filtri */}
      <div className="mb-6 bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo">
        {/* Filtri Base */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-fradiavolo-charcoal" />
              <span className="text-sm font-semibold text-fradiavolo-charcoal">Filtri</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-1 bg-fradiavolo-red text-white text-xs rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-xs text-fradiavolo-red hover:text-fradiavolo-red-dark transition-colors"
                >
                  Reset filtri
                </button>
              )}
            </div>
          </div>

          {/* Filtri Tipo (sempre visibili) */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFileTypeFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                fileTypeFilter === 'all'
                  ? 'bg-fradiavolo-red text-white'
                  : 'bg-fradiavolo-cream text-fradiavolo-charcoal hover:bg-fradiavolo-cream-dark'
              }`}
            >
              Tutti ({txtFiles.length})
            </button>
            <button
              onClick={() => setFileTypeFilter('fatture')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
                fileTypeFilter === 'fatture'
                  ? 'bg-fradiavolo-green text-white'
                  : 'bg-fradiavolo-cream text-fradiavolo-charcoal hover:bg-fradiavolo-cream-dark'
              }`}
            >
              <Package className="h-3 w-3" />
              <span>Fatture ({txtFiles.filter(f => f.type === 'fattura').length})</span>
            </button>
            <button
              onClick={() => setFileTypeFilter('movimentazioni')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
                fileTypeFilter === 'movimentazioni'
                  ? 'bg-fradiavolo-orange text-white'
                  : 'bg-fradiavolo-cream text-fradiavolo-charcoal hover:bg-fradiavolo-cream-dark'
              }`}
            >
              <Truck className="h-3 w-3" />
              <span>Movimentazioni ({txtFiles.filter(f => f.type === 'movimentazione').length})</span>
            </button>
          </div>

          {/* Filtri Avanzati */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-fradiavolo-cream-dark">
            {/* Filtro Data */}
            <div>
              <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                Data
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
              >
                <option value="">Tutte le date</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </option>
                ))}
              </select>
              {dateFilter && (
                <div className="text-xs text-fradiavolo-charcoal-light mt-1">
                  {txtFiles.filter(f => f.date === dateFilter).length} file trovati
                </div>
              )}
            </div>

            {/* Filtro Codice Negozio */}
            <div>
              <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                Codice PV
              </label>
              <select
                value={storeCodeFilter}
                onChange={(e) => setStoreCodeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
              >
                <option value="">Tutti i negozi</option>
                {availableStoreCodes.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              {storeCodeFilter && (
                <div className="text-xs text-fradiavolo-charcoal-light mt-1">
                  {txtFiles.filter(f => f.storeCode === storeCodeFilter).length} file trovati
                </div>
              )}
            </div>

            {/* Filtro Fornitore */}
            <div>
              <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                Fornitore
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
              >
                <option value="">Tutti i fornitori</option>
                {availableSuppliers.map(supplier => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
              {supplierFilter && (
                <div className="text-xs text-fradiavolo-charcoal-light mt-1">
                  {txtFiles.filter(f => f.supplier === supplierFilter).length} file trovati
                </div>
              )}
            </div>

            {/* Filtro Errori */}
            <div>
              <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                Status File
              </label>
              <select
                value={fileErrorFilter}
                onChange={(e) => setFileErrorFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
              >
                <option value="all">Tutti i file</option>
                <option value="normal">Solo normali</option>
                <option value="errors">Solo con errori</option>
              </select>
              {fileErrorFilter !== 'all' && (
                <div className="text-xs text-fradiavolo-charcoal-light mt-1">
                  {fileErrorFilter === 'errors' 
                    ? `${txtFiles.filter(f => f.hasErrors).length} file con errori`
                    : `${txtFiles.filter(f => !f.hasErrors).length} file normali`
                  }
                </div>
              )}
            </div>

            {/* Filtro Numero Documento (solo per fatture) */}
            {fileTypeFilter !== 'movimentazioni' && (
              <div>
                <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                  N° Documento
                </label>
                <select
                  value={documentNumberFilter}
                  onChange={(e) => setDocumentNumberFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                >
                  <option value="">Tutti i documenti</option>
                  {availableDocumentNumbers.map(docNum => (
                    <option key={docNum} value={docNum}>
                      {docNum}
                    </option>
                  ))}
                </select>
                {documentNumberFilter && (
                  <div className="text-xs text-fradiavolo-charcoal-light mt-1">
                    {txtFiles.filter(f => f.documentNumber === documentNumberFilter).length} file trovati
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Riepilogo filtri attivi */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-fradiavolo-cream-dark">
              <span className="text-xs text-fradiavolo-charcoal-light">Filtri attivi:</span>
              {fileTypeFilter !== 'all' && (
                <span className="px-2 py-1 bg-fradiavolo-red/10 text-fradiavolo-red text-xs rounded border border-fradiavolo-red/30">
                  Tipo: {fileTypeFilter}
                </span>
              )}
              {fileErrorFilter !== 'all' && (
                <span className="px-2 py-1 bg-fradiavolo-orange/10 text-fradiavolo-orange text-xs rounded border border-fradiavolo-orange/30">
                  Status: {fileErrorFilter === 'errors' ? 'Con errori' : 'Normali'}
                </span>
              )}
              {dateFilter && (
                <span className="px-2 py-1 bg-fradiavolo-green/10 text-fradiavolo-green text-xs rounded border border-fradiavolo-green/30">
                  Data: {new Date(dateFilter + 'T00:00:00').toLocaleDateString('it-IT')}
                </span>
              )}
              {storeCodeFilter && (
                <span className="px-2 py-1 bg-fradiavolo-orange/10 text-fradiavolo-orange text-xs rounded border border-fradiavolo-orange/30">
                  PV: {storeCodeFilter}
                </span>
              )}
              {supplierFilter && (
                <span className="px-2 py-1 bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal text-xs rounded border border-fradiavolo-charcoal/30">
                  Fornitore: {supplierFilter}
                </span>
              )}
              {documentNumberFilter && (
                <span className="px-2 py-1 bg-fradiavolo-blue/10 text-fradiavolo-blue text-xs rounded border border-fradiavolo-blue/30">
                  Doc: {documentNumberFilter}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 flex items-center space-x-3">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30 flex items-center space-x-3">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Lista File TXT */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-red"></div>
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento file...</h3>
          <p className="text-fradiavolo-charcoal-light">Recupero lista file TXT dal server</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
            <FileText className="h-10 w-10 text-fradiavolo-charcoal-light" />
          </div>
          <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">
            {fileTypeFilter === 'all' 
              ? 'Nessun file TXT trovato' 
              : `Nessun file di tipo "${fileTypeFilter}" trovato`
            }
          </h3>
          <p className="text-fradiavolo-charcoal-light text-lg">
            {fileTypeFilter === 'all' 
              ? 'I file TXT verranno generati automaticamente quando confermi le consegne o crei movimentazioni'
              : `I file TXT di tipo "${fileTypeFilter}" appariranno qui quando disponibili`
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark">
          <div className="p-6 border-b border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-fradiavolo-charcoal">
                File TXT Disponibili ({filteredFiles.length})
              </h2>
              <div className="flex items-center space-x-3">
                {/* Pulsante Accorpa e Scarica */}
                {filteredFiles.length > 1 && (
                  <button
                    onClick={mergeAndDownloadFiles}
                    disabled={isMergingFiles}
                    className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    title={`Accorpa tutti i ${filteredFiles.length} file filtrati in un unico file TXT`}
                  >
                    {isMergingFiles ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="text-sm">Accorpando...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4" />
                        <span className="text-sm">Accorpa e Scarica ({filteredFiles.length})</span>
                      </>
                    )}
                  </button>
                )}
                <div className="text-sm text-fradiavolo-charcoal-light">
                  Ordinati per data di creazione (più recenti prima)
                </div>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-fradiavolo-cream-dark">
            {filteredFiles.map((file, index) => (
              <div key={file.name} className="p-6 hover:bg-fradiavolo-cream/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className={`p-3 rounded-xl border ${
                      file.hasErrors 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-fradiavolo-cream border-fradiavolo-cream-dark'
                    }`}>
                      {getFileIcon(file)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-fradiavolo-charcoal truncate">
                          {file.name}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeBadgeColor(file.type, file.hasErrors)}`}>
                          {file.hasErrors && <AlertCircle className="h-3 w-3 inline mr-1" />}
                          {file.type === 'movimentazione' ? 'Movimentazione' : 'Fattura'}
                          {file.hasErrors && ' (ERRORI)'}
                        </span>
                      </div>
                      
                      {/* Badge errori prominente */}
                      {file.hasErrors && (
                        <div className="mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            CONSEGNA CON ERRORI - Dettagli nel file
                          </span>
                        </div>
                      )}
                      
                      {/* Informazioni estratte dal nome file */}
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        {file.date && (
                          <div className="flex items-center space-x-1 text-fradiavolo-green">
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">Data:</span>
                            <span>{new Date(file.date + 'T00:00:00').toLocaleDateString('it-IT')}</span>
                          </div>
                        )}
                        
                        {/* Per fatture: mostra numero documento */}
                        {file.type === 'fattura' && file.documentNumber && (
                          <div className="flex items-center space-x-1 text-fradiavolo-blue">
                            <FileText className="h-3 w-3" />
                            <span className="font-medium">Doc:</span>
                            <span>{file.documentNumber}</span>
                          </div>
                        )}
                        
                        {/* Per movimentazioni: mostra codice negozio */}
                        {file.type === 'movimentazione' && file.storeCode && file.storeCode !== 'N/A' && (
                          <div className="flex items-center space-x-1 text-fradiavolo-orange">
                            <Package className="h-3 w-3" />
                            <span className="font-medium">Origine:</span>
                            <span>{file.storeCode}</span>
                          </div>
                        )}
                        
                        {/* Per fatture: mostra codice punto vendita */}
                        {file.type === 'fattura' && file.storeCode && file.storeCode !== 'N/A' && (
                          <div className="flex items-center space-x-1 text-fradiavolo-orange">
                            <Package className="h-3 w-3" />
                            <span className="font-medium">PV:</span>
                            <span>{file.storeCode}</span>
                          </div>
                        )}
                        
                        {file.supplier && file.supplier !== 'N/A' && (
                          <div className="flex items-center space-x-1 text-fradiavolo-charcoal">
                            <Truck className="h-3 w-3" />
                            <span className="font-medium">
                              {file.type === 'movimentazione' ? 'Destinazione:' : 'Fornitore:'}
                            </span>
                            <span>{file.supplier}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-4 text-sm text-fradiavolo-charcoal-light">
                        <div className="flex items-center space-x-1">
                          <HardDrive className="h-4 w-4" />
                          <span>{formatFileSize(file.size)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Creato: {formatDate(file.created)}</span>
                        </div>
                      </div>
                      {file.modified !== file.created && (
                        <div className="mt-1 text-xs text-fradiavolo-charcoal-light">
                          Modificato: {formatDate(file.modified)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => previewTxtFile(file.name)}
                      className="flex items-center space-x-2 px-3 py-2 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl transition-all font-semibold shadow-lg transform hover:scale-105"
                      title={`Visualizza ${file.name}`}
                    >
                      <Eye className="h-4 w-4" />
                      <span>Visualizza</span>
                    </button>
                    <button
                      onClick={() => downloadTxtFile(file.name)}
                      className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-red hover:bg-fradiavolo-red-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg transform hover:scale-105"
                      title={`Scarica ${file.name}`}
                    >
                      <Download className="h-4 w-4" />
                      <span>Scarica</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informazioni aggiuntive */}
      {filteredFiles.length > 0 && (
        <div className="mt-6 bg-fradiavolo-cream/30 rounded-xl p-4 border border-fradiavolo-cream-dark">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-fradiavolo-cream rounded-lg">
              <svg className="h-5 w-5 text-fradiavolo-charcoal" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-fradiavolo-charcoal mb-2">Informazioni sui file TXT</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-semibold text-fradiavolo-charcoal mb-1">Formato nomi file:</h5>
                  <ul className="text-sm text-fradiavolo-charcoal-light space-y-1">
                    <li>• <strong>File Fatture:</strong> <code className="bg-white px-1 rounded text-fradiavolo-red text-xs">NumDoc_DatadiConsegna_NomeFornitore_CodicePV.txt</code></li>
                    <li>• <strong>File con Errori:</strong> <code className="bg-white px-1 rounded text-red-600 text-xs">NumDoc_DatadiConsegna_NomeFornitore_CodicePV_ERRORI.txt</code></li>
                    <li>• <strong>File Movimentazioni:</strong> <code className="bg-white px-1 rounded text-fradiavolo-orange text-xs">MOV_YYYY-MM-DD-ORIGINE-DESTINAZIONE-N.txt</code></li>
                  </ul>
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-fradiavolo-charcoal mb-1">Statistiche attuali:</h5>
                  <ul className="text-sm text-fradiavolo-charcoal-light space-y-1">
                    <li>• <strong>Totale file:</strong> {txtFiles.length}</li>
                    <li>• <strong>File visualizzati:</strong> {filteredFiles.length}</li>
                    <li>• <strong>File con errori:</strong> {txtFiles.filter(f => f.hasErrors).length}</li>
                    <li>• <strong>Date disponibili:</strong> {availableDates.length}</li>
                    <li>• <strong>Negozi coinvolti:</strong> {availableStoreCodes.length}</li>
                    <li>• <strong>Fornitori/Destinazioni:</strong> {availableSuppliers.length}</li>
                    {availableDocumentNumbers.length > 0 && (
                      <li>• <strong>Documenti fatture:</strong> {availableDocumentNumbers.length}</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="mt-3 text-sm text-fradiavolo-charcoal-light">
                <p><strong>Suggerimento:</strong> Il file accorpato conterrà solo le righe nel formato "CODICE ; QUANTITA" estratte da tutti i file filtrati.</p>
                {filteredFiles.length > 1 && (
                  <p className="mt-2"><strong>Accorpamento:</strong> Tutti i {filteredFiles.length} file filtrati verranno uniti in formato semplice: una riga per prodotto con codice e quantità.</p>
                )}
                {txtFiles.filter(f => f.hasErrors).length > 0 && (
                  <p className="mt-2 text-red-600"><strong>File con errori:</strong> I file contrassegnati con "_ERRORI" contengono un header con i dettagli degli errori segnalati durante la consegna.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Anteprima */}
      {showPreview && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-4xl max-h-[90vh] overflow-hidden border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${selectedFile.includes('_ERRORI') ? 'bg-red-50' : 'bg-fradiavolo-cream'}`}>
                  {selectedFile.includes('_ERRORI') ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-fradiavolo-charcoal" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">Anteprima File</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">{selectedFile}</p>
                  {selectedFile.includes('_ERRORI') && (
                    <p className="text-xs text-red-600 font-medium">File con errori di consegna</p>
                  )}
                </div>
              </div>
              <button
                onClick={closePreview}
                className="p-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-200px)]">
              {/* Sezione dettagli errori */}
              {selectedFile && selectedFile.includes('_ERRORI') && errorDetails && (
                <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50">
                  <h4 className="text-lg font-bold text-red-700 mb-2 flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    Dettagli Errori di Consegna
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-semibold text-fradiavolo-red">Note errori:</span>
                      <span className="ml-2 text-fradiavolo-charcoal italic">"{errorDetails.note_errori}"</span>
                    </div>
                    <div>
                      <span className="font-semibold text-fradiavolo-red">Data consegna:</span>
                      <span className="ml-2 text-fradiavolo-charcoal">{errorDetails.data_consegna ? new Date(errorDetails.data_consegna).toLocaleDateString('it-IT') : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-fradiavolo-red">Confermato da:</span>
                      <span className="ml-2 text-fradiavolo-charcoal">{errorDetails.confermato_da || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
              {isEditingFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-fradiavolo-charcoal flex items-center space-x-2">
                      <Edit3 className="h-4 w-4" />
                      <span>Modalità Modifica</span>
                    </h4>
                    <div className="text-sm text-fradiavolo-charcoal-light">
                      Modifica il contenuto e clicca "Salva" per confermare
                    </div>
                  </div>
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="w-full h-96 p-4 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors font-mono text-sm resize-none"
                    placeholder="Contenuto del file TXT..."
                  />
                  <div className="flex items-center justify-between text-sm text-fradiavolo-charcoal-light">
                    <span>Caratteri: {fileContent.length}</span>
                    <span>Righe: {fileContent.split('\n').length}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-fradiavolo-charcoal flex items-center space-x-2">
                      <Eye className="h-4 w-4" />
                      <span>Contenuto File</span>
                      {selectedFile.includes('_ERRORI') && (
                        <span className="text-red-600 text-sm">(Con errori di consegna)</span>
                      )}
                    </h4>
                    <button
                      onClick={() => setIsEditingFile(true)}
                      className="flex items-center space-x-1 px-3 py-1 bg-fradiavolo-orange text-white rounded-lg hover:bg-fradiavolo-gold transition-colors text-sm"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Modifica</span>
                    </button>
                  </div>
                  <div className="bg-fradiavolo-cream/30 p-4 rounded-lg border border-fradiavolo-cream-dark max-h-96 overflow-auto">
                    <pre className="text-sm text-fradiavolo-charcoal font-mono whitespace-pre-wrap">
                      {fileContent}
                    </pre>
                  </div>
                  <div className="flex items-center justify-between text-sm text-fradiavolo-charcoal-light">
                    <span>Caratteri: {fileContent.length}</span>
                    <span>Righe: {fileContent.split('\n').length}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center p-6 border-t border-fradiavolo-cream-dark">
              <div className="text-sm text-fradiavolo-charcoal-light">
                {isEditingFile ? (
                  <span className="flex items-center space-x-1 text-fradiavolo-orange">
                    <Edit3 className="h-3 w-3" />
                    <span>Modalità modifica attiva</span>
                  </span>
                ) : (
                  <span>Modalità sola lettura</span>
                )}
              </div>
              
              <div className="flex space-x-3">
                {isEditingFile ? (
                  <>
                    <button
                      onClick={cancelFileEdit}
                      className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
                      disabled={isSavingFile}
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Ripristina</span>
                    </button>
                    <button
                      onClick={saveFileChanges}
                      disabled={isSavingFile || fileContent === originalFileContent}
                      className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingFile ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Salva Modifiche</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => downloadTxtFile(selectedFile)}
                      className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-red hover:bg-fradiavolo-red-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg"
                    >
                      <Download className="h-4 w-4" />
                      <span>Scarica File</span>
                    </button>
                    <button
                      onClick={() => setIsEditingFile(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Modifica File</span>
                    </button>
                  </>
                )}
                
                <button
                  onClick={closePreview}
                  className="px-4 py-2 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
                  disabled={isSavingFile}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TxtFilesManager;