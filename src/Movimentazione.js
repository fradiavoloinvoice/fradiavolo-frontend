import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FileText, Edit3, Save, X, Download, Eye, EyeOff, 
  ChevronDown, ChevronRight, Package, MapPin, Calendar,
  Hash, CheckCircle, RefreshCw, Plus
} from 'lucide-react';
import negoziData from './data/negozi.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// =======================
// Helpers formattazione TXT
// =======================
const format15 = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '0.000000000000000';
  return n.toFixed(15);
};

const toBaseUnit = (qty, uom) => {
  return Number(qty || 0);
};

const Movimentazione = ({ user }) => {
  const puntoOrigine = user?.puntoVendita || 'Non definito';

  // Destinazione unica per movimentazione
  const [destinazione, setDestinazione] = useState(null);

  // Stato righe da movimentare
  const [movimenti, setMovimenti] = useState([
    { prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }
  ]);

  // Storico (raggruppato per DDT)
  const [storico, setStorico] = useState([]);
  const [expandedDDTs, setExpandedDDTs] = useState(new Set());

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
      nome: n.nome,
      indirizzo: n.indirizzo || ''
    }));

  // Toggle espansione DDT
  const toggleDDT = (ddtId) => {
    const newExpanded = new Set(expandedDDTs);
    if (newExpanded.has(ddtId)) {
      newExpanded.delete(ddtId);
    } else {
      newExpanded.add(ddtId);
    }
    setExpandedDDTs(newExpanded);
  };

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

      // Raggruppa per DDT
      const byDDT = {};
      (json?.data || []).forEach(m => {
        const key = m.ddt_number || `DDT_${m.timestamp}`;
        if (!byDDT[key]) {
          byDDT[key] = {
            id: key,
            ddt_number: key,
            data: m.data_movimento,
            timestamp: m.timestamp,
            origine: m.origine,
            codiceOrigine: m.codice_origine || '',
            destinazione: m.destinazione,
            codiceDestinazione: m.codice_destinazione || '',
            movimenti: []
          };
        }
        byDDT[key].movimenti.push({
          prodotto: m.prodotto,
          uom: m.unita_misura,
          quantita: m.quantita,
          verso: m.destinazione,
          codiceDestinazione: m.codice_destinazione
        });
      });

      const items = Object.values(byDDT).sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
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

      options.sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }));
      setProdottiOptions(options);
    } catch (e) {
      console.error('Errore prodotti:', e);
      setError('Errore nel caricamento dei prodotti: ' + e.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Helpers UI =====
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

  const aggiungiRiga = () => {
    setMovimenti([
      ...movimenti,
      { prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }
    ]);
  };

  const rimuoviRiga = (index) => {
    if (movimenti.length === 1) {
      setMovimenti([{ prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }]);
    } else {
      setMovimenti(movimenti.filter((_, i) => i !== index));
    }
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

  // ===== PDF & Salvataggio =====
  const generaPDF = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      if (!destinazione?.nome) {
        setError('Seleziona una destinazione per la movimentazione.');
        return;
      }

      const timestamp = new Date();
      const ddtNumber = `${String(Date.now()).slice(-4)}/${timestamp.getFullYear()}`;
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

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DOCUMENTO DI TRASPORTO', 105, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`N. DDT: ${ddtNumber}`, 105, 28);
      doc.text(`Data: ${dataFormattata}`, 105, 35);

      doc.setDrawColor(211, 47, 47);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      const puntoOrigineObj = negoziData.find(n => n.nome === puntoOrigine);
      let yPos = 52;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('MITTENTE', 20, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${puntoOrigineObj?.nome || puntoOrigine} (${puntoOrigineObj?.codice || ''})`, 20, yPos + 6);
      doc.text(puntoOrigineObj?.indirizzo || '', 20, yPos + 12);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DESTINATARIO', 75, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      if (destinazione) {
        doc.text(`${destinazione.nome} (${destinazione.codice})`, 75, yPos + 6);
        doc.text(destinazione.indirizzo || '', 75, yPos + 12);
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CAUSALE TRASPORTO', 130, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Trasferimento merce tra punti vendita', 130, yPos + 6);
      doc.text('Trasporto a cura del mittente', 130, yPos + 12);

      const tableStartY = yPos + 25;
      const tableData = movimenti
        .filter(m => m.prodotto && m.quantita)
        .map((m, idx) => ([
          (idx + 1).toString(),
          m.prodotto.value || m.prodotto.label || '-',
          m.quantita.toString(),
          m.prodotto?.uom || '-',
          `${destinazione.codice} - ${destinazione.nome}`
        ]));

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
        styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [211, 47, 47], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 85, halign: 'left' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 43, halign: 'left' }
        },
        margin: { left: leftMargin, right: leftMargin },
      });

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

      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Documento generato automaticamente dal sistema Fradiavolo Invoice Manager', 105, 280, { align: 'center' });

      const nomeFile = `DDT_${ddtNumber.replace('/', '-')}_${puntoOrigineObj?.codice || 'ORIG'}_${dataFormattata.replace(/\//g, '-')}.pdf`;
      doc.save(nomeFile);

      const payload = movimenti
        .filter(m => m.prodotto && m.quantita)
        .map((m) => {
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
            destinazione: destinazione.nome,
            codice_destinazione: destinazione.codice,
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
        body: JSON.stringify({ movimenti: payload, origine: puntoOrigine, ddt_number: ddtNumber })
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`Errore ${res.status}: ${text}`);

      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Risposta non JSON: ${text}`); }

      await saveUnifiedTxtFile(payload);

      setSuccess(data?.message || `✅ DDT ${ddtNumber} generato e movimentazione salvata!`);
      await loadStorico();

      setMovimenti([{ prodotto: null, quantita: '', txtContent: '', showTxtEditor: false, isEditingTxt: false }]);
      setDestinazione(null);
    } catch (err) {
      console.error('Errore generazione DDT:', err);
      setError('Errore nella generazione DDT: ' + err.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccess(''); setError(''); }, 8000);
    }
  };

  const regenerateDDT = (entry) => {
    try {
      const timestamp = new Date(entry.timestamp);
      const ddtNumber = entry.ddt_number || `${String(Date.parse(entry.timestamp)).slice(-4)}/${timestamp.getFullYear()}`;
      const dataFormattata = timestamp.toLocaleDateString('it-IT');

      const doc = new jsPDF();

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
      doc.text('DOCUMENTO DI TRASPORTO', 105, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`N. DDT: ${ddtNumber}`, 105, 28);
      doc.text(`Data: ${dataFormattata}`, 105, 35);

      doc.setDrawColor(211, 47, 47);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      const puntoOrigineObj = negoziData.find(n => n.nome === entry.origine);
      const destObj = negoziData.find(n => n.nome === entry.destinazione);

      let yPos = 52;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('MITTENTE', 20, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${puntoOrigineObj?.nome || entry.origine} (${puntoOrigineObj?.codice || ''})`, 20, yPos + 6);
      doc.text(puntoOrigineObj?.indirizzo || '', 20, yPos + 12);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('DESTINATARIO', 75, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      if (destObj) {
        doc.text(`${destObj.nome} (${destObj.codice})`, 75, yPos + 6);
        doc.text(destObj.indirizzo || '', 75, yPos + 12);
      } else if (entry.destinazione) {
        doc.text(`${entry.destinazione}`, 75, yPos + 6);
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(211, 47, 47);
      doc.text('CAUSALE TRASPORTO', 130, yPos);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Trasferimento merce tra punti vendita', 130, yPos + 6);
      doc.text('Trasporto a cura del mittente', 130, yPos + 12);

      const tableStartY = yPos + 25;
      const tableData = entry.movimenti.map((m, idx) => ([
        (idx + 1).toString(),
        m.prodotto,
        String(m.quantita),
        m.uom || '-',
        `${entry.codiceDestinazione ? entry.codiceDestinazione + ' - ' : ''}${entry.destinazione || ''}`
      ]));

      const targetRows = Math.max(10, tableData.length + 5);
      while (tableData.length < targetRows) {
        tableData.push(['', '', '', '', '']);
      }

      autoTable(doc, {
        head: [['#', 'Descrizione Prodotto', 'Qta', 'U.M.', 'Destinazione']],
        body: tableData,
        startY: tableStartY,
        styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [211, 47, 47], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 85, halign: 'left' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 43, halign: 'left' }
        },
        margin: { left: 30, right: 30 },
      });

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

      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Documento generato automaticamente dal sistema Fradiavolo Invoice Manager', 105, 280, { align: 'center' });

      return doc;
    } catch (error) {
      console.error('Errore rigenerazione DDT:', error);
      return null;
    }
  };

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

  const handleDownloadDDT = (entry) => {
    const doc = regenerateDDT(entry);
    if (doc) {
      const timestamp = new Date(entry.timestamp);
      const ddtNumber = entry.ddt_number || `${String(Date.parse(entry.timestamp)).slice(-4)}/${timestamp.getFullYear()}`;
      const dataFormattata = timestamp.toLocaleDateString('it-IT');
      const nomeFile = `DDT_${String(ddtNumber).replace('/', '-')}_${codiceOrigine}_${dataFormattata.replace(/\//g, '-')}.pdf`;
      doc.save(nomeFile);
    } else {
      setError('Errore nel download del DDT');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-fradiavolo-charcoal">Movimentazioni tra Negozi</h2>
          <p className="text-fradiavolo-charcoal-light">
            Origine: <span className="font-semibold text-fradiavolo-red">{codiceOrigine} - {puntoOrigine}</span>
          </p>
        </div>

        <button
          onClick={loadStorico}
          disabled={isLoading}
          className="inline-flex items-center space-x-2 px-3 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Ricarica</span>
        </button>
      </div>

      {/* Alert */}
      {error && (
        <div className="p-3 rounded-xl border bg-red-50 text-red-800 border-red-200">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30">{success}</div>
      )}

      {/* Form Nuova Movimentazione */}
      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark p-6">
        <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-4 pb-3 border-b border-fradiavolo-cream-dark">
          Nuova Movimentazione
        </h3>

        {/* Destinazione unica */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2 uppercase tracking-wide">
            Destinazione
          </label>
          <Select
            options={negoziOptions}
            placeholder="Seleziona punto vendita di destinazione..."
            value={destinazione}
            onChange={(val) => setDestinazione(val)}
            className="text-sm"
            isSearchable
            noOptionsMessage={() => "Nessun negozio trovato"}
            styles={{
              control: (base) => ({
                ...base,
                minHeight: '44px',
                borderColor: '#E5C5A0',
                '&:hover': { borderColor: '#D32F2F' }
              })
            }}
          />
        </div>

        {/* Righe prodotti */}
        <div className="space-y-4 mb-6">
          {movimenti.map((mov, index) => (
            <div key={index} className="border border-fradiavolo-cream-dark rounded-xl p-4 bg-fradiavolo-cream/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                    <Package className="h-3 w-3 inline mr-1" />
                    Prodotto
                  </label>
                  <Select
                    options={prodottiOptions}
                    placeholder={isLoadingProdotti ? "Caricando..." : "Cerca prodotto..."}
                    value={mov.prodotto}
                    onChange={(val) => aggiornaRiga(index, 'prodotto', val)}
                    className="text-sm"
                    isSearchable
                    isLoading={isLoadingProdotti}
                    isDisabled={isLoadingProdotti}
                    noOptionsMessage={() => "Nessun prodotto trovato"}
                    filterOption={(option, rawInput) => {
                      const q = (rawInput || '').toLowerCase();
                      const o = option.data || option;
                      const haystack = [
                        option.label, option.value,
                        o?.nome, o?.brand, o?.pack, o?.materiale, o?.codice, o?.uom
                      ].filter(Boolean).join(' ').toLowerCase();
                      return haystack.includes(q);
                    }}
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '40px',
                        borderColor: '#E5C5A0',
                        '&:hover': { borderColor: '#D32F2F' }
                      })
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">
                    <Hash className="h-3 w-3 inline mr-1" />
                    Quantità {mov.prodotto && `(${mov.prodotto.uom})`}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className="flex-1 border border-fradiavolo-cream-dark p-2.5 rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                      placeholder="Es: 24"
                      value={mov.quantita}
                      onChange={(e) => aggiornaRiga(index, 'quantita', e.target.value)}
                    />
                    {movimenti.length > 1 && (
                      <button
                        onClick={() => rimuoviRiga(index)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Rimuovi riga"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor TXT */}
              {mov.prodotto && (
                <div className="border-t border-fradiavolo-cream-dark pt-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-fradiavolo-charcoal flex items-center space-x-1">
                      <FileText className="h-3 w-3" />
                      <span>Contenuto TXT</span>
                    </h4>
                    <button
                      onClick={() => toggleTxtEditor(index)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors"
                    >
                      {mov.showTxtEditor ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{mov.showTxtEditor ? 'Nascondi' : 'Mostra'}</span>
                    </button>
                  </div>

                  {mov.showTxtEditor && (
                    <div className="bg-white rounded-lg border border-fradiavolo-cream-dark p-3">
                      {mov.isEditingTxt ? (
                        <div className="space-y-2">
                          <textarea
                            defaultValue={mov.txtContent}
                            id={`txt-editor-${index}`}
                            rows="4"
                            className="w-full border border-fradiavolo-cream-dark p-2 rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors font-mono text-xs"
                            placeholder="Contenuto TXT..."
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                const newContent = document.getElementById(`txt-editor-${index}`).value;
                                saveTxtContent(index, newContent);
                              }}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-fradiavolo-green text-white rounded-lg hover:bg-fradiavolo-green-dark transition-colors text-xs"
                            >
                              <Save className="h-3 w-3" />
                              <span>Salva</span>
                            </button>
                            <button
                              onClick={() => cancelTxtEdit(index)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors text-xs"
                            >
                              <X className="h-3 w-3" />
                              <span>Annulla</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="bg-fradiavolo-cream p-2 rounded border border-fradiavolo-cream-dark">
                            <pre className="text-xs text-fradiavolo-charcoal font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {mov.txtContent || 'Nessun contenuto'}
                            </pre>
                          </div>
                          <button
                            onClick={() => startEditingTxt(index)}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors text-xs"
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
        </div>

        {/* Bottoni azione */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-fradiavolo-cream-dark">
          <button
            onClick={aggiungiRiga}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Aggiungi prodotto</span>
          </button>

          <button
            onClick={generaPDF}
            disabled={
              isLoading ||
              !destinazione ||
              movimenti.every(m => !m.prodotto || !m.quantita)
            }
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Genera DDT e Salva</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Storico Movimentazioni */}
      <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
        <div className="p-4 border-b border-fradiavolo-cream-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal">
            Movimentazioni ({storico.length})
          </h3>
          <p className="text-sm text-fradiavolo-charcoal-light">
            Solo da {codiceOrigine}
          </p>
        </div>

        {storico.length === 0 ? (
          <div className="p-8 text-center text-fradiavolo-charcoal-light">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessuna movimentazione registrata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-fradiavolo-cream">
                <tr className="text-left text-fradiavolo-charcoal">
                  <th className="px-4 py-3 w-12"></th>
                  <th className="px-4 py-3">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Data
                  </th>
                  <th className="px-4 py-3">
                    <Hash className="h-4 w-4 inline mr-1" />
                    DDT
                  </th>
                  <th className="px-4 py-3">
                    <Package className="h-4 w-4 inline mr-1" />
                    Articoli
                  </th>
                  <th className="px-4 py-3">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Origine
                  </th>
                  <th className="px-4 py-3">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Destinazione
                  </th>
                  <th className="px-4 py-3">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    Stato
                  </th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {storico.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="border-t border-fradiavolo-cream-dark/50 hover:bg-fradiavolo-cream/20 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleDDT(entry.id)}
                          className="p-1 hover:bg-fradiavolo-cream rounded transition-colors"
                        >
                          {expandedDDTs.has(entry.id) ? (
                            <ChevronDown className="h-4 w-4 text-fradiavolo-charcoal" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-fradiavolo-charcoal" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-fradiavolo-charcoal-light">
                        {entry.data}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-fradiavolo-red">
                          {entry.ddt_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-fradiavolo-cream px-3 py-1 text-xs font-semibold text-fradiavolo-charcoal">
                          {entry.movimenti.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-lg bg-fradiavolo-cream px-2 py-1 text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark">
                            {entry.codiceOrigine}
                          </span>
                          <span className="text-fradiavolo-charcoal-light text-xs">
                            {entry.origine}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-lg bg-fradiavolo-cream px-2 py-1 text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark">
                            {entry.codiceDestinazione}
                          </span>
                          <span className="text-fradiavolo-charcoal-light text-xs">
                            {entry.destinazione}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-fradiavolo-green/10 px-3 py-1 text-xs font-semibold text-fradiavolo-green-dark border border-fradiavolo-green/30">
                          <CheckCircle className="h-3 w-3" />
                          Registrato
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleViewDDT(entry)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            Visualizza
                          </button>
                          <button
                            onClick={() => handleDownloadDDT(entry)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-fradiavolo-red text-white rounded-lg hover:bg-fradiavolo-red-dark transition-colors"
                          >
                            <Download className="h-3 w-3" />
                            Scarica
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Dettaglio espandibile */}
                    {expandedDDTs.has(entry.id) && (
                      <tr className="border-t border-fradiavolo-cream-dark/50 bg-fradiavolo-cream/10">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="ml-12 space-y-2">
                            <h4 className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide mb-3">
                              Dettaglio Prodotti
                            </h4>
                            <div className="space-y-2">
                              {entry.movimenti.map((m, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-fradiavolo-cream-dark">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-fradiavolo-charcoal-light">
                                      #{idx + 1}
                                    </span>
                                    <span className="text-sm font-medium text-fradiavolo-charcoal">
                                      {m.prodotto}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-fradiavolo-green">
                                      {m.quantita} {m.uom}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== TXT unico =====
const saveUnifiedTxtFile = async (movimentiPayload) => {
  try {
    const token = localStorage.getItem('token');
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const lines = movimentiPayload.map(m => (m.txt_content || '').trim()).filter(Boolean);
    const content = lines.join('\n');

    const dataOggi = new Date().toISOString().split('T')[0];
    const nomeFile = `MOV_${dataOggi}-${movimentiPayload[0]?.codice_origine || 'ORIG'}-${movimentiPayload[0]?.codice_destinazione || 'DEST'}-ALL.txt`;

    const response = await fetch(`${API_BASE_URL}/txt-files/create`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: nomeFile,
        content,
        type: 'movimentazione'
      })
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`Errore salvataggio TXT: ${t}`);
    }

    console.log(`✅ File TXT unico salvato: ${nomeFile}`);
  } catch (error) {
    console.error('❌ Errore generale salvataggio file TXT:', error);
  }
};

export default Movimentazione;
