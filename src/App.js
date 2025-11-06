import React, { useState, useRef, useEffect } from 'react';
import { FileText, Eye, Edit3, Download, CheckCircle, AlertCircle, LogOut, User, Users, Clock, Package, MessageCircle, Save, X, RefreshCw, Truck, HardDrive } from 'lucide-react';
import Movimentazione from './Movimentazione';
import AdminDashboard from './components/AdminDashboard';
import AdminInvoiceManager from './components/AdminInvoiceManager';
import AdminMovimentazioniManager from './components/AdminMovimentazioniManager';
import AdminUserManager from './components/AdminUserManager'; // eventualmente usato in altre viste
import TxtFilesManager from './TxtFilesManager';
import AdminSidebarLayout from './components/AdminSidebarLayout';
// ❌ rimosso: import usersData from './components/AdminUserManager';
import negoziData from './data/negozi.json';

// Normalizza input date in YYYY-MM-DD (accetta anche DD/MM/YYYY)
function toISODate(raw) {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // già ISO
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
console.log('🔍 API_BASE_URL configurato:', API_BASE_URL);
console.log('🔍 REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

const InvoiceProcessorApp = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [sheetInvoices, setSheetInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('admin-dashboard');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [errorModalInvoice, setErrorModalInvoice] = useState(null);
  const [errorNotes, setErrorNotes] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStoreForConfirmation, setSelectedStoreForConfirmation] = useState('');
  const [availableStores, setAvailableStores] = useState(negoziData); // default locale

  // Funzione per trovare l'email dal negozio selezionato
  const getStoreEmail = (storeName) => {
    if (!storeName) return '';
    const negozio = (availableStores || negoziData).find(n => n.nome === storeName);
    return negozio?.email || '';
  };

  // Verifica token all'avvio
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  // Carica dati quando l'utente è autenticato
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

  // Imposta vista di default basata sul ruolo utente
  useEffect(() => {
    if (user && !activeTab) {
      if (user.role === 'admin') {
        setActiveTab('admin-dashboard'); // Vista predefinita per admin
      } else {
        setActiveTab('pending'); // Vista predefinita per utenti normali
      }
    }
  }, [user, activeTab]);

  // Auto-refresh ogni 10 minuti
  useEffect(() => {
    if (user && (activeTab === 'pending' || activeTab === 'delivered')) {
      const interval = setInterval(() => {
        loadInvoicesFromSheet();
      }, 600000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab]);

  // FUNZIONI API - AGGIORNATE
  const apiCall = async (endpoint, options = {}) => {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log('🔍 URL chiamata:', fullUrl);
    console.log('🔍 API_BASE_URL:', API_BASE_URL);

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      console.log('🔍 Fetch con config:', config);
      const response = await fetch(fullUrl, config);
      console.log('🔍 Response status:', response.status);

      const text = await response.text();
      console.log('🔍 Response text:', text.substring(0, 200));

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
      // opzionale: carico la lista negozi se admin
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
    console.log('🔄 GET /api/invoices ricevuta');
    console.log('👤 Richiesta da utente:', user.email);
    console.log('🏢 Punto vendita:', user.puntoVendita);
    console.log('🔐 Ruolo utente:', user.role);

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

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Dati ricevuti grezzi:', data.data);

      // Rimuovi duplicati basandoti sull'ID univoco
      const uniqueInvoices = data.data.filter((invoice, index, self) =>
        index === self.findIndex(i => i.id === invoice.id)
      );

      console.log('📊 Fatture ricevute dal backend:', data.data.length);
      console.log('📊 Dopo rimozione duplicati:', uniqueInvoices.length);

      console.log('📊 Dati dopo rimozione duplicati:', uniqueInvoices);
      console.log('🔢 Fatture elaborate:', uniqueInvoices.length);

      setSheetInvoices(uniqueInvoices);
      setError('');
    } catch (error) {
      console.error('❌ Errore caricamento:', error);
      setError('Impossibile caricare le fatture: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // AUTENTICAZIONE
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

  // GESTIONE FATTURE - AGGIORNATE
  const confirmDelivery = async (invoiceId, deliveryDate, noteErrori = '', customEmail = null) => {
    try {
      setIsLoading(true);

      const emailToUse = customEmail || user.email;
      console.log('🔄 Confermando consegna:', { invoiceId, deliveryDate, noteErrori, emailToUse });

      // Prima aggiorna il backend
      await apiCall(`/invoices/${invoiceId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          data_consegna: toISODate(deliveryDate),
          note_errori: noteErrori,
          confermato_da_email: emailToUse
        })
      });

      // Poi aggiorna lo stato locale IMMEDIATAMENTE
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

      // Ricarica dopo 2 secondi per sicurezza
      setTimeout(() => {
        loadInvoicesFromSheet();
      }, 2000);

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

      console.log('🔄 updateInvoice chiamata con:', { invoiceId, updates });
      console.log('🔄 Tipo invoiceId:', typeof invoiceId);

      // Verifica che tutti i campi necessari siano presenti
      if (!updates.data_consegna) {
        console.error('❌ data_consegna mancante');
        setError('❌ Data di consegna richiesta');
        setTimeout(() => setError(''), 3000);
        return;
      }

      if (!updates.confermato_da) {
        console.error('❌ confermato_da mancante');
        setError('❌ Email di conferma richiesta');
        setTimeout(() => setError(''), 3000);
        return;
      }

      // Prima aggiorna il backend
      console.log('📡 Chiamando API...');
      const response = await apiCall(`/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      console.log('✅ Risposta API:', response);

      // Poi aggiorna lo stato locale IMMEDIATAMENTE
      setSheetInvoices(prev => {
        const updated = prev.map(inv =>
          inv.id.toString() === invoiceId.toString()
            ? { ...inv, ...updates }
            : inv
        );
        console.log('🔄 Stato locale aggiornato');
        return updated;
      });

      setSuccess('✅ Fattura aggiornata con successo! Verificando su Google Sheets...');
      setEditingInvoice(null);

      // Ricarica i dati dopo 3 secondi per conferma
      setTimeout(() => {
        console.log('🔄 Ricaricamento dati di conferma...');
        loadInvoicesFromSheet().then(() => {
          console.log('✅ Dati ricaricati da Google Sheets');
          setSuccess('✅ Fattura aggiornata e sincronizzata con Google Sheets!');
        });
      }, 3000);

      setTimeout(() => setSuccess(''), 8000);
    } catch (error) {
      console.error('❌ Errore aggiornamento frontend:', error);
      setError('❌ Errore aggiornamento: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione helper per controllare i permessi utente
  const hasPermission = (requiredPermission) => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin ha accesso completo
    return user.permissions?.includes(requiredPermission);
  };

  // UTILITY FUNCTIONS
  const isOldInvoice = (dateString) => {
    const invoiceDate = new Date(dateString);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    return invoiceDate < fiveDaysAgo;
  };

  // COMPONENTI UI
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
        <button
          onClick={onClose}
          className="text-current opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // LOGIN FORM
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

          {loginError && (
            <AlertMessage
              type="error"
              message={loginError}
              onClose={() => setLoginError('')}
            />
          )}

          {success && (
            <AlertMessage
              type="success"
              message={success}
            />
          )}

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

          <div className="mt-8 p-4 bg-fradiavolo-cream rounded-xl border border-fradiavolo-cream-dark">
            <p className="text-xs text-fradiavolo-charcoal text-center mb-2"><strong>Credenziali Demo:</strong></p>
            <p className="text-xs text-fradiavolo-charcoal-light text-center">milano.isola@fradiavolopizzeria.com / isola2025</p>
          </div>
        </div>
      </div>
    );
  }

  const pendingInvoices = sheetInvoices.filter(inv => inv.stato === 'pending');
  const deliveredInvoices = sheetInvoices.filter(inv => inv.stato === 'consegnato');

  console.log('📋 Tutte le fatture:', sheetInvoices);
  console.log('⏳ Fatture pending:', pendingInvoices);
  console.log('📊 Numero pending:', pendingInvoices.length);

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

              {/* Mobile user info - compact */}
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
        {error && (
          <AlertMessage
            type="error"
            message={error}
            onClose={() => setError('')}
          />
        )}
        {success && (
          <AlertMessage
            type="success"
            message={success}
            onClose={() => setSuccess('')}
          />
        )}
      </div>

      {/* Layout condizionale Admin vs Operator */}
      {user?.role === 'admin' ? (
        // LAYOUT SIDEBAR PER ADMIN
        <div className="flex-1 min-h-screen">
          <AdminSidebarLayout
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
        
          >
            {/* Contenuto per pending/delivered viene passato come children */}
            {activeTab === 'pending' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-fradiavolo-charcoal">Fatture da confermare</h2>
                    <p className="text-fradiavolo-charcoal-light mt-1">
                      Vista amministratore - Tutte le consegne in attesa di conferma da tutti i negozi
                    </p>
                  </div>
                </div>

                {/* Dropdown selezione punto vendita */}
                <div className="mb-6 max-w-xs">
                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                    Conferma per conto di punto vendita
                  </label>
                  <select
                    value={selectedStoreForConfirmation}
                    onChange={e => setSelectedStoreForConfirmation(e.target.value)}
                    className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                  >
                    <option value="">Seleziona punto vendita...</option>
                    {(availableStores || negoziData).map(store => (
                      <option key={store.nome} value={store.nome}>{store.nome}</option>
                    ))}
                  </select>
                </div>

                {isLoading ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
                      <LoadingSpinner />
                    </div>
                    <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento fatture...</h3>
                    <p className="text-fradiavolo-charcoal-light">Connessione a Google Sheets in corso</p>
                  </div>
                ) : pendingInvoices.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-green/10 rounded-full mb-6 border border-fradiavolo-green/30">
                      <CheckCircle className="h-10 w-10 text-fradiavolo-green" />
                    </div>
                    <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Tutto confermato! 🎉</h3>
                    <p className="text-fradiavolo-charcoal-light text-lg">Non ci sono consegne in attesa di conferma</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:gap-6">
                    {pendingInvoices.map((invoice) => {
                      const isOld = isOldInvoice(invoice.data_emissione);
                      return (
                        <div
                          key={invoice.id}
                          className={`bg-white rounded-xl sm:rounded-2xl shadow-fradiavolo p-4 sm:p-6 border transition-all hover:shadow-fradiavolo-lg ${
                            isOld ? 'border-fradiavolo-red bg-red-50' : 'border-fradiavolo-cream-dark'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6">
                            <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                              <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${isOld ? 'bg-fradiavolo-red/10' : 'bg-fradiavolo-cream'} border ${isOld ? 'border-fradiavolo-red/30' : 'border-fradiavolo-cream-dark'}`}>
                                <FileText className={`h-5 w-5 sm:h-6 sm:w-6 ${isOld ? 'text-fradiavolo-red' : 'text-fradiavolo-charcoal'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg sm:text-xl font-bold text-fradiavolo-charcoal flex items-center">
                                  <span className="truncate">{invoice.fornitore}</span>
                                  <span className="mx-2 text-fradiavolo-red">-</span>
                                  <span className="text-sm sm:text-base text-fradiavolo-red">{invoice.numero}</span>
                                  {isOld && <span className="ml-2 text-xl sm:text-2xl">🚨</span>}
                                  {/* Badge punto vendita */}
                                  <span className="ml-3 px-2 py-1 rounded-full bg-fradiavolo-orange/10 text-fradiavolo-orange text-xs font-semibold border border-fradiavolo-orange/30">
                                    {invoice.punto_vendita}
                                  </span>
                                </h3>
                                <p className="text-sm sm:text-base text-fradiavolo-charcoal-light mt-1">
                                  <span className="font-semibold">{new Date(invoice.data_emissione).toLocaleDateString('it-IT')}</span>
                                  {isOld && (
                                    <span className="text-fradiavolo-red font-semibold block sm:inline sm:ml-2">
                                      (Scaduta da oltre 5 giorni)
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-center sm:text-right">
                              {invoice.pdf_link && invoice.pdf_link !== '#' && (
                                <a
                                  href={invoice.pdf_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 text-fradiavolo-red hover:text-fradiavolo-red-dark transition-colors mt-2 text-sm"
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span>PDF</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Visualizza contenuto note/DDT se presente */}
                          {invoice.testo_ddt && invoice.testo_ddt.trim() !== '' && (
                            <div className="mb-4 p-4 bg-fradiavolo-cream rounded-xl border border-fradiavolo-cream-dark">
                              <div className="flex items-center space-x-2 mb-3">
                                <FileText className="h-4 w-4 text-fradiavolo-charcoal" />
                                <span className="text-sm font-semibold text-fradiavolo-charcoal">Contenuto DDT:</span>
                              </div>
                              <pre className="text-xs text-fradiavolo-charcoal-light font-mono whitespace-pre-wrap bg-white p-3 rounded-lg border border-fradiavolo-cream-dark max-h-32 overflow-y-auto leading-relaxed">
                                {invoice.testo_ddt}
                              </pre>
                            </div>
                          )}

                          {/* Azioni */}
                          <div className="space-y-3 sm:space-y-0 sm:flex sm:items-end sm:space-x-4">
                            <div className="flex-1">
                              <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                                Data di consegna <span className="text-fradiavolo-red">*</span>
                              </label>
                              <input
                                type="date"
                                id={`delivery-date-${invoice.id}`}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 sm:px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors text-base"
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                              {/* ✅ Bottone CONFERMA */}
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
                                  const storeEmail = getStoreEmail(selectedStoreForConfirmation);
                                  confirmDelivery(invoice.id, iso, '', storeEmail);
                                }}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                              >
                                {isLoading ? <LoadingSpinner /> : <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                                <span className="text-sm sm:text-base">Conferma</span>
                              </button>

                              {/* ⚠️ Bottone CON ERRORI */}
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
                                  setErrorModalInvoice({
                                    ...invoice,
                                    deliveryDate: iso,
                                    confermato_da: getStoreEmail(selectedStoreForConfirmation),
                                  });
                                  setErrorNotes('');
                                }}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                              >
                                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                <span className="text-sm sm:text-base">Con Errori</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'delivered' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-fradiavolo-charcoal">Consegne confermate</h2>
                    <p className="text-fradiavolo-charcoal-light mt-1">
                      Vista amministratore - Storico di tutte le fatture consegnate da tutti i negozi
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
                      <LoadingSpinner />
                    </div>
                    <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento storico...</h3>
                    <p className="text-fradiavolo-charcoal-light">Recupero dati da Google Sheets</p>
                  </div>
                ) : deliveredInvoices.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
                      <FileText className="h-10 w-10 text-fradiavolo-charcoal-light" />
                    </div>
                    <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Nessuna consegna confermata</h3>
                    <p className="text-fradiavolo-charcoal-light text-lg">Le fatture confermate appariranno qui</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {deliveredInvoices.map((invoice) => {
                      const hasErrors = invoice.note && invoice.note.trim() !== '';
                      return (
                        <div
                          key={invoice.id}
                          className={`rounded-2xl shadow-fradiavolo p-6 border transition-all hover:shadow-fradiavolo-lg ${
                            hasErrors
                              ? 'bg-fradiavolo-orange/10 border-fradiavolo-orange/30'
                              : 'bg-white border-fradiavolo-cream-dark'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 rounded-2xl ${
                                hasErrors ? 'bg-fradiavolo-orange/20' : 'bg-fradiavolo-green/20'
                              } border ${
                                hasErrors ? 'border-fradiavolo-orange/30' : 'border-fradiavolo-green/30'
                              }`}>
                                {hasErrors ? (
                                  <AlertCircle className="h-6 w-6 text-fradiavolo-orange" />
                                ) : (
                                  <CheckCircle className="h-6 w-6 text-fradiavolo-green" />
                                )}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-fradiavolo-charcoal">
                                  {invoice.fornitore} - <span className="text-fradiavolo-red">{invoice.numero}</span>
                                </h3>
                                <div className="mt-2 space-y-1">
                                  <p className="text-fradiavolo-charcoal-light">
                                    Emessa il: <span className="font-semibold text-fradiavolo-charcoal">{new Date(invoice.data_emissione).toLocaleDateString('it-IT')}</span>
                                  </p>
                                  <p className={`font-semibold ${
                                    hasErrors ? 'text-fradiavolo-orange' : 'text-fradiavolo-green'
                                  }`}>
                                    {hasErrors ? '⚠️' : '✅'} Consegnata il: {new Date(invoice.data_consegna).toLocaleDateString('it-IT')}
                                    {hasErrors && <span className="text-fradiavolo-red ml-2">(Con errori)</span>}
                                    {!hasErrors && <span className="text-fradiavolo-green ml-2 text-sm">📄 File TXT generato</span>}
                                  </p>
                                  {hasErrors && (
                                    <div className="mt-3 p-3 bg-fradiavolo-orange/10 rounded-lg border border-fradiavolo-orange/30">
                                      <p className="text-sm font-semibold text-fradiavolo-red mb-1">📝 Note errori:</p>
                                      <p className="text-sm text-fradiavolo-charcoal italic">"{invoice.note}"</p>
                                      <p className="text-xs text-fradiavolo-orange mt-1">📄 File TXT generato comunque</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-fradiavolo-charcoal-light mt-1">Confermato da:</p>
                              <p className="text-sm font-semibold text-fradiavolo-charcoal">{invoice.confermato_da}</p>
                            </div>
                          </div>

                          {editingInvoice === invoice.id ? (
                            <div className="space-y-4 bg-fradiavolo-cream p-6 rounded-xl border border-fradiavolo-cream-dark">
                              <h4 className="font-semibold text-fradiavolo-charcoal mb-4">Modifica dettagli consegna</h4>
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Data consegna</label>
                                    <input
                                      type="date"
                                      defaultValue={invoice.data_consegna}
                                      max={new Date().toISOString().split('T')[0]}
                                      id={`edit-date-${invoice.id}`}
                                      className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Confermato da</label>
                                    <input
                                      type="email"
                                      defaultValue={invoice.confermato_da}
                                      id={`edit-confirmed-${invoice.id}`}
                                      className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Note errori (opzionale)</label>
                                  <textarea
                                    defaultValue={invoice.note || ''}
                                    id={`edit-notes-${invoice.id}`}
                                    rows="3"
                                    className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                                    placeholder="Descrivi eventuali problemi nella consegna..."
                                  />
                                </div>
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  onClick={() => {
                                    console.log('🔄 Bottone Salva Modifiche cliccato');

                                    const dateInput = document.getElementById(`edit-date-${invoice.id}`);
                                    const confirmedInput = document.getElementById(`edit-confirmed-${invoice.id}`);
                                    const notesInput = document.getElementById(`edit-notes-${invoice.id}`);

                                    console.log('📝 Valori input:', {
                                      date: dateInput?.value,
                                      confirmed: confirmedInput?.value,
                                      notes: notesInput?.value
                                    });

                                    if (!dateInput?.value) {
                                      console.error('❌ Data mancante');
                                      setError('⚠️ Data di consegna richiesta');
                                      setTimeout(() => setError(''), 3000);
                                      return;
                                    }

                                    if (!confirmedInput?.value) {
                                      console.error('❌ Email mancante');
                                      setError('⚠️ Email di conferma richiesta');
                                      setTimeout(() => setError(''), 3000);
                                      return;
                                    }
                                    const iso = toISODate(dateInput?.value);
                                    if (!iso) {
                                      setError('⚠️ Data di consegna non valida');
                                      setTimeout(() => setError(''), 3000);
                                      return;
                                    }
                                    const updateData = {
                                      data_consegna: iso,
                                      confermato_da: confirmedInput.value,
                                      note: notesInput?.value || ''
                                    };

                                    console.log('💾 Chiamando updateInvoice con:', updateData);
                                    updateInvoice(invoice.id, updateData);
                                  }}
                                  disabled={isLoading}
                                  className="flex items-center space-x-2 px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 transform hover:scale-105"
                                >
                                  {isLoading ? <LoadingSpinner /> : <Save className="h-4 w-4" />}
                                  <span>Salva Modifiche</span>
                                </button>
                                <button
                                  onClick={() => setEditingInvoice(null)}
                                  className="flex items-center space-x-2 px-6 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg transform hover:scale-105"
                                >
                                  <X className="h-4 w-4" />
                                  <span>Annulla</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                onClick={() => setEditingInvoice(invoice.id)}
                                className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-red hover:bg-fradiavolo-red/10 rounded-xl transition-all font-semibold border border-fradiavolo-red/30 hover:border-fradiavolo-red"
                              >
                                <Edit3 className="h-4 w-4" />
                                <span>Modifica</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </AdminSidebarLayout>
        </div>
      ) : (
        // LAYOUT NORMALE PER OPERATOR
        <>
          {/* Navigation Tabs per Operator */}
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
            <div className="flex space-x-1 bg-white p-1 rounded-2xl shadow-fradiavolo border border-fradiavolo-cream-dark w-full overflow-x-auto mobile-tabs-container">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 min-w-0 px-2 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm mobile-tabs ${
                  activeTab === 'pending'
                    ? 'bg-fradiavolo-red text-white shadow-fradiavolo transform scale-105'
                    : 'text-fradiavolo-charcoal hover:text-fradiavolo-red hover:bg-fradiavolo-cream'
                }`}
              >
                <Package className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">Da confermare</span>
                <span className="sm:hidden truncate">Pending</span>
                <span className="font-bold bg-white/20 px-1 rounded text-xs">
                  ({pendingInvoices.length})
                </span>
              </button>

              <button
                onClick={() => setActiveTab('delivered')}
                className={`flex-1 min-w-0 px-2 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm mobile-tabs ${
                  activeTab === 'delivered'
                    ? 'bg-fradiavolo-green text-white shadow-fradiavolo transform scale-105'
                    : 'text-fradiavolo-charcoal hover:text-fradiavolo-red hover:bg-fradiavolo-cream'
                }`}
              >
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">Confermate</span>
                <span className="sm:hidden truncate">Done</span>
                <span className="font-bold bg-white/20 px-1 rounded text-xs">
                  ({deliveredInvoices.length})
                </span>
              </button>

              <button
                onClick={() => setActiveTab('movimentazione')}
                className={`flex-1 min-w-0 px-2 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm mobile-tabs ${
                  activeTab === 'movimentazione'
                    ? 'bg-fradiavolo-orange text-white shadow-fradiavolo transform scale-105'
                    : 'text-fradiavolo-charcoal hover:text-fradiavolo-red hover:bg-fradiavolo-cream'
                }`}
              >
                <Truck className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">Movimentazione</span>
                <span className="sm:hidden truncate">Transfer</span>
              </button>
            </div>
          </div>

          {/* Contenuto per Operator */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Tab Movimentazione */}
            {activeTab === 'movimentazione' && (
              <Movimentazione user={user} />
            )}

            {/* TAB FILE TXT */}
            {activeTab === 'txt-files' && (
              <TxtFilesManager user={user} />
            )}

            {/* Tab Da Confermare per Operator */}
            {activeTab === 'pending' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-fradiavolo-charcoal">Fatture da confermare</h2>
                    <p className="text-fradiavolo-charcoal-light mt-1">
                      Gestisci le consegne in attesa di conferma - {user.puntoVendita}
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
                      <LoadingSpinner />
                    </div>
                    <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento fatture...</h3>
                    <p className="text-fradiavolo-charcoal-light">Connessione a Google Sheets in corso</p>
                  </div>
                ) : pendingInvoices.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-green/10 rounded-full mb-6 border border-fradiavolo-green/30">
                      <CheckCircle className="h-10 w-10 text-fradiavolo-green" />
                    </div>
                    <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Tutto confermato! 🎉</h3>
                    <p className="text-fradiavolo-charcoal-light text-lg">Non ci sono consegne in attesa di conferma</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:gap-6">
                    {pendingInvoices.map((invoice) => {
                      const isOld = isOldInvoice(invoice.data_emissione);
                      return (
                        <div
                          key={invoice.id}
                          className={`bg-white rounded-xl sm:rounded-2xl shadow-fradiavolo p-4 sm:p-6 border transition-all hover:shadow-fradiavolo-lg ${
                            isOld ? 'border-fradiavolo-red bg-red-50' : 'border-fradiavolo-cream-dark'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6">
                            <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                              <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${isOld ? 'bg-fradiavolo-red/10' : 'bg-fradiavolo-cream'} border ${isOld ? 'border-fradiavolo-red/30' : 'border-fradiavolo-cream-dark'}`}>
                                <FileText className={`h-5 w-5 sm:h-6 sm:w-6 ${isOld ? 'text-fradiavolo-red' : 'text-fradiavolo-charcoal'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg sm:text-xl font-bold text-fradiavolo-charcoal flex items-center">
                                  <span className="truncate">{invoice.fornitore}</span>
                                  <span className="mx-2 text-fradiavolo-red">-</span>
                                  <span className="text-sm sm:text-base text-fradiavolo-red">{invoice.numero}</span>
                                  {isOld && <span className="ml-2 text-xl sm:text-2xl">🚨</span>}
                                  {/* Badge punto vendita */}
                                  <span className="ml-3 px-2 py-1 rounded-full bg-fradiavolo-orange/10 text-fradiavolo-orange text-xs font-semibold border border-fradiavolo-orange/30">
                                    {invoice.punto_vendita}
                                  </span>
                                </h3>
                                <p className="text-sm sm:text-base text-fradiavolo-charcoal-light mt-1">
                                  <span className="font-semibold">{new Date(invoice.data_emissione).toLocaleDateString('it-IT')}</span>
                                  {isOld && (
                                    <span className="text-fradiavolo-red font-semibold block sm:inline sm:ml-2">
                                      (Scaduta da oltre 5 giorni)
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-center sm:text-right">
                              {invoice.pdf_link && invoice.pdf_link !== '#' && (
                                <a
                                  href={invoice.pdf_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 text-fradiavolo-red hover:text-fradiavolo-red-dark transition-colors mt-2 text-sm"
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span>PDF</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Visualizza contenuto note/DDT se presente */}
                          {invoice.testo_ddt && invoice.testo_ddt.trim() !== '' && (
                            <div className="mb-4 p-4 bg-fradiavolo-cream rounded-xl border border-fradiavolo-cream-dark">
                              <div className="flex items-center space-x-2 mb-3">
                                <FileText className="h-4 w-4 text-fradiavolo-charcoal" />
                                <span className="text-sm font-semibold text-fradiavolo-charcoal">Contenuto DDT:</span>
                              </div>
                              <pre className="text-xs text-fradiavolo-charcoal-light font-mono whitespace-pre-wrap bg-white p-3 rounded-lg border border-fradiavolo-cream-dark max-h-32 overflow-y-auto leading-relaxed">
                                {invoice.testo_ddt}
                              </pre>
                            </div>
                          )}

                          <div className="space-y-3 sm:space-y-0 sm:flex sm:items-end sm:space-x-4">
                            <div className="flex-1">
                              <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                                Data di consegna <span className="text-fradiavolo-red">*</span>
                              </label>
                              <input
                                type="date"
                                id={`delivery-date-${invoice.id}`}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 sm:px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors text-base"
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                              {/* ✅ Bottone CONFERMA */}
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
                                  const storeEmail = getStoreEmail(selectedStoreForConfirmation);
                                  confirmDelivery(invoice.id, iso, '', storeEmail);
                                }}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                              >
                                {isLoading ? <LoadingSpinner /> : <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                                <span className="text-sm sm:text-base">Conferma</span>
                              </button>

                              {/* ⚠️ Bottone CON ERRORI */}
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
                                  setErrorModalInvoice({
                                    ...invoice,
                                    deliveryDate: iso,
                                    confermato_da: getStoreEmail(selectedStoreForConfirmation),
                                  });
                                  setErrorNotes('');
                                }}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transform hover:scale-105 min-h-[44px]"
                              >
                                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                <span className="text-sm sm:text-base">Con Errori</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab Già Confermate per Operator */}
            {activeTab === 'delivered' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-fradiavolo-charcoal">Consegne confermate</h2>
                    <p className="text-fradiavolo-charcoal-light mt-1">
                      Storico delle fatture già consegnate - {user.puntoVendita}
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
                      <LoadingSpinner />
                    </div>
                    <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento storico...</h3>
                    <p className="text-fradiavolo-charcoal-light">Recupero dati da Google Sheets</p>
                  </div>
                ) : deliveredInvoices.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
                      <FileText className="h-10 w-10 text-fradiavolo-charcoal-light" />
                    </div>
                    <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Nessuna consegna confermata</h3>
                    <p className="text-fradiavolo-charcoal-light text-lg">Le fatture confermate appariranno qui</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {deliveredInvoices.map((invoice) => {
                      const hasErrors = invoice.note && invoice.note.trim() !== '';
                      return (
                        <div
                          key={invoice.id}
                          className={`rounded-2xl shadow-fradiavolo p-6 border transition-all hover:shadow-fradiavolo-lg ${
                            hasErrors
                              ? 'bg-fradiavolo-orange/10 border-fradiavolo-orange/30'
                              : 'bg-white border-fradiavolo-cream-dark'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 rounded-2xl ${
                                hasErrors ? 'bg-fradiavolo-orange/20' : 'bg-fradiavolo-green/20'
                              } border ${
                                hasErrors ? 'border-fradiavolo-orange/30' : 'border-fradiavolo-green/30'
                              }`}>
                                {hasErrors ? (
                                  <AlertCircle className="h-6 w-6 text-fradiavolo-orange" />
                                ) : (
                                  <CheckCircle className="h-6 w-6 text-fradiavolo-green" />
                                )}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-fradiavolo-charcoal">
                                  {invoice.fornitore} - <span className="text-fradiavolo-red">{invoice.numero}</span>
                                </h3>
                                <div className="mt-2 space-y-1">
                                  <p className="text-fradiavolo-charcoal-light">
                                    Emessa il: <span className="font-semibold text-fradiavolo-charcoal">{new Date(invoice.data_emissione).toLocaleDateString('it-IT')}</span>
                                  </p>
                                  <p className={`font-semibold ${
                                    hasErrors ? 'text-fradiavolo-orange' : 'text-fradiavolo-green'
                                  }`}>
                                    {hasErrors ? '⚠️' : '✅'} Consegnata il: {new Date(invoice.data_consegna).toLocaleDateString('it-IT')}
                                    {hasErrors && <span className="text-fradiavolo-red ml-2">(Con errori)</span>}
                                    {!hasErrors && <span className="text-fradiavolo-green ml-2 text-sm">📄 File TXT generato</span>}
                                  </p>
                                  {hasErrors && (
                                    <div className="mt-3 p-3 bg-fradiavolo-orange/10 rounded-lg border border-fradiavolo-orange/30">
                                      <p className="text-sm font-semibold text-fradiavolo-red mb-1">📝 Note errori:</p>
                                      <p className="text-sm text-fradiavolo-charcoal italic">"{invoice.note}"</p>
                                      <p className="text-xs text-fradiavolo-orange mt-1">📄 File TXT generato comunque</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-fradiavolo-charcoal-light mt-1">Confermato da:</p>
                              <p className="text-sm font-semibold text-fradiavolo-charcoal">{invoice.confermato_da}</p>
                            </div>
                          </div>

                          {editingInvoice === invoice.id ? (
                            <div className="space-y-4 bg-fradiavolo-cream p-6 rounded-xl border border-fradiavolo-cream-dark">
                              <h4 className="font-semibold text-fradiavolo-charcoal mb-4">Modifica dettagli consegna</h4>
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Data consegna</label>
                                    <input
                                      type="date"
                                      defaultValue={invoice.data_consegna}
                                      max={new Date().toISOString().split('T')[0]}
                                      id={`edit-date-${invoice.id}`}
                                      className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Confermato da</label>
                                    <input
                                      type="email"
                                      defaultValue={invoice.confermato_da}
                                      id={`edit-confirmed-${invoice.id}`}
                                      className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">Note errori (opzionale)</label>
                                  <textarea
                                    defaultValue={invoice.note || ''}
                                    id={`edit-notes-${invoice.id}`}
                                    rows="3"
                                    className="w-full px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                                    placeholder="Descrivi eventuali problemi nella consegna..."
                                  />
                                </div>
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  onClick={() => {
                                    console.log('🔄 Bottone Salva Modifiche cliccato');

                                    const dateInput = document.getElementById(`edit-date-${invoice.id}`);
                                    const confirmedInput = document.getElementById(`edit-confirmed-${invoice.id}`);
                                    const notesInput = document.getElementById(`edit-notes-${invoice.id}`);

                                    console.log('📝 Valori input:', {
                                      date: dateInput?.value,
                                      confirmed: confirmedInput?.value,
                                      notes: notesInput?.value
                                    });

                                    if (!dateInput?.value) {
                                      console.error('❌ Data mancante');
                                      setError('⚠️ Data di consegna richiesta');
                                      setTimeout(() => setError(''), 3000);
                                      return;
                                    }

                                    if (!confirmedInput?.value) {
                                      console.error('❌ Email mancante');
                                      setError('⚠️ Email di conferma richiesta');
                                      setTimeout(() => setError(''), 3000);
                                      return;
                                    }
                                    const iso = toISODate(dateInput?.value);
                                    if (!iso) {
                                      setError('⚠️ Data di consegna non valida');
                                      setTimeout(() => setError(''), 3000);
                                      return;
                                    }
                                    const updateData = {
                                      data_consegna: iso,
                                      confermato_da: confirmedInput.value,
                                      note: notesInput?.value || ''
                                    };

                                    console.log('💾 Chiamando updateInvoice con:', updateData);
                                    updateInvoice(invoice.id, updateData);
                                  }}
                                  disabled={isLoading}
                                  className="flex items-center space-x-2 px-6 py-3 bg-fradiavolo-green hover:bg-fradiavolo-green-dark text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 transform hover:scale-105"
                                >
                                  {isLoading ? <LoadingSpinner /> : <Save className="h-4 w-4" />}
                                  <span>Salva Modifiche</span>
                                </button>
                                <button
                                  onClick={() => setEditingInvoice(null)}
                                  className="flex items-center space-x-2 px-6 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg transform hover:scale-105"
                                >
                                  <X className="h-4 w-4" />
                                  <span>Annulla</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                onClick={() => setEditingInvoice(invoice.id)}
                                className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-red hover:bg-fradiavolo-red/10 rounded-xl transition-all font-semibold border border-fradiavolo-red/30 hover:border-fradiavolo-red"
                              >
                                <Edit3 className="h-4 w-4" />
                                <span>Modifica</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Errori - Mobile Optimized */}
      {errorModalInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-lg max-h-[90vh] overflow-y-auto border border-fradiavolo-cream-dark mobile-modal">
            <div className="flex items-center space-x-3 p-4 sm:p-6 border-b border-fradiavolo-cream-dark mobile-modal-header">
              <div className="p-2 sm:p-3 bg-fradiavolo-orange/20 rounded-2xl border border-fradiavolo-orange/30">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-fradiavolo-orange" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-fradiavolo-charcoal">Conferma con Errori</h3>
                <p className="text-sm sm:text-base text-fradiavolo-charcoal-light truncate mobile-text-sm">
                  <span className="block sm:inline">{errorModalInvoice.fornitore}</span>
                  <span className="hidden sm:inline mx-1">-</span>
                  <span className="text-fradiavolo-red font-medium">{errorModalInvoice.numero}</span>
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 mobile-modal-body">
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                  Descrivi i problemi riscontrati:
                </label>
                <textarea
                  value={errorNotes}
                  onChange={(e) => setErrorNotes(e.target.value)}
                  className="w-full px-3 sm:px-4 py-3 border border-fradiavolo-cream-dark rounded-xl focus:ring-2 focus:ring-fradiavolo-orange focus:border-fradiavolo-orange transition-colors text-base mobile-textarea"
                  rows="4"
                  placeholder="Es: Prodotto danneggiato, quantità non corrispondente, cliente assente..."
                  required
                />
                <p className="text-xs text-fradiavolo-charcoal-light mt-2 mobile-text-xs">
                  📄 Un file TXT verrà generato automaticamente anche con le note di errore
                </p>
              </div>

              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    if (!errorNotes.trim()) {
                      setError('⚠️ Inserisci una descrizione dell\'errore');
                      setTimeout(() => setError(''), 3000);
                      return;
                    }
                    confirmDelivery(errorModalInvoice.id, errorModalInvoice.deliveryDate, errorNotes, errorModalInvoice.confermato_da);
                    setErrorModalInvoice(null);
                    setErrorNotes('');
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 sm:px-6 py-3 bg-fradiavolo-orange hover:bg-fradiavolo-gold text-white rounded-xl hover:shadow-fradiavolo transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 mobile-button mobile-touch-feedback"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="text-sm sm:text-base">Salvando...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">Conferma con Note</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setErrorModalInvoice(null);
                    setErrorNotes('');
                  }}
                  className="px-4 sm:px-6 py-3 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg mobile-button mobile-touch-feedback"
                >
                  <span className="text-sm sm:text-base">Annulla</span>
                </button>
              </div>
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
