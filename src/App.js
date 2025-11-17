/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { FileText, Eye, Edit3, CheckCircle, AlertCircle, LogOut, User, Clock, Package, Save, X, RefreshCw, Truck } from 'lucide-react';
import Movimentazione from './Movimentazione';
import AdminDashboard from './components/AdminDashboard';
import AdminInvoiceManager from './components/AdminInvoiceManager';
import AdminMovimentazioniManager from './components/AdminMovimentazioniManager';
import AdminUserManager from './components/AdminUserManager';
import TxtFilesManager from './TxtFilesManager';
import AdminSidebarLayout from './components/AdminSidebarLayout';
import negoziData from './data/negozi.json';

// ==========================================
// ✅ Unità di misura supportate
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('admin-dashboard');
  const [editingInvoice, setEditingInvoice] = useState(null);

  // ==========================================
  // ✅ Stati per modal errori avanzato
  // ==========================================
  const [errorModalData, setErrorModalData] = useState(null);
  const [parsedProdotti, setParsedProdotti] = useState([]);
  const [modificheProdotti, setModificheProdotti] = useState([]);
  const [noteErrori, setNoteErrori] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableStores, setAvailableStores] = useState(negoziData);

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
  // ✅ Funzione per aprire modal errori avanzato
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
  // ✅ Funzione per gestire modifiche prodotto
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
  // ✅ Funzione per inviare report errori
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

     {/* Navigation Tabs */}
        {user.role === 'admin' ? (
          <AdminSidebarLayout
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={user}
          >
            {activeTab === 'admin-dashboard' && (
              <AdminDashboard
                apiCall={apiCall}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
            {activeTab === 'admin-invoices' && (
              <AdminInvoiceManager
                apiCall={apiCall}
                setError={setError}
                setSuccess={setSuccess}
                availableStores={availableStores}
                toISODate={toISODate}
              />
            )}
            {activeTab === 'admin-users' && (
              <AdminUserManager
                apiCall={apiCall}
                setError={setError}
                setSuccess={setSuccess}
                availableStores={availableStores}
              />
            )}
            {activeTab === 'admin-movimentazioni' && (
              <AdminMovimentazioniManager
                apiCall={apiCall}
                setError={setError}
                setSuccess={setSuccess}
                availableStores={availableStores}
              />
            )}
            {activeTab === 'admin-txt-files' && (
              <TxtFilesManager
                apiCall={apiCall}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
          </AdminSidebarLayout>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden mb-6">
              <div className="border-b border-fradiavolo-cream-dark overflow-x-auto mobile-tabs">
                <nav className="flex min-w-max sm:min-w-0">
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 sm:flex-initial px-4 sm:px-8 py-4 text-sm sm:text-base font-semibold transition-all whitespace-nowrap mobile-tab ${
                      activeTab === 'pending'
                        ? 'text-fradiavolo-red border-b-4 border-fradiavolo-red bg-fradiavolo-cream/30'
                        : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal hover:bg-fradiavolo-cream/20'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>In Attesa</span>
                      {pendingInvoices.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 py-1 text-xs font-bold text-white bg-fradiavolo-red rounded-full">
                          {pendingInvoices.length}
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('delivered')}
                    className={`flex-1 sm:flex-initial px-4 sm:px-8 py-4 text-sm sm:text-base font-semibold transition-all whitespace-nowrap mobile-tab ${
                      activeTab === 'delivered'
                        ? 'text-fradiavolo-red border-b-4 border-fradiavolo-red bg-fradiavolo-cream/30'
                        : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal hover:bg-fradiavolo-cream/20'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>Consegnate</span>
                      {deliveredInvoices.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 py-1 text-xs font-bold text-fradiavolo-green-dark bg-fradiavolo-green/20 rounded-full border border-fradiavolo-green">
                          {deliveredInvoices.length}
                        </span>
                      )}
                    </div>
                  </button>

                  {hasPermission('movimentazioni') && (
                    <button
                      onClick={() => setActiveTab('movimentazioni')}
                      className={`flex-1 sm:flex-initial px-4 sm:px-8 py-4 text-sm sm:text-base font-semibold transition-all whitespace-nowrap mobile-tab ${
                        activeTab === 'movimentazioni'
                          ? 'text-fradiavolo-red border-b-4 border-fradiavolo-red bg-fradiavolo-cream/30'
                          : 'text-fradiavolo-charcoal-light hover:text-fradiavolo-charcoal hover:bg-fradiavolo-cream/20'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Movimentazioni</span>
                      </div>
                    </button>
                  )}
                </nav>
              </div>
            </div>

            {/* Pending Invoices */}
            {activeTab === 'pending' && (
              <div className="space-y-4 sm:space-y-6">
                {isLoading && pendingInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <LoadingSpinner />
                    <p className="mt-4 text-fradiavolo-charcoal-light">Caricamento fatture...</p>
                  </div>
                ) : pendingInvoices.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-fradiavolo border border-fradiavolo-cream-dark p-8 sm:p-12 text-center">
                    <div className="p-4 bg-fradiavolo-green/10 rounded-2xl w-fit mx-auto mb-4">
                      <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-fradiavolo-green" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-fradiavolo-charcoal mb-2">
                      Nessuna fattura in attesa
                    </h3>
                    <p className="text-fradiavolo-charcoal-light">
                      Tutte le consegne sono state confermate ✨
                    </p>
                  </div>
                ) : (
                  pendingInvoices.map((invoice) => (
                    <div key={invoice.id} className="bg-white rounded-2xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden hover:shadow-fradiavolo-lg transition-all mobile-card">
                      <div className="bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                              Fattura #{invoice.numero_fattura}
                            </h3>
                            <p className="text-white/90 text-sm sm:text-base font-medium">
                              {invoice.fornitore}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs sm:text-sm font-semibold border border-white/30 w-fit">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                            In Attesa
                          </span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                          <div className="bg-fradiavolo-cream/30 p-3 sm:p-4 rounded-xl border border-fradiavolo-cream-dark">
                            <div className="text-xs sm:text-sm text-fradiavolo-charcoal-light font-semibold mb-1">
                              Data Fattura
                            </div>
                            <div className="text-base sm:text-lg font-bold text-fradiavolo-charcoal">
                              {new Date(invoice.data_fattura).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                          <div className="bg-fradiavolo-cream/30 p-3 sm:p-4 rounded-xl border border-fradiavolo-cream-dark">
                            <div className="text-xs sm:text-sm text-fradiavolo-charcoal-light font-semibold mb-1">
                              Importo
                            </div>
                            <div className="text-base sm:text-lg font-bold text-fradiavolo-charcoal">
                              € {parseFloat(invoice.importo_totale).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="mb-4 sm:mb-6">
                          <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                            Data di consegna
                          </label>
                          <input
                            id={`delivery-date-${invoice.id}`}
                            type="date"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors text-sm sm:text-base"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
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
                              if (window.confirm('✅ Confermare la consegna SENZA errori?')) {
                                confirmDelivery(invoice.id, iso);
                              }
                            }}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                          >
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="text-sm sm:text-base">Tutto OK</span>
                          </button>

                          {renderErrorButton(invoice)}
                          <a
                            href={invoice.link_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                          >
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="text-sm sm:text-base">Vedi PDF</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Delivered Invoices */}
            {activeTab === 'delivered' && (
              <div className="space-y-4 sm:space-y-6">
                {isLoading && deliveredInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <LoadingSpinner />
                    <p className="mt-4 text-fradiavolo-charcoal-light">Caricamento fatture...</p>
                  </div>
                ) : deliveredInvoices.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-fradiavolo border border-fradiavolo-cream-dark p-8 sm:p-12 text-center">
                    <div className="p-4 bg-fradiavolo-cream rounded-2xl w-fit mx-auto mb-4">
                      <Package className="h-12 w-12 sm:h-16 sm:w-16 text-fradiavolo-charcoal-light" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-fradiavolo-charcoal mb-2">
                      Nessuna consegna registrata
                    </h3>
                    <p className="text-fradiavolo-charcoal-light">
                      Le consegne confermate appariranno qui
                    </p>
                  </div>
                ) : (
                  deliveredInvoices.map((invoice) => (
                    <div key={invoice.id} className="bg-white rounded-2xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden hover:shadow-fradiavolo-lg transition-all mobile-card">
                      <div className="bg-gradient-to-r from-fradiavolo-green to-fradiavolo-green-dark p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                              Fattura #{invoice.numero_fattura}
                            </h3>
                            <p className="text-white/90 text-sm sm:text-base font-medium">
                              {invoice.fornitore}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs sm:text-sm font-semibold border border-white/30 w-fit">
                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                            Consegnato
                          </span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                          <div className="bg-fradiavolo-cream/30 p-3 sm:p-4 rounded-xl border border-fradiavolo-cream-dark">
                            <div className="text-xs sm:text-sm text-fradiavolo-charcoal-light font-semibold mb-1">
                              Data Fattura
                            </div>
                            <div className="text-sm sm:text-base font-bold text-fradiavolo-charcoal">
                              {new Date(invoice.data_fattura).toLocaleDateString('it-IT')}
                            </div>
                          </div>
                          <div className="bg-fradiavolo-cream/30 p-3 sm:p-4 rounded-xl border border-fradiavolo-cream-dark">
                            <div className="text-xs sm:text-sm text-fradiavolo-charcoal-light font-semibold mb-1">
                              Data Consegna
                            </div>
                            <div className="text-sm sm:text-base font-bold text-fradiavolo-charcoal">
                              {invoice.data_consegna ? new Date(invoice.data_consegna).toLocaleDateString('it-IT') : 'N/A'}
                            </div>
                          </div>
                          <div className="bg-fradiavolo-cream/30 p-3 sm:p-4 rounded-xl border border-fradiavolo-cream-dark">
                            <div className="text-xs sm:text-sm text-fradiavolo-charcoal-light font-semibold mb-1">
                              Importo
                            </div>
                            <div className="text-sm sm:text-base font-bold text-fradiavolo-charcoal">
                              € {parseFloat(invoice.importo_totale).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {invoice.note && (
                          <div className="mb-4 p-3 sm:p-4 bg-fradiavolo-orange/10 border-l-4 border-fradiavolo-orange rounded-lg">
                            <div className="flex items-start space-x-2">
                              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-fradiavolo-orange flex-shrink-0 mt-0.5" />
                              <div>
                                <div className="text-xs sm:text-sm font-semibold text-fradiavolo-orange mb-1">
                                  Note Consegna
                                </div>
                                <div className="text-xs sm:text-sm text-fradiavolo-charcoal whitespace-pre-wrap">
                                  {invoice.note}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs sm:text-sm text-fradiavolo-charcoal-light mb-4">
                          <span className="flex items-center space-x-1.5">
                            <User className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="mobile-email">{invoice.confermato_da || 'N/A'}</span>
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                          {user.role === 'admin' && (
                            <button
                              onClick={() => setEditingInvoice(invoice)}
                              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-md flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                            >
                              <Edit3 className="h-4 w-4" />
                              <span className="text-sm sm:text-base">Modifica</span>
                            </button>
                          )}
                          <a
                            href={invoice.link_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-fradiavolo-charcoal hover:bg-fradiavolo-charcoal-light text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-md flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="text-sm sm:text-base">Vedi PDF</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Movimentazioni */}
            {activeTab === 'movimentazioni' && hasPermission('movimentazioni') && (
              <Movimentazione
                user={user}
                apiCall={apiCall}
                setError={setError}
                setSuccess={setSuccess}
                AlertMessage={AlertMessage}
                availableStores={availableStores}
              />
            )}
          </>
        )}
      </div>

      {/* MODAL ERRORI AVANZATO */}
      {/* ========================================== */}
      {errorModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-fradiavolo-orange to-fradiavolo-gold p-6 flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    ⚠️ Segnalazione Errori Consegna
                  </h2>
                  <p className="text-white/90">
                    Fattura #{errorModalData.numero_fattura} - {errorModalData.fornitore}
                  </p>
                  <p className="text-white/80 text-sm mt-1">
                    Data consegna: {new Date(errorModalData.deliveryDate).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setErrorModalData(null);
                    setParsedProdotti([]);
                    setModificheProdotti([]);
                    setNoteErrori('');
                  }}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Body Modal - Scrollable */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Info Fattura */}
              {errorModalData.fatturaInfo && (
                <div className="bg-fradiavolo-cream/30 p-4 rounded-xl border border-fradiavolo-cream-dark mb-6">
                  <h3 className="text-sm font-semibold text-fradiavolo-charcoal mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Informazioni DDT
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-fradiavolo-charcoal-light">Numero:</span>
                      <span className="ml-2 font-semibold text-fradiavolo-charcoal">
                        {errorModalData.fatturaInfo.numero}
                      </span>
                    </div>
                    <div>
                      <span className="text-fradiavolo-charcoal-light">Data:</span>
                      <span className="ml-2 font-semibold text-fradiavolo-charcoal">
                        {errorModalData.fatturaInfo.data}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabella Prodotti */}
              {modificheProdotti.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal mb-4 flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    Verifica Prodotti Ricevuti
                    <span className="ml-2 text-sm text-fradiavolo-charcoal-light font-normal">
                      (Modifica solo i prodotti con differenze)
                    </span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-fradiavolo-cream">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark">
                            Riga
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark">
                            Codice
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark">
                            Prodotto
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark bg-blue-50">
                            Previsto DDT
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-fradiavolo-charcoal border border-fradiavolo-cream-dark bg-green-50">
                            Ricevuto
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {modificheProdotti.map((prodotto, idx) => (
                          <tr
                            key={idx}
                            className={`${
                              prodotto.modificato ? 'bg-fradiavolo-orange/10' : 'bg-white'
                            } hover:bg-fradiavolo-cream/20 transition-colors`}
                          >
                            <td className="px-4 py-3 text-sm border border-fradiavolo-cream-dark">
                              {prodotto.riga_numero}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono border border-fradiavolo-cream-dark">
                              {prodotto.codice}
                            </td>
                            <td className="px-4 py-3 text-sm border border-fradiavolo-cream-dark">
                              <div className="font-medium text-fradiavolo-charcoal">
                                {prodotto.nome}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center border border-fradiavolo-cream-dark bg-blue-50/50">
                              <div className="font-semibold text-fradiavolo-charcoal">
                                {prodotto.quantita} {prodotto.um}
                              </div>
                            </td>
                            <td className="px-4 py-3 border border-fradiavolo-cream-dark bg-green-50/50">
                              <div className="flex items-center space-x-2 justify-center">
                                <input
                                  type="number"
                                  value={prodotto.quantita_ricevuta}
                                  onChange={(e) => handleProdottoChange(prodotto.riga_numero, 'quantita_ricevuta', parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1.5 border border-fradiavolo-cream-dark rounded-lg text-center font-semibold focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange"
                                  step="0.01"
                                />
                                <select
                                  value={prodotto.um_ricevuta}
                                  onChange={(e) => handleProdottoChange(prodotto.riga_numero, 'um_ricevuta', e.target.value)}
                                  className="px-2 py-1.5 border border-fradiavolo-cream-dark rounded-lg font-semibold focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange"
                                >
                                  {UNITA_MISURA.map(um => (
                                    <option key={um.value} value={um.value}>
                                      {um.value}
                                    </option>
                                  ))}
                                </select>
                                {prodotto.modificato && (
                                  <AlertCircle className="h-5 w-5 text-fradiavolo-orange flex-shrink-0" />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 flex items-start">
                      <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Suggerimento:</strong> Modifica solo le righe con differenze tra previsto e ricevuto. 
                        Le righe corrette verranno registrate automaticamente come "OK".
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Note Testuali */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Note Aggiuntive
                  <span className="ml-2 text-fradiavolo-charcoal-light font-normal">
                    (Descrivi eventuali problemi o osservazioni)
                  </span>
                </label>
                <textarea
                  value={noteErrori}
                  onChange={(e) => setNoteErrori(e.target.value)}
                  placeholder="Es: Prodotto danneggiato, confezione aperta, scadenza ravvicinata..."
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors resize-none"
                  rows="4"
                />
              </div>

              {/* Info Modifiche */}
              <div className="mb-6 p-4 bg-fradiavolo-orange/10 border-l-4 border-fradiavolo-orange rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-fradiavolo-orange flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-fradiavolo-charcoal">
                    <strong>Riepilogo modifiche:</strong>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>
                        {modificheProdotti.filter(m => m.modificato).length} prodotti modificati
                      </li>
                      {noteErrori.trim() && (
                        <li>Note testuali aggiunte</li>
                      )}
                    </ul>
                    <p className="mt-2 text-fradiavolo-orange font-semibold">
                      ⚠️ Un file TXT dettagliato verrà generato automaticamente e inviato al fornitore.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="bg-fradiavolo-cream/30 p-6 border-t border-fradiavolo-cream-dark flex-shrink-0">
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setErrorModalData(null);
                    setParsedProdotti([]);
                    setModificheProdotti([]);
                    setNoteErrori('');
                  }}
                  className="px-6 py-3 bg-white border-2 border-fradiavolo-charcoal-light text-fradiavolo-charcoal rounded-xl hover:bg-fradiavolo-cream transition-all font-semibold shadow-md flex items-center space-x-2"
                  disabled={isLoading}
                >
                  <X className="h-5 w-5" />
                  <span>Annulla</span>
                </button>
                <button
                  onClick={submitErrorReport}
                  disabled={isLoading}
                  className="px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center space-x-2 transform hover:scale-105"
                >
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>Conferma con Errori</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ✅ MODAL MODIFICA FATTURA (ADMIN) */}
      {/* ========================================== */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-fradiavolo-orange to-fradiavolo-gold p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Modifica Fattura
                  </h2>
                  <p className="text-white/90">
                    #{editingInvoice.numero_fattura} - {editingInvoice.fornitore}
                  </p>
                </div>
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const updates = {
                  stato: formData.get('stato'),
                  data_consegna: toISODate(formData.get('data_consegna')),
                  note: formData.get('note'),
                  confermato_da: formData.get('confermato_da')
                };
                updateInvoice(editingInvoice.id, updates);
              }}
              className="p-6 space-y-6"
            >
              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Stato
                </label>
                <select
                  name="stato"
                  defaultValue={editingInvoice.stato}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                  required
                >
                  <option value="pending">In Attesa</option>
                  <option value="consegnato">Consegnato</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Data Consegna
                </label>
                <input
                  type="date"
                  name="data_consegna"
                  defaultValue={editingInvoice.data_consegna || ''}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Email Conferma
                </label>
                <input
                  type="email"
                  name="confermato_da"
                  defaultValue={editingInvoice.confermato_da || ''}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Note
                </label>
                <textarea
                  name="note"
                  defaultValue={editingInvoice.note || ''}
                  className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors resize-none"
                  rows="4"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-6 py-3 bg-white border-2 border-fradiavolo-charcoal-light text-fradiavolo-charcoal rounded-xl hover:bg-fradiavolo-cream transition-all font-semibold shadow-md flex items-center space-x-2"
                >
                  <X className="h-5 w-5" />
                  <span>Annulla</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-fradiavolo-red hover:bg-fradiavolo-red/90 text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center space-x-2 transform hover:scale-105"
                >
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>Salva Modifiche</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceProcessorApp;
