// frontend/src/components/ErrorsSection.jsx
import React from 'react';
import { AlertCircle, Package, FileText } from 'lucide-react';

/**
 * Componente riutilizzabile per visualizzare gli errori di consegna
 * Mostra: note testuali + modifiche prodotti (quantità ordinate vs ricevute)
 */
const ErrorsSection = ({ errorDetails }) => {
  if (!errorDetails) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
        <p className="text-sm text-gray-600">Nessun errore disponibile</p>
      </div>
    );
  }

  // Parse errori se sono in formato stringa JSON
  let parsedErrors = errorDetails;
  if (typeof errorDetails === 'string') {
    try {
      parsedErrors = JSON.parse(errorDetails);
    } catch (err) {
      console.error('Errore parsing errorDetails:', err);
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Formato errori non valido
          </p>
        </div>
      );
    }
  }

  const { modifiche = [], note_testuali = '' } = parsedErrors;
  const modificheProdotti = modifiche.filter(m => m.modificato);

  return (
    <div className="space-y-6">
      {/* Note Testuali */}
      {note_testuali && note_testuali.trim() !== '' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="text-yellow-600 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900 mb-2">Note Errori</h4>
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">{note_testuali}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modifiche Prodotti */}
      {modificheProdotti.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <Package className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900">
                Prodotti con Discrepanze ({modificheProdotti.length})
              </h4>
              <p className="text-xs text-red-700 mt-1">
                Quantità ordinate vs quantità ricevute
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {modificheProdotti.map((modifica, index) => {
              const differenza = modifica.quantita_ricevuta - modifica.quantita_originale;
              const isDifferenzaNegativa = differenza < 0;

              return (
                <div
                  key={index}
                  className="bg-white border border-red-200 rounded-lg p-4"
                >
                  {/* Nome prodotto e codice */}
                  <div className="mb-3">
                    <p className="font-semibold text-gray-900">{modifica.nome}</p>
                    <p className="text-xs text-gray-600">
                      Codice: <span className="font-mono">{modifica.codice}</span> • 
                      Riga: {modifica.riga_numero}
                    </p>
                  </div>

                  {/* Quantità */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Ordinata</p>
                      <p className="font-semibold text-gray-900">
                        {modifica.quantita_originale} {modifica.unita_misura}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 mb-1">Ricevuta</p>
                      <p className="font-semibold text-red-700">
                        {modifica.quantita_ricevuta} {modifica.unita_misura}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 mb-1">Differenza</p>
                      <p className={`font-semibold ${isDifferenzaNegativa ? 'text-red-700' : 'text-orange-700'}`}>
                        {differenza > 0 ? '+' : ''}{differenza.toFixed(2)} {modifica.unita_misura}
                      </p>
                    </div>
                  </div>

                  {/* Badge Stato */}
                  <div className="mt-3 pt-3 border-t border-red-100">
                    <span className={`
                      inline-block px-2 py-1 rounded-full text-xs font-semibold
                      ${isDifferenzaNegativa 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-orange-100 text-orange-800'
                      }
                    `}>
                      {isDifferenzaNegativa ? '⚠️ Quantità Mancante' : '⚠️ Quantità Eccedente'}
                    </span>
                  </div>

                  {/* Motivo (se presente) */}
                  {modifica.motivo && modifica.motivo.trim() !== '' && (
                    <div className="mt-3 pt-3 border-t border-red-100">
                      <p className="text-xs text-gray-600 mb-1">Motivo:</p>
                      <p className="text-sm text-gray-900">{modifica.motivo}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nessun errore trovato */}
      {modificheProdotti.length === 0 && (!note_testuali || note_testuali.trim() === '') && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
          <p className="text-sm text-gray-600">Nessun errore di consegna registrato</p>
        </div>
      )}
    </div>
  );
};

export default ErrorsSection;
