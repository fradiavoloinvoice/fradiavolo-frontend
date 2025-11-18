// frontend/src/components/InvoiceDetailModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Package, 
  Calendar, 
  User, 
  Building2, 
  AlertCircle, 
  Clock, 
  Download,
  ExternalLink,
  Loader2
} from 'lucide-react';
import ErrorsSection from './ErrorsSection';
import HistorySection from './HistorySection';

/**
 * Modale completa per visualizzare tutti i dettagli di una fattura
 * Include: Info generali, Errori, Cronologia, File TXT
 */
const InvoiceDetailModal = ({ invoice, onClose }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [errorsData, setErrorsData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Carica errori quando si apre il tab
  useEffect(() => {
    if (activeTab === 'errors' && !errorsData && invoice.has_errors) {
      fetchErrors();
    }
  }, [activeTab, invoice.id]);

  // Carica cronologia quando si apre il tab
  useEffect(() => {
    if (activeTab === 'history' && !historyData && invoice.has_history) {
      fetchHistory();
    }
  }, [activeTab, invoice.id]);

  const fetchErrors = async () => {
    setLoadingErrors(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/invoices/${invoice.id}/errors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore caricamento errori');
      
      const data = await response.json();
      setErrorsData(data.errors);
    } catch (error) {
      console.error('Errore fetch errori:', error);
    } finally {
      setLoadingErrors(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/invoices/${invoice.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore caricamento cronologia');
      
      const data = await response.json();
      setHistoryData(data.history);
    } catch (error) {
      console.error('Errore fetch cronologia:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Informazioni', icon: FileText },
    { 
      id: 'errors', 
      label: 'Errori', 
      icon: AlertCircle, 
      badge: invoice.has_errors,
      badgeColor: 'bg-red-500'
    },
    { 
      id: 'history', 
      label: 'Cronologia', 
      icon: Clock, 
      badge: invoice.has_history,
      badgeCount: invoice.history_count,
      badgeColor: 'bg-blue-500'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header Modale */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="text-blue-600" size={28} />
              Fattura #{invoice.numero}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {invoice.fornitore} • {invoice.punto_vendita}
            </p>
          </div>

          {/* Pulsante Chiudi */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Chiudi"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2
                  ${activeTab === tab.id 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                
                {/* Badge indicatore */}
                {tab.badge && (
                  <span className={`
                    ${tab.badgeColor} text-white text-xs px-2 py-0.5 rounded-full font-semibold
                  `}>
                    {tab.badgeCount || '!'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contenuto Tab */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB: Informazioni Generali */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Informazioni Base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                      <FileText size={16} />
                      Numero Documento
                    </label>
                    <p className="text-lg font-semibold text-gray-900">{invoice.numero}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                      <Building2 size={16} />
                      Fornitore
                    </label>
                    <p className="text-lg font-semibold text-gray-900">{invoice.fornitore}</p>
                    {invoice.codice_fornitore && (
                      <p className="text-sm text-gray-500">Codice: {invoice.codice_fornitore}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                      <Package size={16} />
                      Punto Vendita
                    </label>
                    <p className="text-lg font-semibold text-gray-900">{invoice.punto_vendita}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                      <Calendar size={16} />
                      Data Emissione
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(invoice.data_emissione).toLocaleDateString('it-IT')}
                    </p>
                  </div>

                  {invoice.data_consegna && (
                    <div>
                      <label className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                        <Calendar size={16} />
                        Data Consegna
                      </label>
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(invoice.data_consegna).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  )}

                  {invoice.confermato_da && (
                    <div>
                      <label className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                        <User size={16} />
                        Confermato da
                      </label>
                      <p className="text-lg font-semibold text-gray-900">{invoice.confermato_da}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Stato</label>
                    <span className={`
                      inline-block px-3 py-1 rounded-full text-sm font-semibold
                      ${invoice.stato === 'consegnato' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                      }
                    `}>
                      {invoice.stato === 'consegnato' ? 'Consegnato' : 'Da Confermare'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Link PDF */}
              {invoice.pdf_link && invoice.pdf_link !== '#' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <a 
                    href={invoice.pdf_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <ExternalLink size={18} />
                    Visualizza PDF Originale
                  </a>
                </div>
              )}

              {/* Indicatori Errori/Modifiche */}
              <div className="grid grid-cols-2 gap-4">
                {invoice.has_errors && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle size={20} />
                      <span className="font-semibold">Errori Presenti</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      Questa fattura ha errori di consegna segnalati
                    </p>
                  </div>
                )}

                {invoice.has_history && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Clock size={20} />
                      <span className="font-semibold">Modifiche Registrate</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {invoice.history_count} modifiche nella cronologia
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Errori */}
          {activeTab === 'errors' && (
            <div>
              {loadingErrors ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-blue-500" size={48} />
                  <span className="ml-3 text-gray-600">Caricamento errori...</span>
                </div>
              ) : (
                <ErrorsSection errorDetails={errorsData} />
              )}
            </div>
          )}

          {/* TAB: Cronologia */}
          {activeTab === 'history' && (
            <div>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-blue-500" size={48} />
                  <span className="ml-3 text-gray-600">Caricamento cronologia...</span>
                </div>
              ) : (
                <HistorySection historyData={historyData} />
              )}
            </div>
          )}
        </div>

        {/* Footer Azioni */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;
