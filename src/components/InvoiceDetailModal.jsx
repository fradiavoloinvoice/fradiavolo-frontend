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
  ExternalLink,
  Loader2,
  CheckCircle,
  Truck,
  Hash,
  Info
} from 'lucide-react';
import ErrorsSection from './ErrorsSection';
import HistorySection from './HistorySection';

/**
 * Modale completa per visualizzare tutti i dettagli di una fattura
 * Include: Info generali, Errori, Cronologia, File TXT
 */
const InvoiceDetailModal = ({ invoice, onClose }) => {
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  const [activeTab, setActiveTab] = useState('info');
  const [errorsData, setErrorsData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Carica errori quando si apre il tab (sempre, non solo se has_errors)
  useEffect(() => {
    if (activeTab === 'errors' && !errorsData) {
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
    console.log('🔴 FETCH ERRORS CHIAMATO per fattura ID:', invoice.id);
    setLoadingErrors(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${API_URL}/invoices/${invoice.id}/errors`;
      console.log('🔴 Chiamando URL:', url);
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Errore caricamento errori');

      const data = await response.json();
      console.log('🔴 Dati errori ricevuti:', data);
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
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/history`, {
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
    { id: 'info', label: 'Informazioni', icon: Info },
    {
      id: 'errors',
      label: 'Errori',
      icon: AlertCircle,
      badge: invoice.has_errors,
      badgeColor: 'bg-fradiavolo-red'
    },
    {
      id: 'history',
      label: 'Cronologia',
      icon: Clock,
      badge: invoice.has_history,
      badgeCount: invoice.history_count,
      badgeColor: 'bg-fradiavolo-orange'
    }
  ];

  // Helper per formattare la data
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/D';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Helper per lo stato
  const getStatoStyle = (stato) => {
    switch (stato) {
      case 'consegnato':
        return {
          bg: 'bg-fradiavolo-green/20',
          text: 'text-fradiavolo-green',
          icon: CheckCircle,
          label: 'Consegnato'
        };
      case 'in_transito':
        return {
          bg: 'bg-fradiavolo-orange/20',
          text: 'text-fradiavolo-orange',
          icon: Truck,
          label: 'In Transito'
        };
      default:
        return {
          bg: 'bg-fradiavolo-cream',
          text: 'text-fradiavolo-charcoal',
          icon: Clock,
          label: 'Da Confermare'
        };
    }
  };

  const statoStyle = getStatoStyle(invoice.stato);
  const StatoIcon = statoStyle.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText size={28} />
                <h2 className="text-2xl font-bold">
                  Fattura #{invoice.numero}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
                <span className="flex items-center gap-1">
                  <Building2 size={14} />
                  {invoice.fornitore}
                </span>
                <span className="flex items-center gap-1">
                  <Package size={14} />
                  {invoice.punto_vendita}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(invoice.data_emissione)}
                </span>
              </div>
            </div>

            {/* Stato Badge */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${statoStyle.bg} ${statoStyle.text}`}>
                <StatoIcon size={14} />
                {statoStyle.label}
              </span>

              {/* Pulsante Chiudi */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Chiudi"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-fradiavolo-cream-dark bg-fradiavolo-cream/30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-6 py-4 font-medium text-sm transition-colors flex items-center gap-2
                  ${activeTab === tab.id
                    ? 'text-fradiavolo-red border-b-2 border-fradiavolo-red bg-white'
                    : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal hover:bg-fradiavolo-cream/50'
                  }
                `}
              >
                <Icon size={18} />
                <span>{tab.label}</span>

                {/* Badge indicatore */}
                {tab.badge && (
                  <span className={`${tab.badgeColor} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
                    {tab.badgeCount || '!'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contenuto Tab */}
        <div className="flex-1 overflow-y-auto p-6 bg-fradiavolo-cream/20">
          {/* TAB: Informazioni Generali */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Griglia Info Principali */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Colonna Sinistra */}
                <div className="space-y-4">
                  {/* Numero Documento */}
                  <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                    <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Hash size={12} />
                      Numero Documento
                    </label>
                    <p className="text-xl font-bold text-fradiavolo-charcoal">{invoice.numero}</p>
                  </div>

                  {/* Fornitore */}
                  <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                    <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Building2 size={12} />
                      Fornitore
                    </label>
                    <p className="text-lg font-semibold text-fradiavolo-charcoal">{invoice.fornitore}</p>
                    {invoice.codice_fornitore && (
                      <p className="text-sm text-fradiavolo-charcoal-light mt-1">
                        Codice: <span className="font-mono">{invoice.codice_fornitore}</span>
                      </p>
                    )}
                  </div>

                  {/* Punto Vendita */}
                  <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                    <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Package size={12} />
                      Punto Vendita
                    </label>
                    <p className="text-lg font-semibold text-fradiavolo-charcoal">{invoice.punto_vendita}</p>
                  </div>
                </div>

                {/* Colonna Destra */}
                <div className="space-y-4">
                  {/* Data Emissione */}
                  <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                    <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Calendar size={12} />
                      Data Emissione
                    </label>
                    <p className="text-lg font-semibold text-fradiavolo-charcoal">
                      {formatDate(invoice.data_emissione)}
                    </p>
                  </div>

                  {/* Data Consegna */}
                  {invoice.data_consegna && (
                    <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                      <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider flex items-center gap-2 mb-2">
                        <Truck size={12} />
                        Data Consegna
                      </label>
                      <p className="text-lg font-semibold text-fradiavolo-charcoal">
                        {formatDate(invoice.data_consegna)}
                      </p>
                    </div>
                  )}

                  {/* Confermato da */}
                  {invoice.confermato_da && (
                    <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                      <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider flex items-center gap-2 mb-2">
                        <User size={12} />
                        Confermato da
                      </label>
                      <p className="text-lg font-semibold text-fradiavolo-charcoal">{invoice.confermato_da}</p>
                    </div>
                  )}

                  {/* Stato */}
                  <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4">
                    <label className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wider mb-2 block">
                      Stato
                    </label>
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${statoStyle.bg} ${statoStyle.text}`}>
                      <StatoIcon size={16} />
                      {statoStyle.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Link PDF */}
              {invoice.pdf_link && invoice.pdf_link !== '#' && (
                <div className="bg-fradiavolo-cream/50 border border-fradiavolo-cream-dark rounded-xl p-4">
                  <a
                    href={invoice.pdf_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-fradiavolo-red hover:text-fradiavolo-red-dark font-medium transition-colors"
                  >
                    <div className="p-2 bg-fradiavolo-red/10 rounded-lg">
                      <ExternalLink size={20} className="text-fradiavolo-red" />
                    </div>
                    <div>
                      <p className="font-semibold">Visualizza PDF Originale</p>
                      <p className="text-xs text-fradiavolo-charcoal-light">Apri in una nuova scheda</p>
                    </div>
                  </a>
                </div>
              )}

              {/* Indicatori Errori/Modifiche */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invoice.has_errors && (
                  <div
                    className="bg-fradiavolo-red/10 border border-fradiavolo-red/30 rounded-xl p-4 cursor-pointer hover:bg-fradiavolo-red/20 transition-colors"
                    onClick={() => setActiveTab('errors')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-fradiavolo-red/20 rounded-lg">
                        <AlertCircle size={20} className="text-fradiavolo-red" />
                      </div>
                      <div>
                        <p className="font-semibold text-fradiavolo-red">Errori Presenti</p>
                        <p className="text-sm text-fradiavolo-charcoal-light">
                          Questa fattura ha errori di consegna segnalati
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {invoice.has_history && (
                  <div
                    className="bg-fradiavolo-orange/10 border border-fradiavolo-orange/30 rounded-xl p-4 cursor-pointer hover:bg-fradiavolo-orange/20 transition-colors"
                    onClick={() => setActiveTab('history')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-fradiavolo-orange/20 rounded-lg">
                        <Clock size={20} className="text-fradiavolo-orange" />
                      </div>
                      <div>
                        <p className="font-semibold text-fradiavolo-orange">Modifiche Registrate</p>
                        <p className="text-sm text-fradiavolo-charcoal-light">
                          {invoice.history_count} modifiche nella cronologia
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Errori */}
          {activeTab === 'errors' && (
            <div>
              {loadingErrors ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-fradiavolo-cream-dark rounded-full animate-pulse"></div>
                    <Loader2 className="absolute inset-0 m-auto animate-spin text-fradiavolo-red" size={32} />
                  </div>
                  <p className="mt-4 text-fradiavolo-charcoal font-medium">Caricamento errori...</p>
                </div>
              ) : errorsData ? (
                <ErrorsSection errorDetails={errorsData} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-fradiavolo-green/10 rounded-full mb-4">
                    <CheckCircle size={48} className="text-fradiavolo-green" />
                  </div>
                  <h3 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Nessun errore</h3>
                  <p className="text-fradiavolo-charcoal-light">Questa fattura non presenta errori di consegna</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: Cronologia */}
          {activeTab === 'history' && (
            <div>
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-fradiavolo-cream-dark rounded-full animate-pulse"></div>
                    <Loader2 className="absolute inset-0 m-auto animate-spin text-fradiavolo-orange" size={32} />
                  </div>
                  <p className="mt-4 text-fradiavolo-charcoal font-medium">Caricamento cronologia...</p>
                </div>
              ) : !invoice.has_history ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-fradiavolo-cream rounded-full mb-4">
                    <Clock size={48} className="text-fradiavolo-charcoal-light" />
                  </div>
                  <h3 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Nessuna modifica</h3>
                  <p className="text-fradiavolo-charcoal-light">Non ci sono modifiche registrate per questa fattura</p>
                </div>
              ) : (
                <HistorySection historyData={historyData} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-fradiavolo-cream-dark bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-fradiavolo-cream hover:bg-fradiavolo-cream-dark text-fradiavolo-charcoal rounded-xl font-medium transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;
