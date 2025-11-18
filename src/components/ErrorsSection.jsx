// frontend/src/components/ErrorsSection.jsx
import React from 'react';
import { AlertCircle, Package, FileText, Clock } from 'lucide-react';

/**
 * Componente per visualizzare gli errori di consegna di una fattura
 * Supporta sia il nuovo formato strutturato che i formati legacy
 */
const ErrorsSection = ({ errorDetails }) => {
  if (!errorDetails || Object.keys(errorDetails).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="mx-auto mb-2" size={48} />
        <p>Nessun errore segnalato per questa fattura</p>
      </div>
    );
  }

  // ✅ SUPPORTA ENTRAMBI I NOMI: errori_strutturati (nuovo) e errori_consegna (vecchio)
  const erroriStrutturati = errorDetails.errori_strutturati || errorDetails.errori_consegna;
  
  const hasStructuredErrors = erroriStrutturati && 
                               erroriStrutturati.modifiche && 
                               erroriStrutturati.modifiche.length > 0;
  
  const hasLegacyNotes = errorDetails.note_errori_legacy && 
                         errorDetails.note_errori_legacy.trim() !== '';
  
  const hasConversionErrors = errorDetails.errori_conversione_legacy && 
                              errorDetails.errori_conversione_legacy.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Header Sezione */}
      <div className="flex items-center gap-3 pb-3 border-b-2 border-red-500">
        <AlertCircle className="text-red-500" size={24} />
        <h3 className="text-lg font-semibold text-gray-800">
          Errori di Consegna Segnalati
        </h3>
      </div>

      {/* Informazioni Generali */}
      {errorDetails.data_consegna && (
        <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Data consegna</p>
            <p className="font-semibold text-gray-900">
              {new Date(errorDetails.data_consegna).toLocaleDateString('it-IT')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Confermato da</p>
            <p className="font-semibold text-gray-900">
              {errorDetails.confermato_da || 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* ✅ ERRORI STRUTTURATI (NUOVO FORMATO) */}
      {hasStructuredErrors && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-orange-600">
            <Package size={20} />
            <h4 className="font-semibold">
              Modifiche Prodotti ({erroriStrutturati.righe_modificate} su {erroriStrutturati.totale_righe})
            </h4>
          </div>

          {/* Timestamp segnalazione */}
          {erroriStrutturati.timestamp && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
              <Clock size={16} />
              <span>
                Segnalato il {new Date(erroriStrutturati.timestamp).toLocaleString('it-IT')}
                {erroriStrutturati.utente && ` da ${erroriStrutturati.utente}`}
              </span>
            </div>
          )}

          {/* Lista Modifiche */}
          <div className="space-y-3">
            {erroriStrutturati.modifiche.map((modifica, index) => (
              <div 
                key={index}
                className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header Prodotto */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      Riga {modifica.riga_numero}: {modifica.nome || modifica.prodotto_originale || 'Prodotto'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Codice: <span className="font-mono">{modifica.codice || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                {/* Quantità Ordinata vs Ricevuta */}
                <div className="grid grid-cols-2 gap-4 mt-3 bg-white p-3 rounded">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Ordinato</p>
                    <p className="text-lg font-bold text-gray-700">
                      {modifica.quantita_originale} {modifica.unita_misura || ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Ricevuto</p>
                    <p className="text-lg font-bold text-red-600">
                      {modifica.quantita_ricevuta} {modifica.unita_misura || ''}
                    </p>
                  </div>
                </div>

                {/* Motivo Modifica */}
                {modifica.motivo && modifica.motivo.trim() !== '' && (
                  <div className="mt-3 pt-3 border-t border-yellow-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Motivo:</span> {modifica.motivo}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Note Testuali Strutturate */}
          {erroriStrutturati.note_testuali && 
           erroriStrutturati.note_testuali.trim() !== '' && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <FileText className="text-green-600 flex-shrink-0 mt-1" size={20} />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Note Aggiuntive</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {erroriStrutturati.note_testuali}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ⚠️ ERRORI LEGACY (BACKWARD COMPATIBILITY) */}
      {hasLegacyNotes && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-orange-600 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">
                Note Errore (formato legacy)
              </h4>
              <p className="text-gray-700 whitespace-pre-wrap">
                {errorDetails.note_errori_legacy}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ ERRORI CONVERSIONE LEGACY */}
      {hasConversionErrors && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">
                Errore di Conversione
              </h4>
              <p className="text-gray-700 whitespace-pre-wrap">
                {errorDetails.errori_conversione_legacy}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messaggio se nessun formato trovato */}
      {!hasStructuredErrors && !hasLegacyNotes && !hasConversionErrors && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="mx-auto mb-2" size={48} />
          <p>Dati errore non disponibili o formato non riconosciuto</p>
        </div>
      )}
    </div>
  );
};

export default ErrorsSection;
