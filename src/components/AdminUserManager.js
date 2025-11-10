import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Filter, 
  RefreshCw, 
  Download, 
  Eye, 
  Edit3, 
  Check, 
  X,
  Plus,
  Shield, 
  Store, 
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Mail,
  Save,
  Activity
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AdminUserManager = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtri
  const [filters, setFilters] = useState({
    role: 'ALL',
    store: 'ALL',
    status: 'ALL',
    searchTerm: ''
  });

  // UI States
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  // Modal States
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState({});
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    puntoVendita: '',
    role: 'operator'
  });

  // Carica utenti (useCallback per evitare warning 'exhaustive-deps')
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token non disponibile');
        return;
      }

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}`);
      }

      const data = await response.json();
      console.log('👥 Utenti caricati:', data.users);
      setUsers(data.users || []);

    } catch (error) {
      console.error('❌ Errore caricamento utenti:', error);
      setError('Errore nel caricamento degli utenti: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Applica filtri locali
  useEffect(() => {
    let filtered = [...users];

    // Filtro per ruolo
    if (filters.role !== 'ALL') {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    // Filtro per negozio
    if (filters.store !== 'ALL') {
      filtered = filtered.filter(user => 
        user.puntoVendita && user.puntoVendita.toLowerCase().includes(filters.store.toLowerCase())
      );
    }

    // Filtro ricerca generale
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        (user.name && user.name.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.puntoVendita && user.puntoVendita.toLowerCase().includes(searchLower))
      );
    }

    // Ordinamento
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? '';
        let bVal = b[sortConfig.key] ?? '';

        // Per ID numerico
        if (sortConfig.key === 'id') {
          aVal = parseInt(aVal) || 0;
          bVal = parseInt(bVal) || 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredUsers(filtered);
  }, [users, filters, sortConfig]);

  // Aggiorna filtro
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Reset filtri
  const resetFilters = () => {
    setFilters({
      role: 'ALL',
      store: 'ALL',
      status: 'ALL',
      searchTerm: ''
    });
  };

  // Ordinamento colonne
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Selezione utenti
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  // Mostra dettagli utente
  const showUserDetails = (userData) => {
    setSelectedUser(userData);
    setShowDetailsModal(true);
  };

  // Modifica utente
  const startEditUser = (userData) => {
    setEditingUser({ ...userData });
    setShowEditModal(true);
  };

  // Salva modifiche utente
  const saveUserChanges = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Validazioni
      if (!editingUser.name || editingUser.name.trim() === '') {
        setError('Nome richiesto');
        return;
      }
      
      if (!editingUser.email || !editingUser.email.includes('@')) {
        setError('Email valida richiesta');
        return;
      }

      // TODO: Implementare API per aggiornamento utente
      // const token = localStorage.getItem('token');
      // const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      // const response = await fetch(`${API_BASE_URL}/admin/users/${editingUser.id}`, {
      //   method: 'PUT',
      //   headers: {
      //     'Authorization': authHeader,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify(editingUser)
      // });

      // Simulazione update lato client
      setUsers(prev => prev.map(user => 
        user.id === editingUser.id ? editingUser : user
      ));

      setSuccess(`✅ Utente "${editingUser.name}" aggiornato con successo!`);
      setShowEditModal(false);
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('❌ Errore aggiornamento utente:', error);
      setError('Errore nell\'aggiornamento: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Crea nuovo utente
  const createNewUser = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Validazioni
      if (!newUser.name || newUser.name.trim() === '') {
        setError('Nome richiesto');
        return;
      }
      
      if (!newUser.email || !newUser.email.includes('@fradiavolopizzeria.com')) {
        setError('Email aziendale richiesta (@fradiavolopizzeria.com)');
        return;
      }
      
      if (!newUser.password || newUser.password.length < 6) {
        setError('Password di almeno 6 caratteri richiesta');
        return;
      }
      
      if (!newUser.puntoVendita || newUser.puntoVendita.trim() === '') {
        setError('Punto vendita richiesto');
        return;
      }

      // Verifica email duplicata
      if (users.some(user => user.email === newUser.email)) {
        setError('Email già in uso');
        return;
      }

      // TODO: Implementare API per creazione utente

      // Simulazione creazione lato client
      const nextIdBase = users.length ? Math.max(...users.map(u => Number(u.id) || 0)) : 0;
      const newUserWithId = {
        ...newUser,
        id: nextIdBase + 1,
        permissions: newUser.role === 'admin' ? ['all'] : []
      };

      setUsers(prev => [...prev, newUserWithId]);
      setSuccess(`✅ Utente "${newUser.name}" creato con successo!`);
      setShowNewUserModal(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        puntoVendita: '',
        role: 'operator'
      });
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('❌ Errore creazione utente:', error);
      setError('Errore nella creazione: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Export utenti selezionati
  const exportSelectedUsers = () => {
    if (selectedUsers.length === 0) {
      setError('Seleziona almeno un utente per l\'export');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const selectedData = filteredUsers.filter(user => selectedUsers.includes(user.id));
    
    // Rimuovi password dall'export per sicurezza
    const safeData = selectedData.map(({ password, ...user }) => user);
    
    const dataStr = JSON.stringify({
      exportDate: new Date().toISOString(),
      exportedBy: user.email,
      filters: filters,
      users: safeData
    }, null, 2);

    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `utenti_selezionati_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(`✅ Export di ${selectedUsers.length} utenti completato!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Carica dati all'avvio (nessun warning)
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Formattazione
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4 text-fradiavolo-red" />;
      case 'operator':
        return <Users className="h-4 w-4 text-fradiavolo-charcoal" />;
      default:
        return <Users className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    }
  };

  const getRoleBadge = (role) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium border";
    switch (role) {
      case 'admin':
        return `${baseClasses} bg-fradiavolo-red/10 text-fradiavolo-red border-fradiavolo-red/30`;
      case 'operator':
        return `${baseClasses} bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal border-fradiavolo-charcoal/30`;
      default:
        return `${baseClasses} bg-fradiavolo-charcoal/10 text-fradiavolo-charcoal border-fradiavolo-charcoal/30`;
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="h-4 w-4 text-fradiavolo-charcoal-light" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-fradiavolo-charcoal" />
      : <ChevronDown className="h-4 w-4 text-fradiavolo-charcoal" />;
  };

  // Lista negozi unica per select
  const uniqueStores = [...new Set(users.map(user => user.puntoVendita))].filter(Boolean).sort();

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
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
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fradiavolo-charcoal mb-2">
            👥 Gestione Utenti Sistema
          </h1>
          <p className="text-fradiavolo-charcoal-light">
            Vista amministratore - Tutti gli utenti del sistema Fradiavolo
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-gradient-to-r from-fradiavolo-charcoal to-fradiavolo-red text-white rounded-full text-xs font-bold uppercase tracking-wide">
            ADMIN
          </div>
          <button
            onClick={() => setShowNewUserModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-green text-white rounded-lg hover:bg-fradiavolo-green-dark transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Nuovo Utente</span>
          </button>
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-fradiavolo-charcoal hover:text-fradiavolo-charcoal-dark transition-colors disabled:opacity-50 hover:bg-fradiavolo-cream rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-xl border bg-fradiavolo-green/10 text-fradiavolo-green-dark border-fradiavolo-green/30 flex items-center space-x-3">
          <Check className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Filtri */}
      <div className="mb-6 bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo">
        {/* Filtri Base */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-fradiavolo-charcoal" />
            <span className="text-sm font-semibold text-fradiavolo-charcoal">Filtri</span>
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <span className="px-2 py-1 bg-fradiavolo-charcoal text-white text-xs rounded-full">
                Attivi
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {Object.values(filters).some(v => v !== '' && v !== 'ALL') && (
              <button
                onClick={resetFilters}
                className="text-xs text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors"
              >
                Reset filtri
              </button>
            )}
          </div>
        </div>

        {/* Ricerca rapida */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-fradiavolo-charcoal-light" />
            <input
              type="text"
              placeholder="Cerca per nome, email o punto vendita..."
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-charcoal focus:border-fradiavolo-charcoal transition-colors"
            />
          </div>
        </div>

        {/* Filtri rapidi */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Ruolo</label>
            <select
              value={filters.role}
              onChange={(e) => updateFilter('role', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-charcoal focus:border-fradiavolo-charcoal transition-colors"
            >
              <option value="ALL">Tutti i ruoli</option>
              <option value="admin">Amministratori ({users.filter(u => u.role === 'admin').length})</option>
              <option value="operator">Operatori ({users.filter(u => u.role === 'operator').length})</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-fradiavolo-charcoal mb-2">Punto Vendita</label>
            <select
              value={filters.store}
              onChange={(e) => updateFilter('store', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-charcoal focus:border-fradiavolo-charcoal transition-colors"
            >
              <option value="ALL">Tutti i punti vendita</option>
              {uniqueStores.map(store => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Azioni Bulk */}
      {selectedUsers.length > 0 && (
        <div className="mb-4 bg-fradiavolo-cream rounded-xl p-4 border border-fradiavolo-cream-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-fradiavolo-charcoal">
                {selectedUsers.length} utenti selezionati
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={exportSelectedUsers}
                className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-charcoal text-white rounded-lg hover:bg-fradiavolo-charcoal-light transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistiche rapide */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">{filteredUsers.length}</p>
          <p className="text-sm text-fradiavolo-charcoal-light">Utenti Totali</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-red">
            {filteredUsers.filter(user => user.role === 'admin').length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Amministratori</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">
            {filteredUsers.filter(user => user.role === 'operator').length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Operatori</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-fradiavolo-cream-dark shadow-fradiavolo text-center">
          <p className="text-2xl font-bold text-fradiavolo-charcoal">
            {uniqueStores.length}
          </p>
          <p className="text-sm text-fradiavolo-charcoal-light">Punti Vendita</p>
        </div>
      </div>

      {/* Tabella Utenti */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fradiavolo-cream rounded-full mb-4 border border-fradiavolo-cream-dark">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fradiavolo-charcoal"></div>
          </div>
          <h3 className="text-lg font-semibold text-fradiavolo-charcoal mb-2">Caricamento utenti...</h3>
          <p className="text-fradiavolo-charcoal-light">Recupero dati utenti dal sistema</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-fradiavolo-cream rounded-full mb-6 border border-fradiavolo-cream-dark">
            <Users className="h-10 w-10 text-fradiavolo-charcoal-light" />
          </div>
          <h3 className="text-2xl font-bold text-fradiavolo-charcoal mb-3">Nessun utente trovato</h3>
          <p className="text-fradiavolo-charcoal-light text-lg">
            Modifica i filtri per visualizzare gli utenti desiderati
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-fradiavolo border border-fradiavolo-cream-dark overflow-hidden">
          <div className="p-6 border-b border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-fradiavolo-charcoal">
                Utenti ({filteredUsers.length})
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={selectAllUsers}
                  className="rounded border-fradiavolo-cream-dark text-fradiavolo-charcoal focus:ring-fradiavolo-charcoal"
                />
                <span className="text-sm text-fradiavolo-charcoal-light">Seleziona tutto</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fradiavolo-cream/50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={selectAllUsers}
                      className="rounded border-fradiavolo-cream-dark text-fradiavolo-charcoal focus:ring-fradiavolo-charcoal"
                    />
                  </th>
                  {[
                    { key: 'id', label: 'ID' },
                    { key: 'name', label: 'Nome' },
                    { key: 'email', label: 'Email' },
                    { key: 'puntoVendita', label: 'Punto Vendita' },
                    { key: 'role', label: 'Ruolo' }
                  ].map(column => (
                    <th
                      key={column.key}
                      className="px-6 py-3 text-left cursor-pointer hover:bg-fradiavolo-cream/70 transition-colors"
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide">
                          {column.label}
                        </span>
                        {getSortIcon(column.key)}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left">
                    <span className="text-xs font-semibold text-fradiavolo-charcoal uppercase tracking-wide">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fradiavolo-cream-dark">
                {filteredUsers.map((userData) => (
                  <tr key={userData.id} className="hover:bg-fradiavolo-cream/30 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(userData.id)}
                        onChange={() => toggleUserSelection(userData.id)}
                        className="rounded border-fradiavolo-cream-dark text-fradiavolo-charcoal focus:ring-fradiavolo-charcoal"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-fradiavolo-charcoal">
                      #{userData.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(userData.role)}
                        <span className="font-medium text-fradiavolo-charcoal">
                          {userData.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <Mail className="h-3 w-3 text-fradiavolo-charcoal-light" />
                        <span className="text-sm text-fradiavolo-charcoal-light">
                          {userData.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <Store className="h-3 w-3 text-fradiavolo-charcoal-light" />
                        <span className="text-sm text-fradiavolo-charcoal truncate max-w-32">
                          {userData.puntoVendita}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getRoleBadge(userData.role)}>
                        <span className="flex items-center space-x-1">
                          {getRoleIcon(userData.role)}
                          <span className="capitalize">{userData.role}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => showUserDetails(userData)}
                          className="flex items-center space-x-1 px-2 py-1 text-fradiavolo-charcoal hover:text-fradiavolo-charcoal-dark transition-colors text-sm"
                          title="Visualizza dettagli"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => startEditUser(userData)}
                          className="flex items-center space-x-1 px-2 py-1 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors text-sm"
                          title="Modifica utente"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dettagli Utente */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-2xl max-h-[90vh] overflow-hidden border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fradiavolo-charcoal/10 rounded-lg">
                  {getRoleIcon(selectedUser.role)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">Dettagli Utente</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">#{selectedUser.id} - {selectedUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informazioni Base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>Informazioni Personali</span>
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">ID Utente:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">#{selectedUser.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Nome:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">{selectedUser.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Email:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Ruolo:</span>
                      <span className={getRoleBadge(selectedUser.role)}>
                        <span className="flex items-center space-x-1">
                          {getRoleIcon(selectedUser.role)}
                          <span className="capitalize">{selectedUser.role}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center space-x-2">
                    <Store className="h-4 w-4" />
                    <span>Assegnazioni</span>
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-fradiavolo-charcoal-light">Punto Vendita:</span>
                      <span className="text-sm font-medium text-fradiavolo-charcoal">{selectedUser.puntoVendita}</span>
                    </div>
                    {selectedUser.permissions && selectedUser.permissions.length > 0 && (
                      <div>
                        <span className="text-sm text-fradiavolo-charcoal-light block mb-2">Permessi:</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedUser.permissions.map((permission, index) => (
                            <span key={index} className="px-2 py-1 bg-fradiavolo-green/10 text-fradiavolo-green text-xs rounded border border-fradiavolo-green/30">
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistiche attività */}
              <div className="border-t border-fradiavolo-cream-dark pt-6">
                <h4 className="font-semibold text-fradiavolo-charcoal mb-3 flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Statistiche Attività</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-fradiavolo-cream/30 rounded-lg">
                    <p className="text-lg font-bold text-fradiavolo-charcoal">N/A</p>
                    <p className="text-xs text-fradiavolo-charcoal-light">Login Totali</p>
                  </div>
                  <div className="text-center p-3 bg-fradiavolo-cream/30 rounded-lg">
                    <p className="text-lg font-bold text-fradiavolo-charcoal">N/A</p>
                    <p className="text-xs text-fradiavolo-charcoal-light">Ultimo Login</p>
                  </div>
                  <div className="text-center p-3 bg-fradiavolo-cream/30 rounded-lg">
                    <p className="text-lg font-bold text-fradiavolo-charcoal">N/A</p>
                    <p className="text-xs text-fradiavolo-charcoal-light">Azioni Totali</p>
                  </div>
                </div>
                <p className="text-xs text-fradiavolo-charcoal-light mt-2 text-center">
                  Statistiche dettagliate saranno implementate in una versione futura
                </p>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-6 border-t border-fradiavolo-cream-dark">
              <button
                onClick={() => startEditUser(selectedUser)}
                className="flex items-center space-x-2 px-4 py-2 bg-fradiavolo-charcoal text-white rounded-xl hover:bg-fradiavolo-charcoal-light transition-all font-semibold shadow-lg"
              >
                <Edit3 className="h-4 w-4" />
                <span>Modifica Utente</span>
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-fradiavolo-cream text-fradiavolo-charcoal rounded-xl hover:bg-fradiavolo-cream-dark transition-all font-semibold shadow-lg"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Utente */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-2xl max-h-[90vh] overflow-hidden border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fradiavolo-red/10 rounded-lg">
                  <Edit3 className="h-5 w-5 text-fradiavolo-red" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">Modifica Utente</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">#{editingUser.id} - {editingUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); saveUserChanges(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={editingUser.name || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                      placeholder="Es: Mario Rossi"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={editingUser.email || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                      placeholder="mario.rossi@fradiavolopizzeria.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Punto Vendita *
                    </label>
                    <select
                      value={editingUser.puntoVendita || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, puntoVendita: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                      required
                    >
                      <option value="">Seleziona punto vendita...</option>
                      {uniqueStores.map(store => (
                        <option key={store} value={store}>{store}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Ruolo *
                    </label>
                    <select
                      value={editingUser.role || 'operator'}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-red focus:border-fradiavolo-red transition-colors"
                      required
                    >
                      <option value="operator">Operatore</option>
                      <option value="admin">Amministratore</option>
                    </select>
                  </div>
                </div>

                <div className="bg-fradiavolo-cream/30 p-4 rounded-lg border border-fradiavolo-cream-dark">
                  <p className="text-sm text-fradiavolo-charcoal font-semibold mb-2">⚠️ Note sulla Modifica:</p>
                  <ul className="text-sm text-fradiavolo-charcoal-light space-y-1">
                    <li>• La password non può essere modificata da questa interfaccia per sicurezza</li>
                    <li>• I cambiamenti ai ruoli admin richiedono attenzione particolare</li>
                    <li>• L'email deve terminare con @fradiavolopizzeria.com</li>
                  </ul>
                </div>
              </form>
            </div>
            
            <div className="flex justify-between items-center p-6 border-t border-fradiavolo-cream-dark">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 bg-fradiavolo-cream text-fradiavolo-charcoal rounded-xl hover:bg-fradiavolo-cream-dark transition-all font-semibold shadow-lg"
              >
                Annulla
              </button>
              <button
                onClick={saveUserChanges}
                disabled={isLoading || !editingUser.name || !editingUser.email}
                className="flex items-center space-x-2 px-6 py-2 bg-fradiavolo-green text-white rounded-xl hover:bg-fradiavolo-green-dark transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Salva Modifiche</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuovo Utente */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-fradiavolo-lg w-full max-w-2xl max-h-[90vh] overflow-hidden border border-fradiavolo-cream-dark">
            <div className="flex items-center justify-between p-6 border-b border-fradiavolo-cream-dark">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-fradiavolo-green/10 rounded-lg">
                  <Plus className="h-5 w-5 text-fradiavolo-green" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-fradiavolo-charcoal">Nuovo Utente</h3>
                  <p className="text-sm text-fradiavolo-charcoal-light">Crea un nuovo account utente</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewUserModal(false)}
                className="p-2 text-fradiavolo-charcoal hover:text-fradiavolo-red transition-colors hover:bg-fradiavolo-cream rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); createNewUser(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-green focus:border-fradiavolo-green transition-colors"
                      placeholder="Es: Mario Rossi"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Email Aziendale *
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-green focus:border-fradiavolo-green transition-colors"
                      placeholder="mario.rossi@fradiavolopizzeria.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-green focus:border-fradiavolo-green transition-colors"
                      placeholder="Minimo 6 caratteri"
                      required
                      minLength="6"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                      Ruolo *
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-green focus:border-fradiavolo-green transition-colors"
                      required
                    >
                      <option value="operator">Operatore</option>
                      <option value="admin">Amministratore</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-fradiavolo-charcoal mb-2">
                    Punto Vendita *
                  </label>
                  <select
                    value={newUser.puntoVendita}
                    onChange={(e) => setNewUser(prev => ({ ...prev, puntoVendita: e.target.value }))}
                    className="w-full px-3 py-2 border border-fradiavolo-cream-dark rounded-lg focus:ring-2 focus:ring-fradiavolo-green focus:border-fradiavolo-green transition-colors"
                    required
                  >
                    <option value="">Seleziona punto vendita...</option>
                    {uniqueStores.map(store => (
                      <option key={store} value={store}>{store}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-fradiavolo-green/10 p-4 rounded-lg border border-fradiavolo-green/30">
                  <p className="text-sm text-fradiavolo-green font-semibold mb-2">✅ Linee Guida:</p>
                  <ul className="text-sm text-fradiavolo-green space-y-1">
                    <li>• L'email deve terminare con @fradiavolopizzeria.com</li>
                    <li>• La password deve essere di almeno 6 caratteri</li>
                    <li>• Gli amministratori hanno accesso a tutte le funzionalità</li>
                    <li>• Gli operatori hanno accesso solo al loro punto vendita</li>
                  </ul>
                </div>
              </form>
            </div>
            
            <div className="flex justify-between items-center p-6 border-t border-fradiavolo-cream-dark">
              <button
                onClick={() => setShowNewUserModal(false)}
                className="px-6 py-2 bg-fradiavolo-cream text-fradiavolo-charcoal rounded-xl hover:bg-fradiavolo-cream-dark transition-all font-semibold shadow-lg"
              >
                Annulla
              </button>
              <button
                onClick={createNewUser}
                disabled={isLoading || !newUser.name || !newUser.email || !newUser.password || !newUser.puntoVendita}
                className="flex items-center space-x-2 px-6 py-2 bg-fradiavolo-green text-white rounded-xl hover:bg-fradiavolo-green-dark transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Crea Utente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManager;
