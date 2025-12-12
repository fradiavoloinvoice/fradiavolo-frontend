import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import {
  Camera, X, RotateCcw, FileText, Save, Plus, Trash2,
  RefreshCw, AlertCircle, Loader2, CheckCircle, Upload,
  MapPin, Building2, Package, Euro, Hash
} from 'lucide-react';

const SCANNER_STATES = {
  IDLE: 'idle',
  CAPTURING: 'capturing',
  PREVIEW: 'preview',
  PROCESSING: 'processing',
  RESULTS: 'results',
  ERROR: 'error'
};

// Helper per normalizzare unità di misura
const normalizeUM = (um) => {
  if (!um) return 'PZ';
  const mapping = {
    'PEZZI': 'PZ',
    'LITRI': 'LT',
    'CASSA': 'CS',
    'CASSE': 'CS',
    'BUSTA': 'BS',
    'BUSTE': 'BS',
    'MAZZO': 'MZ',
    'MAZZI': 'MZ',
    'GRAMMI': 'GR',
    'UNITA': 'UN',
    'SCATOLA': 'SC',
    'SCATOLE': 'SC',
    'CARTONE': 'CT',
    'CARTONI': 'CT',
    'COLLO': 'CL',
    'COLLI': 'CL'
  };
  return mapping[um.toUpperCase()] || um.toUpperCase();
};

// Parser DDT ottimizzato per template italiani (es. "Quelli che la Frutta")
const parseDDTText = (rawText) => {
  const result = {
    numero_ddt: '',
    data_ddt: '',
    fornitore: '',
    fornitore_piva: '',
    fornitore_indirizzo: '',
    destinatario: '',
    destinatario_piva: '',
    destinazione: '',
    destinazione_indirizzo: '',
    punto_vendita: '',
    prodotti: [],
    totale_imponibile: 0,
    totale_iva: 0,
    totale_documento: 0,
    causale: '',
    raw_text: rawText,
    confidence: 0
  };

  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // ========== 1. NUMERO DDT ==========
  const numPatterns = [
    // "Doc. di trasporto n. 12249 del"
    /(?:Doc\.?\s*(?:di\s+)?trasporto|D\.?D\.?T\.?|Documento)\s*n\.?\s*[°]?\s*(\d+)/i,
    // "n. 12249 del 09/12/2025"
    /\bn\.?\s*[°]?\s*(\d{4,6})\s+del\b/i,
    // "Numero: 12249" o "Nr. 12249"
    /(?:Numero|Nr\.?|N\.?)\s*[°:\s]*(\d{4,6})/i,
    // Fallback: sequenza di numeri lunga
    /\b(\d{5,}\/\d{2,4})\b/
  ];
  
  for (const pattern of numPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.numero_ddt = match[1].trim();
      break;
    }
  }

  // ========== 2. DATA DDT ==========
  const datePatterns = [
    // "del 09/12/2025"
    /del\s+(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    // "Data: 09/12/2025" o "Data 09/12/2025"
    /data[:\s]+(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    // "09/12/2025" vicino a "Doc" o "DDT"
    /(?:Doc|DDT|trasporto)[^\n]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{4})/i,
    // Fallback: prima data con anno 4 cifre
    /(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const parts = match[1].split(/[\-\/\.]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        result.data_ddt = `${year}-${month}-${day}`;
        break;
      }
    }
  }

  // ========== 3. FORNITORE (Header del documento) ==========
  // Il fornitore è tipicamente nelle prime righe, in maiuscolo, con forma societaria
  const fornitorePatterns = [
    // "QUELLI CHE LA FRUTTA ... SRL" - nome con forma societaria
    /^([A-Z][A-Z\s\.\,\&\']{3,50}(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?N\.?C\.?|S\.?A\.?S\.?|S\.?R\.?L\.?S\.?))/m,
    // Prima riga tutto maiuscolo significativa (almeno 8 caratteri)
    /^([A-Z][A-Z\s\.\,\&\']{7,50})\s*$/m
  ];
  
  // Cerca nelle prime 5 righe
  const headerLines = lines.slice(0, 8).join('\n');
  for (const pattern of fornitorePatterns) {
    const match = headerLines.match(pattern);
    if (match) {
      result.fornitore = match[1].replace(/\s+/g, ' ').replace(/\.\.\./g, '...').trim();
      break;
    }
  }

  // P.IVA Fornitore (tipicamente nel header, prima del destinatario)
  const pivaFornitoreMatch = text.match(/C\.?F\.?\s*[\/e]?\s*P\.?\s*I\.?[Vv]a\s*[:\s]*(\d{11})/);
  if (pivaFornitoreMatch) {
    result.fornitore_piva = pivaFornitoreMatch[1];
  }

  // Indirizzo fornitore (cerca Via/Piazza dopo il nome fornitore, nelle prime righe)
  const indirizzoFornitoreMatch = headerLines.match(/(Via|Piazza|Corso|Viale|V\.le|P\.za)[^\n]+[\d]{5}[^\n]*/i);
  if (indirizzoFornitoreMatch) {
    result.fornitore_indirizzo = indirizzoFornitoreMatch[0].trim();
  }

  // ========== 4. DESTINATARIO (chi riceve la fattura/merce) ==========
  // Pattern per blocco "Destinatario"
  const destBlockMatch = text.match(/Destinatario\s*\n?([\s\S]{10,200}?)(?=\n\s*(?:Destinazione|C\.?F\.?|P\.?\s*I\.?[Vv]a|$))/i);
  if (destBlockMatch) {
    const destBlock = destBlockMatch[1];
    // Estrai nome (prima riga significativa del blocco)
    const nomeMatch = destBlock.match(/([A-Z][A-Za-z\s\.]+(?:S\.?R\.?L\.?|S\.?P\.?A\.?)?)/);
    if (nomeMatch) {
      result.destinatario = nomeMatch[1].replace(/\s+/g, ' ').trim();
    }
  }

  // P.IVA Destinatario - cerca dopo "Destinatario" o con pattern C.F./P.Iva
  const pivaDestPatterns = [
    /Destinatario[\s\S]{0,200}C\.?F\.?\s*[\/e]?\s*P\.?\s*I\.?[Vv]a\s*[:\s]*(\d{11})/i,
    /C\.?F\.?\s*[\/e]?\s*P\.?\s*I\.?[Vv]a\s*(\d{11})(?![\s\S]*(?:Via|Piazza))/i
  ];
  for (const pattern of pivaDestPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== result.fornitore_piva) {
      result.destinatario_piva = match[1];
      break;
    }
  }

  // ========== 5. DESTINAZIONE (punto di consegna fisico) ==========
  const destConsegnaMatch = text.match(/Destinazione\s*\n?([\s\S]{10,200}?)(?=\n\s*(?:C\.?F\.?|P\.?\s*I\.?[Vv]a|Codice|$))/i);
  if (destConsegnaMatch) {
    const destBlock = destConsegnaMatch[1];
    
    // Estrai nome destinazione
    const nomeDestMatch = destBlock.match(/([A-Z][A-Za-z\s\.]+)/);
    if (nomeDestMatch) {
      result.destinazione = nomeDestMatch[1].replace(/\s+/g, ' ').trim();
    }
    
    // Estrai indirizzo
    const indirizzoMatch = destBlock.match(/((?:Via|Piazza|Corso|Viale|V\.le|P\.za)[^\n]+)/i);
    if (indirizzoMatch) {
      result.destinazione_indirizzo = indirizzoMatch[1].trim();
    }
    
    // Identifica punto vendita Fradiavolo
    if (/FRADIAVOLO|FRA\s*DIAVOLO/i.test(destBlock)) {
      result.punto_vendita = result.destinazione_indirizzo || result.destinazione;
    }
  }

  // ========== 6. CAUSALE TRASPORTO ==========
  const causaleMatch = text.match(/Causale\s*(?:del\s+)?trasporto\s*[:\s]*([A-Za-z\s]+?)(?:\s*Porto|\s*Franco|\n)/i);
  if (causaleMatch) {
    result.causale = causaleMatch[1].trim();
  } else {
    // Cerca "Vendita" come causale comune
    if (/Causale[\s\S]{0,50}Vendita/i.test(text)) {
      result.causale = 'Vendita';
    }
  }

  // ========== 7. PRODOTTI ==========
  // Trova l'area della tabella prodotti
  const tableStartPatterns = [
    /Codice\s+Descrizione/i,
    /Cod\.?\s+Descrizione/i,
    /Articolo\s+Descrizione/i
  ];
  
  let tableStartIndex = -1;
  for (const pattern of tableStartPatterns) {
    const match = text.search(pattern);
    if (match > -1) {
      tableStartIndex = match;
      break;
    }
  }
  
  const tableEndPatterns = [
    /Tot\.?\s*imponibile/i,
    /Totale\s+imponibile/i,
    /Totale\s+merce/i,
    /CONDIZIONI\s+DI\s+VENDITA/i
  ];
  
  let tableEndIndex = text.length;
  for (const pattern of tableEndPatterns) {
    const match = text.search(pattern);
    if (match > tableStartIndex) {
      tableEndIndex = match;
      break;
    }
  }
  
  const tableArea = tableStartIndex > -1 
    ? text.substring(tableStartIndex, tableEndIndex) 
    : text;
  
  const tableLines = tableArea.split('\n');
  
  // Pattern per righe prodotto - multipli per diversi formati
  const productLinePatterns = [
    // Pattern 1: V27 BASILICO PAD IT. 1 CS € 8,50 € 8,50
    // Codice alfanumerico | Descrizione | Quantità UM | Prezzo | Importo
    /^[V✓]?\s*(\d{1,5})\s+([A-Z][A-Za-z\s\.\/\d\,]+?)\s+(\d+[,.]?\d*)\s*(CS|KG|PZ|LT|CF|CT|NR|BS|MZ|GR|UN|SC|CL)\s+[€]?\s*(\d+[,.]?\d{2})\s*[€]?\s*(\d+[,.]?\d{2})?/i,
    
    // Pattern 2: Codice più lungo (es. ART001)
    /^([A-Z]{2,5}\d{2,6})\s+([A-Za-z\s\.\/\d\,]{5,45})\s+(\d+[,.]?\d*)\s*(CS|KG|PZ|LT|CF|CT|NR|BS|MZ|GR|UN|SC|CL)\s+[€]?\s*(\d+[,.]?\d{2})/i,
    
    // Pattern 3: Solo numerico con descrizione lunga
    /^(\d{4,8})\s+([A-Za-z\s\.\/\d\,]{5,50})\s+(\d+[,.]?\d*)\s*(CS|KG|PZ|LT|CF|CT|NR|BS|MZ|GR|UN|SC|CL)/i
  ];
  
  for (const line of tableLines) {
    // Salta header e righe corte
    if (/^(Codice|Cod\.|Descrizione|Quantità|Prezzo|Articolo)/i.test(line)) continue;
    if (line.length < 15) continue;
    
    // Prova ogni pattern
    for (const pattern of productLinePatterns) {
      const match = line.match(pattern);
      if (match) {
        const qty = parseFloat(match[3].replace(',', '.'));
        const prezzo = match[5] ? parseFloat(match[5].replace(',', '.')) : 0;
        const importo = match[6] 
          ? parseFloat(match[6].replace(',', '.')) 
          : (prezzo > 0 ? qty * prezzo : 0);
        
        if (!isNaN(qty) && qty > 0 && qty < 100000) {
          // Pulisci il codice (rimuovi simboli come ✓ o V iniziale se è checkmark)
          let codice = match[1].trim();
          if (/^\d+$/.test(codice) && codice.length <= 4) {
            codice = 'V' + codice; // Aggiungi V se è solo numerico (tipico di questo fornitore)
          }
          
          result.prodotti.push({
            riga: result.prodotti.length + 1,
            codice: codice,
            descrizione: match[2].trim().replace(/\s+/g, ' '),
            quantita: qty,
            unita_misura: normalizeUM(match[4]),
            prezzo_unitario: prezzo,
            importo: importo
          });
        }
        break; // Trovato match, passa alla riga successiva
      }
    }
  }

  // ========== 8. TOTALI ==========
  // Totale imponibile
  const totImponibilePatterns = [
    /Tot\.?\s*imponibile\s*[€]?\s*(\d+[,.]?\d{2})/i,
    /Totale\s+merce\s*[€]?\s*(\d+[,.]?\d{2})/i,
    /Imponibile\s*[€]?\s*(\d+[,.]?\d{2})/i
  ];
  for (const pattern of totImponibilePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.totale_imponibile = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }

  // Totale IVA
  const totIvaPatterns = [
    /Tot\.?\s*Iva\s*[€]?\s*(\d+[,.]?\d{2})/i,
    /IVA\s+\d+%?\s*[€]?\s*(\d+[,.]?\d{2})/i
  ];
  for (const pattern of totIvaPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.totale_iva = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }

  // Totale documento
  const totDocPatterns = [
    /Tot\.?\s*documento\s*[€]?\s*(\d+[,.]?\d{2})/i,
    /Totale\s+(?:da\s+)?pagare\s*[€]?\s*(\d+[,.]?\d{2})/i,
    /TOTALE\s*[€]?\s*(\d+[,.]?\d{2})\s*$/im
  ];
  for (const pattern of totDocPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.totale_documento = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }

  // ========== 9. CALCOLO CONFIDENCE ==========
  let score = 0;
  if (result.numero_ddt) score += 18;
  if (result.data_ddt) score += 12;
  if (result.fornitore) score += 15;
  if (result.destinatario) score += 10;
  if (result.destinazione) score += 10;
  if (result.prodotti.length > 0) score += 20;
  if (result.totale_documento > 0) score += 10;
  
  // Bonus: coerenza totali
  if (result.prodotti.length > 0 && result.totale_imponibile > 0) {
    const sumProdotti = result.prodotti.reduce((acc, p) => acc + (p.importo || 0), 0);
    const diff = Math.abs(sumProdotti - result.totale_imponibile);
    if (diff < 0.5) {
      score += 5; // Totali corrispondono esattamente
    } else if (diff < 2) {
      score += 3; // Piccola differenza (arrotondamenti)
    }
  }
  
  result.confidence = Math.min(score, 100);

  return result;
};

// Formatta numero come valuta
const formatCurrency = (value) => {
  if (!value && value !== 0) return '';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
};

const DDTScanner = ({ user }) => {
  const [state, setState] = useState(SCANNER_STATES.IDLE);
  const [capturedImage, setCapturedImage] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [showRawText, setShowRawText] = useState(false);

  // Form state con nuovi campi
  const [formData, setFormData] = useState({
    numero_ddt: '',
    data_ddt: '',
    fornitore: '',
    fornitore_piva: '',
    destinatario: '',
    destinatario_piva: '',
    destinazione: '',
    destinazione_indirizzo: '',
    punto_vendita: '',
    causale: '',
    prodotti: [],
    totale_imponibile: 0,
    totale_iva: 0,
    totale_documento: 0
  });

  // Camera refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update form when parsed data changes
  useEffect(() => {
    if (parsedData) {
      setFormData({
        numero_ddt: parsedData.numero_ddt || '',
        data_ddt: parsedData.data_ddt || '',
        fornitore: parsedData.fornitore || '',
        fornitore_piva: parsedData.fornitore_piva || '',
        destinatario: parsedData.destinatario || '',
        destinatario_piva: parsedData.destinatario_piva || '',
        destinazione: parsedData.destinazione || '',
        destinazione_indirizzo: parsedData.destinazione_indirizzo || '',
        punto_vendita: parsedData.punto_vendita || '',
        causale: parsedData.causale || '',
        prodotti: parsedData.prodotti || [],
        totale_imponibile: parsedData.totale_imponibile || 0,
        totale_iva: parsedData.totale_iva || 0,
        totale_documento: parsedData.totale_documento || 0
      });
    }
  }, [parsedData]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setState(SCANNER_STATES.CAPTURING);
    } catch (err) {
      console.error('Errore accesso camera:', err);
      setError('Impossibile accedere alla fotocamera. Verifica i permessi o usa il pulsante "Carica Immagine".');
      setState(SCANNER_STATES.ERROR);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    setCapturedImage(imageData);
    setState(SCANNER_STATES.PREVIEW);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      setState(SCANNER_STATES.PREVIEW);
    };
    reader.readAsDataURL(file);
  };

  const processOCR = async () => {
    if (!capturedImage) return;

    setState(SCANNER_STATES.PROCESSING);
    setOcrProgress(0);

    try {
      const worker = await createWorker('ita', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text, confidence } } = await worker.recognize(capturedImage);
      await worker.terminate();

      const parsed = parseDDTText(text);
      // Combina confidence OCR con quella del parser
      parsed.confidence = Math.round((parsed.confidence * 0.7) + (confidence * 0.3));

      setParsedData(parsed);
      setState(SCANNER_STATES.RESULTS);
    } catch (err) {
      console.error('Errore OCR:', err);
      setError('Errore durante l\'analisi dell\'immagine. Riprova.');
      setState(SCANNER_STATES.ERROR);
    }
  };

  const handleReset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setParsedData(null);
    setError(null);
    setOcrProgress(0);
    setFormData({
      numero_ddt: '',
      data_ddt: '',
      fornitore: '',
      fornitore_piva: '',
      destinatario: '',
      destinatario_piva: '',
      destinazione: '',
      destinazione_indirizzo: '',
      punto_vendita: '',
      causale: '',
      prodotti: [],
      totale_imponibile: 0,
      totale_iva: 0,
      totale_documento: 0
    });
    setState(SCANNER_STATES.IDLE);
  }, [stopCamera]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProductChange = (index, field, value) => {
    setFormData(prev => {
      const newProdotti = prev.prodotti.map((p, i) => {
        if (i !== index) return p;
        const updated = { ...p, [field]: value };
        // Ricalcola importo se cambia quantità o prezzo
        if (field === 'quantita' || field === 'prezzo_unitario') {
          updated.importo = (updated.quantita || 0) * (updated.prezzo_unitario || 0);
        }
        return updated;
      });
      
      // Ricalcola totale imponibile
      const nuovoTotale = newProdotti.reduce((acc, p) => acc + (p.importo || 0), 0);
      
      return {
        ...prev,
        prodotti: newProdotti,
        totale_imponibile: Math.round(nuovoTotale * 100) / 100
      };
    });
  };

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      prodotti: [
        ...prev.prodotti,
        { 
          riga: prev.prodotti.length + 1, 
          codice: '', 
          descrizione: '', 
          quantita: 0, 
          unita_misura: 'PZ',
          prezzo_unitario: 0,
          importo: 0
        }
      ]
    }));
  };

  const removeProduct = (index) => {
    setFormData(prev => {
      const newProdotti = prev.prodotti.filter((_, i) => i !== index);
      const nuovoTotale = newProdotti.reduce((acc, p) => acc + (p.importo || 0), 0);
      return {
        ...prev,
        prodotti: newProdotti,
        totale_imponibile: Math.round(nuovoTotale * 100) / 100
      };
    });
  };

  const handleSave = () => {
    // Prepara oggetto per salvataggio
    const ddtData = {
      ...formData,
      created_at: new Date().toISOString(),
      created_by: user?.email || 'unknown'
    };
    
    console.log('DDT Salvato:', ddtData);
    
    // TODO: Qui si può aggiungere chiamata API per salvare
    alert('Dati DDT salvati con successo!\n\nNumero: ' + formData.numero_ddt + '\nFornitore: ' + formData.fornitore + '\nTotale: ' + formatCurrency(formData.totale_documento));
    handleReset();
  };

  // ========== RENDER: Schermata Iniziale ==========
  if (state === SCANNER_STATES.IDLE) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-red/10 rounded-full mb-4">
            <Camera className="h-10 w-10 text-fradiavolo-red" />
          </div>
          <h1 className="text-2xl font-bold text-fradiavolo-charcoal mb-2">Scanner DDT</h1>
          <p className="text-fradiavolo-charcoal-light max-w-sm">
            Scatta una foto del DDT e il sistema estrarrà automaticamente i dati
          </p>
        </div>

        <div className="space-y-4 w-full max-w-sm">
          <button
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-2xl font-semibold shadow-fradiavolo transition-all"
          >
            <Camera className="h-6 w-6" />
            Scatta Foto DDT
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-fradiavolo-cream-dark"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-50 text-fradiavolo-charcoal-light">oppure</span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-fradiavolo-cream-dark hover:border-fradiavolo-red text-fradiavolo-charcoal rounded-2xl font-semibold transition-all"
          >
            <Upload className="h-6 w-6" />
            Carica Immagine
          </button>
        </div>

        <div className="mt-8 p-4 bg-fradiavolo-cream/50 rounded-xl max-w-sm">
          <h3 className="font-semibold text-fradiavolo-charcoal mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-fradiavolo-orange" />
            Suggerimenti
          </h3>
          <ul className="text-sm text-fradiavolo-charcoal-light space-y-1">
            <li>• Assicurati che il DDT sia ben illuminato</li>
            <li>• Inquadra tutto il documento</li>
            <li>• Evita riflessi e ombre</li>
            <li>• Tieni il telefono fermo</li>
          </ul>
        </div>
      </div>
    );
  }

  // ========== RENDER: Camera Capture ==========
  if (state === SCANNER_STATES.CAPTURING) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay guida */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-8 sm:inset-16 border-2 border-white/50 rounded-lg">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-fradiavolo-red rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-fradiavolo-red rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-fradiavolo-red rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-fradiavolo-red rounded-br-lg" />
          </div>

          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            Inquadra il DDT nella cornice
          </p>
        </div>

        {/* Controlli */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center items-center gap-8">
          <button
            onClick={() => { stopCamera(); handleReset(); }}
            className="p-4 bg-white/20 rounded-full backdrop-blur"
          >
            <X className="h-6 w-6 text-white" />
          </button>

          <button
            onClick={capturePhoto}
            className="p-6 bg-fradiavolo-red rounded-full shadow-lg active:scale-95 transition-transform"
          >
            <Camera className="h-8 w-8 text-white" />
          </button>

          <button
            onClick={() => { stopCamera(); startCamera(); }}
            className="p-4 bg-white/20 rounded-full backdrop-blur"
          >
            <RotateCcw className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ========== RENDER: Preview ==========
  if (state === SCANNER_STATES.PREVIEW) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Anteprima Immagine</h2>
          <p className="text-sm text-fradiavolo-charcoal-light">Verifica che il DDT sia leggibile</p>
        </div>

        <div className="w-full max-w-lg bg-fradiavolo-charcoal rounded-2xl p-2 mb-6">
          <img
            src={capturedImage}
            alt="DDT Preview"
            className="w-full h-auto max-h-[50vh] object-contain rounded-xl"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <button
            onClick={() => { setCapturedImage(null); setState(SCANNER_STATES.IDLE); }}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-fradiavolo-cream hover:bg-fradiavolo-cream-dark text-fradiavolo-charcoal rounded-xl font-semibold transition-colors"
          >
            <RotateCcw className="h-5 w-5" />
            Riprova
          </button>

          <button
            onClick={processOCR}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green/90 text-white rounded-xl font-semibold shadow-lg transition-colors"
          >
            <CheckCircle className="h-5 w-5" />
            Analizza
          </button>
        </div>
      </div>
    );
  }

  // ========== RENDER: Processing ==========
  if (state === SCANNER_STATES.PROCESSING) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <Loader2 className="h-16 w-16 text-fradiavolo-red animate-spin" />
          </div>

          <h2 className="text-xl font-bold text-fradiavolo-charcoal mb-2">
            Analisi in corso...
          </h2>
          <p className="text-fradiavolo-charcoal-light mb-6">
            Estrazione dati dal DDT
          </p>

          <div className="w-64 mx-auto">
            <div className="h-2 bg-fradiavolo-cream rounded-full overflow-hidden">
              <div
                className="h-full bg-fradiavolo-red transition-all duration-300"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <p className="text-sm text-fradiavolo-charcoal-light mt-2">{ocrProgress}%</p>
          </div>
        </div>
      </div>
    );
  }

  // ========== RENDER: Error ==========
  if (state === SCANNER_STATES.ERROR) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-red/10 rounded-full mb-4">
            <AlertCircle className="h-8 w-8 text-fradiavolo-red" />
          </div>
          <h2 className="text-xl font-bold text-fradiavolo-charcoal mb-2">Errore</h2>
          <p className="text-fradiavolo-charcoal-light mb-6">{error}</p>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-fradiavolo-red text-white rounded-xl font-semibold"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  // ========== RENDER: Results ==========
  if (state === SCANNER_STATES.RESULTS) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-fradiavolo-green/20 rounded-2xl">
              <FileText className="h-6 w-6 text-fradiavolo-green" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-fradiavolo-charcoal">
                Dati Estratti
              </h2>
              <p className="text-sm text-fradiavolo-charcoal-light">
                Verifica e modifica prima di salvare
              </p>
            </div>
          </div>

          {parsedData?.confidence !== undefined && (
            <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              parsedData.confidence > 60
                ? 'bg-fradiavolo-green/20 text-fradiavolo-green'
                : parsedData.confidence > 30
                ? 'bg-fradiavolo-orange/20 text-fradiavolo-orange'
                : 'bg-fradiavolo-red/20 text-fradiavolo-red'
            }`}>
              Affidabilità: {parsedData.confidence}%
            </div>
          )}
        </div>

        {/* Sezione: Dati Documento */}
        <div className="bg-white rounded-2xl shadow-fradiavolo p-4 sm:p-6">
          <h3 className="font-semibold text-fradiavolo-charcoal mb-4 flex items-center gap-2">
            <Hash className="h-5 w-5 text-fradiavolo-red" />
            Dati Documento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Numero DDT
              </label>
              <input
                type="text"
                value={formData.numero_ddt}
                onChange={(e) => handleFieldChange('numero_ddt', e.target.value)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                placeholder="Es: 12249"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Data DDT
              </label>
              <input
                type="date"
                value={formData.data_ddt}
                onChange={(e) => handleFieldChange('data_ddt', e.target.value)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Causale
              </label>
              <input
                type="text"
                value={formData.causale}
                onChange={(e) => handleFieldChange('causale', e.target.value)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                placeholder="Es: Vendita"
              />
            </div>
          </div>
        </div>

        {/* Sezione: Fornitore */}
        <div className="bg-white rounded-2xl shadow-fradiavolo p-4 sm:p-6">
          <h3 className="font-semibold text-fradiavolo-charcoal mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-fradiavolo-red" />
            Fornitore
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Ragione Sociale
              </label>
              <input
                type="text"
                value={formData.fornitore}
                onChange={(e) => handleFieldChange('fornitore', e.target.value)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                placeholder="Nome fornitore"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                P.IVA Fornitore
              </label>
              <input
                type="text"
                value={formData.fornitore_piva}
                onChange={(e) => handleFieldChange('fornitore_piva', e.target.value)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                placeholder="Es: 08722401000"
              />
            </div>
          </div>
        </div>

        {/* Sezione: Destinatario / Destinazione */}
        <div className="bg-white rounded-2xl shadow-fradiavolo p-4 sm:p-6">
          <h3 className="font-semibold text-fradiavolo-charcoal mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-fradiavolo-red" />
            Destinatario e Destinazione
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonna Destinatario */}
            <div className="space-y-4">
              <p className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wide font-medium">
                Destinatario (fatturazione)
              </p>
              <div>
                <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                  Ragione Sociale
                </label>
                <input
                  type="text"
                  value={formData.destinatario}
                  onChange={(e) => handleFieldChange('destinatario', e.target.value)}
                  className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                  placeholder="Es: FRAGESA S.R.L."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                  P.IVA
                </label>
                <input
                  type="text"
                  value={formData.destinatario_piva}
                  onChange={(e) => handleFieldChange('destinatario_piva', e.target.value)}
                  className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                  placeholder="Es: 12209370969"
                />
              </div>
            </div>

            {/* Colonna Destinazione */}
            <div className="space-y-4">
              <p className="text-xs text-fradiavolo-charcoal-light uppercase tracking-wide font-medium">
                Destinazione (consegna)
              </p>
              <div>
                <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                  Punto Vendita
                </label>
                <input
                  type="text"
                  value={formData.destinazione}
                  onChange={(e) => handleFieldChange('destinazione', e.target.value)}
                  className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                  placeholder="Es: FRADIAVOLO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                  Indirizzo Consegna
                </label>
                <input
                  type="text"
                  value={formData.destinazione_indirizzo}
                  onChange={(e) => handleFieldChange('destinazione_indirizzo', e.target.value)}
                  className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red"
                  placeholder="Es: Via del Porto Fluviale 7C, 00154 Roma"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sezione: Prodotti */}
        <div className="bg-white rounded-2xl shadow-fradiavolo p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-fradiavolo-charcoal flex items-center gap-2">
              <Package className="h-5 w-5 text-fradiavolo-red" />
              Prodotti ({formData.prodotti.length})
            </h3>
            <button
              onClick={addProduct}
              className="flex items-center gap-2 px-4 py-2 bg-fradiavolo-green text-white rounded-xl text-sm font-semibold hover:bg-fradiavolo-green/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Aggiungi
            </button>
          </div>

          {/* Header tabella (desktop) */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-fradiavolo-charcoal-light uppercase tracking-wide mb-2 px-3">
            <div className="col-span-2">Codice</div>
            <div className="col-span-4">Descrizione</div>
            <div className="col-span-1 text-center">Qtà</div>
            <div className="col-span-1 text-center">UM</div>
            <div className="col-span-2 text-right">Prezzo</div>
            <div className="col-span-1 text-right">Importo</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {formData.prodotti.length === 0 ? (
              <p className="text-center text-fradiavolo-charcoal-light py-8">
                Nessun prodotto estratto. Clicca "Aggiungi" per inserirne uno manualmente.
              </p>
            ) : (
              formData.prodotti.map((prodotto, index) => (
                <div
                  key={index}
                  className="p-3 bg-fradiavolo-cream/30 rounded-xl border border-fradiavolo-cream-dark hover:border-fradiavolo-red/30 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Codice */}
                    <div className="col-span-6 sm:col-span-2">
                      <label className="sm:hidden text-xs text-fradiavolo-charcoal-light">Codice</label>
                      <input
                        type="text"
                        value={prodotto.codice}
                        onChange={(e) => handleProductChange(index, 'codice', e.target.value)}
                        className="w-full px-2 py-2 border border-fradiavolo-cream-dark rounded-lg text-sm focus:ring-1 focus:ring-fradiavolo-red/20"
                        placeholder="Codice"
                      />
                    </div>
                    
                    {/* Descrizione */}
                    <div className="col-span-12 sm:col-span-4 order-first sm:order-none">
                      <label className="sm:hidden text-xs text-fradiavolo-charcoal-light">Descrizione</label>
                      <input
                        type="text"
                        value={prodotto.descrizione}
                        onChange={(e) => handleProductChange(index, 'descrizione', e.target.value)}
                        className="w-full px-2 py-2 border border-fradiavolo-cream-dark rounded-lg text-sm focus:ring-1 focus:ring-fradiavolo-red/20"
                        placeholder="Descrizione prodotto"
                      />
                    </div>
                    
                    {/* Quantità */}
                    <div className="col-span-3 sm:col-span-1">
                      <label className="sm:hidden text-xs text-fradiavolo-charcoal-light">Qtà</label>
                      <input
                        type="number"
                        step="0.1"
                        value={prodotto.quantita}
                        onChange={(e) => handleProductChange(index, 'quantita', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-2 border border-fradiavolo-cream-dark rounded-lg text-sm text-center focus:ring-1 focus:ring-fradiavolo-red/20"
                        placeholder="0"
                      />
                    </div>
                    
                    {/* Unità Misura */}
                    <div className="col-span-3 sm:col-span-1">
                      <label className="sm:hidden text-xs text-fradiavolo-charcoal-light">UM</label>
                      <select
                        value={prodotto.unita_misura}
                        onChange={(e) => handleProductChange(index, 'unita_misura', e.target.value)}
                        className="w-full px-1 py-2 border border-fradiavolo-cream-dark rounded-lg text-sm focus:ring-1 focus:ring-fradiavolo-red/20"
                      >
                        <option value="PZ">PZ</option>
                        <option value="KG">KG</option>
                        <option value="LT">LT</option>
                        <option value="CS">CS</option>
                        <option value="CF">CF</option>
                        <option value="CT">CT</option>
                        <option value="BS">BS</option>
                        <option value="MZ">MZ</option>
                        <option value="GR">GR</option>
                        <option value="UN">UN</option>
                        <option value="SC">SC</option>
                        <option value="CL">CL</option>
                      </select>
                    </div>
                    
                    {/* Prezzo Unitario */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="sm:hidden text-xs text-fradiavolo-charcoal-light">Prezzo €</label>
                      <input
                        type="number"
                        step="0.01"
                        value={prodotto.prezzo_unitario}
                        onChange={(e) => handleProductChange(index, 'prezzo_unitario', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-2 border border-fradiavolo-cream-dark rounded-lg text-sm text-right focus:ring-1 focus:ring-fradiavolo-red/20"
                        placeholder="0.00"
                      />
                    </div>
                    
                    {/* Importo (calcolato) */}
                    <div className="col-span-4 sm:col-span-1">
                      <label className="sm:hidden text-xs text-fradiavolo-charcoal-light">Importo</label>
                      <div className="px-2 py-2 bg-fradiavolo-cream/50 rounded-lg text-sm text-right font-medium">
                        {formatCurrency(prodotto.importo)}
                      </div>
                    </div>
                    
                    {/* Elimina */}
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button
                        onClick={() => removeProduct(index)}
                        className="p-2 text-fradiavolo-red hover:bg-fradiavolo-red/10 rounded-lg transition-colors"
                        title="Elimina prodotto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sezione: Totali */}
        <div className="bg-white rounded-2xl shadow-fradiavolo p-4 sm:p-6">
          <h3 className="font-semibold text-fradiavolo-charcoal mb-4 flex items-center gap-2">
            <Euro className="h-5 w-5 text-fradiavolo-red" />
            Totali
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Totale Imponibile
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totale_imponibile}
                onChange={(e) => handleFieldChange('totale_imponibile', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red text-right font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Totale IVA
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totale_iva}
                onChange={(e) => handleFieldChange('totale_iva', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red/20 focus:border-fradiavolo-red text-right font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fradiavolo-charcoal-light mb-1.5">
                Totale Documento
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totale_documento}
                onChange={(e) => handleFieldChange('totale_documento', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-fradiavolo-green rounded-xl bg-fradiavolo-green/5 focus:ring-2 focus:ring-fradiavolo-green/20 text-right font-bold text-fradiavolo-green text-lg"
              />
            </div>
          </div>

          {/* Validazione totali */}
          {formData.prodotti.length > 0 && formData.totale_imponibile > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-fradiavolo-cream/50">
              {(() => {
                const sumProdotti = formData.prodotti.reduce((acc, p) => acc + (p.importo || 0), 0);
                const diff = Math.abs(sumProdotti - formData.totale_imponibile);
                
                if (diff < 0.5) {
                  return (
                    <p className="text-sm text-fradiavolo-green flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Somma prodotti ({formatCurrency(sumProdotti)}) corrisponde al totale imponibile
                    </p>
                  );
                } else {
                  return (
                    <p className="text-sm text-fradiavolo-orange flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Somma prodotti ({formatCurrency(sumProdotti)}) diversa dal totale imponibile (diff: {formatCurrency(diff)})
                    </p>
                  );
                }
              })()}
            </div>
          )}
        </div>

        {/* Debug: Testo Raw OCR */}
        {parsedData?.raw_text && (
          <div className="bg-white rounded-2xl shadow-fradiavolo p-4">
            <button
              onClick={() => setShowRawText(!showRawText)}
              className="text-sm text-fradiavolo-charcoal-light hover:text-fradiavolo-red transition-colors"
            >
              {showRawText ? '▼ Nascondi' : '▶ Mostra'} testo OCR originale
            </button>
            {showRawText && (
              <pre className="mt-3 p-3 bg-fradiavolo-cream/50 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                {parsedData.raw_text}
              </pre>
            )}
          </div>
        )}

        {/* Azioni */}
        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 bg-gray-50 p-4 -mx-4 sm:-mx-6 rounded-t-2xl shadow-lg">
          <button
            onClick={handleSave}
            disabled={!formData.numero_ddt && !formData.fornitore}
            className="flex-1 px-6 py-3.5 bg-fradiavolo-green text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            Salva DDT
          </button>

          <button
            onClick={handleReset}
            className="px-6 py-3.5 bg-fradiavolo-charcoal text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-fradiavolo-charcoal/90 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
            Nuova Scansione
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default DDTScanner;
