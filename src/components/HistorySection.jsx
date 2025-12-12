// frontend/src/components/HistorySection.jsx
import React from 'react';
import { Clock, User, Calendar, Edit3, AlertTriangle, CheckCircle, Package } from 'lucide-react';

/**
 * Componente riutilizzabile per visualizzare la cronologia modifiche di una fattura
 * Supporta due formati:
 * 1. Oggetto con { modifiche: [...] } dal backend /history
 * 2. Array diretto dallo storico_modifiche
 */
const HistorySection = ({ historyData }) => {
  // Gestisci il caso in cui historyData è undefined/null
  if (!historyData) {
    return (
      <div className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl p-6 text-center">
        <Clock className="mx-auto text-fradiavolo-charcoal-light mb-2" size={32} />
        <p className="text-sm text-fradiavolo-charcoal-light">Nessuna modifica registrata</p>
      </div>
    );
  }

  // Estrai le modifiche dall'oggetto o usa direttamente l'array
  let modifiche = [];

  // Se è un oggetto con proprietà 'modifiche' (formato backend /history)
  if (historyData.modifiche && Array.isArray(historyData.modifiche)) {
    modifiche = historyData.modifiche;
  }
  // Se è un array diretto
  else if (Array.isArray(historyData)) {
    modifiche = historyData;
  }
  // Se è una stringa JSON
  else if (typeof historyData === 'string') {
    try {
      const parsed = JSON.parse(historyData);
      modifiche = Array.isArray(parsed) ? parsed : (parsed.modifiche || []);
    } catch (err) {
      console.error('Errore parsing historyData:', err);
      return (
        <div className="bg-fradiavolo-orange/10 border border-fradiavolo-orange/30 rounded-xl p-4">
          <p className="text-sm text-fradiavolo-orange">
            ⚠️ Formato cronologia non valido
          </p>
        </div>
      );
    }
  }

  // Se non ci sono modifiche
  if (modifiche.length === 0) {
    return (
      <div className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl p-6 text-center">
        <Clock className="mx-auto text-fradiavolo-charcoal-light mb-2" size={32} />
        <p className="text-sm text-fradiavolo-charcoal-light">Nessuna modifica registrata</p>
      </div>
    );
  }

  // Normalizza le modifiche per gestire entrambi i formati
  const history = modifiche.map(mod => {
    // Se ha campo 'valore_nuovo' e 'campo', è il formato storico_modifiche
    if (mod.campo && mod.valore_nuovo !== undefined) {
      // Prova a parsare il valore_nuovo se è JSON di errori_consegna
      let parsedValore = null;
      try {
        if (mod.valore_nuovo && mod.valore_nuovo.startsWith('{')) {
          parsedValore = JSON.parse(mod.valore_nuovo);
        }
      } catch { /* ignore */ }

      return {
        timestamp: mod.timestamp,
        tipo: mod.campo === 'errori_consegna' ? 'segnalazione_errori' : 'modifica',
        descrizione: `Modifica campo: ${mod.campo}`,
        utente: mod.modificato_da,
        data_modifica: mod.data_modifica,
        campo: mod.campo,
        valore_precedente: mod.valore_precedente,
        valore_nuovo: mod.valore_nuovo,
        // Se è un errore consegna parsato, estrai i dettagli
        modifiche: parsedValore?.modifiche || [],
        note_testuali: parsedValore?.note_testuali || '',
        data_consegna: parsedValore?.data_consegna
      };
    }
    // Altrimenti è già nel formato atteso
    return mod;
  });

  // Ordina per timestamp (più recenti prima)
  const sortedHistory = [...history].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Helper per ottenere icona e colore in base al tipo
  const getEventStyle = (tipo) => {
    switch (tipo) {
      case 'segnalazione_errori':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-fradiavolo-orange',
          title: 'Segnalazione Errori Consegna'
        };
      case 'conferma':
        return {
          icon: CheckCircle,
          bgColor: 'bg-fradiavolo-green',
          title: 'Conferma Ricezione'
        };
      case 'modifica':
        return {
          icon: Edit3,
          bgColor: 'bg-blue-500',
          title: 'Modifica Dati'
        };
      default:
        return {
          icon: Clock,
          bgColor: 'bg-fradiavolo-charcoal',
          title: 'Modifica Generica'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Linea verticale timeline */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-fradiavolo-cream-dark"></div>

        {/* Eventi */}
        <div className="space-y-6">
          {sortedHistory.map((event, index) => {
            const eventStyle = getEventStyle(event.tipo);
            const EventIcon = eventStyle.icon;

            return (
              <div key={index} className="relative pl-10">
                {/* Dot timeline */}
                <div className={`absolute left-0 top-1 w-8 h-8 ${eventStyle.bgColor} rounded-full border-4 border-white shadow flex items-center justify-center`}>
                  <EventIcon className="text-white" size={14} />
                </div>

                {/* Card evento */}
                <div className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4 shadow-fradiavolo">
                  {/* Header evento */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-fradiavolo-charcoal">
                        {eventStyle.title}
                      </h4>
                      {event.data_consegna && (
                        <p className="text-xs text-fradiavolo-charcoal-light mt-1">
                          Data consegna: {new Date(event.data_consegna).toLocaleDateString('it-IT')}
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-fradiavolo-charcoal-light whitespace-nowrap ml-3 bg-fradiavolo-cream px-2 py-1 rounded-lg">
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
                    <div className="flex items-center gap-2 mb-3 text-sm text-fradiavolo-charcoal-light">
                      <User size={14} />
                      <span>Modificato da: <strong className="text-fradiavolo-charcoal">{event.utente}</strong></span>
                    </div>
                  )}

                  {/* Dettagli modifiche prodotti */}
                  {event.modifiche && event.modifiche.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-fradiavolo-cream-dark">
                      <p className="text-xs font-semibold text-fradiavolo-charcoal mb-2 flex items-center gap-1">
                        <Package size={14} />
                        Prodotti con discrepanze ({event.modifiche.filter(m => m.modificato).length}):
                      </p>
                      <div className="space-y-2">
                        {event.modifiche
                          .filter(m => m.modificato)
                          .map((modifica, idx) => {
                            const differenza = modifica.quantita_ricevuta - modifica.quantita_originale;
                            const isDifferenzaNegativa = differenza < 0;

                            return (
                              <div
                                key={idx}
                                className="bg-fradiavolo-cream/50 border border-fradiavolo-cream-dark rounded-xl p-3 text-xs"
                              >
                                <p className="font-semibold text-fradiavolo-charcoal">{modifica.nome}</p>
                                <p className="text-fradiavolo-charcoal-light">
                                  Codice: <span className="font-mono">{modifica.codice}</span> • Riga: {modifica.riga_numero}
                                </p>
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-fradiavolo-charcoal">
                                    Ordinata: <strong>{modifica.quantita_originale}</strong> {modifica.unita_misura}
                                  </span>
                                  <span className="text-fradiavolo-charcoal-light">→</span>
                                  <span className="text-fradiavolo-red font-semibold">
                                    Ricevuta: {modifica.quantita_ricevuta} {modifica.unita_misura}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    isDifferenzaNegativa
                                      ? 'bg-fradiavolo-red/20 text-fradiavolo-red'
                                      : 'bg-fradiavolo-orange/20 text-fradiavolo-orange'
                                  }`}>
                                    {differenza > 0 ? '+' : ''}{differenza.toFixed(2)}
                                  </span>
                                </div>
                                {modifica.motivo && (
                                  <p className="text-fradiavolo-charcoal-light mt-2 italic">
                                    Motivo: {modifica.motivo}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Note testuali */}
                  {event.note_testuali && event.note_testuali.trim() !== '' && (
                    <div className="mt-3 pt-3 border-t border-fradiavolo-cream-dark">
                      <p className="text-xs font-semibold text-fradiavolo-charcoal mb-1">Note:</p>
                      <p className="text-sm text-fradiavolo-charcoal whitespace-pre-wrap bg-fradiavolo-cream/30 p-2 rounded-lg">
                        {event.note_testuali}
                      </p>
                    </div>
                  )}

                  {/* Stato precedente/nuovo (se disponibile) */}
                  {event.stato_precedente && event.stato_nuovo && (
                    <div className="mt-3 pt-3 border-t border-fradiavolo-cream-dark flex items-center gap-3 text-xs">
                      <span className="px-2 py-1 bg-fradiavolo-orange/20 text-fradiavolo-orange rounded-lg font-semibold">
                        {event.stato_precedente}
                      </span>
                      <span className="text-fradiavolo-charcoal-light">→</span>
                      <span className="px-2 py-1 bg-fradiavolo-green/20 text-fradiavolo-green rounded-lg font-semibold">
                        {event.stato_nuovo}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer statistiche */}
      <div className="bg-fradiavolo-cream border border-fradiavolo-cream-dark rounded-xl p-4 mt-6">
        <div className="flex items-center gap-2 text-sm text-fradiavolo-charcoal">
          <Calendar size={16} className="text-fradiavolo-red" />
          <span>
            <strong>{history.length}</strong> {history.length === 1 ? 'modifica registrata' : 'modifiche registrate'}
            {history.length > 0 && (
              <> • Prima modifica: {new Date(
                sortedHistory[sortedHistory.length - 1].timestamp
              ).toLocaleDateString('it-IT')}</>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HistorySection;
