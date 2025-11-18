// frontend/src/components/HistorySection.jsx
import React from 'react';
import { Clock, User, ArrowRight, Edit3 } from 'lucide-react';

/**
 * Componente per visualizzare la cronologia delle modifiche di una fattura
 * Mostra tutte le modifiche in formato timeline
 */
const HistorySection = ({ historyData }) => {
  if (!historyData || !historyData.modifiche || historyData.modifiche.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="mx-auto mb-2" size={48} />
        <p>Nessuna modifica registrata per questa fattura</p>
      </div>
    );
  }

  // Mappa nomi campi user-friendly
  const fieldLabels = {
    data_consegna: 'Data di consegna',
    confermato_da: 'Confermato da',
    note: 'Note',
    stato: 'Stato',
    errori_consegna: 'Errori di consegna'
  };

  const getFieldLabel = (campo) => fieldLabels[campo] || campo;

  // Formatta valore per display
  const formatValue = (value, campo) => {
    if (!value || value === '') return '(vuoto)';
    
    // Formatta date
    if (campo === 'data_consegna') {
      try {
        return new Date(value).toLocaleDateString('it-IT');
      } catch {
        return value;
      }
    }
    
    // Limita lunghezza testi lunghi
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    
    return value;
  };

  return (
    <div className="space-y-6">
      {/* Header Sezione */}
      <div className="flex items-center gap-3 pb-3 border-b-2 border-blue-500">
        <Clock className="text-blue-500" size={24} />
        <h3 className="text-lg font-semibold text-gray-800">
          Cronologia Modifiche ({historyData.modifiche.length})
        </h3>
      </div>

      {/* Timeline Modifiche */}
      <div className="relative">
        {/* Linea verticale timeline */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {historyData.modifiche.map((modifica, index) => (
            <div key={index} className="relative pl-16">
              {/* Pallino timeline */}
              <div className="absolute left-3 top-3 w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-md flex items-center justify-center">
                <Edit3 size={12} className="text-white" />
              </div>

              {/* Card Modifica */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                {/* Header Card */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {getFieldLabel(modifica.campo)}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={14} />
                      <span>
                        {modifica.data_modifica || 
                         (modifica.timestamp ? new Date(modifica.timestamp).toLocaleDateString('it-IT') : 'N/A')}
                      </span>
                      {modifica.timestamp && (
                        <span className="text-xs text-gray-400">
                          • {new Date(modifica.timestamp).toLocaleTimeString('it-IT', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge utente */}
                  {modifica.modificato_da && (
                    <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      <User size={12} />
                      <span className="max-w-[150px] truncate">
                        {modifica.modificato_da}
                      </span>
                    </div>
                  )}
                </div>

                {/* Valore Precedente → Valore Nuovo */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                    {/* Valore Precedente */}
                    <div className="bg-white rounded p-3 border border-gray-200">
                      <p className="text-xs text-gray-500 uppercase mb-1">Prima</p>
                      <p className="text-sm font-medium text-gray-700 break-words">
                        {formatValue(modifica.valore_precedente, modifica.campo)}
                      </p>
                    </div>

                    {/* Freccia */}
                    <div className="flex justify-center">
                      <ArrowRight className="text-blue-500" size={20} />
                    </div>

                    {/* Valore Nuovo */}
                    <div className="bg-white rounded p-3 border-2 border-blue-200">
                      <p className="text-xs text-blue-600 uppercase mb-1">Dopo</p>
                      <p className="text-sm font-semibold text-gray-900 break-words">
                        {formatValue(modifica.valore_nuovo, modifica.campo)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Riepilogo */}
      <div className="bg-blue-50 rounded-lg p-4 text-center text-sm text-blue-700">
        <p>
          Totale modifiche registrate: <strong>{historyData.modifiche.length}</strong>
        </p>
      </div>
    </div>
  );
};

export default HistorySection;
