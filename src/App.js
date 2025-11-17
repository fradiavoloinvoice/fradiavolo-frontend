import React, { useState, useRef, useEffect } from 'react';
import { FileText, Eye, Edit3, Download, CheckCircle, AlertCircle, LogOut, User, Users, Clock, Package, MessageCircle, Save, X, RefreshCw, Truck, HardDrive } from 'lucide-react';
import Movimentazione from './Movimentazione';
import AdminDashboard from './components/AdminDashboard';
import AdminInvoiceManager from './components/AdminInvoiceManager';
import AdminMovimentazioniManager from './components/AdminMovimentazioniManager';
import AdminUserManager from './components/AdminUserManager';
import TxtFilesManager from './TxtFilesManager';
import AdminSidebarLayout from './components/AdminSidebarLayout';
import negoziData from './data/negozi.json';

// ==========================================
// ✅ NUOVO: Unità di misura supportate
// ==========================================
const UNITA_MISURA = [
  { value: 'KG', label: 'KG - Kilogrammi' },
  { value: 'GR', label: 'GR - Grammi' },
  { value: 'LT', label: 'LT - Litri' },
  { value: 'ML', label: 'ML - Millilitri' },
  { value: 'PZ', label: 'PZ - Pezzi' },
  { value: 'CF', label: 'CF - Confezioni' },
  { value: 'CAR', label: 'CAR - Cartoni' },
  { value: 'KAR', label: 'KAR - Kartoni' },
  { value: 'BAR', label: 'BAR - Barattoli' },
  { value: 'SAC', label: 'SAC - Sacchi' },
  { value: 'FT', label: 'FT - Fusti' },
  { value: 'BOT', label: 'BOT - Bottiglie' },
  { value: 'LAT', label: 'LAT - Lattine' }
];

// Normalizza input date in YYYY-MM-DD (accetta anche DD/MM/YYYY)
function toISODate(raw) {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
console.log('🔍 API_BASE_URL configurato:', API_BASE_URL);

const InvoiceProcessorApp = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [sheetInvoices, setSheetInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('admin-dashboard');
  const [editingInvoice, setEditingInvoice] = useState(null);

  // ==========================================
  // ✅ NUOVO: Stati per modal errori avanzato
  // ==========================================
  const [errorModalData, setErrorModalData] = useState(null);
  const [parsedProdotti, setParsedProdotti] = useState([]);
  const [modificheProdotti, setModificheProdotti] = useState([]);
  const [noteErrori, setNoteErrori] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStoreForConfirmation, setSelectedStoreForConfirmation] = useState('');
  const [availableStores, setAvailableStores] = useState(negoziData);

  const getStoreEmail = (storeName) => {
    if (!storeName) return '';
    const negozio = (availableStores || negoziData).find(n => n.nome === storeName);
    return negozio?.email || '';
  };

  useEffect(() => {
    if (token) verifyToken();
  }, [token]);

  useEffect(() => {
    if (user && (activeTab === 'pending' || activeTab === 'delivered')) {
      loadInvoicesFromSheet();
    }
  }, [user, activeTab]);

  const loadAvailableStores = async () => {
    try {
      const token = localStorage.getItem('token');
      const authHeader = token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/admin/stores`, {
        headers: { 'Authorization': authHeader }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableStores(data.stores || []);
      }
    } catch (error) {
      console.error('Errore caricamento negozi:', error);
    }
  };

  useEffect(() => {
    if (user && !activeTab) {
      if (user.role === 'admin') {
        setActiveTab('admin-dashboard');
      } else {
        setActiveTab('pending');
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user && (activeTab === 'pending' || activeTab === 'delivered')) {
      const interval = setInterval(() => {
        loadInvoicesFromSheet();
      }, 600000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab]);

  const apiCall = async (endpoint, options = {}) => {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(fullUrl, config);
      const text = await response.text();

      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error('Server ha restituito HTML invece di JSON');
      }

      const data = JSON.parse(text);
      if (!response.ok) {
        throw new Error(data.error || 'Errore nella richiesta');
      }
      return data;
    } catch (error) {
      console.error('🔍 Errore API:', error);
      throw error;
    }
  };

  const verifyToken = async () => {
    try {
      const response = await apiCall('/auth/verify');
      setUser(response.user);
      if (response.user?.role === 'admin') {
        loadAvailableStores();
      }
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const loadInvoicesFromSheet = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/invoices`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Errore ${response.status}`);

      const data = await response.json();
      const uniqueInvoices = data.data.filter((invoice, index, self) =>
        index === self.findIndex(i => i.id === invoice.id)
      );

      setSheetInvoices(uniqueInvoices);
      setError('');
    } catch (error) {
      console.error('❌ Errore caricamento:', error);
      setError('Impossibile caricare le fatture: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });

      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('token', response.token);
        setActiveTab('pending');
        setSuccess('Login effettuato con successo!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Errore logout:', error);
    }

    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoginForm({ email: '', password: '' });
    setActiveTab('pending');
    setSelectedInvoice(null);
    setEditingInvoice(null);
    setSheetInvoices([]);
    setSuccess('Logout effettuato con successo!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const confirmDelivery = async (invoiceId, deliveryDate, noteErrori = '', customEmail = null) => {
    try {
      setIsLoading(true);
      const emailToUse = customEmail || user.email;

      await apiCall(`/invoices/${invoiceId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          data_consegna: toISODate(deliveryDate),
          note_errori: noteErrori,
          confermato_da_email: emailToUse
        })
      });

      setSheetInvoices(prev => prev.map(inv =>
        inv.id.toString() === invoiceId.toString()
          ? {
              ...inv,
              stato: 'consegnato',
              data_consegna: toISODate(deliveryDate),
              confermato_da: emailToUse,
              note: noteErrori || inv.note || ''
            }
          : inv
      ));

      setSuccess(noteErrori
        ? '⚠️ Consegna confermata con note di errore! 📄 File TXT generato automaticamente.'
        : '✅ Consegna confermata con successo! 📄 File TXT generato automaticamente.'
      );

      setTimeout(() => loadInvoicesFromSheet(), 2000);
      setTimeout(() => setSuccess(''), 8000);
    } catch (error) {
      setError('❌ Errore nella conferma: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const updateInvoice = async (invoiceId, updates) => {
    try {
      setIsLoading(true);

      if (!updates.data_consegna) {
        setError('❌ Data di consegna richiesta');
        setTimeout(() => setError(''), 3000);
        return;
      }

      if (!updates.confermato_da) {
        setError('❌ Email di conferma richiesta');
        setTimeout(() => setError(''), 3000);
        return;
      }

      await apiCall(`/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      setSheetInvoices(prev => prev.map(inv =>
        inv.id.toString() === invoiceId.toString()
          ? { ...inv, ...updates }
          : inv
      ));

      setSuccess('✅ Fattura aggiornata con successo!');
      setEditingInvoice(null);

      setTimeout(() => {
        loadInvoicesFromSheet();
      }, 3000);

      setTimeout(() => setSuccess(''), 8000);
    } catch (error) {
      setError('❌ Errore aggiornamento: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // ✅ NUOVO: Funzione per aprire modal errori avanzato
  // ==========================================
  const openErrorModal = async (invoice, deliveryDate) => {
    try {
      setIsLoading(true);

      // Chiama API per parsing DDT
      const response = await apiCall(`/invoices/${invoice.id}/parse-ddt`);
      
      if (response.success) {
        // Inizializza modifiche con valori originali
        const inizializzaModifiche = response.prodotti.map(p => ({
          ...p,
          quantita_ricevuta: p.quantita,
          um_ricevuta: p.um,
          modificato: false
        }));
        
        setErrorModalData({
          ...invoice,
          deliveryDate,
          fatturaInfo: response.fattura,
          testo_originale: response.testo_originale
        });
        setParsedProdotti(response.prodotti);
        setModificheProdotti(inizializzaModifiche);
        setNoteErrori('');
      }
    } catch (error) {
      setError('Impossibile caricare i prodotti del DDT: ' + error.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // ✅ NUOVO: Funzione per gestire modifiche prodotto
  // ==========================================
  const handleProdottoChange = (rigaNumero, campo, valore) => {
    setModificheProdotti(prev => prev.map(p => {
      if (p.riga_numero === rigaNumero) {
        const updated = { ...p, [campo]: valore };

        // Determina se è stato modificato
        const originale = parsedProdotti.find(orig => orig.riga_numero === rigaNumero);
        updated.modificato = (
          updated.quantita_ricevuta !== originale.quantita ||
          updated.um_ricevuta !== originale.um
        );
        
        return updated;
      }
      return p;
    }));
  };

  // ==========================================
  // ✅ NUOVO: Funzione per inviare report errori
  // ==========================================
  const submitErrorReport = async () => {
    try {
      // Validazione
      const hasModifiche = modificheProdotti.some(m => m.modificato);
      const hasNote = noteErrori.trim() !== '';

      if (!hasModifiche && !hasNote) {
        setError('⚠️ Inserisci almeno una modifica o una nota testuale');
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      setIsLoading(true);
      
      // Prepara payload
      const payload = {
        data_consegna: toISODate(errorModalData.deliveryDate),
        modifiche_righe: modificheProdotti.map(p => ({
          riga_numero: p.riga_numero,
          codice: p.codice,
          nome: p.nome,
          originale: {
            quantita: p.quantita,
            um: p.um
          },
          ricevuto: {
            quantita: p.quantita_ricevuta,
            um: p.um_ricevuta
          },
          modificato: p.modificato
        })),
        note_testuali: noteErrori
      };
      
      // Invia a backend
      await apiCall(`/invoices/${errorModalData.id}/report-error`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      // Aggiorna stato locale
      setSheetInvoices(prev => prev.map(inv =>
        inv.id === errorModalData.id
          ? {
              ...inv,
              stato: 'consegnato',
              data_consegna: payload.data_consegna,
              confermato_da: user.email,
              note: noteErrori
            }
          : inv
      ));
      
      setSuccess('⚠️ Errori registrati e comunicati con successo!');
      setTimeout(() => setSuccess(''), 5000);
      
      // Chiudi modal
      setErrorModalData(null);
      setParsedProdotti([]);
      setModificheProdotti([]);
      setNoteErrori('');
      
      // Ricarica dati
      setTimeout(() => loadInvoicesFromSheet(), 2000);
      
    } catch (error) {
      setError('Impossibile inviare il report errori: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (requiredPermission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.includes(requiredPermission);
  };

  const isOldInvoice = (dateString) => {
    const invoiceDate = new Date(dateString);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    return invoiceDate < fiveDaysAgo;
  };

  const LoadingSpinner = () => (
    <div className="inline-flex items-center justify-center">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
    </div>
  );

  const AlertMessage = ({ type, message, onClose }) => (
    <div className={`mb-4 p-4 rounded-xl border flex items-center justify-between shadow-lg ${
      type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
      type === 'success' ? 'bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30' :
      'bg-blue-50 text-blue-800 border-blue-200'
    }`}>
      <div className="flex items-center space-x-3">
        {type === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
        {type === 'success' && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
        <span className="font-medium">{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-70 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fradiavolo-cream via-white to-fradiavolo-cream-dark flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-fradiavolo-lg p-8 w-full max-w-md border border-fradiavolo-cream-dark">
          <div className="text-center mb-8">
            <div className="p-4 bg-fradiavolo-red rounded-2xl w-fit mx-auto mb-6 shadow-fradiavolo">
              <div className="text-white text-4xl">🍕</div>
            </div>
            <h1 className="text-3xl font-bold text-fradiavolo-charcoal mb-2">Fradiavolo Invoice</h1>
            <p className="text-fradiavolo-charcoal-light font-medium">Dashboard Consegna Merce</p>
            <div className="mt-4 text-sm text-fradiavolo-red font-medium">
              Pizza Contemporanea • Qualità Italiana
            </div>
          </div>

          {loginError && <AlertMessage type="error" message={loginError} onClose={() => setLoginError('')} />}
          {success && <AlertMessage type="success" message={success} />}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Email aziendale</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                placeholder="utente@azienda.it"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-fradiavolo-red text-white py-3 px-6 rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105"
            >
              {isLoading ? <LoadingSpinner /> : <span>Accedi alla Dashboard</span>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pendingInvoices = sheetInvoices.filter(inv => inv.stato === 'pending');
  const deliveredInvoices = sheetInvoices.filter(inv => inv.stato === 'consegnato');

  // Render del bottone "Con Errori"
  const renderErrorButton = (invoice) => (
    <button
      onClick={() => {
        const dateInput = document.getElementById(`delivery-date-${invoice.id}`);
        const raw = dateInput?.value || '';
        const iso = toISODate(raw);
        if (!iso) {
          setError('⚠️ Inserisci una data di consegna valida');
          setTimeout(() => setError(''), 3000);
          return;
        }
        openErrorModal(invoice, iso);
      }}
      disabled={isLoading}
      className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
    >
      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="text-sm sm:text-base">Con Errori</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-fradiavolo-cream via-white to-fradiavolo-cream-dark">
      {/* Header */}
      <div className="bg-white shadow-fradiavolo border-b border-fradiavolo-cream-dark">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4 mobile-header">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="p-2 sm:p-3 bg-fradiavolo-red rounded-xl sm:rounded-2xl shadow-fradiavolo">
                <div className="h-5 w-5 sm:h-8 sm:w-8 text-white text-center text-base sm:text-2xl">🍕</div>
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-fradiavolo-charcoal mobile-header-title">
                  Fradiavolo Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-fradiavolo-red font-medium hidden sm:block">
                  Punto vendita: {user.puntoVendita}
                </p>
                <p className="text-xs text-fradiavolo-red font-medium sm:hidden mobile-email">
                  {user.puntoVendita.replace('FDV ', '')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {(activeTab === 'pending' || activeTab === 'delivered') && (
                <button
                  onClick={loadInvoicesFromSheet}
                  disabled={isLoading}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg mobile-button-sm mobile-touch-feedback"
                  title="Ricarica dati"
                >
                  <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:block text-sm">Aggiorna</span>
                </button>
              )}

              <div className="hidden sm:flex items-center space-x-2 text-sm text-fradiavolo-charcoal bg-fradiavolo-cream px-3 py-2 rounded-lg border border-fradiavolo-cream-dark">
                <User className="h-4 w-4" />
                <span className="mobile-email">{user.email}</span>
              </div>

              <div className="sm:hidden flex items-center space-x-1 text-xs text-fradiavolo-charcoal bg-fradiavolo-cream px-2 py-1 rounded-lg border border-fradiavolo-cream-dark">
                <User className="h-3 w-3" />
                <span className="mobile-email-short">{user.email.split('@')[0]}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg mobile-button-sm mobile-touch-feedback"
                title="Logout"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:block text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
        {success && <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        {user.role === 'admin' ? (
          <AdminSidebarLayout 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
          >
            {activeTab === 'admin-dashboard' && <AdminDashboard />}
            {activeTab === 'admin-users' && <AdminUserManager />}
            {activeTab === 'admin-invoices' && <AdminInvoiceManager />}
            {activeTab === 'admin-movimentazioni' && <AdminMovimentazioniManager />}
            {activeTab === 'admin-txt-files' && <TxtFilesManager />}
            {activeTab === 'movimentazione' && <Movimentazione />}
            {activeTab === 'pending' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-fradiavolo-charcoal">Fatture In Attesa</h2>
                  <span className="px-4 py-2 bg-fradiavolo-orange/10 text-fradiavolo-orange rounded-xl font-semibold border border-fradiavolo-orange/30">
                    {pendingInvoices.length} fatture
                  </span>
                </div>

                {pendingInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto text-fradiavolo-charcoal-light mb-4" />
                    <p className="text-fradiavolo-charcoal-light text-lg">Nessuna fattura in attesa</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {pendingInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="bg-white rounded-2xl shadow-fradiavolo-lg border border-fradiavolo-cream-dark overflow-hidden hover:shadow-fradiavolo transition-all"
                      >
                        <div className="p-6">
                          {/* Invoice Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-fradiavolo-red/10 rounded-xl border border-fradiavolo-red/20">
                                <FileText className="h-6 w-6 text-fradiavolo-red" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-fradiavolo-charcoal">
                                  {invoice.numero}
                                </h3>
                                <p className="text-fradiavolo-charcoal-light">
                                  {invoice.fornitore}
                                </p>
                              </div>
                            </div>
                            
                            <span className="px-4 py-2 bg-fradiavolo-orange/10 text-fradiavolo-orange rounded-xl font-semibold text-sm border border-fradiavolo-orange/30 w-fit">
                              ⏳ In Attesa
                            </span>
                          </div>

                          {/* Invoice Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Data Fattura</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.data_fattura}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Importo</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                €{invoice.importo}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Punto Vendita</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.punto_vendita}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Caricato</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.timestamp ? new Date(invoice.timestamp).toLocaleDateString('it-IT') : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="border-t border-fradiavolo-cream-dark pt-6">
                            <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                              Data di consegna <span className="text-fradiavolo-red">*</span>
                            </label>
                            <input
                              type="date"
                              id={`delivery-date-${invoice.id}`}
                              max={new Date().toISOString().split('T')[0]}
                              className="w-full max-w-xs px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors mb-4"
                            />

                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => {
                                  const dateInput = document.getElementById(`delivery-date-${invoice.id}`);
                                  const raw = dateInput?.value || '';
                                  const iso = toISODate(raw);
                                  if (!iso) {
                                    setError('⚠️ Inserisci una data di consegna valida');
                                    setTimeout(() => setError(''), 3000);
                                    return;
                                  }
                                  confirmDelivery(invoice.id, iso);
                                }}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105"
                              >
                                <CheckCircle className="h-5 w-5" />
                                <span>Confermo Tutto OK</span>
                              </button>

                              {renderErrorButton(invoice)}

                              {invoice.file_url && (
  
    href={invoice.file_url}
    target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105"
                                >
                                  <Eye className="h-5 w-5" />
                                  <span>Vedi PDF</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'delivered' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-fradiavolo-charcoal">Fatture Consegnate</h2>
                  <span className="px-4 py-2 bg-fradiavolo-green/10 text-fradiavolo-green-dark rounded-xl font-semibold border border-fradiavolo-green/30">
                    {deliveredInvoices.length} fatture
                  </span>
                </div>

                {deliveredInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 mx-auto text-fradiavolo-charcoal-light mb-4" />
                    <p className="text-fradiavolo-charcoal-light text-lg">Nessuna fattura consegnata</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {deliveredInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="bg-white rounded-2xl shadow-fradiavolo-lg border border-fradiavolo-cream-dark overflow-hidden"
                      >
                        <div className="p-6">
                          {/* Invoice Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-fradiavolo-green/10 rounded-xl border border-fradiavolo-green/20">
                                <CheckCircle className="h-6 w-6 text-fradiavolo-green" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-fradiavolo-charcoal">
                                  {invoice.numero}
                                </h3>
                                <p className="text-fradiavolo-charcoal-light">
                                  {invoice.fornitore}
                                </p>
                              </div>
                            </div>
                            
                            <span className="px-4 py-2 bg-fradiavolo-green/10 text-fradiavolo-green-dark rounded-xl font-semibold text-sm border border-fradiavolo-green/30 w-fit">
                              ✅ Consegnato
                            </span>
                          </div>

                          {/* Invoice Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Data Fattura</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.data_fattura}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Data Consegna</p>
                              <p className="font-semibold text-fradiavolo-green-dark">
                                {invoice.data_consegna}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Importo</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                €{invoice.importo}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Confermato da</p>
                              <p className="font-semibold text-fradiavolo-charcoal text-sm">
                                {invoice.confermato_da || user.email}
                              </p>
                            </div>
                          </div>

                          {invoice.note && (
                            <div className="bg-fradiavolo-orange/10 border border-fradiavolo-orange/30 rounded-xl p-4 mb-4">
                              <div className="flex items-start space-x-3">
                                <AlertCircle className="h-5 w-5 text-fradiavolo-orange flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-fradiavolo-orange mb-1">Note di consegna:</p>
                                  <p className="text-sm text-fradiavolo-charcoal">{invoice.note}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => setEditingInvoice(invoice)}
                              className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105"
                            >
                              <Edit3 className="h-5 w-5" />
                              <span>Modifica</span>
                            </button>

                           {invoice.file_url && (
  
    href={invoice.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105"
                              >
                                <Eye className="h-5 w-5" />
                                <span>Vedi PDF</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </AdminSidebarLayout>
        ) : (
          <>
            {/* User Navigation */}
            <div className="bg-white rounded-2xl shadow-fradiavolo-lg border border-fradiavolo-cream-dark p-2 mb-6">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                    activeTab === 'pending'
                      ? 'bg-fradiavolo-red text-white shadow-lg'
                      : 'text-fradiavolo-charcoal hover:bg-fradiavolo-cream'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>In Attesa ({pendingInvoices.length})</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('delivered')}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                    activeTab === 'delivered'
                      ? 'bg-fradiavolo-red text-white shadow-lg'
                      : 'text-fradiavolo-charcoal hover:bg-fradiavolo-cream'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <span>Consegnate ({deliveredInvoices.length})</span>
                  </div>
                </button>
                {hasPermission('movimentazione') && (
                  <button
                    onClick={() => setActiveTab('movimentazione')}
                    className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                      activeTab === 'movimentazione'
                        ? 'bg-fradiavolo-red text-white shadow-lg'
                        : 'text-fradiavolo-charcoal hover:bg-fradiavolo-cream'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Truck className="h-5 w-5" />
                      <span>Movimentazioni</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'pending' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-fradiavolo-charcoal">Fatture In Attesa</h2>
                  <span className="px-4 py-2 bg-fradiavolo-orange/10 text-fradiavolo-orange rounded-xl font-semibold border border-fradiavolo-orange/30">
                    {pendingInvoices.length} fatture
                  </span>
                </div>

                {pendingInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto text-fradiavolo-charcoal-light mb-4" />
                    <p className="text-fradiavolo-charcoal-light text-lg">Nessuna fattura in attesa</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {pendingInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="bg-white rounded-2xl shadow-fradiavolo-lg border border-fradiavolo-cream-dark overflow-hidden hover:shadow-fradiavolo transition-all"
                      >
                        <div className="p-6">
                          {/* Invoice Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-fradiavolo-red/10 rounded-xl border border-fradiavolo-red/20">
                                <FileText className="h-6 w-6 text-fradiavolo-red" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-fradiavolo-charcoal">
                                  {invoice.numero}
                                </h3>
                                <p className="text-fradiavolo-charcoal-light">
                                  {invoice.fornitore}
                                </p>
                              </div>
                            </div>
                            
                            <span className="px-4 py-2 bg-fradiavolo-orange/10 text-fradiavolo-orange rounded-xl font-semibold text-sm border border-fradiavolo-orange/30 w-fit">
                              ⏳ In Attesa
                            </span>
                          </div>

                          {/* Invoice Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Data Fattura</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.data_fattura}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Importo</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                €{invoice.importo}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Punto Vendita</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.punto_vendita}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Caricato</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.timestamp ? new Date(invoice.timestamp).toLocaleDateString('it-IT') : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="border-t border-fradiavolo-cream-dark pt-6">
                            <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                              Data di consegna <span className="text-fradiavolo-red">*</span>
                            </label>
                            <input
                              type="date"
                              id={`delivery-date-${invoice.id}`}
                              max={new Date().toISOString().split('T')[0]}
                              className="w-full max-w-xs px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors mb-4"
                            />

                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => {
                                  const dateInput = document.getElementById(`delivery-date-${invoice.id}`);
                                  const raw = dateInput?.value || '';
                                  const iso = toISODate(raw);
                                  if (!iso) {
                                    setError('⚠️ Inserisci una data di consegna valida');
                                    setTimeout(() => setError(''), 3000);
                                    return;
                                  }
                                  confirmDelivery(invoice.id, iso);
                                }}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105"
                              >
                                <CheckCircle className="h-5 w-5" />
                                <span>Confermo Tutto OK</span>
                              </button>

                              {renderErrorButton(invoice)}

                             {invoice.file_url && (
  
    href={invoice.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105"
                                >
                                  <Eye className="h-5 w-5" />
                                  <span>Vedi PDF</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'delivered' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-fradiavolo-charcoal">Fatture Consegnate</h2>
                  <span className="px-4 py-2 bg-fradiavolo-green/10 text-fradiavolo-green-dark rounded-xl font-semibold border border-fradiavolo-green/30">
                    {deliveredInvoices.length} fatture
                  </span>
                </div>

                {deliveredInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 mx-auto text-fradiavolo-charcoal-light mb-4" />
                    <p className="text-fradiavolo-charcoal-light text-lg">Nessuna fattura consegnata</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {deliveredInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="bg-white rounded-2xl shadow-fradiavolo-lg border border-fradiavolo-cream-dark overflow-hidden"
                      >
                        <div className="p-6">
                          {/* Invoice Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-fradiavolo-green/10 rounded-xl border border-fradiavolo-green/20">
                                <CheckCircle className="h-6 w-6 text-fradiavolo-green" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-fradiavolo-charcoal">
                                  {invoice.numero}
                                </h3>
                                <p className="text-fradiavolo-charcoal-light">
                                  {invoice.fornitore}
                                </p>
                              </div>
                            </div>
                            
                            <span className="px-4 py-2 bg-fradiavolo-green/10 text-fradiavolo-green-dark rounded-xl font-semibold text-sm border border-fradiavolo-green/30 w-fit">
                              ✅ Consegnato
                            </span>
                          </div>

                          {/* Invoice Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Data Fattura</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                {invoice.data_fattura}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Data Consegna</p>
                              <p className="font-semibold text-fradiavolo-green-dark">
                                {invoice.data_consegna}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Importo</p>
                              <p className="font-semibold text-fradiavolo-charcoal">
                                €{invoice.importo}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-fradiavolo-charcoal-light mb-1">Confermato da</p>
                              <p className="font-semibold text-fradiavolo-charcoal text-sm">
                                {invoice.confermato_da || user.email}
                              </p>
                            </div>
                          </div>

                          {invoice.note && (
                            <div className="bg-fradiavolo-orange/10 border border-fradiavolo-orange/30 rounded-xl p-4 mb-4">
                              <div className="flex items-start space-x-3">
                                <AlertCircle className="h-5 w-5 text-fradiavolo-orange flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-fradiavolo-orange mb-1">Note di consegna:</p>
                                  <p className="text-sm text-fradiavolo-charcoal">{invoice.note}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => setEditingInvoice(invoice)}
                              className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105"
                            >
                              <Edit3 className="h-5 w-5" />
                              <span>Modifica</span>
                            </button>

                            {invoice.file_url && (
  
    href={invoice.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto px-6 py-3 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105"
                              >
                                <Eye className="h-5 w-5" />
                                <span>Vedi PDF</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'movimentazione' && <Movimentazione />}
          </>
        )}
      </div>

      {/* ==========================================
          ✅ NUOVO: Modal Report Errori Avanzato
          ========================================== */}
      {errorModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-fradiavolo-cream-dark">
            
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-fradiavolo-cream-dark p-6 z-10">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-fradiavolo-orange/20 rounded-2xl border border-fradiavolo-orange/30">
                  <AlertCircle className="h-6 w-6 text-fradiavolo-orange" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-fradiavolo-charcoal">
                    Segnala errori di consegna
                  </h3>
                  <p className="text-fradiavolo-charcoal-light mt-1">
                    {errorModalData.fornitore} - <span className="text-fradiavolo-red font-semibold">{errorModalData.numero}</span>
                  </p>
                </div>
              </div>
              
              {/* Data consegna */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Data di consegna <span className="text-fradiavolo-red">*</span>
                </label>
                <input
                  type="date"
                  value={errorModalData.deliveryDate}
                  onChange={(e) => setErrorModalData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full max-w-xs px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
                />
              </div>
            </div>
            
            {/* Body - Lista prodotti */}
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-fradiavolo-charcoal">
                    📦 Prodotti ({parsedProdotti.length} righe)
                  </h4>
                  <div className="text-sm">
                    <span className="text-fradiavolo-orange font-semibold">
                      {modificheProdotti.filter(m => m.modificato).length} modificati
                    </span>
                    <span className="text-fradiavolo-charcoal-light"> su {parsedProdotti.length}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {modificheProdotti.map((prodotto) => {
                    const originale = parsedProdotti.find(p => p.riga_numero === prodotto.riga_numero);
                    return (
                      <div 
                        key={prodotto.riga_numero}
                        className={`border rounded-xl p-4 transition-all ${
                          prodotto.modificato 
                            ? 'border-fradiavolo-orange bg-fradiavolo-orange/5' 
                            : 'border-fradiavolo-cream-dark bg-white'
                        }`}
                      >
                        {/* Intestazione prodotto */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h5 className="font-bold text-fradiavolo-charcoal">
                              <span className="text-fradiavolo-red">{prodotto.codice}</span> - {prodotto.nome}
                            </h5>
                            <p className="text-xs text-fradiavolo-charcoal-light mt-1">
                              Riga {prodotto.riga_numero} del DDT
                            </p>
                          </div>
                          {prodotto.modificato && (
                            <span className="px-2 py-1 bg-fradiavolo-orange/20 text-fradiavolo-orange text-xs font-semibold rounded-full border border-fradiavolo-orange/30">
                              🟡 Modificato
                            </span>
                          )}
                        </div>
                        
                        {/* Valori originali e ricevuti */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Originale (read-only) */}
                          <div className="bg-fradiavolo-cream/50 p-3 rounded-lg border border-fradiavolo-cream-dark">
                            <p className="text-xs font-semibold text-fradiavolo-charcoal-light mb-2">
                              ✓ Come da DDT:
                            </p>
                            <div className="flex items-center space-x-3">
                              <div className="flex-1">
                                <p className="text-xs text-fradiavolo-charcoal-light mb-1">Quantità</p>
                                <p className="text-lg font-bold text-fradiavolo-charcoal">
                                  {originale.quantita}
                                </p>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-fradiavolo-charcoal-light mb-1">UM</p>
                                <p className="text-lg font-bold text-fradiavolo-charcoal">
                                  {originale.um}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Ricevuto (editabile) */}
                          <div className="bg-white p-3 rounded-lg border-2 border-fradiavolo-orange/30">
                            <p className="text-xs font-semibold text-fradiavolo-orange mb-2">
                              ✏️ Ricevuto effettivamente:
                            </p>
                            <div className="flex items-end space-x-3">
                              <div className="flex-1">
                                <label className="text-xs text-fradiavolo-charcoal-light mb-1 block">
                                  Quantità
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={prodotto.quantita_ricevuta}
                                  onChange={(e) => handleProdottoChange(
                                    prodotto.riga_numero, 
                                    'quantita_ricevuta', 
                                    parseFloat(e.target.value) || 0
                                  )}
                                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-fradiavolo-charcoal-light mb-1 block">
                                  UM
                                </label>
                                <select
                                  value={prodotto.um_ricevuta}
                                  onChange={(e) => handleProdottoChange(
                                    prodotto.riga_numero, 
                                    'um_ricevuta', 
                                    e.target.value
                                  )}
                                  className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
                                >
                                  {UNITA_MISURA.map(um => (
                                    <option key={um.value} value={um.value}>
                                      {um.value}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Note aggiuntive */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  📝 Note aggiuntive (opzionale)
                </label>
                <textarea
                  value={noteErrori}
                  onChange={(e) => setNoteErrori(e.target.value)}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors"
                  rows="3"
                  placeholder="Es: Prodotto danneggiato, cliente assente, problemi di qualità..."
                />
                <p className="text-xs text-fradiavolo-charcoal-light mt-2">
                  💡 Puoi inserire solo una nota testuale anche senza modificare le quantità
                </p>
              </div>
            </div>
            
            {/* Footer - Azioni */}
            <div className="sticky bottom-0 bg-fradiavolo-cream border-t border-fradiavolo-cream-dark p-6 flex space-x-3">
              <button
                onClick={() => {
                  setErrorModalData(null);
                  setParsedProdotti([]);
                  setModificheProdotti([]);
                  setNoteErrori('');
                }}
                className="px-6 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
              >
                ❌ Annulla
              </button>
              <button
                onClick={submitErrorReport}
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    <span>Invio in corso...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5" />
                    <span>✅ Comunica Errore</span>
                  </>
                )}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Modal Editing Invoice */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-2xl border border-fradiavolo-cream-dark">
            <div className="p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-fradiavolo-charcoal/10 rounded-2xl">
                  <Edit3 className="h-6 w-6 text-fradiavolo-charcoal" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-fradiavolo-charcoal">
                    Modifica Fattura
                  </h3>
                  <p className="text-fradiavolo-charcoal-light">
                    {editingInvoice.numero}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Data di consegna <span className="text-fradiavolo-red">*</span>
                </label>
                <input
                  type="date"
                  value={editingInvoice.data_consegna || ''}
                  onChange={(e) => setEditingInvoice(prev => ({ ...prev, data_consegna: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                  required
                />
              </div>

              {user.role === 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                    Confermato da (email) <span className="text-fradiavolo-red">*</span>
                  </label>
                  <input
                    type="email"
                    value={editingInvoice.confermato_da || ''}
                    onChange={(e) => setEditingInvoice(prev => ({ ...prev, confermato_da: e.target.value }))}
                    className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Note (opzionale)
                </label>
                <textarea
                  value={editingInvoice.note || ''}
                  onChange={(e) => setEditingInvoice(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                  rows="3"
                  placeholder="Eventuali note o problemi di consegna..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-fradiavolo-cream-dark flex space-x-3">
              <button
                onClick={() => setEditingInvoice(null)}
                className="px-6 py-3 bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal rounded-xl hover:bg-fradiavolo-charcoal/20 transition-all font-semibold"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  const updates = {
                    data_consegna: editingInvoice.data_consegna,
                    confermato_da: editingInvoice.confermato_da || user.email,
                    note: editingInvoice.note || ''
                  };
                  updateInvoice(editingInvoice.id, updates);
                }}
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>Salva Modifiche</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Admin */}
      {user?.role === 'admin' && (
        <footer className="bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange text-white py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
            Modalità Amministratore Attiva — Accesso completo al sistema
          </div>
        </footer>
      )}
    </div>
  );
};

export default InvoiceProcessorApp;
