// src/components/ErrorReportModal.jsx
import React, { useState, useEffect } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';

const ErrorReportModal = ({ invoice, onClose, onConfirm, isLoading, apiBaseUrl, token }) => {
  const [errorNotes, setErrorNotes] = useState('');
  const [parsedProducts, setParsedProducts] = useState([]);
  const [productErrors, setProductErrors] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ✅ Carica prodotti DDT
  useEffect(() => {
    const loadDDT = async () => {
      try {
        setLoadingProducts(true);
        
        const authHeader = token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
        
        const response = await fetch(
          `${apiBaseUrl}/invoices/${invoice.id}/parse-ddt`,
          {
            headers: { Authorization: authHeader }
          }
        );

        if (!response.ok) {
          throw new Error(`Errore ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.prodotti) {
          setParsedProducts(data.prodotti);
        } else {
          console.warn('Nessun prodotto trovato nel DDT');
          setParsedProducts([]);
        }
      } catch (error) {
        console.error('Errore caricamento DDT:', error);
        setParsedProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadDDT();
  }, [invoice.id, apiBaseUrl, token]);

  // ✅ Pre-carica errori esistenti se in modalità modifica
  useEffect(() => {
    if (invoice.existingErrors && invoice.isEditMode) {
      console.log('🔄 Pre-caricamento errori esistenti:', invoice.existingErrors);
      
      // Pre-compila note testuali
      if (invoice.existingErrors.note_testuali) {
        setErrorNotes(invoice.existingErrors.note_testuali); // ✅ FIXATO
      }
      
      // Pre-compila modifiche prodotti
      if (invoice.existingErrors.modifiche && Array.isArray(invoice.existingErrors.modifiche)) {
        // Aspetta che i prodotti siano caricati prima di applicare le modifiche
        if (parsedProducts.length > 0) {
          const newProductErrors = {};
          
          invoice.existingErrors.modifiche.forEach(modificaEsistente => {
            const prodotto = parsedProducts.find(
              p => p.riga_numero === modificaEsistente.riga_numero
            );
            
            if (prodotto) {
              newProductErrors[prodotto.riga_numero] = {
                modificato: true,
                quantita_originale: modificaEsistente.quantita_originale,
                quantita_ricevuta: modificaEsistente.quantita_ricevuta,
                motivo: modificaEsistente.motivo || ''
              };
            }
          });
          
          setProductErrors(newProductErrors);
          console.log('✅ Errori pre-caricati:', newProductErrors);
        }
      }
    }
  }, [invoice.existingErrors, invoice.isEditMode, parsedProducts]);

  const handleProductErrorToggle = (rigaNumero) => {
    setProductErrors(prev => ({
      ...prev,
      [rigaNumero]: prev[rigaNumero] ? null : {
        modificato: true,
        quantita_originale: parsedProducts.find(p => p.riga_numero === rigaNumero)?.quantita || 0,
        quantita_ricevuta: 0
      }
    }));
  };

  const handleQuantityChange = (rigaNumero, newQuantity) => {
    setProductErrors(prev => ({
      ...prev,
      [rigaNumero]: {
        ...prev[rigaNumero],
        quantita_ricevuta: parseFloat(newQuantity) || 0
      }
    }));
  };

  const handleSubmit = () => {
    const modifiche = parsedProducts.map(prodotto => ({
      riga_numero: prodotto.riga_numero,
      codice: prodotto.codice,
      nome: prodotto.nome,
      quantita_originale: prodotto.quantita,
      unita_misura: prodotto.um,
      modificato: !!productErrors[prodotto.riga_numero],
      quantita_ricevuta: productErrors[prodotto.riga_numero]?.quantita_ricevuta || prodotto.quantita
    }));

    onConfirm({
      modifiche_righe: modifiche,
      note_testuali: errorNotes
    });
  };

  const hasAnyError = Object.values(productErrors).some(e => e) || errorNotes.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-fradiavolo-cream-dark">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-fradiavolo-cream-dark sticky top-0 bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 sm:p-3 bg-fradiavolo-orange/20 rounded-2xl border border-fradiavolo-orange/30">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-fradiavolo-orange" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-fradiavolo-charcoal">Segnala Errori Consegna</h3>
              <p className="text-sm text-fradiavolo-charcoal-light">
                {invoice.fornitore} - <span className="text-fradiavolo-red font-medium">{invoice.numero}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-fradiavolo-charcoal hover:text-fradiavolo-red">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Lista prodotti */}
          {loadingProducts ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-red mx-auto mb-2"></div>
              <p className="text-sm text-fradiavolo-charcoal-light">Caricamento prodotti DDT...</p>
            </div>
          ) : parsedProducts.length > 0 ? (
            <div>
              <h4 className="font-semibold text-fradiavolo-charcoal mb-3">Prodotti nel DDT:</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parsedProducts.map((prodotto) => (
                  <div
                    key={prodotto.riga_numero}
                    className={`p-3 rounded-lg border transition-all ${
                      productErrors[prodotto.riga_numero]
                        ? 'bg-fradiavolo-orange/10 border-fradiavolo-orange/30'
                        : 'bg-fradiavolo-cream border-fradiavolo-cream-dark'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={!!productErrors[prodotto.riga_numero]}
                        onChange={() => handleProductErrorToggle(prodotto.riga_numero)}
                        className="mt-1 h-4 w-4 text-fradiavolo-red focus:ring-fradiavolo-red border-fradiavolo-cream-dark rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-fradiavolo-charcoal">
                          {prodotto.nome}
                        </p>
                        <p className="text-xs text-fradiavolo-charcoal-light">
                          Codice: {prodotto.codice} | Ordinati: {prodotto.quantita} {prodotto.um}
                        </p>
                        
                        {productErrors[prodotto.riga_numero] && (
                          <div className="mt-2 flex items-center space-x-2">
                            <label className="text-xs font-semibold text-fradiavolo-orange">
                              Quantità ricevuta:
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={productErrors[prodotto.riga_numero].quantita_ricevuta}
                              onChange={(e) => handleQuantityChange(prodotto.riga_numero, e.target.value)}
                              className="w-24 px-2 py-1 text-sm border border-fradiavolo-orange/30 rounded focus:ring-2 focus:ring-fradiavolo-orange"
                            />
                            <span className="text-xs text-fradiavolo-charcoal-light">{prodotto.um}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Note testuali */}
          <div>
            <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
              Note aggiuntive (opzionale):
            </label>
            <textarea
              value={errorNotes}
              onChange={(e) => setErrorNotes(e.target.value)}
              className="w-full px-3 sm:px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
              rows="3"
              placeholder="Es: Cliente assente, indirizzo errato, altro..."
            />
          </div>

          {/* Bottoni azione */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !hasAnyError}
              className="flex-1 px-4 sm:px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Conferma con Errori</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 sm:px-6 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
            >
              Annulla
            </button>
          </div>

          <p className="text-xs text-fradiavolo-charcoal-light text-center">
            📄 Un file TXT con suffisso "_ERRORI" verrà generato automaticamente
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorReportModal;
