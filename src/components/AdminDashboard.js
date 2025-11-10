import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Store, 
  FileText, 
  Truck, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Shield,
  Globe
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AdminDashboard = ({ user }) => {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Carica dati dashboard
  const loadDashboardStats = async () => {
    try {
      setIsLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Dashboard stats caricate:', data.stats);
      setDashboardStats(data.stats);

    } catch (error) {
      console.error('❌ Errore caricamento dashboard:', error);
      setError('Errore nel caricamento della dashboard: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Carica lista utenti
  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': authHeader }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('❌ Errore caricamento utenti:', error);
    }
  };


  // Carica tutti i dati all'avvio
  useEffect(() => {
    loadDashboardStats();
    loadUsers();
  }, []);

  // Formatta numeri
  const formatNumber = (num) => {
    return new Intl.NumberFormat('it-IT').format(num);
  };

  // Formatta data
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-800 mb-2">Accesso Negato</h2>
          <p className="text-red-600">
            Questa sezione è riservata agli amministratori del sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Admin */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange rounded-xl">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-fradiavolo-charcoal">
              Dashboard Amministratore
            </h1>
            <p className="text-fradiavolo-charcoal-light flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Vista Globale - Tutti i Negozi Fradiavolo</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadDashboardStats}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Aggiorna</span>
          </button>
          
          {/* Badge Admin */}
          <div className="px-3 py-1 bg-gradient-to-r from-fradiavolo-red to-fradiavolo-orange text-white rounded-full text-xs font-bold uppercase tracking-wide">
            ADMIN
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30 flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Panoramica - Solo questa sezione rimane */}
      <div className="space-y-6">
        {/* KPI Cards */}
        {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Fatture Totali */}
            <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-fradiavolo-green/10 rounded-xl">
                  <FileText className="h-6 w-6 text-fradiavolo-green" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-fradiavolo-charcoal">
                    {formatNumber(dashboardStats.invoices.total)}
                  </p>
                  <p className="text-sm text-fradiavolo-charcoal-light">Fatture Totali</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-fradiavolo-charcoal-light">Consegnate:</span>
                  <span className="font-medium text-fradiavolo-green">
                    {formatNumber(dashboardStats.invoices.consegnate)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-fradiavolo-charcoal-light">In Consegna:</span>
                  <span className="font-medium text-fradiavolo-orange">
                    {formatNumber(dashboardStats.invoices.pending)}
                  </span>
                </div>
              </div>
            </div>

            {/* Movimentazioni */}
            <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-fradiavolo-orange/10 rounded-xl">
                  <Truck className="h-6 w-6 text-fradiavolo-orange" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-fradiavolo-charcoal">
                    {formatNumber(dashboardStats.movimentazioni.total)}
                  </p>
                  <p className="text-sm text-fradiavolo-charcoal-light">Movimentazioni</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-fradiavolo-charcoal-light">Questo Mese:</span>
                  <span className="font-medium text-fradiavolo-orange">
                    {formatNumber(dashboardStats.movimentazioni.thisMonth)}
                  </span>
                </div>
              </div>
            </div>

            {/* Negozi Attivi */}
            <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-fradiavolo-red/10 rounded-xl">
                  <Store className="h-6 w-6 text-fradiavolo-red" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-fradiavolo-charcoal">
                    {dashboardStats.activeStores.length}
                  </p>
                  <p className="text-sm text-fradiavolo-charcoal-light">Negozi Attivi</p>
                </div>
              </div>
              <div className="text-sm text-fradiavolo-charcoal-light">
                Con attività recente
              </div>
            </div>

            {/* Utenti Sistema */}
            <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-fradiavolo-charcoal/10 rounded-xl">
                  <Users className="h-6 w-6 text-fradiavolo-charcoal" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-fradiavolo-charcoal">
                    {users.length}
                  </p>
                  <p className="text-sm text-fradiavolo-charcoal-light">Utenti Sistema</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-fradiavolo-charcoal-light">Admin:</span>
                  <span className="font-medium text-fradiavolo-red">
                    {users.filter(u => u.role === 'admin').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-fradiavolo-charcoal-light">Operatori:</span>
                  <span className="font-medium text-fradiavolo-charcoal">
                    {users.filter(u => u.role === 'operator').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        

        {/* Recent Activity */}
        {dashboardStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Invoices */}
            <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
              <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-4 flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Attività Fatture Recenti</span>
              </h3>
              <div className="space-y-3">
                {dashboardStats.invoices.recentActivity.slice(0, 5).map((invoice, index) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-fradiavolo-cream/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fradiavolo-charcoal truncate">
                        {invoice.fornitore} - {invoice.numero}
                      </p>
                      <p className="text-xs text-fradiavolo-charcoal-light">
                        {invoice.punto_vendita}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.stato === 'consegnato' 
                          ? 'bg-fradiavolo-green/20 text-fradiavolo-green'
                          : 'bg-fradiavolo-orange/20 text-fradiavolo-orange'
                      }`}>
                        {invoice.stato}
                      </span>
                      <p className="text-xs text-fradiavolo-charcoal-light mt-1">
                        {formatDate(invoice.data_consegna)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Movimentazioni */}
            <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
              <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-4 flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <span>Movimentazioni Recenti</span>
              </h3>
              <div className="space-y-3">
                {dashboardStats.movimentazioni.recentActivity.slice(0, 5).map((movimento, index) => (
                  <div key={movimento.id} className="flex items-center justify-between p-3 bg-fradiavolo-cream/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fradiavolo-charcoal truncate">
                        {movimento.prodotto} - {movimento.quantita} {movimento.unita_misura}
                      </p>
                      <p className="text-xs text-fradiavolo-charcoal-light">
                        {movimento.origine} → {movimento.destinazione}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-fradiavolo-charcoal-light">
                        {formatDate(movimento.data_movimento)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Store Performance */}
        {dashboardStats && Object.keys(dashboardStats.invoices.byStore).length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-fradiavolo-cream-dark shadow-fradiavolo">
            <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-4 flex items-center space-x-2">
              <Store className="h-5 w-5" />
              <span>Performance per Negozio</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(dashboardStats.invoices.byStore)
                .sort(([,a], [,b]) => b.total - a.total)
                .slice(0, 6)
                .map(([store, stats]) => (
                  <div key={store} className="p-4 bg-fradiavolo-cream/30 rounded-lg">
                    <h4 className="font-medium text-fradiavolo-charcoal mb-2 truncate">
                      {store}
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-fradiavolo-charcoal-light">Totali:</span>
                        <span className="font-medium">{stats.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-fradiavolo-charcoal-light">Consegnate:</span>
                        <span className="text-fradiavolo-green font-medium">{stats.consegnate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-fradiavolo-charcoal-light">Pending:</span>
                        <span className="text-fradiavolo-orange font-medium">{stats.pending}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-red mx-auto mb-4"></div>
            <p className="text-fradiavolo-charcoal font-medium">Caricamento dati...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
