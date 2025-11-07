import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Edit3, Save, X, Download, Eye, EyeOff } from 'lucide-react';
import negoziData from './data/negozi.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// =======================
// Helpers formattazione TXT/PDF
// =======================
const format15 = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '0.000000000000000';
  return n.toFixed(15);
};

const toBaseUnit = (qty /*, uom*/ ) => {
  return Number(qty || 0);
};

const safeToken = () => {
  const token = localStorage.getItem('token') || '';
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
};

const norm = (s) => (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

// Piccolo helper per rigenerare un PDF "basico" dallo storico se il backend non fornisce un file
const generateDDTFromEntry = (entry, opts = { action: 'view' }) => {
  const doc = new jsPDF();
  const dataFormattata = entry?.data || new Date().toLocaleDateString('it-IT');

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(211, 47, 47);
  doc.text('DOCUMENTO DI TRASPORTO', 105, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  if (entry?.ddtNumber) doc.text(`N. DDT: ${entry.ddtNumber}`, 20, 28);
  doc.text(`Data: ${dataFormattata}`, 20, 34);

  doc.setDrawColor(211, 47, 47);
  doc.line(20, 38, 190, 38);

  const yStart = 46;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(211, 47, 47);
  doc.text('DESTINATARIO', 20, yStart);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const dest = `${entry?.codiceDestinazione ? entry.codiceDestinazione + ' - ' : ''}${entry?.destinazione || '-'}`;
  doc.text(dest, 20, yStart + 6);

  const prodotti = (entry?.prodotti || '').toString();
  const items = prodotti
    ? prodotti.split(/\n|\r|\,|;|\|/).map((x) => x.trim()).filter(Boolean)
    : [];

  const tableData = items.length
    ? items.map((p, i) => [String(i + 1), p])
    : [["", "(dettaglio prodotti non disponibile)"]];

  autoTable(doc, {
    head: [['#', 'Prodotto / Qta / UM']],
    body: tableData,
    startY: yStart + 14,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [211, 47, 47], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 170 } },
    margin: { left: 20, right: 20 },
  });

  const fileName = `DDT_${(entry?.ddtNumber || 'storico').replace('/', '-')}.pdf`;

  if (opts.action === 'download') {
    doc.save(fileName);
  } else {
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  }
};

const Movimentazione = ({ user }) => {
  const puntoOrigine = user?.puntoVendita || 'Non definito';

  // ✅ STATO DESTINAZIONE UNICA
  const [destinazioneUnica, setDestinazioneUnica] = useState(null);

  // Stato righe da movimentare (senza più campo "verso")
  const [movimenti, setMovimenti] = useState([
    { prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }
  ]);

  const [storico, setStorico] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProdotti, setIsLoadingProdotti] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [prodottiOptions, setProdottiOptions] = useState([]);

  const puntoOrigineObj = negoziData.find(n => n.nome === puntoOrigine);
  const codiceOrigine = puntoOrigineObj?.codice || '';
  const negoziOptions = negoziData
    .filter(n => n.nome !== puntoOrigine)
    .map(n => ({
      value: n.nome,
      label: `${n.codice} - ${n.nome}`,
      codice: n.codice,
      nome: n.nome
    }));

  // ===== Carica STORICO =====
  const loadStorico = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/movimentazioni`, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const json = await res.json();

      // ✅ MAPPING AGGIORNATO: ogni movimentazione è già una riga unica
      const items = (json?.data || []).map(m => ({
        id: m.id,
        data: m.data_movimento,
        timestamp: m.timestamp,
        prodotti: m.prodotti, // ✅ Descrizione completa
        destinazione: m.destinazione,
        codiceDestinazione: m.codice_destinazione,
        ddtNumber: m.ddt_number
      }));

      setStorico(items);
    } catch (e) {
      console.error('Errore storico:', e);
      setError('Errore nel caricamento dello storico');
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Carica PRODOTTI =====
  const loadProdotti = async () => {
    try {
      setIsLoadingProdotti(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile per caricare prodotti');
        return;
      }
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/prodotti`, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const data = await res.json();

      const options = (data?.data || []).map(p => {
        const nome = norm(p.nome);
        const uom = norm(p.unitaMisura);
        const codice = norm(p.codice);
        const brand = norm(p.brand);
        const pack = norm(p.pack);
        const materiale = norm(p.materiale);
        const titolo = [brand, nome, pack, materiale].filter(Boolean).join(' ');

        return {
          value: titolo || nome || codice || Math.random().toString(36).slice(2),
          label: `${titolo || nome}${uom ? ` (${uom})` : ''}${codice ? ` - ${codice}` : ''}`,
          uom, codice, nome, brand, pack, materiale
        };
      }).filter(o => o.label);

      options.sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }));
      setProdottiOptions(options);
    } catch (e) {
      console.error('Errore prodotti:', e);
      setError('Errore nel caricamento dei prodotti: ' + e.message);
      // Fallback di emergenza
      setProdottiOptions([
        { value: 'Pizza Margherita', label: 'Pizza Margherita (PZ)', uom: 'PZ', codice: 'PIZZA001' },
        { value: 'Pizza Marinara', label: 'Pizza Marinara (PZ)', uom: 'PZ', codice: 'PIZZA002' }
      ]);
    } finally {
      setIsLoadingProdotti(false);
    }
  };

  useEffect(() => {
    loadStorico();
    loadProdotti();
  }, []);

  // ===== Aggiorna Riga =====
  const aggiornaRiga = (index, campo, valore) => {
    const nuovoMov = [...movimenti];
    nuovoMov[index][campo] = valore;

    const r = nuovoMov[index];
    const prodotto = (campo === 'prodotto' ? valore : r.prodotto) || null;
    const codiceMago = prodotto?.codice || '';
    const uom = prodotto?.uom || r.prodotto?.uom || '';
    const qty = (campo === 'quantita' ? valore : r.quantita) || '';
    const qtyBase = toBaseUnit(qty, uom);

    nuovoMov[index].txtContent = `${codiceMago} ; ${format15(qtyBase)}`;
    setMovimenti(nuovoMov);
  };

  // ✅ AGGIUNGI RIGA (senza destinazione)
  const aggiungiRiga = () => {
    setMovimenti([...
      movimenti,
      { prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }
    ]);
  };

  const toggleTxtEditor = (index) => {
    const nuovo = [...movimenti];
    nuovo[index].showTxtEditor = !nuovo[index].showTxtEditor;
    setMovimenti(nuovo);
  };

  const startEditingTxt = (index) => {
    const nuovo = [...movimenti];
    nuovo[index].isEditingTxt = true;
    setMovimenti(nuovo);
  };

  const saveTxtContent = (index, newContent) => {
    const nuovo = [...movimenti];
    nuovo[index].txtContent = newContent;
    nuovo[index].isEditingTxt = false;
    setMovimenti(nuovo);
    setSuccess('📝 Contenuto TXT aggiornato!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const cancelTxtEdit = (index) => {
    const nuovo = [...movimenti];
    nuovo[index].isEditingTxt = false;
    setMovimenti(nuovo);
  };

  // ====== VIEW / DOWNLOAD DDT DALLO STORICO ======
  const fetchAndOpenDDT = async (entry, mode = 'view') => {
    try {
      const res = await fetch(`${API_BASE_URL}/movimentazioni/${entry.id}/ddt`, {
        headers: { Authorization: safeToken() }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `DDT_${(entry?.ddtNumber || entry.id)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      console.warn('Nessun PDF dal backend, rigenero localmente...', err);
      generateDDTFromEntry(entry, { action: mode === 'download' ? 'download' : 'view' });
    }
  };

  const handleViewDDT = (entry) => fetchAndOpenDDT(entry, 'view');
  const handleDownloadDDT = (entry) => fetchAndOpenDDT(entry, 'download');

  // ✅ GENERA PDF E SALVA (con destinazione unica)
  const generaPDF = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Validazione destinazione
      if (!destinazioneUnica) {
        setError('⚠️ Seleziona una destinazione prima di generare il DDT');
        setIsLoading(false);
        return;
      }

      // Validazione righe
      const righeValide = movimenti.filter(m => m.prodotto && m.quantita);
      if (righeValide.length === 0) {
        setError('⚠️ Aggiungi almeno un prodotto con quantità');
        setIsLoading(false);
        return;
      }

      const timestamp = new Date();
      const ddtNumber = `${String(Date.now()).slice(-4)}/${timestamp.getFullYear()}`;
      const dataFormattata = timestamp.toLocaleDateString('it-IT');

      // ✅ Genera PDF con tutte le righe
      const doc = new jsPDF();

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('FRADIAVOLO PIZZERIA', 20, 20);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(211, 47, 47);
      doc.text('Pizza Contemporanea • Qualita Italiana', 20, 28);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DOCUMENTO DI TRASPORTO', 105, 20, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`N. DDT: ${ddtNumber}`, 105, 28);
      doc.text(`Data: ${dataFormattata}`, 105, 35);

      doc.setDrawColor(211, 47, 47);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      let yPos = 52;

      // Mittente
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('MITTENTE', 20, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${puntoOrigineObj?.nome || puntoOrigine} (${codiceOrigine})`, 20, yPos + 6);
      doc.text(puntoOrigineObj?.indirizzo || '', 20, yPos + 12);

      // ✅ Destinatario UNICO
      const destObj = negoziData.find(n => n.nome === destinazioneUnica);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DESTINATARIO', 75, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      if (destObj) {
        doc.text(`${destObj.nome} (${destObj.codice})`, 75, yPos + 6);
        doc.text(destObj.indirizzo || '', 75, yPos + 12);
      } else {
        doc.text(destinazioneUnica, 75, yPos + 6);
      }

      // Causale
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CAUSALE TRASPORTO', 130, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Trasferimento merce tra punti vendita', 130, yPos + 6);
      doc.text('Trasporto a cura del mittente', 130, yPos + 12);

      // ✅ Tabella prodotti (TUTTE LE RIGHE)
      const tableStartY = yPos + 25;
      const tableData = righeValide.map((m, idx) => [
        (idx + 1).toString(),
        m.prodotto.value || m.prodotto.label || '-',
        m.quantita.toString(),
        m.prodotto?.uom || '-',
        destObj ? `${destObj.codice} - ${destObj.nome}` : destinazioneUnica
      ]);

      const targetRows = Math.max(10, tableData.length + 5);
      while (tableData.length < targetRows) tableData.push(['', '', '', '', '']);

      const pageWidth = doc.internal.pageSize.width;
      const tableWidth = 170;
      const leftMargin = (pageWidth - tableWidth) / 2;

      autoTable(doc, {
        head: [['#', 'Descrizione Prodotto', 'Qta', 'U.M.', 'Destinazione']],
        body: tableData,
        startY: tableStartY,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [211, 47, 47],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 85, halign: 'left' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 43, halign: 'left' }
        },
        margin: { left: leftMargin, right: leftMargin },
      });

      // Note + Firme
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(211, 47, 47);
      doc.text('Note e Osservazioni:', 20, finalY);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.5);
      doc.rect(20, finalY + 2, 170, 15);

      const signY = finalY + 25;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);

      doc.text('FIRMA MITTENTE', 35, signY);
      doc.text('FIRMA TRASPORTATORE', 90, signY);
      doc.text('FIRMA DESTINATARIO', 150, signY);

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(20, signY + 12, 65, signY + 12);
      doc.line(75, signY + 12, 120, signY + 12);
      doc.line(135, signY + 12, 180, signY + 12);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Documento generato automaticamente dal sistema Fradiavolo Invoice Manager', 105, 280, { align: 'center' });

      // Salva PDF
      const nomeFile = `DDT_${ddtNumber.replace('/', '-')}_${codiceOrigine}_${destObj?.codice || 'DEST'}_${dataFormattata.replace(/\//g, '-')}.pdf`;
      doc.save(nomeFile);

      // ✅ Payload per backend (con destinazione unica)
      const payload = righeValide.map((m) => {
        const codiceMago = m.prodotto?.codice || '';
        const uom = m.prodotto?.uom || '';
        const qtyBase = toBaseUnit(m.quantita, uom);
        const rigaTxt = `${codiceMago} ; ${format15(qtyBase)}`;

        return {
          origine: puntoOrigine,
          codice_origine: codiceOrigine,
          prodotto: m.prodotto?.value || '',
          quantita: m.quantita,
          unita_misura: uom,
          destinazione: destinazioneUnica, // ✅ UNICA DESTINAZIONE
          codice_destinazione: destObj?.codice || '',
          txt_content: rigaTxt,
          ddt_number: ddtNumber
        };
      });

      const token = localStorage.getItem('token');
      if (!token || token.length < 20) {
        setError('Token non valido o assente, ripeti il login.');
        return;
      }
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/movimentazioni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ movimenti: payload, origine: puntoOrigine })
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`Errore ${res.status}: ${text}`);

      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Risposta non JSON: ${text}`); }

      setSuccess(data?.message || `✅ DDT ${ddtNumber} generato e movimentazione salvata!`);
      await loadStorico();

      // ✅ Reset completo
      setMovimenti([{ prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }]);
      setDestinazioneUnica(null);

    } catch (err) {
      console.error('Errore generazione DDT:', err);
      setError('Errore nella generazione DDT: ' + err.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccess(''); setError(''); }, 8000);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fradiavolo-charcoal mb-2">Movimentazione tra Negozi</h1>
          <p className="text-fradiavolo-charcoal-light">
            Origine: <span className="font-semibold text-fradiavolo-red">{codiceOrigine} - {puntoOrigine}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProdotti}
            disabled={isLoadingProdotti}
            className="flex items-center space-x-2 px-3 py-1 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
          >
            <svg className={`h-4 w-4 ${isLoadingProdotti ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">Ricarica Prodotti</span>
          </button>

          <button
            onClick={loadStorico}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
          >
            <svg className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">Aggiorna</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl border bg-red-50 text-red-800 border-red-200">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-4 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30">{success}</div>
      )}

      {/* Form Movimentazioni */}
      <div className="mobile-invoice-card bg-white shadow-fradiavolo border border-fradiavolo-cream-dark mb-4 sm:mb-8">
        <h3 className="mobile-card-header text-fradiavolo-charcoal mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-fradiavolo-cream-dark">
          Nuova Movimentazione
        </h3>

        {/* ✅ DESTINAZIONE UNICA (PRIMA DEL FORM) */}
        <div className="mb-6 p-4 bg-fradiavolo-cream rounded-lg border border-fradiavolo-cream-dark">
          <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
            🏪 Punto Vendita di Destinazione (unico per tutti i prodotti)
          </label>
          <Select
            options={negoziOptions}
            placeholder="Seleziona destinazione..."
            value={negoziOptions.find(opt => opt.nome === destinazioneUnica) || null}
            onChange={(val) => setDestinazioneUnica(val?.nome || null)}
            className="text-sm"
            isSearchable
            noOptionsMessage={() => "Nessun negozio trovato"}
            styles={{
              control: (base) => ({
                ...base,
                minHeight: '44px',
                fontSize: '14px',
                borderColor: destinazioneUnica ? '#2d8659' : '#e5c9b5'
              })
            }}
          />
          {destinazioneUnica && (
            <p className="text-xs text-fradiavolo-green-dark mt-2">
              ✓ Tutti i prodotti verranno inviati a: {destinazioneUnica}
            </p>
          )}
        </div>

        <div className="mobile-space-y-2 sm:space-y-6">
          {movimenti.map((mov, index) => (
            <div key={index} className="mb-4 sm:mb-6 p-3 sm:p-4 bg-fradiavolo-cream rounded-lg border border-fradiavolo-cream-dark mobile-list-item">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Prodotto</label>
                  <Select
                    options={prodottiOptions}
                    placeholder={isLoadingProdotti ? "Caricando prodotti..." : "Seleziona prodotto..."}
                    value={mov.prodotto}
                    onChange={(val) => aggiornaRiga(index, 'prodotto', val)}
                    className="text-sm mobile-select"
                    isSearchable
                    isLoading={isLoadingProdotti}
                    isDisabled={isLoadingProdotti}
                    noOptionsMessage={() => isLoadingProdotti ? "Caricamento in corso..." : "Nessun prodotto trovato"}
                    filterOption={(option, rawInput) => {
                      const q = (rawInput || '').toLowerCase();
                      const o = option.data || option;
                      const haystack = [
                        option.label,
                        option.value,
                        o?.nome, o?.brand, o?.pack, o?.materiale, o?.codice, o?.uom
                      ].filter(Boolean).join(' ').toLowerCase();
                      return haystack.includes(q);
                    }}
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '44px',
                        fontSize: '14px'
                      })
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Quantità</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-full border border-fradiavolo-cream-dark p-3 rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors mobile-input"
                    placeholder="Es: 24"
                    value={mov.quantita}
                    onChange={(e) => aggiornaRiga(index, 'quantita', e.target.value)}
                  />
                  {mov.prodotto && (
                    <p className="text-xs text-fradiavolo-charcoal-light mt-1">Unità: {mov.prodotto.uom}</p>
                  )}
                </div>
              </div>

              {/* Editor TXT (opzionale) */}
              {mov.prodotto && (
                <div className="border-t border-fradiavolo-cream-dark pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-fradiavolo-charcoal flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Contenuto TXT</span>
                    </h4>
                    <button
                      onClick={() => toggleTxtEditor(index)}
                      className="flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors"
                    >
                      {mov.showTxtEditor ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{mov.showTxtEditor ? 'Nascondi' : 'Mostra'}</span>
                    </button>
                  </div>

                  {mov.showTxtEditor && (
                    <div className="bg-white rounded-lg border border-fradiavolo-cream-dark p-3 sm:p-4">
                      {mov.isEditingTxt ? (
                        <div className="space-y-3">
                          <textarea
                            defaultValue={mov.txtContent}
                            id={`txt-editor-${index}`}
                            rows="6"
                            className="w-full border border-fradiavolo-cream-dark p-3 rounded-xl focus:ring-2 focus:ring-fradiavolo-red font-mono text-sm"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                const el = document.getElementById(`txt-editor-${index}`);
                                const newContent = el ? el.value : mov.txtContent;
                                saveTxtContent(index, newContent);
                              }}
                              className="flex items-center space-x-1 px-3 py-2 bg-fradiavolo-green text-white rounded-lg hover:bg-fradiavolo-green-dark text-sm"
                            >
                              <Save className="h-3 w-3" />
                              <span>Salva</span>
                            </button>
                            <button
                              onClick={() => cancelTxtEdit(index)}
                              className="flex items-center space-x-1 px-3 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light text-sm"
                            >
                              <X className="h-3 w-3" />
                              <span>Annulla</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-fradiavolo-cream p-3 rounded-lg border border-fradiavolo-cream-dark">
                            <pre className="text-xs text-fradiavolo-charcoal font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {mov.txtContent || 'Nessun contenuto TXT generato'}
                            </pre>
                          </div>
                          <button
                            onClick={() => startEditingTxt(index)}
                            className="flex items-center space-x-1 px-3 py-2 bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark text-sm"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Modifica</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={aggiungiRiga}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
            >
              <span>+ Aggiungi prodotto</span>
            </button>

            <button
              onClick={generaPDF}
              disabled={isLoading || !destinazioneUnica || movimenti.every(m => !m.prodotto || !m.quantita)}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-fradiavolo-red text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Genera DDT & Salva</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Storico */}
      {storico.length > 0 && (
        <div className="bg-white rounded-xl shadow-fradiavolo p-4 sm:p-6 border border-fradiavolo-cream-dark">
          <h2 className="text-lg sm:text-xl font-semibold text-fradiavolo-charcoal mb-4">
            📜 Storico movimentazioni ({storico.length})
          </h2>

          <div className="space-y-3 sm:space-y-4">
            {storico.map(entry => (
              <div key={entry.id} className="bg-fradiavolo-cream p-3 sm:p-4 rounded-lg border border-fradiavolo-cream-dark">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-fradiavolo-charcoal">
                      📅 {entry.data}
                    </p>
                    {entry.ddtNumber && (
                      <p className="text-xs text-fradiavolo-charcoal-light">
                        DDT: {entry.ddtNumber}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewDDT(entry)}
                      className="flex items-center space-x-1 px-3 py-2 text-xs bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Visualizza</span>
                    </button>
                    <button
                      onClick={() => handleDownloadDDT(entry)}
                      className="flex items-center space-x-1 px-3 py-2 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light"
                    >
                      <Download className="h-3 w-3" />
                      <span>Scarica</span>
                    </button>
                  </div>
                </div>

                {/* ✅ VISUALIZZAZIONE UNIFICATA */}
                <div className="text-sm mt-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-fradiavolo-charcoal">📦 Prodotti:</span>
                    <span className="text-fradiavolo-charcoal-light">{entry.prodotti}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-fradiavolo-charcoal">🏪 Destinazione:</span>
                    <span className="text-fradiavolo-red font-medium">
                      {entry.codiceDestinazione ? `${entry.codiceDestinazione} - ` : ''}{entry.destinazione}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Movimentazione;
