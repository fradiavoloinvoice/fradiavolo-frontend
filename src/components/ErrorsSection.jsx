// frontend/src/components/ErrorsSection.jsx
import { AlertCircle, Package, FileText, AlertTriangle } from 'lucide-react';

/**
 * Componente riutilizzabile per visualizzare gli errori di consegna
 * Gestisce 2 tipi di errori:
 * 1. errori_strutturati (nuovo formato JSON da errori_consegna)
 * 2. errori_conversione_legacy (item_noconv - colonna O)
 */
const ErrorsSection = ({ errorDetails }) => {
  console.log('🟢 ErrorsSection riceve:', errorDetails);

  if (!errorDetails) {
    console.log('🟢 errorDetails è null/undefined');
    return (
      <div className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl p-6 text-center">
        <AlertCircle className="mx-auto text-fradiavolo-charcoal-light mb-2" size={32} />
        <p className="text-sm text-fradiavolo-charcoal-light">Nessun errore disponibile</p>
      </div>
    );
  }

  // Parse errori se sono in formato stringa JSON
  let parsedErrors = errorDetails;
  if (typeof errorDetails === 'string') {
    try {
      parsedErrors = JSON.parse(errorDetails);
    } catch {
      // Se non è JSON valido, trattalo come nota testuale
      parsedErrors = { note_testuali: errorDetails };
    }
  }

  console.log('🟢 parsedErrors:', parsedErrors);

  // Estrai i diversi tipi di errori dalla struttura backend
  const {
    // Nuovo formato (dal backend endpoint /errors)
    errori_strutturati = null,
    errori_conversione_legacy = null,
    // Formato diretto (errori_consegna parsato)
    modifiche = [],
    note_testuali = ''
  } = parsedErrors;

  console.log('🟢 errori_strutturati:', errori_strutturati);
  console.log('🟢 errori_conversione_legacy:', errori_conversione_legacy);

  // Gestisci errori strutturati (possono essere dentro errori_strutturati o direttamente)
  const erroriStrutturati = errori_strutturati || (modifiche.length > 0 ? { modifiche, note_testuali } : null);
  const modificheProdotti = erroriStrutturati?.modifiche?.filter(m => m.modificato) || [];
  const noteTestuali = erroriStrutturati?.note_testuali || note_testuali || '';

  console.log('🟢 modificheProdotti:', modificheProdotti);
  console.log('🟢 noteTestuali:', noteTestuali);

  const hasAnyError = modificheProdotti.length > 0 ||
                      noteTestuali.trim() !== '' ||
                      errori_conversione_legacy;

  return (
    <div className="space-y-6">
      {/* ========== ERRORI DI CONVERSIONE (item_noconv - Colonna O) ========== */}
      {errori_conversione_legacy && errori_conversione_legacy.trim() !== '' && (
        <div className="bg-fradiavolo-orange/10 border border-fradiavolo-orange/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-fradiavolo-orange mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-fradiavolo-charcoal mb-2">Errori di Conversione</h4>
              <p className="text-xs text-fradiavolo-charcoal-light mb-3">
                Articoli non convertiti durante l'elaborazione del DDT
              </p>
              <pre className="bg-white border border-fradiavolo-cream-dark rounded-xl p-3 text-sm font-mono whitespace-pre-wrap text-fradiavolo-charcoal max-h-48 overflow-y-auto">
                {errori_conversione_legacy}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ========== ERRORI DI CONSEGNA - Note Testuali ========== */}
      {noteTestuali && noteTestuali.trim() !== '' && (
        <div className="bg-fradiavolo-cream border border-fradiavolo-cream-dark rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FileText className="text-fradiavolo-charcoal mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-fradiavolo-charcoal mb-2">Note Errori Consegna</h4>
              <p className="text-sm text-fradiavolo-charcoal-light whitespace-pre-wrap">{noteTestuali}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========== ERRORI DI CONSEGNA - Modifiche Prodotti ========== */}
      {modificheProdotti.length > 0 && (
        <div className="bg-fradiavolo-red/10 border border-fradiavolo-red/30 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-4">
            <Package className="text-fradiavolo-red mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-fradiavolo-charcoal">
                Prodotti con Discrepanze ({modificheProdotti.length})
              </h4>
              <p className="text-xs text-fradiavolo-charcoal-light mt-1">
                Quantità ordinate vs quantità ricevute alla consegna
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
                  className="bg-white border border-fradiavolo-cream-dark rounded-xl p-4"
                >
                  {/* Nome prodotto e codice */}
                  <div className="mb-3">
                    <p className="font-semibold text-fradiavolo-charcoal">{modifica.nome}</p>
                    <p className="text-xs text-fradiavolo-charcoal-light">
                      Codice: <span className="font-mono">{modifica.codice}</span> •
                      Riga: {modifica.riga_numero}
                    </p>
                  </div>

                  {/* Quantità */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-fradiavolo-charcoal-light mb-1">Ordinata</p>
                      <p className="font-semibold text-fradiavolo-charcoal">
                        {modifica.quantita_originale} {modifica.unita_misura}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-fradiavolo-charcoal-light mb-1">Ricevuta</p>
                      <p className="font-semibold text-fradiavolo-red">
                        {modifica.quantita_ricevuta} {modifica.unita_misura}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-fradiavolo-charcoal-light mb-1">Differenza</p>
                      <p className={`font-semibold ${isDifferenzaNegativa ? 'text-fradiavolo-red' : 'text-fradiavolo-orange'}`}>
                        {differenza > 0 ? '+' : ''}{differenza.toFixed(2)} {modifica.unita_misura}
                      </p>
                    </div>
                  </div>

                  {/* Badge Stato */}
                  <div className="mt-3 pt-3 border-t border-fradiavolo-cream-dark">
                    <span className={`
                      inline-block px-2.5 py-1 rounded-full text-xs font-semibold
                      ${isDifferenzaNegativa
                        ? 'bg-fradiavolo-red/20 text-fradiavolo-red'
                        : 'bg-fradiavolo-orange/20 text-fradiavolo-orange'
                      }
                    `}>
                      {isDifferenzaNegativa ? 'Quantità Mancante' : 'Quantità Eccedente'}
                    </span>
                  </div>

                  {/* Motivo (se presente) */}
                  {modifica.motivo && modifica.motivo.trim() !== '' && (
                    <div className="mt-3 pt-3 border-t border-fradiavolo-cream-dark">
                      <p className="text-xs text-fradiavolo-charcoal-light mb-1">Motivo:</p>
                      <p className="text-sm text-fradiavolo-charcoal">{modifica.motivo}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== NESSUN ERRORE TROVATO ========== */}
      {!hasAnyError && (
        <div className="bg-fradiavolo-cream/30 border border-fradiavolo-cream-dark rounded-xl p-6 text-center">
          <AlertCircle className="mx-auto text-fradiavolo-charcoal-light mb-2" size={32} />
          <p className="text-sm text-fradiavolo-charcoal-light">Nessun errore di consegna registrato</p>
        </div>
      )}
    </div>
  );
};

export default ErrorsSection;
