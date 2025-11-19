// frontend/src/components/HistorySection.jsx
import React from 'react';
import { Clock, User, Calendar } from 'lucide-react';

/**
 * Componente riutilizzabile per visualizzare la cronologia modifiche di una fattura
 * Mostra: timestamp, utente, tipo modifica, dettagli
 */
const HistorySection = ({ historyData }) => {
  if (!historyData || historyData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <Clock className="mx-auto text-gray-400 mb-2" size={32} />
        <p className="text-sm text-gray-600">Nessuna modifica registrata</p>
      </div>
    );
  }

  // Parse cronologia se è in formato stringa JSON
  let parsedHistory = historyData;
  if (typeof historyData === 'string') {
    try {
      parsedHistory = JSON.parse(historyData);
    } catch (err) {
      console.error('Errore parsing historyData:', err);
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Formato cronologia non valido
          </p>
        </div>
      );
    }
  }

  // Assicurati che sia un array
  const history = Array.isArray(parsedHistory) ? parsedHistory : [];

  // Ordina per timestamp (più recenti prima)
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Linea verticale timeline */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Eventi */}
        <div className="space-y-6">
          {sortedHistory.map((event, index) => (
            <div key={index} className="relative pl-10">
              {/* Dot timeline */}
              <div className="absolute left-0 top-1 w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow flex items-center justify-center">
                <Clock className="text-white" size={14} />
              </div>

              {/* Card evento */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                {/* Header evento */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {event.tipo === 'conferma' && '✅ Conferma Ricezione'}
                      {event.tipo === 'modifica' && '✏️ Modifica Dati'}
                      {event.tipo === 'segnalazione_errori' && '⚠️ Segnalazione Errori'}
                      {!event.tipo && '📝 Modifica Generica'}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {event.descrizione || 'Modifica effettuata'}
                    </p>
                  </div>

                  <span className="text-xs text-gray-500 whitespace-nowrap ml-3">
                    {new Date(event.timestamp).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Utente */}
                {event.utente && (
                  <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                    <User size={14} />
                    <span>Modificato da: <strong className="text-gray-900">{event.utente}</strong></span>
                  </div>
                )}

                {/* Dettagli modifiche prodotti */}
                {event.modifiche && event.modifiche.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Modifiche Prodotti:
                    </p>
                    <div className="space-y-2">
                      {event.modifiche
                        .filter(m => m.modificato)
                        .map((modifica, idx) => (
                          <div 
                            key={idx}
                            className="bg-gray-50 border border-gray-200 rounded p-2 text-xs"
                          >
                            <p className="font-medium text-gray-900">{modifica.nome}</p>
                            <p className="text-gray-600">
                              Codice: {modifica.codice} • Riga: {modifica.riga_numero}
                            </p>
                            <p className="text-gray-700 mt-1">
                              <span className="text-gray-600">Ordinata:</span> {modifica.quantita_originale} {modifica.unita_misura} → 
                              <span className="text-red-700 font-semibold"> Ricevuta:</span> {modifica.quantita_ricevuta} {modifica.unita_misura}
                            </p>
                            {modifica.motivo && (
                              <p className="text-gray-600 mt-1 italic">
                                Motivo: {modifica.motivo}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Note testuali */}
                {event.note_testuali && event.note_testuali.trim() !== '' && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Note:</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {event.note_testuali}
                    </p>
                  </div>
                )}

                {/* Stato precedente/nuovo (se disponibile) */}
                {event.stato_precedente && event.stato_nuovo && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-3 text-xs">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      {event.stato_precedente}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      {event.stato_nuovo}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer statistiche */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <Calendar size={16} />
          <span>
            <strong>{history.length}</strong> modifiche registrate • 
            Prima modifica: {history.length > 0 && new Date(
              history[history.length - 1].timestamp
            ).toLocaleDateString('it-IT')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HistorySection;
