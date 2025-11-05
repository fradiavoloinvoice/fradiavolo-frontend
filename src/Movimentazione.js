import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Edit3, Save, X, Download, Eye, EyeOff } from 'lucide-react';
import negoziData from './data/negozi.json';

// =======================
// Helpers formattazione TXT
// =======================
const format15 = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '0.000000000000000';
  return n.toFixed(15);
};

const toBaseUnit = (qty, uom /* , prodotto */) => {
  // Qui puoi implementare conversioni UM -> UMB se serve
  return Number(qty || 0);
};

// NOTE: questo componente si aspetta una prop "user" con almeno { email, puntoVendita }
const Movimentazione = ({ user }) => {
  const puntoOrigine = user?.puntoVendita || 'Non definito';

  // Stato righe da movimentare
  const [movimenti, setMovimenti] = useState([
    { prodotto: null, quantita: '', verso: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }
  ]);

  // Storico (da /api/movimentazioni)
  const [storico, setStorico] = useState([]);

  // Loading & messaggi
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProdotti, setIsLoadingProdotti] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Prodotti da API
  const [prodottiOptions, setProdottiOptions] = useState([]);

  // Dati negozi
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
      const res = await fetch('/api/movimentazioni', {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const json = await res.json();

      // Raggruppa tutte le righe con lo stesso timestamp in un "entry"
      const byTs = new Map();
      for (const m of (json?.data || [])) {
        const key = m.timestamp;
        if (!byTs.has(key)) {
          byTs.set(key, {
            id: m.id,
            data: m.data_movimento,
            timestamp: m.timestamp,
            movimenti: []
          });
        }
        byTs.get(key).movimenti.push({
          prodotto: m.prodotto,
          uom: m.unita_misura,
          quantita: m.quantita,
          verso: m.destinazione,
          codiceDestinazione: m.codice_destinazione
        });
      }
      // Ordina per timestamp desc
      const entries = [...byTs.values()].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setStorico(entries);
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

      const res = await fetch('/api/prodotti', {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const data = await res.json();

      // Mapping ricco per aiutare la ricerca (“vetro pepsi”, ecc.)
      const norm = s => (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
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

      // Ordina per label
      options.sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }));
      setProdottiOptions(options);
    } catch (e) {
      console.error('Errore prodotti:', e);
      setError('Errore nel caricamento dei prodotti: ' + e.message);
      // Fallback minimo
      setProdottiOptions([
        { value: 'Pizza Margherita', label: 'Pizza Margherita (PZ)', uom: 'PZ', codice: 'PIZZA001' },
        { value: 'Pizza Marinara', label: 'Pizza Marinara (PZ)', uom: 'PZ', codice: 'PIZZA002' }
      ]);
    } finally {
      setIsLoadingProdotti(false);
    }
  };

  // Avvio: carica storico + prodotti
  useEffect(() => {
    loadStorico();
    loadProdotti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Helpers UI =====
  const aggiornaRiga = (index, campo, valore) => {
    const nuovoMov = [...movimenti];
    nuovoMov[index][campo] = valore;

    // ————— Genera la riga TXT per questa riga —————
    const r = nuovoMov[index];
    const prodotto = (campo === 'prodotto' ? valore : r.prodotto) || null;
    const codiceMago = prodotto?.codice || '';
    const uom = prodotto?.uom || r.prodotto?.uom || '';
    const qty = (campo === 'quantita' ? valore : r.quantita) || '';

    // quantità in UMB (per ora identità)
    const qtyBase = toBaseUnit(qty, uom);

    // Riga TXT nel formato richiesto
    nuovoMov[index].txtContent = `${codiceMago} ; ${format15(qtyBase)}`;

    setMovimenti(nuovoMov);
  };

  const aggiungiRiga = () => {
    setMovimenti([
      ...movimenti,
      { prodotto: null, quantita: '', verso: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }
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

  const generaPDF = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Genera DDT con numerazione progressiva
      const timestamp = new Date();
      const ddtNumber = `${String(Date.now()).slice(-4)}/${timestamp.getFullYear()}`;
      const dataFormattata = timestamp.toLocaleDateString('it-IT');

      // Crea PDF DDT
      const doc = new jsPDF();

      // Header - Logo (senza emoji)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('FRADIAVOLO PIZZERIA', 20, 20);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(211, 47, 47);
      doc.text('Pizza Contemporanea • Qualita Italiana', 20, 28);

      // Info DDT - spostato più a destra
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DOCUMENTO DI TRASPORTO', 105, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`N. DDT: ${ddtNumber}`, 105, 28);
      doc.text(`Data: ${dataFormattata}`, 105, 35);

      // Linea di separazione
      doc.setDrawColor(211, 47, 47);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      // Info trasporto - layout migliorato
      const puntoOrigineObj = negoziData.find(n => n.nome === puntoOrigine);
      const destinazioniUniche = [...new Set(movimenti.map(m => m.verso).filter(Boolean))];

      let yPos = 52;

      // Mittente
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('MITTENTE', 20, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${puntoOrigineObj?.nome || puntoOrigine} (${puntoOrigineObj?.codice || ''})`, 20, yPos + 6);
      doc.text(puntoOrigineObj?.indirizzo || '', 20, yPos + 12);

      // Destinatario - una sola destinazione principale
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DESTINATARIO', 75, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      if (destinazioniUniche.length > 0) {
        const destObj = negoziData.find(n => n.nome === destinazioniUniche[0]);
        if (destObj) {
          doc.text(`${destObj.nome} (${destObj.codice})`, 75, yPos + 6);
          doc.text(destObj.indirizzo || '', 75, yPos + 12);
        }
      }

      // Causale
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CAUSALE TRASPORTO', 130, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Trasferimento merce tra punti vendita', 130, yPos + 6);
      doc.text('Trasporto a cura del mittente', 130, yPos + 12);

      // Tabella prodotti - layout migliorato
      const tableStartY = yPos + 25;
      const tableData = movimenti
        .filter(m => m.prodotto && m.quantita && m.verso)
        .map((m, idx) => {
          const destObj = negoziData.find(n => n.nome === m.verso);
          const destinazione = destObj ? `${destObj.codice} - ${destObj.nome}` : m.verso;

          return [
            (idx + 1).toString(),
            m.prodotto.value || m.prodotto.label || '-',
            m.quantita.toString(),
            m.prodotto?.uom || '-',
            destinazione
          ];
        });

      // Aggiungi righe vuote
      const targetRows = Math.max(10, tableData.length + 5);
      while (tableData.length < targetRows) {
        tableData.push(['', '', '', '', '']);
      }

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

      // Note
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(211, 47, 47);
      doc.text('Note e Osservazioni:', 20, finalY);

      // Box per note
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.5);
      doc.rect(20, finalY + 2, 170, 15);

      // Firme
      const signY = finalY + 25;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);

      doc.text('FIRMA MITTENTE', 35, signY);
      doc.text('FIRMA TRASPORTATORE', 90, signY);
      doc.text('FIRMA DESTINATARIO', 150, signY);

      // Linee per firme
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(20, signY + 12, 65, signY + 12);
      doc.line(75, signY + 12, 120, signY + 12);
      doc.line(135, signY + 12, 180, signY + 12);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Documento generato automaticamente dal sistema Fradiavolo Invoice Manager', 105, 280, { align: 'center' });

      // Salva PDF localmente (browser)
      const nomeFile = `DDT_${ddtNumber.replace('/', '-')}_${puntoOrigineObj?.codice || 'ORIG'}_${dataFormattata.replace(/\//g, '-')}.pdf`;
      doc.save(nomeFile);

      // --- Salvataggio movimentazione su backend ---
      const payload = movimenti
        .filter(m => m.prodotto && m.quantita && m.verso)   // evita righe vuote
        .map((m) => {
          const negozioDest = negoziData.find(n => n.nome === m.verso);
          const codiceMago  = m.prodotto?.codice || '';
          const uom         = m.prodotto?.uom || '';
          const qtyBase     = toBaseUnit(m.quantita, uom);
          const rigaTxt     = `${codiceMago} ; ${format15(qtyBase)}`;

          return {
            origine: puntoOrigine,
            codice_origine: codiceOrigine,
            prodotto: m.prodotto?.value || m.prodotto?.label || '',
            quantita: Number(m.quantita),
            unita_misura: uom,
            destinazione: m.verso,
            codice_destinazione: negozioDest?.codice || '',
            txt_content: rigaTxt,
            ddt_number: ddtNumber // (facoltativo: il backend lo ignora, utile a log)
          };
        });

      const token = localStorage.getItem('token');
      if (!token || token.length < 20) {
        setError('Token non valido o assente, ripeti il login.');
        return;
      }
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const res = await fetch('/api/movimentazioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ movimenti: payload, origine: puntoOrigine })
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`Errore ${res.status}: ${text}`);

      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Risposta non JSON: ${text}`); }

      setSuccess(data?.message || `✅ DDT ${ddtNumber} generato e movimentazione registrata!`);
      await loadStorico(); // aggiorna lista

      // reset form
      setMovimenti([{ prodotto: null, quantita: '', verso: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }]);
    } catch (err) {
      console.error('Errore generazione DDT:', err);
      setError('Errore nella generazione DDT: ' + err.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccess(''); setError(''); }, 8000);
    }
  };

  // Funzione per rigenerare DDT dallo storico
  const regenerateDDT = (entry) => {
    try {
      const timestamp = new Date(entry.timestamp);
      const ddtNumber = `${String(Date.parse(entry.timestamp)).slice(-4)}/${timestamp.getFullYear()}`;
      const dataFormattata = timestamp.toLocaleDateString('it-IT');

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

      // Info DDT
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DOCUMENTO DI TRASPORTO', 105, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`N. DDT: ${ddtNumber}`, 105, 28);
      doc.text(`Data: ${dataFormattata}`, 105, 35);

      // Linea di separazione
      doc.setDrawColor(211, 47, 47);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      // Info trasporto
      const puntoOrigineObj = negoziData.find(n => n.nome === puntoOrigine);
      const destinazioniUniche = [...new Set(entry.movimenti.map(m => m.verso))];

      let yPos = 52;

      // Mittente
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('MITTENTE', 20, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${puntoOrigineObj?.nome || puntoOrigine} (${puntoOrigineObj?.codice || ''})`, 20, yPos + 6);
      doc.text(puntoOrigineObj?.indirizzo || '', 20, yPos + 12);

      // Destinatario
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DESTINATARIO', 75, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      if (destinazioniUniche.length > 0) {
        const destObj = negoziData.find(n => n.nome === destinazioniUniche[0]);
        if (destObj) {
          doc.text(`${destObj.nome} (${destObj.codice})`, 75, yPos + 6);
          doc.text(destObj.indirizzo || '', 75, yPos + 12);
        }
      }

      // Causale
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CAUSALE TRASPORTO', 130, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Trasferimento merce tra punti vendita', 130, yPos + 6);
      doc.text('Trasporto a cura del mittente', 130, yPos + 12);

      // Tabella prodotti
      const tableStartY = yPos + 25;
      const tableData = entry.movimenti.map((m, idx) => {
        const destObj = negoziData.find(n => n.nome === m.verso);
        const destinazione = destObj ? `${destObj.codice} - ${destObj.nome}` : m.verso;

        return [
          (idx + 1).toString(),
          m.prodotto,
          m.quantita.toString(),
          m.uom || '-',
          destinazione
        ];
      });

      // Aggiungi righe vuote
      const targetRows = Math.max(10, tableData.length + 5);
      while (tableData.length < targetRows) {
        tableData.push(['', '', '', '', '']);
      }

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
        margin: { left: 30, right: 30 },
      });

      // Note
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(211, 47, 47);
      doc.text('Note e Osservazioni:', 20, finalY);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.5);
      doc.rect(20, finalY + 2, 170, 15);

      // Firme
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

      return doc;
    } catch (error) {
      console.error('Errore rigenerazione DDT:', error);
      return null;
    }
  };

  // Handler per visualizzare DDT
  const handleViewDDT = (entry) => {
    const doc = regenerateDDT(entry);
    if (doc) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } else {
      setError('Errore nella visualizzazione del DDT');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Handler per scaricare DDT
  const handleDownloadDDT = (entry) => {
    const doc = regenerateDDT(entry);
    if (doc) {
      const timestamp = new Date(entry.timestamp);
      const ddtNumber = `${String(Date.parse(entry.timestamp)).slice(-4)}/${timestamp.getFullYear()}`;
      const dataFormattata = timestamp.toLocaleDateString('it-IT');
      const nomeFile = `DDT_${ddtNumber.replace('/', '-')}_${codiceOrigine}_${dataFormattata.replace(/\//g, '-')}.pdf`;
      doc.save(nomeFile);
    } else {
      setError('Errore nel download del DDT');
      setTimeout(() => setError(''), 3000);
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
          {/* Ricarica prodotti */}
          <button
            onClick={loadProdotti}
            disabled={isLoadingProdotti}
            className="flex items-center space-x-2 px-3 py-1 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
            title="Ricarica lista prodotti"
          >
            <svg className={`h-4 w-4 ${isLoadingProdotti ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">Ricarica Prodotti</span>
          </button>

          {/* Ricarica storico */}
          <button
            onClick={loadStorico}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
            title="Ricarica storico"
          >
            <svg className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Alert */}
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

        <div className="mobile-space-y-2 sm:space-y-6"></div>

        {movimenti.map((mov, index) => (
          <div key={index} className="mb-4 sm:mb-6 p-3 sm:p-4 bg-fradiavolo-cream rounded-lg border border-fradiavolo-cream-dark mobile-list-item">
            {/* Riga principale */}
            <div className="grid grid-cols-1 gap-4 mb-4 movimento-grid">
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
                      minHeight: '44px', // Touch-friendly
                      fontSize: '14px'
                    }),
                    menu: (base) => ({
                      ...base,
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
                  <p className="text-xs text-fradiavolo-charcoal-light mt-1 mobile-text-xs">Unità: {mov.prodotto.uom}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Destinazione</label>
                <Select
                  options={negoziOptions}
                  placeholder="Seleziona destinazione..."
                  value={negoziOptions.find(opt => opt.nome === mov.verso) || null}
                  onChange={(val) => aggiornaRiga(index, 'verso', val?.nome || '')}
                  className="text-sm mobile-select"
                  isSearchable
                  noOptionsMessage={() => "Nessun negozio trovato"}
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '44px',
                      fontSize: '14px'
                    }),
                    menu: (base) => ({
                      ...base,
                      fontSize: '14px'
                    })
                  }}
                />
              </div>
            </div>

            {/* Editor TXT */}
            {mov.prodotto && (
              <div className="border-t border-fradiavolo-cream-dark pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-fradiavolo-charcoal flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Contenuto TXT per il movimento</span>
                    <span className="sm:hidden">TXT movimento</span>
                  </h4>
                  <button
                    onClick={() => toggleTxtEditor(index)}
                    className="flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors mobile-button-sm mobile-touch-feedback"
                  >
                    {mov.showTxtEditor ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span className="hidden sm:inline">{mov.showTxtEditor ? 'Nascondi' : 'Mostra'} Editor</span>
                    <span className="sm:hidden">{mov.showTxtEditor ? 'Hide' : 'Show'}</span>
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
                          className="w-full border border-fradiavolo-cream-dark p-3 rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors font-mono text-sm mobile-textarea"
                          placeholder="Inserisci il contenuto del file TXT..."
                        />
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                          <button
                            onClick={() => {
                              const newContent = document.getElementById(`txt-editor-${index}`).value;
                              saveTxtContent(index, newContent);
                            }}
                            className="flex items-center justify-center space-x-1 px-3 py-2 bg-fradiavolo-green text-white rounded-lg hover:bg-fradiavolo-green-dark transition-colors text-sm mobile-button mobile-touch-feedback"
                          >
                            <Save className="h-3 w-3" />
                            <span>Salva TXT</span>
                          </button>
                          <button
                            onClick={() => cancelTxtEdit(index)}
                            className="flex items-center justify-center space-x-1 px-3 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors text-sm mobile-button mobile-touch-feedback"
                          >
                            <X className="h-3 w-3" />
                            <span>Annulla</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-fradiavolo-cream p-3 rounded-lg border border-fradiavolo-cream-dark">
                          <pre className="text-xs text-fradiavolo-charcoal font-mono whitespace-pre-wrap max-h-24 sm:max-h-32 overflow-y-auto mobile-notes">
                            {mov.txtContent || 'Nessun contenuto TXT generato'}
                          </pre>
                        </div>
                        <button
                          onClick={() => startEditingTxt(index)}
                          className="flex items-center space-x-1 px-3 py-2 bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors text-sm mobile-button mobile-touch-feedback"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Modifica TXT</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 movimento-buttons">
          <button
            onClick={aggiungiRiga}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg mobile-button mobile-touch-feedback"
          >
            <span className="text-sm sm:text-base">+ Aggiungi riga</span>
          </button>

          <button
            onClick={generaPDF}
            disabled={isLoading || movimenti.every(m => !m.prodotto || !m.quantita || !m.verso)}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-fradiavolo-red text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mobile-generate-btn mobile-touch-feedback"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="hidden sm:inline text-sm">Salvando...</span>
                <span className="sm:hidden text-xs">Salvando...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">Genera DDT e Registra</span>
                <span className="sm:hidden text-xs mobile-ddt-btn">Genera DDT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Storico - versione mobile ottimizzata */}
      {storico.length > 0 && (
        <div className="bg-white rounded-xl shadow-fradiavolo p-4 sm:p-6 border border-fradiavolo-cream-dark">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
            <h2 className="text-lg sm:text-xl font-semibold text-fradiavolo-charcoal flex items-center space-x-2">
              <span className="text-base sm:text-xl">📜</span>
              <span>Storico movimentazioni ({storico.length})</span>
            </h2>
            <p className="text-xs sm:text-sm text-fradiavolo-charcoal-light mobile-text-xs">
              <span className="hidden sm:inline">Solo le movimentazioni originate da {codiceOrigine} - {puntoOrigine}</span>
              <span className="sm:hidden">Da {codiceOrigine}</span>
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {storico.map(entry => (
              <div key={entry.id} className="bg-fradiavolo-cream p-3 sm:p-4 rounded-lg border border-fradiavolo-cream-dark mobile-history-card">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 space-y-2 sm:space-y-0">
                  <p className="text-sm font-semibold text-fradiavolo-charcoal">
                    Registrata il: {entry.data}
                  </p>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button
                      onClick={() => handleViewDDT(entry)}
                      className="flex items-center justify-center space-x-1 px-3 py-2 text-xs bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors mobile-button-sm mobile-touch-feedback"
                    >
                      <Eye className="h-3 w-3" />
                      <span className="hidden sm:inline">Visualizza DDT</span>
                      <span className="sm:hidden">Vedi DDT</span>
                    </button>
                    <button
                      onClick={() => handleDownloadDDT(entry)}
                      className="flex items-center justify-center space-x-1 px-3 py-2 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors mobile-button-sm mobile-touch-feedback"
                    >
                      <Download className="h-3 w-3" />
                      <span className="hidden sm:inline">Scarica DDT</span>
                      <span className="sm:hidden">Download</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-fradiavolo-charcoal-light mb-2 mobile-text-xs">ID: {entry.id}</p>
                <div className="space-y-1 mobile-history-details">
                  {entry.movimenti.map((m, idx) => (
                    <div key={idx} className="text-sm mobile-text-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                        <span className="font-medium text-fradiavolo-charcoal">{m.prodotto}</span>
                        <span className="hidden sm:inline text-fradiavolo-charcoal-light">→</span>
                        <span className="text-fradiavolo-red font-medium">
                          {m.codiceDestinazione ? `${m.codiceDestinazione} - ` : ''}{m.verso}
                        </span>
                        <span className="text-fradiavolo-green font-medium">
                          {m.quantita} {m.uom}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {storico.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl shadow-fradiavolo p-6 sm:p-8 border border-fradiavolo-cream-dark text-center">
          <div className="text-fradiavolo-charcoal-light">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Nessuna movimentazione trovata</h3>
            <p className="text-fradiavolo-charcoal-light text-sm sm:text-base">
              <span className="hidden sm:inline">Le movimentazioni registrate da {codiceOrigine} - {puntoOrigine} appariranno qui</span>
              <span className="sm:hidden">Le movimentazioni da {codiceOrigine} appariranno qui</span>
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default Movimentazione;
